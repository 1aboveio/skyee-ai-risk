#!/usr/bin/env python3
"""FastAPI service for customer association lookup backed by DuckDB.

The service performs a two-hop traversal on the association inverted index:
customer attribute -> shared attribute -> customer attribute.

Examples:
    GRAPH_DUCKDB_PATH=data/skyee_graph.duckdb \
      uv run --with duckdb==1.0.0 --with fastapi --with uvicorn \
      uvicorn scripts.duckdb_graph_service:app --host 0.0.0.0 --port 8088
"""

from __future__ import annotations

import os
from typing import Any

import duckdb
from fastapi import FastAPI, HTTPException, Query

DEFAULT_DB_PATH = "data/skyee_graph.duckdb"
ASSOCIATION_TABLE = "association_attribute_links"

ASSOCIATION_ATTRIBUTE_TO_SAME_ATTRIBUTE = {
    "mobile_phone": "same_mobile_phone",
    "email": "same_email",
    "business_name": "same_business_name",
    "person_name": "same_person_name",
    "id_no": "same_id_no",
    "address": "same_address",
    "store_url": "same_store_url",
    "ip": "same_ip",
}

ALLOWED_SAME_ATTRIBUTE_TYPES = set(ASSOCIATION_ATTRIBUTE_TO_SAME_ATTRIBUTE.values())
SAME_ATTRIBUTE_BY_ATTRIBUTE = {v: k for k, v in ASSOCIATION_ATTRIBUTE_TO_SAME_ATTRIBUTE.items()}

app = FastAPI(title="Skyee Association Link Lookup Service")


def get_db_path() -> str:
    return os.getenv("GRAPH_DUCKDB_PATH", DEFAULT_DB_PATH)


def get_max_query_degree() -> int:
    return int(os.getenv("GRAPH_MAX_QUERY_DEGREE", "1000"))


def _snapshot_missing() -> str:
    return f"DuckDB graph database not found: {get_db_path()}"


def _ensure_snapshot_exists():
    db_path = get_db_path()
    if not os.path.exists(db_path):
        raise HTTPException(status_code=503, detail=_snapshot_missing())


def _assert_snapshot_schema(con: duckdb.DuckDBPyConnection):
    rows = con.execute(
        """
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'main' AND table_name = ?
        """,
        [ASSOCIATION_TABLE],
    ).fetchall()
    if not rows:
        raise HTTPException(
            status_code=503,
            detail=(
                f"Association table '{ASSOCIATION_TABLE}' is not available in snapshot. "
                f"Expected table is required for association lookup."
            ),
        )


def _table_exists(con: duckdb.DuckDBPyConnection, table_name: str) -> bool:
    row = con.execute(
        """
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'main' AND table_name = ?
        """,
        [table_name],
    ).fetchone()
    return row is not None


def _query(sql: str, params: list[Any] | None = None) -> list[dict[str, Any]]:
    _ensure_snapshot_exists()
    con = duckdb.connect(get_db_path(), read_only=True)
    try:
        _assert_snapshot_schema(con)
        result = con.execute(sql, params or [])
        columns = [desc[0] for desc in result.description]
        return [dict(zip(columns, row)) for row in result.fetchall()]
    finally:
        con.close()


