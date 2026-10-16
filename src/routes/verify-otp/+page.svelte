<script lang="ts">
  import { enhance } from "$app/forms";
  import Button from "$lib/components/ui/button/button.svelte";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { authSanitizers } from "$lib/utils/sanitization.js";
  import Logo from "$lib/components/Logo.svelte";

  let { form, data } = $props();
  let loading = $state(false);
  let resending = $state(false);
  let code = $state("");
  let showResent = $state(false);

  $effect(() => {
    if (form?.resent) {
      showResent = true;
      setTimeout(() => { showResent = false; }, 5000);
    }
  });
</script>

<svelte:head>
  <title>Verify Email - {data?.settings?.siteName || 'EzboAI'}</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center p-6 bg-muted/20">
  <Card.Root class="w-full max-w-md shadow-xl border-border/40 backdrop-blur-sm">
    <Card.Header class="text-center pt-8">
      <div class="flex justify-center mb-6">
        <Logo width={150} height={36} />
      </div>
      <Card.Title class="text-2xl font-bold tracking-tight">Verify your email</Card.Title>
      <Card.Description class="pt-2 text-sm text-muted-foreground leading-relaxed">
        We sent a 6-digit verification code to
        <span class="font-medium text-foreground block pt-1">{data.email}</span>
      </Card.Description>
    </Card.Header>
    <Card.Content class="space-y-4 pt-2">
      <form
        method="POST"
        action="?/verify"
        use:enhance={() => {
          loading = true;
          return async ({ result, update }) => {
            if (result.type === "redirect") {
              await update();
              return;
            }
            await update();
            loading = false;
          };
        }}
        class="space-y-4"
      >
        <input type="hidden" name="email" value={data.email} />

        <div class="space-y-2">
          <Label for="code">Verification Code</Label>
          <Input
            id="code"
            name="code"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            placeholder="······"
            bind:value={code}
            disabled={loading}
            maxlength={6}
            class="text-center text-2xl tracking-[0.5em] font-mono font-bold h-14 bg-background"
            required
            autofocus
          />
        </div>

        {#if form?.error}
          <div class="text-sm text-destructive text-center p-2 rounded-md bg-destructive/10 border border-destructive/20">
            {authSanitizers.errorMessage(form.error)}
          </div>
        {/if}

        {#if showResent}
          <div class="text-sm text-green-600 dark:text-green-400 text-center p-2 rounded-md bg-green-500/10 border border-green-500/20">
            A new verification code has been sent to your email.
          </div>
        {/if}

        <Button type="submit" disabled={loading || code.length !== 6} class="w-full h-11 cursor-pointer font-medium text-base shadow-sm">
          {loading ? "Verifying & Signing In..." : "Verify & Sign In"}
        </Button>
      </form>

      <div class="text-center pt-2">
        <form
          method="POST"
          action="?/resend"
          use:enhance={() => {
            resending = true;
            return async ({ update }) => {
              await update();
              resending = false;
            };
          }}
          class="inline"
        >
          <input type="hidden" name="email" value={data.email} />
          <p class="text-sm text-muted-foreground">
            Didn't receive the code?
            <button
              type="submit"
              disabled={resending}
              class="text-primary hover:underline cursor-pointer disabled:opacity-50 ml-1 font-medium"
            >
              {resending ? "Sending..." : "Resend code"}
            </button>
          </p>
        </form>
      </div>
    </Card.Content>
    <Card.Footer class="text-center pb-8 justify-center border-t border-border/30 pt-4">
      <p class="text-sm text-muted-foreground">
        Wrong email?
        <a href="/register" class="text-primary hover:underline cursor-pointer ml-1 font-medium">
          Register with another email
        </a>
      </p>
    </Card.Footer>
  </Card.Root>
</div>
