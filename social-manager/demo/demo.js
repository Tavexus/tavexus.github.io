/* Tavexus Social Manager — tarayıcı demosu (statik sayfalar, sunucu yok).
   Hiçbir yere istek gönderilmez: formlar ve düğmeler yalnız bilgi mesajı gösterir. app.js'den ÖNCE yüklenir. */
(function () {
  "use strict";
  var MSG_KAYIT = "Bu bir demo — gerçek programda kaydedilir.";
  var MSG_YOK = "Bu bölüm demoda gösterilmiyor — gerçek programda açılır.";
  var MSG_FILTRE = "Bu seçim demoda gösterilmiyor — gerçek programda açılır.";
  var MSG_FB = "Bu demo; gerçek programda Facebook onayı açılır.";
  var MSG_GOOGLE = "Bu demo; gerçek programda Google onayı açılır.";
  var PAYLASIM = {
    schedule: "Bu bir demo — gerçek programda paylaşım seçtiğiniz saate zamanlanır ve Takvim'de görünür.",
    now: "Bu bir demo — gerçek programda paylaşım seçili hesaplarda hemen paylaşılır.",
    draft: "Bu bir demo — gerçek programda paylaşım taslak olarak kaydedilir."
  };
  var SAYFALAR = window.__DEMO_SAYFALAR || {};
  var kutu = null, zaman = null;

  function mesaj(metin) {
    if (!document.body) { return; }
    if (!kutu) {
      kutu = document.createElement("div");
      kutu.id = "tavexus-demo-bilgi";
      kutu.setAttribute("role", "status");
      kutu.setAttribute("aria-live", "polite");
      document.body.appendChild(kutu);
    }
    kutu.textContent = metin;
    kutu.classList.add("acik");
    if (zaman) { clearTimeout(zaman); }
    zaman = setTimeout(function () { kutu.classList.remove("acik"); }, 3800);
  }
  window.tavexusDemoMesaj = mesaj;

  function json(veri) {
    return Promise.resolve(new Response(JSON.stringify(veri), { status: 200, headers: { "Content-Type": "application/json" } }));
  }
  function bekle() { return new Promise(function () {}); }  /* hiç dönmez: sayfa olduğu gibi kalır */

  function ornekParola(n) {
    var h = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789-";
    var s = "", a = new Uint32Array(n);
    (window.crypto || {}).getRandomValues ? window.crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 1e9; });
    for (var i = 0; i < n; i++) { s += h[a[i] % h.length]; }
    return s;
  }

  /* Ağ yok: programın kendi istekleri burada cevaplanır */
  window.fetch = function (url, ayar) {
    var yol = String(url || "");
    var govde = {};
    try { govde = JSON.parse((ayar && ayar.body) || "{}"); } catch (e) { govde = {}; }
    if (/\/secret$/.test(yol)) { return json({ ok: true, value: "••••••••" }); }
    if (/\/ping$/.test(yol)) { return json({ ok: true }); }
    if (/\/vault\/generate$/.test(yol)) { return json({ ok: true, value: ornekParola(Math.max(8, Math.min(64, govde.length || 20))) }); }
    if (/\/parola-gucu$/.test(yol)) {
      var n = String(govde.password || "").length;
      var p = n < 8 ? 0 : n < 12 ? 1 : n < 16 ? 2 : n < 20 ? 3 : 4;
      var ad = ["Zayıf", "Zayıf", "Orta", "İyi", "Güçlü"][p];
      return json({ ok: true, score: p, label: ad, message: p >= 3 ? "Parola uygun." : "Daha uzun bir parola seçin." });
    }
    if (/\/status$/.test(yol) || /\/durum$/.test(yol)) { return bekle(); }
    if (/youtube/.test(yol)) { mesaj(MSG_GOOGLE); return bekle(); }
    mesaj(MSG_KAYIT);
    return bekle();
  };

  function anahtar(form) {
    var yol = form.getAttribute("data-demo-get") || "/";
    var parca = [];
    var fd = new FormData(form);
    fd.forEach(function (v, k) { if (typeof v === "string" && v !== "") { parca.push([k, v]); } });
    parca.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0); });
    return yol + (parca.length ? "?" + parca.map(function (x) { return x[0] + "=" + x[1]; }).join("&") : "");
  }

  function gonder(form, dugme) {
    if (form.hasAttribute("data-demo-get")) {
      var hedef = SAYFALAR[anahtar(form)];
      if (hedef) { window.location.href = hedef; } else { mesaj(MSG_FILTRE); }
      return;
    }
    var sonraki = form.getAttribute("data-demo-next");
    if (sonraki) { window.location.href = sonraki; return; }
    var baglan = form.getAttribute("data-demo-baglan");
    if (baglan) {
      var pl = (dugme && dugme.value) || baglan;
      mesaj(/youtube|google/.test(pl) ? MSG_GOOGLE : MSG_FB);
      return;
    }
    var ozel = form.getAttribute("data-demo-mesaj");
    if (ozel) { mesaj(ozel); return; }
    if (form.hasAttribute("data-demo-paylasim")) {
      var tur = dugme && dugme.name === "action" ? dugme.value : "draft";
      mesaj(PAYLASIM[tur] || MSG_KAYIT);
      return;
    }
    mesaj(MSG_KAYIT);
  }

  document.addEventListener("submit", function (ev) {
    var form = ev.target;
    if (!form || form.tagName !== "FORM") { return; }
    ev.preventDefault();
    ev.stopImmediatePropagation();
    gonder(form, ev.submitter);
  }, true);

  HTMLFormElement.prototype.submit = function () { gonder(this, null); };

  document.addEventListener("click", function (ev) {
    var a = ev.target.closest && ev.target.closest("a[data-demo-yok]");
    if (a) { ev.preventDefault(); mesaj(MSG_YOK); }
  }, true);
})();
