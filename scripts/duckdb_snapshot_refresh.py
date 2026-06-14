#!/usr/bin/env python3
"""Refresh DuckDB association snapshots by full candidate replacement.

The refresh flow is:
1. build a complete candidate DuckDB snapshot from clean exported parquet data,
2. validate required schema and basic counts,
3. atomically promote candidate over the live snapshot.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import duckdb
import typer

import scripts.duckdb_graph_query as graph_query


DEFAULT_DB_PATH = "data/skyee_graph.duckdb"
DEFAULT_MIN_ROWS = 0
TABLE_NAME = graph_query.ASSOCIATION_ATTRIBUTE_LINK_TABLE


app = typer.Typer(help="Build and atomically promote DuckDB association snapshots.")


def _candidate_path(db_path: str) -> str:
    return f"{db_path}.next"


def _raw_hudi_markers() -> tuple[str, ...]:
    return (
        "/.hoodie/",
        "/__hudi_",
        ".hudi",
        "/hive/warehouse/",
        "/hudi/",
    )


def _is_raw_hudi_path(path: str) -> bool:
    normalized = path.replace("\\", "/").lower()
    if any(marker in normalized for marker in _raw_hudi_markers()):
        return True
    return False


def _normalize_links_paths(links_paths: list[str]) -> list[str]:
    if not links_paths:
        raise ValueError("At least one --links-path must be supplied.")

    normalized: list[str] = []
    for links_path in links_paths:
        candidate = links_path.strip()
        if not candidate:
            continue
        if _is_raw_hudi_path(candidate):
            raise ValueError(
                f"Refusing to build snapshot from raw Hudi path: {candidate}. "
                "Provide clean parquet export paths instead."
            )
        normalized.append(candidate)

    if not normalized:
        raise ValueError("At least one non-empty --links-path must be supplied.")
    return normalized


def _insert_source_links(con: duckdb.DuckDBPyConnection, links_paths: list[str]) -> int:
    columns = ", ".join(graph_query.ASSOCIATION_LINK_COLUMNS)
    insert_sql = (
        f"INSERT INTO {TABLE_NAME} ({columns}) "
        "SELECT "
        "src_attr_type, src_attr_value, src_attr_hash, dst_attr_type, dst_attr_value, "
        "dst_attr_hash, attr_link_type, source_table, source_field, "
        "first_seen, last_seen, record_count "
        "FROM read_parquet(?)"
    )

    for links_path in links_paths:
        con.execute(insert_sql, [links_path])

    count = con.execute(f"SELECT COUNT(*) AS count FROM {TABLE_NAME}").fetchone()
    return int(count[0] if count else 0)


def _validate_snapshot_schema(con: duckdb.DuckDBPyConnection) -> int:
    table_rows = con.execute(
        """
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema='main' AND table_name=?
        """,
        [TABLE_NAME],
    ).fetchall()
    if not table_rows:
        raise ValueError(f"Missing required table '{TABLE_NAME}' in candidate snapshot.")

    required_columns = set(graph_query.ASSOCIATION_LINK_COLUMNS)
    existing_columns = {
        row[1]
        for row in con.execute(f"PRAGMA table_info('{TABLE_NAME}')").fetchall()
        if row and row[1]
    }
    missing = sorted(required_columns - existing_columns)
    if missing:
        raise ValueError(
            f"Candidate snapshot table '{TABLE_NAME}' is missing required columns: {', '.join(missing)}"
        )

    count_row = con.execute(f"SELECT COUNT(*) AS count FROM {TABLE_NAME}").fetchone()
    return int(count_row[0] if count_row else 0)


def _assert_minimum_rows(row_count: int, minimum_rows: int) -> None:
    if row_count < minimum_rows:
        raise ValueError(
            f"Candidate snapshot row count {row_count} is below required minimum {minimum_rows}."
        )


def refresh_association_snapshot(
    links_paths: list[str],
    *,
    live_db_path: str = DEFAULT_DB_PATH,
    candidate_db_path: str | None = None,
    build_indexes: bool = True,
    minimum_rows: int = DEFAULT_MIN_ROWS,
) -> dict[str, Any]:
    normalized_links_paths = _normalize_links_paths(links_paths)
    candidate_path = Path(candidate_db_path or _candidate_path(live_db_path))
    live_path = Path(live_db_path)

    if candidate_path == live_path:
        raise ValueError("candidate_db_path must differ from live_db_path.")

    try:
        if not candidate_path.parent.exists():
            candidate_path.parent.mkdir(parents=True, exist_ok=True)

        con = graph_query.duckdb_connection(str(candidate_path))
        try:
            graph_query.create_association_schema(con, replace=True)
            _insert_source_links(con, normalized_links_paths)
            if build_indexes:
                graph_query.create_association_indexes(con)
            row_count = _validate_snapshot_schema(con)
            _assert_minimum_rows(row_count, minimum_rows)
        finally:
            con.close()

        os.replace(str(candidate_path), str(live_path))

        return {
            "live_db_path": str(live_path),
            "candidate_db_path": str(candidate_path),
            "rows_loaded": row_count,
        }
    except Exception as exc:
        if candidate_path.exists():
            candidate_path.unlink()
        if isinstance(exc, ValueError):
            raise
        raise ValueError(
            f"Failed to rebuild association snapshot from parquet source: {exc}"
        ) from exc


@app.command("replace-association")
def refresh_command(
    links_path: list[str] = typer.Argument(..., help="Parquet snapshot path(s) for association links."),
    live_db_path: str = typer.Option(
        DEFAULT_DB_PATH,
        "--live-db-path",
        help="Path to live DuckDB association snapshot file.",
    ),
    candidate_db_path: str | None = typer.Option(
        None,
        "--candidate-db-path",
        help="Temporary candidate DuckDB path; defaults to <live>.next",
    ),
    build_indexes: bool = typer.Option(True, "--build-indexes/--no-build-indexes"),
    minimum_rows: int = typer.Option(
        DEFAULT_MIN_ROWS,
        "--minimum-rows",
        min=0,
        help="Reject candidate snapshots with fewer rows than this.",
    ),
):
    """Build and atomically promote a DuckDB association snapshot."""
    result = refresh_association_snapshot(
        links_paths=links_path,
        live_db_path=live_db_path,
        candidate_db_path=candidate_db_path,
        build_indexes=build_indexes,
        minimum_rows=minimum_rows,
    )
    typer.echo(
        (
            f"Promoted snapshot to {result['live_db_path']} "
            f"using {result['candidate_db_path']} ({result['rows_loaded']} rows)"
        )
    )


if __name__ == "__main__":
    app()
