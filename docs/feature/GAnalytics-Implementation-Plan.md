# Google Analytics 4 — Implementation Plan

**Property:** SellOS Web Software
**Measurement ID:** `G-HHZ6RF3CML`
**Stream URL:** `https://app.sellos.in`
**Stream ID:** `14984265772`
**Scope:** Frontend app at `frontend/` (Next.js 16, App Router, React 19). Landing site (`landing/`) is out of scope for this plan.

---

## Goal

Stand up basic GA4 tracking on the SellOS web app so we can answer:

- Who's actively using the app (sessions, DAU/MAU per tenant)?
- Which features get used, and which sit idle?
- Where do users drop off in the bill-creation funnel?
- Which print/share channels (browser print vs WhatsApp PDF) are actually used?
- Auth health — how often do logins fail?

We are **not** building a marketing-attribution funnel or an A/B testing harness in this pass. Just enough instrumentation to make product decisions.

---

## Approach

Use `@next/third-parties/google` — Next.js's officially supported wrapper around `gtag.js`. It:

- Defers the GA script until **after** hydration (no impact on LCP/FCP).
- Tracks SPA pageviews automatically on `history.pushState` — no manual wiring per route.
- Exposes a typed `sendGAEvent()` helper for custom events.

We will wrap `sendGAEvent` in a single `lib/analytics.ts` module so every call site goes through one place. That gives us:

- A no-op fallback when GA isn't loaded (local dev, missing env var).
- One file to rename/retire events from later.
- A natural spot to scrub PII before it leaves the browser.

---

## Step-by-step

### 1. Install dependency

```bash
cd frontend
npm install @next/third-parties@latest
```

This adds a single package, no peer-dependency conflicts with Next 16.2.1.

### 2. Configure environment variable

Add to `frontend/.env.local`:

```env
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-HHZ6RF3CML
```

