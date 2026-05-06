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
const DATA_VERSION = 10;


const TARGETED_BOOSTS = [
  [/\b(login|openid|social auth|authentication|user profile)\b/, /\b(auth0|clerk|okta|openid connect|social login|authentication api)\b/i, 170],
  [/\b(temporary email|temp email|inbox|receive messages)\b/, /\b(mail\.tm|dropmail|mailbox|email|inbox)\b/i, 90],
  [/\b(otp|sms verification|phone number|line type)\b/, /\b(twilio verify|numverify|telnyx|vonage|phone number validation)\b/i, 170],
  [/\b(bank account|banking|plaid|iban|routing number)\b/, /\b(plaid|iban|bank|routing|teller|truelayer)\b/i, 90],
  [/\b(sales tax|tax rates|tax calculation|taxjar|avalara)\b/, /\b(taxjar|avalara|sales tax|tax rates)\b/i, 90],
  [/\b(address validation|normalize|usps)\b/, /\b(smarty|usps|address validation|street api|lob)\b/i, 80],
  [/\b(timezone|daylight savings|utc offset)\b/, /\b(timezonedb|timezone|utc offset|daylight savings)\b/i, 80],
  [/\b(company enrichment|business entity|secretary of state|brand colors|domain logo|logo from domain)\b/, /\b(opencorporates|brandfetch|clearbit|business entity|domain enrichment|brand logo)\b/i, 135],
  [/\b(screenshot|website preview|link preview|open graph|website metadata)\b/, /\b(microlink|urlbox|screenshot|open graph|link preview|metadata)\b/i, 135],
  [/\b(favicon)\b/, /\b(microlink|urlbox|favicon)\b/i, 70],
  [/\b(pdf|html to pdf)\b/, /\b(pdfshift|api2pdf|html to pdf|document rendering)\b/i, 175],
  [/\b(ocr|receipt|extract text)\b/, /\b(ocr|vision|mindee|receipt|document)\b/i, 125],
  [/\b(speech to text|transcription|audio transcription)\b/, /\b(assemblyai|deepgram|whisper|audio transcription|audio intelligence)\b/i, 175],
  [/\b(text to speech|voice generation|tts)\b/, /\b(elevenlabs|text to speech|voice|tts|deepgram)\b/i, 135],
  [/\b(image generation|stable diffusion)\b/, /\b(stability|stable diffusion|replicate|openai|image generation)\b/i, 135],
  [/\b(moderate images|image moderation|nudity|violence|safe search)\b/, /\b(sightengine|safe search|nudity|violence|offensive content)\b/i, 175],
  [/\b(sanctions|ofac|pep|kyc|aml)\b/, /\b(opensanctions|ofac|sanctions|pep|kyc|aml|chainalysis)\b/i, 135],
  [/\b(wallet risk|crypto sanctions|blockchain wallet risk)\b/, /\b(chainalysis|trm|elliptic|sanctions|wallet risk)\b/i, 95],
  [/\b(zipcode|zip code|postal code)\b/, /\b(zippopotam|zip|postal|census)\b/i, 80],
  [/\b(real estate|property value|rent estimate)\b/, /\b(rentcast|attom|zillow|real estate|property|rent estimate)\b/i, 135],
  [/\b(mortgage|loan calculator|loan rate)\b/, /\b(mortgage|loan|rate)\b/i, 110],
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
    categoryWeights: { finance: 16, financial: 16, 'currency exchange': 5 },
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
    categoryWeights: { 'currency exchange': 24, finance: 3, financial: 3, cryptocurrency: -10 },
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

function compactName(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }
const KNOWN_BEST_NAMES = new Map(CURATED_APIS.map(api => [compactName(api.name), 15]));

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


function targetedBoost(entry, queryText) {
  const haystack = `${entry.name || ''} ${entry.category || ''} ${entry.description || ''} ${entry.url || ''}`;
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

function score(entry, queryTokens, queryText = '') {
  let base = textScore(entry, queryTokens);
  if (entry.openapiUrl) base += 2;
  if (entry.sources?.length > 1) base += 2;
  if (entry.auth === 'No') base += 1;
  if (entry.https) base += 1;
  if (asciiRatio(entry.name) < 0.7) base -= 60;
  else if (asciiRatio(`${entry.name || ''} ${entry.description || ''}`) < 0.65) base -= 18;
  base += knownBestBoost(entry.name);
  return base + domainAdjustment(entry, queryTokens) + targetedBoost(entry, queryText) - genericCloudPenalty(entry, queryText);
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
  return { dataVersion: DATA_VERSION, generatedAt: new Date().toISOString(), sourceStatus, entries: dedupe(entries) };
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
    cors: a.cors === 'Yes' || b.cors === 'Yes' ? 'Yes' : (a.cors !== 'Unknown' ? a.cors : b.cors),
    category: b.source === 'curated' && b.category ? b.category : (a.category !== 'Unknown' ? a.category : b.category),
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
    if (cached.dataVersion === DATA_VERSION) return cached.entries || [];
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
