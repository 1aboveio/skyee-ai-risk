"""Generate graph edge evidence and canonical edges from STG tables.

The job intentionally processes one graph attribute at a time. Some source
tables contain millions of rows, so each attribute is normalized, deduped by
customer/key, hot-key filtered, paired, and written before the next attribute.

Two association graph tables are maintained:
  * dwd_graph_edge_monthly: idempotent monthly edge evidence, partitioned by
    edge_type, edge_source, edge_field, and observed_month for reverse backfill
    overwrite without clobbering other specs.
  * dwd_graph_edges: canonical edge snapshot, partitioned only by edge_type so
    first_seen can move backward without moving the Hudi record partition.

Usage:
    python dwd_graph_edges.py [--spark-remote <spark_connect_url>] [--start-date YYYY-MM-DD] [--end-date YYYY-MM-DD] [--bulk/--per-day] [--max-degree 100] [--snapshot-hudi-mode upsert]
"""

import sys
import os
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from utils.etl import Etl, create_spark_session
from pyspark.sql import Column, DataFrame
from pyspark.sql.functions import (
    col,
    coalesce,
    concat,
    concat_ws,
    countDistinct,
    current_timestamp,
    date_format,
    first,
    greatest,
    least,
    lit,
    lower,
    regexp_replace,
    trim,
    upper,
    when,
    xxhash64,
    min as spark_min,
    max as spark_max,
    sum as spark_sum,
)
from typing_extensions import Annotated
import typer
import logging

logger = logging.getLogger(__name__)

# Maximum distinct customers per join key before we consider it "hot".
# A key with degree 100 already produces 4,950 pairs, so the default is
# deliberately conservative and can be raised per backfill if needed.
MAX_DEGREE = int(os.getenv("GRAPH_MAX_DEGREE", "100"))


