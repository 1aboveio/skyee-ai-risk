#!/usr/bin/env python3
"""
Deep Data Cleaning Analysis & EDA for all 13 stg_* tables in usr_skyee_mw.
Analyzes nulls, duplicates, referential integrity, date ranges, and data lineage.
"""

import prestodb
import pandas as pd
import sys
import json
from datetime import datetime
from collections import defaultdict

# ─── Connection ───────────────────────────────────────────────────────────────
PRESTO_HOST = "172.16.100.213"
PRESTO_PORT = 9666
PRESTO_USER = "jonas"
CATALOG = "hive"
SCHEMA = "usr_skyee_mw"

TABLES = [
    "stg_cust_customer_info",
    "stg_cust_bank_acct_info",
    "stg_cust_collections_acct",
    "stg_cust_enterprise_realname_info",
    "stg_cust_foreign_trade_order",
    "stg_cust_foreign_trade_order_logistics",
    "stg_cust_person_realname_info",
    "stg_cust_realname_enterprise_ref_person",
    "stg_cust_store_info",
    "stg_cust_user_login_log",
    "stg_pmp_coll_order",
    "stg_pmp_pay_details",
    "stg_pmp_pay_order",
]


def get_connection():
    return prestodb.dbapi.connect(
        host=PRESTO_HOST,
        port=PRESTO_PORT,
        user=PRESTO_USER,
        catalog=CATALOG,
        schema=SCHEMA,
    )


def run_query(conn, sql, desc=""):
    """Execute query and return list of row tuples."""
    cur = conn.cursor()
    try:
        cur.execute(sql)
        rows = cur.fetchall()
        return rows
    except Exception as e:
        print(f"  [WARN] Query failed ({desc}): {e}", file=sys.stderr)
        return None


def run_query_df(conn, sql, desc=""):
    """Execute query and return a DataFrame."""
    cur = conn.cursor()
    try:
        cur.execute(sql)
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description] if cur.description else []
        return pd.DataFrame(rows, columns=cols)
    except Exception as e:
        print(f"  [WARN] Query failed ({desc}): {e}", file=sys.stderr)
        return pd.DataFrame()


# ─── Per-table analysis ──────────────────────────────────────────────────────

def get_table_columns(conn, table):
    """Return list of (column_name, data_type, ordinal_position)."""
    sql = f"""
    SELECT column_name, data_type, ordinal_position
    FROM information_schema.columns
    WHERE table_schema = '{SCHEMA}' AND table_name = '{table}'
    ORDER BY ordinal_position
    """
    rows = run_query(conn, sql, f"columns for {table}")
    return rows or []


def get_row_count(conn, table):
    sql = f"SELECT COUNT(*) FROM {table}"
    rows = run_query(conn, sql, f"row count {table}")
    return rows[0][0] if rows else "ERROR"


def get_null_analysis(conn, table, columns):
    """Return per-column null counts and percentages."""
    total_sql = f"SELECT COUNT(*) FROM {table}"
    total = run_query(conn, total_sql, f"total {table}")
    if not total:
        return {}
    total_count = total[0][0]
    if total_count == 0:
        return {}

    # Build a single query for all columns' null counts
    parts = []
    for col_name, _, _ in columns:
        safe = col_name.replace('"', '""')
        parts.append(f'SUM(CASE WHEN "{safe}" IS NULL THEN 1 ELSE 0 END) AS null_{col_name}')
    
    sql = f"SELECT {', '.join(parts)} FROM {table}"
    rows = run_query(conn, sql, f"nulls {table}")
    if not rows:
        return {}

    result = {}
    row = rows[0]
    for i, (col_name, dtype, _) in enumerate(columns):
        null_count = row[i]
        null_pct = round(100.0 * null_count / total_count, 2) if total_count > 0 else 0
        result[col_name] = {
            "data_type": dtype,
            "null_count": null_count,
            "null_pct": null_pct,
            "total": total_count,
        }
    return result


