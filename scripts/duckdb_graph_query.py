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
from typing import Any, Optional

import duckdb
import typer


PRESTO_HOST = "172.16.100.213"
PRESTO_PORT = 9666
PRESTO_USER = "jonas"
PRESTO_CATALOG = "hive"
PRESTO_SCHEMA = "usr_skyee_mw"
DEFAULT_DB_PATH = "data/skyee_graph.duckdb"
ASSOCIATION_ATTRIBUTE_LINK_TABLE = "association_attribute_links"
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
ASSOCIATION_ATTRIBUTE_TO_LEGACY_EDGE_TYPE = {
    "mobile_phone": "SAME_PHONE",
    "email": "SAME_EMAIL",
    "business_name": "SAME_BUSINESS_NAME",
    "person_name": "SAME_PERSON_NAME",
    "id_no": "SAME_ID_NO",
    "address": "SAME_ADDRESS",
    "store_url": "SAME_STORE_URL",
    "ip": "SAME_IP",
}
ALLOWED_SAME_ATTRIBUTE_TYPES = set(ASSOCIATION_ATTRIBUTE_TO_SAME_ATTRIBUTE.values())
ASSOCIATION_LINK_COLUMNS = [
    "src_attr_type",
    "src_attr_value",
    "src_attr_hash",
    "dst_attr_type",
    "dst_attr_value",
    "dst_attr_hash",
    "attr_link_type",
    "source_table",
    "source_field",
    "first_seen",
    "last_seen",
    "record_count",
]

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


def create_association_schema(con: duckdb.DuckDBPyConnection, replace: bool):
    if replace:
        con.execute(f"DROP TABLE IF EXISTS {ASSOCIATION_ATTRIBUTE_LINK_TABLE}")
    con.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {ASSOCIATION_ATTRIBUTE_LINK_TABLE} (
            {', '.join(f'{col} VARCHAR' for col in ASSOCIATION_LINK_COLUMNS)}
        )
        """
    )


def create_association_indexes(con: duckdb.DuckDBPyConnection):
    con.execute(
        f"CREATE INDEX IF NOT EXISTS idx_{ASSOCIATION_ATTRIBUTE_LINK_TABLE}_src_type_value "
        f"ON {ASSOCIATION_ATTRIBUTE_LINK_TABLE}(src_attr_type, src_attr_value)"
    )
    con.execute(
        f"CREATE INDEX IF NOT EXISTS idx_{ASSOCIATION_ATTRIBUTE_LINK_TABLE}_dst_type_value "
        f"ON {ASSOCIATION_ATTRIBUTE_LINK_TABLE}(dst_attr_type, dst_attr_value)"
    )


def _rows_as_dicts(con: duckdb.DuckDBPyConnection, sql: str, params: list | None = None):
    result = con.execute(sql, params or [])
    columns = [desc[0] for desc in result.description]
    return [dict(zip(columns, row)) for row in result.fetchall()]


def _derive_same_attribute_type(attribute_type: str | None) -> str | None:
    if not attribute_type:
        return None
    return ASSOCIATION_ATTRIBUTE_TO_SAME_ATTRIBUTE.get(attribute_type)


def _derive_legacy_edge_type(attribute_type: str | None) -> str | None:
    if not attribute_type:
        return None
    return ASSOCIATION_ATTRIBUTE_TO_LEGACY_EDGE_TYPE.get(attribute_type)


def _customer_lookup_base_sql() -> tuple[str, str]:
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
                CAST(
                    CASE
                        WHEN b.src_attr_type = 'customer'
                            THEN CAST(b.src_attr_value AS VARCHAR)
                        WHEN b.dst_attr_type = 'customer'
                            THEN CAST(b.dst_attr_value AS VARCHAR)
                        ELSE NULL
                    END AS VARCHAR
                ) <> CAST(? AS VARCHAR)
        )
        """,
        """
        SELECT
            CAST(neighbor_cust_id AS BIGINT) AS neighbor_cust_id,
            CAST(? AS BIGINT) AS source_cust_id,
            CAST(neighbor_cust_id AS BIGINT) AS target_cust_id,
            shared_attr_type,
            shared_attr_value,
            first_link_type AS attr_link_type,
            COALESCE(first_source_table, second_source_table) AS edge_source,
            COALESCE(first_source_field, second_source_field) AS edge_source_field,
            COALESCE(second_last_seen, first_last_seen) AS last_seen,
            COALESCE(second_first_seen, first_first_seen) AS first_seen,
            COALESCE(second_record_count, first_record_count, '0') AS record_count,
            'Strong' AS strength
        FROM linked_neighbors
        """,
    )