And mirror it in Vercel project settings for the **Production** environment only (skip Preview/Development so PR builds and local don't pollute the data stream).

Document the var in `CLAUDE.md` under the existing Environment Variables section.

### 3. Mount `<GoogleAnalytics />` in the root layout

Edit `frontend/app/layout.tsx`:

```tsx
import { GoogleAnalytics } from '@next/third-parties/google'

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable}>
      <head>...</head>
      <body ...>
        <Providers>{children}</Providers>
        <ToasterClient />
      </body>
      {GA_ID ? <GoogleAnalytics gaId={GA_ID} /> : null}
    </html>
  )
}
```

The env-var guard means GA is silently absent when the var isn't set (local dev), so we don't need a separate dev/prod branch.

### 4. Create `frontend/lib/analytics.ts`

Single wrapper module. API:

```ts
// Fire a custom event. No-op if GA isn't loaded.
export function trackEvent(name: string, params?: Record<string, unknown>): void

// Attach a tenant_id to the current GA session so we can segment by shop.
// Pass tenant ID only — no usernames, emails, or phone numbers.
export function identifyTenant(tenantId: string): void
```

Implementation notes:

- Internally call `sendGAEvent('event', name, params)` from `@next/third-parties/google`.
- Wrap in `typeof window !== 'undefined'` + a `try/catch` so a broken GA load can never break the app.
- For `identifyTenant`, use `gtag('set', 'user_properties', { tenant_id })` plus `gtag('config', GA_ID, { user_id: tenantId })`.

### 5. Wire up events

Each row below is a single `trackEvent(...)` call at the marked location. **No event carries PII** — only IDs, counts, amounts, and enums.

| Event | Location | Params | Why |
|---|---|---|---|
| `login_success` | `app/(auth)/login/page.tsx` — after successful auth response | `{ tenant_id }` | Funnel entry |
| `login_failed` | same file — in the catch branch | `{ reason }` (`'invalid_credentials' \| 'network' \| 'server'`) | Auth health |
| `logout` | sidebar/topbar logout handler | — | Session length signal |
| `bill_created` | `app/(dashboard)/billing/page.tsx` — after order POST resolves | `{ total, item_count, payment_mode, gst_total }` | **Core conversion event** |
| `bill_printed` | `generateBill()` in `lib/generateBill.tsx` | `{ source: 'new' \| 'reprint' }` | Print-flow usage |
| `bill_whatsapp_sent` | `sendBillViaWhatsApp()` in `lib/generateBill.tsx` | `{ total }` | Channel split |
| `product_added` | inventory create handler | `{ has_batch: boolean }` | Onboarding/growth signal |
| `batch_added` | batch create handler | `{ standalone: boolean }` (batch added without a fresh product) | Stock-keeping usage |
| `customer_created` | customers page create handler | — | CRM adoption |
| `report_exported` | reports page CSV export | `{ report_type, row_count }` | Compliance-feature usage |
| `settings_updated` | settings save handler | `{ section }` (`'shop' \| 'gst' \| 'invoice'`) | Configuration churn |

`identifyTenant(tenantId)` is called **once** on `login_success` and **once** on app boot if a JWT is already present in the Redux store.

### 6. GA4 admin configuration (one-time, in the GA4 UI)

After events start flowing, register custom dimensions so they're filterable:

- `tenant_id` — user-scoped — source: `user_property` named `tenant_id`
- `payment_mode` — event-scoped — source: event parameter
- `report_type` — event-scoped — source: event parameter
- `source` (for `bill_printed`) — event-scoped

Mark `bill_created` as a **Key Event** (formerly Conversion) so it shows in the standard reports.

In **Admin → Data Streams → Web → Enhanced Measurement**: confirm "Page changes based on browser history events" is enabled. (It is by default; we just need to verify.)

### 7. Verification

Local check (with `NEXT_PUBLIC_GA_MEASUREMENT_ID` temporarily set in `.env.local`):

1. `cd frontend && npm run dev`
2. Open `http://localhost:3000`, log in, create a bill, export a report.
3. Open GA4 → **Reports → Realtime** — events should appear within ~30 seconds.
4. Confirm `tenant_id` shows up as a user property on the active user card.

Production check: after deploy to `app.sellos.in`, repeat steps 2–4 against the live app.

---

## What's intentionally **not** in this plan

- **Cookie consent banner.** GA4 is cookieless-by-default for the events we send, and our user base is India-only today. If/when we sell into EU/UK, we'll add a CMP and gate the GA mount on consent.
- **Google Tag Manager.** Direct `gtag.js` is simpler for this event set. We can layer GTM later if marketing needs to fire additional vendor tags without code deploys.
- **Server-side events.** All tracking is browser-side. Server-side measurement protocol can come later if we need to attribute revenue events that happen outside the SPA (e.g., webhook-driven).
- **PII / customer data.** No customer names, phone numbers, GSTINs, or invoice numbers are sent to GA. If a future event needs richer context, we hash on the client first.

---

## Files touched

### New
- `frontend/lib/analytics.ts` — `trackEvent`, `identifyTenant` helpers

### Modified
- `frontend/package.json` + `package-lock.json` — add `@next/third-parties`
- `frontend/app/layout.tsx` — mount `<GoogleAnalytics />`
- `frontend/.env.local` (and Vercel production env) — add `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- `CLAUDE.md` — document the new env var
- `frontend/app/(auth)/login/page.tsx` — `login_success` / `login_failed` / `identifyTenant`
- `frontend/app/(dashboard)/billing/page.tsx` — `bill_created`
- `frontend/lib/generateBill.tsx` — `bill_printed`, `bill_whatsapp_sent`
- `frontend/app/(dashboard)/inventory/...` — `product_added`, `batch_added`
- `frontend/app/(dashboard)/customers/...` — `customer_created`
- `frontend/app/(dashboard)/reports/...` — `report_exported`
- `frontend/app/(dashboard)/settings/...` — `settings_updated`
- Sidebar/topbar logout handler — `logout`

---

## Rollout

1. Land the layout + helper + env var in one PR — GA mounted, zero custom events. Confirm pageviews work in production for 24 hours.
2. Land the event wiring in a second PR. Smaller blast radius if any one event throws.
3. Register custom dimensions in GA4 admin **after** step 2 deploys and events have been seen at least once (GA4 needs to see the param to let you register it).