def get_date_range(conn, table, date_candidates=None):
    """Try common date columns for min/max."""
    if date_candidates is None:
        date_candidates = ["CREATE_TIME", "create_time", "UPDATE_TIME", "update_time",
                           "CREATED_AT", "created_at", "UPDATED_AT", "updated_at",
                           "create_dt", "CREATE_DT", "gmt_create", "GMT_CREATE"]
    
    # First, find which date columns exist
    cols_rows = get_table_columns(conn, table)
    col_names = [c[0].upper() for c in cols_rows]
    
    found_dates = []
    for candidate in date_candidates:
        if candidate.upper() in col_names:
            # find actual case
            for c in cols_rows:
                if c[0].upper() == candidate.upper():
                    found_dates.append((c[0], c[1]))
                    break

    if not found_dates:
        return {}

    # Query min/max for up to 3 date columns
    parts = []
    for col_name, dtype in found_dates[:3]:
        safe = col_name.replace('"', '""')
        parts.append(f'MIN("{safe}") AS min_{col_name}')
        parts.append(f'MAX("{safe}") AS max_{col_name}')

    sql = f"SELECT {', '.join(parts)} FROM {table}"
    rows = run_query(conn, sql, f"date range {table}")
    if not rows:
        return {}

    result = {}
    row = rows[0]
    for i, (col_name, dtype) in enumerate(found_dates[:3]):
        result[col_name] = {
            "data_type": dtype,
            "min": str(row[i * 2]) if row[i * 2] is not None else "NULL",
            "max": str(row[i * 2 + 1]) if row[i * 2 + 1] is not None else "NULL",
        }
    return result


def get_duplicate_analysis(conn, table, columns):
    """Check for full-row duplicates and duplicates on likely PK columns."""
    col_names = [c[0] for c in columns]
    total_sql = f"SELECT COUNT(*) FROM {table}"
    total = run_query(conn, total_sql, f"total {table}")
    if not total:
        return {}
    total_count = total[0][0]

    # Full row duplicates
    full_dup_sql = f"""
    SELECT COUNT(*) FROM (
        SELECT COUNT(*) AS cnt
        FROM {table}
        GROUP BY {', '.join(f'"{c}"' for c in col_names)}
        HAVING COUNT(*) > 1
    )
    """
    full_dup = run_query(conn, full_dup_sql, f"full dup {table}")
    full_dup_groups = full_dup[0][0] if full_dup else "ERROR"

    # Also try COUNT(*) - COUNT(DISTINCT *) approach
    distinct_sql = f"""
    SELECT COUNT(*) - COUNT(DISTINCT ({', '.join(f'CAST("{c}" AS VARCHAR)' for c in col_names)}))
    FROM {table}
    """
    distinct_rows = run_query(conn, distinct_sql, f"distinct diff {table}")
    extra_rows = distinct_rows[0][0] if distinct_rows else "ERROR"

    return {
        "total_rows": total_count,
        "duplicate_groups": full_dup_groups,
        "extra_duplicate_rows": extra_rows,
    }


def get_unique_sample(conn, table, column, limit=20):
    """Get distinct value count and sample values for a column."""
    safe = column.replace('"', '""')
    cnt_sql = f'SELECT COUNT(DISTINCT "{safe}") FROM {table}'
    cnt = run_query(conn, cnt_sql, f"unique {table}.{column}")
    unique_count = cnt[0][0] if cnt else "ERROR"

    sample_sql = f'SELECT DISTINCT "{safe}" FROM {table} LIMIT {limit}'
    sample = run_query(conn, sample_sql, f"sample {table}.{column}")
    sample_vals = [str(r[0]) for r in sample] if sample else []

    return {"unique_count": unique_count, "sample_values": sample_vals}


