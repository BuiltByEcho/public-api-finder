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
