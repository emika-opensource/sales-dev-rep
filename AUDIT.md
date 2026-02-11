# AUDIT.md — Sales Development Rep (Prospect Hub)

**Date:** 2026-02-11  
**Auditor:** AI Internal Audit  
**Focus:** Time-to-first-value (TTFV) improvements

---

## 1. First-Run Experience

**Verdict: No onboarding whatsoever. Cold start into empty dashboard.**

When a new user opens the app for the first time:

1. They land on `#dashboard` — which shows **all zeros**. Total Prospects: 0, Enrichment Rate: 0%, With Email: 0, With Phone: 0. An empty funnel. No ICP segments.
2. There is **zero guidance** on what to do next. No welcome modal, no getting-started wizard, no empty-state CTAs, no tooltips.
3. The BOOTSTRAP.md defines an 8-step conversational onboarding flow, but this is **AI-agent-only** — it only fires if the user is chatting with the AI. If they just open the dashboard URL directly, they get nothing.
4. A new user must **already know** to navigate to Settings → paste an Apollo API key → go to ICPs → create a profile → go to Prospects → import CSV or search → then enrich. That's **6+ pages and 15+ clicks** before any value.

**TTFV estimate: 10-20 minutes** for someone who reads BOOTSTRAP.md. **Infinite** for someone who just opens the dashboard.

---

## 2. UI/UX Issues

### Critical
- **Empty dashboard is demoralizing.** All-zeros stat cards with no call-to-action. Should show a setup checklist or redirect to onboarding.
- **No loading states.** Every API call just... happens. No spinners, no skeleton screens. The page either shows stale data or nothing.
- **No confirmation that settings saved correctly.** The "Save Settings" button fires a toast but doesn't validate API keys. User can paste garbage and never know it's wrong until enrichment fails silently.
- **Campaigns can't actually send email.** There's no email sending integration. Users can build elaborate multi-step sequences that do absolutely nothing. This is a dead end.
- **No way to add prospects to campaigns from the UI.** The campaign detail says "Add prospects from the Prospects table using bulk select" — but there's no bulk action to assign prospects to a campaign. Complete dead end.

### Major
- **CSV preview is naive.** It splits on commas, which breaks for any CSV with commas in values (quoted fields). The preview will look garbled for real-world CSVs.
- **Double-click to edit cells is undiscoverable.** No visual hint that cells are editable. Users will never find this.
- **The "Enrich" icon (sparkle/starburst SVG) is cryptic.** No label, no tooltip. New users won't know what it does.
- **ICP scoring is opaque.** Prospects get scored 0-100 but users can't see how. No breakdown of which criteria matched.
- **No pagination.** If you have 10,000 prospects, the app loads them all. The `limit`/`offset` params exist on the API but the frontend never uses them.
- **Search has 300ms debounce but re-renders the entire table.** With large datasets this will be janky.

### Minor
- **Mobile responsive is just "collapse sidebar."** The table is completely unusable on mobile.
- **Sort arrows always show up-arrow icon when not sorted.** Confusing — should hide when inactive.
- **Color swatches in ICP form don't show selected state on page load** when editing an existing ICP with a non-default color.
- **Waterfall drag-and-drop has no drop indicator.** Hard to tell where you're dropping.
- **No keyboard shortcuts.** No `Ctrl+K` search, no `Esc` to close modals (wait — Esc does close inline edit, but not modals via keyboard).

---

## 3. Feature Completeness

### Fully Implemented ✅
- Prospect CRUD (create, read, update, delete, bulk delete)
- CSV import with auto-mapping
- CSV export
- ICP CRUD with criteria
- ICP scoring (basic)
- Template CRUD
- Campaign CRUD with step builder
- Apollo.io search integration
- Apollo.io enrichment integration
- Settings with API key management
- Waterfall enrichment ordering
- Dashboard analytics
- Detail sidebar for prospects
- Inline cell editing
- Bulk selection + enrichment

### Stubbed / Fake 🟡
- **ContactOut, RocketReach, Hunter enrichment** — all use `mockEnrich()` which returns random fake data. No real integration.
- **Campaign execution** — campaigns can be created and set to "active" but nothing happens. No email sending. No scheduling. No tracking.
- **Campaign stats** (sent, opened, replied, bounced) — always 0. No mechanism to update them.
- **Email verification** — not implemented at all despite Hunter.io being listed.

### Missing / TODO 🔴
- **No email sending capability.** The entire campaign feature is decorative.
- **No prospect deduplication.** Import the same CSV twice and you get duplicates.
- **No undo for destructive actions.** Delete is permanent (just removes from JSON).
- **No prospect search via Apollo from the UI.** The API endpoint exists (`POST /api/search`) but there's no UI to trigger it. The only way to search is through the AI agent.
- **No way to link templates to campaign steps.** Steps are created manually; you can't pick from your template library.
- **No webhook/callback for enrichment results.** Everything is synchronous.
- **No rate limiting on API calls.** A user could hammer Apollo's API.

