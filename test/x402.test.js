import test from 'node:test';
import assert from 'node:assert/strict';

const { default: handler } = await import('../x402/public-api-finder/index.ts');

test('x402 handler returns ranked paid pull results', async () => {
  const req = new Request('https://x402.local/public-api-finder', {
    method: 'POST',
    body: JSON.stringify({ query: 'weather forecast no auth cors', noAuth: true, https: true, cors: 'Yes', limit: 3 }),
  });
  const res = await handler(req);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.price, '$0.01');
  assert.equal(body.charged, true);
  assert.ok(body.results.length > 0);
  assert.equal(body.results[0].auth, 'No');
  assert.equal(body.results[0].cors, 'Yes');
});

test('x402 handler validates query', async () => {
  const req = new Request('https://x402.local/public-api-finder', { method: 'POST', body: '{}' });
  const res = await handler(req);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /query is required/);
});
