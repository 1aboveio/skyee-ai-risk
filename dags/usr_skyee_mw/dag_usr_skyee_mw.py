"""
Airflow DAG: Sync MySQL usr_skyee_mw tables to Hudi via spark-submit.

Schedule: Daily at 02:00 AM

Variables:
    MYSQL_DB_URL_SECRET - MySQL JDBC URL with credentials
"""

from datetime import datetime, timedelta
from airflow import DAG
from airflow.providers.apache.spark.operators.spark_submit import SparkSubmitOperator
from airflow.operators.empty import EmptyOperator

# Default args
default_args = {
    "owner": "data-team",
    "depends_on_past": False,
    "email_on_failure": True,
    "email_on_retry": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}

# Scripts path
SCRIPTS_PATH = "/opt/airflow/dags/usr_skyee_mw/python"
LOCAL_INTERVAL_START = "{{ data_interval_start.in_timezone('Asia/Shanghai').strftime('%Y-%m-%d') }}"
LOCAL_INTERVAL_END = "{{ data_interval_end.in_timezone('Asia/Shanghai').strftime('%Y-%m-%d') }}"

# Tables to sync
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
    "cust_user_login_log",
    "pmp_coll_order",
    "pmp_pay_details",
    "pmp_pay_order",
]

with DAG(
    dag_id="usr_skyee_mw",
    default_args=default_args,
    description="Sync MySQL usr_skyee_mw tables to Hudi",
    schedule_interval="0 2 * * *",
    start_date=datetime(2026, 6, 1),
    catchup=False,
    tags=["mysql", "hudi", "usr_skyee_mw"],
) as dag:

    start = EmptyOperator(task_id="start")
    end = EmptyOperator(task_id="end")
    stg_tasks = []

    for table in TABLES:
        sync_task = SparkSubmitOperator(
            task_id=f"stg_{table}",
            name=f"usr_skyee_mw.stg.{table}.{LOCAL_INTERVAL_START}",
            application=f"{SCRIPTS_PATH}/stg_{table}.py",
            conn_id="spark_default",
            application_args=[
                "--url", "jdbc:mysql://{{ var.value.MYSQL_DB_URL_SECRET }}",
                "--start-date", LOCAL_INTERVAL_START,
                "--end-date", LOCAL_INTERVAL_END,
                "--bulk",
            ],
            verbose=True,
        )

        start >> sync_task
        stg_tasks.append(sync_task)

    reconcile_mysql_to_stg = SparkSubmitOperator(
        task_id="reconcile_mysql_to_stg",
        name=f"usr_skyee_mw.dq.mysql_to_stg.{LOCAL_INTERVAL_START}",
        application=f"{SCRIPTS_PATH}/reconcile_mysql_to_stg.py",
        conn_id="spark_default",
        application_args=[
            "--url", "jdbc:mysql://{{ var.value.MYSQL_DB_URL_SECRET }}",
            "--start-date", LOCAL_INTERVAL_START,
            "--end-date", LOCAL_INTERVAL_END,
            "--run-id", "{{ run_id }}",
            "--fail-on-mismatch",
            "--write-results",
        ],
        verbose=True,
    )

    graph_edge_monthly = SparkSubmitOperator(
        task_id="dwd_graph_edge_monthly",
        name=f"usr_skyee_mw.dwd.graph_edge_monthly.{LOCAL_INTERVAL_START}",
        application=f"{SCRIPTS_PATH}/dwd_graph_edges.py",
        conn_id="spark_default",
        application_args=[
            "--start-date", LOCAL_INTERVAL_START,
            "--end-date", LOCAL_INTERVAL_END,
            "--bulk",
            "--max-degree", "100",
            "--use-attr-index",
            "--write-attr-index",
            "--target", "monthly",
        ],
        verbose=True,
    )

    graph_edges = SparkSubmitOperator(
        task_id="dwd_graph_edges",
        name=f"usr_skyee_mw.dwd.graph_edges.{LOCAL_INTERVAL_START}",
        application=f"{SCRIPTS_PATH}/dwd_graph_edges.py",
        conn_id="spark_default",
        application_args=[
            "--bulk",
            "--snapshot-hudi-mode", "insert_overwrite_table",
            "--target", "snapshot",
        ],
        verbose=True,
    )

    dwd_customer = SparkSubmitOperator(
        task_id="dwd_customer",
        name=f"usr_skyee_mw.dwd.customer.{LOCAL_INTERVAL_START}",
        application=f"{SCRIPTS_PATH}/dwd_customer.py",
        conn_id="spark_default",
        application_args=[
            "--bulk",
        ],
        verbose=True,
    )

    dwd_transaction = SparkSubmitOperator(
        task_id="dwd_transaction",
        name=f"usr_skyee_mw.dwd.transaction.{LOCAL_INTERVAL_START}",
        application=f"{SCRIPTS_PATH}/dwd_transaction.py",
        conn_id="spark_default",
        application_args=[
            "--start-date", LOCAL_INTERVAL_START,
            "--end-date", LOCAL_INTERVAL_END,
            "--bulk",
        ],
        verbose=True,
    )

    reconcile_stg_to_dwd_transaction = SparkSubmitOperator(
        task_id="reconcile_stg_to_dwd_transaction",
        name=f"usr_skyee_mw.dq.stg_to_dwd_transaction.{LOCAL_INTERVAL_START}",
        application=f"{SCRIPTS_PATH}/reconcile_stg_to_dwd_transaction.py",
        conn_id="spark_default",
        application_args=[
            "--start-date", LOCAL_INTERVAL_START,
            "--end-date", LOCAL_INTERVAL_END,
            "--run-id", "{{ run_id }}",
            "--fail-on-mismatch",
            "--write-results",
        ],
        verbose=True,
    )

    graph_nodes = SparkSubmitOperator(
        task_id="dwd_graph_nodes",
        name=f"usr_skyee_mw.dwd.graph_nodes.{LOCAL_INTERVAL_START}",
        application=f"{SCRIPTS_PATH}/dwd_graph_nodes.py",
        conn_id="spark_default",
        application_args=[
            "--bulk",
        ],
        verbose=True,
    )

    stg_tasks >> reconcile_mysql_to_stg
    reconcile_mysql_to_stg >> graph_edge_monthly >> graph_edges >> graph_nodes
    reconcile_mysql_to_stg >> dwd_customer >> dwd_transaction
    dwd_transaction >> reconcile_stg_to_dwd_transaction
    [graph_nodes, reconcile_stg_to_dwd_transaction] >> end
