from abc import ABC, abstractmethod
from argparse import ArgumentParser
from dateutil.relativedelta import relativedelta
from pyspark.sql import SparkSession, DataFrame
from pyspark.sql.functions import *
from pyspark.sql.types import *
from pyspark.sql.utils import AnalysisException
from typing import List, Dict, Union, Literal, Optional
from typing_extensions import Annotated
import typer
import pandas as pd
import enum
import logging

logger = logging.getLogger(__name__)


def create_spark_session(spark_remote: Optional[str] = None) -> SparkSession:
    """Create a Spark session in Spark Connect or classic spark-submit mode."""
    builder = SparkSession.builder
    if spark_remote:
        builder = builder.remote(spark_remote)
    return builder.getOrCreate()


class Etl(ABC):
    """
     The base class for ETL jobs.

    Attributes:
    ----------
    id: str
        field name of the unique key, required in Hudi table
    ts: str
        field name of the record unique timestamp, used as Hudi `preCombine` field
    filter_by: str
        field name filtering in `extract` function

    Methods:
    -------
    extract(start_date: str, end_date: str):
        extract table from <`src_db`.`src_tbl`>

    transform(df: DataFrame):
        performs transformation to df

    load(df):
        load into <`dst_db`.`dst_tbl`> as `spark_table` or `hudi_table` based on the `table_type` setting
    """

    table_type: Literal["hudi_table", "spark_table"] = "hudi_table"
    hudi_mode: Literal["upsert", "insert_overwrite", "insert_overwrite_table"] = (
        "upsert"
    )
    src_db = None
    src_tbl = None
    dst_db = None
    dst_tbl = None
    id = None
    ts = None
    filter_by = None
    offset = None
    par_cols = []
    path = None
    repartition = []
    url: str = None
    concurrency_mode: Literal["SINGLE_WRITER", "OPTIMISTIC_CONCURRENCY_CONTROL"] = (
        "SINGLE_WRITER"
    )
    zookeeper: str = None

    def __init__(
        self,
        start_date: str = None,
        end_date: str = None,
        zookeeper: str = None,
        url: str = None,
        bulk: bool = True,
        hudi_mode_override: str = None,
        **kwargs,
    ):
        fields = ["dst_db", "dst_tbl", "path"]
        if self.table_type == "hudi_table":
            fields += ["id", "ts"]
        for field in fields:
            if getattr(self, field) is None:
                raise ValueError(
                    f"Field {field} cannot be None. Please set {field} before proceed"
                )
        if len(self.par_cols) == 0:
            logger.warn("`par_cols is 0, do not partition")
        if type(self.repartition) != list:
            self.repartition = [self.repartition]
        if self.filter_by is None:
            logger.warn(
                "`filter_by` is not set, will extract full table, please be aware!"
            )
        self.start_date: str = start_date if start_date else None
        self.end_date: str = end_date if end_date else None
        self.zookeeper = zookeeper if zookeeper else self.zookeeper
        self.url = url if url else self.url
        self.bulk = bulk
        # Allow CLI override of hudi_mode (e.g. --hudi-mode bulk_insert)
        if hudi_mode_override:
            self.hudi_mode = hudi_mode_override
        for k, v in kwargs.items():
            setattr(self, k, v)

        if (
            self.concurrency_mode == "OPTIMISTIC_CONCURRENCY_CONTROL"
            and self.zookeeper is None
        ):
            raise ValueError("concurrency control enabled but zookeeper not set")
        self.spark = SparkSession.getActiveSession()

    def __call__(self):
        self.process()

    @classmethod
    def run_from_cli(
        cls,
        start_date: Annotated[str, typer.Option("--start-date")] = None,
        end_date: Annotated[str, typer.Option("--end-date")] = None,
        zookeeper: Annotated[str, typer.Option("--zookeeper")] = None,
        url: Annotated[str, typer.Option("--url")] = None,
        bulk: Annotated[bool, typer.Option("--bulk/--per-day")] = True,
    ):
        obj = cls.__new__(cls)
        obj.__init__(start_date, end_date, zookeeper, url, bulk)
        obj()
        return obj

    def extract(self, start_date: str = None, end_date: str = None):
        start_date = start_date or self.start_date
        end_date = end_date or self.end_date
        df = self.spark.table(f"{self.src_db}.{self.src_tbl}")

        if self.offset and start_date:
            from dateutil.relativedelta import relativedelta
            from dateutil.parser import parse as date_parse

            start_date = date_parse(start_date) - relativedelta(days=self.offset)
            start_date = start_date.strftime("%Y-%m-%d")

        if self.filter_by and start_date:
            df = df.filter(col(self.filter_by) >= start_date)
        if self.filter_by and end_date:
            df = df.filter(col(self.filter_by) < end_date)
        return df

    def select_or_none(
        self, df: DataFrame, cols: Union[List, Dict[str, Union[str, DataType]]]
    ) -> DataFrame:
        if type(cols) == list:
            available_cols = [i for i in cols if i in df.columns]
            missing_cols = [i for i in cols if i not in df.columns]
            df = df.select(*available_cols)

            logger.warn(
                f"Columns {missing_cols} are missing, filling with None and cast as default StringType"
            )
            for col in missing_cols:
                df = df.withColumn(col, lit(None).cast(StringType()))
        elif type(cols) == dict:
            available_cols = [i for i in cols.keys() if i in df.columns]
            missing_cols = [i for i in cols.keys() if i not in df.columns]
            df = df.select(*available_cols)
            for col in missing_cols:
                col_type = cols[col]
                df = df.withColumn(col, lit(None).cast(col_type))
        else:
            raise TypeError(f"cols {cols} should be List or Dict")
        df = df.select(*cols)
        return df

    @abstractmethod
    def transform(self, df: DataFrame) -> DataFrame:
        return df

    def _prepare_partition(self, df: DataFrame) -> DataFrame:
        self.spark.conf.set("spark.sql.sources.partitionOverwriteMode", "DYNAMIC")
        new_cols = [i for i in df.columns if i not in self.par_cols] + self.par_cols
        df = df.select(*new_cols)
        if self.start_date and self.filter_by:
            df = df.filter(col(self.filter_by) >= self.start_date)
        return df

    def _is_existing_hudi_table(self) -> bool:
        """Check if a Hudi table already exists at `self.path`.

        Used to determine whether we can perform an `upsert` (requires existing
        table metadata at `.hoodie/hoodie.properties`) or need to fall back to
        `bulk_insert` for the initial load.
        """
        try:
            self.spark.read.text(f"{self.path}/.hoodie/hoodie.properties").limit(1).collect()
            return True
        except Exception:
            return False

    def load_hudi(self, df: DataFrame) -> DataFrame:
        # -----------------------------------------------------------------
        # Hudi write operation auto-detection (added 2026-03-02)
        # -----------------------------------------------------------------
        # In Hudi 0.14+, the `upsert` operation expects an existing Hudi table
        # with `.hoodie/hoodie.properties` on HDFS. Writing to a *new* path
        # with `upsert` fails with `HoodieUpsertException`.
        #
        # Previously (Hudi 0.12), `upsert` could auto-create new tables.
        #
        # Decision: auto-detect whether the table exists. If not, override
        # the operation to `bulk_insert` for the initial load. Subsequent
        # writes use the configured `hudi_mode` (typically `upsert`).
        # -----------------------------------------------------------------
        operation = self.hudi_mode
        needs_existing_table = operation in ("upsert", "insert_overwrite", "insert_overwrite_table")
        if needs_existing_table and not self._is_existing_hudi_table():
            logger.info(
                f"Hudi table not found at {self.path}, "
                f"falling back to 'bulk_insert' for initial load "
                f"(configured mode: {operation})"
            )
            operation = "bulk_insert"

        hudi_options = {
            "hoodie.table.name": f"{self.dst_db}.{self.dst_tbl}",
            "hoodie.datasource.write.table.type": "COPY_ON_WRITE",
            "hoodie.datasource.write.recordkey.field": self.id,
            "hoodie.datasource.write.partitionpath.field": ",".join(self.par_cols),
            "hoodie.datasource.write.keygenerator.class": "org.apache.hudi.keygen.ComplexKeyGenerator",
            "hoodie.datasource.write.precombine.field": self.ts,
            "hoodie.datasource.write.operation": f"{operation}",
            "hoodie.datasource.write.reconcile.schema": True,
            "hoodie.schema.on.read.enable": True,
            # ---------------------------------------------------------------
            # Hudi 0.15 ComplexKeyGenerator regression fix
            # ---------------------------------------------------------------
            # Hudi 0.14.1, 0.15.0, 1.0.x introduced a regression in
            # ComplexKeyGenerator with a single record key field - the record
            # key encoding changed, which can cause duplicate records during
            # upserts. Setting this to `true` ensures consistent encoding
            # for tables created on these versions.
            #
            # Ref: https://hudi.apache.org/releases/release-1.1.1
            # ---------------------------------------------------------------
            "hoodie.write.complex.keygen.new.encoding": True,
            "hoodie.datasource.hive_sync.enable": True,
            "hoodie.datasource.hive_sync.create_managed_table": True,
            "hoodie.datasource.hive_sync.database": self.dst_db,
            "hoodie.datasource.hive_sync.table": self.dst_tbl,
            "hoodie.datasource.hive_sync.skip_ro_suffix": False,
            "hoodie.datasource.hive_sync.support_timestamp": True,
            "hoodie.datasource.write.hive_style_partitioning": True,
            "hoodie.metadata.enable": False,
            "hoodie.write.concurrency.mode": f"{self.concurrency_mode}",
            "hoodie.write.lock.zookeeper.base_path": "/hudi",
            "hoodie.write.lock.zookeeper.lock_key": f"{self.dst_db}.{self.dst_tbl}",
            "hoodie.write.lock.zookeeper.port": "2181",
            "hoodie.write.lock.zookeeper.url": f"{self.zookeeper}",
            "path": self.path,
        }

        df.write.format("hudi").options(**hudi_options).mode("append").save()

    def load_spark(self, df: DataFrame):
        try:
            df.repartition(*self.repartition).write.mode("overwrite").insertInto(
                f"{self.dst_db}.{self.dst_tbl}"
            )
        except AnalysisException:
            if len(self.par_cols) == 0:
                df.repartition(*self.repartition).write.option("path", self.path).mode(
                    "overwrite"
                ).saveAsTable(f"{self.dst_db}.{self.dst_tbl}")
            else:
                df.repartition(*self.repartition).write.option("path", self.path).mode(
                    "overwrite"
                ).partitionBy(*self.par_cols).saveAsTable(
                    f"{self.dst_db}.{self.dst_tbl}"
                )

    def load(self, df: DataFrame):
        if len(self.par_cols) > 0:
            df = self._prepare_partition(df)
        if self.table_type == "hudi_table":
            self.load_hudi(df)
        elif self.table_type == "spark_table":
            self.load_spark(df)
        else:
            raise ValueError(f'table_type "{self.table_type}" is incorrect')

    def etl(self, start_date: str = None, end_date: str = None):
        df = self.extract(start_date=start_date, end_date=end_date)
        res = self.transform(df)
        self.load(res)

    def process(self):
        if self.bulk:
            self.etl(self.start_date, self.end_date)
        else:
            # 1 Batch per day
            logger.info("Processing ETL task on a per day basis")
            date_rng = pd.date_range(self.start_date, self.end_date)
            for dt in date_rng:
                start_dt = dt.strftime("%Y-%m-%d")
                end_dt = dt + relativedelta(days=1)
                end_dt = end_dt.strftime("%Y-%m-%d")
                logger.info(f"Processing dt {start_dt}")
                self.etl(start_dt, end_dt)


