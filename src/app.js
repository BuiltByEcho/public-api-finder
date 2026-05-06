import { createServer as createHttpServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { searchApis } from './cli.js';

const DEFAULT_PULL_PRICE_CENTS = 1;
const DEFAULT_CREDITS_PER_PULL = 1;

function json(res, status, body, headers = {}) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(payload);
}

function html(res, body) {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(raw);
  } catch {
    const err = new Error('Invalid JSON body');
    err.status = 400;
    throw err;
  }
}

function accountFromRequest(req, body = {}) {
  const auth = req.headers.authorization || '';
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  return String(body.account || req.headers['x-api-key'] || bearer || '').trim();
}

function assertAccount(account) {
  if (!account) {
    const err = new Error('Missing account. Pass X-API-Key, Authorization: Bearer, or body.account.');
    err.status = 401;
    throw err;
  }
}

class CreditLedger {
  constructor(path) {
    this.path = path;
    this.data = null;
  }

  async load() {
    if (this.data) return this.data;
    try {
      this.data = JSON.parse(await readFile(this.path, 'utf8'));
    } catch {
      this.data = { version: 1, accounts: {}, topups: {}, events: [] };
    }
    return this.data;
  }

  async save() {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, JSON.stringify(this.data, null, 2));
  }

  async balance(account) {
    const data = await this.load();
    return data.accounts[account]?.credits || 0;
  }

  async grant(account, credits, meta = {}) {
    assertAccount(account);
    if (!Number.isFinite(credits) || credits <= 0) {
      const err = new Error('credits must be a positive number');
      err.status = 400;
      throw err;
    }
    const data = await this.load();
    data.accounts[account] ||= { credits: 0, createdAt: new Date().toISOString() };
    data.accounts[account].credits += credits;
    data.accounts[account].updatedAt = new Date().toISOString();
    data.events.push({ id: randomUUID(), type: 'grant', account, credits, meta, at: new Date().toISOString() });
    await this.save();
    return data.accounts[account].credits;
  }

  async spend(account, credits, meta = {}) {
    assertAccount(account);
    const data = await this.load();
    const current = data.accounts[account]?.credits || 0;
    if (current < credits) {
      const err = new Error(`Insufficient credits: need ${credits}, have ${current}`);
      err.status = 402;
      err.code = 'INSUFFICIENT_CREDITS';
      err.balance = current;
      throw err;
    }
    data.accounts[account].credits = current - credits;
    data.accounts[account].updatedAt = new Date().toISOString();
    data.events.push({ id: randomUUID(), type: 'spend', account, credits, meta, at: new Date().toISOString() });
    await this.save();
    return data.accounts[account].credits;
  }

  async createTopup(account, credits, usdCents, meta = {}) {
    assertAccount(account);
    const id = `topup_${randomUUID()}`;
    const data = await this.load();
    data.topups[id] = {
      id,
      account,
      credits,
      usdCents,
      status: 'pending',
      meta,
      createdAt: new Date().toISOString(),
    };
    data.events.push({ id: randomUUID(), type: 'topup.created', account, topupId: id, credits, usdCents, meta, at: new Date().toISOString() });
    await this.save();
    return data.topups[id];
  }
}

function bankrInstructions(topup, env) {
  const receiveAddress = env.BANKR_RECEIVE_ADDRESS || env.PUBLIC_API_FINDER_RECEIVE_ADDRESS || 'SET_BANKR_RECEIVE_ADDRESS';
  const dollars = (topup.usdCents / 100).toFixed(2);
  return {
    provider: 'bankr',
    status: 'pending_manual_confirmation',
    receiveAddress,
    network: env.BANKR_NETWORK || 'Base',
    asset: env.BANKR_ASSET || 'USDC',
    memo: topup.id,
    prompt: `Send $${dollars} ${env.BANKR_ASSET || 'USDC'} on ${env.BANKR_NETWORK || 'Base'} to ${receiveAddress} for ${topup.credits} Public API Finder credits. Memo/order id: ${topup.id}`,
  };
}