def _customer_lookup_base_query() -> tuple[str, str]:
    return (
        """
        WITH source_attributes AS (
            SELECT DISTINCT
                CASE
                    WHEN a.src_attr_type = 'customer' THEN a.dst_attr_type
                    ELSE a.src_attr_type
                END AS shared_attr_type,
                CASE
                    WHEN a.src_attr_type = 'customer' THEN CAST(a.dst_attr_value AS VARCHAR)
                    ELSE CAST(a.src_attr_value AS VARCHAR)
                END AS shared_attr_value,
                a.attr_link_type AS first_link_type,
                a.source_table AS first_source_table,
                a.source_field AS first_source_field,
                a.first_seen AS first_first_seen,
                a.last_seen AS first_last_seen,
                a.record_count AS first_record_count
            FROM association_attribute_links AS a
            WHERE
                (a.src_attr_type = 'customer' AND CAST(a.src_attr_value AS VARCHAR) = CAST(? AS VARCHAR))
                OR
                (a.dst_attr_type = 'customer' AND CAST(a.dst_attr_value AS VARCHAR) = CAST(? AS VARCHAR))
        ),
        linked_neighbors AS (
            SELECT DISTINCT
                CASE
                    WHEN b.src_attr_type = 'customer'
                        THEN CAST(b.src_attr_value AS VARCHAR)
                    WHEN b.dst_attr_type = 'customer'
                        THEN CAST(b.dst_attr_value AS VARCHAR)
                    ELSE NULL
                END AS neighbor_cust_id,
                sa.shared_attr_type,
                sa.shared_attr_value,
                sa.first_link_type,
                sa.first_source_table,
                sa.first_source_field,
                sa.first_first_seen,
                sa.first_last_seen,
                sa.first_record_count,
                b.source_table AS second_source_table,
                b.source_field AS second_source_field,
                b.first_seen AS second_first_seen,
                b.last_seen AS second_last_seen,
                b.record_count AS second_record_count
            FROM source_attributes AS sa
            JOIN association_attribute_links AS b
                ON (
                    b.src_attr_type = sa.shared_attr_type
                    AND CAST(b.src_attr_value AS VARCHAR) = sa.shared_attr_value
                    AND b.dst_attr_type = 'customer'
                )
                OR (
                    b.dst_attr_type = sa.shared_attr_type
                    AND CAST(b.dst_attr_value AS VARCHAR) = sa.shared_attr_value
                    AND b.src_attr_type = 'customer'
                )
            WHERE
                neighbor_cust_id <> CAST(? AS VARCHAR)
                AND neighbor_cust_id IS NOT NULL
                AND TRY_CAST(neighbor_cust_id AS BIGINT) IS NOT NULL
        )
        """,
        """
        SELECT
            TRY_CAST(neighbor_cust_id AS BIGINT) AS neighbor_cust_id,
            CAST(? AS BIGINT) AS source_cust_id,
            TRY_CAST(neighbor_cust_id AS BIGINT) AS target_cust_id,
            shared_attr_type,
            shared_attr_value,
            first_link_type AS attr_link_type,
            COALESCE(first_source_table, second_source_table) AS edge_source,
            COALESCE(first_source_field, second_source_field) AS edge_source_field,
            COALESCE(second_last_seen, first_last_seen) AS last_seen,
            COALESCE(second_first_seen, first_first_seen) AS first_seen,
            COALESCE(second_record_count, first_record_count, 0) AS record_count,
            'Strong' AS strength
        FROM linked_neighbors
        """,
    )


def _derive_same_attribute_type(attribute_type: str | None) -> str | None:
    if not attribute_type:
        return None
    return ASSOCIATION_ATTRIBUTE_TO_SAME_ATTRIBUTE.get(attribute_type)


def _load_neighbor_metadata(cust_ids: list[int]) -> dict[int, dict[str, Any]]:
    if not cust_ids:
        return {}

    _ensure_snapshot_exists()
    con = duckdb.connect(get_db_path(), read_only=True)
    try:
        if not _table_exists(con, "graph_nodes"):
            return {}

        has_degrees = _table_exists(con, "graph_node_degrees")
        degree_join = (
            "LEFT JOIN graph_node_degrees d ON d.cust_id = n.cust_id"
            if has_degrees
            else ""
        )
        degree_expr = (
            "COALESCE(d.node_degree, 0) AS node_degree"
            if has_degrees
            else "0 AS node_degree"
        )
        result = con.execute(
            f"""
            SELECT
                n.cust_id,
                n.cust_name,
                n.risk_level,
                n.is_high_risk,
                n.is_sanctioned,
                n.current_balance,
                n.confirmed_risk_status,
                n.confirmed_risk_type,
                {degree_expr}
            FROM graph_nodes n
            {degree_join}
            WHERE n.cust_id IN (SELECT UNNEST(?))
            """,
            [cust_ids],
        )
        columns = [desc[0] for desc in result.description]
        return {int(row[0]): dict(zip(columns, row)) for row in result.fetchall()}
    finally:
        con.close()


