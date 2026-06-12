#!/usr/bin/env python3
"""FastAPI service for low-latency customer graph queries backed by DuckDB.

Run:
    GRAPH_DUCKDB_PATH=data/skyee_graph.duckdb \
      uv run --with duckdb==1.0.0 --with fastapi --with uvicorn \
      uvicorn scripts.duckdb_graph_service:app --host 0.0.0.0 --port 8088
"""

import os
from typing import Any

import duckdb
from fastapi import FastAPI, HTTPException, Query


DEFAULT_DB_PATH = "data/skyee_graph.duckdb"
GRAPH_DUCKDB_PATH = os.getenv("GRAPH_DUCKDB_PATH", DEFAULT_DB_PATH)
GRAPH_MAX_QUERY_DEGREE = int(os.getenv("GRAPH_MAX_QUERY_DEGREE", "1000"))

app = FastAPI(title="Skyee Customer Graph Query Service")


def query(sql: str, params: list[Any] | None = None) -> list[dict[str, Any]]:
    if not os.path.exists(GRAPH_DUCKDB_PATH):
        raise HTTPException(
            status_code=503,
            detail=f"DuckDB graph database not found: {GRAPH_DUCKDB_PATH}",
        )
    con = duckdb.connect(GRAPH_DUCKDB_PATH, read_only=True)
    try:
        result = con.execute(sql, params or [])
        columns = [desc[0] for desc in result.description]
        return [dict(zip(columns, row)) for row in result.fetchall()]
    finally:
        con.close()


def node_degree(cust_id: int) -> int:
    rows = query(
        """
        SELECT COALESCE(node_degree, 0) AS node_degree
        FROM graph_node_degrees
        WHERE cust_id = ?
        """,
        [cust_id],
    )
    if not rows:
        return 0
    return int(rows[0]["node_degree"] or 0)


def assert_expandable(cust_id: int) -> int:
    degree = node_degree(cust_id)
    if degree > GRAPH_MAX_QUERY_DEGREE:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "NODE_DEGREE_TOO_HIGH",
                "message": (
                    "Customer has too many graph neighbors for interactive expansion."
                ),
                "cust_id": cust_id,
                "node_degree": degree,
                "max_degree": GRAPH_MAX_QUERY_DEGREE,
            },
        )
    return degree


@app.get("/health")
def health():
    return {
        "status": "ok",
        "db_path": GRAPH_DUCKDB_PATH,
        "max_query_degree": GRAPH_MAX_QUERY_DEGREE,
    }


@app.get("/stats")
def stats():
    return {
        "counts": query(
            """
            SELECT 'nodes' AS item, COUNT(*) AS count FROM graph_nodes
            UNION ALL
            SELECT 'edges' AS item, COUNT(*) AS count FROM graph_edges
            """
        ),
        "edge_types": query(
            """
            SELECT edge_type, strength, COUNT(*) AS edge_count
            FROM graph_edges
            GROUP BY edge_type, strength
            ORDER BY edge_count DESC
            """
        ),
    }


@app.get("/neighbors/{cust_id}")
def neighbors(cust_id: int, limit: int = Query(50, ge=1, le=500)):
    assert_expandable(cust_id)
    return query(
        """
        WITH incident_edges AS (
            SELECT target_cust_id AS neighbor_cust_id, *
            FROM graph_edges
            WHERE source_cust_id = ?
            UNION ALL
            SELECT source_cust_id AS neighbor_cust_id, *
            FROM graph_edges
            WHERE target_cust_id = ?
        )
        SELECT
            e.neighbor_cust_id,
            e.edge_id,
            e.source_cust_id,
            e.target_cust_id,
            n.cust_name,
            n.risk_level,
            n.is_high_risk,
            n.is_sanctioned,
            COALESCE(d.node_degree, 0) AS node_degree,
            e.edge_type,
            e.edge_source,
            e.strength,
            e.edge_value,
            e.record_count,
            e.first_seen,
            e.last_seen
        FROM incident_edges e
        LEFT JOIN graph_nodes n ON n.cust_id = e.neighbor_cust_id
        LEFT JOIN graph_node_degrees d ON d.cust_id = e.neighbor_cust_id
        ORDER BY CASE e.strength WHEN 'Strong' THEN 0 ELSE 1 END, e.last_seen DESC
        LIMIT ?
        """,
        [cust_id, cust_id, limit],
    )


