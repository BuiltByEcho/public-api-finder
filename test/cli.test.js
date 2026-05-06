import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const BASE_ENTRIES = [
  { name: 'Open-Meteo', url: 'https://open-meteo.com/', description: 'Global weather forecast API', auth: 'No', https: true, cors: 'Yes', category: 'Weather' },
  { name: 'Coinlore', url: 'https://www.coinlore.com/cryptocurrency-data-api', description: 'Cryptocurrencies prices, volume and more', auth: 'No', https: true, cors: 'Unknown', category: 'Cryptocurrency' },
  { name: 'CoinMarketCap', url: 'https://coinmarketcap.com/api/', description: 'Cryptocurrencies Prices', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Cryptocurrency' },
  { name: 'Old HTTP API', url: 'http://example.test', description: 'Legacy weather data', auth: 'No', https: false, cors: 'No', category: 'Weather' },
  { name: 'Stripe API', url: 'https://stripe.com/docs/api', description: 'Payments API with OpenAPI schema', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Financial', openapiUrl: 'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json', sources: ['apis-guru'] },
  { name: 'Polygon', url: 'https://polygon.io/', description: 'Historical stock quotes and market data', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Finance', openapiUrl: 'https://api.apis.guru/v2/specs/polygon.io/1.0.0/swagger.json', sources: ['public-apis', 'apis-guru'] }
];

function fixtureCache(entries = BASE_ENTRIES) {
  const dir = join(tmpdir(), `public-api-finder-test-${process.pid}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'all.json');
  writeFileSync(path, JSON.stringify({ dataVersion: 5, count: entries.length, entries }));
  return path;
}

function run(args, entries = BASE_ENTRIES) {
  return spawnSync(process.execPath, ['src/cli.js', ...args], {
    encoding: 'utf8',
    env: { ...process.env, PUBLIC_API_FINDER_CACHE: fixtureCache(entries) }
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
  assert.ok(/^Stripe( API)?$/.test(rows[0].name));
  assert.match(rows[0].openapiUrl, /openapi/);
});

test('source filter narrows results', () => {
  const r = run(['payments', '--source', 'apis-guru']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Stripe API/);
});


test('finance intent does not rank generic quote APIs above finance APIs', () => {
  const r = run(['stock quotes', '--json']);
  assert.equal(r.status, 0, r.stderr);
  const rows = JSON.parse(r.stdout);
  assert.equal(rows[0].name, 'Polygon');
  assert.equal(rows[0].category, 'Finance');
});

test('crypto intent favors cryptocurrency APIs over generic price APIs', () => {
  const r = run(['crypto prices', '--json']);
  assert.equal(r.status, 0, r.stderr);
  const rows = JSON.parse(r.stdout);
  assert.ok(rows.some(row => row.category === 'Cryptocurrency'));
  assert.equal(rows[0].category, 'Cryptocurrency');
});

test('check annotates result reachability failures', () => {
  const r = run(['local test api', '--check', '--json'], [
    { name: 'Local Test API', url: 'http://127.0.0.1:9/docs', description: 'Local test api docs', auth: 'No', https: false, cors: 'Unknown', category: 'Test' }
  ]);
  assert.equal(r.status, 0, r.stderr);
  const rows = JSON.parse(r.stdout);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].check.ok, false);
  assert.equal(rows[0].check.status, null);
  assert.equal(rows[0].check.method, 'GET');
  assert.ok(rows[0].check.error);
});

test('natural-language no-auth and cors hints act like filters', () => {
  const r = run(['weather no auth cors', '--json'], [
    { name: 'Key Weather', url: 'https://example.com/key', description: 'Weather API', auth: 'apiKey', https: true, cors: 'Yes', category: 'Weather' },
    { name: 'Server Weather', url: 'https://example.com/server', description: 'Weather API', auth: 'No', https: true, cors: 'Unknown', category: 'Weather' },
    { name: 'Browser Weather', url: 'https://example.com/browser', description: 'Weather API', auth: 'No', https: true, cors: 'Yes', category: 'Weather' }
  ]);
  assert.equal(r.status, 0, r.stderr);
  const rows = JSON.parse(r.stdout);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Browser Weather');
});

test('no-auth stock intent keeps a finance API on top', () => {
  const r = run(['free stock quote api no auth', '--json'], [
    { name: 'Free Weather', url: 'https://example.com/weather', description: 'Free API with hourly data', auth: 'No', https: true, cors: 'Yes', category: 'Weather' },
    { name: 'Stooq', url: 'https://stooq.com/db/h/', description: 'Free historical stock quotes, forex, indices, and CSV market data', auth: 'No', https: true, cors: 'Unknown', category: 'Finance' }
  ]);
  assert.equal(r.status, 0, r.stderr);
  const rows = JSON.parse(r.stdout);
  assert.equal(rows[0].name, 'Stooq');
});

test('books and podcast intents prefer their own domains', () => {
  const books = run(['public domain books search authors covers no auth', '--json'], [
    { name: 'Census Data API', url: 'https://example.com/census', description: 'Public government search data', auth: 'No', https: true, cors: 'Yes', category: 'Government' },
    { name: 'Open Library', url: 'https://openlibrary.org/developers/api', description: 'Books, authors, ISBN lookup, covers, and public library metadata', auth: 'No', https: true, cors: 'Yes', category: 'Books' }
  ]);
  assert.equal(books.status, 0, books.stderr);
  assert.equal(JSON.parse(books.stdout)[0].name, 'Open Library');

  const podcasts = run(['podcast search episodes rss metadata', '--json'], [
    { name: 'TVMaze', url: 'https://example.com/tv', description: 'TV episodes and show metadata search', auth: 'No', https: true, cors: 'Yes', category: 'Video' },
    { name: 'Listen Notes', url: 'https://www.listennotes.com/api/docs/', description: 'Podcast search, episodes, shows, RSS metadata, and podcast directory', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Podcasts' }
  ]);
  assert.equal(podcasts.status, 0, podcasts.stderr);
  assert.equal(JSON.parse(podcasts.stdout)[0].name, 'Listen Notes');
});

test('short generic api names do not receive broad curated-name boosts', () => {
  const r = run(['payments openapi', '--openapi', '--json'], [
    { name: 'API', url: 'https://example.com/openapi.json', description: 'Generic web API', auth: 'Unknown', https: true, cors: 'Unknown', category: 'OpenAPI', openapiUrl: 'https://example.com/openapi.json' },
    { name: 'Stripe API', url: 'https://docs.stripe.com/api', description: 'Payments, checkout, billing, invoices, and subscriptions API', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Payments', openapiUrl: 'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json' }
  ]);
  assert.equal(r.status, 0, r.stderr);
  const rows = JSON.parse(r.stdout);
  assert.ok(/^Stripe( API)?$/.test(rows[0].name));
});
