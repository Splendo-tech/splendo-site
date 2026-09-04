/* Splendo - booking.js
   Calcolo prezzo live + invio form di prenotazione via Web3Forms (nessun backend proprio).
   Le etichette mostrate seguono la lingua attiva (lette dal DOM già tradotto da i18n.js).
   L'email interna usa sempre le etichette tedesche (attributo data-de). */

(function () {
  "use strict";

  var form = document.getElementById("booking-form");
  if (!form) return;

  var summaryList = document.getElementById("summary-list");
  var summaryTotalValue = document.getElementById("summary-total-value");
  var summaryTotalBlock = document.getElementById("summary-total-block");
  var summaryRecurring = document.getElementById("summary-recurring");
  var statusEl = document.getElementById("form-status");

  var counters = form.querySelectorAll("[data-counter]");

  function eur(n) {
    return n.toFixed(0) + "€";
  }

  function t(key, fallback) {
    return window.SPLENDO_T ? window.SPLENDO_T(key) : fallback;
  }

  function getSelectedApartment() {
    var input = form.querySelector('input[name="apartment"]:checked');
    if (!input) return null;
    var card = input.closest(".option-card");
    var nameEl = card.querySelector(".option-name");
    var priceEl = card.querySelector(".option-price");
    var isQuote = input.dataset.quote === "true";
    return {
      displayLabel: nameEl ? nameEl.textContent : input.value,
      deLabel: input.dataset.de || input.value,
      price: isQuote ? null : parseFloat(input.dataset.price),
      quoteLabel: isQuote && priceEl ? priceEl.textContent : null,
      isQuote: isQuote
    };
  }

  function getSelectedServiceLevel() {
    var input = form.querySelector('input[name="service-level"]:checked');
    if (!input) return { displayLabel: null, deLabel: null, multiplier: 1 };
    var card = input.closest(".option-card");
    var nameEl = card.querySelector(".option-name");
    return {
      displayLabel: nameEl ? nameEl.textContent : input.value,
      deLabel: input.dataset.de || input.value,
      multiplier: parseFloat(input.dataset.multiplier) || 1
    };
  }

  function getSelectedFrequency() {
    var input = form.querySelector('input[name="frequency"]:checked');
    if (!input) return null;
    var card = input.closest(".option-card");
    var nameEl = card.querySelector(".option-name");
    return {
      displayLabel: nameEl ? nameEl.textContent : input.value,
      deLabel: input.dataset.de || input.value,
      isRecurring: input.dataset.recurring === "true"
    };
  }

  function getCheckedExtras() {
    var nodes = form.querySelectorAll('input[name="extra"]:checked');
    var items = [];
    nodes.forEach(function (node) {
      var nameEl = node.closest(".extra-check").querySelector(".extra-name");
      items.push({
        displayLabel: nameEl ? nameEl.textContent : node.value,
        deLabel: node.dataset.de || node.value,
        price: parseFloat(node.dataset.price)
      });
    });
    return items;
  }

  function getCounterItems() {
    var items = [];
    counters.forEach(function (row) {
      var valueEl = row.querySelector(".counter-value");
      var qty = parseInt(valueEl.dataset.value, 10) || 0;
      if (qty > 0) {
        var unitPrice = parseFloat(row.dataset.price);
        var labelEl = row.querySelector(".extra-name > span:first-child");
        var displayBase = labelEl ? labelEl.textContent : row.dataset.de;
        items.push({
          displayLabel: displayBase + " ×" + qty,
          deLabel: row.dataset.de + " ×" + qty,
          price: unitPrice * qty
        });
      }
    });
    return items;
  }

  function getTappezzeria() {
    var input = document.getElementById("tappezzeria");
    if (!input || !input.checked) return null;
    var nameEl = input.closest(".extra-check").querySelector(".extra-name");
    return {
      displayLabel: nameEl ? nameEl.textContent : input.dataset.de,
      deLabel: input.dataset.de
    };
  }

  function getUrgent() {
    var input = document.getElementById("urgent");
    if (!input || !input.checked) return null;
    return { amount: parseFloat(input.dataset.price), deLabel: input.dataset.de };
  }

  function getProducts() {
    var input = document.getElementById("products");
    if (!input || !input.checked) return null;
    return { amount: parseFloat(input.dataset.price), deLabel: input.dataset.de };
  }

  function renderSummary() {
    var apartment = getSelectedApartment();
    var serviceLevel = getSelectedServiceLevel();
    var frequency = getSelectedFrequency();
    var extras = getCheckedExtras().concat(getCounterItems());
    var tappezzeria = getTappezzeria();
    var products = getProducts();
    var urgent = getUrgent();

    var rows = [];
    var total = 0;

    if (apartment) {
      if (apartment.isQuote) {
        rows.push({ label: apartment.displayLabel, amountLabel: apartment.quoteLabel || "-" });
      } else {
        var adjustedPrice = Math.round(apartment.price * serviceLevel.multiplier);
        total += adjustedPrice;
        rows.push({ label: apartment.displayLabel, amountLabel: eur(apartment.price) });
        if (serviceLevel.multiplier !== 1) {
          var delta = adjustedPrice - apartment.price;
          rows.push({ label: serviceLevel.displayLabel, amountLabel: "+" + eur(delta) });
        }
      }
    }

    extras.forEach(function (item) {
      total += item.price;
      var amountLabel = item.price > 0 ? "+" + eur(item.price) : t("included_label", "Inklusive");
      rows.push({ label: item.displayLabel, amountLabel: amountLabel });
    });

    if (tappezzeria) {
      rows.push({ label: tappezzeria.displayLabel, amountLabel: "-" });
    }

    if (products) {
      total += products.amount;
      rows.push({ label: t("products_label", "Prodotti forniti da noi"), amountLabel: "+" + eur(products.amount) });
    }

    if (urgent) {
      total += urgent.amount;
      rows.push({ label: t("urgent_label", "Richiesta urgente"), amountLabel: "+" + eur(urgent.amount) });
    }

    summaryList.innerHTML = "";
    if (rows.length === 0) {
      var empty = document.createElement("li");
      empty.className = "summary-empty";
      empty.textContent = t("summary_empty", "Seleziona le opzioni per vedere il prezzo");
      summaryList.appendChild(empty);
    } else {
      rows.forEach(function (row) {
        var li = document.createElement("li");
        var label = document.createElement("span");
        label.className = "summary-label";
        label.textContent = row.label;
        var amount = document.createElement("span");
        amount.className = "summary-amount";
        amount.textContent = row.amountLabel;
        li.appendChild(label);
        li.appendChild(amount);
        summaryList.appendChild(li);
      });
    }

    if (frequency && frequency.isRecurring) {
      summaryTotalBlock.hidden = true;
      summaryRecurring.hidden = false;
    } else {
      summaryTotalBlock.hidden = false;
      summaryRecurring.hidden = true;
      summaryTotalValue.textContent = eur(total);
    }
  }

  // ---- Contatori (+/-) ----
  counters.forEach(function (row) {
    var valueEl = row.querySelector(".counter-value");
    row.querySelectorAll(".counter-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var current = parseInt(valueEl.dataset.value, 10) || 0;
        if (btn.dataset.action === "increase") {
          current += 1;
        } else {
          current = Math.max(0, current - 1);
        }
        valueEl.dataset.value = current;
        valueEl.textContent = current;
        renderSummary();
      });
    });
  });

  form.addEventListener("change", renderSummary);
  document.addEventListener("splendo:langchange", renderSummary);
  renderSummary();

  // Precompila il CAP se arriva dal quick-start della Home (?plz=...)
  (function prefillPlz() {
    var params = new URLSearchParams(window.location.search);
    var plz = params.get("plz");
    var plzField = document.getElementById("plz");
    if (plz && plzField) plzField.value = plz;
  })();

  // Ritorno dalla pagina di pagamento Stripe dopo abbandono (cancel_url):
  // la prenotazione non esiste, nessuna notifica è mai partita.
  (function handleCancelledReturn() {
    var params = new URLSearchParams(window.location.search);
    if (params.get("cancelled") !== "1") return;
    statusEl.textContent = t("status_cancelled", "Die Buchung wurde nicht bestätigt - die Karte wurde nicht gespeichert. Du kannst es jederzeit erneut versuchen.");
    statusEl.className = "form-status is-error";
    params.delete("cancelled");
    var newUrl = window.location.pathname + (params.toString() ? "?" + params.toString() : "");
    window.history.replaceState({}, "", newUrl);
  })();

  // ---- Validazione CAP di Berlino (10115–14199) ----
  function isValidBerlinPlz(plz) {
    return /^[0-9]{5}$/.test(plz) && Number(plz) >= 10115 && Number(plz) <= 14199;
  }

  var plzField = document.getElementById("plz");
  var plzError = document.getElementById("plz-error");

  if (plzField) {
    plzField.addEventListener("input", function () {
      plzError.classList.remove("visible");
      plzField.classList.remove("is-invalid");
    });
  }

  // ---- Einwilligung § 356 Abs. 4 BGB (vorzeitiger Beginn der Dienstleistung) ----
  var WIDERRUF_CONSENT_TEXT = "Ich verlange ausdrücklich, dass Splendo mit der Reinigungsleistung vor Ablauf der Widerrufsfrist beginnt. Mir ist bekannt, dass ich mein Widerrufsrecht verliere, sobald die Leistung vollständig erbracht ist.";
  var consentCheckbox = document.getElementById("widerruf-consent");
  var submitBtn = document.getElementById("booking-submit-btn");

  if (consentCheckbox && submitBtn) {
    consentCheckbox.addEventListener("change", function () {
      submitBtn.disabled = !consentCheckbox.checked;
    });
  }

  // ---- Selezioni "grezze" per il ricalcolo prezzo lato server: i value/
  // dataset qui coincidono 1:1 con le chiavi di api/_pricing.js. ----
  function getPricingSelections() {
    var apartmentInput = form.querySelector('input[name="apartment"]:checked');
    var serviceLevelInput = form.querySelector('input[name="service-level"]:checked');
    var extraInputs = form.querySelectorAll('input[name="extra"]:checked');
    var counterValues = {};
    counters.forEach(function (row) {
      var valueEl = row.querySelector(".counter-value");
      var qty = parseInt(valueEl.dataset.value, 10) || 0;
      if (qty > 0) counterValues[row.dataset.counter] = qty;
    });
    var urgentInput = document.getElementById("urgent");
    var productsInput = document.getElementById("products");

    return {
      apartment: apartmentInput ? apartmentInput.value : null,
      serviceLevel: serviceLevelInput ? serviceLevelInput.value : null,
      extras: Array.prototype.map.call(extraInputs, function (n) { return n.value; }),
      counters: counterValues,
      urgent: !!(urgentInput && urgentInput.checked),
      products: !!(productsInput && productsInput.checked)
    };
  }

  // ---- Invio form: crea la Setup Session Stripe e reindirizza al checkout
  // ospitato. La prenotazione esiste solo se la carta viene salvata - non
  // viene inviata nessuna notifica da qui, quella parte la fa il webhook
  // dopo checkout.session.completed. ----
  form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (plzField && !isValidBerlinPlz(plzField.value.trim())) {
      plzError.classList.add("visible");
      plzField.classList.add("is-invalid");
      plzField.focus();
      plzField.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }

    if (consentCheckbox && !consentCheckbox.checked) {
      consentCheckbox.focus();
      consentCheckbox.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }

    statusEl.textContent = t("status_redirecting", "Weiterleitung zur sicheren Zahlungsseite...");
    statusEl.className = "form-status";
    submitBtn.disabled = true;

    var apartment = getSelectedApartment();
    var serviceLevel = getSelectedServiceLevel();
    var frequency = getSelectedFrequency();
    var extras = getCheckedExtras().concat(getCounterItems());
    var tappezzeria = getTappezzeria();
    var products = getProducts();
    var urgent = getUrgent();

    var booking = {
      postleitzahl: form.querySelector("#plz").value,
      wohnungstyp: apartment ? apartment.deLabel : "",
      art_der_reinigung: serviceLevel.deLabel || "Standardreinigung",
      haeufigkeit: frequency ? frequency.deLabel : "",
      reinigungsprodukte_mitbringen: products ? ("Ja (+" + eur(products.amount) + ")") : "Nein",
      extras: extras.map(function (i) { return i.deLabel; }).join(", ") || "Keine",
      polstermoebel_sofas: tappezzeria ? "Ja, Preis auf Anfrage" : "Nein",
      dringende_anfrage: urgent ? ("Ja (+" + eur(urgent.amount) + ")") : "Nein",
      rabattcode: form.querySelector("#promo").value || "Kein Rabattcode",
      bevorzugtes_datum: form.querySelector("#data").value,
      bevorzugte_uhrzeit: form.querySelector("#ora").value,
      adresse: form.querySelector("#indirizzo").value,
      name: form.querySelector("#nome").value,
      telefon: form.querySelector("#telefono").value,
      email: form.querySelector("#email").value,
      haustiere: form.querySelector("#pets").value || "Keine Angabe",
      notizen: form.querySelector("#note").value,
      einwilligung_vorzeitiger_beginn_356_bgb: WIDERRUF_CONSENT_TEXT,
      einwilligung_zeitstempel: new Date().toISOString()
    };

    fetch("/api/create-setup-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pricing: getPricingSelections(),
        booking: booking,
        lang: window.SPLENDO_GET_LANG ? window.SPLENDO_GET_LANG() : "de"
      })
    })
      .then(function (res) {
        if (!res.ok) throw new Error("create-setup-session failed: " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data.url) throw new Error("Missing checkout URL");
        window.location.href = data.url;
      })
      .catch(function () {
        statusEl.textContent = t("status_error", "Etwas ist schiefgelaufen. Schreib uns direkt an admin@splendo.eu, wir antworten sofort.");
        statusEl.className = "form-status is-error";
        submitBtn.disabled = false;
      });
  });
})();
