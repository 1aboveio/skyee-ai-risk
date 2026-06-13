"""Generate dwd_customer from customer master and selected current identity.

Usage:
    python dwd_customer.py --spark-remote <spark_connect_url> [--bulk/--per-day]
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pyspark.sql import DataFrame
from pyspark.sql.window import Window
from pyspark.sql.functions import col, lit, row_number, when
from typing_extensions import Annotated
import typer

from utils.etl import Etl


class DwdCustomerEtl(Etl):
    """Canonical customer subject.

    Grain: one row per customer (cust_id).

    The table enriches the customer master with one selected current identity
    record. Full KYC/account/store/login detail remains in STG until a real
    semantic DWD table is justified.
    """

    src_db = "usr_skyee_mw"
    src_tbl = "stg_cust_customer_info"
    dst_db = "usr_skyee_mw"
    dst_tbl = "dwd_customer"
    id = "cust_id"
    ts = "lst_upd_time"
    filter_by = None
    par_cols = ["dt"]
    path = "/user/hive/warehouse/usr_skyee_mw.db/dwd_customer"
    table_type = "hudi_table"
    hudi_mode = "upsert"
    concurrency_mode = "SINGLE_WRITER"

    def extract(self, start_date: str = None, end_date: str = None) -> DataFrame:
        # Full refresh into Hudi upsert keeps identity selection correct when an
        # old customer receives a new KYC record outside its original dt.
        self.src_person = self.spark.table(f"{self.src_db}.stg_cust_person_realname_info")
        self.src_enterprise = self.spark.table(
            f"{self.src_db}.stg_cust_enterprise_realname_info"
        )
        return self.spark.table(f"{self.src_db}.{self.src_tbl}")

    @staticmethod
    def _active(df: DataFrame) -> DataFrame:
        return df.filter(
            col("cust_id").isNotNull()
            & ((col("delete_flag").isNull()) | (col("delete_flag") != lit("Y")))
        )

    @staticmethod
    def _selected_identity(df: DataFrame) -> DataFrame:
        window = Window.partitionBy("cust_id").orderBy(
            when(col("main_record") == lit("Y"), lit(0)).otherwise(lit(1)),
            col("lst_upd_time").desc_nulls_last(),
            col("id").desc_nulls_last(),
        )
        return (
            df.withColumn("_identity_rank", row_number().over(window))
            .filter(col("_identity_rank") == lit(1))
            .drop("_identity_rank")
        )

    def _person_identity(self) -> DataFrame:
        return self._selected_identity(self._active(self.src_person)).select(
            col("cust_id").alias("p_cust_id"),
            col("id").cast("long").alias("p_identity_id"),
            col("name").alias("p_name"),
            col("en_name").alias("p_en_name"),
            col("country").alias("p_country"),
            col("cert_type").alias("p_cert_type"),
            col("cert_no").alias("p_cert_no"),
            col("cert_address").alias("p_cert_address"),
            col("residence_address").alias("p_residence_address"),
            when(col("main_record") == lit("Y"), lit("MAIN_RECORD"))
            .otherwise(lit("LATEST_RECORD"))
            .alias("p_selection_method"),
        )

    def _enterprise_identity(self) -> DataFrame:
        return self._selected_identity(self._active(self.src_enterprise)).select(
            col("cust_id").alias("e_cust_id"),
            col("id").cast("long").alias("e_identity_id"),
            col("enterprise_name").alias("e_name"),
            col("en_name").alias("e_en_name"),
            col("regist_country").alias("e_country"),
            col("cert_type").alias("e_cert_type"),
            col("cert_no").alias("e_cert_no"),
            col("cert_address").alias("e_cert_address"),
            col("residence_address").alias("e_residence_address"),
            col("legal_person_name").alias("e_legal_person_name"),
            col("business_status").alias("e_business_status"),
            col("company_website_url").alias("e_company_website_url"),
            when(col("main_record") == lit("Y"), lit("MAIN_RECORD"))
            .otherwise(lit("LATEST_RECORD"))
            .alias("e_selection_method"),
        )

    def transform(self, df: DataFrame) -> DataFrame:
        customer = self._active(df).alias("c")
        person = self._person_identity().alias("p")
        enterprise = self._enterprise_identity().alias("e")

        joined = (
            customer.join(person, col("c.cust_id") == col("p.p_cust_id"), "left")
            .join(enterprise, col("c.cust_id") == col("e.e_cust_id"), "left")
        )

        is_company = col("c.cust_type") == lit("COMPANY")
        is_personal = col("c.cust_type") == lit("PERSONAL")

        selected_identity_type = (
            when(is_company & col("e.e_identity_id").isNotNull(), lit("ENTERPRISE"))
            .when(is_personal & col("p.p_identity_id").isNotNull(), lit("PERSON"))
            .otherwise(lit("NONE"))
        )

        return joined.select(
            col("c.cust_id").cast("long").alias("cust_id"),
            col("c.cust_type"),
            col("c.cust_name"),
            col("c.en_name"),
            col("c.old_cust_name"),
            col("c.mobile_code"),
            col("c.cust_mobile"),
            col("c.email"),
            col("c.contact_mobile"),
            col("c.regist_country"),
            col("c.merchant_platform"),
            col("c.merchant_platform_sub_type"),
            col("c.cust_status"),
            col("c.realname_status"),
            col("c.realname_finish_time"),
            col("c.risk_level"),
            col("c.risk_score"),
            col("c.sanctioned"),
            col("c.high_risk"),
            col("c.last_risk_scan_id"),
            col("c.last_risk_scan_time"),
            col("c.last_risk_scan_desc"),
            col("c.business_model"),
            col("c.industry"),
            col("c.staff_count_desc"),
            col("c.bussiness_scale"),
            col("c.expected_annual_turnover"),
            col("c.expected_monthly_turnover"),
            col("c.cust_biz_category"),
            col("c.source"),
            col("c.channel_partner"),
            col("c.cust_label"),
            col("c.invite_code"),
            col("c.invitor"),
            col("c.proxy_user"),
            col("c.manage_user"),
            col("c.cust_relation_type"),
            col("c.import_agent_type"),
            col("c.pay_quota"),
            col("c.active_status"),
            col("c.active_time"),
            col("c.stopped_time"),
            col("c.frozen_time"),
            col("c.frozen_reason"),
            col("c.reg_time"),
            col("c.first_realname_submit_time"),
            col("c.first_realname_success_time"),
            selected_identity_type.alias("selected_identity_type"),
            when(is_company, col("e.e_identity_id"))
            .when(is_personal, col("p.p_identity_id"))
            .cast("long")
            .alias("selected_identity_id"),
            when(is_company, col("e.e_name"))
            .when(is_personal, col("p.p_name"))
            .alias("verified_name"),
            when(is_company, col("e.e_en_name"))
            .when(is_personal, col("p.p_en_name"))
            .alias("verified_en_name"),
            when(is_company, col("e.e_country"))
            .when(is_personal, col("p.p_country"))
            .alias("verified_country"),
            when(is_company, col("e.e_cert_type"))
            .when(is_personal, col("p.p_cert_type"))
            .alias("verified_cert_type"),
            when(is_company, col("e.e_cert_no"))
            .when(is_personal, col("p.p_cert_no"))
            .alias("verified_cert_no"),
            when(is_company, col("e.e_cert_address"))
            .when(is_personal, col("p.p_cert_address"))
            .alias("verified_cert_address"),
            when(is_company, col("e.e_residence_address"))
            .when(is_personal, col("p.p_residence_address"))
            .alias("verified_residence_address"),
            when(is_company, col("e.e_legal_person_name")).alias(
                "company_legal_person_name"
            ),
            when(is_company, col("e.e_business_status")).alias("company_business_status"),
            when(is_company, col("e.e_company_website_url")).alias(
                "company_website_url"
            ),
            when(is_company & col("e.e_identity_id").isNotNull(), col("e.e_selection_method"))
            .when(is_personal & col("p.p_identity_id").isNotNull(), col("p.p_selection_method"))
            .otherwise(lit("NONE"))
            .alias("identity_selection_method"),
            col("c.create_user"),
            col("c.create_time"),
            col("c.lst_upd_user"),
            col("c.lst_upd_time"),
            col("c.delete_flag"),
            col("c.create_time").cast("date").alias("dt"),
        )


def main(
    spark_remote: Annotated[str, typer.Option("--spark-remote")],
    start_date: Annotated[str, typer.Option("--start-date")] = None,
    end_date: Annotated[str, typer.Option("--end-date")] = None,
    bulk: Annotated[bool, typer.Option("--bulk/--per-day")] = True,
):
    from pyspark.sql import SparkSession

    spark = SparkSession.builder.remote(spark_remote).getOrCreate()
    etl = DwdCustomerEtl(
        start_date=start_date,
        end_date=end_date,
        bulk=bulk,
    )
    etl.spark = spark
    etl()
    spark.stop()


if __name__ == "__main__":
    typer.run(main)
