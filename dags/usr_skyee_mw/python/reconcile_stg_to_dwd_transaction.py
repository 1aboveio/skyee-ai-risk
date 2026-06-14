"""Reconcile STG payment/collection rows against dwd_transaction.

Daily DAG usage:
    spark-submit reconcile_stg_to_dwd_transaction.py \
        --start-date 2026-06-13 \
        --end-date 2026-06-14 \
        --run-id scheduled__2026-06-13
"""

import json
import os
import sys
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Iterable, List, Optional

import typer
from pyspark.sql import DataFrame, Row, SparkSession
from pyspark.sql.functions import (
    col,
    concat,
    count,
    lit,
    max as spark_max,
    min as spark_min,
    sum as spark_sum,
    when,
)
from pyspark.sql.types import (
    BooleanType,
    DateType,
    DecimalType,
    LongType,
    StringType,
    StructField,
    StructType,
    TimestampType,
)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from utils.etl import create_spark_session  # noqa: E402


DB = "usr_skyee_mw"
AUDIT_TABLE = "dq_stg_dwd_reconciliation"
AUDIT_PATH = f"/user/hive/warehouse/{DB}.db/{AUDIT_TABLE}"
AMOUNT_COLUMNS = ("txn_amount", "txn_amount_cny", "commission_amount")


AUDIT_SCHEMA = StructType(
    [
        StructField("reconcile_id", StringType(), False),
        StructField("run_id", StringType(), False),
        StructField("dwd_table", StringType(), False),
        StructField("source_scope", StringType(), False),
        StructField("transaction_source", StringType(), False),
        StructField("window_start", DateType(), False),
        StructField("window_end", DateType(), False),
        StructField("bucket_date", DateType(), False),
        StructField("source_count", LongType(), False),
        StructField("dwd_count", LongType(), False),
        StructField("count_delta", LongType(), False),
        StructField("source_min_txn_id", StringType(), True),
        StructField("dwd_min_txn_id", StringType(), True),
        StructField("source_max_txn_id", StringType(), True),
        StructField("dwd_max_txn_id", StringType(), True),
        StructField("min_txn_id_matches", BooleanType(), False),
        StructField("max_txn_id_matches", BooleanType(), False),
        StructField("amount_sums_json", StringType(), False),
        StructField("status", StringType(), False),
        StructField("severity", StringType(), False),
        StructField("checked_at", TimestampType(), False),
        StructField("check_date", DateType(), False),
    ]
)


def _parse_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def _date_range(start_date: date, end_date: date) -> Iterable[date]:
    current = start_date
    while current < end_date:
        yield current
        current += timedelta(days=1)


def _json_default(value):
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)


def _active(alias: str):
    return col(f"{alias}.delete_flag").isNull() | (col(f"{alias}.delete_flag") != lit("Y"))


def _window_filter(df: DataFrame, start_date: date, end_date: date) -> DataFrame:
    return df.filter(col("dt") >= lit(start_date.isoformat()).cast("date")).filter(
        col("dt") < lit(end_date.isoformat()).cast("date")
    )


def _expected_collection_rows(spark: SparkSession, start_date: date, end_date: date) -> DataFrame:
    co = _window_filter(spark.table(f"{DB}.stg_pmp_coll_order"), start_date, end_date).alias(
        "co"
    )
    return co.filter(_active("co")).select(
        col("co.dt").cast("date").alias("bucket_date"),
        lit("COLL").alias("transaction_source"),
        concat(lit("COLL:"), col("co.coll_order_id").cast("string")).alias("txn_id"),
        col("co.coll_txn_amt").cast(DecimalType(38, 6)).alias("txn_amount"),
        col("co.coll_txn_cny_amt").cast(DecimalType(38, 6)).alias("txn_amount_cny"),
        col("co.commission_amt").cast(DecimalType(38, 6)).alias("commission_amount"),
    )


def _expected_pay_rows(spark: SparkSession, start_date: date, end_date: date) -> DataFrame:
    pd = _window_filter(spark.table(f"{DB}.stg_pmp_pay_details"), start_date, end_date).alias(
        "pd"
    )
    po = spark.table(f"{DB}.stg_pmp_pay_order").alias("po")
    return (
        pd.join(po, col("pd.pay_order_id") == col("po.pay_order_id"), "left")
        .filter(_active("pd") & _active("po"))
        .select(
            col("pd.dt").cast("date").alias("bucket_date"),
            lit("PAY").alias("transaction_source"),
            concat(lit("PAY:"), col("pd.id").cast("string")).alias("txn_id"),
            col("pd.pay_txn_amt").cast(DecimalType(38, 6)).alias("txn_amount"),
            col("pd.pay_txn_amt_cny").cast(DecimalType(38, 6)).alias("txn_amount_cny"),
            col("pd.commission_amt").cast(DecimalType(38, 6)).alias("commission_amount"),
        )
    )


