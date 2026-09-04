/* Splendo - api/checkout-session.js
   GET endpoint for buchen-success.html: given a session_id (from the
   success_url query string - an unguessable Stripe-generated ID, same
   trust model Stripe itself uses), returns just the reassembled booking
   record so the browser can send the Web3Forms notification client-side
   (see api/stripe-webhook.js for why that can't happen server-side).

   Only returns what the client needs - never the raw Stripe customer/
   session objects, payment method details, etc. */

const Stripe = require("stripe");
const { reassembleBooking } = require("./_metadata");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const sessionId = req.query.session_id;
  if (!sessionId || typeof sessionId !== "string" || sessionId.indexOf("cs_") !== 0) {
    res.status(400).json({ error: "Missing or invalid session_id" });
    return;
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.mode !== "setup" || session.status !== "complete") {
      res.status(404).json({ error: "Session not found or not completed" });
      return;
    }

    const customerId = typeof session.customer === "string" ? session.customer : session.customer.id;
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }

    const booking = reassembleBooking(customer.metadata);
    if (!booking) {
      res.status(404).json({ error: "No booking data for this session" });
      return;
    }

    res.status(200).json({ booking: booking });
  } catch (err) {
    console.error("checkout-session error:", err.message);
    res.status(500).json({ error: "Internal error" });
  }
};
