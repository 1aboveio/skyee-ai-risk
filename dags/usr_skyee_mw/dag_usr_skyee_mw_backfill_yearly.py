"""
Airflow DAG: Backfill regular stg_* tables yearly.

Schedule: @yearly from 2016-09-01
Catchup: enabled

Tables: all except pmp_coll_order, cust_user_login_log

Variables:
    MYSQL_DB_URL_SECRET - MySQL JDBC URL with credentials
    SPARK_CONNECT_URL   - Spark Connect server URL
"""

from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.empty import EmptyOperator

default_args = {
    "owner": "data-team",
    "depends_on_past": False,
    "email_on_failure": True,
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

TABLES = [
    "cust_customer_info",
    "cust_bank_acct_info",
    "cust_collections_acct",
    "cust_enterprise_realname_info",
    "cust_foreign_trade_order",
    "cust_foreign_trade_order_logistics",
    "cust_person_realname_info",
    "cust_realname_enterprise_ref_person",
    "cust_store_info",
]


with DAG(
    dag_id="usr_skyee_mw_backfill_yearly",
    default_args=default_args,
    description="Backfill regular stg_* tables (yearly)",
    schedule="@yearly",
    start_date=datetime(2016, 9, 1),
    catchup=True,
    max_active_runs=1,
    tags=["backfill", "usr_skyee_mw"],
):

    start = EmptyOperator(task_id="start")
    end = EmptyOperator(task_id="end")

    tasks = [EmptyOperator(task_id=f"stg_{t}") for t in TABLES]

    start >> tasks >> end
