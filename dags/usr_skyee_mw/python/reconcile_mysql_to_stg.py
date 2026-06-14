"""Reconcile MySQL source tables against their STG Hudi tables.

Daily DAG usage:
    spark-submit reconcile_mysql_to_stg.py \
        --url jdbc:mysql://... \
        --start-date 2026-06-13 \
        --end-date 2026-06-14 \
        --run-id manual__2026-06-14
"""

import json
import os
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Dict, Iterable, List, Optional

import typer
from pyspark.sql import DataFrame, Row, SparkSession
from pyspark.sql.functions import col, count, lit, min as spark_min, max as spark_max
from pyspark.sql.functions import sum as spark_sum, to_date
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


SRC_DB = "usr_skyee_mw"
DST_DB = "usr_skyee_mw"
AUDIT_TABLE = "dq_mysql_stg_reconciliation"
AUDIT_PATH = f"/user/hive/warehouse/{DST_DB}.db/{AUDIT_TABLE}"


@dataclass(frozen=True)
class TableSpec:
    source_table: str
    stg_table: str
    id_column: str
    filter_column: str = "CREATE_TIME"
    amount_columns: tuple[str, ...] = ()


TABLE_SPECS: Dict[str, TableSpec] = {
    "cust_customer_info": TableSpec(
        source_table="cust_customer_info",
        stg_table="stg_cust_customer_info",
        id_column="CUST_ID",
    ),
    "cust_bank_acct_info": TableSpec(
        source_table="cust_bank_acct_info",
        stg_table="stg_cust_bank_acct_info",
        id_column="ID",
    ),
    "cust_collections_acct": TableSpec(
        source_table="cust_collections_acct",
        stg_table="stg_cust_collections_acct",
        id_column="ID",
    ),
    "cust_enterprise_realname_info": TableSpec(
        source_table="cust_enterprise_realname_info",
        stg_table="stg_cust_enterprise_realname_info",
        id_column="ID",
    ),
    "cust_foreign_trade_order": TableSpec(
        source_table="cust_foreign_trade_order",
        stg_table="stg_cust_foreign_trade_order",
        id_column="ID",
    ),
    "cust_foreign_trade_order_logistics": TableSpec(
        source_table="cust_foreign_trade_order_logistics",
        stg_table="stg_cust_foreign_trade_order_logistics",
        id_column="ID",
    ),
    "cust_person_realname_info": TableSpec(
        source_table="cust_person_realname_info",
        stg_table="stg_cust_person_realname_info",
        id_column="ID",
    ),
    "cust_realname_enterprise_ref_person": TableSpec(
        source_table="cust_realname_enterprise_ref_person",
        stg_table="stg_cust_realname_enterprise_ref_person",
        id_column="ID",
    ),
    "cust_store_info": TableSpec(
        source_table="cust_store_info",
        stg_table="stg_cust_store_info",
        id_column="ID",
    ),
    "cust_user_login_log": TableSpec(
        source_table="cust_user_login_log",
        stg_table="stg_cust_user_login_log",
        id_column="ID",
    ),
    "pmp_coll_order": TableSpec(
        source_table="pmp_coll_order",
        stg_table="stg_pmp_coll_order",
        id_column="COLL_ORDER_ID",
        amount_columns=("COLL_TXN_AMT", "COLL_TXN_CNY_AMT", "COMMISSION_AMT"),
    ),
    "pmp_pay_details": TableSpec(
        source_table="pmp_pay_details",
        stg_table="stg_pmp_pay_details",
        id_column="ID",
        amount_columns=("PAY_TXN_AMT", "PAY_TXN_AMT_CNY", "COMMISSION_AMT"),
    ),
    "pmp_pay_order": TableSpec(
        source_table="pmp_pay_order",
        stg_table="stg_pmp_pay_order",
        id_column="PAY_ORDER_ID",
    ),
}


AUDIT_SCHEMA = StructType(
    [
        StructField("reconcile_id", StringType(), False),
        StructField("run_id", StringType(), False),
        StructField("table_name", StringType(), False),
        StructField("source_table", StringType(), False),
        StructField("stg_table", StringType(), False),
        StructField("window_start", DateType(), False),
        StructField("window_end", DateType(), False),
        StructField("bucket_date", DateType(), False),
        StructField("mysql_count", LongType(), False),
        StructField("stg_count", LongType(), False),
        StructField("count_delta", LongType(), False),
        StructField("mysql_min_id", StringType(), True),
        StructField("stg_min_id", StringType(), True),
        StructField("mysql_max_id", StringType(), True),
        StructField("stg_max_id", StringType(), True),
        StructField("min_id_matches", BooleanType(), False),
        StructField("max_id_matches", BooleanType(), False),
        StructField("amount_sums_json", StringType(), False),
        StructField("status", StringType(), False),
        StructField("severity", StringType(), False),
        StructField("checked_at", TimestampType(), False),
        StructField("check_date", DateType(), False),
    ]
)


