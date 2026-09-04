# Suno developer API: partner application draft

Status: **not submitted.** Adam submits this himself. Claude drafted it.

Suno opened an exploratory developer-API partner program in July 2026, curated,
via an intake form. There is no self-serve key, no public docs, no pricing, and
no published timeline. The form is the only path.

What they said they want: applications that unlock experiences generative music
makes possible for the first time.

## Before submitting

- [ ] Find the current intake form link on suno.com (it has moved before)
- [ ] Deploy /dj so the application can point at a live URL, not a description
- [ ] Decide which email to use (the Pacifica identity, or adamtpang@gmail.com)
- [ ] Paste the answers below, edit in your own voice, submit

## Copy-ready answers

### What are you building?

Strummer DJ, a listening station where the listener's decisions steer what gets
generated next.

You do not prompt it. You listen, and you keep, skip, replay, or send a song
back for iteration. Each decision is scored against seven musical traits (hook,
groove, harmony, vocal, lyrics, texture, surprise) and compounds into a taste
profile. That profile becomes the steering prompt for the next generation, so
the station converges on what a specific person actually likes rather than on
what they were able to describe in a text box.

It is built and running today at strummer.fun/dj, playing my own released
catalog through SoundCloud embeds. Every part works except generation, which is
the part that needs you.

### Why does this need generative music specifically?

A station over a fixed catalog eventually runs out. Recommendation systems solve
that by finding you someone else's song. This solves it by making the next one.

The interesting consequence is that the taste profile stops being an analytics
artifact and becomes a production instrument. After a few hundred decisions it
describes a listener's ear precisely enough to author music, and the listener
never wrote a prompt. That is not a better search over a catalog. It is a
catalog that did not exist before the listening happened, and it is not possible
without generation in the loop.

### What is the integration?

One server-side endpoint. The browser never sees a credential.

`POST /api/dj/generations` takes `{ requestId, prompt }`, submits and polls one
generation, and returns `{ candidates: [{ title, url, prompt, createdAt }] }`.
The client requests a refill when two playable songs remain and pauses cleanly
on provider errors without losing the queue or the taste profile.

The client contract is already written and shipped. The adapter is the only
missing piece, roughly a day of work once there is a key.

### Volume

Small and honest. One user today, me. Expected load in the first months is
double-digit generations per day, not thousands. I am applying because the
product does not work without generation, not because I have traffic to bring.

### Anything else?

Two commitments in the product already, in case they matter to you.

No generated song is marked kept or certified without an explicit human action.
The station will not silently accumulate a catalog nobody chose.

The taste profile export contains only the listener's own decisions and their
own written notes. No Spotify track names, artist names, IDs, or listening
history are ever included in what gets sent to a generation provider. That
exclusion is enforced in code, not policy.

## If they say no, or say nothing

The station keeps working on the catalog we control. That was the point of
pointing it at src/content/songs rather than waiting: the useful half ships
either way, and the refill path stays dead code until there is a real endpoint
behind it.

Do not route around this with a session-cookie wrapper. The unofficial Suno API
proxies break their terms and would cost the account, which is a bad trade for a
feature we can live without.
