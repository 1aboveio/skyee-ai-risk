#!/usr/bin/env python3
"""
Build Confirmed Risk Registry - Bad Customer Slice

Ingests customer IDs from labeled spreadsheets and produces a normalized
risk registry for downstream graph/monitoring consumption.

Source files:
  - 坏人特征库名单_截止20260605.xlsx: Manual label list (189 customers)
  - 欺诈客户特征（3个代码）.xlsx: Fraud feature list (3 customers)

Output:
  - CSV for Hive staging (data/confirmed_risk_registry/)
  - Validation report to stdout
"""

import argparse
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

import pandas as pd


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE_DIR = PROJECT_ROOT / "docs" / "reference" / "label"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "data" / "confirmed_risk_registry"

SOURCE_FILES = {
    "bad_person_label": "坏人特征库名单_截止20260605.xlsx",
    "fraud_features": "欺诈客户特征（3个代码）.xlsx",
}

# Column name mappings per source
COL_MAP = {
    "bad_person_label": {"id": "客户代码", "label": "人工标签", "type": "坏人类型"},
    "fraud_features": {"id": "cust_id"},
}

SUBJECT_TYPE = "customer"
CONFIRMED_RISK_TYPE = "bad_customer"
CONFIRMED_RISK_STATUS = "confirmed"


# ---------------------------------------------------------------------------
# Extraction
# ---------------------------------------------------------------------------

def extract_bad_person_label(path: Path) -> pd.DataFrame:
    """Extract customer IDs from the manual label spreadsheet."""
    df = pd.read_excel(path)

    # Validate expected columns
    expected = {"客户代码", "人工标签", "坏人类型"}
    actual = set(df.columns)
    if not expected.issubset(actual):
        raise ValueError(
            f"坏人特征库 missing expected columns. "
            f"Expected superset of {expected}, got {actual}"
        )

    records = df[["客户代码", "人工标签", "坏人类型"]].copy()
    records["subject_id"] = records["客户代码"].astype(str).str.strip()
    records["source_file"] = SOURCE_FILES["bad_person_label"]
    records["source_label"] = records["人工标签"]
    records["source_bad_type"] = records["坏人类型"].fillna("未知")
    records["source_as_of"] = "截止20260605"

    return records[["subject_id", "source_file", "source_label",
                     "source_bad_type", "source_as_of"]]


def extract_fraud_features(path: Path) -> pd.DataFrame:
    """Extract customer IDs from the fraud features spreadsheet.
    
    NOTE: All fraud feature columns are IGNORED per requirements.
    Only cust_id is extracted.
    """
    df = pd.read_excel(path)

    if "cust_id" not in df.columns:
        raise ValueError("欺诈客户特征 missing 'cust_id' column")

    records = df[["cust_id"]].copy()
    records["subject_id"] = records["cust_id"].astype(str).str.strip()
    records["source_file"] = SOURCE_FILES["fraud_features"]
    records["source_label"] = "欺诈客户"  # inferred from filename
    records["source_bad_type"] = "欺诈客户"
    records["source_as_of"] = "特征提取样本"

    return records[["subject_id", "source_file", "source_label",
                     "source_bad_type", "source_as_of"]]


# ---------------------------------------------------------------------------
# Normalization
# ---------------------------------------------------------------------------

def normalize(records: pd.DataFrame) -> pd.DataFrame:
    """Normalize extracted records into the confirmed risk registry schema."""
    registry = pd.DataFrame({
        "subject_type": SUBJECT_TYPE,
        "subject_id": records["subject_id"],
        "confirmed_risk_type": CONFIRMED_RISK_TYPE,
        "confirmed_risk_status": CONFIRMED_RISK_STATUS,
        "source_file": records["source_file"],
        "source_label": records["source_label"],
        "source_bad_type": records["source_bad_type"],
        "source_as_of": records["source_as_of"],
        "ingested_at": datetime.utcnow().isoformat() + "Z",
    })
    return registry


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate(df: pd.DataFrame) -> dict:
    """Run validation checks and return a report dict."""
    report = {
        "total_records": len(df),
        "unique_subject_ids": df["subject_id"].nunique(),
        "duplicates_removed": 0,
        "missing_subject_ids": [],
        "source_lineage": {},
        "customer_type_distribution": {},
    }

    # Check for empty subject IDs
    empty_mask = df["subject_id"].isna() | (df["subject_id"].str.strip() == "")
    if empty_mask.any():
        report["missing_subject_ids"] = df.loc[empty_mask].index.tolist()

    # Check for duplicates (keep first occurrence)
    dup_mask = df.duplicated(subset=["subject_id"], keep="first")
    report["duplicates_removed"] = int(dup_mask.sum())

    # Source lineage
    source_counts = df["source_file"].value_counts().to_dict()
    report["source_lineage"] = source_counts

    # Customer type distribution (from source_bad_type)
    type_counts = df["source_bad_type"].value_counts().to_dict()
    report["customer_type_distribution"] = type_counts

    return report


