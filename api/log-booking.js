/* Splendo - api/log-booking.js
   Standalone endpoint wrapping api/_sheets.js's appendBookingRow(). Not
   called by the frontend anymore - since the card-on-file flow moved the
   booking notification into api/stripe-webhook.js (only fires once a
   booking is actually confirmed), that's now the real call site. Kept
   as a thin, directly-testable endpoint rather than deleted. */

const { appendBookingRow } = require("./_sheets");

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

  try {
    await appendBookingRow(body);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("log-booking error:", err.message);
    res.status(err.message && err.message.indexOf("Sheets append failed") === 0 ? 502 : 500).json({ error: "Sheet write failed" });
  }
};
