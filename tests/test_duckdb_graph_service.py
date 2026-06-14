from datetime import datetime
from pathlib import Path

import duckdb
import pytest
from fastapi.testclient import TestClient

import scripts.duckdb_graph_query as graph_query
import scripts.duckdb_graph_service as graph_service


class _FakeSourceEvidenceAdapter(graph_service.SourceEvidenceDatabaseAdapter):
    def __init__(
        self,
        payloads: dict[int, dict],
        fail_on_calls: set[int] | None = None,
        failure_messages: dict[int, str] | None = None,
    ) -> None:
        self.payloads = payloads
        self.fail_on_calls = fail_on_calls or set()
        self.failure_messages = failure_messages or {}
        self.calls: list[list[int]] = []
        self._call_index = 0

    def get_customer_profiles(self, customer_ids: list[int]) -> dict[int, dict]:
        self.calls.append(list(customer_ids))
        if self._call_index in self.fail_on_calls:
            message = self.failure_messages.get(
                self._call_index,
                f"simulated source evidence timeout on call {self._call_index + 1}",
            )
            self._call_index += 1
            raise RuntimeError(message)
        self._call_index += 1
        return {
            customer_id: self.payloads[customer_id]
            for customer_id in customer_ids
            if customer_id in self.payloads
        }


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


def test_neighbors_enrichment_is_batched_and_not_per_neighbor(tmp_path, monkeypatch):
    # @covers duckdb_graph_service.batch_enrichment
    # @level integration
    rows = [
        _row("customer", 5001, "cs_5001", "mobile_phone", "555-0001", "ma_1"),
        _row("mobile_phone", "555-0001", "ma_1", "customer", 5002, "cs_5002"),
        _row("customer", 5001, "cs_5001", "email", "e1@example.com", "em_1"),
        _row("email", "e1@example.com", "em_1", "customer", 5003, "cs_5003"),
        _row("customer", 5001, "cs_5001", "ip", "10.1.1.1", "ip_1"),
        _row("ip", "10.1.1.1", "ip_1", "customer", 5004, "cs_5004"),
    ]

    db_path = tmp_path / "graph-batch.duckdb"
    _create_snapshot(db_path, rows)
    monkeypatch.setenv("GRAPH_DUCKDB_PATH", str(db_path))
    monkeypatch.setenv("GRAPH_ENRICHMENT_BATCH_SIZE", "2")
    monkeypatch.setattr(
        graph_service,
        "source_evidence_adapter",
        _FakeSourceEvidenceAdapter(
            payloads={
                5002: {"cust_name": "Alice", "risk_level": "LOW"},
                5003: {"cust_name": "Bob", "risk_level": "LOW"},
                5004: {"cust_name": "Carol", "risk_level": "LOW"},
            },
        ),
    )

    with TestClient(graph_service.app) as client:
        links = _neighbors(client, 5001)

    assert len(links) == 3
    assert len(graph_service.source_evidence_adapter.calls) == 2
    assert all(len(batch) <= 2 for batch in graph_service.source_evidence_adapter.calls)
    assert {5002, 5003, 5004} == {
        row["neighbor_cust_id"] for row in links
    }


def test_neighbors_apply_enrichment_after_fanout_limit(tmp_path, monkeypatch):
    # @covers duckdb_graph_service.fanout_limit_enrichment_order
    # @level integration
    rows = [
        _row("customer", 6001, "cs_6001", "mobile_phone", "777-0001", "ma_1"),
        _row("mobile_phone", "777-0001", "ma_1", "customer", 6002, "cs_6002"),
        _row("customer", 6001, "cs_6001", "mobile_phone", "777-0001", "ma_1"),
        _row("mobile_phone", "777-0001", "ma_1", "customer", 6003, "cs_6003"),
        _row("customer", 6001, "cs_6001", "mobile_phone", "777-0001", "ma_1"),
        _row("mobile_phone", "777-0001", "ma_1", "customer", 6004, "cs_6004"),
        _row("customer", 6001, "cs_6001", "mobile_phone", "777-0001", "ma_1"),
        _row("mobile_phone", "777-0001", "ma_1", "customer", 6005, "cs_6005"),
        _row("customer", 6001, "cs_6001", "mobile_phone", "777-0001", "ma_1"),
        _row("mobile_phone", "777-0001", "ma_1", "customer", 6006, "cs_6006"),
    ]
    # Multiple evidence rows for each neighbor are intentionally avoided because
    # enrichment is bound to unique linked customer IDs after dedupe.
    db_path = tmp_path / "graph-limit.duckdb"
    _create_snapshot(db_path, rows)
    monkeypatch.setenv("GRAPH_DUCKDB_PATH", str(db_path))
    monkeypatch.setenv("GRAPH_ENRICHMENT_BATCH_SIZE", "10")
    monkeypatch.setattr(
        graph_service,
        "source_evidence_adapter",
        _FakeSourceEvidenceAdapter(
            payloads={
                6002: {"cust_name": "Customer 6002"},
                6003: {"cust_name": "Customer 6003"},
                6004: {"cust_name": "Customer 6004"},
                6005: {"cust_name": "Customer 6005"},
                6006: {"cust_name": "Customer 6006"},
            },
        ),
    )

    with TestClient(graph_service.app) as client:
        response = client.get("/neighbors/6001?limit=2")
    assert response.status_code == 200
    links = response.json()

    assert len(links) == 2
    returned_ids = [item["neighbor_cust_id"] for item in links]
    assert len(graph_service.source_evidence_adapter.calls) == 1
    assert set(graph_service.source_evidence_adapter.calls[0]).issubset(set(returned_ids))
    assert set(graph_service.source_evidence_adapter.calls[0]) == set(returned_ids)


