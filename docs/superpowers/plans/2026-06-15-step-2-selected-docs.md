# Step 2 selected docs implementation plan

## Scope

Implement the requested Step 2 documents only:

- `docs/step 2/001_authentication_security_upgrade.md`
- `docs/step 2/004_advanced_comments_and_interactions.md`
- `docs/step 2/007_admin_moderation_and_operations.md`
- `docs/step 2/008_rag_quality_and_evaluation.md`
- `docs/step 2/011_observability_and_test_automation.md`

If a requested item turns out to require a different Step 2 document, stop and ask before expanding scope.

## Current constraints

- Work directly on `main`; do not create a branch.
- Preserve existing uncommitted frontend changes for the theater search page and review docs.
- Follow TDD for production code changes: write a failing or targeted regression test before implementation where practical.
- Keep the current visual design and do not introduce Tailwind/Bootstrap.

## Implementation checkpoints

1. Authentication security
   - Add server-side auth sessions and refresh-token rotation.
   - Move browser auth from localStorage access tokens to httpOnly cookies.
   - Add logout invalidation and cookie clearing.
   - Add password reset token flow as the required account-security mail-adjacent feature.
   - Configure CORS for credentialed requests and document the CSRF choice in code/docs.

2. Comments and interactions
   - Add one-level replies through `parentId`.
   - Add comment likes.
   - Parse and expose mentions from comment content.
   - Keep response shapes explicit and frontend-friendly.

3. Admin moderation and operations
   - Add admin role checks.
   - Add report creation and admin review APIs.
   - Add hide/restore/force-delete moderation flows.
   - Add basic audit log entries for sensitive admin actions.

4. RAG quality and evaluation
   - Improve chunk metadata and regeneration/evaluation scripts.
   - Add representative evaluation questions.
   - Persist or collect RAG result logs for later quality review.

5. Observability and tests
   - Add request IDs and structured request/error logging.
   - Add backend integration-style tests for major flows.
   - Add frontend integration/E2E coverage where the repo tooling supports it.
   - Verify with build/test commands and record any existing unrelated failures.

## First execution slice

Start with 001 because later admin/comment actions depend on reliable auth identity:

1. Add focused tests for auth cookie extraction, session token parsing, and refresh/logout behavior.
2. Extend Prisma schema and migration with auth session and password reset token models.
3. Generate Prisma client.
4. Implement auth cookie/session helpers, service methods, and controller endpoints.
5. Update frontend API/auth calls to use `credentials: "include"` and remove auth-token localStorage usage.
6. Run backend auth tests and frontend affected tests/build.
