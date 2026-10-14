<script lang="ts">
  import { browser } from '$app/environment';
  import { slide } from 'svelte/transition';

  const STORAGE_KEY = 'ezboai_hide_app_download_banner';

  let isVisible = $state(true);
  let isDownloading = $state(false);

  $effect(() => {
    if (browser) {
      if (localStorage.getItem(STORAGE_KEY) === 'true') {
        isVisible = false;
      }
    }
  });

  function dismissBanner() {
    isVisible = false;
    if (browser) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
  }

  function handleDownloadClick() {
    isDownloading = true;
    setTimeout(() => {
      isDownloading = false;
    }, 4000);
  }
</script>

{#if isVisible}
  <div
    transition:slide={{ duration: 250 }}
    class="relative z-20 w-full border-b border-indigo-500/20 bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-950/60 backdrop-blur-md px-3 py-1.5 sm:px-4 sm:py-2 text-foreground"
  >
    <div class="mx-auto flex max-w-5xl items-center justify-between gap-2 sm:gap-4">
      <!-- Left: Animated Icon + Tagline -->
      <div class="flex items-center gap-2.5 min-w-0">
        <!-- Glowing animated phone/android badge -->
        <div class="relative flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/25 ring-1 ring-white/20">
          <svg class="h-4 w-4 text-white animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="14" height="20" x="5" y="2" rx="2" ry="2"/>
            <path d="M12 18h.01"/>
          </svg>
          <span class="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
          </span>
        </div>

        <div class="flex flex-col sm:flex-row sm:items-center sm:gap-2 min-w-0">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-xs sm:text-sm font-semibold tracking-tight text-white flex items-center gap-1">
              EzboAI Mobile App
              <span class="hidden sm:inline-flex rounded-full bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300 ring-1 ring-inset ring-indigo-500/30">
                Android APK
              </span>
            </span>
          </div>
          <p class="text-[11px] sm:text-xs text-indigo-200/80 truncate">
            Experience ultra-fast streaming, studios & voice on your phone
          </p>
        </div>
      </div>

      <!-- Right: Action CTA & Close Button -->
      <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <!-- Direct Download Button -->
        <a
          href="/downloads/ezboai.apk"
          download="EzboAI.apk"
          onclick={handleDownloadClick}
          class="group relative inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 via-purple-600 to-indigo-600 px-3 py-1 sm:px-3.5 sm:py-1.5 text-xs font-semibold text-white shadow-sm shadow-indigo-500/30 transition-all duration-200 hover:scale-[1.03] hover:shadow-indigo-500/50 active:scale-[0.98] ring-1 ring-white/20"
        >
          {#if isDownloading}
            <svg class="h-3.5 w-3.5 animate-spin text-white" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="text-[11px] sm:text-xs">Downloading...</span>
          {:else}
            <svg class="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" x2="12" y1="15" y2="3"/>
            </svg>
            <span class="text-[11px] sm:text-xs">Download <span class="hidden md:inline">(21.7 MB)</span></span>
          {/if}
        </a>

        <!-- Cross / Close Icon -->
        <button
          type="button"
          aria-label="Dismiss banner"
          onclick={dismissBanner}
          class="rounded-full p-1 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Dismiss"
        >
          <svg class="h-3.5 w-3.5 sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
{/if}
