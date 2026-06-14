"""
Backfill script for usr_skyee_mw tables. 
- Large tables (pmp_coll_order): processed monthly
- Other tables: processed yearly

Usage:
    python backfill.py --url <mysql_jdbc_url> --spark-remote <spark_connect_url> --start-date <YYYY-MM-DD> --end-date <YYYY-MM-DD> [--tables <table1,table2,...>]

Examples:
    # Backfill all tables for 2024
    python backfill.py --url "jdbc:mysql://..." --spark-remote "sc://..." --start-date 2024-01-01 --end-date 2025-01-01

    # Backfill specific tables
    python backfill.py --url "jdbc:mysql://..." --spark-remote "sc://..." --start-date 2024-01-01 --end-date 2025-01-01 --tables cust_customer_info,pmp_coll_order
"""

import sys
import os
from datetime import datetime
from dateutil.relativedelta import relativedelta
import calendar

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'dags', 'usr_skyee_mw', 'python'))

from pyspark.sql import SparkSession
from typing_extensions import Annotated
import typer

# Import all ETL classes
from stg_cust_customer_info import StgCustCustomerInfoEtl
from stg_cust_bank_acct_info import StgCustBankAcctInfoEtl
from stg_cust_collections_acct import StgCustCollectionsAcctEtl
from stg_cust_enterprise_realname_info import StgCustEnterpriseRealnameInfoEtl
from stg_cust_foreign_trade_order import StgCustForeignTradeOrderEtl
from stg_cust_foreign_trade_order_logistics import StgCustForeignTradeOrderLogisticsEtl
from stg_cust_person_realname_info import StgCustPersonRealnameInfoEtl
from stg_cust_realname_enterprise_ref_person import StgCustRealnameEnterpriseRefPersonEtl
from stg_cust_store_info import StgCustStoreInfoEtl
from stg_cust_user_login_log import StgCustUserLoginLogEtl
from stg_pmp_coll_order import StgPmpCollOrderEtl
from stg_pmp_pay_details import StgPmpPayDetailsEtl
from stg_pmp_pay_order import StgPmpPayOrderEtl

# Table registry
TABLE_REGISTRY = {
    "cust_customer_info": StgCustCustomerInfoEtl,
    "cust_bank_acct_info": StgCustBankAcctInfoEtl,
    "cust_collections_acct": StgCustCollectionsAcctEtl,
    "cust_enterprise_realname_info": StgCustEnterpriseRealnameInfoEtl,
    "cust_foreign_trade_order": StgCustForeignTradeOrderEtl,
    "cust_foreign_trade_order_logistics": StgCustForeignTradeOrderLogisticsEtl,
    "cust_person_realname_info": StgCustPersonRealnameInfoEtl,
    "cust_realname_enterprise_ref_person": StgCustRealnameEnterpriseRefPersonEtl,
    "cust_store_info": StgCustStoreInfoEtl,
    "cust_user_login_log": StgCustUserLoginLogEtl,
    "pmp_coll_order": StgPmpCollOrderEtl,
    "pmp_pay_details": StgPmpPayDetailsEtl,
    "pmp_pay_order": StgPmpPayOrderEtl,
}

# Large tables that need monthly processing
LARGE_TABLES = {"pmp_coll_order", "cust_user_login_log", "pmp_pay_details", "pmp_pay_order"}


def get_month_ranges(start_date: str, end_date: str):
    """Generate month-by-month date ranges."""
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    
    ranges = []
    current = start
    
    while current < end:
        # First day of current month
        month_start = current.replace(day=1)
        
        # First day of next month
        if current.month == 12:
            month_end = current.replace(year=current.year + 1, month=1, day=1)
        else:
            month_end = current.replace(month=current.month + 1, day=1)
        
        # Don't go past end date
        if month_end > end:
            month_end = end
        
        # Don't start before start date
        if month_start < start:
            month_start = start
        
        ranges.append((month_start.strftime("%Y-%m-%d"), month_end.strftime("%Y-%m-%d")))
        
        # Move to next month
        current = month_end
    
    return ranges


def run_etl(etl_class, url, start_date, end_date, spark):
    """Run ETL and return (success, duration, error)."""
    start_time = datetime.now()
    try:
        etl = etl_class(
            url=url,
            start_date=start_date,
            end_date=end_date,
            bulk=True,
        )
        etl.spark = spark
        etl()
        duration = (datetime.now() - start_time).total_seconds()
        return (True, duration, None)
    except Exception as e:
        duration = (datetime.now() - start_time).total_seconds()
        error_msg = str(e)[:100]
        return (False, duration, error_msg)


