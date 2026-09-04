/* Splendo - api/_pricing.js
   Server-side mirror of the price table encoded in buchen.html's option
   inputs (data-price / data-multiplier attributes) and computed by
   booking.js's renderSummary(). This is the ONLY price the booking flow
   trusts - whatever the client sends is recomputed from scratch here.

   Keep this in sync by hand whenever a price changes in buchen.html -
   there's no single source of truth to generate both from. */

const APARTMENT_PRICES = {
  "Studio": 79,
  "2-Zimmer": 99,
  "3-Zimmer": 129
  // "4+" is quote-only (no fixed price) - handled separately below.
};

const SERVICE_LEVEL_MULTIPLIERS = {
  "Standardreinigung": 1,
  "Grundreinigung": 1.3,
  "Einzugsreinigung": 1.3,
  "Endreinigung": 1.5
};

const EXTRA_PRICES = {
  "Englischsprachiger Cleaner": 0,
  "Backofen": 20,
  "Dunstabzugshaube": 16,
  "Kühlschrank (innen)": 15,
  "Mikrowelle": 9,
  "Küchenschrank (innen)": 60,
  "Geschirr von Hand": 10,
  "Balkon/Terrasse": 15,
  "Bügeln": 28,
  "Kleiderschrank (Inneres aufräumen)": 13,
  "Tierstreu": 4
};

const COUNTER_UNIT_PRICES = {
  "finestre": 15,
  "ore-extra": 28
};

const URGENT_PRICE = 56;
const PRODUCTS_PRICE = 18;

/* selections shape:
   {
     apartment: "Studio" | "2-Zimmer" | "3-Zimmer" | "4+",
     serviceLevel: "Standardreinigung" | "Grundreinigung" | "Einzugsreinigung" | "Endreinigung",
     extras: string[],                 // values matching EXTRA_PRICES keys
     counters: { finestre?: number, "ore-extra"?: number },
     urgent: boolean,
     products: boolean
   }
   Throws on any unrecognized key - fail closed rather than silently
   under-charging on a typo'd or tampered value. */
function computeTotal(selections) {
  selections = selections || {};
  let total = 0;
  let quoteOnly = false;

  if (selections.apartment === "4+") {
    quoteOnly = true;
  } else if (Object.prototype.hasOwnProperty.call(APARTMENT_PRICES, selections.apartment)) {
    const base = APARTMENT_PRICES[selections.apartment];
    const multiplier = Object.prototype.hasOwnProperty.call(SERVICE_LEVEL_MULTIPLIERS, selections.serviceLevel)
      ? SERVICE_LEVEL_MULTIPLIERS[selections.serviceLevel]
      : 1;
    total += Math.round(base * multiplier);
  } else {
    throw new Error("Unknown apartment type: " + selections.apartment);
  }

  const extras = Array.isArray(selections.extras) ? selections.extras : [];
  extras.forEach(function (key) {
    if (!Object.prototype.hasOwnProperty.call(EXTRA_PRICES, key)) {
      throw new Error("Unknown extra: " + key);
    }
    total += EXTRA_PRICES[key];
  });

  const counters = selections.counters || {};
  Object.keys(counters).forEach(function (key) {
    if (!Object.prototype.hasOwnProperty.call(COUNTER_UNIT_PRICES, key)) {
      throw new Error("Unknown counter: " + key);
    }
    const qty = Number(counters[key]);
    if (!Number.isFinite(qty) || qty < 0 || !Number.isInteger(qty)) {
      throw new Error("Invalid counter quantity for " + key);
    }
    total += COUNTER_UNIT_PRICES[key] * qty;
  });

  if (selections.urgent) total += URGENT_PRICE;
  if (selections.products) total += PRODUCTS_PRICE;

  return { total: total, quoteOnly: quoteOnly };
}

module.exports = {
  APARTMENT_PRICES: APARTMENT_PRICES,
  SERVICE_LEVEL_MULTIPLIERS: SERVICE_LEVEL_MULTIPLIERS,
  EXTRA_PRICES: EXTRA_PRICES,
  COUNTER_UNIT_PRICES: COUNTER_UNIT_PRICES,
  URGENT_PRICE: URGENT_PRICE,
  PRODUCTS_PRICE: PRODUCTS_PRICE,
  computeTotal: computeTotal
};