class MongoDbEtl(Etl):
    schema = None

    def extract(
        self, start_date: str = None, end_date: str = None, schema: StructField = None
    ):
        start_date = start_date or self.start_date
        end_date = end_date or self.end_date
        schema = schema or self.schema
        df = (
            self.spark.read.format("mongodb")
            .option("connection.uri", self.url)
            .option("database", self.src_db)
            .option("collection", self.src_tbl)
            .option("sql.inferSchema.mapTypes.enabled", "true")
            .load(schema=schema)
        )
        if start_date:
            df = df.filter(col(self.filter_by) >= start_date)
        if end_date:
            df = df.filter(col(self.filter_by) < end_date)
        return df


class JdbcEtl(Etl):
    driver = None

    def __init__(
        self,
        url: str,
        start_date: str = None,
        end_date: str = None,
        bulk=True,
        hudi_mode_override: str = None,
        **kwargs,
    ):
        super().__init__(start_date, end_date, url=url, bulk=bulk, hudi_mode_override=hudi_mode_override, **kwargs)

    @classmethod
    def run_from_cli(
        cls,
        url: Annotated[str, typer.Option("--url")],
        start_date: Annotated[str, typer.Option("--start-date")] = None,
        end_date: Annotated[str, typer.Option("--end-date")] = None,
        bulk: Annotated[bool, typer.Option("--bulk/--per-day")] = True,
        hudi_mode: Annotated[str, typer.Option("--hudi-mode")] = None,
    ):
        obj = cls.__new__(cls)
        obj.__init__(url, start_date, end_date, bulk, hudi_mode_override=hudi_mode)
        obj()
        return obj

    def _prepare_query(self, start_date: str = None, end_date: str = None):
        query = f"select * from {self.src_db}.{self.src_tbl} where 1 = 1 "
        if self.filter_by and start_date:
            query += f'and {self.filter_by} >= "{start_date}" '
        if self.filter_by and end_date:
            query += f'and {self.filter_by} < "{end_date}" '
        self.query = f"({query}) as tmp"
        return self.query

    def extract(self, start_date: str = None, end_date: str = None):
        start_date = start_date or self.start_date
        end_date = end_date or self.end_date
        self._prepare_query(start_date, end_date)
        logger.info(self.query)
        if self.filter_by and start_date and end_date:
            df = (
                self.spark.read.format("jdbc")
                .option("driver", self.driver)
                .option("url", self.url)
                .option("dbtable", self.query)
                .option("partitionColumn", self.ts)
                .option("lowerBound", start_date)
                .option("upperBound", end_date)
                .option("numPartitions", "8")
                .option("fetchsize", "1000")
                .option("pushDownPredicate", "true")
                .option("pushDownAggregate", "true")
                .option("pushDownLimit", "true")
                .option("pushDownOffset", "true")
                .load()
            )
        else:
            df = (
                self.spark.read.format("jdbc")
                .option("driver", self.driver)
                .option("url", self.url)
                .option("dbtable", self.query)
                .option("fetchsize", "1000")
                .option("pushDownPredicate", "true")
                .option("pushDownAggregate", "true")
                .option("pushDownLimit", "true")
                .option("pushDownOffset", "true")
                .load()
            )
        return df


