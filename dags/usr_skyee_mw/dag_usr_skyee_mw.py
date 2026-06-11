"""
Airflow DAG: Sync MySQL usr_skyee_mw tables to Hudi via Spark Connect.

Schedule: Daily at 02:00 AM

Variables:
    MYSQL_DB_URL_SECRET - MySQL JDBC URL with credentials
    SPARK_CONNECT_URL   - Spark Connect server URL
"""

from datetime import datetime, timedelta
from airflow import DAG
from airflow.models import Variable
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

    for table in TABLES:
        sync_task = SparkSubmitOperator(
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

        start >> sync_task >> end