class DwdGraphEdgesEtl(Etl):
    """Monthly edge evidence from shared customer attributes."""

    src_db = None
    src_tbl = None
    dst_db = "usr_skyee_mw"
    dst_tbl = "dwd_graph_edge_monthly"
    id = "edge_month_id"
    ts = "etl_ts"
    par_cols = ["edge_type", "edge_source", "edge_field", "observed_month"]
    path = "/user/hive/warehouse/usr_skyee_mw.db/dwd_graph_edge_monthly"
    table_type = "hudi_table"
    hudi_mode = "insert_overwrite"
    concurrency_mode = "SINGLE_WRITER"

    def __init__(self, *args, max_degree: int = MAX_DEGREE, **kwargs):
        super().__init__(*args, **kwargs)
        self.max_degree = max_degree

    def extract(self, start_date: str = None, end_date: str = None) -> DataFrame:
        db = "usr_skyee_mw"
        self.src_customer = self.spark.table(f"{db}.stg_cust_customer_info")
        self.src_person = self.spark.table(f"{db}.stg_cust_person_realname_info")
        self.src_enterprise = self.spark.table(f"{db}.stg_cust_enterprise_realname_info")
        self.src_store = self.spark.table(f"{db}.stg_cust_store_info")
        self.src_login = self.spark.table(f"{db}.stg_cust_user_login_log")
        self.src_pay = self.spark.table(f"{db}.stg_pmp_pay_details")
        self.src_pay_order = self.spark.table(f"{db}.stg_pmp_pay_order")
        self.src_coll = self.spark.table(f"{db}.stg_pmp_coll_order")
        self.src_collection_acct = self.spark.table(f"{db}.stg_cust_collections_acct")
        self.src_bank = self.spark.table(f"{db}.stg_cust_bank_acct_info")
        self.src_trade_order = self.spark.table(f"{db}.stg_cust_foreign_trade_order")
        self.src_trade_logistics = self.spark.table(
            f"{db}.stg_cust_foreign_trade_order_logistics"
        )

        return self.spark.createDataFrame([], "edge_id long")

    @staticmethod
    def _clean_value(value: Column) -> Column:
        return trim(value.cast("string"))

    @classmethod
    def _exact_key(cls, value: Column) -> Column:
        return upper(regexp_replace(cls._clean_value(value), r"\s+", " "))

    @classmethod
    def _email_key(cls, value: Column) -> Column:
        return lower(cls._clean_value(value))

    @classmethod
    def _phone_key(cls, value: Column) -> Column:
        return regexp_replace(cls._clean_value(value), r"[\s\-\(\)\+]", "")

    @classmethod
    def _url_key(cls, value: Column) -> Column:
        return lower(regexp_replace(cls._clean_value(value), r"/+$", ""))

    def _normalize_attrs(
        self,
        df: DataFrame,
        value_expr: Column,
        key_expr: Column,
        edge_type: str,
        edge_source: str,
        strength: str,
        src_filter: Column = None,
        cust_expr: Column = None,
        create_expr: Column = None,
        update_expr: Column = None,
    ) -> DataFrame:
        if src_filter is not None:
            df = df.filter(src_filter)

        cust_expr = cust_expr if cust_expr is not None else col("cust_id")
        create_expr = create_expr if create_expr is not None else col("create_time")
        update_expr = update_expr if update_expr is not None else col("lst_upd_time")

        attrs = df.select(
            key_expr.alias("_join_key"),
            cust_expr.cast("long").alias("cust_id"),
            lit(edge_type).alias("edge_type"),
            lit(edge_source).alias("edge_source"),
            lit(strength).alias("strength"),
            self._clean_value(value_expr).alias("edge_value"),
            create_expr.alias("create_time"),
            update_expr.alias("lst_upd_time"),
        )

        return attrs.filter(
            col("cust_id").isNotNull()
            & col("_join_key").isNotNull()
            & (trim(col("_join_key")) != "")
        )

    @staticmethod
    def _dedupe(attrs: DataFrame) -> DataFrame:
        return (
            attrs.groupBy("cust_id", "_join_key", "edge_type", "edge_source", "strength")
            .agg(
                first("edge_value", ignorenulls=True).alias("edge_value"),
                spark_min("create_time").alias("create_time"),
                spark_max("create_time").alias("_latest_create_time"),
                spark_max("lst_upd_time").alias("lst_upd_time"),
                spark_max(coalesce(col("create_time"), col("lst_upd_time"))).alias(
                    "_change_time"
                ),
                spark_sum(lit(1)).cast("int").alias("_record_count"),
            )
        )

    @staticmethod
    def _filter_hot_keys(attrs: DataFrame, max_degree: int) -> DataFrame:
        deg = (
            attrs.groupBy("_join_key", "edge_type", "edge_source")
            .agg(countDistinct("cust_id").alias("_degree"))
        )
        valid = deg.filter((col("_degree") >= 2) & (col("_degree") <= max_degree))
        return attrs.join(valid, on=["_join_key", "edge_type", "edge_source"], how="inner")

    def _generate_pairs(self, attrs: DataFrame, edge_type: str, edge_source: str, strength: str) -> DataFrame:
        select_cols = [
            col("a.cust_id").alias("source_cust_id"),
            col("b.cust_id").alias("target_cust_id"),
            col("a.edge_value"),
            least(col("a.create_time"), col("b.create_time")).alias("first_seen"),
            greatest(col("a.lst_upd_time"), col("b.lst_upd_time")).alias("last_seen"),
            greatest(
                col("a._change_time"),
                col("b._change_time"),
            ).alias("observed_time"),
            lit(edge_type).alias("edge_type"),
            lit(edge_source).alias("edge_source"),
            lit(strength).alias("strength"),
            (col("a._record_count") + col("b._record_count")).cast("int").alias("record_count"),
        ]
        join_cond = (
            (col("a._join_key") == col("b._join_key"))
            & (col("a.cust_id") < col("b.cust_id"))
        )

        def _build(df_a, df_b):
            return df_a.alias("a").join(df_b.alias("b"), on=join_cond, how="inner").select(*select_cols)

        if self.start_date:
            new = attrs.filter(col("_change_time") >= self.start_date)
            if self.end_date:
                new = new.filter(col("_change_time") < self.end_date)
            old = attrs.filter(col("_change_time") < self.start_date)
            return _build(new, attrs).unionByName(_build(old, new))
        else:
            return _build(attrs, attrs)

    def _finish_monthly_edges(self, edges: DataFrame, edge_field: str) -> DataFrame:
        edges = edges.withColumn(
            "edge_id",
            xxhash64(
                col("source_cust_id").cast("string"),
                col("target_cust_id").cast("string"),
                col("edge_type"),
                col("edge_source"),
                col("edge_value"),
            ),
        )
        edges = (
            edges
            .withColumn("record_count", col("record_count").cast("int"))
        )
        observed_ts = coalesce(col("observed_time"), col("first_seen"), col("last_seen"))
        edges = (
            edges.withColumn(
                "observed_month",
                when(observed_ts.isNull(), lit("unknown")).otherwise(
                    date_format(observed_ts, "yyyy-MM")
                ),
            )
            .groupBy(
                "edge_id",
                "source_cust_id",
                "target_cust_id",
                "edge_type",
                "edge_value",
                "edge_source",
                "strength",
                "observed_month",
            )
            .agg(
                spark_min("first_seen").alias("first_seen"),
                spark_max("last_seen").alias("last_seen"),
                spark_sum("record_count").cast("int").alias("record_count"),
                spark_min(observed_ts).alias("_observed_time"),
            )
        )
        event_ts = coalesce(col("_observed_time"), col("first_seen"), col("last_seen"))
        return (
            edges.withColumn("dt", event_ts.cast("date"))
            .withColumn("etl_ts", current_timestamp())
            .withColumn("edge_field", lit(edge_field))
            .withColumn(
                "edge_month_id",
                xxhash64(
                    col("edge_id").cast("string"),
                    col("edge_source"),
                    col("edge_field"),
                    col("observed_month"),
                ),
            )
            .select(
                "edge_month_id",
                "edge_id",
                "source_cust_id",
                "target_cust_id",
                "edge_value",
                "edge_source",
                "strength",
                "first_seen",
                "last_seen",
                "record_count",
                "dt",
                "etl_ts",
                "edge_type",
                "edge_field",
                "observed_month",
            )
        )

    def _process_attr_spec(
        self,
        src_df: DataFrame,
        src_label: str,
        value_expr: Column,
        key_expr: Column,
        edge_type: str,
        edge_source: str,
        strength: str,
        src_filter: Column = None,
        cust_expr: Column = None,
        create_expr: Column = None,
        update_expr: Column = None,
    ):
        logger.info("Processing %s/%s/%s", edge_type, edge_source, src_label)
        attrs = self._normalize_attrs(
            src_df,
            value_expr,
            key_expr,
            edge_type,
            edge_source,
            strength,
            src_filter=src_filter,
            cust_expr=cust_expr,
            create_expr=create_expr,
            update_expr=update_expr,
        )
        attrs = self._dedupe(attrs)
        attrs = self._filter_hot_keys(attrs, self.max_degree)

        edges = self._generate_pairs(attrs, edge_type, edge_source, strength)
        edges = self._finish_monthly_edges(edges, src_label)
        self.load(edges)
        logger.info("Done %s/%s/%s", edge_type, edge_source, src_label)

    def process(self):
        self.extract(self.start_date, self.end_date)

        def not_empty(column_name: str) -> Column:
            value = trim(col(column_name).cast("string"))
            return col(column_name).isNotNull() & (value != "")

        company_customers = self.src_customer.filter(upper(col("cust_type")) == "COMPANY")
        personal_customers = self.src_customer.filter(upper(col("cust_type")) == "PERSONAL")
        trade_logistics = self.src_trade_logistics.alias("fl").join(
            self.src_trade_order.select(
                col("id").alias("_trade_order_id"),
                col("cust_id").alias("_trade_cust_id"),
            ),
            col("fl.foreign_trade_order_id") == col("_trade_order_id"),
            "inner",
        ).select(
            col("fl.goods_store_url").alias("goods_store_url"),
            col("fl.create_time").alias("create_time"),
            col("fl.lst_upd_time").alias("lst_upd_time"),
            col("_trade_cust_id"),
        )

        specs = [
            (self.src_customer, "cust_mobile", col("cust_mobile"), self._phone_key(col("cust_mobile")), "SAME_PHONE", "stg_cust_customer_info", "Strong", None, None, None, None),
            (self.src_customer, "contact_mobile", col("contact_mobile"), self._phone_key(col("contact_mobile")), "SAME_PHONE", "stg_cust_customer_info", "Strong", None, None, None, None),
            (self.src_pay, "mobile_no", col("mobile_no"), self._phone_key(col("mobile_no")), "SAME_PHONE", "stg_pmp_pay_details", "Strong", None, None, None, None),
            (self.src_bank, "reserved_mobile", col("reserved_mobile"), self._phone_key(col("reserved_mobile")), "SAME_PHONE", "stg_cust_bank_acct_info", "Strong", None, None, None, None),
            (self.src_bank, "phone_no", col("phone_no"), self._phone_key(col("phone_no")), "SAME_PHONE", "stg_cust_bank_acct_info", "Strong", None, None, None, None),
            (self.src_pay_order, "same_name_payer_mobile", col("same_name_payer_mobile"), self._phone_key(col("same_name_payer_mobile")), "SAME_PHONE", "stg_pmp_pay_order", "Strong", None, None, None, None),
            (self.src_customer, "email", col("email"), self._email_key(col("email")), "SAME_EMAIL", "stg_cust_customer_info", "Strong", None, None, None, None),
            (self.src_bank, "entity_email", col("entity_email"), self._email_key(col("entity_email")), "SAME_EMAIL", "stg_cust_bank_acct_info", "Strong", None, None, None, None),
            (self.src_pay, "email", col("email"), self._email_key(col("email")), "SAME_EMAIL", "stg_pmp_pay_details", "Strong", None, None, None, None),
            (self.src_pay, "beneficiary_email", col("beneficiary_email"), self._email_key(col("beneficiary_email")), "SAME_EMAIL", "stg_pmp_pay_details", "Strong", None, None, None, None),
            # Business name edges (SAME_BUSINESS_NAME) - Weak by default
            (company_customers, "cust_name", col("cust_name"), self._exact_key(col("cust_name")), "SAME_BUSINESS_NAME", "stg_cust_customer_info", "Weak", None, None, None, None),
            (company_customers, "en_name", col("en_name"), self._exact_key(col("en_name")), "SAME_BUSINESS_NAME", "stg_cust_customer_info", "Weak", None, None, None, None),
            (self.src_enterprise, "enterprise_name", col("enterprise_name"), self._exact_key(col("enterprise_name")), "SAME_BUSINESS_NAME", "stg_cust_enterprise_realname_info", "Weak", None, None, None, None),
            (self.src_enterprise, "en_name", col("en_name"), self._exact_key(col("en_name")), "SAME_BUSINESS_NAME", "stg_cust_enterprise_realname_info", "Weak", None, None, None, None),
            # Account holder name edges (SAME_ACCT_HOLDER_NAME) - Weak by default
            (self.src_bank, "acct_name", col("acct_name"), self._exact_key(col("acct_name")), "SAME_ACCT_HOLDER_NAME", "stg_cust_bank_acct_info", "Weak", None, None, None, None),
            (self.src_bank, "acct_en_name", col("acct_en_name"), self._exact_key(col("acct_en_name")), "SAME_ACCT_HOLDER_NAME", "stg_cust_bank_acct_info", "Weak", None, None, None, None),
            (self.src_collection_acct, "name", col("name"), self._exact_key(col("name")), "SAME_ACCT_HOLDER_NAME", "stg_cust_collections_acct", "Weak", None, None, None, None),
            (self.src_collection_acct, "bank_acct_name", col("bank_acct_name"), self._exact_key(col("bank_acct_name")), "SAME_ACCT_HOLDER_NAME", "stg_cust_collections_acct", "Weak", None, None, None, None),
            # Trade party name edges (SAME_TRADE_PARTY_NAME) - Weak by default
            (self.src_trade_order, "buyer_name", col("buyer_name"), self._exact_key(col("buyer_name")), "SAME_TRADE_PARTY_NAME", "stg_cust_foreign_trade_order", "Weak", None, None, None, None),
            (self.src_trade_order, "seller_name", col("seller_name"), self._exact_key(col("seller_name")), "SAME_TRADE_PARTY_NAME", "stg_cust_foreign_trade_order", "Weak", None, None, None, None),
            # Legal person name edges (SAME_PERSON_NAME) - Weak by default
            (self.src_enterprise, "legal_person_name", col("legal_person_name"), self._exact_key(col("legal_person_name")), "SAME_PERSON_NAME", "stg_cust_enterprise_realname_info", "Weak", None, None, None, None),
            (personal_customers, "cust_name", col("cust_name"), self._exact_key(col("cust_name")), "SAME_PERSON_NAME", "stg_cust_customer_info", "Weak", None, None, None, None),
            (personal_customers, "en_name", col("en_name"), self._exact_key(col("en_name")), "SAME_PERSON_NAME", "stg_cust_customer_info", "Weak", None, None, None, None),
            (self.src_person, "name", col("name"), self._exact_key(col("name")), "SAME_PERSON_NAME", "stg_cust_person_realname_info", "Weak", None, None, None, None),
            (self.src_person, "en_name", col("en_name"), self._exact_key(col("en_name")), "SAME_PERSON_NAME", "stg_cust_person_realname_info", "Weak", None, None, None, None),
            (self.src_person, "residence_address", col("residence_address"), self._exact_key(col("residence_address")), "SAME_ADDRESS", "stg_cust_person_realname_info", "Strong", None, None, None, None),
            (self.src_person, "cert_address", col("cert_address"), self._exact_key(col("cert_address")), "SAME_ADDRESS", "stg_cust_person_realname_info", "Strong", None, None, None, None),
            (self.src_bank, "entity_address", col("entity_address"), self._exact_key(col("entity_address")), "SAME_ADDRESS", "stg_cust_bank_acct_info", "Strong", None, None, None, None),
            (self.src_bank, "entity_en_address", col("entity_en_address"), self._exact_key(col("entity_en_address")), "SAME_ADDRESS", "stg_cust_bank_acct_info", "Strong", None, None, None, None),
            (self.src_coll, "payee_address", col("payee_address"), self._exact_key(col("payee_address")), "SAME_ADDRESS", "stg_pmp_coll_order", "Strong", None, None, None, None),
            (self.src_pay, "coll_address", col("coll_address"), self._exact_key(col("coll_address")), "SAME_ADDRESS", "stg_pmp_pay_details", "Strong", None, None, None, None),
            (self.src_pay, "coll_en_address", col("coll_en_address"), self._exact_key(col("coll_en_address")), "SAME_ADDRESS", "stg_pmp_pay_details", "Strong", None, None, None, None),
            (self.src_enterprise, "residence_address", col("residence_address"), self._exact_key(col("residence_address")), "SAME_ADDRESS", "stg_cust_enterprise_realname_info", "Strong", None, None, None, None),
            (self.src_enterprise, "cert_address", col("cert_address"), self._exact_key(col("cert_address")), "SAME_ADDRESS", "stg_cust_enterprise_realname_info", "Strong", None, None, None, None),
            (self.src_person, "cert_no", concat_ws("=", col("cert_type"), col("cert_no")), self._exact_key(concat_ws("=", col("cert_type"), col("cert_no"))), "SAME_ID_NO", "stg_cust_person_realname_info", "Strong", col("cert_type").isin("ID_CARD", "PASSPORT") & not_empty("cert_no"), None, None, None),
            (self.src_enterprise, "cert_no", concat_ws("=", col("cert_type"), col("cert_no")), self._exact_key(concat_ws("=", col("cert_type"), col("cert_no"))), "SAME_ID_NO", "stg_cust_enterprise_realname_info", "Strong", not_empty("cert_no"), None, None, None),
            (self.src_bank, "id_card_no", concat(lit("ID_CARD="), col("id_card_no")), self._exact_key(concat(lit("ID_CARD="), col("id_card_no"))), "SAME_ID_NO", "stg_cust_bank_acct_info", "Strong", not_empty("id_card_no"), None, None, None),
            (self.src_bank, "entity_identification_no", concat_ws("=", col("entity_identification_type"), col("entity_identification_no")), self._exact_key(concat_ws("=", col("entity_identification_type"), col("entity_identification_no"))), "SAME_ID_NO", "stg_cust_bank_acct_info", "Strong", not_empty("entity_identification_no"), None, None, None),
            (self.src_bank, "ref_company_cert_no", concat(lit("REF_COMPANY="), col("ref_company_cert_no")), self._exact_key(concat(lit("REF_COMPANY="), col("ref_company_cert_no"))), "SAME_ID_NO", "stg_cust_bank_acct_info", "Strong", not_empty("ref_company_cert_no"), None, None, None),
            (self.src_pay, "identity_no", concat(lit("IDENTITY="), col("identity_no")), self._exact_key(concat(lit("IDENTITY="), col("identity_no"))), "SAME_ID_NO", "stg_pmp_pay_details", "Strong", not_empty("identity_no"), None, None, None),
            (self.src_pay, "beneficiary_identification_no", concat_ws("=", col("beneficiary_identification_type"), col("beneficiary_identification_no")), self._exact_key(concat_ws("=", col("beneficiary_identification_type"), col("beneficiary_identification_no"))), "SAME_ID_NO", "stg_pmp_pay_details", "Strong", not_empty("beneficiary_identification_no"), None, None, None),
            (self.src_pay_order, "same_name_payer_cert_no", concat_ws("=", col("same_name_payer_cert_type"), col("same_name_payer_cert_no")), self._exact_key(concat_ws("=", col("same_name_payer_cert_type"), col("same_name_payer_cert_no"))), "SAME_ID_NO", "stg_pmp_pay_order", "Strong", not_empty("same_name_payer_cert_no"), None, None, None),
            (self.src_store, "store_url", col("store_url"), self._url_key(col("store_url")), "SAME_STORE_URL", "stg_cust_store_info", "Weak", None, None, None, None),
            (trade_logistics, "goods_store_url", col("goods_store_url"), self._url_key(col("goods_store_url")), "SAME_STORE_URL", "stg_cust_foreign_trade_order_logistics", "Weak", None, col("_trade_cust_id"), None, None),
            (self.src_enterprise, "company_website_url", col("company_website_url"), self._url_key(col("company_website_url")), "SAME_STORE_URL", "stg_cust_enterprise_realname_info", "Weak", None, None, None, None),
            (self.src_login, "login_ip", col("login_ip"), self._exact_key(col("login_ip")), "SAME_IP", "stg_cust_user_login_log", "Weak", None, None, None, None),
        ]

        for (
            src_df,
            src_label,
            value_expr,
            key_expr,
            edge_type,
            edge_source,
            strength,
            src_filter,
            cust_expr,
            create_expr,
            update_expr,
        ) in specs:
            self._process_attr_spec(
                src_df,
                src_label,
                value_expr,
                key_expr,
                edge_type,
                edge_source,
                strength,
                src_filter=src_filter,
                cust_expr=cust_expr,
                create_expr=create_expr,
                update_expr=update_expr,
            )

    def transform(self, df: DataFrame) -> DataFrame:
        """Not used — process() handles batching directly."""
        raise NotImplementedError("Use process() which batches by spec.")


