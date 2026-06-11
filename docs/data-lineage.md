# Data Lineage & Quality Report — usr_skyee_mw.stg_* Tables

**Generated:** 2026-06-12 00:34:43
**Presto Cluster:** 172.16.100.213:9666
**Catalog/Schema:** hive.usr_skyee_mw

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Table Overview](#2-table-overview)
3. [Detailed Table Analysis](#3-detailed-table-analysis)
4. [Null Analysis Summary](#4-null-analysis-summary)
5. [Duplicate Analysis](#5-duplicate-analysis)
6. [Referential Integrity](#6-referential-integrity)
7. [Date Range Coverage](#7-date-range-coverage)
8. [Cross-Table Relationships](#8-cross-table-relationships)
9. [Data Lineage: MySQL → Hudi](#9-data-lineage-mysql--hudi)
10. [Data Quality Issues & Recommendations](#10-data-quality-issues--recommendations)

---

## 1. Executive Summary

| Metric | Value |
|--------|-------|
| Total Tables Analyzed | 13 |
| Total Rows (all tables) | 358,019 |
| Tables with CUST_ID FK | 12 |
| Tables with Orphan Records | 11 |
| Tables with Duplicate Rows | 0 |
| Columns with >50% Nulls | 216 |

## 2. Table Overview

| Table | Rows | Columns | Duplicates | Has CUST_ID | Orphans |
|-------|------|---------|------------|-------------|---------|
| `stg_cust_customer_info` | 1,729 | 72 | 0 | Yes | 0 |
| `stg_cust_bank_acct_info` | 5,346 | 96 | 0 | Yes | 4,542 |
| `stg_cust_collections_acct` | 4,005 | 83 | 0 | Yes | 2,670 |
| `stg_cust_enterprise_realname_info` | 2,126 | 67 | 0 | Yes | 79 |
| `stg_cust_foreign_trade_order` | 14,270 | 49 | 0 | Yes | 14,106 |
| `stg_cust_foreign_trade_order_logistics` | 14,270 | 25 | 0 | No | N/A |
| `stg_cust_person_realname_info` | 5,145 | 76 | 0 | Yes | 410 |
| `stg_cust_realname_enterprise_ref_person` | 6,496 | 23 | 0 | Yes | 2,482 |
| `stg_cust_store_info` | 1,210 | 55 | 0 | Yes | 744 |
| `stg_cust_user_login_log` | 118,659 | 25 | 0 | Yes | 114,712 |
| `stg_pmp_coll_order` | 114,734 | 111 | 0 | Yes | 114,204 |
| `stg_pmp_pay_details` | 36,194 | 108 | 0 | Yes | 35,865 |
| `stg_pmp_pay_order` | 33,835 | 138 | 0 | Yes | 33,506 |

## 3. Detailed Table Analysis

### 3.1 `stg_cust_customer_info`

- **Row count:** 1,729
- **Column count:** 72

**Columns:**

| # | Column | Data Type | Null % |
|---|--------|-----------|--------|
| 1 | `_hoodie_commit_time` | varchar | 0.0% |
| 2 | `_hoodie_commit_seqno` | varchar | 0.0% |
| 3 | `_hoodie_record_key` | varchar | 0.0% |
| 4 | `_hoodie_partition_path` | varchar | 0.0% |
| 5 | `_hoodie_file_name` | varchar | 0.0% |
| 6 | `cust_id` | bigint | 0.0% |
| 7 | `cust_type` | varchar | 0.0% |
| 8 | `cust_name` | varchar | 0.0% |
| 9 | `mobile_code` | varchar | 0.0% |
| 10 | `cust_mobile` | varchar | 0.0% |
| 11 | `email` | varchar | 0.0% |
| 12 | `regist_country` | varchar | 20.76% |
| 13 | `merchant_platform` | varchar | 0.0% |
| 14 | `merchant_platform_sub_type` | varchar | 0.0% |
| 15 | `cust_status` | varchar | 0.0% |
| 16 | `realname_status` | varchar | 0.0% |
| 17 | `reg_time` | timestamp | 0.0% |
| 18 | `realname_finish_time` | timestamp | 34.01% |
| 19 | `primary_prod` | varchar | 100.0% |
| 20 | `business_model` | varchar | 100.0% |
| 21 | `industry` | varchar | 99.94% |
| 22 | `founded_time` | timestamp | 100.0% |
| 23 | `staff_count_desc` | varchar | 100.0% |
| 24 | `bussiness_scale` | varchar | 100.0% |
| 25 | `expected_annual_turnover` | integer | 100.0% |
| 26 | `risk_level` | varchar | 34.01% |
| 27 | `risk_score` | decimal(4,2) | 34.01% |
| 28 | `sanctioned` | varchar | 0.0% |
| 29 | `high_risk` | varchar | 0.0% |
| 30 | `last_risk_scan_id` | bigint | 34.01% |
| 31 | `last_risk_scan_time` | timestamp | 34.01% |
| 32 | `last_risk_scan_desc` | varchar | 100.0% |
| 33 | `proxy_user` | varchar | 13.53% |
| 34 | `if_famous_company` | varchar | 100.0% |
| 35 | `if_pay_org` | varchar | 100.0% |
| 36 | `remark` | varchar | 100.0% |
| 37 | `create_user` | varchar | 13.53% |
| 38 | `create_time` | timestamp | 0.0% |
| 39 | `lst_upd_user` | varchar | 75.65% |
| 40 | `lst_upd_time` | timestamp | 0.0% |
| 41 | `jpa_version` | integer | 0.0% |
| 42 | `delete_flag` | varchar | 0.0% |
| 43 | `invite_code` | varchar | 13.53% |
| 44 | `invitor` | varchar | 100.0% |
| 45 | `pay_quota` | decimal(18,2) | 0.0% |
| 46 | `old_cust_id` | varchar | 0.0% |
| 47 | `active_status` | varchar | 0.0% |
| 48 | `active_time` | timestamp | 90.69% |
| 49 | `manage_user` | varchar | 59.92% |
| 50 | `old_cust_name` | varchar | 0.0% |
| 51 | `old_storeholder_id` | varchar | 0.0% |
| 52 | `en_name` | varchar | 6.94% |
| 53 | `stopped_time` | timestamp | 100.0% |
| 54 | `frozen_time` | timestamp | 99.77% |
| 55 | `cust_relation_type` | varchar | 0.0% |
| 56 | `migrate_time` | timestamp | 100.0% |
| 57 | `import_agent_type` | varchar | 13.53% |
| 58 | `frozen_reason` | varchar | 99.77% |
| 59 | `secd_cust_no` | varchar | 93.35% |
| 60 | `secd_cust_association_type` | varchar | 93.35% |
| 61 | `first_realname_submit_time` | timestamp | 25.68% |
| 62 | `first_realname_success_time` | timestamp | 34.01% |
| 63 | `source` | varchar | 13.53% |
| 64 | `channel_partner` | varchar | 100.0% |
| 65 | `cust_label` | varchar | 0.0% |
| 66 | `label_update_time` | timestamp | 54.42% |
| 67 | `contact_mobile` | varchar | 20.76% |
| 68 | `contact_mobile_source` | varchar | 0.0% |
| 69 | `contact_mobile_save_time` | timestamp | 83.11% |
| 70 | `expected_monthly_turnover` | varchar | 0.0% |
| 71 | `cust_biz_category` | varchar | 0.0% |
| 72 | `dt` | date | 0.0% |

**Key Column Uniqueness:**

- `cust_id`: 1,729 unique values
  - Sample: `1017807148421110`, `1017804046201114`, `1017806850411002`, `1017807136391009`, `1017807129071103`

**Date Ranges:**

- `create_time` (timestamp): 2026-06-01 00:06:02.000 → 2026-06-11 23:20:15.000

**Duplicate Analysis:**

- Total rows: 1,729
- Extra duplicate rows: 0

**Referential Integrity (→ stg_cust_customer_info.CUST_ID):**

- FK column: `cust_id`
- Non-null FK values: 1,729
- Null FK values: 0
- Orphan records: 0 (0.0%)

---

### 3.2 `stg_cust_bank_acct_info`

- **Row count:** 5,346
- **Column count:** 96

**Columns:**

| # | Column | Data Type | Null % |
|---|--------|-----------|--------|
| 1 | `_hoodie_commit_time` | varchar | 0.0% |
| 2 | `_hoodie_commit_seqno` | varchar | 0.0% |
| 3 | `_hoodie_record_key` | varchar | 0.0% |
| 4 | `_hoodie_partition_path` | varchar | 0.0% |
| 5 | `_hoodie_file_name` | varchar | 0.0% |
| 6 | `id` | bigint | 0.0% |
| 7 | `cust_id` | bigint | 0.0% |
| 8 | `acct_status` | varchar | 0.0% |
| 9 | `bank_acct_type` | varchar | 0.0% |
| 10 | `business_scenario` | varchar | 0.0% |
| 11 | `counterparty_id` | bigint | 0.0% |
| 12 | `entity_type` | varchar | 0.0% |
| 13 | `entity_nature` | varchar | 0.0% |
| 14 | `acct_type` | varchar | 0.0% |
| 15 | `support_currency` | varchar | 0.0% |
| 16 | `acct_name` | varchar | 0.0% |
| 17 | `acct_no` | varchar | 0.0% |
| 18 | `entity_country` | varchar | 0.0% |
| 19 | `entity_address` | varchar | 0.0% |
| 20 | `phone_code` | varchar | 16.97% |
| 21 | `phone_no` | varchar | 0.0% |
| 22 | `reserved_mobile` | varchar | 0.0% |
| 23 | `bank_name` | varchar | 0.0% |
| 24 | `bank_country` | varchar | 0.0% |
| 25 | `support_internal_wire_transfer` | varchar | 0.0% |
| 26 | `swift_code` | varchar | 0.0% |
| 27 | `acct_en_name` | varchar | 0.0% |
| 28 | `bank_detail_en_address` | varchar | 0.0% |
| 29 | `bank_en_name` | varchar | 0.0% |
| 30 | `bank_en_address` | varchar | 0.0% |
| 31 | `support_local_transfer` | varchar | 0.0% |
| 32 | `local_transfer_mode` | varchar | 0.0% |
| 33 | `bank_identify_no_type` | varchar | 0.0% |
| 34 | `bank_identify_no` | varchar | 0.0% |
| 35 | `branch_name` | varchar | 0.0% |
| 36 | `branch_identify_no` | varchar | 0.0% |
| 37 | `branch_address` | varchar | 0.0% |
| 38 | `branch_province` | varchar | 66.57% |
| 39 | `branch_city` | varchar | 66.63% |
| 40 | `branch_area` | varchar | 86.51% |
| 41 | `id_card_no` | varchar | 0.0% |
| 42 | `bankcard_verify_status` | varchar | 0.0% |
| 43 | `audit_status` | varchar | 0.0% |
| 44 | `audit_start_time` | timestamp | 72.91% |
| 45 | `audit_finish_time` | timestamp | 1.42% |
| 46 | `audit_flow_instance_id` | varchar | 0.0% |
| 47 | `ref_delete_id` | bigint | 0.0% |
| 48 | `create_user` | varchar | 0.0% |
| 49 | `create_time` | timestamp | 0.0% |
| 50 | `lst_upd_user` | varchar | 99.7% |
| 51 | `lst_upd_time` | timestamp | 0.0% |
| 52 | `jpa_version` | integer | 0.0% |
| 53 | `delete_flag` | varchar | 0.0% |
| 54 | `merchant_platform_type` | varchar | 0.04% |
| 55 | `auto_audit_pass` | varchar | 0.0% |
| 56 | `alias_name` | varchar | 28.02% |
| 57 | `prove_file` | varchar | 99.72% |
| 58 | `refused_reason` | varchar | 0.0% |
| 59 | `need_complete_files` | varchar | 0.0% |
| 60 | `audit_complete_files` | varchar | 0.0% |
| 61 | `audit_complete_note` | varchar | 0.0% |
| 62 | `bank_name_other` | varchar | 14.83% |
| 63 | `entity_person_id` | bigint | 98.24% |
| 64 | `bank_code` | varchar | 83.26% |
| 65 | `entity_en_address` | varchar | 70.41% |
| 66 | `inter_bank_no` | varchar | 0.0% |
| 67 | `batch_audit_no` | varchar | 0.0% |
| 68 | `entity_province` | varchar | 89.97% |
| 69 | `entity_province_code` | varchar | 94.87% |
| 70 | `entity_city` | varchar | 86.42% |
| 71 | `entity_post_code` | varchar | 92.63% |
| 72 | `default_bank_acct` | varchar | 0.0% |
| 73 | `entity_identification_type` | varchar | 0.0% |
| 74 | `entity_identification_no` | varchar | 0.0% |
| 75 | `entity_email` | varchar | 0.0% |
| 76 | `audit_middle_variable` | varchar | 79.59% |
| 77 | `entity_birthday` | timestamp | 99.96% |
| 78 | `cp_type` | varchar | 28.99% |
| 79 | `lst_pass_acct_name` | varchar | 0.0% |
| 80 | `pay_target_country` | varchar | 99.05% |
| 81 | `bank_acct_fill_in_type` | varchar | 97.33% |
| 82 | `payee_additional_info` | varchar | 100.0% |
| 83 | `bank_identify_no_from_chl` | varchar | 0.0% |
| 84 | `bank_acct_category` | varchar | 0.0% |
| 85 | `bank_acct_usage` | varchar | 0.0% |
| 86 | `acct_owner` | varchar | 0.0% |
| 87 | `sort` | integer | 0.0% |
| 88 | `service_provider_id` | bigint | 0.0% |
| 89 | `related_cust_id` | bigint | 0.0% |
| 90 | `feedback_incorrect` | varchar | 0.0% |
| 91 | `pay_purpose` | varchar | 0.0% |
| 92 | `ref_company_counterparty_id` | bigint | 100.0% |
| 93 | `ref_company_name` | varchar | 0.0% |
| 94 | `ref_company_cert_no` | varchar | 0.0% |
| 95 | `check_ref_company_info` | varchar | 0.0% |
| 96 | `dt` | date | 0.0% |

**Key Column Uniqueness:**

- `cust_id`: 2,565 unique values
  - Sample: `1017802793341002`, `1017803983531003`, `1017655096891102`, `1017502156341003`, `1016865573381027`
- `id`: 5,346 unique values
  - Sample: `1514674239372832777`, `1514573181355077634`, `1514668345788506119`, `1514442023975825411`, `1514596286991478784`

**Date Ranges:**

- `create_time` (timestamp): 2026-06-01 00:24:30.000 → 2026-06-11 23:50:50.000

**Duplicate Analysis:**

- Total rows: 5,346
- Extra duplicate rows: 0

**Referential Integrity (→ stg_cust_customer_info.CUST_ID):**

- FK column: `cust_id`
- Non-null FK values: 5,346
- Null FK values: 0
- Orphan records: 4,542 (84.96%)
- **WARNING: 4,542 orphan records found**

---

### 3.3 `stg_cust_collections_acct`

- **Row count:** 4,005
- **Column count:** 83

**Columns:**

| # | Column | Data Type | Null % |
|---|--------|-----------|--------|
| 1 | `_hoodie_commit_time` | varchar | 0.0% |
| 2 | `_hoodie_commit_seqno` | varchar | 0.0% |
| 3 | `_hoodie_record_key` | varchar | 0.0% |
| 4 | `_hoodie_partition_path` | varchar | 0.0% |
| 5 | `_hoodie_file_name` | varchar | 0.0% |
| 6 | `id` | bigint | 0.0% |
| 7 | `cust_id` | bigint | 0.0% |
| 8 | `name` | varchar | 0.0% |
| 9 | `acctno_alias` | varchar | 42.6% |
| 10 | `coll_acctno_type` | varchar | 0.0% |
| 11 | `collections_type` | varchar | 0.0% |
| 12 | `currency_cd` | varchar | 0.0% |
| 13 | `bank_name` | varchar | 0.0% |
| 14 | `sub_bank_name` | varchar | 91.36% |
| 15 | `bank_acct_name` | varchar | 0.0% |
| 16 | `bank_acct_no` | varchar | 0.0% |
| 17 | `bank_addr` | varchar | 5.04% |
| 18 | `swift_code` | varchar | 5.07% |
| 19 | `acctno_status` | varchar | 0.0% |
| 20 | `active_status` | varchar | 0.0% |
| 21 | `create_user` | varchar | 8.41% |
| 22 | `create_time` | timestamp | 0.0% |
| 23 | `lst_upd_user` | varchar | 94.51% |
| 24 | `lst_upd_time` | timestamp | 0.0% |
| 25 | `jpa_version` | integer | 0.0% |
| 26 | `delete_flag` | varchar | 0.0% |
| 27 | `bank_code` | varchar | 0.0% |
| 28 | `va_account_id` | bigint | 0.0% |
| 29 | `fee_rate` | varchar | 100.0% |
| 30 | `bank_acct_type` | varchar | 0.25% |
| 31 | `usages` | varchar | 100.0% |
| 32 | `holder_entity` | varchar | 0.25% |
| 33 | `first_arrival_time` | timestamp | 99.05% |
| 34 | `last_arrival_time` | timestamp | 99.05% |
| 35 | `is_used_ind` | varchar | 54.18% |
| 36 | `first_post_time` | timestamp | 68.84% |
| 37 | `last_post_time` | timestamp | 68.84% |
| 38 | `business_scale` | varchar | 100.0% |
| 39 | `bank_addr_detail` | varchar | 5.04% |
| 40 | `merchant_platform_type` | varchar | 0.0% |
| 41 | `platform_cus_no` | varchar | 100.0% |
| 42 | `realname_status` | varchar | 0.0% |
| 43 | `business_scene` | varchar | 0.0% |
| 44 | `active_time` | timestamp | 68.84% |
| 45 | `coll_bank_id` | bigint | 0.0% |
| 46 | `wire_routing_number` | varchar | 89.51% |
| 47 | `dk_acct_no` | varchar | 74.43% |
| 48 | `audit_status` | varchar | 0.0% |
| 49 | `audit_start_time` | timestamp | 40.77% |
| 50 | `audit_finish_time` | timestamp | 28.24% |
| 51 | `va_source` | varchar | 0.0% |
| 52 | `push_bank_time` | timestamp | 43.4% |
| 53 | `acs_quota_update_flag` | varchar | 100.0% |
| 54 | `chl_child_cust_id` | bigint | 100.0% |
| 55 | `sweep_indicator` | varchar | 97.6% |
| 56 | `sweep_type` | varchar | 97.6% |
| 57 | `acs_acct_status` | varchar | 0.0% |
| 58 | `peg_balance` | decimal(18,2) | 97.6% |
| 59 | `ach_transactions_allowed` | varchar | 97.6% |
| 60 | `coll_business_type` | varchar | 0.0% |
| 61 | `same_name_payer_id` | bigint | 97.2% |
| 62 | `default_pay_acct` | varchar | 97.2% |
| 63 | `api_seq` | varchar | 94.61% |
| 64 | `chl_resp_msg` | varchar | 0.0% |
| 65 | `note` | varchar | 99.9% |
| 66 | `chl_bank_acct_id` | varchar | 82.77% |
| 67 | `chl_bank_acct_name` | varchar | 98.45% |
| 68 | `enabled_time` | timestamp | 4.42% |
| 69 | `va_acct_type` | varchar | 0.0% |
| 70 | `report_status` | varchar | 0.0% |
| 71 | `merchants_ignore` | varchar | 0.0% |
| 72 | `migrate_from_independent_station` | varchar | 0.0% |
| 73 | `migrate_from_independent_station_time` | timestamp | 0.0% |
| 74 | `is_mast_acct` | varchar | 0.0% |
| 75 | `store_auth_files` | varchar | 95.71% |
| 76 | `chl_mast_acct_beneficiary_id` | varchar | 0.0% |
| 77 | `is_sleep` | varchar | 0.0% |
| 78 | `sort_num` | integer | 0.0% |
| 79 | `data_source` | varchar | 0.0% |
| 80 | `cancel_type` | varchar | 0.0% |
| 81 | `unique_key` | varchar | 3.05% |
| 82 | `is_subject_account_owner` | varchar | 97.03% |
| 83 | `dt` | date | 0.0% |

**Key Column Uniqueness:**

- `cust_id`: 2,522 unique values
  - Sample: `1017230910601108`, `1017803135041021`, `1017652745191108`, `1017809755861103`, `1017804628901112`
- `id`: 4,005 unique values
  - Sample: `2217809786583451101`, `2217808370456521109`, `2217803138710361103`, `2217809912346581107`, `2217809905435631009`
- `bank_acct_no`: 3,885 unique values
  - Sample: `7008028825`, `4568510988`, `DE57202208000044203111`, `30180048237-959803`, `28945287`

**Date Ranges:**

- `create_time` (timestamp): 2026-06-01 08:57:19.000 → 2026-06-11 23:20:24.000

**Duplicate Analysis:**

- Total rows: 4,005
- Extra duplicate rows: 0

**Referential Integrity (→ stg_cust_customer_info.CUST_ID):**

- FK column: `cust_id`
- Non-null FK values: 4,005
- Null FK values: 0
- Orphan records: 2,670 (66.67%)
- **WARNING: 2,670 orphan records found**

---

### 3.4 `stg_cust_enterprise_realname_info`

- **Row count:** 2,126
- **Column count:** 67

**Columns:**

| # | Column | Data Type | Null % |
|---|--------|-----------|--------|
| 1 | `_hoodie_commit_time` | varchar | 0.0% |
| 2 | `_hoodie_commit_seqno` | varchar | 0.0% |
| 3 | `_hoodie_record_key` | varchar | 0.0% |
| 4 | `_hoodie_partition_path` | varchar | 0.0% |
| 5 | `_hoodie_file_name` | varchar | 0.0% |
| 6 | `id` | bigint | 0.0% |
| 7 | `cust_id` | bigint | 0.0% |
| 8 | `realname_record_id` | bigint | 0.0% |
| 9 | `main_record` | varchar | 0.0% |
| 10 | `enterprise_name` | varchar | 0.0% |
| 11 | `en_name` | varchar | 0.0% |
| 12 | `regist_country` | varchar | 0.0% |
| 13 | `enterprise_type` | varchar | 0.0% |
| 14 | `legal_person_name` | varchar | 0.0% |
| 15 | `cert_type` | varchar | 0.0% |
| 16 | `cert_no` | varchar | 0.0% |
| 17 | `cert_province` | varchar | 0.0% |
| 18 | `cert_city` | varchar | 0.0% |
| 19 | `cert_area` | varchar | 0.0% |
| 20 | `cert_address` | varchar | 0.0% |
| 21 | `residence_province` | varchar | 0.0% |
| 22 | `residence_city` | varchar | 0.0% |
| 23 | `residence_area` | varchar | 0.0% |
| 24 | `residence_address` | varchar | 0.0% |
| 25 | `compare_with_reg_addr` | varchar | 19.8% |
| 26 | `post_code` | varchar | 0.0% |
| 27 | `issuing_agency` | varchar | 0.0% |
| 28 | `issuing_date` | timestamp | 26.95% |
| 29 | `business_valid_time_start` | timestamp | 4.05% |
| 30 | `business_valid_time_end` | timestamp | 8.04% |
| 31 | `company_reg_cert_file_id` | varchar | 0.66% |
| 32 | `company_busi_checkin_file_id` | varchar | 0.89% |
| 33 | `diff_with_main_record` | varchar | 47.74% |
| 34 | `create_user` | varchar | 100.0% |
| 35 | `create_time` | timestamp | 0.0% |
| 36 | `lst_upd_user` | varchar | 100.0% |
| 37 | `lst_upd_time` | timestamp | 0.0% |
| 38 | `jpa_version` | integer | 0.0% |
| 39 | `delete_flag` | varchar | 0.0% |
| 40 | `main_record_id` | bigint | 49.48% |
| 41 | `is_match` | varchar | 0.0% |
| 42 | `match_detail` | varchar | 43.51% |
| 43 | `risk_infos` | varchar | 44.07% |
| 44 | `lst_pass_copy_record_id` | bigint | 49.39% |
| 45 | `company_other_cert_file_ids` | varchar | 0.47% |
| 46 | `ocr_scan_info` | varchar | 42.94% |
| 47 | `business_status` | varchar | 0.0% |
| 48 | `company_equity_structure_chart_file_id` | varchar | 3.72% |
| 49 | `company_articles_of_association_file_id` | varchar | 3.34% |
| 50 | `residence_country` | varchar | 0.0% |
| 51 | `company_type` | varchar | 0.0% |
| 52 | `company_document_file_id` | varchar | 20.13% |
| 53 | `company_certificate_of_incorporation_file_id` | varchar | 20.13% |
| 54 | `company_partnership_deed_file_id` | varchar | 20.13% |
| 55 | `company_trust_deed_file_id` | varchar | 20.13% |
| 56 | `company_board_resolution_file_id` | varchar | 20.13% |
| 57 | `company_letter_of_authorisation_file_id` | varchar | 20.13% |
| 58 | `company_other_cert_file_type` | varchar | 20.13% |
| 59 | `ignore_check_box_info_enable` | varchar | 19.8% |
| 60 | `contact_person_infos` | varchar | 0.0% |
| 61 | `trading_name` | varchar | 0.0% |
| 62 | `three_tier_architecture` | varchar | 0.0% |
| 63 | `is_online_seller` | varchar | 0.0% |
| 64 | `company_website_url` | varchar | 0.0% |
| 65 | `company_storefront_file_id` | varchar | 0.0% |
| 66 | `address_number` | varchar | 21.45% |
| 67 | `dt` | date | 0.0% |

**Key Column Uniqueness:**

- `cust_id`: 1,052 unique values
  - Sample: `1017803829451127`, `1017810805031119`, `1017805756271005`, `1017807390181104`, `1017811722411007`
- `id`: 2,126 unique values
  - Sample: `1511759360072654851`, `1513929162199445509`, `1511773085550817286`, `1511850918792966152`, `1511801087366045705`

**Date Ranges:**

- `create_time` (timestamp): 2026-06-01 07:15:35.000 → 2026-06-11 21:46:25.000

**Duplicate Analysis:**

- Total rows: 2,126
- Extra duplicate rows: 0

**Referential Integrity (→ stg_cust_customer_info.CUST_ID):**

- FK column: `cust_id`
- Non-null FK values: 2,126
- Null FK values: 0
- Orphan records: 79 (3.72%)
- **WARNING: 79 orphan records found**

---

### 3.5 `stg_cust_foreign_trade_order`

- **Row count:** 14,270
- **Column count:** 49

**Columns:**

| # | Column | Data Type | Null % |
|---|--------|-----------|--------|
| 1 | `_hoodie_commit_time` | varchar | 0.0% |
| 2 | `_hoodie_commit_seqno` | varchar | 0.0% |
| 3 | `_hoodie_record_key` | varchar | 0.0% |
| 4 | `_hoodie_partition_path` | varchar | 0.0% |
| 5 | `_hoodie_file_name` | varchar | 0.0% |
| 6 | `id` | bigint | 0.0% |
| 7 | `cust_id` | bigint | 0.0% |
| 8 | `order_no` | varchar | 0.0% |
| 9 | `buyer_name` | varchar | 0.0% |
| 10 | `seller_name` | varchar | 0.0% |
| 11 | `order_create_date` | timestamp | 0.0% |
| 12 | `goods_export_country` | varchar | 0.0% |
| 13 | `goods_name` | varchar | 0.0% |
| 14 | `order_currency` | varchar | 0.0% |
| 15 | `order_amt` | decimal(18,2) | 0.0% |
| 16 | `remaining_relation_amt` | decimal(18,2) | 0.0% |
| 17 | `related_amt` | decimal(18,2) | 0.0% |
| 18 | `settlement_currency` | varchar | 100.0% |
| 19 | `remaining_relation_settlement_quota` | decimal(18,2) | 0.58% |
| 20 | `related_settlement_quota` | decimal(18,2) | 57.07% |
| 21 | `goods_count` | decimal(18,2) | 0.02% |
| 22 | `goods_unit` | varchar | 0.0% |
| 23 | `proof_file` | varchar | 0.0% |
| 24 | `order_status` | varchar | 0.0% |
| 25 | `need_settlement` | varchar | 0.0% |
| 26 | `audit_status` | varchar | 0.0% |
| 27 | `audit_start_time` | timestamp | 0.0% |
| 28 | `audit_finish_time` | timestamp | 0.17% |
| 29 | `audit_flow_instance_id` | varchar | 100.0% |
| 30 | `refused_reason` | varchar | 99.76% |
| 31 | `audit_complete_files` | varchar | 100.0% |
| 32 | `need_complete_files` | varchar | 100.0% |
| 33 | `audit_complete_note` | varchar | 100.0% |
| 34 | `is_resubmit` | varchar | 0.0% |
| 35 | `create_user` | varchar | 0.0% |
| 36 | `create_time` | timestamp | 0.0% |
| 37 | `lst_upd_user` | varchar | 0.35% |
| 38 | `lst_upd_time` | timestamp | 0.0% |
| 39 | `jpa_version` | integer | 0.0% |
| 40 | `delete_flag` | varchar | 0.0% |
| 41 | `other_attachments` | varchar | 0.0% |
| 42 | `occupy_num` | integer | 0.0% |
| 43 | `order_be_related_time` | timestamp | 0.55% |
| 44 | `audit_middle_variable` | varchar | 100.0% |
| 45 | `order_status_for_customer` | varchar | 0.0% |
| 46 | `order_cny_amt` | decimal(18,2) | 0.17% |
| 47 | `goods_unit_price_cny` | decimal(18,2) | 0.17% |
| 48 | `data_source` | varchar | 0.0% |
| 49 | `dt` | date | 0.0% |

**Key Column Uniqueness:**

- `cust_id`: 1,632 unique values
  - Sample: `1017562893861023`, `1017576701331001`, `1017502394471006`, `1017535070641013`, `1017646669331123`
- `id`: 14,270 unique values
  - Sample: `1511434045240684550`, `1511416101274169347`, `1511414256787038209`, `1511403629989371908`, `1511450615438417925`
- `order_no`: 14,266 unique values
  - Sample: `20260605GFSFQI`, `20260605POHXAF`, `20260605DKABVM`, `20260605IQJEBO`, `20260605KDXDKJ`

**Date Ranges:**

- `create_time` (timestamp): 2026-06-01 00:14:18.000 → 2026-06-11 23:52:10.000

**Duplicate Analysis:**

- Total rows: 14,270
- Extra duplicate rows: 0

**Referential Integrity (→ stg_cust_customer_info.CUST_ID):**

- FK column: `cust_id`
- Non-null FK values: 14,270
- Null FK values: 0
- Orphan records: 14,106 (98.85%)
- **WARNING: 14,106 orphan records found**

---

### 3.6 `stg_cust_foreign_trade_order_logistics`

- **Row count:** 14,270
- **Column count:** 25

**Columns:**

| # | Column | Data Type | Null % |
|---|--------|-----------|--------|
| 1 | `_hoodie_commit_time` | varchar | 0.0% |
| 2 | `_hoodie_commit_seqno` | varchar | 0.0% |
| 3 | `_hoodie_record_key` | varchar | 0.0% |
| 4 | `_hoodie_partition_path` | varchar | 0.0% |
| 5 | `_hoodie_file_name` | varchar | 0.0% |
| 6 | `id` | bigint | 0.0% |
| 7 | `foreign_trade_order_id` | bigint | 0.0% |
| 8 | `goods_store_url` | varchar | 0.09% |
| 9 | `estimated_shipping_time` | timestamp | 95.78% |
| 10 | `buyer_type` | varchar | 0.0% |
| 11 | `history_shipping_proof_file` | varchar | 0.0% |
| 12 | `inquiry_order_record_proof_file` | varchar | 0.0% |
| 13 | `logistics_status` | varchar | 0.0% |
| 14 | `logistics_time` | timestamp | 3.5% |
| 15 | `additional_params` | varchar | 0.0% |
| 16 | `logistics_audit_complete_files` | varchar | 100.0% |
| 17 | `create_user` | varchar | 0.0% |
| 18 | `create_time` | timestamp | 0.0% |
| 19 | `lst_upd_user` | varchar | 99.12% |
| 20 | `lst_upd_time` | timestamp | 0.0% |
| 21 | `jpa_version` | integer | 0.0% |
| 22 | `delete_flag` | varchar | 0.0% |
| 23 | `store_platform_name` | varchar | 0.07% |
| 24 | `store_platform_type` | varchar | 0.0% |
| 25 | `dt` | date | 0.0% |

**Key Column Uniqueness:**

- `id`: 14,270 unique values
  - Sample: `1513191085910827017`, `1514188637258948614`, `1512563078401662986`, `1512978553086451719`, `1513302192856018954`

**Date Ranges:**

- `create_time` (timestamp): 2026-06-01 00:14:18.000 → 2026-06-11 23:52:10.000

**Duplicate Analysis:**

- Total rows: 14,270
- Extra duplicate rows: 0

---

### 3.7 `stg_cust_person_realname_info`

- **Row count:** 5,145
- **Column count:** 76

**Columns:**

| # | Column | Data Type | Null % |
|---|--------|-----------|--------|
| 1 | `_hoodie_commit_time` | varchar | 0.0% |
| 2 | `_hoodie_commit_seqno` | varchar | 0.0% |
| 3 | `_hoodie_record_key` | varchar | 0.0% |
| 4 | `_hoodie_partition_path` | varchar | 0.0% |
| 5 | `_hoodie_file_name` | varchar | 0.0% |
| 6 | `id` | bigint | 0.0% |
| 7 | `cust_id` | bigint | 0.0% |
| 8 | `realname_record_id` | bigint | 0.0% |
| 9 | `main_record` | varchar | 0.0% |
| 10 | `name` | varchar | 0.0% |
| 11 | `en_name` | varchar | 0.0% |
| 12 | `first_name` | varchar | 72.83% |
| 13 | `middle_name` | varchar | 0.0% |
| 14 | `last_name` | varchar | 0.0% |
| 15 | `alias_name` | varchar | 0.0% |
| 16 | `country` | varchar | 0.0% |
| 17 | `cert_type` | varchar | 0.0% |
| 18 | `cert_no` | varchar | 0.0% |
| 19 | `gender` | varchar | 0.0% |
| 20 | `birthday` | date | 7.7% |
| 21 | `cert_province` | varchar | 0.0% |
| 22 | `cert_city` | varchar | 0.0% |
| 23 | `cert_area` | varchar | 0.0% |
| 24 | `cert_address` | varchar | 0.0% |
| 25 | `residence_province` | varchar | 0.0% |
| 26 | `residence_city` | varchar | 0.0% |
| 27 | `residence_area` | varchar | 0.0% |
| 28 | `residence_address` | varchar | 0.0% |
| 29 | `compare_with_reg_addr` | varchar | 41.94% |
| 30 | `post_code` | varchar | 0.0% |
| 31 | `cert_valid_time_start` | timestamp | 8.01% |
| 32 | `cert_valid_time_end` | timestamp | 8.2% |
| 33 | `idcard_front_file_id` | varchar | 1.01% |
| 34 | `idcard_back_file_id` | varchar | 1.01% |
| 35 | `hand_idcard_file_id` | varchar | 30.53% |
| 36 | `addr_prove_file_id` | varchar | 22.88% |
| 37 | `diff_with_main_record` | varchar | 52.69% |
| 38 | `create_user` | varchar | 100.0% |
| 39 | `create_time` | timestamp | 0.0% |
| 40 | `lst_upd_user` | varchar | 16.19% |
| 41 | `lst_upd_time` | timestamp | 0.0% |
| 42 | `jpa_version` | integer | 0.0% |
| 43 | `delete_flag` | varchar | 0.0% |
| 44 | `issuing_agency` | varchar | 24.96% |
| 45 | `issuing_date` | timestamp | 36.54% |
| 46 | `main_record_id` | bigint | 49.87% |
| 47 | `is_match` | varchar | 0.0% |
| 48 | `match_detail` | varchar | 18.72% |
| 49 | `lst_pass_copy_record_id` | bigint | 49.78% |
| 50 | `sky_remit_cert_front_file_id` | varchar | 100.0% |
| 51 | `sky_remit_cert_back_file_id` | varchar | 100.0% |
| 52 | `visa_type` | varchar | 99.96% |
| 53 | `stay_reason` | varchar | 100.0% |
| 54 | `stay_time_start` | timestamp | 94.73% |
| 55 | `stay_time` | timestamp | 94.73% |
| 56 | `pp_supt_type` | varchar | 88.79% |
| 57 | `work_permit_no` | varchar | 100.0% |
| 58 | `work_permit_type` | varchar | 99.96% |
| 59 | `person_other_cert_file_ids` | varchar | 5.54% |
| 60 | `ocr_scan_info` | varchar | 42.99% |
| 61 | `identity_document_type` | varchar | 0.0% |
| 62 | `identity_check_type` | varchar | 0.0% |
| 63 | `identity_check_result` | varchar | 0.0% |
| 64 | `detect_auth_id` | bigint | 84.61% |
| 65 | `identity_check_time` | timestamp | 83.81% |
| 66 | `identity_check_status` | varchar | 0.0% |
| 67 | `ignore_check_box_info_enable` | varchar | 96.27% |
| 68 | `is_singapore_resident` | varchar | 0.0% |
| 69 | `shufti_cert_req_no` | varchar | 81.52% |
| 70 | `shufti_cert_down_status` | varchar | 81.52% |
| 71 | `residence_address_en` | varchar | 0.0% |
| 72 | `shufti_cert_report_file_id` | varchar | 0.0% |
| 73 | `address_number` | varchar | 96.05% |
| 74 | `same_person_notary_file_id` | varchar | 0.0% |
| 75 | `hand_skyee_open_account_file_id` | varchar | 0.0% |
| 76 | `dt` | date | 0.0% |

**Key Column Uniqueness:**

- `cust_id`: 1,521 unique values
  - Sample: `1017806470291023`, `1017811506161007`, `1017803000981124`, `1017810816841028`, `1017803053361103`
- `id`: 5,145 unique values
  - Sample: `1511831091445538819`, `1511762821505921036`, `1511693130976501764`, `1511734491763224580`, `1511685459598684169`

**Date Ranges:**

- `create_time` (timestamp): 2026-06-01 07:15:35.000 → 2026-06-11 21:46:25.000

**Duplicate Analysis:**

- Total rows: 5,145
- Extra duplicate rows: 0

**Referential Integrity (→ stg_cust_customer_info.CUST_ID):**

- FK column: `cust_id`
- Non-null FK values: 5,145
- Null FK values: 0
- Orphan records: 410 (7.97%)
- **WARNING: 410 orphan records found**

---

### 3.8 `stg_cust_realname_enterprise_ref_person`

- **Row count:** 6,496
- **Column count:** 23

**Columns:**

| # | Column | Data Type | Null % |
|---|--------|-----------|--------|
| 1 | `_hoodie_commit_time` | varchar | 0.0% |
| 2 | `_hoodie_commit_seqno` | varchar | 0.0% |
| 3 | `_hoodie_record_key` | varchar | 0.0% |
| 4 | `_hoodie_partition_path` | varchar | 0.0% |
| 5 | `_hoodie_file_name` | varchar | 0.0% |
| 6 | `id` | bigint | 0.0% |
| 7 | `cust_id` | bigint | 0.0% |
| 8 | `realname_record_id` | bigint | 0.0% |
| 9 | `enterprise_id` | bigint | 0.0% |
| 10 | `person_id` | bigint | 0.0% |
| 11 | `main_record` | varchar | 0.0% |
| 12 | `relation_type` | varchar | 0.0% |
| 13 | `sharehold_ratio` | decimal(8,4) | 27.23% |
| 14 | `create_user` | varchar | 98.61% |
| 15 | `create_time` | timestamp | 0.0% |
| 16 | `lst_upd_user` | varchar | 0.0% |
| 17 | `lst_upd_time` | timestamp | 0.0% |
| 18 | `jpa_version` | integer | 0.0% |
| 19 | `delete_flag` | varchar | 0.0% |
| 20 | `director_type` | varchar | 5.46% |
| 21 | `main_record_id` | bigint | 34.87% |
| 22 | `lst_pass_copy_record_id` | bigint | 33.04% |
| 23 | `dt` | date | 0.0% |

**Key Column Uniqueness:**

- `cust_id`: 2,159 unique values
  - Sample: `1017811671441028`, `1017804488111010`, `1017758894521007`, `1017811604001123`, `1017811692801129`
- `id`: 6,496 unique values
  - Sample: `1511657604395347980`, `1514673834840600583`, `1512456831950168068`, `1511782821029519370`, `1511565165139632134`

**Date Ranges:**

- `create_time` (timestamp): 2026-06-01 02:00:01.000 → 2026-06-11 21:46:25.000

**Duplicate Analysis:**

- Total rows: 6,496
- Extra duplicate rows: 0

**Referential Integrity (→ stg_cust_customer_info.CUST_ID):**

- FK column: `cust_id`
- Non-null FK values: 6,496
- Null FK values: 0
- Orphan records: 2,482 (38.21%)
- **WARNING: 2,482 orphan records found**

---

### 3.9 `stg_cust_store_info`

- **Row count:** 1,210
- **Column count:** 55

**Columns:**

| # | Column | Data Type | Null % |
|---|--------|-----------|--------|
| 1 | `_hoodie_commit_time` | varchar | 0.0% |
| 2 | `_hoodie_commit_seqno` | varchar | 0.0% |
| 3 | `_hoodie_record_key` | varchar | 0.0% |
| 4 | `_hoodie_partition_path` | varchar | 0.0% |
| 5 | `_hoodie_file_name` | varchar | 0.0% |
| 6 | `id` | bigint | 0.0% |
| 7 | `cust_id` | bigint | 0.0% |
| 8 | `merchant_platform` | varchar | 0.0% |
| 9 | `ec_platform_id` | bigint | 0.0% |
| 10 | `ec_platform_name` | varchar | 0.0% |
| 11 | `store_support_currency` | varchar | 0.0% |
| 12 | `store_name` | varchar | 0.0% |
| 13 | `store_status` | varchar | 0.0% |
| 14 | `store_holder_name` | varchar | 0.0% |
| 15 | `store_url` | varchar | 53.39% |
| 16 | `check_store_url_time` | timestamp | 57.77% |
| 17 | `checked_store_url_flag` | varchar | 0.0% |
| 18 | `primary_prod` | varchar | 0.0% |
| 19 | `expect_annual_sales` | varchar | 0.0% |
| 20 | `auth_method_type` | varchar | 0.0% |
| 21 | `store_code` | varchar | 8.51% |
| 22 | `auth_status` | varchar | 0.0% |
| 23 | `auth_time` | timestamp | 80.74% |
| 24 | `auth_params` | varchar | 100.0% |
| 25 | `create_user` | varchar | 100.0% |
| 26 | `create_time` | timestamp | 0.0% |
| 27 | `lst_upd_user` | varchar | 100.0% |
| 28 | `lst_upd_time` | timestamp | 0.0% |
| 29 | `jpa_version` | integer | 0.0% |
| 30 | `delete_flag` | varchar | 0.0% |
| 31 | `belong_cust_id` | bigint | 0.0% |
| 32 | `belong_cust_name` | varchar | 3.64% |
| 33 | `ec_platform_code` | varchar | 0.0% |
| 34 | `auth_expire_time` | timestamp | 80.74% |
| 35 | `store_country` | varchar | 83.22% |
| 36 | `last_order_sync_time` | timestamp | 100.0% |
| 37 | `last_bill_sync_time` | timestamp | 100.0% |
| 38 | `support_pay_service` | varchar | 98.51% |
| 39 | `active_status` | varchar | 0.0% |
| 40 | `active_time` | timestamp | 90.91% |
| 41 | `first_bind_time` | timestamp | 80.74% |
| 42 | `old_store_sn` | varchar | 100.0% |
| 43 | `pspp_reported` | varchar | 0.0% |
| 44 | `store_belong_edit_open_deadline` | timestamp | 100.0% |
| 45 | `merchants_ignore` | varchar | 0.0% |
| 46 | `bind_belong_cust_time` | timestamp | 3.64% |
| 47 | `merchants_ignore_type` | varchar | 0.0% |
| 48 | `merchants_ignore_reason` | varchar | 0.0% |
| 49 | `merchants_ignore_time` | timestamp | 99.34% |
| 50 | `store_url_update_time` | timestamp | 71.4% |
| 51 | `store_mode` | varchar | 0.0% |
| 52 | `store_reg_email_file_id` | varchar | 0.0% |
| 53 | `store_email_backend_file_id` | varchar | 0.0% |
| 54 | `net_monthly_average_income` | varchar | 21.24% |
| 55 | `dt` | date | 0.0% |

**Key Column Uniqueness:**

- `cust_id`: 763 unique values
  - Sample: `1017810621671019`, `1017745801621109`, `1017605157231009`, `1017811078861111`, `1017407480421001`
- `id`: 1,210 unique values
  - Sample: `1514242631469670400`, `1512531539110436867`, `1511368860119375874`, `1514221336354926594`, `1514305348578615300`

**Date Ranges:**

- `create_time` (timestamp): 2026-06-01 09:05:07.000 → 2026-06-11 22:55:38.000

**Duplicate Analysis:**

- Total rows: 1,210
- Extra duplicate rows: 0

**Referential Integrity (→ stg_cust_customer_info.CUST_ID):**

- FK column: `cust_id`
- Non-null FK values: 1,210
- Null FK values: 0
- Orphan records: 744 (61.49%)
- **WARNING: 744 orphan records found**

---

### 3.10 `stg_cust_user_login_log`

- **Row count:** 118,659
- **Column count:** 25

**Columns:**

| # | Column | Data Type | Null % |
|---|--------|-----------|--------|
| 1 | `_hoodie_commit_time` | varchar | 0.0% |
| 2 | `_hoodie_commit_seqno` | varchar | 0.0% |
| 3 | `_hoodie_record_key` | varchar | 0.0% |
| 4 | `_hoodie_partition_path` | varchar | 0.0% |
| 5 | `_hoodie_file_name` | varchar | 0.0% |
| 6 | `id` | bigint | 0.0% |
| 7 | `cust_user_id` | bigint | 0.0% |
| 8 | `lst_login_time` | timestamp | 0.0% |
| 9 | `login_addr` | varchar | 0.0% |
| 10 | `login_ip` | varchar | 0.0% |
| 11 | `login_type` | varchar | 0.0% |
| 12 | `login_terminal` | varchar | 0.0% |
| 13 | `logout_time` | timestamp | 70.63% |
| 14 | `create_user` | varchar | 0.0% |
| 15 | `create_time` | timestamp | 0.0% |
| 16 | `lst_upd_user` | varchar | 100.0% |
| 17 | `lst_upd_time` | timestamp | 0.0% |
| 18 | `login_status` | varchar | 0.0% |
| 19 | `fail_reason` | varchar | 96.33% |
| 20 | `jpa_version` | integer | 0.0% |
| 21 | `delete_flag` | varchar | 0.0% |
| 22 | `cust_id` | bigint | 0.0% |
| 23 | `cust_login_acct` | varchar | 0.0% |
| 24 | `merchant_platform_sub_type` | varchar | 0.0% |
| 25 | `dt` | date | 0.0% |

**Key Column Uniqueness:**

- `cust_id`: 19,507 unique values
  - Sample: `766552`, `1017658665871013`, `1017522183991109`, `246788`, `1017060891281126`
- `id`: 118,659 unique values
  - Sample: `1512797613450108932`, `1513251645587234818`, `1512622966016356357`, `1512930459061891079`, `1512799008286875651`

**Date Ranges:**

- `create_time` (timestamp): 2026-06-01 00:00:41.000 → 2026-06-11 23:52:57.000

**Duplicate Analysis:**

- Total rows: 118,659
- Extra duplicate rows: 0

**Referential Integrity (→ stg_cust_customer_info.CUST_ID):**

- FK column: `cust_id`
- Non-null FK values: 118,659
- Null FK values: 0
- Orphan records: 114,712 (96.67%)
- **WARNING: 114,712 orphan records found**

---

### 3.11 `stg_pmp_coll_order`

- **Row count:** 114,734
- **Column count:** 111

**Columns:**

| # | Column | Data Type | Null % |
|---|--------|-----------|--------|
| 1 | `_hoodie_commit_time` | varchar | 0.0% |
| 2 | `_hoodie_commit_seqno` | varchar | 0.0% |
| 3 | `_hoodie_record_key` | varchar | 0.0% |
| 4 | `_hoodie_partition_path` | varchar | 0.0% |
| 5 | `_hoodie_file_name` | varchar | 0.0% |
| 6 | `coll_order_id` | bigint | 0.0% |
| 7 | `cust_id` | bigint | 0.0% |
| 8 | `name` | varchar | 0.0% |
| 9 | `collections_type` | varchar | 0.0% |
| 10 | `country_cd` | varchar | 0.0% |
| 11 | `coll_bank_name` | varchar | 0.0% |
| 12 | `acct_type` | varchar | 0.0% |
| 13 | `coll_currency_cd` | varchar | 0.0% |
| 14 | `coll_txn_amt` | decimal(15,2) | 0.0% |
| 15 | `coll_status` | varchar | 0.0% |
| 16 | `commission_amt` | decimal(15,2) | 0.38% |
| 17 | `pay_bank_name` | varchar | 0.0% |
| 18 | `pay_bank_acct_name` | varchar | 0.0% |
| 19 | `pay_bank_acct_no` | varchar | 1.81% |
| 20 | `fund_source` | varchar | 100.0% |
| 21 | `fund_purpose` | varchar | 100.0% |
| 22 | `coll_memo` | varchar | 0.0% |
| 23 | `qualified_status` | varchar | 0.0% |
| 24 | `qualified_time` | timestamp | 100.0% |
| 25 | `qualified_no` | varchar | 100.0% |
| 26 | `arrival_status` | varchar | 0.0% |
| 27 | `arrival_time` | timestamp | 0.0% |
| 28 | `arrival_txn_no` | bigint | 0.0% |
| 29 | `post_status` | varchar | 0.0% |
| 30 | `post_time` | timestamp | 0.38% |
| 31 | `is_exchange` | varchar | 0.0% |
| 32 | `exchange_status` | varchar | 0.0% |
| 33 | `exchange_no` | bigint | 100.0% |
| 34 | `exchange_curr_cd` | varchar | 100.0% |
| 35 | `exchange_amt` | decimal(15,2) | 100.0% |
| 36 | `exchange_rate` | decimal(12,8) | 100.0% |
| 37 | `exchange_time` | timestamp | 100.0% |
| 38 | `refund_status` | varchar | 0.0% |
| 39 | `refund_no` | bigint | 100.0% |
| 40 | `refund_time` | timestamp | 100.0% |
| 41 | `platform_own` | varchar | 0.0% |
| 42 | `proxy_user` | varchar | 0.07% |
| 43 | `create_user` | varchar | 0.0% |
| 44 | `create_time` | timestamp | 0.0% |
| 45 | `lst_upd_user` | varchar | 100.0% |
| 46 | `lst_upd_time` | timestamp | 0.0% |
| 47 | `jpa_version` | integer | 0.0% |
| 48 | `delete_flag` | varchar | 0.0% |
| 49 | `bill_no` | varchar | 48.03% |
| 50 | `sub_biz_type` | varchar | 0.0% |
| 51 | `acctno_alias` | varchar | 60.9% |
| 52 | `holder_entity` | varchar | 100.0% |
| 53 | `refund_amt` | decimal(20,6) | 100.0% |
| 54 | `refund_currency_cd` | varchar | 100.0% |
| 55 | `refund_comm_amt` | decimal(20,6) | 100.0% |
| 56 | `refund_comm_currency_cd` | varchar | 100.0% |
| 57 | `coll_bank_acct_no` | varchar | 0.0% |
| 58 | `commision_rate` | varchar | 0.38% |
| 59 | `pay_bank_code` | varchar | 0.0% |
| 60 | `pay_bank_country` | varchar | 0.0% |
| 61 | `audit_status` | varchar | 0.0% |
| 62 | `audit_start_time` | timestamp | 0.24% |
| 63 | `audit_finish_time` | timestamp | 20.04% |
| 64 | `audit_flow_instance_id` | varchar | 0.0% |
| 65 | `ec_platform_code` | varchar | 0.0% |
| 66 | `cust_store_id` | bigint | 22.87% |
| 67 | `coll_acct_id` | bigint | 0.0% |
| 68 | `cust_store_name` | varchar | 0.0% |
| 69 | `ec_platform_name` | varchar | 0.0% |
| 70 | `refused_reason` | varchar | 0.0% |
| 71 | `need_complete_files` | varchar | 0.0% |
| 72 | `audit_complete_files` | varchar | 0.0% |
| 73 | `ref_store_bill_id` | bigint | 100.0% |
| 74 | `audit_complete_note` | varchar | 0.0% |
| 75 | `auto_audit_pass` | varchar | 0.0% |
| 76 | `has_matched_store_bill` | varchar | 0.0% |
| 77 | `matched_store_bill_id` | bigint | 48.03% |
| 78 | `payment_platform_code` | varchar | 0.0% |
| 79 | `payment_platform_name` | varchar | 26.08% |
| 80 | `trade_postscript` | varchar | 7.95% |
| 81 | `store_belong_cust_id` | bigint | 22.87% |
| 82 | `turn_to_manual_reason` | varchar | 0.25% |
| 83 | `bank_txn_seq` | varchar | 0.0% |
| 84 | `swift_code` | varchar | 0.0% |
| 85 | `coll_txn_cny_amt` | decimal(18,2) | 0.0% |
| 86 | `store_code` | varchar | 25.38% |
| 87 | `refund_code` | varchar | 0.26% |
| 88 | `coll_order_type` | varchar | 0.0% |
| 89 | `refused_coll_type` | varchar | 0.0% |
| 90 | `cust_label` | varchar | 0.0% |
| 91 | `order_relation_status` | varchar | 0.0% |
| 92 | `order_relation_first_time` | timestamp | 99.99% |
| 93 | `order_relation_update_time` | timestamp | 100.0% |
| 94 | `biz_note` | varchar | 0.24% |
| 95 | `match_result` | varchar | 99.97% |
| 96 | `reality_decide_result` | varchar | 99.97% |
| 97 | `audit_supply_file` | varchar | 99.99% |
| 98 | `audit_middle_variable` | varchar | 0.24% |
| 99 | `va_acct_name` | varchar | 0.0% |
| 100 | `payee_address` | varchar | 0.0% |
| 101 | `coll_bank_acct_name` | varchar | 0.0% |
| 102 | `payment_platform_type` | varchar | 0.0% |
| 103 | `merchants_ignore` | varchar | 0.0% |
| 104 | `dubious_personal_coll_flag` | varchar | 0.0% |
| 105 | `show_coll_bank_acct_no` | varchar | 0.0% |
| 106 | `coll_method_source` | varchar | 0.0% |
| 107 | `va_deposit_en_name` | varchar | 0.0% |
| 108 | `statistics_commision_rate` | varchar | 0.0% |
| 109 | `commission_currency_cd` | varchar | 0.0% |
| 110 | `commission_status` | varchar | 0.0% |
| 111 | `dt` | date | 0.0% |

**Key Column Uniqueness:**

- `cust_id`: 16,151 unique values
  - Sample: `1017726817061024`, `708881`, `1017732946751119`, `1017466076661015`, `1017585307101106`

**Date Ranges:**

- `create_time` (timestamp): 2026-06-01 00:03:27.000 → 2026-06-11 23:52:44.000

**Duplicate Analysis:**

- Total rows: 114,734
- Extra duplicate rows: 0

**Referential Integrity (→ stg_cust_customer_info.CUST_ID):**

- FK column: `cust_id`
- Non-null FK values: 114,734
- Null FK values: 0
- Orphan records: 114,204 (99.54%)
- **WARNING: 114,204 orphan records found**

---

### 3.12 `stg_pmp_pay_details`

- **Row count:** 36,194
- **Column count:** 108

**Columns:**

| # | Column | Data Type | Null % |
|---|--------|-----------|--------|
| 1 | `_hoodie_commit_time` | varchar | 0.0% |
| 2 | `_hoodie_commit_seqno` | varchar | 0.0% |
| 3 | `_hoodie_record_key` | varchar | 0.0% |
| 4 | `_hoodie_partition_path` | varchar | 0.0% |
| 5 | `_hoodie_file_name` | varchar | 0.0% |
| 6 | `id` | bigint | 0.0% |
| 7 | `subject_name` | varchar | 0.0% |
| 8 | `bank_name` | varchar | 0.0% |
| 9 | `pay_method` | varchar | 0.0% |
| 10 | `bank_identify_no` | varchar | 0.29% |
| 11 | `bank_acct_name` | varchar | 0.0% |
| 12 | `bank_acct_no` | varchar | 0.0% |
| 13 | `pay_tot_amt` | decimal(15,2) | 0.06% |
| 14 | `pay_txn_amt` | decimal(15,2) | 0.15% |
| 15 | `commission_amt` | decimal(15,2) | 6.32% |
| 16 | `pay_memo` | varchar | 0.0% |
| 17 | `clear_status` | varchar | 0.0% |
| 18 | `clear_time` | timestamp | 7.49% |
| 19 | `clear_memo` | varchar | 7.49% |
| 20 | `create_user` | varchar | 100.0% |
| 21 | `create_time` | timestamp | 0.0% |
| 22 | `lst_upd_user` | varchar | 100.0% |
| 23 | `lst_upd_time` | timestamp | 0.0% |
| 24 | `jpa_version` | integer | 0.0% |
| 25 | `delete_flag` | varchar | 0.0% |
| 26 | `pay_order_id` | bigint | 0.0% |
| 27 | `declared_amt` | decimal(15,2) | 100.0% |
| 28 | `undeclear_amt` | decimal(15,2) | 100.0% |
| 29 | `account_prop` | varchar | 0.0% |
| 30 | `province` | varchar | 100.0% |
| 31 | `city` | varchar | 100.0% |
| 32 | `bank_branch_no` | varchar | 0.56% |
| 33 | `bank_branch_name` | varchar | 0.56% |
| 34 | `country_cd` | varchar | 0.0% |
| 35 | `nickname` | varchar | 21.23% |
| 36 | `mobile_no` | varchar | 0.56% |
| 37 | `email` | varchar | 100.0% |
| 38 | `identity_no` | varchar | 0.56% |
| 39 | `proxy_id` | varchar | 100.0% |
| 40 | `address1` | varchar | 0.56% |
| 41 | `address2` | varchar | 100.0% |
| 42 | `bank_ind_type` | varchar | 100.0% |
| 43 | `inter_swift_bic` | varchar | 100.0% |
| 44 | `swift_code` | varchar | 0.0% |
| 45 | `coll_country_cd` | varchar | 0.29% |
| 46 | `coller_type` | varchar | 98.47% |
| 47 | `pay_attach_name` | varchar | 100.0% |
| 48 | `currency_cd` | varchar | 0.0% |
| 49 | `oss_id` | varchar | 9.29% |
| 50 | `fee_bear_method` | varchar | 0.0% |
| 51 | `fund_purpose` | varchar | 0.0% |
| 52 | `real_commission_amt` | decimal(15,2) | 6.55% |
| 53 | `selected_pay_fee_config` | varchar | 0.0% |
| 54 | `receiver_relation_type` | varchar | 0.0% |
| 55 | `remark` | varchar | 100.0% |
| 56 | `platform_receive_acct_id` | varchar | 0.0% |
| 57 | `pay_target_country` | varchar | 98.47% |
| 58 | `bank_acct_entity_type` | varchar | 0.0% |
| 59 | `bank_country` | varchar | 99.99% |
| 60 | `branch_province` | varchar | 53.69% |
| 61 | `branch_city` | varchar | 53.73% |
| 62 | `branch_area` | varchar | 68.31% |
| 63 | `coll_address` | varchar | 0.0% |
| 64 | `bank_acct_alias_name` | varchar | 9.86% |
| 65 | `pay_ref_file_ids` | varchar | 0.0% |
| 66 | `has_refund` | varchar | 0.0% |
| 67 | `has_refund_commission` | varchar | 0.0% |
| 68 | `refund_currency` | varchar | 100.0% |
| 69 | `refund_amt` | decimal(15,2) | 100.0% |
| 70 | `refund_note` | varchar | 99.33% |
| 71 | `counter_party_id` | bigint | 37.58% |
| 72 | `coll_en_address` | varchar | 66.44% |
| 73 | `inter_bank_no` | varchar | 0.0% |
| 74 | `beneficiary_province` | varchar | 72.98% |
| 75 | `beneficiary_province_code` | varchar | 85.98% |
| 76 | `beneficiary_city` | varchar | 71.42% |
| 77 | `beneficiary_post_code` | varchar | 77.05% |
| 78 | `bank_code` | varchar | 0.09% |
| 79 | `beneficiary_identification_type` | varchar | 0.0% |
| 80 | `beneficiary_identification_no` | varchar | 0.0% |
| 81 | `beneficiary_acct_card_type` | varchar | 0.0% |
| 82 | `beneficiary_email` | varchar | 0.0% |
| 83 | `beneficiary_birthday` | timestamp | 92.51% |
| 84 | `pay_txn_amt_cny` | decimal(15,2) | 6.55% |
| 85 | `cust_id` | bigint | 0.0% |
| 86 | `mobile_code` | varchar | 98.31% |
| 87 | `real_non_fixed_commission_currency` | varchar | 0.0% |
| 88 | `real_non_fixed_commission_amt` | decimal(15,2) | 0.0% |
| 89 | `real_refund_non_fixed_commission_currency` | varchar | 0.0% |
| 90 | `real_refund_non_fixed_commission_amt` | decimal(15,2) | 0.0% |
| 91 | `sub_biz_type` | varchar | 0.0% |
| 92 | `pay_type` | varchar | 0.0% |
| 93 | `use_same_name_pay` | varchar | 0.0% |
| 94 | `cover_bank_acct_flag` | varchar | 9.86% |
| 95 | `receive_bank_acct_type` | varchar | 0.0% |
| 96 | `bank_identify_no_from_chl` | varchar | 0.0% |
| 97 | `bank_acct_category` | varchar | 0.0% |
| 98 | `pay_post_status` | varchar | 0.0% |
| 99 | `pay_post_time` | timestamp | 6.91% |
| 100 | `clear_chl_code` | varchar | 6.92% |
| 101 | `clear_chl_name` | varchar | 6.92% |
| 102 | `clear_chl_seq` | varchar | 8.06% |
| 103 | `clear_req_chl_seq` | varchar | 99.34% |
| 104 | `payment_time` | timestamp | 6.55% |
| 105 | `bank_acct_usage` | varchar | 0.0% |
| 106 | `pay_fee_rate` | varchar | 0.0% |
| 107 | `pay_fee_rate_formatted` | varchar | 0.0% |
| 108 | `dt` | date | 0.0% |

**Key Column Uniqueness:**

- `cust_id`: 8,973 unique values
  - Sample: `1017806339371001`, `1017688214201129`, `1017418457881014`, `1017683730741105`, `70299`
- `id`: 36,194 unique values
  - Sample: `4217808029173101108`, `4217810804275021106`, `4217808395603851106`, `4217808038699481001`, `4217808436845411106`
- `bank_acct_no`: 18,109 unique values
  - Sample: `770578665849`, `6217223602000916302`, `6230582000053619360`, `6222620710036222618`, `697556986`

**Date Ranges:**

- `create_time` (timestamp): 2026-06-01 00:10:51.000 → 2026-06-11 23:58:29.000

**Duplicate Analysis:**

- Total rows: 36,194
- Extra duplicate rows: 0

**Referential Integrity (→ stg_cust_customer_info.CUST_ID):**

- FK column: `cust_id`
- Non-null FK values: 36,194
- Null FK values: 0
- Orphan records: 35,865 (99.09%)
- **WARNING: 35,865 orphan records found**

---

### 3.13 `stg_pmp_pay_order`

- **Row count:** 33,835
- **Column count:** 138

**Columns:**

| # | Column | Data Type | Null % |
|---|--------|-----------|--------|
| 1 | `_hoodie_commit_time` | varchar | 0.0% |
| 2 | `_hoodie_commit_seqno` | varchar | 0.0% |
| 3 | `_hoodie_record_key` | varchar | 0.0% |
| 4 | `_hoodie_partition_path` | varchar | 0.0% |
| 5 | `_hoodie_file_name` | varchar | 0.0% |
| 6 | `pay_order_id` | bigint | 0.0% |
| 7 | `cust_id` | bigint | 0.0% |
| 8 | `name` | varchar | 0.0% |
| 9 | `acct_type` | varchar | 0.0% |
| 10 | `country_cd` | varchar | 0.0% |
| 11 | `pay_type` | varchar | 0.0% |
| 12 | `pay_currency_cd` | varchar | 0.0% |
| 13 | `pay_txn_nums` | integer | 0.0% |
| 14 | `pay_tot_amt` | decimal(15,2) | 0.07% |
| 15 | `pay_txn_amt` | decimal(15,2) | 0.17% |
| 16 | `pay_real_amt` | decimal(15,2) | 7.15% |
| 17 | `commission_amt` | decimal(15,2) | 4.71% |
| 18 | `real_commission_amt` | decimal(15,2) | 6.2% |
| 19 | `payment_currency_cd` | varchar | 0.0% |
| 20 | `payment_status` | varchar | 0.0% |
| 21 | `payment_time` | timestamp | 6.2% |
| 22 | `pay_status` | varchar | 0.0% |
| 23 | `qualified_status` | varchar | 100.0% |
| 24 | `qualified_time` | timestamp | 100.0% |
| 25 | `qualified_no` | varchar | 100.0% |
| 26 | `is_exchange` | varchar | 6.2% |
| 27 | `exchange_status` | varchar | 6.2% |
| 28 | `exchange_no` | bigint | 61.44% |
| 29 | `exchange_curr_cd` | varchar | 61.44% |
| 30 | `exchange_amt` | decimal(15,2) | 100.0% |
| 31 | `exchange_rate` | decimal(20,8) | 61.44% |
| 32 | `exchange_time` | timestamp | 61.44% |
| 33 | `clear_status` | varchar | 0.0% |
| 34 | `clear_time` | timestamp | 7.15% |
| 35 | `pay_post_status` | varchar | 0.0% |
| 36 | `pay_post_time` | timestamp | 7.15% |
| 37 | `platform_own` | varchar | 0.0% |
| 38 | `proxy_user` | varchar | 0.02% |
| 39 | `pay_details` | varchar | 100.0% |
| 40 | `create_user` | varchar | 8.01% |
| 41 | `create_time` | timestamp | 0.0% |
| 42 | `lst_upd_user` | varchar | 10.06% |
| 43 | `lst_upd_time` | timestamp | 0.0% |
| 44 | `jpa_version` | integer | 0.0% |
| 45 | `delete_flag` | varchar | 0.0% |
| 46 | `need_declear` | varchar | 100.0% |
| 47 | `settle_curr_cd` | varchar | 100.0% |
| 48 | `settle_amt` | decimal(15,2) | 7.15% |
| 49 | `declared_amt` | decimal(15,2) | 0.0% |
| 50 | `undeclear_amt` | decimal(15,2) | 100.0% |
| 51 | `sub_biz_type` | varchar | 0.0% |
| 52 | `holder_entity` | varchar | 100.0% |
| 53 | `refund_amt` | decimal(20,6) | 100.0% |
| 54 | `refund_currency_cd` | varchar | 100.0% |
| 55 | `refund_extra_deduct_amt` | decimal(15,2) | 100.0% |
| 56 | `real_refund_amt` | decimal(15,2) | 100.0% |
| 57 | `refund_commission_currency` | varchar | 100.0% |
| 58 | `refund_commission_amt` | decimal(15,2) | 100.0% |
| 59 | `real_refund_commission_amt` | decimal(15,2) | 100.0% |
| 60 | `refund_note` | varchar | 99.31% |
| 61 | `refund_status` | varchar | 0.0% |
| 62 | `commision_rate` | varchar | 100.0% |
| 63 | `rate_lost_type` | varchar | 100.0% |
| 64 | `fund_source` | varchar | 100.0% |
| 65 | `use_lock_exchange` | varchar | 0.0% |
| 66 | `fx_exchange_no` | varchar | 0.0% |
| 67 | `fx_biz_order_no` | varchar | 0.0% |
| 68 | `auto_trade_with_bal` | varchar | 0.0% |
| 69 | `real_commission_currency` | varchar | 0.0% |
| 70 | `commission_currency` | varchar | 0.0% |
| 71 | `fund_purpose` | varchar | 0.0% |
| 72 | `transfer_to_self` | varchar | 100.0% |
| 73 | `payment_method` | varchar | 0.0% |
| 74 | `qualified_note` | varchar | 0.0% |
| 75 | `va_account_id` | bigint | 0.0% |
| 76 | `use_same_name_pay` | varchar | 0.0% |
| 77 | `rate_spread_type` | varchar | 0.0% |
| 78 | `audit_status` | varchar | 0.0% |
| 79 | `audit_start_time` | timestamp | 6.47% |
| 80 | `audit_finish_time` | timestamp | 6.2% |
| 81 | `audit_flow_instance_id` | varchar | 0.0% |
| 82 | `refused_reason` | varchar | 0.0% |
| 83 | `need_complete_files` | varchar | 0.0% |
| 84 | `audit_complete_files` | varchar | 0.0% |
| 85 | `extends_params` | varchar | 99.7% |
| 86 | `audit_complete_note` | varchar | 0.0% |
| 87 | `auto_audit_pass` | varchar | 0.0% |
| 88 | `trade_type` | varchar | 0.0% |
| 89 | `business_type` | varchar | 100.0% |
| 90 | `trade_order_batch_no` | varchar | 99.68% |
| 91 | `rate_spread_value` | decimal(18,6) | 0.0% |
| 92 | `orig_exchange_rate` | decimal(18,6) | 0.0% |
| 93 | `refund_apply_user` | varchar | 100.0% |
| 94 | `refund_apply_time` | timestamp | 100.0% |
| 95 | `refund_audit_user` | varchar | 100.0% |
| 96 | `refund_audit_time` | timestamp | 100.0% |
| 97 | `refund_method` | varchar | 100.0% |
| 98 | `refund_time` | timestamp | 100.0% |
| 99 | `store_order_type` | varchar | 0.0% |
| 100 | `pay_count_type` | varchar | 0.0% |
| 101 | `trade_type_other_desc` | varchar | 0.0% |
| 102 | `same_name_payer_name` | varchar | 0.0% |
| 103 | `same_name_payer_en_name` | varchar | 0.0% |
| 104 | `same_name_payer_address` | varchar | 88.59% |
| 105 | `same_name_id` | bigint | 88.68% |
| 106 | `third_party_seq_no` | varchar | 0.0% |
| 107 | `settlement_quota_type` | varchar | 0.0% |
| 108 | `same_name_payer_country_code` | varchar | 0.0% |
| 109 | `same_name_payer_country_name` | varchar | 0.0% |
| 110 | `same_name_payer_cert_type` | varchar | 0.0% |
| 111 | `same_name_payer_cert_no` | varchar | 0.0% |
| 112 | `same_name_payer_mobile` | varchar | 0.0% |
| 113 | `same_name_payer_birthday` | timestamp | 91.99% |
| 114 | `same_name_payer_bank_acct_no` | varchar | 0.0% |
| 115 | `same_name_payer_province` | varchar | 0.0% |
| 116 | `same_name_payer_city` | varchar | 0.0% |
| 117 | `same_name_payer_postcode` | varchar | 0.0% |
| 118 | `turn_to_manual_reason` | varchar | 100.0% |
| 119 | `audit_middle_variable` | varchar | 6.47% |
| 120 | `coll_order_ids` | varchar | 91.99% |
| 121 | `pay_tot_amt_cny` | decimal(15,2) | 0.07% |
| 122 | `pay_method` | varchar | 0.0% |
| 123 | `hidden_for_cust` | varchar | 0.0% |
| 124 | `pay_purpose` | varchar | 0.0% |
| 125 | `fixed_amt_type` | varchar | 0.0% |
| 126 | `biz_version` | varchar | 8.01% |
| 127 | `my_bank_quick_pay` | varchar | 8.01% |
| 128 | `real_non_fixed_commission_currency` | varchar | 0.0% |
| 129 | `real_non_fixed_commission_amt` | decimal(15,2) | 0.0% |
| 130 | `real_refund_non_fixed_commission_currency` | varchar | 0.0% |
| 131 | `real_refund_non_fixed_commission_amt` | decimal(15,2) | 0.0% |
| 132 | `batch_describe` | varchar | 8.01% |
| 133 | `data_source` | varchar | 0.0% |
| 134 | `confirm_pay_user_id` | bigint | 14.21% |
| 135 | `is_cross_border_purchase` | varchar | 0.0% |
| 136 | `bank_acct_category` | varchar | 0.0% |
| 137 | `bank_acct_usage` | varchar | 0.0% |
| 138 | `dt` | date | 0.0% |

**Key Column Uniqueness:**

- `cust_id`: 8,973 unique values
  - Sample: `1017788427041103`, `1017725178821009`, `1017573080941110`, `1017568844401005`, `1017412428341113`

**Date Ranges:**

- `create_time` (timestamp): 2026-06-01 00:10:51.000 → 2026-06-12 00:00:18.000

**Duplicate Analysis:**

- Total rows: 33,835
- Extra duplicate rows: 0

**Referential Integrity (→ stg_cust_customer_info.CUST_ID):**

- FK column: `cust_id`
- Non-null FK values: 33,835
- Null FK values: 0
- Orphan records: 33,506 (99.03%)
- **WARNING: 33,506 orphan records found**

---

## 4. Null Analysis Summary

Columns with >30% null values across all tables:

| Table | Column | Data Type | Null % | Null Count | Total |
|-------|--------|-----------|--------|------------|-------|
| `stg_cust_customer_info` | `realname_finish_time` | timestamp | 34.01% | 588 | 1,729 |
| `stg_cust_customer_info` | `primary_prod` | varchar | 100.0% | 1,729 | 1,729 |
| `stg_cust_customer_info` | `business_model` | varchar | 100.0% | 1,729 | 1,729 |
| `stg_cust_customer_info` | `industry` | varchar | 99.94% | 1,728 | 1,729 |
| `stg_cust_customer_info` | `founded_time` | timestamp | 100.0% | 1,729 | 1,729 |
| `stg_cust_customer_info` | `staff_count_desc` | varchar | 100.0% | 1,729 | 1,729 |
| `stg_cust_customer_info` | `bussiness_scale` | varchar | 100.0% | 1,729 | 1,729 |
| `stg_cust_customer_info` | `expected_annual_turnover` | integer | 100.0% | 1,729 | 1,729 |
| `stg_cust_customer_info` | `risk_level` | varchar | 34.01% | 588 | 1,729 |
| `stg_cust_customer_info` | `risk_score` | decimal(4,2) | 34.01% | 588 | 1,729 |
| `stg_cust_customer_info` | `last_risk_scan_id` | bigint | 34.01% | 588 | 1,729 |
| `stg_cust_customer_info` | `last_risk_scan_time` | timestamp | 34.01% | 588 | 1,729 |
| `stg_cust_customer_info` | `last_risk_scan_desc` | varchar | 100.0% | 1,729 | 1,729 |
| `stg_cust_customer_info` | `if_famous_company` | varchar | 100.0% | 1,729 | 1,729 |
| `stg_cust_customer_info` | `if_pay_org` | varchar | 100.0% | 1,729 | 1,729 |
| `stg_cust_customer_info` | `remark` | varchar | 100.0% | 1,729 | 1,729 |
| `stg_cust_customer_info` | `lst_upd_user` | varchar | 75.65% | 1,308 | 1,729 |
| `stg_cust_customer_info` | `invitor` | varchar | 100.0% | 1,729 | 1,729 |
| `stg_cust_customer_info` | `active_time` | timestamp | 90.69% | 1,568 | 1,729 |
| `stg_cust_customer_info` | `manage_user` | varchar | 59.92% | 1,036 | 1,729 |
| `stg_cust_customer_info` | `stopped_time` | timestamp | 100.0% | 1,729 | 1,729 |
| `stg_cust_customer_info` | `frozen_time` | timestamp | 99.77% | 1,725 | 1,729 |
| `stg_cust_customer_info` | `migrate_time` | timestamp | 100.0% | 1,729 | 1,729 |
| `stg_cust_customer_info` | `frozen_reason` | varchar | 99.77% | 1,725 | 1,729 |
| `stg_cust_customer_info` | `secd_cust_no` | varchar | 93.35% | 1,614 | 1,729 |
| `stg_cust_customer_info` | `secd_cust_association_type` | varchar | 93.35% | 1,614 | 1,729 |
| `stg_cust_customer_info` | `first_realname_success_time` | timestamp | 34.01% | 588 | 1,729 |
| `stg_cust_customer_info` | `channel_partner` | varchar | 100.0% | 1,729 | 1,729 |
| `stg_cust_customer_info` | `label_update_time` | timestamp | 54.42% | 941 | 1,729 |
| `stg_cust_customer_info` | `contact_mobile_save_time` | timestamp | 83.11% | 1,437 | 1,729 |
| `stg_cust_bank_acct_info` | `branch_province` | varchar | 66.57% | 3,559 | 5,346 |
| `stg_cust_bank_acct_info` | `branch_city` | varchar | 66.63% | 3,562 | 5,346 |
| `stg_cust_bank_acct_info` | `branch_area` | varchar | 86.51% | 4,625 | 5,346 |
| `stg_cust_bank_acct_info` | `audit_start_time` | timestamp | 72.91% | 3,898 | 5,346 |
| `stg_cust_bank_acct_info` | `lst_upd_user` | varchar | 99.7% | 5,330 | 5,346 |
| `stg_cust_bank_acct_info` | `prove_file` | varchar | 99.72% | 5,331 | 5,346 |
| `stg_cust_bank_acct_info` | `entity_person_id` | bigint | 98.24% | 5,252 | 5,346 |
| `stg_cust_bank_acct_info` | `bank_code` | varchar | 83.26% | 4,451 | 5,346 |
| `stg_cust_bank_acct_info` | `entity_en_address` | varchar | 70.41% | 3,764 | 5,346 |
| `stg_cust_bank_acct_info` | `entity_province` | varchar | 89.97% | 4,810 | 5,346 |
| `stg_cust_bank_acct_info` | `entity_province_code` | varchar | 94.87% | 5,072 | 5,346 |
| `stg_cust_bank_acct_info` | `entity_city` | varchar | 86.42% | 4,620 | 5,346 |
| `stg_cust_bank_acct_info` | `entity_post_code` | varchar | 92.63% | 4,952 | 5,346 |
| `stg_cust_bank_acct_info` | `audit_middle_variable` | varchar | 79.59% | 4,255 | 5,346 |
| `stg_cust_bank_acct_info` | `entity_birthday` | timestamp | 99.96% | 5,344 | 5,346 |
| `stg_cust_bank_acct_info` | `pay_target_country` | varchar | 99.05% | 5,295 | 5,346 |
| `stg_cust_bank_acct_info` | `bank_acct_fill_in_type` | varchar | 97.33% | 5,203 | 5,346 |
| `stg_cust_bank_acct_info` | `payee_additional_info` | varchar | 100.0% | 5,346 | 5,346 |
| `stg_cust_bank_acct_info` | `ref_company_counterparty_id` | bigint | 100.0% | 5,346 | 5,346 |
| `stg_cust_collections_acct` | `acctno_alias` | varchar | 42.6% | 1,706 | 4,005 |
| `stg_cust_collections_acct` | `sub_bank_name` | varchar | 91.36% | 3,659 | 4,005 |
| `stg_cust_collections_acct` | `lst_upd_user` | varchar | 94.51% | 3,785 | 4,005 |
| `stg_cust_collections_acct` | `fee_rate` | varchar | 100.0% | 4,005 | 4,005 |
| `stg_cust_collections_acct` | `usages` | varchar | 100.0% | 4,005 | 4,005 |
| `stg_cust_collections_acct` | `first_arrival_time` | timestamp | 99.05% | 3,967 | 4,005 |
| `stg_cust_collections_acct` | `last_arrival_time` | timestamp | 99.05% | 3,967 | 4,005 |
| `stg_cust_collections_acct` | `is_used_ind` | varchar | 54.18% | 2,170 | 4,005 |
| `stg_cust_collections_acct` | `first_post_time` | timestamp | 68.84% | 2,757 | 4,005 |
| `stg_cust_collections_acct` | `last_post_time` | timestamp | 68.84% | 2,757 | 4,005 |
| `stg_cust_collections_acct` | `business_scale` | varchar | 100.0% | 4,005 | 4,005 |
| `stg_cust_collections_acct` | `platform_cus_no` | varchar | 100.0% | 4,005 | 4,005 |
| `stg_cust_collections_acct` | `active_time` | timestamp | 68.84% | 2,757 | 4,005 |
| `stg_cust_collections_acct` | `wire_routing_number` | varchar | 89.51% | 3,585 | 4,005 |
| `stg_cust_collections_acct` | `dk_acct_no` | varchar | 74.43% | 2,981 | 4,005 |
| `stg_cust_collections_acct` | `audit_start_time` | timestamp | 40.77% | 1,633 | 4,005 |
| `stg_cust_collections_acct` | `push_bank_time` | timestamp | 43.4% | 1,738 | 4,005 |
| `stg_cust_collections_acct` | `acs_quota_update_flag` | varchar | 100.0% | 4,005 | 4,005 |
| `stg_cust_collections_acct` | `chl_child_cust_id` | bigint | 100.0% | 4,005 | 4,005 |
| `stg_cust_collections_acct` | `sweep_indicator` | varchar | 97.6% | 3,909 | 4,005 |
| `stg_cust_collections_acct` | `sweep_type` | varchar | 97.6% | 3,909 | 4,005 |
| `stg_cust_collections_acct` | `peg_balance` | decimal(18,2) | 97.6% | 3,909 | 4,005 |
| `stg_cust_collections_acct` | `ach_transactions_allowed` | varchar | 97.6% | 3,909 | 4,005 |
| `stg_cust_collections_acct` | `same_name_payer_id` | bigint | 97.2% | 3,893 | 4,005 |
| `stg_cust_collections_acct` | `default_pay_acct` | varchar | 97.2% | 3,893 | 4,005 |
| `stg_cust_collections_acct` | `api_seq` | varchar | 94.61% | 3,789 | 4,005 |
| `stg_cust_collections_acct` | `note` | varchar | 99.9% | 4,001 | 4,005 |
| `stg_cust_collections_acct` | `chl_bank_acct_id` | varchar | 82.77% | 3,315 | 4,005 |
| `stg_cust_collections_acct` | `chl_bank_acct_name` | varchar | 98.45% | 3,943 | 4,005 |
| `stg_cust_collections_acct` | `store_auth_files` | varchar | 95.71% | 3,833 | 4,005 |
| `stg_cust_collections_acct` | `is_subject_account_owner` | varchar | 97.03% | 3,886 | 4,005 |
| `stg_cust_enterprise_realname_info` | `diff_with_main_record` | varchar | 47.74% | 1,015 | 2,126 |
| `stg_cust_enterprise_realname_info` | `create_user` | varchar | 100.0% | 2,126 | 2,126 |
| `stg_cust_enterprise_realname_info` | `lst_upd_user` | varchar | 100.0% | 2,126 | 2,126 |
| `stg_cust_enterprise_realname_info` | `main_record_id` | bigint | 49.48% | 1,052 | 2,126 |
| `stg_cust_enterprise_realname_info` | `match_detail` | varchar | 43.51% | 925 | 2,126 |
| `stg_cust_enterprise_realname_info` | `risk_infos` | varchar | 44.07% | 937 | 2,126 |
| `stg_cust_enterprise_realname_info` | `lst_pass_copy_record_id` | bigint | 49.39% | 1,050 | 2,126 |
| `stg_cust_enterprise_realname_info` | `ocr_scan_info` | varchar | 42.94% | 913 | 2,126 |
| `stg_cust_foreign_trade_order` | `settlement_currency` | varchar | 100.0% | 14,270 | 14,270 |
| `stg_cust_foreign_trade_order` | `related_settlement_quota` | decimal(18,2) | 57.07% | 8,144 | 14,270 |
| `stg_cust_foreign_trade_order` | `audit_flow_instance_id` | varchar | 100.0% | 14,270 | 14,270 |
| `stg_cust_foreign_trade_order` | `refused_reason` | varchar | 99.76% | 14,236 | 14,270 |
| `stg_cust_foreign_trade_order` | `audit_complete_files` | varchar | 100.0% | 14,270 | 14,270 |
| `stg_cust_foreign_trade_order` | `need_complete_files` | varchar | 100.0% | 14,270 | 14,270 |
| `stg_cust_foreign_trade_order` | `audit_complete_note` | varchar | 100.0% | 14,270 | 14,270 |
| `stg_cust_foreign_trade_order` | `audit_middle_variable` | varchar | 100.0% | 14,270 | 14,270 |
| `stg_cust_foreign_trade_order_logistics` | `estimated_shipping_time` | timestamp | 95.78% | 13,668 | 14,270 |
| `stg_cust_foreign_trade_order_logistics` | `logistics_audit_complete_files` | varchar | 100.0% | 14,270 | 14,270 |
| `stg_cust_foreign_trade_order_logistics` | `lst_upd_user` | varchar | 99.12% | 14,145 | 14,270 |
| `stg_cust_person_realname_info` | `first_name` | varchar | 72.83% | 3,747 | 5,145 |
| `stg_cust_person_realname_info` | `compare_with_reg_addr` | varchar | 41.94% | 2,158 | 5,145 |
| `stg_cust_person_realname_info` | `hand_idcard_file_id` | varchar | 30.53% | 1,571 | 5,145 |
| `stg_cust_person_realname_info` | `diff_with_main_record` | varchar | 52.69% | 2,711 | 5,145 |
| `stg_cust_person_realname_info` | `create_user` | varchar | 100.0% | 5,145 | 5,145 |
| `stg_cust_person_realname_info` | `issuing_date` | timestamp | 36.54% | 1,880 | 5,145 |
| `stg_cust_person_realname_info` | `main_record_id` | bigint | 49.87% | 2,566 | 5,145 |
| `stg_cust_person_realname_info` | `lst_pass_copy_record_id` | bigint | 49.78% | 2,561 | 5,145 |
| `stg_cust_person_realname_info` | `sky_remit_cert_front_file_id` | varchar | 100.0% | 5,145 | 5,145 |
| `stg_cust_person_realname_info` | `sky_remit_cert_back_file_id` | varchar | 100.0% | 5,145 | 5,145 |
| `stg_cust_person_realname_info` | `visa_type` | varchar | 99.96% | 5,143 | 5,145 |
| `stg_cust_person_realname_info` | `stay_reason` | varchar | 100.0% | 5,145 | 5,145 |
| `stg_cust_person_realname_info` | `stay_time_start` | timestamp | 94.73% | 4,874 | 5,145 |
| `stg_cust_person_realname_info` | `stay_time` | timestamp | 94.73% | 4,874 | 5,145 |
| `stg_cust_person_realname_info` | `pp_supt_type` | varchar | 88.79% | 4,568 | 5,145 |
| `stg_cust_person_realname_info` | `work_permit_no` | varchar | 100.0% | 5,145 | 5,145 |
| `stg_cust_person_realname_info` | `work_permit_type` | varchar | 99.96% | 5,143 | 5,145 |
| `stg_cust_person_realname_info` | `ocr_scan_info` | varchar | 42.99% | 2,212 | 5,145 |
| `stg_cust_person_realname_info` | `detect_auth_id` | bigint | 84.61% | 4,353 | 5,145 |
| `stg_cust_person_realname_info` | `identity_check_time` | timestamp | 83.81% | 4,312 | 5,145 |
| `stg_cust_person_realname_info` | `ignore_check_box_info_enable` | varchar | 96.27% | 4,953 | 5,145 |
| `stg_cust_person_realname_info` | `shufti_cert_req_no` | varchar | 81.52% | 4,194 | 5,145 |
| `stg_cust_person_realname_info` | `shufti_cert_down_status` | varchar | 81.52% | 4,194 | 5,145 |
| `stg_cust_person_realname_info` | `address_number` | varchar | 96.05% | 4,942 | 5,145 |
| `stg_cust_realname_enterprise_ref_person` | `create_user` | varchar | 98.61% | 6,406 | 6,496 |
| `stg_cust_realname_enterprise_ref_person` | `main_record_id` | bigint | 34.87% | 2,265 | 6,496 |
| `stg_cust_realname_enterprise_ref_person` | `lst_pass_copy_record_id` | bigint | 33.04% | 2,146 | 6,496 |
| `stg_cust_store_info` | `store_url` | varchar | 53.39% | 646 | 1,210 |
| `stg_cust_store_info` | `check_store_url_time` | timestamp | 57.77% | 699 | 1,210 |
| `stg_cust_store_info` | `auth_time` | timestamp | 80.74% | 977 | 1,210 |
| `stg_cust_store_info` | `auth_params` | varchar | 100.0% | 1,210 | 1,210 |
| `stg_cust_store_info` | `create_user` | varchar | 100.0% | 1,210 | 1,210 |
| `stg_cust_store_info` | `lst_upd_user` | varchar | 100.0% | 1,210 | 1,210 |
| `stg_cust_store_info` | `auth_expire_time` | timestamp | 80.74% | 977 | 1,210 |
| `stg_cust_store_info` | `store_country` | varchar | 83.22% | 1,007 | 1,210 |
| `stg_cust_store_info` | `last_order_sync_time` | timestamp | 100.0% | 1,210 | 1,210 |
| `stg_cust_store_info` | `last_bill_sync_time` | timestamp | 100.0% | 1,210 | 1,210 |
| `stg_cust_store_info` | `support_pay_service` | varchar | 98.51% | 1,192 | 1,210 |
| `stg_cust_store_info` | `active_time` | timestamp | 90.91% | 1,100 | 1,210 |
| `stg_cust_store_info` | `first_bind_time` | timestamp | 80.74% | 977 | 1,210 |
| `stg_cust_store_info` | `old_store_sn` | varchar | 100.0% | 1,210 | 1,210 |
| `stg_cust_store_info` | `store_belong_edit_open_deadline` | timestamp | 100.0% | 1,210 | 1,210 |
| `stg_cust_store_info` | `merchants_ignore_time` | timestamp | 99.34% | 1,202 | 1,210 |
| `stg_cust_store_info` | `store_url_update_time` | timestamp | 71.4% | 864 | 1,210 |
| `stg_cust_user_login_log` | `logout_time` | timestamp | 70.63% | 83,806 | 118,659 |
| `stg_cust_user_login_log` | `lst_upd_user` | varchar | 100.0% | 118,659 | 118,659 |
| `stg_cust_user_login_log` | `fail_reason` | varchar | 96.33% | 114,300 | 118,659 |
| `stg_pmp_coll_order` | `fund_source` | varchar | 100.0% | 114,734 | 114,734 |
| `stg_pmp_coll_order` | `fund_purpose` | varchar | 100.0% | 114,734 | 114,734 |
| `stg_pmp_coll_order` | `qualified_time` | timestamp | 100.0% | 114,734 | 114,734 |
| `stg_pmp_coll_order` | `qualified_no` | varchar | 100.0% | 114,734 | 114,734 |
| `stg_pmp_coll_order` | `exchange_no` | bigint | 100.0% | 114,734 | 114,734 |
| `stg_pmp_coll_order` | `exchange_curr_cd` | varchar | 100.0% | 114,734 | 114,734 |
| `stg_pmp_coll_order` | `exchange_amt` | decimal(15,2) | 100.0% | 114,734 | 114,734 |
| `stg_pmp_coll_order` | `exchange_rate` | decimal(12,8) | 100.0% | 114,734 | 114,734 |
| `stg_pmp_coll_order` | `exchange_time` | timestamp | 100.0% | 114,734 | 114,734 |
| `stg_pmp_coll_order` | `refund_no` | bigint | 100.0% | 114,729 | 114,734 |
| `stg_pmp_coll_order` | `refund_time` | timestamp | 100.0% | 114,732 | 114,734 |
| `stg_pmp_coll_order` | `lst_upd_user` | varchar | 100.0% | 114,734 | 114,734 |
| `stg_pmp_coll_order` | `bill_no` | varchar | 48.03% | 55,111 | 114,734 |
| `stg_pmp_coll_order` | `acctno_alias` | varchar | 60.9% | 69,877 | 114,734 |
| `stg_pmp_coll_order` | `holder_entity` | varchar | 100.0% | 114,734 | 114,734 |
| `stg_pmp_coll_order` | `refund_amt` | decimal(20,6) | 100.0% | 114,734 | 114,734 |
| `stg_pmp_coll_order` | `refund_currency_cd` | varchar | 100.0% | 114,734 | 114,734 |
| `stg_pmp_coll_order` | `refund_comm_amt` | decimal(20,6) | 100.0% | 114,734 | 114,734 |
| `stg_pmp_coll_order` | `refund_comm_currency_cd` | varchar | 100.0% | 114,734 | 114,734 |
| `stg_pmp_coll_order` | `ref_store_bill_id` | bigint | 100.0% | 114,734 | 114,734 |
| `stg_pmp_coll_order` | `matched_store_bill_id` | bigint | 48.03% | 55,111 | 114,734 |
| `stg_pmp_coll_order` | `order_relation_first_time` | timestamp | 99.99% | 114,724 | 114,734 |
| `stg_pmp_coll_order` | `order_relation_update_time` | timestamp | 100.0% | 114,731 | 114,734 |
| `stg_pmp_coll_order` | `match_result` | varchar | 99.97% | 114,705 | 114,734 |
| `stg_pmp_coll_order` | `reality_decide_result` | varchar | 99.97% | 114,705 | 114,734 |
| `stg_pmp_coll_order` | `audit_supply_file` | varchar | 99.99% | 114,727 | 114,734 |
| `stg_pmp_pay_details` | `create_user` | varchar | 100.0% | 36,194 | 36,194 |
| `stg_pmp_pay_details` | `lst_upd_user` | varchar | 100.0% | 36,194 | 36,194 |
| `stg_pmp_pay_details` | `declared_amt` | decimal(15,2) | 100.0% | 36,194 | 36,194 |
| `stg_pmp_pay_details` | `undeclear_amt` | decimal(15,2) | 100.0% | 36,194 | 36,194 |
| `stg_pmp_pay_details` | `province` | varchar | 100.0% | 36,194 | 36,194 |
| `stg_pmp_pay_details` | `city` | varchar | 100.0% | 36,194 | 36,194 |
| `stg_pmp_pay_details` | `email` | varchar | 100.0% | 36,194 | 36,194 |
| `stg_pmp_pay_details` | `proxy_id` | varchar | 100.0% | 36,194 | 36,194 |
| `stg_pmp_pay_details` | `address2` | varchar | 100.0% | 36,194 | 36,194 |
| `stg_pmp_pay_details` | `bank_ind_type` | varchar | 100.0% | 36,194 | 36,194 |
| `stg_pmp_pay_details` | `inter_swift_bic` | varchar | 100.0% | 36,194 | 36,194 |
| `stg_pmp_pay_details` | `coller_type` | varchar | 98.47% | 35,639 | 36,194 |
| `stg_pmp_pay_details` | `pay_attach_name` | varchar | 100.0% | 36,194 | 36,194 |
| `stg_pmp_pay_details` | `remark` | varchar | 100.0% | 36,194 | 36,194 |
| `stg_pmp_pay_details` | `pay_target_country` | varchar | 98.47% | 35,639 | 36,194 |
| `stg_pmp_pay_details` | `bank_country` | varchar | 99.99% | 36,190 | 36,194 |
| `stg_pmp_pay_details` | `branch_province` | varchar | 53.69% | 19,432 | 36,194 |
| `stg_pmp_pay_details` | `branch_city` | varchar | 53.73% | 19,448 | 36,194 |
| `stg_pmp_pay_details` | `branch_area` | varchar | 68.31% | 24,724 | 36,194 |
| `stg_pmp_pay_details` | `refund_currency` | varchar | 100.0% | 36,194 | 36,194 |
| `stg_pmp_pay_details` | `refund_amt` | decimal(15,2) | 100.0% | 36,194 | 36,194 |
| `stg_pmp_pay_details` | `refund_note` | varchar | 99.33% | 35,950 | 36,194 |
| `stg_pmp_pay_details` | `counter_party_id` | bigint | 37.58% | 13,603 | 36,194 |
| `stg_pmp_pay_details` | `coll_en_address` | varchar | 66.44% | 24,047 | 36,194 |
| `stg_pmp_pay_details` | `beneficiary_province` | varchar | 72.98% | 26,414 | 36,194 |
| `stg_pmp_pay_details` | `beneficiary_province_code` | varchar | 85.98% | 31,119 | 36,194 |
| `stg_pmp_pay_details` | `beneficiary_city` | varchar | 71.42% | 25,848 | 36,194 |
| `stg_pmp_pay_details` | `beneficiary_post_code` | varchar | 77.05% | 27,889 | 36,194 |
| `stg_pmp_pay_details` | `beneficiary_birthday` | timestamp | 92.51% | 33,483 | 36,194 |
| `stg_pmp_pay_details` | `mobile_code` | varchar | 98.31% | 35,581 | 36,194 |
| `stg_pmp_pay_details` | `clear_req_chl_seq` | varchar | 99.34% | 35,954 | 36,194 |
| `stg_pmp_pay_order` | `qualified_status` | varchar | 100.0% | 33,835 | 33,835 |
| `stg_pmp_pay_order` | `qualified_time` | timestamp | 100.0% | 33,835 | 33,835 |
| `stg_pmp_pay_order` | `qualified_no` | varchar | 100.0% | 33,835 | 33,835 |
| `stg_pmp_pay_order` | `exchange_no` | bigint | 61.44% | 20,787 | 33,835 |
| `stg_pmp_pay_order` | `exchange_curr_cd` | varchar | 61.44% | 20,787 | 33,835 |
| `stg_pmp_pay_order` | `exchange_amt` | decimal(15,2) | 100.0% | 33,835 | 33,835 |
| `stg_pmp_pay_order` | `exchange_rate` | decimal(20,8) | 61.44% | 20,787 | 33,835 |
| `stg_pmp_pay_order` | `exchange_time` | timestamp | 61.44% | 20,787 | 33,835 |
| `stg_pmp_pay_order` | `pay_details` | varchar | 100.0% | 33,835 | 33,835 |
| `stg_pmp_pay_order` | `need_declear` | varchar | 100.0% | 33,835 | 33,835 |
| `stg_pmp_pay_order` | `settle_curr_cd` | varchar | 100.0% | 33,835 | 33,835 |
| `stg_pmp_pay_order` | `undeclear_amt` | decimal(15,2) | 100.0% | 33,835 | 33,835 |
| `stg_pmp_pay_order` | `holder_entity` | varchar | 100.0% | 33,835 | 33,835 |
| `stg_pmp_pay_order` | `refund_amt` | decimal(20,6) | 100.0% | 33,835 | 33,835 |
| `stg_pmp_pay_order` | `refund_currency_cd` | varchar | 100.0% | 33,835 | 33,835 |
| `stg_pmp_pay_order` | `refund_extra_deduct_amt` | decimal(15,2) | 100.0% | 33,835 | 33,835 |
| `stg_pmp_pay_order` | `real_refund_amt` | decimal(15,2) | 100.0% | 33,835 | 33,835 |
| `stg_pmp_pay_order` | `refund_commission_currency` | varchar | 100.0% | 33,835 | 33,835 |
| `stg_pmp_pay_order` | `refund_commission_amt` | decimal(15,2) | 100.0% | 33,835 | 33,835 |
| `stg_pmp_pay_order` | `real_refund_commission_amt` | decimal(15,2) | 100.0% | 33,835 | 33,835 |
| `stg_pmp_pay_order` | `refund_note` | varchar | 99.31% | 33,602 | 33,835 |
| `stg_pmp_pay_order` | `commision_rate` | varchar | 100.0% | 33,835 | 33,835 |
| `stg_pmp_pay_order` | `rate_lost_type` | varchar | 100.0% | 33,835 | 33,835 |
| `stg_pmp_pay_order` | `fund_source` | varchar | 100.0% | 33,835 | 33,835 |
| `stg_pmp_pay_order` | `transfer_to_self` | varchar | 100.0% | 33,835 | 33,835 |
| `stg_pmp_pay_order` | `extends_params` | varchar | 99.7% | 33,735 | 33,835 |
| `stg_pmp_pay_order` | `business_type` | varchar | 100.0% | 33,835 | 33,835 |
| `stg_pmp_pay_order` | `trade_order_batch_no` | varchar | 99.68% | 33,728 | 33,835 |
| `stg_pmp_pay_order` | `refund_apply_user` | varchar | 100.0% | 33,835 | 33,835 |
| `stg_pmp_pay_order` | `refund_apply_time` | timestamp | 100.0% | 33,835 | 33,835 |
| `stg_pmp_pay_order` | `refund_audit_user` | varchar | 100.0% | 33,835 | 33,835 |
| `stg_pmp_pay_order` | `refund_audit_time` | timestamp | 100.0% | 33,835 | 33,835 |
| `stg_pmp_pay_order` | `refund_method` | varchar | 100.0% | 33,835 | 33,835 |
| `stg_pmp_pay_order` | `refund_time` | timestamp | 100.0% | 33,835 | 33,835 |
| `stg_pmp_pay_order` | `same_name_payer_address` | varchar | 88.59% | 29,976 | 33,835 |
| `stg_pmp_pay_order` | `same_name_id` | bigint | 88.68% | 30,005 | 33,835 |
| `stg_pmp_pay_order` | `same_name_payer_birthday` | timestamp | 91.99% | 31,124 | 33,835 |
| `stg_pmp_pay_order` | `turn_to_manual_reason` | varchar | 100.0% | 33,835 | 33,835 |
| `stg_pmp_pay_order` | `coll_order_ids` | varchar | 91.99% | 31,124 | 33,835 |

## 5. Duplicate Analysis

| Table | Total Rows | Duplicate Extra Rows | Status |
|-------|------------|---------------------|--------|
| `stg_cust_customer_info` | 1,729 | 0 | ✅ CLEAN |
| `stg_cust_bank_acct_info` | 5,346 | 0 | ✅ CLEAN |
| `stg_cust_collections_acct` | 4,005 | 0 | ✅ CLEAN |
| `stg_cust_enterprise_realname_info` | 2,126 | 0 | ✅ CLEAN |
| `stg_cust_foreign_trade_order` | 14,270 | 0 | ✅ CLEAN |
| `stg_cust_foreign_trade_order_logistics` | 14,270 | 0 | ✅ CLEAN |
| `stg_cust_person_realname_info` | 5,145 | 0 | ✅ CLEAN |
| `stg_cust_realname_enterprise_ref_person` | 6,496 | 0 | ✅ CLEAN |
| `stg_cust_store_info` | 1,210 | 0 | ✅ CLEAN |
| `stg_cust_user_login_log` | 118,659 | 0 | ✅ CLEAN |
| `stg_pmp_coll_order` | 114,734 | 0 | ✅ CLEAN |
| `stg_pmp_pay_details` | 36,194 | 0 | ✅ CLEAN |
| `stg_pmp_pay_order` | 33,835 | 0 | ✅ CLEAN |

## 6. Referential Integrity

All tables linking to `stg_cust_customer_info.CUST_ID`:

| Table | FK Column | Non-Null FK | Null FK | Orphans | Orphan % | Status |
|-------|-----------|------------|---------|---------|----------|--------|
| `stg_cust_customer_info` | `cust_id` | 1,729 | 0 | 0 | 0.0% | ✅ CLEAN |
| `stg_cust_bank_acct_info` | `cust_id` | 5,346 | 0 | 4,542 | 84.96% | ❌ ORPHANS FOUND |
| `stg_cust_collections_acct` | `cust_id` | 4,005 | 0 | 2,670 | 66.67% | ❌ ORPHANS FOUND |
| `stg_cust_enterprise_realname_info` | `cust_id` | 2,126 | 0 | 79 | 3.72% | ❌ ORPHANS FOUND |
| `stg_cust_foreign_trade_order` | `cust_id` | 14,270 | 0 | 14,106 | 98.85% | ❌ ORPHANS FOUND |
| `stg_cust_person_realname_info` | `cust_id` | 5,145 | 0 | 410 | 7.97% | ❌ ORPHANS FOUND |
| `stg_cust_realname_enterprise_ref_person` | `cust_id` | 6,496 | 0 | 2,482 | 38.21% | ❌ ORPHANS FOUND |
| `stg_cust_store_info` | `cust_id` | 1,210 | 0 | 744 | 61.49% | ❌ ORPHANS FOUND |
| `stg_cust_user_login_log` | `cust_id` | 118,659 | 0 | 114,712 | 96.67% | ❌ ORPHANS FOUND |
| `stg_pmp_coll_order` | `cust_id` | 114,734 | 0 | 114,204 | 99.54% | ❌ ORPHANS FOUND |
| `stg_pmp_pay_details` | `cust_id` | 36,194 | 0 | 35,865 | 99.09% | ❌ ORPHANS FOUND |
| `stg_pmp_pay_order` | `cust_id` | 33,835 | 0 | 33,506 | 99.03% | ❌ ORPHANS FOUND |

Tables without CUST_ID (standalone or different FK):

- `stg_cust_foreign_trade_order_logistics`

## 7. Date Range Coverage

| Table | Date Column | Min | Max | Data Type |
|-------|------------|-----|-----|-----------|
| `stg_cust_customer_info` | `create_time` | 2026-06-01 00:06:02.000 | 2026-06-11 23:20:15.000 | timestamp |
| `stg_cust_bank_acct_info` | `create_time` | 2026-06-01 00:24:30.000 | 2026-06-11 23:50:50.000 | timestamp |
| `stg_cust_collections_acct` | `create_time` | 2026-06-01 08:57:19.000 | 2026-06-11 23:20:24.000 | timestamp |
| `stg_cust_enterprise_realname_info` | `create_time` | 2026-06-01 07:15:35.000 | 2026-06-11 21:46:25.000 | timestamp |
| `stg_cust_foreign_trade_order` | `create_time` | 2026-06-01 00:14:18.000 | 2026-06-11 23:52:10.000 | timestamp |
| `stg_cust_foreign_trade_order_logistics` | `create_time` | 2026-06-01 00:14:18.000 | 2026-06-11 23:52:10.000 | timestamp |
| `stg_cust_person_realname_info` | `create_time` | 2026-06-01 07:15:35.000 | 2026-06-11 21:46:25.000 | timestamp |
| `stg_cust_realname_enterprise_ref_person` | `create_time` | 2026-06-01 02:00:01.000 | 2026-06-11 21:46:25.000 | timestamp |
| `stg_cust_store_info` | `create_time` | 2026-06-01 09:05:07.000 | 2026-06-11 22:55:38.000 | timestamp |
| `stg_cust_user_login_log` | `create_time` | 2026-06-01 00:00:41.000 | 2026-06-11 23:52:57.000 | timestamp |
| `stg_pmp_coll_order` | `create_time` | 2026-06-01 00:03:27.000 | 2026-06-11 23:52:44.000 | timestamp |
| `stg_pmp_pay_details` | `create_time` | 2026-06-01 00:10:51.000 | 2026-06-11 23:58:29.000 | timestamp |
| `stg_pmp_pay_order` | `create_time` | 2026-06-01 00:10:51.000 | 2026-06-12 00:00:18.000 | timestamp |

## 8. Cross-Table Relationships

### Entity-Relationship Diagram (Text)

```
stg_cust_customer_info (CUST_ID) [BASE TABLE]
    │
    ├── stg_cust_bank_acct_info (CUST_ID)
    ├── stg_cust_collections_acct (CUST_ID)
    ├── stg_cust_enterprise_realname_info (CUST_ID)
    ├── stg_cust_foreign_trade_order (CUST_ID)
    ├── stg_cust_person_realname_info (CUST_ID)
    ├── stg_cust_store_info (CUST_ID)
    ├── stg_cust_user_login_log (CUST_ID)
    ├── stg_pmp_coll_order (CUST_ID)
    ├── stg_pmp_pay_details (CUST_ID)
    ├── stg_pmp_pay_order (CUST_ID)
    │
    ├── stg_cust_foreign_trade_order_logistics (ORDER_NO → stg_cust_foreign_trade_order)
    └── stg_cust_realname_enterprise_ref_person (REALNAME_ID → stg_cust_enterprise_realname_info)
```

### CUST_ID Coverage Detail

How well does each table's CUST_ID population cover the base table?

- **Base table rows:** 1,729

- `stg_cust_bank_acct_info`: 5,346 CUST_ID refs (309.2% of base), 4,542 orphans
- `stg_cust_collections_acct`: 4,005 CUST_ID refs (231.64% of base), 2,670 orphans
- `stg_cust_enterprise_realname_info`: 2,126 CUST_ID refs (122.96% of base), 79 orphans
- `stg_cust_foreign_trade_order`: 14,270 CUST_ID refs (825.33% of base), 14,106 orphans
- `stg_cust_person_realname_info`: 5,145 CUST_ID refs (297.57% of base), 410 orphans
- `stg_cust_realname_enterprise_ref_person`: 6,496 CUST_ID refs (375.71% of base), 2,482 orphans
- `stg_cust_store_info`: 1,210 CUST_ID refs (69.98% of base), 744 orphans
- `stg_cust_user_login_log`: 118,659 CUST_ID refs (6862.87% of base), 114,712 orphans
- `stg_pmp_coll_order`: 114,734 CUST_ID refs (6635.86% of base), 114,204 orphans
- `stg_pmp_pay_details`: 36,194 CUST_ID refs (2093.35% of base), 35,865 orphans
- `stg_pmp_pay_order`: 33,835 CUST_ID refs (1956.91% of base), 33,506 orphans

## 9. Data Lineage: MySQL → Hudi

### Source System Assumption

The `stg_*` prefix indicates these are **staging tables** ingested from an upstream MySQL OLTP database into Hudi (Hive-backed) via a CDC or batch ETL pipeline.

### Inferred Lineage

```
┌─────────────────────────────────────────────────────────────────┐
│                    SOURCE: MySQL OLTP                           │
│                                                                 │
│  database: skyee_cust (or similar)                              │
│  tables: customer_info, bank_acct_info, collections_acct, ...   │
│                                                                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                     ETL / CDC Pipeline
                     (Spark / Flink / Airflow)
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAGING: Hudi on Hive                        │
│                                                                 │
│  catalog: hive                                                  │
│  schema:  usr_skyee_mw                                          │
│  tables:  stg_cust_* (customer domain)                         │
│           stg_pmp_* (payment domain)                           │
│                                                                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                     Downstream Consumers
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
        Risk Models     Reporting/BI     Analytics
```

### Table Naming Convention

| Prefix | Domain | Source DB (inferred) | Description |
|--------|--------|---------------------|-------------|
| `stg_cust_` | Customer | skyee_cust | Customer master, KYC, stores, logins |
| `stg_pmp_` | Payment | skyee_pmp (or pmp) | Payment orders, collections, pay details |

### Table-by-Table Lineage

#### `stg_cust_customer_info`
- **Domain:** Customer
- **Rows:** 1,729
- **Columns:** 72
- **FK:** `cust_id` → `stg_cust_customer_info.CUST_ID`
- **Source:** MySQL `cust_customer_info` table (inferred)

#### `stg_cust_bank_acct_info`
- **Domain:** Customer
- **Rows:** 5,346
- **Columns:** 96
- **FK:** `cust_id` → `stg_cust_customer_info.CUST_ID`
- **Source:** MySQL `cust_bank_acct_info` table (inferred)

#### `stg_cust_collections_acct`
- **Domain:** Customer
- **Rows:** 4,005
- **Columns:** 83
- **FK:** `cust_id` → `stg_cust_customer_info.CUST_ID`
- **Source:** MySQL `cust_collections_acct` table (inferred)

#### `stg_cust_enterprise_realname_info`
- **Domain:** Customer
- **Rows:** 2,126
- **Columns:** 67
- **FK:** `cust_id` → `stg_cust_customer_info.CUST_ID`
- **Source:** MySQL `cust_enterprise_realname_info` table (inferred)

#### `stg_cust_foreign_trade_order`
- **Domain:** Customer
- **Rows:** 14,270
- **Columns:** 49
- **FK:** `cust_id` → `stg_cust_customer_info.CUST_ID`
- **Source:** MySQL `cust_foreign_trade_order` table (inferred)

#### `stg_cust_foreign_trade_order_logistics`
- **Domain:** Customer
- **Rows:** 14,270
- **Columns:** 25
- **Source:** MySQL `cust_foreign_trade_order_logistics` table (inferred)

#### `stg_cust_person_realname_info`
- **Domain:** Customer
- **Rows:** 5,145
- **Columns:** 76
- **FK:** `cust_id` → `stg_cust_customer_info.CUST_ID`
- **Source:** MySQL `cust_person_realname_info` table (inferred)

#### `stg_cust_realname_enterprise_ref_person`
- **Domain:** Customer
- **Rows:** 6,496
- **Columns:** 23
- **FK:** `cust_id` → `stg_cust_customer_info.CUST_ID`
- **Source:** MySQL `cust_realname_enterprise_ref_person` table (inferred)

#### `stg_cust_store_info`
- **Domain:** Customer
- **Rows:** 1,210
- **Columns:** 55
- **FK:** `cust_id` → `stg_cust_customer_info.CUST_ID`
- **Source:** MySQL `cust_store_info` table (inferred)

#### `stg_cust_user_login_log`
- **Domain:** Customer
- **Rows:** 118,659
- **Columns:** 25
- **FK:** `cust_id` → `stg_cust_customer_info.CUST_ID`
- **Source:** MySQL `cust_user_login_log` table (inferred)

#### `stg_pmp_coll_order`
- **Domain:** Payment
- **Rows:** 114,734
- **Columns:** 111
- **FK:** `cust_id` → `stg_cust_customer_info.CUST_ID`
- **Source:** MySQL `pmp_coll_order` table (inferred)

#### `stg_pmp_pay_details`
- **Domain:** Payment
- **Rows:** 36,194
- **Columns:** 108
- **FK:** `cust_id` → `stg_cust_customer_info.CUST_ID`
- **Source:** MySQL `pmp_pay_details` table (inferred)

#### `stg_pmp_pay_order`
- **Domain:** Payment
- **Rows:** 33,835
- **Columns:** 138
- **FK:** `cust_id` → `stg_cust_customer_info.CUST_ID`
- **Source:** MySQL `pmp_pay_order` table (inferred)

## 10. Data Quality Issues & Recommendations

### Issues Found

**1. High Null Columns in `stg_cust_customer_info`**
- Columns with >80% nulls:
  - `primary_prod`: 100.0% null (1,729/1,729)
  - `business_model`: 100.0% null (1,729/1,729)
  - `industry`: 99.94% null (1,728/1,729)
  - `founded_time`: 100.0% null (1,729/1,729)
  - `staff_count_desc`: 100.0% null (1,729/1,729)
  - `bussiness_scale`: 100.0% null (1,729/1,729)
  - `expected_annual_turnover`: 100.0% null (1,729/1,729)
  - `last_risk_scan_desc`: 100.0% null (1,729/1,729)
  - `if_famous_company`: 100.0% null (1,729/1,729)
  - `if_pay_org`: 100.0% null (1,729/1,729)
  - `remark`: 100.0% null (1,729/1,729)
  - `invitor`: 100.0% null (1,729/1,729)
  - `active_time`: 90.69% null (1,568/1,729)
  - `stopped_time`: 100.0% null (1,729/1,729)
  - `frozen_time`: 99.77% null (1,725/1,729)
  - `migrate_time`: 100.0% null (1,729/1,729)
  - `frozen_reason`: 99.77% null (1,725/1,729)
  - `secd_cust_no`: 93.35% null (1,614/1,729)
  - `secd_cust_association_type`: 93.35% null (1,614/1,729)
  - `channel_partner`: 100.0% null (1,729/1,729)
  - `contact_mobile_save_time`: 83.11% null (1,437/1,729)
- **Recommendation:** Verify if these are legitimately optional fields or indicate missing data upstream

**2. Orphan Records in `stg_cust_bank_acct_info`**
- 4,542 records have `cust_id` values not found in `stg_cust_customer_info.CUST_ID`
- This indicates either: (a) deleted customers, (b) incomplete sync, or (c) data quality issue in source
- **Recommendation:** Investigate source MySQL for missing customer records or soft-delete flags

**3. High Null Columns in `stg_cust_bank_acct_info`**
- Columns with >80% nulls:
  - `branch_area`: 86.51% null (4,625/5,346)
  - `lst_upd_user`: 99.7% null (5,330/5,346)
  - `prove_file`: 99.72% null (5,331/5,346)
  - `entity_person_id`: 98.24% null (5,252/5,346)
  - `bank_code`: 83.26% null (4,451/5,346)
  - `entity_province`: 89.97% null (4,810/5,346)
  - `entity_province_code`: 94.87% null (5,072/5,346)
  - `entity_city`: 86.42% null (4,620/5,346)
  - `entity_post_code`: 92.63% null (4,952/5,346)
  - `entity_birthday`: 99.96% null (5,344/5,346)
  - `pay_target_country`: 99.05% null (5,295/5,346)
  - `bank_acct_fill_in_type`: 97.33% null (5,203/5,346)
  - `payee_additional_info`: 100.0% null (5,346/5,346)
  - `ref_company_counterparty_id`: 100.0% null (5,346/5,346)
- **Recommendation:** Verify if these are legitimately optional fields or indicate missing data upstream

**4. Orphan Records in `stg_cust_collections_acct`**
- 2,670 records have `cust_id` values not found in `stg_cust_customer_info.CUST_ID`
- This indicates either: (a) deleted customers, (b) incomplete sync, or (c) data quality issue in source
- **Recommendation:** Investigate source MySQL for missing customer records or soft-delete flags

**5. High Null Columns in `stg_cust_collections_acct`**
- Columns with >80% nulls:
  - `sub_bank_name`: 91.36% null (3,659/4,005)
  - `lst_upd_user`: 94.51% null (3,785/4,005)
  - `fee_rate`: 100.0% null (4,005/4,005)
  - `usages`: 100.0% null (4,005/4,005)
  - `first_arrival_time`: 99.05% null (3,967/4,005)
  - `last_arrival_time`: 99.05% null (3,967/4,005)
  - `business_scale`: 100.0% null (4,005/4,005)
  - `platform_cus_no`: 100.0% null (4,005/4,005)
  - `wire_routing_number`: 89.51% null (3,585/4,005)
  - `acs_quota_update_flag`: 100.0% null (4,005/4,005)
  - `chl_child_cust_id`: 100.0% null (4,005/4,005)
  - `sweep_indicator`: 97.6% null (3,909/4,005)
  - `sweep_type`: 97.6% null (3,909/4,005)
  - `peg_balance`: 97.6% null (3,909/4,005)
  - `ach_transactions_allowed`: 97.6% null (3,909/4,005)
  - `same_name_payer_id`: 97.2% null (3,893/4,005)
  - `default_pay_acct`: 97.2% null (3,893/4,005)
  - `api_seq`: 94.61% null (3,789/4,005)
  - `note`: 99.9% null (4,001/4,005)
  - `chl_bank_acct_id`: 82.77% null (3,315/4,005)
  - `chl_bank_acct_name`: 98.45% null (3,943/4,005)
  - `store_auth_files`: 95.71% null (3,833/4,005)
  - `is_subject_account_owner`: 97.03% null (3,886/4,005)
- **Recommendation:** Verify if these are legitimately optional fields or indicate missing data upstream

**6. Orphan Records in `stg_cust_enterprise_realname_info`**
- 79 records have `cust_id` values not found in `stg_cust_customer_info.CUST_ID`
- This indicates either: (a) deleted customers, (b) incomplete sync, or (c) data quality issue in source
- **Recommendation:** Investigate source MySQL for missing customer records or soft-delete flags

**7. High Null Columns in `stg_cust_enterprise_realname_info`**
- Columns with >80% nulls:
  - `create_user`: 100.0% null (2,126/2,126)
  - `lst_upd_user`: 100.0% null (2,126/2,126)
- **Recommendation:** Verify if these are legitimately optional fields or indicate missing data upstream

**8. Orphan Records in `stg_cust_foreign_trade_order`**
- 14,106 records have `cust_id` values not found in `stg_cust_customer_info.CUST_ID`
- This indicates either: (a) deleted customers, (b) incomplete sync, or (c) data quality issue in source
- **Recommendation:** Investigate source MySQL for missing customer records or soft-delete flags

**9. High Null Columns in `stg_cust_foreign_trade_order`**
- Columns with >80% nulls:
  - `settlement_currency`: 100.0% null (14,270/14,270)
  - `audit_flow_instance_id`: 100.0% null (14,270/14,270)
  - `refused_reason`: 99.76% null (14,236/14,270)
  - `audit_complete_files`: 100.0% null (14,270/14,270)
  - `need_complete_files`: 100.0% null (14,270/14,270)
  - `audit_complete_note`: 100.0% null (14,270/14,270)
  - `audit_middle_variable`: 100.0% null (14,270/14,270)
- **Recommendation:** Verify if these are legitimately optional fields or indicate missing data upstream

**10. High Null Columns in `stg_cust_foreign_trade_order_logistics`**
- Columns with >80% nulls:
  - `estimated_shipping_time`: 95.78% null (13,668/14,270)
  - `logistics_audit_complete_files`: 100.0% null (14,270/14,270)
  - `lst_upd_user`: 99.12% null (14,145/14,270)
- **Recommendation:** Verify if these are legitimately optional fields or indicate missing data upstream

**11. Orphan Records in `stg_cust_person_realname_info`**
- 410 records have `cust_id` values not found in `stg_cust_customer_info.CUST_ID`
- This indicates either: (a) deleted customers, (b) incomplete sync, or (c) data quality issue in source
- **Recommendation:** Investigate source MySQL for missing customer records or soft-delete flags

**12. High Null Columns in `stg_cust_person_realname_info`**
- Columns with >80% nulls:
  - `create_user`: 100.0% null (5,145/5,145)
  - `sky_remit_cert_front_file_id`: 100.0% null (5,145/5,145)
  - `sky_remit_cert_back_file_id`: 100.0% null (5,145/5,145)
  - `visa_type`: 99.96% null (5,143/5,145)
  - `stay_reason`: 100.0% null (5,145/5,145)
  - `stay_time_start`: 94.73% null (4,874/5,145)
  - `stay_time`: 94.73% null (4,874/5,145)
  - `pp_supt_type`: 88.79% null (4,568/5,145)
  - `work_permit_no`: 100.0% null (5,145/5,145)
  - `work_permit_type`: 99.96% null (5,143/5,145)
  - `detect_auth_id`: 84.61% null (4,353/5,145)
  - `identity_check_time`: 83.81% null (4,312/5,145)
  - `ignore_check_box_info_enable`: 96.27% null (4,953/5,145)
  - `shufti_cert_req_no`: 81.52% null (4,194/5,145)
  - `shufti_cert_down_status`: 81.52% null (4,194/5,145)
  - `address_number`: 96.05% null (4,942/5,145)
- **Recommendation:** Verify if these are legitimately optional fields or indicate missing data upstream

**13. Orphan Records in `stg_cust_realname_enterprise_ref_person`**
- 2,482 records have `cust_id` values not found in `stg_cust_customer_info.CUST_ID`
- This indicates either: (a) deleted customers, (b) incomplete sync, or (c) data quality issue in source
- **Recommendation:** Investigate source MySQL for missing customer records or soft-delete flags

**14. High Null Columns in `stg_cust_realname_enterprise_ref_person`**
- Columns with >80% nulls:
  - `create_user`: 98.61% null (6,406/6,496)
- **Recommendation:** Verify if these are legitimately optional fields or indicate missing data upstream

**15. Orphan Records in `stg_cust_store_info`**
- 744 records have `cust_id` values not found in `stg_cust_customer_info.CUST_ID`
- This indicates either: (a) deleted customers, (b) incomplete sync, or (c) data quality issue in source
- **Recommendation:** Investigate source MySQL for missing customer records or soft-delete flags

**16. High Null Columns in `stg_cust_store_info`**
- Columns with >80% nulls:
  - `auth_time`: 80.74% null (977/1,210)
  - `auth_params`: 100.0% null (1,210/1,210)
  - `create_user`: 100.0% null (1,210/1,210)
  - `lst_upd_user`: 100.0% null (1,210/1,210)
  - `auth_expire_time`: 80.74% null (977/1,210)
  - `store_country`: 83.22% null (1,007/1,210)
  - `last_order_sync_time`: 100.0% null (1,210/1,210)
  - `last_bill_sync_time`: 100.0% null (1,210/1,210)
  - `support_pay_service`: 98.51% null (1,192/1,210)
  - `active_time`: 90.91% null (1,100/1,210)
  - `first_bind_time`: 80.74% null (977/1,210)
  - `old_store_sn`: 100.0% null (1,210/1,210)
  - `store_belong_edit_open_deadline`: 100.0% null (1,210/1,210)
  - `merchants_ignore_time`: 99.34% null (1,202/1,210)
- **Recommendation:** Verify if these are legitimately optional fields or indicate missing data upstream

**17. Orphan Records in `stg_cust_user_login_log`**
- 114,712 records have `cust_id` values not found in `stg_cust_customer_info.CUST_ID`
- This indicates either: (a) deleted customers, (b) incomplete sync, or (c) data quality issue in source
- **Recommendation:** Investigate source MySQL for missing customer records or soft-delete flags

**18. High Null Columns in `stg_cust_user_login_log`**
- Columns with >80% nulls:
  - `lst_upd_user`: 100.0% null (118,659/118,659)
  - `fail_reason`: 96.33% null (114,300/118,659)
- **Recommendation:** Verify if these are legitimately optional fields or indicate missing data upstream

**19. Orphan Records in `stg_pmp_coll_order`**
- 114,204 records have `cust_id` values not found in `stg_cust_customer_info.CUST_ID`
- This indicates either: (a) deleted customers, (b) incomplete sync, or (c) data quality issue in source
- **Recommendation:** Investigate source MySQL for missing customer records or soft-delete flags

**20. High Null Columns in `stg_pmp_coll_order`**
- Columns with >80% nulls:
  - `fund_source`: 100.0% null (114,734/114,734)
  - `fund_purpose`: 100.0% null (114,734/114,734)
  - `qualified_time`: 100.0% null (114,734/114,734)
  - `qualified_no`: 100.0% null (114,734/114,734)
  - `exchange_no`: 100.0% null (114,734/114,734)
  - `exchange_curr_cd`: 100.0% null (114,734/114,734)
  - `exchange_amt`: 100.0% null (114,734/114,734)
  - `exchange_rate`: 100.0% null (114,734/114,734)
  - `exchange_time`: 100.0% null (114,734/114,734)
  - `refund_no`: 100.0% null (114,729/114,734)
  - `refund_time`: 100.0% null (114,732/114,734)
  - `lst_upd_user`: 100.0% null (114,734/114,734)
  - `holder_entity`: 100.0% null (114,734/114,734)
  - `refund_amt`: 100.0% null (114,734/114,734)
  - `refund_currency_cd`: 100.0% null (114,734/114,734)
  - `refund_comm_amt`: 100.0% null (114,734/114,734)
  - `refund_comm_currency_cd`: 100.0% null (114,734/114,734)
  - `ref_store_bill_id`: 100.0% null (114,734/114,734)
  - `order_relation_first_time`: 99.99% null (114,724/114,734)
  - `order_relation_update_time`: 100.0% null (114,731/114,734)
  - `match_result`: 99.97% null (114,705/114,734)
  - `reality_decide_result`: 99.97% null (114,705/114,734)
  - `audit_supply_file`: 99.99% null (114,727/114,734)
- **Recommendation:** Verify if these are legitimately optional fields or indicate missing data upstream

**21. Orphan Records in `stg_pmp_pay_details`**
- 35,865 records have `cust_id` values not found in `stg_cust_customer_info.CUST_ID`
- This indicates either: (a) deleted customers, (b) incomplete sync, or (c) data quality issue in source
- **Recommendation:** Investigate source MySQL for missing customer records or soft-delete flags

**22. High Null Columns in `stg_pmp_pay_details`**
- Columns with >80% nulls:
  - `create_user`: 100.0% null (36,194/36,194)
  - `lst_upd_user`: 100.0% null (36,194/36,194)
  - `declared_amt`: 100.0% null (36,194/36,194)
  - `undeclear_amt`: 100.0% null (36,194/36,194)
  - `province`: 100.0% null (36,194/36,194)
  - `city`: 100.0% null (36,194/36,194)
  - `email`: 100.0% null (36,194/36,194)
  - `proxy_id`: 100.0% null (36,194/36,194)
  - `address2`: 100.0% null (36,194/36,194)
  - `bank_ind_type`: 100.0% null (36,194/36,194)
  - `inter_swift_bic`: 100.0% null (36,194/36,194)
  - `coller_type`: 98.47% null (35,639/36,194)
  - `pay_attach_name`: 100.0% null (36,194/36,194)
  - `remark`: 100.0% null (36,194/36,194)
  - `pay_target_country`: 98.47% null (35,639/36,194)
  - `bank_country`: 99.99% null (36,190/36,194)
  - `refund_currency`: 100.0% null (36,194/36,194)
  - `refund_amt`: 100.0% null (36,194/36,194)
  - `refund_note`: 99.33% null (35,950/36,194)
  - `beneficiary_province_code`: 85.98% null (31,119/36,194)
  - `beneficiary_birthday`: 92.51% null (33,483/36,194)
  - `mobile_code`: 98.31% null (35,581/36,194)
  - `clear_req_chl_seq`: 99.34% null (35,954/36,194)
- **Recommendation:** Verify if these are legitimately optional fields or indicate missing data upstream

**23. Orphan Records in `stg_pmp_pay_order`**
- 33,506 records have `cust_id` values not found in `stg_cust_customer_info.CUST_ID`
- This indicates either: (a) deleted customers, (b) incomplete sync, or (c) data quality issue in source
- **Recommendation:** Investigate source MySQL for missing customer records or soft-delete flags

**24. High Null Columns in `stg_pmp_pay_order`**
- Columns with >80% nulls:
  - `qualified_status`: 100.0% null (33,835/33,835)
  - `qualified_time`: 100.0% null (33,835/33,835)
  - `qualified_no`: 100.0% null (33,835/33,835)
  - `exchange_amt`: 100.0% null (33,835/33,835)
  - `pay_details`: 100.0% null (33,835/33,835)
  - `need_declear`: 100.0% null (33,835/33,835)
  - `settle_curr_cd`: 100.0% null (33,835/33,835)
  - `undeclear_amt`: 100.0% null (33,835/33,835)
  - `holder_entity`: 100.0% null (33,835/33,835)
  - `refund_amt`: 100.0% null (33,835/33,835)
  - `refund_currency_cd`: 100.0% null (33,835/33,835)
  - `refund_extra_deduct_amt`: 100.0% null (33,835/33,835)
  - `real_refund_amt`: 100.0% null (33,835/33,835)
  - `refund_commission_currency`: 100.0% null (33,835/33,835)
  - `refund_commission_amt`: 100.0% null (33,835/33,835)
  - `real_refund_commission_amt`: 100.0% null (33,835/33,835)
  - `refund_note`: 99.31% null (33,602/33,835)
  - `commision_rate`: 100.0% null (33,835/33,835)
  - `rate_lost_type`: 100.0% null (33,835/33,835)
  - `fund_source`: 100.0% null (33,835/33,835)
  - `transfer_to_self`: 100.0% null (33,835/33,835)
  - `extends_params`: 99.7% null (33,735/33,835)
  - `business_type`: 100.0% null (33,835/33,835)
  - `trade_order_batch_no`: 99.68% null (33,728/33,835)
  - `refund_apply_user`: 100.0% null (33,835/33,835)
  - `refund_apply_time`: 100.0% null (33,835/33,835)
  - `refund_audit_user`: 100.0% null (33,835/33,835)
  - `refund_audit_time`: 100.0% null (33,835/33,835)
  - `refund_method`: 100.0% null (33,835/33,835)
  - `refund_time`: 100.0% null (33,835/33,835)
  - `same_name_payer_address`: 88.59% null (29,976/33,835)
  - `same_name_id`: 88.68% null (30,005/33,835)
  - `same_name_payer_birthday`: 91.99% null (31,124/33,835)
  - `turn_to_manual_reason`: 100.0% null (33,835/33,835)
  - `coll_order_ids`: 91.99% null (31,124/33,835)
- **Recommendation:** Verify if these are legitimately optional fields or indicate missing data upstream

### General Recommendations

1. **CDC Monitoring:** Set up alerts for CDC lag between MySQL source and Hudi staging
2. **Row Count Reconciliation:** Daily reconciliation of row counts between MySQL source and Hudi staging
3. **Null Budget:** Define acceptable null percentages per column and alert when exceeded
4. **Duplicate Detection:** Add dedup checks in the ETL pipeline, especially for incremental loads
5. **FK Integrity Checks:** Run orphan detection queries as part of post-ETL validation
6. **Schema Drift Detection:** Monitor for column additions/removals in MySQL that aren't reflected in Hudi
7. **Data Freshness SLA:** Define and monitor maximum acceptable lag for each table

---

*Report generated by automated EDA pipeline*