#!/usr/bin/env python3
"""Materialize and query the customer graph with DuckDB.

Presto reads the Hudi/Hive graph tables. DuckDB stores a local analytical copy
with lookup indexes for low-latency neighbor and path queries.

Examples:
    uv run --with duckdb==1.0.0 --with pandas --with presto-python-client --with typer \
      python scripts/duckdb_graph_query.py sync --db-path data/skyee_graph.duckdb

    uv run --with duckdb==1.0.0 --with typer \
      python scripts/duckdb_graph_query.py neighbors 12345
"""

from pathlib import Path
from typing import Optional

import duckdb
import typer


PRESTO_HOST = "172.16.100.213"
PRESTO_PORT = 9666
PRESTO_USER = "jonas"
PRESTO_CATALOG = "hive"
PRESTO_SCHEMA = "usr_skyee_mw"
DEFAULT_DB_PATH = "data/skyee_graph.duckdb"

NODE_COLUMNS = [
    "cust_id",
    "cust_type",
    "cust_name",
    "en_name",
    "risk_level",
    "risk_score",
    "is_sanctioned",
    "is_high_risk",
    "cust_status",
    "regist_country",
    "first_seen",
    "last_seen",
    "dt",
]

EDGE_COLUMNS = [
    "edge_id",
    "source_cust_id",
    "target_cust_id",
    "edge_type",
    "edge_value",
    "edge_source",
    "strength",
    "first_seen",
    "last_seen",
    "record_count",
    "dt",
]

app = typer.Typer(help="DuckDB graph materialization and query helpers.")


def presto_connection():
    import prestodb

    return prestodb.dbapi.connect(
        host=PRESTO_HOST,
        port=PRESTO_PORT,
        user=PRESTO_USER,
        catalog=PRESTO_CATALOG,
        schema=PRESTO_SCHEMA,
    )


def duckdb_connection(db_path: str):
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(db_path)
    con.execute("SET threads TO 8")
    con.execute("SET preserve_insertion_order TO false")
    return con


def create_schema(con: duckdb.DuckDBPyConnection, replace: bool):
    if replace:
        con.execute("DROP TABLE IF EXISTS graph_node_degrees")
        con.execute("DROP TABLE IF EXISTS graph_nodes")
        con.execute("DROP TABLE IF EXISTS graph_edges")

    con.execute(
        """
        CREATE TABLE IF NOT EXISTS graph_nodes (
            cust_id BIGINT,
            cust_type VARCHAR,
            cust_name VARCHAR,
            en_name VARCHAR,
            risk_level VARCHAR,
            risk_score DECIMAL(10, 2),
            is_sanctioned VARCHAR,
            is_high_risk VARCHAR,
            cust_status VARCHAR,
            regist_country VARCHAR,
            current_balance DECIMAL(18, 2),
            confirmed_risk_status VARCHAR,
            confirmed_risk_type VARCHAR,
            first_seen TIMESTAMP,
            last_seen TIMESTAMP,
            dt DATE
        )
        """
    )
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS confirmed_risk_registry (
            subject_id BIGINT,
            confirmed_risk_type VARCHAR,
            confirmed_risk_status VARCHAR,
            source_file VARCHAR,
            source_label VARCHAR,
            source_bad_type VARCHAR,
            ingested_at TIMESTAMP
        )
        """
    )
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS graph_edges (
            edge_id BIGINT,
            source_cust_id BIGINT,
            target_cust_id BIGINT,
            edge_type VARCHAR,
            edge_value VARCHAR,
            edge_source VARCHAR,
            strength VARCHAR,
            first_seen TIMESTAMP,
            last_seen TIMESTAMP,
            record_count INTEGER,
            dt DATE
        )
        """
    )


def create_indexes(con: duckdb.DuckDBPyConnection):
    con.execute("CREATE INDEX IF NOT EXISTS idx_graph_nodes_cust_id ON graph_nodes(cust_id)")
    con.execute("CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON graph_edges(source_cust_id)")
    con.execute("CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON graph_edges(target_cust_id)")
    con.execute("CREATE INDEX IF NOT EXISTS idx_graph_edges_type ON graph_edges(edge_type)")
    con.execute("CREATE INDEX IF NOT EXISTS idx_graph_edges_pair ON graph_edges(source_cust_id, target_cust_id)")


