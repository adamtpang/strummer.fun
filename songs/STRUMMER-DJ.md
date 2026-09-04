# Strummer DJ

Strummer DJ is a listener-steered station for original songs. The first product surface is an installable web app at `/dj/`. It stores the candidate queue and explicit feedback locally, turns each decision into a reusable steering prompt, and exports the resulting profile as `taste.md`.

## Current product boundary

- Suno song URLs are added by the listener and played through Suno's supported embed page.
- Likes, dislikes, replays, iteration directions, kept songs, and certified bangers persist in the browser.
- The Playlist Lab can pass listener-authored musical observations into the DJ. Spotify track names, artists, IDs, and listening history are excluded from that payload.
- `taste.md` contains only explicit listener feedback and listener-authored observations.

## Generation provider contract

Infinite generation requires a server-side provider adapter. The browser must never receive a provider secret. A `POST /api/dj/generations` endpoint should accept the steering request, submit and poll an original-song generation through an authorized provider, then return completed candidates in Strummer's normalized shape.

Set `PUBLIC_STRUMMER_GENERATION_ENDPOINT` to a same-origin endpoint to enable automatic refill. The current client sends `{ requestId, prompt }` when fewer than three playable candidates remain and accepts `{ candidates: [{ title, url, prompt, createdAt }] }`. It rejects non-Suno URLs, duplicate song IDs, cross-origin endpoint configuration, and malformed provider output.

The queue should request another candidate when two playable songs remain. Provider errors must pause refilling without losing the current queue or taste profile. No generated song should be marked kept or certified without an explicit listener action.

## Account and mobile path

1. Add Strummer authentication and sync the local DJ state plus `taste.md` data to a per-user record.
2. Implement the authorized generation adapter and background job status flow.
3. Share the pure TypeScript taste and decision logic with a React Native client.
4. Add background audio, lock-screen controls, offline queueing, and native sign-in.
5. Complete App Store privacy disclosures, TestFlight signing, and internal testing before public beta.

Suno credentials, provider terms, an Apple Developer account, signing, and TestFlight submission are owner-controlled dependencies. The web app remains useful without them.
