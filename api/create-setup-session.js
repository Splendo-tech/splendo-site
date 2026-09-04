/* Splendo - api/create-setup-session.js
   Creates a Stripe Customer + a Checkout Session in mode:'setup' so the
   customer stores a card with no amount charged or held. Splendo charges
   the saved card by hand from the Stripe Dashboard once the cleaning is
   done - this endpoint's only job is getting a verified card on file and
   a confirmed booking record onto the Customer.

   The booking is only considered real once api/stripe-webhook.js sees
   checkout.session.completed - if the customer abandons the hosted
   Checkout page, nothing here ever notifies anyone. */

const Stripe = require("stripe");
const { computeTotal } = require("./_pricing");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const SUPPORTED_LOCALES = ["de", "en", "it"];
const METADATA_CHUNK_SIZE = 480; // Stripe metadata values cap at 500 chars/value.
const REQUIRED_BOOKING_FIELDS = [
  "name", "email", "telefon", "adresse", "bevorzugtes_datum", "bevorzugte_uhrzeit", "postleitzahl"
];

function siteUrlFromRequest(req) {
  const host = req.headers.host;
  const proto = host && host.indexOf("localhost") !== -1 ? "http" : "https";
  return proto + "://" + host;
}

function chunkString(str, size) {
  const chunks = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.slice(i, i + size));
  }
  return chunks.length ? chunks : [""];
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  } catch (e) {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  const pricing = body.pricing || {};
  const booking = body.booking || {};
  const lang = SUPPORTED_LOCALES.indexOf(body.lang) !== -1 ? body.lang : "de";

  for (const field of REQUIRED_BOOKING_FIELDS) {
    if (!booking[field] || typeof booking[field] !== "string" || !booking[field].trim()) {
      res.status(400).json({ error: "Missing required field: " + field });
      return;
    }
  }

  let priceResult;
  try {
    priceResult = computeTotal(pricing);
  } catch (err) {
    console.error("create-setup-session pricing error:", err.message);
    res.status(400).json({ error: "Invalid selection" });
    return;
  }

  try {
    const bookingRecord = Object.assign({}, booking, {
      geschaetzter_gesamtpreis: priceResult.quoteOnly ? "Preis auf Anfrage" : priceResult.total + "€",
      lang: lang
    });
    const bookingJson = JSON.stringify(bookingRecord);
    const chunks = chunkString(bookingJson, METADATA_CHUNK_SIZE);

    const metadata = {
      booking_chunks: String(chunks.length),
      lang: lang,
      estimated_total_eur: priceResult.quoteOnly ? "quote" : String(priceResult.total),
      apartment: String(booking.wohnungstyp || "").slice(0, 500),
      service_level: String(booking.art_der_reinigung || "").slice(0, 500),
      booking_date: String(booking.bevorzugtes_datum || "").slice(0, 500),
      booking_time: String(booking.bevorzugte_uhrzeit || "").slice(0, 500)
    };
    chunks.forEach(function (chunk, i) {
      metadata["booking_data_" + i] = chunk;
    });

    const customer = await stripe.customers.create({
      name: booking.name,
      email: booking.email,
      phone: booking.telefon,
      metadata: metadata
    });

    const origin = siteUrlFromRequest(req);
    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      payment_method_types: ["card"],
      customer: customer.id,
      locale: lang,
      success_url: origin + "/buchen-success.html?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: origin + "/buchen.html?cancelled=1"
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("create-setup-session error:", err.message);
    res.status(500).json({ error: "Internal error" });
  }
};
