"""
Airflow DAG: Backfill MySQL usr_skyee_mw stg_* tables to Hudi.

Schedule: @monthly from 2016-09-01
Catchup: enabled (backfills all months from start_date)

Processing strategy:
- Large tables (pmp_coll_order, cust_user_login_log): monthly
- Other tables: yearly (12-month window, idempotent overwrites)

Variables:
    MYSQL_DB_URL_SECRET - MySQL JDBC URL with credentials
    SPARK_CONNECT_URL   - Spark Connect server URL
"""

from datetime import datetime, timedelta

from airflow import DAG
from airflow.providers.apache.spark.operators.spark_submit import SparkSubmitOperator
from airflow.operators.empty import EmptyOperator

SCRIPTS_PATH = "/opt/airflow/dags/usr_skyee_mw/python"

MYSQL_URL = "{{ var.value.MYSQL_DB_URL_SECRET }}"
SPARK_REMOTE = "{{ var.value.SPARK_CONNECT_URL }}"

# One month window
MONTH_START = "{{ ds }}"
MONTH_END = "{{ next_ds }}"

# One year window (idempotent: Hudi insert_overwrite replaces partitions)
YEAR_START = "{{ ds }}"
YEAR_END = "{{ (macros.datetime.strptime(ds, '%Y-%m-%d') + macros.dateutil.relativedelta.relativedelta(years=1)).strftime('%Y-%m-%d') }}"

default_args = {
    "owner": "data-team",
    "depends_on_past": False,
    "email_on_failure": True,
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}


def spark_stg(task_id: str, table: str, start: str, end: str) -> SparkSubmitOperator:
    return SparkSubmitOperator(
        task_id=task_id,
        application=f"{SCRIPTS_PATH}/stg_{table}.py",
        conn_id="spark_default",
        application_args=[
            "--url", MYSQL_URL,
            "--spark-remote", SPARK_REMOTE,
            "--start-date", start,
            "--end-date", end,
            "--bulk",
        ],
        verbose=True,
    )


with DAG(
    dag_id="usr_skyee_mw_backfill",
    default_args=default_args,
    description="Backfill usr_skyee_mw stg_* tables to Hudi",
    schedule="@monthly",
    start_date=datetime(2016, 9, 1),
    catchup=True,
    max_active_runs=1,
    tags=["backfill", "usr_skyee_mw"],
):

    start = EmptyOperator(task_id="start")
    end = EmptyOperator(task_id="end")

    # Large tables: monthly processing
    monthly = [
        spark_stg(f"monthly_{t}", t, MONTH_START, MONTH_END)
        for t in ("pmp_coll_order", "cust_user_login_log")
    ]

    # Regular tables: yearly processing (idempotent Hudi overwrite)
    yearly = [
        spark_stg(f"yearly_{t}", t, YEAR_START, YEAR_END)
        for t in (
            "cust_customer_info",
            "cust_bank_acct_info",
            "cust_collections_acct",
            "cust_enterprise_realname_info",
            "cust_foreign_trade_order",
            "cust_foreign_trade_order_logistics",
            "cust_person_realname_info",
            "cust_realname_enterprise_ref_person",
            "cust_store_info",
            "pmp_pay_details",
            "pmp_pay_order",
        )
    ]

    start >> monthly >> end
    start >> yearly >> end
