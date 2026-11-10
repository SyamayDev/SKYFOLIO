/**
 * Render HTML statis Mode Ringkas (/ringkas/, docs/07 bagian 9) dari konten publik.
 * Kedua bahasa ada di DOM (atribut data-l) dan ditukar dengan atribut html[data-lang] → tanpa reload,
 * tanpa three.js, ramah SEO. Semua teks tentang Aril berasal dari content/ (aturan 1).
 */
import { escapeHtml as esc } from '../../src/content/markdown';
import { pickText } from '../../src/content/public';
import type { LText, MediaImage, Project, SiteContent } from '../../src/content/schema';

type Loc = 'id' | 'en';
const LOCS: Loc[] = ['id', 'en'];

export const UI = {
  id: {
    enter: 'Masuk ke dunia 3D',
    about: 'Tentang',
    projects: 'Proyek',
    featured: 'Unggulan',
    skills: 'Skill',
    journey: 'Perjalanan',
    certificates: 'Sertifikat',
    contact: 'Kontak',
    cv: 'Unduh CV',
    demo: 'Demo',
    repo: 'Kode',
    now: 'sekarang',
    tagline3d: 'Portofolio 3D interaktif: terbangkan pesawat keliling Bumi bersama co-pilot Piko.',
    noCert: 'Sertifikat sedang dikumpulkan.',
    lang: 'English',
    theme: 'Tema',
    role: 'Peran',
    team: 'Tim',
    madeWith: 'Dibuat dengan three.js, Rapier, dan Svelte. Semua isi dari folder konten SKYFOLIO.',
    interests: 'Minat',
    from: 'dari',
    semester: 'Semester',
  },
  en: {
    enter: 'Enter the 3D world',
    about: 'About',
    projects: 'Projects',
    featured: 'Featured',
    skills: 'Skills',
    journey: 'Journey',
    certificates: 'Certificates',
    contact: 'Contact',
    cv: 'Download CV',
    demo: 'Demo',
    repo: 'Code',
    now: 'now',
    tagline3d: 'An interactive 3D portfolio: fly a plane around the Earth with co-pilot Piko.',
    noCert: 'Certificates are being collected.',
    lang: 'Bahasa Indonesia',
    theme: 'Theme',
    role: 'Role',
    team: 'Team',
    madeWith: 'Made with three.js, Rapier, and Svelte. All text comes from the SKYFOLIO content folder.',
    interests: 'Interests',
    from: 'from',
    semester: 'Semester',
  },
} as const;

/** Dua span (ID & EN); jika keduanya sama cukup satu. */
export function both(fn: (l: Loc) => string, tag = 'span'): string {
  const a = fn('id');
  const b = fn('en');
  if (a === b) return a;
  return `<${tag} data-l="id">${a}</${tag}><${tag} data-l="en" lang="en">${b}</${tag}>`;
}

export function tx(t: LText | string | null | undefined, l: Loc): string {
  return esc(pickText(t, l));
}

function picture(img: MediaImage | null, alt: string, cls: string, sizes = '(max-width: 700px) 92vw, 420px'): string {
  if (!img) return '';
  return `<picture class="${cls}"><source type="image/avif" srcset="${esc(img.avifSrcset)}" sizes="${sizes}"><img src="${esc(img.src)}" srcset="${esc(img.srcset)}" sizes="${sizes}" width="${img.width}" height="${img.height}" alt="${esc(alt)}" loading="lazy" decoding="async" style="background-image:url(${img.blur});background-size:cover"></picture>`;
}

export function yearRange(start: string | null | undefined, end: string | null | undefined, l: Loc): string {
  if (!start && !end) return '';
  if (start && end) return start === end ? esc(start) : `${esc(start)} – ${esc(end)}`;
  if (start) return `${esc(start)} – ${UI[l].now}`;
  return esc(end ?? '');
}