class MySqlEtl(JdbcEtl):
    driver = "com.mysql.cj.jdbc.Driver"


class MsSqlEtl(JdbcEtl):
    """
    ETL base class for Microsoft SQL Server sources via JDBC.

    JDBC URL format:
        jdbc:sqlserver://host:port;databaseName=db;encrypt=false

    Differences from MySqlEtl:
        - Driver: com.microsoft.sqlserver.jdbc.SQLServerDriver
        - Date literals use single quotes (ANSI SQL)
        - Identifiers use bracket quoting: [schema].[table]
    """

    driver = "com.microsoft.sqlserver.jdbc.SQLServerDriver"

    def _prepare_query(self, start_date: str = None, end_date: str = None):
        # Use bracket-quoted identifiers for MSSQL
        if self.src_db:
            table_ref = f"[{self.src_db}].[{self.src_tbl}]"
        else:
            table_ref = f"[{self.src_tbl}]"

        query = f"select * from {table_ref} where 1 = 1 "
        if self.filter_by and start_date:
            query += f"and [{self.filter_by}] >= '{start_date}' "
        if self.filter_by and end_date:
            query += f"and [{self.filter_by}] < '{end_date}' "
        self.query = f"({query}) as tmp"
        return self.query

    def extract(self, start_date: str = None, end_date: str = None):
        """
        MSSQL-specific extract -- always uses single-partition JDBC read.

        MSSQL servers often redirect partitioned connections to internal
        hostnames (e.g. 'DB197') that Spark workers cannot resolve.
        Avoid `partitionColumn` / `numPartitions` to prevent this.

        All semicolon-delimited URL properties (user, password, encrypt, etc.)
        are extracted and passed as explicit Spark JDBC `.option()` calls.
        This is required because:
        - MSSQL JDBC driver v10.2+ defaults `encrypt=true`
        - Spark's JDBC Properties object does NOT merge URL-embedded properties
        - All properties must be in the Properties object for the driver
        """
        start_date = start_date or self.start_date
        end_date = end_date or self.end_date
        self._prepare_query(start_date, end_date)
        logger.info(self.query)

        # Parse MSSQL JDBC URL: jdbc:sqlserver://host:port;key=val;key=val;...
        parts = self.url.split(";")
        base_url = parts[0]  # jdbc:sqlserver://host:port
        jdbc_props = {}
        remaining_url_parts = []
        for part in parts[1:]:
            if "=" in part:
                k, v = part.split("=", 1)
                # databaseName must stay in the URL (required by the driver)
                # redirect must stay in the URL (connection-level property;
                # the driver ignores it when passed as a JDBC Properties entry)
                if k.lower() in ("databasename", "redirect"):
                    remaining_url_parts.append(part)
                else:
                    jdbc_props[k] = v
            else:
                remaining_url_parts.append(part)

        clean_url = ";".join([base_url] + remaining_url_parts)

        # Ensure SSL properties are set (driver v10.2+ defaults encrypt=true)
        jdbc_props.setdefault("encrypt", "false")
        jdbc_props.setdefault("trustServerCertificate", "true")

        logger.info(f"MSSQL clean URL: {clean_url}")
        logger.info(f"MSSQL props keys: {list(jdbc_props.keys())}")

        df = (
            self.spark.read.format("jdbc")
            .option("driver", self.driver)
            .option("url", clean_url)
            .option("dbtable", self.query)
            .option("fetchsize", "1000")
            .options(**jdbc_props)
            .load()
        )
        return df


