/* Splendo — booking.js
   Calcolo prezzo live + invio form di prenotazione via Web3Forms (nessun backend proprio).
   Le etichette mostrate seguono la lingua attiva (lette dal DOM già tradotto da i18n.js).
   L'email interna usa sempre le etichette tedesche (attributo data-de). */

(function () {
  "use strict";

  // Sostituisci con la tua access key gratuita da https://web3forms.com
  var WEB3FORMS_ACCESS_KEY = "YOUR_WEB3FORMS_ACCESS_KEY";

  var form = document.getElementById("booking-form");
  if (!form) return;

  var summaryList = document.getElementById("summary-list");
  var summaryTotalValue = document.getElementById("summary-total-value");
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

  function getSelectedFrequency() {
    var input = form.querySelector('input[name="frequency"]:checked');
    if (!input) return null;
    var card = input.closest(".option-card");
    var nameEl = card.querySelector(".option-name");
    return {
      displayLabel: nameEl ? nameEl.textContent : input.value,
      deLabel: input.dataset.de || input.value
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

  function renderSummary() {
    var apartment = getSelectedApartment();
    var extras = getCheckedExtras().concat(getCounterItems());
    var tappezzeria = getTappezzeria();
    var urgent = getUrgent();

    var rows = [];
    var total = 0;

    if (apartment) {
      if (apartment.isQuote) {
        rows.push({ label: apartment.displayLabel, amountLabel: apartment.quoteLabel || "—" });
      } else {
        total += apartment.price;
        rows.push({ label: apartment.displayLabel, amountLabel: eur(apartment.price) });
      }
    }

    extras.forEach(function (item) {
      total += item.price;
      rows.push({ label: item.displayLabel, amountLabel: "+" + eur(item.price) });
    });

    if (tappezzeria) {
      rows.push({ label: tappezzeria.displayLabel, amountLabel: "—" });
    }

    if (urgent) {
      total += urgent.amount;
      rows.push({ label: t("urgent_label", "Dringende Anfrage"), amountLabel: "+" + eur(urgent.amount) });
    }

    summaryList.innerHTML = "";
    if (rows.length === 0) {
      var empty = document.createElement("li");
      empty.className = "summary-empty";
      empty.textContent = t("summary_empty", "Wähle Optionen, um den Preis zu sehen");
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

    summaryTotalValue.textContent = eur(total);
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

  // ---- Invio form ----
  form.addEventListener("submit", function (e) {
    e.preventDefault();

    statusEl.textContent = t("status_sending", "Wird gesendet...");
    statusEl.className = "form-status";

    var apartment = getSelectedApartment();
    var frequency = getSelectedFrequency();
    var extras = getCheckedExtras().concat(getCounterItems());
    var tappezzeria = getTappezzeria();
    var urgent = getUrgent();

    var payload = {
      access_key: WEB3FORMS_ACCESS_KEY,
      subject: "Neue Splendo-Buchungsanfrage — " + (form.querySelector("#nome").value || ""),
      from_name: "Splendo Website",
      wohnungstyp: apartment ? apartment.deLabel : "",
      haeufigkeit: frequency ? frequency.deLabel : "",
      extras: extras.map(function (i) { return i.deLabel; }).join(", ") || "Keine",
      polstermoebel_sofas: tappezzeria ? "Ja, Preis auf Anfrage" : "Nein",
      dringende_anfrage: urgent ? "Ja (+20€)" : "Nein",
      geschaetzter_gesamtpreis: summaryTotalValue.textContent,
      bevorzugtes_datum: form.querySelector("#data").value,
      bevorzugte_uhrzeit: form.querySelector("#ora").value,
      adresse: form.querySelector("#indirizzo").value,
      name: form.querySelector("#nome").value,
      telefon: form.querySelector("#telefono").value,
      email: form.querySelector("#email").value,
      notizen: form.querySelector("#note").value
    };

    fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.success) {
          statusEl.textContent = t("status_success", "Anfrage gesendet!");
          statusEl.className = "form-status is-success";
          form.reset();
          counters.forEach(function (row) {
            var valueEl = row.querySelector(".counter-value");
            valueEl.dataset.value = 0;
            valueEl.textContent = 0;
          });
          renderSummary();
        } else {
          throw new Error(data.message || "Errore invio");
        }
      })
      .catch(function () {
        statusEl.textContent = t("status_error", "Etwas ist schiefgelaufen.");
        statusEl.className = "form-status is-error";
      });
  });
})();
