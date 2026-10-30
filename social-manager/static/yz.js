/* Tavexus Social Manager — "Metin öner" (Aşama 3b). Yalnız bu programa sorar (/yz/oner); program da yalnız bu
   bilgisayardaki yapay zekâya sorar. Seçilen öneri metin kutusuna yazılır; hiçbir şey kendiliğinden kaydedilmez. */
(function () {
  "use strict";

  var box = document.getElementById("yz");
  var btn = document.getElementById("yz-oner");
  var out = document.getElementById("yz-sonuc");
  if (!box || !btn || !out || btn.disabled) { return; }
  var form = box.closest("form");
  var textArea = form ? form.querySelector('textarea[name="text"]') : null;
  var brandSel = form ? form.querySelector('select[name="brand_id"]') : null;
  var meta = document.querySelector('meta[name="csrf-token"]');
  var CSRF = meta ? meta.getAttribute("content") : "";
  if (!textArea) { return; }

  function say(msg, cls) {
    out.textContent = "";
    var p = document.createElement("p");
    p.className = "small " + (cls || "muted");
    p.textContent = msg;
    out.appendChild(p);
  }

  function show(items) {
    out.textContent = "";
    items.forEach(function (it, i) {
      var full = it.text + (it.hashtags && it.hashtags.length ? "\n\n" + it.hashtags.join(" ") : "");
      var card = document.createElement("div");
      card.className = "card";
      var h = document.createElement("p");
      h.className = "small muted";
      h.textContent = "Öneri " + (i + 1);
      var t = document.createElement("p");
      t.className = "post-text";
      t.textContent = full;
      var use = document.createElement("button");
      use.type = "button";
      use.className = "btn btn-sm btn-accent";
      use.textContent = "Bunu kullan";
      use.addEventListener("click", function () {
        textArea.value = full;
        textArea.dispatchEvent(new Event("input", { bubbles: true }));
        textArea.focus();
        say("Öneri metin kutusuna yazıldı. Kaydetmek için aşağıdaki düğmelerden birine basın.");
      });
      card.appendChild(h);
      card.appendChild(t);
      card.appendChild(use);
      out.appendChild(card);
    });
  }

  btn.addEventListener("click", function () {
    var text = (textArea.value || "").trim();
    if (!text) { say("Önce metin kutusuna birkaç kelimeyle konuyu yazın.", "text-warning"); textArea.focus(); return; }
    btn.disabled = true;
    say("Öneriler hazırlanıyor (en çok iki dakika)…");
    fetch(box.getAttribute("data-url"), {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": CSRF, "X-Requested-With": "fetch" },
      body: JSON.stringify({ text: text, brand_id: brandSel ? brandSel.value : "" })
    }).then(function (r) {
      if (r.status === 401) { window.location.href = "/unlock"; return null; }
      return r.json().catch(function () { return {}; });
    }).then(function (data) {
      if (!data) { return; }
      if (data.ok && data.suggestions && data.suggestions.length) { show(data.suggestions); }
      else { say(data.error || "Öneri hazırlanamadı. Yeniden deneyin.", "text-danger"); }
    }).catch(function () {
      say("Öneri hazırlanamadı. Yeniden deneyin.", "text-danger");
    }).then(function () { btn.disabled = false; });
  });
})();
