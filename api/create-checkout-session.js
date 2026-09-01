/* Splendo — POST /api/create-checkout-session
   Creates a Stripe Checkout Session with manual capture (the card is
   authorised at booking, charged only after the cleaning is done).
   The browser sends selection identifiers, never a price — the total
   is always computed here, from api/_pricing.js. */

const Stripe = require("stripe");
const { computeTotal } = require("./_pricing");

// TODO (v2): a card authorisation expires after 7 days, which is why online
// booking is capped at MAX_DAYS_AHEAD below. Removing that cap needs a
// Vercel Cron job that authorises the card 6 days before the appointment
// instead of at booking time (store the booking + card intent to authorise
// later, e.g. via a Stripe SetupIntent now and a PaymentIntent created by
// the cron job closer to the date). Not built yet — out of scope for launch.
const MAX_DAYS_AHEAD = 7;
const SITE_URL = "https://splendo.eu";

function berlinTodayISODate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const map = {};
  parts.forEach((p) => { map[p.type] = p.value; });
  return `${map.year}-${map.month}-${map.day}`;
}

function daysBetween(isoA, isoB) {
  const a = new Date(isoA + "T00:00:00Z");
  const b = new Date(isoB + "T00:00:00Z");
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function truncate(value, max) {
  const s = value === undefined || value === null ? "" : String(value);
  return s.length > max ? s.slice(0, max) : s;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error("STRIPE_SECRET_KEY is not configured");
    res.status(500).json({ error: "Payment is not configured yet." });
    return;
  }
  const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const selections = body.selections || {};
  const contact = body.contact || {};
  const labels = body.labels || {};
  const consent = body.consent || {};

  // Required contact fields.
  const requiredFields = ["name", "email", "telefono", "adresse", "plz", "datum", "ora"];
  for (const field of requiredFields) {
    if (!contact[field] || String(contact[field]).trim() === "") {
      res.status(400).json({ error: "Missing required field: " + field });
      return;
    }
  }

  // The § 356 Abs. 4 consent checkbox must have been ticked — the client
  // already gates the submit button on this, but we don't trust the client.
  if (!consent.accepted || !consent.text || !consent.timestamp) {
    res.status(400).json({ error: "Missing withdrawal consent" });
    return;
  }

  // Bookings further out than 7 days can't get a card pre-authorisation
  // that survives to the appointment (holds expire after 7 days) — those
  // go to WhatsApp instead, same as apartments needing a custom quote and
  // recurring frequencies (no fixed one-off total to hold).
  const requestedDate = String(contact.datum || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    res.status(400).json({ error: "Invalid date" });
    return;
  }
  const today = berlinTodayISODate();
  const diff = daysBetween(today, requestedDate);
  if (diff < 0) {
    res.status(400).json({ error: "Date is in the past" });
    return;
  }
  if (diff > MAX_DAYS_AHEAD) {
    res.status(409).json({
      error: "date_too_far",
      message: "Online booking is only available up to 7 days ahead — a card hold can't survive longer than that. Please arrange this date on WhatsApp instead."
    });
    return;
  }

  if (selections.apartment === "4+") {
    res.status(409).json({
      error: "quote_only",
      message: "This apartment size needs a custom quote — please book it on WhatsApp instead."
    });
    return;
  }
  if (selections.recurring === true) {
    res.status(409).json({
      error: "recurring_not_supported",
      message: "Recurring bookings are arranged and priced per visit on WhatsApp, not through online pre-authorisation."
    });
    return;
  }

  let total;
  try {
    total = computeTotal(selections);
  } catch (err) {
    console.error("Pricing error:", err.message);
    res.status(400).json({ error: "Could not price this booking: " + err.message });
    return;
  }

  const metadata = {
    name: truncate(contact.name, 200),
    email: truncate(contact.email, 200),
    telefon: truncate(contact.telefono, 60),
    adresse: truncate(contact.adresse, 300),
    postleitzahl: truncate(contact.plz, 10),
    bevorzugtes_datum: truncate(contact.datum, 20),
    bevorzugte_uhrzeit: truncate(contact.ora, 20),
    haustiere: truncate(contact.haustiere, 200),
    notizen: truncate(contact.notizen, 400),
    rabattcode: truncate(contact.promo, 60),
    wohnungstyp: truncate(labels.wohnungstyp, 100),
    art_der_reinigung: truncate(labels.artDerReinigung, 100),
    haeufigkeit: truncate(labels.haeufigkeit, 100),
    extras: truncate(labels.extras, 450),
    dringende_anfrage: truncate(labels.dringendeAnfrage, 100),
    reinigungsprodukte: truncate(labels.reinigungsprodukte, 100),
    einwilligung_vorzeitiger_beginn_356_bgb: truncate(consent.text, 480),
    einwilligung_zeitstempel: truncate(consent.timestamp, 40)
  };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: contact.email,
      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: Math.round(total * 100),
            product_data: {
              name: "Splendo Reinigung — " + truncate(labels.wohnungstyp, 60) + " (" + truncate(labels.artDerReinigung, 60) + ")",
              description: "Kartenautorisierung. Abgebucht wird erst nach Abschluss der Reinigung."
            }
          },
          quantity: 1
        }
      ],
      payment_intent_data: {
        capture_method: "manual",
        metadata
      },
      metadata,
      success_url: SITE_URL + "/buchen-success.html?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: SITE_URL + "/buchen.html"
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err.message);
    res.status(500).json({ error: "Could not start checkout: " + err.message });
  }
};
