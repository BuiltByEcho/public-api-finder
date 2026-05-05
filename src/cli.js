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
    triggers: ['crypto', 'cryptocurrency', 'cryptocurrencies', 'bitcoin', 'ethereum', 'solana', 'blockchain', 'defi', 'token', 'tokens', 'coin', 'coins', 'wallet'],
    categoryWeights: { cryptocurrency: 22, 'currency exchange': 3, finance: -4, financial: -4 },
    boostTerms: ['crypto', 'cryptocurrency', 'bitcoin', 'ethereum', 'solana', 'blockchain', 'defi', 'token', 'coin', 'wallet'],
    weakTerms: ['price', 'prices', 'market', 'exchange'],
  },
  finance: {
    triggers: ['stock', 'stocks', 'equity', 'equities', 'market', 'trading', 'ticker', 'tickers', 'quote', 'quotes', 'etf', 'forex', 'portfolio', 'options'],
    categoryWeights: { finance: 16, financial: 16, 'currency exchange': 5 },
    boostTerms: ['stock', 'stocks', 'equity', 'market', 'trading', 'ticker', 'quote', 'quotes', 'forex', 'portfolio', 'options', 'historical'],
    weakTerms: ['quote', 'quotes', 'price', 'prices', 'market'],
  },
  weather: {
    triggers: ['weather', 'forecast', 'radar', 'temperature', 'climate', 'alerts', 'precipitation', 'hourly', 'daily'],
    categoryWeights: { weather: 18, location: 4 },
    boostTerms: ['weather', 'forecast', 'radar', 'temperature', 'climate', 'alerts', 'precipitation', 'meteorological'],
    weakTerms: ['daily', 'hourly'],
  },
  maps: {
    triggers: ['maps', 'map', 'geocoding', 'reverse', 'address', 'coordinates', 'places', 'routing', 'distance', 'timezone', 'location', 'navigation'],
    categoryWeights: { geocoding: 18, location: 12, 'open data': 3 },
    boostTerms: ['map', 'maps', 'geocoding', 'geocoder', 'reverse', 'address', 'coordinates', 'routing', 'places', 'location', 'navigation', 'timezone'],
    weakTerms: ['location'],
  },
  jobs: {
    triggers: ['jobs', 'careers', 'employment', 'hiring', 'salary', 'resume', 'remote', 'companies', 'internships', 'recruitment'],
    categoryWeights: { jobs: 20 },
    boostTerms: ['jobs', 'careers', 'employment', 'hiring', 'salary', 'resume', 'remote', 'recruitment'],
    weakTerms: ['remote'],
  },
  sports: {
    triggers: ['sports', 'scores', 'teams', 'leagues', 'fixtures', 'odds', 'football', 'basketball', 'baseball', 'soccer', 'standings', 'stats'],
    categoryWeights: { 'sports & fitness': 18, entertainment: 4 },
    boostTerms: ['sports', 'scores', 'teams', 'leagues', 'fixtures', 'odds', 'football', 'basketball', 'baseball', 'soccer', 'standings', 'stats'],
    weakTerms: ['scores', 'stats'],
  },
  media: {
    triggers: ['movies', 'movie', 'tv', 'shows', 'streaming', 'actors', 'ratings', 'posters', 'trailers', 'anime', 'imdb', 'films', 'episodes'],
    categoryWeights: { entertainment: 16, anime: 14, media: 12, video: 8 },
    boostTerms: ['movie', 'movies', 'tv', 'show', 'shows', 'streaming', 'actors', 'ratings', 'posters', 'trailers', 'anime', 'imdb', 'film', 'films', 'episodes'],
    weakTerms: ['media'],
  },
  news: {
    triggers: ['news', 'headlines', 'articles', 'breaking', 'media', 'newspapers', 'topics', 'politics', 'world', 'latest'],
    categoryWeights: { news: 20, media: 6 },
    boostTerms: ['news', 'headlines', 'articles', 'breaking', 'newspapers', 'topics', 'politics', 'world', 'latest'],
    weakTerms: ['media', 'search'],
  },
  government: {
    triggers: ['government', 'census', 'legislation', 'representatives', 'elections', 'bills', 'federal', 'agencies', 'public', 'civic'],
    categoryWeights: { government: 18, 'open data': 10 },
    boostTerms: ['government', 'census', 'legislation', 'representatives', 'elections', 'bills', 'federal', 'agencies', 'public data', 'civic'],
    weakTerms: ['public', 'data'],
  },
  commerce: {
    triggers: ['commerce', 'products', 'product', 'prices', 'deals', 'coupons', 'barcode', 'ecommerce', 'shopping', 'reviews', 'inventory', 'catalog', 'store'],
    categoryWeights: { ecommerce: 18, shopping: 16, 'test data': 14, food: 10, 'food & drink': 10, 'open data': 3 },
    boostTerms: ['commerce', 'products', 'product', 'prices', 'deals', 'coupons', 'barcode', 'ecommerce', 'shopping', 'reviews', 'inventory', 'catalog', 'store'],
    weakTerms: ['price', 'prices'],
  },
};

