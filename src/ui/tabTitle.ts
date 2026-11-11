/** Judul tab mengikuti lokasi terbang (docs/11 bagian 6), misalnya "Lembah Lampion Danau Toba · SKYFOLIO". */
import { L, content, zoneById } from '../content';
import { appPhase, currentZone } from '../core/AppState';
import { locale, translate } from '../i18n';

export function wireTabTitle(): () => void {
  const apply = (): void => {
    const l = locale.get();
    const id = appPhase.get() === 'flying' ? currentZone.get() : null;
    const zone = id ? zoneById(id) : undefined;
    const name = zone ? L(zone.name, l) : '';
    document.title = name ? translate(l, 'meta.titleZone', { zone: name }) : translate(l, 'meta.title');
  };
  const offs = [locale.subscribe(apply), currentZone.subscribe(apply), appPhase.subscribe(apply), content.subscribe(apply)];
  return () => {
    for (const off of offs) off();
  };
}
