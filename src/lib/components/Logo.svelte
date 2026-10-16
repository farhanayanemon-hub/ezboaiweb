<script lang="ts">
  import { getContext } from "svelte";
  import { mode } from "mode-watcher";
  import type { SettingsState } from "$lib/stores/settings.svelte.js";

  // Props
  let {
    class: className = "",
    alt = "App Logo",
    fallbackSrcDark = "/branding/logos/default-dark-logo.png",
    fallbackSrcLight = "/branding/logos/default-light-logo.png",
    fallbackSrc = "/branding/logos/default-dark-logo.png",
  }: {
    class?: string;
    alt?: string;
    fallbackSrcDark?: string;
    fallbackSrcLight?: string;
    fallbackSrc?: string;
  } = $props();

  // Get settings from context (provided by layout)
  const settingsState = getContext<SettingsState>("settings");

  // Get logo dimensions from settings
  const logoWidth = $derived(() => settingsState?.logoWidth ?? "140");
  const logoHeight = $derived(() => settingsState?.logoHeight ?? "34");

  // Compute final CSS classes and inline styles
  const logoStyles = $derived(
    () => `width: ${logoWidth()}px; height: ${logoHeight()}px;`
  );
  const logoClasses = $derived(() =>
    `object-contain ${className}`.trim()
  );

  // Determine the logo URL based on current theme
  const logoUrl = $derived(() => {
    const currentMode = mode.current;

    if (currentMode === "dark") {
      return settingsState?.logoUrlDark || fallbackSrcDark || fallbackSrc;
    } else {
      return settingsState?.logoUrlLight || fallbackSrcLight;
    }
  });

  // Error handling state
  let imageError = $state(false);
  let isLoading = $state(true);
  let lastLoadedUrl = $state<string>("");

  // Reset error state when URL changes, but only trigger loading for actual URL changes
  $effect(() => {
    const currentUrl = logoUrl();
    if (currentUrl && currentUrl !== lastLoadedUrl) {
      imageError = false;
      isLoading = true;
    } else if (currentUrl === lastLoadedUrl && lastLoadedUrl !== "") {
      // Same URL as already loaded, don't show loading state
      isLoading = false;
    }
  });

  function handleImageLoad() {
    isLoading = false;
    lastLoadedUrl = logoUrl();
  }

  function handleImageError() {
    imageError = true;
    isLoading = false;
    lastLoadedUrl = logoUrl();
  }

  // Final image source - use fallback if there's an error
  const finalSrc = $derived(imageError ? (mode.current === "dark" ? fallbackSrcDark : fallbackSrcLight) : logoUrl());
</script>

<div class="relative">
  <!-- Logo image -->
  <img
    src={finalSrc}
    {alt}
    style={logoStyles()}
    class={`${logoClasses()} ${isLoading ? "opacity-0" : "opacity-100"} transition-opacity duration-200`}
    onload={handleImageLoad}
    onerror={handleImageError}
  />

  <!-- Loading placeholder - positioned absolutely to match image exactly -->
  {#if isLoading}
    <div
      style={logoStyles()}
      class={`absolute inset-0 bg-muted animate-pulse ${logoClasses()}`}
      aria-label="Loading logo"
    >
      <div class="w-full h-full bg-muted-foreground/20 rounded-lg"></div>
    </div>
  {/if}
</div>
