/* Splendo — POST /api/stripe-webhook
   Confirms the card authorisation succeeded (Checkout Session completed
   with a manual-capture PaymentIntent) and forwards the booking, plus
   the PaymentIntent ID, to Web3Forms — the same inbox Mattia already
   uses for every other booking. Capture/cancel/partial-capture is done
   later from the Stripe Dashboard directly (see AGB § 7); this endpoint
   only records that the hold exists.

   TODO: build a simple admin page for capture/cancel/partial-capture
   instead of the Stripe Dashboard, once there's enough booking volume
   to make that worthwhile. Not built yet — zero code needed for launch,
   the Dashboard does this today. */

const Stripe = require("stripe");

const WEB3FORMS_ACCESS_KEY = "476e51d4-8223-4645-b4b2-04755e570b05";

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function notifyWeb3Forms(session, paymentIntentId, amountHeld) {
  const md = session.metadata || {};
  const payload = {
    access_key: WEB3FORMS_ACCESS_KEY,
    subject: "Karte autorisiert — " + (md.name || "Splendo-Buchung"),
    from_name: "Splendo Website — Stripe",
    name: md.name || "",
    email: md.email || "",
    telefon: md.telefon || "",
    adresse: md.adresse || "",
    postleitzahl: md.postleitzahl || "",
    wohnungstyp: md.wohnungstyp || "",
    art_der_reinigung: md.art_der_reinigung || "",
    haeufigkeit: md.haeufigkeit || "",
    extras: md.extras || "Keine",
    dringende_anfrage: md.dringende_anfrage || "Nein",
    reinigungsprodukte: md.reinigungsprodukte || "Nein",
    rabattcode: md.rabattcode || "Kein Rabattcode",
    bevorzugtes_datum: md.bevorzugtes_datum || "",
    bevorzugte_uhrzeit: md.bevorzugte_uhrzeit || "",
    haustiere: md.haustiere || "Keine Angabe",
    notizen: md.notizen || "",
    einwilligung_vorzeitiger_beginn_356_bgb: md.einwilligung_vorzeitiger_beginn_356_bgb || "",
    einwilligung_zeitstempel: md.einwilligung_zeitstempel || "",
    stripe_payment_intent_id: paymentIntentId,
    stripe_betrag_gehalten: (amountHeld / 100).toFixed(2) + " €",
    stripe_status: "Karte autorisiert (Betrag gehalten, noch nicht abgebucht). Abbuchen im Stripe-Dashboard nach Serviceabschluss.",
    rechtliche_hinweise: "Datenschutz: https://splendo.eu/datenschutz.html — AGB & Widerrufsbelehrung: https://splendo.eu/agb.html — Widerruf online: https://splendo.eu/widerruf.html"
  };

  const res = await fetch("https://api.web3forms.com/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload)
  });

  // Web3Forms is expected to return JSON, but under rate-limiting or an
  // outage it can return an HTML page instead — read as text first so a
  // non-JSON response produces a clear, diagnosable error instead of an
  // opaque JSON.parse crash. Stripe retries this webhook on a non-2xx
  // response, so throwing here (rather than swallowing the failure) is
  // deliberate — it gives a transient Web3Forms problem a chance to clear
  // before the notification is lost for good.
  const rawText = await res.text();
  let data;
  try {
    data = JSON.parse(rawText);
  } catch (e) {
    throw new Error(
      "Web3Forms returned a non-JSON response (HTTP " + res.status + "): " + rawText.slice(0, 200)
    );
  }
  if (!data.success) {
    throw new Error("Web3Forms notification failed: " + (data.message || "unknown error"));
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!webhookSecret || !secretKey) {
    console.error("Stripe webhook is not configured (missing env vars)");
    res.status(500).send("Webhook not configured");
    return;
  }
  const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });

  const signature = req.headers["stripe-signature"];
  let event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    res.status(400).send("Webhook signature verification failed");
    return;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const paymentIntentId = typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent && session.payment_intent.id);

      if (paymentIntentId) {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent.status === "requires_capture") {
          // This is the manual-capture authorisation succeeding — the
          // card has a hold, nothing has been charged yet.
          await notifyWeb3Forms(session, paymentIntentId, paymentIntent.amount);
        } else {
          console.warn("checkout.session.completed but PaymentIntent status is " + paymentIntent.status + ", not requires_capture — skipping notification");
        }
      }
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook handling error:", err.message);
    // Respond 500 so Stripe retries delivery — the authorisation itself
    // already succeeded on Stripe's side either way, this only affects
    // whether Mattia's notification email goes out.
    res.status(500).json({ error: err.message });
  }
};

// Must be set on module.exports AFTER the handler is assigned above —
// assigning module.exports = fn would otherwise wipe out a .config set
// earlier. Vercel needs this to skip its default JSON body parsing, since
// Stripe signature verification requires the exact raw request bytes.
module.exports.config = {
  api: { bodyParser: false }
};
