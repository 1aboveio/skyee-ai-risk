"""
Backfill script for usr_skyee_mw tables. Processes month by month in reverse order.

Usage:
    python backfill_reverse.py --url <mysql_jdbc_url> --spark-remote <spark_connect_url> --start-date <YYYY-MM-DD> --end-date <YYYY-MM-DD> [--tables <table1,table2,...>]

Examples:
    # Backfill all tables from 2016 to now (reverse order)
    python backfill_reverse.py --url "jdbc:mysql://..." --spark-remote "sc://..." --start-date 2016-09-01 --end-date 2026-07-01

    # Backfill specific tables
    python backfill_reverse.py --url "jdbc:mysql://..." --spark-remote "sc://..." --start-date 2016-09-01 --end-date 2026-07-01 --tables cust_customer_info,pmp_coll_order
"""

import sys
import os
from datetime import datetime
from dateutil.relativedelta import relativedelta

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


def get_month_ranges_reverse(start_date: str, end_date: str):
    """Generate month-by-month date ranges in reverse order."""
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    
    ranges = []
    # Start from the last day of the month containing end_date
    current = end.replace(day=1) + relativedelta(months=1) - relativedelta(days=1)
    
    while current >= start:
        # First day of current month
        month_start = current.replace(day=1)
        # Last day of current month (which is current)
        month_end = current
        
        # Don't go before start date
        if month_start < start:
            month_start = start
        
        ranges.append((month_start.strftime("%Y-%m-%d"), month_end.strftime("%Y-%m-%d")))
        
        # Move to last day of previous month
        current = month_start - relativedelta(days=1)
    
    return ranges


def main(
    url: Annotated[str, typer.Option("--url")],
    spark_remote: Annotated[str, typer.Option("--spark-remote")],
    start_date: Annotated[str, typer.Option("--start-date")],
    end_date: Annotated[str, typer.Option("--end-date")],
    tables: Annotated[str, typer.Option("--tables")] = None,
):
    """Backfill tables month by month in reverse order."""
    
    # Parse tables to process
    if tables:
        table_list = [t.strip() for t in tables.split(",")]
        for t in table_list:
            if t not in TABLE_REGISTRY:
                print(f"Error: Unknown table '{t}'. Available tables: {', '.join(TABLE_REGISTRY.keys())}")
                sys.exit(1)
    else:
        table_list = list(TABLE_REGISTRY.keys())
    
    # Get month ranges in reverse order
    month_ranges = get_month_ranges_reverse(start_date, end_date)
    
    print(f"{'=' * 60}")
    print(f"Backfill Plan (Reverse Order)")
    print(f"{'=' * 60}")
    print(f"Date Range: {start_date} to {end_date}")
    print(f"Months to process: {len(month_ranges)}")
    print(f"Tables to process: {len(table_list)}")
    print(f"Total jobs: {len(month_ranges) * len(table_list)}")
    print(f"Order: Most recent month first")
    print(f"{'=' * 60}")
    print()
    
    # Initialize Spark session
    spark = SparkSession.builder.remote(spark_remote).getOrCreate()
    
    total_jobs = len(month_ranges) * len(table_list)
    completed_jobs = 0
    failed_jobs = []
    
    # Process each month in reverse order
    for month_idx, (month_start, month_end) in enumerate(month_ranges, 1):
        month_label = month_start[:7]  # YYYY-MM
        print(f"\n{'=' * 60}")
        print(f"Processing month: {month_label} ({month_start} to {month_end})")
        print(f"Month {month_idx}/{len(month_ranges)}")
        print(f"{'=' * 60}")
        
        for table_idx, table_name in enumerate(table_list, 1):
            etl_class = TABLE_REGISTRY[table_name]
            dst_table = f"stg_{table_name}"
            completed_jobs += 1
            
            print(f"\n  [{completed_jobs}/{total_jobs}] {table_name} -> {dst_table}")
            print(f"  Date range: {month_start} to {month_end}")
            
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
                print(f"  ✓ Completed in {duration:.1f}s")
            except Exception as e:
                duration = (datetime.now() - start_time).total_seconds()
                print(f"  ✗ Failed after {duration:.1f}s")
                print(f"    Error: {e}")
                failed_jobs.append((month_label, table_name, str(e)))
                continue
    
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