def _aggregate(df: DataFrame, count_alias: str, min_alias: str, max_alias: str) -> DataFrame:
    aggregations = [
        count(lit(1)).alias(count_alias),
        spark_min(col("txn_id")).alias(min_alias),
        spark_max(col("txn_id")).alias(max_alias),
    ]
    for amount_column in AMOUNT_COLUMNS:
        aggregations.append(
            spark_sum(col(amount_column).cast(DecimalType(38, 6))).alias(
                f"{amount_column}_sum"
            )
        )
    return df.groupBy("bucket_date", "transaction_source").agg(*aggregations)


def _expected_aggregates(
    spark: SparkSession, start_date: date, end_date: date
) -> DataFrame:
    expected = _expected_collection_rows(spark, start_date, end_date).unionByName(
        _expected_pay_rows(spark, start_date, end_date)
    )
    return _aggregate(expected, "source_count", "source_min_txn_id", "source_max_txn_id")


def _dwd_aggregates(spark: SparkSession, start_date: date, end_date: date) -> DataFrame:
    dwd = (
        _window_filter(spark.table(f"{DB}.dwd_transaction"), start_date, end_date)
        .filter(col("transaction_source").isin("COLL", "PAY"))
        .select(
            col("dt").cast("date").alias("bucket_date"),
            col("transaction_source"),
            col("txn_id"),
            col("txn_amount").cast(DecimalType(38, 6)).alias("txn_amount"),
            col("txn_amount_cny").cast(DecimalType(38, 6)).alias("txn_amount_cny"),
            col("commission_amount").cast(DecimalType(38, 6)).alias("commission_amount"),
        )
    )
    return _aggregate(dwd, "dwd_count", "dwd_min_txn_id", "dwd_max_txn_id")


def _decimal_or_zero(value) -> Decimal:
    return Decimal(str(value or "0"))


def _string_or_none(value) -> Optional[str]:
    if value is None:
        return None
    return str(value)


def _same_string(left: Optional[str], right: Optional[str]) -> bool:
    return (left or "") == (right or "")


def _field(row: Row, name: str, default=None):
    if name not in row.asDict(recursive=False):
        return default
    value = row[name]
    return default if value is None else value


def build_audit_rows(
    spark: SparkSession,
    start_date: date,
    end_date: date,
    run_id: str,
    checked_at: datetime,
) -> List[Row]:
    source = _expected_aggregates(spark, start_date, end_date).alias("source")
    dwd = _dwd_aggregates(spark, start_date, end_date).alias("dwd")
    joined = source.join(
        dwd,
        (col("source.bucket_date") == col("dwd.bucket_date"))
        & (col("source.transaction_source") == col("dwd.transaction_source")),
        "full_outer",
    ).select(
        when(col("source.bucket_date").isNotNull(), col("source.bucket_date"))
        .otherwise(col("dwd.bucket_date"))
        .alias("bucket_date"),
        when(col("source.transaction_source").isNotNull(), col("source.transaction_source"))
        .otherwise(col("dwd.transaction_source"))
        .alias("transaction_source"),
        col("source.source_count"),
        col("dwd.dwd_count"),
        col("source.source_min_txn_id"),
        col("dwd.dwd_min_txn_id"),
        col("source.source_max_txn_id"),
        col("dwd.dwd_max_txn_id"),
        *[
            col(f"source.{amount_column}_sum").alias(f"source_{amount_column}_sum")
            for amount_column in AMOUNT_COLUMNS
        ],
        *[
            col(f"dwd.{amount_column}_sum").alias(f"dwd_{amount_column}_sum")
            for amount_column in AMOUNT_COLUMNS
        ],
    )

    rows = joined.collect()
    if not rows:
        empty_rows = []
        for bucket in _date_range(start_date, end_date):
            for transaction_source in ("COLL", "PAY"):
                empty_rows.append(
                    Row(bucket_date=bucket, transaction_source=transaction_source)
                )
        rows = empty_rows

    audit_rows = []
    for row in rows:
        bucket = row["bucket_date"]
        transaction_source = row["transaction_source"]
        source_count = int(_field(row, "source_count", 0))
        dwd_count = int(_field(row, "dwd_count", 0))
        source_min_txn_id = _string_or_none(_field(row, "source_min_txn_id"))
        dwd_min_txn_id = _string_or_none(_field(row, "dwd_min_txn_id"))
        source_max_txn_id = _string_or_none(_field(row, "source_max_txn_id"))
        dwd_max_txn_id = _string_or_none(_field(row, "dwd_max_txn_id"))
        amount_sums = {}
        amount_mismatch = False

        for amount_column in AMOUNT_COLUMNS:
            source_sum = _field(row, f"source_{amount_column}_sum")
            dwd_sum = _field(row, f"dwd_{amount_column}_sum")
            delta = _decimal_or_zero(dwd_sum) - _decimal_or_zero(source_sum)
            amount_sums[amount_column] = {
                "source": source_sum,
                "dwd": dwd_sum,
                "delta": delta,
            }
            amount_mismatch = amount_mismatch or delta != 0

        count_delta = dwd_count - source_count
        min_txn_id_matches = _same_string(source_min_txn_id, dwd_min_txn_id)
        max_txn_id_matches = _same_string(source_max_txn_id, dwd_max_txn_id)
        status = (
            "PASS"
            if count_delta == 0
            and min_txn_id_matches
            and max_txn_id_matches
            and not amount_mismatch
            else "FAIL"
        )
        reconcile_id = "|".join(
            [
                run_id,
                "dwd_transaction",
                transaction_source,
                bucket.isoformat(),
                start_date.isoformat(),
                end_date.isoformat(),
            ]
        )

        audit_rows.append(
            Row(
                reconcile_id=reconcile_id,
                run_id=run_id,
                dwd_table=f"{DB}.dwd_transaction",
                source_scope="stg_pmp_coll_order+stg_pmp_pay_details+stg_pmp_pay_order",
                transaction_source=transaction_source,
                window_start=start_date,
                window_end=end_date,
                bucket_date=bucket,
                source_count=source_count,
                dwd_count=dwd_count,
                count_delta=count_delta,
                source_min_txn_id=source_min_txn_id,
                dwd_min_txn_id=dwd_min_txn_id,
                source_max_txn_id=source_max_txn_id,
                dwd_max_txn_id=dwd_max_txn_id,
                min_txn_id_matches=min_txn_id_matches,
                max_txn_id_matches=max_txn_id_matches,
                amount_sums_json=json.dumps(amount_sums, default=_json_default, sort_keys=True),
                status=status,
                severity="BLOCKING",
                checked_at=checked_at,
                check_date=checked_at.date(),
            )
        )
    return audit_rows


