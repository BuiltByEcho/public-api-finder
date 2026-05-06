/**
 * Public API Finder — Bankr x402 paid endpoint.
 *
 * Price/config lives in bankr.x402.json. Handler is intentionally
 * self-contained because Bankr x402 deploy uploads this source file.
 */

type ApiEntry = {
  name: string;
  url: string;
  description: string;
  auth: string;
  https: boolean;
  cors: string;
  category: string;
  source?: string;
  sourceWeight?: number;
  score?: number;
};

const CURATED_APIS: ApiEntry[] = [
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

const STOPWORDS = new Set(['a','an','and','api','apis','for','from','i','in','is','me','need','no','of','on','or','the','to','using','with']);

function tokens(text: string): string[] {
  return String(text || '').toLowerCase().match(/[a-z0-9]+/g)?.filter(t => t.length > 1 && !STOPWORDS.has(t)) || [];
}

function clean(text: string): string {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function score(entry: ApiEntry, queryTokens: string[]): number {
  const haystack = `${entry.name} ${entry.category} ${entry.description} ${entry.url}`.toLowerCase();
  let s = 0;
  for (const token of queryTokens) {
    if (entry.name.toLowerCase().includes(token)) s += 14;
    if (entry.category.toLowerCase().includes(token)) s += 10;
    if (entry.description.toLowerCase().includes(token)) s += 6;
    if (entry.url.toLowerCase().includes(token)) s += 3;
    if (haystack.includes(token)) s += 1;
  }
  if (/no auth|no key|without key|free/.test(queryTokens.join(' ')) && entry.auth === 'No') s += 20;
  if (/cors|browser|frontend/.test(queryTokens.join(' ')) && entry.cors === 'Yes') s += 12;
  if (entry.https) s += 3;
  s += entry.sourceWeight || 0;
  return s;
}

function search(body: any) {
  const query = String(body.query || '').trim();
  if (!query) throw new Error('query is required');
  const q = tokens(query);
  const limit = Math.min(Math.max(Number(body.limit || 8), 1), 20);
  return CURATED_APIS
    .filter((entry) => !body.category || entry.category.toLowerCase().includes(String(body.category).toLowerCase()))
    .filter((entry) => !body.noAuth || entry.auth === 'No')
    .filter((entry) => !body.https || entry.https)
    .filter((entry) => !body.cors || entry.cors.toLowerCase() === String(body.cors).toLowerCase())
    .map((entry) => ({ ...entry, description: clean(entry.description), source: 'curated', score: score(entry, q) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => (b.score || 0) - (a.score || 0) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ error: 'POST required' }, { status: 405 });
  }

  try {
    const body = await req.json();
    const results = search(body);
    return Response.json({
      query: body.query,
      price: '$0.01',
      charged: results.length > 0,
      resultCount: results.length,
      results,
      note: 'Paid x402 pull. CLI remains free; this endpoint charges only after a successful response.',
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Bad request' }, { status: 400 });
  }
}
