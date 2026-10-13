<script lang="ts">
  import * as Select from "$lib/components/ui/select/index.js";
  import Button from "$lib/components/ui/button/button.svelte";
  import {
    Settings2Icon,
    XIcon,
    ChevronDownIcon,
    CheckIcon,
    GlobeIcon,
    StarIcon,
    CameraIcon,
    MicIcon,
    ImageIcon,
    FileIcon,
  } from "$lib/icons/index.js";
  import { VoiceModeState } from "./voice-mode-state.svelte.js";
  import { GUEST_MESSAGE_LIMIT } from "$lib/constants/guest-limits.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { goto } from "$app/navigation";
  import { getAllToolNames, getToolDisplayName } from "$lib/ai/tools/index.js";
  import { IsMounted } from "runed";
  import * as m from "$lib/../paraglide/messages.js";
  import { providerConfig } from "$lib/config/provider-icons.js";

  // Controls the branded "sign up to keep chatting" popup that appears the
  // moment a guest tries to send a prompt. Guests can no longer get any
  // response without an account.
  let showLoginDialog = $state(false);

  // Hidden file inputs for the three attach options (Camera / Image / Files)
  // shown in the "+" action menu. Each one opens a different native picker.
  let cameraOpen = $state(false);
  let cameraInputEl = $state<HTMLInputElement | null>(null);
  let imageInputEl = $state<HTMLInputElement | null>(null);
  let fileInputEl = $state<HTMLInputElement | null>(null);

  function handleAttachmentChange(e: Event) {
    const target = e.target as HTMLInputElement;
    const picked = target.files;
    if (picked && picked.length > 0 && promptInputContext) {
      promptInputContext.add(picked);
    }
    // Reset so the same file can be re-picked later.
    target.value = "";
  }

  // Svelte AI Elements components
  import {
    PromptInput,
    PromptInputBody,
    PromptInputTextarea,
    PromptInputToolbar,
    PromptInputTools,
    PromptInputSubmit,
    PromptInputAttachments,
    PromptInputAttachment,
    PromptInputActionMenu,
    PromptInputActionMenuTrigger,
    PromptInputActionMenuContent,
    PromptInputActionMenuItem,
    PromptInputButton,
    PlusIcon,
    type PromptInputMessage,
    type ChatStatus,
    type AttachmentsContext,
  } from "$lib/components/ai-elements/prompt-input";

  // Model selector components
  import {
    ModelSelector,
    ModelSelectorTrigger,
    ModelSelectorContent,
    ModelSelectorInput,
    ModelSelectorList,
    ModelSelectorEmpty,
    ModelSelectorGroup,
    ModelSelectorItem,
    ModelSelectorLogo,
    ModelSelectorName,
  } from "$lib/components/ai-elements/model-selector";

  // Model selector utilities
  import {
    groupModelsByProvider,
    getInputModalities,
    capabilityConfig,
  } from "../chat-utils/model-capabilities.js";
  import type { AIModelConfig } from "$lib/ai/types.js";
  import type { AttachedFile } from "../chat-state.svelte.js";
  import CameraCaptureModal from "./CameraCaptureModal.svelte";
  import { isTextFileMimeType } from "$lib/utils/file-types.js";

  interface Props {
    prompt: string;
    isLoading: boolean;
    selectedTool: string | undefined;
    userId: string | null;
    guestMessageCount: number;
    models: AIModelConfig[];
    selectedModel: string;
    isLoadingModels: boolean;
    webSearchEnabled?: boolean;
    isWebSearchAvailable?: boolean;
    favoriteModels?: Set<string>;
    onToggleFavorite?: (modelName: string) => void;
    onPromptChange: (value: string) => void;
    onSubmit: (files?: AttachedFile[]) => void;
    onClearTool: () => void;
    onSelectModel: (modelName: string) => boolean;
    onSelectTool: (tool: string | undefined) => void;
    onWebSearchToggle?: (enabled: boolean) => void;
    voiceMode?: VoiceModeState;
    onVoiceTranscript?: (text: string) => void;
    cleanMessageContent: (content: string) => string;
    canGuestSendMessage: () => boolean;
    getModelDisplayName: (modelName: string) => string;
  }

  let {
    prompt,
    isLoading,
    selectedTool,
    userId,
    guestMessageCount,
    models,
    selectedModel,
    isLoadingModels,
    webSearchEnabled = false,
    isWebSearchAvailable = false,
    favoriteModels = new Set<string>(),
    onToggleFavorite,
    onPromptChange,
    onSubmit,
    onClearTool,
    onSelectModel,
    onSelectTool,
    onWebSearchToggle,
    voiceMode,
    onVoiceTranscript,
    cleanMessageContent,
    canGuestSendMessage,
    getModelDisplayName,
  }: Props = $props();

  async function handleVoiceClick() {
    if (!voiceMode) return;

    if (voiceMode.isRecording) {
      const text = await voiceMode.stopAndTranscribe();
      if (text && onVoiceTranscript) {
        onVoiceTranscript(text);
      }
    } else {
      await voiceMode.startRecording();
    }
  }

  const mounted = new IsMounted();

  // Textarea ref for focus management
  let textareaRef = $state<HTMLTextAreaElement | null>(null);

  // PromptInput attachments context for accessing file state
  let promptInputContext = $state<AttachmentsContext | null>(null);

  // Model selector state
  let modelSelectorOpen = $state(false);
  let modelSearchQuery = $state("");
  let selectedProviderFilter = $state<string | null>(null);

  // Debounced search query for performance
  let debouncedSearchQuery = $state("");
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Debounce search input - explicitly track modelSearchQuery to avoid running on unrelated state changes
  $effect(() => {
    const query = modelSearchQuery; // Explicitly track this dependency

    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    searchDebounceTimer = setTimeout(() => {
      debouncedSearchQuery = query;
    }, 150);

    return () => {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
      }
    };
  });

  // Memoized model lookup map for O(1) access instead of O(n) .find() calls
  let cachedModelsRef: AIModelConfig[] | null = null;
  let cachedModelLookup: Map<string, AIModelConfig> = new Map();

  const modelLookup = $derived.by(() => {
    // Only rebuild map when models array reference changes
    if (models !== cachedModelsRef) {
      cachedModelsRef = models;
      cachedModelLookup = new Map();
      for (const model of models) {
        cachedModelLookup.set(model.name, model);
      }
    }
    return cachedModelLookup;
  });

  // Derived model groups - standard provider grouping (Favorites handled via filter)
  const aiModelGroups = $derived.by(() => {
    // Ensure lookup is computed first
    modelLookup;
    return groupModelsByProvider(models);
  });

  // Filtered model groups based on provider selection
  const filteredModelGroups = $derived.by(() => {
    // Special handling for Favorites filter
    if (selectedProviderFilter === "Favorites") {
      const favoriteModelsList = models.filter((m) =>
        favoriteModels.has(m.name),
      );
      if (favoriteModelsList.length === 0) return [];
      return [
        {
          provider: "Favorites",
          models: favoriteModelsList.map((model) => ({
            value: model.name,
            label: model.displayName,
            capabilities: [],
            architecture: model.architecture,
          })),
        },
      ];
    }
    if (!selectedProviderFilter) {
      return aiModelGroups;
    }
    return aiModelGroups.filter(
      (group) => group.provider === selectedProviderFilter,
    );
  });

  // Get unique providers for filter pills (add Favorites pill when user has favorites)
  const uniqueProviders = $derived.by(() => {
    const providers = aiModelGroups.map((group) => group.provider);
    if (userId && favoriteModels.size > 0) {
      return ["Favorites", ...providers];
    }
    return providers;
  });

  // Get the provider for the selected model - O(1) lookup
  const selectedModelProvider = $derived.by(() => {
    const model = modelLookup.get(selectedModel);
    return model?.provider || null;
  });

  // Chat status for submit button
  const chatStatus = $derived.by((): ChatStatus => {
    if (isLoading) return "streaming";
    return "idle";
  });

  // Check if send button should be disabled
  // Use simple .trim() instead of full cleanMessageContent() to avoid 4 regex ops per keystroke
  // The full cleaning is only needed on actual submit
  const sendButtonDisabled = $derived.by(() => {
    if (isLoading) return true;

    const hasPrompt = prompt && prompt.trim();
    const hasFiles = (promptInputContext?.files?.length ?? 0) > 0;

    if (!hasPrompt && !hasFiles) return true;
    // Note: we intentionally do NOT disable the send button for guests.
    // We want the click/Enter to fire so we can intercept it in
    // handlePromptSubmit and open the sign-up / log-in popup.
    return false;
  });

  // Handle submit from PromptInput
  function handlePromptSubmit(message: PromptInputMessage, event: SubmitEvent) {
    // Prevent default form submission behavior
    event.preventDefault();

    const hasContent = cleanMessageContent(prompt);
    const hasFiles = message.files && message.files.length > 0;

    // Require either text content or files
    if (!hasContent && !hasFiles) return;

    // Guests cannot get any responses — show the sign-up / log-in popup
    // immediately and abort the send. The server also enforces this.
    if (!userId) {
      showLoginDialog = true;
      return;
    }
    if (!canGuestSendMessage()) {
      showLoginDialog = true;
      return;
    }

    // Convert FileUIPart[] to AttachedFile[] format for ChatState
    let files: AttachedFile[] | undefined;
    if (hasFiles) {
      files = message.files!.map((f, idx) => {
        const isTextFile = isTextFileMimeType(f.mediaType);
        let content: string | undefined;

        // Extract text content from data URL for text files
        if (isTextFile && f.url?.startsWith("data:")) {
          try {
            // Data URL format: data:[<mediatype>][;base64],<data>
            const base64Data = f.url.split(",")[1];
            if (base64Data) {
              content = atob(base64Data);
            }
          } catch (e) {
            console.error("Failed to decode text file content:", e);
          }
        }

        return {
          id: crypto.randomUUID(),
          file: new File([], f.filename || "file"), // Placeholder - not used for upload since we have dataUrl
          name: f.filename || `file-${idx}`,
          size: 0,
          type: f.mediaType || "application/octet-stream",
          dataUrl: f.url, // Already converted to data URL by PromptInput
          content, // Populated for text files
        };
      });
    }

    onSubmit(files);

    // Clear PromptInput's attachments after submission (files have been passed to ChatState)
    promptInputContext?.clear();
  }

  // Handle file upload error
  function handleUploadError(err: { code: string; message: string }) {
    console.error(`Upload error [${err.code}]: ${err.message}`);
  }

  // Capture screenshot using the Screen Capture API
  async function captureScreenshot() {
    try {
      // Check if the Screen Capture API is available
      if (!navigator.mediaDevices?.getDisplayMedia) {
        console.error("Screen Capture API not supported in this browser");
        return;
      }

      // Use CaptureController to prevent focus switch to captured tab/window
      // CaptureController is not yet in TypeScript's lib.dom.d.ts
      const CaptureControllerClass = (globalThis as Record<string, unknown>)["CaptureController"] as { new(): { setFocusBehavior(behavior: string): void } } | undefined;
      const controller = CaptureControllerClass ? new CaptureControllerClass() : null;

      // Set focus behavior to stay on current page (must be called before getDisplayMedia resolves)
      if (controller) {
        controller.setFocusBehavior("no-focus-change");
      }

      // Request screen capture - this opens the native browser dialog
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
        ...(controller && { controller }),
      } as DisplayMediaStreamOptions);

      // Get the video track
      const videoTrack = stream.getVideoTracks()[0];

      // Create a video element to capture a frame from
      const video = document.createElement("video");
      video.srcObject = stream;
      video.autoplay = true;

      // Wait for video to be ready
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          video.play();
          resolve();
        };
      });

      // Small delay to ensure the frame is rendered
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Draw to canvas and convert to blob
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      ctx.drawImage(video, 0, 0);

      // Stop the stream immediately (we only need one frame)
      stream.getTracks().forEach((track) => track.stop());

      // Convert to PNG blob
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/png");
      });

      if (!blob) {
        console.error("Failed to create screenshot blob");
        return;
      }

      // Create File object and add to attachments
      const filename = `screenshot-${Date.now()}.png`;
      const file = new File([blob], filename, { type: "image/png" });

      // Add to PromptInput's attachments context
      promptInputContext?.add([file]);
    } catch (error) {
      // User cancelled or browser doesn't support - silently ignore NotAllowedError
      if ((error as Error).name !== "NotAllowedError") {
        console.error("Screenshot capture failed:", error);
      }
    }
  }

  // Focus the textarea after model selector closes
  function focusTextareaAfterModelSelector(delay: number = 100) {
    modelSearchQuery = "";
    debouncedSearchQuery = "";
    selectedProviderFilter = null;

    managedTimeout(() => {
      const textarea = document.querySelector(
        'textarea[name="message"]',
      ) as HTMLTextAreaElement;
      if (textarea) {
        textarea.focus();
      }
    }, delay);
  }

  // Handle model selection from ModelSelector
  function handleModelSelect(modelValue: string) {
    const foundModel = modelLookup.get(modelValue);
    if (foundModel?.isLocked) {
      return;
    }

    if (!onSelectModel(modelValue)) {
      return;
    }

    modelSelectorOpen = false;
    focusTextareaAfterModelSelector(100);
  }

  // Handle model selector open state change
  function handleModelSelectorOpenChange(open: boolean) {
    modelSelectorOpen = open;

    // Focus prompt input when model selector closes
    if (!open) {
      focusTextareaAfterModelSelector(50);
    }
  }

  // Handle provider filter selection
  function handleProviderFilter(provider: string | null) {
    selectedProviderFilter = provider;
  }

  // Timer management for cleanup
  let timers: Set<ReturnType<typeof setTimeout>> = new Set();

  const TIMING = {
    FOCUS_AFTER_MOUNT: 225,
    PROMPT_TEMPLATE_FOCUS: 10,
  } as const;

  function managedTimeout(callback: () => void, delay: number) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
    return timer;
  }

  // Cleanup timers on component destroy - runs only once for cleanup registration
  let cleanupRegistered = false;
  $effect(() => {
    if (cleanupRegistered) return;
    cleanupRegistered = true;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  });

  // Focus textarea on mount - runs only once when mounted becomes true
  let focusAttempted = false;
  $effect(() => {
    if (focusAttempted || !mounted.current) return;
    focusAttempted = true;

    managedTimeout(() => {
      const textarea = document.querySelector(
        'textarea[name="message"]',
      ) as HTMLTextAreaElement;
      if (textarea) {
        textarea.focus();
        textareaRef = textarea;
      }
    }, TIMING.FOCUS_AFTER_MOUNT);
  });

  // Expose focus method for parent
  export function focus() {
    const textarea = document.querySelector(
      'textarea[name="message"]',
    ) as HTMLTextAreaElement;
    if (textarea) {
      textarea.focus();
    }
  }

  // Expose method to set cursor position after setting prompt
  export function focusWithCursor(position: number) {
    managedTimeout(() => {
      const textarea = document.querySelector(
        'textarea[name="message"]',
      ) as HTMLTextAreaElement;
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(position, position);
      }
    }, TIMING.PROMPT_TEMPLATE_FOCUS);
  }
