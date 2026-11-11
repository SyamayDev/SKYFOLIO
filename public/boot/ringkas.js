// Mode Ringkas: pilih bahasa & tema sebelum halaman tampil supaya tidak berkedip.
// File statis (bukan inline) supaya lolos Content-Security-Policy tanpa 'unsafe-inline'.
(function () {
  var d = document.documentElement;
  var lang = 'id';
  try {
    var q = new URLSearchParams(location.search).get('lang');
    var s = JSON.parse(localStorage.getItem('skyfolio:v1:settings') || '{}');
    lang = q || (s.language && s.language !== 'auto' ? s.language : (navigator.language || 'id').toLowerCase().indexOf('en') === 0 ? 'en' : 'id');
    var th = localStorage.getItem('skyfolio:ringkas:theme');
    if (th) d.dataset.theme = th;
  } catch (e) {
    // mode privat / storage diblokir: pakai bawaan
  }
  d.dataset.lang = lang === 'en' ? 'en' : 'id';
  d.lang = d.dataset.lang;
})();
