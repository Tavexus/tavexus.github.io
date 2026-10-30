/* Takvim: paylaşımı sürükleyip başka güne bırakma (HTML5 sürükle-bırak). Dokunmatik ekran / klavye için her
   paylaşımın altında "Taşı" düğmesi vardır (bu dosya olmadan da çalışır). CSP: yalnız 'self', satır içi kod yok. */
(function () {
  "use strict";
  var box = document.querySelector(".tk[data-move-url]");
  if (!box) { return; }
  var url = box.getAttribute("data-move-url");
  var meta = document.querySelector('meta[name="csrf-token"]');
  var CSRF = meta ? meta.getAttribute("content") : "";
  var dragged = null;

  /* Telefonda ay görünümü alt alta günlerdir: sayfa bugünün gününe kendiliğinden kayar (geçmiş günler üstte kalır). */
  var bugun = box.classList.contains("tk-ay") && !window.location.hash && box.querySelector(".tk-bugun");
  if (bugun && window.matchMedia && window.matchMedia("(max-width: 860px)").matches) {
    bugun.scrollIntoView({ block: "start" });
  }

  box.addEventListener("dragstart", function (ev) {
    var li = ev.target.closest && ev.target.closest("[data-post-id]");
    if (!li) { return; }
    dragged = li.getAttribute("data-post-id");
    try { ev.dataTransfer.setData("text/plain", dragged); ev.dataTransfer.effectAllowed = "move"; } catch (e) { /* eski tarayıcı */ }
    li.classList.add("tk-suruklenen");
  });
  box.addEventListener("dragend", function (ev) {
    var li = ev.target.closest && ev.target.closest("[data-post-id]");
    if (li) { li.classList.remove("tk-suruklenen"); }
    Array.prototype.forEach.call(box.querySelectorAll(".tk-hedef"), function (el) { el.classList.remove("tk-hedef"); });
  });
  box.addEventListener("dragover", function (ev) {
    var day = ev.target.closest && ev.target.closest("[data-day]");
    if (!day || !dragged) { return; }
    ev.preventDefault();
    day.classList.add("tk-hedef");
  });
  box.addEventListener("dragleave", function (ev) {
    var day = ev.target.closest && ev.target.closest("[data-day]");
    if (day && !day.contains(ev.relatedTarget)) { day.classList.remove("tk-hedef"); }
  });
  box.addEventListener("drop", function (ev) {
    var day = ev.target.closest && ev.target.closest("[data-day]");
    if (!day || !dragged) { return; }
    ev.preventDefault();
    var postId = dragged;
    dragged = null;
    day.classList.remove("tk-hedef");
    fetch(url, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": CSRF, "X-Requested-With": "fetch" },
      body: JSON.stringify({ post_id: Number(postId), date: day.getAttribute("data-day") })
    }).then(function (r) {
      if (r.status === 401) { window.location.href = "/unlock"; return null; }
      return r.json().catch(function () { return {}; });
    }).then(function (data) {
      if (!data) { return; }
      if (data.ok) { window.location.reload(); }
      else { window.alert(data.error || "Paylaşım taşınamadı. Sayfayı yenileyip tekrar deneyin."); }
    }).catch(function () {
      window.alert("Paylaşım taşınamadı. Program açık mı? Sayfayı yenileyip tekrar deneyin.");
    });
  });
})();
