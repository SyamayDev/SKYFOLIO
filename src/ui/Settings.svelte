<script lang="ts">
  import { settings, updateSettings, type Settings } from '../core/Settings';
  import { t } from '../i18n';
  import { actions } from './bridge';
  import type { QualitySetting } from '../config/quality';
  import type { AssistLevel } from '../config/flight';

  let gyroMsg = $state('');

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
      <select value={$settings.language} onchange={(e) => updateSettings('language', (e.currentTarget as HTMLSelectElement).value as 'auto')}>
        <option value="auto">{$t('settings.languageAuto')}</option>
        <option value="id">Indonesia</option>
        <option value="en">English</option>
      </select>
    </label>
    <button class="link" onclick={() => actions.restartTutorial()}>{$t('settings.replayTutorial')}</button>
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
    <label class="row"><span>{$t('settings.showFps')}</span><input type="checkbox" checked={$settings.graphics.showFps} onchange={(e) => set('graphics', { showFps: e.currentTarget.checked })} /></label>
  </section>

  <section>
    <h3>{$t('settings.audio')}</h3>
    {#each [['master', 'settings.master'], ['engine', 'settings.engine'], ['wind', 'settings.wind'], ['sfx', 'settings.sfx']] as [key, label] (key)}
      <label class="row">
        <span>{$t(label as Parameters<typeof $t>[0])}</span>
        <input type="range" min="0" max="1" step="0.05" value={$settings.audio[key as 'master']} oninput={(e) => updateSettings('audio', { [key as string]: Number(e.currentTarget.value) })} />
      </label>
    {/each}
    <label class="row"><span>{$t('settings.muteHidden')}</span><input type="checkbox" checked={$settings.audio.muteWhenTabHidden} onchange={(e) => set('audio', { muteWhenTabHidden: e.currentTarget.checked })} /></label>
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
    font-size: 16px;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 44px;
    font-size: 15px;
  }
  select {
    font: inherit;
    padding: 6px 10px;
    border-radius: 10px;
    border: 2px solid #e6dccb;
    background: var(--cream);
    min-height: 40px;
  }
  input[type='checkbox'] {
    width: 24px;
    height: 24px;
    accent-color: var(--sky);
  }
  input[type='range'] {
    width: 46%;
    accent-color: var(--sky);
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
    font-size: 14px;
    min-height: 38px;
  }
  .seg button.on {
    background: var(--sun);
  }
  .link {
    border: 0;
    background: transparent;
    color: var(--sky);
    font-size: 15px;
    padding: 8px 0;
    min-height: 40px;
  }
  .msg {
    margin: 0;
    color: var(--berry);
    font-size: 14px;
  }
</style>
