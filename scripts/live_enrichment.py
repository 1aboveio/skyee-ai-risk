from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

DEFAULT_ENRICHMENT_BATCH_SIZE = 100


def _normalize_customer_id(value: Any) -> int | None:
    """Return a normalized customer id for enrichment and matching."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


class SourceEvidenceDatabaseAdapter(ABC):
    """Abstraction for fetching linked-customer enrichment payloads."""

    @abstractmethod
    def get_customer_profiles(
        self, customer_ids: list[int]
    ) -> dict[int, dict[str, Any]]:
        """Return a customer_id -> enrichment payload mapping for requested IDs."""


@dataclass(frozen=True)
class _EnrichmentFieldSpec:
    source_key: str
    row_key: str


_ENRICHMENT_FIELD_SPECS = (
    _EnrichmentFieldSpec("cust_name", "cust_name"),
    _EnrichmentFieldSpec("risk_level", "risk_level"),
    _EnrichmentFieldSpec("is_high_risk", "is_high_risk"),
    _EnrichmentFieldSpec("is_sanctioned", "is_sanctioned"),
    _EnrichmentFieldSpec("current_balance", "current_balance"),
    _EnrichmentFieldSpec("confirmed_risk_status", "confirmed_risk_status"),
    _EnrichmentFieldSpec("confirmed_risk_type", "confirmed_risk_type"),
    _EnrichmentFieldSpec("node_degree", "node_degree"),
)


def batch_ids(customer_ids: list[int], batch_size: int) -> list[list[int]]:
    """Split a list of customer IDs into bounded batches."""
    if batch_size <= 0:
        raise ValueError("batch_size must be greater than zero")
    return [customer_ids[index : index + batch_size] for index in range(0, len(customer_ids), batch_size)]


def _coerce_ids(rows: list[dict[str, Any]]) -> list[int]:
    seen: set[int] = set()
    ordered_ids: list[int] = []
    for row in rows:
        customer_id = _normalize_customer_id(row.get("neighbor_cust_id"))
        if customer_id is None:
            continue
        if customer_id in seen:
            continue
        seen.add(customer_id)
        ordered_ids.append(customer_id)
    return ordered_ids


def _apply_enrichment_payload(
    row: dict[str, Any],
    payload: dict[str, Any] | None,
    default_error: str | None,
) -> None:
    if payload is None:
        row["cust_name"] = row.get("cust_name")
        row["risk_level"] = row.get("risk_level")
        row["is_high_risk"] = row.get("is_high_risk")
        row["is_sanctioned"] = row.get("is_sanctioned")
        row["current_balance"] = row.get("current_balance")
        row["confirmed_risk_status"] = row.get("confirmed_risk_status")
        row["confirmed_risk_type"] = row.get("confirmed_risk_type")
        row["node_degree"] = row.get("node_degree", 0)
        row["enrichment_status"] = "partial" if default_error else "unavailable"
        row["enrichment_error"] = default_error
        return

    for spec in _ENRICHMENT_FIELD_SPECS:
        row[spec.row_key] = payload.get(spec.source_key)
    row["enrichment_status"] = "enriched"
    row["enrichment_error"] = None


def enrich_neighbor_rows_with_metadata(
    rows: list[dict[str, Any]],
    adapter: SourceEvidenceDatabaseAdapter,
    batch_size: int,
) -> list[dict[str, Any]]:
    """Apply batched live enrichment to neighbor rows.

    Enrichment happens on the already fanout-trimmed row set, and failures in a
    single batch do not abort the whole response.
    """
    if not rows:
        return rows

    ids = _coerce_ids(rows)
    if not ids:
        return rows

    failed_customer_ids: set[int] = set()
    failed_batch_error: str | None = None
    customer_profiles: dict[int, dict[str, Any]] = {}

    for batch in batch_ids(ids, batch_size):
        try:
            customer_profiles.update(adapter.get_customer_profiles(batch))
        except Exception as exc:  # pragma: no cover - defensive: adapter-specific failures
            failed_customer_ids.update(batch)
            failed_batch_error = f"Live enrichment batch failed: {exc}"

    for row in rows:
        neighbor_id = _normalize_customer_id(row.get("neighbor_cust_id"))
        payload = customer_profiles.get(neighbor_id) if neighbor_id is not None else None
        if payload is not None:
            _apply_enrichment_payload(row, payload, None)
            continue

        should_treat_as_partial = neighbor_id in failed_customer_ids
        _apply_enrichment_payload(row, None, failed_batch_error if should_treat_as_partial else None)

    return rows