def _apply_neighbor_metadata(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    metadata = _load_neighbor_metadata(
        sorted(
            {
                int(row["neighbor_cust_id"])
                for row in rows
                if row.get("neighbor_cust_id") is not None
            }
        )
    )
    for row in rows:
        node = metadata.get(int(row["neighbor_cust_id"]), {})
        row["cust_name"] = node.get("cust_name")
        row["risk_level"] = node.get("risk_level")
        row["is_high_risk"] = node.get("is_high_risk")
        row["is_sanctioned"] = node.get("is_sanctioned")
        row["current_balance"] = node.get("current_balance")
        row["confirmed_risk_status"] = node.get("confirmed_risk_status")
        row["confirmed_risk_type"] = node.get("confirmed_risk_type")
        row["node_degree"] = node.get("node_degree", 0)
    return rows


def _require_graph_nodes():
    _ensure_snapshot_exists()
    con = duckdb.connect(get_db_path(), read_only=True)
    try:
        if not _table_exists(con, "graph_nodes"):
            raise HTTPException(
                status_code=503,
                detail={
                    "code": "HIGH_RISK_ENRICHMENT_UNAVAILABLE",
                    "message": (
                        "High-risk neighbor lookup requires graph_nodes enrichment "
                        "metadata in the DuckDB snapshot."
                    ),
                },
            )
    finally:
        con.close()


def _build_neighbor_rows(cust_id: int, same_attribute_type: str | None = None) -> list[dict[str, Any]]:
    shared_attr_filter: str | None = None
    if same_attribute_type is not None:
        shared_attr_filter = SAME_ATTRIBUTE_BY_ATTRIBUTE.get(same_attribute_type)
        if shared_attr_filter is None:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "INVALID_SAME_ATTRIBUTE_TYPE",
                    "message": "Unsupported same_attribute_type.",
                    "same_attribute_type": same_attribute_type,
                    "allowed_values": sorted(ALLOWED_SAME_ATTRIBUTE_TYPES),
                },
            )

    pre_sql, select_sql = _customer_lookup_base_query()
    where_clause = ""
    params: list[Any] = [
        str(cust_id),
        str(cust_id),
        str(cust_id),
        str(cust_id),
    ]
    if shared_attr_filter is not None:
        where_clause = "WHERE shared_attr_type = ?"
        params.append(shared_attr_filter)

    order_clause = "ORDER BY COALESCE(last_seen, first_seen) DESC NULLS LAST, shared_attr_type, neighbor_cust_id"
    rows = _query(
        f"""
        {pre_sql}
        {select_sql}
        {where_clause}
        {order_clause}
        """,
        params,
    )

    linked_rows: list[dict[str, Any]] = []
    for row in rows:
        same_attribute = _derive_same_attribute_type(row["shared_attr_type"])
        result = {
            **row,
            "edge_type": same_attribute or row["shared_attr_type"],
            "same_attribute_type": same_attribute or row["shared_attr_type"],
            "edge_value": row["shared_attr_value"],
            "edge_id": f"{cust_id}:{row['neighbor_cust_id']}:{row['shared_attr_type']}:{row['shared_attr_value']}",
        }
        if same_attribute is None and shared_attr_filter is not None:
            continue
        linked_rows.append(result)

    return _apply_neighbor_metadata(linked_rows)