def test_neighbors_partial_enrichment_failure_is_returned(tmp_path, monkeypatch):
    # @covers duckdb_graph_service.partial_enrichment_failure
    # @level integration
    rows = [
        _row("customer", 7001, "cs_7001", "mobile_phone", "901-0001", "ma_1"),
        _row("mobile_phone", "901-0001", "ma_1", "customer", 7002, "cs_7002"),
        _row("customer", 7001, "cs_7001", "mobile_phone", "901-0001", "ma_1"),
        _row("mobile_phone", "901-0001", "ma_1", "customer", 7003, "cs_7003"),
        _row("customer", 7001, "cs_7001", "mobile_phone", "901-0001", "ma_1"),
        _row("mobile_phone", "901-0001", "ma_1", "customer", 7004, "cs_7004"),
    ]
    db_path = tmp_path / "graph-partial.duckdb"
    _create_snapshot(db_path, rows)
    monkeypatch.setenv("GRAPH_DUCKDB_PATH", str(db_path))
    monkeypatch.setenv("GRAPH_ENRICHMENT_BATCH_SIZE", "2")

    fake_adapter = _FakeSourceEvidenceAdapter(
        payloads={
            7002: {"cust_name": "Customer 7002"},
            7003: {"cust_name": "Customer 7003"},
        },
        fail_on_calls={1},
    )
    monkeypatch.setattr(graph_service, "source_evidence_adapter", fake_adapter)

    with TestClient(graph_service.app) as client:
        response = client.get("/neighbors/7001")
    assert response.status_code == 200
    links = response.json()

    linked = {link["neighbor_cust_id"]: link for link in links}
    assert linked[7002]["enrichment_status"] == "enriched"
    assert linked[7002]["cust_name"] == "Customer 7002"
    assert linked[7003]["enrichment_status"] == "enriched"
    assert linked[7003]["cust_name"] == "Customer 7003"
    assert linked[7004]["enrichment_status"] == "partial"
    assert linked[7004]["cust_name"] is None
    assert "simulated source evidence timeout" in linked[7004]["enrichment_error"]


def test_neighbors_preserve_per_batch_enrichment_errors(tmp_path, monkeypatch):
    # @covers duckdb_graph_service.partial_enrichment_failure
    # @level integration
    rows = [
        _row("customer", 7101, "cs_7101", "mobile_phone", "901-1001", "ma_11"),
        _row("mobile_phone", "901-1001", "ma_11", "customer", 7102, "cs_7102"),
        _row("customer", 7101, "cs_7101", "email", "batch-one@example.com", "em_11"),
        _row("email", "batch-one@example.com", "em_11", "customer", 7103, "cs_7103"),
        _row("customer", 7101, "cs_7101", "ip", "10.71.0.4", "ip_11"),
        _row("ip", "10.71.0.4", "ip_11", "customer", 7104, "cs_7104"),
        _row("customer", 7101, "cs_7101", "address", "710 Main St", "addr_11"),
        _row("address", "710 Main St", "addr_11", "customer", 7105, "cs_7105"),
    ]
    db_path = tmp_path / "graph-partial-two-batches.duckdb"
    _create_snapshot(db_path, rows)
    monkeypatch.setenv("GRAPH_DUCKDB_PATH", str(db_path))
    monkeypatch.setenv("GRAPH_ENRICHMENT_BATCH_SIZE", "2")

    fake_adapter = _FakeSourceEvidenceAdapter(
        payloads={},
        fail_on_calls={0, 1},
        failure_messages={
            0: "first batch timeout",
            1: "second batch timeout",
        },
    )
    monkeypatch.setattr(graph_service, "source_evidence_adapter", fake_adapter)

    with TestClient(graph_service.app) as client:
        response = client.get("/neighbors/7101")
    assert response.status_code == 200

    linked = {link["neighbor_cust_id"]: link for link in response.json()}
    first_batch, second_batch = fake_adapter.calls
    for customer_id in first_batch:
        assert "first batch timeout" in linked[customer_id]["enrichment_error"]
    for customer_id in second_batch:
        assert "second batch timeout" in linked[customer_id]["enrichment_error"]


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