function landingPage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Public API Finder</title>
<style>
body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;background:#07111f;color:#e6f7ff}main{max-width:900px;margin:0 auto;padding:64px 24px}.eyebrow{color:#74e7ff;font-weight:700;letter-spacing:.08em;text-transform:uppercase}h1{font-size:clamp(42px,8vw,84px);line-height:.92;margin:12px 0 18px}p{font-size:20px;line-height:1.55;color:#b9d6e2}.card{background:rgba(255,255,255,.07);border:1px solid rgba(116,231,255,.25);border-radius:24px;padding:24px;margin-top:24px;box-shadow:0 24px 80px rgba(0,0,0,.35)}code{background:rgba(0,0,0,.35);padding:2px 6px;border-radius:7px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}.price{font-size:36px;font-weight:800;color:#fff}.muted{color:#87a9b8;font-size:15px}</style>
</head>
<body><main>
<div class="eyebrow">Agent-native API discovery</div>
<h1>Find the right public API in one pull.</h1>
<p>Public API Finder ranks free/public APIs for prototypes, agents, and app builders. The CLI is free. The hosted API uses credits designed for Bankr-powered top-ups.</p>
<div class="grid">
<section class="card"><div class="price">$0.01</div><p>per successful enriched pull</p><p class="muted">1 credit = 1 ranked API search result set.</p></section>
<section class="card"><h2>Try the API</h2><p><code>POST /api/search</code><br/>Use <code>X-API-Key</code>, spend 1 credit only when results return.</p></section>
<section class="card"><h2>Bankr-ready</h2><p><code>POST /api/credits/topup</code><br/>Creates a Bankr payment prompt and pending credit order.</p></section>
</div>
</main></body></html>`;
}

export function createApp(options = {}) {
  const env = options.env || process.env;
  const ledger = options.ledger || new CreditLedger(options.statePath || env.PUBLIC_API_FINDER_STATE || join(process.cwd(), 'state', 'public-api-finder-ledger.json'));
  const pullPriceCents = Number(env.PUBLIC_API_FINDER_PULL_PRICE_CENTS || DEFAULT_PULL_PRICE_CENTS);
  const creditsPerPull = Number(env.PUBLIC_API_FINDER_CREDITS_PER_PULL || DEFAULT_CREDITS_PER_PULL);
  const freeSearches = String(env.PUBLIC_API_FINDER_FREE_SEARCH || '').toLowerCase() === 'true';

  return createHttpServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/') return html(res, landingPage());
      if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { ok: true, service: 'public-api-finder' });

      if (req.method === 'GET' && url.pathname === '/api/credits') {
        const account = accountFromRequest(req, Object.fromEntries(url.searchParams));
        assertAccount(account);
        return json(res, 200, { account, credits: await ledger.balance(account) });
      }

      if (req.method === 'POST' && url.pathname === '/api/credits/topup') {
        const body = await readJson(req);
        const account = accountFromRequest(req, body);
        assertAccount(account);
        const credits = Math.max(1, Math.floor(Number(body.credits || 100)));
        const usdCents = Math.max(1, Math.floor(Number(body.usdCents || credits * pullPriceCents)));
        const topup = await ledger.createTopup(account, credits, usdCents, { source: 'bankr', requestedBy: body.requestedBy || null });
        return json(res, 201, { topup, payment: bankrInstructions(topup, env) });
      }

      if (req.method === 'POST' && url.pathname === '/api/admin/credits') {
        if (!env.PUBLIC_API_FINDER_ADMIN_TOKEN || req.headers['x-admin-token'] !== env.PUBLIC_API_FINDER_ADMIN_TOKEN) {
          return json(res, 403, { error: 'Forbidden' });
        }
        const body = await readJson(req);
        const account = String(body.account || '').trim();
        const credits = Math.floor(Number(body.credits || 0));
        const balance = await ledger.grant(account, credits, { reason: body.reason || 'admin grant', paymentRef: body.paymentRef || null });
        return json(res, 200, { account, credits: balance });
      }

      if (req.method === 'POST' && url.pathname === '/api/search') {
        const body = await readJson(req);
        const account = accountFromRequest(req, body);
        assertAccount(account);
        if (!body.query || typeof body.query !== 'string') return json(res, 400, { error: 'query is required' });
        const results = await searchApis({
          query: body.query,
          category: body.category,
          source: body.source,
          noAuth: body.noAuth,
          https: body.https,
          openapi: body.openapi,
          cors: body.cors,
          limit: body.limit || 8,
          check: body.check,
          refresh: body.refresh,
        });
        let remaining = await ledger.balance(account);
        let chargedCredits = 0;
        if (!freeSearches && results.length) {
          remaining = await ledger.spend(account, creditsPerPull, { query: body.query, resultCount: results.length });
          chargedCredits = creditsPerPull;
        }
        return json(res, 200, {
          query: body.query,
          results,
          billing: {
            account,
            chargedCredits,
            remainingCredits: remaining,
            unitPriceCents: pullPriceCents,
            note: chargedCredits ? 'charged for successful enriched pull' : 'not charged',
          },
        });
      }

      return json(res, 404, { error: 'Not found' });
    } catch (err) {
      return json(res, err.status || 500, {
        error: err.message || 'Internal server error',
        code: err.code,
        balance: err.balance,
      });
    }
  });
}

export { CreditLedger };

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const port = Number(process.env.PORT || 8787);
  createApp().listen(port, () => {
    console.log(`public-api-finder app listening on http://localhost:${port}`);
  });
}
