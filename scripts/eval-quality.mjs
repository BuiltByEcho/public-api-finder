#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const cases = [
  { q: 'free frontend-safe weather alerts for US cities', args: ['--no-auth','--https','--cors','Yes'], expectCategory: /weather/i, expectAnyName: /weather|meteo|pirate/i },
  { q: 'global weather forecast hourly no key browser', args: [], expectCategory: /weather/i, expectAuth: 'No', expectCors: 'Yes' },
  { q: 'rain radar severe weather alerts us no signup', args: [], expectCategory: /weather/i, expectAuth: 'No' },
  { q: 'crypto token metadata logos contract addresses', args: ['--category','Cryptocurrency'], expectCategory: /cryptocurrency/i, expectAnyName: /coinmarketcap|coingecko|coinpaprika|coinbase/i },
  { q: 'ethereum gas prices no auth', args: [], expectCategory: /cryptocurrency|blockchain/i, expectAuth: 'No' },
  { q: 'solana token price market cap dex no key', args: [], expectCategory: /cryptocurrency/i },
  { q: 'intraday stock candles historical OHLC forex', args: [], expectCategory: /finance/i, expectAnyName: /polygon|twelve|alpha|finnhub/i },
  { q: 'free stock quote API no auth', args: [], expectCategory: /finance/i, expectAuth: 'No' },
  { q: 'company fundamentals earnings financial statements', args: [], expectCategory: /finance/i },
  { q: 'reverse geocode lat lon to address no auth', args: ['--https'], expectCategory: /geocoding|location/i, expectAuth: 'No', expectAnyName: /nominatim|geocode/i },
  { q: 'map tiles routing distance matrix places', args: [], expectCategory: /geocoding|location|maps/i, expectAnyName: /mapbox|openstreetmap|google|here|tomtom/i },
  { q: 'timezone from latitude longitude no auth', args: [], expectCategory: /geocoding|location/i },
  { q: 'remote developer jobs salary company listings', args: [], expectCategory: /jobs/i, expectAnyName: /adzuna|graphql|usajobs|search.gov/i },
  { q: 'nba player stats team standings no auth', args: [], expectCategory: /sports/i, expectAuth: 'No', expectAnyName: /balldontlie|nba/i },
  { q: 'soccer fixtures odds standings predictions api key', args: [], expectCategory: /sports/i, expectAnyName: /football|sports/i },
  { q: 'anime character search images ratings no auth cors', args: ['--no-auth','--https'], expectCategory: /anime/i, expectAuth: 'No', expectAnyName: /jikan/i },
  { q: 'movie database posters cast ratings imdb', args: [], expectCategory: /media|video|entertainment/i, expectAnyName: /tmdb|omdb/i },
  { q: 'tv episode schedule cast search no auth', args: [], expectCategory: /video|media|entertainment/i, expectAnyName: /tvmaze|tmdb/i },
  { q: 'news article search by topic and country', args: [], expectCategory: /news/i, expectAnyName: /news api|gnews|currents|guardian/i },
  { q: 'election campaign finance donations candidates', args: [], expectCategory: /government|open data/i, expectAnyName: /fec|data.gov/i },
  { q: 'congress bills votes representatives civic data', args: [], expectCategory: /government|open data/i },
  { q: 'food barcode ingredients allergens nutrition no auth cors', args: ['--no-auth','--https'], expectCategory: /food/i, expectAuth: 'No', expectAnyName: /open food facts/i },
  { q: 'checkout subscriptions invoices payments openapi', args: ['--openapi'], expectCategory: /payments|openapi/i, expectAnyName: /stripe|payments/i },
  { q: 'validate disposable email mx deliverability', args: [], expectCategory: /email/i, expectAnyName: /abstract|mailbox|email/i },
  { q: 'ip reputation vpn proxy privacy detection', args: ['--https'], expectCategory: /security|geocoding|location/i, expectAnyName: /ipqualityscore|proxycheck|ipinfo/i },
  { q: 'word synonyms antonyms dictionary pronunciation', args: [], expectCategory: /dictionar|education/i, expectAnyName: /dictionary|wordsapi|wordnik|merriam/i },
  { q: 'meal planning recipes by ingredients nutrition', args: [], expectCategory: /food/i, expectAnyName: /spoonacular|edamam|themealdb|open food/i },
  { q: 'air quality by coordinates pollutant measurements', args: [], expectCategory: /environment|science|weather/i, expectAnyName: /openaq|air quality|aqicn/i },
  { q: 'historical currency exchange rates no auth cors', args: ['--no-auth','--https'], expectCategory: /currency exchange/i, expectAuth: 'No', expectAnyName: /frankfurter|currency/i },
  { q: 'public holidays by country next long weekend no auth', args: ['--no-auth','--https'], expectCategory: /calendar|date/i, expectAuth: 'No', expectAnyName: /nager|holiday/i },
  { q: 'fake ecommerce cart products users for frontend demo', args: ['--no-auth','--https'], expectCategory: /test data|shopping/i, expectAuth: 'No', expectAnyName: /fake store|dummyjson|jsonplaceholder/i },
  { q: 'gtfs transit stops routes realtime departures', args: [], expectCategory: /transport|transit/i, expectAnyName: /transitland|transport|mbta|transportapi/i },
  { q: 'openapi spec for sms messaging send text', args: ['--openapi'], expectCategory: /communication|messaging|telecom|openapi/i, expectAnyName: /twilio|message|sms/i },
  { q: 'file upload storage s3 compatible openapi', args: ['--openapi'], expectCategory: /cloud|storage|openapi/i, expectAnyName: /amazon|s3|storage|backblaze|management/i },
  { q: 'public domain books search authors covers no auth', args: ['--no-auth','--https'], expectCategory: /books|education|open data/i, expectAuth: 'No', expectAnyName: /open library|google books|gutendex/i },
  { q: 'podcast search episodes rss metadata', args: [], expectCategory: /podcasts|media|entertainment|music/i, expectAnyName: /podcast|listen notes|itunes/i },
  { q: 'carbon intensity electricity grid emissions by region', args: [], expectCategory: /environment|science|open data/i, expectAnyName: /carbon|electricity|emissions/i },
  { q: 'domain whois dns records ssl certificate lookup', args: [], expectCategory: /security|development|openapi/i, expectAnyName: /whois|dns|ssl|certificate/i },
  { q: 'qr code generation api no auth', args: ['--no-auth','--https'], expectCategory: /development|utility|tools|test data|openapi/i, expectAuth: 'No', expectAnyName: /qr/i },
  { q: 'shorten urls branded links analytics', args: [], expectCategory: /development|url shortener|utility|openapi/i, expectAnyName: /bitly|short/i },
  { q: 'i need a free api for avatars profile pictures placeholder users no key', args: [], expectCategory: /test data|social|development|media/i, expectAuth: 'No', expectAnyName: /random user|dicebear|avatar|ui faces|placeholder/i },
  { q: 'generate identicon avatar svg from wallet address no auth cors', args: [], expectAuth: 'No', expectAnyName: /avatar|dicebear|boring|identicon|blockies/i },
  { q: 'nft metadata by contract token id ethereum polygon', args: [], expectCategory: /cryptocurrency|blockchain|openapi/i, expectAnyName: /alchemy|moralis|opensea|coinmarketcap|coinbase/i },
  { q: 'wallet balance transactions erc20 transfers api', args: [], expectCategory: /cryptocurrency|blockchain|openapi/i, expectAnyName: /etherscan|alchemy|moralis|covalent|block/i },
  { q: 'restaurant places nearby search opening hours photos', args: [], expectCategory: /geocoding|location|food|openapi/i, expectAnyName: /google|mapbox|foursquare|yelp|places/i },
  { q: 'vehicle vin decode recall safety data no auth', args: [], expectCategory: /transportation|government|open data/i, expectAnyName: /nhtsa|vin|vehicle/i },
  { q: 'license plate lookup vehicle owner', args: [], expectCategory: /transportation|government|openapi/i },
  { q: 'address autocomplete typeahead places browser cors', args: [], expectCategory: /geocoding|location/i, expectCors: 'Yes', expectAnyName: /mapbox|nominatim|geo/i },
  { q: 'free image search photos unsplash alternative no key', args: [], expectCategory: /photography|media|images|entertainment/i, expectAuth: 'No', expectAnyName: /pexels|pixabay|unsplash|wikimedia|openverse/i },
  { q: 'cat images random dog facts no auth', args: [], expectAuth: 'No', expectAnyName: /cat|dog|thecatapi|dog ceo/i },
  { q: 'jokes memes random quote api no auth', args: [], expectAuth: 'No', expectAnyName: /joke|meme|quote/i },
  { q: 'translation language detect text api free', args: [], expectCategory: /language|translation|text analysis|openapi/i, expectAnyName: /libretranslate|google|microsoft|detect/i },
  { q: 'sentiment analysis text moderation toxicity api', args: [], expectCategory: /machine learning|text analysis|ai|openapi/i, expectAnyName: /sentiment|moderation|toxicity|perspective/i },
  { q: 'sms no twilio cheaper alternative openapi', args: ['--openapi'], expectCategory: /communication|messaging|telecom|openapi/i, expectAnyName: /sms|message|telnyx|vonage|messagebird|plivo/i },
  { q: 'stripe alternative payments for crypto checkout x402', args: [], expectCategory: /payments|cryptocurrency|financial/i, expectAnyName: /stripe|paypal|coinbase|commerce|payment/i },
  { q: 'calendar events create google calendar openapi oauth', args: ['--openapi'], expectCategory: /calendar|openapi/i, expectAnyName: /google|calendar/i },
  { q: 'send email transactional api openapi', args: ['--openapi'], expectCategory: /email|communication|openapi/i, expectAnyName: /sendgrid|mailgun|postmark|resend|email/i },
  { q: 'package tracking shipment carrier tracking no auth', args: [], expectCategory: /tracking|logistics|commerce|openapi/i, expectAnyName: /tracking|shippo|aftership|ups|fedex/i },
  { q: 'open source vulnerability CVE lookup package security', args: [], expectCategory: /security|development|open data/i, expectAnyName: /nvd|cve|osv|security/i },
  { q: 'github repo stars issues commits api no auth', args: [], expectCategory: /development|open data/i, expectAnyName: /github|gitlab/i },
  { q: 'npm package downloads version metadata no key', args: [], expectCategory: /development|open data/i, expectAuth: 'No', expectAnyName: /npm|libraries.io|package/i },
  { q: 'docker image tags vulnerabilities registry api', args: [], expectCategory: /development|security|openapi/i, expectAnyName: /docker|registry|hub|security/i },
  { q: 'exchange rates but not crypto fiat only no auth', args: [], expectCategory: /currency exchange/i, expectAuth: 'No' },
  { q: 'crypto prices but not stocks no auth', args: [], expectCategory: /cryptocurrency/i, expectAuth: 'No' },
  { q: 'weather not climate current conditions no auth', args: [], expectCategory: /weather/i, expectAuth: 'No' },
  { q: 'login oauth user profile social auth api openid', args: [], expectCategory: /authentication|security|development|openapi/i, expectAnyName: /auth0|clerk|okta|openid|oauth|google/i },
  { q: 'create temporary email inbox receive messages api no auth', args: [], expectCategory: /email|test data|communication/i, expectAnyName: /mail|email|inbox|temp/i },
  { q: 'sms verification otp phone number lookup api', args: [], expectCategory: /communication|messaging|telecom|security/i, expectAnyName: /twilio|vonage|telnyx|numverify|phone/i },
  { q: 'phone number validation carrier line type country lookup', args: [], expectCategory: /communication|telecom|security|openapi/i, expectAnyName: /numverify|twilio|phone|abstract/i },
  { q: 'bank routing number iban validation payments', args: [], expectCategory: /financial|finance|payments|openapi/i, expectAnyName: /iban|bank|routing|plaid|stripe/i },
  { q: 'plaid alternative bank account transactions finance api', args: [], expectCategory: /finance|financial|payments|openapi/i, expectAnyName: /plaid|teller|truelayer|bank/i },
  { q: 'tax rates sales tax by address api', args: [], expectCategory: /finance|government|commerce|openapi/i, expectAnyName: /tax|avalara|taxjar/i },
  { q: 'address validation normalize usps deliverability api', args: [], expectCategory: /geocoding|location|openapi/i, expectAnyName: /smarty|usps|lob|address|geocod/i },
  { q: 'timezone offset daylight savings from coordinates', args: [], expectCategory: /geocoding|location|time/i, expectAnyName: /timezone|timezonedb|ipgeolocation|google|abstract/i },
  { q: 'public records business entity secretary of state api', args: [], expectCategory: /government|open data|business/i, expectAnyName: /opencorporates|business|company|data.gov/i },
  { q: 'company enrichment domain employees logo api', args: [], expectCategory: /business|openapi|development|marketing/i, expectAnyName: /clearbit|brandfetch|company|logo|domain/i },
  { q: 'logo from domain brand colors api no auth', args: [], expectCategory: /business|media|development|marketing/i, expectAnyName: /brandfetch|clearbit|logo|favicon/i },
  { q: 'favicon screenshot website preview api', args: [], expectCategory: /development|media|utility|openapi/i, expectAnyName: /screenshot|favicon|microlink|urlbox/i },
  { q: 'website metadata link preview open graph api no auth', args: [], expectCategory: /development|media|utility|openapi/i, expectAnyName: /microlink|linkpreview|metadata|open graph/i },
  { q: 'pdf generation html to pdf api', args: [], expectCategory: /documents|development|utility|openapi/i, expectAnyName: /pdf|document/i },
  { q: 'ocr extract text from image receipt api', args: [], expectCategory: /machine learning|ai|documents|openapi/i, expectAnyName: /ocr|vision|mindee|google|azure/i },
  { q: 'speech to text transcription audio api', args: [], expectCategory: /ai|machine learning|audio|openapi/i, expectAnyName: /whisper|assemblyai|deepgram|speech/i },
  { q: 'text to speech voice generation api', args: [], expectCategory: /ai|audio|machine learning|openapi/i, expectAnyName: /elevenlabs|speech|voice|tts/i },
  { q: 'image generation ai api stable diffusion', args: [], expectCategory: /ai|machine learning|media|openapi/i, expectAnyName: /stability|openai|replicate|image/i },
  { q: 'moderate images nudity violence safe search api', args: [], expectCategory: /ai|machine learning|security|openapi/i, expectAnyName: /moderation|sightengine|vision|safe/i },
  { q: 'blockchain wallet risk sanctions screening api', args: [], expectCategory: /cryptocurrency|security|finance/i, expectAnyName: /chainalysis|trm|sanction|wallet|elliptic/i },
  { q: 'sanctions ofac pep screening person company api', args: [], expectCategory: /security|government|finance|openapi/i, expectAnyName: /ofac|sanction|opensanctions|pep/i },
  { q: 'zipcode to city state county demographics no auth', args: [], expectCategory: /geocoding|government|open data/i, expectAuth: 'No', expectAnyName: /zippopotam|census|zip|postal/i },
  { q: 'school district boundary by address api', args: [], expectCategory: /education|government|geocoding|open data/i, expectAnyName: /school|district|census/i },
  { q: 'real estate property value rent estimate api', args: [], expectCategory: /real estate|property|openapi|finance/i, expectAnyName: /rentcast|zillow|attom|real estate|property/i },
  { q: 'mortgage rates loan calculator api', args: [], expectCategory: /finance|financial|real estate|openapi/i, expectAnyName: /mortgage|loan|rate/i },
  { q: 'flight status airport arrivals departures api', args: [], expectCategory: /transportation|travel|openapi/i, expectAnyName: /aviation|flight|airport|amadeus/i },
  { q: 'hotel search booking availability api', args: [], expectCategory: /travel|commerce|openapi/i, expectAnyName: /hotel|booking|amadeus/i },
  { q: 'recipe from pantry ingredients avoid allergens api', args: [], expectCategory: /food/i, expectAnyName: /spoonacular|edamam|recipe|meal/i },
  { q: 'calorie macro nutrition label parse api', args: [], expectCategory: /food|health|openapi/i, expectAnyName: /nutrition|edamam|spoonacular|food/i },

];

