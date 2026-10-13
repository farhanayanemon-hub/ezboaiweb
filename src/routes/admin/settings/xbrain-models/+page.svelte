<script lang="ts">
  import { enhance } from '$app/forms';
  import * as Card from '$lib/components/ui/card/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Label } from '$lib/components/ui/label/index.js';
  import { Textarea } from '$lib/components/ui/textarea/index.js';
  import { Switch } from '$lib/components/ui/switch/index.js';

  let { data, form } = $props();

  const TIERS = [
    { id: 'free', label: 'Ezbo 1.0', accent: 'Free / Fast' },
    { id: 'pro', label: 'Ezbo 1.0 (Beta)', accent: 'Premium' },
    { id: 'thinking', label: 'Ezbo P2 Thinking', accent: 'Deep Reasoning' },
  ] as const;
  const CATS = ['code','math','creative','factual','conversation','analysis','vision'] as const;

  let saving = $state(false);
  let resetting = $state(false);

  // Local copy to allow editing
  let local = $state(structuredClone(data.configs));
  let routerModel = $state(data.routerModel);

  function resetTier(t: 'free'|'pro'|'thinking') {
    local[t] = structuredClone(data.defaults[t]);
  }
</script>

<svelte:head><title>Ezbo Models - Admin</title></svelte:head>

<div class="space-y-6">
  <div>
    <h2 class="text-2xl font-bold">Ezbo Models</h2>
    <p class="text-sm text-muted-foreground mt-1">
      Control system prompts, routing, max tokens, temperature, and underlying models for the 3 Ezbo tiers.
      Changes apply immediately (cache TTL ~30 sec).
    </p>
  </div>

  {#if form?.success}
    <div class="p-3 rounded-md bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-200 text-sm">
      ✓ {form.message}
    </div>
  {:else if form?.error}
    <div class="p-3 rounded-md bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200 text-sm">
      ✗ {form.error}
    </div>
  {/if}

  <form
    method="POST"
    action="?/save"
    use:enhance={() => {
      saving = true;
      return async ({ update }) => { await update(); saving = false; };
    }}
    class="space-y-6"
  >
    <Card.Root>
      <Card.Header>
        <Card.Title>Global Router</Card.Title>
        <Card.Description>The cheap classifier model used to pick which underlying model answers each request.</Card.Description>
      </Card.Header>
      <Card.Content>
        <Label for="routerModel">Router Model (OpenRouter ID)</Label>
        <Input id="routerModel" name="routerModel" bind:value={routerModel} placeholder={data.defaultRouterModel} />
        <p class="text-xs text-muted-foreground mt-1">Default: <code>{data.defaultRouterModel}</code></p>
      </Card.Content>
    </Card.Root>

    {#each TIERS as t}
      {@const c = local[t.id]}
      <Card.Root>
        <Card.Header>
          <div class="flex items-center justify-between">
            <div>
              <Card.Title class="flex items-center gap-3">
                {t.label}
                <span class="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-normal">{t.accent}</span>
              </Card.Title>
              <Card.Description>Model ID: <code>ezbo/{t.id === 'free' ? 'ezbo-1.0' : t.id === 'pro' ? 'ezbo-1.0-pro' : 'ezbo-p2-thinking'}</code></Card.Description>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-sm">Enabled</span>
              <Switch name="{t.id}_enabled" bind:checked={c.enabled} />
            </div>
          </div>
        </Card.Header>
        <Card.Content class="space-y-4">
          <div class="grid md:grid-cols-2 gap-4">
            <div>
              <Label for="{t.id}_displayName">Display Name</Label>
              <Input id="{t.id}_displayName" name="{t.id}_displayName" bind:value={c.displayName} />
            </div>
            <div>
              <Label for="{t.id}_defaultModel">Default Fallback Model</Label>
              <Input id="{t.id}_defaultModel" name="{t.id}_defaultModel" bind:value={c.defaultModel} />
            </div>
            <div>
              <Label for="{t.id}_maxTokens">Max Tokens</Label>
              <Input id="{t.id}_maxTokens" name="{t.id}_maxTokens" type="number" min="256" max="200000" bind:value={c.maxTokens} />
            </div>
            <div>
              <Label for="{t.id}_temperature">Temperature (0–2)</Label>
              <Input id="{t.id}_temperature" name="{t.id}_temperature" type="number" step="0.05" min="0" max="2" bind:value={c.temperature} />
            </div>
            <div class="md:col-span-2">
              <Label for="{t.id}_description">Description</Label>
              <Input id="{t.id}_description" name="{t.id}_description" bind:value={c.description} />
            </div>
          </div>

          <div>
            <Label for="{t.id}_systemPrompt">System Prompt / Instructions</Label>
            <Textarea id="{t.id}_systemPrompt" name="{t.id}_systemPrompt" bind:value={c.systemPrompt} rows={8} class="font-mono text-xs" />
            <p class="text-xs text-muted-foreground mt-1">This is prepended as a <code>system</code> message to every conversation handled by this model.</p>
          </div>

          <div>
            <h4 class="text-sm font-semibold mb-2">Category Routing</h4>
            <p class="text-xs text-muted-foreground mb-3">Enter the underlying OpenRouter model ID for each question category.</p>
            <div class="grid md:grid-cols-2 gap-3">
              {#each CATS as cat}
                <div>
                  <Label for="{t.id}_route_{cat}" class="capitalize">{cat}</Label>
                  <Input id="{t.id}_route_{cat}" name="{t.id}_route_{cat}" bind:value={c.routes[cat]} />
                </div>
              {/each}
            </div>
          </div>

          <div class="pt-2">
            <Button type="button" variant="outline" size="sm" onclick={() => resetTier(t.id)}>Reset {t.label} to defaults</Button>
          </div>
        </Card.Content>
      </Card.Root>
    {/each}

    <div class="flex items-center gap-3 sticky bottom-4 bg-background/80 backdrop-blur p-3 rounded-md border">
      <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
      <span class="text-xs text-muted-foreground">All changes apply immediately to live chat.</span>
    </div>
  </form>

  <form
    method="POST"
    action="?/reset"
    use:enhance={() => {
      resetting = true;
      return async ({ update }) => { await update(); resetting = false; window.location.reload(); };
    }}
  >
    <Card.Root class="border-destructive/40">
      <Card.Header>
        <Card.Title class="text-destructive">Reset Everything to Defaults</Card.Title>
        <Card.Description>Restores all 3 models, router, prompts, and routing to factory defaults. Cannot be undone.</Card.Description>
      </Card.Header>
      <Card.Content>
        <Button type="submit" variant="destructive" disabled={resetting}>{resetting ? 'Resetting...' : 'Reset to Defaults'}</Button>
      </Card.Content>
    </Card.Root>
  </form>
</div>
