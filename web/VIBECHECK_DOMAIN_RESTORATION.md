# Restoration record: vibecheck.style

October 13, 2026.

- Repository: https://github.com/adamtpang/strummer.fun
- Production branch: main
- Vercel project: prj_Ym97xlAIIQl0q8FobBjWdIZPJncH
- READY deployment: dpl_9Emyqc6x2dDQSEjYDm15QTxPVTV8
- Verified production revision: 6b55a82e0d45b7385b2635712008418ea430b9cf
- Status: Current integration available at https://strummer.fun/vibe/. Custom domain not attached: external registration/control not yet confirmed.

No purchases, renewals, paid services or database creation. Original archives and unrelated user changes preserved. This record is outside the public build allowlist.

## Vibe polish - 2026-10-14

Changes are local and uncommitted. No production deployment or domain purchase
was authorized in this pass. The deployed application is `web/vibe/`, not the
separate historical `vibecheck/client/` directory.

- Simplified the first screen, exposed invite-only access before sign-in, and
  linked the existing no-login playlist card maker.
- Added bounded OAuth state validation, prevented duplicate callback exchange
  in React Strict Mode, and recovered malformed stored sessions.
- Sign-out and authentication failures clear only Spotify session keys, not
  chord/songbook data or story preferences.
- Story renders use independent canvases and selection-keyed PNG/File outputs.
  Private profiles may share images without publishing; their private profile
  URL is omitted from the image and share text. Publishing remains explicit.
- Corrected featured-song numbering, long-text wrapping, narrow-screen overflow,
  optional preference storage, image-load timeout, and object URL cleanup.
- Fixed `/vibe/` favicon paths and added the canonical page URL.

Verification: 79 web Node tests passed, Vibe lint and TypeScript checks passed,
and its production build passed into `dist-vibe-polish/` without replacing the
existing build. Focused isolated Helium checks exercised 1440px, 390px and 320px
layouts, all four looks, selected artwork, a real 1080x1920 PNG File, privacy,
keyboard focus, Escape, and saved layout preferences. Native sharing was mocked
in the local test harness; physical Instagram delivery and authenticated Spotify
consent were not verified. Test fixtures are not part of the production build.

Run browser checks with Vite on port 4392:

```powershell
Get-Content web/test/vibe-browser-check.py -Raw | helium-agent --profile strummer-vibe run
```

Vercel's read-only lookup on October 13 reported `vibecheck.style` available:
purchasePrice 12.99 for one year, renewalPrice 34.51. Availability and pricing
must be checked again before any separately approved purchase. No DNS or
Spotify redirect settings were changed.
