/* Splendo - api/_metadata.js
   Reassembles the booking record that api/create-setup-session.js chunks
   across Customer metadata keys (Stripe caps each value at 500 chars).
   Shared by api/stripe-webhook.js (Sheets backup) and api/checkout-session.js
   (feeds the client-side Web3Forms notification from buchen-success.html). */

function reassembleBooking(customerMetadata) {
  customerMetadata = customerMetadata || {};
  const chunkCount = parseInt(customerMetadata.booking_chunks || "0", 10);
  let json = "";
  for (let i = 0; i < chunkCount; i++) {
    json += customerMetadata["booking_data_" + i] || "";
  }
  try {
    return JSON.parse(json);
  } catch (e) {
    console.error("_metadata: failed to reassemble booking:", e.message);
    return null;
  }
}

module.exports = { reassembleBooking: reassembleBooking };
