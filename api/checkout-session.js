/* Splendo — GET /api/checkout-session?session_id=...
   Read-only lookup used by buchen-success.html to show the confirmed
   held amount and appointment details — never trust the URL alone,
   always confirm against Stripe's own record. */

const Stripe = require("stripe");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    res.status(500).json({ error: "Payment is not configured yet." });
    return;
  }
  const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });

  const sessionId = req.query && req.query.session_id;
  if (!sessionId || typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
    res.status(400).json({ error: "Invalid session id" });
    return;
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"]
    });
    const pi = session.payment_intent;
    res.status(200).json({
      amount: pi ? pi.amount : session.amount_total,
      currency: pi ? pi.currency : session.currency,
      status: pi ? pi.status : session.payment_status,
      datum: session.metadata ? session.metadata.bevorzugtes_datum : null,
      uhrzeit: session.metadata ? session.metadata.bevorzugte_uhrzeit : null,
      wohnungstyp: session.metadata ? session.metadata.wohnungstyp : null
    });
  } catch (err) {
    console.error("checkout-session lookup error:", err.message);
    res.status(404).json({ error: "Session not found" });
  }
};
