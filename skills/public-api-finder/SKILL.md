---
name: public-api-finder
description: Find and evaluate free/public APIs for projects, demos, agents, prototypes, data enrichment, examples, integrations, or research. Use the simple public-api-finder CLI to choose APIs by category, auth requirements, HTTPS/CORS support, and practical fit before writing integration code.
---

# Public API Finder

Use this skill when a task needs a public API candidate. The CLI searches multiple sources: public-api-lists, public-apis, APIs.guru OpenAPI directory, and a curated best-known API layer for common domains like crypto, stocks, weather, maps, jobs, sports, media, news, government, and commerce.

Default to the local/free CLI for ordinary coding assistance. Use the live paid API when an agent needs a remote service call, a verifiable paid receipt, or a demo of agent-paid API discovery.

## Quick command

```bash
npx --yes --package=@builtbyecho/public-api-finder -- public-api-finder "weather forecast" --no-auth --https
npx --yes --package=@builtbyecho/public-api-finder -- public-api-finder "crypto prices" --category Cryptocurrency --limit 5
npx --yes --package=@builtbyecho/public-api-finder -- public-api-finder "jobs" --json
npx --yes --package=@builtbyecho/public-api-finder -- public-api-finder "payments" --openapi
npx --yes --package=@builtbyecho/public-api-finder -- public-api-finder "weather forecast" --no-auth --https --check
```

If npm is unavailable, use the bundled fallback script:

```bash
python3 skills/public-api-finder/scripts/search_public_apis.py "weather forecast" --no-auth --https
```

Resolve the fallback script path relative to this `SKILL.md`.

## Output to user

Recommend 2-5 APIs. Include:

- API name and URL
- What it is good for
- Auth requirement
- HTTPS/CORS notes
- One caveat to verify: rate limits, pricing, docs freshness, uptime, or terms
- Minimal example request only after checking docs/live endpoint
- OpenAPI URL when available

## Heuristics

Prefer APIs that are HTTPS-enabled, no-auth or simple API key, CORS `Yes` for frontend demos, well documented, and narrowly suited to the task.

The curated list is not a production-readiness guarantee. Always verify before building around an API. Use `--check` for a quick live reachability check, but still inspect docs, terms, auth, and rate limits before committing to an integration.

## Live $ECHO paid endpoint

Public API Finder is live behind Echo Gate as a native `$ECHO` paid service on Base.

Use this flow for agents that can make Base token payments:

1. Fetch the quote:

```bash
curl -sS https://storage.builtbyecho.xyz/echo-gate/tools/public-api-finder/quote
```

The quote returns:

- chain: Base (`eip155:8453`)
- token: `$ECHO` (`0xA7F63eB41779925803a3EEC30890742571e63Ba3`)
- receiver: `0x3dff7a5e979fce5de2e58f4317d02460911c95b4`
- current amount: `7,375 ECHO` (`7375000000000000000000` raw)

2. Send at least the quoted amount of `$ECHO` on Base to the receiver.

3. Call the tool with the payment transaction hash:

```bash
curl -sS https://storage.builtbyecho.xyz/echo-gate/public/tools/public-api-finder/call \
  -H 'content-type: application/json' \
  -H 'X-Echo-Payment-Tx: 0xPAYMENT_TX_HASH' \
  --data '{
    "query": "weather forecast no auth cors",
    "limit": 5,
    "noAuth": true,
    "https": true,
    "cors": "Yes",
    "account": "agent-name"
  }'
```

Echo Gate verifies the Base transaction receipt, confirms a successful `$ECHO` transfer to the receiver for at least the quoted amount, strips the payment hash before execution, records the payer/tx/amount on the receipt, and rejects reused payment hashes.

Paid-service mental model:

```text
quote -> pay in $ECHO -> submit tx hash -> receive API Finder output
```

The receiver wallet is intended as a burn collection wallet; `$ECHO` paid into it is to be burned by the service operator.

## Bankr x402 endpoint

The current BuiltByEcho production x402 endpoint is:

```text
https://x402.bankr.bot/0x2a16625fad3b0d840ac02c7c59edea3781e340ae/public-api-finder
```

Endpoint owner account: `builtbyecho@agentmail.to`.
