#!/usr/bin/env python3
"""
Load Confirmed Risk Registry CSV into Hive table via Spark Connect.

Usage:
    python scripts/load_risk_registry_to_hive.py \
        --csv data/confirmed_risk_registry/confirmed_risk_registry_latest.csv \
        --spark-remote sc://172.16.100.212:15002
"""

import argparse
from pathlib import Path

from pyspark.sql import SparkSession
from pyspark.sql.types import (
    StringType, StructField, StructType, TimestampType
)


SCHEMA = StructType([
    StructField("subject_type", StringType(), False),
    StructField("subject_id", StringType(), False),
    StructField("confirmed_risk_type", StringType(), False),
    StructField("confirmed_risk_status", StringType(), False),
    StructField("source_file", StringType(), False),
    StructField("source_label", StringType(), False),
    StructField("source_bad_type", StringType(), False),
    StructField("source_as_of", StringType(), False),
    StructField("ingested_at", StringType(), False),
])

TABLE_NAME = "hive.usr_skyee_mw.confirmed_risk_registry"


def main(csv_path: str, spark_remote: str):
    csv_path = Path(csv_path).resolve()
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    print(f"Spark Remote: {spark_remote}")
    print(f"CSV Path:     {csv_path}")
    print(f"Target Table: {TABLE_NAME}")

    spark = (
        SparkSession.builder
        .appName("load_risk_registry")
        .remote(spark_remote)
        .getOrCreate()
    )

    print("\nReading CSV...")
    df = spark.read.csv(str(csv_path), header=True, schema=SCHEMA)

    record_count = df.count()
    print(f"Records to insert: {record_count}")

    print("\nSample data:")
    df.show(5, truncate=False)

    print(f"\nInserting into {TABLE_NAME}...")
    df.write.mode("append").insertInto(TABLE_NAME)

    print(f"✓ Successfully inserted {record_count} records into {TABLE_NAME}")

    spark.stop()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Load risk registry CSV into Hive"
    )
    parser.add_argument(
        "--csv",
        required=True,
        help="Path to the CSV file",
    )
    parser.add_argument(
        "--spark-remote",
        default="sc://172.16.100.212:15002",
        help="Spark Connect remote URL",
    )
    args = parser.parse_args()
    main(csv_path=args.csv, spark_remote=args.spark_remote)
