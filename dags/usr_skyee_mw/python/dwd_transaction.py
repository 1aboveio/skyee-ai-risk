"""Generate dwd_transaction from payout details and collection orders.

Usage:
    python dwd_transaction.py [--spark-remote <spark_connect_url>] [--start-date <YYYY-MM-DD>] [--end-date <YYYY-MM-DD>] [--bulk/--per-day]
"""

import os
import sys
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pyspark.sql import Column, DataFrame
from pyspark.sql.functions import (
    coalesce,
    col,
    concat,
    greatest,
    lit,
    to_date,
    trim,
    when,
)
from pyspark.sql.types import DecimalType, LongType, StringType, TimestampType
from typing_extensions import Annotated
import typer

from utils.etl import Etl, create_spark_session


class DwdTransactionEtl(Etl):
    """Canonical transaction detail.

    Grain: one row per payment detail or collection order.

    Payout rows come from payment detail joined to payment order. Collection
    rows come from collection order. This is intentionally not a source-table
    replica: it gives payment and collection activity one shared transaction
    shape for risk, investigation, and transaction-flow graph use cases.

    Incremental windows are based on the source STG create partition (`dt`),
    not update time. That keeps each backfill window responsible for stable
    output partitions.
    """

    src_db = None
    src_tbl = None
    dst_db = "usr_skyee_mw"
    dst_tbl = "dwd_transaction"
    id = "txn_id"
    ts = "lst_upd_time"
    filter_by = None
    par_cols = ["dt"]
    path = "/user/hive/warehouse/usr_skyee_mw.db/dwd_transaction"
    table_type = "hudi_table"
    hudi_mode = "insert_overwrite"
    concurrency_mode = "SINGLE_WRITER"

    def extract(self, start_date: str = None, end_date: str = None) -> DataFrame:
        self.start_date = start_date or self.start_date
        self.end_date = end_date or self.end_date

        db = "usr_skyee_mw"
        self.src_pay_order = self.spark.table(f"{db}.stg_pmp_pay_order")
        self.src_pay_details = self.spark.table(f"{db}.stg_pmp_pay_details")
        self.src_coll_order = self.spark.table(f"{db}.stg_pmp_coll_order")
        return self._with_forex(self._pay_rows().unionByName(self._collection_rows()))

    @staticmethod
    def _is_active(alias: str) -> Column:
        return (col(f"{alias}.delete_flag").isNull()) | (
            col(f"{alias}.delete_flag") != lit("Y")
        )

    @staticmethod
    def _in_date_window(
        expr: Column, start_date: str = None, end_date: str = None
    ) -> Column:
        date_expr = expr.cast("date")
        cond = lit(True)
        if start_date:
            cond = cond & (date_expr >= lit(start_date).cast("date"))
        if end_date:
            cond = cond & (date_expr < lit(end_date).cast("date"))
        return cond

    @staticmethod
    def _empty(data_type):
        return lit(None).cast(data_type)

    @staticmethod
    def _not_blank(value: Column) -> Column:
        return value.isNotNull() & (trim(value.cast("string")) != lit(""))

    @classmethod
    def _flag(cls, condition: Column) -> Column:
        return when(condition, lit("Y")).otherwise(lit("N"))

    def _with_forex(self, df: DataFrame) -> DataFrame:
        """Add transaction-currency-to-CNY FX rate and risk-ready CNY amount."""
        forex = (
            self.spark.table("dim.dim_forex")
            .filter(col("from") == lit("USD"))
            .select(
                col("date").cast("date").alias("__fx_date"),
                col("to").alias("__fx_currency"),
                col("exchange_rate")
                .cast(DecimalType(20, 8))
                .alias("__usd_to_currency_rate"),
            )
        )
        currency_fx = (
            forex.select(
                col("__fx_date").alias("__currency_fx_date"),
                col("__fx_currency").alias("__currency_fx_currency"),
                col("__usd_to_currency_rate"),
            )
            .alias("currency_fx")
        )
        cny_fx = (
            forex.filter(col("__fx_currency") == lit("CNY"))
            .select(
                col("__fx_date").alias("__cny_fx_date"),
                col("__usd_to_currency_rate").alias("__usd_to_cny_rate"),
            )
            .alias("cny_fx")
        )

        df_with_date = df.withColumn("__fx_date", coalesce(to_date(col("txn_time")), col("dt")))
        joined = (
            df_with_date.join(
                currency_fx,
                (col("__fx_date") == col("currency_fx.__currency_fx_date"))
                & (col("txn_currency") == col("currency_fx.__currency_fx_currency")),
                "left",
            )
            .join(cny_fx, col("__fx_date") == col("cny_fx.__cny_fx_date"), "left")
        )

        fx_rate = (
            when(col("txn_currency") == lit("CNY"), lit(1))
            .when(col("__usd_to_currency_rate").isNull(), lit(None))
            .otherwise(col("__usd_to_cny_rate") / col("__usd_to_currency_rate"))
            .cast(DecimalType(20, 8))
        )

        enriched = joined.withColumn("fx_rate", fx_rate).withColumn(
            "use_amount",
            coalesce(
                col("txn_amount_cny"),
                (col("txn_amount") * col("fx_rate")).cast(DecimalType(20, 6)),
            ).cast(DecimalType(20, 6)),
        )

        ordered_columns = []
        for name in df.columns:
            ordered_columns.append(name)
            if name == "txn_amount_cny":
                ordered_columns.extend(["use_amount", "fx_rate"])
        return enriched.select(*ordered_columns)

    def _pay_rows(self) -> DataFrame:
        po = self.src_pay_order.alias("po")
        pd = self.src_pay_details.alias("pd")

        if self.start_date or self.end_date:
            pd = pd.filter(
                self._in_date_window(col("pd.dt"), self.start_date, self.end_date)
            )

        joined = pd.join(
            po,
            col("pd.pay_order_id") == col("po.pay_order_id"),
            "left",
        ).filter(self._is_active("pd") & self._is_active("po"))

        txn_time = coalesce(
            col("pd.payment_time"),
            col("po.payment_time"),
            col("pd.pay_post_time"),
            col("po.pay_post_time"),
            col("pd.clear_time"),
            col("po.clear_time"),
            col("pd.create_time"),
        )

        payer_country = col("po.country_cd")
        payee_country = col("pd.coll_country_cd")
        is_cross_border = payer_country.isNotNull() & payee_country.isNotNull() & (
            payer_country != payee_country
        )

        is_pobo = self._not_blank(col("po.same_name_payer_name")) | (
            col("po.use_same_name_pay") == lit("Y")
        )

        return joined.select(
            concat(lit("PAY:"), col("pd.id").cast("string")).alias("txn_id"),
            lit("PAY").alias("transaction_source"),
            col("po.pay_order_id").cast("long").alias("source_order_id"),
            col("pd.id").cast("long").alias("source_detail_id"),
            col("po.cust_id").cast("long").alias("cust_id"),
            lit("PAY_OUT").alias("transaction_direction"),
            coalesce(col("pd.pay_post_status"), col("po.payment_status"), col("po.pay_status")).alias(
                "txn_status"
            ),
            txn_time.alias("txn_time"),
            col("pd.pay_txn_amt").cast(DecimalType(20, 6)).alias("txn_amount"),
            col("pd.currency_cd").alias("txn_currency"),
            col("pd.pay_txn_amt_cny").cast(DecimalType(20, 6)).alias("txn_amount_cny"),
            col("pd.commission_amt").cast(DecimalType(20, 6)).alias("commission_amount"),
            col("po.commission_currency").alias("commission_currency"),
            col("pd.real_commission_amt")
            .cast(DecimalType(20, 6))
            .alias("real_commission_amount"),
            col("po.settle_amt").cast(DecimalType(20, 6)).alias("settlement_amount"),
            col("po.settle_curr_cd").alias("settlement_currency"),
            col("po.is_exchange").alias("is_exchange"),
            col("po.exchange_status").alias("exchange_status"),
            col("po.exchange_curr_cd").alias("exchange_currency"),
            col("po.exchange_amt").cast(DecimalType(20, 6)).alias("exchange_amount"),
            col("po.exchange_rate").cast(DecimalType(20, 8)).alias("exchange_rate"),
            col("po.exchange_time").alias("exchange_time"),
            col("pd.has_refund").alias("is_refund"),
            col("pd.has_refund_commission").alias("is_refund_commission"),
            self._flag(is_pobo).alias("is_pobo"),
            self._flag(self._not_blank(col("po.proxy_user"))).alias("is_agent_initiated"),
            self._flag(is_cross_border).alias("is_cross_border"),
            col("po.is_cross_border_purchase").alias("is_cross_border_purchase"),
            col("po.need_declear").alias("is_declared"),
            col("po.name").alias("initiating_party_name"),
            when(self._not_blank(col("po.proxy_user")), lit("AGENT"))
            .otherwise(lit("CUSTOMER"))
            .alias("initiating_party_type"),
            col("po.proxy_user").alias("initiating_party_id"),
            col("po.name").alias("debtor_name"),
            payer_country.alias("debtor_country"),
            col("pd.mobile_no").alias("debtor_mobile"),
            self._empty(StringType()).alias("debtor_cert_type"),
            col("pd.identity_no").alias("debtor_cert_no"),
            col("po.same_name_payer_name").alias("ultimate_debtor_name"),
            col("po.same_name_payer_en_name").alias("ultimate_debtor_en_name"),
            col("po.same_name_payer_country_code").alias("ultimate_debtor_country_code"),
            col("po.same_name_payer_country_name").alias("ultimate_debtor_country_name"),
            col("po.same_name_payer_cert_type").alias("ultimate_debtor_cert_type"),
            col("po.same_name_payer_cert_no").alias("ultimate_debtor_cert_no"),
            col("po.same_name_payer_mobile").alias("ultimate_debtor_mobile"),
            col("po.same_name_payer_address").alias("ultimate_debtor_address"),
            col("po.same_name_payer_birthday").alias("ultimate_debtor_birthday"),
            col("po.same_name_payer_bank_acct_no").alias("ultimate_debtor_bank_acct_no"),
            col("po.same_name_payer_province").alias("ultimate_debtor_province"),
            col("po.same_name_payer_city").alias("ultimate_debtor_city"),
            col("po.same_name_payer_postcode").alias("ultimate_debtor_postcode"),
            col("pd.subject_name").alias("creditor_name"),
            col("pd.beneficiary_email").alias("creditor_email"),
            col("pd.beneficiary_identification_type").alias("creditor_cert_type"),
            col("pd.beneficiary_identification_no").alias("creditor_cert_no"),
            col("pd.coll_address").alias("creditor_address"),
            col("pd.coll_en_address").alias("creditor_en_address"),
            payee_country.alias("creditor_country"),
            col("pd.beneficiary_province").alias("creditor_province"),
            col("pd.beneficiary_city").alias("creditor_city"),
            col("pd.beneficiary_post_code").alias("creditor_postcode"),
            self._empty(StringType()).alias("debtor_agent_name"),
            self._empty(StringType()).alias("debtor_agent_code"),
            self._empty(StringType()).alias("debtor_agent_swift"),
            self._empty(StringType()).alias("debtor_agent_country"),
            col("pd.bank_name").alias("creditor_agent_name"),
            col("pd.bank_code").alias("creditor_agent_code"),
            col("pd.swift_code").alias("creditor_agent_swift"),
            col("pd.bank_acct_no").alias("creditor_agent_acct_no"),
            col("pd.bank_acct_name").alias("creditor_agent_acct_name"),
            col("pd.bank_country").alias("creditor_agent_country"),
            col("pd.province").alias("creditor_agent_province"),
            col("pd.city").alias("creditor_agent_city"),
            col("pd.bank_branch_name").alias("creditor_agent_branch_name"),
            col("pd.bank_branch_no").alias("creditor_agent_branch_no"),
            coalesce(col("pd.pay_method"), col("po.pay_method"), col("po.payment_method")).alias(
                "pay_method"
            ),
            coalesce(col("pd.pay_type"), col("po.pay_type")).alias("pay_type"),
            col("po.trade_type").alias("trade_type"),
            col("po.business_type").alias("business_type"),
            coalesce(col("pd.sub_biz_type"), col("po.sub_biz_type")).alias("sub_biz_type"),
            coalesce(col("pd.fund_purpose"), col("po.fund_purpose"), col("po.pay_purpose")).alias(
                "fund_purpose"
            ),
            coalesce(col("pd.clear_status"), col("po.clear_status")).alias("clear_status"),
            coalesce(col("pd.clear_time"), col("po.clear_time")).alias("clear_time"),
            col("pd.clear_chl_code").alias("clear_channel_code"),
            col("pd.clear_chl_name").alias("clear_channel_name"),
            col("pd.clear_chl_seq").alias("clear_channel_seq"),
            coalesce(col("pd.pay_post_status"), col("po.pay_post_status")).alias("post_status"),
            coalesce(col("pd.pay_post_time"), col("po.pay_post_time")).alias("post_time"),
            coalesce(col("po.audit_status"), col("po.qualified_status")).alias("audit_status"),
            coalesce(col("po.audit_finish_time"), col("po.qualified_time")).alias("audit_time"),
            col("po.qualified_no").alias("audit_no"),
            col("pd.pay_memo").alias("memo"),
            col("pd.remark").alias("remark"),
            col("pd.create_user").alias("create_user"),
            col("pd.create_time").alias("create_time"),
            col("pd.lst_upd_user").alias("lst_upd_user"),
            greatest(
                coalesce(col("pd.lst_upd_time"), col("pd.create_time")),
                coalesce(col("po.lst_upd_time"), col("po.create_time")),
            ).alias("lst_upd_time"),
            col("pd.delete_flag").alias("delete_flag"),
            col("pd.dt").cast("date").alias("dt"),
        )

    def _collection_rows(self) -> DataFrame:
        co = self.src_coll_order.alias("co")
        if self.start_date or self.end_date:
            co = co.filter(
                self._in_date_window(col("co.dt"), self.start_date, self.end_date)
            )

        co = co.filter(self._is_active("co"))
        txn_time = coalesce(
            col("co.arrival_time"),
            col("co.post_time"),
            col("co.create_time"),
        )

        payer_country = col("co.pay_bank_country")
        payee_country = col("co.country_cd")
        is_cross_border = payer_country.isNotNull() & payee_country.isNotNull() & (
            payer_country != payee_country
        )

        return co.select(
            concat(lit("COLL:"), col("co.coll_order_id").cast("string")).alias("txn_id"),
            lit("COLL").alias("transaction_source"),
            col("co.coll_order_id").cast("long").alias("source_order_id"),
            self._empty(LongType()).alias("source_detail_id"),
            col("co.cust_id").cast("long").alias("cust_id"),
            lit("COLLECTION_IN").alias("transaction_direction"),
            coalesce(col("co.arrival_status"), col("co.coll_status")).alias("txn_status"),
            txn_time.alias("txn_time"),
            col("co.coll_txn_amt").cast(DecimalType(20, 6)).alias("txn_amount"),
            col("co.coll_currency_cd").alias("txn_currency"),
            col("co.coll_txn_cny_amt").cast(DecimalType(20, 6)).alias("txn_amount_cny"),
            col("co.commission_amt").cast(DecimalType(20, 6)).alias("commission_amount"),
            col("co.commission_currency_cd").alias("commission_currency"),
            self._empty(DecimalType(20, 6)).alias("real_commission_amount"),
            self._empty(DecimalType(20, 6)).alias("settlement_amount"),
            self._empty(StringType()).alias("settlement_currency"),
            col("co.is_exchange").alias("is_exchange"),
            col("co.exchange_status").alias("exchange_status"),
            col("co.exchange_curr_cd").alias("exchange_currency"),
            col("co.exchange_amt").cast(DecimalType(20, 6)).alias("exchange_amount"),
            col("co.exchange_rate").cast(DecimalType(20, 8)).alias("exchange_rate"),
            col("co.exchange_time").alias("exchange_time"),
            self._flag(self._not_blank(col("co.refund_status"))).alias("is_refund"),
            self._flag(self._not_blank(col("co.refund_comm_currency_cd"))).alias(
                "is_refund_commission"
            ),
            lit("N").alias("is_pobo"),
            self._flag(self._not_blank(col("co.proxy_user"))).alias("is_agent_initiated"),
            self._flag(is_cross_border).alias("is_cross_border"),
            self._empty(StringType()).alias("is_cross_border_purchase"),
            self._empty(StringType()).alias("is_declared"),
            col("co.name").alias("initiating_party_name"),
            when(self._not_blank(col("co.proxy_user")), lit("AGENT"))
            .otherwise(lit("CUSTOMER"))
            .alias("initiating_party_type"),
            col("co.proxy_user").alias("initiating_party_id"),
            col("co.pay_bank_acct_name").alias("debtor_name"),
            payer_country.alias("debtor_country"),
            self._empty(StringType()).alias("debtor_mobile"),
            self._empty(StringType()).alias("debtor_cert_type"),
            self._empty(StringType()).alias("debtor_cert_no"),
            self._empty(StringType()).alias("ultimate_debtor_name"),
            self._empty(StringType()).alias("ultimate_debtor_en_name"),
            self._empty(StringType()).alias("ultimate_debtor_country_code"),
            self._empty(StringType()).alias("ultimate_debtor_country_name"),
            self._empty(StringType()).alias("ultimate_debtor_cert_type"),
            self._empty(StringType()).alias("ultimate_debtor_cert_no"),
            self._empty(StringType()).alias("ultimate_debtor_mobile"),
            self._empty(StringType()).alias("ultimate_debtor_address"),
            self._empty(TimestampType()).alias("ultimate_debtor_birthday"),
            self._empty(StringType()).alias("ultimate_debtor_bank_acct_no"),
            self._empty(StringType()).alias("ultimate_debtor_province"),
            self._empty(StringType()).alias("ultimate_debtor_city"),
            self._empty(StringType()).alias("ultimate_debtor_postcode"),
            coalesce(col("co.va_acct_name"), col("co.coll_bank_acct_name"), col("co.name")).alias(
                "creditor_name"
            ),
            self._empty(StringType()).alias("creditor_email"),
            self._empty(StringType()).alias("creditor_cert_type"),
            self._empty(StringType()).alias("creditor_cert_no"),
            col("co.payee_address").alias("creditor_address"),
            self._empty(StringType()).alias("creditor_en_address"),
            payee_country.alias("creditor_country"),
            self._empty(StringType()).alias("creditor_province"),
            self._empty(StringType()).alias("creditor_city"),
            self._empty(StringType()).alias("creditor_postcode"),
            col("co.pay_bank_name").alias("debtor_agent_name"),
            col("co.pay_bank_code").alias("debtor_agent_code"),
            col("co.swift_code").alias("debtor_agent_swift"),
            col("co.pay_bank_country").alias("debtor_agent_country"),
            col("co.coll_bank_name").alias("creditor_agent_name"),
            self._empty(StringType()).alias("creditor_agent_code"),
            self._empty(StringType()).alias("creditor_agent_swift"),
            col("co.coll_bank_acct_no").alias("creditor_agent_acct_no"),
            col("co.coll_bank_acct_name").alias("creditor_agent_acct_name"),
            payee_country.alias("creditor_agent_country"),
            self._empty(StringType()).alias("creditor_agent_province"),
            self._empty(StringType()).alias("creditor_agent_city"),
            self._empty(StringType()).alias("creditor_agent_branch_name"),
            self._empty(StringType()).alias("creditor_agent_branch_no"),
            coalesce(col("co.coll_method_source"), col("co.payment_platform_code")).alias(
                "pay_method"
            ),
            col("co.collections_type").alias("pay_type"),
            col("co.coll_order_type").alias("trade_type"),
            self._empty(StringType()).alias("business_type"),
            col("co.sub_biz_type").alias("sub_biz_type"),
            col("co.fund_purpose").alias("fund_purpose"),
            self._empty(StringType()).alias("clear_status"),
            self._empty(TimestampType()).alias("clear_time"),
            self._empty(StringType()).alias("clear_channel_code"),
            self._empty(StringType()).alias("clear_channel_name"),
            self._empty(StringType()).alias("clear_channel_seq"),
            col("co.post_status").alias("post_status"),
            col("co.post_time").alias("post_time"),
            coalesce(col("co.audit_status"), col("co.qualified_status")).alias("audit_status"),
            coalesce(col("co.audit_finish_time"), col("co.qualified_time")).alias("audit_time"),
            col("co.qualified_no").alias("audit_no"),
            col("co.coll_memo").alias("memo"),
            col("co.biz_note").alias("remark"),
            col("co.create_user").alias("create_user"),
            col("co.create_time").alias("create_time"),
            col("co.lst_upd_user").alias("lst_upd_user"),
            coalesce(col("co.lst_upd_time"), col("co.create_time")).alias("lst_upd_time"),
            col("co.delete_flag").alias("delete_flag"),
            col("co.dt").cast("date").alias("dt"),
        )

    def transform(self, df: DataFrame) -> DataFrame:
        return df


def main(
    spark_remote: Annotated[Optional[str], typer.Option("--spark-remote")] = None,
    start_date: Annotated[str, typer.Option("--start-date")] = None,
    end_date: Annotated[str, typer.Option("--end-date")] = None,
    bulk: Annotated[bool, typer.Option("--bulk/--per-day")] = True,
):
    spark = create_spark_session(spark_remote)
    etl = DwdTransactionEtl(
        start_date=start_date,
        end_date=end_date,
        bulk=bulk,
    )
    etl.spark = spark
    etl()
    spark.stop()


if __name__ == "__main__":
    typer.run(main)
