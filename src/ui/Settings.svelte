<script lang="ts">
  import { settings, updateSettings, type Settings } from '../core/Settings';
  import { t } from '../i18n';
  import { actions } from './bridge';
  import { toStation } from '../audio/MusicEngine/MusicEngine';
  import type { QualitySetting } from '../config/quality';
  import type { AssistLevel } from '../config/flight';
  import { resetProgress } from '../game/Progress';

  let gyroMsg = $state('');
  // Reset progres dua langkah: tekan sekali → minta konfirmasi 5 detik → tekan lagi.
  let resetArmed = $state(false);
  let resetDone = $state(false);
  let resetTimer: ReturnType<typeof setTimeout> | undefined;
  function onReset(): void {
    actions.click();
    if (!resetArmed) {
      resetArmed = true;
      resetDone = false;
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => (resetArmed = false), 5000);
      return;
    }
    clearTimeout(resetTimer);
    resetArmed = false;
    resetProgress();
    resetDone = true;
  }

  function set<K extends keyof Settings>(section: K, patch: Partial<Settings[K]>): void {
    actions.click();
    updateSettings(section, patch);
  }

  async function toggleGyro(on: boolean): Promise<void> {
    gyroMsg = '';
    if (on) {
      const res = await actions.requestGyro();
      if (res !== 'granted') {
        gyroMsg = res === 'denied' ? $t('settings.gyroDenied') : $t('settings.gyroUnavailable');
        return;
      }
    }
    set('controls', { gyroSteering: on });
  }

  const qualities: { value: QualitySetting; key: Parameters<typeof $t>[0] }[] = [
    { value: 'auto', key: 'settings.qualityAuto' },
    { value: 'low', key: 'settings.qualityLow' },
    { value: 'medium', key: 'settings.qualityMedium' },
    { value: 'high', key: 'settings.qualityHigh' },
    { value: 'ultra', key: 'settings.qualityUltra' },
  ];
  const weathers = ['clear', 'cloudy', 'rain', 'storm', 'snow', 'fog'];
  const stations = ['syamay', 'funkot', 'timur', 'gurun', 'energi'];
  const assists: { value: AssistLevel; key: Parameters<typeof $t>[0] }[] = [
    { value: 'full', key: 'settings.assistFull' },
    { value: 'normal', key: 'settings.assistNormal' },
    { value: 'off', key: 'settings.assistOff' },
  ];
</script>