---

## 4. Error Handling

**Verdict: Minimal. Happy path only.**

- **API errors:** The `api()` helper calls `r.json()` without checking `r.ok`. A 500 response with HTML error page will throw a JSON parse error that's completely unhandled.
- **Network errors:** No try/catch around most API calls in the frontend. If the server is down, the app silently breaks.
- **Empty states:** Prospects table has a decent empty state ("No prospects yet"). ICPs, campaigns, and templates also have basic empty states. Dashboard has none — just zeros.
- **Enrichment failures:** If all providers fail, the user sees... nothing. No error toast, no indication which providers were tried.
- **CSV import errors:** Server returns `{ error: message }` but the frontend doesn't check for this — it blindly reads `result.imported`.
- **File I/O:** The `loadJson` helper has a try/catch, which is good. But `saveJson` doesn't — a full disk would crash the server.
- **No input validation on the server.** You can POST a prospect with `{ status: "whatever" }` — no enum validation. Same for campaigns, ICPs, etc.

---

## 5. Code Quality

### Architecture
- **JSON file persistence is a ticking time bomb.** Every request reads the entire file, parses it, modifies it, and writes it back. Two concurrent requests = data loss (race condition). This is fine for a demo but dangerous in production.
- **No request validation middleware.** Express endpoints trust all input blindly.
- **Global `require('node-fetch')` inside functions** (enrichWithApollo, search) — should be at the top level.

### Security
- **API keys stored in plain text JSON on disk.** No encryption.
- **No authentication on any endpoint.** Anyone with the URL can read/write/delete all data.
- **No CSRF protection.**
- **No rate limiting.**
- **XSS:** The `esc()` function is used consistently, which is good. But `detailField` passes raw HTML for status badges without escaping the status value itself — a stored XSS vector if status is user-controlled (it is via API).

### Bugs
- **`closeDetail` is referenced before definition** in the `window.ProspectHub` object (line with `closeDetail,`). It works because of hoisting, but it's fragile.
- **ICP color swatch selection** uses `this.dataset.sel='1'` but this attribute is never read — the selected color is determined by the `.selected` class. Dead code.
- **`rescoreProspects` is called on ICP create/update but not on prospect update.** If you change a prospect's industry, their ICP score doesn't update until the next ICP edit.
- **The `uid()` function can generate collisions** for rapid sequential calls (same `Date.now()` + short random suffix).

### Anti-patterns
- **Entire SPA in one file (app.js, ~500 lines).** No modules, no components. Will become unmaintainable.
- **Global state mutation everywhere.** `state.prospects = ...` scattered across many functions.
- **HTML strings built via template literals.** XSS-prone and hard to maintain. Should use a lightweight template library or at minimum a DOM builder.
- **`onclick` handlers in HTML strings** referencing global objects (`ProspectHub`, `ICPHub`, etc.). Fragile coupling.

---

## 6. BOOTSTRAP.md Quality

**Verdict: Good structure, but entirely dependent on AI chat. Zero UI support.**

The 8-step flow is well-sequenced:
1. Business context → 2. Market → 3. ICPs → 4. API keys → 5. Import → 6. Enrich → 7. Templates → 8. Campaign

**Problems:**
- **If the user doesn't chat with the AI, none of this happens.** The dashboard gives zero indication that there's an onboarding flow.
- **Step 4 (API keys) is a hard blocker.** If the user doesn't have an Apollo key, steps 5-6 are crippled (search doesn't work, enrichment is fake). No guidance on getting a key.
- **Too linear.** What if the user just wants to import a CSV and enrich? They shouldn't have to define ICPs and describe their business first.
- **No "skip" options.** Every step is presented as mandatory.
- **The BOOTSTRAP.md should be deleted after first run** per AGENTS.md instructions, but the onboarding flow it describes should be persistent in SKILL.md (which it is — duplicated). The BOOTSTRAP.md is essentially redundant with SKILL.md's "Onboarding Flow" section.

---

## 7. SKILL.md Quality

**Verdict: Solid reference doc. Good sales methodology. Missing critical context.**

**Strengths:**
- Complete API reference with all endpoints and payloads
- ICP building methodology is genuinely useful
- Cold email frameworks (AIDA, PAS, BAB) are well-explained
- Campaign sequencing best practices are practical
- Enrichment waterfall strategy is clear

