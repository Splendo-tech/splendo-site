/* Splendo - booking.js
   Calcolo prezzo live + invio form di prenotazione via Web3Forms (nessun backend proprio).
   Le etichette mostrate seguono la lingua attiva (lette dal DOM già tradotto da i18n.js).
   L'email interna usa sempre le etichette tedesche (attributo data-de). */

(function () {
  "use strict";

  // Sostituisci con la tua access key gratuita da https://web3forms.com
  var WEB3FORMS_ACCESS_KEY = "476e51d4-8223-4645-b4b2-04755e570b05";

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

  // ---- Limite di 7 giorni per la prenotazione online (vedi api/create-checkout-session.js) ----
  var MAX_DAYS_AHEAD = 7;
  (function limitDatePicker() {
    var dataField = document.getElementById("data");
    if (!dataField) return;
    var max = new Date();
    max.setDate(max.getDate() + MAX_DAYS_AHEAD);
    dataField.max = max.toISOString().slice(0, 10);
    var min = new Date();
    dataField.min = min.toISOString().slice(0, 10);
  })();

  function daysFromToday(dateStr) {
    var target = new Date(dateStr + "T00:00:00");
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - today.getTime()) / 86400000);
  }

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

  // ---- Chiavi selezione per il calcolo prezzo lato server (api/_pricing.js) ----
  function getApartmentKey() {
    var input = form.querySelector('input[name="apartment"]:checked');
    return input ? input.value.toLowerCase() : null;
  }

  function getServiceLevelKey() {
    var input = form.querySelector('input[name="service-level"]:checked');
    return input ? input.value.toLowerCase() : "standardreinigung";
  }

  function isRecurringFrequency() {
    var input = form.querySelector('input[name="frequency"]:checked');
    return !!(input && input.dataset.recurring === "true");
  }

  function getExtraKeys() {
    var nodes = form.querySelectorAll('input[name="extra"]:checked');
    var keys = [];
    nodes.forEach(function (node) {
      if (node.dataset.key) keys.push(node.dataset.key);
    });
    return keys;
  }

  function getCounterSelections() {
    var out = {};
    counters.forEach(function (row) {
      var valueEl = row.querySelector(".counter-value");
      var qty = parseInt(valueEl.dataset.value, 10) || 0;
      if (qty > 0 && row.dataset.counter) out[row.dataset.counter] = qty;
    });
    return out;
  }

  function whatsappFallback(message) {
    var note = document.getElementById("whatsapp-fallback-note");
    if (!note) return;
    note.innerHTML = "";
    var p = document.createElement("p");
    p.textContent = message;
    var link = document.createElement("a");
    link.href = "https://wa.me/491758990050";
    link.target = "_blank";
    link.rel = "noopener";
    link.className = "btn btn-gold";
    link.style.marginTop = "10px";
    link.textContent = t("buchen_whatsapp_fallback_btn", "Auf WhatsApp schreiben");
    note.appendChild(p);
    note.appendChild(link);
    note.style.display = "block";
    note.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function submitViaWeb3Forms() {
    var apartment = getSelectedApartment();
    var serviceLevel = getSelectedServiceLevel();
    var frequency = getSelectedFrequency();
    var extras = getCheckedExtras().concat(getCounterItems());
    var tappezzeria = getTappezzeria();
    var products = getProducts();
    var urgent = getUrgent();

    var payload = {
      access_key: WEB3FORMS_ACCESS_KEY,
      subject: "Neue Splendo-Buchungsanfrage - " + (form.querySelector("#nome").value || ""),
      from_name: "Splendo Website",
      postleitzahl: form.querySelector("#plz").value,
      wohnungstyp: apartment ? apartment.deLabel : "",
      art_der_reinigung: serviceLevel.deLabel || "Standardreinigung",
      haeufigkeit: frequency ? frequency.deLabel : "",
      reinigungsprodukte_mitbringen: products ? ("Ja (+" + eur(products.amount) + ")") : "Nein",
      extras: extras.map(function (i) { return i.deLabel; }).join(", ") || "Keine",
      polstermoebel_sofas: tappezzeria ? "Ja, Preis auf Anfrage" : "Nein",
      dringende_anfrage: urgent ? ("Ja (+" + eur(urgent.amount) + ")") : "Nein",
      geschaetzter_gesamtpreis: summaryTotalValue.textContent,
      rabattcode: form.querySelector("#promo").value || "Kein Rabattcode",
      bevorzugtes_datum: form.querySelector("#data").value,
      bevorzugte_uhrzeit: form.querySelector("#ora").value,
      adresse: form.querySelector("#indirizzo").value,
      name: form.querySelector("#nome").value,
      telefon: form.querySelector("#telefono").value,
      email: form.querySelector("#email").value,
      haustiere: form.querySelector("#pets").value || "Keine Angabe",
      notizen: form.querySelector("#note").value,
      hinweis: "Individuelle Anfrage (4+ Zimmer oder wiederkehrend) - Preis und Zahlung werden manuell per WhatsApp vereinbart, keine Kartenreservierung.",
      einwilligung_vorzeitiger_beginn_356_bgb: WIDERRUF_CONSENT_TEXT,
      einwilligung_zeitstempel: new Date().toISOString(),
      rechtliche_hinweise: "Datenschutz: https://splendo.eu/datenschutz.html - AGB & Widerrufsbelehrung: https://splendo.eu/agb.html - Widerruf online: https://splendo.eu/widerruf.html"
    };

    fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.success) {
          statusEl.textContent = t("status_success", "Richiesta inviata. Ti contatteremo entro poche ore su WhatsApp per confermare data e prezzo finale. Il pagamento avviene solo a fine servizio.");
          statusEl.className = "form-status is-success";
          form.reset();
          counters.forEach(function (row) {
            var valueEl = row.querySelector(".counter-value");
            valueEl.dataset.value = 0;
            valueEl.textContent = 0;
          });
          renderSummary();
        } else {
          throw new Error(data.message || "Web3Forms error");
        }
      })
      .catch(function () {
        statusEl.textContent = t("status_error", "Qualcosa è andato storto. Scrivici direttamente a admin@splendo.eu, ti rispondiamo subito.");
        statusEl.className = "form-status is-error";
      });
  }

  function submitViaStripe() {
    var apartment = getSelectedApartment();
    var serviceLevel = getSelectedServiceLevel();
    var frequency = getSelectedFrequency();
    var extras = getCheckedExtras().concat(getCounterItems());
    var products = getProducts();
    var urgent = getUrgent();

    var body = {
      selections: {
        apartment: getApartmentKey(),
        serviceLevel: getServiceLevelKey(),
        extras: getExtraKeys(),
        counters: getCounterSelections(),
        urgent: !!(document.getElementById("urgent") && document.getElementById("urgent").checked),
        products: !!(document.getElementById("products") && document.getElementById("products").checked),
        recurring: isRecurringFrequency()
      },
      labels: {
        wohnungstyp: apartment ? apartment.deLabel : "",
        artDerReinigung: serviceLevel.deLabel || "Standardreinigung",
        haeufigkeit: frequency ? frequency.deLabel : "",
        extras: extras.map(function (i) { return i.deLabel; }).join(", ") || "Keine",
        dringendeAnfrage: urgent ? ("Ja (+" + eur(urgent.amount) + ")") : "Nein",
        reinigungsprodukte: products ? ("Ja (+" + eur(products.amount) + ")") : "Nein"
      },
      contact: {
        name: form.querySelector("#nome").value,
        email: form.querySelector("#email").value,
        telefono: form.querySelector("#telefono").value,
        adresse: form.querySelector("#indirizzo").value,
        plz: form.querySelector("#plz").value,
        datum: form.querySelector("#data").value,
        ora: form.querySelector("#ora").value,
        haustiere: form.querySelector("#pets").value || "Keine Angabe",
        notizen: form.querySelector("#note").value,
        promo: form.querySelector("#promo").value || ""
      },
      consent: {
        accepted: !!(consentCheckbox && consentCheckbox.checked),
        text: WIDERRUF_CONSENT_TEXT,
        timestamp: new Date().toISOString()
      }
    };

    fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        if (result.ok && result.data.url) {
          window.location.href = result.data.url;
          return;
        }
        if (result.data.error === "date_too_far") {
          statusEl.textContent = "";
          statusEl.className = "form-status";
          whatsappFallback(t("buchen_whatsapp_fallback_date", "Online-Buchung ist nur bis 7 Tage im Voraus möglich."));
          return;
        }
        throw new Error((result.data && result.data.error) || "checkout error");
      })
      .catch(function () {
        statusEl.textContent = t("status_error", "Qualcosa è andato storto. Scrivici direttamente a admin@splendo.eu, ti rispondiamo subito.");
        statusEl.className = "form-status is-error";
      });
  }

  // ---- Invio form ----
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

    var whatsappNote = document.getElementById("whatsapp-fallback-note");
    if (whatsappNote) whatsappNote.style.display = "none";

    var apartmentKey = getApartmentKey();
    var recurring = isRecurringFrequency();

    // Apartments needing a custom quote, and recurring bookings, never had a
    // single fixed total to hold - those keep going straight to Mattia via
    // WhatsApp/Web3Forms exactly as before, no card involved.
    if (apartmentKey === "4+" || recurring) {
      statusEl.textContent = t("status_sending", "Invio in corso...");
      statusEl.className = "form-status";
      submitViaWeb3Forms();
      return;
    }

    // Bookings further out than 7 days can't get a card hold that survives
    // to the appointment - send those to WhatsApp instead of attempting
    // checkout (the server enforces this too; this is just to avoid a
    // pointless round trip).
    var dateVal = form.querySelector("#data").value;
    var diff = dateVal ? daysFromToday(dateVal) : 0;
    if (diff > MAX_DAYS_AHEAD || diff < 0) {
      whatsappFallback(t("buchen_whatsapp_fallback_date", "Online-Buchung ist nur bis 7 Tage im Voraus möglich."));
      return;
    }

    statusEl.textContent = t("status_sending", "Invio in corso...");
    statusEl.className = "form-status";
    submitViaStripe();
  });
})();
