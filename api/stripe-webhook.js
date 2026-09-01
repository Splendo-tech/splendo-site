/* Splendo — POST /api/stripe-webhook
   Confirms the card authorisation succeeded (Checkout Session completed
   with a manual-capture PaymentIntent) — logged server-side as the audit
   trail. Capture/cancel/partial-capture is done later from the Stripe
   Dashboard directly (see AGB § 7); this endpoint only records that the
   hold exists.

   The Web3Forms notification to Mattia is sent from buchen-success.html
   instead of from here — Web3Forms's own docs say server-to-server calls
   aren't supported on the free plan, and in practice Cloudflare blocks
   this endpoint's calls to Web3Forms with a bot challenge (confirmed via
   a real failed delivery: HTTP 403, "Just a moment..."). The success page
   runs in the customer's own browser, same as the regular booking form
   that already works reliably, so it doesn't hit that block.

   TODO: build a simple admin page for capture/cancel/partial-capture
   instead of the Stripe Dashboard, once there's enough booking volume
   to make that worthwhile. Not built yet — zero code needed for launch,
   the Dashboard does this today. */

const Stripe = require("stripe");

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
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
          console.log(
            "Authorisation confirmed: " + paymentIntentId +
            ", " + (paymentIntent.amount / 100).toFixed(2) + " " + paymentIntent.currency.toUpperCase() +
            ", held (not charged). Customer: " + (session.metadata && session.metadata.email)
          );
        } else {
          console.warn("checkout.session.completed but PaymentIntent status is " + paymentIntent.status + ", not requires_capture");
        }
      }
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook handling error:", err.message);
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
