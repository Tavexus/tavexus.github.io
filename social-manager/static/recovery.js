/* Kurtarma kodu ekranı: "Yazdır" düğmesi (satır içi betik yok — CSP) */
(function () {
  "use strict";
  var btns = document.querySelectorAll("[data-print]");
  for (var i = 0; i < btns.length; i++) {
    btns[i].addEventListener("click", function () { window.print(); });
  }
})();
