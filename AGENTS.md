# Project Rules

## Product intent (summary)
- Single-page chat product with a blank white canvas aesthetic.
- Left history sidebar, central chat canvas, bottom input bar.
- Dual response comparisons exist only as a future concept.
- Subscription and usage limits are enforced later.
- Keep foundations minimal and production-shaped.

## Non-negotiables
- Single page UI only (root route `/`).
- Never show provider names or model/vendor identifiers.
- Duel only on first message per thread (future behavior).
- After a vote, lock provider per thread (future behavior).
- Verified mode consumes verified quota; exploration consumes normal quota (future behavior).
- Keep everything minimal; avoid adding pages.

## Engineering rules
- Prefer server-side routes for sensitive operations.
- Use Prisma for all database access.
- No hardcoded secrets.
- Always add acceptance criteria for each future task.
- Keep changes localized; do not refactor unrelated files.