def check_referential_integrity(conn, table, fk_col="CUST_ID"):
    """Check if all fk_col values exist in stg_cust_customer_info.CUST_ID."""
    cols_rows = get_table_columns(conn, table)
    col_names_upper = [c[0].upper() for c in cols_rows]
    
    if fk_col.upper() not in col_names_upper:
        return {"has_fk": False}

    actual_col = None
    for c in cols_rows:
        if c[0].upper() == fk_col.upper():
            actual_col = c[0]
            break

    if actual_col is None:
        return {"has_fk": False}

    safe = actual_col.replace('"', '""')

    # Count orphan records (FK value not in parent)
    orphan_sql = f"""
    SELECT COUNT(*) FROM {table} t
    WHERE t."{safe}" IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM stg_cust_customer_info p
        WHERE p."CUST_ID" = t."{safe}"
    )
    """
    orphan = run_query(conn, orphan_sql, f"orphans {table}")
    orphan_count = orphan[0][0] if orphan else "ERROR"

    # Total non-null FK values
    total_fk_sql = f'SELECT COUNT(*) FROM {table} WHERE "{safe}" IS NOT NULL'
    total_fk = run_query(conn, total_fk_sql, f"total fk {table}")
    total_fk_count = total_fk[0][0] if total_fk else "ERROR"

    # Null FK values
    null_fk_sql = f'SELECT COUNT(*) FROM {table} WHERE "{safe}" IS NULL'
    null_fk = run_query(conn, null_fk_sql, f"null fk {table}")
    null_fk_count = null_fk[0][0] if null_fk else "ERROR"

    return {
        "has_fk": True,
        "fk_column": actual_col,
        "total_non_null_fk": total_fk_count,
        "null_fk": null_fk_count,
        "orphan_count": orphan_count,
        "orphan_pct": round(100.0 * orphan_count / total_fk_count, 2) if isinstance(total_fk_count, int) and total_fk_count > 0 else 0,
    }


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    conn = get_connection()
    report = {}
    table_summaries = []

    print("=" * 70)
    print("DEEP DATA CLEANING ANALYSIS & EDA — usr_skyee_mw.stg_* tables")
    print(f"Run at: {datetime.now().isoformat()}")
    print("=" * 70)

    for table in TABLES:
        print(f"\n{'─' * 70}")
        print(f"Analyzing: {table}")
        print(f"{'─' * 70}")
        
        t = {}

        # 1. Columns
        cols = get_table_columns(conn, table)
        t["columns"] = [(c[0], c[1]) for c in cols]
        t["column_count"] = len(cols)
        print(f"  Columns: {len(cols)}")

        # 2. Row count
        rc = get_row_count(conn, table)
        t["row_count"] = rc
        print(f"  Row count: {rc:,}" if isinstance(rc, int) else f"  Row count: {rc}")

        # 3. Null analysis
        null_info = get_null_analysis(conn, table, cols)
        t["null_analysis"] = null_info
        high_null = {k: v for k, v in null_info.items() if v["null_pct"] > 50}
        if high_null:
            print(f"  High-null columns (>50%): {list(high_null.keys())}")

        # 4. Date range
        dr = get_date_range(conn, table)
        t["date_ranges"] = dr
        for col_name, info in dr.items():
            print(f"  Date range [{col_name}]: {info['min']} → {info['max']}")

        # 5. Duplicate analysis
        dup = get_duplicate_analysis(conn, table, cols)
        t["duplicates"] = dup
        if dup.get("extra_duplicate_rows", 0) and isinstance(dup["extra_duplicate_rows"], int) and dup["extra_duplicate_rows"] > 0:
            print(f"  ⚠ Duplicate rows: {dup['extra_duplicate_rows']} extra rows")
        else:
            print(f"  Duplicate rows: 0 (clean)")

        # 6. Referential integrity
        ri = check_referential_integrity(conn, table)
        t["referential_integrity"] = ri
        if ri.get("has_fk"):
            print(f"  FK [{ri['fk_column']}]: {ri['total_non_null_fk']} non-null, {ri['orphan_count']} orphans ({ri['orphan_pct']}%)")

        # 7. Unique samples for key columns
        key_candidates = ["CUST_ID", "ID", "ORDER_NO", "ORDER_ID", "LOG_ID",
                          "BANK_ACCT_NO", "STORE_ID", "REALNAME_ID"]
        t["key_column_uniques"] = {}
        for kc in key_candidates:
            for col_name, dtype in t["columns"]:
                if col_name.upper() == kc.upper():
                    uniq = get_unique_sample(conn, table, col_name, limit=10)
                    t["key_column_uniques"][col_name] = uniq
                    print(f"  Unique [{col_name}]: {uniq['unique_count']}")
                    break

        report[table] = t
        table_summaries.append({
            "table": table,
            "rows": rc,
            "cols": len(cols),
            "dup_extra": dup.get("extra_duplicate_rows", "?"),
            "has_fk": ri.get("has_fk", False),
            "orphans": ri.get("orphan_count", "N/A"),
        })

    # ─── Cross-table relationship analysis ────────────────────────────────────
    print(f"\n{'=' * 70}")
    print("CROSS-TABLE RELATIONSHIP ANALYSIS")
    print(f"{'=' * 70}")

    # Find all tables that have CUST_ID
    cust_id_tables = []
    for table in TABLES:
        cols = report[table]["columns"]
        col_upper = [c[0].upper() for c in cols]
        if "CUST_ID" in col_upper:
            cust_id_tables.append(table)
    
    print(f"\nTables with CUST_ID: {cust_id_tables}")

    # Cross-check: each stg_cust_* table's CUST_ID coverage vs customer_info
    cross_check = {}
    if "stg_cust_customer_info" in [t for t in TABLES]:
        main_count = report.get("stg_cust_customer_info", {}).get("row_count", 0)
        print(f"\nBase table (stg_cust_customer_info) row count: {main_count:,}")
        for table in cust_id_tables:
            if table == "stg_cust_customer_info":
                continue
            ri = report[table].get("referential_integrity", {})
            if ri.get("has_fk"):
                cross_check[table] = {
                    "total_fk": ri["total_non_null_fk"],
                    "orphans": ri["orphan_count"],
                    "orphan_pct": ri["orphan_pct"],
                }
                print(f"  {table}: {ri['total_non_null_fk']} refs, {ri['orphan_count']} orphans ({ri['orphan_pct']}%)")

    report["_cross_table"] = {
        "cust_id_tables": cust_id_tables,
        "cross_check": cross_check,
    }

    # ─── Generate markdown report ─────────────────────────────────────────────
    generate_markdown(report)

    print(f"\n{'=' * 70}")
    print("Analysis complete. Report saved to docs/data-lineage.md")
    print(f"{'=' * 70}")


