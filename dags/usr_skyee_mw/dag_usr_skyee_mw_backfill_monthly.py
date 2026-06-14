"""
Airflow DAG: Backfill graph attributes monthly.

Schedule: @monthly from 2016-09-01
Catchup: enabled

Skipped staging tables already backfilled:
    pmp_coll_order, cust_user_login_log, pmp_pay_details, pmp_pay_order

Graph:
    dwd_graph_attr_index is rebuilt for the same monthly window.
    dwd_graph_edge_monthly can still be rebuilt from monthly source data when
    pairwise warehouse edges are needed.
"""

from datetime import datetime, timedelta

from airflow import DAG
from airflow.providers.apache.spark.operators.spark_submit import SparkSubmitOperator
from airflow.operators.empty import EmptyOperator

SCRIPTS_PATH = "/opt/airflow/dags/usr_skyee_mw/python"
LOCAL_INTERVAL_START = "{{ data_interval_start.in_timezone('Asia/Shanghai').strftime('%Y-%m-%d') }}"
LOCAL_INTERVAL_END = "{{ data_interval_end.in_timezone('Asia/Shanghai').strftime('%Y-%m-%d') }}"

default_args = {
    "owner": "data-team",
    "depends_on_past": False,
    "email_on_failure": True,
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

BACKFILLED_STG_TABLES = [
    "pmp_coll_order",
    "cust_user_login_log",
    "pmp_pay_details",
    "pmp_pay_order",
]


with DAG(
    dag_id="usr_skyee_mw_backfill_monthly",
    default_args=default_args,
    description="Skip completed stg backfills and rebuild graph attributes monthly",
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
        EmptyOperator(task_id=f"stg_{table}")
        for table in BACKFILLED_STG_TABLES
    ]

    graph_attr_index = SparkSubmitOperator(
        task_id="dwd_graph_attr_index",
        name=f"usr_skyee_mw.backfill.monthly.dwd.graph_attr_index.{LOCAL_INTERVAL_START}",
        application=f"{SCRIPTS_PATH}/dwd_graph_edges.py",
        conn_id="spark_default",
        application_args=[
            "--start-date", LOCAL_INTERVAL_START,
            "--end-date", LOCAL_INTERVAL_END,
            "--bulk",
            "--no-use-attr-index",
            "--write-attr-index",
            "--target", "attr-index",
        ],
        verbose=True,
    )

    graph_edge_monthly = SparkSubmitOperator(
        task_id="dwd_graph_edge_monthly",
        name=f"usr_skyee_mw.backfill.monthly.dwd.graph_edge_monthly.{LOCAL_INTERVAL_START}",
        application=f"{SCRIPTS_PATH}/dwd_graph_edges.py",
        conn_id="spark_default",
        application_args=[
            "--start-date", LOCAL_INTERVAL_START,
            "--end-date", LOCAL_INTERVAL_END,
            "--bulk",
            "--max-degree", "100",
            "--no-use-attr-index",
            "--no-write-attr-index",
            "--target", "monthly",
        ],
        verbose=True,
    )

    start >> stg_tasks >> graph_attr_index >> graph_edge_monthly >> end