def _count_neighbors(cust_id: int, same_attribute_type: str | None = None) -> int:
    rows = _query(
        f"""
        WITH source_attributes AS (
            SELECT DISTINCT
                CASE
                    WHEN a.src_attr_type = 'customer' THEN a.dst_attr_type
                    ELSE a.src_attr_type
                END AS shared_attr_type,
                CASE
                    WHEN a.src_attr_type = 'customer' THEN CAST(a.dst_attr_value AS VARCHAR)
                    ELSE CAST(a.src_attr_value AS VARCHAR)
                END AS shared_attr_value
            FROM association_attribute_links AS a
            WHERE
                (a.src_attr_type = 'customer' AND CAST(a.src_attr_value AS VARCHAR) = CAST(? AS VARCHAR))
                OR
                (a.dst_attr_type = 'customer' AND CAST(a.dst_attr_value AS VARCHAR) = CAST(? AS VARCHAR))
        ),
        linked_neighbors AS (
            SELECT DISTINCT
                CASE
                    WHEN b.src_attr_type = 'customer'
                        THEN CAST(b.src_attr_value AS VARCHAR)
                    WHEN b.dst_attr_type = 'customer'
                        THEN CAST(b.dst_attr_value AS VARCHAR)
                    ELSE NULL
                END AS source_cust_id,
                CASE
                    WHEN b.src_attr_type = 'customer'
                        THEN CAST(b.src_attr_value AS VARCHAR)
                    WHEN b.dst_attr_type = 'customer'
                        THEN CAST(b.dst_attr_value AS VARCHAR)
                    ELSE NULL
                END AS neighbor_cust_id,
                sa.shared_attr_type
            FROM source_attributes AS sa
            JOIN association_attribute_links AS b
                ON (
                    b.src_attr_type = sa.shared_attr_type
                    AND CAST(b.src_attr_value AS VARCHAR) = sa.shared_attr_value
                    AND b.dst_attr_type = 'customer'
                )
                OR (
                    b.dst_attr_type = sa.shared_attr_type
                    AND CAST(b.dst_attr_value AS VARCHAR) = sa.shared_attr_value
                    AND b.src_attr_type = 'customer'
                )
            WHERE
                source_cust_id <> CAST(? AS VARCHAR)
                AND neighbor_cust_id IS NOT NULL
                AND TRY_CAST(neighbor_cust_id AS BIGINT) IS NOT NULL
        )
        SELECT COUNT(*) AS count
        FROM (
            SELECT DISTINCT CAST(neighbor_cust_id AS VARCHAR) AS neighbor_cust_id
            FROM linked_neighbors
        ) distinct_neighbors
        """,
        [str(cust_id), str(cust_id), str(cust_id)],
    )
    if not rows:
        return 0
    if same_attribute_type is None:
        return int(rows[0]["count"] or 0)
    # Count only after filtering to keep filter semantics aligned with `/neighbors`.
    rows = _build_neighbor_rows(cust_id, same_attribute_type)
    return len({str(row["neighbor_cust_id"]) for row in rows if row["same_attribute_type"] == same_attribute_type})


def assert_expandable(cust_id: int) -> int:
    degree = _count_neighbors(cust_id)
    max_degree = get_max_query_degree()
    if degree > max_degree:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "NODE_DEGREE_TOO_HIGH",
                "message": (
                    "Customer has too many graph neighbors for interactive expansion."
                ),
                "cust_id": cust_id,
                "node_degree": degree,
                "max_degree": max_degree,
            },
        )
    return degree