function projectCard(p: Project): string {
  const tech = p.tech.length ? `<ul class="chips">${p.tech.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '';
  const links = [
    p.links.demo ? `<a class="btn small" href="${esc(p.links.demo)}" target="_blank" rel="noopener">${both((l) => UI[l].demo)} ↗</a>` : '',
    p.links.repo ? `<a class="btn small ghost" href="${esc(p.links.repo)}" target="_blank" rel="noopener">${both((l) => UI[l].repo)} ↗</a>` : '',
  ].join('');
  const meta = [
    p.year ? esc(String(p.year)) : '',
    p.role && (p.role.id || p.role.en) ? both((l) => `${UI[l].role}: ${tx(p.role, l)}`) : '',
    p.team ? both((l) => `${UI[l].team}: ${esc(p.team ?? '')}`) : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const initials = p.title
    .split(/[\s-]+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 3);
  const cover = p.cover ? picture(p.cover, p.title, 'cover') : `<div class="cover placeholder" aria-hidden="true">${esc(initials)}</div>`;
  return `<article class="card project" id="proyek-${esc(p.id)}">
  ${cover}
  <div class="pad">
    ${p.featured ? `<span class="badge">★ ${both((l) => UI[l].featured)}</span>` : ''}
    <h3>${esc(p.title)}</h3>
    ${p.fullTitle ? `<p class="muted">${both((l) => tx(p.fullTitle, l))}</p>` : ''}
    <p>${both((l) => tx(p.summary, l))}</p>
    ${meta ? `<p class="muted small">${meta}</p>` : ''}
    ${tech}
    <div class="row">${links}</div>
  </div>
</article>`;
}

export function personJsonLd(c: SiteContent, siteUrl: string): string {
  const sameAs = c.socials.links.filter((x) => x.public && x.url.startsWith('http')).map((x) => x.url);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: c.profile.name,
    alternateName: c.profile.nickname,
    description: pickText(c.profile.tagline, 'en'),
    email: `mailto:${c.socials.contactEmail}`,
    address: { '@type': 'PostalAddress', addressLocality: c.profile.hometown.city, addressCountry: 'ID' },
    affiliation: { '@type': 'CollegeOrUniversity', name: c.profile.education.campus },
    knowsAbout: c.skills.groups.flatMap((g) => g.skills.map((s) => (typeof s.name === 'string' ? s.name : (s.name.en ?? s.name.id ?? s.id)))),
    url: siteUrl,
    sameAs,
  };
  return `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`;
}

export function renderRingkas(c: SiteContent): string {
  const p = c.profile;
  const siteUrl = process.env.VITE_SITE_URL || '';
  const photo = c.profilePhoto ? picture(c.profilePhoto, pickText(p.avatar.photoAlt, 'id') || p.name, 'avatar', '160px') : `<div class="avatar placeholder" aria-hidden="true">${esc(p.nickname.slice(0, 1))}</div>`;
  const featured = c.projects.filter((x) => x.featured);
  const others = c.projects.filter((x) => !x.featured);
  const skills = c.skills.groups
    .filter((g) => g.skills.length)
    .map(
      (g) => `<div class="card pad"><h3>${both((l) => tx(g.label, l))}</h3><ul class="skills">${g.skills
        .map((s) => {
          const name = typeof s.name === 'string' ? esc(s.name) : both((l) => tx(s.name as LText, l));
          const level = both((l) => tx(c.skills.levelScale[String(s.level)], l));
          return `<li><span>${name}</span><span class="lvl lvl-${s.level}" title="${s.level}/5">${level}</span></li>`;
        })
        .join('')}</ul></div>`,
    )
    .join('');
  const journey = c.timeline.items
    .map((it) => {
      const yr = both((l) => yearRange(it.start, it.end, l));
      const sum = it.summary ? both((l) => tx(it.summary, l), 'p') : '';
      return `<li class="card pad"><div class="when">${yr}</div><h3>${both((l) => tx(it.title, l))}</h3>${it.org ? `<p class="muted">${esc(it.org)}${it.location ? ` · ${esc(it.location)}` : ''}</p>` : ''}${sum}</li>`;
    })
    .join('');
  const certs = c.certificates.items.length
    ? `<ul class="grid">${c.certificates.items
        .map((ct) => `<li class="card pad"><h3>${both((l) => tx(ct.title, l))}</h3><p class="muted">${esc(ct.issuer ?? '')}${ct.date ? ` · ${esc(ct.date)}` : ''}</p></li>`)
        .join('')}</ul>`
    : `<p class="muted">${both((l) => UI[l].noCert)}</p>`;
  const contact = c.socials.links
    .filter((x) => x.public)
    .map((x) => `<li><a class="contact" href="${esc(x.url)}" ${x.url.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}><strong>${esc(x.label)}</strong><span>${esc(x.value)}</span></a></li>`)
    .join('');
  const semester = p.education.currentSemester ? both((l) => ` · ${UI[l].semester} ${p.education.currentSemester}`) : '';

  return `${personJsonLd(c, siteUrl)}
<header class="hero">
  <nav class="top">
    <span class="logo">SKY<b>FOLIO</b></span>
    <span class="row">
      <button type="button" class="chip" id="lang-toggle">${both((l) => UI[l].lang)}</button>
      <button type="button" class="chip" id="theme-toggle" aria-label="Tema / Theme">◐</button>
    </span>
  </nav>
  <div class="hero-in">
    ${photo}
    <div>
      <h1>${esc(p.name)} <span class="nick">(${esc(p.nickname)})</span></h1>
      <p class="tag">${both((l) => tx(p.tagline, l))}</p>
      <p class="muted">${both((l) => tx(p.education.program, l))} · ${esc(p.education.campus)}${semester} · ${esc(p.hometown.city)}</p>
      <div class="row">
        <a class="btn big" href="/">✈ ${both((l) => UI[l].enter)}</a>
        <a class="btn ghost" data-l="id" href="${esc(p.cv.id)}" download>${UI.id.cv} (PDF)</a>
        <a class="btn ghost" data-l="en" lang="en" href="${esc(p.cv.en)}" download>${UI.en.cv} (PDF)</a>
      </div>
      <p class="muted small">${both((l) => UI[l].tagline3d)}</p>
    </div>
  </div>
</header>
<main>
  <section id="tentang"><h2>${both((l) => UI[l].about)}</h2>
    <div class="card pad"><p>${both((l) => tx(p.bio, l))}</p>
    <p class="muted"><strong>${both((l) => UI[l].interests)}:</strong> ${both((l) => esc(p.interests[l].join(', ')))}</p></div>
  </section>
  <section id="proyek"><h2>${both((l) => UI[l].projects)}</h2>
    <div class="grid">${featured.map(projectCard).join('')}${others.map(projectCard).join('')}</div>
  </section>
  <section id="skill"><h2>${both((l) => UI[l].skills)}</h2><div class="grid">${skills}</div></section>
  <section id="perjalanan"><h2>${both((l) => UI[l].journey)}</h2><ol class="timeline">${journey}</ol></section>
  <section id="sertifikat"><h2>${both((l) => UI[l].certificates)}</h2>${certs}</section>
  <section id="kontak"><h2>${both((l) => UI[l].contact)}</h2><ul class="contacts">${contact}</ul></section>
</main>
<footer class="muted small"><p>${both((l) => UI[l].madeWith)}</p><p><a href="/">SKYFOLIO 3D</a> · <a href="/cv/">CV</a></p></footer>`;
}

export { LOCS };
