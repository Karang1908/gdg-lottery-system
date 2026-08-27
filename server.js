'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const compression = require('compression');

try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch {
  // Environment variables are normally supplied by Vercel or the shell.
}

const {
  adminView,
  joinLottery,
  publicView,
  readState,
  requireAdmin,
  runAdminAction,
} = require('./lib/lottery');

const PORT = Number(process.env.PORT) || 3000;
const DIST = path.join(__dirname, 'dist');
const PUBLIC = path.join(__dirname, 'public');
const ROOT = fs.existsSync(path.join(DIST, 'index.html')) ? DIST : PUBLIC;
const BUILT = ROOT === DIST;

const app = express();
app.disable('x-powered-by');
app.use(compression());
app.use(express.json({ limit: '16kb' }));

function apiError(response, error) {
  response.status(error.status || 500).json({
    error: error.message || 'Unexpected server error.',
    code: error.code || 'INTERNAL_ERROR',
  });
}

app.get('/api/state', async (request, response) => {
  response.set('Cache-Control', 'private, no-store, max-age=0');
  try {
    const state = await readState();
    if (request.query.admin === '1') {
      requireAdmin(request.get('x-admin-password'));
      return response.json(adminView(state));
    }
    return response.json(publicView(state));
  } catch (error) {
    return apiError(response, error);
  }
});

app.post('/api/join', async (request, response) => {
  response.set('Cache-Control', 'private, no-store, max-age=0');
  try {
    const result = await joinLottery(request.body || {});
    return response.status(result.alreadyJoined ? 200 : 201).json(result);
  } catch (error) {
    return apiError(response, error);
  }
});

app.post('/api/admin', async (request, response) => {
  response.set('Cache-Control', 'private, no-store, max-age=0');
  try {
    return response.json(
      await runAdminAction(request.get('x-admin-password'), request.body || {})
    );
  } catch (error) {
    return apiError(response, error);
  }
});

app.get('/healthz', (_request, response) => response.type('text').send('ok'));
app.get('/admin', (_request, response) =>
  response.sendFile(path.join(ROOT, 'admin.html'))
);

app.use(
  express.static(ROOT, {
    setHeaders(response, filePath) {
      if (filePath.endsWith('.html')) {
        response.setHeader('Cache-Control', 'no-cache');
      } else if (BUILT) {
        response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  })
);

app.use((error, _request, response, _next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return response.status(400).json({ error: 'Request body must be valid JSON.' });
  }
  return apiError(response, error);
});

const httpServer = app.listen(PORT);

httpServer.once('listening', () => {
  console.log(`Lottery ready at http://localhost:${PORT}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.warn('ADMIN_PASSWORD is not set; the admin console will stay locked.');
  }
  if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) {
    console.log('Using ignored local state file for development.');
  }
});

httpServer.once('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Could not start the lottery: port ${PORT} is already in use. ` +
        'Set a different PORT in .env and try again.'
    );
  } else if (error.code === 'EACCES' || error.code === 'EPERM') {
    console.error(
      `Could not start the lottery on port ${PORT}: permission denied.`
    );
  } else {
    console.error('Could not start the lottery:', error.message);
  }
  process.exitCode = 1;
});
