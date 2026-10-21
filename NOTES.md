# Pulse assessment notes

## Phase 1 — Make it run

- Fixed the chat data-channel type mismatch, queued ICE candidate ordering, stale
  connection cleanup, duplicate request polling, and API failures that were being
  ignored by the client.
- Heartbeats now refresh only the authenticated session; stale sessions and
  undelivered signals are reaped. Video signaling and connection cleanup track
  the specific peer.
- Assumption: a tab is one short-lived session. Closing it removes its presence;
  the stale timeout is the fallback when the browser cannot send a leave request.
- Two-session API smoke tests passed join, discovery, authentication, privacy
  offset, request/accept, signaling, end, and busy-state cleanup. A manual
  two-browser WebRTC/camera test remains.

## Phase 2 — Make it good

- Reworked the entry screen, map overlays, chat panel, typography, colors, and
  motion into a calm, dark, map-first experience; added reduced-motion support
  and clearer location/privacy status.
- Busy peers are visibly unavailable, and connection errors are surfaced rather
  than silently swallowed.

## Phase 3 — Make it secure

- Highest risk found: API callers could impersonate arbitrary session IDs,
  inspect another inbox, and change other users' connection state. Added
  server-issued random bearer tokens (stored as SHA-256 hashes), per-session
  authorization, UUID validation, and active-peer checks.
- Fixed the global-heartbeat bug that kept every presence alive, prevented
  unrelated declines/ends from clearing a user's busy state, and bounded
  request bodies and signaling payloads.
- The schema migration clears only legacy transient presence/signaling rows so
  sessions created before bearer tokens are introduced cannot be claimed.
- Upgraded Next.js to 16.4.2 and Prisma packages to 7.10.1; `npm audit
  --omit=dev` reports no production vulnerabilities. The full audit still
  reports five high-severity findings in the ESLint toolchain's transitive
  `braces` dependency. The available forced fix downgrades the Next ESLint
  config to v14, so it was not applied.
- Trade-off: anonymous access remains open by design. Production deployment
  should add a shared, distributed rate limit; in-memory limits are unreliable
  on serverless instances.

## Phase 4 — Make it better

- Added a peer-to-peer conversation Spark deck for low-pressure openers and a
  one-tap “Leave & block” action. Blocks last for the current tab session only;
  no report or block history is stored.
- Next step: add a privacy-preserving, server-backed abuse-report workflow and
  decide how to moderate it without retaining message content.

## Delivery checks

- `npm install`, `npm run lint`, and `npm run build` completed.
- The entry screen and Mapbox map loaded through the local development server.
- `npx prisma db push` completed against a local Prisma Postgres dev server.
  The ignored `.env` points to this local instance; use a hosted PostgreSQL URL
  and configure the deployment's environment variables before publishing.
- A Mapbox token is present locally; `.env` is intentionally not included in
  version control. No Vercel deployment was created.
