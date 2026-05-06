import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function fixtureApp() {
  const dir = await mkdtemp(join(tmpdir(), 'paf-app-'));
  const cachePath = join(dir, 'cache.json');
  await writeFile(cachePath, JSON.stringify({
    dataVersion: 14,
    entries: [
      { name: 'Open-Meteo', url: 'https://open-meteo.com/en/docs', description: 'Free weather forecast API', auth: 'No', https: true, cors: 'Yes', category: 'Weather', source: 'curated', sourceWeight: 5, sources: ['curated'] },
      { name: 'Auth0', url: 'https://auth0.com/docs/api', description: 'OAuth OpenID Connect login authentication API', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Authentication', source: 'curated', sourceWeight: 5, sources: ['curated'] },
    ],
  }));
  process.env.PUBLIC_API_FINDER_CACHE = cachePath;
  const { createApp, CreditLedger } = await import(`../src/app.js?test=${Date.now()}-${Math.random()}`);
  const ledger = new CreditLedger(join(dir, 'ledger.json'));
  const server = createApp({ ledger, env: { PUBLIC_API_FINDER_ADMIN_TOKEN: 'admin', BANKR_RECEIVE_ADDRESS: '0xabc' } });
  await new Promise(resolve => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, server, ledger };
}

async function post(base, path, body, headers = {}) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

test('hosted search spends one credit for successful pulls', async () => {
  const { base, server, ledger } = await fixtureApp();
  try {
    await ledger.grant('acct_test', 2, { reason: 'test' });
    const res = await post(base, '/api/search', { query: 'weather forecast', account: 'acct_test' });
    assert.equal(res.status, 200);
    assert.equal(res.body.results[0].name, 'Open-Meteo');
    assert.equal(res.body.billing.chargedCredits, 1);
    assert.equal(res.body.billing.remainingCredits, 1);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('hosted search returns 402 when credits are missing', async () => {
  const { base, server } = await fixtureApp();
  try {
    const res = await post(base, '/api/search', { query: 'weather forecast', account: 'acct_empty' });
    assert.equal(res.status, 402);
    assert.equal(res.body.code, 'INSUFFICIENT_CREDITS');
    assert.equal(res.body.balance, 0);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('topup creates Bankr payment instructions', async () => {
  const { base, server } = await fixtureApp();
  try {
    const res = await post(base, '/api/credits/topup', { account: 'acct_test', credits: 100 });
    assert.equal(res.status, 201);
    assert.equal(res.body.topup.credits, 100);
    assert.equal(res.body.payment.provider, 'bankr');
    assert.match(res.body.payment.prompt, /100 Public API Finder credits/);
    assert.equal(res.body.payment.receiveAddress, '0xabc');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
