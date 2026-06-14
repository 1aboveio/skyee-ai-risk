# DuckDB Graph Serving Refresh

Accepted.

The DuckDB graph query service will serve from a local DuckDB database file that is rebuilt from clean Parquet snapshots of the graph serving tables. The serving inputs are the canonical graph tables, `dwd_graph_nodes` and `dwd_graph_edges`, after Hudi snapshot semantics have already been resolved.

DuckDB must not raw-scan the Hudi table storage directories under the Hive warehouse. Although those directories contain Parquet files, they are Hudi-managed table storage and may include historical base files, metadata, and commit timeline state. DuckDB's Parquet reader does not interpret the Hudi timeline, so raw directory scans can read stale or duplicate records.

## Decision

The graph refresh pipeline has two distinct layers:

1. Warehouse graph tables:
   - `usr_skyee_mw.dwd_graph_nodes`
   - `usr_skyee_mw.dwd_graph_edges`

2. DuckDB serving snapshot:
   - clean Parquet files exported from the current Hudi snapshot
   - stored in an HDFS serving-snapshot location separate from the Hive warehouse table directories

The DuckDB refresh job reads only the serving-snapshot Parquet files and rebuilds:

- `graph_nodes`
- `graph_edges`
- `graph_node_degrees`
- optional lookup indexes

The refresh should write to a new DuckDB file, validate basic counts, then atomically replace the live database file used by the FastAPI service. The service continues to open the live DuckDB database read-only.

Example file convention:

```text
data/skyee_graph.duckdb       # live database used by the service
data/skyee_graph.next.duckdb  # rebuilt candidate database
```

The final swap is a filesystem move from the candidate file to the live file after the rebuild succeeds.

## Consequences

The DuckDB service remains independent from Presto, Spark, Hive Metastore, and Hudi at query time. Its runtime dependency is only the local DuckDB file.

The refresh job can read from HDFS directly when the source path points at clean serving Parquet snapshots, for example:

```text
hdfs:///user/usr_skyee_mw/serving/duckdb_graph_snapshot/nodes/*.parquet
hdfs:///user/usr_skyee_mw/serving/duckdb_graph_snapshot/edges/*.parquet
```

It must not read directly from paths such as:

```text
hdfs:///user/hive/warehouse/usr_skyee_mw.db/dwd_graph_nodes/**
hdfs:///user/hive/warehouse/usr_skyee_mw.db/dwd_graph_edges/**
```

Those are Hudi table storage paths, not plain serving datasets.

The graph service uses `dwd_graph_edges` as a canonical association snapshot, not `dwd_graph_edge_monthly`. Monthly edge evidence remains a warehouse/backfill layer. The serving edge table contains canonical edge rows and the DuckDB query layer treats them as undirected by querying both `(source_cust_id, target_cust_id)` directions.

Daily graph refresh order should be:

1. update `dwd_graph_edge_monthly`
2. rebuild `dwd_graph_edges`
3. rebuild `dwd_graph_nodes`
4. export clean serving Parquet snapshots
5. rebuild the candidate DuckDB database
6. validate and swap the live DuckDB database file

## Follow-Up

The current `sync-parquet` implementation should insert node rows with an explicit target column list. `graph_nodes` contains `confirmed_risk_status` and `confirmed_risk_type`, while the current node Parquet export does not provide those fields. The refresh should either include those fields in the serving Parquet snapshot or insert explicitly into the available node columns and leave confirmed-risk columns null until the registry overlay is applied.
