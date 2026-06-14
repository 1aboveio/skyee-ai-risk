# Association Inverted Index Serving

Accepted.

Association Link Lookup will serve from an Association Inverted Index, not from precomputed customer-to-customer graph edges. The v1 serving implementation is a read-only DuckDB Association Snapshot rebuilt by full snapshot replacement, while the product query remains a two-hop lookup from customer Attribute to shared Attribute to customer Attribute.

This supersedes ADR-0005. ADR-0005 assumed `dwd_graph_nodes` and `dwd_graph_edges` were the canonical DuckDB serving inputs; the current serving contract is the Association Inverted Index. The valid DuckDB refresh mechanics from ADR-0005 are consolidated here.

## Decision

The serving snapshot stores directed Attribute Link rows in `association_attribute_links`:

```text
src_attr_type
src_attr_value
src_attr_hash
dst_attr_type
dst_attr_value
dst_attr_hash
attr_link_type
source_table
source_field
first_seen
last_seen
record_count
```

`dst_attr_type` is the neutral Association Attribute Type used for lookup, such as `mobile_phone`, `email`, `business_name`, `person_name`, `id_no`, `address`, `store_url`, or `ip`. `attr_link_type` is the source/provenance subtype used for display and interpretation, not the v1 user-facing filter.

The API derives customer-to-customer Association Link Results at query time. User-facing filters and result categories use Same-Attribute Link Types such as `same_mobile_phone`, `same_email`, `same_business_name`, `same_person_name`, `same_id_no`, `same_address`, `same_store_url`, and `same_ip`.

The index may store all available directed Attribute Links, including non-customer links. V1 customer lookup only traverses:

```text
customer -> attribute -> customer
```

## Consequences

`dwd_graph_edges` is not required for the current product serving path. Pairwise customer edges may still be produced later for offline graph analytics, exports, reconciliation snapshots, or compatibility with demos, but they are derived artifacts rather than the serving contract.

DuckDB v1 should keep enrichment out of the snapshot unless required for query performance. Live customer/account/risk display fields can be fetched from the online source evidence database after the graph query returns linked customer IDs, using batched queries and fanout limits.

The DuckDB refresh should read from clean serving snapshots exported from resolved warehouse tables, not directly from Hudi table storage directories under the Hive warehouse. Although those directories contain Parquet files, they are Hudi-managed storage and may include historical base files, metadata, and commit timeline state. DuckDB's Parquet reader does not interpret the Hudi timeline, so raw directory scans can read stale or duplicate records.

The refresh should build a complete candidate DuckDB file, validate it, and atomically promote it over the previous serving snapshot. Incremental DuckDB patching is intentionally avoided for v1 because deletes, changed attributes, and duplicate mappings are easier to reason about with full replacement.

Example file convention:

```text
data/skyee_graph.duckdb       # live database used by the service
data/skyee_graph.next.duckdb  # rebuilt candidate database
```

The graph query service opens the live DuckDB database read-only. Its query-time dependency is the local DuckDB file plus any online source evidence database calls used for live enrichment.

## Operational Entry Point

The repository refresh entry point is:

```bash
scripts/refresh_remote_graph_duckdb.sh
```

It expects `HDFS_LINKS_DIR` to point at a clean parquet export of `association_attribute_links`, not at raw Hudi table storage. The script copies that export locally and runs:

```bash
python scripts/duckdb_snapshot_refresh.py replace-association \
  /path/to/association_attribute_links/*.parquet \
  --live-db-path data/skyee_graph.duckdb
```

The refresh command validates required columns, enforces the configured minimum row count, builds optional lookup indexes, and promotes the complete candidate DuckDB file over the live snapshot only after validation succeeds.

## Verification Gates

The blocking CI gate is `.github/workflows/association-serving.yml`.

It runs the DuckDB service and snapshot tests:

```bash
uv run \
  --with duckdb==1.0.0 \
  --with fastapi \
  --with httpx \
  --with pytest \
  --with typer \
  python -m pytest -q \
    tests/test_duckdb_graph_service.py \
    tests/test_duckdb_snapshot_refresh.py
```

It also runs the graph-demo frontend gates:

```bash
pnpm build
pnpm lint
pnpm test:e2e -- graph-demo.spec.ts workbench.spec.ts
```

If the Association Link Lookup grows beyond DuckDB snapshot limits, the same logical contract can move to HBase or another key-value serving store by materializing the same customer-to-attribute and attribute-to-customer access paths.
