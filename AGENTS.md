# Codex PR Review Guide — Planic Admin (SaaS)

This file gives Codex **project-specific rules** for reviewing pull requests. Use it to evaluate admin and operations work in this repository. Prefer concrete, applicable checks over generic advice.

---

## Project Context

- **Product**: Planic — event-quote SaaS (quote generation, subscriptions, billing).
- **Stack**: Next.js 14, React, Neon (Postgres), NextAuth, Stripe/TossPayments.
- **Admin**: Cookie-based admin session (`lib/admin-auth`), HMAC-signed token (`COOKIE_NAME` / `planic_admin`). All admin API routes must call `requireAdmin(request)` and return 401 when unauthorized.
- **Admin surface**: UI under `app/admin/`, API under `app/api/admin/` and `app/api/auth/admin-*`. Key pages: dashboard (`app/admin/page.tsx`), users (`app/admin/users/page.tsx`), subscriptions (`app/admin/subscriptions/page.tsx`), plus plans, payments, engines, samples, review, usage, logs, ops-stats, system, settlement.

---

## Review Priorities

1. **Admin work must produce visible product impact** — docs/helpers only is not enough.
2. **Critical admin surfaces** — pay extra attention to dashboard, users, and subscriptions pages and their APIs.
3. **Operational usefulness** — real operator workflows over polished dummy UI.
4. **Security and access control** — strict on admin auth and sensitive actions.
5. **State and resilience** — loading, empty, error, and failure handling.
6. **UX and operational clarity** — tables, status, and actions must support fast decisions.

---

## Admin Product Expectations

- **Visible change**: For admin-related tasks, documentation-only or “lib/helpers/docs only” changes are **not sufficient**. The reviewer must verify that the **actual admin UI or operator workflow** changed in a meaningful way.
- **No “invisible” admin work**: Adding only utilities, types, or docs under `lib/` or `components/` without updating real admin pages (e.g. `app/admin/**/*.tsx`) or admin API behavior should be **flagged**. Ask: “Can an operator see or use this?”
- **Critical surfaces** (review with care):
  - `app/admin/page.tsx` — dashboard
  - `app/admin/users/page.tsx` — user list, filters, status
  - `app/admin/subscriptions/page.tsx` — subscriptions, revenue, failures
- **Other admin pages** (plans, payments, engines, samples, review, usage, logs, ops-stats, system, settlement) should also be held to the same bar when touched: real data, real actions, clear operator value.

---

## Security and Access Control

- **Every admin API route** under `app/api/admin/**` and any route that performs admin-only actions must:
  - Call `requireAdmin(request)` (from `@/lib/admin-auth`).
  - Return 401 (or equivalent) when the session is missing or invalid.
- **Flag**:
  - New admin endpoints that do not use `requireAdmin`.
  - Bypasses (e.g. query params or headers that skip auth “for convenience”).
  - Assumptions that “only admins can reach this URL” without server-side checks.
- **Sensitive admin actions** (e.g. user state changes, subscription overrides, payment/refund actions, system config) must be clearly protected and must not be callable by unauthenticated or non-admin clients.
- **Cookie and secrets**: Do not weaken cookie flags (e.g. HttpOnly, SameSite, Secure in production) or document default/weak secrets in a way that could encourage misuse.

---

## Data, State, and Reliability

- **Loading**: Admin list/detail views and actions that fetch data must show an explicit loading state (e.g. “로딩 중…” or skeleton). **Flag** missing loading states for async data.
- **Empty**: Empty lists or “no data” cases must be handled with a clear message, not a blank area or broken layout. **Flag** missing empty states.
- **Error**: Failed fetches or failed actions must surface an error message to the operator. **Flag** swallowed errors, silent failures, or generic “Something went wrong” with no way to recover or retry.
- **Async and data flow**: **Flag** unclear or fragile async handling (e.g. no cleanup on unmount, race conditions, or state updates after unmount). Admin actions should have understandable system feedback (success/error, and optionally loading).
- **Resilience**: Prefer patterns that support real operational data and future expansion (e.g. pagination, filters, clear error boundaries) over one-off mock structures.

---

## UX and Operational Clarity

- **Fast decision-making**: Admin UI should let operators assess status and act quickly. **Flag** missing or vague status indicators, unclear table columns, or actions that are hard to discover.
- **Core information** that should be visible where relevant (and flagged if missing when the feature claims to support it):
  - **Users**: user identity, signup/login, **subscription status**, **plan**, **usage/quota**, active/inactive, admin flag, last payment or conversion signal.
  - **Subscriptions**: plan, status, start/expiry, cancellation, payment failures, revenue/refund signals.
  - **Operations**: status indicators, timestamps, and policy-relevant info (e.g. limits, overages, failures).
- **Tables, cards, and actions**: Column headers and action labels should have clear operational meaning. **Flag** placeholder labels, “TODO” buttons, or actions that do not map to real backend behavior.

---

## PR Red Flags

- Admin task with **only** changes under `lib/`, `helpers/`, or `docs/` and no change to admin UI or API behavior.
- **New admin API route** without `requireAdmin(request)` and proper 401 on failure.
- **Auth bypass** or “dev-only” shortcuts that could ship to production.
- **Missing loading, empty, or error states** for admin views or actions that depend on async data.
- **Polished dummy UI** that is not wired to real data or real operations (e.g. static lists, fake actions).
- **Refactors or style-only changes** presented as “admin improvement” with no improvement to a real operator workflow.
- **Unclear or missing feedback** after admin actions (no success/error, or silent failures).
- **Missing core operator info** (e.g. subscription status, usage, or payment signals) on pages that claim to support user or subscription management.

---

## Not Enough for Approval

- **“Looks cleaner” or refactor alone** — Refactors without clear product or operational value must not be treated as sufficient. If the PR claims admin improvement, the reviewer must check whether a **real admin’s workflow** actually improved (e.g. faster decisions, fewer clicks, clearer status, or new actionable data).
- **Documentation-only for admin work** — If the task is “admin dashboard” or “admin feature X”, documentation-only changes are not enough. There must be a visible, usable change in the admin product (UI or API behavior).
- **Mock-only or placeholder UI** — Implementations that look complete but are not usable by a real operator (e.g. hardcoded data, non-functional buttons) should not be approved as “done.” Prefer structures that can support real data and future expansion.
- **Weakened security or access control** — Any change that removes or relaxes admin checks, or introduces bypasses, must not be approved without explicit justification and remediation.

---

## Quick Checklist for Admin PRs

- [ ] If the task is admin-related: does the **admin UI or API** actually change in a visible, usable way?
- [ ] Do all touched admin API routes use `requireAdmin(request)` and return 401 when unauthorized?
- [ ] Are loading, empty, and error states present for async admin views and actions?
- [ ] Do tables/cards show operator-relevant info (e.g. user/subscription status, usage, payments) where the feature claims it?
- [ ] Are admin actions wired to real behavior with clear success/error feedback?
- [ ] If the PR is a refactor or “improvement,” does a real operator workflow clearly improve?
