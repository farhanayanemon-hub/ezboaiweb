<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";
  import Button from "$lib/components/ui/button/button.svelte";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import { CheckIcon, LoaderIcon } from "$lib/icons/index.js";
  import { enhance } from "$app/forms";

  let { data, form } = $props();

  let saving = $state(false);
  let showSuccess = $state(false);

  const s = data.landingSettings;

  function getVal(key: string, fallback: string): string {
    return s[key] || fallback;
  }
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-xl font-bold">Landing Page Content</h2>
    <p class="text-muted-foreground mt-1">
      Edit all text content displayed on the public landing page.
    </p>
  </div>

  {#if showSuccess}
    <div class="bg-green-500/10 border border-green-500/20 rounded-lg p-3 flex items-center gap-2">
      <CheckIcon class="w-4 h-4 text-green-500" />
      <p class="text-sm text-green-500 font-medium">Landing page content saved successfully!</p>
    </div>
  {/if}

  {#if form?.error}
    <div class="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
      <p class="text-sm text-destructive">{form.error}</p>
    </div>
  {/if}

  <form
    method="POST"
    action="?/update"
    use:enhance={() => {
      saving = true;
      showSuccess = false;
      return async ({ update }) => {
        await update();
        saving = false;
        showSuccess = true;
        setTimeout(() => (showSuccess = false), 3000);
      };
    }}
  >
    <div class="space-y-6">

      <Card.Root>
        <Card.Header>
          <Card.Title>Hero Section</Card.Title>
        </Card.Header>
        <Card.Content class="space-y-4">
          <div>
            <Label for="hero_heading">Heading</Label>
            <Input
              id="hero_heading"
              name="hero_heading"
              value={getVal("hero_heading", "Unlock AI Magic: Text, Images, Videos –")}
            />
          </div>
          <div>
            <Label for="hero_highlight">Highlight Text (colored)</Label>
            <Input
              id="hero_highlight"
              name="hero_highlight"
              value={getVal("hero_highlight", "Create Without Limits")}
            />
          </div>
          <div>
            <Label for="hero_subheading">Subheading</Label>
            <Textarea
              id="hero_subheading"
              name="hero_subheading"
              rows={3}
              value={getVal("hero_subheading", "Dive into endless AI possibilities: pick from top-tier LLMs, craft images from text or existing visuals, and animate videos starting with words or pictures—your creative toolkit awaits.")}
            />
          </div>
          <div>
            <Label for="hero_cta_text">CTA Button Text</Label>
            <Input
              id="hero_cta_text"
              name="hero_cta_text"
              value={getVal("hero_cta_text", "Get Started for Free")}
            />
          </div>
          <div>
            <Label for="hero_social_proof">Social Proof Text</Label>
            <Input
              id="hero_social_proof"
              name="hero_social_proof"
              value={getVal("hero_social_proof", "Loved by over 1,000 creators!")}
            />
          </div>
        </Card.Content>
      </Card.Root>

      <Card.Root>
        <Card.Header>
          <Card.Title>Features Section</Card.Title>
        </Card.Header>
        <Card.Content class="space-y-4">
          <div>
            <Label for="features_title">Section Title</Label>
            <Input
              id="features_title"
              name="features_title"
              value={getVal("features_title", "One Platform, Infinite AI: Text to Video, Imagination to Reality")}
            />
          </div>
          <div>
            <Label for="features_subtitle">Section Subtitle</Label>
            <Textarea
              id="features_subtitle"
              name="features_subtitle"
              rows={3}
              value={getVal("features_subtitle", "Choose from a vast array of AI models to bring your ideas to life: harness powerful text-based LLMs for intelligent responses, generate stunning visuals with text-to-image and image-to-image capabilities, and create dynamic content through text-to-video and image-to-video transformations—all in one seamless platform.")}
            />
          </div>

          {#each [
            { idx: 1, defaultTitle: "65 Models", defaultDesc: "Discover an expansive library of over 65 AI models tailored to your needs, from cutting-edge text-based LLMs like GPT, Claude, Gemini variants to specialized tools for creative generation.", defaultTags: "Text Generation, Image Generation, Video Generation" },
            { idx: 2, defaultTitle: "Image Generation", defaultDesc: "Transform your visions into reality with powerful image generation capabilities. Leverage text-to-image for creating stunning visuals from simple descriptions, or use image-to-image to refine and evolve existing photos with styles, edits, or enhancements.", defaultTags: "23+ Models" },
            { idx: 3, defaultTitle: "Video Generation", defaultDesc: "Bring stories to life effortlessly through innovative video generation. Start with text-to-video to generate dynamic clips from written prompts, or elevate static assets with image-to-video for animated sequences and smooth transitions.", defaultTags: "8+ Models" },
            { idx: 4, defaultTitle: "Multimodal Chat", defaultDesc: "Engage in intelligent, versatile conversations with our multimodal chat feature, where text-based LLMs integrate seamlessly with image and video inputs. Upload visuals to analyze, generate related content, or even iterate on ideas in real-time.", defaultTags: "File Upload, Chats History" },
            { idx: 5, defaultTitle: "Why choose us?", defaultDesc: "Experience unmatched versatility, speed, and affordability in one platform—backed by secure, scalable infrastructure for creators and enterprises alike.", defaultTags: "Generous pricing model, Reliability" },
            { idx: 6, defaultTitle: "Get started now!", defaultDesc: "Ready to unleash AI? Sign up for a free trial today and explore 65+ models with no credit card required.", defaultTags: "GDPR, Secure" },
          ] as feature}
            <div class="border rounded-lg p-4 space-y-3">
              <p class="text-sm font-semibold text-muted-foreground">Feature Card {feature.idx}</p>
              <div>
                <Label for="feature_{feature.idx}_title">Title</Label>
                <Input
                  id="feature_{feature.idx}_title"
                  name="feature_{feature.idx}_title"
                  value={getVal(`feature_${feature.idx}_title`, feature.defaultTitle)}
                />
              </div>
              <div>
                <Label for="feature_{feature.idx}_desc">Description</Label>
                <Textarea
                  id="feature_{feature.idx}_desc"
                  name="feature_{feature.idx}_desc"
                  rows={3}
                  value={getVal(`feature_${feature.idx}_desc`, feature.defaultDesc)}
                />
              </div>
              <div>
                <Label for="feature_{feature.idx}_tags">Tags (comma separated)</Label>
                <Input
                  id="feature_{feature.idx}_tags"
                  name="feature_{feature.idx}_tags"
                  value={getVal(`feature_${feature.idx}_tags`, feature.defaultTags)}
                />
              </div>
            </div>
          {/each}
        </Card.Content>
      </Card.Root>

      <Card.Root>
        <Card.Header>
          <Card.Title>Pricing Section</Card.Title>
          <Card.Description>
            Pricing plans are managed from the Pricing Plans settings page. Here you can edit the section text.
          </Card.Description>
        </Card.Header>
        <Card.Content class="space-y-4">
          <div>
            <Label for="pricing_title">Section Title</Label>
            <Input
              id="pricing_title"
              name="pricing_title"
              value={getVal("pricing_title", "Simple, Transparent Pricing")}
            />
          </div>
          <div>
            <Label for="pricing_subtitle">Section Subtitle</Label>
            <Input
              id="pricing_subtitle"
              name="pricing_subtitle"
              value={getVal("pricing_subtitle", "Start free and scale as you grow. No hidden fees, no surprises.")}
            />
          </div>
        </Card.Content>
      </Card.Root>

      <Card.Root>
        <Card.Header>
          <Card.Title>CTA Section</Card.Title>
        </Card.Header>
        <Card.Content class="space-y-4">
          <div>
            <Label for="cta_heading">Heading</Label>
            <Input
              id="cta_heading"
              name="cta_heading"
              value={getVal("cta_heading", "Ignite Your AI-Powered Future")}
            />
          </div>
          <div>
            <Label for="cta_subheading">Subheading</Label>
            <Input
              id="cta_subheading"
              name="cta_subheading"
              value={getVal("cta_subheading", "Your journey to effortless innovation starts here.")}
            />
          </div>
          <div>
            <Label for="cta_button_text">Button Text</Label>
            <Input
              id="cta_button_text"
              name="cta_button_text"
              value={getVal("cta_button_text", "Get Started for Free")}
            />
          </div>
        </Card.Content>
      </Card.Root>

      <Card.Root>
        <Card.Header>
          <Card.Title>FAQ Section</Card.Title>
        </Card.Header>
        <Card.Content class="space-y-4">
          <div>
            <Label for="faq_title">Section Title</Label>
            <Input
              id="faq_title"
              name="faq_title"
              value={getVal("faq_title", "Frequently Asked Questions")}
            />
          </div>
          <div>
            <Label for="faq_subtitle">Section Subtitle</Label>
            <Input
              id="faq_subtitle"
              name="faq_subtitle"
              value={getVal("faq_subtitle", "Get answers to common questions about our platform")}
            />
          </div>

          {#each [
            { idx: 1, defaultQ: "What AI models are available on your platform?", defaultA: "We offer 65+ AI models from 9 different providers including OpenRouter (32+ text models), Google Gemini, OpenAI, xAI, Stability AI, Black Forest Labs, Kling AI, Luma Labs, and Alibaba. This includes text generation models like Claude, GPT, Gemini, and Llama, plus 25+ image generation models and 8+ video generation models." },
            { idx: 2, defaultQ: "How does your pricing work?", defaultA: "We offer a free tier with basic text generation, limited image creation, and chat history. Our Professional plan ($19/month) includes unlimited text generation, advanced image models, video generation, and priority support. Enterprise plans ($49/month) add custom limits." },
            { idx: 3, defaultQ: "Can I switch between models mid-conversation?", defaultA: "Yes! You can seamlessly switch between any of our 65+ models during a conversation while maintaining your complete chat history. This allows you to leverage different model strengths for different tasks within the same conversation." },
            { idx: 4, defaultQ: "What file types can I upload?", defaultA: "Our multimodal chat supports image uploads (PNG, JPG, JPEG, WebP) and text files. You can upload images for analysis, editing, or to use as input for image-to-image and image-to-video generation across compatible models." },
            { idx: 5, defaultQ: "Is my data secure and private?", defaultA: "Yes, we prioritize your privacy and security. We're GDPR compliant, SOC2 certified, and maintain 99.9% uptime. Your conversations and generated content are securely stored with enterprise-grade encryption. We include bot protection via Cloudflare Turnstile and follow security best practices." },
            { idx: 6, defaultQ: "Do you offer enterprise solutions?", defaultA: "Yes! Our Advanced plan includes all Pro features plus custom usage limits, priority support, and advanced admin controls. Contact us for custom advanced solutions and volume pricing." },
            { idx: 7, defaultQ: "What's included in the free tier?", defaultA: "Our free tier includes basic text generation capabilities, limited image creation, chat history storage, and access to select AI models. It's perfect for trying out the platform and light usage. No credit card required to get started." },
            { idx: 8, defaultQ: "Can I cancel my subscription anytime?", defaultA: "Absolutely! You can cancel your subscription at any time through your account settings. There are no long-term contracts or cancellation fees. Your access will continue until the end of your current billing period." },
          ] as faq}
            <div class="border rounded-lg p-4 space-y-3">
              <p class="text-sm font-semibold text-muted-foreground">FAQ {faq.idx}</p>
              <div>
                <Label for="faq_{faq.idx}_question">Question</Label>
                <Input
                  id="faq_{faq.idx}_question"
                  name="faq_{faq.idx}_question"
                  value={getVal(`faq_${faq.idx}_question`, faq.defaultQ)}
                />
              </div>
              <div>
                <Label for="faq_{faq.idx}_answer">Answer</Label>
                <Textarea
                  id="faq_{faq.idx}_answer"
                  name="faq_{faq.idx}_answer"
                  rows={3}
                  value={getVal(`faq_${faq.idx}_answer`, faq.defaultA)}
                />
              </div>
            </div>
          {/each}
        </Card.Content>
      </Card.Root>

      <Card.Root>
        <Card.Header>
          <Card.Title>Footer</Card.Title>
        </Card.Header>
        <Card.Content>
          <div>
            <Label for="footer_text">Copyright Text</Label>
            <Input
              id="footer_text"
              name="footer_text"
              value={getVal("footer_text", "© 2026 Ezbo AI. All rights reserved.")}
            />
          </div>
        </Card.Content>
      </Card.Root>

      <div class="flex justify-end">
        <Button type="submit" disabled={saving} class="min-w-[140px]">
          {#if saving}
            <LoaderIcon class="w-4 h-4 animate-spin mr-2" />
            Saving...
          {:else}
            Save Changes
          {/if}
        </Button>
      </div>
    </div>
  </form>
</div>