def _parse_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def _quote_mysql_identifier(identifier: str) -> str:
    return f"`{identifier.replace('`', '``')}`"


def _json_default(value):
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)


def _amount_alias(column_name: str) -> str:
    return f"sum__{column_name.lower()}"


def _date_range(start_date: date, end_date: date) -> Iterable[date]:
    current = start_date
    while current < end_date:
        yield current
        current += timedelta(days=1)


def _read_mysql_buckets(
    spark: SparkSession,
    url: str,
    spec: TableSpec,
    start_date: str,
    end_date: str,
) -> Dict[date, Row]:
    bucket_expr = f"DATE({_quote_mysql_identifier(spec.filter_column)})"
    select_parts = [
        f"{bucket_expr} AS bucket_date",
        "COUNT(*) AS row_count",
        f"MIN({_quote_mysql_identifier(spec.id_column)}) AS min_id",
        f"MAX({_quote_mysql_identifier(spec.id_column)}) AS max_id",
    ]
    for amount_column in spec.amount_columns:
        select_parts.append(
            "SUM(CAST("
            f"{_quote_mysql_identifier(amount_column)} AS DECIMAL(38, 6)"
            f")) AS {_amount_alias(amount_column)}"
        )

    query = f"""
        SELECT {", ".join(select_parts)}
        FROM {_quote_mysql_identifier(SRC_DB)}.{_quote_mysql_identifier(spec.source_table)}
        WHERE {_quote_mysql_identifier(spec.filter_column)} >= '{start_date}'
          AND {_quote_mysql_identifier(spec.filter_column)} < '{end_date}'
        GROUP BY {bucket_expr}
    """

    df = (
        spark.read.format("jdbc")
        .option("driver", "com.mysql.cj.jdbc.Driver")
        .option("url", url)
        .option("dbtable", f"({query}) AS reconcile_src")
        .option("fetchsize", "1000")
        .load()
    )
    return {_coerce_bucket(row["bucket_date"]): row for row in df.collect()}


def _read_stg_buckets(
    spark: SparkSession,
    spec: TableSpec,
    start_date: str,
    end_date: str,
) -> Dict[date, Row]:
    aggregations = [
        count(lit(1)).alias("row_count"),
        spark_min(col(spec.id_column)).alias("min_id"),
        spark_max(col(spec.id_column)).alias("max_id"),
    ]
    for amount_column in spec.amount_columns:
        aggregations.append(
            spark_sum(col(amount_column).cast(DecimalType(38, 6))).alias(
                _amount_alias(amount_column)
            )
        )

    df = (
        spark.table(f"{DST_DB}.{spec.stg_table}")
        .filter(col(spec.filter_column) >= lit(start_date).cast("timestamp"))
        .filter(col(spec.filter_column) < lit(end_date).cast("timestamp"))
        .groupBy(to_date(col(spec.filter_column)).alias("bucket_date"))
        .agg(*aggregations)
    )
    return {_coerce_bucket(row["bucket_date"]): row for row in df.collect()}


def _coerce_bucket(value) -> date:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    return _parse_date(str(value))


def _row_value(row: Optional[Row], field: str, default=None):
    if row is None:
        return default
    value = row[field]
    return default if value is None else value


def _string_or_none(value) -> Optional[str]:
    if value is None:
        return None
    return str(value)


def _same_id(left: Optional[str], right: Optional[str]) -> bool:
    return (left or "") == (right or "")


