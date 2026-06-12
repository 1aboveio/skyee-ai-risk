"""
Data quality check script for usr_skyee_mw stg_* tables.
Runs against Presto/Hive to validate backfilled data.

Usage:
    python data_quality_check.py [--start-date YYYY-MM-DD] [--end-date YYYY-MM-DD] [--tables table1,table2,...]

Examples:
    # Check all tables for 2024
    python data_quality_check.py --start-date 2024-01-01 --end-date 2025-01-01

    # Check specific tables
    python data_quality_check.py --tables stg_pmp_coll_order,stg_cust_customer_info
"""

import sys
import os
from datetime import datetime, timedelta
from typing import Optional
import json

from pyspark.sql import SparkSession
from typing_extensions import Annotated
import typer

# Table registry with key columns
TABLE_REGISTRY = {
    "stg_cust_customer_info": {
        "key": "CUST_ID",
        "ts": "LST_UPD_TIME",
        "filter": "CREATE_TIME",
        "parent": None,
        "fk_column": None,
    },
    "stg_cust_bank_acct_info": {
        "key": "ID",
        "ts": "LST_UPD_TIME",
        "filter": "CREATE_TIME",
        "parent": "stg_cust_customer_info",
        "fk_column": "CUST_ID",
    },
    "stg_cust_collections_acct": {
        "key": "ID",
        "ts": "LST_UPD_TIME",
        "filter": "CREATE_TIME",
        "parent": "stg_cust_customer_info",
        "fk_column": "CUST_ID",
    },
    "stg_cust_enterprise_realname_info": {
        "key": "ID",
        "ts": "LST_UPD_TIME",
        "filter": "CREATE_TIME",
        "parent": "stg_cust_customer_info",
        "fk_column": "CUST_ID",
    },
    "stg_cust_foreign_trade_order": {
        "key": "ID",
        "ts": "LST_UPD_TIME",
        "filter": "CREATE_TIME",
        "parent": "stg_cust_customer_info",
        "fk_column": "CUST_ID",
    },
    "stg_cust_foreign_trade_order_logistics": {
        "key": "ID",
        "ts": "LST_UPD_TIME",
        "filter": "CREATE_TIME",
        "parent": "stg_cust_customer_info",
        "fk_column": "CUST_ID",
    },
    "stg_cust_person_realname_info": {
        "key": "ID",
        "ts": "LST_UPD_TIME",
        "filter": "CREATE_TIME",
        "parent": "stg_cust_customer_info",
        "fk_column": "CUST_ID",
    },
    "stg_cust_realname_enterprise_ref_person": {
        "key": "ID",
        "ts": "LST_UPD_TIME",
        "filter": "CREATE_TIME",
        "parent": "stg_cust_customer_info",
        "fk_column": "CUST_ID",
    },
    "stg_cust_store_info": {
        "key": "ID",
        "ts": "LST_UPD_TIME",
        "filter": "CREATE_TIME",
        "parent": "stg_cust_customer_info",
        "fk_column": "CUST_ID",
    },
    "stg_cust_user_login_log": {
        "key": "ID",
        "ts": "LST_UPD_TIME",
        "filter": "CREATE_TIME",
        "parent": "stg_cust_customer_info",
        "fk_column": "CUST_ID",
    },
    "stg_pmp_coll_order": {
        "key": "COLL_ORDER_ID",
        "ts": "LST_UPD_TIME",
        "filter": "CREATE_TIME",
        "parent": "stg_cust_customer_info",
        "fk_column": "CUST_ID",
    },
    "stg_pmp_pay_details": {
        "key": "ID",
        "ts": "LST_UPD_TIME",
        "filter": "CREATE_TIME",
        "parent": "stg_pmp_pay_order",
        "fk_column": "PAY_ORDER_ID",
    },
    "stg_pmp_pay_order": {
        "key": "PAY_ORDER_ID",
        "ts": "LST_UPD_TIME",
        "filter": "CREATE_TIME",
        "parent": "stg_cust_customer_info",
        "fk_column": "CUST_ID",
    },
}


def run_query(spark: SparkSession, query: str) -> list:
    """Run a SQL query and return results as list of rows."""
    return spark.sql(query).collect()