def query_association_neighbors(
    con: duckdb.DuckDBPyConnection,
    cust_id: int,
    same_attribute_type: str | None = None,
    limit: int | None = 1000,
) -> list[dict[str, Any]]:
    if same_attribute_type is None:
        same_attribute = None
    else:
        same_attribute = next(
            (
                attribute
                for attribute, link in ASSOCIATION_ATTRIBUTE_TO_SAME_ATTRIBUTE.items()
                if link == same_attribute_type
            ),
            None,
        )
        if same_attribute is None:
            allowed = ", ".join(sorted(ALLOWED_SAME_ATTRIBUTE_TYPES))
            raise ValueError(
                f"Unsupported same_attribute_type: {same_attribute_type}. "
                f"Allowed values: {allowed}"
            )

    pre_sql, select_sql = _customer_lookup_base_sql()
    where_clause = ""
    params: list[Any] = [str(cust_id), str(cust_id), str(cust_id), cust_id]
    if same_attribute is not None:
        where_clause = "WHERE shared_attr_type = ?"
        params.append(same_attribute)
    if limit is not None:
        params.append(limit)
        order_and_limit = "ORDER BY COALESCE(last_seen, first_seen) DESC NULLS LAST, shared_attr_type, neighbor_cust_id LIMIT ?"
    else:
        order_and_limit = "ORDER BY COALESCE(last_seen, first_seen) DESC NULLS LAST, shared_attr_type, neighbor_cust_id"

    rows = _rows_as_dicts(
        con,
        f"""
        {pre_sql}
        {select_sql}
        {where_clause}
        {order_and_limit}
        """,
        params,
    )

    for row in rows:
        row_same_type = _derive_same_attribute_type(row["shared_attr_type"])
        row_edge_type = _derive_legacy_edge_type(row["shared_attr_type"])
        row["same_attribute_type"] = row_same_type or row["shared_attr_type"]
        row["edge_type"] = row_edge_type or row["shared_attr_type"]
        row["edge_value"] = row["shared_attr_value"]
        row["edge_id"] = f"{cust_id}:{row['neighbor_cust_id']}:{row['shared_attr_type']}:{row['shared_attr_value']}"
    return rows


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


@app.command("sync-association-links")
def sync_association_links(
    links_path: str = typer.Option(..., "--links-path"),
    db_path: str = typer.Option(DEFAULT_DB_PATH, "--db-path"),
    replace: bool = typer.Option(True, "--replace/--append"),
    build_indexes: bool = typer.Option(True, "--build-indexes/--no-build-indexes"),
):
    """Build local DuckDB from association attribute-link parquet snapshots."""
    con = duckdb_connection(db_path)
    create_association_schema(con, replace=replace)
    typer.echo("loading association_attribute_links", err=True)
    con.execute(
        f"""
        INSERT INTO {ASSOCIATION_ATTRIBUTE_LINK_TABLE} (
            src_attr_type, src_attr_value, src_attr_hash, dst_attr_type,
            dst_attr_value, dst_attr_hash, attr_link_type, source_table,
            source_field, first_seen, last_seen, record_count
        )
        SELECT
            src_attr_type, src_attr_value, src_attr_hash, dst_attr_type,
            dst_attr_value, dst_attr_hash, attr_link_type, source_table,
            source_field, first_seen, last_seen, record_count
        FROM read_parquet(?)
        """,
        [links_path],
    )
    if build_indexes:
        typer.echo("creating lookup indexes", err=True)
        create_association_indexes(con)
    counts = rows_as_dicts(
        con,
        f"SELECT COUNT(*) AS count FROM {ASSOCIATION_ATTRIBUTE_LINK_TABLE}",
    )
    echo_rows(counts)
    con.close()


@app.command("neighbors-association")
def neighbors_association(
    cust_id: int,
    db_path: str = typer.Option(DEFAULT_DB_PATH, "--db-path"),
    same_attribute_type: str | None = typer.Option(None, "--same-attribute-type"),
    limit: int = typer.Option(50, "--limit"),
):
    """List two-hop association neighbors for a customer."""
    con = duckdb_connection(db_path)
    rows = query_association_neighbors(
        con,
        cust_id=cust_id,
        same_attribute_type=same_attribute_type,
        limit=limit,
    )
    echo_rows(rows)
    con.close()


@app.command("stats-association")
def stats_association(db_path: str = typer.Option(DEFAULT_DB_PATH, "--db-path")):
    """Show association-link snapshot counts."""
    con = duckdb_connection(db_path)
    echo_rows(
        rows_as_dicts(
            con,
            f"""
            SELECT
                'association_attribute_links' AS item,
                COUNT(*) AS count
            FROM {ASSOCIATION_ATTRIBUTE_LINK_TABLE}
            """
        )
    )
    con.close()


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
