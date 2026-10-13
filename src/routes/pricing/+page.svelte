<script lang="ts">
  const showPrimaryCta = $derived(
    data.activePaymentProvider !== "opaybd" || data.userCountry === "BD",
  );

  // Effective primary gateway per user currency: BDT → opaybd, others → manual

  import Button from "$lib/components/ui/button/button.svelte";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";

  import {
    CheckIcon,
    ArrowRightIcon,
    ArrowLeftIcon,
    SparkleIcon,
    StarIcon,
    ShieldIcon,
  } from "$lib/icons/index.js";

  import {
    CURRENCIES,
    DEFAULT_CURRENCY,
    convertFromUsdCents,
    formatCurrency,
    type CurrencyCode,
  } from "$lib/utils/currencies.js";

  let { data } = $props();

  const allPlans = data.plans || [];
  const currentSubscription = data.currentSubscription;
  const user = data.user;
  const userData = data.userData;

  const activeProvider = data.activePaymentProvider || "stripe";

  // Currency state — default from server (BDT). Persist in localStorage on change.
  let currency = $state<CurrencyCode>(
    (data.defaultCurrency as CurrencyCode) || DEFAULT_CURRENCY
  );
  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem("ezbo_currency");
    if (saved && saved in CURRENCIES) currency = saved as CurrencyCode;
  }
  $effect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("ezbo_currency", currency);
    }
  });

  const currencyMeta = $derived(CURRENCIES[currency]);
  const currencyOptions = Object.values(CURRENCIES);
  let currencyOpen = $state(false);

  let isYearly = $state(false);

  const monthlyPaidPlans = $derived(
    allPlans.filter((p) => p.billingInterval === "month" && p.tier !== "free")
  );
  const yearlyPaidPlans = $derived(
    allPlans.filter((p) => p.billingInterval === "year" && p.tier !== "free")
  );
  const paidPlans = $derived(isYearly ? yearlyPaidPlans : monthlyPaidPlans);
  const freePlan = $derived(allPlans.find((p) => p.tier === "free"));
  const displayPlans = $derived(
    freePlan ? [freePlan, ...paidPlans] : paidPlans
  );

  const planMeta: Record<string, { gradient: string; ring: string; iconBg: string; popular?: boolean; tagline: string }> = {
    free: {
      gradient: "from-slate-50 to-slate-100 dark:from-slate-900/40 dark:to-slate-800/40",
      ring: "ring-slate-200 dark:ring-slate-800",
      iconBg: "bg-slate-500",
      tagline: "Get started — no credit card",
    },
    starter: {
      gradient: "from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30",
      ring: "ring-blue-200 dark:ring-blue-900/50",
      iconBg: "bg-gradient-to-br from-blue-500 to-indigo-500",
      tagline: "For hobbyists & solo creators",
    },
    pro: {
      gradient: "from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/40 dark:via-purple-950/40 dark:to-pink-950/30",
      ring: "ring-indigo-300 dark:ring-indigo-500/40",
      iconBg: "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500",
      popular: true,
      tagline: "Best for professionals & teams",
    },
    advanced: {
      gradient: "from-amber-50 via-orange-50 to-rose-50 dark:from-amber-950/30 dark:via-orange-950/30 dark:to-rose-950/30",
      ring: "ring-amber-200 dark:ring-amber-900/50",
      iconBg: "bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500",
      tagline: "Unlimited everything for power users",
    },
  };

  let loadingPlan: string | null = $state(null);
  let showConfirmDialog = $state(false);
  let pendingAction = $state<{
    priceId: string;
    planName: string;
    changeType: string;
    isUpgrade: boolean;
  } | null>(null);

  function isCurrentPlan(planTier: string): boolean {
    if (planTier === "free") return userData?.planTier === "free";
    return currentSubscription?.plan?.tier === planTier;
  }

  function isDowngrade(planTier: string): boolean {
    const tierOrder = { free: 0, starter: 1, pro: 2, advanced: 3 };
    let currentTier = "free";
    if (userData?.planTier === "free") currentTier = "free";
    else if (currentSubscription?.plan?.tier) currentTier = currentSubscription.plan.tier;
    return (tierOrder[planTier as keyof typeof tierOrder] || 0) < (tierOrder[currentTier as keyof typeof tierOrder] || 0);
  }

  // ----- price formatters using selected currency + admin-defined FX rates -----
  const rates = data.currencyRates;

  function formatTotal(plan: { priceAmount: number; priceAmountBdt?: number | null }): string {
    return formatCurrency(
      convertFromUsdCents(plan.priceAmount, currency, plan.priceAmountBdt, rates),
      currency
    );
  }
  function formatPerMonth(plan: { priceAmount: number; priceAmountBdt?: number | null }): string {
    const value = convertFromUsdCents(plan.priceAmount, currency, plan.priceAmountBdt, rates) / 12;
    return formatCurrency(value, currency);
  }
  function getYearlySavings(tier: string): string | null {
    if (!isYearly) return null;
    const monthly = monthlyPaidPlans.find((p) => p.tier === tier);
    const yearly = yearlyPaidPlans.find((p) => p.tier === tier);
    if (!monthly || !yearly) return null;
    const monthlyValue = convertFromUsdCents(monthly.priceAmount, currency, monthly.priceAmountBdt, rates);
    const yearlyValue = convertFromUsdCents(yearly.priceAmount, currency, yearly.priceAmountBdt, rates);
    const savings = monthlyValue * 12 - yearlyValue;
    if (savings <= 0) return null;
    return formatCurrency(savings, currency);
  }

  async function handleSubscribe(priceId: string, planName: string, planTier: string) {
    if (!user) {
      toast.error("Please log in to subscribe");
      goto("/login");
      return;
    }
    if (isCurrentPlan(planTier)) {
      toast.info("You are already subscribed to this plan");
      return;
    }
    loadingPlan = priceId;
    try {
      if (currentSubscription) {
        const isUpgrade = !isDowngrade(planTier);
        pendingAction = { priceId, planName, changeType: isUpgrade ? "upgrade" : "downgrade", isUpgrade };
        showConfirmDialog = true;
        loadingPlan = null;
        return;
      }
      await createCheckoutSession(priceId, planName);
    } catch (error) {
      console.error("Error processing subscription:", error);
      toast.error(error instanceof Error ? error.message : "Failed to process subscription");
    } finally {
      loadingPlan = null;
    }
  }

  function getButtonText(plan: any): string {
    if (isCurrentPlan(plan.tier)) return "Current Plan";
    if (plan.tier === "free") return "Get Started Free";
    if (isDowngrade(plan.tier)) return "Downgrade";
    if (!currentSubscription) return "Get Started";
    return "Upgrade";
  }

  function handleConfirmUpgrade() {
    if (!pendingAction) return;
    showConfirmDialog = false;
    proceedWithSubscriptionUpdate(pendingAction);
  }
  function handleCancelUpgrade() {
    showConfirmDialog = false;
    pendingAction = null;
    loadingPlan = null;
  }

  async function proceedWithSubscriptionUpdate(action: typeof pendingAction) {
    if (!action) return;
    loadingPlan = action.priceId;
    try {
      const updateResponse = await fetch("/api/stripe/update-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: action.priceId }),
      });
      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(errorData.message || "Failed to update subscription");
      }
      const updateResult = await updateResponse.json();
      if (updateResult.success) {
        if (updateResult.subscription?.proration_amount && updateResult.subscription.proration_amount > 0) {
          const prorationFormatted = (updateResult.subscription.proration_amount / 100).toFixed(2);
          toast.info(`A proration charge of ${prorationFormatted} has been applied.`);
        }
        const successUrl = new URL("/settings/billing", window.location.origin);
        successUrl.searchParams.set("subscription_updated", "true");
        successUrl.searchParams.set("plan_name", action.planName);
        successUrl.searchParams.set("change_type", action.changeType);
        successUrl.searchParams.set("expected_price_id", action.priceId);
        goto(successUrl.pathname + successUrl.search);
        return;
      } else if (updateResult.requiresCheckout) {
        createCheckoutSession(action.priceId, action.planName);
        return;
      } else {
        const errorUrl = new URL("/settings/billing", window.location.origin);
        errorUrl.searchParams.set("subscription_error", "true");
        errorUrl.searchParams.set("error_message", encodeURIComponent(updateResult.message || "Failed to update subscription"));
        goto(errorUrl.pathname + errorUrl.search);
        return;
      }
    } catch (error) {
      console.error("Error processing subscription:", error);
      toast.error(error instanceof Error ? error.message : "Failed to process subscription change");
    } finally {
      loadingPlan = null;
      pendingAction = null;
    }
  }

  async function createCheckoutSession(priceId: string, planName: string) {
    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      if (!response.ok) throw new Error("Failed to create checkout session");
      const result = await response.json();
      if (result.provider === "opaybd" && result.paymentUrl) {
        window.location.href = result.paymentUrl;
        return;
      }
      goto(`/checkout?client_secret=${result.clientSecret}&plan=${encodeURIComponent(planName)}`);
    } catch (error) {
      console.error("Error creating checkout session:", error);
      toast.error("Failed to start checkout process");
    }
  }
