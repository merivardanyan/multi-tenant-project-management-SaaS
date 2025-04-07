# projectflow

kanban project management app i've been building. multi-tenant — each team gets their own workspace with members, projects, and a kanban board.

## stack
- **backend**: node/express, mysql 8, socket.io, redis (optional)
- **frontend**: react 18 + vite, tailwindcss, react-query, zustand
- **auth**: jwt with refresh token rotation, httponly cookies
- **payments**: stripe
- **uploads**: cloudinary (avatars only for now)

## dev setup

```bash
cd server && npm install
cp .env.example .env   # fill in your values
# run schema.sql against your mysql db
npm run dev
```

```bash
cd client && npm install && npm run dev
```

## notes
- free plan is limited to 1 active project per workspace
- real-time updates use socket.io rooms scoped to each project
- redis is optional — falls back to an in-memory map if not available
- time tracking and gantt views are stubbed, not implemented