def refresh_node_degrees(con: duckdb.DuckDBPyConnection):
    con.execute("DROP TABLE IF EXISTS graph_node_degrees")
    con.execute(
        """
        CREATE TABLE graph_node_degrees AS
        WITH neighbors AS (
            SELECT source_cust_id AS cust_id, target_cust_id AS neighbor_cust_id
            FROM graph_edges
            UNION ALL
            SELECT target_cust_id AS cust_id, source_cust_id AS neighbor_cust_id
            FROM graph_edges
        )
        SELECT cust_id, COUNT(DISTINCT neighbor_cust_id)::INTEGER AS node_degree
        FROM neighbors
        GROUP BY cust_id
        """
    )
    con.execute("CREATE INDEX IF NOT EXISTS idx_graph_node_degrees_cust_id ON graph_node_degrees(cust_id)")


def load_risk_registry(con: duckdb.DuckDBPyConnection, registry_path: str):
    """Load Confirmed Risk Registry from CSV and update graph nodes."""
    import pandas as pd
    from pathlib import Path
    
    if not Path(registry_path).exists():
        typer.echo(f"Registry file not found: {registry_path}", err=True)
        return
    
    # Load registry CSV
    df = pd.read_csv(registry_path)
    registry_records = df[['subject_id', 'confirmed_risk_type', 'confirmed_risk_status', 
                           'source_file', 'source_label', 'source_bad_type', 'ingested_at']]
    
    # Insert into registry table
    con.execute("DELETE FROM confirmed_risk_registry")
    con.register("_registry_batch", registry_records)
    con.execute("""
        INSERT INTO confirmed_risk_registry 
        SELECT * FROM _registry_batch
    """)
    con.unregister("_registry_batch")
    
    # Update graph nodes with confirmed risk status
    con.execute("""
        UPDATE graph_nodes 
        SET 
            confirmed_risk_status = r.confirmed_risk_status,
            confirmed_risk_type = r.confirmed_risk_type
        FROM confirmed_risk_registry r
        WHERE graph_nodes.cust_id = r.subject_id
    """)
    
    typer.echo(f"Loaded {len(registry_records)} registry entries", err=True)


def load_from_presto(
    con: duckdb.DuckDBPyConnection,
    table_name: str,
    columns: list[str],
    where_sql: Optional[str],
    batch_size: int,
):
    cur = presto_connection().cursor()
    quoted_cols = ", ".join(columns)
    sql = f"SELECT {quoted_cols} FROM {PRESTO_SCHEMA}.{table_name}"
    if where_sql:
        sql += f" WHERE {where_sql}"
    cur.execute(sql)

    target = table_name.replace("dwd_", "")
    loaded = 0
    while True:
        rows = cur.fetchmany(batch_size)
        if not rows:
            break
        import pandas as pd

        df = pd.DataFrame(rows, columns=columns)
        con.register("_graph_batch", df)
        con.execute(f"INSERT INTO {target} ({quoted_cols}) SELECT * FROM _graph_batch")
        con.unregister("_graph_batch")
        loaded += len(df)
        typer.echo(f"{target}: loaded {loaded} rows", err=True)


def rows_as_dicts(con: duckdb.DuckDBPyConnection, sql: str, params: list | None = None):
    result = con.execute(sql, params or [])
    columns = [desc[0] for desc in result.description]
    return [dict(zip(columns, row)) for row in result.fetchall()]


def echo_rows(rows: list[dict]):
    if not rows:
        typer.echo("(no rows)")
        return
    columns = list(rows[0].keys())
    typer.echo("\t".join(columns))
    for row in rows:
        typer.echo("\t".join("" if row[col] is None else str(row[col]) for col in columns))


