const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Run database migrations in production
if (process.env.NODE_ENV === 'production') {
  const { runMigrations } = require('./utils/dbMigrate');
  runMigrations().catch(console.error);
}

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const clientRoutes = require('./routes/clients');
const projectRoutes = require('./routes/projects');
const timeEntryRoutes = require('./routes/timeEntries');
const subcontractorRoutes = require('./routes/subcontractors');
const invoiceRoutes = require('./routes/invoiceRoutes');
const importRoutes = require('./routes/importRoutes');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy headers in production (required for Render)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // Trust first proxy
}

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later'
});

app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/time-entries', timeEntryRoutes);
app.use('/api/subcontractors', subcontractorRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/import', importRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/user-preferences', require('./routes/userPreferences'));

// Temporary migration route - remove after running
const migrationRoutes = require('./routes/migrationRoutes');
app.use('/api/migrations', migrationRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/server-time', (req, res) => {
  const { getEasternDate, formatEasternDateTime } = require('./utils/timezone');
  res.json({ 
    currentDate: getEasternDate(),
    currentDateTime: formatEasternDateTime(new Date()),
    timezone: 'America/New_York',
    timestamp: new Date().toISOString()
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // Serve frontend static files
  app.use(express.static(path.join(__dirname, '../../frontend')));
  
  // Handle client-side routing - serve index.html for all non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      // If it's an API route, pass to next handler (404)
      next();
    } else {
      // Otherwise serve the frontend
      res.sendFile(path.join(__dirname, '../../frontend/index.html'));
    }
  });
}

// 404 handler for API routes only
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ 
      error: 'API route not found',
      path: req.path,
      method: req.method 
    });
  } else if (process.env.NODE_ENV !== 'production') {
    // In development, return 404 for non-API routes
    res.status(404).json({ 
      error: 'Route not found (frontend not served in development)',
      path: req.path,
      method: req.method 
    });
  }
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  if (err.code === 'ECONNREFUSED') {
    return res.status(503).json({ error: 'Database connection failed' });
  }
  
  // Default error response
  res.status(err.status || 500).json({ 
    error: err.message || 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});