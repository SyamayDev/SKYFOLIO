<script lang="ts">
  /** Wajah Piko (anak kecil berseragam pilot) untuk gelembung obrolan — vektor, sama di semua perangkat. */
  let { size = 44, mood = 'happy' }: { size?: number; mood?: string } = $props();
</script>

<svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
  <circle cx="24" cy="27" r="15" fill="#FFD9B8" />
  <path d="M8.5 24c0-9 7-15.5 15.5-15.5S39.5 15 39.5 24c-2.5-1.6-8-2.6-15.5-2.6S11 22.4 8.5 24z" fill="#3AA0FF" />
  <path d="M8 24.2c4-1.7 9.4-2.5 16-2.5s12 .8 16 2.5l-1.2 2.2c-4-1.4-9-2-14.8-2s-10.8.6-14.8 2z" fill="#2B6FD0" />
  <circle cx="24" cy="14.5" r="2.6" fill="#FFC93C" />
  <circle cx="7.8" cy="28" r="3" fill="#2B2D42" />
  <circle cx="40.2" cy="28" r="3" fill="#2B2D42" />
  {#if mood === 'sleepy'}
    <path d="M16.5 30h4.5M27 30h4.5" stroke="#2B2D42" stroke-width="2" stroke-linecap="round" />
  {:else}
    <ellipse cx="18.8" cy="30" rx="2.2" ry="2.8" fill="#2B2D42" />
    <ellipse cx="29.2" cy="30" rx="2.2" ry="2.8" fill="#2B2D42" />
    <circle cx="19.6" cy="29" r="0.8" fill="#fff" />
    <circle cx="30" cy="29" r="0.8" fill="#fff" />
  {/if}
  <circle cx="14.5" cy="34.5" r="2.4" fill="#FF8FA3" opacity="0.75" />
  <circle cx="33.5" cy="34.5" r="2.4" fill="#FF8FA3" opacity="0.75" />
  {#if mood === 'wow' || mood === 'cheer'}
    <ellipse cx="24" cy="37" rx="2.6" ry="2.2" fill="#B5374A" />
  {:else}
    <path d="M20.5 36c1.8 1.8 5.2 1.8 7 0" fill="none" stroke="#B5374A" stroke-width="2" stroke-linecap="round" />
  {/if}
</svg>
