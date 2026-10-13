<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import * as Card from "$lib/components/ui/card/index.js";

  // Import icons
  import {
    SettingsIcon,
    PaletteIcon,
    CreditCardIcon,
    KeyIcon,
    BrainIcon,
    CloudIcon,
    GemIcon,
    ShieldIcon,
    MailIcon,
    HomeIcon,
    CirclePlusIcon,
    MessageCircleIcon,
    WalletIcon,
  } from "$lib/icons/index.js";

  let { children, data } = $props();

  // Settings navigation items with icons
  const settingsNav = [
    {
      id: "general",
      label: "General",
      path: "/admin/settings/general",
      icon: SettingsIcon,
    },
    {
      id: "branding",
      label: "Branding",
      path: "/admin/settings/branding",
      icon: PaletteIcon,
    },
    {
      id: "landing",
      label: "Landing Page",
      path: "/admin/settings/landing",
      icon: HomeIcon,
    },
    {
      id: "payment-methods",
      label: "Payment Methods",
      path: "/admin/settings/payment-methods",
      icon: CreditCardIcon,
    },
    {
      id: "manual-gateways",
      label: "Manual Gateways",
      path: "/admin/settings/manual-gateways",
      icon: WalletIcon,
    },
    {
      id: "plans",
      label: "Pricing Plans",
      path: "/admin/settings/plans",
      icon: GemIcon,
    },
    {
      id: "currencies",
      label: "Currencies",
      path: "/admin/settings/currencies",
      icon: WalletIcon,
    },
    {
      id: "credit-plans",
      label: "Credit Plans",
      path: "/admin/settings/credit-plans",
      icon: CirclePlusIcon,
    },
    {
      id: "oauth-providers",
      label: "OAuth Providers",
      path: "/admin/settings/oauth-providers",
      icon: KeyIcon,
    },
    {
      id: "xbrain-models",
      label: "Ezbo Models",
      path: "/admin/settings/xbrain-models",
      icon: BrainIcon,
    },
    {
      id: "ai-models",
      label: "AI Models",
      path: "/admin/settings/ai-models",
      icon: BrainIcon,
    },
    {
      id: "cloud-storage",
      label: "Cloud Storage",
      path: "/admin/settings/cloud-storage",
      icon: CloudIcon,
    },
    {
      id: "security",
      label: "Security",
      path: "/admin/settings/security",
      icon: ShieldIcon,
    },
    {
      id: "mailing",
      label: "Mailing",
      path: "/admin/settings/mailing",
      icon: MailIcon,
    },
    {
      id: "prompt-suggestions",
      label: "Prompt Suggestions",
      path: "/admin/settings/prompt-suggestions",
      icon: MessageCircleIcon,
    },
  ];

  // Get current active nav item based on pathname
  const activeNavItem = $derived(() => {
    const currentPath = page.url.pathname;

    // Only return an active item if there's an exact match with a settings subpage
    // Return null when on the main /admin/settings page
    return settingsNav.find((item) => currentPath === item.path)?.id || null;
  });
</script>

<svelte:head>
  <title>Site Settings - {data.settings.siteName}</title>
  <meta name="description" content={data.settings.siteDescription} />
</svelte:head>

<div class="min-h-screen p-6">
  <div class="max-w-6xl mx-auto">
    <!-- Header -->
    <div class="cursor-default mb-8 space-y-2">
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold">Site Settings</h1>
      </div>
    </div>

    <div class="grid lg:grid-cols-[220px_minmax(0,1fr)] gap-4">
      <!-- Settings Sidebar -->
      <Card.Root class="h-fit py-0 mb-4 bg-transparent border-none shadow-none">
        <Card.Content class="p-0 lg:mr-4">
          <nav class="space-y-2">
            {#each settingsNav as navItem}
              {@const Icon = navItem.icon}
              <button
                class="cursor-pointer w-full text-left px-3 py-1.5 text-md rounded-md transition-colors flex items-center gap-3 {activeNavItem() ===
                navItem.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'}"
                onclick={() => goto(navItem.path)}
              >
                <Icon class="w-4.5 h-4.5" />
                {navItem.label}
              </button>
            {/each}
          </nav>
        </Card.Content>
      </Card.Root>

      <!-- Main Content Area -->
      <div class="min-w-0">
        {@render children()}
      </div>
    </div>
  </div>
</div>
