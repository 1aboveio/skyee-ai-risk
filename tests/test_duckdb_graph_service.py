from datetime import datetime
from pathlib import Path

import duckdb
from fastapi.testclient import TestClient

import scripts.duckdb_graph_service as graph_service


TABLE_COLUMNS = (
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
)


def _create_snapshot(path: Path, rows: list[dict]) -> None:
    con = duckdb.connect(str(path))
    con.execute("DROP TABLE IF EXISTS association_attribute_links")
    con.execute(
        """
        CREATE TABLE association_attribute_links (
            src_attr_type VARCHAR,
            src_attr_value VARCHAR,
            src_attr_hash VARCHAR,
            dst_attr_type VARCHAR,
            dst_attr_value VARCHAR,
            dst_attr_hash VARCHAR,
            attr_link_type VARCHAR,
            source_table VARCHAR,
            source_field VARCHAR,
            first_seen TIMESTAMP,
            last_seen TIMESTAMP,
            record_count INTEGER
        )
        """
    )
    insert_sql = f"INSERT INTO association_attribute_links ({', '.join(TABLE_COLUMNS)}) VALUES ({', '.join('?' for _ in TABLE_COLUMNS)})"
    values = [
        (
            row["src_attr_type"],
            str(row["src_attr_value"]),
            row["src_attr_hash"],
            row["dst_attr_type"],
            str(row["dst_attr_value"]),
            row["dst_attr_hash"],
            row["attr_link_type"],
            row["source_table"],
            row["source_field"],
            row["first_seen"],
            row["last_seen"],
            row["record_count"],
        )
        for row in rows
    ]
    if values:
        con.executemany(insert_sql, values)
    con.close()


