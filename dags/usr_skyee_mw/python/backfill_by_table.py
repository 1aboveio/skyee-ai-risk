"""
Backfill script by table, then by month. Processes each table fully before moving to the next.

Features:
- By-table processing (complete one table before starting next)
- Resume from checkpoint
- Retry logic for connection errors
- Timeout handling
- Progress tracking

Usage:
    python backfill_by_table.py --url <mysql_jdbc_url> --spark-remote <spark_connect_url> --start-date <YYYY-MM-DD> --end-date <YYYY-MM-DD> [--tables <table1,table2,...>] [--max-retries <num>] [--timeout <seconds>] [--resume]
"""

import sys
import os
import signal
import json
from datetime import datetime
from dateutil.relativedelta import relativedelta
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

# Table registry with order (smaller tables first for quick wins)
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

# Lock for thread-safe operations
print_lock = threading.Lock()
progress_lock = threading.Lock()

# Global flag for graceful shutdown
shutdown_flag = threading.Event()

# Progress file path
PROGRESS_FILE = "/tmp/backfill_by_table_progress.json"


def signal_handler(signum, frame):
    """Handle shutdown signals gracefully."""
    print(f"\n{'=' * 60}")
    print(f"Received signal {signum}. Shutting down gracefully...")
    print(f"Progress saved. Use --resume to continue.")
    print(f"{'=' * 60}")
    shutdown_flag.set()


# Register signal handlers
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


def load_progress():
    """Load progress from checkpoint file."""
    if os.path.exists(PROGRESS_FILE):
        try:
            with open(PROGRESS_FILE, 'r') as f:
                return json.load(f)
        except:
            return {"completed": {}, "failed": {}}
    return {"completed": {}, "failed": {}}


def save_progress(progress):
    """Save progress to checkpoint file."""
    with progress_lock:
        with open(PROGRESS_FILE, 'w') as f:
            json.dump(progress, f, indent=2)


def get_job_key(table_name, month_start):
    """Generate unique key for a job."""
    return f"{table_name}_{month_start[:7]}"


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


