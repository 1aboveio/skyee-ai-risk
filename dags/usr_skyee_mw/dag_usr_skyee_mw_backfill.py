"""
Airflow DAG: Backfill MySQL usr_skyee_mw stg_* tables to Hudi via Spark Connect.

Supports hybrid processing:
- Large tables (pmp_coll_order, cust_user_login_log): monthly processing
- Other tables: yearly processing

Trigger with conf:
    {
        "start_date": "2016-09-01",
        "end_date": "2025-01-01"
    }

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

# Large tables that need monthly processing
LARGE_TABLES = {"pmp_coll_order", "cust_user_login_log"}

# Regular tables that can be processed yearly
YEARLY_TABLES = [
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
]


with DAG(
    dag_id="usr_skyee_mw_backfill",
    default_args=default_args,
    description="Backfill MySQL usr_skyee_mw stg_* tables to Hudi",
    schedule_interval=None,  # Manual trigger only
    start_date=datetime(2026, 6, 1),
    catchup=False,
    tags=["backfill", "mysql", "hudi", "usr_skyee_mw"],
) as dag:

    start = EmptyOperator(task_id="start")
    end = EmptyOperator(task_id="end")

    # ── Yearly tables (one task per table, full date range) ──
    yearly_tasks = []
    for table in YEARLY_TABLES:
        task = SparkSubmitOperator(
            task_id=f"yearly_{table}",
            application=f"{SCRIPTS_PATH}/stg_{table}.py",
            conn_id="spark_default",
            application_args=[
                "--url",
                "jdbc:mysql://{{ var.value.MYSQL_DB_URL_SECRET }}",
                "--spark-remote",
                "{{ var.value.SPARK_CONNECT_URL }}",
                "--start-date",
                "{{ dag_run.conf.start_date if dag_run.conf else '2016-09-01' }}",
                "--end-date",
                "{{ dag_run.conf.end_date if dag_run.conf else '2025-01-01' }}",
                "--bulk",
            ],
            verbose=True,
        )
        yearly_tasks.append(task)

    # ── Monthly tables (pre-defined 12 months) ──
    monthly_tasks = []

    for month_idx in range(12):
        if month_idx == 0:
            start_expr = "{{ dag_run.conf.start_date if dag_run.conf else '2016-09-01' }}"
        else:
            start_expr = (
                "{{ (macros.datetime.strptime("
                "dag_run.conf.start_date if dag_run.conf else '2016-09-01', "
                "'%Y-%m-%d') + macros.dateutil.relativedelta.relativedelta(months=" + str(month_idx) + ")"
                ").strftime('%Y-%m-%d') }}"
            )

        end_expr = (
            "{{ (macros.datetime.strptime("
            "dag_run.conf.start_date if dag_run.conf else '2016-09-01', "
            "'%Y-%m-%d') + macros.dateutil.relativedelta.relativedelta(months=" + str(month_idx + 1) + ")"
            ").strftime('%Y-%m-%d') }}"
        )

        for table in LARGE_TABLES:
            task = SparkSubmitOperator(
                task_id=f"monthly_{table}_{month_idx:02d}",
                application=f"{SCRIPTS_PATH}/stg_{table}.py",
                conn_id="spark_default",
                application_args=[
                    "--url",
                    "jdbc:mysql://{{ var.value.MYSQL_DB_URL_SECRET }}",
                    "--spark-remote",
                    "{{ var.value.SPARK_CONNECT_URL }}",
                    "--start-date",
                    start_expr,
                    "--end-date",
                    end_expr,
                    "--bulk",
                ],
                verbose=True,
            )
            monthly_tasks.append(task)

    # ── Dependencies ──
    start >> yearly_tasks >> end
    start >> monthly_tasks >> end
