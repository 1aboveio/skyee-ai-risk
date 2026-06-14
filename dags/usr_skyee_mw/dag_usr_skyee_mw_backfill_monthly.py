"""
Airflow DAG: Backfill large stg_* tables and graph edges monthly.

Schedule: @monthly from 2016-09-01
Catchup: enabled

Tables: pmp_coll_order, cust_user_login_log, pmp_pay_details, pmp_pay_order

Graph:
    dwd_graph_edge_monthly is rebuilt for the same monthly window.
    dwd_graph_edges is refreshed by the daily DAG from monthly evidence.

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

TABLES = ["pmp_coll_order", "cust_user_login_log", "pmp_pay_details", "pmp_pay_order"]


with DAG(
    dag_id="usr_skyee_mw_backfill_monthly",
    default_args=default_args,
    description="Backfill large stg_* tables (monthly)",
    schedule="@monthly",
    start_date=datetime(2016, 9, 1),
    catchup=True,
    max_active_runs=1,
    max_active_tasks=4,
    tags=["backfill", "usr_skyee_mw"],
):

    start = EmptyOperator(task_id="start")
    end = EmptyOperator(task_id="end")

    stg_tasks = [
        SparkSubmitOperator(
            task_id=f"stg_{table}",
            name=f"usr_skyee_mw.backfill.monthly.stg.{table}.{{{{ ds }}}}",
            application=f"{SCRIPTS_PATH}/stg_{table}.py",
            conn_id="spark_default",
            application_args=[
                "--url", "jdbc:mysql://{{ var.value.MYSQL_DB_URL_SECRET }}",
                "--start-date", "{{ ds }}",
                "--end-date", "{{ next_ds }}",
                "--bulk",
            ],
            verbose=True,
        )
        for table in TABLES
    ]

    graph_edge_monthly = SparkSubmitOperator(
        task_id="dwd_graph_edge_monthly",
        name="usr_skyee_mw.backfill.monthly.dwd.graph_edge_monthly.{{ ds }}",
        application=f"{SCRIPTS_PATH}/dwd_graph_edges.py",
        conn_id="spark_default",
        application_args=[
            "--start-date", "{{ ds }}",
            "--end-date", "{{ next_ds }}",
            "--bulk",
            "--max-degree", "100",
            "--target", "monthly",
        ],
        verbose=True,
    )

    start >> stg_tasks >> graph_edge_monthly >> end
