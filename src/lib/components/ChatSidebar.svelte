<script lang="ts">
  import { goto } from "$app/navigation";
  import { signOut } from "@auth/sveltekit/client";

  // UI Component imports
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import Button from "$lib/components/ui/button/button.svelte";
  import Logo from "$lib/components/Logo.svelte";

  // Icon imports
  import {
    ChevronDownIcon,
    UpgradeIcon,
    AudioLinesIcon,
    ImagesIcon,
    LoginIcon,
    LogOutIcon,
    MoreHorizontalIcon,
    PencilIcon,
    PinIcon,
    SettingsIcon,
    TrashIcon,
    UserIcon,
    GlobeIcon,
    CheckIcon,
    FolderOpenIcon,
    MessageCircleIcon,
  } from "$lib/icons/index.js";
  import GitBranch from "@lucide/svelte/icons/git-branch";

  import { getContext } from "svelte";
  import type { ChatState } from "./chat-state.svelte.js";
  import type { Session } from "@auth/sveltekit";
  import * as m from "$lib/../paraglide/messages.js";
  import {
    getLocale,
    setLocale,
    type Locale,
  } from "$lib/../paraglide/runtime.js";

  let { chatState }: { chatState: ChatState } = $props();

  // Get session from context (provided by layout)
  const getSession = getContext<() => Session | null>("session");
  const session = $derived(getSession?.() || null);

  // Focus action for accessibility
  function focus(node: HTMLElement) {
    node.focus();
  }

  // Language switching functions
  const currentLocale = $derived(getLocale());

  function changeLanguage(newLocale: Locale) {
    // Disable automatic reload to prevent flickering
    setLocale(newLocale, { reload: false });

    // Allow a brief moment for the cookie to be set, then reload
    setTimeout(() => {
      window.location.reload();
    }, 150);
  }
</script>

{#snippet chatItem(chat: {
  id: string;
  title: string;
  model: string;
  pinned: boolean;
  isBranch: boolean;
  createdAt: string;
  updatedAt: string;
})}
  <!-- Normal display mode -->
  <div class="relative group/item">
    <!-- Full-width hover background -->
    <div
      class="absolute inset-0 rounded-md bg-accent/100 transition-opacity {chatState.currentChatId ===
      chat.id
        ? 'opacity-100'
        : 'opacity-0 group-hover/item:opacity-100'}"
    ></div>

    <!-- Content layer -->
    <div class="relative flex items-center">
      <Sidebar.MenuButton
        class="flex-1 text-left py-6 cursor-pointer hover:!bg-transparent min-w-0"
        onclick={() => chatState.loadChat(chat.id)}
      >
        <div class="flex flex-col gap-1 min-w-0">
          <span class="font-light text-sm truncate leading-tight flex items-center gap-1">
            {#if chat.isBranch || chat.title.endsWith(' (Branch)')}
              <GitBranch class="w-3 h-3 flex-shrink-0 text-muted-foreground" />
            {/if}
            <span class="truncate">{chat.title}</span>
          </span>
          <div
            class="flex items-center gap-2 text-xs text-muted-foreground leading-tight"
          >
            <span class="truncate">
              {chatState.getModelDisplayName(chat.model)}
            </span>
            <span>•</span>
            <span class="whitespace-nowrap">
              {chatState.formatDate(chat.updatedAt)}
            </span>
          </div>
        </div>
      </Sidebar.MenuButton>

      <!-- Pin button -->
      <Button
        variant="ghost"
        size="sm"
        class="opacity-0 group-hover/item:opacity-100 transition-opacity p-2 h-6 w-6 flex-shrink-0 hover:bg-transparent {chat.pinned
          ? 'text-yellow-600'
          : 'text-muted-foreground'}"
        onclick={(e) => {
          e.stopPropagation();
          chatState.toggleChatPin(chat.id);
        }}
      >
        <PinIcon />
      </Button>

      <!-- 3-dot menu -->
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              variant="ghost"
              size="sm"
              class="opacity-0 group-hover/item:opacity-100 transition-opacity p-2 h-6 w-6 flex-shrink-0 hover:!bg-transparent"
              onclick={(e) => e.stopPropagation()}
            >
              <MoreHorizontalIcon />
            </Button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content side="right" align="start">
          <DropdownMenu.Item
            class="cursor-pointer"
            onclick={() => chatState.startEditingTitle(chat.id, chat.title)}
          >
            <PencilIcon class="w-4 h-4 mr-2" />
            {m["chat.rename"]()}
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item
            class="cursor-pointer text-destructive focus:text-destructive"
            onclick={() => chatState.startDeleteChat(chat.id)}
          >
            <TrashIcon class="w-4 h-4 mr-2" />
            {m["chat.delete"]()}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  </div>
{/snippet}

