const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const connectDB = require('./src/config/db');
const { notFound, errorHandler } = require('./src/middleware/errorHandler');
const { startEmailPolling, stopEmailPolling } = require('./src/services/emailPoller');
const { startScheduler, stopScheduler } = require('./src/services/scheduler');

const isProd = process.env.NODE_ENV === 'production';

// Fail fast on configuration that would make the app insecure in production.
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set — refusing to start.');
  process.exit(1);
}
if (isProd && process.env.JWT_SECRET.length < 32) {
  console.warn('⚠️  JWT_SECRET is shorter than 32 characters — use a long random value in production.');
}
if (!process.env.ENCRYPTION_KEY) {
  console.warn('⚠️  ENCRYPTION_KEY is not set — falling back to JWT_SECRET for encrypting mailbox passwords and 2FA secrets.');
}

connectDB().then(() =>
  require('./src/models/Ticket')
    .backfillPriorityRank()
    .catch((err) => console.error('priorityRank backfill failed:', err.message))
);

const app = express();

// Behind Nginx / a load balancer, so req.ip and rate limiting see the real client.
if (process.env.TRUST_PROXY !== 'false') app.set('trust proxy', 1);

app.use(
  helmet({
    // The API only serves JSON + uploaded files; the SPA sets its own policy.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // let the SPA load /uploads files
  })
);
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(morgan(isProd ? 'combined' : 'dev'));

// Public routes (client portal, embeddable form, ticket tracking, inbound email webhook)
// are meant to be called from anywhere, so they get an open CORS policy.
app.use('/api/public', cors());
app.use('/api/public', require('./src/routes/publicRoutes'));

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''));
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  })
);

// Uploaded attachments. Served with a locked-down policy so an uploaded SVG/HTML file
// can never run script in the context of our domain.
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (/\.svg$/i.test(req.path)) res.setHeader('Content-Disposition', 'attachment');
    next();
  },
  express.static(path.join(__dirname, 'uploads'), { maxAge: '7d', index: false })
);

app.get('/api/health', (req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({
    status: dbUp ? 'ok' : 'degraded',
    db: dbUp ? 'connected' : 'disconnected',
    uptime: Math.round(process.uptime()),
  });
});

// General API rate limit (per IP) — generous, just stops runaway scripts.
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 600, standardHeaders: 'draft-7', legacyHeaders: false }));

app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/users', require('./src/routes/userRoutes'));
app.use('/api/clients', require('./src/routes/clientRoutes'));
app.use('/api/projects', require('./src/routes/projectRoutes'));
app.use('/api/tickets', require('./src/routes/ticketRoutes'));
app.use('/api/todos', require('./src/routes/todoRoutes'));
app.use('/api/dashboard', require('./src/routes/dashboardRoutes'));
app.use('/api/company', require('./src/routes/companyRoutes'));
app.use('/api/uploads', require('./src/routes/uploadRoutes'));
app.use('/api/search', require('./src/routes/searchRoutes'));
app.use('/api/time', require('./src/routes/timeRoutes'));
app.use('/api/invoices', require('./src/routes/invoiceRoutes'));
app.use('/api/automations', require('./src/routes/automationRoutes'));
app.use('/api/reports', require('./src/routes/reportRoutes'));
const feeds = require('./src/routes/feedRoutes');
app.use('/api/activity', feeds.activity);
app.use('/api/notifications', feeds.notifications);
app.use('/api/saved-replies', feeds.replies);

// Optionally serve the built frontend from the same server (single-container deploys).
const frontendDist = process.env.FRONTEND_DIST || path.join(__dirname, '..', 'frontend', 'dist');
if (process.env.SERVE_FRONTEND === 'true' && fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist, { maxAge: '1h', index: false }));
  app.get(/^\/(?!api|uploads).*/, (req, res) => res.sendFile(path.join(frontendDist, 'index.html')));
}

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`ZoopDesk API running on port ${PORT}`);
  if (process.env.EMAIL_POLLING !== 'false') startEmailPolling();
  if (process.env.SCHEDULER !== 'false') startScheduler();
});

// Graceful shutdown so in-flight requests finish during deploys/restarts.
function shutdown(signal) {
  console.log(`${signal} received — shutting down gracefully`);
  stopEmailPolling?.();
  stopScheduler();
  server.close(() => {
    mongoose.connection.close(false).finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));