@app.command()
def sync(
    db_path: str = typer.Option(DEFAULT_DB_PATH, "--db-path"),
    start_date: Optional[str] = typer.Option(None, "--start-date"),
    end_date: Optional[str] = typer.Option(None, "--end-date"),
    batch_size: int = typer.Option(50000, "--batch-size"),
    replace: bool = typer.Option(True, "--replace/--append"),
    build_indexes: bool = typer.Option(True, "--build-indexes/--no-build-indexes"),
    registry_path: Optional[str] = typer.Option(None, "--registry-path"),
):
    """Copy graph tables from Presto/Hudi into a local DuckDB file."""
    con = duckdb_connection(db_path)
    create_schema(con, replace=replace)

    edge_where = None
    if start_date:
        edge_where = f"dt >= DATE '{start_date}'"
    if end_date:
        end_clause = f"dt < DATE '{end_date}'"
        edge_where = f"{edge_where} AND {end_clause}" if edge_where else end_clause

    load_from_presto(con, "dwd_graph_nodes", NODE_COLUMNS, None, batch_size)
    load_from_presto(con, "dwd_graph_edges", EDGE_COLUMNS, edge_where, batch_size)
    
    # Load Confirmed Risk Registry if path provided
    if registry_path:
        load_risk_registry(con, registry_path)
    
    typer.echo("refreshing node degrees", err=True)
    refresh_node_degrees(con)
    if build_indexes:
        typer.echo("creating lookup indexes", err=True)
        create_indexes(con)

    counts = rows_as_dicts(
        con,
        """
        SELECT
            (SELECT COUNT(*) FROM graph_nodes) AS node_count,
            (SELECT COUNT(*) FROM graph_edges) AS edge_count,
            (SELECT COUNT(*) FROM confirmed_risk_registry) AS registry_count
        """,
    )
    echo_rows(counts)
    con.close()


def print_query(con: duckdb.DuckDBPyConnection, sql: str, params: list, limit: int):
    echo_rows(rows_as_dicts(con, sql, params + [limit]))


@app.command()
def neighbors(
    cust_id: int,
    db_path: str = typer.Option(DEFAULT_DB_PATH, "--db-path"),
    limit: int = typer.Option(50, "--limit"),
):
    """List one-hop graph neighbors for a customer."""
    con = duckdb_connection(db_path)
    print_query(
        con,
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
            n.cust_name,
            n.risk_level,
            n.is_high_risk,
            e.edge_type,
            e.strength,
            e.edge_value,
            e.record_count,
            e.last_seen
        FROM incident_edges e
        LEFT JOIN graph_nodes n ON n.cust_id = e.neighbor_cust_id
        ORDER BY CASE e.strength WHEN 'Strong' THEN 0 ELSE 1 END, e.last_seen DESC
        LIMIT ?
        """,
        [cust_id, cust_id],
        limit,
    )
    con.close()


@app.command("high-risk")
def high_risk(
    cust_id: int,
    db_path: str = typer.Option(DEFAULT_DB_PATH, "--db-path"),
    limit: int = typer.Option(50, "--limit"),
):
    """List high-risk one-hop neighbors for a customer."""
    con = duckdb_connection(db_path)
    print_query(
        con,
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
            COALESCE(d.node_degree, 0) AS node_degree,
            e.edge_type,
            e.strength,
            e.edge_value
        FROM incident_edges e
        JOIN graph_nodes n ON n.cust_id = e.neighbor_cust_id
        LEFT JOIN graph_node_degrees d ON d.cust_id = n.cust_id
        WHERE n.risk_level IN ('HIGH', 'MEDIUM_HIGH')
           OR n.is_high_risk = 'Y'
           OR n.is_sanctioned = 'Y'
        ORDER BY CASE e.strength WHEN 'Strong' THEN 0 ELSE 1 END, COALESCE(d.node_degree, 0) DESC
        LIMIT ?
        """,
        [cust_id, cust_id],
        limit,
    )
    con.close()


