#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCES = {
  publicApiLists: 'https://public-api-lists.github.io/public-api-lists/api/all.json',
  publicApisReadme: 'https://raw.githubusercontent.com/public-apis/public-apis/master/README.md',
  apisGuru: 'https://api.apis.guru/v2/list.json',
  apiMegaList: 'https://raw.githubusercontent.com/cporter202/API-mega-list/main/README.md',
};
const CACHE_PATH = process.env.PUBLIC_API_FINDER_CACHE || join(homedir(), '.cache', 'public-api-finder', 'all.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DATA_VERSION = 15;

const ENRICHMENT_FIELDS = [
  'tags',
  'useCases',
  'domains',
  'exampleQueries',
  'pricing',
  'freeTier',
  'authType',
  'providerType',
  'reliability',
  'docsQuality',
  'bestFor',
  'avoidFor',
  'rateLimit',
  'apiBase',
  'caveats',
];


const TARGETED_BOOSTS = [
  [/\b(login|openid|social auth|authentication|user profile)\b/, /\b(auth0|clerk|okta|openid connect|social login|authentication api)\b/i, 170],
  [/\b(temporary email|temp email|inbox|receive messages)\b/, /\b(mail\.tm|dropmail|mailbox|email|inbox)\b/i, 90],
  [/\b(otp|sms verification|phone number|line type)\b/, /\b(twilio verify|numverify|telnyx|vonage|phone number validation)\b/i, 170],
  [/\b(bank account|banking|plaid|iban|routing number)\b/, /\b(plaid|iban|bank|routing|teller|truelayer)\b/i, 90],
  [/\b(sales tax|tax rates|tax calculation|taxjar|avalara)\b/, /\b(taxjar|avalara|sales tax|tax rates)\b/i, 90],
  [/\b(address validation|normalize|usps)\b/, /\b(smarty|usps|address validation|street api|lob)\b/i, 80],
  [/\b(timezone|daylight savings|utc offset)\b/, /\b(timezonedb|timezone|utc offset|daylight savings)\b/i, 80],
  [/\b(company enrichment|business entity|secretary of state|brand colors|domain logo|logo from domain)\b/, /\b(opencorporates|brandfetch|clearbit|business entity|domain enrichment|brand logo)\b/i, 135],
  [/\b(screenshot|screenshots|website preview|link preview|open graph|website metadata|responsive preview|full page)\b/, /\b(microlink|urlbox|screenshot|screenshots|open graph|link preview|website metadata|responsive previews|full-page)\b/i, 210],
  [/\b(favicon)\b/, /\b(microlink|urlbox|favicon)\b/i, 70],
  [/\b(pdf|html to pdf)\b/, /\b(pdfshift|api2pdf|html to pdf|document rendering)\b/i, 175],
  [/\b(ocr|receipt|extract text)\b/, /\b(ocr|vision|mindee|receipt|document)\b/i, 125],
  [/\b(speech to text|transcription|audio transcription)\b/, /\b(assemblyai|deepgram|whisper|audio transcription|audio intelligence)\b/i, 175],
  [/\b(text to speech|voice generation|tts)\b/, /\b(elevenlabs|text to speech|voice|tts|deepgram)\b/i, 135],
  [/\b(image generation|stable diffusion)\b/, /\b(stability|stable diffusion|replicate|openai|image generation)\b/i, 135],
  [/\b(moderate images|image moderation|nudity|violence|safe search)\b/, /\b(sightengine|safe search|nudity|violence|offensive content)\b/i, 175],
  [/\b(sanctions|ofac|pep|kyc|aml)\b/, /\b(opensanctions|ofac|sanctions|pep|kyc|aml|chainalysis)\b/i, 135],
  [/\b(wallet risk|crypto sanctions|blockchain wallet risk)\b/, /\b(chainalysis|trm|elliptic|sanctions|wallet risk)\b/i, 95],
  [/\b(crypto token metadata|token metadata|token logos|coin logos|logos contract addresses)\b/, /\b(coinmarketcap|coingecko|coinpaprika|coinbase|token logos|coin metadata|coin images)\b/i, 90],
  [/\b(zipcode|zip code|postal code)\b/, /\b(zippopotam|zip|postal|census)\b/i, 80],
  [/\b(real estate|property value|rent estimate)\b/, /\b(rentcast|attom|zillow|real estate|property|rent estimate)\b/i, 135],
  [/\b(mortgage|mortgage rates|loan calculator|loan rate|home loan)\b/, /\b(mortgage|home loan|loan rate)\b/i, 230],
  [/\b(flight status|airport|arrivals|departures)\b/, /\b(aviationstack|amadeus|flight|airport|arrivals|departures)\b/i, 135],
  [/\b(hotel search|hotel booking|booking availability)\b/, /\b(amadeus|hotel|booking|availability)\b/i, 135],
];

const DOMAIN_PROFILES = {
  crypto: {
    triggers: ['crypto', 'cryptocurrency', 'cryptocurrencies', 'bitcoin', 'ethereum', 'solana', 'blockchain', 'defi', 'token', 'tokens', 'coin', 'coins', 'wallet'],
    categoryWeights: { cryptocurrency: 22, 'currency exchange': 3, finance: -4, financial: -4 },
    boostTerms: ['crypto', 'cryptocurrency', 'bitcoin', 'ethereum', 'solana', 'blockchain', 'defi', 'token', 'coin', 'wallet'],
    weakTerms: ['price', 'prices', 'market', 'exchange'],
  },
  finance: {
    triggers: ['stock', 'stocks', 'equity', 'equities', 'market', 'trading', 'ticker', 'tickers', 'quote', 'quotes', 'etf', 'forex', 'portfolio', 'options'],
    categoryWeights: { finance: 16, financial: 16, 'currency exchange': 5, cryptocurrency: -18, blockchain: -18 },
    boostTerms: ['stock', 'stocks', 'equity', 'market', 'trading', 'ticker', 'quote', 'quotes', 'forex', 'portfolio', 'options', 'historical'],
    weakTerms: ['quote', 'quotes', 'price', 'prices', 'market'],
  },
  communication: {
    triggers: ['sms', 'messaging', 'message', 'messages', 'text', 'texts', 'send', 'twilio', 'whatsapp', 'email', 'notification', 'notifications'],
    categoryWeights: { communication: 24, messaging: 24, openapi: 4, cloud: -18 },
    boostTerms: ['sms', 'messaging', 'message', 'messages', 'send text', 'twilio', 'whatsapp', 'notification', 'notifications'],
    weakTerms: ['send', 'text', 'openapi'],
  },
  dns: {
    triggers: ['domain', 'domains', 'whois', 'dns', 'ssl', 'certificate', 'certificates', 'records', 'lookup'],
    categoryWeights: { security: 22, development: 12, developer: 12, geocoding: -14, location: -10, cloud: -8 },
    boostTerms: ['whois', 'dns', 'ssl', 'certificate', 'certificates', 'domain lookup', 'dns records', 'nameserver'],
    weakTerms: ['lookup', 'records'],
  },
  qr: {
    triggers: ['qr', 'qrcode', 'barcode'],
    categoryWeights: { development: 14, developer: 14, utility: 14, tools: 14, 'test data': 6, media: -10, weather: -10 },
    boostTerms: ['qr', 'qrcode', 'qr code', 'code generation', 'barcode'],
    weakTerms: ['code', 'generation', 'api'],
  },
  urlshortener: {
    triggers: ['shorten', 'shortener', 'shorteners', 'url', 'urls', 'links', 'branded', 'bitly'],
    categoryWeights: { 'url shortener': 24, development: 12, developer: 12, utility: 12, analytics: -8 },
    boostTerms: ['url shortener', 'shorten urls', 'short links', 'branded links', 'bitly', 'link analytics'],
    weakTerms: ['links', 'analytics'],
  },
  avatars: {
    triggers: ['avatar', 'avatars', 'identicon', 'identicons', 'profile', 'pictures', 'placeholder', 'svg', 'blockies'],
    categoryWeights: { 'test data': 18, development: 16, media: 8, cryptocurrency: -8, cloud: -18 },
    boostTerms: ['avatar', 'avatars', 'identicon', 'identicons', 'profile pictures', 'placeholder users', 'svg avatars', 'wallet address', 'blockies'],
    weakTerms: ['profile', 'pictures', 'placeholder'],
  },
  nfts: {
    triggers: ['nft', 'nfts', 'metadata', 'contract', 'token', 'tokenid', 'erc20', 'erc721', 'erc1155', 'wallet', 'balance', 'transactions', 'transfers'],
    categoryWeights: { cryptocurrency: 24, blockchain: 24, finance: -12, media: -12, podcasts: -18, cloud: -24 },
    boostTerms: ['nft metadata', 'contract address', 'token id', 'wallet balance', 'erc20', 'erc721', 'erc1155', 'transactions', 'transfers', 'alchemy', 'moralis', 'etherscan'],
    weakTerms: ['metadata', 'token', 'contract'],
  },
  vehicle: {
    triggers: ['vehicle', 'vehicles', 'vin', 'recall', 'recalls', 'license', 'plate', 'nhtsa', 'car', 'cars'],
    categoryWeights: { transportation: 22, government: 14, 'open data': 12, security: -12, 'sports & fitness': -18, 'test data': -18 },
    boostTerms: ['vin', 'vin decode', 'vehicle', 'vehicles', 'recalls', 'safety data', 'license plate', 'nhtsa'],
    weakTerms: ['lookup', 'data'],
  },
  anime: {
    triggers: ['anime', 'manga', 'myanimelist'],
    categoryWeights: { anime: 30, entertainment: 6, media: 4, video: -8 },
    boostTerms: ['anime', 'manga', 'myanimelist', 'characters', 'rankings'],
    weakTerms: ['search'],
  },
  images: {
    triggers: ['image', 'images', 'photo', 'photos', 'photography', 'unsplash', 'pexels', 'pixabay', 'openverse'],
    categoryWeights: { photography: 24, images: 24, media: 12, entertainment: 8, jobs: -12, 'test data': -12, development: -14 },
    boostTerms: ['image search', 'photo search', 'photos', 'photography', 'unsplash', 'pexels', 'pixabay', 'openverse', 'wikimedia'],
    weakTerms: ['search', 'free'],
  },
  fun: {
    triggers: ['joke', 'jokes', 'meme', 'memes', 'cat', 'cats', 'dog', 'dogs', 'facts'],
    categoryWeights: { entertainment: 18, animals: 24, media: 8, 'test data': -6 },
    boostTerms: ['joke', 'jokes', 'meme', 'memes', 'quote', 'quotes', 'cat images', 'dog facts', 'random cat', 'random dog'],
    weakTerms: ['random', 'facts'],
  },
  languageai: {
    triggers: ['translation', 'translate', 'language', 'detect', 'sentiment', 'moderation', 'toxicity', 'nlp'],
    categoryWeights: { language: 24, 'text analysis': 24, 'machine learning': 18, ai: 18, messaging: -18, cloud: -8 },
    boostTerms: ['translation', 'translate', 'language detect', 'sentiment analysis', 'moderation', 'toxicity', 'nlp', 'text analysis', 'libretranslate', 'perspective'],
    weakTerms: ['text', 'api'],
  },
  calendarapi: {
    triggers: ['calendar', 'calendars', 'events', 'event', 'google calendar', 'oauth'],
    categoryWeights: { calendar: 24, calendars: 24, openapi: 6, analytics: -18 },
    boostTerms: ['calendar events', 'google calendar', 'create events', 'oauth', 'ical'],
    weakTerms: ['events', 'create'],
  },
  logistics: {
    triggers: ['tracking', 'shipment', 'shipments', 'carrier', 'carriers', 'shipping', 'ups', 'fedex'],
    categoryWeights: { logistics: 24, tracking: 24, commerce: 10, ecommerce: 8, development: -12, media: -12 },
    boostTerms: ['package tracking', 'shipment tracking', 'carrier tracking', 'shipping', 'ups', 'fedex', 'aftership', 'shippo'],
    weakTerms: ['tracking'],
  },
  devsec: {
    triggers: ['cve', 'vulnerability', 'vulnerabilities', 'github', 'repo', 'repos', 'stars', 'issues', 'commits', 'npm', 'downloads', 'docker', 'registry', 'tags'],
    categoryWeights: { security: 20, development: 18, 'open data': 10, cloud: -10, media: -12, books: -12 },
    boostTerms: ['cve', 'vulnerability', 'vulnerabilities', 'osv', 'nvd', 'github repo', 'repo stars', 'issues', 'commits', 'npm package', 'package downloads', 'docker image', 'registry api', 'image tags'],
    weakTerms: ['package', 'image', 'metadata'],
  },
  weather: {
    triggers: ['weather', 'forecast', 'radar', 'temperature', 'climate', 'alerts', 'precipitation'],
    categoryWeights: { weather: 18, location: 4 },
    boostTerms: ['weather', 'forecast', 'radar', 'temperature', 'climate', 'alerts', 'precipitation', 'meteorological'],
    weakTerms: ['daily', 'hourly'],
  },
  maps: {
    triggers: ['maps', 'map', 'geocoding', 'reverse', 'address', 'coordinates', 'places', 'place', 'restaurant', 'restaurants', 'nearby', 'routing', 'distance', 'timezone', 'location', 'navigation'],
    categoryWeights: { geocoding: 18, location: 14, 'open data': 3, photography: -16, media: -8 },
    boostTerms: ['map', 'maps', 'geocoding', 'geocoder', 'reverse', 'address', 'coordinates', 'routing', 'places', 'restaurant', 'nearby', 'opening hours', 'location', 'navigation', 'timezone'],
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
    triggers: ['government', 'census', 'legislation', 'representatives', 'elections', 'election', 'campaign', 'donations', 'candidates', 'bills', 'federal', 'agencies', 'public', 'civic'],
    categoryWeights: { government: 18, 'open data': 12, finance: -12, financial: -12, cryptocurrency: -12 },
    boostTerms: ['government', 'census', 'legislation', 'representatives', 'elections', 'election', 'campaign finance', 'campaign', 'donations', 'candidates', 'bills', 'federal', 'agencies', 'public data', 'civic'],
    weakTerms: ['public', 'data'],
  },
  commerce: {
    triggers: ['commerce', 'products', 'product', 'prices', 'deals', 'coupons', 'barcode', 'ecommerce', 'shopping', 'reviews', 'inventory', 'catalog', 'store'],
    categoryWeights: { ecommerce: 18, shopping: 16, 'test data': 14, food: 10, 'food & drink': 10, 'open data': 3 },
    boostTerms: ['commerce', 'products', 'product', 'prices', 'deals', 'coupons', 'barcode', 'ecommerce', 'shopping', 'reviews', 'inventory', 'catalog', 'store'],
    weakTerms: ['price', 'prices'],
  },
  payments: {
    triggers: ['payment', 'payments', 'billing', 'checkout', 'invoice', 'invoices', 'stripe', 'subscription', 'subscriptions'],
    categoryWeights: { payments: 22, ecommerce: 6, openapi: 2, financial: -4, finance: -4, cloud: -10 },
    boostTerms: ['payment', 'payments', 'billing', 'checkout', 'invoice', 'invoices', 'stripe', 'subscription', 'subscriptions'],
    weakTerms: ['openapi', 'api'],
  },
  email: {
    triggers: ['email', 'emails', 'mailbox', 'deliverability', 'validation', 'verify', 'verification'],
    categoryWeights: { email: 22, communication: 8, openapi: 3 },
    boostTerms: ['email', 'mailbox', 'deliverability', 'validation', 'verify', 'verification', 'smtp'],
    weakTerms: ['validation'],
  },
  ip: {
    triggers: ['ip', 'geolocation', 'geoip', 'asn', 'whois'],
    categoryWeights: { geocoding: 12, location: 14, security: 14, openapi: -8, cloud: -24 },
    boostTerms: ['ip', 'geolocation', 'geoip', 'asn', 'whois', 'country', 'city', 'vpn', 'proxy', 'privacy', 'reputation', 'threat'],
    weakTerms: ['geolocation'],
  },
  dictionary: {
    triggers: ['dictionary', 'definitions', 'definition', 'word', 'words', 'thesaurus', 'phonetics'],
    categoryWeights: { dictionaries: 24, dictionary: 24, education: 8, development: -12, openapi: -8, cloud: -24 },
    boostTerms: ['dictionary', 'definition', 'definitions', 'word', 'words', 'thesaurus', 'phonetics', 'pronunciation'],
    weakTerms: ['api'],
  },
  books: {
    triggers: ['book', 'books', 'isbn', 'authors', 'author', 'covers', 'cover', 'library', 'libraries', 'ebooks'],
    categoryWeights: { books: 24, education: 12, 'open data': 8, government: -10, cloud: -18 },
    boostTerms: ['book', 'books', 'isbn', 'authors', 'author', 'covers', 'cover', 'open library', 'public domain', 'ebooks', 'metadata'],
    weakTerms: ['public', 'search'],
  },
  podcasts: {
    triggers: ['podcast', 'podcasts', 'rss', 'itunes'],
    categoryWeights: { podcasts: 24, media: 14, entertainment: 10, music: 8, anime: -12, video: -8, cloud: -18 },
    boostTerms: ['podcast', 'podcasts', 'episode', 'episodes', 'rss', 'itunes', 'audio', 'show metadata'],
    weakTerms: ['search', 'metadata'],
  },
  food: {
    triggers: ['recipe', 'recipes', 'nutrition', 'ingredients', 'ingredient', 'calories', 'food', 'meal', 'meals'],
    categoryWeights: { food: 18, 'food & drink': 18, health: 6, social: -8 },
    boostTerms: ['recipe', 'recipes', 'nutrition', 'ingredients', 'ingredient', 'calories', 'food', 'meal', 'meals'],
    weakTerms: ['data'],
  },
  environment: {
    triggers: ['air', 'quality', 'pollution', 'aqi', 'environment', 'environmental', 'climate', 'carbon', 'emissions', 'electricity', 'grid', 'intensity'],
    categoryWeights: { environment: 20, science: 10, 'science & math': 10, weather: 5 },
    boostTerms: ['air quality', 'pollution', 'aqi', 'environment', 'environmental', 'climate', 'particulate', 'carbon intensity', 'carbon', 'emissions', 'electricity grid', 'grid intensity'],
    weakTerms: ['quality'],
  },
  currency: {
    triggers: ['currency', 'currencies', 'exchange', 'forex', 'fx', 'rates', 'conversion'],
    categoryWeights: { 'currency exchange': 24, finance: 3, financial: 3, cryptocurrency: -24 },
    boostTerms: ['currency', 'currencies', 'exchange rates', 'forex', 'fx', 'conversion'],
    weakTerms: ['rates', 'exchange'],
  },
  holidays: {
    triggers: ['holiday', 'holidays', 'calendar', 'calendars', 'observance', 'observances'],
    categoryWeights: { calendar: 22, calendars: 22, date: 12, government: -6 },
    boostTerms: ['holiday', 'holidays', 'calendar', 'observance', 'public holidays', 'bank holidays'],
    weakTerms: ['public'],
  },
  testdata: {
    triggers: ['random', 'fake', 'mock', 'test', 'dummy', 'sample', 'user', 'users', 'placeholder'],
    categoryWeights: { 'test data': 26, development: 8, shopping: 3, 'sports & fitness': -10, cryptocurrency: -12 },
    boostTerms: ['random user', 'fake', 'mock', 'test data', 'dummy', 'sample', 'placeholder', 'users'],
    weakTerms: ['data', 'user'],
  },
  transit: {
    triggers: ['transit', 'transport', 'transportation', 'bus', 'rail', 'train', 'subway', 'gtfs', 'routes', 'stops'],
    categoryWeights: { transportation: 24, transit: 24, open_data: 4, 'open data': 4, government: 2, food: -12, 'sports & fitness': -12 },
    boostTerms: ['transit', 'transport', 'transportation', 'bus', 'rail', 'train', 'subway', 'gtfs', 'routes', 'stops'],
    weakTerms: ['open', 'data'],
  },
};

const CURATED_APIS = [
  { name: 'DexScreener', url: 'https://docs.dexscreener.com/api/reference', description: 'No-auth DEX token search, pair lookup, token prices, liquidity, volume, boosted tokens, and trending pool data across many chains.', auth: 'No', authType: 'none', https: true, cors: 'Unknown', category: 'Cryptocurrency', source: 'curated', sourceWeight: 8, providerType: 'dex-market-data', pricing: 'free public API', freeTier: 'public endpoints; documented rate limits include 60 rpm for profile/boost endpoints and higher pair/search limits', reliability: 'high', docsQuality: 'good', domains: ['crypto', 'defi', 'dex', 'on-chain'], tags: ['crypto prices', 'token price', 'dex pairs', 'liquidity pools', 'trending tokens', 'solana', 'ethereum', 'base', 'memecoins'], useCases: ['find token price by contract address', 'discover DEX pairs and liquidity', 'build crypto trend scanners', 'show token charts from pool data'], exampleQueries: ['crypto prices no auth', 'token price by contract address', 'dex liquidity pairs', 'trending solana tokens'], caveats: ['Not a centralized exchange order book; verify chain IDs and rate limits before production use.'] },
  { name: 'CoinMarketCap', url: 'https://coinmarketcap.com/api/', description: 'Cryptocurrency market data for coin rankings, latest quotes, metadata, exchange data, fiat conversion, and global metrics.', auth: 'apiKey', authType: 'apiKey', https: true, cors: 'Unknown', category: 'Cryptocurrency', source: 'curated', sourceWeight: 7, providerType: 'centralized-market-data', pricing: 'free tier plus paid plans', freeTier: 'limited free/basic plan; commercial usage may need paid tier', reliability: 'high', docsQuality: 'good', domains: ['crypto', 'market-data'], tags: ['crypto prices', 'coin rankings', 'market cap', 'quotes', 'exchange data', 'metadata'], useCases: ['rank coins by market cap', 'get latest cryptocurrency quotes', 'map token symbols to metadata'], exampleQueries: ['crypto market cap rankings', 'bitcoin latest quote', 'coin metadata api'], caveats: ['Requires API key; strict plan limits on free/basic tiers.'] },
  { name: 'CoinGecko', url: 'https://www.coingecko.com/en/api', description: 'Cryptocurrency prices, market charts, coin metadata, exchanges, NFT data, derivatives, and CoinGecko on-chain DEX endpoints.', auth: 'apiKey', authType: 'apiKey', https: true, cors: 'Yes', category: 'Cryptocurrency', source: 'curated', sourceWeight: 7, providerType: 'centralized-and-onchain-market-data', pricing: 'demo/free access plus paid plans', freeTier: 'demo/public access with rate limits; paid for higher limits and pro data', reliability: 'high', docsQuality: 'good', domains: ['crypto', 'defi', 'nft', 'on-chain'], tags: ['crypto prices', 'market charts', 'coin metadata', 'exchanges', 'nft prices', 'on-chain dex data'], useCases: ['get common coin prices by ID', 'build market chart dashboards', 'combine centralized and on-chain crypto data'], exampleQueries: ['free crypto price api', 'coin market chart api', 'nft floor price api'], caveats: ['Coin IDs differ from symbols; free/demo limits can be tight for agents.'] },
  { name: 'DexPaprika', url: 'https://docs.dexpaprika.com/api-reference/introduction', description: 'DEX and on-chain data API from Coinpaprika for token prices, liquidity pools, swaps, volumes, transactions, and networks across 30+ chains.', auth: 'No', authType: 'none', https: true, cors: 'Unknown', category: 'Cryptocurrency', source: 'curated', sourceWeight: 7, providerType: 'dex-market-data', pricing: 'free public API', freeTier: 'public REST endpoints', reliability: 'medium', docsQuality: 'good', domains: ['crypto', 'defi', 'dex', 'on-chain'], tags: ['dex prices', 'token price', 'liquidity pools', 'swaps', 'transactions', 'on-chain volume', 'solana'], useCases: ['fetch latest token price in USD by network and address', 'inspect DEX pools and swaps', 'build DeFi dashboards'], exampleQueries: ['dexpaprika token price', 'on chain liquidity pool api', 'solana dex price api'], caveats: ['Newer API; verify supported networks and endpoint stability for production.'] },
  { name: 'DefiLlama', url: 'https://api-docs.defillama.com/', description: 'No-auth DeFi protocol TVL, chain TVL, yields, stablecoins, bridges, fees, revenue, DEX volumes, token prices, and protocol metrics.', auth: 'No', authType: 'none', https: true, cors: 'Unknown', category: 'Cryptocurrency', source: 'curated', sourceWeight: 7, providerType: 'defi-analytics', pricing: 'free public API plus pro API', freeTier: 'many public no-auth endpoints; Pro API for some advanced/beta metrics', reliability: 'high', docsQuality: 'good', domains: ['crypto', 'defi', 'open-data'], tags: ['defi tvl', 'protocol metrics', 'yields', 'stablecoins', 'bridges', 'fees', 'dex volume', 'token prices'], useCases: ['rank DeFi protocols by TVL', 'track chain TVL', 'find yield pools', 'monitor stablecoin supply'], exampleQueries: ['defi tvl no auth', 'stablecoin supply api', 'crypto yield pools api'], caveats: ['Methodology matters; TVL and category definitions should be explained to users.'] },
  { name: 'GeckoTerminal', url: 'https://apiguide.geckoterminal.com/', description: 'Free public on-chain DEX API by CoinGecko for token prices, pools, OHLCV charts, trades, networks, and market data across many chains.', auth: 'No', authType: 'none', https: true, cors: 'Unknown', category: 'Cryptocurrency', source: 'curated', sourceWeight: 7, providerType: 'dex-market-data', pricing: 'free public API; higher limits via CoinGecko paid plans', freeTier: 'free public API, commonly documented around 30 calls/minute', reliability: 'high', docsQuality: 'good', domains: ['crypto', 'defi', 'dex', 'on-chain'], tags: ['token price', 'ohlcv', 'liquidity pools', 'dex trades', 'on-chain market data', 'new pools'], useCases: ['price any on-chain token by pool address', 'fetch OHLCV candles for DEX pools', 'discover pools by token address'], exampleQueries: ['free on-chain token price api', 'dex ohlcv api', 'pool address price api'], caveats: ['Public rate limit is low; use CoinGecko paid /onchain endpoints for heavier workloads.'] },
  { name: 'Coinpaprika', url: 'https://api.coinpaprika.com/', description: 'No-auth cryptocurrency prices, coins, market data, exchanges, tickers, historical OHLCV, and global market data.', auth: 'No', authType: 'none', https: true, cors: 'Yes', category: 'Cryptocurrency', source: 'curated', sourceWeight: 6, providerType: 'centralized-market-data', pricing: 'free public endpoints plus paid plans', freeTier: 'free endpoints with rate limits', reliability: 'high', docsQuality: 'good', domains: ['crypto', 'market-data'], tags: ['crypto prices', 'tickers', 'ohlcv', 'coins', 'exchanges', 'historical data'], useCases: ['get no-auth crypto tickers', 'fetch OHLCV history', 'list coins and exchanges'], exampleQueries: ['no auth crypto prices', 'crypto historical ohlcv api'], caveats: ['Use IDs rather than ambiguous symbols where possible.'] },
  { name: 'CoinCap', url: 'https://docs.coincap.io/', description: 'Real-time cryptocurrency prices, assets, rates, exchanges, markets, candles, and WebSocket market data.', auth: 'No', authType: 'none', https: true, cors: 'Unknown', category: 'Cryptocurrency', source: 'curated', sourceWeight: 6, providerType: 'centralized-market-data', pricing: 'free public API', freeTier: 'public REST/WebSocket endpoints with rate limits', reliability: 'medium', docsQuality: 'fair', domains: ['crypto', 'market-data'], tags: ['crypto prices', 'assets', 'exchanges', 'markets', 'candles', 'websocket'], useCases: ['simple no-auth asset prices', 'stream crypto prices', 'fetch exchange markets'], exampleQueries: ['simple crypto price websocket', 'no auth coin assets api'], caveats: ['Docs and service limits should be rechecked before relying on it.'] },
  { name: 'Birdeye', url: 'https://docs.birdeye.so/', description: 'Multi-chain token market data API for Solana and EVM token prices, trades, OHLCV, wallet holdings, PnL, and trader analytics.', auth: 'apiKey', authType: 'apiKey', https: true, cors: 'Unknown', category: 'Cryptocurrency', source: 'curated', sourceWeight: 6, providerType: 'dex-market-data', pricing: 'free/limited access plus paid plans', freeTier: 'API key required; verify current free credits and chain coverage', reliability: 'high', docsQuality: 'good', domains: ['crypto', 'defi', 'dex', 'wallet-analytics'], tags: ['solana token price', 'evm token price', 'wallet analytics', 'trades', 'ohlcv', 'pnl', 'smart money'], useCases: ['build Solana token dashboards', 'analyze wallet holdings and PnL', 'monitor DEX trades'], exampleQueries: ['solana token price api', 'wallet pnl api', 'birdeye trades api'], caveats: ['API key and plan limits apply; some advanced analytics may be paid.'] },
  { name: '0x Swap API', url: 'https://0x.org/docs/api', description: 'DEX aggregator and swap API for quotes, prices, gasless swaps, liquidity routing, token metadata, and trading on EVM chains.', auth: 'apiKey', authType: 'apiKey', https: true, cors: 'Unknown', category: 'Cryptocurrency', source: 'curated', sourceWeight: 6, providerType: 'swap-aggregator', pricing: 'free to start; monetization/spread and integrator terms vary', freeTier: 'API key access; verify current rate limits', reliability: 'high', docsQuality: 'good', domains: ['crypto', 'defi', 'dex', 'payments'], tags: ['swap quote', 'token swap', 'dex aggregator', 'evm', 'price quote', 'trading'], useCases: ['quote token swaps', 'embed EVM swap flows', 'compare route prices across DEX liquidity'], exampleQueries: ['crypto swap quote api', 'evm token swap api', 'dex aggregator api'], caveats: ['Not a general market-data corpus; execution requires wallet/signing and chain-specific handling.'] },
  { name: 'Etherscan', url: 'https://docs.etherscan.io/', description: 'Ethereum explorer API for wallet balances, transactions, ERC20/ERC721/ERC1155 transfers, contract ABIs/source, gas, logs, and token data.', auth: 'apiKey', authType: 'apiKey', https: true, cors: 'Unknown', category: 'Cryptocurrency', source: 'curated', sourceWeight: 6, providerType: 'block-explorer', pricing: 'free tier plus paid plans', freeTier: 'free API key with rate limits', reliability: 'high', docsQuality: 'good', domains: ['crypto', 'blockchain', 'ethereum'], tags: ['wallet balance', 'transactions', 'erc20 transfers', 'nft transfers', 'contract abi', 'gas price', 'logs'], useCases: ['look up Ethereum wallet transactions', 'fetch contract ABI', 'index token transfers'], exampleQueries: ['ethereum wallet balance api', 'erc20 transfers api', 'contract abi api'], caveats: ['Explorer API, not full RPC; rate limits and indexing delays apply.'] },
  { name: 'Basescan', url: 'https://docs.etherscan.io/etherscan-v2/supported-chains', description: 'Base network explorer API via Etherscan v2 for Base wallet balances, transactions, token transfers, contract ABIs/source, gas, and logs.', auth: 'apiKey', authType: 'apiKey', https: true, cors: 'Unknown', category: 'Cryptocurrency', source: 'curated', sourceWeight: 6, providerType: 'block-explorer', pricing: 'free tier plus paid plans', freeTier: 'free API key with rate limits', reliability: 'high', docsQuality: 'good', domains: ['crypto', 'blockchain', 'base', 'ethereum'], tags: ['base wallet balance', 'base transactions', 'erc20 transfers', 'contract abi', 'logs', 'block explorer'], useCases: ['query Base account activity', 'fetch Base contract ABIs', 'monitor Base token transfers'], exampleQueries: ['base wallet balance api', 'basescan token transfers', 'base contract abi api'], caveats: ['Uses Etherscan API model; chain ID support and limits should be verified.'] },
  { name: 'Alchemy', url: 'https://docs.alchemy.com/reference', description: 'Blockchain developer APIs for JSON-RPC, NFT metadata, token balances, transfers, webhooks, simulation, account abstraction, and multi-chain node access.', auth: 'apiKey', authType: 'apiKey', https: true, cors: 'Unknown', category: 'Cryptocurrency', source: 'curated', sourceWeight: 6, providerType: 'node-and-indexing-platform', pricing: 'free tier plus paid plans', freeTier: 'free developer tier with compute-unit limits', reliability: 'high', docsQuality: 'excellent', domains: ['crypto', 'blockchain', 'nft', 'webhooks'], tags: ['rpc', 'nft metadata', 'token balances', 'transfers', 'webhooks', 'simulation', 'ethereum', 'base', 'polygon', 'solana'], useCases: ['read blockchain state via RPC', 'fetch wallet token balances', 'get NFT metadata and owners', 'subscribe to address activity'], exampleQueries: ['nft metadata api', 'ethereum rpc api', 'wallet token balances api'], caveats: ['Powerful but not no-auth; price and quotas depend on chain and method.'] },
  { name: 'Moralis', url: 'https://docs.moralis.com/web3-data-api', description: 'Web3 data APIs for wallet balances, token prices, NFTs, transfers, DeFi positions, streams, and multi-chain indexed blockchain data.', auth: 'apiKey', authType: 'apiKey', https: true, cors: 'Unknown', category: 'Cryptocurrency', source: 'curated', sourceWeight: 6, providerType: 'web3-data-platform', pricing: 'free tier plus paid plans', freeTier: 'free account tier with request/compute limits', reliability: 'high', docsQuality: 'good', domains: ['crypto', 'blockchain', 'nft', 'wallet-analytics'], tags: ['wallet balances', 'token price', 'nft metadata', 'transfers', 'defi positions', 'streams', 'multi-chain'], useCases: ['build wallet portfolio views', 'fetch token/NFT metadata', 'monitor address events with streams'], exampleQueries: ['wallet portfolio api', 'multi chain nft api', 'defi positions api'], caveats: ['Commercial platform; validate plan limits and supported chains.'] },
  { name: 'Coinbase', url: 'https://docs.cdp.coinbase.com/', description: 'Coinbase developer APIs for exchange data, wallets, onramp, trading, payments, and hosted crypto infrastructure.', auth: 'apiKey', authType: 'apiKey', https: true, cors: 'Unknown', category: 'Cryptocurrency', source: 'curated', sourceWeight: 5, providerType: 'exchange-and-wallet-platform', pricing: 'varies by Coinbase product', freeTier: 'developer access varies by API', reliability: 'high', docsQuality: 'good', domains: ['crypto', 'exchange', 'wallets', 'payments'], tags: ['exchange prices', 'wallets', 'trading', 'onramp', 'accounts', 'payments'], useCases: ['integrate Coinbase account/trading flows', 'fetch exchange market data', 'build crypto onramp experiences'], exampleQueries: ['coinbase exchange api', 'crypto onramp api', 'coinbase wallet api'], caveats: ['Product families differ; many endpoints require user auth or compliance review.'] },
  { name: 'Alpha Vantage', url: 'https://www.alphavantage.co/documentation/', description: 'Stock, ETF, forex, crypto, technical indicators, and market data API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Finance', source: 'curated', sourceWeight: 5 },
  { name: 'Polygon', url: 'https://polygon.io/docs/', description: 'Stock market, options, forex, crypto, tickers, trades, aggregates, and historical market data.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Finance', source: 'curated', sourceWeight: 5 },
  { name: 'Twelve Data', url: 'https://twelvedata.com/docs', description: 'Stock, forex, ETF, index, and crypto market data with real-time and historical prices.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Finance', source: 'curated', sourceWeight: 5 },
  { name: 'Tradier', url: 'https://developer.tradier.com/', description: 'US equity, options, quotes, market data, trading, and brokerage API.', auth: 'OAuth', https: true, cors: 'Yes', category: 'Finance', source: 'curated', sourceWeight: 5 },
  { name: 'Finnhub', url: 'https://finnhub.io/docs/api', description: 'Real-time stock, forex, crypto, company fundamentals, news, and alternative market data.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Finance', source: 'curated', sourceWeight: 5 },
  { name: 'Stooq', url: 'https://stooq.com/db/h/', description: 'Free historical stock quotes, daily prices, forex, indices, and CSV market data downloads.', auth: 'No', https: true, cors: 'Unknown', category: 'Finance', source: 'curated', sourceWeight: 5 },
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
  { name: 'iTunes Search API', url: 'https://performance-partners.apple.com/search-api', description: 'No-auth podcast, music, audiobook, movie, app, and episode search metadata from Apple/iTunes.', auth: 'No', https: true, cors: 'Unknown', category: 'Media', source: 'curated', sourceWeight: 5 },
  { name: 'Listen Notes', url: 'https://www.listennotes.com/api/docs/', description: 'Podcast search, episodes, shows, RSS metadata, recommendations, and podcast directory API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Podcasts', source: 'curated', sourceWeight: 5 },
  { name: 'OpenStreetMap Nominatim', url: 'https://nominatim.org/release-docs/latest/api/Overview/', description: 'OpenStreetMap geocoding and reverse geocoding API.', auth: 'No', https: true, cors: 'Yes', category: 'Geocoding', source: 'curated', sourceWeight: 5 },
  { name: 'Mapbox', url: 'https://docs.mapbox.com/api/', description: 'Maps, geocoding, routing, navigation, tiles, places, nearby search, and location APIs.', auth: 'apiKey', https: true, cors: 'Yes', category: 'Geocoding', source: 'curated', sourceWeight: 5 },
  { name: 'Foursquare Places', url: 'https://docs.foursquare.com/developer/reference/place-search', description: 'Places, restaurants, nearby search, opening hours, photos, categories, geocoding, and venue data.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Geocoding', source: 'curated', sourceWeight: 5 },
  { name: 'USAJOBS', url: 'https://developer.usajobs.gov/', description: 'US federal government job listings and hiring data.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Jobs', source: 'curated', sourceWeight: 5 },
  { name: 'Adzuna', url: 'https://developer.adzuna.com/', description: 'Job search, salary, vacancies, and employment market data.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Jobs', source: 'curated', sourceWeight: 5 },
  { name: 'TheSportsDB', url: 'https://www.thesportsdb.com/api.php', description: 'Sports teams, leagues, events, scores, players, and media.', auth: 'apiKey', https: true, cors: 'Yes', category: 'Sports & Fitness', source: 'curated', sourceWeight: 5 },
  { name: 'balldontlie', url: 'https://www.balldontlie.io/', description: 'Basketball/NBA teams, players, games, stats, and seasons.', auth: 'No', https: true, cors: 'Yes', category: 'Sports & Fitness', source: 'curated', sourceWeight: 5 },
  { name: 'Census Data API', url: 'https://www.census.gov/data/developers/data-sets.html', description: 'US Census datasets, demographics, geography, ACS, and economic data.', auth: 'No', https: true, cors: 'Yes', category: 'Government', source: 'curated', sourceWeight: 5 },
  { name: 'OpenFEC', url: 'https://api.open.fec.gov/developers/', description: 'US campaign finance, candidates, committees, filings, and election data.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Government', source: 'curated', sourceWeight: 5 },
  { name: 'Fake Store API', url: 'https://fakestoreapi.com/', description: 'Fake ecommerce products, carts, users, and categories for demos and prototypes.', auth: 'No', https: true, cors: 'Yes', category: 'Shopping', source: 'curated', sourceWeight: 5 },
  { name: 'Open Food Facts', url: 'https://world.openfoodfacts.org/data', description: 'Food product database with barcodes, ingredients, nutrition, and labels.', auth: 'No', https: true, cors: 'Yes', category: 'Food', source: 'curated', sourceWeight: 5 },
  { name: 'Stripe', url: 'https://docs.stripe.com/api', description: 'Payments, checkout, billing, invoices, subscriptions, and customer payment methods API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Payments', source: 'curated', sourceWeight: 5, openapiUrl: 'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json' },
  { name: 'PayPal', url: 'https://developer.paypal.com/api/rest/', description: 'Payments, checkout orders, invoices, subscriptions, payouts, and disputes API.', auth: 'OAuth', https: true, cors: 'Unknown', category: 'Payments', source: 'curated', sourceWeight: 5 },
  { name: 'Twilio Messaging', url: 'https://www.twilio.com/docs/messaging/api', description: 'SMS, MMS, WhatsApp, messaging services, message status, phone numbers, and text sending API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Communication', source: 'curated', sourceWeight: 5, openapiUrl: 'https://raw.githubusercontent.com/twilio/twilio-oai/main/spec/json/twilio_api_v2010.json' },
  { name: 'WhoisXML API', url: 'https://main.whoisxmlapi.com/', description: 'WHOIS, DNS lookup, domain availability, SSL certificates, reverse WHOIS, and threat intelligence APIs.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Security', source: 'curated', sourceWeight: 5 },
  { name: 'Google DNS', url: 'https://developers.google.com/speed/public-dns/docs/doh', description: 'DNS over HTTPS lookup API for DNS records, domain resolution, and public resolver queries.', auth: 'No', https: true, cors: 'Yes', category: 'Development', source: 'curated', sourceWeight: 5 },
  { name: 'SSL Labs', url: 'https://github.com/ssllabs/ssllabs-scan/blob/master/ssllabs-api-docs-v4.md', description: 'SSL certificate and TLS configuration assessment API for domains and HTTPS endpoints.', auth: 'No', https: true, cors: 'Unknown', category: 'Security', source: 'curated', sourceWeight: 5 },
  { name: 'Abstract Email Validation', url: 'https://www.abstractapi.com/email-verification-validation-api', description: 'Email validation, deliverability, typo detection, MX records, and disposable email checks.', auth: 'apiKey', https: true, cors: 'Yes', category: 'Email', source: 'curated', sourceWeight: 5 },
  { name: 'IPinfo', url: 'https://ipinfo.io/developers', description: 'IP geolocation, ASN, company, carrier, privacy, and hosted domains data.', auth: 'No', https: true, cors: 'Unknown', category: 'Geocoding', source: 'curated', sourceWeight: 5 },
  { name: 'IPQualityScore', url: 'https://www.ipqualityscore.com/documentation/proxy-detection-api/overview', description: 'IP reputation, VPN, proxy, TOR, bot, fraud score, privacy, and threat detection API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Security', source: 'curated', sourceWeight: 5 },
  { name: 'proxycheck.io', url: 'https://proxycheck.io/api/', description: 'IP proxy, VPN, TOR, datacenter, ASN, risk, and privacy detection API.', auth: 'No', https: true, cors: 'Unknown', category: 'Security', source: 'curated', sourceWeight: 5 },
  { name: 'Free Dictionary API', url: 'https://dictionaryapi.dev/', description: 'Free dictionary definitions, phonetics, pronunciations, parts of speech, meanings, and examples.', auth: 'No', https: true, cors: 'Yes', category: 'Dictionaries', source: 'curated', sourceWeight: 5 },
  { name: 'Open Library', url: 'https://openlibrary.org/developers/api', description: 'Books, authors, ISBN lookup, covers, works, editions, subjects, and public library metadata.', auth: 'No', https: true, cors: 'Yes', category: 'Books', source: 'curated', sourceWeight: 5 },
  { name: 'Gutendex', url: 'https://gutendex.com/', description: 'Project Gutenberg public domain books, authors, subjects, languages, formats, and ebook metadata.', auth: 'No', https: true, cors: 'Yes', category: 'Books', source: 'curated', sourceWeight: 5 },
  { name: 'spoonacular', url: 'https://spoonacular.com/food-api/docs', description: 'Recipes, ingredients, meal planning, nutrition, grocery products, and food ontology API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Food & Drink', source: 'curated', sourceWeight: 5 },
  { name: 'OpenAQ', url: 'https://docs.openaq.org/', description: 'Open air quality measurements, locations, sensors, pollutants, and environmental monitoring data.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Environment', source: 'curated', sourceWeight: 5 },
  { name: 'UK Carbon Intensity', url: 'https://carbon-intensity.github.io/api-definitions/', description: 'Carbon intensity, electricity generation mix, grid emissions, forecasts, and regional energy data.', auth: 'No', https: true, cors: 'Unknown', category: 'Environment', source: 'curated', sourceWeight: 5 },
  { name: 'Electricity Maps', url: 'https://portal.electricitymaps.com/docs/getting-started', description: 'Electricity grid carbon intensity, power production, emissions, and regional energy mix API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Environment', source: 'curated', sourceWeight: 5 },
  { name: 'Frankfurter', url: 'https://www.frankfurter.app/docs', description: 'Currency exchange rates, conversion, historical rates, and time series data from ECB.', auth: 'No', https: true, cors: 'Yes', category: 'Currency Exchange', source: 'curated', sourceWeight: 5 },
  { name: 'Currency-api', url: 'https://github.com/fawazahmed0/currency-api#readme', description: 'Free currency exchange rates API with many currencies, no auth, and CDN-hosted JSON endpoints.', auth: 'No', https: true, cors: 'Yes', category: 'Currency Exchange', source: 'curated', sourceWeight: 5 },
  { name: 'Nager.Date', url: 'https://date.nager.at/Api', description: 'Public holidays by country and year, long weekends, country info, and calendar date data.', auth: 'No', https: true, cors: 'Yes', category: 'Calendar', source: 'curated', sourceWeight: 5 },
  { name: 'Calendarific', url: 'https://calendarific.com/api-documentation', description: 'Worldwide public holidays, observances, local holidays, and calendar metadata.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Calendar', source: 'curated', sourceWeight: 5 },
  { name: 'Random User Generator', url: 'https://randomuser.me/documentation', description: 'Random fake user profiles for mockups, tests, demos, placeholders, and sample data.', auth: 'No', https: true, cors: 'Yes', category: 'Test Data', source: 'curated', sourceWeight: 5 },
  { name: 'JSONPlaceholder', url: 'https://jsonplaceholder.typicode.com/', description: 'Fake REST API for posts, comments, albums, photos, todos, and users in demos and tests.', auth: 'No', https: true, cors: 'Yes', category: 'Test Data', source: 'curated', sourceWeight: 5 },
  { name: 'QuickChart QR Code', url: 'https://quickchart.io/documentation/qr-codes/', description: 'No-auth QR code generation API for URLs, text, images, charts, and embeddable frontend demos.', auth: 'No', https: true, cors: 'Yes', category: 'Development', source: 'curated', sourceWeight: 5 },
  { name: 'GoQR.me', url: 'https://goqr.me/api/', description: 'Free QR code generation API for creating QR images from text, URLs, and contact data.', auth: 'No', https: true, cors: 'Unknown', category: 'Development', source: 'curated', sourceWeight: 5 },
  { name: 'Bitly', url: 'https://dev.bitly.com/', description: 'URL shortener API for branded short links, link management, redirects, QR codes, and analytics.', auth: 'OAuth', https: true, cors: 'Unknown', category: 'URL Shortener', source: 'curated', sourceWeight: 5 },
  { name: 'TinyURL', url: 'https://tinyurl.com/app/dev', description: 'URL shortening API for creating short links, branded links, aliases, and link redirects.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'URL Shortener', source: 'curated', sourceWeight: 5 },
  { name: 'Transitland', url: 'https://www.transit.land/documentation/datastore/api-endpoints.html', description: 'Transit operators, routes, stops, schedules, GTFS feeds, and public transportation data.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Transportation', source: 'curated', sourceWeight: 5 },
  { name: 'Transport API', url: 'https://www.transportapi.com/developers/documentation/', description: 'UK transport, train, bus, routes, stops, departures, and journey planning API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Transportation', source: 'curated', sourceWeight: 5 },
  { name: 'OpenFEC', url: 'https://api.open.fec.gov/developers/', description: 'US election campaign finance data including candidates, committees, donations, filings, and spending.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Open Data', source: 'curated', sourceWeight: 5 },
  { name: 'DiceBear', url: 'https://www.dicebear.com/how-to-use/http-api/', description: 'No-auth avatar, identicon, profile picture, SVG, and placeholder image generation API.', auth: 'No', https: true, cors: 'Yes', category: 'Development', source: 'curated', sourceWeight: 5 },
  { name: 'Boring Avatars', url: 'https://boringavatars.com/', description: 'No-auth SVG avatar and identicon generation from names, seeds, or wallet-like strings.', auth: 'No', https: true, cors: 'Yes', category: 'Development', source: 'curated', sourceWeight: 5 },
  { name: 'Alchemy NFT API', url: 'https://docs.alchemy.com/reference/nft-api-quickstart', description: 'NFT metadata, owners, contract data, token IDs, wallet NFTs, transfers, and blockchain data.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Cryptocurrency', source: 'curated', sourceWeight: 5 },
  { name: 'Etherscan', url: 'https://docs.etherscan.io/', description: 'Ethereum wallet balances, transactions, ERC20/ERC721 transfers, contract data, gas, and token APIs.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Cryptocurrency', source: 'curated', sourceWeight: 5 },
  { name: 'NHTSA Vehicle API', url: 'https://vpic.nhtsa.dot.gov/api/', description: 'No-auth vehicle VIN decode, recalls, manufacturers, models, safety, and transportation data.', auth: 'No', https: true, cors: 'Unknown', category: 'Transportation', source: 'curated', sourceWeight: 5 },
  { name: 'Pexels', url: 'https://www.pexels.com/api/documentation/', description: 'Photo and image search API for stock photos, photography, collections, and media assets.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Photography', source: 'curated', sourceWeight: 5 },
  { name: 'Openverse', url: 'https://api.openverse.engineering/v1/', description: 'Openly licensed image search, photos, audio, media metadata, and public domain content.', auth: 'No', https: true, cors: 'Yes', category: 'Media', source: 'curated', sourceWeight: 5 },
  { name: 'Dog CEO', url: 'https://dog.ceo/dog-api/', description: 'No-auth random dog images and breed image API for demos and fun apps.', auth: 'No', https: true, cors: 'Yes', category: 'Animals', source: 'curated', sourceWeight: 5 },
  { name: 'The Cat API', url: 'https://thecatapi.com/', description: 'Random cat images, breeds, facts, votes, favorites, and cat media API.', auth: 'No', https: true, cors: 'Yes', category: 'Animals', source: 'curated', sourceWeight: 5 },
  { name: 'Official Joke API', url: 'https://official-joke-api.appspot.com/', description: 'No-auth random jokes, programming jokes, ten jokes, and entertainment demo data.', auth: 'No', https: true, cors: 'Yes', category: 'Entertainment', source: 'curated', sourceWeight: 5 },
  { name: 'Quotable', url: 'https://docs.quotable.io/', description: 'No-auth random quotes, authors, tags, search, and quote API for apps.', auth: 'No', https: true, cors: 'Yes', category: 'Entertainment', source: 'curated', sourceWeight: 5 },
  { name: 'LibreTranslate', url: 'https://libretranslate.com/docs/', description: 'Translation, language detection, text translation, and multilingual language API.', auth: 'No', https: true, cors: 'Unknown', category: 'Language', source: 'curated', sourceWeight: 5 },
  { name: 'Perspective API', url: 'https://developers.perspectiveapi.com/s/docs', description: 'Text moderation, toxicity, sentiment-like safety scoring, comments, and abuse detection API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Text Analysis', source: 'curated', sourceWeight: 5 },
  { name: 'Google Calendar API', url: 'https://developers.google.com/calendar/api/v3/reference', description: 'Calendar events create, update, list, OAuth calendars, reminders, attendees, and Google Calendar API.', auth: 'OAuth', https: true, cors: 'Unknown', category: 'Calendar', source: 'curated', sourceWeight: 5, openapiUrl: 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest' },
  { name: 'AfterShip Tracking', url: 'https://www.aftership.com/docs/tracking/quickstart/api-quick-start', description: 'Package tracking, shipment status, carrier detection, tracking numbers, UPS, FedEx, and logistics API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Logistics', source: 'curated', sourceWeight: 5 },
  { name: 'Shippo Tracking', url: 'https://docs.goshippo.com/shippoapi/public-api/', description: 'Shipment tracking, carrier tracking, labels, parcels, rates, UPS, FedEx, USPS, and logistics API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Logistics', source: 'curated', sourceWeight: 5 },
  { name: 'OSV', url: 'https://google.github.io/osv.dev/api/', description: 'Open source vulnerability database for package CVEs, advisories, ecosystems, and security lookups.', auth: 'No', https: true, cors: 'Yes', category: 'Security', source: 'curated', sourceWeight: 5 },
  { name: 'NVD', url: 'https://nvd.nist.gov/developers/vulnerabilities', description: 'CVE vulnerability lookup, security advisories, CPEs, CVSS scores, and NVD vulnerability data.', auth: 'No', https: true, cors: 'Unknown', category: 'Security', source: 'curated', sourceWeight: 5 },
  { name: 'GitHub REST API', url: 'https://docs.github.com/en/rest', description: 'GitHub repositories, stars, issues, commits, pull requests, releases, users, and org data API.', auth: 'No', https: true, cors: 'Yes', category: 'Development', source: 'curated', sourceWeight: 5 },
  { name: 'npm Registry API', url: 'https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md', description: 'No-auth npm package metadata, versions, downloads, dist-tags, registry documents, and package data.', auth: 'No', https: true, cors: 'Yes', category: 'Development', source: 'curated', sourceWeight: 5 },
  { name: 'Docker Hub', url: 'https://docs.docker.com/docker-hub/api/latest/', description: 'Docker image repositories, tags, registry metadata, namespaces, vulnerabilities, and container image data API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Development', source: 'curated', sourceWeight: 5 },

  { name: 'Auth0', url: 'https://auth0.com/docs/api', description: 'OAuth, OpenID Connect, login, user profiles, social auth, authentication, and identity APIs.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Authentication', source: 'curated', sourceWeight: 5 },
  { name: 'Clerk', url: 'https://clerk.com/docs/reference/backend-api', description: 'Authentication, user profiles, organizations, sessions, OAuth, social login, and identity APIs.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Authentication', source: 'curated', sourceWeight: 5 },
  { name: 'Mail.tm', url: 'https://docs.mail.tm/', description: 'No-auth temporary email inboxes, disposable mail accounts, receive messages, and testing email API.', auth: 'No', https: true, cors: 'Yes', category: 'Email', source: 'curated', sourceWeight: 5 },
  { name: 'Twilio Verify', url: 'https://www.twilio.com/docs/verify/api', description: 'SMS OTP verification, phone verification, one-time passcodes, factors, and verification checks.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Telecom', source: 'curated', sourceWeight: 5 },
  { name: 'numverify', url: 'https://numverify.com/documentation', description: 'Phone number validation, carrier, country, location, line type, and international number lookup API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Telecom', source: 'curated', sourceWeight: 5 },
  { name: 'Plaid', url: 'https://plaid.com/docs/api/', description: 'Bank account linking, transactions, balances, identity, auth, income, assets, and financial data API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Finance', source: 'curated', sourceWeight: 5 },
  { name: 'IBAN.com', url: 'https://www.iban.com/validation-api', description: 'IBAN validation, bank routing, SWIFT/BIC checks, payments validation, and bank data API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Financial', source: 'curated', sourceWeight: 5 },
  { name: 'TaxJar', url: 'https://developers.taxjar.com/api/reference/', description: 'Sales tax rates, tax calculation, address-based tax lookup, nexus, categories, and reporting API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Finance', source: 'curated', sourceWeight: 5 },
  { name: 'Avalara', url: 'https://developer.avalara.com/api-reference/avatax/rest/v2/', description: 'Sales tax rates, tax calculation, address validation, exemption certificates, and tax compliance API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Finance', source: 'curated', sourceWeight: 5 },
  { name: 'Smarty', url: 'https://www.smarty.com/docs/cloud/us-street-api', description: 'USPS address validation, autocomplete, normalization, deliverability, ZIP+4, and geocoding API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Geocoding', source: 'curated', sourceWeight: 5 },
  { name: 'TimeZoneDB', url: 'https://timezonedb.com/api', description: 'Timezone lookup, UTC offset, daylight savings, coordinates, zone names, and local time API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Geocoding', source: 'curated', sourceWeight: 5 },
  { name: 'OpenCorporates', url: 'https://api.opencorporates.com/documentation/API-Reference', description: 'Business entity search, company records, officers, filings, jurisdictions, and public company data.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Business', source: 'curated', sourceWeight: 5 },
  { name: 'Brandfetch', url: 'https://docs.brandfetch.com/reference/brand-api', description: 'Brand logo, domain logo, company colors, fonts, imagery, metadata, and brand enrichment API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Business', source: 'curated', sourceWeight: 5 },
  { name: 'Clearbit Logo API', url: 'https://clearbit.com/docs#logo-api', description: 'No-auth company logo from domain, brand logos, domain enrichment, favicon-like images, and business identity.', auth: 'No', https: true, cors: 'Unknown', category: 'Business', source: 'curated', sourceWeight: 5 },
  { name: 'Microlink', url: 'https://microlink.io/docs/api/getting-started/overview', description: 'Website metadata, link preview, Open Graph, screenshots, PDF capture, favicon, and content extraction API.', auth: 'No', https: true, cors: 'Yes', category: 'Development', source: 'curated', sourceWeight: 5 },
  { name: 'Urlbox', url: 'https://urlbox.com/docs', description: 'Website screenshots, responsive previews, full-page captures, image/PDF rendering, and web previews API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Development', source: 'curated', sourceWeight: 5 },
  { name: 'PDFShift', url: 'https://docs.pdfshift.io/', description: 'HTML to PDF generation, document rendering, screenshots, templates, and PDF conversion API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Documents', source: 'curated', sourceWeight: 5 },
  { name: 'OCR.space', url: 'https://ocr.space/ocrapi', description: 'OCR text extraction from images, PDFs, receipts, screenshots, and scanned documents API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Documents', source: 'curated', sourceWeight: 5 },
  { name: 'AssemblyAI', url: 'https://www.assemblyai.com/docs', description: 'Speech to text, audio transcription, speaker labels, summarization, sentiment, and audio intelligence API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'AI', source: 'curated', sourceWeight: 5 },
  { name: 'Deepgram', url: 'https://developers.deepgram.com/docs', description: 'Speech to text, transcription, audio intelligence, diarization, language detection, and TTS APIs.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'AI', source: 'curated', sourceWeight: 5 },
  { name: 'ElevenLabs', url: 'https://elevenlabs.io/docs/api-reference/introduction', description: 'Text to speech, voice generation, speech synthesis, voice cloning, and audio generation API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'AI', source: 'curated', sourceWeight: 5 },
  { name: 'Stability AI', url: 'https://platform.stability.ai/docs/api-reference', description: 'AI image generation, Stable Diffusion, image editing, upscaling, and generative media API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'AI', source: 'curated', sourceWeight: 5 },
  { name: 'Sightengine', url: 'https://sightengine.com/docs', description: 'Image moderation, nudity, violence, weapons, offensive content, face detection, and safe search API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'AI', source: 'curated', sourceWeight: 5 },
  { name: 'OpenSanctions', url: 'https://www.opensanctions.org/docs/api/', description: 'Sanctions, OFAC, PEP screening, companies, people, AML, KYC, and compliance data API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Security', source: 'curated', sourceWeight: 5 },
  { name: 'Chainalysis', url: 'https://docs.chainalysis.com/api/kyt/', description: 'Blockchain wallet risk, crypto sanctions screening, transaction monitoring, KYT, and compliance API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Cryptocurrency', source: 'curated', sourceWeight: 5 },
  { name: 'Zippopotam.us', url: 'https://www.zippopotam.us/', description: 'No-auth ZIP code, postal code, city, state, country, place, and geocoding lookup API.', auth: 'No', https: true, cors: 'Yes', category: 'Geocoding', source: 'curated', sourceWeight: 5 },
  { name: 'RentCast', url: 'https://developers.rentcast.io/reference/introduction', description: 'Real estate property data, rent estimates, property values, comparable rentals, and market data API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Real Estate', source: 'curated', sourceWeight: 5 },
  { name: 'ATTOM', url: 'https://api.developer.attomdata.com/docs', description: 'Property data, real estate records, valuation, mortgage, ownership, tax, and neighborhood data API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Real Estate', source: 'curated', sourceWeight: 5 },
  { name: 'Mortgage News Daily', url: 'https://www.mortgagenewsdaily.com/mortgage-rates', description: 'Mortgage rates, loan rate data, daily mortgage market rates, and home loan benchmarks.', auth: 'Unknown', https: true, cors: 'Unknown', category: 'Finance', source: 'curated', sourceWeight: 5 },
  { name: 'Aviationstack', url: 'https://aviationstack.com/documentation', description: 'Flight status, airports, airlines, aircraft, arrivals, departures, routes, and aviation data API.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Travel', source: 'curated', sourceWeight: 5 },
  { name: 'Amadeus Travel APIs', url: 'https://developers.amadeus.com/self-service', description: 'Flight search, airport data, hotel search, hotel booking, availability, pricing, and travel APIs.', auth: 'apiKey', https: true, cors: 'Unknown', category: 'Travel', source: 'curated', sourceWeight: 5 },
];


const CURATED_CATEGORY_ENRICHMENTS = {
  'AI': { providerType: 'ai-media-platform', domains: ['ai', 'media', 'automation'], tags: ['AI', 'media generation', 'analysis', 'automation'], useCases: ['add AI capabilities to apps', 'process user-generated media'], bestFor: 'AI/media features where a managed API is faster than self-hosting models.', caveats: ['Most AI APIs require keys and have usage-based pricing; confirm model availability and content policies.'] },
  'Anime': { providerType: 'anime-metadata', domains: ['media', 'anime', 'entertainment'], tags: ['anime search', 'manga', 'characters', 'rankings', 'metadata'], useCases: ['search anime and manga catalogs', 'show character and title metadata'], bestFor: 'Anime/manga catalog search and fan-app metadata.', caveats: ['Unofficial catalog APIs can have stricter rate limits or attribution requirements.'] },
  'Animals': { providerType: 'demo-media-api', domains: ['animals', 'media', 'test-data'], tags: ['random images', 'cat images', 'dog images', 'breeds', 'demo data'], useCases: ['add random animal images to demos', 'prototype media cards without auth'], bestFor: 'Lightweight demos and playful placeholders.', caveats: ['Not a structured veterinary or breed reference API.'] },
  'Authentication': { providerType: 'identity-platform', domains: ['auth', 'identity', 'security'], tags: ['auth', 'OAuth', 'OpenID Connect', 'login', 'user profiles', 'social auth'], useCases: ['add login and signup flows', 'manage user identities and sessions'], bestFor: 'Production identity, OAuth/OIDC, and user-management integrations.', caveats: ['Usually requires account setup and environment-specific app configuration.'] },
  'Books': { providerType: 'book-metadata', domains: ['books', 'open-data', 'education'], tags: ['books', 'ISBN', 'authors', 'covers', 'ebooks', 'public domain'], useCases: ['look up books by ISBN or title', 'build reading/library catalogs'], bestFor: 'Book discovery, metadata, covers, and public-domain ebook projects.', caveats: ['Coverage varies by source and may require reconciliation across editions.'] },
  'Business': { providerType: 'business-enrichment', domains: ['business', 'company-data', 'branding'], tags: ['company enrichment', 'business entity', 'domain logo', 'brand colors', 'public records'], useCases: ['enrich companies from domains', 'look up legal entities and brand assets'], bestFor: 'Company identity, public business records, and brand enrichment.', caveats: ['Business coverage and freshness vary by country and provider.'] },
  'Calendar': { providerType: 'calendar-data', domains: ['calendar', 'dates', 'productivity'], tags: ['calendar events', 'holidays', 'observances', 'dates', 'scheduling'], useCases: ['create event workflows', 'show public holidays by country'], bestFor: 'Calendar integrations, holiday lookup, and scheduling context.', caveats: ['OAuth calendar APIs require user consent; holiday definitions differ by locale.'] },
  'Communication': { providerType: 'messaging-platform', domains: ['communications', 'messaging', 'notifications'], tags: ['SMS', 'MMS', 'WhatsApp', 'messaging', 'notifications', 'webhooks'], useCases: ['send transactional SMS', 'track message delivery status'], bestFor: 'Reliable customer messaging and notification workflows.', caveats: ['Messaging APIs may require compliance registration, phone numbers, and regional rules.'] },
  'Cryptocurrency': { providerType: 'crypto-data-platform', domains: ['crypto', 'blockchain', 'defi'], tags: ['crypto prices', 'wallet balances', 'transactions', 'token metadata', 'on-chain data'], useCases: ['build wallet, token, or market-data tools', 'query blockchain activity'], bestFor: 'Crypto market data, wallet data, and blockchain integrations.', caveats: ['Chain coverage, indexing latency, and plan limits vary significantly.'] },
  'Currency Exchange': { providerType: 'fiat-fx-rates', domains: ['finance', 'currency', 'open-data'], tags: ['exchange rates', 'currency conversion', 'forex', 'historical rates', 'fiat'], useCases: ['convert currencies', 'show historical FX rates'], bestFor: 'Fiat exchange-rate conversion and historical rate widgets.', caveats: ['Do not use fiat FX APIs as crypto price feeds unless explicitly supported.'] },
  'Development': { providerType: 'developer-utility', domains: ['developer-tools', 'utility', 'web'], tags: ['developer tools', 'metadata', 'automation', 'webhooks', 'testing'], useCases: ['prototype developer utilities', 'enrich apps with web or repo metadata'], bestFor: 'Agent and builder utilities that need simple HTTP integrations.', caveats: ['Developer utility APIs vary widely; confirm endpoint stability and terms.'] },
  'Dictionaries': { providerType: 'dictionary-language-data', domains: ['language', 'education', 'reference'], tags: ['dictionary', 'definitions', 'phonetics', 'pronunciation', 'word meanings'], useCases: ['look up word definitions', 'add dictionary cards to education apps'], bestFor: 'Simple word-definition and pronunciation lookup.', caveats: ['May not include synonyms/antonyms unless documented.'] },
  'Documents': { providerType: 'document-processing', domains: ['documents', 'automation', 'media'], tags: ['PDF', 'OCR', 'HTML to PDF', 'document rendering', 'text extraction'], useCases: ['convert HTML to PDF', 'extract text from images or scanned documents'], bestFor: 'Document automation where hosted rendering/OCR is acceptable.', caveats: ['Sensitive documents need privacy review and provider data-retention checks.'] },
  'Email': { providerType: 'email-utility', domains: ['email', 'communications', 'testing'], tags: ['email validation', 'deliverability', 'temporary email', 'MX records', 'inbox testing'], useCases: ['validate signup email addresses', 'create disposable inboxes for tests'], bestFor: 'Email validation, deliverability checks, and test inbox workflows.', caveats: ['Validation results are probabilistic; do not block users solely on one provider.'] },
  'Entertainment': { providerType: 'entertainment-metadata', domains: ['media', 'entertainment'], tags: ['movies', 'TV', 'jokes', 'quotes', 'metadata', 'search'], useCases: ['build entertainment catalogs', 'add fun sample content to demos'], bestFor: 'Media discovery or fun content for prototypes.', caveats: ['Licensing and attribution requirements vary for media assets.'] },
  'Environment': { providerType: 'environmental-data', domains: ['environment', 'climate', 'open-data'], tags: ['air quality', 'carbon intensity', 'emissions', 'electricity grid', 'pollutants'], useCases: ['show air quality by location', 'track carbon intensity and energy mix'], bestFor: 'Environmental dashboards and sustainability context.', caveats: ['Sensor coverage and regional freshness vary.'] },
  'Finance': { providerType: 'financial-market-data', domains: ['finance', 'markets', 'banking'], tags: ['stock quotes', 'market data', 'forex', 'financial data', 'historical prices'], useCases: ['fetch market quotes and candles', 'build finance dashboards'], bestFor: 'Financial market data, banking workflows, or tax calculations depending on provider.', caveats: ['Market-data licensing and redistribution restrictions are common.'] },
  'Financial': { providerType: 'financial-validation', domains: ['finance', 'payments', 'banking'], tags: ['bank data', 'IBAN validation', 'routing', 'payments validation', 'SWIFT'], useCases: ['validate bank-account identifiers', 'support payment setup flows'], bestFor: 'Bank identifier validation and payment metadata.', caveats: ['Validation does not guarantee account ownership or transfer success.'] },
  'Food': { providerType: 'food-product-data', domains: ['food', 'nutrition', 'commerce'], tags: ['food products', 'barcodes', 'ingredients', 'nutrition', 'labels'], useCases: ['scan food barcodes', 'show ingredients and nutrition labels'], bestFor: 'Nutrition, product barcode, and grocery metadata.', caveats: ['Crowdsourced product data can be incomplete or region-specific.'] },
  'Food & Drink': { providerType: 'food-and-recipe-data', domains: ['food', 'nutrition', 'recipes'], tags: ['recipes', 'ingredients', 'nutrition', 'meal planning', 'barcodes'], useCases: ['find recipes by ingredients', 'analyze nutrition or product labels'], bestFor: 'Recipe, ingredient, nutrition, and grocery-product features.', caveats: ['Recipe licensing and nutrition precision vary by provider.'] },
  'Geocoding': { providerType: 'location-data', domains: ['maps', 'geocoding', 'location'], tags: ['geocoding', 'reverse geocoding', 'routing', 'places', 'addresses', 'coordinates'], useCases: ['convert addresses to coordinates', 'find places or routes near a user'], bestFor: 'Maps, address lookup, places, routing, and timezone/location utilities.', caveats: ['Respect geocoding usage policies, attribution, and caching restrictions.'] },
  'Government': { providerType: 'government-open-data', domains: ['government', 'open-data', 'civic'], tags: ['government data', 'census', 'elections', 'public records', 'federal data'], useCases: ['query civic datasets', 'build dashboards from public government data'], bestFor: 'US government, civic, census, and public-record datasets.', caveats: ['Dataset freshness and field definitions differ by agency.'] },
  'Jobs': { providerType: 'jobs-search', domains: ['jobs', 'employment', 'labor-market'], tags: ['jobs', 'job search', 'salary', 'remote jobs', 'hiring', 'employment'], useCases: ['search job listings', 'show salary or labor-market data'], bestFor: 'Job boards, hiring dashboards, and employment search tools.', caveats: ['Job freshness and deduplication often require additional filtering.'] },
  'Language': { providerType: 'translation-api', domains: ['language', 'nlp', 'text'], tags: ['translation', 'language detection', 'multilingual', 'text translation'], useCases: ['translate user text', 'detect language for content routing'], bestFor: 'Translation and lightweight multilingual features.', caveats: ['Hosted instances and language pairs may differ; verify rate limits.'] },
  'Logistics': { providerType: 'shipment-tracking', domains: ['logistics', 'shipping', 'commerce'], tags: ['package tracking', 'shipment status', 'carrier detection', 'labels', 'rates'], useCases: ['track packages across carriers', 'show shipping status in commerce apps'], bestFor: 'Shipment tracking, carrier metadata, and logistics workflows.', caveats: ['Carrier coverage and webhook behavior vary by plan.'] },
  'Media': { providerType: 'media-search', domains: ['media', 'audio', 'images'], tags: ['media search', 'audio', 'images', 'podcasts', 'metadata'], useCases: ['search media catalogs', 'enrich apps with audio/image metadata'], bestFor: 'Media search, metadata, and open-license asset discovery.', caveats: ['Asset licensing must be checked before redistribution.'] },
  'News': { providerType: 'news-search', domains: ['news', 'media', 'content'], tags: ['news', 'headlines', 'article search', 'topics', 'publishers'], useCases: ['search recent articles', 'build news dashboards by topic or country'], bestFor: 'Headline and article search across publishers or a single outlet.', caveats: ['Free tiers may restrict historical search, commercial use, or full article content.'] },
  'Open Data': { providerType: 'open-data-api', domains: ['open-data', 'government', 'civic'], tags: ['open data', 'public records', 'government data', 'campaign finance'], useCases: ['query public datasets', 'build civic data explorers'], bestFor: 'Public datasets and civic/open-data integrations.', caveats: ['Open data still needs source attribution and schema verification.'] },
  'Payments': { providerType: 'payment-platform', domains: ['payments', 'commerce', 'finance'], tags: ['payments', 'checkout', 'billing', 'invoices', 'subscriptions', 'webhooks'], useCases: ['create checkout flows', 'manage subscriptions and invoices'], bestFor: 'Commerce payments, billing, checkout, and subscription workflows.', caveats: ['Payment APIs require account setup, compliance checks, and secure server-side handling.'] },
  'Photography': { providerType: 'image-search', domains: ['images', 'photography', 'media'], tags: ['image search', 'stock photos', 'photos', 'collections', 'media assets'], useCases: ['search stock photos', 'populate prototypes with licensed images'], bestFor: 'Image search and photography assets for apps or demos.', caveats: ['Review license, attribution, and hotlinking rules for each asset.'] },
  'Podcasts': { providerType: 'podcast-directory', domains: ['podcasts', 'audio', 'media'], tags: ['podcast search', 'episodes', 'RSS', 'show metadata', 'recommendations'], useCases: ['search podcasts and episodes', 'resolve podcast RSS metadata'], bestFor: 'Podcast discovery, episode metadata, and audio-directory features.', caveats: ['Some podcast APIs require paid plans for full search or transcripts.'] },
  'Real Estate': { providerType: 'real-estate-data', domains: ['real-estate', 'property', 'finance'], tags: ['property data', 'rent estimates', 'property values', 'comparables', 'ownership'], useCases: ['estimate rent or property values', 'enrich addresses with property records'], bestFor: 'Real-estate valuation, rental comps, and property-record enrichment.', caveats: ['Coverage, licensing, and allowed use vary by market and provider.'] },
  'Security': { providerType: 'security-intelligence', domains: ['security', 'risk', 'compliance'], tags: ['security', 'threat intelligence', 'vulnerability data', 'risk scoring', 'compliance'], useCases: ['look up vulnerabilities or risky indicators', 'screen entities for compliance'], bestFor: 'Security enrichment, vulnerability lookup, and compliance screening.', caveats: ['Security signals can be stale or probabilistic; verify critical findings.'] },
  'Shopping': { providerType: 'commerce-product-data', domains: ['commerce', 'shopping', 'products'], tags: ['ecommerce', 'products', 'barcode lookup', 'carts', 'catalog', 'pricing'], useCases: ['prototype ecommerce products/carts', 'look up products by barcode'], bestFor: 'Product catalog, ecommerce demo, and barcode lookup workflows.', caveats: ['Product pricing and availability are often incomplete or region-specific.'] },
  'Sports & Fitness': { providerType: 'sports-data', domains: ['sports', 'scores', 'stats'], tags: ['sports scores', 'fixtures', 'standings', 'players', 'teams', 'odds'], useCases: ['show fixtures and scores', 'build team/player stat dashboards'], bestFor: 'Sports fixtures, standings, team/player stats, and scores.', caveats: ['League coverage, live updates, and odds may require paid plans.'] },
  'Telecom': { providerType: 'telecom-utility', domains: ['telecom', 'communications', 'security'], tags: ['SMS verification', 'OTP', 'phone validation', 'carrier lookup', 'line type'], useCases: ['verify phone numbers with OTP', 'validate phone number metadata'], bestFor: 'Phone verification, number validation, and telecom metadata.', caveats: ['Phone verification has fraud and regional compliance considerations.'] },
  'Test Data': { providerType: 'test-data-api', domains: ['test-data', 'prototyping', 'frontend'], tags: ['test data', 'fake users', 'mock API', 'sample data', 'frontend demo'], useCases: ['seed prototypes with sample data', 'test frontend API calls without a backend'], bestFor: 'Demos, tests, tutorials, and placeholder data.', caveats: ['Do not treat generated/fake data as production-grade or stable identifiers.'] },
  'Text Analysis': { providerType: 'text-analysis-api', domains: ['ai', 'nlp', 'moderation'], tags: ['text moderation', 'toxicity', 'comment analysis', 'safety scoring', 'NLP'], useCases: ['moderate user comments', 'rank content by toxicity or abuse risk'], bestFor: 'Comment moderation and content-safety signals.', caveats: ['Moderation scores require human calibration and appeal paths for serious decisions.'] },
  'Transportation': { providerType: 'transportation-data', domains: ['transportation', 'transit', 'mobility'], tags: ['transit', 'GTFS', 'routes', 'stops', 'vehicle data', 'VIN decode'], useCases: ['show transit routes/stops', 'decode VINs or vehicle recall data'], bestFor: 'Transit, vehicle, and transportation-data projects.', caveats: ['Realtime transit and vehicle ownership data may not be available.'] },
  'Travel': { providerType: 'travel-data', domains: ['travel', 'flights', 'hotels'], tags: ['flight status', 'airports', 'hotel search', 'booking', 'travel pricing'], useCases: ['search flights or hotels', 'track flight status and airport metadata'], bestFor: 'Travel search, flight status, airport, and hotel availability workflows.', caveats: ['Booking and fare data require careful terms, caching, and commercial-use review.'] },
  'URL Shortener': { providerType: 'url-shortener', domains: ['developer-tools', 'links', 'marketing'], tags: ['URL shortener', 'short links', 'branded links', 'redirects', 'link analytics'], useCases: ['create short links', 'track link analytics and redirects'], bestFor: 'Short links, campaign links, QR/link workflows, and branded redirects.', caveats: ['Abuse controls and branded-domain setup may affect automation.'] },
  'Weather': { providerType: 'weather-data-api', domains: ['weather', 'climate', 'location'], tags: ['weather forecast', 'current conditions', 'historical weather', 'weather alerts', 'climate'], useCases: ['fetch forecasts and current conditions', 'show severe alerts or historical weather'], bestFor: 'Weather forecasts, alerts, current conditions, and climate/history data.', caveats: ['Forecast models, geography coverage, and alert availability vary by provider.'] },
};

const CURATED_API_ENRICHMENTS = {
  'Alpha Vantage': { providerType: 'financial-market-data', tags: ['stock quotes', 'technical indicators', 'forex', 'crypto prices', 'time series'], useCases: ['fetch stock/ETF time series', 'calculate technical indicator dashboards'], caveats: ['Free API key limits are tight; intraday data may be limited.'] },
  'Polygon': { providerType: 'market-data-platform', tags: ['stock market data', 'options', 'forex', 'crypto', 'aggregates', 'trades'], useCases: ['fetch intraday aggregates and trades', 'build multi-asset market dashboards'], caveats: ['Many realtime/historical datasets are paid or exchange-licensed.'] },
  'Twelve Data': { providerType: 'market-data-platform', tags: ['stock quotes', 'forex', 'ETF', 'indices', 'crypto', 'technical indicators'], useCases: ['fetch realtime and historical prices', 'query technical indicators across asset classes'] },
  'Tradier': { providerType: 'brokerage-and-market-data', tags: ['equity quotes', 'options chains', 'brokerage trading', 'market data'], useCases: ['build US equities/options workflows', 'integrate brokerage account trading'], caveats: ['Trading/account endpoints need OAuth and brokerage approval.'] },
  'Finnhub': { providerType: 'financial-market-data', tags: ['stock quotes', 'company fundamentals', 'earnings', 'financial statements', 'market news'], useCases: ['fetch company fundamentals', 'combine quotes with finance news'] },
  'Stooq': { providerType: 'free-market-data-csv', tags: ['free stock quotes', 'historical prices', 'CSV downloads', 'forex', 'indices'], useCases: ['download historical CSV price data', 'prototype no-auth finance charts'], bestFor: 'No-auth historical market-data prototypes.' },
  'Open-Meteo': { providerType: 'weather-and-geocoding', tags: ['weather forecast', 'historical weather', 'climate', 'geocoding', 'marine weather'], useCases: ['fetch hourly forecasts without an API key', 'combine weather and geocoding for frontend apps'], bestFor: 'No-auth, frontend-friendly forecast and climate data.' },
  'National Weather Service API': { providerType: 'government-weather-api', tags: ['US weather alerts', 'forecast', 'observations', 'radar stations', 'gridpoints'], useCases: ['show US severe weather alerts', 'fetch official US forecasts'], bestFor: 'Official US weather alerts and forecasts.', caveats: ['US-only and expects a descriptive User-Agent.'] },
  'Pirate Weather': { providerType: 'weather-forecast-api', tags: ['weather forecast', 'Dark Sky compatible', 'current conditions', 'minutely forecast'], useCases: ['replace Dark Sky-style forecast integrations'], caveats: ['Verify current free limits and attribution requirements.'] },
  'Geocod.io': { providerType: 'geocoding-and-census', tags: ['forward geocoding', 'reverse geocoding', 'address parsing', 'census data', 'coordinates'], useCases: ['geocode US/Canada addresses', 'append Census geographies to addresses'] },
  'GraphHopper': { providerType: 'routing-platform', tags: ['routing', 'navigation', 'route optimization', 'matrix', 'map matching', 'geocoding'], useCases: ['calculate routes and distance matrices', 'optimize delivery stops'] },
  'GraphQL Jobs': { providerType: 'jobs-graphql-api', tags: ['jobs', 'GraphQL', 'developer jobs', 'job listings'], useCases: ['search GraphQL job listings', 'prototype jobs search UIs'], caveats: ['Check service freshness before building around it.'] },
  'Search.gov Jobs': { providerType: 'government-jobs-search', tags: ['government jobs', 'federal jobs', 'job search', 'US jobs'], useCases: ['search US government job openings'] },
  'API-FOOTBALL': { providerType: 'soccer-data-api', tags: ['soccer fixtures', 'standings', 'teams', 'players', 'odds', 'predictions'], useCases: ['show soccer fixtures and standings', 'fetch match odds and predictions'] },
  'Football-Data': { providerType: 'soccer-data-api', tags: ['football fixtures', 'competitions', 'teams', 'matches', 'standings', 'scores'], useCases: ['show European football fixtures', 'build standings tables'] },
  'TVMaze': { providerType: 'tv-metadata-api', tags: ['TV shows', 'episodes', 'schedule', 'cast', 'show search'], useCases: ['search TV shows', 'show episode schedules and cast metadata'] },
  'Jikan': { providerType: 'anime-metadata-api', tags: ['anime search', 'manga search', 'MyAnimeList', 'characters', 'rankings'], useCases: ['search anime/manga without auth', 'show rankings and character metadata'] },
  'AniList': { providerType: 'anime-graphql-api', tags: ['anime GraphQL', 'manga', 'characters', 'studios', 'user lists'], useCases: ['query anime and manga metadata with GraphQL', 'integrate user list features'], caveats: ['OAuth is required for user-specific list operations.'] },
  'Data.gov': { providerType: 'government-api-catalog', tags: ['government data', 'federal APIs', 'public datasets', 'api.data.gov key'], useCases: ['discover US federal public APIs', 'use a shared API key gateway for agencies'] },
  'Open Food Facts': { providerType: 'food-product-database', tags: ['barcode lookup', 'ingredients', 'nutrition', 'allergens', 'food labels'], useCases: ['scan food products by barcode', 'show ingredient and nutrition facts'], bestFor: 'No-auth food barcode and nutrition/product metadata.' },
  'Barcode Lookup': { providerType: 'product-barcode-lookup', tags: ['barcode lookup', 'UPC', 'EAN', 'product catalog', 'pricing', 'images'], useCases: ['look up retail products by UPC/EAN', 'enrich product cards with images and prices'] },
  'OpenWeather': { providerType: 'weather-platform', tags: ['current weather', 'forecast', 'historical weather', 'weather alerts', 'geocoding', 'weather maps'], useCases: ['fetch current weather and forecasts', 'add weather map layers'], caveats: ['API key required; One Call and historical data limits vary.'] },
  'The Guardian Open Platform': { providerType: 'publisher-content-api', tags: ['Guardian articles', 'sections', 'tags', 'article search', 'publisher content'], useCases: ['search Guardian content by section/tag', 'build publisher-specific news widgets'] },
  'TMDb': { providerType: 'movie-tv-metadata', tags: ['movie metadata', 'TV metadata', 'posters', 'cast', 'ratings', 'discovery'], useCases: ['build movie/TV discovery apps', 'fetch posters and cast metadata'] },
  'OMDb': { providerType: 'movie-tv-metadata', tags: ['IMDb lookup', 'movie metadata', 'TV metadata', 'ratings', 'title search'], useCases: ['look up titles by IMDb ID', 'prototype movie metadata cards'] },
  'iTunes Search API': { providerType: 'apple-media-search', tags: ['podcast search', 'music search', 'audiobooks', 'apps', 'episodes'], useCases: ['search Apple/iTunes media metadata without auth'] },
  'OpenStreetMap Nominatim': { providerType: 'open-geocoding-api', tags: ['geocoding', 'reverse geocoding', 'OpenStreetMap', 'address lookup', 'places'], useCases: ['geocode addresses with OSM data', 'reverse geocode coordinates no-auth'], caveats: ['Public Nominatim has strict usage policy; self-host for heavy workloads.'] },
  'Mapbox': { providerType: 'maps-location-platform', tags: ['maps', 'geocoding', 'routing', 'navigation', 'tiles', 'places'], useCases: ['add maps/geocoding to apps', 'build route and places search experiences'] },
  'Foursquare Places': { providerType: 'places-search-api', tags: ['places', 'restaurants', 'nearby search', 'opening hours', 'photos', 'categories'], useCases: ['find nearby venues/restaurants', 'enrich places with hours and photos'] },
  'USAJOBS': { providerType: 'federal-jobs-api', tags: ['federal jobs', 'government jobs', 'hiring', 'job search'], useCases: ['search federal job listings', 'build government jobs alerts'] },
  'Adzuna': { providerType: 'jobs-market-data', tags: ['job search', 'salary data', 'vacancies', 'employment market', 'remote jobs'], useCases: ['search job listings by country', 'compare salary and vacancy trends'] },
  'TheSportsDB': { providerType: 'sports-metadata-api', tags: ['sports teams', 'leagues', 'events', 'scores', 'players', 'media'], useCases: ['show team/player metadata', 'build sports event dashboards'] },
  'balldontlie': { providerType: 'basketball-stats-api', tags: ['NBA', 'basketball stats', 'players', 'teams', 'games', 'seasons'], useCases: ['fetch NBA teams/players/games', 'prototype basketball stats apps'] },
  'Census Data API': { providerType: 'census-demographics-api', tags: ['census', 'ACS', 'demographics', 'geography', 'economic data'], useCases: ['query demographic variables by geography', 'build Census/ACS dashboards'] },
  'OpenFEC': { providerType: 'campaign-finance-api', tags: ['campaign finance', 'candidates', 'committees', 'filings', 'donations', 'elections'], useCases: ['track campaign donations and filings', 'search candidates and committees'] },
  'Fake Store API': { providerType: 'fake-ecommerce-api', tags: ['fake store', 'ecommerce products', 'carts', 'users', 'frontend demo'], useCases: ['prototype shopping carts and product pages without a backend'] },
  'Stripe': { providerType: 'payment-platform', tags: ['payments', 'checkout', 'billing', 'subscriptions', 'invoices', 'webhooks'], useCases: ['create checkout sessions', 'manage recurring billing and invoices'], bestFor: 'Modern card payments, billing, subscriptions, and payment webhooks.' },
  'PayPal': { providerType: 'payment-platform', tags: ['payments', 'checkout orders', 'subscriptions', 'payouts', 'invoices', 'disputes'], useCases: ['accept PayPal checkout', 'create orders, payouts, or invoices'] },
  'Twilio Messaging': { providerType: 'sms-messaging-platform', tags: ['SMS', 'MMS', 'WhatsApp', 'message status', 'phone numbers', 'webhooks'], useCases: ['send SMS/MMS/WhatsApp messages', 'track delivery status with webhooks'] },
  'WhoisXML API': { providerType: 'domain-intelligence-api', tags: ['WHOIS', 'DNS lookup', 'domain availability', 'SSL certificates', 'threat intelligence'], useCases: ['enrich domains with WHOIS/DNS data', 'screen domains for security workflows'] },
  'Google DNS': { providerType: 'dns-over-https', tags: ['DNS over HTTPS', 'DNS records', 'domain resolution', 'public resolver'], useCases: ['resolve DNS records from frontend/server apps', 'debug domain DNS without auth'] },
  'SSL Labs': { providerType: 'tls-assessment-api', tags: ['SSL certificates', 'TLS configuration', 'HTTPS scan', 'security assessment'], useCases: ['grade website TLS configuration', 'monitor certificate/security posture'] },
  'IPinfo': { providerType: 'ip-intelligence-api', tags: ['IP geolocation', 'ASN', 'company', 'carrier', 'privacy', 'hosted domains'], useCases: ['geolocate IP addresses', 'enrich traffic with ASN/company metadata'] },
  'IPQualityScore': { providerType: 'ip-risk-scoring', tags: ['IP reputation', 'VPN detection', 'proxy detection', 'TOR', 'fraud score', 'bot detection'], useCases: ['score IP risk during signup', 'detect VPN/proxy/TOR traffic'] },
  'proxycheck.io': { providerType: 'ip-proxy-detection', tags: ['proxy detection', 'VPN detection', 'TOR', 'datacenter IP', 'risk score'], useCases: ['detect anonymous IPs', 'flag risky login/session traffic'] },
  'spoonacular': { providerType: 'recipe-nutrition-api', tags: ['recipes', 'ingredients', 'meal planning', 'nutrition', 'grocery products', 'allergens'], useCases: ['find recipes by pantry ingredients', 'analyze meal nutrition and allergens'] },
  'QuickChart QR Code': { providerType: 'qr-code-generator', tags: ['QR code', 'QR images', 'charts', 'frontend demo', 'no auth'], useCases: ['generate QR codes for URLs/text', 'embed QR images in frontend demos'] },
  'GoQR.me': { providerType: 'qr-code-generator', tags: ['QR code', 'text to QR', 'URL QR', 'contact data'], useCases: ['generate simple QR images without auth'] },
  'Transitland': { providerType: 'transit-open-data-api', tags: ['transit', 'GTFS', 'operators', 'routes', 'stops', 'schedules'], useCases: ['query transit routes/stops', 'build public transportation maps'] },
  'Transport API': { providerType: 'uk-transport-api', tags: ['UK trains', 'bus departures', 'routes', 'stops', 'journey planning'], useCases: ['show UK train/bus departures', 'plan UK transport journeys'] },
  'DiceBear': { providerType: 'avatar-generator', tags: ['avatars', 'identicons', 'SVG', 'placeholder images', 'profile pictures'], useCases: ['generate deterministic avatars from names/seeds', 'add placeholder profile pictures'] },
  'Boring Avatars': { providerType: 'avatar-generator', tags: ['avatars', 'identicons', 'SVG', 'seeded avatar', 'wallet-like strings'], useCases: ['generate seeded SVG avatars', 'display identicons for users or wallet-like IDs'] },
  'Alchemy NFT API': { providerType: 'nft-data-api', tags: ['NFT metadata', 'NFT owners', 'contract data', 'token IDs', 'wallet NFTs', 'transfers'], useCases: ['fetch NFTs owned by a wallet', 'resolve NFT contract/token metadata'] },
  'NHTSA Vehicle API': { providerType: 'vehicle-government-data', tags: ['VIN decode', 'vehicle recalls', 'manufacturers', 'models', 'safety data'], useCases: ['decode VINs without auth', 'look up vehicle recall and safety data'] },
  'Openverse': { providerType: 'open-license-media-search', tags: ['open licensed images', 'public domain', 'audio search', 'image search', 'media metadata'], useCases: ['find openly licensed images/audio', 'build attribution-aware media search'] },
  'LibreTranslate': { providerType: 'translation-api', tags: ['translation', 'language detection', 'text translation', 'multilingual'], useCases: ['translate text between languages', 'detect source language'] },
  'Perspective API': { providerType: 'text-moderation-api', tags: ['toxicity', 'text moderation', 'comment analysis', 'abuse detection', 'safety scoring'], useCases: ['score comments for toxicity', 'moderate user-generated text'] },
  'Google Calendar API': { providerType: 'calendar-oauth-api', tags: ['calendar events', 'OAuth', 'reminders', 'attendees', 'Google Calendar'], useCases: ['list/create/update calendar events', 'build scheduling assistants'], caveats: ['Requires Google OAuth consent for user calendars.'] },
  'OSV': { providerType: 'open-source-vulnerability-api', tags: ['vulnerability data', 'CVE', 'advisories', 'packages', 'ecosystems', 'security lookup'], useCases: ['check package versions for known vulnerabilities', 'build dependency security scanners'], bestFor: 'No-auth open source package vulnerability lookup.' },
  'NVD': { providerType: 'cve-vulnerability-api', tags: ['CVE', 'CVSS', 'CPE', 'vulnerability data', 'security advisories'], useCases: ['search CVEs by keyword/CPE', 'enrich security dashboards with CVSS data'] },
  'GitHub REST API': { providerType: 'source-control-api', tags: ['repositories', 'stars', 'issues', 'commits', 'pull requests', 'releases'], useCases: ['query repo metadata and issues', 'automate GitHub workflows'], caveats: ['No-auth calls are heavily rate-limited; use tokens for agents.'] },
  'npm Registry API': { providerType: 'package-registry-api', tags: ['npm packages', 'versions', 'downloads', 'dist-tags', 'package metadata'], useCases: ['inspect package versions and metadata', 'build dependency search tools'] },
  'Docker Hub': { providerType: 'container-registry-api', tags: ['Docker images', 'image tags', 'registry metadata', 'namespaces', 'vulnerabilities'], useCases: ['list container image tags', 'inspect Docker repository metadata'] },
  'Mail.tm': { providerType: 'temporary-email-api', tags: ['temporary email', 'disposable inbox', 'receive messages', 'test email'], useCases: ['create disposable inboxes for tests', 'receive email in automated QA flows'] },
  'Twilio Verify': { providerType: 'phone-verification-api', tags: ['SMS OTP', 'phone verification', 'one-time passcodes', 'verification checks'], useCases: ['send OTP codes', 'verify phone ownership'] },
  'numverify': { providerType: 'phone-validation-api', tags: ['phone validation', 'carrier lookup', 'line type', 'country lookup'], useCases: ['validate phone number format and carrier metadata'] },
  'Plaid': { providerType: 'banking-data-platform', tags: ['bank account linking', 'transactions', 'balances', 'identity', 'income', 'assets'], useCases: ['link bank accounts', 'fetch transactions and balances with user consent'] },
  'IBAN.com': { providerType: 'bank-identifier-validation', tags: ['IBAN validation', 'SWIFT', 'BIC', 'bank routing', 'payments validation'], useCases: ['validate IBAN/SWIFT details before payment setup'] },
  'TaxJar': { providerType: 'sales-tax-api', tags: ['sales tax', 'tax rates', 'tax calculation', 'nexus', 'address tax lookup'], useCases: ['calculate sales tax by address', 'support ecommerce tax workflows'] },
  'Avalara': { providerType: 'tax-compliance-api', tags: ['sales tax', 'tax calculation', 'address validation', 'exemption certificates', 'compliance'], useCases: ['calculate tax and manage compliance workflows'] },
  'Smarty': { providerType: 'address-validation-api', tags: ['address validation', 'USPS', 'autocomplete', 'ZIP+4', 'deliverability', 'geocoding'], useCases: ['normalize US addresses', 'add address autocomplete/typeahead'] },
  'Brandfetch': { providerType: 'brand-enrichment-api', tags: ['brand logo', 'domain logo', 'brand colors', 'company metadata', 'fonts'], useCases: ['fetch brand assets from a domain', 'enrich company profile cards'] },
  'Clearbit Logo API': { providerType: 'domain-logo-api', tags: ['logo from domain', 'company logo', 'brand logo', 'favicon-like image'], useCases: ['show a company logo from its domain without auth'] },
  'Microlink': { providerType: 'web-metadata-and-screenshot', tags: ['website metadata', 'link preview', 'Open Graph', 'screenshots', 'PDF capture', 'favicon'], useCases: ['generate link previews', 'capture website screenshots/PDFs without auth'], bestFor: 'No-auth web metadata, unfurling, and lightweight screenshot capture.' },
  'Urlbox': { providerType: 'website-screenshot-api', tags: ['screenshots', 'responsive previews', 'full-page capture', 'PDF rendering', 'web previews'], useCases: ['capture website screenshots', 'generate responsive preview images'] },
  'OCR.space': { providerType: 'ocr-api', tags: ['OCR', 'text extraction', 'receipts', 'screenshots', 'PDF OCR', 'scanned documents'], useCases: ['extract text from images/PDFs', 'prototype receipt or screenshot OCR'] },
  'AssemblyAI': { providerType: 'speech-to-text-api', tags: ['speech to text', 'audio transcription', 'speaker labels', 'summarization', 'audio intelligence'], useCases: ['transcribe audio', 'add speaker labels and summaries'] },
  'Deepgram': { providerType: 'speech-audio-api', tags: ['speech to text', 'transcription', 'diarization', 'language detection', 'TTS'], useCases: ['transcribe realtime or batch audio', 'build voice apps with STT/TTS'] },
  'ElevenLabs': { providerType: 'text-to-speech-api', tags: ['text to speech', 'voice generation', 'speech synthesis', 'voice cloning'], useCases: ['generate spoken audio from text', 'prototype voice agents'] },
  'Stability AI': { providerType: 'image-generation-api', tags: ['image generation', 'Stable Diffusion', 'image editing', 'upscaling', 'generative media'], useCases: ['generate images from prompts', 'edit or upscale images'] },
  'Sightengine': { providerType: 'image-moderation-api', tags: ['image moderation', 'nudity detection', 'violence detection', 'weapons', 'safe search'], useCases: ['moderate uploaded images', 'detect unsafe visual content'] },
  'OpenSanctions': { providerType: 'sanctions-screening-api', tags: ['sanctions', 'OFAC', 'PEP screening', 'AML', 'KYC', 'compliance'], useCases: ['screen people/companies for sanctions and PEP risk'] },
  'Chainalysis': { providerType: 'crypto-compliance-api', tags: ['wallet risk', 'crypto sanctions', 'transaction monitoring', 'KYT', 'compliance'], useCases: ['screen blockchain wallets/transactions for compliance risk'] },
  'Zippopotam.us': { providerType: 'postal-code-geocoding', tags: ['ZIP code', 'postal code', 'city lookup', 'state lookup', 'geocoding'], useCases: ['resolve postal codes to city/state/country without auth'] },
  'Mortgage News Daily': { providerType: 'mortgage-rate-data', tags: ['mortgage rates', 'loan rates', 'daily rates', 'home loan benchmarks'], useCases: ['show current mortgage-rate benchmarks'], caveats: ['This is a rates/data page; verify whether a supported API/export is available before integration.'] },
  'Aviationstack': { providerType: 'aviation-data-api', tags: ['flight status', 'airports', 'airlines', 'arrivals', 'departures', 'routes'], useCases: ['track flight status', 'show airport arrivals/departures'] },
  'Amadeus Travel APIs': { providerType: 'travel-commerce-platform', tags: ['flight search', 'airport data', 'hotel search', 'hotel booking', 'availability', 'pricing'], useCases: ['search flights and hotels', 'build travel booking/availability workflows'] },
};

const INTENT_TAG_RULES = [
  [/webhook/i, 'webhooks'], [/OCR/i, 'OCR'], [/screenshot/i, 'screenshots'], [/PDF/i, 'PDF'], [/barcode|UPC|EAN/i, 'barcode lookup'], [/geocod/i, 'geocoding'], [/routing|route/i, 'routing'], [/forecast|weather/i, 'weather forecast'], [/jobs?|hiring/i, 'jobs'], [/payment|checkout|billing/i, 'payments'], [/OAuth|OpenID|login|authentication/i, 'auth'], [/SMS|MMS|WhatsApp/i, 'SMS'], [/email/i, 'email'], [/vulnerab|CVE|CVSS/i, 'vulnerability data'], [/government|census|federal/i, 'government data'], [/stock|forex|market data/i, 'market data'], [/wallet|blockchain|token/i, 'wallet/token data'], [/recipe|nutrition|ingredient/i, 'nutrition'], [/flight|hotel|travel/i, 'travel'], [/image|photo|avatar/i, 'images'], [/speech|voice|transcription|audio/i, 'audio'], [/sanctions|KYC|AML|OFAC/i, 'compliance'], [/IP |VPN|proxy|TOR/i, 'IP intelligence'],
];

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean).map(value => String(value).trim()).filter(Boolean))];
}

function normalizeAuthType(auth) {
  const value = String(auth || '').toLowerCase();
  if (value === 'no' || value === 'none' || value === 'noauth') return 'none';
  if (value.includes('oauth')) return 'OAuth';
  if (value.includes('key')) return 'apiKey';
  if (value.includes('jwt')) return 'JWT';
  return value && value !== 'unknown' ? value : 'unknown';
}

function wordsFrom(value) {
  return String(value || '')
    .replace(/&/g, ' and ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [];
}

function categoryTags(category) {
  const words = wordsFrom(category).filter(word => !['and', 'api', 'apis', 'openapi', 'unknown'].includes(word));
  const tags = [];
  const categoryText = String(category || '').toLowerCase();
  if (categoryText && !['unknown', 'openapi'].includes(categoryText)) tags.push(categoryText.replace(/\s+/g, ' '));
  for (const word of words) tags.push(word);
  return tags;
}

function inferTags(api, specific = {}) {
  const text = `${api.name || ''} ${api.category || ''} ${api.description || ''} ${api.url || ''} ${api.provider || ''} ${(specific.tags || []).join(' ')}`;
  return INTENT_TAG_RULES.filter(([pattern]) => pattern.test(text)).map(([, tag]) => tag);
}

function enrichApiMetadata(api) {
  const categoryBase = CURATED_CATEGORY_ENRICHMENTS[api.category] || {};
  const specific = CURATED_API_ENRICHMENTS[api.name] || {};
  const merged = { ...categoryBase, ...specific, ...api };
  const tags = uniqueStrings([
    ...(categoryBase.tags || []),
    ...(specific.tags || []),
    ...inferTags(api, specific),
    ...(api.tags || []),
    ...categoryTags(api.category),
  ]);

  merged.authType = api.authType || specific.authType || categoryBase.authType || normalizeAuthType(api.auth);
  merged.providerType = api.providerType || specific.providerType || categoryBase.providerType || 'public-api';
  merged.tags = tags.length ? tags : ['public api'];
  merged.domains = uniqueStrings([...(categoryBase.domains || []), ...(specific.domains || []), ...(api.domains || []), ...categoryTags(api.category).slice(0, 2)]);
  merged.useCases = uniqueStrings([...(categoryBase.useCases || []), ...(specific.useCases || []), ...(api.useCases || [])]);
  merged.caveats = uniqueStrings([...(categoryBase.caveats || []), ...(specific.caveats || []), ...(api.caveats || [])]);
  merged.bestFor = api.bestFor || specific.bestFor || categoryBase.bestFor;
  return merged;
}

const ENRICHED_CURATED_APIS = CURATED_APIS.map(enrichApiMetadata);

export function getCuratedApis() {
  return ENRICHED_CURATED_APIS.map(api => ({ ...api, tags: [...(api.tags || [])], domains: [...(api.domains || [])], useCases: [...(api.useCases || [])] }));
}

function compactName(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }
const KNOWN_BEST_NAMES = new Map(ENRICHED_CURATED_APIS.map(api => [compactName(api.name), 15]));

function knownBestBoost(entryName) {
  const compactEntryName = compactName(entryName);
  if (compactEntryName.length < 4) return 0;
  let boost = 0;
  for (const [name, weight] of KNOWN_BEST_NAMES) {
    if (compactEntryName === name) boost = Math.max(boost, weight);
    else if (compactEntryName.length >= 6 && name.length >= 6 && (compactEntryName.includes(name) || name.includes(compactEntryName))) {
      boost = Math.max(boost, Math.floor(weight / 2));
    }
  }
  return boost;
}

function detectDomains(queryTokens) {
  return Object.entries(DOMAIN_PROFILES)
    .filter(([, profile]) => profile.triggers.some(t => queryTokens.has(t)))
    .map(([name]) => name);
}

function domainAdjustment(entry, queryTokens) {
  const domains = detectDomains(queryTokens);
  if (!domains.length) return 0;
  const cat = String(entry.category || '').toLowerCase();
  const text = `${entry.name || ''} ${entry.description || ''} ${entry.provider || ''} ${enrichedText(entry)}`.toLowerCase();
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
    if (textHit) adjustment += categoryHit ? 6 : 3;
    if (!categoryHit && !textHit) adjustment -= 10;
    for (const weak of profile.weakTerms) {
      if (queryTokens.has(weak) && text.includes(weak) && !categoryHit && !textHit) adjustment -= 4;
    }
  }
  if (cat.includes('currency exchange') && [...queryTokens].some(t => ['stock', 'stocks', 'equity', 'equities', 'ticker', 'tickers', 'candles', 'ohlc', 'intraday'].includes(t))) {
    adjustment -= 18;
  }
  return adjustment;
}


function usage() {
  console.log(`public-api-finder — multi-source public API discovery for agents

Usage:
  public-api-finder <query> [options]

Options:
  --category <name>  Filter by category substring
  --source <name>    Filter by source: public-api-lists, public-apis, apis-guru, api-mega-list, curated
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
  public-api-finder "weather forecast" --no-auth --https --check
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
  applyQueryHints(args);
  return args;
}

function applyQueryHints(args) {
  const query = String(args.query || '').toLowerCase();
  const noAuthHint = /\b(no auth|without auth|no api key|no key|unauthenticated)\b/.test(query);
  const authScarceDomain = /\b(package tracking|shipment|shipments|carrier tracking|shipping|ups|fedex)\b/.test(query);
  if (!args.noAuth && noAuthHint && !authScarceDomain) args.noAuth = true;
  if (!args.cors && /\b(cors|frontend-safe|browser-safe|frontend safe|browser safe)\b/.test(query)) args.cors = 'Yes';
}

const SEARCH_STOPWORDS = new Set(['a', 'an', 'and', 'api', 'apis', 'for', 'from', 'in', 'no', 'of', 'on', 'or', 'the', 'to', 'with']);

function tokenSet(text) {
  return new Set(String(text).toLowerCase().match(/[a-z0-9]+/g)?.filter(t => t.length > 1 && !SEARCH_STOPWORDS.has(t)) || []);
}

function intersectionCount(a, b) {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

function arrayify(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value];
}

function uniqueArray(...values) {
  const seen = new Set();
  const out = [];
  for (const value of values.flatMap(arrayify)) {
    const s = String(value).trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function enrichedText(entry) {
  return [
    entry.provider,
    entry.providerType,
    entry.authType,
    entry.pricing,
    entry.freeTier,
    entry.bestFor,
    entry.avoidFor,
    entry.rateLimit,
    entry.apiBase,
    ...arrayify(entry.tags),
    ...arrayify(entry.useCases),
    ...arrayify(entry.domains),
    ...arrayify(entry.exampleQueries),
    ...arrayify(entry.caveats),
  ].filter(Boolean).join(' ');
}

function textScore(entry, queryTokens) {
  const name = tokenSet(entry.name);
  const category = tokenSet(entry.category);
  const desc = tokenSet(entry.description);
  const enriched = tokenSet(enrichedText(entry));
  const all = new Set([...name, ...category, ...desc, ...enriched]);
  return 5 * intersectionCount(queryTokens, name)
    + 4 * intersectionCount(queryTokens, category)
    + 2 * intersectionCount(queryTokens, desc)
    + 3 * intersectionCount(queryTokens, enriched)
    + intersectionCount(queryTokens, all);
}

function asciiRatio(value) {
  const s = String(value || '');
  if (!s.length) return 1;
  let ascii = 0;
  for (const ch of s) if (ch.charCodeAt(0) <= 127) ascii++;
  return ascii / s.length;
}


function targetedBoost(entry, queryText) {
  const haystack = `${entry.name || ''} ${entry.category || ''} ${entry.description || ''} ${entry.url || ''} ${enrichedText(entry)}`;
  let boost = 0;
  for (const [queryPattern, entryPattern, amount] of TARGETED_BOOSTS) {
    if (queryPattern.test(queryText) && entryPattern.test(haystack)) boost = Math.max(boost, amount);
  }
  if (boost > 0 && (entry.sources || [entry.source]).includes('curated')) boost += 30;
  return boost;
}

function genericCloudPenalty(entry, queryText) {
  if (/\b(azure|aws|amazon|google cloud|gcp|cloud|kubernetes|container|vm|virtual machine|storage account|resource group)\b/.test(queryText)) return 0;
  const name = String(entry.name || '');
  const cat = String(entry.category || '').toLowerCase();
  const desc = String(entry.description || '').toLowerCase();
  if (/ManagementClient$/.test(name) || (/\bmanagement client\b/.test(desc) && cat.includes('cloud'))) return 90;
  if (cat.includes('cloud') && /\b(api management|network management|sql management|storage management|compute management)\b/.test(desc)) return 70;
  return 0;
}

function intentPenalty(entry, queryText) {
  const cat = String(entry.category || '').toLowerCase();
  const text = `${entry.name || ''} ${entry.description || ''} ${enrichedText(entry)}`.toLowerCase();
  let penalty = 0;

  if (cat.includes('cryptocurrency')) {
    if (/\b(fiat only|not crypto|non crypto|stocks? quote|equity|equities|plaid|bank account|banking transactions|routing number|iban|mortgage|loan calculator)\b/.test(queryText)) penalty += 60;
    if (/\b(favicon|website preview|open graph|link preview|screenshot)\b/.test(queryText) && !/\b(microlink|urlbox|favicon|website metadata|open graph|link preview|screenshot)\b/.test(text)) penalty += 120;
  }

  if (/\b(school district|school boundary|district boundary)\b/.test(queryText) && /\b(linkedin|jobs scraper|lead|sales|recruiting)\b/.test(text)) {
    penalty += 95;
  }

  if (!cat.includes('cryptocurrency') && /\b(wallet address|identicon|avatar|profile picture)\b/.test(queryText) && /\b(avatar|identicon|profile picture)\b/.test(text)) {
    penalty -= 20;
  }

  return penalty;
}

function score(entry, queryTokens, queryText = '') {
  let base = textScore(entry, queryTokens);
  if (entry.openapiUrl) base += 2;
  if (entry.sources?.length > 1) base += 2;
  if (entry.auth === 'No') base += 1;
  if (entry.https) base += 1;
  if (asciiRatio(entry.name) < 0.7) base -= 60;
  else if (asciiRatio(`${entry.name || ''} ${entry.description || ''}`) < 0.65) base -= 18;
  base += knownBestBoost(entry.name);
  return base + domainAdjustment(entry, queryTokens) + targetedBoost(entry, queryText) - genericCloudPenalty(entry, queryText) - intentPenalty(entry, queryText);
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
  return String(cat).replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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


function parseApiMegaList(readme) {
  const entries = [];
  let category = '';
  for (const raw of readme.split('\n')) {
    const heading = raw.match(/^##\s+(.+?)\s*$/) || raw.match(/^###\s+(.+?)\s*$/);
    if (heading) {
      const text = heading[1].replace(/[#*_`]/g, '').trim();
      if (text && !/table of contents|repository stats|star this|join my|contributing|license/i.test(text)) category = normalizeCategory(text.replace(/^\d+\.\s*/, ''));
      continue;
    }
    if (!raw.startsWith('| [')) continue;
    const cells = raw.split('|').slice(1, -1).map(c => c.trim());
    if (cells.length < 2) continue;
    if (/^-+$/.test(cells[0]) || /^api name$/i.test(cells[0])) continue;
    const link = cells[0].match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (!link) continue;
    const name = link[1].replace(/<[^>]+>/g, '').trim();
    const url = link[2].trim();
    const description = cleanDescription(cells[1] || `${name} API`);
    if (!name || !/^https?:\/\//i.test(url)) continue;
    entries.push({
      name,
      url,
      description,
      auth: 'Unknown',
      https: /^https:/i.test(url),
      cors: 'Unknown',
      category: category || 'Unknown',
      source: 'api-mega-list',
      sourceWeight: 1,
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
  const [pal, publicApisReadme, guru, megaList] = await Promise.allSettled([
    fetchJson(SOURCES.publicApiLists),
    fetchText(SOURCES.publicApisReadme),
    fetchJson(SOURCES.apisGuru),
    fetchText(SOURCES.apiMegaList),
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
  if (megaList.status === 'fulfilled') {
    const rows = parseApiMegaList(megaList.value);
    sourceStatus['api-mega-list'] = rows.length;
    entries.push(...rows);
  } else sourceStatus['api-mega-list'] = `error: ${megaList.reason.message}`;
  sourceStatus.curated = ENRICHED_CURATED_APIS.length;
  entries.push(...ENRICHED_CURATED_APIS);
  const deduped = dedupe(entries).map(enrichApiMetadata);
  return { dataVersion: DATA_VERSION, generatedAt: new Date().toISOString(), sourceStatus, entries: deduped };
}

function keyFor(entry) {
  const compact = compactName(entry.name);
  if (KNOWN_BEST_NAMES.has(compact)) return `known:${compact}`;
  const host = String(entry.url || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  return `${compact}|${host}`;
}

function mergeEntry(a, b) {
  const sources = new Set([...(a.sources || [a.source]), ...(b.sources || [b.source])].filter(Boolean));
  const merged = {
    ...a,
    description: (b.description || '').length > (a.description || '').length ? b.description : a.description,
    auth: a.auth !== 'Unknown' ? a.auth : b.auth,
    https: Boolean(a.https || b.https),
    cors: a.cors === 'Yes' || b.cors === 'Yes' ? 'Yes' : (a.cors !== 'Unknown' ? a.cors : b.cors),
    category: b.source === 'curated' && b.category ? b.category : (a.category !== 'Unknown' ? a.category : b.category),
    openapiUrl: a.openapiUrl || b.openapiUrl || null,
    provider: a.provider || b.provider,
    sourceWeight: (a.sourceWeight || 0) + (b.sourceWeight || 0),
    sources: [...sources],
  };
  for (const field of ENRICHMENT_FIELDS) {
    const av = a[field];
    const bv = b[field];
    if (Array.isArray(av) || Array.isArray(bv)) merged[field] = uniqueArray(av, bv);
    else merged[field] = b.source === 'curated' && bv ? bv : (av || bv);
  }
  return merged;
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
    for (const field of ENRICHMENT_FIELDS) {
      if (e[field] == null) continue;
      clean[field] = Array.isArray(e[field]) ? uniqueArray(e[field]) : e[field];
    }
    const key = keyFor(clean);
    map.set(key, map.has(key) ? mergeEntry(map.get(key), clean) : clean);
  }
  return [...map.values()];
}

async function loadData(refresh = false) {
  if (!refresh && await cacheIsFresh()) {
    const cached = JSON.parse(await readFile(CACHE_PATH, 'utf8'));
    if (cached.dataVersion === DATA_VERSION) return (cached.entries || []).map(enrichApiMetadata);
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
    const targeted = q.size ? targetedBoost(e, args.query.toLowerCase()) : 0;
    if (q.size && matched === 0 && domain <= 0 && targeted <= 0) return [];
    const s = q.size ? score(e, q, args.query.toLowerCase()) : 1;
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

export async function buildSearchIndex(options = {}) {
  return loadData(Boolean(options.refresh));
}

export async function searchApis(options = {}) {
  const args = {
    query: options.query || '',
    category: options.category || null,
    source: options.source || null,
    noAuth: Boolean(options.noAuth),
    https: Boolean(options.https),
    openapi: Boolean(options.openapi),
    cors: options.cors || null,
    limit: Math.min(Math.max(Number(options.limit || 8), 1), 50),
    check: Boolean(options.check),
    refresh: Boolean(options.refresh),
  };
  let rows = filterEntries(await loadData(args.refresh), args);
  if (args.check) rows = await checkRows(rows);
  return rows;
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
    if (e.tags?.length) console.log(`   - Tags: ${e.tags.slice(0, 8).join(', ')}`);
    if (e.useCases?.length) console.log(`   - Good for: ${e.useCases.slice(0, 3).join('; ')}`);
    if (e.freeTier || e.pricing) console.log(`   - Pricing/free tier: ${e.freeTier || e.pricing}`);
    if (e.caveats?.length) console.log(`   - Caveat: ${e.caveats[0]}`);
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
  let rows = await searchApis(args);
  if (args.json) console.log(JSON.stringify(rows, null, 2));
  else printMarkdown(rows);
  return 0;
}

function isDirectRun() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  main().then(code => process.exitCode = code).catch(err => {
    console.error(`public-api-finder: ${err.message}`);
    process.exitCode = 1;
  });
}
