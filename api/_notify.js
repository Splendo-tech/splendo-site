/* Splendo - api/_notify.js
   Sends the booking notification to Web3Forms. This used to fire directly
   from the browser on form submit (booking.js); it now fires from
   api/stripe-webhook.js only after checkout.session.completed, so an
   abandoned checkout never generates a notification.

   The access key below is Web3Forms' public "form identifier", not a
   secret - it was already shipped in plain client-side JS in booking.js
   for as long as this form has existed, so moving it server-side isn't
   protecting anything new. */

const WEB3FORMS_ACCESS_KEY = "476e51d4-8223-4645-b4b2-04755e570b05";

/* booking: the same field-name shape booking.js used to build client-side
   (wohnungstyp, art_der_reinigung, bevorzugtes_datum, ... - all already
   German-labeled strings ready to send as-is). */
async function notifyWeb3Forms(booking) {
  booking = booking || {};
  const payload = Object.assign({
    access_key: WEB3FORMS_ACCESS_KEY,
    subject: "Neue Splendo-Buchung (Karte hinterlegt) - " + (booking.name || ""),
    from_name: "Splendo Website",
    rechtliche_hinweise: "Datenschutz: https://splendo.eu/datenschutz.html - AGB & Widerrufsbelehrung: https://splendo.eu/agb.html - Widerruf online: https://splendo.eu/widerruf.html"
  }, booking);

  const res = await fetch("https://api.web3forms.com/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(function () { return {}; });
  if (!data.success) {
    throw new Error("Web3Forms send failed: " + (data.message || res.status));
  }
}

module.exports = { notifyWeb3Forms: notifyWeb3Forms };
