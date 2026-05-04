import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function fixtureCache() {
  const dir = join(tmpdir(), `public-api-finder-test-${process.pid}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'all.json');
  writeFileSync(path, JSON.stringify({
    count: 4,
    entries: [
      { name: 'Open-Meteo', url: 'https://open-meteo.com/', description: 'Global weather forecast API', auth: 'No', https: true, cors: 'Yes', category: 'Weather' },
      { name: 'Coinlore', url: 'https://www.coinlore.com/cryptocurrency-data-api', description: 'Cryptocurrencies prices, volume and more', auth: 'No', https: true, cors: 'Unknown', category: 'Cryptocurrency' },
      { name: 'CoinMarketCap', url: 'https://coinmarketcap.com/api/', description: 'Cryptocurrencies Prices', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Cryptocurrency' },
      { name: 'Old HTTP API', url: 'http://example.test', description: 'Legacy weather data', auth: 'No', https: false, cors: 'No', category: 'Weather' },
      { name: 'Stripe API', url: 'https://stripe.com/docs/api', description: 'Payments API with OpenAPI schema', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Financial', openapiUrl: 'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json', sources: ['apis-guru'] }
    ]
  }));
  return path;
}

function run(args) {
  return spawnSync(process.execPath, ['src/cli.js', ...args], {
    encoding: 'utf8',
    env: { ...process.env, PUBLIC_API_FINDER_CACHE: fixtureCache() }
  });
}

test('help prints usage', () => {
  const r = spawnSync(process.execPath, ['src/cli.js', '--help'], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /public-api-finder/);
  assert.match(r.stdout, /weather forecast/);
});

test('filters no-auth and https results', () => {
  const r = run(['weather forecast', '--no-auth', '--https']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Open-Meteo/);
  assert.doesNotMatch(r.stdout, /Old HTTP API/);
});

test('category filter and json output are valid', () => {
  const r = run(['crypto prices', '--category', 'Cryptocurrency', '--json']);
  assert.equal(r.status, 0, r.stderr);
  const rows = JSON.parse(r.stdout);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].category, 'Cryptocurrency');
  assert.ok(rows[0].score >= rows[1].score);
});

test('prints helpful message for no matches', () => {
  const r = run(['zzzz-no-match']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /No matching public APIs found/);
});


test('openapi filter returns schema-backed APIs', () => {
  const r = run(['payments', '--openapi', '--json']);
  assert.equal(r.status, 0, r.stderr);
  const rows = JSON.parse(r.stdout);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Stripe API');
  assert.match(rows[0].openapiUrl, /openapi/);
});

test('source filter narrows results', () => {
  const r = run(['payments', '--source', 'apis-guru']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Stripe API/);
});