def process_table_month(table_name, etl_class, url, month_start, month_end, 
                        spark, job_num, total_jobs, max_retries=3, timeout=600,
                        progress=None):
    """Process a single table for a month with retry logic."""
    dst_table = f"stg_{table_name}"
    job_key = get_job_key(table_name, month_start)
    
    # Check if already completed
    if progress and job_key in progress.get("completed", {}):
        return (table_name, month_start[:7], True, 0, "skipped")
    
    for attempt in range(max_retries + 1):
        start_time = datetime.now()
        
        try:
            # Check for shutdown signal
            if shutdown_flag.is_set():
                return (table_name, month_start[:7], False, 0, "Shutdown requested")
            
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
            
            # Mark as completed
            if progress:
                with progress_lock:
                    progress["completed"][job_key] = {
                        "timestamp": datetime.now().isoformat(),
                        "duration": duration
                    }
                    # Remove from failed if it was there
                    if job_key in progress.get("failed", {}):
                        del progress["failed"][job_key]
                    save_progress(progress)
            
            return (table_name, month_start[:7], True, duration, None)
            
        except TimeoutError:
            duration = (datetime.now() - start_time).total_seconds()
            
            if attempt < max_retries:
                time.sleep(5)  # Wait before retry
                continue
            else:
                # Mark as failed
                if progress:
                    with progress_lock:
                        progress["failed"][job_key] = {
                            "timestamp": datetime.now().isoformat(),
                            "error": f"Timeout after {max_retries + 1} attempts"
                        }
                        save_progress(progress)
                return (table_name, month_start[:7], False, duration, f"Timeout after {max_retries + 1} attempts")
                
        except Exception as e:
            duration = (datetime.now() - start_time).total_seconds()
            error_msg = str(e)
            
            # Check if it's a connection error
            if is_connection_error(error_msg):
                if attempt < max_retries:
                    time.sleep(10)  # Wait longer for connection errors
                    continue
                else:
                    # Mark as failed
                    if progress:
                        with progress_lock:
                            progress["failed"][job_key] = {
                                "timestamp": datetime.now().isoformat(),
                                "error": f"Connection error after {max_retries + 1} attempts: {error_msg}"
                            }
                            save_progress(progress)
                    return (table_name, month_start[:7], False, duration, f"Connection error after {max_retries + 1} attempts")
            else:
                # Mark as failed
                if progress:
                    with progress_lock:
                        progress["failed"][job_key] = {
                            "timestamp": datetime.now().isoformat(),
                            "error": error_msg
                        }
                        save_progress(progress)
                return (table_name, month_start[:7], False, duration, error_msg)
    
    return (table_name, month_start[:7], False, 0, "Max retries exceeded")


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
    tables: Annotated[str, typer.Option("--tables")] = None,
    max_retries: Annotated[int, typer.Option("--max-retries")] = 3,
    timeout: Annotated[int, typer.Option("--timeout")] = 600,
    resume: Annotated[bool, typer.Option("--resume")] = False,
):
    """Backfill tables by table, then by month."""
    
    if tables:
        table_list = [t.strip() for t in tables.split(",")]
        for t in table_list:
            if t not in TABLE_REGISTRY:
                print(f"Error: Unknown table '{t}'. Available tables: {', '.join(TABLE_REGISTRY.keys())}")
                sys.exit(1)
    else:
        table_list = list(TABLE_REGISTRY.keys())
    
    # Load or initialize progress
    progress = {"completed": {}, "failed": {}}
    if resume:
        progress = load_progress()
        print(f"{'=' * 60}")
        print(f"Resuming from checkpoint")
        print(f"{'=' * 60}")
        print(f"Previously completed: {len(progress['completed'])} jobs")
        print(f"Previously failed: {len(progress['failed'])} jobs")
        print()
    
    month_ranges = get_month_ranges(start_date, end_date)
    total_jobs = len(month_ranges) * len(table_list)
    
    print(f"{'=' * 60}")
    print(f"Backfill Plan (By Table)")
    print(f"{'=' * 60}")
    print(f"Date Range: {start_date} to {end_date}")
    print(f"Months to process: {len(month_ranges)}")
    print(f"Tables to process: {len(table_list)}")
    print(f"Max retries: {max_retries}")
    print(f"Timeout: {timeout}s per job")
    print(f"Total jobs: {total_jobs}")
    print(f"Progress file: {PROGRESS_FILE}")
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
    skipped_jobs = 0
    failed_jobs = []
    start_time = datetime.now()
    
    # Process each table completely before moving to next
    for table_idx, table_name in enumerate(table_list, 1):
        # Check for shutdown signal
        if shutdown_flag.is_set():
            print(f"\nShutdown requested. Stopping at table {table_idx}/{len(table_list)}")
            break
        
        etl_class = TABLE_REGISTRY[table_name]
        dst_table = f"stg_{table_name}"
        
        print(f"\n{'=' * 60}")
        print(f"Processing table: {table_name} -> {dst_table}")
        print(f"Table {table_idx}/{len(table_list)} | Months: {len(month_ranges)}")
        print(f"{'=' * 60}")
        
        table_start_time = datetime.now()
        table_completed = 0
        table_skipped = 0
        table_failed = 0
        
        # Process all months for this table
        for month_idx, (month_start, month_end) in enumerate(month_ranges, 1):
            # Check for shutdown signal
            if shutdown_flag.is_set():
                print(f"\nShutdown requested. Stopping at month {month_idx}/{len(month_ranges)}")
                break
            
            month_label = month_start[:7]
            job_num = completed_jobs + skipped_jobs + 1
            
            # Process the table for this month
            table_name_result, month_label_result, success, duration, error = process_table_month(
                table_name, etl_class, url, month_start, month_end, spark,
                job_num, total_jobs, max_retries, timeout, progress
            )
            
            if error == "skipped":
                skipped_jobs += 1
                table_skipped += 1
                with print_lock:
                    print(f"  [{job_num}/{total_jobs}] {month_label} ⊘ skipped")
            elif success:
                completed_jobs += 1
                table_completed += 1
                with print_lock:
                    print(f"  [{job_num}/{total_jobs}] {month_label} ✓ {duration:.1f}s")
            else:
                completed_jobs += 1
                table_failed += 1
                failed_jobs.append((table_name, month_label, error))
                with print_lock:
                    print(f"  [{job_num}/{total_jobs}] {month_label} ✗ {error}")
        
        # Table summary
        table_duration = (datetime.now() - table_start_time).total_seconds()
        print(f"\n  Table {table_name} summary:")
        print(f"    Completed: {table_completed}")
        print(f"    Skipped: {table_skipped}")
        print(f"    Failed: {table_failed}")
        print(f"    Duration: {table_duration:.1f}s ({table_duration / 60:.1f}m)")
    
    # Final summary
    total_duration = (datetime.now() - start_time).total_seconds()
    print(f"\n{'=' * 60}")
    print("Backfill completed!" if not shutdown_flag.is_set() else "Backfill interrupted!")
    print(f"{'=' * 60}")
    print(f"\nSummary:")
    print(f"  Total jobs: {total_jobs}")
    print(f"  Completed: {completed_jobs}")
    print(f"  Skipped: {skipped_jobs}")
    print(f"  Successful: {completed_jobs - len(failed_jobs)}")
    print(f"  Failed: {len(failed_jobs)}")
    print(f"  Total duration: {total_duration:.1f}s ({total_duration / 60:.1f}m)")
    print(f"  Progress file: {PROGRESS_FILE}")
    
    if failed_jobs:
        print(f"\nFailed jobs:")
        for table, month, error in failed_jobs:
            print(f"  - {table}/{month}: {error}")
    
    if shutdown_flag.is_set():
        print(f"\nTo resume, run with --resume flag")
    
    if spark:
        try:
            spark.stop()
        except:
            pass


if __name__ == "__main__":
    typer.run(main)