class DwdGraphEdgesSnapshotEtl(Etl):
    """Canonical graph edge snapshot aggregated from monthly evidence."""

    src_db = "usr_skyee_mw"
    src_tbl = "dwd_graph_edge_monthly"
    dst_db = "usr_skyee_mw"
    dst_tbl = "dwd_graph_edges"
    id = "edge_id"
    ts = "last_seen"
    filter_by = None
    par_cols = ["edge_type", "edge_month"]
    path = "/user/hive/warehouse/usr_skyee_mw.db/dwd_graph_edges"
    table_type = "hudi_table"
    hudi_mode = "upsert"
    concurrency_mode = "SINGLE_WRITER"

    def extract(self, start_date: str = None, end_date: str = None) -> DataFrame:
        return self.spark.table(f"{self.src_db}.{self.src_tbl}")

    def transform(self, df: DataFrame) -> DataFrame:
        df = df.filter(col("edge_type") != "COUNTERPARTY")
        edges = (
            df.groupBy(
                "edge_id",
                "source_cust_id",
                "target_cust_id",
                "edge_type",
                "edge_value",
                "edge_source",
                "strength",
            )
            .agg(
                spark_min("first_seen").alias("first_seen"),
                spark_max("last_seen").alias("last_seen"),
                spark_sum("record_count").cast("int").alias("record_count"),
            )
        )
        event_ts = coalesce(col("first_seen"), col("last_seen"))
        return edges.withColumn("dt", event_ts.cast("date")).withColumn(
            "etl_ts", current_timestamp()
        ).withColumn(
            "edge_month", date_format(col("last_seen"), "yyyy-MM")
        ).select(
            "edge_id",
            "source_cust_id",
            "target_cust_id",
            "edge_value",
            "edge_source",
            "strength",
            "first_seen",
            "last_seen",
            "record_count",
            "dt",
            "etl_ts",
            "edge_type",
            "edge_month",
        )


def main(
    spark_remote: Annotated[Optional[str], typer.Option("--spark-remote")] = None,
    start_date: Annotated[str, typer.Option("--start-date")] = None,
    end_date: Annotated[str, typer.Option("--end-date")] = None,
    bulk: Annotated[bool, typer.Option("--bulk/--per-day")] = True,
    max_degree: Annotated[int, typer.Option("--max-degree")] = MAX_DEGREE,
    snapshot_hudi_mode: Annotated[str, typer.Option("--snapshot-hudi-mode")] = "upsert",
):
    spark = create_spark_session(spark_remote)
    etl = DwdGraphEdgesEtl(
        start_date=start_date,
        end_date=end_date,
        bulk=bulk,
        max_degree=max_degree,
    )
    etl.spark = spark
    etl()

    snapshot = DwdGraphEdgesSnapshotEtl(
        start_date=start_date,
        end_date=end_date,
        bulk=bulk,
        hudi_mode_override=snapshot_hudi_mode,
    )
    snapshot.spark = spark
    snapshot()
    spark.stop()


if __name__ == "__main__":
    typer.run(main)
