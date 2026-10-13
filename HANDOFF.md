# EZBO AI Web — Project Handoff / Agent Memory

Last updated: July 07, 2026. This file lets any developer or AI agent continue work on this project from scratch.

## Current live state (all verified working)

- **Live site:** https://ezboai.com (primary). https://www.ezboai.com 308-redirects to it. https://ezboaiweb.vercel.app also serves the app.
- **Hosting:** Vercel — team `team_GLZNluxStmySEmkyLhDyzbJi`, project `ezboaiweb` (`prj_soYYd0AsfAXsNfexmZdSsT88U7F9`), production branch `main` of this GitHub repo (repoId `1111734803`). Pushing to `main` triggers deploys; a production deploy can also be triggered via `POST /v13/deployments` with `gitSource {type: github, ref: main, repoId}`.
- **Database:** Neon Postgres. Vercel env `DATABASE_URL` is set (production/preview/development). Schema was created with `drizzle-kit push`. All tables exist; pricing plans auto-seed from code defaults.
- **Admin account:** `ovirajemon11@gmail.com` (isAdmin=true, email verified). Password hash updated to user's desired password. Login + `/admin` verified working on ezboai.com.
- **Branding & Models:** The 3 internal models have been renamed to `Ezbo 1.0`, `Ezbo 1.0 (Beta)`, and `Ezbo P2 Thinking`. All public branding ("XBrainPro") updated to "Ezbo AI" / "Ezbo".
- **Auth UI:** `/login` and `/register` have been redesigned with a sleek, compact container (`max-w-[380px]`), brand logo, ambient glow, and back link. Auth buttons (Sign In / Sign Up) across the landing page navbar, mobile menu, and dialogs are native `href` anchor buttons for instant, reliable navigation.
- **DNS (managed at Hostinger, nameservers ns1/ns2.dns-parking.com):**
  - `A @ -> 76.76.21.21` (Vercel)
  - `CNAME www -> cname.vercel-dns.com`
  - Email records (MX mx1/mx2.hostinger.com, SPF/DMARC TXT, hostingermail DKIM CNAMEs, autoconfig/autodiscover) and `A ftp` are untouched and must be preserved.
- Vercel env vars set: `DATABASE_URL`, `AUTH_SECRET`, `NODE_ENV=production`. `AUTH_URL`/`ORIGIN` are intentionally NOT set — `trustHost: true` handles multi-domain auth.

## Key technical lessons (do not re-learn these the hard way)

1. **`/auth/csrf` returns 404 — this is NOT a bug.** `@auth/sveltekit`'s `signIn("credentials")` client never calls `/auth/csrf`; it POSTs directly to `/auth/callback/credentials` with header `X-Auth-Return-Redirect: 1`. Login works fine in browsers.
2. **Testing login with curl** requires BOTH headers: `Origin: <site-url>` (SvelteKit's built-in CSRF check otherwise returns "Cross-site POST form submissions are forbidden") and `X-Auth-Return-Redirect: 1`. Success returns `{"url": ...}` and sets `__Secure-authjs.session-token`.
3. **Build fixes already on main:** uses `@sveltejs/adapter-auto` (adapter-node broke Vercel), and the broken `static/uploads` symlink was removed.
4. **Hostinger DNS API** (if DNS changes are ever needed again): `https://developers.hostinger.com/api/dns/v1/zones/ezboai.com` with a Bearer API token from hpanel.hostinger.com/profile/api. `DELETE` with `{filters:[{name,type}]}` then `PUT` with `{overwrite:false, zone:[...]}` only touches matching name+type, preserving email records. CNAME contents need a trailing dot.
5. An empty database causes the homepage to 500. If pointing at a fresh DB, run `drizzle-kit push` with `DATABASE_URL` set first.
6. **Unlayered CSS override issue:** Never put `* { max-width: 100%; }` as unlayered CSS in `app.css`. In modern CSS Cascade Layers, unlayered styles override all styles inside `@layer utilities` regardless of specificity, breaking Tailwind's `max-w-*` classes. Use `@layer base` and inline styles `style="max-width: 400px; width: 100%;"` on auth card containers.

## Not yet configured (features that need API keys via /admin or Vercel env)

- AI models: `OPENROUTER_API_KEY`, `REPLICATE_API_TOKEN`
- Payments: Stripe keys / opaybd config
- Storage: Cloudflare R2 (`R2_*`)
- Email: SMTP settings (needed for OTP/verification emails)
- Social login: Google OAuth etc.
- Turnstile captcha keys

## To continue from a new Replit account (or any environment)

1. Import this repo: `farhanayanemon-hub/ezboaiweb` (GitHub).
2. Add these secrets (values are with the project owner — never commit them):
   - `GITHUB_TOKEN` — GitHub personal access token with repo access
   - `VERCEL_TOKEN` — Vercel account token
   - `NEON_DATABASE_URL` — Neon Postgres connection string (same value as Vercel's `DATABASE_URL`)
   - `HOSTINGER_API_TOKEN` — (optional) only if DNS changes are needed
3. Development: `npm install`, then `npm run dev`. DB schema changes: edit `src/lib/server/db/schema.ts`, then `drizzle-kit push`.
4. Deploy: push to `main` — Vercel auto-deploys — or trigger via the Vercel API (IDs above).
