"""
Sync cust_customer_info from MySQL to Hudi.

Usage:
    spark-submit --master yarn sync_cust_customer_info.py --url <mysql_jdbc_url> [options]

Options:
    --url           MySQL JDBC URL (required)
    --start-date    Start date for incremental sync (YYYY-MM-DD)
    --end-date      End date for incremental sync (YYYY-MM-DD)
    --bulk/--per-day  Bulk or per-day processing (default: bulk)
    --hudi-mode     Hudi write operation (default: upsert)
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from utils.etl import MySqlEtl
from pyspark.sql.types import *
from pyspark.sql.functions import *


class CustCustomerInfoEtl(MySqlEtl):
    """ETL for cust_customer_info table."""

    # Source
    src_db = "usr_skyee_mw"
    src_tbl = "cust_customer_info"

    # Destination
    dst_db = "usr_skyee_mw"
    dst_tbl = "cust_customer_info"
    path = "/user/hive/warehouse/usr_skyee_mw.db/cust_customer_info"

    # Keys
    id = "CUST_ID"
    ts = "LST_UPD_TIME"
    filter_by = "LST_UPD_TIME"

    # Partition
    par_cols = ["LST_UPD_DATE"]

    # Hudi settings
    table_type = "hudi_table"
    hudi_mode = "upsert"
    concurrency_mode = "SINGLE_WRITER"

    def transform(self, df):
        """Apply transformations before loading."""
        return df.withColumn("LST_UPD_DATE", col("LST_UPD_TIME").cast("date"))


if __name__ == "__main__":
    CustCustomerInfoEtl.run_from_cli()
