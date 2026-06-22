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
```

## Why

Agents often waste time wandering the web for APIs. This gives them a small, predictable first stop: search a curated list, filter by auth/HTTPS/CORS, then verify the chosen API docs before coding.

## Skill

The package includes an agent skill at:

```text
skills/public-api-finder/SKILL.md
```

The skill tells agents to prefer the CLI first, then live-check docs/endpoints before building.

## CLI options

```text
--category <name>  Filter by category substring
--source <name>    Filter by source: public-api-lists, public-apis, apis-guru, curated
--no-auth          Only APIs with Auth = No
--https            Only HTTPS APIs
--cors <value>     Filter by CORS: Yes, No, Unknown
--openapi          Only APIs with OpenAPI specs
--limit <n>        Max results
--json             Emit JSON
--refresh          Refresh cache
```

## Release Automation

This package is published from GitHub Actions using npm Trusted Publishing with provenance. Releases are built on GitHub-hosted runners and no long-lived npm publish token is required.
