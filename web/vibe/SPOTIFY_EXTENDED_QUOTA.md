# Spotify access plan for Strummer Vibe

## Current constraint

Strummer Vibe is in Spotify Development Mode. Under Spotify's current policy:

- The app owner must have Spotify Premium.
- Up to five Spotify accounts can be allowlisted in User Management.
- Anyone outside that list will be rejected by Spotify even if the OAuth flow starts.
- The July 2026 increase to 25 client IDs applies to apps per developer account, not users per app.

There is no code change that removes the five-user cap.

## Invite the first testers

1. Open the app in the Spotify Developer Dashboard.
2. Open **User Management**.
3. Add each tester's name and the email attached to their Spotify account.
4. Keep one slot for a clean end-to-end test account when possible.

The production redirect URI must include:

```text
https://strummer.fun/vibe
```

Add a Vercel preview redirect only when that exact preview needs to authenticate.

## Extended quota reality

Spotify's current extended-access criteria are designed for established organizations, not a new consumer prototype. The application must represent a launched service and Spotify currently lists at least 250,000 monthly active users among its requirements. Approval also depends on policy, security, branding, and scope compliance.

For Strummer Vibe, the practical launch path is:

1. Prove the artifact and sharing loop with five invited users.
2. Validate that people publish the card, share it, and drive profile visits.
3. Build a waitlist and a non-Spotify demo mode so growth is not blocked by OAuth.
4. Revisit extended access once the product and organization meet Spotify's published criteria.

## Scopes used

- `user-top-read`: top tracks and artists across Spotify's three windows.
- `user-read-private`: display name and profile image.
- `playlist-read-private`: find a previously created living ult playlist.
- `playlist-modify-private`: create and refresh the private playlist after opt-in.
- `ugc-image-upload`: upload the generated playlist cover.
- `user-read-recently-played`, `user-read-currently-playing`, `user-read-playback-state`: owner-only listening context.
- `user-library-read`: owner-only saved track and album counts.

Do not request `playlist-modify-public`. Strummer Vibe creates a private playlist and profiles are private until their owner publishes them.

## Review checklist

- Privacy policy: `https://strummer.fun/vibe/privacy`
- Terms: `https://strummer.fun/vibe/terms`
- Spotify attribution appears wherever Spotify data or artwork is shown.
- Spotify artwork is not cropped, filtered, or overlaid.
- Spotify data is not used to train machine-learning models.
- Playlist writes and profile publication require explicit user action.

Official references:

- https://developer.spotify.com/documentation/web-api/concepts/quota-modes
- https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates
- https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide
