#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const cases = [
  { q: 'crypto prices', args: ['--no-auth','--https','--cors','Yes'], topCategory: /cryptocurrency/i, top3Category: /cryptocurrency/i, mustName: /dexscreener|dexpaprika|defillama|geckoterminal|coinpaprika/i, forbid: /weather|joke|tvmaze|jobs/i },
  { q: 'stock prices', args: ['--no-auth','--https','--cors','Yes'], topCategory: /finance/i, top3Category: /finance/i, forbid: /weather|joke|tvmaze|jobs/i },
  { q: 'free stock quote API no auth', args: ['--no-auth','--https'], topCategory: /finance/i, mustName: /stooq|portfolio|alpha|finnhub|twelve/i, forbid: /weather|joke|anime|tv/i },
  { q: 'solana token price market cap dex no key', args: ['--no-auth','--https'], topCategory: /cryptocurrency/i, top3Category: /cryptocurrency/i, mustName: /dexscreener|dexpaprika|geckoterminal|defillama/i },
  { q: 'wallet balance transactions erc20 transfers api', args: [], topCategory: /cryptocurrency|openapi/i, mustName: /etherscan|alchemy|moralis|covalent|block/i },
  { q: 'weather forecast no auth cors', args: ['--no-auth','--https','--cors','Yes'], topCategory: /weather/i, top3Category: /weather/i, mustName: /open-meteo|national weather|pirate/i, forbid: /joke|crypto|stocks/i },
  { q: 'historical weather api', args: [], topCategory: /weather/i, mustName: /open-meteo|weather/i },
  { q: 'weather alerts us api', args: ['--no-auth'], topCategory: /weather/i, mustName: /national weather|weather/i },
  { q: 'geocoding api no auth', args: ['--no-auth','--https'], topCategory: /geocoding|location/i, mustName: /nominatim|geocod|zippopotam|ipinfo/i },
  { q: 'reverse geocoding api', args: [], topCategory: /geocoding|location/i, mustName: /nominatim|geocod|mapbox|google/i },
  { q: 'maps routing api', args: [], topCategory: /geocoding|location/i, mustName: /graphhopper|mapbox|google|here|tomtom/i, forbid: /linkedin/i },
  { q: 'public transit api', args: [], topCategory: /transport|transit/i, mustName: /transitland|transport|mbta/i },
  { q: 'jobs api remote', args: [], topCategory: /jobs|agents/i, mustName: /graphql jobs|adzuna|usajobs|search.gov|linkedin jobs/i },
  { q: 'government jobs api', args: [], topCategory: /jobs|government/i, mustName: /usajobs|search.gov/i },
  { q: 'company enrichment api', args: [], topCategory: /business|marketing|openapi/i, mustName: /clearbit|brandfetch|opencorporates|company/i },
  { q: 'email validation api', args: [], topCategory: /email/i, mustName: /abstract|email|mail/i },
  { q: 'phone number lookup api', args: [], topCategory: /communication|telecom|security|openapi/i, mustName: /numverify|twilio|phone|abstract/i },
  { q: 'sms api', args: [], topCategory: /communication|messaging|telecom|openapi/i, mustName: /twilio|telnyx|vonage|sms|message/i },
  { q: 'webhook testing api', args: [], mustName: /webhook|requestbin|pipedream|beeceptor|alchemy/i },
  { q: 'payment processing api', args: [], topCategory: /payments|financial|openapi/i, mustName: /stripe|paypal|checkout|payment/i },
  { q: 'subscriptions billing api', args: [], topCategory: /payments|openapi/i, mustName: /stripe|billing|subscription|chargebee/i },
  { q: 'oauth identity api', args: [], topCategory: /authentication|security|development|openapi/i, mustName: /auth0|clerk|okta|oauth|openid/i },
  { q: 'passwordless auth api', args: [], topCategory: /authentication|security|openapi/i, mustName: /auth0|clerk|magic|stytch|passwordless/i },
  { q: 'screenshot api', args: [], topCategory: /development|media|documents|openapi/i, mustName: /urlbox|microlink|screenshot/i },
  { q: 'link preview api', args: [], topCategory: /development|media|utility|openapi/i, mustName: /microlink|linkpreview|metadata|open graph/i },
  { q: 'website metadata api', args: [], topCategory: /development|media|utility|openapi/i, mustName: /microlink|metadata|open graph|urlbox/i },
  { q: 'pdf generation api', args: [], topCategory: /documents|development|utility|openapi/i, mustName: /pdf|document/i },
  { q: 'ocr api', args: [], topCategory: /machine learning|ai|documents|openapi/i, mustName: /ocr|vision|mindee/i },
  { q: 'image generation api', args: [], topCategory: /ai|machine learning|media|openapi/i, mustName: /stability|openai|replicate|image/i },
  { q: 'text to speech api', args: [], topCategory: /ai|audio|machine learning|openapi/i, mustName: /elevenlabs|speech|voice|tts/i },
  { q: 'speech to text api', args: [], topCategory: /ai|audio|machine learning|openapi/i, mustName: /assemblyai|deepgram|whisper|speech/i },
  { q: 'vulnerability database api', args: [], topCategory: /security|development|open data/i, mustName: /osv|nvd|cve|vulnerab/i },
  { q: 'cve lookup api', args: [], topCategory: /security|open data/i, mustName: /nvd|cve|osv/i },
  { q: 'npm package metadata api', args: ['--no-auth'], topCategory: /development|open data/i, mustName: /npm|libraries.io|package/i },
  { q: 'github repo stats api', args: [], topCategory: /development|open data/i, mustName: /github|gitlab/i },
  { q: 'domain dns lookup api', args: [], topCategory: /security|development|openapi/i, mustName: /dns|google dns|whois|ssl/i },
  { q: 'open data demographics api', args: [], topCategory: /government|open data/i, mustName: /census|data.gov|demographics/i },
  { q: 'fake ecommerce api for testing', args: ['--no-auth','--https'], topCategory: /test data|shopping/i, mustName: /fake store|dummyjson|jsonplaceholder/i },
  { q: 'joke api', args: ['--no-auth'], topCategory: /entertainment|jokes/i, mustName: /joke/i, forbid: /weather|crypto|stock/i },
  { q: 'cat images random dog facts no auth', args: ['--no-auth'], mustName: /cat|dog|thecatapi|dog ceo/i, forbid: /weather|stock|crypto/i },
  { q: 'food barcode ingredients allergens nutrition no auth cors', args: ['--no-auth','--https'], topCategory: /food/i, mustName: /open food facts/i },
  { q: 'recipe from pantry ingredients avoid allergens api', args: [], topCategory: /food/i, mustName: /spoonacular|edamam|recipe|meal/i },
  { q: 'air quality by coordinates pollutant measurements', args: [], topCategory: /environment|science|weather/i, mustName: /openaq|air quality|aqicn/i },
  { q: 'historical currency exchange rates no auth cors', args: ['--no-auth','--https'], topCategory: /currency exchange/i, mustName: /frankfurter|currency/i, forbid: /crypto|bitcoin|dex/i },
  { q: 'public holidays by country no auth', args: ['--no-auth','--https'], topCategory: /calendar|date/i, mustName: /nager|holiday|calendarific/i },
  { q: 'vehicle vin decode recall safety data no auth', args: ['--no-auth'], topCategory: /transportation|government|open data/i, mustName: /nhtsa|vin|vehicle/i },
  { q: 'real estate property value rent estimate api', args: [], topCategory: /real estate|property|openapi|finance/i, mustName: /rentcast|attom|zillow|real estate|property/i },
  { q: 'flight status airport arrivals departures api', args: [], topCategory: /transportation|travel|openapi/i, mustName: /aviation|flight|airport|amadeus/i },
  { q: 'hotel search booking availability api', args: [], topCategory: /travel|commerce|openapi/i, mustName: /hotel|booking|amadeus/i },
  { q: 'brand colors fonts logo company domain enrichment', args: [], topCategory: /business|marketing|development|openapi/i, mustName: /brandfetch|clearbit|logo|brand/i },
];

