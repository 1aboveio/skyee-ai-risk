"""
Simple backfill script by table. Processes each table fully before moving to the next.
No threading, no timeout - just sequential processing with resume support.

Usage:
    python backfill_simple.py --url <mysql_jdbc_url> --spark-remote <spark_connect_url> --start-date <YYYY-MM-DD> --end-date <YYYY-MM-DD> [--tables <table1,table2,...>] [--resume]
"""

import sys
import os
import signal
import json
from datetime import datetime
from dateutil.relativedelta import relativedelta
import time

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
    "cust_store_info": StgCustStoreInfoEtl,
    "cust_customer_info": StgCustCustomerInfoEtl,
    "cust_person_realname_info": StgCustPersonRealnameInfoEtl,
    "cust_enterprise_realname_info": StgCustEnterpriseRealnameInfoEtl,
    "cust_realname_enterprise_ref_person": StgCustRealnameEnterpriseRefPersonEtl,
    "cust_bank_acct_info": StgCustBankAcctInfoEtl,
    "cust_collections_acct": StgCustCollectionsAcctEtl,
    "cust_foreign_trade_order": StgCustForeignTradeOrderEtl,
    "cust_foreign_trade_order_logistics": StgCustForeignTradeOrderLogisticsEtl,
    "cust_user_login_log": StgCustUserLoginLogEtl,
    "pmp_pay_details": StgPmpPayDetailsEtl,
    "pmp_pay_order": StgPmpPayOrderEtl,
    "pmp_coll_order": StgPmpCollOrderEtl,
}

# Global flag for graceful shutdown
shutdown_flag = False

# Progress file path
PROGRESS_FILE = "/tmp/backfill_simple_progress.json"


def signal_handler(signum, frame):
    """Handle shutdown signals gracefully."""
    global shutdown_flag
    print(f"\n{'=' * 60}")
    print(f"Received signal {signum}. Shutting down...")
    print(f"{'=' * 60}")
    shutdown_flag = True


signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


def load_progress():
    """Load progress from checkpoint file."""
    if os.path.exists(PROGRESS_FILE):
        try:
            with open(PROGRESS_FILE, 'r') as f:
                return json.load(f)
        except:
            return {"completed": []}
    return {"completed": []}


def save_progress(progress):
    """Save progress to checkpoint file."""
    with open(PROGRESS_FILE, 'w') as f:
        json.dump(progress, f, indent=2)


def get_month_ranges(start_date: str, end_date: str):
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


def main(
    url: Annotated[str, typer.Option("--url")],
    spark_remote: Annotated[str, typer.Option("--spark-remote")],
    start_date: Annotated[str, typer.Option("--start-date")],
    end_date: Annotated[str, typer.Option("--end-date")],
    tables: Annotated[str, typer.Option("--tables")] = None,
    resume: Annotated[bool, typer.Option("--resume")] = False,
):
    """Backfill tables by table, then by month."""
    
    global shutdown_flag
    
    if tables:
        table_list = [t.strip() for t in tables.split(",")]
    else:
        table_list = list(TABLE_REGISTRY.keys())
    
    # Load or initialize progress
    progress = {"completed": []}
    if resume:
        progress = load_progress()
        print(f"Resuming: {len(progress['completed'])} jobs already completed")
    
    month_ranges = get_month_ranges(start_date, end_date)
    total_jobs = len(month_ranges) * len(table_list)
    
    print(f"{'=' * 60}")
    print(f"Simple Backfill (By Table)")
    print(f"{'=' * 60}")
    print(f"Date: {start_date} to {end_date}")
    print(f"Months: {len(month_ranges)}, Tables: {len(table_list)}, Total: {total_jobs}")
    print(f"{'=' * 60}")
    
    # Create Spark session
    spark = SparkSession.builder.remote(spark_remote).getOrCreate()
    print(f"Connected to Spark: {spark_remote}")
    
    completed = 0
    skipped = 0
    failed = 0
    start_time = datetime.now()
    
    for table_idx, table_name in enumerate(table_list, 1):
        if shutdown_flag:
            print("Shutdown requested")
            break
        
        etl_class = TABLE_REGISTRY[table_name]
        print(f"\n{'=' * 60}")
        print(f"Table {table_idx}/{len(table_list)}: {table_name}")
        print(f"{'=' * 60}")
        
        for month_idx, (month_start, month_end) in enumerate(month_ranges, 1):
            if shutdown_flag:
                break
            
            job_key = f"{table_name}_{month_start[:7]}"
            month_label = month_start[:7]
            
            # Skip if already completed
            if job_key in progress.get("completed", []):
                skipped += 1
                print(f"  {month_label} ⊘ skipped")
                continue
            
            # Run ETL
            start = time.time()
            try:
                etl = etl_class(
                    url=url,
                    start_date=month_start,
                    end_date=month_end,
                    bulk=True,
                )
                etl.spark = spark
                etl()
                
                duration = time.time() - start
                completed += 1
                
                # Save progress
                progress["completed"].append(job_key)
                save_progress(progress)
                
                print(f"  {month_label} ✓ {duration:.1f}s")
                
            except Exception as e:
                duration = time.time() - start
                failed += 1
                print(f"  {month_label} ✗ {duration:.1f}s - {e}")
        
        # Table summary
        print(f"  --- {table_name} done ---")
    
    # Final summary
    total_duration = (datetime.now() - start_time).total_seconds()
    print(f"\n{'=' * 60}")
    print(f"{'Done!' if not shutdown_flag else 'Interrupted!'}")
    print(f"Completed: {completed}, Skipped: {skipped}, Failed: {failed}")
    print(f"Duration: {total_duration:.0f}s ({total_duration/60:.1f}m)")
    print(f"{'=' * 60}")
    
    spark.stop()


if __name__ == "__main__":
    typer.run(main)
