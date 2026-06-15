# Theater Search Page Design

## Goal

Add a public theater-specific review search page so users can open one theater directly, search reviews for that theater, and refine results by seat, rating, tag, and sort options.

The page should make theater browsing feel intentional instead of forcing every user through the global review board first.

## Route

Use a client-rendered route first:

```text
/theaters/:theaterId
```

`theaterId` is the safest first version because the backend already exposes theater IDs and review search already supports theater filtering. A slug route can be added later if the product needs prettier URLs.

## Rendering Strategy

Keep this page CSR for now.

SSR is not required for the first version because the current app is a Vite SPA, and this feature can reuse existing client-side data loading. Theater pages are good future SSR or SSG candidates if search traffic, social previews, or public sharing become important.

## User Experience

The page opens with the selected theater fixed as the main context.

It should include:

- Theater header with the theater name.
- Review search input scoped to the selected theater.
- Seat filters such as floor, section, row, and seat number.
- Rating and tag filters already supported by review search.
- Sort controls using existing review sort options.
- Theater seat map when the selected theater has supported seat-map data.
- Review list using the existing public review card/detail behavior.

The page should not feel like a separate product surface. It should look like the current review board, just pre-scoped to one theater.

## Architecture

Add a dedicated theater page component that reads `theaterId` from React Router.

Reuse existing review API helpers and query builders where possible:

- Load theater metadata from `/theaters`.
- Find the selected theater by route param.
- Fetch reviews through existing seat review search/list APIs with the theater fixed in the query.
- Reuse existing review list, filters, and detail modal components where the current boundaries allow it.

If `ReviewBoardPage` has too much tightly coupled state to reuse cleanly, extract only the shared review search/list pieces needed by both pages. Avoid broad refactors outside the review browsing surface.

## Error Handling

Handle three common states:

- Loading: show the existing page-level loading treatment.
- Not found: show a simple empty state when `theaterId` does not match a known theater.
- API failure: show the existing review board error style and allow retry through normal filter/search interactions.

## Navigation

Add links into the theater page from places where theater names already appear, such as review cards or theater filter choices, if those components are easy to update without changing unrelated behavior.

The global review board should remain available at `/`.

## Testing

Add focused frontend tests for:

- Theater route renders for a known theater ID.
- Review search query includes the selected theater ID.
- Unknown theater ID shows a not-found/empty state.

Run the existing web build after implementation. If the page touches shared review query helpers, run their current tests as well.

## Out of Scope

This first version will not add:

- SSR or SSG.
- A new UI framework such as Tailwind or Bootstrap.
- Theater slug generation.
- Backend schema changes.
- New public review detail route.

Those are useful later, but they are not needed to make theater-specific search valuable now.