def check_row_count(spark: SparkSession, table: str, start_date: str, end_date: str) -> dict:
    """Check row count for a table in the given date range."""
    query = f"""
    SELECT COUNT(*) as total_rows
    FROM usr_skyee_mw.{table}
    WHERE dt >= '{start_date}' AND dt < '{end_date}'
    """
    result = run_query(spark, query)
    return {"total_rows": result[0]["total_rows"] if result else 0}


def check_partition_coverage(spark: SparkSession, table: str, start_date: str, end_date: str) -> dict:
    """Check which partitions (dates) exist and which are missing."""
    query = f"""
    SELECT dt, COUNT(*) as row_count
    FROM usr_skyee_mw.{table}
    WHERE dt >= '{start_date}' AND dt < '{end_date}'
    GROUP BY dt
    ORDER BY dt
    """
    result = run_query(spark, query)
    
    existing_dates = {str(row["dt"]) for row in result}
    date_counts = {str(row["dt"]): row["row_count"] for row in result}
    
    # Generate expected dates
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    expected_dates = set()
    current = start
    while current < end:
        expected_dates.add(current.strftime("%Y-%m-%d"))
        current += timedelta(days=1)
    
    missing_dates = sorted(expected_dates - existing_dates)
    
    return {
        "existing_partitions": len(existing_dates),
        "expected_partitions": len(expected_dates),
        "missing_count": len(missing_dates),
        "missing_dates": missing_dates[:10],  # First 10 missing
        "partition_counts": date_counts,
    }


def check_nulls(spark: SparkSession, table: str, columns: list, start_date: str, end_date: str) -> dict:
    """Check null percentages for key columns."""
    if not columns:
        return {}
    
    null_checks = ", ".join([
        f"SUM(CASE WHEN {col} IS NULL THEN 1 ELSE 0 END) as null_{col}"
        for col in columns
    ])
    
    query = f"""
    SELECT 
        COUNT(*) as total,
        {null_checks}
    FROM usr_skyee_mw.{table}
    WHERE dt >= '{start_date}' AND dt < '{end_date}'
    """
    result = run_query(spark, query)
    
    if not result:
        return {}
    
    row = result[0]
    total = row["total"]
    
    null_stats = {}
    for col in columns:
        null_count = row[f"null_{col}"]
        null_pct = (null_count / total * 100) if total > 0 else 0
        null_stats[col] = {
            "null_count": null_count,
            "null_pct": round(null_pct, 2),
        }
    
    return null_stats


def check_duplicates(spark: SparkSession, table: str, key_col: str, start_date: str, end_date: str) -> dict:
    """Check for duplicate key values."""
    query = f"""
    SELECT 
        COUNT(*) as total_rows,
        COUNT(DISTINCT {key_col}) as distinct_keys,
        COUNT(*) - COUNT(DISTINCT {key_col}) as duplicate_count
    FROM usr_skyee_mw.{table}
    WHERE dt >= '{start_date}' AND dt < '{end_date}'
    """
    result = run_query(spark, query)
    
    if not result:
        return {}
    
    row = result[0]
    total = row["total_rows"]
    distinct = row["distinct_keys"]
    duplicates = row["duplicate_count"]
    
    return {
        "total_rows": total,
        "distinct_keys": distinct,
        "duplicate_count": duplicates,
        "duplicate_pct": round(duplicates / total * 100, 2) if total > 0 else 0,
    }


def check_referential_integrity(
    spark: SparkSession,
    child_table: str,
    parent_table: str,
    fk_column: str,
    start_date: str,
    end_date: str,
) -> dict:
    """Check for orphan records (FK values not in parent table)."""
    query = f"""
    SELECT 
        COUNT(*) as total_child,
        SUM(CASE WHEN p.{fk_column} IS NULL THEN 1 ELSE 0 END) as orphan_count
    FROM usr_skyee_mw.{child_table} c
    LEFT JOIN (
        SELECT DISTINCT {fk_column}
        FROM usr_skyee_mw.{parent_table}
        WHERE dt >= '{start_date}' AND dt < '{end_date}'
    ) p ON c.{fk_column} = p.{fk_column}
    WHERE c.dt >= '{start_date}' AND c.dt < '{end_date}'
      AND c.{fk_column} IS NOT NULL
    """
    result = run_query(spark, query)
    
    if not result:
        return {}
    
    row = result[0]
    total = row["total_child"]
    orphans = row["orphan_count"]
    
    return {
        "total_records": total,
        "orphan_count": orphans,
        "orphan_pct": round(orphans / total * 100, 2) if total > 0 else 0,
        "parent_table": parent_table,
        "fk_column": fk_column,
    }


