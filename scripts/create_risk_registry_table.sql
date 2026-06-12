-- =========================================================================
-- Confirmed Risk Registry - Hive Table Definition
-- =========================================================================
-- Table: usr_skyee_mw.confirmed_risk_registry
-- Purpose: Normalized registry of confirmed risk subjects
--          (currently: bad customer slice; extensible to other risk types)
-- =========================================================================

CREATE TABLE IF NOT EXISTS hive.usr_skyee_mw.confirmed_risk_registry (
    -- Subject identification
    subject_type        VARCHAR     COMMENT 'Type of risk subject (customer, merchant, etc.)',
    subject_id          VARCHAR     COMMENT 'Unique identifier for the subject (e.g., CUST_ID)',

    -- Risk classification
    confirmed_risk_type     VARCHAR COMMENT 'Risk category (bad_customer, fraud_merchant, etc.)',
    confirmed_risk_status   VARCHAR COMMENT 'Risk status (confirmed, under_review, cleared)',

    -- Source lineage
    source_file         VARCHAR     COMMENT 'Original source filename for traceability',
    source_label        VARCHAR     COMMENT 'Label from source file (人工标签)',
    source_bad_type     VARCHAR     COMMENT 'Sub-type from source (坏人类型)',
    source_as_of        VARCHAR     COMMENT 'Source data as-of date or context',

    -- Audit
    ingested_at         TIMESTAMP   COMMENT 'UTC timestamp when record was ingested'
)
COMMENT 'Confirmed risk registry - normalized risk subject entries from labeled data'
STORED AS PARQUET
TBLPROPERTIES (
    'parquet.compression' = 'SNAPPY'
);


-- =========================================================================
-- Alternative: Hudi table for incremental upserts (preferred for production)
-- =========================================================================

-- CREATE TABLE IF NOT EXISTS hive.usr_skyee_mw.confirmed_risk_registry_hudi (
--     subject_type        VARCHAR,
--     subject_id          VARCHAR,
--     confirmed_risk_type     VARCHAR,
--     confirmed_risk_status   VARCHAR,
--     source_file         VARCHAR,
--     source_label        VARCHAR,
--     source_bad_type     VARCHAR,
--     source_as_of        VARCHAR,
--     ingested_at         TIMESTAMP
-- )
-- USING hudi
-- TBLPROPERTIES (
--     'type' = 'cow',
--     'primaryKey' = 'subject_id',
--     'preCombineField' = 'ingested_at'
-- );