const CURATED_APIS = [
  { name: 'CoinMarketCap', url: 'https://coinmarketcap.com/api/', description: 'Popular cryptocurrency market data, rankings, quotes, metadata, and exchange data.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Cryptocurrency', source: 'curated', sourceWeight: 5 },
  { name: 'CoinGecko', url: 'https://www.coingecko.com/en/api', description: 'Popular cryptocurrency prices, market data, tokens, exchanges, and DeFi data.', auth: 'apiKey', https: true, cors: 'Yes', category: 'Cryptocurrency', source: 'curated', sourceWeight: 5 },

  { name: 'Coinpaprika', url: 'https://api.coinpaprika.com/', description: 'Cryptocurrency prices, coins, market data, exchanges, and historical data.', auth: 'No', https: true, cors: 'Yes', category: 'Cryptocurrency', source: 'curated', sourceWeight: 5 },
  { name: 'CoinCap', url: 'https://docs.coincap.io/', description: 'Real-time cryptocurrency prices, assets, rates, exchanges, and markets.', auth: 'No', https: true, cors: 'Unknown', category: 'Cryptocurrency', source: 'curated', sourceWeight: 5 },
  { name: 'Coinbase', url: 'https://docs.cloud.coinbase.com/', description: 'Coinbase crypto exchange, wallet, price, account, and trading APIs.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Cryptocurrency', source: 'curated', sourceWeight: 5 },
  { name: 'Alpha Vantage', url: 'https://www.alphavantage.co/documentation/', description: 'Stock, ETF, forex, crypto, technical indicators, and market data API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Finance', source: 'curated', sourceWeight: 5 },
  { name: 'Polygon', url: 'https://polygon.io/docs/', description: 'Stock market, options, forex, crypto, tickers, trades, aggregates, and historical market data.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Finance', source: 'curated', sourceWeight: 5 },
  { name: 'Twelve Data', url: 'https://twelvedata.com/docs', description: 'Stock, forex, ETF, index, and crypto market data with real-time and historical prices.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Finance', source: 'curated', sourceWeight: 5 },
  { name: 'Tradier', url: 'https://developer.tradier.com/', description: 'US equity, options, quotes, market data, trading, and brokerage API.', auth: 'OAuth', https: true, cors: 'Yes', category: 'Finance', source: 'curated', sourceWeight: 5 },
  { name: 'Finnhub', url: 'https://finnhub.io/docs/api', description: 'Real-time stock, forex, crypto, company fundamentals, news, and alternative market data.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Finance', source: 'curated', sourceWeight: 5 },
  { name: 'Open-Meteo', url: 'https://open-meteo.com/en/docs', description: 'Free weather forecast, historical weather, climate, geocoding, and marine weather APIs.', auth: 'No', https: true, cors: 'Yes', category: 'Weather', source: 'curated', sourceWeight: 5 },
  { name: 'National Weather Service API', url: 'https://www.weather.gov/documentation/services-web-api', description: 'US weather alerts, forecasts, observations, radar stations, and gridpoint weather data.', auth: 'No', https: true, cors: 'Yes', category: 'Weather', source: 'curated', sourceWeight: 5 },
  { name: 'Pirate Weather', url: 'https://pirateweather.net/en/latest/', description: 'Weather forecast API compatible with Dark Sky-style forecast data.', auth: 'No', https: true, cors: 'Yes', category: 'Weather', source: 'curated', sourceWeight: 5 },
  { name: 'Geocod.io', url: 'https://www.geocod.io/docs/', description: 'Forward and reverse geocoding, address parsing, coordinates, and census data.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Geocoding', source: 'curated', sourceWeight: 5 },
  { name: 'GraphHopper', url: 'https://docs.graphhopper.com/', description: 'Routing, navigation, route optimization, matrix, geocoding, and map matching APIs.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Geocoding', source: 'curated', sourceWeight: 5 },
  { name: 'GraphQL Jobs', url: 'https://graphql.jobs/docs/api/', description: 'GraphQL job listings and employment search API.', auth: 'No', https: true, cors: 'Yes', category: 'Jobs', source: 'curated', sourceWeight: 5 },
  { name: 'Search.gov Jobs', url: 'https://search.gov/developer/jobs.html', description: 'US government job openings and federal jobs search API.', auth: 'No', https: true, cors: 'Unknown', category: 'Jobs', source: 'curated', sourceWeight: 5 },
  { name: 'API-FOOTBALL', url: 'https://www.api-football.com/documentation-v3', description: 'Football/soccer fixtures, standings, teams, players, odds, predictions, and stats.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Sports & Fitness', source: 'curated', sourceWeight: 5 },
  { name: 'Football-Data', url: 'https://www.football-data.org/documentation/quickstart', description: 'Football competitions, teams, fixtures, matches, standings, and scores.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Sports & Fitness', source: 'curated', sourceWeight: 5 },
  { name: 'TVMaze', url: 'https://www.tvmaze.com/api', description: 'TV shows, episodes, schedules, cast, search, and show metadata API.', auth: 'No', https: true, cors: 'Yes', category: 'Entertainment', source: 'curated', sourceWeight: 5 },
  { name: 'Jikan', url: 'https://docs.api.jikan.moe/', description: 'Unofficial MyAnimeList anime, manga, characters, rankings, and search API.', auth: 'No', https: true, cors: 'Yes', category: 'Anime', source: 'curated', sourceWeight: 5 },
  { name: 'AniList', url: 'https://docs.anilist.co/', description: 'Anime and manga GraphQL API for titles, characters, studios, staff, and lists.', auth: 'OAuth', https: true, cors: 'Yes', category: 'Anime', source: 'curated', sourceWeight: 5 },
  { name: 'GNews', url: 'https://gnews.io/docs/', description: 'News headlines, article search, topics, countries, and languages API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'News', source: 'curated', sourceWeight: 5 },
  { name: 'Currents', url: 'https://currentsapi.services/en/docs/', description: 'Latest news, headlines, search, topics, regions, and languages API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'News', source: 'curated', sourceWeight: 5 },
  { name: 'Data.gov', url: 'https://api.data.gov/docs/', description: 'US government API catalog and API key access for federal public data APIs.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Government', source: 'curated', sourceWeight: 5 },
  { name: 'Open Food Facts', url: 'https://world.openfoodfacts.org/data', description: 'Food product database with barcodes, ingredients, nutrition, labels, and product metadata.', auth: 'No', https: true, cors: 'Yes', category: 'Food & Drink', source: 'curated', sourceWeight: 5 },
  { name: 'Barcode Lookup', url: 'https://www.barcodelookup.com/api', description: 'Barcode, UPC, EAN, product lookup, catalog, pricing, images, and store product data.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Shopping', source: 'curated', sourceWeight: 5 },
  { name: 'OpenWeather', url: 'https://openweathermap.org/api', description: 'Weather forecasts, current weather, historical weather, alerts, geocoding, and maps.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Weather', source: 'curated', sourceWeight: 5 },
  { name: 'News API', url: 'https://newsapi.org/', description: 'News headlines and article search across publishers and topics.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'News', source: 'curated', sourceWeight: 5 },
  { name: 'The Guardian Open Platform', url: 'https://open-platform.theguardian.com/', description: 'Guardian articles, sections, tags, search, and content API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'News', source: 'curated', sourceWeight: 5 },
  { name: 'TMDb', url: 'https://developer.themoviedb.org/docs', description: 'Movie and TV metadata, ratings, posters, images, actors, and discovery.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Entertainment', source: 'curated', sourceWeight: 5 },
  { name: 'OMDb', url: 'https://www.omdbapi.com/', description: 'Movie and TV metadata by IMDb ID or title.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Entertainment', source: 'curated', sourceWeight: 5 },
  { name: 'OpenStreetMap Nominatim', url: 'https://nominatim.org/release-docs/latest/api/Overview/', description: 'OpenStreetMap geocoding and reverse geocoding API.', auth: 'No', https: true, cors: 'Yes', category: 'Geocoding', source: 'curated', sourceWeight: 5 },
  { name: 'Mapbox', url: 'https://docs.mapbox.com/api/', description: 'Maps, geocoding, routing, navigation, tiles, and location APIs.', auth: 'apiKey', https: true, cors: 'Yes', category: 'Geocoding', source: 'curated', sourceWeight: 5 },
  { name: 'USAJOBS', url: 'https://developer.usajobs.gov/', description: 'US federal government job listings and hiring data.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Jobs', source: 'curated', sourceWeight: 5 },
  { name: 'Adzuna', url: 'https://developer.adzuna.com/', description: 'Job search, salary, vacancies, and employment market data.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Jobs', source: 'curated', sourceWeight: 5 },
  { name: 'TheSportsDB', url: 'https://www.thesportsdb.com/api.php', description: 'Sports teams, leagues, events, scores, players, and media.', auth: 'apiKey', https: true, cors: 'Yes', category: 'Sports & Fitness', source: 'curated', sourceWeight: 5 },
  { name: 'balldontlie', url: 'https://www.balldontlie.io/', description: 'Basketball/NBA teams, players, games, stats, and seasons.', auth: 'No', https: true, cors: 'Yes', category: 'Sports & Fitness', source: 'curated', sourceWeight: 5 },
  { name: 'Census Data API', url: 'https://www.census.gov/data/developers/data-sets.html', description: 'US Census datasets, demographics, geography, ACS, and economic data.', auth: 'No', https: true, cors: 'Yes', category: 'Government', source: 'curated', sourceWeight: 5 },
  { name: 'OpenFEC', url: 'https://api.open.fec.gov/developers/', description: 'US campaign finance, candidates, committees, filings, and election data.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Government', source: 'curated', sourceWeight: 5 },
  { name: 'Fake Store API', url: 'https://fakestoreapi.com/', description: 'Fake ecommerce products, carts, users, and categories for demos and prototypes.', auth: 'No', https: true, cors: 'Yes', category: 'Shopping', source: 'curated', sourceWeight: 5 },
  { name: 'Open Food Facts', url: 'https://world.openfoodfacts.org/data', description: 'Food product database with barcodes, ingredients, nutrition, and labels.', auth: 'No', https: true, cors: 'Yes', category: 'Food', source: 'curated', sourceWeight: 5 },
];

function compactName(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }
const KNOWN_BEST_NAMES = new Map(CURATED_APIS.map(api => [compactName(api.name), 15]));

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
    let categoryBoost = null;
    for (const [category, weight] of Object.entries(profile.categoryWeights || {})) {
      if (cat.includes(category)) categoryBoost = categoryBoost === null ? weight : Math.max(categoryBoost, weight);
    }
    categoryBoost = categoryBoost ?? 0;
    const categoryHit = categoryBoost !== 0;
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
  --source <name>    Filter by source: public-api-lists, public-apis, apis-guru, curated
  --no-auth          Only APIs with Auth = No
  --https            Only HTTPS APIs
  --cors <value>     Filter by CORS: Yes, No, Unknown
  --openapi          Only APIs with OpenAPI specs
  --limit <n>        Max results (default: 8)
  --check            Live-check result URLs and annotate reachability
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
    else if (a === '--check') args.check = true;
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

function asciiRatio(value) {
  const s = String(value || '');
  if (!s.length) return 1;
  let ascii = 0;
  for (const ch of s) if (ch.charCodeAt(0) <= 127) ascii++;
  return ascii / s.length;
}

function score(entry, queryTokens) {
  let base = textScore(entry, queryTokens);
  if (entry.openapiUrl) base += 2;
  if (entry.sources?.length > 1) base += 2;
  if (entry.auth === 'No') base += 1;
  if (entry.https) base += 1;
  if (asciiRatio(entry.name) < 0.7) base -= 60;
  else if (asciiRatio(`${entry.name || ''} ${entry.description || ''}`) < 0.65) base -= 18;
  const compactEntryName = compactName(entry.name);
  for (const [name, weight] of KNOWN_BEST_NAMES) {
    if (compactEntryName.includes(name) || name.includes(compactEntryName)) base += weight;
  }
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
  sourceStatus.curated = CURATED_APIS.length;
  entries.push(...CURATED_APIS);
  return { generatedAt: new Date().toISOString(), sourceStatus, entries: dedupe(entries) };
}

function keyFor(entry) {
  const compact = compactName(entry.name);
  if (KNOWN_BEST_NAMES.has(compact)) return `known:${compact}`;
  const host = String(entry.url || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  return `${compact}|${host}`;
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
    const domain = q.size ? domainAdjustment(e, q) : 0;
    if (q.size && matched === 0 && domain <= 0) return [];
    const s = q.size ? score(e, q) : 1;
    if (q.size && s <= 0) return [];
    return [{ ...e, score: s + (e.sourceWeight || 0) }];
  }).sort((a, b) => b.score - a.score || String(a.category).localeCompare(String(b.category)) || String(a.name).localeCompare(String(b.name))).slice(0, args.limit);
}

async function checkUrl(url, timeoutMs = 5000) {
  const startedAt = Date.now();

  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetch(url, {
        method,
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'user-agent': 'public-api-finder/0.4',
          ...(method === 'GET' ? { range: 'bytes=0-0' } : {}),
        },
      });

      return {
        ok: res.ok,
        status: res.status,
        method,
        finalUrl: res.url || url,
        latencyMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
      };
    } catch (err) {
      if (method === 'HEAD') continue;
      return {
        ok: false,
        status: null,
        method,
        finalUrl: url,
        latencyMs: Date.now() - startedAt,
        error: err.name === 'TimeoutError' ? 'timeout' : err.message,
        checkedAt: new Date().toISOString(),
      };
    }
  }
}

async function checkRows(rows) {
  const checked = [];
  for (const row of rows) {
    checked.push({ ...row, check: await checkUrl(row.url) });
  }
  return checked;
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
    if (e.check) {
      const status = e.check.ok ? 'reachable' : 'not reachable';
      const detail = e.check.status ? `HTTP ${e.check.status}` : e.check.error;
      console.log(`   - Live check: ${status} (${detail}, ${e.check.latencyMs}ms)`);
    }
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.query) {
    usage();
    return args.help ? 0 : 1;
  }
  let rows = filterEntries(await loadData(args.refresh), args);
  if (args.check) rows = await checkRows(rows);
  if (args.json) console.log(JSON.stringify(rows, null, 2));
  else printMarkdown(rows);
  return 0;
}

main().then(code => process.exitCode = code).catch(err => {
  console.error(`public-api-finder: ${err.message}`);
  process.exitCode = 1;
});