def main(
    url: Annotated[str, typer.Option("--url")],
    spark_remote: Annotated[str, typer.Option("--spark-remote")],
    start_date: Annotated[str, typer.Option("--start-date")],
    end_date: Annotated[str, typer.Option("--end-date")],
    tables: Annotated[str, typer.Option("--tables")] = None,
):
    """Backfill tables with hybrid strategy: monthly for large tables, yearly for others."""
    
    # Parse tables to process
    if tables:
        table_list = [t.strip() for t in tables.split(",")]
        for t in table_list:
            if t not in TABLE_REGISTRY:
                print(f"Error: Unknown table '{t}'. Available tables: {', '.join(TABLE_REGISTRY.keys())}")
                sys.exit(1)
    else:
        table_list = list(TABLE_REGISTRY.keys())
    
    # Split tables by processing strategy
    monthly_tables = [t for t in table_list if t in LARGE_TABLES]
    yearly_tables = [t for t in table_list if t not in LARGE_TABLES]
    
    month_ranges = get_month_ranges(start_date, end_date)
    
    # Calculate total jobs
    total_jobs = len(monthly_tables) * len(month_ranges) + len(yearly_tables)
    
    print(f"{'=' * 70}")
    print(f"Backfill Plan")
    print(f"{'=' * 70}")
    print(f"Date Range: {start_date} to {end_date}")
    print(f"")
    print(f"Monthly tables ({len(monthly_tables)}): {', '.join(monthly_tables) or 'none'}")
    print(f"  → {len(monthly_tables) * len(month_ranges)} jobs ({len(month_ranges)} months each)")
    print(f"")
    print(f"Yearly tables ({len(yearly_tables)}): {', '.join(yearly_tables) or 'none'}")
    print(f"  → {len(yearly_tables)} jobs (full range each)")
    print(f"")
    print(f"Total jobs: {total_jobs}")
    print(f"{'=' * 70}")
    print()
    
    # Initialize Spark session
    spark = SparkSession.builder.remote(spark_remote).getOrCreate()
    
    completed_jobs = 0
    failed_jobs = []
    table_results = {}  # table -> [(label, success, duration, error)]
    
    start_time_all = datetime.now()
    
    # ── Phase 1: Process yearly tables ──
    if yearly_tables:
        print(f"\n{'=' * 70}")
        print(f"Phase 1: Yearly Tables ({len(yearly_tables)} tables, full date range)")
        print(f"{'=' * 70}")
        
        for table_idx, table_name in enumerate(yearly_tables, 1):
            etl_class = TABLE_REGISTRY[table_name]
            dst_table = f"stg_{table_name}"
            completed_jobs += 1
            
            label = f"{start_date[:4]}"  # e.g. "2024"
            print(f"\n  [{completed_jobs}/{total_jobs}] {dst_table} ({label})", end="", flush=True)
            
            success, duration, error = run_etl(etl_class, url, start_date, end_date, spark)
            table_results[table_name] = [(label, success, duration, error)]
            
            if success:
                print(f"  ✓ {duration:.1f}s")
            else:
                print(f"  ✗ {duration:.1f}s")
                print(f"    Error: {error}")
                failed_jobs.append((label, table_name, error))
        
        print(f"\n  Phase 1 complete: {len(yearly_tables) - len([f for f in failed_jobs if f[1] in yearly_tables])} succeeded")
    
    # ── Phase 2: Process monthly tables ──
    if monthly_tables:
        print(f"\n\n{'=' * 70}")
        print(f"Phase 2: Monthly Tables ({len(monthly_tables)} tables, {len(month_ranges)} months)")
        print(f"{'=' * 70}")
        
        for month_idx, (month_start, month_end) in enumerate(month_ranges, 1):
            month_label = month_start[:7]  # YYYY-MM
            
            print(f"\n  ── Month {month_idx}/{len(month_ranges)}: {month_label} ──")
            
            for table_name in monthly_tables:
                etl_class = TABLE_REGISTRY[table_name]
                dst_table = f"stg_{table_name}"
                completed_jobs += 1
                
                print(f"    [{completed_jobs}/{total_jobs}] {dst_table}", end="", flush=True)
                
                success, duration, error = run_etl(etl_class, url, month_start, month_end, spark)
                
                if table_name not in table_results:
                    table_results[table_name] = []
                table_results[table_name].append((month_label, success, duration, error))
                
                if success:
                    print(f"  ✓ {duration:.1f}s")
                else:
                    print(f"  ✗ {duration:.1f}s")
                    print(f"      Error: {error}")
                    failed_jobs.append((month_label, table_name, error))
    
    total_duration = (datetime.now() - start_time_all).total_seconds()
    
    # ── Summary by Table ──
    print(f"\n\n{'=' * 70}")
    print("Summary by Table")
    print(f"{'=' * 70}")
    print(f"{'Table':<45} {'Jobs':>6} {'OK':>6} {'Fail':>6} {'Duration':>10}")
    print(f"{'-' * 45} {'-' * 6} {'-' * 6} {'-' * 6} {'-' * 10}")
    
    for table_name in table_list:
        results = table_results.get(table_name, [])
        total = len(results)
        success = sum(1 for _, s, _, _ in results if s)
        failed = sum(1 for _, s, _, _ in results if not s)
        dur = sum(d for _, _, d, _ in results)
        status = "✓" if failed == 0 else "✗"
        dst_table = f"stg_{table_name}"
        strategy = "monthly" if table_name in LARGE_TABLES else "yearly"
        print(f"{dst_table:<38} [{strategy:>6}] {total:>6} {success:>6} {failed:>6} {dur:>9.1f}s {status}")
    
    # ── Final Summary ──
    print(f"\n{'=' * 70}")
    print("Backfill Complete!")
    print(f"{'=' * 70}")
    print(f"Total jobs: {total_jobs}")
    print(f"Succeeded: {total_jobs - len(failed_jobs)}")
    print(f"Failed: {len(failed_jobs)}")
    print(f"Total duration: {total_duration:.1f}s ({total_duration/60:.1f}m)")
    
    if failed_jobs:
        print(f"\nFailed jobs:")
        for label, table, error in failed_jobs:
            print(f"  - {label}/{table}: {error}")
    
    spark.stop()


if __name__ == "__main__":
    typer.run(main)
