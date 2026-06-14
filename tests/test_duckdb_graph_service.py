from datetime import datetime
from pathlib import Path

import duckdb
import pytest
from fastapi.testclient import TestClient

import scripts.duckdb_graph_query as graph_query
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
            cust_type VARCHAR,
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
            cust_id, cust_type, cust_name, risk_level, is_high_risk, is_sanctioned,
            current_balance, confirmed_risk_status, confirmed_risk_type
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                row["cust_id"],
                row.get("cust_type", "COMPANY"),
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


def _create_confirmed_risk_registry(path: Path, rows: list[dict]) -> None:
    con = duckdb.connect(str(path))
    con.execute("DROP TABLE IF EXISTS confirmed_risk_registry")
    con.execute(
        """
        CREATE TABLE confirmed_risk_registry (
            subject_id BIGINT,
            source_file VARCHAR,
            source_label VARCHAR,
            source_bad_type VARCHAR,
            ingested_at TIMESTAMP
        )
        """
    )
    con.executemany(
        """
        INSERT INTO confirmed_risk_registry (
            subject_id, source_file, source_label, source_bad_type, ingested_at
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        [
            (
                row["subject_id"],
                row["source_file"],
                row["source_label"],
                row["source_bad_type"],
                row["ingested_at"],
            )
            for row in rows
        ],
    )
    con.close()


def _create_graph_edges(path: Path, rows: list[dict]) -> None:
    con = duckdb.connect(str(path))
    con.execute("DROP TABLE IF EXISTS graph_edges")
    con.execute(
        """
        CREATE TABLE graph_edges (
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
    timestamp = datetime(2026, 6, 1)
    con.executemany(
        """
        INSERT INTO graph_edges (
            edge_id, source_cust_id, target_cust_id, edge_type, edge_value,
            edge_source, strength, first_seen, last_seen, record_count, dt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                row["edge_id"],
                row["source_cust_id"],
                row["target_cust_id"],
                row.get("edge_type", "SAME_EMAIL"),
                row.get("edge_value", "value"),
                row.get("edge_source", "source"),
                row.get("strength", "Strong"),
                timestamp,
                timestamp,
                row.get("record_count", 1),
                timestamp.date(),
            )
            for row in rows
        ],
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

    assert {item["edge_type"] for item in links} == {"SAME_PHONE", "SAME_EMAIL"}
    assert {item["same_attribute_type"] for item in links} == {
        "same_mobile_phone",
        "same_email",
    }
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
    assert {item["edge_type"] for item in links} == {"SAME_PHONE", "SAME_EMAIL"}
    assert len({item["neighbor_cust_id"] for item in links}) == 1


def test_count_neighbors_counts_unique_neighbors(tmp_path, monkeypatch):
    # @characterizes duckdb_graph_service.count_neighbors
    # @covers duckdb_graph_service.degree_guard
    # @level integration
    rows = [
        _row("customer", 2101, "cs_2101", "mobile_phone", "555-1111", "ma_1"),
        _row("mobile_phone", "555-1111", "ma_1", "customer", 2102, "cs_2102"),
        _row("customer", 2101, "cs_2101", "email", "same@domain.com", "em_1"),
        _row("email", "same@domain.com", "em_1", "customer", 2102, "cs_2102"),
    ]
    db_path = tmp_path / "graph-unique-neighbors.duckdb"
    _create_snapshot(db_path, rows)
    monkeypatch.setenv("GRAPH_DUCKDB_PATH", str(db_path))
    assert graph_service._count_neighbors(2101) == 1


def test_neighbor_lookup_works_when_only_association_attribute_links_exists(tmp_path, monkeypatch):
    # @covers duckdb_graph_service.no_edge_table_behavior
    # @level integration
    rows = [
        {
            **_row("customer", 3001, "cs_3001", "ip", "10.0.0.1", "ip_1"),
            "attr_link_type": "LOGIN_ACTIVITY",
            "source_table": "network_logs",
            "source_field": "ip_last_seen",
        },
        {
            **_row("ip", "10.0.0.1", "ip_1", "customer", 3002, "cs_3002"),
            "attr_link_type": "LOGIN_ACTIVITY",
            "source_table": "network_logs",
            "source_field": "ip_last_seen",
        },
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
    assert links[0]["attribute_link_type"] == "LOGIN_ACTIVITY"
    assert links[0]["edge_type"] == "SAME_IP"
    assert links[0]["same_attribute_type"] == "same_ip"
    assert links[0]["strength"] == "Strong"
    assert links[0]["provenance"]["attribute_link_type"] == "LOGIN_ACTIVITY"
    assert links[0]["provenance"]["attribute_link_type_label"] == "Login activity"
    assert links[0]["provenance"]["source_table"] == "network_logs"
    assert links[0]["provenance"]["source_table_label"] == "Network logs"
    assert links[0]["provenance"]["source_field"] == "ip_last_seen"
    assert links[0]["provenance"]["source_field_label"] == "IP address"


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


def test_query_helper_filters_same_attribute_type(tmp_path):
    # @covers duckdb_graph_query.same_attribute_filter
    # @level integration
    rows = [
        _row("customer", 6001, "cs_6001", "mobile_phone", "188-0001", "ma_1"),
        _row("mobile_phone", "188-0001", "ma_1", "customer", 6002, "cs_6002"),
        _row("customer", 6001, "cs_6001", "email", "filter@example.com", "em_1"),
        _row("email", "filter@example.com", "em_1", "customer", 6003, "cs_6003"),
    ]
    db_path = tmp_path / "graph-filter.duckdb"
    _create_snapshot(db_path, rows)

    con = duckdb.connect(str(db_path))
    try:
        links = graph_query.query_association_neighbors(
            con,
            cust_id=6001,
            same_attribute_type="same_email",
        )
    finally:
        con.close()

    assert len(links) == 1
    assert links[0]["neighbor_cust_id"] == 6003
    assert links[0]["same_attribute_type"] == "same_email"
    assert links[0]["edge_type"] == "SAME_EMAIL"


def test_query_helper_rejects_invalid_same_attribute_type(tmp_path):
    # @covers duckdb_graph_query.same_attribute_filter_validation
    # @level integration
    rows = [
        _row("customer", 7001, "cs_7001", "mobile_phone", "199-0001", "ma_1"),
        _row("mobile_phone", "199-0001", "ma_1", "customer", 7002, "cs_7002"),
    ]
    db_path = tmp_path / "graph-invalid-filter.duckdb"
    _create_snapshot(db_path, rows)

    con = duckdb.connect(str(db_path))
    try:
        with pytest.raises(ValueError, match="Unsupported same_attribute_type"):
            graph_query.query_association_neighbors(
                con,
                cust_id=7001,
                same_attribute_type="bogus",
            )
    finally:
        con.close()


def test_query_helper_covers_all_same_attribute_filters(tmp_path):
    # @covers duckdb_graph_query.same_attribute_filter
    # @level integration
    rows = [
        _row("customer", 8101, "cs_8101", "mobile_phone", "m-01", "ma_01"),
        _row("mobile_phone", "m-01", "ma_01", "customer", 8102, "cs_8102"),
        _row("customer", 8101, "cs_8101", "email", "e-01", "em_01"),
        _row("email", "e-01", "em_01", "customer", 8103, "cs_8103"),
        _row("customer", 8101, "cs_8101", "business_name", "Acme", "bn_01"),
        _row("business_name", "Acme", "bn_01", "customer", 8104, "cs_8104"),
        _row("customer", 8101, "cs_8101", "person_name", "Alice", "pn_01"),
        _row("person_name", "Alice", "pn_01", "customer", 8105, "cs_8105"),
        _row("customer", 8101, "cs_8101", "id_no", "ID-01", "id_01"),
        _row("id_no", "ID-01", "id_01", "customer", 8106, "cs_8106"),
        _row("customer", 8101, "cs_8101", "address", "1 Main", "ad_01"),
        _row("address", "1 Main", "ad_01", "customer", 8107, "cs_8107"),
        _row("customer", 8101, "cs_8101", "store_url", "https://shop", "su_01"),
        _row("store_url", "https://shop", "su_01", "customer", 8108, "cs_8108"),
        _row("customer", 8101, "cs_8101", "ip", "10.1.1.1", "ip_01"),
        _row("ip", "10.1.1.1", "ip_01", "customer", 8109, "cs_8109"),
    ]
    db_path = tmp_path / "graph-all-query-filters.duckdb"
    _create_snapshot(db_path, rows)

    same_filters = [
        "same_mobile_phone",
        "same_email",
        "same_business_name",
        "same_person_name",
        "same_id_no",
        "same_address",
        "same_store_url",
        "same_ip",
    ]
    expected_neighbor = {
        "same_mobile_phone": 8102,
        "same_email": 8103,
        "same_business_name": 8104,
        "same_person_name": 8105,
        "same_id_no": 8106,
        "same_address": 8107,
        "same_store_url": 8108,
        "same_ip": 8109,
    }

    con = duckdb.connect(str(db_path))
    try:
        for same_attribute_type in same_filters:
            links = graph_query.query_association_neighbors(
                con,
                cust_id=8101,
                same_attribute_type=same_attribute_type,
            )
            assert len(links) == 1
            assert links[0]["neighbor_cust_id"] == expected_neighbor[same_attribute_type]
            assert links[0]["same_attribute_type"] == same_attribute_type
    finally:
        con.close()


def test_neighbor_lookup_filters_each_same_attribute_type(tmp_path, monkeypatch):
    # @covers duckdb_graph_service.same_attribute_filter
    # @level integration
    rows = [
        _row("customer", 8001, "cs_8001", "mobile_phone", "m-01", "ma_01"),
        _row("mobile_phone", "m-01", "ma_01", "customer", 8002, "cs_8002"),
        _row("customer", 8001, "cs_8001", "email", "a@b.com", "em_01"),
        _row("email", "a@b.com", "em_01", "customer", 8003, "cs_8003"),
        _row("customer", 8001, "cs_8001", "business_name", "Acme", "bn_01"),
        _row("business_name", "Acme", "bn_01", "customer", 8004, "cs_8004"),
        _row("customer", 8001, "cs_8001", "person_name", "Alice", "pn_01"),
        _row("person_name", "Alice", "pn_01", "customer", 8005, "cs_8005"),
        _row("customer", 8001, "cs_8001", "id_no", "ID-01", "id_01"),
        _row("id_no", "ID-01", "id_01", "customer", 8006, "cs_8006"),
        _row("customer", 8001, "cs_8001", "address", "1 Main", "ad_01"),
        _row("address", "1 Main", "ad_01", "customer", 8007, "cs_8007"),
        _row("customer", 8001, "cs_8001", "store_url", "https://shop", "su_01"),
        _row("store_url", "https://shop", "su_01", "customer", 8008, "cs_8008"),
        _row("customer", 8001, "cs_8001", "ip", "10.0.0.1", "ip_01"),
        _row("ip", "10.0.0.1", "ip_01", "customer", 8009, "cs_8009"),
    ]
    db_path = tmp_path / "graph-all-filters.duckdb"
    _create_snapshot(db_path, rows)
    same_filters = [
        ("same_mobile_phone", 8002),
        ("same_email", 8003),
        ("same_business_name", 8004),
        ("same_person_name", 8005),
        ("same_id_no", 8006),
        ("same_address", 8007),
        ("same_store_url", 8008),
        ("same_ip", 8009),
    ]

    monkeypatch.setenv("GRAPH_DUCKDB_PATH", str(db_path))
    with TestClient(graph_service.app) as client:
        for filter_value, expected_neighbor in same_filters:
            response = client.get("/neighbors/8001", params={"same_attribute_type": filter_value})
            links = response.json()
            assert response.status_code == 200
            assert len(links) == 1
            assert links[0]["neighbor_cust_id"] == expected_neighbor
            assert links[0]["same_attribute_type"] == filter_value


def test_neighbor_lookup_rejects_high_fanout_attribute_unfiltered(tmp_path, monkeypatch):
    # @covers duckdb_graph_service.fanout_guard_unfiltered
    # @level integration
    rows = []
    for neighbor_id in [8302, 8303, 8304]:
        rows.append(
            _row(
                "customer",
                8301,
                "cs_8301",
                "mobile_phone",
                "199-333",
                "ma_33",
            )
        )
        rows.append(
            _row(
                "mobile_phone",
                "199-333",
                "ma_33",
                "customer",
                neighbor_id,
                f"cs_{neighbor_id}",
            )
        )

    rows.extend(
        [
            _row("customer", 8301, "cs_8301", "email", "same@sample.com", "em_01"),
            _row(
                "email",
                "same@sample.com",
                "em_01",
                "customer",
                8399,
                "cs_8399",
            ),
        ]
    )
    db_path = tmp_path / "graph-fanout.duckdb"
    _create_snapshot(db_path, rows)
    monkeypatch.setenv("GRAPH_DUCKDB_PATH", str(db_path))
    monkeypatch.setenv("GRAPH_MAX_QUERY_DEGREE", "2")

    with TestClient(graph_service.app) as client:
        response = client.get("/neighbors/8301")

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["code"] == "ATTR_FANOUT_TOO_HIGH"
    assert detail["cust_id"] == 8301
    assert detail["association_attribute_type"] == "mobile_phone"
    assert detail["same_attribute_type"] == "same_mobile_phone"
    assert detail["neighbor_count"] == 3
    assert detail["max_degree"] == 2


def test_neighbor_lookup_rejects_high_fanout_attribute_filtered(tmp_path, monkeypatch):
    # @covers duckdb_graph_service.fanout_guard_filtered
    # @level integration
    rows = []
    for neighbor_id in [8402, 8403, 8404]:
        rows.append(
            _row(
                "customer",
                8401,
                "cs_8401",
                "mobile_phone",
                "199-444",
                "ma_44",
            )
        )
        rows.append(
            _row(
                "mobile_phone",
                "199-444",
                "ma_44",
                "customer",
                neighbor_id,
                f"cs_{neighbor_id}",
            )
        )

    rows.extend(
        [
            _row("customer", 8401, "cs_8401", "email", "e-123", "em_11"),
            _row("email", "e-123", "em_11", "customer", 8405, "cs_8405"),
        ]
    )
    db_path = tmp_path / "graph-fanout-filtered.duckdb"
    _create_snapshot(db_path, rows)
    monkeypatch.setenv("GRAPH_DUCKDB_PATH", str(db_path))
    monkeypatch.setenv("GRAPH_MAX_QUERY_DEGREE", "2")

    with TestClient(graph_service.app) as client:
        response = client.get(
            "/neighbors/8401",
            params={"same_attribute_type": "same_mobile_phone"},
        )

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["code"] == "ATTR_FANOUT_TOO_HIGH"
    assert detail["cust_id"] == 8401
    assert detail["association_attribute_type"] == "mobile_phone"
    assert detail["same_attribute_type"] == "same_mobile_phone"
    assert detail["neighbor_count"] == 3
    assert detail["max_degree"] == 2


def test_neighbor_lookup_allows_low_fanout_filter_when_total_degree_is_high(tmp_path, monkeypatch):
    # @covers duckdb_graph_service.filtered_fanout_guard
    # @level integration
    rows = []
    for neighbor_id in [8602, 8603, 8604]:
        rows.append(
            _row(
                "customer",
                8601,
                "cs_8601",
                "mobile_phone",
                "199-666",
                "ma_66",
            )
        )
        rows.append(
            _row(
                "mobile_phone",
                "199-666",
                "ma_66",
                "customer",
                neighbor_id,
                f"cs_{neighbor_id}",
            )
        )
    rows.extend(
        [
            _row("customer", 8601, "cs_8601", "email", "safe@example.com", "em_safe"),
            _row("email", "safe@example.com", "em_safe", "customer", 8699, "cs_8699"),
        ]
    )
    db_path = tmp_path / "graph-filter-safe-high-degree.duckdb"
    _create_snapshot(db_path, rows)
    monkeypatch.setenv("GRAPH_DUCKDB_PATH", str(db_path))
    monkeypatch.setenv("GRAPH_MAX_QUERY_DEGREE", "2")

    with TestClient(graph_service.app) as client:
        response = client.get(
            "/neighbors/8601",
            params={"same_attribute_type": "same_email"},
        )

    assert response.status_code == 200
    links = response.json()
    assert len(links) == 1
    assert links[0]["neighbor_cust_id"] == 8699
    assert links[0]["same_attribute_type"] == "same_email"


def test_neighbor_lookup_rejects_unmapped_same_attribute_filter(tmp_path, monkeypatch):
    # @covers duckdb_graph_service.same_attribute_filter_validation
    # @level integration
    rows = [
        _row("customer", 8501, "cs_8501", "ip", "10.0.0.5", "ip_1"),
        _row("ip", "10.0.0.5", "ip_1", "customer", 8502, "cs_8502"),
    ]
    db_path = tmp_path / "graph-unmapped-filter.duckdb"
    _create_snapshot(db_path, rows)
    monkeypatch.setenv("GRAPH_DUCKDB_PATH", str(db_path))
    with TestClient(graph_service.app) as client:
        response = client.get(
            "/neighbors/8501",
            params={"same_attribute_type": "SAME_PHONE"},
        )
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "INVALID_SAME_ATTRIBUTE_TYPE"



def test_confirmed_risk_uses_legacy_registry_when_available(tmp_path, monkeypatch):
    # @covers duckdb_graph_service.confirmed_risk_legacy_registry
    # @level integration
    db_path = tmp_path / "graph-confirmed-risk.duckdb"
    _create_snapshot(db_path, [])
    _create_graph_nodes(
        db_path,
        [
            {
                "cust_id": 8001,
                "cust_type": "COMPANY",
                "cust_name": "Confirmed Customer",
                "risk_level": "HIGH",
                "is_high_risk": "Y",
                "is_sanctioned": "N",
                "current_balance": 50.0,
                "confirmed_risk_status": "confirmed",
                "confirmed_risk_type": "bad_customer",
            }
        ],
    )
    _create_confirmed_risk_registry(
        db_path,
        [
            {
                "subject_id": 8001,
                "source_file": "case.xlsx",
                "source_label": "bad_customer",
                "source_bad_type": "fraud",
                "ingested_at": datetime(2026, 6, 1),
            }
        ],
    )
    monkeypatch.setenv("GRAPH_DUCKDB_PATH", str(db_path))

    with TestClient(graph_service.app) as client:
        response = client.get("/confirmed-risk/8001")
        listing = client.get("/confirmed-risk?limit=10")

    assert response.status_code == 200
    assert response.json()["cust_id"] == 8001
    assert response.json()["source_bad_type"] == "fraud"
    assert listing.status_code == 200
    assert listing.json()[0]["cust_id"] == 8001


def test_confirmed_risk_returns_explicit_unavailable_without_registry(tmp_path, monkeypatch):
    # @covers duckdb_graph_service.confirmed_risk_legacy_unavailable
    # @level integration
    db_path = tmp_path / "graph-no-registry.duckdb"
    _create_snapshot(db_path, [])
    monkeypatch.setenv("GRAPH_DUCKDB_PATH", str(db_path))

    with TestClient(graph_service.app) as client:
        response = client.get("/confirmed-risk/8001")

    assert response.status_code == 501
    assert response.json()["detail"]["code"] == "CONFIRMED_RISK_REGISTRY_UNAVAILABLE"


def test_path_uses_legacy_multihop_edges_when_available(tmp_path, monkeypatch):
    # @covers duckdb_graph_service.path_legacy_graph_edges
    # @level integration
    db_path = tmp_path / "graph-path.duckdb"
    _create_snapshot(db_path, [])
    _create_graph_edges(
        db_path,
        [
            {"edge_id": 1, "source_cust_id": 9001, "target_cust_id": 9002},
            {"edge_id": 2, "source_cust_id": 9002, "target_cust_id": 9003},
        ],
    )
    monkeypatch.setenv("GRAPH_DUCKDB_PATH", str(db_path))

    with TestClient(graph_service.app) as client:
        response = client.get("/path/9001/9003?max_depth=2&limit=10")

    assert response.status_code == 200
    assert response.json()[0] == {"path_text": "9001 -> 9002 -> 9003", "depth": 2}


def test_path_returns_explicit_unavailable_without_graph_edges(tmp_path, monkeypatch):
    # @covers duckdb_graph_service.path_legacy_unavailable
    # @level integration
    db_path = tmp_path / "graph-no-edges.duckdb"
    _create_snapshot(db_path, [])
    monkeypatch.setenv("GRAPH_DUCKDB_PATH", str(db_path))

    with TestClient(graph_service.app) as client:
        response = client.get("/path/9001/9003?max_depth=2")

    assert response.status_code == 501
    assert response.json()["detail"]["code"] == "PATH_TRAVERSAL_UNAVAILABLE"


def test_path_preserves_legacy_degree_guard(tmp_path, monkeypatch):
    # @covers duckdb_graph_service.path_legacy_degree_guard
    # @level integration
    db_path = tmp_path / "graph-path-guard.duckdb"
    _create_snapshot(db_path, [])
    _create_graph_edges(
        db_path,
        [
            {"edge_id": 1, "source_cust_id": 9101, "target_cust_id": 9102},
            {"edge_id": 2, "source_cust_id": 9102, "target_cust_id": 9103},
        ],
    )
    monkeypatch.setenv("GRAPH_DUCKDB_PATH", str(db_path))
    monkeypatch.setenv("GRAPH_MAX_QUERY_DEGREE", "0")

    with TestClient(graph_service.app) as client:
        response = client.get("/path/9101/9103?max_depth=2")

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "NODE_DEGREE_TOO_HIGH"