**Weaknesses:**
- **Doesn't mention that 3 of 4 enrichment providers are fake.** The AI will confidently suggest configuring ContactOut/RocketReach/Hunter when they do nothing.
- **Doesn't mention that campaigns can't send email.** The AI will help users build campaigns that are non-functional.
- **No error handling guidance.** What should the AI do when Apollo returns an error? When enrichment fails?
- **No guidance on prospect volume.** How many prospects can the JSON backend handle before it falls over? (Answer: probably a few thousand.)
- **Missing `POST /api/search` UI trigger.** The AI knows the endpoint exists but can't tell users how to access it from the dashboard (because there's no UI for it).
- **No mention of the dashboard URL.** Users need to know where to find the web UI.

---

## 8. Specific Improvements (Ranked by Impact)

### 🔴 Critical (blocks first value)

1. **Add a first-run welcome/setup wizard in the UI.** When `prospects.json` doesn't exist or is empty AND no ICPs exist, show a guided setup overlay: "Welcome! Let's get started" → Import CSV → Define ICP → Enrich. This alone could cut TTFV from 20 minutes to 3 minutes.

2. **Add a prospect search UI.** There's an Apollo search API but no frontend for it. Add a "Search Prospects" button/modal where users can search by title + company + location and add results directly to their list. This is the fastest path to first value for users without a CSV.

3. **Add sample/demo data option.** "Load 25 sample prospects to explore the platform" button on first run. Lets users see the UI working immediately, then replace with real data.

4. **Fix the `api()` helper to handle errors.** Check `r.ok`, parse error responses, show toast on failure. Every API call should be wrapped in try/catch with user-visible error feedback.

### 🟠 High Impact

5. **Add prospect-to-campaign assignment.** Add a "Add to Campaign" bulk action in the prospects table. Without this, campaigns are completely disconnected from prospects.

6. **Remove or clearly label fake enrichment providers.** Either implement ContactOut/RocketReach/Hunter for real, or remove them from the UI and SKILL.md. Showing mock data as real enrichment results is actively harmful — users will make decisions based on fake phone numbers.

7. **Add empty-state CTAs to dashboard.** Instead of "Total Prospects: 0", show "No prospects yet → Import CSV / Search Apollo / Add manually" with action buttons.

8. **Add a prospect search bar to the dashboard** (not just the prospects table). Let users search Apollo right from the landing page.

9. **Make inline editing discoverable.** Add a subtle pencil icon on hover, or show "double-click to edit" tooltip on first visit.

10. **Add pagination to prospects table.** Load 50 at a time with next/prev. The API supports it already.

### 🟡 Medium Impact

11. **Add prospect deduplication** on import (match by email). Show "X duplicates skipped" in the import result.

12. **Add template picker to campaign step creation.** When adding a step, let users select from their template library instead of writing from scratch.

13. **Add Apollo API key validation.** When saving settings, make a test API call and show green checkmark or red X.

14. **Add loading skeletons/spinners** for page transitions and API calls.

15. **Fix CSV preview** to use proper CSV parsing (the server already has `csv-parse` — use it client-side too, or preview server-side).

16. **Add keyboard shortcuts.** `Ctrl+K` for search, `Esc` for modal close, `Enter` to confirm.

17. **Show ICP score breakdown** in the detail sidebar — which criteria matched and which didn't.

### 🟢 Lower Impact (polish)

18. **Add authentication.** Even basic token auth would prevent anyone with the URL from accessing all data.

19. **Fix race conditions in JSON persistence.** Use file locking or switch to SQLite.

20. **Add undo for delete operations** (soft delete with 30-second undo toast).

21. **Make the status field an enum** with server-side validation.

22. **Add a "Getting Started" section to SKILL.md** that honestly describes what's implemented vs. stubbed.

23. **Remove BOOTSTRAP.md redundancy** — the onboarding flow is already in SKILL.md. BOOTSTRAP.md should just say "Read SKILL.md, start onboarding conversation."

24. **Add bulk ICP assignment** from the prospects table.

25. **Add a "last enriched" timestamp column** to the prospects table so users know which records are stale.

---

## Summary

The app has a **solid foundation** — the UI is polished, the data model is reasonable, and the Clay-style enrichment table is genuinely well-done. The SKILL.md gives the AI agent good sales methodology to work with.

**The core problem is that the app assumes AI-mediated interaction for everything meaningful**, but the dashboard itself provides zero guidance. A user who opens the URL without chatting with the AI will bounce immediately.

**The second problem is feature honesty.** Three of four enrichment providers are fake. Campaigns can't send email. There's no prospect search UI despite the API existing. Users will hit dead ends quickly.

**Top 3 changes for maximum TTFV improvement:**
1. First-run setup wizard in the UI (not just AI chat)
2. Prospect search UI (Apollo search from the dashboard)
3. Sample data loader (immediate "aha" moment)

These three changes could reduce TTFV from **20+ minutes to under 2 minutes**.
