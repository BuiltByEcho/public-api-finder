#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const cases = [
  { q: 'free stock data for a frontend chart', args: ['--no-auth','--https'], expect: /finance/i, any: /stooq|portfolio|stock|finance/i, forbid: /weather|joke|anime/i },
  { q: 'api for checking token liquidity on dexes', args: [], expect: /cryptocurrency/i, any: /dexscreener|dexpaprika|geckoterminal|defillama/i },
  { q: 'browser safe weather forecast api', args: ['--no-auth','--https','--cors','Yes'], expect: /weather/i, any: /open-meteo|weather|pirate/i },
  { q: 'whois and dns lookup for a domain', args: [], expect: /security|development|openapi/i, any: /whois|dns|ssl/i },
  { q: 'send text messages to users api', args: [], expect: /communication|messaging|telecom|openapi/i, any: /twilio|sms|message|telnyx|vonage/i },
  { q: 'make pdf from html api', args: [], expect: /documents|development|openapi/i, any: /pdf|html/i },
  { q: 'find APIs for app screenshots', args: [], expect: /development|media|documents|openapi/i, any: /urlbox|microlink|screenshot|capture/i },
  { q: 'check if npm package has vulnerabilities', args: [], expect: /security|development|open data/i, any: /osv|nvd|vulnerability|npm/i },
  { q: 'lookup us census demographics by zip', args: [], expect: /government|open data|geocoding/i, any: /census|zippopotam|data.gov/i },
  { q: 'temporary email inbox for tests', args: ['--no-auth','--https'], expect: /email/i, any: /mail|email|inbox/i },
  { q: 'login users with magic link api', args: [], expect: /authentication|security|openapi/i, any: /stytch|magic|auth0|clerk|passwordless/i },
  { q: 'mock webhooks during development', args: [], expect: /development|test data|openapi/i, any: /webhook|beeceptor|requestbin|mock/i },
  { q: 'public holidays calendar for germany', args: ['--no-auth','--https'], expect: /calendar|date/i, any: /nager|holiday|calendar/i },
  { q: 'random user data for frontend seed demo', args: ['--no-auth','--https'], expect: /test data/i, any: /random user|jsonplaceholder|dummyjson|fake/i },
  { q: 'recipe nutrition search by ingredients', args: [], expect: /food/i, any: /spoonacular|edamam|open food|recipe|nutrition/i },
  { q: 'flight arrivals by airport code', args: [], expect: /travel|transportation|openapi/i, any: /aviation|flight|airport|amadeus/i },
  { q: 'rent estimate property valuation api', args: [], expect: /real estate|property|finance|openapi/i, any: /rentcast|attom|property|real estate/i },
  { q: 'container image tags registry api', args: [], expect: /development|security|openapi/i, any: /docker|registry|container/i },
  { q: 'open graph card preview for url', args: [], expect: /development|media|utility|openapi/i, any: /microlink|open graph|link preview|metadata/i },
  { q: 'speech transcription from uploaded audio', args: [], expect: /ai|audio|machine learning|openapi/i, any: /assemblyai|deepgram|whisper|transcription/i },
  // Over-filter / tight filter checks: should not pad unrelated junk.
  { q: 'stock quote no auth cors yes', args: ['--no-auth','--https','--cors','Yes'], any: /portfolio|stooq|stock|finance/i, forbid: /weather|joke|tvmaze|anime|jobs/i, max: 5, allowEmpty: true },
  { q: 'crypto exchange orderbook no auth cors yes', args: ['--no-auth','--https','--cors','Yes'], expect: /cryptocurrency/i, any: /0x|coinpaprika|dexpaprika|dex|crypto/i, forbid: /weather|stock|joke/i, max: 5 },
  { q: 'oauth login no auth cors yes', args: ['--no-auth','--https','--cors','Yes'], forbid: /weather|joke|food|crypto|stock|calendar|holiday/i, max: 5, allowEmpty: true },
  { q: 'webhook testing no auth cors yes', args: ['--no-auth','--https','--cors','Yes'], any: /webhook|beeceptor|jsonplaceholder|mock/i, forbid: /weather|crypto|stock/i, max: 5 },
  { q: 'medical diagnosis api no auth cors yes', args: ['--no-auth','--https','--cors','Yes'], forbid: /weather|crypto|stock|joke|tvmaze|anime|email|animals|food/i, max: 5, allowEmpty: true },
];

function checkRows(rows, c) {
  const checks = [];
  const top = rows[0];
  if (!top && !c.allowEmpty) checks.push('no results');
  if (top && c.expect && !c.expect.test(top.category || '')) checks.push(`top category ${top.category} !~ ${c.expect}`);
  if (c.any && !(c.allowEmpty && rows.length === 0) && !rows.slice(0, 3).some(r => c.any.test(`${r.name} ${r.category} ${r.description} ${r.url}`))) checks.push(`top3 missing ${c.any}`);
  if (c.forbid && rows.some(r => c.forbid.test(`${r.name} ${r.category} ${r.description}`))) checks.push(`forbidden ${c.forbid}`);
  if (c.max && rows.length > c.max) checks.push(`too many rows ${rows.length} > ${c.max}`);
  return checks;
}

let failures = 0;
for (const [i, c] of cases.entries()) {
  const res = spawnSync(process.execPath, ['src/cli.js', c.q, ...c.args, '--limit', String(c.max || 5), '--json'], { encoding: 'utf8' });
  const rows = res.status === 0 ? JSON.parse(res.stdout || '[]') : [];
  const checks = checkRows(rows, c);
  const ok = checks.length === 0;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${i + 1}. ${c.q}`);
  rows.slice(0, 3).forEach((r, idx) => console.log(`  ${idx + 1}. ${r.name} | ${r.category} | auth=${r.auth} | cors=${r.cors} | score=${r.score}`));
  if (!ok) console.log(`  Reasons: ${checks.join('; ')}`);
}
console.log(`\n${cases.length - failures}/${cases.length} mutation cases passed`);
process.exitCode = failures ? 1 : 0;
