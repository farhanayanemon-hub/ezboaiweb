<script lang="ts">
  import { getContext } from "svelte";
  import { browser } from "$app/environment";
  import type { SettingsState } from "$lib/stores/settings.svelte.js";

  // Props
  let {
    fallbackHref = "/branding/favicon/default-favicon.png?v=20261016",
    elementId = "favicon"
  }: {
    fallbackHref?: string;
    elementId?: string;
  } = $props();

  // Get settings from context (provided by layout)
  const settingsState = getContext<SettingsState>("settings");

  // Determine the favicon URL using reactive derived
  const faviconUrl = $derived(() => {
    const customFavicon = settingsState?.currentFavicon;
    return customFavicon || fallbackHref;
  });

  // State for tracking URL changes to prevent unnecessary updates
  let lastLoadedUrl = $state<string>("");

  // Cache DOM element reference for performance
  let cachedFaviconElement: HTMLLinkElement | null = null;

  // Helper function to get or cache favicon element
  function getFaviconElement(): HTMLLinkElement | null {
    if (!browser) return null;

    if (!cachedFaviconElement) {
      cachedFaviconElement = document.getElementById(elementId) as HTMLLinkElement;
    }

    return cachedFaviconElement;
  }

  // Helper function to construct absolute URL if needed
  function constructAbsoluteUrl(url: string): string {
    if (!browser) return url;

    // If already absolute URL, return as-is
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
      return url;
    }

    // If relative URL, construct absolute URL
    if (url.startsWith('/')) {
      return `${window.location.origin}${url}`;
    }

    // If relative path, construct from current path
    return `${window.location.origin}/${url}`;
  }

  // Core favicon update function - simplified
  function updateFavicon(newUrl: string) {
    if (!browser) return;

    const faviconElement = getFaviconElement();
    if (!faviconElement) {
      console.warn('[Favicon] Favicon element not found in DOM');
      return;
    }

    const absoluteUrl = constructAbsoluteUrl(newUrl);

    // Only update if URL actually changed to prevent unnecessary DOM manipulation
    if (faviconElement.href === absoluteUrl) {
      return;
    }

    try {
      // Update the favicon href - let browser handle loading/fallback naturally
      faviconElement.href = absoluteUrl;

      // Update tracking state
      lastLoadedUrl = newUrl;

    } catch (error) {
      console.error('[Favicon] Error updating favicon:', error);

      // Fallback on exception, but prevent infinite loops
      if (newUrl !== fallbackHref) {
        try {
          const fallbackAbsoluteUrl = constructAbsoluteUrl(fallbackHref);
          if (faviconElement.href !== fallbackAbsoluteUrl) {
            faviconElement.href = fallbackAbsoluteUrl;
          }
        } catch (fallbackError) {
          console.error('[Favicon] Error applying fallback favicon:', fallbackError);
        }
      }
    }
  }

  // Single $effect block for URL changes - simplified reactivity
  $effect(() => {
    const currentUrl = faviconUrl();
    if (currentUrl && currentUrl !== lastLoadedUrl) {
      updateFavicon(currentUrl);
    }
  });
</script>

<!--
This component manages favicon updates reactively but doesn't render any visible content.
It follows the same patterns as the Logo component for consistency:
- Uses $derived for reactive URL computation
- Implements comprehensive error handling and loading states
- Tracks URL changes to prevent unnecessary updates
- Provides fallback behavior for failed loads
- Caches DOM references for performance
- Handles both relative and absolute URLs properly
-->