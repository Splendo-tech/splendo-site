/* Splendo - api/_sheets.js
   Appends a booking row to the Google Sheet backup. Shared between
   api/log-booking.js (standalone endpoint, kept for manual/future use)
   and api/stripe-webhook.js (the actual call site in the card-on-file
   flow - only fires once a booking is confirmed, never on an abandoned
   checkout).

   Auth: a Google Cloud service account, signed and exchanged for an
   access token by hand (RS256 JWT via Node's built-in crypto) so this
   needs zero npm dependencies - no googleapis package to install. */

const crypto = require("crypto");

const SHEET_COLUMNS = [
  "server_timestamp", "einwilligung_zeitstempel", "bevorzugtes_datum", "bevorzugte_uhrzeit",
  "name", "email", "telefon", "adresse", "postleitzahl",
  "wohnungstyp", "art_der_reinigung", "haeufigkeit",
  "reinigungsprodukte_mitbringen", "extras", "polstermoebel_sofas", "dringende_anfrage",
  "geschaetzter_gesamtpreis", "rabattcode", "haustiere", "notizen"
];

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function getAccessToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY || "";
  const privateKey = rawKey.includes("\\n") ? rawKey.replace(/\\n/g, "\n") : rawKey;

  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };

  const unsigned = base64url(JSON.stringify(header)) + "." + base64url(JSON.stringify(claims));
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(privateKey);
  const jwt = unsigned + "." + base64url(signature);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });

  if (!res.ok) {
    throw new Error("Token exchange failed: " + res.status + " " + (await res.text()));
  }
  const data = await res.json();
  return data.access_token;
}

/* booking: a plain object with (a subset of) SHEET_COLUMNS as keys. */
async function appendBookingRow(booking) {
  booking = booking || {};
  const row = SHEET_COLUMNS.map(function (key) {
    if (key === "server_timestamp") return new Date().toISOString();
    const value = booking[key];
    return value === undefined || value === null ? "" : String(value);
  });

  const token = await getAccessToken();
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const range = "A:T";
  const url =
    "https://sheets.googleapis.com/v4/spreadsheets/" + sheetId +
    "/values/" + encodeURIComponent(range) + ":append?valueInputOption=USER_ENTERED";

  const appendRes = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ values: [row] })
  });

  if (!appendRes.ok) {
    throw new Error("Sheets append failed: " + appendRes.status + " " + (await appendRes.text()));
  }
}

module.exports = { appendBookingRow: appendBookingRow };
