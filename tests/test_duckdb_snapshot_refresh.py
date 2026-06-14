from datetime import datetime
from pathlib import Path

import duckdb
import pytest

import scripts.duckdb_graph_query as graph_query
from scripts import duckdb_snapshot_refresh


TABLE_COLUMNS = graph_query.ASSOCIATION_LINK_COLUMNS


def _create_parquet_snapshot(path: Path, rows: list[dict]) -> None:
    con = duckdb.connect()
    con.execute(
        f"CREATE TABLE association_attribute_links ({', '.join(f'{c} VARCHAR' for c in TABLE_COLUMNS)})"
    )
    con.executemany(
        f"INSERT INTO association_attribute_links ({', '.join(TABLE_COLUMNS)}) VALUES ({', '.join('?' for _ in TABLE_COLUMNS)})",
        [
            tuple(
                str(row[col])
                for col in TABLE_COLUMNS
                if col not in {"record_count"}
            )
            + (str(row["record_count"]),)
            for row in rows
        ],
    )
    con.execute(f"COPY association_attribute_links TO '{path}' (FORMAT PARQUET)")
    con.close()


def _create_invalid_schema_parquet(path: Path) -> None:
    con = duckdb.connect()
    con.execute("CREATE TABLE association_attribute_links (src_attr_type VARCHAR, src_attr_value VARCHAR)")
    con.execute(
        "INSERT INTO association_attribute_links VALUES (?, ?)",
        [
            "customer",
            "1001",
        ],
    )
    con.execute(f"COPY association_attribute_links TO '{path}' (FORMAT PARQUET)")
    con.close()


def _create_live_snapshot(path: Path, rows: list[dict]) -> None:
    con = duckdb.connect(str(path))
    con.execute("DROP TABLE IF EXISTS association_attribute_links")
    con.execute(
        f"CREATE TABLE association_attribute_links ({', '.join(f'{c} VARCHAR' for c in TABLE_COLUMNS)})"
    )
    con.executemany(
        f"INSERT INTO association_attribute_links ({', '.join(TABLE_COLUMNS)}) VALUES ({', '.join('?' for _ in TABLE_COLUMNS)})",
        [
            tuple(
                str(row[col])
                for col in TABLE_COLUMNS
                if col not in {"record_count"}
            ) + (str(row["record_count"]),)
            for row in rows
        ],
    )
    con.close()


def _snapshot_row_count(path: Path) -> int:
    con = duckdb.connect(str(path), read_only=True)
    try:
        count = con.execute(f"SELECT COUNT(*) FROM {graph_query.ASSOCIATION_ATTRIBUTE_LINK_TABLE}").fetchone()
    finally:
        con.close()
    return int(count[0])


def _link_row(
    source_type: str,
    source_value: int | str,
    target_type: str,
    target_value: int | str,
    link_type: str = "link",
) -> dict:
    timestamp = datetime(2026, 6, 1)
    return {
        "src_attr_type": source_type,
        "src_attr_value": str(source_value),
        "src_attr_hash": f"h_{source_value}",
        "dst_attr_type": target_type,
        "dst_attr_value": str(target_value),
        "dst_attr_hash": f"h_{target_value}",
        "attr_link_type": link_type,
        "source_table": "source",
        "source_field": "field",
        "first_seen": timestamp,
        "last_seen": timestamp,
        "record_count": 1,
    }


def test_replace_promotes_candidate_snapshot_after_validation_passes(tmp_path):
    # @covers duckdb_snapshot_refresh.replace_candidate_promotion
    # @level integration
    live_db = tmp_path / "live.duckdb"
    candidate_source = tmp_path / "links.parquet"

    _create_live_snapshot(
        live_db,
        [
            _link_row("customer", 1001, "mobile_phone", "old"),
        ],
    )

    _create_parquet_snapshot(
        candidate_source,
        [
            _link_row("customer", 1001, "mobile_phone", "111-0001", link_type="mobile"),
            _link_row("customer", 2002, "email", "alice@acme.com", link_type="email"),
        ],
    )

    result = duckdb_snapshot_refresh.refresh_association_snapshot(
        [str(candidate_source)],
        live_db_path=str(live_db),
    )

    assert result["rows_loaded"] == 2
    assert _snapshot_row_count(live_db) == 2
    assert result["live_db_path"] == str(live_db)


def test_refresh_rejects_invalid_snapshot_and_keeps_live_snapshot(tmp_path):
    # @covers duckdb_snapshot_refresh.preserve_live_on_validation_failure
    # @level integration
    live_db = tmp_path / "live.duckdb"
    bad_source = tmp_path / "bad-links.parquet"
    bad_source.parent.mkdir(parents=True, exist_ok=True)

    _create_live_snapshot(
        live_db,
        [
            _link_row("customer", 1001, "mobile_phone", "111-0001"),
        ],
    )
    _create_invalid_schema_parquet(bad_source)

    with pytest.raises(ValueError):
        duckdb_snapshot_refresh.refresh_association_snapshot(
            [str(bad_source)],
            live_db_path=str(live_db),
            minimum_rows=1,
        )

    assert _snapshot_row_count(live_db) == 1


def test_refresh_rejects_raw_hudi_storage_paths(tmp_path):
    # @covers duckdb_snapshot_refresh.raw_hudi_path_guard
    # @level integration
    live_db = tmp_path / "live.duckdb"
    _create_live_snapshot(
        live_db,
        [_link_row("customer", 9001, "mobile_phone", "111-1111")],
    )

    hudi_path = str(tmp_path / "hive/warehouse/usr_skyee_mw/dwd_graph_edges")

    with pytest.raises(ValueError, match="raw Hudi path"):
        duckdb_snapshot_refresh.refresh_association_snapshot(
            [hudi_path],
            live_db_path=str(live_db),
        )

    assert _snapshot_row_count(live_db) == 1