class JsonEtl(Etl):
    src_path = None
    schema = None

    def __init__(
        self,
        src_path: str,
        start_date: str = None,
        end_date: str = None,
        bulk=True,
        recursive: bool = True,
        **kwargs,
    ):
        super().__init__(start_date, end_date, bulk, **kwargs)
        self.src_path = src_path
        self.recursive = recursive

    @classmethod
    def run_from_cli(
        cls,
        src_path: Annotated[str, typer.Option("--src-path")] = None,
        start_date: Annotated[str, typer.Option("--start-date")] = None,
        end_date: Annotated[str, typer.Option("--end-date")] = None,
        bulk: Annotated[bool, typer.Option("--bulk/--per-day")] = True,
        recursive: Annotated[str, typer.Option("--resursive")] = True,
    ):
        obj = cls.__new__(cls)
        obj.__init__(src_path, start_date, end_date, bulk, recursive)
        obj()
        return obj

    def extract(self, start_date: str = None, end_date: str = None):
        start_date = start_date or self.start_date
        end_date = end_date or self.end_date
        recursive = str(self.recursive).lower()
        if self.schema:
            return (
                self.spark.read.option("recursiveFileLookup", recursive)
                .schema(self.schema)
                .json(self.src_path)
            )
        else:
            return self.spark.read.option("recursiveFileLookup", recursive).json(
                self.src_path
            )


