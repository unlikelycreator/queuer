# Queuer 3.0

The work hub for **any** client-facing team — software, QA, support, marketing or agencies. Requests,
projects and a client portal, plus **time tracking, invoicing, no-code automations, SLAs, CSAT and a full
KPI dashboard**, with two-factor auth and a refined **Evergreen** design in light and dark themes.

```
queuer/
├── backend/           Node.js + Express + MongoDB (Mongoose) REST API
├── frontend/          React + Vite + Tailwind + Radix UI
└── docker-compose.yml MongoDB + API + Nginx, ready for a server
```

## What's new in 3.0

| Area | What it does |
| --- | --- |
| **Workspace templates** | The admin picks what the workspace is for — *Software development*, *QA & testing*, *Customer support*, *Marketing & content* or *Agency / general* — at signup or in **Settings → Workspace**. One click sets the wording everywhere (e.g. Tickets → *Issues* / *Requests* / *Tasks*, Projects → *Campaigns* / *Products*), the request types, custom fields and SLA targets. Everything stays editable. |
| **Custom fields** | Text, number, dropdown, date, checkbox and link fields per workspace (build number, severity, order ID, channel, publish date, budget…). Optional *required* and *show in client portal*. Exported to CSV. |
| **Checklists** | Steps, acceptance criteria or test cases on every ticket with progress bars (paste a list to add many). |
| **Time tracking** | Live timer from any ticket or project (header widget follows you), manual entries ("1h 30m", "1:30"), weekly timesheet, billable toggle, estimates vs. actuals, team totals. |
| **Billing & invoices** | Turn unbilled billable time + fixed-price tickets into invoices in two clicks (no double billing). Discounts, tax/GST/VAT, payments & partial payments, overdue tracking, void. **Download real PDFs**, print, email the PDF to the client, or share a client invoice link. Three invoice themes (Modern / Classic / Minimal), accent colour, logo and business details with a live preview. |
| **Automations** | No-code *When → If → Then* rules: triggers (created, status changed, assigned, client replied, idle for N hours, SLA breached), conditions on any field incl. custom fields, and actions (set status/priority, assign or load-balanced round-robin, tag, internal note, templated reply to the client + email, in-app notification, project to-do, due date, webhook to Slack/Zapier/Make). Recipe gallery, test-on-a-ticket, run history. |
| **SLA policies** | First-response and resolution targets per priority, countdown badges on tickets, breach detection every minute, notifications, compliance in reports. |
| **CSAT** | Clients rate resolved requests 1–5 ★ (+ comment) from their tracking page. |
| **Insights (KPI dashboard)** | Created/resolved/backlog, first-response & resolution times, SLA compliance, CSAT, reopen rate, hours, utilization, billable value, revenue collected/outstanding — all with change vs. the previous period. Throughput, backlog aging, type mix, arrival heatmap (weekday × hour), hours, revenue, team leaderboard, top clients. Filters by range & client. CSV export of tickets, time and invoices. |
| **Activity log & notifications** | Complete audit trail (people, clients, automations, SLA monitor) and an in-app notification bell (assignments, client replies, SLA breaches, ratings, paid invoices). |
| **Saved replies** | Team or private canned responses with `{{variables}}`, inserted from the composer. |

## What was new in 2.0

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

### Upgrading from 2.x

No migration script is needed. Existing workspaces keep the software ticket types they already use and
show a **"Tailor Queuer to your team"** prompt on the dashboard for owners/admins. Install the new
backend dependency (`npm install` picks up `pdfkit`) and restart. Optionally set `SCHEDULER_INTERVAL_MS`.

Keep the same `backend/.env` (`MONGODB_URI`, `JWT_SECRET`, `ENCRYPTION_KEY`) as before: accounts live in that
database, and 2FA secrets are encrypted with that key. The app was renamed from ZoopDesk to Queuer; browsers
that were signed in stay signed in, and the Docker Compose database name is unchanged (`zoopdesk`).

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
3. **Share the to-do list** (toggle on the *Share link* tab or under *Settings*, off by default) adds a
   read-only **Plan** tab to the portal: the project's day-by-day to-dos with who's on them and what's
   done. To-do notes and ticket links are never shown. The project's To-dos tab tells your team when the
   plan is visible to the client.
