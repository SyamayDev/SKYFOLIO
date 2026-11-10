/** Mode Ringkas: gaya + tombol bahasa/tema (tanpa three.js, ringan). */
import '@fontsource/fredoka/600.css';
import '@fontsource/nunito-sans/400.css';
import '@fontsource/nunito-sans/700.css';
import './ringkas.css';

const d = document.documentElement;
document.getElementById('lang-toggle')?.addEventListener('click', () => {
  const next = d.dataset.lang === 'en' ? 'id' : 'en';
  d.dataset.lang = next;
  d.lang = next;
  try {
    const s = JSON.parse(localStorage.getItem('skyfolio:v1:settings') ?? '{}') as Record<string, unknown>;
    s.language = next;
    localStorage.setItem('skyfolio:v1:settings', JSON.stringify(s));
  } catch {
    // mode privat: cukup berlaku di halaman ini
  }
});
document.getElementById('theme-toggle')?.addEventListener('click', () => {
  const dark = d.dataset.theme === 'dark' || (!d.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  d.dataset.theme = dark ? 'light' : 'dark';
  try {
    localStorage.setItem('skyfolio:ringkas:theme', d.dataset.theme);
  } catch {
    // abaikan
  }
});
