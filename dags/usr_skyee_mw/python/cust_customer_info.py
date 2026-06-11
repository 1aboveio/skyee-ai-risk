"""
Sync cust_customer_info from MySQL to Hudi via Spark Connect.

Usage:
    python sync_cust_customer_info.py --url <mysql_jdbc_url> --spark-remote <spark_connect_url> [options]

Options:
    --url           MySQL JDBC URL (required)
    --spark-remote  Spark Connect server URL (required)
    --start-date    Start date for incremental sync (YYYY-MM-DD)
    --end-date      End date for incremental sync (YYYY-MM-DD)
    --bulk/--per-day  Bulk or per-day processing (default: bulk)
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from utils.etl import MySqlEtl
from pyspark.sql import SparkSession
from pyspark.sql.functions import col
from typing_extensions import Annotated
import typer


class CustCustomerInfoEtl(MySqlEtl):
    """ETL for cust_customer_info table."""

    # Source
    src_db = "usr_skyee_mw"
    src_tbl = "cust_customer_info"

    # Destination
    dst_db = "usr_skyee_mw"
    dst_tbl = "stg_cust_customer_info"
    path = "/user/hive/warehouse/usr_skyee_mw.db/stg_cust_customer_info"

    # Keys
    id = "CUST_ID"
    ts = "LST_UPD_TIME"
    filter_by = "CREATE_TIME"

    # Partition
    par_cols = ["dt"]

    # Hudi settings
    table_type = "hudi_table"
    hudi_mode = "insert_overwrite"
    concurrency_mode = "SINGLE_WRITER"

    def transform(self, df):
        """Apply transformations before loading."""
        return df.withColumn("dt", col("CREATE_TIME").cast("date"))


def main(
    url: Annotated[str, typer.Option("--url")],
    spark_remote: Annotated[str, typer.Option("--spark-remote")],
    start_date: Annotated[str, typer.Option("--start-date")] = None,
    end_date: Annotated[str, typer.Option("--end-date")] = None,
    bulk: Annotated[bool, typer.Option("--bulk/--per-day")] = True,
):
    # Init Spark Connect session
    spark = SparkSession.builder.remote(spark_remote).getOrCreate()

    # Run ETL
    etl = CustCustomerInfoEtl(
        url=url,
        start_date=start_date,
        end_date=end_date,
        bulk=bulk,
    )
    etl.spark = spark
    etl()

    spark.stop()


if __name__ == "__main__":
    typer.run(main)
