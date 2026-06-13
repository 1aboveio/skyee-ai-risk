"""
Airflow DAG: Backfill large stg_* tables monthly.

Schedule: @monthly from 2016-09-01
Catchup: enabled

Tables: pmp_coll_order, cust_user_login_log, pmp_pay_details, pmp_pay_order

Variables:
    MYSQL_DB_URL_SECRET - MySQL JDBC URL with credentials
    SPARK_CONNECT_URL   - Spark Connect server URL
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

TABLES = ["pmp_coll_order", "cust_user_login_log", "pmp_pay_details", "pmp_pay_order"]


with DAG(
    dag_id="usr_skyee_mw_backfill_monthly",
    default_args=default_args,
    description="Backfill large stg_* tables (monthly)",
    schedule="@monthly",
    start_date=datetime(2016, 9, 1),
    catchup=True,
    max_active_runs=1,
    max_active_tasks=1,
    tags=["backfill", "usr_skyee_mw"],
):

    start = EmptyOperator(task_id="start")
    end = EmptyOperator(task_id="end")

    tasks = [
        SparkSubmitOperator(
            task_id=f"stg_{table}",
            application=f"{SCRIPTS_PATH}/stg_{table}.py",
            conn_id="spark_default",
            application_args=[
                "--url", "jdbc:mysql://{{ var.value.MYSQL_DB_URL_SECRET }}",
                "--spark-remote", "{{ var.value.SPARK_CONNECT_URL }}",
                "--start-date", "{{ ds }}",
                "--end-date", "{{ next_ds }}",
                "--bulk",
            ],
            verbose=True,
        )
        for table in TABLES
    ]

    start >> tasks >> end
