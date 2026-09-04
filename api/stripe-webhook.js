/* Splendo - api/stripe-webhook.js
   Verifies the Stripe webhook signature and, on checkout.session.completed
   for a mode:'setup' session, makes the saved card the customer's default
   payment method and fires the booking notifications (Web3Forms + Sheets
   backup) - this is the ONLY place those fire from in the card-on-file
   flow, specifically so an abandoned checkout never notifies anyone.

   Idempotent: Stripe redelivers events (retries, duplicate webhooks), so
   this checks a "already processed this session" marker on the Customer
   before doing any of the one-time work, and is safe to run twice for
   the same session.id.

   Needs the raw request body for signature verification, so Vercel's
   default JSON body-parsing is disabled below - via `module.exports.config`,
   which MUST be set AFTER `module.exports = handler`, not before, or the
   assignment silently gets discarded and bodyParser stays on. (This bit
   this exact codebase once already, on the pre-auth branch - see git
   history if you're wondering why this comment is so specific.) */

const Stripe = require("stripe");
const { notifyWeb3Forms } = require("./_notify");
const { appendBookingRow } = require("./_sheets");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function getRawBody(req) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    req.on("data", function (chunk) { chunks.push(chunk); });
    req.on("end", function () { resolve(Buffer.concat(chunks)); });
    req.on("error", reject);
  });
}

function reassembleBooking(customerMetadata) {
  const chunkCount = parseInt(customerMetadata.booking_chunks || "0", 10);
  let json = "";
  for (let i = 0; i < chunkCount; i++) {
    json += customerMetadata["booking_data_" + i] || "";
  }
  try {
    return JSON.parse(json);
  } catch (e) {
    console.error("stripe-webhook: failed to reassemble booking metadata:", e.message);
    return null;
  }
}

async function handleSetupCompleted(session) {
  const customerId = typeof session.customer === "string" ? session.customer : session.customer.id;
  const customer = await stripe.customers.retrieve(customerId);

  if (customer.deleted) {
    console.error("stripe-webhook: customer was deleted, skipping", customerId);
    return;
  }

  if (customer.metadata.processed_session_id === session.id) {
    // Already handled this exact session (Stripe retry) - no-op.
    return;
  }

  const setupIntentId = typeof session.setup_intent === "string" ? session.setup_intent : session.setup_intent.id;
  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
  const paymentMethodId = setupIntent.payment_method;

  if (!paymentMethodId) {
    console.error("stripe-webhook: setup_intent has no payment_method", setupIntentId, setupIntent.status);
    return;
  }

  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
    metadata: Object.assign({}, customer.metadata, { processed_session_id: session.id })
  });

  const booking = reassembleBooking(customer.metadata);
  if (!booking) {
    console.error("stripe-webhook: no usable booking data for customer", customerId);
    return;
  }

  const results = await Promise.allSettled([
    notifyWeb3Forms(booking),
    appendBookingRow(booking)
  ]);
  results.forEach(function (result, i) {
    if (result.status === "rejected") {
      console.error("stripe-webhook: notification step " + i + " failed:", result.reason && result.reason.message);
    }
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const signature = req.headers["stripe-signature"];
  let event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("stripe-webhook: signature verification failed:", err.message);
    res.status(400).send("Webhook Error: " + err.message);
    return;
  }

  if (event.type !== "checkout.session.completed") {
    res.status(200).json({ received: true, ignored: event.type });
    return;
  }

  const session = event.data.object;
  if (session.mode !== "setup") {
    res.status(200).json({ received: true, ignored: "mode:" + session.mode });
    return;
  }

  try {
    await handleSetupCompleted(session);
    res.status(200).json({ received: true });
  } catch (err) {
    console.error("stripe-webhook: processing error:", err.message);
    // Non-2xx makes Stripe retry the event - correct here, since this
    // branch means we don't yet know if the payment method got attached.
    res.status(500).json({ error: "Processing failed" });
  }
};

module.exports.config = { api: { bodyParser: false } };
