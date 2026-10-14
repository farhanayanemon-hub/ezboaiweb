<script lang="ts">
  /**
   * ChatInterface - Orchestration layer for the chat interface
   *
   * Composes sub-components:
   * - PromptTemplates: Welcome screen with template suggestions
   * - MessagesList: Message rendering and display
   * - ChatInput: Input area with file upload, model selector, and tools
   *
   * Uses Svelte AI Elements Conversation components for automatic scroll management
   */

  import Skeleton from "$lib/components/ui/skeleton/skeleton.svelte";
  import { IsMounted } from "runed";
  import { getContext } from "svelte";
  import type { ChatState } from "./chat-state.svelte.js";
  import * as m from "$lib/../paraglide/messages.js";

  // Sub-components
  import PromptTemplates from "./chat/PromptTemplates.svelte";
  import MessagesList from "./chat/MessagesList.svelte";
  import ChatInput from "./chat/ChatInput.svelte";
  import AppDownloadBanner from "$lib/components/AppDownloadBanner.svelte";
  import { VoiceModeState } from "./chat/voice-mode-state.svelte.js";

  // Conversation components for auto-scroll management
  import {
    Conversation,
    ConversationContent,
    ConversationEmptyState,
    ConversationScrollButton,
  } from "$lib/components/ai-elements/conversation";

  // Popover positioning utilities
  import { setupPopoverPositioning } from "./chat-utils/popover-positioning.js";

  // Get chat state from context (provided by layout)
  const chatState = getContext<ChatState>("chatState");

  let chatInput: ChatInput;
  const mounted = new IsMounted();

  const voiceMode = new VoiceModeState();

  // Timer management for cleanup
  let timers: Set<ReturnType<typeof setTimeout>> = new Set();

  // Standardized timing constants
  const TIMING = {
    FOCUS_AFTER_RESPONSE: 200,
    PROMPT_TEMPLATE_FOCUS: 10,
  } as const;

  // Helper function for managed timers
  function managedTimeout(callback: () => void, delay: number) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
    return timer;
  }

  // Cleanup timers and voice mode on component destroy
  $effect(() => {
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
      voiceMode.destroy();
    };
  });

  // Setup popover positioning when component mounts
  $effect(() => {
    if (!mounted.current) return;

    const cleanup = setupPopoverPositioning(
      [
        {
          popoverId: "model-selector-popover",
          triggerId: "model-selector-trigger",
        },
        { popoverId: "file-upload-popover", triggerId: "file-upload-trigger" },
      ],
      () => mounted.current,
    );

    return cleanup;
  });

  // Setup model change detection
  chatState.setupModelChangeDetection();

  // Handle clicking on prompt templates
  function handlePromptTemplate(template: string) {
    chatState.prompt = template;
    // Focus the input and move cursor to end
    managedTimeout(() => {
      chatInput?.focusWithCursor(template.length);
    }, TIMING.PROMPT_TEMPLATE_FOCUS);
  }

  // Focus input after AI responds
  $effect(() => {
    if (!chatState.isLoading && chatState.messages.length > 0) {
      managedTimeout(() => {
        chatInput?.focus();
      }, TIMING.FOCUS_AFTER_RESPONSE);
    }
  });
</script>

