const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./src/config/db');
const { notFound, errorHandler } = require('./src/middleware/errorHandler');
const { startEmailPolling } = require('./src/services/emailPoller');

connectDB();

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Public routes (embeddable form, ticket tracking, inbound email webhook) are meant to be
// called from anywhere — a client's own website, or an email provider's servers — so they
// get an open CORS policy. Everything else is restricted to our own frontend.
app.use('/api/public', cors());
app.use('/api/public', require('./src/routes/publicRoutes'));

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// Serve uploaded attachments
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Queuer API is running' });
});

app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/users', require('./src/routes/userRoutes'));
app.use('/api/clients', require('./src/routes/clientRoutes'));
app.use('/api/projects', require('./src/routes/projectRoutes'));
app.use('/api/tickets', require('./src/routes/ticketRoutes'));
app.use('/api/dashboard', require('./src/routes/dashboardRoutes'));
app.use('/api/company', require('./src/routes/companyRoutes'));
app.use('/api/uploads', require('./src/routes/uploadRoutes'));
app.use('/api/search', require('./src/routes/searchRoutes'));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Queuer API running on port ${PORT}`);
  startEmailPolling();
});
