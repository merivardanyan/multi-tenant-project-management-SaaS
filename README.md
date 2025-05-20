# projectflow

kanban-style project management for teams. each team gets a workspace with members, projects, and boards.

## stack

- **backend**: node/express, mysql 8, socket.io, redis (optional)
- **frontend**: react 18 + vite, tailwindcss, @tanstack/react-query, zustand
- **auth**: jwt with refresh token rotation, httponly cookies
- **payments**: stripe (subscription)
- **uploads**: cloudinary (avatars)
- **docs**: swagger at /api/docs

## getting started

```bash
# backend
cd server
npm install
cp .env.example .env
# fill in .env (mysql creds, jwt secrets, stripe keys, etc.)
# run schema.sql against your mysql instance
npm run dev
```

```bash
# frontend
cd client
npm install
npm run dev
```

## notes

- free plan: 1 active project per workspace
- socket.io rooms are scoped per-project so updates don't bleed across projects
- redis is optional — if it's not running the server falls back to an in-memory map
- time tracking and gantt chart are stubbed out, not implemented
- google/github oauth is configured but not wired up yet
