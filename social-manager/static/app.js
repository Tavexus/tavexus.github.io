/* Tavexus Social Manager — küçük vanilla JS (CSP: yalnızca 'self', satır içi kod yok) */
(function () {
  "use strict";

  var csrfMeta = document.querySelector('meta[name="csrf-token"]');
  var CSRF = csrfMeta ? csrfMeta.getAttribute("content") : "";

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function postJSON(url, body, signal) {
    return fetch(url, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal: signal,
      headers: { "Content-Type": "application/json", "X-CSRF-Token": CSRF, "X-Requested-With": "fetch" },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (r.status === 401) { window.location.href = "/unlock"; throw new Error("locked"); }
        if (!r.ok || !data.ok) { throw new Error(data.error || "İstek başarısız"); }
        return data;
      });
    });
  }

  function fetchSecret(entryId, key, purpose) {
    /* purpose: "copy" (Kopyala) veya "reveal" (Göster) — yalnız işlem kaydı için */
    return postJSON("/vault/" + encodeURIComponent(entryId) + "/secret", { key: key, purpose: purpose || "reveal" }).then(function (d) { return d.value || ""; });
  }

  /* Kopyalanan sır 30 sn sonra panodan silinir — yalnızca pano okunabiliyor ve hâlâ aynı
     değeri içeriyorsa (asla körlemesine silinmez). Sayfa odakta değilse odak/görünürlükte
     tekrar denenir. Bekleyen iş sessionStorage'da tutulur (sayfa değişse de sürer); orada
     yalnızca değerin SHA-256 özeti saklanır, değerin kendisi asla. */
  var CLIPBOARD_CLEAR_MS = 30000;
  var CLIP_KEY = "sm-clip-pending";
  var clipMem = null;
  var clipTimer = null;
  function sha256Hex(text) {
    if (!(window.crypto && window.crypto.subtle && window.TextEncoder)) { return Promise.reject(new Error("no-subtle")); }
    return window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
    });
  }
  function getPending() {
    try {
      var v = JSON.parse(window.sessionStorage.getItem(CLIP_KEY) || "null");
      if (v && typeof v.h === "string" && typeof v.due === "number") { return v; }
    } catch (e) { /* sessionStorage yok */ }
    return clipMem;
  }
  function setPending(p) {
    clipMem = p;
    try {
      if (p) { window.sessionStorage.setItem(CLIP_KEY, JSON.stringify(p)); }
      else { window.sessionStorage.removeItem(CLIP_KEY); }
    } catch (e) { /* yok say */ }
  }
  function armClipTimer(ms) {
    if (clipTimer) { clearTimeout(clipTimer); }
    clipTimer = setTimeout(function () { clipTimer = null; tryClipboardClear(); }, Math.max(0, ms));
  }
  function tryClipboardClear() {
    var p = getPending();
    if (!p) return;
    var wait = p.due - Date.now();
    if (wait > 0) { armClipTimer(wait); return; }
    if (!navigator.clipboard || !navigator.clipboard.readText) { setPending(null); return; } /* doğrulanamaz: silme */
    if (document.hidden || (document.hasFocus && !document.hasFocus())) return; /* odak gelince tekrar */
    var reading;
    try { reading = navigator.clipboard.readText(); } catch (e) { return; }
    reading.then(function (cur) {
      return sha256Hex(cur).then(function (h) {
        if (h !== p.h) { setPending(null); return; } /* pano değişmiş: dokunma */
        return navigator.clipboard.writeText("").then(function () { setPending(null); });
      });
    }).catch(function () { /* izin/odak yok: bir sonraki odakta tekrar denenir */ });
  }
  function scheduleClipboardClear(text) {
    sha256Hex(text).then(function (h) {
      setPending({ h: h, due: Date.now() + CLIPBOARD_CLEAR_MS });
      armClipTimer(CLIPBOARD_CLEAR_MS);
    }).catch(function () { /* özet alınamıyor: silme planlanmaz */ });
  }
  window.addEventListener("focus", tryClipboardClear);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) { tryClipboardClear(); } });
  tryClipboardClear();

  function copyText(text, btn, notSecret) {
    if (text && !notSecret) { scheduleClipboardClear(text); }
    function done() {
      if (!btn) return;
      var old = btn.textContent;
      btn.classList.add("copied");
      btn.textContent = "Kopyalandı";
      setTimeout(function () { btn.classList.remove("copied"); btn.textContent = old; }, 1500);
    }
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    }
    fallbackCopy(text); done();
    return Promise.resolve();
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.className = "offscreen";
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) { /* yok say */ }
    document.body.removeChild(ta);
  }

  function showError(err) {
    if (err && err.message === "locked") return;
    window.alert((err && err.message) || "Hata oluştu");
  }

  /* Renk örnekleri (inline style yerine CSSOM) */
  $all("[data-color]").forEach(function (el) {
    var c = el.getAttribute("data-color") || "";
    if (/^#[0-9a-fA-F]{6}$/.test(c)) { el.style.backgroundColor = c; }
  });
  $all("[data-border-color]").forEach(function (el) {
    var c = el.getAttribute("data-border-color") || "";
    if (/^#[0-9a-fA-F]{6}$/.test(c)) { el.style.borderTopColor = c; }
  });

  /* Telefon menü düğmesi: ekran okuyucu açık / kapalı durumunu bilsin */
  var navToggle = document.getElementById("nav-toggle");
  if (navToggle) {
    navToggle.addEventListener("change", function () {
      navToggle.setAttribute("aria-expanded", navToggle.checked ? "true" : "false");
    });
  }

  /* Onay isteyen formlar ve butonlar */
  document.addEventListener("submit", function (ev) {
    var form = ev.target;
    var q = form.getAttribute && form.getAttribute("data-confirm");
    if (q && !window.confirm(q)) { ev.preventDefault(); }
  });
  /* Rol değişimi: Yönetici yapmadan ve şifre görebilen birini Sadece paylaşım yapmadan önce onay */
  document.addEventListener("submit", function (ev) {
    var form = ev.target;
    var from = form.getAttribute && form.getAttribute("data-role-from");
    if (!from || ev.defaultPrevented) { return; }
    var sel = form.querySelector("select[name=role]");
    var to = sel ? sel.value : from;
    var q = null;
    if (to === "yonetici" && from !== "yonetici") { q = form.getAttribute("data-confirm-admin"); }
    else if (to === "paylasim" && from !== "paylasim") { q = form.getAttribute("data-confirm-share"); }
    else if (to === "editor" && from === "paylasim") { q = form.getAttribute("data-confirm-editor"); }
    if (q && !window.confirm(q)) { ev.preventDefault(); }
  });
  /* Uzun süren formlar: gönderilince düğmeyi kilitle ve bekleme metni göster (çift tıklama yok). */
  document.addEventListener("submit", function (ev) {
    var form = ev.target;
    var text = form.getAttribute && form.getAttribute("data-busy");
    if (!text || ev.defaultPrevented) { return; }
    var btn = form.querySelector("button[type=submit]");
    if (btn) {
      if (!btn.hasAttribute("data-label")) { btn.setAttribute("data-label", btn.textContent); }
      btn.textContent = text;
      setTimeout(function () { btn.disabled = true; }, 0);  /* gönderim başladıktan sonra */
    }
  });
  window.addEventListener("pageshow", function () {  /* geri tuşu: düğmeyi eski haline getir */
    $all("form[data-busy] button[data-label]").forEach(function (btn) {
      btn.disabled = false;
      btn.textContent = btn.getAttribute("data-label");
    });
  });
  $all("[data-confirm-click]").forEach(function (btn) {
    btn.addEventListener("click", function (ev) {
      /* data-confirm-needs: bu seçici formda yoksa (ör. hiç hesap seçilmemiş) onay sorulmaz; sunucu nedenini yazar */
      var need = btn.getAttribute("data-confirm-needs");
      if (need && btn.form && !btn.form.querySelector(need)) { return; }
      if (!window.confirm(btn.getAttribute("data-confirm-click"))) { ev.preventDefault(); }
    });
  });
  $all("select[data-autosubmit]").forEach(function (sel) {
    sel.addEventListener("change", function () { sel.form.submit(); });
  });

  /* Kasa listesi: göster / kopyala */
  $all("[data-reveal]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var row = btn.closest(".secret-row");
      var out = row ? $("[data-secret-out]", row) : null;
      if (!out) return;
      if (btn.getAttribute("data-shown") === "1") {
        out.textContent = "••••••••";
        btn.textContent = "Göster";
        btn.setAttribute("data-shown", "0");
        return;
      }
      fetchSecret(btn.getAttribute("data-entry"), btn.getAttribute("data-reveal")).then(function (v) {
        out.textContent = v === "" ? "(boş)" : v;
        btn.textContent = "Gizle";
        btn.setAttribute("data-shown", "1");
      }).catch(showError);
    });
  });
  $all("[data-copy-secret]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      fetchSecret(btn.getAttribute("data-entry"), btn.getAttribute("data-copy-secret"), "copy")
        .then(function (v) { return copyText(v, btn); }).catch(showError);
    });
  });

  /* Kasa formu */
  function changedInputFor(input) {
    if (input.id === "password") { return document.getElementById("password_changed"); }
    var row = input.closest(".field-row");
    return row ? $('input[name="field_changed"]', row) : null;
  }
  function needsLoad(input) {
    var ch = changedInputFor(input);
    return input.value === "" && input.getAttribute("data-entry") && ch && ch.value === "0";
  }
  function ensureValue(input) {
    if (!needsLoad(input)) { return Promise.resolve(input.value); }
    return fetchSecret(input.getAttribute("data-entry"), input.getAttribute("data-key")).then(function (v) {
      input.value = v;
      return v;
    });
  }
  function toggleInput(input, btn) {
    if (input.type === "password") {
      ensureValue(input).then(function () { input.type = "text"; if (btn) btn.textContent = "Gizle"; }).catch(showError);
    } else {
      input.type = "password";
      if (btn) btn.textContent = "Göster";
    }
  }
  function markChanged(ev) {
    var ch = changedInputFor(ev.target);
    if (ch) ch.value = "1";
  }

  $all("[data-toggle-input]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var input = document.getElementById(btn.getAttribute("data-toggle-input"));
      if (input) toggleInput(input, btn);
    });
  });
  $all("[data-copy-input]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var input = document.getElementById(btn.getAttribute("data-copy-input"));
      if (input) ensureValue(input).then(function (v) { return copyText(v, btn); }).catch(showError);
    });
  });
  /* Sır olmayan metin için genel "Kopyala": [data-copy-from="<öğe id>"] (ör. lisans talep kodu) */
  $all("[data-copy-from]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var el = document.getElementById(btn.getAttribute("data-copy-from"));
      if (!el) return;
      var text = ("value" in el && el.value !== undefined) ? el.value : el.textContent;
      copyText((text || "").trim(), btn, true);
    });
  });
  var pw = document.getElementById("password");
  if (pw) { pw.addEventListener("input", markChanged); }
  $all("[data-generate]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var input = document.getElementById(btn.getAttribute("data-generate"));
      var lenEl = document.getElementById("gen-length");
      var symEl = document.getElementById("gen-symbols");
      var len = lenEl ? parseInt(lenEl.value, 10) || 20 : 20;
      len = Math.max(8, Math.min(128, len));
      if (lenEl) { lenEl.value = String(len); }
      postJSON("/vault/generate", {
        length: len,
        symbols: symEl ? symEl.checked : true
      }).then(function (d) {
        input.value = d.value;
        input.type = "text";
        var ch = document.getElementById("password_changed");
        if (ch) ch.value = "1";
        var tbtn = $('[data-toggle-input="' + input.id + '"]');
        if (tbtn) tbtn.textContent = "Gizle";
      }).catch(showError);
    });
  });

  function wireRow(row) {
    var val = $('input[name="field_value"]', row);
    if (val) val.addEventListener("input", markChanged);
    var t = $("[data-row-toggle]", row);
    if (t) t.addEventListener("click", function () { toggleInput(val, t); });
    var c = $("[data-row-copy]", row);
    if (c) c.addEventListener("click", function () {
      ensureValue(val).then(function (v) { return copyText(v, c); }).catch(showError);
    });
    var r = $("[data-row-remove]", row);
    if (r) r.addEventListener("click", function () { row.parentNode.removeChild(row); });
  }
  $all("#field-rows .field-row").forEach(wireRow);
  var addField = document.getElementById("add-field");
  var tpl = document.getElementById("field-row-template");
  if (addField && tpl) {
    addField.addEventListener("click", function () {
      var node = tpl.content.firstElementChild.cloneNode(true);
      document.getElementById("field-rows").appendChild(node);
      wireRow(node);
      $('input[name="field_name"]', node).focus();
    });
  }

  /* Hesap formu: seçili platformun alan yardımını göster */
  var platformSel = document.getElementById("platform-select");
  if (platformSel) {
    var syncHelp = function () {
      var v = platformSel.value;
      $all(".platform-help").forEach(function (el) { el.hidden = !!v && el.getAttribute("data-platform") !== v; });
    };
    platformSel.addEventListener("change", syncHelp);
    syncHelp();
  }

  /* Hesap formu: seçili markada kullanılamayan kasa kayıtlarını işaretle */
  var accBrand = document.getElementById("account-brand");
  var accEntry = document.getElementById("account-entry");
  if (accBrand && accEntry) {
    var syncEntries = function () {
      var b = accBrand.value;
      $all("option[data-label]", accEntry).forEach(function (opt) {
        var blocked = !!b && (opt.getAttribute("data-blocked") || "").split(",").indexOf(b) >= 0;
        opt.disabled = blocked;
        opt.textContent = opt.getAttribute("data-label") + (blocked ? " — başka marka" : "");
        if (blocked && opt.selected) { accEntry.value = ""; }
      });
    };
    accBrand.addEventListener("change", syncEntries);
  }

  /* Ana parola gücü göstergesi: kural tek kaynakta (sunucu, sm/passwords.py); yazarken ölçülür. */
  $all("input[data-strength]").forEach(function (input) {
    var box = document.getElementById(input.getAttribute("data-strength"));
    if (!box) return;
    var bar = $("[data-pw-bar]", box);
    var text = $("[data-pw-text]", box);
    var seq = 0;
    var timer = null;
    var ctrl = null;
    var submitting = false;
    var show = function (score, label, message) {
      bar.hidden = score === null;
      bar.className = "pw-bar" + (score === null ? "" : " pw-s" + score);
      text.className = "pw-text small" + (score === null ? "" : " pw-t" + score);
      text.textContent = score === null ? "" : label + " — " + message;
    };
    var measure = function () {
      var my = ++seq;
      if (submitting) { return; }
      if (!input.value) { show(null); return; }
      if (ctrl) { ctrl.abort(); }
      ctrl = window.AbortController ? new AbortController() : null;
      postJSON("/parola-gucu", { password: input.value }, ctrl ? ctrl.signal : undefined).then(function (d) {
        if (my === seq) { show(d.score, d.label, d.message); }
      }).catch(function () { if (my === seq && !submitting) { show(null); } });
    };
    /* Form gönderilince bekleyen ölçüm gönderilmez, süren iptal edilir: gönderim oturumu yeniler (yeni CSRF),
       eski belirteçle giden ölçüm 403 alırdı (konsolda hata). Ekranda hiçbir şey değişmez. */
    if (input.form) {
      input.form.addEventListener("submit", function (ev) {
        submitting = true;
        if (timer) { clearTimeout(timer); timer = null; }
        if (ctrl) { ctrl.abort(); ctrl = null; }
        setTimeout(function () { if (ev.defaultPrevented) { submitting = false; } }, 0);  /* gönderim iptal edildi */
      });
    }
    input.addEventListener("input", function () {
      if (timer) { clearTimeout(timer); }
      timer = setTimeout(measure, 250);
    });
    if (input.value) { measure(); }
  });

  /* Paylaşım formu: marka filtresi + medya uyarısı */
  var brandSel = document.getElementById("post-brand");
  if (brandSel) {
    var mediaInput = document.getElementById("post-media");
    var removeMedia = document.getElementById("remove-media");
    var warn = document.getElementById("media-warning");
    var labels = { text: "metin", image: "görsel", video: "video" };

    // Uzantı listeleri ve mesaj sunucudan gelir (sm/constants.py — tek kaynak).
    var extList = function (attr) {
      return ((mediaInput && mediaInput.getAttribute(attr)) || "").split(",");
    };

    var currentMediaType = function () {
      if (mediaInput && mediaInput.files && mediaInput.files.length) {
        var name = mediaInput.files[0].name.toLowerCase();
        var ext = name.indexOf(".") >= 0 ? name.split(".").pop() : "";
        if (extList("data-image-ext").indexOf(ext) >= 0) return "image";
        if (extList("data-video-ext").indexOf(ext) >= 0) return "video";
        return "invalid";
      }
      if (removeMedia && removeMedia.checked) return "text";
      return (mediaInput && mediaInput.getAttribute("data-current-type")) || "text";
    };

    var checkMedia = function () {
      var mt = currentMediaType();
      var problems = [];
      if (mt === "invalid") {
        problems.push(mediaInput.getAttribute("data-invalid-msg"));
      }
      $all(".target-item").forEach(function (item) {
        var cb = $("input", item);
        var media = (item.getAttribute("data-media") || "").split(",");
        var bad = mt !== "invalid" && cb.checked && media.indexOf(mt) < 0;
        item.classList.toggle("unsupported", bad);
        if (bad) {
          problems.push($("strong", item).textContent + " bu içerik türünü (" + labels[mt] + ") desteklemiyor.");
        }
      });
      if (warn) {
        warn.textContent = problems.join(" ");
        warn.hidden = problems.length === 0;
      }
    };

    var syncBrand = function () {
      var b = brandSel.value;
      var visible = 0;
      $all(".target-item").forEach(function (item) {
        var show = !!b && item.getAttribute("data-brand") === b;
        item.hidden = !show;
        if (!show) { $("input", item).checked = false; } else { visible++; }
      });
      var hint = document.getElementById("no-brand-hint");
      if (hint) hint.hidden = !!b;
      var none = document.getElementById("no-accounts-hint");
      if (none) none.hidden = !b || visible > 0;
      checkMedia();
    };
    /* Dosya boyutu: gönderilmeden önce kontrol (sınır sunucudan: sm/constants.py MAX_UPLOAD) */
    var sizeError = document.getElementById("media-size-error");
    var fileTooLarge = function () {
      var max = mediaInput ? parseInt(mediaInput.getAttribute("data-max-bytes") || "0", 10) : 0;
      var f = mediaInput && mediaInput.files && mediaInput.files[0];
      return !!(f && max > 0 && f.size > max);
    };
    var checkSize = function () {
      var big = fileTooLarge();
      if (sizeError) {
        sizeError.textContent = big ? mediaInput.getAttribute("data-too-large-msg") : "";
        sizeError.hidden = !big;
      }
      if (mediaInput) { mediaInput.setAttribute("aria-invalid", big ? "true" : "false"); }
      return !big;
    };
    var postForm = document.getElementById("post-form");
    if (postForm) {
      postForm.addEventListener("submit", function (ev) {
        if (!checkSize()) { ev.preventDefault(); mediaInput.focus(); }
      });
    }

    /* Zamanlama: geçmiş saat yazılırken canlı uyarı (sunucu da reddeder; 1 dk pay) */
    var whenInput = document.getElementById("post-when");
    var pastBox = document.getElementById("past-warning");
    var checkPast = function () {
      if (!whenInput || !pastBox) return;
      var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(whenInput.value || "");
      var past = false;
      if (m) {
        var t = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime();
        var cutoff = new Date();
        cutoff.setSeconds(0, 0);
        past = t < cutoff.getTime() - 60000;
      }
      pastBox.textContent = past ? whenInput.getAttribute("data-past-msg") : "";
      pastBox.className = past ? "alert alert-warning" : "";
      whenInput.setAttribute("aria-invalid", past ? "true" : "false");
    };
    if (whenInput) {
      whenInput.addEventListener("input", checkPast);
      whenInput.addEventListener("change", checkPast);
      checkPast();
    }

    brandSel.addEventListener("change", syncBrand);
    if (mediaInput) mediaInput.addEventListener("change", function () { checkMedia(); checkSize(); });
    if (removeMedia) removeMedia.addEventListener("change", checkMedia);
    $all(".target-item input").forEach(function (cb) { cb.addEventListener("change", checkMedia); });
    syncBrand();
  }

  /* "Paylaşılıyor" durumunu izle */
  var poll = $("[data-poll-status]");
  if (poll) {
    var url = poll.getAttribute("data-poll-status");
    var timer = setInterval(function () {
      /* X-Background: sunucu bu istekle hareketsizlik sayacını yenilemez */
      fetch(url, { credentials: "same-origin", cache: "no-store",
                   headers: { "X-Requested-With": "fetch", "X-Background": "1" } })
        .then(function (r) { return r.json(); })
        .then(function (d) { if (d && d.status && d.status !== "posting") { clearInterval(timer); window.location.reload(); } })
        .catch(function () { /* sonra tekrar */ });
    }, 3000);
  }

  /* YouTube yetkilendirme: bekleme kutusu (geri sayım, durum sorgusu, İptal) — sayfa donmaz */
  /* Geri yüklemeden sonra: program yeniden açılana kadar bekle, sonra kilit ekranına geç (yeni örnek farklı
     X-SM-Instance başlığıyla yanıt verir; eski örnek kapanırken yanıt verse bile geçilmez). */
  var rs = document.getElementById("sm-restarting");
  if (rs) {
    var rsOld = rs.getAttribute("data-instance");
    var rsTarget = rs.getAttribute("data-target");
    var rsNext = function () { setTimeout(rsPoll, 2000); };
    var rsPoll = function () {
      fetch(rsTarget, { credentials: "same-origin", cache: "no-store" }).then(function (r) {
        var id = r.headers.get("X-SM-Instance");
        if (r.ok && id && id !== rsOld) { window.location.href = rsTarget; } else { rsNext(); }
      }).catch(rsNext);
    };
    rsNext();
  }

  var yt = document.getElementById("yt-auth");
  if (yt && yt.getAttribute("data-final") !== "1") {
    var ytWait = $("[data-yt-wait]", yt);
    var ytResult = $("[data-yt-result]", yt);
    var ytDone = $("[data-yt-done]", yt);
    var ytCount = $("[data-yt-countdown]", yt);
    var ytForm = $("[data-yt-cancel-form]", yt);
    var ytLeft = parseInt(yt.getAttribute("data-remaining") || "0", 10);
    var ytClasses = { done: "alert alert-success", cancelled: "alert alert-info" };
    var ytFmt = function (s) { var r = s % 60; return Math.floor(s / 60) + ":" + (r < 10 ? "0" : "") + r; };
    var ytTick, ytPoll;
    var ytOpen = $("[data-yt-open]", yt);
    var ytLink = function (url) {  /* yalnız Google onay sayfası (sunucu da denetler) */
      if (ytOpen && url && url.indexOf("https://accounts.google.com/") === 0) {
        $("[data-yt-link]", ytOpen).setAttribute("href", url);
        ytOpen.hidden = false;
      }
    };
    var ytFinish = function (d) {
      clearInterval(ytTick); clearInterval(ytPoll);
      ytWait.hidden = true;
      if (ytOpen) { ytOpen.hidden = true; }
      ytResult.className = ytClasses[d.state] || "alert alert-danger";
      ytResult.textContent = d.message || "";
      ytDone.hidden = false;
    };
    var ytCheck = function () {
      fetch(yt.getAttribute("data-status-url"), { credentials: "same-origin", cache: "no-store",
            headers: { "X-Requested-With": "fetch", "X-Background": "1" } })
        .then(function (r) {
          if (r.status === 401) { window.location.href = "/unlock"; throw new Error("locked"); }
          return r.json();
        })
        .then(function (d) {
          if (!d || !d.state) return;
          if (d.final) { ytFinish(d); } else { ytLeft = d.remaining; ytCount.textContent = ytFmt(ytLeft); ytLink(d.auth_url); }
        })
        .catch(function () { /* bir sonraki sorguda tekrar */ });
    };
    ytTick = setInterval(function () { ytLeft = Math.max(0, ytLeft - 1); ytCount.textContent = ytFmt(ytLeft); }, 1000);
    ytPoll = setInterval(ytCheck, 2000);
    if (ytForm) {
      ytForm.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var btn = $("button", ytForm);
        btn.disabled = true;
        btn.textContent = "İptal ediliyor…";
        postJSON(ytForm.getAttribute("action"), {}).then(ytCheck).catch(function (err) {
          btn.disabled = false;
          btn.textContent = "İptal";
          showError(err);
        });
      });
    }
  }

  /* Otomatik kilit: hareketsizlikte sayfayı yenile (sunucu kilit ekranına yönlendirir),
     hareket varken sunucu oturumunu canlı tut. */
  var minutes = parseInt(document.body.getAttribute("data-autolock") || "0", 10);
  if (minutes > 0) {
    var limitMs = minutes * 60 * 1000;
    var lastActivity = Date.now();
    var lastPing = Date.now();
    var onActivity = function () {
      lastActivity = Date.now();
      if (Date.now() - lastPing > 60000) {
        lastPing = Date.now();
        postJSON("/ping", {}).catch(function () { /* 401 -> yönlendirildi */ });
      }
    };
    ["mousedown", "keydown", "scroll", "touchstart", "input"].forEach(function (evName) {
      document.addEventListener(evName, onActivity, { passive: true, capture: true });
    });
    setInterval(function () {
      if (Date.now() - lastActivity > limitMs + 2000) { window.location.reload(); }
    }, 15000);
  }
})();
