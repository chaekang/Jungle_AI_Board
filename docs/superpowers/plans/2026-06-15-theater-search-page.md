# Theater Search Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public CSR page at `/theaters/:theaterId` where users can browse and search reviews scoped to one theater.

**Architecture:** Add a dedicated page component that reads the theater ID from React Router, loads theater metadata, and reuses the existing seat-review API hook, review cards, detail modal, comments, and seat-map component. Extend the review search query builder with an optional fixed theater ID instead of duplicating query construction.

**Tech Stack:** React 19, React Router 7, Vite, TypeScript, project CSS files, existing review API helpers.

---

### Task 1: Search Query Support

**Files:**
- Modify: `apps/web-react/src/features/reviews/review-search-query.ts`
- Modify: `apps/web-react/src/features/reviews/review-search-query.test.ts`

- [ ] **Step 1: Extend search state with fixed theater ID**

Add an optional `fixedTheaterId?: string` field to `ReviewBoardSearchState`.

- [ ] **Step 2: Make the query prefer fixed theater ID**

When `fixedTheaterId` exists, set `query.theaterId` and do not set theater text filters from theater mode.

- [ ] **Step 3: Add a query test**

Add a test proving that a theater page state creates `/seat-reviews/search?...&theaterId=theater-1...` and does not send `theater=...`.

### Task 2: Theater Page

**Files:**
- Create: `apps/web-react/src/features/reviews/TheaterReviewsPage.tsx`
- Create: `apps/web-react/src/features/reviews/styles/theater-reviews-page.css`

- [ ] **Step 1: Create the page shell**

Read `theaterId` from `useParams`, load theaters with `getTheaters`, and show loading, not-found, and API error states.

- [ ] **Step 2: Add scoped review search**

Use `useSeatReviews` with `theaterId`, `q`, seat filters, tag filter, and sort. Keep pagination local to the page.

- [ ] **Step 3: Add view controls**

Show board view by default and seat-map view when `theaterSeatMapNames` supports the selected theater name.

- [ ] **Step 4: Reuse review detail behavior**

Use `SeatReviewCard`, `ReviewComments`, edit/delete handlers, and auth handling consistent with `ReviewBoardPage`.

### Task 3: Routing And Entry Points

**Files:**
- Modify: `apps/web-react/src/App.tsx`
- Modify: `apps/web-react/src/features/reviews/components/SeatReviewCard.tsx`

- [ ] **Step 1: Add route**

Add lazy route `/theaters/:theaterId` pointing to `TheaterReviewsPage`.

- [ ] **Step 2: Link theater names**

Allow `SeatReviewCard` to receive an optional theater link handler. Use it on the board so clicking a theater name opens the theater page without opening the review modal.

### Task 4: Verification

**Files:**
- Use existing tests and build scripts.

- [ ] **Step 1: Run query tests**

Run the web review search query test.

- [ ] **Step 2: Run web build**

Run `npm.cmd run web:build`.

- [ ] **Step 3: Inspect git diff**

Confirm changes are scoped to the theater page feature and plan.
