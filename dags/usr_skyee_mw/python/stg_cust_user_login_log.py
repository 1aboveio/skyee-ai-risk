"""
Sync cust_user_login_log from MySQL to Hudi via Spark Connect.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from utils.etl import MySqlEtl, create_spark_session
from pyspark.sql.functions import col
from typing import Optional
from typing_extensions import Annotated
import typer


class StgCustUserLoginLogEtl(MySqlEtl):
    src_db = "usr_skyee_mw"
    src_tbl = "cust_user_login_log"
    dst_db = "usr_skyee_mw"
    dst_tbl = "stg_cust_user_login_log"
    path = "/user/hive/warehouse/usr_skyee_mw.db/stg_cust_user_login_log"
    id = "ID"
    ts = "LST_UPD_TIME"
    filter_by = "CREATE_TIME"
    par_cols = ["dt"]
    table_type = "hudi_table"
    hudi_mode = "insert_overwrite"
    concurrency_mode = "SINGLE_WRITER"

    def transform(self, df):
        return df.withColumn("dt", col("CREATE_TIME").cast("date"))


def main(
    url: Annotated[str, typer.Option("--url")],
    spark_remote: Annotated[Optional[str], typer.Option("--spark-remote")] = None,
    start_date: Annotated[str, typer.Option("--start-date")] = None,
    end_date: Annotated[str, typer.Option("--end-date")] = None,
    bulk: Annotated[bool, typer.Option("--bulk/--per-day")] = True,
):
    spark = create_spark_session(spark_remote)
    etl = StgCustUserLoginLogEtl(url=url, start_date=start_date, end_date=end_date, bulk=bulk)
    etl.spark = spark
    etl()
    spark.stop()


if __name__ == "__main__":
    typer.run(main)