def print_validation_report(report: dict):
    """Pretty-print the validation report."""
    print("\n" + "=" * 60)
    print("CONFIRMED RISK REGISTRY - VALIDATION REPORT")
    print("=" * 60)

    print(f"\nTotal records ingested:      {report['total_records']}")
    print(f"Unique subject IDs:          {report['unique_subject_ids']}")
    print(f"Duplicates removed:          {report['duplicates_removed']}")

    if report["missing_subject_ids"]:
        print(f"\n⚠  Missing subject IDs at rows: {report['missing_subject_ids']}")
    else:
        print("\n✓  No missing subject IDs")

    print("\n--- Source File Lineage ---")
    for src, count in report["source_lineage"].items():
        print(f"  {src}: {count} records")

    print("\n--- Customer Type Distribution ---")
    for ctype, count in sorted(
        report["customer_type_distribution"].items(),
        key=lambda x: x[1],
        reverse=True,
    ):
        print(f"  {ctype}: {count}")

    print("\n" + "=" * 60)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main(
    source_dir: Optional[Path] = None,
    output_dir: Optional[Path] = None,
    dry_run: bool = False,
):
    source_dir = source_dir or DEFAULT_SOURCE_DIR
    output_dir = output_dir or DEFAULT_OUTPUT_DIR

    print(f"Source directory: {source_dir}")
    print(f"Output directory: {output_dir}")

    # --- Extract ---
    dfs = []

    bad_person_path = source_dir / SOURCE_FILES["bad_person_label"]
    if bad_person_path.exists():
        print(f"\nExtracting from {SOURCE_FILES['bad_person_label']}...")
        dfs.append(extract_bad_person_label(bad_person_path))
    else:
        print(f"⚠  File not found: {bad_person_path}")

    fraud_path = source_dir / SOURCE_FILES["fraud_features"]
    if fraud_path.exists():
        print(f"Extracting from {SOURCE_FILES['fraud_features']}...")
        dfs.append(extract_fraud_features(fraud_path))
    else:
        print(f"⚠  File not found: {fraud_path}")

    if not dfs:
        print("ERROR: No source files found. Aborting.", file=sys.stderr)
        sys.exit(1)

    # --- Combine & Normalize ---
    combined = pd.concat(dfs, ignore_index=True)
    registry = normalize(combined)

    # --- Deduplicate (keep first occurrence) ---
    before_dedup = len(registry)
    registry = registry.drop_duplicates(subset=["subject_id"], keep="first")
    after_dedup = len(registry)

    # --- Validate ---
    report = validate(registry)
    report["duplicates_removed"] = before_dedup - after_dedup
    print_validation_report(report)

    # --- Output ---
    if dry_run:
        print("\n[DRY RUN] No files written.")
        print("\nSample output (first 10 rows):")
        print(registry.head(10).to_string(index=False))
        return registry, report

    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    csv_path = output_dir / f"confirmed_risk_registry_{timestamp}.csv"
    registry.to_csv(csv_path, index=False, encoding="utf-8-sig")
    print(f"\n✓  CSV written: {csv_path}")

    # Also write a latest symlink-style file
    latest_path = output_dir / "confirmed_risk_registry_latest.csv"
    registry.to_csv(latest_path, index=False, encoding="utf-8-sig")
    print(f"✓  Latest CSV:  {latest_path}")

    # Write validation report as JSON
    import json
    report_path = output_dir / f"validation_report_{timestamp}.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"✓  Report:      {report_path}")

    return registry, report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Build confirmed risk registry from labeled spreadsheets"
    )
    parser.add_argument(
        "--source-dir",
        type=Path,
        help="Directory containing source spreadsheets",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        help="Output directory for registry files",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print output without writing files",
    )
    args = parser.parse_args()
    main(
        source_dir=args.source_dir,
        output_dir=args.output_dir,
        dry_run=args.dry_run,
    )
