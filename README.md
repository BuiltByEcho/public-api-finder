# Public API Finder

Find free/public APIs for agents, prototypes, demos, and integrations.

Powered by the curated [`public-api-lists/public-api-lists`](https://github.com/public-api-lists/public-api-lists) JSON dataset.

## Quick start

```bash
npx public-api-finder "weather forecast" --no-auth --https
npx public-api-finder "crypto prices" --category Cryptocurrency --limit 5
npx public-api-finder "jobs" --json
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
--no-auth          Only APIs with Auth = No
--https            Only HTTPS APIs
--cors <value>     Filter by CORS: Yes, No, Unknown
--limit <n>        Max results
--json             Emit JSON
--refresh          Refresh cache
```