</script>

<div class="flex-shrink-0 p-4 w-full flex justify-center fixed inset-x-0 bottom-0 z-40 bg-background border-t border-border md:static md:inset-auto md:bg-transparent md:border-t-0 pb-[max(env(safe-area-inset-bottom),1rem)] md:pb-4">
  <div class="w-full max-w-3xl">
    <!-- Guest hint: a single inline call-to-action above the input. The
         actual gating happens in handlePromptSubmit, which opens the
         branded sign-up / log-in popup as soon as a guest tries to send. -->
    {#if !userId}
      <div class="mb-2 px-2 text-sm text-muted-foreground flex items-center justify-between">
        <span>Sign up to start chatting with Ezbo AI.</span>
        <Button
          variant="ghost"
          size="sm"
          onclick={() => goto("/login")}
          class="h-7 underline px-2 cursor-pointer hover:bg-accent"
        >
          Log in
        </Button>
      </div>
    {/if}

    <!-- PromptInput with Svelte AI Elements -->
    <PromptInput
      onSubmit={handlePromptSubmit}
      onContextReady={(ctx) => (promptInputContext = ctx)}
      accept="image/*,.txt,.md,.csv,.json,.pdf,application/pdf"
      multiple={true}
      maxFiles={3}
      maxFileSize={10_000_000}
      globalDrop={false}
      clearOnSubmit={false}
      onError={handleUploadError}
      class="rounded-2xl shadow-lg"
    >
      <!-- Attachments display -->
      <PromptInputAttachments class="px-3 pt-3">
        {#snippet children(file)}
          <PromptInputAttachment data={file} />
        {/snippet}
      </PromptInputAttachments>

      <!-- Input body with textarea -->
      <PromptInputBody>
        <PromptInputTextarea
          value={prompt}
          disabled={isLoading}
          oninput={(e) =>
            onPromptChange((e.target as HTMLTextAreaElement).value)}
          placeholder={isLoading
            ? m["interface.generating_response"]()
            : m["interface.type_message_here"]()}
          class="min-h-24 max-h-64 px-4 pt-4 pb-2"
        />
      </PromptInputBody>

      <!-- Toolbar with actions -->
      <PromptInputToolbar class="px-2 py-2">
        <PromptInputTools>
          <!-- File attachment action menu -->
          <PromptInputActionMenu>
            <PromptInputActionMenuTrigger
              class={(promptInputContext?.files?.length ?? 0) > 0
                ? "bg-blue-500 text-white hover:bg-blue-600"
                : ""}
            >
              <PlusIcon class="size-4" />
            </PromptInputActionMenuTrigger>
            <PromptInputActionMenuContent>
              <PromptInputActionMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  // On desktop, file-input capture is ignored — open a real camera modal.
                  // On mobile, this still works as a clean photo-capture flow.
                  cameraOpen = true;
                }}
              >
                <CameraIcon class="mr-2 size-4" />
                Camera
              </PromptInputActionMenuItem>
              <PromptInputActionMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  imageInputEl?.click();
                }}
              >
                <ImageIcon class="mr-2 size-4" />
                Image
              </PromptInputActionMenuItem>
              <PromptInputActionMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  fileInputEl?.click();
                }}
              >
                <FileIcon class="mr-2 size-4" />
                Files
              </PromptInputActionMenuItem>
              {#if (promptInputContext?.files?.length ?? 0) > 0}
                <PromptInputActionMenuItem
                  onSelect={() => promptInputContext?.clear()}
                >
                  <XIcon class="mr-2 size-4" />
                  {m["interface.remove_all"]()}
                </PromptInputActionMenuItem>
              {/if}
            </PromptInputActionMenuContent>
          </PromptInputActionMenu>

          <!-- Model selector -->
          <ModelSelector
            open={modelSelectorOpen}
            onOpenChange={handleModelSelectorOpenChange}
          >
            <ModelSelectorTrigger>
              {#snippet children(triggerProps)}
                <PromptInputButton
                  {...triggerProps}
                  disabled={isLoadingModels}
                  class="gap-1.5 text-sm"
                  size="default"
                >
                  {#if !isLoadingModels && selectedModelProvider && providerConfig[selectedModelProvider]?.iconPath}
                    <img
                      src={providerConfig[selectedModelProvider].iconPath}
                      alt="{selectedModelProvider} icon"
                      class="size-4 object-contain flex-shrink-0"
                    />
                  {/if}
                  <span
                    class="truncate max-w-32 {isLoadingModels ? 'italic' : ''}"
                  >
                    {isLoadingModels
                      ? m["interface.loading"]()
                      : getModelDisplayName(selectedModel) ||
                        m["interface.select"]()}
                  </span>
                  <ChevronDownIcon class="w-4 h-4 flex-shrink-0" />
                </PromptInputButton>
              {/snippet}
            </ModelSelectorTrigger>

            <ModelSelectorContent class="sm:max-w-[550px]">
              <ModelSelectorInput
                placeholder={m["interface.search_models"]()}
                bind:value={modelSearchQuery}
              />

              <!-- Provider filter pills -->
              <div class="flex flex-wrap gap-1.5 px-3 py-2 border-b">
                <button
                  type="button"
                  onclick={() => handleProviderFilter(null)}
                  class="px-2.5 py-1 text-xs rounded-full transition-colors cursor-pointer
                    {selectedProviderFilter === null
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground'}"
                >
                  All
                </button>
                {#each uniqueProviders as provider (provider)}
                  <button
                    type="button"
                    onclick={() => handleProviderFilter(provider)}
                    class="px-2.5 py-1 text-xs rounded-full transition-colors cursor-pointer flex items-center gap-1
                      {selectedProviderFilter === provider
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'}"
                  >
                    {#if providerConfig[provider]?.iconPath}
                      <img
                        src={providerConfig[provider].iconPath}
                        alt="{provider} icon"
                        class="size-3 object-contain"
                      />
                    {/if}
                    {provider}
                  </button>
                {/each}
              </div>

              <ModelSelectorList>
                <ModelSelectorEmpty>
                  {m["interface.no_models_found"]()}
                </ModelSelectorEmpty>
                {#each filteredModelGroups as group (group.provider)}
                  <ModelSelectorGroup
                    heading={group.provider === "Favorites"
                      ? m["interface.favorites"]()
                      : group.provider}
                  >
                    {#each group.models as model (model.value)}
                      {@const foundModel = modelLookup.get(model.value)}
                      {@const isSelected = selectedModel === model.value}
                      {@const isLocked = foundModel?.isLocked || false}
                      {@const isFavorited = favoriteModels.has(model.value)}

                      <ModelSelectorItem
                        value={model.value}
                        keywords={[
                          model.label,
                          group.provider,
                          ...(isFavorited ? ["favorite", "favorites"] : []),
                        ]}
                        disabled={isLocked}
                        onSelect={() => handleModelSelect(model.value)}
                        class="{isLocked ? 'opacity-50' : ''} group/item"
                      >
                        <!-- Always show provider icon (use model's actual provider, not group) -->
                        {@const modelProvider =
                          foundModel?.provider || group.provider}
                        {#if providerConfig[modelProvider]?.iconPath}
                          <img
                            src={providerConfig[modelProvider].iconPath}
                            alt="{modelProvider} icon"
                            class="size-4 object-contain"
                          />
                        {:else}
                          <ModelSelectorLogo
                            provider={modelProvider.toLowerCase()}
                            class="size-4"
                          />
                        {/if}
                        <ModelSelectorName>
                          <span class="inline-flex items-center gap-1">
                            {model.label}

                            <!-- Capability icons in pill -->
                            {#if foundModel}
                              {@const inputModalities =
                                getInputModalities(foundModel)}
                              {#if inputModalities.length > 0}
                                <span
                                  class="inline-flex items-center gap-1.5 ms-1.5 px-1.5 py-0.5 rounded-full bg-black/10 dark:bg-white/10 opacity-70"
                                >
                                  {#each inputModalities as modality}
                                    {@const config = capabilityConfig[modality]}
                                    {#if config}
                                      {@const Icon = config.icon}
                                      <span title={config.tooltip}>
                                        <Icon
                                          class="w-3 h-3 {config.iconColor}"
                                        />
                                      </span>
                                    {/if}
                                  {/each}
                                </span>
                              {/if}
                            {/if}

                            <!-- Favorite star button - inline with model name -->
                            {#if userId && onToggleFavorite}
                              <button
                                type="button"
                                class="p-0.5 rounded hover:bg-accent/50 transition-all flex-shrink-0 {isFavorited
                                  ? ''
                                  : 'opacity-0 group-hover/item:opacity-50'}"
                                onclick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onToggleFavorite(model.value);
                                }}
                                title={isFavorited
                                  ? m["interface.remove_from_favorites"]()
                                  : m["interface.add_to_favorites"]()}
                              >
                                <StarIcon
                                  class="size-3.5 text-yellow-500 {isFavorited
                                    ? 'fill-yellow-500'
                                    : ''}"
                                />
                              </button>
                            {/if}
                          </span>
                          {#if isLocked}
                            <span class="text-xs text-muted-foreground ml-2">
                              {#if !userId}
                                ({m["interface.sign_up_to_unlock"]()})
                              {:else if foundModel?.isDemoMode}
                                ({m["interface.not_available_in_demo"]()})
                              {:else}
                                ({m["interface.sign_up_to_unlock"]()})
                              {/if}
                            </span>
                          {/if}
                        </ModelSelectorName>
                        {#if isSelected}
                          <CheckIcon
                            class="ml-auto size-4 text-primary flex-shrink-0"
                          />
                        {/if}
                      </ModelSelectorItem>
                    {/each}
                  </ModelSelectorGroup>
                {/each}
              </ModelSelectorList>
            </ModelSelectorContent>
          </ModelSelector>

          <!-- Tools selector with clear button -->
          <div class="flex items-center">
            <Select.Root
              type="single"
              value={selectedTool}
              onValueChange={onSelectTool}
            >
              <Select.Trigger
                class="h-8 text-sm border-transparent {selectedTool
                  ? 'border-dashed border-blue-500 bg-blue-50 dark:bg-blue-950'
                  : ''} cursor-pointer bg-transparent dark:bg-transparent hover:bg-accent dark:hover:bg-accent !rounded-lg [&>svg:last-child]:hidden"
              >
                <Settings2Icon class="size-4" />
                {#if selectedTool}
                  <span class="ml-1 text-xs hidden sm:inline"
                    >{getToolDisplayName(selectedTool)}</span
                  >
                {/if}
              </Select.Trigger>
              <Select.Content class="max-h-40">
                {#each getAllToolNames() as toolName (toolName)}
                  <Select.Item value={toolName} class="cursor-pointer">
                    <div class="flex flex-col">
                      <span class="font-medium"
                        >{getToolDisplayName(toolName)}</span
                      >
                    </div>
                  </Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
            {#if selectedTool}
              <button
                type="button"
                onclick={onClearTool}
                class="ml-0.5 p-1 rounded hover:bg-accent"
                aria-label="Clear tool selection"
              >
                <XIcon class="size-3" />
              </button>
            {/if}
          </div>

          <!-- Web Search Toggle - only show for supported models -->
          {#if isWebSearchAvailable}
            <Button
              type="button"
              variant={webSearchEnabled ? "secondary" : "ghost"}
              size="sm"
              class="h-8 gap-1.5 text-xs cursor-pointer {webSearchEnabled
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'}"
              onclick={() => onWebSearchToggle?.(!webSearchEnabled)}
              aria-label={webSearchEnabled
                ? "Disable web search"
                : "Enable web search"}
              aria-pressed={webSearchEnabled}
            >
              <GlobeIcon class="size-4" />
              <span class="hidden sm:inline">Search</span>
            </Button>
          {/if}

          <!-- Voice Input Button -->
          {#if voiceMode}
            <Button
              type="button"
              variant={voiceMode.isRecording ? "secondary" : "ghost"}
              size="sm"
              class="h-8 gap-1.5 text-xs cursor-pointer {voiceMode.isRecording
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 animate-pulse'
                : voiceMode.isTranscribing
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'}"
              onclick={handleVoiceClick}
              disabled={voiceMode.isTranscribing || isLoading}
              aria-label={voiceMode.isRecording ? "Stop recording" : "Start voice input"}
            >
              {#if voiceMode.isTranscribing}
                <svg class="size-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
                </svg>
                <span class="hidden sm:inline">Transcribing...</span>
              {:else if voiceMode.isRecording}
                <MicIcon class="size-4" />
                <span class="hidden sm:inline">{voiceMode.formatTime(voiceMode.recordingTime)}</span>
              {:else}
                <MicIcon class="size-4" />
              {/if}
            </Button>
          {/if}
        </PromptInputTools>

        <!-- Submit button -->
        <PromptInputSubmit
          status={chatStatus}
          disabled={sendButtonDisabled}
          class="rounded-lg"
        />
      </PromptInputToolbar>
    </PromptInput>
  </div>
</div>

<!-- Hidden inputs for the three attach options. Kept outside the action menu
     so closing the menu doesn't unmount them mid file-pick. -->
<input
  bind:this={cameraInputEl}
  type="file"
  accept="image/*"
  capture="environment"
  class="hidden"
  onchange={handleAttachmentChange}
/>
<input
  bind:this={imageInputEl}
  type="file"
  accept="image/*"
  multiple
  class="hidden"
  onchange={handleAttachmentChange}
/>
<input
  bind:this={fileInputEl}
  type="file"
  accept=".pdf,application/pdf,.txt,.md,.csv,.json"
  multiple
  class="hidden"
  onchange={handleAttachmentChange}
/>

<!-- Camera modal for taking photos via webcam (desktop) or device camera (mobile fallback). -->
<CameraCaptureModal
  bind:open={cameraOpen}
  onCapture={(file) => {
    promptInputContext?.add([file]);
  }}
  onClose={() => (cameraOpen = false)}
/>

<!-- Branded sign-up / log-in popup shown when a guest tries to send a prompt. -->
<Dialog.Root bind:open={showLoginDialog}>
  <Dialog.Content class="sm:max-w-md text-center">
    <div class="flex flex-col items-center gap-4 pt-2">
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
          <path d="M12 2a5 5 0 0 1 5 5v3a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5z" />
          <path d="M3 22a9 9 0 0 1 18 0" />
        </svg>
      </div>
      <Dialog.Header class="space-y-2">
        <Dialog.Title class="text-xl">Create a free account to chat</Dialog.Title>
        <Dialog.Description>
          Ezbo AI is free to use, but you need an account so we can save your
          conversations and keep your chats secure. It only takes a few seconds.
        </Dialog.Description>
      </Dialog.Header>
      <div class="flex w-full flex-col gap-2 pt-2 sm:flex-row">
        <Button
          class="flex-1"
          onclick={() => {
            showLoginDialog = false;
            goto("/register");
          }}
        >
          Sign up free
        </Button>
        <Button
          variant="outline"
          class="flex-1"
          onclick={() => {
            showLoginDialog = false;
            goto("/login");
          }}
        >
          Log in
        </Button>
      </div>
      <button
        type="button"
        class="text-xs text-muted-foreground hover:underline"
        onclick={() => (showLoginDialog = false)}
      >
        Maybe later
      </button>
    </div>
  </Dialog.Content>
</Dialog.Root>
