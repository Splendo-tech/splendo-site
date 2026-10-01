/* Splendo - api/widerruf.js
   Sends the § 356a BGB Eingangsbestätigung for a withdrawal submitted on
   /widerruf.html, via Resend (the "resend" npm package, not the plain
   REST call api/_email.js uses - the Web3Forms flow this replaces broke
   confirmation delivery outright: its free tier silently drops ccemail,
   so the customer never got their required immediate confirmation on a
   durable medium). Scoped to this one form only - the booking flow's
   own Resend email (api/_email.js) is untouched.

   Required env var: RESEND_API_KEY (already set - same one api/_email.js
   and api/stripe-webhook.js use). */

const { Resend } = require("resend");

const FROM = "Splendo <widerruf@splendo.eu>";
const ADMIN_EMAIL = "admin@splendo.eu";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// "01.10.2026, 11:15:32 Uhr" in Europe/Berlin, generated server-side so
// it can't be spoofed or skewed by the visitor's own clock/timezone.
function berlinTimestamp(date) {
  const parts = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).formatToParts(date);
  const map = {};
  parts.forEach(function (p) { map[p.type] = p.value; });
  return map.day + "." + map.month + "." + map.year + ", " + map.hour + ":" + map.minute + ":" + map.second + " Uhr";
}

function buildDeclaration(name, buchung) {
  return "Hiermit widerrufe ich, " + name + ", den mit Splendo abgeschlossenen Vertrag über die Erbringung der Reinigungsleistung (Buchung/Referenz: " + buchung + ").";
}

function buildEmail(fields) {
  const declarationBlock =
    "Name: " + fields.name + "\n" +
    "Buchungsnummer/Referenz: " + fields.buchung + "\n" +
    "E-Mail: " + fields.email + "\n\n" +
    fields.declaration;

  const declarationBlockHtml =
    "Name: " + escapeHtml(fields.name) + "<br>" +
    "Buchungsnummer/Referenz: " + escapeHtml(fields.buchung) + "<br>" +
    "E-Mail: " + escapeHtml(fields.email) + "<br><br>" +
    escapeHtml(fields.declaration);

  const text = [
    "Hallo " + fields.name + ",",
    "",
    "wir haben deinen Widerruf erhalten.",
    "",
    "Eingegangen am: " + fields.timestamp,
    "",
    "Deine Erklärung:",
    declarationBlock,
    "",
    "Bereits geleistete Zahlungen erstatten wir innerhalb von 14 Tagen.",
    "",
    "Team Splendo",
    "",
    "---",
    "",
    "We have received your withdrawal.",
    "",
    "Received on: " + fields.timestamp,
    "",
    "Your declaration:",
    declarationBlock,
    "",
    "Any payments already made will be refunded within 14 days.",
    "",
    "Team Splendo"
  ].join("\n");

  const html = [
    "<p>Hallo " + escapeHtml(fields.name) + ",</p>",
    "<p>wir haben deinen Widerruf erhalten.</p>",
    "<p>Eingegangen am: " + escapeHtml(fields.timestamp) + "</p>",
    "<p>Deine Erklärung:<br>" + declarationBlockHtml + "</p>",
    "<p>Bereits geleistete Zahlungen erstatten wir innerhalb von 14 Tagen.</p>",
    "<p>Team Splendo</p>",
    "<hr>",
    "<p>We have received your withdrawal.</p>",
    "<p>Received on: " + escapeHtml(fields.timestamp) + "</p>",
    "<p>Your declaration:<br>" + declarationBlockHtml + "</p>",
    "<p>Any payments already made will be refunded within 14 days.</p>",
    "<p>Team Splendo</p>"
  ].join("\n");

  return { text: text, html: html };
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

  // Honeypot: a real visitor never fills this field. Answer 200 as if it
  // worked, so a bot gets no signal that it was caught.
  if (body.website) {
    res.status(200).json({ success: true });
    return;
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const buchung = typeof body.buchung === "string" ? body.buchung.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";

  if (!name || !buchung || !email) {
    res.status(400).json({ error: "Missing required field" });
    return;
  }
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: "Invalid email" });
    return;
  }

  const timestamp = berlinTimestamp(new Date());
  const declaration = buildDeclaration(name, buchung);
  const { text, html } = buildEmail({ name: name, buchung: buchung, email: email, timestamp: timestamp, declaration: declaration });

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: [email],
      bcc: [ADMIN_EMAIL],
      replyTo: ADMIN_EMAIL,
      subject: "Eingangsbestätigung deines Widerrufs – Splendo",
      text: text,
      html: html
    });

    if (error || !data) {
      console.error("widerruf: Resend did not confirm send:", error && error.message);
      res.status(500).json({ error: "Send failed" });
      return;
    }

    res.status(200).json({ success: true, timestamp: timestamp, declaration: declaration });
  } catch (err) {
    console.error("widerruf: unexpected error sending confirmation:", err.message);
    res.status(500).json({ error: "Send failed" });
  }
};
