/* Splendo - api/_email.js
   Sends the booking confirmation email via Resend - server-side, unlike
   Web3Forms's free tier which returns 403 on non-browser calls (see
   api/stripe-webhook.js's header comment). Plain REST call to Resend's
   API, no SDK, so no new npm dependency.

   Required env var: RESEND_API_KEY.
   Optional: BOOKING_NOTIFICATION_EMAIL (default admin@splendo.eu),
   RESEND_FROM_EMAIL (default Resend's shared sandbox sender - swap this
   once splendo.eu is verified as a sending domain in Resend). */

const FIELD_LABELS = [
  ["name", "Name"],
  ["email", "E-Mail"],
  ["telefon", "Telefon"],
  ["adresse", "Adresse"],
  ["postleitzahl", "PLZ"],
  ["bevorzugtes_datum", "Datum"],
  ["bevorzugte_uhrzeit", "Uhrzeit"],
  ["wohnungstyp", "Wohnungstyp"],
  ["art_der_reinigung", "Art der Reinigung"],
  ["haeufigkeit", "Häufigkeit"],
  ["extras", "Extras"],
  ["polstermoebel_sofas", "Polstermöbel/Sofas"],
  ["dringende_anfrage", "Dringende Anfrage"],
  ["reinigungsprodukte_mitbringen", "Reinigungsprodukte"],
  ["geschaetzter_gesamtpreis", "Geschätzter Gesamtpreis"],
  ["rabattcode", "Rabattcode"],
  ["haustiere", "Haustiere"],
  ["notizen", "Notizen"]
];

async function sendBookingEmail(booking) {
  booking = booking || {};
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.BOOKING_NOTIFICATION_EMAIL || "admin@splendo.eu";
  const from = process.env.RESEND_FROM_EMAIL || "Splendo Buchungen <onboarding@resend.dev>";

  const lines = ["Neue Splendo-Buchung (Karte hinterlegt)", ""];
  FIELD_LABELS.forEach(function (pair) {
    lines.push(pair[1] + ": " + (booking[pair[0]] || ""));
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: from,
      to: [to],
      subject: "Neue Splendo-Buchung - " + (booking.name || ""),
      text: lines.join("\n")
    })
  });

  if (!res.ok) {
    throw new Error("Resend send failed: " + res.status + " " + (await res.text()));
  }
}

module.exports = { sendBookingEmail: sendBookingEmail };
