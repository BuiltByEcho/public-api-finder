# Public API Finder

Find free/public APIs for agents, prototypes, demos, and integrations.

Powered by multiple sources plus a curated best-known API layer:

- [`public-api-lists/public-api-lists`](https://github.com/public-api-lists/public-api-lists) for fast curated JSON discovery
- [`public-apis/public-apis`](https://github.com/public-apis/public-apis) for the larger canonical README list
- [`APIs-guru/openapi-directory`](https://github.com/APIs-guru/openapi-directory) for OpenAPI-backed APIs

## Quick start

```bash
npx --yes --package=public-api-finder -- public-api-finder "weather forecast" --no-auth --https
npx --yes --package=public-api-finder -- public-api-finder "crypto prices" --category Cryptocurrency --limit 5
npx --yes --package=public-api-finder -- public-api-finder "jobs" --json
npx --yes --package=public-api-finder -- public-api-finder "payments" --openapi
npx --yes --package=public-api-finder -- public-api-finder "weather forecast" --no-auth --https --check
```

## Why

Agents often waste time wandering the web for APIs. This gives them a small, predictable first stop: search a curated list, filter by auth/HTTPS/CORS, then verify the chosen API docs before coding.

## Skill

The package includes an agent skill at:

```text
skills/public-api-finder/SKILL.md
```

The skill tells agents to prefer the CLI first, then live-check docs/endpoints before building. Use `--check` when you want the CLI to annotate whether each result URL is reachable right now.

## CLI options

```text
--category <name>  Filter by category substring
--source <name>    Filter by source: public-api-lists, public-apis, apis-guru, curated
--no-auth          Only APIs with Auth = No
--https            Only HTTPS APIs
--cors <value>     Filter by CORS: Yes, No, Unknown
--openapi          Only APIs with OpenAPI specs
--limit <n>        Max results
--check            Live-check result URLs and annotate reachability
--json             Emit JSON
--refresh          Refresh cache
```

## Hosted app / Bankr-ready credits

The package also includes a tiny zero-dependency hosted API and landing page:

```bash
npm start
# http://localhost:8787
```

Pricing model: **1 credit = 1 successful enriched pull**. The default public price is `$0.01` per pull, so a 100-credit top-up is `$1.00`.

### API

```bash
# Create a Bankr-ready top-up order
curl -X POST http://localhost:8787/api/credits/topup \
  -H 'content-type: application/json' \
  -H 'x-api-key: acct_demo' \
  -d '{"credits":100}'

# Search, spending 1 credit only when results are returned
curl -X POST http://localhost:8787/api/search \
  -H 'content-type: application/json' \
  -H 'x-api-key: acct_demo' \
  -d '{"query":"weather forecast no auth cors","noAuth":true,"https":true,"cors":"Yes"}'
```

Top-ups currently return Bankr payment instructions and create a pending order. After confirming payment, grant credits with an admin token:

```bash
PUBLIC_API_FINDER_ADMIN_TOKEN=secret npm start

curl -X POST http://localhost:8787/api/admin/credits \
  -H 'content-type: application/json' \
  -H 'x-admin-token: secret' \
  -d '{"account":"acct_demo","credits":100,"paymentRef":"bankr-tx-or-job-id"}'
```

Environment knobs:

```text
PORT                              Server port, default 8787
PUBLIC_API_FINDER_STATE           Ledger JSON path, default ./state/public-api-finder-ledger.json
PUBLIC_API_FINDER_PULL_PRICE_CENTS Price per pull, default 1
PUBLIC_API_FINDER_CREDITS_PER_PULL Credits charged per successful search, default 1
PUBLIC_API_FINDER_ADMIN_TOKEN      Required for manual credit grants
BANKR_RECEIVE_ADDRESS              Address shown in Bankr payment instructions
BANKR_NETWORK                      Default Base
BANKR_ASSET                        Default USDC
```