@app.get("/health")
def health():
    db_path = get_db_path()
    exists = os.path.exists(db_path)
    has_assoc_table = False
    if exists:
        con = duckdb.connect(db_path, read_only=True)
        try:
            has_rows = con.execute(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'main' AND table_name = ?
                """,
                [ASSOCIATION_TABLE],
            ).fetchone()
            has_assoc_table = has_rows is not None
        finally:
            con.close()
    return {
        "status": "ok" if has_assoc_table else "degraded",
        "db_path": db_path,
        "max_query_degree": get_max_query_degree(),
        "has_association_attribute_links": has_assoc_table,
    }


@app.get("/stats")
def stats():
    return {
        "counts": _query(
            """
            SELECT
                'association_attribute_links' AS item,
                COUNT(*) AS count
            FROM association_attribute_links
            """,
        ),
        "attribute_types": _query(
            """
            SELECT
                shared_attr_type AS item,
                COUNT(*) AS count
            FROM (
                SELECT
                    CASE
                        WHEN a.src_attr_type = 'customer' THEN a.dst_attr_type
                        ELSE a.src_attr_type
                    END AS shared_attr_type
                FROM association_attribute_links AS a
                WHERE
                    (a.src_attr_type = 'customer' AND a.src_attr_type IS NOT NULL)
                    OR
                    (a.dst_attr_type = 'customer' AND a.dst_attr_type IS NOT NULL)
            )
            WHERE shared_attr_type IS NOT NULL
            GROUP BY shared_attr_type
            ORDER BY count DESC
            """,
        ),
    }


@app.get("/degree/{cust_id}")
def degree(cust_id: int):
    return {"cust_id": cust_id, "node_degree": _count_neighbors(cust_id)}


@app.get("/neighbors/{cust_id}")
def neighbors(
    cust_id: int,
    limit: int = Query(50, ge=1, le=500),
    same_attribute_type: str | None = Query(default=None),
):
    if same_attribute_type is not None:
        same_attribute_type = same_attribute_type.strip()
    if same_attribute_type is not None and not same_attribute_type:
        raise HTTPException(
            status_code=422,
            detail={"code": "INVALID_SAME_ATTRIBUTE_TYPE", "message": "same_attribute_type cannot be empty."},
        )
    assert_expandable(cust_id)
    rows = _build_neighbor_rows(cust_id, same_attribute_type)
    if limit is not None:
        return rows[:limit]
    return rows


@app.get("/high-risk/{cust_id}")
def high_risk(cust_id: int, limit: int = Query(50, ge=1, le=500)):
    _require_graph_nodes()
    assert_expandable(cust_id)
    rows = [
        row
        for row in _build_neighbor_rows(cust_id)
        if row.get("risk_level") in {"HIGH", "MEDIUM_HIGH"}
        or row.get("is_high_risk") in {"Y", "true", "1", True}
        or row.get("is_sanctioned") in {"Y", "true", "1", True}
    ]
    return [
        {
            "cust_id": row["neighbor_cust_id"],
            "cust_name": row.get("cust_name"),
            "risk_level": row.get("risk_level"),
            "is_high_risk": row.get("is_high_risk"),
            "is_sanctioned": row.get("is_sanctioned"),
            "current_balance": row.get("current_balance"),
            "confirmed_risk_status": row.get("confirmed_risk_status"),
            "confirmed_risk_type": row.get("confirmed_risk_type"),
            "edge_type": row.get("edge_type"),
            "strength": row.get("strength"),
            "edge_value": row.get("edge_value"),
        }
        for row in rows[:limit]
    ]


@app.get("/shared/{source_cust_id}/{target_cust_id}")
def shared(source_cust_id: int, target_cust_id: int, limit: int = Query(50, ge=1, le=500)):
    rows = [
        row
        for row in _build_neighbor_rows(source_cust_id)
        if row["neighbor_cust_id"] == target_cust_id
    ]
    return rows[:limit]


@app.get("/confirmed-risk/{cust_id}")
def confirmed_risk(cust_id: int):
    return {
        "cust_id": cust_id,
        "confirmed_risk_status": None,
        "message": "Association Lookup no longer stores confirmed risk in DuckDB snapshot.",
    }


@app.get("/confirmed-risk")
def list_confirmed_risk(limit: int = Query(100, ge=1, le=1000)):
    return []


@app.get("/path/{source_cust_id}/{target_cust_id}")
def path(
    source_cust_id: int,
    target_cust_id: int,
    max_depth: int = Query(4, ge=1, le=6),
    limit: int = Query(10, ge=1, le=100),
):
    # V1 intentionally performs only one customer -> shared attribute -> customer hop.
    _ = max_depth
    if source_cust_id == target_cust_id:
        return [{"path_text": f"{source_cust_id} -> {target_cust_id}", "depth": 0}]
    shared_rows = _build_neighbor_rows(source_cust_id)
    if any(row["neighbor_cust_id"] == target_cust_id for row in shared_rows):
        return [{"path_text": f"{source_cust_id} -> {target_cust_id}", "depth": 1}]
    return []
