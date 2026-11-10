/**
 * Titik masuk pengalaman 3D SKYFOLIO.
 */
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/nunito-sans/400.css';
import '@fontsource/nunito-sans/600.css';
import '@fontsource/nunito-sans/700.css';
import './ui/theme.css';
import { mount } from 'svelte';
import App from './ui/App.svelte';
import { fatalError, paused } from './core/AppState';
import { hasGraphicsSupport } from './core/Support';
import { tr } from './i18n';
import { bindActions } from './ui/bridge';
import { wireUi } from './ui/glue';

wireUi();

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;
mount(App, { target: uiRoot });

async function start(): Promise<void> {
  if (!hasGraphicsSupport()) {
    fatalError.set(tr('errors.noWebgl'));
    setTimeout(() => location.assign('/ringkas/'), 4000);
    return;
  }
  // Muat dunia 3D secara dinamis supaya UI pra-terbang tampil secepat mungkin.
  const { Experience } = await import('./core/Experience');
  const exp = await Experience.create(canvas);
  bindActions({
    board: () => void exp.board(),
    respawn: () => {
      paused.set(false);
      exp.requestRespawn();
    },
    resume: () => paused.set(false),
    restartTutorial: () => {
      exp.tutorial.restart();
      paused.set(false);
    },
    skipTutorial: () => exp.tutorial.skip(),
    click: () => exp.audio.sfx?.click(),
    requestGyro: () => exp.requestGyro(),
    addLook: (dx, dy) => exp.input.addLook(dx, dy, 'touch'),
    flyTo: (dest) => exp.flyTo(dest),
    cancelAutopilot: () => exp.cancelAutopilot(),
    releaseLantern: () => exp.lantern.releaseLantern(),
    paperPlane: () => exp.post.launchPaperPlane(),
    hover: (on) => exp.hover(on),
  });
  if (import.meta.hot) import.meta.hot.dispose(() => exp.dispose());
}

start().catch((err: unknown) => {
  console.error('SKYFOLIO gagal dimuat:', err);
  fatalError.set(tr('errors.generic'));
});