def reconcile_table(
    spark: SparkSession,
    url: str,
    spec: TableSpec,
    table_name: str,
    start_date: date,
    end_date: date,
    run_id: str,
    checked_at: datetime,
) -> List[Row]:
    mysql_rows = _read_mysql_buckets(
        spark, url, spec, start_date.isoformat(), end_date.isoformat()
    )
    stg_rows = _read_stg_buckets(spark, spec, start_date.isoformat(), end_date.isoformat())
    buckets = sorted(set(mysql_rows) | set(stg_rows))
    if not buckets:
        buckets = list(_date_range(start_date, end_date))

    audit_rows = []
    for bucket in buckets:
        mysql_row = mysql_rows.get(bucket)
        stg_row = stg_rows.get(bucket)
        mysql_count = int(_row_value(mysql_row, "row_count", 0))
        stg_count = int(_row_value(stg_row, "row_count", 0))
        mysql_min_id = _string_or_none(_row_value(mysql_row, "min_id"))
        stg_min_id = _string_or_none(_row_value(stg_row, "min_id"))
        mysql_max_id = _string_or_none(_row_value(mysql_row, "max_id"))
        stg_max_id = _string_or_none(_row_value(stg_row, "max_id"))
        amount_sums = {}
        amount_mismatch = False

        for amount_column in spec.amount_columns:
            alias = _amount_alias(amount_column)
            mysql_sum = _row_value(mysql_row, alias)
            stg_sum = _row_value(stg_row, alias)
            delta = None
            if mysql_sum is not None or stg_sum is not None:
                mysql_decimal = Decimal(str(mysql_sum or "0"))
                stg_decimal = Decimal(str(stg_sum or "0"))
                delta = stg_decimal - mysql_decimal
                amount_mismatch = amount_mismatch or delta != 0
            amount_sums[amount_column] = {
                "mysql": mysql_sum,
                "stg": stg_sum,
                "delta": delta,
            }

        count_delta = stg_count - mysql_count
        min_id_matches = _same_id(mysql_min_id, stg_min_id)
        max_id_matches = _same_id(mysql_max_id, stg_max_id)
        status = (
            "PASS"
            if count_delta == 0
            and min_id_matches
            and max_id_matches
            and not amount_mismatch
            else "FAIL"
        )
        reconcile_id = "|".join(
            [run_id, table_name, bucket.isoformat(), start_date.isoformat(), end_date.isoformat()]
        )

        audit_rows.append(
            Row(
                reconcile_id=reconcile_id,
                run_id=run_id,
                table_name=table_name,
                source_table=f"{SRC_DB}.{spec.source_table}",
                stg_table=f"{DST_DB}.{spec.stg_table}",
                window_start=start_date,
                window_end=end_date,
                bucket_date=bucket,
                mysql_count=mysql_count,
                stg_count=stg_count,
                count_delta=count_delta,
                mysql_min_id=mysql_min_id,
                stg_min_id=stg_min_id,
                mysql_max_id=mysql_max_id,
                stg_max_id=stg_max_id,
                min_id_matches=min_id_matches,
                max_id_matches=max_id_matches,
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
        "hoodie.table.name": f"{DST_DB}.{AUDIT_TABLE}",
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
        "hoodie.datasource.hive_sync.database": DST_DB,
        "hoodie.datasource.hive_sync.table": AUDIT_TABLE,
        "hoodie.datasource.hive_sync.skip_ro_suffix": False,
        "hoodie.datasource.hive_sync.support_timestamp": True,
        "hoodie.datasource.write.hive_style_partitioning": True,
        "hoodie.metadata.enable": False,
        "path": AUDIT_PATH,
    }
    df.write.format("hudi").options(**hudi_options).mode("append").save()


def _selected_specs(tables: Optional[str]) -> Dict[str, TableSpec]:
    if not tables:
        return TABLE_SPECS
    selected = [table.strip() for table in tables.split(",") if table.strip()]
    unknown = sorted(set(selected) - set(TABLE_SPECS))
    if unknown:
        raise typer.BadParameter(f"Unknown table(s): {', '.join(unknown)}")
    return {table: TABLE_SPECS[table] for table in selected}


def main(
    url: str = typer.Option(..., "--url"),
    spark_remote: Optional[str] = typer.Option(None, "--spark-remote"),
    start_date: str = typer.Option(..., "--start-date"),
    end_date: str = typer.Option(..., "--end-date"),
    run_id: str = typer.Option("manual", "--run-id"),
    tables: Optional[str] = typer.Option(None, "--tables"),
    fail_on_mismatch: bool = typer.Option(True, "--fail-on-mismatch/--no-fail-on-mismatch"),
    write_results: bool = typer.Option(True, "--write-results/--no-write-results"),
):
    spark = create_spark_session(spark_remote)
    checked_at = datetime.utcnow()
    start = _parse_date(start_date)
    end = _parse_date(end_date)
    if end <= start:
        raise typer.BadParameter("--end-date must be after --start-date")

    audit_rows: List[Row] = []
    specs = _selected_specs(tables)
    for table_name, spec in specs.items():
        audit_rows.extend(
            reconcile_table(spark, url, spec, table_name, start, end, run_id, checked_at)
        )

    df = spark.createDataFrame(audit_rows, schema=AUDIT_SCHEMA)
    failures = df.filter(col("status") == lit("FAIL")).collect()
    if write_results:
        write_audit(spark, df)

    total = df.count()
    failed = len(failures)
    print(f"mysql-to-stg reconciliation completed: total={total}, failed={failed}")
    for row in failures[:50]:
        print(
            "FAIL "
            f"table={row['table_name']} bucket={row['bucket_date']} "
            f"mysql_count={row['mysql_count']} stg_count={row['stg_count']} "
            f"count_delta={row['count_delta']} "
            f"mysql_min_id={row['mysql_min_id']} stg_min_id={row['stg_min_id']} "
            f"mysql_max_id={row['mysql_max_id']} stg_max_id={row['stg_max_id']}"
        )

    spark.stop()
    if failures and fail_on_mismatch:
        raise typer.Exit(code=1)


if __name__ == "__main__":
    typer.run(main)
