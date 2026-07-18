# Getting friends into vibecheck — the Spotify access problem

**Why friends can't check their vibe:** the Spotify app is in **Development Mode**,
which hard-caps usage to **25 users you manually allowlist**. Anyone else gets a
403 on `/v1/me` after login (the app now shows them a clear "invite-only" message
instead of a silent bounce). There is **no code fix** for this — it's a Spotify
platform policy. Two moves solve it:

## A. Right now: add friends as test users (instant, up to 25)

1. developer.spotify.com/dashboard → the vibecheck app → **User Management**.
2. Add each friend's **name + the email on their Spotify account**.
3. They can check their vibe immediately. Cap is 25 total.

## B. The real unlock: apply for Extended Quota Mode (removes the cap)

Dashboard → the app → **Settings** → request/extended-quota. Approval means
*anyone* can use it. Spotify reviews these; keep it clean. What they ask for and
the answers for vibecheck:

- **What does your app do?** "vibecheck.style shows a user a shareable 'vibe card'
  summarizing their own Spotify listening — top tracks, top artists, top genres,
  and a computed taste profile. Optionally saves a private playlist of their top
  tracks. A public directory lets users compare taste."
- **Which Spotify data / scopes and why** (we slimmed these to only what's used):
  - `user-top-read` — the core: top tracks & artists for the vibe.
  - `user-read-private` — display name + avatar on the card.
  - `user-read-recently-played`, `user-read-currently-playing`,
    `user-read-playback-state` — the optional "now playing" + "recently played"
    strips on the owner's own card.
  - `user-library-read` — the "saved songs / albums" counts.
  - `playlist-modify-private` + `ugc-image-upload` — the opt-in "Save to Spotify"
    playlist and its cover. (We dropped `playlist-modify-public` — the app only
    creates private playlists.)
- **Commercial?** No.
- **Privacy Policy URL:** https://strummer.fun/vibe/privacy
- **Terms URL:** https://strummer.fun/vibe/terms
- **Requirement checklist Spotify enforces:**
  - Show the Spotify logo + "powered by Spotify" attribution near the data. ⚠️
    verify this is present on the card before submitting.
  - Don't use Spotify data to train ML, and don't replicate Spotify's own UI.
    vibecheck is fine on both.
  - No misleading branding — the app is "vibecheck", not "Spotify …".

**Redirect URI to allowlist** (dashboard → Settings → Redirect URIs), matching the
new home under strummer:

```
https://strummer.fun/vibe
```

(Add the Vercel preview URL too if you want previews to log in, e.g.
`https://<preview>.vercel.app/vibe`.)

## Realistic expectations

- Test users (A) is guaranteed and instant — do it today for the friends who asked.
- Extended Quota (B) can take days to weeks and is occasionally rejected; the slim
  scopes + real privacy/terms pages give the best shot. If rejected, the app still
  works fine in invite-only mode.
