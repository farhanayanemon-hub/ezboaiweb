<script lang="ts">
  import { signIn } from "@auth/sveltekit/client";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { invalidateAll } from "$app/navigation";
  import Button from "$lib/components/ui/button/button.svelte";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import * as Separator from "$lib/components/ui/separator/index.js";
  import {
    authSanitizers,
    validatePasswordSafety,
  } from "$lib/utils/sanitization.js";
  import Logo from "$lib/components/Logo.svelte";

  let { data } = $props();

  let email = $state("");
  let password = $state("");
  let loading = $state(false);
  let error = $state("");

  // Check for success message from URL params - sanitize for security
  const successMessage = authSanitizers.successMessage(
    page.url.searchParams.get("message")
  );

  // Demo credentials state
  let copiedField = $state("");

  async function handleSignIn() {
    // Sanitize inputs for security
    const sanitizedEmail = authSanitizers.email(email);
    const passwordValidation = validatePasswordSafety(password);

    if (!sanitizedEmail || !passwordValidation.isValid) {
      error = "Please fill in all fields correctly";
      return;
    }

    loading = true;
    error = "";

    try {
      const result = await signIn("credentials", {
        email: sanitizedEmail,
        password: passwordValidation.sanitized,
        redirect: false,
      });

      // Auth.js returns an object with error property on failure
      if (result?.error) {
        // Map specific Auth.js errors to user-friendly messages
        switch (result.error) {
          case "CredentialsSignin":
            error = "Invalid email or password";
            break;
          case "AccessDenied":
            error = "Access denied. Please check your credentials.";
            break;
          default:
            error = "Invalid email or password";
        }
      } else if (result?.ok) {
        // Success - invalidate first to refresh session data, then redirect
        await invalidateAll();
        const redirectTo = authSanitizers.redirectUrl(
          page.url.searchParams.get("callbackUrl")
        );
        await goto(redirectTo);
        // Note: Chat history will be automatically refreshed by the reactive session system in layout
      } else {
        error = "An unexpected error occurred. Please try again.";
      }
    } catch (err) {
      // Catch any other errors (network issues, etc.) - don't expose internal error details
      console.error("Login error:", err);
      error = "An error occurred. Please try again.";
    } finally {
      loading = false;
    }
  }

  async function handleGoogleSignIn() {
    if (!data.oauthProviders?.google) {
      error = "Google sign-in is not available.";
      return;
    }

    loading = true;
    error = "";
    try {
      await signIn("google", {
        callbackUrl: authSanitizers.redirectUrl(
          page.url.searchParams.get("callbackUrl")
        ),
      });
    } catch (err) {
      console.error("OAuth provider error:", err);
      error = "Authentication with external provider failed. Please try again.";
      loading = false;
    }
  }

  async function handleAppleSignIn() {
    if (!data.oauthProviders?.apple) {
      error = "Apple sign-in is not available.";
      return;
    }

    loading = true;
    error = "";
    try {
      await signIn("apple", {
        callbackUrl: authSanitizers.redirectUrl(
          page.url.searchParams.get("callbackUrl")
        ),
      });
    } catch (err) {
      console.error("OAuth provider error:", err);
      error = "Authentication with external provider failed. Please try again.";
      loading = false;
    }
  }

  async function handleTwitterSignIn() {
    if (!data.oauthProviders?.twitter) {
      error = "X sign-in is not available.";
      return;
    }

    loading = true;
    error = "";
    try {
      await signIn("twitter", {
        callbackUrl: authSanitizers.redirectUrl(
          page.url.searchParams.get("callbackUrl")
        ),
      });
    } catch (err) {
      console.error("OAuth provider error:", err);
      error = "Authentication with external provider failed. Please try again.";
      loading = false;
    }
  }

  async function handleFacebookSignIn() {
    if (!data.oauthProviders?.facebook) {
      error = "Facebook sign-in is not available.";
      return;
    }

    loading = true;
    error = "";
    try {
      await signIn("facebook", {
        callbackUrl: authSanitizers.redirectUrl(
          page.url.searchParams.get("callbackUrl")
        ),
      });
    } catch (err) {
      console.error("OAuth provider error:", err);
      error = "Authentication with external provider failed. Please try again.";
      loading = false;
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      handleSignIn();
    }
  }

  // Copy to clipboard functionality for demo credentials
  async function copyToClipboard(text: string, fieldName: string) {
    try {
      await navigator.clipboard.writeText(text);
      copiedField = fieldName;
      setTimeout(() => {
        copiedField = "";
      }, 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  }

  // Auto-fill credentials
  function fillDemoCredentials() {
    email = "demo@demo.com";
    password = "demopass123";
  }
</script>

<svelte:head>
  <title>Login - {data.settings.siteName}</title>
  <meta name="description" content={data.settings.siteDescription} />
</svelte:head>

<div
  class="relative min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-background overflow-hidden"
>
  <!-- Ambient background glow matching landing page design -->
  <div class="pointer-events-none absolute inset-0 overflow-hidden opacity-40 dark:opacity-30">
    <div class="absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[300px] bg-gradient-to-tr from-indigo-500/25 to-purple-500/25 blur-[90px] rounded-full"></div>
    <div class="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[520px] h-[300px] bg-gradient-to-br from-purple-500/20 to-indigo-500/20 blur-[90px] rounded-full"></div>
  </div>

  <!-- Constrained Card Container (guaranteed <= 400px on desktop) -->
  <div class="relative z-10 w-full max-w-[400px] flex flex-col items-center mx-auto" style="max-width: 400px; width: 100%;">
    <!-- Brand Logo header -->
    <div class="mb-6 flex flex-col items-center">
      <a href="/" class="inline-flex items-center gap-2 transition-transform duration-200 hover:scale-[1.02]" title="Go to Home">
        <Logo alt={data.settings.siteName} />
      </a>
    </div>

    <Card.Root class="w-full border border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl rounded-2xl" style="max-width: 400px; width: 100%;">
      <Card.Header class="text-center pb-2">
        <Card.Title class="text-2xl font-bold tracking-tight">Log in</Card.Title>
        <Card.Description class="text-xs text-muted-foreground mt-1">
          Welcome back! Please enter your details.
        </Card.Description>
      </Card.Header>
    <Card.Content class="space-y-4">
      {#if data.oauthProviders?.google || data.oauthProviders?.apple || data.oauthProviders?.twitter || data.oauthProviders?.facebook}
        <!-- OAuth Provider Buttons -->
        {#if data.oauthProviders?.google}
          <!-- Google Sign In Button -->
          <Button
            onclick={handleGoogleSignIn}
            disabled={loading}
            variant="outline"
            class="w-full cursor-pointer"
          >
            <svg class="w-4 h-4 mr-2" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {loading ? "Signing in..." : "Continue with Google"}
          </Button>
        {/if}

        {#if data.oauthProviders?.apple}
          <!-- Apple Sign In Button -->
          <Button
            onclick={handleAppleSignIn}
            disabled={loading}
            variant="outline"
            class="w-full cursor-pointer"
          >
            <svg class="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
              />
            </svg>
            {loading ? "Signing in..." : "Continue with Apple"}
          </Button>
        {/if}

        {#if data.oauthProviders?.twitter}
          <!-- X (Twitter) Sign In Button -->
          <Button
            onclick={handleTwitterSignIn}
            disabled={loading}
            variant="outline"
            class="w-full cursor-pointer"
          >
            <svg class="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
              />
            </svg>
            {loading ? "Signing in..." : "Continue with X"}
          </Button>
        {/if}

        {#if data.oauthProviders?.facebook}
          <!-- Facebook Sign In Button -->
          <Button
            onclick={handleFacebookSignIn}
            disabled={loading}
            variant="outline"
            class="w-full cursor-pointer"
          >
            <svg class="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="#1877F2">
              <path
                d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
              />
            </svg>
            {loading ? "Signing in..." : "Continue with Facebook"}
          </Button>
        {/if}

        <div class="flex items-center">
          <div class="flex-1">
            <Separator.Root />
          </div>
          <span class="px-3 text-xs uppercase text-muted-foreground"> OR </span>
          <div class="flex-1">
            <Separator.Root />
          </div>
        </div>
      {/if}

      <form
        onsubmit={(e) => {
          e.preventDefault();
          handleSignIn();
        }}
        class="space-y-4"
      >
        <div class="space-y-2">
          <Label for="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="Enter your email"
            bind:value={email}
            disabled={loading}
            required
          />
        </div>
        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <Label for="password">Password</Label>
            <a
              href="/reset-password"
              class="text-sm text-primary hover:underline cursor-pointer"
            >
              Forgot your password?
            </a>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            bind:value={password}
            disabled={loading}
            required
          />
        </div>
        {#if successMessage}
          <div class="text-sm text-green-600 text-center bg-green-50 p-2 rounded">
            {successMessage}
          </div>
        {/if}
        {#if error}
          <div class="text-sm text-destructive text-center">
            {authSanitizers.errorMessage(error)}
          </div>
        {/if}

        <Button
          type="submit"
          disabled={loading}
          class="w-full cursor-pointer btn-gradient rounded-lg"
        >
          {loading ? "Logging in..." : "Log in"}
        </Button>
      </form>

      <p class="text-xs text-muted-foreground text-center">
        By continuing, you acknowledge {data.settings.siteName}'s
        <a class="underline underline-offset-2" href="/terms" target="_blank"
          >Terms of Service</a
        >.
      </p>
    </Card.Content>
    <Card.Footer class="flex flex-col gap-2 pt-2 text-center">
      <p class="text-sm text-muted-foreground">
        Don't have an account?
        <a href="/register" class="text-primary hover:underline font-medium cursor-pointer"
          >Create your account</a
        >
      </p>
    </Card.Footer>
  </Card.Root>

  <!-- Demo Credentials Section -->
  {#if data.isDemoMode}
    <Card.Root class="relative z-10 w-full max-w-[380px] mt-4 py-5 border border-border/80 bg-card/95 backdrop-blur-xl shadow-lg rounded-2xl">
      <Card.Content class="space-y-4">
        <div>
          <span class="font-semibold">Demo Credentials</span>
        </div>
        <div>
          <Label>Email</Label>
          <div class="flex items-center gap-2">
            <span class="text-muted-foreground text-sm">demo@demo.com</span>

            <Button
              size="sm"
              variant="outline"
              onclick={() => copyToClipboard("demo@demo.com", "demo-email")}
              title={copiedField === "demo-email" ? "Copied!" : "Copy email"}
            >
              {#if copiedField === "demo-email"}
                <!-- Checkmark icon -->
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 13l4 4L19 7"
                  ></path>
                </svg>
              {:else}
                <!-- Copy/Clipboard icon -->
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  ></path>
                </svg>
              {/if}
            </Button>
          </div>
        </div>
        <div>
          <Label>Password</Label>
          <div class="flex items-center gap-2">
            <span class="text-muted-foreground text-sm">demopass123</span>
            <Button
              size="sm"
              variant="outline"
              onclick={() => copyToClipboard("demopass123", "demo-password")}
              title={copiedField === "demo-password"
                ? "Copied!"
                : "Copy password"}
            >
              {#if copiedField === "demo-password"}
                <!-- Checkmark icon -->
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 13l4 4L19 7"
                  ></path>
                </svg>
              {:else}
                <!-- Copy/Clipboard icon -->
                <svg
                  class="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  ></path>
                </svg>
              {/if}
            </Button>
          </div>
        </div>
        <Button onclick={fillDemoCredentials} class="w-full">
          Auto-fill demo credentials
        </Button>
      </Card.Content>
    </Card.Root>
  {/if}

    <!-- Back to Home link -->
    <div class="mt-6 text-center">
      <a
        href="/"
        class="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5 px-3 rounded-full hover:bg-muted/50 cursor-pointer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
        Back to website
      </a>
    </div>
  </div>
</div>
