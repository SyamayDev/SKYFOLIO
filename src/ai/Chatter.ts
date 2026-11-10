/**
 * Obrolan otomatis Piko tanpa AI (docs/06 bagian 6): kalimat pendek per kejadian, ≥ 5 variasi per bahasa
 * (src/i18n: chatter.<kejadian>.0–4), tidak mengulang variasi yang sama berturut-turut. Frekuensi mengikuti
 * Pengaturan (Pendiam/Normal/Cerewet) lewat sayPiko; Piko juga beranimasi.
 */
import { bus, type GameEvents } from '../core/EventBus';
import { tr, type I18nKey } from '../i18n';
import { actions } from '../ui/bridge';
import { sayPiko } from '../ui/glue';

export const CHATTER_EVENTS = [
  'first',
  'takeoff',
  'smooth',
  'hard',
  'crash',
  'boost',
  'rain',
  'night',
  'cloud',
  'rocket',
  'strato',
  'space',
  'moon',
  'reentry',
  'back',
  'idle',
  'achievement',
] as const;
export type ChatterEvent = (typeof CHATTER_EVENTS)[number];
export const VARIANTS = 5;

const EMOTE: Partial<Record<ChatterEvent, 'wave' | 'cheer' | 'think' | 'sleepy' | 'wow'>> = {
  first: 'cheer',
  takeoff: 'cheer',
  smooth: 'cheer',
  crash: 'wow',
  boost: 'cheer',
  night: 'wow',
  rocket: 'wow',
  space: 'wow',
  moon: 'wow',
  reentry: 'wow',
  idle: 'sleepy',
  achievement: 'cheer',
};

const last: Partial<Record<ChatterEvent, number>> = {};

export function chatterLine(ev: ChatterEvent, rnd = Math.random): string {
  let i = Math.floor(rnd() * VARIANTS);
  if (i === last[ev]) i = (i + 1) % VARIANTS;
  last[ev] = i;
  return tr(`chatter.${ev}.${i}` as I18nKey);
}

function say(ev: ChatterEvent, priority = 1): void {
  sayPiko(chatterLine(ev), ev === 'crash' || ev === 'hard' ? 'wow' : 'happy', priority);
  const e = EMOTE[ev];
  if (e) actions.emote(e);
}

export function wireChatter(): () => void {
  let flights = 0;
  let boostAt = 0;
  const on = <K extends keyof GameEvents>(k: K, fn: (e: GameEvents[K]) => void): (() => void) => bus.on(k, fn);
  const offs = [
    on('plane:takeoff', () => {
      flights++;
      say(flights === 1 ? 'first' : 'takeoff', flights === 1 ? 2 : 1);
    }),
    on('plane:landed', (e) => say(e.smooth ? 'smooth' : 'hard')),
    on('plane:crash', (e) => {
      if (e.tier >= 2) say('crash', 2);
    }),
    on('plane:boost', (e) => {
      const now = performance.now();
      if (e.active && now - boostAt > 40_000) {
        boostAt = now;
        say('boost');
      }
    }),
    on('canopy', (e) => {
      if (e.closed) say('rain');
    }),
    on('world:night', (e) => {
      if (e.night) say('night');
    }),
    on('world:cloud', () => say('cloud')),
    on('rocket', (e) => {
      if (e.deployed) say('rocket', 3);
    }),
    on('flight:regime', (e) => {
      if (e.regime === 'stratosphere' && e.prev === 'air') say('strato', 2);
      else if (e.regime === 'space' && e.prev !== 'moon') say('space', 3);
      else if (e.regime === 'moon') say('moon', 3);
      else if (e.regime === 'air' && e.prev === 'stratosphere') say('back', 2);
    }),
    on('reentry', (e) => {
      if (e.active) say('reentry', 3);
    }),
    on('plane:idle', () => say('idle')),
    on('achievement', () => say('achievement', 2)),
  ];
  return () => offs.forEach((o) => o());
}
