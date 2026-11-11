// CV: bahasa dari ?lang= sebelum render, dan tombol cetak.
// File statis (bukan inline) supaya lolos Content-Security-Policy tanpa 'unsafe-inline'.
(function () {
  var d = document.documentElement;
  var q = new URLSearchParams(location.search).get('lang');
  d.dataset.lang = q === 'en' ? 'en' : 'id';
  d.lang = d.dataset.lang;
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t.closest && t.closest('[data-print]')) window.print();
  });
})();
