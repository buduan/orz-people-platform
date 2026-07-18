# PostgreSQL JSONB query spike baseline

This spike verifies the smallest viable storage and query baseline for form submissions. It uses
a transaction-local table, so it neither migrates nor retains application data.

## Measured fixture

- PostgreSQL: 17 Alpine from `compose.dev.yml`
- Rows: 10,004 split across `workspace-a` and `workspace-b`
- Storage: `public_data jsonb`, `internal_data jsonb`, plus relational Workspace and submission
  columns
- Query scope: every application query begins with `workspace_id = ...`
- Stable ordering: every multi-field sort ends with submission `id`

The contract covers string and email equality, textarea contains, number and integer casts,
boolean, enum, multiselect containment, cascader path containment, repeated-object containment,
date, local time, offset date-time, and internal enum filtering. It also checks root `all` (AND),
root `any` (OR), duplicate-free OR results, ordered multi-field sorting, and a same-value record in
another Workspace that must remain invisible.

## Index baseline

| Index | Purpose | Observed `EXPLAIN (FORMAT JSON)` eligibility |
|---|---|---|
| `(workspace_id, submitted_at DESC, id DESC)` | Default scoped recency order | Composite B-tree index scan |
| `GIN (public_data jsonb_path_ops)` | Registered public-field containment | GIN bitmap index scan |
| `GIN (internal_data jsonb_path_ops)` | Registered internal-field containment | GIN bitmap index scan |
| `(workspace_id, department, score DESC, id)` expression index | Proven hot multi-sort shape | Ordered expression index scan |

The plan assertions temporarily disable sequential scans only to prove that each index can satisfy
its intended query shape. Production query planning must not change that setting. Expression
indexes are form/version-specific optimization candidates, not a requirement to index every JSONB
field. Text contains may later justify a controlled `pg_trgm` expression index if production
measurements show it is hot; this spike does not add that extension speculatively.

Run the baseline with:

```sh
pnpm --filter @orz-people-platform/backend test:spike:postgres
```
