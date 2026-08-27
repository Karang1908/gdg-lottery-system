import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { joinLottery } = require('../lib/lottery');

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  try {
    const result = await joinLottery(request.body || {});
    return response.status(result.alreadyJoined ? 200 : 201).json(result);
  } catch (error) {
    return response.status(error.status || 500).json({
      error: error.message || 'Unexpected server error.',
      code: error.code || 'INTERNAL_ERROR',
    });
  }
}
