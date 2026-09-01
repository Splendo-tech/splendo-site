/* Splendo — server-side price table.
   This is the ONLY place the total may be computed. The browser sends
   selection identifiers (which apartment, which service level, which
   extras...), never a price — see api/create-checkout-session.js. */

const APARTMENT_PRICES = {
  studio: 79,
  "2-zimmer": 99,
  "3-zimmer": 129
  // "4+" has no fixed price (Preis auf Anfrage) — handled separately,
  // never routed through the online payment flow.
};

const SERVICE_LEVEL_MULTIPLIERS = {
  standardreinigung: 1,
  grundreinigung: 1.3,
  einzugsreinigung: 1.3,
  endreinigung: 1.5
};

const EXTRA_PRICES = {
  englischsprachiger_cleaner: 0,
  backofen: 20,
  dunstabzugshaube: 16,
  kuehlschrank: 15,
  mikrowelle: 9,
  kuechenschrank: 60,
  geschirr_von_hand: 10,
  balkon_terrasse: 15,
  buegeln: 28,
  kleiderschrank: 13,
  tierstreu: 4
};

// Counter-type extras: price is per unit, quantity comes from the client
// (quantity is not sensitive — it only ever multiplies a server-side unit price).
const COUNTER_EXTRA_UNIT_PRICES = {
  finestre: 15,
  "ore-extra": 28
};

const URGENT_SURCHARGE = 56;
const PRODUCTS_SURCHARGE = 18;

/**
 * Computes the total in whole euros from a selections object. Throws on
 * any unrecognised or missing key rather than silently defaulting —
 * an unrecognised selection must never fall back to "free".
 *
 * selections shape:
 * {
 *   apartment: "studio" | "2-zimmer" | "3-zimmer",
 *   serviceLevel: "standardreinigung" | "grundreinigung" | "einzugsreinigung" | "endreinigung",
 *   extras: string[],                 // keys into EXTRA_PRICES, each counted once
 *   counters: { finestre?: number, ore_extra?: number },
 *   urgent: boolean,
 *   products: boolean
 * }
 */
function computeTotal(selections) {
  if (!selections || typeof selections !== "object") {
    throw new Error("Missing selections");
  }

  const apartmentKey = String(selections.apartment || "").toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(APARTMENT_PRICES, apartmentKey)) {
    throw new Error("Unknown or unsupported apartment type: " + selections.apartment);
  }
  const basePrice = APARTMENT_PRICES[apartmentKey];

  const levelKey = String(selections.serviceLevel || "").toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(SERVICE_LEVEL_MULTIPLIERS, levelKey)) {
    throw new Error("Unknown service level: " + selections.serviceLevel);
  }
  const multiplier = SERVICE_LEVEL_MULTIPLIERS[levelKey];

  let total = Math.round(basePrice * multiplier);

  const extras = Array.isArray(selections.extras) ? selections.extras : [];
  for (const extraKey of extras) {
    const key = String(extraKey).toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(EXTRA_PRICES, key)) {
      throw new Error("Unknown extra: " + extraKey);
    }
    total += EXTRA_PRICES[key];
  }

  const counters = selections.counters || {};
  for (const counterKey of Object.keys(counters)) {
    const key = String(counterKey).toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(COUNTER_EXTRA_UNIT_PRICES, key)) {
      throw new Error("Unknown counter extra: " + counterKey);
    }
    const qty = Number(counters[counterKey]);
    if (!Number.isInteger(qty) || qty < 0 || qty > 20) {
      throw new Error("Invalid quantity for " + counterKey);
    }
    total += COUNTER_EXTRA_UNIT_PRICES[key] * qty;
  }

  if (selections.urgent === true) {
    total += URGENT_SURCHARGE;
  }
  if (selections.products === true) {
    total += PRODUCTS_SURCHARGE;
  }

  if (!Number.isFinite(total) || total <= 0) {
    throw new Error("Computed an invalid total");
  }

  return total;
}

module.exports = {
  APARTMENT_PRICES,
  SERVICE_LEVEL_MULTIPLIERS,
  EXTRA_PRICES,
  COUNTER_EXTRA_UNIT_PRICES,
  URGENT_SURCHARGE,
  PRODUCTS_SURCHARGE,
  computeTotal
};
