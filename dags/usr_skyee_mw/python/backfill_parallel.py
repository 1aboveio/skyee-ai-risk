"""
Parallel backfill script for usr_skyee_mw tables. Processes month by month in reverse order with parallel table processing.

Usage:
    python backfill_parallel.py --url <mysql_jdbc_url> --spark-remote <spark_connect_url> --start-date <YYYY-MM-DD> --end-date <YYYY-MM-DD> [--workers <num>] [--tables <table1,table2,...>]
"""

import sys
import os
from datetime import datetime
from dateutil.relativedelta import relativedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

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

# Lock for thread-safe printing
print_lock = threading.Lock()


def get_month_ranges_reverse(start_date: str, end_date: str):
    """Generate month-by-month date ranges in reverse order."""
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    
    ranges = []
    current = end.replace(day=1) + relativedelta(months=1) - relativedelta(days=1)
    
    while current >= start:
        month_start = current.replace(day=1)
        month_end = current
        
        if month_start < start:
            month_start = start
        
        ranges.append((month_start.strftime("%Y-%m-%d"), month_end.strftime("%Y-%m-%d")))
        current = month_start - relativedelta(days=1)
    
    return ranges


def process_table(table_name, etl_class, url, month_start, month_end, spark, job_num, total_jobs):
    """Process a single table for a month."""
    dst_table = f"stg_{table_name}"
    start_time = datetime.now()
    
    try:
        etl = etl_class(
            url=url,
            start_date=month_start,
            end_date=month_end,
            bulk=True,
        )
        etl.spark = spark
        etl()
        
        duration = (datetime.now() - start_time).total_seconds()
        with print_lock:
            print(f"  [{job_num}/{total_jobs}] {table_name} -> {dst_table} ✓ {duration:.1f}s")
        return (table_name, True, duration, None)
    except Exception as e:
        duration = (datetime.now() - start_time).total_seconds()
        with print_lock:
            print(f"  [{job_num}/{total_jobs}] {table_name} -> {dst_table} ✗ {duration:.1f}s - {e}")
        return (table_name, False, duration, str(e))


def main(
    url: Annotated[str, typer.Option("--url")],
    spark_remote: Annotated[str, typer.Option("--spark-remote")],
    start_date: Annotated[str, typer.Option("--start-date")],
    end_date: Annotated[str, typer.Option("--end-date")],
    workers: Annotated[int, typer.Option("--workers")] = 4,
    tables: Annotated[str, typer.Option("--tables")] = None,
):
    """Backfill tables month by month in reverse order with parallel processing."""
    
    if tables:
        table_list = [t.strip() for t in tables.split(",")]
        for t in table_list:
            if t not in TABLE_REGISTRY:
                print(f"Error: Unknown table '{t}'. Available tables: {', '.join(TABLE_REGISTRY.keys())}")
                sys.exit(1)
    else:
        table_list = list(TABLE_REGISTRY.keys())
    
    month_ranges = get_month_ranges_reverse(start_date, end_date)
    total_jobs = len(month_ranges) * len(table_list)
    
    print(f"{'=' * 60}")
    print(f"Parallel Backfill Plan (Reverse Order)")
    print(f"{'=' * 60}")
    print(f"Date Range: {start_date} to {end_date}")
    print(f"Months to process: {len(month_ranges)}")
    print(f"Tables to process: {len(table_list)}")
    print(f"Workers: {workers}")
    print(f"Total jobs: {total_jobs}")
    print(f"Order: Most recent month first")
    print(f"{'=' * 60}")
    print()
    
    spark = SparkSession.builder.remote(spark_remote).getOrCreate()
    
    completed_jobs = 0
    failed_jobs = []
    
    for month_idx, (month_start, month_end) in enumerate(month_ranges, 1):
        month_label = month_start[:7]
        print(f"\n{'=' * 60}")
        print(f"Processing month: {month_label} ({month_start} to {month_end})")
        print(f"Month {month_idx}/{len(month_ranges)} | Parallel workers: {workers}")
        print(f"{'=' * 60}")
        
        # Process tables in parallel
        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {}
            for table_name in table_list:
                job_num = completed_jobs + len(futures) + 1
                etl_class = TABLE_REGISTRY[table_name]
                future = executor.submit(
                    process_table,
                    table_name, etl_class, url, month_start, month_end, spark,
                    job_num, total_jobs
                )
                futures[future] = table_name
            
            for future in as_completed(futures):
                table_name, success, duration, error = future.result()
                completed_jobs += 1
                if not success:
                    failed_jobs.append((month_label, table_name, error))
    
    print(f"\n{'=' * 60}")
    print("Backfill completed!")
    print(f"{'=' * 60}")
    print(f"\nSummary:")
    print(f"  Total jobs: {total_jobs}")
    print(f"  Completed: {total_jobs - len(failed_jobs)}")
    print(f"  Failed: {len(failed_jobs)}")
    
    if failed_jobs:
        print(f"\nFailed jobs:")
        for month, table, error in failed_jobs:
            print(f"  - {month}/{table}: {error}")
    
    spark.stop()


if __name__ == "__main__":
    typer.run(main)