let failures = 0;
for (const [i, c] of cases.entries()) {
  const res = spawnSync(process.execPath, ['src/cli.js', c.q, ...c.args, '--limit', '5', '--json'], { encoding: 'utf8' });
  if (res.status !== 0) {
    failures++;
    console.log(`FAIL ${i+1} ${c.q}: command failed ${res.stderr}`);
    continue;
  }
  const rows = JSON.parse(res.stdout);
  const top = rows[0];
  const top3 = rows.slice(0,3);
  const checks = [];
  if (!top) checks.push('no results');
  if (top && c.expectCategory && !c.expectCategory.test(top.category || '')) checks.push(`top category ${top.category} !~ ${c.expectCategory}`);
  if (top && c.expectAuth && top.auth !== c.expectAuth) checks.push(`top auth ${top.auth} != ${c.expectAuth}`);
  if (top && c.expectCors && top.cors !== c.expectCors) checks.push(`top cors ${top.cors} != ${c.expectCors}`);
  if (c.expectAnyName && !top3.some(r => c.expectAnyName.test(r.name || '') || c.expectAnyName.test(r.description || '') || c.expectAnyName.test(r.url || ''))) checks.push(`top3 missing ${c.expectAnyName}`);
  const ok = checks.length === 0;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${i+1}. ${c.q}`);
  rows.slice(0,3).forEach((r, idx) => console.log(`  ${idx+1}. ${r.name} | ${r.category} | auth=${r.auth} | cors=${r.cors} | score=${r.score}`));
  if (!ok) console.log(`  Reasons: ${checks.join('; ')}`);
}
console.log(`\n${cases.length - failures}/${cases.length} passed`);
process.exitCode = failures ? 1 : 0;