def check_date_range(spark: SparkSession, table: str, start_date: str, end_date: str) -> dict:
    """Check min/max dates for key timestamp columns."""
    query = f"""
    SELECT 
        MIN(CREATE_TIME) as min_create_time,
        MAX(CREATE_TIME) as max_create_time,
        MIN(LST_UPD_TIME) as min_update_time,
        MAX(LST_UPD_TIME) as max_update_time
    FROM usr_skyee_mw.{table}
    WHERE dt >= '{start_date}' AND dt < '{end_date}'
    """
    result = run_query(spark, query)
    
    if not result:
        return {}
    
    row = result[0]
    return {
        "create_time_range": {
            "min": str(row["min_create_time"]),
            "max": str(row["max_create_time"]),
        },
        "update_time_range": {
            "min": str(row["min_update_time"]),
            "max": str(row["max_update_time"]),
        },
    }


def run_table_checks(
    spark: SparkSession,
    table: str,
    config: dict,
    start_date: str,
    end_date: str,
) -> dict:
    """Run all quality checks for a single table."""
    print(f"\n  Checking {table}...", end="", flush=True)
    
    results = {
        "table": table,
        "date_range": f"{start_date} to {end_date}",
    }
    
    # 1. Row count
    row_count = check_row_count(spark, table, start_date, end_date)
    results["row_count"] = row_count["total_rows"]
    
    # 2. Partition coverage
    partitions = check_partition_coverage(spark, table, start_date, end_date)
    results["partitions"] = partitions
    
    # 3. Null analysis for key columns
    key_columns = [config["key"]]
    if config.get("fk_column"):
        key_columns.append(config["fk_column"])
    nulls = check_nulls(spark, table, key_columns, start_date, end_date)
    results["nulls"] = nulls
    
    # 4. Duplicate check on primary key
    duplicates = check_duplicates(spark, table, config["key"], start_date, end_date)
    results["duplicates"] = duplicates
    
    # 5. Referential integrity (if has parent)
    if config.get("parent") and config.get("fk_column"):
        ref_integrity = check_referential_integrity(
            spark, table, config["parent"], config["fk_column"], start_date, end_date
        )
        results["referential_integrity"] = ref_integrity
    
    # 6. Date range
    date_range = check_date_range(spark, table, start_date, end_date)
    results["date_range_info"] = date_range
    
    # Determine status
    issues = []
    if results["row_count"] == 0:
        issues.append("NO DATA")
    if partitions["missing_count"] > 0:
        issues.append(f"{partitions['missing_count']} MISSING PARTITIONS")
    if duplicates.get("duplicate_count", 0) > 0:
        issues.append(f"{duplicates['duplicate_count']} DUPLICATES")
    if ref_integrity := results.get("referential_integrity"):
        if ref_integrity.get("orphan_count", 0) > 0:
            issues.append(f"{ref_integrity['orphan_count']} ORPHANS")
    for col, stats in nulls.items():
        if stats["null_pct"] > 50:
            issues.append(f"{col} {stats['null_pct']}% NULL")
    
    results["status"] = "PASS" if not issues else "FAIL"
    results["issues"] = issues
    
    status_icon = "✓" if results["status"] == "PASS" else "✗"
    print(f" {status_icon} {results['row_count']:,} rows", end="")
    if issues:
        print(f" [{', '.join(issues)}]")
    else:
        print()
    
    return results


