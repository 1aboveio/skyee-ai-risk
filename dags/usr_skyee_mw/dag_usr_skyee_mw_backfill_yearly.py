"""
Airflow DAG: Backfill regular stg_* tables yearly.

Schedule: @yearly from 2015-09-01 (first run covers 2016)
Catchup: enabled

Tables: all except pmp_coll_order, cust_user_login_log, pmp_pay_details, pmp_pay_order

Variables:
    MYSQL_DB_URL_SECRET - MySQL JDBC URL with credentials
"""

from datetime import datetime, timedelta

from airflow import DAG
from airflow.providers.apache.spark.operators.spark_submit import SparkSubmitOperator
from airflow.operators.empty import EmptyOperator

SCRIPTS_PATH = "/opt/airflow/dags/usr_skyee_mw/python"

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
    start_date=datetime(2015, 9, 1),
    catchup=True,
    max_active_runs=1,
    max_active_tasks=4,
    tags=["backfill", "usr_skyee_mw"],
):

    start = EmptyOperator(task_id="start")
    end = EmptyOperator(task_id="end")

    tasks = [
        SparkSubmitOperator(
            task_id=f"stg_{table}",
            name=f"usr_skyee_mw.backfill.yearly.stg.{table}.{{{{ ds }}}}",
            application=f"{SCRIPTS_PATH}/stg_{table}.py",
            conn_id="spark_default",
            application_args=[
                "--url", "jdbc:mysql://{{ var.value.MYSQL_DB_URL_SECRET }}",
                "--start-date", "{{ ds }}",
                "--end-date", "{{ (macros.datetime.strptime(ds, '%Y-%m-%d') + macros.dateutil.relativedelta.relativedelta(years=1)).strftime('%Y-%m-%d') }}",
                "--bulk",
            ],
            verbose=True,
        )
        for table in TABLES
    ]

    start >> tasks >> end
