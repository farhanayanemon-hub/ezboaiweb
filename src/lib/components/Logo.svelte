<script lang="ts">
  import { getContext } from "svelte";
  import { mode } from "mode-watcher";
  import type { SettingsState } from "$lib/stores/settings.svelte.js";

  // Props
  let {
    class: className = "",
    alt = "EzboAI",
    fallbackSrcDark = "/branding/logos/default-dark-logo.png",
    fallbackSrcLight = "/branding/logos/default-light-logo.png",
  }: {
    class?: string;
    alt?: string;
    fallbackSrcDark?: string;
    fallbackSrcLight?: string;
    fallbackSrc?: string;
  } = $props();

  // Get settings from context (provided by layout)
  const settingsState = getContext<SettingsState>("settings");

  // Logo dimensions (responsive and aspect-ratio preserving)
  const logoWidth = $derived(settingsState?.logoWidth ? `${settingsState.logoWidth}px` : "140px");
  const logoHeight = $derived(settingsState?.logoHeight ? `${settingsState.logoHeight}px` : "34px");

  const logoStyles = $derived(
    `max-width: ${logoWidth}; max-height: ${logoHeight}; width: auto; height: auto; object-fit: contain;`
  );

  const logoClasses = $derived(
    `inline-block ${className}`.trim()
  );

  let hasError = $state(false);

  // Determine logo URL reactively with cache busting query param
  const currentSrc = $derived.by(() => {
    const isDark = mode.current === "dark";
    if (hasError) {
      return isDark ? fallbackSrcDark : fallbackSrcLight;
    }
    const base = isDark
      ? (settingsState?.logoUrlDark || fallbackSrcDark)
      : (settingsState?.logoUrlLight || fallbackSrcLight);
    
    // Append version query param to prevent browser caching stale logos
    return base.includes('?') ? base : `${base}?v=20261016`;
  });

  function handleImageError() {
    if (!hasError) {
      hasError = true;
    }
  }
</script>

<img
  src={currentSrc}
  {alt}
  style={logoStyles}
  class={logoClasses}
  loading="eager"
  decoding="async"
  onerror={handleImageError}
/>
