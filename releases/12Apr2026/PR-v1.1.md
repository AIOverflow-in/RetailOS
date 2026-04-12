# RetailOS v1.1 — Release Notes

### Accessibility, Compliance, and Quality of Life

**Release Date:** April 2026
**Branch:** `feat/subhanu` → `main`

---

## Overview

RetailOS v1.1 is a focused quality-of-life release that builds on v1.0 with **four targeted improvements**: a new **Shop Settings** page for GSTIN and license details, a sweeping **accessibility upgrade** with larger fonts and icons, a **version numbering system** so you always know what you're running, and a **password visibility toggle** on both login pages.

No new core workflows — just polish, compliance, and a more comfortable everyday experience.

---

## What's New

### 1. Shop Settings Page — GSTIN & License Details
**Commit:** `33e2f52`

Store all your shop's compliance details in one place.

- **Store Address** — Full shop address including pincode, in a multi-line field
- **GSTIN** — 15-character GST identification number with auto-uppercase formatting
- **Drug License Number** — Required for medical and pharmacy shops
- **FSSAI Food License** — 14-digit food license number for shops selling food items or nutraceuticals
- **Other License Details** — Free-text field for any additional registrations or certifications
- **Per-Shop Storage** — Settings are stored per-shop in isolated tenant data, accessible only to that shop's operators
- **Save & Reload** — Values persist immediately and load automatically next time you open the page

**Why it matters:** GSTIN and license numbers belong on every printed bill, every GST return, and every compliance audit. Storing them centrally means you enter them once and they're always available — no retyping, no spreadsheets, no hunting for paperwork.

---

### 2. Accessibility — Larger Fonts and Icons
**Commit:** `a1d292f`

RetailOS is now significantly easier to read and operate.

- **Increased Base Font Size** — All text across the app is larger and more legible
- **Bigger Icons** — Sidebar, buttons, and navigation icons scaled up for visibility
- **Better Touch Targets** — Larger interactive areas for tablet and touchscreen use
- **Consistent Across the App** — Applied via global CSS so every page benefits uniformly

**Why it matters:** Pharmacy staff range widely in age and eyesight, and many shops run RetailOS on tablets at the counter. A POS that's easy to read reduces billing errors, speeds up checkouts, and makes long shifts less tiring on the eyes.

---

### 3. Version Numbering System with Auto-Bump and UI Display
**Commit:** `6cfdfc2`

Always know exactly which version of RetailOS you're running.

- **Auto-Incrementing Version** — Build process bumps the version number automatically with each release
- **Version Display in the UI** — Current version is visible from inside the app
- **Easy Support Triage** — When something behaves unexpectedly, support can immediately confirm which version is running

**Why it matters:** When a user reports an issue, the first question is always "what version are you on?" Now the answer is right on the screen. No more guessing, no more mismatch between what's deployed and what users think is deployed.

---

### 4. Password Visibility Toggle on Both Login Pages
**Commit:** `a4ef6cd`

A small UX win that makes a real difference.

- **Eye Icon Toggle** — Click the eye icon in any password field to reveal what you typed
- **Both Login Pages** — Available on the shop login page and the super admin login page
- **Reusable Component** — A new shared `PasswordInput` component used consistently, so future password fields get this for free

**Why it matters:** Typing complex passwords on touchscreens or unfamiliar keyboards is error-prone. Letting users verify their password before submitting reduces failed login attempts, account lockouts, and counter-staff frustration at the start of a shift.

---

## Summary of Changes

### New Pages
- `/settings` — Shop GSTIN, drug license, FSSAI, and store address

### New Components
- `PasswordInput` — Reusable password field with show/hide toggle, used on both login pages

### New Backend Endpoints
- `GET /settings` — Fetch the current shop's settings
- `PUT /settings` — Update the current shop's settings

### New Database Migrations
- `000003_add_tenant_settings` — Adds a JSONB `settings` column to the public `tenants` table

### Global UI Changes
- Increased base font size across all pages
- Larger sidebar and button icons
- Version number now visible in the app UI

---

## Technical Notes

- Tenant settings are stored as JSONB in the public `tenants` table and accessed via the connection pool directly, bypassing the per-tenant `search_path` middleware
- The settings endpoint validates that the request body is a JSON object, then re-marshals to canonical form before persisting
- The `PasswordInput` component is built once and reused — adding a password field anywhere else in the app automatically gets the toggle behavior
- Font and icon size changes are applied via global CSS utilities so they propagate to every page without per-component edits

---

## Test Plan

- [ ] Open `/settings`, fill in GSTIN, drug license, FSSAI, address; save and reload — values should persist
- [ ] Verify GSTIN auto-uppercases as you type
- [ ] Confirm FSSAI field caps at 14 characters and GSTIN at 15
- [ ] Toggle password visibility on the shop login page — verify text shows and hides correctly
- [ ] Toggle password visibility on the super admin login page — same check
- [ ] Verify the version number is visible somewhere in the app UI
- [ ] Compare font and icon sizes against v1.0 — confirm they're noticeably larger and consistent across all pages
- [ ] Open RetailOS on a tablet — confirm touch targets feel comfortable

---

**RetailOS v1.1** — Smaller release. Bigger impact. Easier every day.