let failures = 0;
for (const [i, c] of cases.entries()) {
  const res = spawnSync(process.execPath, ['src/cli.js', c.q, ...c.args, '--limit', '5', '--json'], { encoding: 'utf8' });
  const rows = res.status === 0 ? JSON.parse(res.stdout || '[]') : [];
  const top = rows[0];
  const checks = [];
  if (!top) checks.push('no results');
  if (top && c.topCategory && !c.topCategory.test(top.category || '')) checks.push(`top category ${top.category} !~ ${c.topCategory}`);
  if (top && c.top3Category) {
    const bad = rows.slice(0, 3).filter(r => !c.top3Category.test(r.category || '')).map(r => `${r.name} (${r.category})`);
    if (bad.length) checks.push(`top3 off-domain: ${bad.join(', ')}`);
  }
  if (c.mustName && !rows.slice(0, 3).some(r => c.mustName.test(`${r.name} ${r.description} ${r.url}`))) checks.push(`top3 missing ${c.mustName}`);
  if (c.forbid && rows.slice(0, 5).some(r => c.forbid.test(`${r.name} ${r.category} ${r.description}`))) checks.push(`forbidden result ${c.forbid}`);
  const ok = checks.length === 0;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${i + 1}. ${c.q}`);
  rows.slice(0, 3).forEach((r, idx) => console.log(`  ${idx + 1}. ${r.name} | ${r.category} | auth=${r.auth} | cors=${r.cors} | score=${r.score}`));
  if (!ok) console.log(`  Reasons: ${checks.join('; ')}`);
}
console.log(`\n${cases.length - failures}/${cases.length} hardening cases passed`);
process.exitCode = failures ? 1 : 0;