class CsvEtl(Etl):
    src_path = None
    schema = None

    def __init__(
        self,
        src_path: str,
        start_date: str = None,
        end_date: str = None,
        bulk=True,
        recursive: bool = True,
        **kwargs,
    ):
        super().__init__(start_date, end_date, bulk=bulk, **kwargs)
        self.src_path = src_path
        self.recursive = recursive

    @classmethod
    def run_from_cli(
        cls,
        src_path: Annotated[str, typer.Option("--src-path")] = None,
        start_date: Annotated[str, typer.Option("--start-date")] = None,
        end_date: Annotated[str, typer.Option("--end-date")] = None,
        bulk: Annotated[bool, typer.Option("--bulk/--per-day")] = True,
        recursive: Annotated[str, typer.Option("--resursive")] = True,
    ):
        obj = cls.__new__(cls)
        obj.__init__(src_path, start_date, end_date, bulk, recursive)
        obj()
        return obj

    def extract(self, start_date: str = None, end_date: str = None):
        if self.schema:
            return (
                self.spark.read.option("recursiveFileLookup", self.recursive)
                .option("header", True)
                .option("mode", "DROPMALFORMED")
                .schema(self.schema)
                .csv(self.src_path)
            )
        else:
            return (
                self.spark.read.option("recursiveFileLookup", self.recursive)
                .option("header", True)
                .option("mode", "DROPMALFORMED")
                .csv(self.src_path)
            )