def print_summary(all_results: list):
    """Print summary table of all check results."""
    print(f"\n{'=' * 80}")
    print("Data Quality Summary")
    print(f"{'=' * 80}")
    print(f"{'Table':<45} {'Rows':>12} {'Status':>8} {'Issues'}")
    print(f"{'-' * 45} {'-' * 12} {'-' * 8} {'-' * 30}")
    
    total_pass = 0
    total_fail = 0
    
    for r in all_results:
        status = r["status"]
        if status == "PASS":
            total_pass += 1
        else:
            total_fail += 1
        
        issues_str = ", ".join(r["issues"]) if r["issues"] else "-"
        print(f"{r['table']:<45} {r['row_count']:>12,} {status:>8} {issues_str}")
    
    print(f"\n{'=' * 80}")
    print(f"Results: {total_pass} PASSED, {total_fail} FAILED out of {len(all_results)} tables")
    print(f"{'=' * 80}")
    
    # Print details for failed tables
    failed = [r for r in all_results if r["status"] == "FAIL"]
    if failed:
        print(f"\n{'=' * 80}")
        print("Failed Table Details")
        print(f"{'=' * 80}")
        
        for r in failed:
            print(f"\n--- {r['table']} ---")
            print(f"  Rows: {r['row_count']:,}")
            print(f"  Partitions: {r['partitions']['existing_partitions']}/{r['partitions']['expected_partitions']} "
                  f"(missing: {r['partitions']['missing_count']})")
            if r['partitions']['missing_dates']:
                print(f"    First missing: {', '.join(r['partitions']['missing_dates'][:5])}")
            
            if dups := r.get('duplicates'):
                if dups.get('duplicate_count', 0) > 0:
                    print(f"  Duplicates: {dups['duplicate_count']:,} ({dups['duplicate_pct']}%)")
            
            if ri := r.get('referential_integrity'):
                if ri.get('orphan_count', 0) > 0:
                    print(f"  Orphans: {ri['orphan_count']:,} ({ri['orphan_pct']}%) "
                          f"missing from {ri['parent_table']}.{ri['fk_column']}")
            
            for col, stats in r.get('nulls', {}).items():
                if stats['null_pct'] > 10:
                    print(f"  Nulls: {col} = {stats['null_count']:,} ({stats['null_pct']}%)")


def main(
    spark_remote: Annotated[str, typer.Option("--spark-remote")] = "sc://172.16.100.212:15002",
    start_date: Annotated[str, typer.Option("--start-date")] = "2024-01-01",
    end_date: Annotated[str, typer.Option("--end-date")] = "2025-01-01",
    tables: Annotated[str, typer.Option("--tables")] = None,
    output: Annotated[str, typer.Option("--output", "-o")] = None,
):
    """Run data quality checks on stg_* tables."""
    
    # Parse tables to check
    if tables:
        table_list = [t.strip() for t in tables.split(",")]
        for t in table_list:
            if t not in TABLE_REGISTRY:
                print(f"Error: Unknown table '{t}'. Available: {', '.join(TABLE_REGISTRY.keys())}")
                sys.exit(1)
    else:
        table_list = list(TABLE_REGISTRY.keys())
    
    print(f"{'=' * 80}")
    print("Data Quality Check")
    print(f"{'=' * 80}")
    print(f"Spark: {spark_remote}")
    print(f"Date range: {start_date} to {end_date}")
    print(f"Tables: {len(table_list)}")
    print(f"{'=' * 80}")
    
    # Initialize Spark session
    spark = SparkSession.builder.remote(spark_remote).getOrCreate()
    
    all_results = []
    start_time = datetime.now()
    
    for table in table_list:
        config = TABLE_REGISTRY[table]
        result = run_table_checks(spark, table, config, start_date, end_date)
        all_results.append(result)
    
    total_duration = (datetime.now() - start_time).total_seconds()
    
    print_summary(all_results)
    print(f"\nTotal check duration: {total_duration:.1f}s")
    
    # Save results to JSON if output specified
    if output:
        with open(output, "w") as f:
            json.dump(all_results, f, indent=2, default=str)
        print(f"Results saved to: {output}")
    
    # Return exit code based on results
    failed_count = sum(1 for r in all_results if r["status"] == "FAIL")
    sys.exit(1 if failed_count > 0 else 0)


if __name__ == "__main__":
    typer.run(main)