def generate_markdown(report):
    """Generate a well-structured markdown report."""
    lines = []
    lines.append("# Data Lineage & Quality Report — usr_skyee_mw.stg_* Tables")
    lines.append("")
    lines.append(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"**Presto Cluster:** {PRESTO_HOST}:{PRESTO_PORT}")
    lines.append(f"**Catalog/Schema:** {CATALOG}.{SCHEMA}")
    lines.append("")
    lines.append("---")
    lines.append("")

    # ── Table of Contents ──
    lines.append("## Table of Contents")
    lines.append("")
    lines.append("1. [Executive Summary](#1-executive-summary)")
    lines.append("2. [Table Overview](#2-table-overview)")
    lines.append("3. [Detailed Table Analysis](#3-detailed-table-analysis)")
    lines.append("4. [Null Analysis Summary](#4-null-analysis-summary)")
    lines.append("5. [Duplicate Analysis](#5-duplicate-analysis)")
    lines.append("6. [Referential Integrity](#6-referential-integrity)")
    lines.append("7. [Date Range Coverage](#7-date-range-coverage)")
    lines.append("8. [Cross-Table Relationships](#8-cross-table-relationships)")
    lines.append("9. [Data Lineage: MySQL → Hudi](#9-data-lineage-mysql--hudi)")
    lines.append("10. [Data Quality Issues & Recommendations](#10-data-quality-issues--recommendations)")
    lines.append("")
    lines.append("---")
    lines.append("")

    # ── Executive Summary ──
    lines.append("## 1. Executive Summary")
    lines.append("")
    total_rows = 0
    tables_with_orphans = 0
    tables_with_dupes = 0
    high_null_cols = 0
    
    for table in TABLES:
        t = report[table]
        rc = t.get("row_count", 0)
        if isinstance(rc, int):
            total_rows += rc
        ri = t.get("referential_integrity", {})
        if ri.get("orphan_count", 0) and isinstance(ri.get("orphan_count"), int) and ri["orphan_count"] > 0:
            tables_with_orphans += 1
        dup = t.get("duplicates", {})
        if isinstance(dup.get("extra_duplicate_rows"), int) and dup["extra_duplicate_rows"] > 0:
            tables_with_dupes += 1
        for col, info in t.get("null_analysis", {}).items():
            if info["null_pct"] > 50:
                high_null_cols += 1

    lines.append(f"| Metric | Value |")
    lines.append(f"|--------|-------|")
    lines.append(f"| Total Tables Analyzed | {len(TABLES)} |")
    lines.append(f"| Total Rows (all tables) | {total_rows:,} |")
    lines.append(f"| Tables with CUST_ID FK | {len(report.get('_cross_table', {}).get('cust_id_tables', []))} |")
    lines.append(f"| Tables with Orphan Records | {tables_with_orphans} |")
    lines.append(f"| Tables with Duplicate Rows | {tables_with_dupes} |")
    lines.append(f"| Columns with >50% Nulls | {high_null_cols} |")
    lines.append("")

    # ── Table Overview ──
    lines.append("## 2. Table Overview")
    lines.append("")
    lines.append("| Table | Rows | Columns | Duplicates | Has CUST_ID | Orphans |")
    lines.append("|-------|------|---------|------------|-------------|---------|")
    for table in TABLES:
        t = report[table]
        rc = t.get("row_count", "?")
        rc_str = f"{rc:,}" if isinstance(rc, int) else str(rc)
        cc = t.get("column_count", "?")
        dup = t.get("duplicates", {}).get("extra_duplicate_rows", "?")
        dup_str = f"{dup:,}" if isinstance(dup, int) else str(dup)
        ri = t.get("referential_integrity", {})
        has_fk = "Yes" if ri.get("has_fk") else "No"
        orphans = ri.get("orphan_count", "N/A")
        orph_str = f"{orphans:,}" if isinstance(orphans, int) else str(orphans)
        lines.append(f"| `{table}` | {rc_str} | {cc} | {dup_str} | {has_fk} | {orph_str} |")
    lines.append("")

    # ── Detailed Table Analysis ──
    lines.append("## 3. Detailed Table Analysis")
    lines.append("")
    for table in TABLES:
        t = report[table]
        lines.append(f"### 3.{TABLES.index(table)+1} `{table}`")
        lines.append("")
        rc = t.get("row_count", "?")
        lines.append(f"- **Row count:** {rc:,}" if isinstance(rc, int) else f"- **Row count:** {rc}")
        lines.append(f"- **Column count:** {t.get('column_count', '?')}")
        lines.append("")
        
        # Column list
        lines.append("**Columns:**")
        lines.append("")
        lines.append("| # | Column | Data Type | Null % |")
        lines.append("|---|--------|-----------|--------|")
        for i, (col_name, dtype) in enumerate(t.get("columns", []), 1):
            null_pct = t.get("null_analysis", {}).get(col_name, {}).get("null_pct", "?")
            null_str = f"{null_pct}%" if isinstance(null_pct, (int, float)) else str(null_pct)
            lines.append(f"| {i} | `{col_name}` | {dtype} | {null_str} |")
        lines.append("")

        # Key column uniqueness
        if t.get("key_column_uniques"):
            lines.append("**Key Column Uniqueness:**")
            lines.append("")
            for col, info in t["key_column_uniques"].items():
                lines.append(f"- `{col}`: {info['unique_count']:,} unique values" if isinstance(info['unique_count'], int) else f"- `{col}`: {info['unique_count']} unique values")
                if info.get("sample_values"):
                    sample_str = ", ".join(f"`{v}`" for v in info["sample_values"][:5])
                    lines.append(f"  - Sample: {sample_str}")
            lines.append("")

        # Date ranges
        if t.get("date_ranges"):
            lines.append("**Date Ranges:**")
            lines.append("")
            for col, info in t["date_ranges"].items():
                lines.append(f"- `{col}` ({info['data_type']}): {info['min']} → {info['max']}")
            lines.append("")

        # Duplicates
        dup = t.get("duplicates", {})
        if dup:
            lines.append("**Duplicate Analysis:**")
            lines.append("")
            lines.append(f"- Total rows: {dup.get('total_rows', '?'):,}" if isinstance(dup.get('total_rows'), int) else f"- Total rows: {dup.get('total_rows', '?')}")
            extra = dup.get("extra_duplicate_rows", 0)
            lines.append(f"- Extra duplicate rows: {extra:,}" if isinstance(extra, int) else f"- Extra duplicate rows: {extra}")
            if isinstance(extra, int) and extra > 0:
                lines.append(f"- **WARNING: {extra} duplicate rows detected**")
            lines.append("")

        # Referential integrity
        ri = t.get("referential_integrity", {})
        if ri.get("has_fk"):
            lines.append("**Referential Integrity (→ stg_cust_customer_info.CUST_ID):**")
            lines.append("")
            lines.append(f"- FK column: `{ri['fk_column']}`")
            lines.append(f"- Non-null FK values: {ri['total_non_null_fk']:,}" if isinstance(ri['total_non_null_fk'], int) else f"- Non-null FK values: {ri['total_non_null_fk']}")
            lines.append(f"- Null FK values: {ri['null_fk']:,}" if isinstance(ri['null_fk'], int) else f"- Null FK values: {ri['null_fk']}")
            lines.append(f"- Orphan records: {ri['orphan_count']:,} ({ri['orphan_pct']}%)" if isinstance(ri['orphan_count'], int) else f"- Orphan records: {ri['orphan_count']}")
            if isinstance(ri['orphan_count'], int) and ri['orphan_count'] > 0:
                lines.append(f"- **WARNING: {ri['orphan_count']:,} orphan records found**")
            lines.append("")

        lines.append("---")
        lines.append("")

    # ── Null Analysis Summary ──
    lines.append("## 4. Null Analysis Summary")
    lines.append("")
    lines.append("Columns with >30% null values across all tables:")
    lines.append("")
    lines.append("| Table | Column | Data Type | Null % | Null Count | Total |")
    lines.append("|-------|--------|-----------|--------|------------|-------|")
    for table in TABLES:
        t = report[table]
        for col, info in t.get("null_analysis", {}).items():
            if info["null_pct"] > 30:
                lines.append(f"| `{table}` | `{col}` | {info['data_type']} | {info['null_pct']}% | {info['null_count']:,} | {info['total']:,} |")
    lines.append("")

    # ── Duplicate Analysis ──
    lines.append("## 5. Duplicate Analysis")
    lines.append("")
    lines.append("| Table | Total Rows | Duplicate Extra Rows | Status |")
    lines.append("|-------|------------|---------------------|--------|")
    for table in TABLES:
        t = report[table]
        dup = t.get("duplicates", {})
        total = dup.get("total_rows", "?")
        extra = dup.get("extra_duplicate_rows", "?")
        total_str = f"{total:,}" if isinstance(total, int) else str(total)
        extra_str = f"{extra:,}" if isinstance(extra, int) else str(extra)
        status = "CLEAN" if (isinstance(extra, int) and extra == 0) else ("DUPLICATES FOUND" if isinstance(extra, int) else "UNKNOWN")
        emoji = "✅" if status == "CLEAN" else "⚠️"
        lines.append(f"| `{table}` | {total_str} | {extra_str} | {emoji} {status} |")
    lines.append("")

    # ── Referential Integrity ──
    lines.append("## 6. Referential Integrity")
    lines.append("")
    lines.append("All tables linking to `stg_cust_customer_info.CUST_ID`:")
    lines.append("")
    lines.append("| Table | FK Column | Non-Null FK | Null FK | Orphans | Orphan % | Status |")
    lines.append("|-------|-----------|------------|---------|---------|----------|--------|")
    for table in TABLES:
        t = report[table]
        ri = t.get("referential_integrity", {})
        if ri.get("has_fk"):
            nn = ri['total_non_null_fk']
            nk = ri['null_fk']
            oc = ri['orphan_count']
            op = ri['orphan_pct']
            nn_str = f"{nn:,}" if isinstance(nn, int) else str(nn)
            nk_str = f"{nk:,}" if isinstance(nk, int) else str(nk)
            oc_str = f"{oc:,}" if isinstance(oc, int) else str(oc)
            status = "CLEAN" if (isinstance(oc, int) and oc == 0) else "ORPHANS FOUND"
            emoji = "✅" if status == "CLEAN" else "❌"
            lines.append(f"| `{table}` | `{ri['fk_column']}` | {nn_str} | {nk_str} | {oc_str} | {op}% | {emoji} {status} |")
    lines.append("")
    lines.append("Tables without CUST_ID (standalone or different FK):")
    lines.append("")
    for table in TABLES:
        t = report[table]
        ri = t.get("referential_integrity", {})
        if not ri.get("has_fk"):
            lines.append(f"- `{table}`")
    lines.append("")

    # ── Date Range Coverage ──
    lines.append("## 7. Date Range Coverage")
    lines.append("")
    lines.append("| Table | Date Column | Min | Max | Data Type |")
    lines.append("|-------|------------|-----|-----|-----------|")
    for table in TABLES:
        t = report[table]
        for col, info in t.get("date_ranges", {}).items():
            lines.append(f"| `{table}` | `{col}` | {info['min']} | {info['max']} | {info['data_type']} |")
    lines.append("")

    # ── Cross-Table Relationships ──
    lines.append("## 8. Cross-Table Relationships")
    lines.append("")
    lines.append("### Entity-Relationship Diagram (Text)")
    lines.append("")
    lines.append("```")
    lines.append("stg_cust_customer_info (CUST_ID) [BASE TABLE]")
    lines.append("    │")
    lines.append("    ├── stg_cust_bank_acct_info (CUST_ID)")
    lines.append("    ├── stg_cust_collections_acct (CUST_ID)")
    lines.append("    ├── stg_cust_enterprise_realname_info (CUST_ID)")
    lines.append("    ├── stg_cust_foreign_trade_order (CUST_ID)")
    lines.append("    ├── stg_cust_person_realname_info (CUST_ID)")
    lines.append("    ├── stg_cust_store_info (CUST_ID)")
    lines.append("    ├── stg_cust_user_login_log (CUST_ID)")
    lines.append("    ├── stg_pmp_coll_order (CUST_ID)")
    lines.append("    ├── stg_pmp_pay_details (CUST_ID)")
    lines.append("    ├── stg_pmp_pay_order (CUST_ID)")
    lines.append("    │")
    lines.append("    ├── stg_cust_foreign_trade_order_logistics (ORDER_NO → stg_cust_foreign_trade_order)")
    lines.append("    └── stg_cust_realname_enterprise_ref_person (REALNAME_ID → stg_cust_enterprise_realname_info)")
    lines.append("```")
    lines.append("")

    cross = report.get("_cross_table", {})
    if cross.get("cross_check"):
        lines.append("### CUST_ID Coverage Detail")
        lines.append("")
        lines.append("How well does each table's CUST_ID population cover the base table?")
        lines.append("")
        base_count = report.get("stg_cust_customer_info", {}).get("row_count", 0)
        lines.append(f"- **Base table rows:** {base_count:,}")
        lines.append("")
        for table, info in cross["cross_check"].items():
            coverage = round(100.0 * info["total_fk"] / base_count, 2) if isinstance(base_count, int) and base_count > 0 else "?"
            lines.append(f"- `{table}`: {info['total_fk']:,} CUST_ID refs ({coverage}% of base), {info['orphans']:,} orphans")
        lines.append("")

    # ── Data Lineage ──
    lines.append("## 9. Data Lineage: MySQL → Hudi")
    lines.append("")
    lines.append("### Source System Assumption")
    lines.append("")
    lines.append("The `stg_*` prefix indicates these are **staging tables** ingested from an upstream MySQL OLTP database into Hudi (Hive-backed) via a CDC or batch ETL pipeline.")
    lines.append("")
    lines.append("### Inferred Lineage")
    lines.append("")
    lines.append("```")
    lines.append("┌─────────────────────────────────────────────────────────────────┐")
    lines.append("│                    SOURCE: MySQL OLTP                           │")
    lines.append("│                                                                 │")
    lines.append("│  database: skyee_cust (or similar)                              │")
    lines.append("│  tables: customer_info, bank_acct_info, collections_acct, ...   │")
    lines.append("│                                                                 │")
    lines.append("└───────────────────────────────┬─────────────────────────────────┘")
    lines.append("                                │")
    lines.append("                     ETL / CDC Pipeline")
    lines.append("                     (Spark / Flink / Airflow)")
    lines.append("                                │")
    lines.append("                                ▼")
    lines.append("┌─────────────────────────────────────────────────────────────────┐")
    lines.append("│                    STAGING: Hudi on Hive                        │")
    lines.append("│                                                                 │")
    lines.append("│  catalog: hive                                                  │")
    lines.append("│  schema:  usr_skyee_mw                                          │")
    lines.append("│  tables:  stg_cust_* (customer domain)                         │")
    lines.append("│           stg_pmp_* (payment domain)                           │")
    lines.append("│                                                                 │")
    lines.append("└───────────────────────────────┬─────────────────────────────────┘")
    lines.append("                                │")
    lines.append("                     Downstream Consumers")
    lines.append("                                │")
    lines.append("                ┌───────────────┼───────────────┐")
    lines.append("                ▼               ▼               ▼")
    lines.append("        Risk Models     Reporting/BI     Analytics")
    lines.append("```")
    lines.append("")

    lines.append("### Table Naming Convention")
    lines.append("")
    lines.append("| Prefix | Domain | Source DB (inferred) | Description |")
    lines.append("|--------|--------|---------------------|-------------|")
    lines.append("| `stg_cust_` | Customer | skyee_cust | Customer master, KYC, stores, logins |")
    lines.append("| `stg_pmp_` | Payment | skyee_pmp (or pmp) | Payment orders, collections, pay details |")
    lines.append("")

    lines.append("### Table-by-Table Lineage")
    lines.append("")
    for table in TABLES:
        t = report[table]
        rc = t.get("row_count", "?")
        rc_str = f"{rc:,}" if isinstance(rc, int) else str(rc)
        domain = "Customer" if table.startswith("stg_cust_") else "Payment"
        lines.append(f"#### `{table}`")
        lines.append(f"- **Domain:** {domain}")
        lines.append(f"- **Rows:** {rc_str}")
        lines.append(f"- **Columns:** {t.get('column_count', '?')}")
        ri = t.get("referential_integrity", {})
        if ri.get("has_fk"):
            lines.append(f"- **FK:** `{ri['fk_column']}` → `stg_cust_customer_info.CUST_ID`")
        lines.append(f"- **Source:** MySQL `{table.replace('stg_', '')}` table (inferred)")
        lines.append("")

    # ── Data Quality Issues ──
    lines.append("## 10. Data Quality Issues & Recommendations")
    lines.append("")
    lines.append("### Issues Found")
    lines.append("")

    issue_num = 1
    for table in TABLES:
        t = report[table]
        
        # Check for orphans
        ri = t.get("referential_integrity", {})
        if ri.get("has_fk") and isinstance(ri.get("orphan_count"), int) and ri["orphan_count"] > 0:
            lines.append(f"**{issue_num}. Orphan Records in `{table}`**")
            lines.append(f"- {ri['orphan_count']:,} records have `{ri['fk_column']}` values not found in `stg_cust_customer_info.CUST_ID`")
            lines.append(f"- This indicates either: (a) deleted customers, (b) incomplete sync, or (c) data quality issue in source")
            lines.append(f"- **Recommendation:** Investigate source MySQL for missing customer records or soft-delete flags")
            lines.append("")
            issue_num += 1

        # Check for duplicates
        dup = t.get("duplicates", {})
        if isinstance(dup.get("extra_duplicate_rows"), int) and dup["extra_duplicate_rows"] > 0:
            lines.append(f"**{issue_num}. Duplicate Rows in `{table}`**")
            lines.append(f"- {dup['extra_duplicate_rows']:,} extra duplicate rows detected")
            lines.append(f"- This likely indicates: (a) CDC replay issues, (b) missing unique constraint, or (c) ETL idempotency problem")
            lines.append(f"- **Recommendation:** Add dedup logic in ETL or ensure Hudi upsert keys are correctly configured")
            lines.append("")
            issue_num += 1

        # Check for high-null columns
        high_null = {k: v for k, v in t.get("null_analysis", {}).items() if v["null_pct"] > 80}
        if high_null:
            lines.append(f"**{issue_num}. High Null Columns in `{table}`**")
            lines.append("- Columns with >80% nulls:")
            for col, info in high_null.items():
                lines.append(f"  - `{col}`: {info['null_pct']}% null ({info['null_count']:,}/{info['total']:,})")
            lines.append(f"- **Recommendation:** Verify if these are legitimately optional fields or indicate missing data upstream")
            lines.append("")
            issue_num += 1

    if issue_num == 1:
        lines.append("No critical data quality issues found. All tables appear clean.")
        lines.append("")

    lines.append("### General Recommendations")
    lines.append("")
    lines.append("1. **CDC Monitoring:** Set up alerts for CDC lag between MySQL source and Hudi staging")
    lines.append("2. **Row Count Reconciliation:** Daily reconciliation of row counts between MySQL source and Hudi staging")
    lines.append("3. **Null Budget:** Define acceptable null percentages per column and alert when exceeded")
    lines.append("4. **Duplicate Detection:** Add dedup checks in the ETL pipeline, especially for incremental loads")
    lines.append("5. **FK Integrity Checks:** Run orphan detection queries as part of post-ETL validation")
    lines.append("6. **Schema Drift Detection:** Monitor for column additions/removals in MySQL that aren't reflected in Hudi")
    lines.append("7. **Data Freshness SLA:** Define and monitor maximum acceptable lag for each table")
    lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("*Report generated by automated EDA pipeline*")

    # Write to file
    output_path = "/Users/exoulster/projects/skyee-ai-risk/docs/data-lineage.md"
    with open(output_path, "w") as f:
        f.write("\n".join(lines))
    
    print(f"\nMarkdown report written to: {output_path}")


if __name__ == "__main__":
    main()
