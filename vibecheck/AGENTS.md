<!-- BEGIN:summon-standard -->
Summon standard: this company must pass the six readiness gates in `summon.company/SUMMON_COMPANY_STANDARD.md` (Outcome, Evidence, Workspace, Organization, Skills, Runtime). Read `NORTH_STAR.md`, `EVIDENCE.md`, `company/ORGANIZATION.md`.
<!-- END:summon-standard -->

<!-- BEGIN:grok-chat-continuation -->
Grok chat continuation: read `GROK_CONTINUE_FROM_CLAUDE.md` and/or `GROK_CONTINUE_FROM_CODEX.md` when resuming in Grok. Refresh with `node .grok/sync-to-grok.js` from Aether root.
<!-- END:grok-chat-continuation -->
<!-- BEGIN:claude-codex-sync -->
# Claude/Codex sync

Before making changes, read `CLAUDE.md` in this project if it exists. It is the live handoff from Claude Code and the source of truth for current project progress, design decisions, constraints, and open tasks. Keep future progress updates there so Claude and Codex stay in sync.

If this file contains older project context that conflicts with `CLAUDE.md`, prefer `CLAUDE.md` unless the user says otherwise.
<!-- END:claude-codex-sync -->

<!-- BEGIN:imported-claude-context -->
# Imported Claude context

Copied from `CLAUDE.md` on 2026-07-08 so Codex starts with the same project context Claude Code used. Keep `CLAUDE.md` as the source of truth and refresh this block after meaningful Claude-side progress.

<!-- SOURCE: CLAUDE.md -->

# CLAUDE.md - vibecheck.style

Context for Claude Code, Codex, and humans working in this folder.

## What this is

This handoff was generated on 2026-07-07 so every top-level Codex project under
`C:\Users\adamp\OneDrive\Aether` has both `CLAUDE.md` and `AGENTS.md`.

No richer Claude handoff was found here during the workspace sync. Treat this file
as a starting point, then inspect the actual code and docs before making changes.

## Detected project facts

- Workspace folder: `vibecheck.style`
- Git repository: yes
- `package.json`: yes
- Detected stack: package "vibecheck-style"
- Existing context-like files: README.md, readme.md
- Notable top-level files: .env, .gitignore, package-lock.json, package.json, README.md, server.js, vercel.json

## How to keep this useful

- If you learn the product purpose, stack, run commands, deployment target, or open
  tasks, update this file.
- Keep `AGENTS.md` synchronized with this file so Codex sessions have the same
  context inline.
- Prefer concrete project facts over generic instructions.

## Imported existing context

Source: `README.md`

```markdown
# Vibecheck.me

A full-stack React + Node.js app that creates ultimate playlists from your Spotify top tracks across different time periods.

## Features

- Modern React frontend with TypeScript
- Beautiful UI with Tailwind CSS and shadcn/ui components
- Login with Spotify OAuth
- Fetch top tracks from 3 time ranges (short_term, medium_term, long_term)
- Merge tracks into one "ultimate playlist"
- Create or update playlist on your Spotify account
- Personal profile page with embedded Spotify player
- Responsive design for all devices

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for fast development
- Tailwind CSS for styling
- shadcn/ui for UI components
- React Router for navigation
- Axios for API calls

### Backend
- Node.js with Express
- Express Session for authentication
- Spotify Web API integration
- CORS enabled for cross-origin requests

## Setup Instructions

### 1. Install Dependencies

Install root dependencies:
```bash
npm install
```

Install client dependencies:
```bash
cd client
npm install
cd ..
```

### 2. Set up Spotify App
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/)
2. Create a new app
3. Note your Client ID and Client Secret
4. Add `http://localhost:3000/api/callback` to your app's redirect URIs

### 3. Environment Variables
1. Copy `config.example.env` to `.env`
2. Fill in your Spotify credentials:
```
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/callback
SESSION_SECRET=your_session_secret_here
PORT=3000
```

### 4. Run the App

**Development mode (both frontend and backend):**
```bash
npm run dev
```

This will start:
- Express API server on `http://localhost:3000`
- React dev server on `http://localhost:5173`

**Individual components:**
```bash
# Backend only
npm run server

# Frontend only (from client directory)
cd client && npm run dev
```

**Production build:**
```bash
npm run build
npm start
```

## How It Works

1. **Login**: Click "Login with Spotify" to authenticate via OAuth
2. **Data Collection**: The app fetches your top tracks from:
   - Short term (last 4 weeks)
   - Medium term (last 6 months)
   - Long term (all time)
3. **Playlist Creation**: Creates or updates a playlist called "Vibecheck.me - Ultimate Playlist"
4. **Profile Page**: View your profile at `/user/:id` with the embedded playlist

## API Endpoints

- `GET /api/user` - Get current authenticated user
- `GET /api/user/:id` - Get user by ID
- `GET /api/login` - Get Spotify authorization URL
- `GET /api/callback` - Handle OAuth callback
- `POST /api/logout` - Logout user

## Project Structure

```
vibecheck/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── lib/            # Utility functions
│   │   └── ...
│   ├── package.json
│   └── ...
├── server.js              # Express API server
├── package.json           # Root package.json
└── README.md
```

## Dependencies

### Root
- `express` - Web framework
- `express-session` - Session management
- `cors` - Cross-origin resource sharing
- `dotenv` - Environment variables
- `spotify-web-api-node` - Spotify API client
- `concurrently` - Run multiple commands

### Client
- `react` & `react-dom` - React framework
- `typescript` - Type safety
- `vite` - Build tool
- `tailwindcss` - CSS framework
- `react-router-dom` - Client-side routing
- `axios` - HTTP client
- `lucide-react` - Icons
- `clsx` & `tailwind-merge` - Utility classes

## Notes

- This uses in-memory storage (no database) for MVP
- User data is stored in sessions and server memory
- Frontend uses modern React patterns with TypeScript
- Tailwind CSS with shadcn/ui for beautiful, accessible components
- Private playlists are created by default
- CORS is configured for local development

## Development

The app is set up for easy development with:
- Hot reload for both frontend and backend
- TypeScript for type safety
- ESLint for code quality
- Concurrent development servers
- API proxy configuration in Vite// Force build Sat Jul  5 20:43:59 +08 2025
# Deploy Sat Jul  5 20:47:04 +08 2025
```
<!-- END:imported-claude-context -->
