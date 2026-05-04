#!/usr/bin/env node
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const SOURCES = {
  publicApiLists: 'https://public-api-lists.github.io/public-api-lists/api/all.json',
  publicApisReadme: 'https://raw.githubusercontent.com/public-apis/public-apis/master/README.md',
  apisGuru: 'https://api.apis.guru/v2/list.json',
};
const CACHE_PATH = process.env.PUBLIC_API_FINDER_CACHE || join(homedir(), '.cache', 'public-api-finder', 'all.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const DOMAIN_PROFILES = {
  crypto: {
    triggers: ['crypto', 'cryptocurrency', 'cryptocurrencies', 'bitcoin', 'ethereum', 'blockchain', 'defi', 'token', 'tokens', 'coin', 'coins', 'wallet'],
    categories: ['cryptocurrency', 'currency exchange', 'finance', 'financial'],
    categoryWeights: { cryptocurrency: 16, 'currency exchange': 5, finance: 3, financial: 3 },
    boostTerms: ['crypto', 'cryptocurrency', 'bitcoin', 'ethereum', 'blockchain', 'defi', 'token', 'coin', 'exchange', 'price', 'market'],
    weakTerms: ['price', 'prices'],
  },
  finance: {
    triggers: ['stock', 'stocks', 'equity', 'equities', 'market', 'trading', 'ticker', 'tickers', 'quote', 'quotes', 'etf', 'forex', 'portfolio'],
    categories: ['finance', 'financial', 'currency exchange'],
    categoryWeights: { finance: 14, financial: 14, 'currency exchange': 5 },
    boostTerms: ['stock', 'stocks', 'equity', 'market', 'trading', 'ticker', 'quote', 'quotes', 'forex', 'portfolio'],
    weakTerms: ['quote', 'quotes', 'price', 'prices', 'market'],
  },
};

function detectDomains(queryTokens) {
  return Object.entries(DOMAIN_PROFILES)
    .filter(([, profile]) => profile.triggers.some(t => queryTokens.has(t)))
    .map(([name]) => name);
}

function domainAdjustment(entry, queryTokens) {
  const domains = detectDomains(queryTokens);
  if (!domains.length) return 0;
  const cat = String(entry.category || '').toLowerCase();
  const text = `${entry.name || ''} ${entry.description || ''} ${entry.provider || ''}`.toLowerCase();
  let adjustment = 0;
  for (const domain of domains) {
    const profile = DOMAIN_PROFILES[domain];
    let categoryBoost = 0;
    for (const [category, weight] of Object.entries(profile.categoryWeights || {})) {
      if (cat.includes(category)) categoryBoost = Math.max(categoryBoost, weight);
    }
    const categoryHit = categoryBoost > 0;
    const textHit = profile.boostTerms.some(t => text.includes(t));
    if (categoryHit) adjustment += categoryBoost;
    else if (textHit) adjustment += 3;
    else adjustment -= 10;
    for (const weak of profile.weakTerms) {
      if (queryTokens.has(weak) && text.includes(weak) && !categoryHit && !textHit) adjustment -= 4;
    }
  }
  return adjustment;
}


function usage() {
  console.log(`public-api-finder — multi-source public API discovery for agents

Usage:
  public-api-finder <query> [options]

Options:
  --category <name>  Filter by category substring
  --source <name>    Filter by source: public-api-lists, public-apis, apis-guru
  --no-auth          Only APIs with Auth = No
  --https            Only HTTPS APIs
  --cors <value>     Filter by CORS: Yes, No, Unknown
  --openapi          Only APIs with OpenAPI specs
  --limit <n>        Max results (default: 8)
  --json             Emit JSON
  --refresh          Refresh cache
  -h, --help         Show help

Examples:
  public-api-finder "weather forecast" --no-auth --https
  public-api-finder "crypto prices" --category Cryptocurrency --limit 5
  public-api-finder "payments" --openapi --json
`);
}

function parseArgs(argv) {
  const args = { query: '', limit: 8, json: false, refresh: false };
  const parts = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') args.help = true;
    else if (a === '--no-auth') args.noAuth = true;
    else if (a === '--https') args.https = true;
    else if (a === '--json') args.json = true;
    else if (a === '--refresh') args.refresh = true;
    else if (a === '--openapi') args.openapi = true;
    else if (a === '--category') args.category = argv[++i] || '';
    else if (a === '--source') args.source = argv[++i] || '';
    else if (a === '--cors') args.cors = argv[++i] || '';
    else if (a === '--limit') args.limit = Number(argv[++i] || 8);
    else parts.push(a);
  }
  args.query = parts.join(' ').trim();
  return args;
}