</script>

<svelte:head>
  <title>Pricing — Ezbo AI</title>
  <meta name="description" content="Choose the perfect plan for your AI needs. Multi-currency pricing — pay in BDT, USD, EUR, INR & more." />
</svelte:head>

<div class="relative min-h-screen overflow-hidden bg-background">
  <!-- Decorative background blobs -->
  <div class="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
    <div class="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-gradient-to-br from-indigo-400/30 to-purple-400/30 blur-3xl"></div>
    <div class="absolute top-1/3 -left-40 h-96 w-96 rounded-full bg-gradient-to-br from-pink-400/20 to-orange-400/20 blur-3xl"></div>
    <div class="absolute bottom-0 right-1/3 h-80 w-80 rounded-full bg-gradient-to-br from-blue-400/20 to-cyan-400/20 blur-3xl"></div>
  </div>

  <div class="container mx-auto px-4 py-8 max-w-7xl">
    <!-- Top bar: Back + Currency selector -->
    <div class="flex items-center justify-between mb-6 gap-3">
      <Button
        variant="ghost"
        size="sm"
        class="cursor-pointer gap-2 hover:bg-accent/60"
        onclick={() => goto("/")}
      >
        <ArrowLeftIcon class="w-4 h-4" />
        Back to home
      </Button>

      <!-- Currency selector -->
      <div class="relative">
        <button
          type="button"
          onclick={() => (currencyOpen = !currencyOpen)}
          class="cursor-pointer inline-flex items-center gap-2 rounded-full border border-border/60 bg-white/70 dark:bg-black/40 backdrop-blur-md px-3 py-2 text-sm font-medium hover:bg-accent/60 transition shadow-sm"
        >
          <span class="text-base leading-none">{currencyMeta.flag}</span>
          <span class="font-semibold">{currencyMeta.code}</span>
          <span class="text-muted-foreground">{currencyMeta.symbol}</span>
          <svg class="w-3 h-3 ml-0.5 opacity-70" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 5l3 3 3-3"/></svg>
        </button>
        {#if currencyOpen}
          <div
            role="presentation"
            class="fixed inset-0 z-30"
            onclick={() => (currencyOpen = false)}
          ></div>
          <div class="absolute right-0 mt-2 w-60 rounded-xl border border-border/60 bg-popover shadow-xl shadow-black/5 z-40 overflow-hidden">
            <div class="px-3 py-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground border-b border-border/50">
              Display currency
            </div>
            <ul class="max-h-72 overflow-y-auto py-1">
              {#each currencyOptions as opt}
                <li>
                  <button
                    type="button"
                    onclick={() => { currency = opt.code; currencyOpen = false; }}
                    class={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent/60 transition ${
                      opt.code === currency ? "bg-accent/40 font-semibold" : ""
                    }`}
                  >
                    <span class="text-base">{opt.flag}</span>
                    <span class="flex-1 text-left">
                      <span class="font-medium">{opt.code}</span>
                      <span class="text-muted-foreground ml-1.5 text-xs">{opt.label}</span>
                    </span>
                    <span class="text-muted-foreground">{opt.symbol}</span>
                    {#if opt.code === currency}
                      <CheckIcon class="w-4 h-4 text-indigo-500" />
                    {/if}
                  </button>
                </li>
              {/each}
            </ul>
            <div class="px-3 py-2 text-[10px] text-muted-foreground border-t border-border/50">
              Prices auto-converted from USD. BDT uses real BDT pricing.
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Header -->
    <div class="text-center mb-10 max-w-3xl mx-auto">
      <h1 class="text-4xl md:text-6xl font-bold mb-4 tracking-tight">
        Choose your
        <span class="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
          perfect plan
        </span>
      </h1>
      <p class="text-lg text-muted-foreground">
        Start free, upgrade as you grow. No hidden fees. Cancel anytime.
      </p>
    </div>

    <!-- Billing Toggle -->
    <div class="flex flex-col items-center mb-12">
      <div class="bg-white/70 dark:bg-black/40 backdrop-blur-md border border-border/50 rounded-full p-1.5 inline-flex items-center gap-1 shadow-lg shadow-indigo-500/5">
        <button
          type="button"
          onclick={() => (isYearly = false)}
          class={`cursor-pointer px-6 py-2.5 text-sm font-semibold transition-all duration-300 rounded-full ${
            !isYearly
              ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md shadow-indigo-500/30"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onclick={() => (isYearly = true)}
          class={`cursor-pointer px-6 py-2.5 text-sm font-semibold transition-all duration-300 rounded-full flex items-center gap-2 ${
            isYearly
              ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md shadow-indigo-500/30"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Yearly
          <span class={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
            isYearly ? "bg-white/20 text-white" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          }`}>
            SAVE 16%
          </span>
        </button>
      </div>
    </div>

    <!-- Plans Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16 items-stretch">
      {#each displayPlans as plan (plan.id)}
        {@const meta = planMeta[plan.tier] || planMeta.starter}
        {@const savings = getYearlySavings(plan.tier)}
        <div class="relative h-full group">
          {#if meta.popular}
            <div class="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
              <div class="px-3 py-1 rounded-full text-[11px] font-bold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-purple-500/40 flex items-center gap-1 whitespace-nowrap">
                <StarIcon class="w-3 h-3 fill-white" />
                MOST POPULAR
              </div>
            </div>
            <div class="absolute -inset-px rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-60 blur-sm -z-10 group-hover:opacity-100 transition-opacity duration-500"></div>
          {/if}

          <div
            class={`relative h-full rounded-2xl p-6 flex flex-col bg-gradient-to-br ${meta.gradient} backdrop-blur-sm ring-1 ${meta.ring} ${
              meta.popular ? "shadow-xl shadow-purple-500/20" : "shadow-md hover:shadow-xl"
            } transition-all duration-300 hover:-translate-y-1`}
          >
            <!-- Plan icon + name -->
            <div class="flex items-center gap-3 mb-2">
              <div class={`w-10 h-10 rounded-xl ${meta.iconBg} flex items-center justify-center shadow-md`}>
                {#if plan.tier === "free"}
                  <SparkleIcon class="w-5 h-5 text-white" />
                {:else if plan.tier === "starter"}
                  <ArrowRightIcon class="w-5 h-5 text-white" />
                {:else if plan.tier === "pro"}
                  <StarIcon class="w-5 h-5 text-white fill-white" />
                {:else}
                  <ShieldIcon class="w-5 h-5 text-white" />
                {/if}
              </div>
              <h3 class="text-xl font-bold">{plan.name}</h3>
            </div>
            <p class="text-xs text-muted-foreground mb-5">{meta.tagline}</p>

            <!-- Price -->
            <div class="mb-5">
              {#if plan.tier === "free"}
                <div class="flex items-baseline gap-1">
                  <span class="text-5xl font-extrabold tracking-tight">{currencyMeta.symbol}0</span>
                  <span class="text-sm text-muted-foreground">/forever</span>
                </div>
                <p class="text-xs text-muted-foreground mt-1.5 h-4">No credit card required</p>
              {:else}
                <div class="flex items-baseline gap-1">
                  <span class="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                    {isYearly ? formatPerMonth(plan) : formatTotal(plan)}
                  </span>
                  <span class="text-sm text-muted-foreground">/mo</span>
                </div>
                <p class="text-xs text-muted-foreground mt-1.5 h-4">
                  {#if isYearly}
                    {formatTotal(plan)} billed yearly
                    {#if savings}
                      <span class="ml-1 text-emerald-600 dark:text-emerald-400 font-semibold">save {savings}</span>
                    {/if}
                  {:else}
                    Billed monthly
                  {/if}
                </p>
              {/if}
            </div>

            <!-- CTA: hidden when user currency != BDT and admin's primary provider is opaybd (those users use manual gateways instead) -->
            {#if showPrimaryCta}
            <Button
              class={`cursor-pointer w-full mb-6 font-semibold transition-all duration-300 ${
                isCurrentPlan(plan.tier)
                  ? "bg-muted text-muted-foreground hover:bg-muted cursor-not-allowed"
                  : meta.popular
                    ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-90 text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50"
                    : plan.tier === "free"
                      ? "bg-foreground text-background hover:bg-foreground/90"
                      : "bg-background border border-border hover:border-foreground/30 hover:bg-accent text-foreground"
              }`}
              variant="ghost"
              disabled={isCurrentPlan(plan.tier) || loadingPlan === plan.stripePriceId}
              onclick={() => handleSubscribe(plan.stripePriceId, plan.name, plan.tier)}
            >
              {#if loadingPlan === plan.stripePriceId}
                <div class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
                Processing...
              {:else}
                {getButtonText(plan)}
                {#if !isCurrentPlan(plan.tier)}
                  <ArrowRightIcon class="w-4 h-4 ml-1.5" />
                {/if}
              {/if}
            </Button>
            {/if}

            <!-- Features -->
            <div class="flex-1">
              <p class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">What's included</p>
              <ul class="space-y-2.5">
                {#each plan.features as feature}
                  <li class="flex items-start gap-2.5 text-sm">
                    <div class={`w-4 h-4 mt-0.5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      meta.popular ? "bg-gradient-to-br from-indigo-500 to-purple-500" : "bg-emerald-500"
                    }`}>
                      <CheckIcon class="w-2.5 h-2.5 text-white" />
                    </div>
                    <span class="text-foreground/80 leading-tight">{feature}</span>
                  </li>
                {/each}
              </ul>
            </div>

            {#if data.manualGatewaysEnabled && plan.tier !== "free" && !isCurrentPlan(plan.tier)}
              <button
                type="button"
                class="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 mb-3 cursor-pointer"
                onclick={() => goto(`/checkout/manual?planId=${plan.id}`)}
              >
                Or pay manually (PayPal, Wise, Skrill, Binance, Bybit)
              </button>
            {/if}

            {#if isDowngrade(plan.tier) && plan.tier !== "free"}
              <p class="text-[11px] text-muted-foreground text-center mt-4 pt-4 border-t border-border/50">
                Downgrade takes effect at end of billing period
              </p>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    <!-- Currency note (only when non-payment currency) -->
    {#if currency !== "BDT" && currency !== "USD"}
      <div class="text-center mb-6">
        <p class="text-xs text-muted-foreground">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 border border-border/50">
            <SparkleIcon class="w-3 h-3" />
            Showing approximate prices in {currencyMeta.label}. You will be charged in
            {activeProvider === "opaybd" ? "BDT" : "USD"} at checkout.
          </span>
        </p>
      </div>
    {/if}

    <!-- Trust strip -->
    <div class="text-center max-w-3xl mx-auto">
      <div class="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground mb-6">
        <div class="flex items-center gap-2">
          <ShieldIcon class="w-4 h-4 text-emerald-500" />
          Cancel anytime
        </div>
        <div class="flex items-center gap-2">
          <ShieldIcon class="w-4 h-4 text-emerald-500" />
          Secure payment
        </div>
        <div class="flex items-center gap-2">
          <ShieldIcon class="w-4 h-4 text-emerald-500" />
          GDPR compliant
        </div>
        <div class="flex items-center gap-2">
          <ShieldIcon class="w-4 h-4 text-emerald-500" />
          24/7 support
        </div>
      </div>
      <p class="text-sm text-muted-foreground">
        All plans include access to our complete model library and full chat history.
      </p>
      {#if user}
        <p class="text-sm text-muted-foreground mt-2">
          Need help choosing?
          <a href="/settings/billing" class="text-primary font-medium hover:underline">View your current usage</a>
        </p>
      {:else}
        <p class="text-sm text-muted-foreground mt-2">
          <a href="/login" class="text-primary font-medium hover:underline">Sign in</a> to view your usage and get personalized recommendations.
        </p>
      {/if}
    </div>
  </div>
</div>

<!-- Confirmation Dialog -->
<AlertDialog.Root bind:open={showConfirmDialog}>
  <AlertDialog.Content class="sm:max-w-[425px]">
    <AlertDialog.Header>
      <AlertDialog.Title>
        Confirm Subscription {pendingAction?.changeType || "Change"}
      </AlertDialog.Title>
      <AlertDialog.Description class="text-left space-y-3">
        <p>
          Are you sure you want to <strong>{pendingAction?.changeType}</strong>
          your subscription to <strong>{pendingAction?.planName}</strong>?
        </p>
        {#if pendingAction}
          <div class="p-3 rounded-lg bg-muted/50">
            {#if pendingAction.isUpgrade}
              <div class="flex items-start gap-2">
                <span class="text-green-600 mt-0.5">💳</span>
                <div class="text-sm">
                  <p class="font-medium text-green-700 dark:text-green-400">Upgrade Billing</p>
                  <p class="text-muted-foreground">You will be charged a prorated amount immediately based on your current billing cycle.</p>
                </div>
              </div>
            {:else}
              <div class="flex items-start gap-2">
                <span class="text-blue-600 mt-0.5">💰</span>
                <div class="text-sm">
                  <p class="font-medium text-blue-700 dark:text-blue-400">Downgrade Credit</p>
                  <p class="text-muted-foreground">You'll get a credit for the unused portion of your current plan, applied to your next invoice.</p>
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel onclick={handleCancelUpgrade}>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action onclick={handleConfirmUpgrade}>
        Confirm {pendingAction?.changeType || "Change"}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
