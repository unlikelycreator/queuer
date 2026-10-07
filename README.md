# ZoopDesk 2.0

Client, project & ticket management for software studios — with a built-in **client portal**,
**date-based project to-dos**, **two-factor authentication**, and a refined **Evergreen** design
in light and dark themes.

```
zoopdesk/
├── backend/           Node.js + Express + MongoDB (Mongoose) REST API
├── frontend/          React + Vite + Tailwind + Radix UI
└── docker-compose.yml MongoDB + API + Nginx, ready for a server
```

## What's new in 2.0

| Area | What changed |
| --- | --- |
| **Design** | New "Evergreen" theme — deep forest sidebar, emerald primary, chartreuse accents. Light, dark, and "follow system" modes (no flash on load). Bricolage Grotesque + Manrope type. Redesigned every screen; fully responsive. |
| **Tickets** | Inbox with status tabs + live counts, quick views (Assigned to me · Unassigned · Awaiting reply · Overdue), filters & sorting kept in the URL, bulk status/priority/assignee changes, and a drag-and-drop **Kanban board**. |
| **Ticket page** | Full page (`/tickets/:id`) instead of a cramped dialog: a clear conversation timeline (client messages, public replies, emailed replies, amber internal notes, status events), a composer with *Reply to client* / *Internal note*, optional email + status change in one send, inline-editable title/description and a properties sidebar. |
| **Client portal** | The project's public link is now a portal at `/portal/:token`: project progress & stats, list/search of requests, new-request form with attachments, and per-ticket pages where the client can reply and **reopen** resolved tickets. Configurable per project (show all tickets vs. only their own, allow replies, welcome message). The old iframe form still works. |
| **Project to-dos** | Day-by-day plan per project: week strip with progress dots, quick add with priority & assignee, carry-over of unfinished items, move/push to another day, link a to-do to a ticket. "My day" widget on the dashboard. |
| **Security** | TOTP 2FA (QR setup, 10 single-use backup codes), forgot / reset password (hashed, 30-min, single-use tokens), password change revokes other sessions, account lockout after repeated failures, rate limits, Helmet headers, safe regex search, HTML-escaped emails, locked-down `/uploads`. |
| **Productivity** | `Ctrl/⌘ + K` command palette (jump to `#42`, any project/client, quick actions), dashboard with 14-day ticket flow, avg. resolution time, team workload and alerts. |
| **Production** | Route-level code splitting, error boundaries, 404 page, health check with DB status, graceful shutdown, compression, Docker + Nginx config, `.env.example` documented. |

## Quick start (local development)

Prerequisites: Node.js 18+ and MongoDB (local or a free Atlas cluster).

```bash
# 1. API
cd backend
cp .env.example .env        # set MONGODB_URI, JWT_SECRET, ENCRYPTION_KEY
npm install
npm run dev                 # http://localhost:5000  (health: /api/health)

# 2. Web app (second terminal)
cd frontend
cp .env.example .env        # VITE_API_URL=http://localhost:5000/api
npm install
npm run dev                 # http://localhost:5173
```

Open http://localhost:5173 → **Create a workspace** (you become the owner) → invite your team from **Team**.

> **Password-reset emails in development:** if no SMTP is configured, the reset email (with its link)
> is printed in the backend console, so you can test the flow without any mail setup.

## Production deployment

### Option A — Docker Compose (recommended)

```bash
cp backend/.env.example backend/.env    # fill in secrets, CLIENT_URL=https://your-domain
docker compose up -d --build            # app on :8080 — put your TLS proxy / load balancer in front
```

Nginx serves the built frontend and proxies `/api` and `/uploads` to the API. MongoDB data and uploads
live in named volumes. To use Atlas instead of the bundled MongoDB, set `MONGODB_URI` in your shell or
`.env` file before `docker compose up`.

### Option B — Node + your own web server

```bash
cd frontend && npm ci && VITE_API_URL=https://api.your-domain.com/api npm run build   # → frontend/dist
cd ../backend && npm ci --omit=dev && NODE_ENV=production node server.js
```

Serve `frontend/dist` with any static host (SPA fallback to `index.html`), or set `SERVE_FRONTEND=true`
to let the API serve it on the same port.

### Production checklist

- `JWT_SECRET` — 32+ random characters. Changing it logs everyone out.
- `ENCRYPTION_KEY` — set it once and keep it. It encrypts saved mailbox passwords and 2FA secrets.
  **Upgrading from 1.x?** It previously fell back to `JWT_SECRET`, so set `ENCRYPTION_KEY` to your
  *current* `JWT_SECRET` value before you rotate `JWT_SECRET`, otherwise saved mailbox passwords can't be decrypted.
- `CLIENT_URL` — your real frontend URL (used for CORS and every link in emails).
- `SMTP_*` — platform mailbox for password-reset emails.
- Serve over HTTPS; keep `TRUST_PROXY=true` behind a proxy so rate limits see real IPs.
- Back up MongoDB and the `uploads/` folder.

## Using the client portal

1. Open a project → **Client portal** → copy the link and send it to your client.
2. Under *Settings* choose whether the client sees all project tickets or only their own, whether they
   can reply, and add a welcome message.
3. New requests appear in **Tickets** with a pulsing dot and under **Awaiting reply** until someone on
   your team answers publicly. Internal notes are never shown to clients.
4. Tracking links (`/public/ticket/…`) are included in auto-replies and email replies, so clients can
   always get back to the conversation.

## Two-factor authentication

**Account & security → Set up 2FA**, scan the QR code with Google Authenticator / Authy / 1Password,
enter the 6-digit code, and save the backup codes. At login you'll be asked for a code; "Use a backup
code" works if the phone is lost (each code works once). 2FA applies to Google Sign-In too.

## Email-to-ticket

Unchanged from 1.x: **Settings → Support mailbox** connects any IMAP mailbox (your domain, Gmail with
an app password, …). Matching emails become tickets, the sender gets an auto-reply (now with a tracking
link), and replies from the ticket page are sent from that mailbox.

## API additions (v2)

```
POST /api/auth/2fa/setup | /enable | /disable | /backup-codes | /verify
POST /api/auth/forgot-password       GET|POST /api/auth/reset-password/:token
PUT  /api/auth/me                    PUT /api/auth/password
GET  /api/tickets/counts             POST /api/tickets/bulk
GET|POST /api/projects/:id/todos     PUT|DELETE /api/todos/:id     GET /api/todos/my-day
GET  /api/public/portal/:token       GET|POST /api/public/portal/:token/tickets
POST /api/public/tickets/:token/comments
```

`GET /api/tickets` now also accepts `sort` (`updated|newest|oldest|priority|due`), `assignedTo=me|unassigned`,
`status=active|done` and `view=overdue|awaiting`.

## Tech stack

**Backend:** Express, Mongoose, bcryptjs, jsonwebtoken, helmet, express-rate-limit, compression, nodemailer,
imapflow, mailparser, qrcode (TOTP is implemented in-house per RFC 6238).
**Frontend:** React 18, Vite, React Router, Tailwind CSS, Radix UI, lucide-react, recharts, axios, react-hot-toast.
