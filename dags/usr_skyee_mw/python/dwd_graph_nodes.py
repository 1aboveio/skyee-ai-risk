"""Generate dwd_graph_nodes from STG customer data.

Usage:
    python dwd_graph_nodes.py --spark-remote <spark_connect_url> [--start-date <YYYY-MM-DD>] [--end-date <YYYY-MM-DD>] [--bulk/--per-day]
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pyspark.sql import DataFrame
from pyspark.sql.functions import col, lit, when
from typing_extensions import Annotated
import typer

from utils.etl import Etl


class DwdGraphNodesEtl(Etl):
    """Customer nodes in the relationship graph.

    Grain: one row per customer (cust_id).

    The node table is intentionally idempotent and customer-sourced only.
    Edge-derived metrics such as degree are computed in the query layer or in a
    separate metrics table, because they change whenever edges change.
    """

    src_db = "usr_skyee_mw"
    src_tbl = "stg_cust_customer_info"
    dst_db = "usr_skyee_mw"
    dst_tbl = "dwd_graph_nodes"
    id = "cust_id"
    ts = "last_seen"
    filter_by = None
    par_cols = ["dt"]
    path = "/user/hive/warehouse/usr_skyee_mw.db/dwd_graph_nodes"
    table_type = "hudi_table"
    hudi_mode = "upsert"
    concurrency_mode = "SINGLE_WRITER"

    def extract(self, start_date: str = None, end_date: str = None) -> DataFrame:
        # Customer count is modest, and this avoids missing updates to existing
        # customers whose CREATE_TIME is outside the current daily window.
        return self.spark.table(f"{self.src_db}.{self.src_tbl}")

    def transform(self, df: DataFrame) -> DataFrame:
        return df.select(
            col("cust_id").cast("long").alias("cust_id"),
            col("cust_type"),
            col("cust_name"),
            col("en_name"),
            col("risk_level"),
            col("risk_score"),
            col("sanctioned").alias("is_sanctioned"),
            col("high_risk").alias("is_high_risk"),
            col("cust_status"),
            col("regist_country"),
            col("create_time").alias("first_seen"),
            col("lst_upd_time").alias("last_seen"),
            when(col("risk_level").isin("HIGH", "MEDIUM_HIGH"), lit("Y"))
            .otherwise(lit("N"))
            .alias("is_risk"),
            col("create_time").cast("date").alias("dt"),
        )


def main(
    spark_remote: Annotated[str, typer.Option("--spark-remote")],
    start_date: Annotated[str, typer.Option("--start-date")] = None,
    end_date: Annotated[str, typer.Option("--end-date")] = None,
    bulk: Annotated[bool, typer.Option("--bulk/--per-day")] = True,
):
    from pyspark.sql import SparkSession

    spark = SparkSession.builder.remote(spark_remote).getOrCreate()
    etl = DwdGraphNodesEtl(
        start_date=start_date,
        end_date=end_date,
        bulk=bulk,
    )
    etl.spark = spark
    etl()
    spark.stop()


if __name__ == "__main__":
    typer.run(main)