<Sidebar.Root>
  <Sidebar.Header>
    <div class="">
      <!-- Logo Section -->
      <div class="mb-5 mt-1 ml-1">
        <Logo alt="App Logo" />
      </div>

      <!-- New Chat Button -->
      <div class="flex items-center gap-1 mr-2">
        <div
          class="group/newchat flex-1 flex items-center p-2 gap-1 text-md font-semibold cursor-pointer hover:text-primary transition-colors hover:bg-accent/100 rounded-md"
          onclick={() => chatState.startNewChat()}
          role="button"
          tabindex="0"
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              chatState.startNewChat();
            }
          }}
        >
          <MessageCircleIcon
            class="w-5 h-5 transition-transform duration-300 group-hover/newchat:scale-110"
          />
          <span>{m["nav.new_chat"]()}</span>
        </div>
      </div>

      <hr class="my-2 mr-2 border-border" />

      <!-- Image & Video Button -->
      <div
        class="group/imgvid flex items-center p-2 mr-2 gap-1 text-md font-semibold cursor-pointer hover:text-primary transition-colors hover:bg-accent/100 rounded-md"
        onclick={() => goto("/image-video")}
        role="button"
        tabindex="0"
        onkeydown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            goto("/image-video");
          }
        }}
      >
        <ImagesIcon
          class="w-5 h-5 transition-transform duration-300 group-hover/imgvid:scale-110"
        />
        <span>{m["nav.image_video"]()}</span>
      </div>

      <!-- Audio Button -->
      <div
        class="group/audio flex items-center p-2 mr-2 gap-1 text-md font-semibold cursor-pointer hover:text-primary transition-colors hover:bg-accent/100 rounded-md"
        onclick={() => goto("/audio")}
        role="button"
        tabindex="0"
        onkeydown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            goto("/audio");
          }
        }}
      >
        <AudioLinesIcon
          class="w-5 h-5 transition-transform duration-300 group-hover/audio:scale-110"
        />
        <span>{m["nav.audio"]()}</span>
      </div>

      <hr class="my-2 mr-2 border-border" />

      <!-- Projects Button -->
      <div
        class="group/projects flex items-center p-2 mr-2 gap-1 text-md font-semibold cursor-pointer hover:text-primary transition-colors hover:bg-accent/100 rounded-md"
        onclick={() => goto("/projects")}
        role="button"
        tabindex="0"
        onkeydown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            goto("/projects");
          }
        }}
      >
        <FolderOpenIcon
          class="w-5 h-5 transition-transform duration-300 group-hover/projects:scale-110 group-hover/projects:rotate-4"
        />
        <span>{m["nav.projects"]()}</span>
      </div>
    </div>
  </Sidebar.Header>
  <Sidebar.Content class="scrollbar-thin">
    <!-- Pinned Chats Section -->
    {#if chatState.pinnedChats.length > 0}
      <Sidebar.Group>
        <Sidebar.GroupLabel class="cursor-default"
          >{m["sidebar.pinned_chats"]()}</Sidebar.GroupLabel
        >
        <Sidebar.GroupContent>
          <Sidebar.Menu class="space-y-1">
            {#each chatState.pinnedChats as chat}
              <Sidebar.MenuItem>
                {#if chatState.editingChatId === chat.id}
                  <!-- Editing mode -->
                  <div class="p-2 bg-accent/50 rounded-md">
                    <input
                      type="text"
                      bind:value={chatState.editingTitle}
                      class="w-full text-sm bg-transparent border-none outline-none p-1 rounded"
                      onkeydown={(e) => {
                        if (e.key === "Enter") {
                          chatState.saveRenamedTitle(chat.id);
                        } else if (e.key === "Escape") {
                          chatState.cancelEditing();
                        }
                      }}
                      {@attach focus}
                    />
                    <div class="flex gap-1 mt-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        class="h-6 px-2 text-xs"
                        onclick={() => chatState.saveRenamedTitle(chat.id)}
                      >
                        {m["chat.save"]()}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        class="h-6 px-2 text-xs"
                        onclick={() => chatState.cancelEditing()}
                      >
                        {m["chat.cancel"]()}
                      </Button>
                    </div>
                  </div>
                {:else}
                  {@render chatItem(chat)}
                {/if}
              </Sidebar.MenuItem>
            {/each}
          </Sidebar.Menu>
        </Sidebar.GroupContent>
      </Sidebar.Group>
    {/if}

    <!-- Recent Chats Section -->
    <Sidebar.Group>
      <Sidebar.GroupLabel class="cursor-default"
        >{m["sidebar.recent_chats"]()}</Sidebar.GroupLabel
      >
      <Sidebar.GroupContent>
        <Sidebar.Menu class="space-y-1">
          {#if chatState.recentChats.length === 0 && chatState.pinnedChats.length === 0}
            <div class="p-4 text-center text-sm text-muted-foreground">
              {#each m["sidebar.no_chat_history"]().split("\n") as line}
                {line}<br />
              {/each}
            </div>
          {:else if chatState.recentChats.length === 0}
            <div class="p-4 text-center text-sm text-muted-foreground">
              {#each m["sidebar.all_chats_pinned"]().split("\n") as line}
                {line}<br />
              {/each}
            </div>
          {:else}
            {#each chatState.recentChats as chat}
              <Sidebar.MenuItem>
                {#if chatState.editingChatId === chat.id}
                  <!-- Editing mode -->
                  <div class="p-2 bg-accent/50 rounded-md">
                    <input
                      type="text"
                      bind:value={chatState.editingTitle}
                      class="w-full text-sm bg-transparent border-none outline-none p-1 rounded"
                      onkeydown={(e) => {
                        if (e.key === "Enter") {
                          chatState.saveRenamedTitle(chat.id);
                        } else if (e.key === "Escape") {
                          chatState.cancelEditing();
                        }
                      }}
                      {@attach focus}
                    />
                    <div class="flex gap-1 mt-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        class="h-6 px-2 text-xs"
                        onclick={() => chatState.saveRenamedTitle(chat.id)}
                      >
                        {m["chat.save"]()}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        class="h-6 px-2 text-xs"
                        onclick={() => chatState.cancelEditing()}
                      >
                        {m["chat.cancel"]()}
                      </Button>
                    </div>
                  </div>
                {:else}
                  {@render chatItem(chat)}
                {/if}
              </Sidebar.MenuItem>
            {/each}
          {/if}
        </Sidebar.Menu>
      </Sidebar.GroupContent>
    </Sidebar.Group>
  </Sidebar.Content>
  <Sidebar.Footer>
    {#if session?.user}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              variant="ghost"
              class="w-full justify-start mb-2 p-3 h-auto rounded-xl cursor-pointer"
            >
              <div class="flex items-center gap-3 w-full">
                <div
                  class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"
                >
                  <UserIcon class="w-4 h-4" />
                </div>
                <div class="flex flex-col items-start text-left flex-1 min-w-0">
                  <span class="font-medium text-sm truncate w-full">
                    {session?.user?.name || "User"}
                  </span>
                  <span class="text-xs text-muted-foreground truncate w-full">
                    {session?.user?.email || ""}
                  </span>
                </div>
                <ChevronDownIcon class="w-4 h-4 text-muted-foreground" />
              </div>
            </Button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content side="top" align="end" class="w-56">
          <DropdownMenu.Item
            onclick={() => goto("/settings")}
            class="cursor-pointer"
          >
            <SettingsIcon class="w-4 h-4 mr-2" />
            {m["auth.account_settings"]()}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onclick={() => goto("/pricing")}
            class="cursor-pointer"
          >
            <UpgradeIcon class="w-4 h-4 mr-2" />
            {m["auth.upgrade_plan"]()}
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger class="cursor-pointer">
              <GlobeIcon class="w-4 h-4 mr-2" />
              {m["common.language"]()}
            </DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent side="right" class="w-40">
              <DropdownMenu.Item
                onclick={() => changeLanguage("en")}
                class="cursor-pointer"
              >
                <div class="flex items-center justify-between w-full">
                  <span>{m["common.english"]()}</span>
                  {#if currentLocale === "en"}
                    <CheckIcon class="w-4 h-4 ml-2" />
                  {/if}
                </div>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onclick={() => changeLanguage("de")}
                class="cursor-pointer"
              >
                <div class="flex items-center justify-between w-full">
                  <span>{m["common.german"]()}</span>
                  {#if currentLocale === "de"}
                    <CheckIcon class="w-4 h-4 ml-2" />
                  {/if}
                </div>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onclick={() => changeLanguage("es")}
                class="cursor-pointer"
              >
                <div class="flex items-center justify-between w-full">
                  <span>{m["common.spanish"]()}</span>
                  {#if currentLocale === "es"}
                    <CheckIcon class="w-4 h-4 ml-2" />
                  {/if}
                </div>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onclick={() => changeLanguage("pt")}
                class="cursor-pointer"
              >
                <div class="flex items-center justify-between w-full">
                  <span>{m["common.portuguese"]()}</span>
                  {#if currentLocale === "pt"}
                    <CheckIcon class="w-4 h-4 ml-2" />
                  {/if}
                </div>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onclick={() => changeLanguage("ar")}
                class="cursor-pointer"
              >
                <div class="flex items-center justify-between w-full">
                  <span>{m["common.arabic"]()}</span>
                  {#if currentLocale === "ar"}
                    <CheckIcon class="w-4 h-4 ml-2" />
                  {/if}
                </div>
              </DropdownMenu.Item>
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>
          <DropdownMenu.Separator />
          <DropdownMenu.Item
            onclick={() => signOut({ callbackUrl: "/newchat" })}
            class="cursor-pointer"
          >
            <LogOutIcon class="w-4 h-4 mr-2" />
            {m["auth.sign_out"]()}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    {:else}
      <Button
        variant="ghost"
        size="sm"
        href="/login"
        class="w-full justify-start mb-2 p-5 rounded-xl cursor-pointer"
      >
        {m["auth.sign_in"]()}
        <LoginIcon />
      </Button>
    {/if}
  </Sidebar.Footer>
</Sidebar.Root>
