"""
Parallel backfill script for usr_skyee_mw tables. Processes month by month in reverse order with parallel table processing.

Features:
- Retry logic for connection errors
- Timeout handling
- Progress tracking
- Error recovery

Usage:
    python backfill_parallel.py --url <mysql_jdbc_url> --spark-remote <spark_connect_url> --start-date <YYYY-MM-DD> --end-date <YYYY-MM-DD> [--workers <num>] [--tables <table1,table2,...>] [--max-retries <num>] [--timeout <seconds>]
"""

import sys
import os
import signal
from datetime import datetime
from dateutil.relativedelta import relativedelta
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError
import threading
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

# Global flag for graceful shutdown
shutdown_flag = threading.Event()


def signal_handler(signum, frame):
    """Handle shutdown signals gracefully."""
    print(f"\n{'=' * 60}")
    print(f"Received signal {signum}. Shutting down gracefully...")
    print(f"{'=' * 60}")
    shutdown_flag.set()


# Register signal handlers
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


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


def process_table_with_retry(table_name, etl_class, url, month_start, month_end, 
                             spark, job_num, total_jobs, max_retries=3, timeout=600):
    """Process a single table for a month with retry logic."""
    dst_table = f"stg_{table_name}"
    
    for attempt in range(max_retries + 1):
        start_time = datetime.now()
        
        try:
            # Check for shutdown signal
            if shutdown_flag.is_set():
                return (table_name, False, 0, "Shutdown requested")
            
            etl = etl_class(
                url=url,
                start_date=month_start,
                end_date=month_end,
                bulk=True,
            )
            etl.spark = spark
            
            # Run with timeout
            result = run_with_timeout(etl, timeout)
            
            duration = (datetime.now() - start_time).total_seconds()
            with print_lock:
                if attempt > 0:
                    print(f"  [{job_num}/{total_jobs}] {table_name} -> {dst_table} ✓ {duration:.1f}s (attempt {attempt + 1})")
                else:
                    print(f"  [{job_num}/{total_jobs}] {table_name} -> {dst_table} ✓ {duration:.1f}s")
            return (table_name, True, duration, None)
            
        except TimeoutError:
            duration = (datetime.now() - start_time).total_seconds()
            with print_lock:
                print(f"  [{job_num}/{total_jobs}] {table_name} -> {dst_table} ⏱ {duration:.1f}s timeout (attempt {attempt + 1}/{max_retries + 1})")
            
            if attempt < max_retries:
                time.sleep(5)  # Wait before retry
                continue
            else:
                return (table_name, False, duration, f"Timeout after {max_retries + 1} attempts")
                
        except Exception as e:
            duration = (datetime.now() - start_time).total_seconds()
            error_msg = str(e)
            
            # Check if it's a connection error
            if is_connection_error(error_msg):
                with print_lock:
                    print(f"  [{job_num}/{total_jobs}] {table_name} -> {dst_table} ✗ {duration:.1f}s connection error (attempt {attempt + 1}/{max_retries + 1})")
                
                if attempt < max_retries:
                    time.sleep(10)  # Wait longer for connection errors
                    continue
                else:
                    return (table_name, False, duration, f"Connection error after {max_retries + 1} attempts: {error_msg}")
            else:
                with print_lock:
                    print(f"  [{job_num}/{total_jobs}] {table_name} -> {dst_table} ✗ {duration:.1f}s - {error_msg}")
                return (table_name, False, duration, error_msg)
    
    return (table_name, False, 0, "Max retries exceeded")


def run_with_timeout(func, timeout):
    """Run a function with timeout."""
    result = [None]
    exception = [None]
    
    def target():
        try:
            result[0] = func()
        except Exception as e:
            exception[0] = e
    
    thread = threading.Thread(target=target)
    thread.daemon = True
    thread.start()
    thread.join(timeout)
    
    if thread.is_alive():
        # Thread is still running, timeout occurred
        raise TimeoutError(f"Function timed out after {timeout} seconds")
    
    if exception[0]:
        raise exception[0]
    
    return result[0]