@app.get("/high-risk/{cust_id}")
def high_risk(cust_id: int, limit: int = Query(50, ge=1, le=500)):
    assert_expandable(cust_id)
    return query(
        """
        WITH incident_edges AS (
            SELECT target_cust_id AS neighbor_cust_id, *
            FROM graph_edges
            WHERE source_cust_id = ?
            UNION ALL
            SELECT source_cust_id AS neighbor_cust_id, *
            FROM graph_edges
            WHERE target_cust_id = ?
        )
        SELECT DISTINCT
            n.cust_id,
            n.cust_name,
            n.risk_level,
            n.is_high_risk,
            n.is_sanctioned,
            e.edge_type,
            e.strength,
            e.edge_value
        FROM incident_edges e
        JOIN graph_nodes n ON n.cust_id = e.neighbor_cust_id
        WHERE n.risk_level IN ('HIGH', 'MEDIUM_HIGH')
           OR n.is_high_risk = 'Y'
           OR n.is_sanctioned = 'Y'
        ORDER BY CASE e.strength WHEN 'Strong' THEN 0 ELSE 1 END, n.cust_id
        LIMIT ?
        """,
        [cust_id, cust_id, limit],
    )


@app.get("/shared/{source_cust_id}/{target_cust_id}")
def shared(source_cust_id: int, target_cust_id: int, limit: int = Query(50, ge=1, le=500)):
    low, high = sorted((source_cust_id, target_cust_id))
    return query(
        """
        SELECT edge_type, edge_source, strength, edge_value, record_count, first_seen, last_seen
        FROM graph_edges
        WHERE source_cust_id = ? AND target_cust_id = ?
        ORDER BY CASE strength WHEN 'Strong' THEN 0 ELSE 1 END, last_seen DESC
        LIMIT ?
        """,
        [low, high, limit],
    )


@app.get("/path/{source_cust_id}/{target_cust_id}")
def path(
    source_cust_id: int,
    target_cust_id: int,
    max_depth: int = Query(4, ge=1, le=6),
    limit: int = Query(10, ge=1, le=100),
):
    assert_expandable(source_cust_id)
    assert_expandable(target_cust_id)
    return query(
        """
        WITH RECURSIVE undirected AS (
            SELECT source_cust_id AS from_id, target_cust_id AS to_id
            FROM graph_edges
            UNION ALL
            SELECT target_cust_id AS from_id, source_cust_id AS to_id
            FROM graph_edges
        ),
        paths(node_id, path_text, path_key, depth) AS (
            SELECT
                to_id,
                CAST(? AS VARCHAR) || ' -> ' || CAST(to_id AS VARCHAR),
                ',' || CAST(? AS VARCHAR) || ',' || CAST(to_id AS VARCHAR) || ',',
                1
            FROM undirected
            WHERE from_id = ?
            UNION ALL
            SELECT
                u.to_id,
                p.path_text || ' -> ' || CAST(u.to_id AS VARCHAR),
                p.path_key || CAST(u.to_id AS VARCHAR) || ',',
                p.depth + 1
            FROM paths p
            JOIN undirected u ON u.from_id = p.node_id
            WHERE p.depth < ?
              AND instr(p.path_key, ',' || CAST(u.to_id AS VARCHAR) || ',') = 0
        )
        SELECT path_text, depth
        FROM paths
        WHERE node_id = ?
        ORDER BY depth
        LIMIT ?
        """,
        [source_cust_id, source_cust_id, source_cust_id, max_depth, target_cust_id, limit],
    )
