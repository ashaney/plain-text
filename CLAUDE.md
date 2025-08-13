# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Running the Application
```bash
# Using Bun (preferred per user's global instructions)
bun run dev:bun      # Development with hot reload
bun run start:bun    # Production

# Using Node.js
npm run dev          # Development with nodemon
npm start            # Production

# Using Docker
docker-compose up -d # Production with Docker Compose
```

### Environment Setup
- Copy `.env.example` to `.env` and set credentials
- Required environment variables:
  - `AUTH_USER` - Admin username
  - `AUTH_PASS` - Admin password  
  - `PUBLIC_URL` - Optional custom share URL (e.g., for Tailscale/ngrok)
  - `DB_PATH` - SQLite database location (default: `./pastes.db`)

## Architecture Overview

### Core Application
- **server-better-sqlite.js**: Main Express server using better-sqlite3 for database
  - Admin routes protected with basic auth (`/admin`, `/api/*`)
  - Public read-only routes for paste viewing (`/:id`, `/:id/raw`)
  - SQLite database with single `pastes` table
  
### Key Components
- **Database**: SQLite via better-sqlite3, storing pastes with id, content, format, timestamps
- **Authentication**: express-basic-auth for admin panel protection
- **Frontend**: Vanilla JavaScript admin interface in `views/admin.html`
- **Markdown Rendering**: marked library for markdown-to-HTML conversion

### API Structure
- Admin endpoints (auth required):
  - `GET /api/pastes` - List all pastes
  - `GET /api/pastes/:id` - Get paste details
  - `POST /api/pastes` - Create new paste
  - `PUT /api/pastes/:id` - Update paste
  - `DELETE /api/pastes/:id` - Delete paste
  
- Public endpoints:
  - `GET /:id` - View paste (HTML for markdown, text for plain)
  - `GET /:id/raw` - Always returns plain text

### Deployment
- Docker container with Node.js Alpine image
- Volume mount for persistent database storage (`./data`)
- Works with tunneling services (ngrok, Cloudflare Tunnel, Tailscale Funnel)