def is_connection_error(error_msg):
    """Check if error is a connection-related error."""
    connection_errors = [
        "connection",
        "timeout",
        "eofexception",
        "socket",
        "network",
        "lost connection",
        "broken pipe",
        "connection reset",
        "connection refused",
    ]
    error_lower = error_msg.lower()
    return any(err in error_lower for err in connection_errors)


def main(
    url: Annotated[str, typer.Option("--url")],
    spark_remote: Annotated[str, typer.Option("--spark-remote")],
    start_date: Annotated[str, typer.Option("--start-date")],
    end_date: Annotated[str, typer.Option("--end-date")],
    workers: Annotated[int, typer.Option("--workers")] = 4,
    tables: Annotated[str, typer.Option("--tables")] = None,
    max_retries: Annotated[int, typer.Option("--max-retries")] = 3,
    timeout: Annotated[int, typer.Option("--timeout")] = 600,
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
    print(f"Max retries: {max_retries}")
    print(f"Timeout: {timeout}s per job")
    print(f"Total jobs: {total_jobs}")
    print(f"Order: Most recent month first")
    print(f"{'=' * 60}")
    print()
    
    # Create Spark session with retry
    spark = None
    for attempt in range(3):
        try:
            spark = SparkSession.builder.remote(spark_remote).getOrCreate()
            print(f"✓ Connected to Spark: {spark_remote}")
            break
        except Exception as e:
            print(f"✗ Failed to connect to Spark (attempt {attempt + 1}/3): {e}")
            if attempt < 2:
                time.sleep(5)
            else:
                print("Failed to connect to Spark after 3 attempts. Exiting.")
                sys.exit(1)
    
    completed_jobs = 0
    failed_jobs = []
    start_time = datetime.now()
    
    for month_idx, (month_start, month_end) in enumerate(month_ranges, 1):
        # Check for shutdown signal
        if shutdown_flag.is_set():
            print(f"\nShutdown requested. Stopping at month {month_idx}/{len(month_ranges)}")
            break
        
        month_label = month_start[:7]
        print(f"\n{'=' * 60}")
        print(f"Processing month: {month_label} ({month_start} to {month_end})")
        print(f"Month {month_idx}/{len(month_ranges)} | Parallel workers: {workers}")
        print(f"{'=' * 60}")
        
        # Process tables in parallel
        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {}
            for table_name in table_list:
                # Check for shutdown signal
                if shutdown_flag.is_set():
                    break
                
                job_num = completed_jobs + len(futures) + 1
                etl_class = TABLE_REGISTRY[table_name]
                future = executor.submit(
                    process_table_with_retry,
                    table_name, etl_class, url, month_start, month_end, spark,
                    job_num, total_jobs, max_retries, timeout
                )
                futures[future] = table_name
            
            for future in as_completed(futures):
                # Check for shutdown signal
                if shutdown_flag.is_set():
                    break
                
                try:
                    table_name, success, duration, error = future.result(timeout=timeout + 30)
                    completed_jobs += 1
                    if not success:
                        failed_jobs.append((month_label, table_name, error))
                except TimeoutError:
                    table_name = futures[future]
                    completed_jobs += 1
                    failed_jobs.append((month_label, table_name, "Future timeout"))
                    with print_lock:
                        print(f"  [{completed_jobs}/{total_jobs}] {table_name} ✗ Future timeout")
    
    # Final summary
    total_duration = (datetime.now() - start_time).total_seconds()
    print(f"\n{'=' * 60}")
    print("Backfill completed!" if not shutdown_flag.is_set() else "Backfill interrupted!")
    print(f"{'=' * 60}")
    print(f"\nSummary:")
    print(f"  Total jobs: {total_jobs}")
    print(f"  Completed: {completed_jobs}")
    print(f"  Successful: {completed_jobs - len(failed_jobs)}")
    print(f"  Failed: {len(failed_jobs)}")
    print(f"  Total duration: {total_duration:.1f}s ({total_duration / 60:.1f}m)")
    
    if failed_jobs:
        print(f"\nFailed jobs:")
        for month, table, error in failed_jobs:
            print(f"  - {month}/{table}: {error}")
    
    if spark:
        try:
            spark.stop()
        except:
            pass


if __name__ == "__main__":
    typer.run(main)