def _create_graph_nodes(path: Path, rows: list[dict]) -> None:
    con = duckdb.connect(str(path))
    con.execute("DROP TABLE IF EXISTS graph_nodes")
    con.execute("DROP TABLE IF EXISTS graph_node_degrees")
    con.execute(
        """
        CREATE TABLE graph_nodes (
            cust_id BIGINT,
            cust_name VARCHAR,
            risk_level VARCHAR,
            is_high_risk VARCHAR,
            is_sanctioned VARCHAR,
            current_balance DOUBLE,
            confirmed_risk_status VARCHAR,
            confirmed_risk_type VARCHAR
        )
        """
    )
    con.execute(
        """
        CREATE TABLE graph_node_degrees (
            cust_id BIGINT,
            node_degree INTEGER
        )
        """
    )
    con.executemany(
        """
        INSERT INTO graph_nodes (
            cust_id, cust_name, risk_level, is_high_risk, is_sanctioned,
            current_balance, confirmed_risk_status, confirmed_risk_type
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                row["cust_id"],
                row["cust_name"],
                row["risk_level"],
                row["is_high_risk"],
                row["is_sanctioned"],
                row["current_balance"],
                row.get("confirmed_risk_status"),
                row.get("confirmed_risk_type"),
            )
            for row in rows
        ],
    )
    con.executemany(
        "INSERT INTO graph_node_degrees (cust_id, node_degree) VALUES (?, ?)",
        [(row["cust_id"], row.get("node_degree", 0)) for row in rows],
    )
    con.close()


def _row(
    source_type: str,
    source_value: int | str,
    source_hash: str,
    target_type: str,
    target_value: int | str,
    target_hash: str,
    link_type: str = "link",
) -> dict:
    timestamp = datetime(2026, 6, 1)
    return {
        "src_attr_type": source_type,
        "src_attr_value": str(source_value),
        "src_attr_hash": source_hash,
        "dst_attr_type": target_type,
        "dst_attr_value": str(target_value),
        "dst_attr_hash": target_hash,
        "attr_link_type": link_type,
        "source_table": "source",
        "source_field": "field",
        "first_seen": timestamp,
        "last_seen": timestamp,
        "record_count": 1,
    }


def _neighbors(client: TestClient, cust_id: int):
    response = client.get(f"/neighbors/{cust_id}")
    assert response.status_code == 200
    return response.json()


def test_neighbor_lookup_returns_two_hop_customer_links_only(tmp_path, monkeypatch):
    # @covers duckdb_graph_service.two_hop_lookup
    # @level integration
    rows = [
        _row("customer", 1001, "cs_1001", "mobile_phone", "111-0001", "ma_1"),
        _row("mobile_phone", "111-0001", "ma_1", "customer", 1002, "cs_1002"),
        _row("customer", 1001, "cs_1001", "email", "alice@acme.com", "em_1"),
        _row("email", "alice@acme.com", "em_1", "customer", 1004, "cs_1004"),
        _row("customer", 1003, "cs_1003", "ip", "10.1.1.99", "ip_99"),
    ]
    db_path = tmp_path / "graph.duckdb"
    _create_snapshot(db_path, rows)
    monkeypatch.setenv("GRAPH_DUCKDB_PATH", str(db_path))
    with TestClient(graph_service.app) as client:
        links = _neighbors(client, 1001)
    assert len(links) == 2
    neighbors = {item["neighbor_cust_id"] for item in links}
    assert neighbors == {1002, 1004}
    assert 1003 not in neighbors

    assert all(item["edge_type"] == item["same_attribute_type"] for item in links)
    assert all(item["same_attribute_type"].startswith("same_") for item in links)
    assert all(item["source_cust_id"] == 1001 for item in links)

    with TestClient(graph_service.app) as client:
        unlinked = _neighbors(client, 1003)
    assert unlinked == []


def test_neighbor_lookup_returns_empty_when_no_edges_present(tmp_path, monkeypatch):
    # @covers duckdb_graph_service.two_hop_lookup
    # @level integration
    db_path = tmp_path / "graph-empty.duckdb"
    _create_snapshot(db_path, [])
    monkeypatch.setenv("GRAPH_DUCKDB_PATH", str(db_path))
    with TestClient(graph_service.app) as client:
        links = _neighbors(client, 5001)
    assert links == []


def test_neighbor_lookup_preserves_multiple_evidence_for_same_customer(tmp_path, monkeypatch):
    # @covers duckdb_graph_service.multi_evidence
    # @level integration
    rows = [
        _row("customer", 2001, "cs_2001", "mobile_phone", "555-1111", "ma_1"),
        _row("mobile_phone", "555-1111", "ma_1", "customer", 2002, "cs_2002"),
        _row("customer", 2001, "cs_2001", "email", "same@domain.com", "em_1"),
        _row("email", "same@domain.com", "em_1", "customer", 2002, "cs_2002"),
    ]
    db_path = tmp_path / "graph-multi.duckdb"
    _create_snapshot(db_path, rows)
    monkeypatch.setenv("GRAPH_DUCKDB_PATH", str(db_path))
    with TestClient(graph_service.app) as client:
        links = _neighbors(client, 2001)
    assert len(links) == 2
    assert {item["same_attribute_type"] for item in links} == {"same_mobile_phone", "same_email"}
    assert len({item["neighbor_cust_id"] for item in links}) == 1


def test_neighbor_lookup_works_when_only_association_attribute_links_exists(tmp_path, monkeypatch):
    # @covers duckdb_graph_service.no_edge_table_behavior
    # @level integration
    rows = [
        _row("customer", 3001, "cs_3001", "ip", "10.0.0.1", "ip_1"),
        _row("ip", "10.0.0.1", "ip_1", "customer", 3002, "cs_3002"),
    ]
    db_path = tmp_path / "graph-minimal.duckdb"
    _create_snapshot(db_path, rows)
    with duckdb.connect(str(db_path)) as con:
        tables = {
            name for name, in con.execute(
                "SELECT table_name FROM information_schema.tables WHERE table_schema='main' AND table_name='graph_edges'"
            ).fetchall()
        }
    assert tables == set()

    monkeypatch.setenv("GRAPH_DUCKDB_PATH", str(db_path))
    with TestClient(graph_service.app) as client:
        links = _neighbors(client, 3001)
    assert len(links) == 1
    assert links[0]["neighbor_cust_id"] == 3002


def test_neighbor_lookup_preserves_optional_graph_node_metadata(tmp_path, monkeypatch):
    # @covers duckdb_graph_service.neighbor_metadata_compatibility
    # @level integration
    rows = [
        _row("customer", 4001, "cs_4001", "mobile_phone", "177-0001", "ma_1"),
        _row("mobile_phone", "177-0001", "ma_1", "customer", 4002, "cs_4002"),
    ]
    db_path = tmp_path / "graph-with-nodes.duckdb"
    _create_snapshot(db_path, rows)
    _create_graph_nodes(
        db_path,
        [
            {
                "cust_id": 4002,
                "cust_name": "Linked Customer",
                "risk_level": "HIGH",
                "is_high_risk": "Y",
                "is_sanctioned": "N",
                "current_balance": 123.45,
                "confirmed_risk_status": "confirmed",
                "confirmed_risk_type": "bad_customer",
                "node_degree": 7,
            }
        ],
    )

    monkeypatch.setenv("GRAPH_DUCKDB_PATH", str(db_path))
    with TestClient(graph_service.app) as client:
        links = _neighbors(client, 4001)

    assert len(links) == 1
    assert links[0]["cust_name"] == "Linked Customer"
    assert links[0]["risk_level"] == "HIGH"
    assert links[0]["is_high_risk"] == "Y"
    assert links[0]["is_sanctioned"] == "N"
    assert links[0]["current_balance"] == 123.45
    assert links[0]["node_degree"] == 7

    with TestClient(graph_service.app) as client:
        high_risk = client.get("/high-risk/4001")
    assert high_risk.status_code == 200
    assert high_risk.json()[0]["cust_id"] == 4002


def test_high_risk_endpoint_requires_graph_node_metadata(tmp_path, monkeypatch):
    # @covers duckdb_graph_service.high_risk_metadata_contract
    # @level integration
    rows = [
        _row("customer", 5001, "cs_5001", "ip", "10.0.0.5", "ip_5"),
        _row("ip", "10.0.0.5", "ip_5", "customer", 5002, "cs_5002"),
    ]
    db_path = tmp_path / "graph-without-nodes.duckdb"
    _create_snapshot(db_path, rows)
    monkeypatch.setenv("GRAPH_DUCKDB_PATH", str(db_path))

    with TestClient(graph_service.app) as client:
        response = client.get("/high-risk/5001")

    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "HIGH_RISK_ENRICHMENT_UNAVAILABLE"