def _hudi_table_exists(spark: SparkSession) -> bool:
    try:
        spark.read.text(f"{AUDIT_PATH}/.hoodie/hoodie.properties").limit(1).collect()
        return True
    except Exception:
        return False


def write_audit(spark: SparkSession, df: DataFrame):
    operation = "upsert" if _hudi_table_exists(spark) else "bulk_insert"
    hudi_options = {
        "hoodie.table.name": f"{DB}.{AUDIT_TABLE}",
        "hoodie.datasource.write.table.type": "COPY_ON_WRITE",
        "hoodie.datasource.write.recordkey.field": "reconcile_id",
        "hoodie.datasource.write.partitionpath.field": "check_date",
        "hoodie.datasource.write.precombine.field": "checked_at",
        "hoodie.datasource.write.operation": operation,
        "hoodie.datasource.write.reconcile.schema": True,
        "hoodie.schema.on.read.enable": True,
        "hoodie.write.complex.keygen.new.encoding": True,
        "hoodie.datasource.hive_sync.enable": True,
        "hoodie.datasource.hive_sync.create_managed_table": True,
        "hoodie.datasource.hive_sync.database": DB,
        "hoodie.datasource.hive_sync.table": AUDIT_TABLE,
        "hoodie.datasource.hive_sync.skip_ro_suffix": False,
        "hoodie.datasource.hive_sync.support_timestamp": True,
        "hoodie.datasource.write.hive_style_partitioning": True,
        "hoodie.metadata.enable": False,
        "path": AUDIT_PATH,
    }
    df.write.format("hudi").options(**hudi_options).mode("append").save()


def main(
    spark_remote: Optional[str] = typer.Option(None, "--spark-remote"),
    start_date: str = typer.Option(..., "--start-date"),
    end_date: str = typer.Option(..., "--end-date"),
    run_id: str = typer.Option("manual", "--run-id"),
    fail_on_mismatch: bool = typer.Option(True, "--fail-on-mismatch/--no-fail-on-mismatch"),
    write_results: bool = typer.Option(True, "--write-results/--no-write-results"),
):
    spark = create_spark_session(spark_remote)
    checked_at = datetime.utcnow()
    start = _parse_date(start_date)
    end = _parse_date(end_date)
    if end <= start:
        raise typer.BadParameter("--end-date must be after --start-date")

    audit_rows = build_audit_rows(spark, start, end, run_id, checked_at)
    df = spark.createDataFrame(audit_rows, schema=AUDIT_SCHEMA)
    failures = df.filter(col("status") == lit("FAIL")).collect()
    if write_results:
        write_audit(spark, df)

    total = df.count()
    failed = len(failures)
    print(f"stg-to-dwd transaction reconciliation completed: total={total}, failed={failed}")
    for row in failures[:50]:
        print(
            "FAIL "
            f"source={row['transaction_source']} bucket={row['bucket_date']} "
            f"source_count={row['source_count']} dwd_count={row['dwd_count']} "
            f"count_delta={row['count_delta']} "
            f"source_min_txn_id={row['source_min_txn_id']} dwd_min_txn_id={row['dwd_min_txn_id']} "
            f"source_max_txn_id={row['source_max_txn_id']} dwd_max_txn_id={row['dwd_max_txn_id']}"
        )

    spark.stop()
    if failures and fail_on_mismatch:
        raise typer.Exit(code=1)


if __name__ == "__main__":
    typer.run(main)
