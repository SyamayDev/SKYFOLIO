/**
 * Render CV siap cetak (/cv/, docs/07 bagian 10) dari konten publik. Ramah ATS (teks asli),
 * dua bahasa (data-l, dipilih lewat ?lang=id|en). Field needsConfirmation sudah dibuang sebelumnya.
 */
import { escapeHtml as esc } from '../../src/content/markdown';
import { pickText } from '../../src/content/public';
import type { LText, SiteContent } from '../../src/content/schema';
import { both, tx, yearRange } from './render-ringkas';

type Loc = 'id' | 'en';

const CV = {
  id: {
    summary: 'Ringkasan',
    education: 'Pendidikan',
    experience: 'Pengalaman',
    organization: 'Organisasi',
    competition: 'Kompetisi',
    projects: 'Proyek Unggulan',
    skills: 'Keahlian',
    certificates: 'Sertifikat',
    contact: 'Kontak',
    web: 'Portofolio 3D',
  },
  en: {
    summary: 'Summary',
    education: 'Education',
    experience: 'Experience',
    organization: 'Organizations',
    competition: 'Competitions',
    projects: 'Featured Projects',
    skills: 'Skills',
    certificates: 'Certificates',
    contact: 'Contact',
    web: '3D Portfolio',
  },
} as const;

function section(key: keyof (typeof CV)['id'], body: string): string {
  if (!body.trim()) return '';
  return `<section><h2>${both((l: Loc) => CV[l][key])}</h2>${body}</section>`;
}

export function renderCv(c: SiteContent): string {
  const p = c.profile;
  const items = c.timeline.items;
  const entry = (it: (typeof items)[number]): string => {
    const yr = both((l) => yearRange(it.start, it.end, l));
    const res = it.result ? ` — ${esc(it.result)}` : '';
    const sum = it.summary && (it.summary.id || it.summary.en) ? `<p>${both((l) => tx(it.summary, l))}</p>` : '';
    return `<div class="entry"><div class="entry-head"><strong>${both((l) => tx(it.title, l))}</strong><span class="when">${yr}</span></div>${
      it.org ? `<div class="org">${esc(it.org)}${it.location ? `, ${esc(it.location)}` : ''}${res}</div>` : ''
    }${sum}</div>`;
  };
  const byType = (types: string[]): string => items.filter((i) => types.includes(i.type)).map(entry).join('');
  const projects = c.projects
    .filter((x) => x.featured)
    .map((x) => {
      const links = [x.links.demo, x.links.repo].filter(Boolean).map((u) => `<a href="${esc(u!)}">${esc(u!.replace(/^https?:\/\//, ''))}</a>`).join(' · ');
      const meta = [x.year ? String(x.year) : '', x.tech.join(', ')].filter(Boolean).map(esc).join(' · ');
      return `<div class="entry"><div class="entry-head"><strong>${esc(x.title)}</strong><span class="when">${meta}</span></div><p>${both((l) => tx(x.summary, l))}</p>${links ? `<div class="org">${links}</div>` : ''}</div>`;
    })
    .join('');
  const skills = c.skills.groups
    .filter((g) => g.skills.length)
    .map(
      (g) =>
        `<p class="skills"><strong>${both((l) => tx(g.label, l))}:</strong> ${both((l) =>
          g.skills.map((s) => (typeof s.name === 'string' ? esc(s.name) : tx(s.name as LText, l))).join(', '),
        )}</p>`,
    )
    .join('');
  const certs = c.certificates.items
    .map((ct) => `<div class="entry"><div class="entry-head"><strong>${both((l) => tx(ct.title, l))}</strong><span class="when">${esc(ct.date ?? '')}</span></div><div class="org">${esc(ct.issuer ?? '')}</div></div>`)
    .join('');
  const contact = c.socials.links
    .filter((x) => x.public)
    .map((x) => `<li><span>${esc(x.label)}:</span> <a href="${esc(x.url)}">${esc(x.value)}</a></li>`)
    .join('');
  const site = process.env.VITE_SITE_URL;
  return `<article class="cv">
<header>
  <h1>${esc(p.name)}</h1>
  <p class="role">${both((l) => tx(p.tagline, l))} · ${both((l) => tx(p.education.program, l))}, ${esc(p.education.campus)} · ${esc(p.hometown.city)}, ${esc(p.hometown.country ?? '')}</p>
  <ul class="contact">${contact}${site ? `<li><span>${both((l: Loc) => CV[l].web)}:</span> <a href="${esc(site)}">${esc(site.replace(/^https?:\/\//, ''))}</a></li>` : ''}</ul>
</header>
${section('summary', `<p>${both((l) => esc(pickText(p.bio, l)))}</p>`)}
${section('education', byType(['education']))}
${section('experience', byType(['internship', 'work']))}
${section('organization', byType(['organization', 'volunteer']))}
${section('competition', byType(['competition', 'award']))}
${section('projects', projects)}
${section('skills', skills)}
${section('certificates', certs)}
</article>`;
}