<div class="settings">
  <section>
    <h3>{$t('settings.general')}</h3>
    <label class="row">
      <span>{$t('settings.language')}</span>
      <select value={$settings.language} data-testid="language-select" onchange={(e) => updateSettings('language', (e.currentTarget as HTMLSelectElement).value as 'auto')}>
        <option value="auto">{$t('settings.languageAuto')}</option>
        <option value="id">Indonesia</option>
        <option value="en">English</option>
      </select>
    </label>
    <button class="link" onclick={() => actions.restartTutorial()}>{$t('settings.replayTutorial')}</button>
  </section>

  <section>
    <h3>{$t('settings.world')}</h3>
    <label class="row"><span>{$t('settings.realTime')}</span><input type="checkbox" checked={$settings.world.realTimeDayNight} onchange={(e) => set('world', { realTimeDayNight: e.currentTarget.checked })} data-testid="set-realtime" /></label>
    {#if !$settings.world.realTimeDayNight}
      <label class="row"><span>{$t('settings.hour')} · {String(Math.floor($settings.world.manualTimeOfDay)).padStart(2, '0')}.{String(Math.round(($settings.world.manualTimeOfDay % 1) * 60)).padStart(2, '0')}</span><input type="range" min="0" max="23.75" step="0.25" value={$settings.world.manualTimeOfDay} oninput={(e) => updateSettings('world', { manualTimeOfDay: Number(e.currentTarget.value) })} /></label>
    {/if}
    <label class="row"><span>{$t('settings.realWeather')}</span><input type="checkbox" checked={$settings.world.realHometownWeather} onchange={(e) => set('world', { realHometownWeather: e.currentTarget.checked })} /></label>
    {#if !$settings.world.realHometownWeather}
      <label class="row">
        <span>{$t('settings.weather')}</span>
        <select value={$settings.world.manualWeather} onchange={(e) => set('world', { manualWeather: (e.currentTarget as HTMLSelectElement).value })} data-testid="set-weather">
          {#each weathers as w (w)}<option value={w}>{$t(`weather.${w}` as Parameters<typeof $t>[0])}</option>{/each}
        </select>
      </label>
    {/if}
    <label class="row"><span>{$t('settings.seasons')}</span><input type="checkbox" checked={$settings.world.seasons} onchange={(e) => set('world', { seasons: e.currentTarget.checked })} /></label>
    <label class="row"><span>{$t('settings.uiTheme')}</span><input type="checkbox" checked={$settings.world.uiThemeFollowsDayNight} onchange={(e) => set('world', { uiThemeFollowsDayNight: e.currentTarget.checked })} /></label>
  </section>

  <section>
    <h3>{$t('settings.controls')}</h3>
    <div class="row">
      <span>{$t('settings.assist')}</span>
      <div class="seg" role="radiogroup" aria-label={$t('settings.assist')}>
        {#each assists as a (a.value)}
          <button role="radio" aria-checked={$settings.controls.assistLevel === a.value} class:on={$settings.controls.assistLevel === a.value} onclick={() => set('controls', { assistLevel: a.value })}>{$t(a.key)}</button>
        {/each}
      </div>
    </div>
    <label class="row"><span>{$t('settings.invertPitch')}</span><input type="checkbox" checked={$settings.controls.invertPitch} onchange={(e) => set('controls', { invertPitch: e.currentTarget.checked })} /></label>
    <label class="row"><span>{$t('settings.vibration')}</span><input type="checkbox" checked={$settings.controls.vibration} onchange={(e) => set('controls', { vibration: e.currentTarget.checked })} /></label>
    <label class="row"><span>{$t('settings.cameraShake')}</span><input type="checkbox" checked={$settings.controls.cameraShake} onchange={(e) => set('controls', { cameraShake: e.currentTarget.checked })} /></label>
    <label class="row"><span>{$t('settings.gyro')}</span><input type="checkbox" checked={$settings.controls.gyroSteering} onchange={(e) => toggleGyro(e.currentTarget.checked)} /></label>
    {#if gyroMsg}<p class="msg">{gyroMsg}</p>{/if}
    {#if $settings.controls.gyroSteering}
      <label class="row"><span>{$t('settings.gyroSensitivity')}</span><input type="range" min="0.4" max="2" step="0.1" value={$settings.controls.gyroSensitivity} oninput={(e) => updateSettings('controls', { gyroSensitivity: Number(e.currentTarget.value) })} /></label>
    {/if}
    <label class="row">
      <span>{$t('settings.canopy')}</span>
      <select value={$settings.controls.canopy} onchange={(e) => set('controls', { canopy: (e.currentTarget as HTMLSelectElement).value as 'auto' })}>
        <option value="auto">{$t('settings.canopyAuto')}</option>
        <option value="open">{$t('settings.canopyOpen')}</option>
        <option value="closed">{$t('settings.canopyClosed')}</option>
      </select>
    </label>
    <label class="row">
      <span>{$t('settings.joystickSide')}</span>
      <select value={$settings.controls.touchJoystickSide} onchange={(e) => set('controls', { touchJoystickSide: (e.currentTarget as HTMLSelectElement).value as 'left' })}>
        <option value="left">{$t('settings.left')}</option>
        <option value="right">{$t('settings.right')}</option>
      </select>
    </label>
  </section>

  <section>
    <h3>{$t('settings.camera')}</h3>
    <label class="row">
      <span>{$t('settings.cameraMode')}</span>
      <select value={$settings.camera.mode} onchange={(e) => set('camera', { mode: (e.currentTarget as HTMLSelectElement).value as 'chase' })}>
        <option value="chase">{$t('settings.cameraChase')}</option>
        <option value="cockpit">{$t('settings.cameraCockpit')}</option>
      </select>
    </label>
    <label class="row"><span>{$t('settings.fovBoost')}</span><input type="checkbox" checked={$settings.camera.fovBoost} onchange={(e) => set('camera', { fovBoost: e.currentTarget.checked })} /></label>
  </section>

  <section>
    <h3>{$t('settings.graphics')}</h3>
    <label class="row">
      <span>{$t('settings.quality')}</span>
      <select value={$settings.graphics.quality} onchange={(e) => set('graphics', { quality: (e.currentTarget as HTMLSelectElement).value as QualitySetting })}>
        {#each qualities as q (q.value)}<option value={q.value}>{$t(q.key)}</option>{/each}
      </select>
    </label>
    <label class="row">
      <span>{$t('settings.postProcessing')}</span>
      <select value={$settings.graphics.postProcessing} onchange={(e) => set('graphics', { postProcessing: (e.currentTarget as HTMLSelectElement).value })}>
        <option value="auto">{$t('settings.ppAuto')}</option>
        <option value="on">{$t('settings.ppOn')}</option>
        <option value="off">{$t('settings.ppOff')}</option>
      </select>
    </label>
    <label class="row"><span>{$t('settings.showFps')}</span><input type="checkbox" checked={$settings.graphics.showFps} onchange={(e) => set('graphics', { showFps: e.currentTarget.checked })} /></label>
  </section>

  <section>
    <h3>{$t('settings.audio')}</h3>
    {#each [['master', 'settings.master'], ['music', 'settings.music'], ['engine', 'settings.engine'], ['wind', 'settings.wind'], ['sfx', 'settings.sfx'], ['ambient', 'settings.ambient'], ['ui', 'settings.uiSounds']] as [key, label] (key)}
      <label class="row">
        <span>{$t(label as Parameters<typeof $t>[0])}</span>
        <input type="range" min="0" max="1" step="0.05" value={$settings.audio[key as 'master']} oninput={(e) => updateSettings('audio', { [key as string]: Number(e.currentTarget.value) })} />
      </label>
    {/each}
    <label class="row">
      <span>{$t('settings.radio')}</span>
      <select value={toStation($settings.audio.radioStation)} onchange={(e) => set('audio', { radioStation: (e.currentTarget as HTMLSelectElement).value })} data-testid="set-radio">
        {#each stations as st (st)}<option value={st}>{$t(`radio.${st}` as Parameters<typeof $t>[0])}</option>{/each}
      </select>
    </label>
    <label class="row"><span>{$t('settings.muteHidden')}</span><input type="checkbox" checked={$settings.audio.muteWhenTabHidden} onchange={(e) => set('audio', { muteWhenTabHidden: e.currentTarget.checked })} /></label>
  </section>

  <section>
    <h3>{$t('settings.copilot')}</h3>
    <label class="row"><span>{$t('settings.copilotOn')}</span><input type="checkbox" checked={$settings.copilot.enabled} onchange={(e) => set('copilot', { enabled: e.currentTarget.checked })} /></label>
    <label class="row"><span>{$t('settings.subtitles')}</span><input type="checkbox" checked={$settings.copilot.subtitles} onchange={(e) => set('copilot', { subtitles: e.currentTarget.checked })} /></label>
    <label class="row">
      <span>{$t('settings.chatter')}</span>
      <select value={$settings.copilot.chatterLevel} onchange={(e) => set('copilot', { chatterLevel: (e.currentTarget as HTMLSelectElement).value as 'normal' })}>
        <option value="quiet">{$t('settings.chatterQuiet')}</option>
        <option value="normal">{$t('settings.chatterNormal')}</option>
        <option value="chatty">{$t('settings.chatterChatty')}</option>
      </select>
    </label>
  </section>

  <section>
    <h3>{$t('settings.accessibility')}</h3>
    <label class="row">
      <span>{$t('settings.reducedMotion')}</span>
      <select value={$settings.accessibility.reducedMotion} onchange={(e) => set('accessibility', { reducedMotion: (e.currentTarget as HTMLSelectElement).value as 'auto' })}>
        <option value="auto">{$t('settings.reducedMotionAuto')}</option>
        <option value="on">{$t('common.on')}</option>
        <option value="off">{$t('common.off')}</option>
      </select>
    </label>
    <label class="row"><span>{$t('settings.highContrast')}</span><input type="checkbox" checked={$settings.accessibility.highContrastUi} onchange={(e) => set('accessibility', { highContrastUi: e.currentTarget.checked })} data-testid="set-contrast" /></label>
    <label class="row"><span>{$t('settings.largeText')}</span><input type="checkbox" checked={$settings.accessibility.largeText} onchange={(e) => set('accessibility', { largeText: e.currentTarget.checked })} data-testid="set-largetext" /></label>
    <label class="row"><span>{$t('settings.colorblindMarkers')}</span><input type="checkbox" checked={$settings.accessibility.colorblindFriendlyMarkers} onchange={(e) => set('accessibility', { colorblindFriendlyMarkers: e.currentTarget.checked })} /></label>
  </section>

  <section>
    <h3>{$t('settings.data')}</h3>
    <button class="link danger" onclick={onReset} data-testid="reset-progress">{resetArmed ? $t('settings.resetConfirm') : $t('settings.resetProgress')}</button>
    {#if resetDone}<p class="msg ok" role="status">{$t('settings.resetDone')}</p>{/if}
  </section>
</div>

<style>
  .settings {
    display: grid;
    gap: 12px;
  }
  section {
    background: #fff;
    border-radius: 16px;
    padding: 10px 14px;
  }
  h3 {
    margin: 0 0 6px;
    font-family: var(--font-title);
    font-size: calc(16px * var(--text-scale, 1));
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 44px;
    font-size: calc(15px * var(--text-scale, 1));
  }
  select {
    font: inherit;
    padding: 6px 10px;
    border-radius: 10px;
    border: 2px solid #e6dccb;
    background: var(--cream);
    min-height: 40px;
  }
  /* Sakelar geser (ganti checkbox bawaan browser yang berbeda-beda tiap perangkat). */
  input[type='checkbox'] {
    appearance: none;
    -webkit-appearance: none;
    flex: none;
    position: relative;
    width: 50px;
    height: 30px;
    margin: 0;
    border-radius: 999px;
    background: #ddd3c2;
    cursor: pointer;
    transition: background 0.18s;
  }
  input[type='checkbox']::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 3px rgba(43, 45, 66, 0.3);
    transition: transform 0.18s cubic-bezier(0.3, 1.4, 0.5, 1);
  }
  input[type='checkbox']:checked {
    background: var(--leaf);
  }
  input[type='checkbox']:checked::after {
    transform: translateX(20px);
  }
  input[type='checkbox']:focus-visible,
  select:focus-visible,
  input[type='range']:focus-visible {
    outline: 3px solid var(--sun);
    outline-offset: 2px;
  }
  input[type='range'] {
    width: 46%;
    accent-color: #2f8fa6;
    cursor: pointer;
  }
  select {
    cursor: pointer;
    color: var(--ink);
  }
  @media (prefers-reduced-motion: reduce) {
    input[type='checkbox'],
    input[type='checkbox']::after {
      transition: none;
    }
  }
  .seg {
    display: flex;
    background: var(--cream);
    border-radius: 12px;
    padding: 3px;
  }
  .seg button {
    border: 0;
    background: transparent;
    padding: 8px 10px;
    border-radius: 10px;
    font-size: calc(14px * var(--text-scale, 1));
    min-height: 38px;
  }
  .seg button.on {
    background: var(--sun);
  }
  .link {
    border: 0;
    background: transparent;
    color: var(--sky);
    font-size: calc(15px * var(--text-scale, 1));
    padding: 8px 0;
    min-height: 40px;
  }
  .link.danger {
    color: var(--berry);
    font-weight: 700;
  }
  .msg.ok {
    color: var(--ink);
  }
  .msg {
    margin: 0;
    color: var(--berry);
    font-size: calc(14px * var(--text-scale, 1));
  }
</style>
