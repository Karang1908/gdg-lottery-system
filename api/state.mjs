import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { adminView, publicView, readState, requireAdmin } = require('../lib/lottery');

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed.' });
  }
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  try {
    const state = await readState();
    const adminRequested = String(request.query?.admin || '') === '1';
    if (adminRequested) {
      requireAdmin(request.headers['x-admin-password']);
      return response.status(200).json(adminView(state));
    }
    return response.status(200).json(publicView(state));
  } catch (error) {
    return response.status(error.status || 500).json({
      error: error.message || 'Unexpected server error.',
      code: error.code || 'INTERNAL_ERROR',
    });
  }
}