4. New requests appear in **Tickets** with a pulsing dot and under **Awaiting reply** until someone on
   your team answers publicly. Internal notes are never shown to clients.
5. Tracking links (`/public/ticket/…`) are included in auto-replies and email replies, so clients can
   always get back to the conversation.

## Two-factor authentication

**Account & security → Set up 2FA**, scan the QR code with Google Authenticator / Authy / 1Password,
enter the 6-digit code, and save the backup codes. At login you'll be asked for a code; "Use a backup
code" works if the phone is lost (each code works once). 2FA applies to Google Sign-In too.

## Can't log in? (account recovery)

"Invalid email or password" means the email isn't in the database the API is connected to, or the
password doesn't match. The API prints the database it uses at startup
(`MongoDB connected: <host> / database "<name>"`). From `backend/`, using the same `.env`:

```bash
npm run account -- list                                # every user in that database
npm run account -- show you@company.com                # 2FA on/off, locked, google-only, ...
npm run account -- set-password you@company.com 'NewPassw0rd!'
npm run account -- disable-2fa you@company.com         # lost phone and backup codes
npm run account -- unlock you@company.com              # after too many failed attempts
```

If `list` doesn't show your account, `MONGODB_URI` points at a different database than the one you
signed up on. An account made with Google Sign-In has no password; use the Google button or `set-password`.

## Email-to-ticket

Unchanged from 1.x: **Settings → Support mailbox** connects any IMAP mailbox (your domain, Gmail with
an app password, …). Matching emails become tickets, the sender gets an auto-reply (now with a tracking
link), and replies from the ticket page are sent from that mailbox.

## API additions (v3)

```
GET|PUT /api/company/workspace   POST /api/company/workspace/template   PUT /api/company/billing
POST /api/tickets/:id/checklist  PUT|DELETE /api/tickets/:id/checklist/:itemId
GET|POST /api/time   PUT|DELETE /api/time/:id   GET /api/time/running|summary   POST /api/time/start|stop
GET|POST /api/invoices   GET /api/invoices/unbilled   GET|PUT|DELETE /api/invoices/:id
GET /api/invoices/:id/pdf   POST /api/invoices/:id/send|payments   DELETE /api/invoices/:id/payments/:pid
GET|POST /api/automations   PUT|DELETE /api/automations/:id   POST /api/automations/:id/test
GET /api/reports/overview   GET /api/reports/export?type=tickets|time|invoices
GET /api/activity   GET /api/notifications(/unread)   POST /api/notifications(/:id)/read
GET|POST /api/saved-replies   PUT|DELETE /api/saved-replies/:id
GET /api/public/invoices/:token(/pdf)   POST /api/public/tickets/:token/csat
```

Billing endpoints are restricted to owners and admins.

## API additions (v2)

```
POST /api/auth/2fa/setup | /enable | /disable | /backup-codes | /verify
POST /api/auth/forgot-password       GET|POST /api/auth/reset-password/:token
PUT  /api/auth/me                    PUT /api/auth/password
GET  /api/tickets/counts             POST /api/tickets/bulk
GET|POST /api/projects/:id/todos     PUT|DELETE /api/todos/:id     GET /api/todos/my-day
GET  /api/public/portal/:token       GET|POST /api/public/portal/:token/tickets
GET  /api/public/portal/:token/todos (only when the project shares its to-do list)
POST /api/public/tickets/:token/comments
```

`GET /api/tickets` now also accepts `sort` (`updated|newest|oldest|priority|due`), `assignedTo=me|unassigned`,
`status=active|done` and `view=overdue|awaiting`.

## Tech stack

**Backend:** Express, Mongoose, bcryptjs, jsonwebtoken, helmet, express-rate-limit, compression, nodemailer,
imapflow, mailparser, qrcode, pdfkit (TOTP is implemented in-house per RFC 6238).
**Frontend:** React 18, Vite, React Router, Tailwind CSS, Radix UI, lucide-react, recharts, axios, react-hot-toast.