function tokenSet(text) {
  return new Set(String(text).toLowerCase().match(/[a-z0-9]+/g)?.filter(t => t.length > 1) || []);
}

function intersectionCount(a, b) {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

function textScore(entry, queryTokens) {
  const name = tokenSet(entry.name);
  const category = tokenSet(entry.category);
  const desc = tokenSet(entry.description);
  const all = new Set([...name, ...category, ...desc, ...tokenSet(entry.provider || '')]);
  return 5 * intersectionCount(queryTokens, name)
    + 4 * intersectionCount(queryTokens, category)
    + 2 * intersectionCount(queryTokens, desc)
    + intersectionCount(queryTokens, all);
}

function score(entry, queryTokens) {
  let base = textScore(entry, queryTokens);
  if (entry.openapiUrl) base += 2;
  if (entry.sources?.length > 1) base += 2;
  if (entry.auth === 'No') base += 1;
  if (entry.https) base += 1;
  return base + domainAdjustment(entry, queryTokens);
}

async function cacheIsFresh() {
  try {
    const s = await stat(CACHE_PATH);
    return Date.now() - s.mtimeMs < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'public-api-finder/0.2' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'public-api-finder/0.2' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function normalizeCategory(cat) {
  if (!cat) return 'Unknown';
  return String(cat).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function cleanDescription(desc) {
  return String(desc || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_`>\[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 260).replace(/\s+\S{0,20}$/, '');
}

function normalizeAuth(auth) {
  const a = String(auth || 'Unknown').replace(/`/g, '').trim();
  if (/^no$/i.test(a)) return 'No';
  if (/api\s*key/i.test(a)) return 'apiKey';
  if (/oauth/i.test(a)) return 'OAuth';
  return a || 'Unknown';
}

function parsePublicApisReadme(readme) {
  const entries = [];
  let category = '';
  for (const raw of readme.split('\n')) {
    const heading = raw.match(/^###\s+(.+)/);
    if (heading) {
      category = heading[1].trim();
      continue;
    }
    if (!raw.startsWith('| [')) continue;
    const cells = raw.split('|').slice(1, -1).map(c => c.trim());
    if (cells.length < 5) continue;
    const link = cells[0].match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (!link) continue;
    entries.push({
      name: link[1],
      url: link[2],
      description: cleanDescription(cells[1]),
      auth: normalizeAuth(cells[2]),
      https: /^yes$/i.test(cells[3]),
      cors: /^(yes|no|unknown)$/i.test(cells[4]) ? normalizeCategory(cells[4]) : 'Unknown',
      category,
      source: 'public-apis',
      sourceWeight: 2,
    });
  }
  return entries;
}

function parseApisGuru(data) {
  const entries = [];
  for (const [providerName, item] of Object.entries(data || {})) {
    const version = item.versions?.[item.preferred] || Object.values(item.versions || {})[0];
    const info = version?.info || {};
    const origin = info['x-origin']?.[0]?.url;
    entries.push({
      name: info.title || providerName,
      url: (info.contact?.url && !String(info.contact.url).startsWith('file:')) ? info.contact.url : ((origin && !String(origin).startsWith('file:')) ? origin : (version?.swaggerUrl || version?.openapiUrl || `https://api.apis.guru/v2/specs/${providerName}/${item.preferred || 'latest'}/openapi.json`)),
      description: cleanDescription(info.description || `OpenAPI definition for ${providerName}`),
      auth: 'Unknown',
      https: true,
      cors: 'Unknown',
      category: normalizeCategory(info['x-apisguru-categories']?.[0] || 'OpenAPI'),
      source: 'apis-guru',
      sourceWeight: 2,
      provider: providerName,
      openapiUrl: version?.swaggerUrl || version?.openapiUrl || origin || null,
    });
  }
  return entries;
}

async function buildData() {
  const [pal, publicApisReadme, guru] = await Promise.allSettled([
    fetchJson(SOURCES.publicApiLists),
    fetchText(SOURCES.publicApisReadme),
    fetchJson(SOURCES.apisGuru),
  ]);
  const entries = [];
  const sourceStatus = {};
  if (pal.status === 'fulfilled') {
    sourceStatus['public-api-lists'] = pal.value.entries?.length || 0;
    entries.push(...(pal.value.entries || []).map(e => ({ ...e, auth: normalizeAuth(e.auth), source: 'public-api-lists', sourceWeight: 1 })));
  } else sourceStatus['public-api-lists'] = `error: ${pal.reason.message}`;
  if (publicApisReadme.status === 'fulfilled') {
    const rows = parsePublicApisReadme(publicApisReadme.value);
    sourceStatus['public-apis'] = rows.length;
    entries.push(...rows);
  } else sourceStatus['public-apis'] = `error: ${publicApisReadme.reason.message}`;
  if (guru.status === 'fulfilled') {
    const rows = parseApisGuru(guru.value);
    sourceStatus['apis-guru'] = rows.length;
    entries.push(...rows);
  } else sourceStatus['apis-guru'] = `error: ${guru.reason.message}`;
  return { generatedAt: new Date().toISOString(), sourceStatus, entries: dedupe(entries) };
}

function keyFor(entry) {
  const host = String(entry.url || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  return `${String(entry.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '')}|${host}`;
}

function mergeEntry(a, b) {
  const sources = new Set([...(a.sources || [a.source]), ...(b.sources || [b.source])].filter(Boolean));
  return {
    ...a,
    description: (b.description || '').length > (a.description || '').length ? b.description : a.description,
    auth: a.auth !== 'Unknown' ? a.auth : b.auth,
    https: Boolean(a.https || b.https),
    cors: a.cors !== 'Unknown' ? a.cors : b.cors,
    category: a.category !== 'Unknown' ? a.category : b.category,
    openapiUrl: a.openapiUrl || b.openapiUrl || null,
    provider: a.provider || b.provider,
    sourceWeight: (a.sourceWeight || 0) + (b.sourceWeight || 0),
    sources: [...sources],
  };
}

function dedupe(entries) {
  const map = new Map();
  for (const e of entries) {
    const clean = {
      name: e.name,
      url: e.url,
      description: cleanDescription(e.description),
      auth: normalizeAuth(e.auth),
      https: Boolean(e.https),
      cors: e.cors || 'Unknown',
      category: normalizeCategory(e.category),
      source: e.source,
      sourceWeight: e.sourceWeight || 1,
      sources: [...(e.sources || []), e.source].filter(Boolean),
      provider: e.provider,
      openapiUrl: e.openapiUrl || null,
    };
    const key = keyFor(clean);
    map.set(key, map.has(key) ? mergeEntry(map.get(key), clean) : clean);
  }
  return [...map.values()];
}

async function loadData(refresh = false) {
  if (!refresh && await cacheIsFresh()) {
    const cached = JSON.parse(await readFile(CACHE_PATH, 'utf8'));
    return cached.entries || [];
  }
  const data = await buildData();
  await mkdir(dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(data, null, 2));
  return data.entries || [];
}

function sourceMatches(entry, source) {
  if (!source) return true;
  return (entry.sources || [entry.source]).some(s => String(s).toLowerCase() === source.toLowerCase());
}

function filterEntries(entries, args) {
  const q = tokenSet(args.query);
  return entries.flatMap(e => {
    if (args.category && !String(e.category || '').toLowerCase().includes(args.category.toLowerCase())) return [];
    if (args.source && !sourceMatches(e, args.source)) return [];
    if (args.noAuth && String(e.auth || '').toLowerCase() !== 'no') return [];
    if (args.https && !e.https) return [];
    if (args.openapi && !e.openapiUrl) return [];
    if (args.cors && String(e.cors || '').toLowerCase() !== args.cors.toLowerCase()) return [];
    const matched = q.size ? textScore(e, q) : 1;
    if (q.size && matched === 0) return [];
    const s = q.size ? score(e, q) : 1;
    if (q.size && s <= 0) return [];
    return [{ ...e, score: s + (e.sourceWeight || 0) }];
  }).sort((a, b) => b.score - a.score || String(a.category).localeCompare(String(b.category)) || String(a.name).localeCompare(String(b.name))).slice(0, args.limit);
}

function printMarkdown(rows) {
  if (!rows.length) {
    console.log('No matching public APIs found. Try broader terms or remove filters.');
    return;
  }
  rows.forEach((e, i) => {
    console.log(`${i + 1}. **${e.name}** (${e.category}) — ${cleanDescription(e.description)}`);
    console.log(`   - URL: ${e.url}`);
    console.log(`   - Auth: \`${e.auth}\` · HTTPS: ${e.https ? 'yes' : 'no'} · CORS: ${e.cors} · sources: ${((e.sources && e.sources.length) ? e.sources : [e.source || 'unknown']).join(', ')} · score: ${e.score}`);
    if (e.openapiUrl) console.log(`   - OpenAPI: ${e.openapiUrl}`);
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.query) {
    usage();
    return args.help ? 0 : 1;
  }
  const rows = filterEntries(await loadData(args.refresh), args);
  if (args.json) console.log(JSON.stringify(rows, null, 2));
  else printMarkdown(rows);
  return 0;
}

main().then(code => process.exitCode = code).catch(err => {
  console.error(`public-api-finder: ${err.message}`);
  process.exitCode = 1;
});