<!-- Main content area -->
<main class="flex flex-col h-full w-full min-w-0 overflow-hidden">
  <!-- Top App Download Banner -->
  <AppDownloadBanner />

  <!-- Main chat area with auto-scroll management -->
  <Conversation class="flex-1 min-h-0">
    <ConversationContent
      class="scroll-smooth overflow-x-hidden p-0 pb-[180px] md:pb-0 {chatState.messages.length ===
        0 && !chatState.isLoadingChat
        ? 'overflow-y-hidden'
        : ''}"
    >
      {#if chatState.isLoadingChat}
        <div class="flex items-center justify-center p-6 h-full">
          <div class="w-full xl:max-w-4xl mx-auto text-center">
            <div class="flex items-center justify-center gap-2">
              <div class="flex items-center space-x-4">
                <div class="space-y-2">
                  <Skeleton class="h-5 w-lg" />
                  <Skeleton class="h-5 w-xl" />
                  <Skeleton class="h-5 w-sm" />
                  <Skeleton class="h-5 w-md" />
                  <Skeleton class="h-5 w-xl" />
                  <Skeleton class="h-5 w-lg" />
                </div>
              </div>
            </div>
          </div>
        </div>
      {:else if chatState.messages.length === 0}
        <ConversationEmptyState class="!p-4 overflow-hidden">
          <div class="w-full xl:max-w-4xl mx-auto">
            <div class="text-center mb-8">
              <h1 class="text-4xl font-bold mb-4">
                {m["interface.welcome_heading"]()}
              </h1>
              <p class="text-muted-foreground text-lg mb-2">
                {m["interface.welcome_subtitle"]()}
              </p>
              <div class="text-sm text-muted-foreground">
                {m["interface.welcome_description"]()}
              </div>
            </div>

            <!-- Prompt Templates Grid -->
            <PromptTemplates onTemplateClick={handlePromptTemplate} />
          </div>
        </ConversationEmptyState>
      {:else}
        <MessagesList
          messages={chatState.messages}
          isLoading={chatState.isLoading}
          isStreamingContent={chatState.isStreamingContent}
          error={chatState.error}
          getModelDisplayName={chatState.getModelDisplayName}
          selectedModel={chatState.selectedModel}
          activeToolInvocations={chatState.activeToolInvocations}
          onRetryMessage={(index) => chatState.retryMessage(index)}
          retryingMessageIndex={chatState.retryingMessageIndex}
          onBranchMessage={(index) => chatState.branchFromMessage(index)}
          isBranch={chatState.currentChatIsBranch}
          branchAtIndex={chatState.currentChatBranchAtIndex}
          branchSourceId={chatState.currentChatBranchSourceId}
          branchSourceTitle={chatState.currentChatBranchSourceTitle}
          editingMessageIndex={chatState.editingMessageIndex}
          editingMessageContent={chatState.editingMessageContent}
          onStartEdit={(index) => chatState.startEditMessage(index)}
          onCancelEdit={() => chatState.cancelEditMessage()}
          onUpdateEditContent={(content) =>
            chatState.updateEditingContent(content)}
          onSaveEdit={() => chatState.saveAndRegenerateMessage()}
          chatId={chatState.currentChatId}
        />
      {/if}
    </ConversationContent>

    <!-- Scroll-to-bottom button (auto-shows when user scrolls up) -->
    <ConversationScrollButton />
  </Conversation>

  <!-- Chat input area -->
  <ChatInput
    bind:this={chatInput}
    prompt={chatState.prompt}
    isLoading={chatState.isLoading}
    selectedTool={chatState.selectedTool}
    userId={chatState.userId}
    guestMessageCount={chatState.guestMessageCount}
    models={chatState.models}
    selectedModel={chatState.selectedModel}
    isLoadingModels={chatState.isLoadingModels}
    webSearchEnabled={chatState.webSearchEnabled}
    isWebSearchAvailable={chatState.isWebSearchAvailable()}
    favoriteModels={chatState.favoriteModels}
    onToggleFavorite={(modelName) => chatState.toggleFavorite(modelName)}
    onPromptChange={(value) => (chatState.prompt = value)}
    onSubmit={(files) => chatState.handleSubmit(files)}
    onClearTool={() => chatState.clearSelectedTool()}
    onSelectModel={(modelName) => chatState.selectModel(modelName)}
    onSelectTool={(tool) => (chatState.selectedTool = tool)}
    onWebSearchToggle={(enabled) => (chatState.webSearchEnabled = enabled)}
    {voiceMode}
    onVoiceTranscript={(text) => {
      chatState.prompt = text;
      managedTimeout(() => {
        chatInput?.focusWithCursor(text.length);
      }, TIMING.PROMPT_TEMPLATE_FOCUS);
    }}
    cleanMessageContent={(content) => chatState.cleanMessageContent(content)}
    canGuestSendMessage={() => chatState.canGuestSendMessage()}
    getModelDisplayName={(name) => chatState.getModelDisplayName(name)}
  />
</main>
