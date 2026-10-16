<script lang="ts">
  import { onMount, getContext } from "svelte";
  import { page } from "$app/state";
  import { toast } from "svelte-sonner";

  // UI Components
  import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";

  // Shared components
  import ChatInterface from "$lib/components/ChatInterface.svelte";
  import type { ChatState } from "$lib/components/chat-state.svelte.js";
  import type { SettingsState } from "$lib/stores/settings.svelte.js";
  import * as m from "$lib/../paraglide/messages.js";

  // Get chat state and settings from context (provided by layout)
  const chatState = getContext<ChatState>("chatState");
  const settingsState = getContext<SettingsState>("settings");

  onMount(() => {
    // Clear any existing chat when visiting newchat route for new conversations
    chatState.currentChatId = null;
    chatState.messages = [];
    chatState.error = null;
    chatState.clearSelectedTool(); // Clear tool selection when starting new chat
    chatState.resetFreshChatFlag(); // Reset fresh chat flag when starting new chat
    // Keep selected model for continuity

    // Display welcome notification if redirected after OTP verification
    if (page.url.searchParams.get("welcome") === "true") {
      toast.success("Welcome to EzboAI! Your account is verified and ready.", {
        description: "Start chatting with 65+ AI models across text, image, video, and audio.",
        duration: 6000,
      });
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("welcome");
        window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
      } catch {
        // Safe fallback
      }
    }
  });
</script>

<svelte:head>
  <title>{settingsState.siteName}</title>
  <meta name="description" content={settingsState.siteDescription} />
</svelte:head>

<!-- Main Chat Interface -->
<ChatInterface />

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root open={chatState.deletingChatId !== null}>
  <AlertDialog.Content class="z-[100]">
    <AlertDialog.Header>
      <AlertDialog.Title>{m['chat.delete_chat_title']()}</AlertDialog.Title>
      <AlertDialog.Description>
        {m['chat.delete_chat_description']()}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel onclick={() => chatState.cancelDelete()}
        >{m['chat.cancel']()}</AlertDialog.Cancel
      >
      <AlertDialog.Action
        onclick={() => chatState.confirmDeleteChat()}
        class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
      >
        {m['chat.delete']()}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<!-- Model Change Confirmation Dialog -->
<AlertDialog.Root open={chatState.showModelChangeDialog}>
  <AlertDialog.Content class="z-[100]">
    <AlertDialog.Header>
      <AlertDialog.Title>{m['chat.switch_model_title']()}</AlertDialog.Title>
      <AlertDialog.Description>
        {m['chat.switch_model_description']()}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel onclick={() => chatState.cancelModelChange()}
        >{m['chat.cancel']()}</AlertDialog.Cancel
      >
      <AlertDialog.Action onclick={() => chatState.confirmModelChange()}>
        {m['chat.start_new_chat']()}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
