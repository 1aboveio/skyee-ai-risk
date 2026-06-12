#!/usr/bin/env bash
set -euo pipefail

# Run this on skyeej after the Spark/Hudi graph ETL has completed.
# It exports a Hudi snapshot through Spark SQL to HDFS Parquet, copies that
# snapshot to local disk, and rebuilds the local DuckDB query database.

REPO_DIR="${REPO_DIR:-/data/home/jonas.gu/projects/skyee-ai-risk}"
BASE_DIR="${BASE_DIR:-${REPO_DIR}}"
HDFS_EXPORT_DIR="${HDFS_EXPORT_DIR:-/tmp/skyee_graph_duckdb_snapshot}"
DB_PATH="${DB_PATH:-${BASE_DIR}/data/skyee_graph.duckdb}"

mkdir -p "${BASE_DIR}/data"
rm -rf "${BASE_DIR}/snapshot"
hdfs dfs -rm -r -f "${HDFS_EXPORT_DIR}" >/dev/null 2>&1 || true

spark-sql -e "
INSERT OVERWRITE DIRECTORY '${HDFS_EXPORT_DIR}/nodes'
USING parquet
SELECT
  cust_id, cust_type, cust_name, en_name, risk_level, risk_score,
  is_sanctioned, is_high_risk, cust_status, regist_country,
  first_seen, last_seen, dt
FROM usr_skyee_mw.dwd_graph_nodes
"

spark-sql -e "
INSERT OVERWRITE DIRECTORY '${HDFS_EXPORT_DIR}/edges'
USING parquet
SELECT
  edge_id, source_cust_id, target_cust_id, edge_type, edge_value,
  edge_source, strength, first_seen, last_seen, record_count, dt
FROM usr_skyee_mw.dwd_graph_edges
"

hdfs dfs -get "${HDFS_EXPORT_DIR}" "${BASE_DIR}/snapshot"

"${REPO_DIR}/.uv-bin/uv" run \
  --with duckdb==1.0.0 \
  --with typer \
  python "${REPO_DIR}/scripts/duckdb_graph_query.py" sync-parquet \
    --nodes-path "${BASE_DIR}/snapshot/nodes/*.parquet" \
    --edges-path "${BASE_DIR}/snapshot/edges/*.parquet" \
    --db-path "${DB_PATH}" \
    --replace
