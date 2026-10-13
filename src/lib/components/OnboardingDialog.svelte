<script lang="ts">
  // Two-step onboarding popup shown right after a user creates an account
  // (or any logged-in user who hasn't set their name yet).
  //
  //   Step 1 — "What is your name?" (required)
  //   Step 2 — "Want to personalize XBrainPro?"
  //              Yes  -> /settings/ai-personalization
  //              Skip -> closes with a toast saying they can do it later
  //
  // The parent (root +layout.svelte) decides when to mount this based on
  // data.needsNameOnboarding from +layout.server.ts.

  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import Button from "$lib/components/ui/button/button.svelte";
  import Input from "$lib/components/ui/input/input.svelte";
  import { goto, invalidateAll } from "$app/navigation";
  import { toast } from "svelte-sonner";

  let { open = $bindable(true) }: { open?: boolean } = $props();

  let step = $state<1 | 2>(1);
  let name = $state("");
  let saving = $state(false);
  let savedName = $state("");

  async function submitName(e: Event) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Please enter your name");
      return;
    }
    saving = true;
    try {
      const res = await fetch("/api/user/name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "Couldn't save your name. Please try again.");
        saving = false;
        return;
      }
      savedName = data?.name || trimmed;
      // Refresh layout data so needsNameOnboarding flips to false and the
      // dialog won't reopen on next navigation.
      await invalidateAll();
      step = 2;
    } catch (err) {
      console.error("name save failed", err);
      toast.error("Network error. Please try again.");
    } finally {
      saving = false;
    }
  }

  function personalizeNow() {
    open = false;
    goto("/settings/ai-personalization");
  }

  function skipPersonalization() {
    open = false;
    toast.success("You can personalize Ezbo any time from Settings.");
  }
</script>

<Dialog.Root
  bind:open
  onOpenChange={(o) => {
    // Don't let users dismiss step 1 by clicking outside — name is required.
    if (!o && step === 1) {
      open = true;
    }
  }}
>
  <Dialog.Content class="sm:max-w-md">
    {#if step === 1}
      <div class="flex flex-col items-center gap-4 pt-2 text-center">
        <div
          class="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="h-7 w-7"
          >
            <path d="M20 21a8 8 0 1 0-16 0" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <Dialog.Header class="space-y-2">
          <Dialog.Title class="text-xl">Welcome to Ezbo AI</Dialog.Title>
          <Dialog.Description>What is your name?</Dialog.Description>
        </Dialog.Header>
        <form onsubmit={submitName} class="w-full space-y-3 pt-1">
          <Input
            type="text"
            bind:value={name}
            placeholder="Your name"
            maxlength={80}
            autocomplete="given-name"
            disabled={saving}
            class="text-center"
          />
          <Button type="submit" class="w-full" disabled={saving || !name.trim()}>
            {saving ? "Saving..." : "Continue"}
          </Button>
        </form>
      </div>
    {:else}
      <div class="flex flex-col items-center gap-4 pt-2 text-center">
        <div
          class="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="h-7 w-7"
          >
            <path d="M9.5 2A2.5 2.5 0 0 0 7 4.5v15A2.5 2.5 0 0 0 9.5 22h5A2.5 2.5 0 0 0 17 19.5v-15A2.5 2.5 0 0 0 14.5 2h-5z" />
            <path d="M12 18h.01" />
          </svg>
        </div>
        <Dialog.Header class="space-y-2">
          <Dialog.Title class="text-xl">
            Nice to meet you{savedName ? `, ${savedName}` : ""}!
          </Dialog.Title>
          <Dialog.Description>
            Want to personalize Ezbo so it answers in a way that fits you best?
            You can tell it about your profession and how you'd like it to talk
            to you.
          </Dialog.Description>
        </Dialog.Header>
        <div class="flex w-full flex-col gap-2 pt-2 sm:flex-row">
          <Button class="flex-1" onclick={personalizeNow}>Yes, personalize</Button>
          <Button variant="outline" class="flex-1" onclick={skipPersonalization}
            >Skip for now</Button
          >
        </div>
      </div>
    {/if}
  </Dialog.Content>
</Dialog.Root>
