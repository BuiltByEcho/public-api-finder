# API Enrichment Plan

Public API Finder should help builders and agents choose usable APIs, not just match keywords. The current corpus is assembled at runtime from public-api-lists, public-apis README, APIs.guru, and a curated layer in `src/cli.js`; cache files are written to `~/.cache/public-api-finder/all.json` (or `PUBLIC_API_FINDER_CACHE`) and invalidated by `DATA_VERSION`.

## Practical metadata schema

Curated records can now carry optional fields that survive dedupe/merge, are included in JSON output, and are searched/scored:

- `tags`: compact search labels, e.g. `token price`, `wallet balances`, `forecast`, `webhooks`.
- `useCases`: concrete builder tasks, e.g. `fetch OHLCV candles for DEX pools`.
- `domains`: broad facets, e.g. `crypto`, `defi`, `weather`, `payments`, `security`.
- `exampleQueries`: queries this API should satisfy in evals.
- `pricing` / `freeTier`: human-readable plan notes.
- `authType`: `none`, `apiKey`, `OAuth`, `JWT`, etc.; normalized `auth` remains for filtering.
- `providerType`: practical class, e.g. `dex-market-data`, `block-explorer`, `geocoding`, `email-validation`.
- `reliability` and `docsQuality`: low/medium/high/excellent, intentionally coarse.
- `bestFor` / `avoidFor`: short fit guidance.
- `rateLimit`, `apiBase`, `caveats`: selection warnings and implementation notes.

Keep fields short and directly searchable. Prefer facts from docs; put uncertainty in `caveats` instead of overclaiming.

## First-pass category priorities

1. Crypto/DeFi: prices, token metadata, DEX pools/OHLCV, wallet balances, explorers, RPC/indexing, swaps, TVL/yields.
2. Finance/stocks: quotes, historical candles, fundamentals, options, forex, no-auth CSV sources.
3. Weather/maps/geocoding: forecast, alerts, radar, routing, places, timezone, address validation.
4. Jobs: public job search, remote jobs, government jobs, salary data.
5. Payments/auth/comms: Stripe/PayPal, OAuth/OIDC, SMS/email/OTP, webhooks.
6. Web metadata/screenshot: link previews, OG metadata, favicons, screenshots, HTML-to-PDF.
7. AI/media: STT/TTS, OCR, moderation, image/video, media catalogs.
8. Government/open data: Census, FEC, data.gov, transport, vehicles, legislation.
9. Ecommerce/test data: fake stores, products/barcodes, random users, placeholder media.
10. Security/vulnerability: CVE/OSV/NVD, DNS/WHOIS/SSL, IP reputation, sanctions/KYC.

## Crypto/DeFi pass completed

Added/enriched obvious APIs surfaced by the product issue:

- DexScreener — no-auth DEX token search, prices, pairs, liquidity, boosted/trending tokens.
- CoinMarketCap — API-key market data, quotes, rankings, metadata.
- CoinGecko — market data plus on-chain/CoinGecko ecosystem coverage.
- DexPaprika — no-auth DEX/on-chain API from Coinpaprika for prices, pools, swaps, networks.
- DefiLlama — no-auth DeFi TVL, chains, yields, stablecoins, fees/revenue, prices.
- GeckoTerminal — free public DEX/on-chain token, pool, OHLCV, network data.
- Coinpaprika — no-auth tickers, coins, exchanges, OHLCV.
- CoinCap — no-auth assets, rates, markets, candles, WebSocket.
- Birdeye — Solana/EVM token prices, wallet analytics, trades, OHLCV.
- 0x Swap API — EVM swap quotes and DEX aggregation.
- Etherscan/Basescan — explorer APIs for balances, transactions, transfers, ABIs/logs.
- Alchemy — RPC/indexing/NFT/token balances/webhooks.
- Moralis — wallet portfolio, token/NFT metadata, transfers, DeFi positions.

## Second-pass enrichment completed

All curated records are now enriched at runtime with practical builder-agent metadata. The enrichment layer combines category-level defaults with provider-specific overrides, then normalizes `authType` and fills `tags`, `domains`, `useCases`, `providerType`, and either `bestFor` or `caveats` for every curated API. This keeps the inline corpus readable while ensuring broad categories like finance, weather/maps, jobs, payments/auth/comms, web metadata/screenshots, AI/media, government/open data, ecommerce/test data, and security/vulnerability have searchable intent labels.

Some records intentionally keep uncertainty in `caveats` instead of stronger claims, especially pages that may not expose a stable API/export (for example Mortgage News Daily) or services where plan/region coverage changes frequently.

## Embedding / hybrid search recommendation

Embeddings would help once the corpus needs to answer fuzzy intent queries that do not share exact words with the docs, e.g. “unfurl a URL,” “is this package unsafe,” or “find restaurants near me.” They should complement—not replace—the current lexical/domain scoring because filters like `--no-auth`, `--cors`, category, OpenAPI availability, and exact high-intent terms still matter.

Recommended design:

- Build a small per-record embedding document from: `name`, `category`, `description`, `tags`, `domains`, `useCases`, `bestFor`, `avoidFor`, and `caveats`.
- Keep noisy operational fields out of embeddings unless useful to users: skip raw URLs, timestamps, cache source metadata, and long OpenAPI blobs.
- Use hybrid retrieval: lexical/domain score first for precision and filters, embedding similarity as an additive rerank signal for the top N candidates.
- Version the embedding index with `DATA_VERSION` plus an embedding-model/version key so stale vectors are invalidated safely.
- Start with curated records only; backfill external-source matches later after name-based enrichment/quality filtering.

Do not implement embeddings yet unless the package accepts an optional dependency or a provider-neutral local vector cache. A design-only step is safer for the current CLI because online embedding calls would add cost, latency, privacy concerns, and provider configuration requirements.

## Next passes

- Move `CURATED_APIS` plus enrichment maps into a dedicated data module or JSON file once enrichments grow past ~150 records.
- Add field validators for enums (`authType`, `providerType`, reliability/docs quality).
- Backfill high-quality external-source matches by known provider name.
- Consider CLI filters later: `--tag`, `--domain`, `--auth-type`, `--free-tier`.
