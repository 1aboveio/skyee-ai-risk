#!/usr/bin/env bash
set -euo pipefail

# Run this on skyeej after the warehouse has exported a clean Association
# Attribute Link parquet snapshot. Do not point this at raw Hudi table storage.

REPO_DIR="${REPO_DIR:-/data/home/jonas.gu/projects/skyee-ai-risk}"
BASE_DIR="${BASE_DIR:-${REPO_DIR}}"
HDFS_LINKS_DIR="${HDFS_LINKS_DIR:-/user/usr_skyee_mw/serving/association_attribute_links}"
LOCAL_SNAPSHOT_DIR="${LOCAL_SNAPSHOT_DIR:-${BASE_DIR}/snapshot/association_attribute_links}"
DB_PATH="${DB_PATH:-${BASE_DIR}/data/skyee_graph.duckdb}"
MINIMUM_ROWS="${MINIMUM_ROWS:-1}"
BUILD_INDEXES="${BUILD_INDEXES:-1}"

INDEX_ARGS=(--build-indexes)
if [[ "${BUILD_INDEXES}" == "0" || "${BUILD_INDEXES}" == "false" ]]; then
  INDEX_ARGS=(--no-build-indexes)
fi

mkdir -p "${BASE_DIR}/data"
rm -rf "${LOCAL_SNAPSHOT_DIR}"
mkdir -p "$(dirname "${LOCAL_SNAPSHOT_DIR}")"

hdfs dfs -test -d "${HDFS_LINKS_DIR}"
hdfs dfs -get "${HDFS_LINKS_DIR}" "${LOCAL_SNAPSHOT_DIR}"

cd "${REPO_DIR}"

PYTHONPATH="${REPO_DIR}${PYTHONPATH:+:${PYTHONPATH}}" "${REPO_DIR}/.uv-bin/uv" run \
  --with duckdb==1.0.0 \
  --with typer \
  python -m scripts.duckdb_snapshot_refresh replace-association \
    "${LOCAL_SNAPSHOT_DIR}"/*.parquet \
    --live-db-path "${DB_PATH}" \
    --minimum-rows "${MINIMUM_ROWS}" \
    "${INDEX_ARGS[@]}"