@app.command()
def shared(
    source_cust_id: int,
    target_cust_id: int,
    db_path: str = typer.Option(DEFAULT_DB_PATH, "--db-path"),
    limit: int = typer.Option(50, "--limit"),
):
    """Show shared graph attributes between two customers."""
    low, high = sorted((source_cust_id, target_cust_id))
    con = duckdb_connection(db_path)
    print_query(
        con,
        """
        SELECT edge_type, edge_source, strength, edge_value, record_count, first_seen, last_seen
        FROM graph_edges
        WHERE source_cust_id = ? AND target_cust_id = ?
        ORDER BY CASE strength WHEN 'Strong' THEN 0 ELSE 1 END, last_seen DESC
        LIMIT ?
        """,
        [low, high],
        limit,
    )
    con.close()


@app.command()
def path(
    source_cust_id: int,
    target_cust_id: int,
    db_path: str = typer.Option(DEFAULT_DB_PATH, "--db-path"),
    max_depth: int = typer.Option(4, "--max-depth"),
    limit: int = typer.Option(10, "--limit"),
):
    """Find short undirected paths between two customers."""
    con = duckdb_connection(db_path)
    rows = rows_as_dicts(
        con,
        """
        WITH RECURSIVE undirected AS (
            SELECT source_cust_id AS from_id, target_cust_id AS to_id, edge_type, strength
            FROM graph_edges
            UNION ALL
            SELECT target_cust_id AS from_id, source_cust_id AS to_id, edge_type, strength
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
    echo_rows(rows)
    con.close()


@app.command()
def sync_parquet(
    nodes_path: str = typer.Option(..., "--nodes-path"),
    edges_path: str = typer.Option(..., "--edges-path"),
    db_path: str = typer.Option(DEFAULT_DB_PATH, "--db-path"),
    replace: bool = typer.Option(True, "--replace/--append"),
    build_indexes: bool = typer.Option(True, "--build-indexes/--no-build-indexes"),
):
    """Build the local DuckDB graph database from local Parquet snapshots."""
    con = duckdb_connection(db_path)
    create_schema(con, replace=replace)
    typer.echo("loading graph_nodes from parquet", err=True)
    con.execute(
        """
        INSERT INTO graph_nodes
        SELECT
            cust_id, cust_type, cust_name, en_name, risk_level, risk_score,
            is_sanctioned, is_high_risk, cust_status, regist_country,
            current_balance, first_seen, last_seen, dt
        FROM read_parquet(?)
        """,
        [nodes_path],
    )
    typer.echo("loading graph_edges from parquet", err=True)
    con.execute(
        """
        INSERT INTO graph_edges
        SELECT
            edge_id, source_cust_id, target_cust_id, edge_type, edge_value,
            edge_source, strength, first_seen, last_seen, record_count, dt
        FROM read_parquet(?)
        """,
        [edges_path],
    )
    typer.echo("refreshing node degrees", err=True)
    refresh_node_degrees(con)
    if build_indexes:
        typer.echo("creating lookup indexes", err=True)
        create_indexes(con)
    counts = rows_as_dicts(
        con,
        """
        SELECT
            (SELECT COUNT(*) FROM graph_nodes) AS node_count,
            (SELECT COUNT(*) FROM graph_edges) AS edge_count
        """,
    )
    echo_rows(counts)
    con.close()


@app.command()
def stats(db_path: str = typer.Option(DEFAULT_DB_PATH, "--db-path")):
    """Show local DuckDB graph counts and top edge types."""
    con = duckdb_connection(db_path)
    echo_rows(
        rows_as_dicts(
            con,
            """
            SELECT 'nodes' AS item, COUNT(*) AS count FROM graph_nodes
            UNION ALL
            SELECT 'edges' AS item, COUNT(*) AS count FROM graph_edges
            UNION ALL
            SELECT 'nodes_with_degree' AS item, COUNT(*) AS count FROM graph_node_degrees
            """,
        )
    )
    echo_rows(
        rows_as_dicts(
            con,
            """
            SELECT edge_type, strength, COUNT(*) AS edge_count
            FROM graph_edges
            GROUP BY edge_type, strength
            ORDER BY edge_count DESC
            """,
        )
    )
    con.close()


if __name__ == "__main__":
    app()
