# DWD Layer Design Document

**Author:** MiMo  
**Date:** 2026-06-12  
**Status:** Draft  
**Source Database:** MySQL `usr_skyee_mw` → STG (`stg_*`) → DWD (`dwd_*`)

---

## 1. Executive Summary

The DWD (Data Warehouse Detail) layer consolidates and cleanses data from the STG (Staging) layer into business-domain-oriented tables. Unlike STG tables which are 1:1 mirrors of source tables, DWD tables:

- **Denormalize** related data into single, analysis-ready tables
- **Standardize** field names, data types, and values
- **Cleanse** nulls, duplicates, and invalid data
- **Enrich** with derived fields and business logic
- **Serve** multiple downstream use cases (analytics, reporting, ML, graph)

---

## 2. Table Aliases

| Alias | Full Table Name | Description |
|-------|-----------------|-------------|
| **ci** | stg_cust_customer_info | Customer master |
| **ba** | stg_cust_bank_acct_info | Bank accounts |
| **ca** | stg_cust_collections_acct | Collection accounts |
| **er** | stg_cust_enterprise_realname_info | Enterprise KYC |
| **pr** | stg_cust_person_realname_info | Person KYC |
| **rp** | stg_cust_realname_enterprise_ref_person | Enterprise-person ref |
| **si** | stg_cust_store_info | Customer stores |
| **ll** | stg_cust_user_login_log | Login history |
| **ft** | stg_cust_foreign_trade_order | Foreign trade orders |
| **fl** | stg_cust_foreign_trade_order_logistics | Logistics |
| **co** | stg_pmp_coll_order | Collection orders |
| **po** | stg_pmp_pay_order | Payment orders |
| **pd** | stg_pmp_pay_details | Payment details |

---

## 3. DWD Table Designs

### 3.1 dwd_customer (Customer Master)

**Purpose:** Consolidated customer profile with contact information and risk attributes.

**Grain:** One row per customer (CUST_ID)

**Source Tables:** ci (stg_cust_customer_info)

| Column | Type | Source | Description |
|--------|------|--------|-------------|
| cust_id | bigint | ci.CUST_ID | Primary key |
| cust_type | varchar(20) | ci.CUST_TYPE | PERSONAL / COMPANY |
| cust_name | varchar(150) | ci.CUST_NAME | Customer name (Chinese) |
| en_name | varchar(255) | ci.EN_NAME | English name |
| old_cust_name | varchar(40) | ci.OLD_CUST_NAME | Previous name |
| mobile_code | varchar(20) | ci.MOBILE_CODE | Country code (86, etc.) |
| cust_mobile | varchar(255) | ci.CUST_MOBILE | Primary mobile (encrypted) |
| email | varchar(255) | ci.EMAIL | Primary email |
| contact_mobile | varchar(255) | ci.CONTACT_MOBILE | Secondary mobile |
| regist_country | varchar(10) | ci.REGIST_COUNTRY | Registration country |
| merchant_platform | varchar(20) | ci.MERCHANT_PLATFORM | GENERAL / etc. |
| merchant_platform_sub_type | varchar(50) | ci.MERCHANT_PLATFORM_SUB_TYPE | Platform subtype |
| cust_status | varchar(20) | ci.CUST_STATUS | NORMAL / FROZEN / STOPPED |
| realname_status | char(1) | ci.REALNAME_STATUS | Y / N |
| realname_finish_time | timestamp | ci.REALNAME_FINISH_TIME | KYC completion time |
| risk_level | varchar(20) | ci.RISK_LEVEL | HIGH / MEDIUM_HIGH / MEDIUM / LOW |
| risk_score | decimal(4,2) | ci.RISK_SCORE | Numeric risk score (0-100) |
| sanctioned | char(1) | ci.SANCTIONED | Y / N |
| high_risk | char(1) | ci.HIGH_RISK | Y / N |
| last_risk_scan_id | bigint | ci.LAST_RISK_SCAN_ID | Last risk scan ID |
| last_risk_scan_time | timestamp | ci.LAST_RISK_SCAN_TIME | Last scan time |
| last_risk_scan_desc | varchar(255) | ci.LAST_RISK_SCAN_DESC | Scan result |
| business_model | varchar(50) | ci.BUSINESS_MODEL | Business model |
| industry | varchar(100) | ci.INDUSTRY | Industry category |
| staff_count_desc | varchar(50) | ci.STAFF_COUNT_DESC | Staff size |
| bussiness_scale | varchar(50) | ci.BUSSINESS_SCALE | Business scale |
| expected_annual_turnover | int | ci.EXPECTED_ANNUAL_TURNOVER | Expected turnover |
| expected_monthly_turnover | varchar(100) | ci.EXPECTED_MONTHLY_TURNOVER | Expected monthly |
| cust_biz_category | varchar(40) | ci.CUST_BIZ_CATEGORY | Business category |
| source | varchar(30) | ci.SOURCE | Customer source |
| channel_partner | varchar(255) | ci.CHANNEL_PARTNER | Channel partner |
| cust_label | varchar(50) | ci.CUST_LABEL | Customer labels |
| invite_code | varchar(50) | ci.INVITE_CODE | Invite code |
| invitor | varchar(50) | ci.INVITOR | Invitor ID |
| proxy_user | varchar(50) | ci.PROXY_USER | Proxy user |
| manage_user | varchar(50) | ci.MANAGE_USER | Manager |
| cust_relation_type | varchar(50) | ci.CUST_RELATION_TYPE | CUST_SELF / AGENT / etc. |
| import_agent_type | varchar(20) | ci.IMPORT_AGENT_TYPE | Import type |
| pay_quota | decimal(18,2) | ci.PAY_QUOTA | Payment quota |
| active_status | char(1) | ci.ACTIVE_STATUS | Y / N |
| active_time | timestamp | ci.ACTIVE_TIME | Activation time |
| stopped_time | timestamp | ci.STOPPED_TIME | Stop time |
| frozen_time | timestamp | ci.FROZEN_TIME | Freeze time |
| frozen_reason | varchar(255) | ci.FROZEN_REASON | Freeze reason |
| reg_time | timestamp | ci.REG_TIME | Registration time |
| first_realname_submit_time | timestamp | ci.FIRST_REALNAME_SUBMIT_TIME | First KYC submit |
| first_realname_success_time | timestamp | ci.FIRST_REALNAME_SUCCESS_TIME | First KYC success |
| create_user | varchar(100) | ci.CREATE_USER | Created by |
| create_time | timestamp | ci.CREATE_TIME | Record creation |
| lst_upd_user | varchar(100) | ci.LST_UPD_USER | Last updated by |
| lst_upd_time | timestamp | ci.LST_UPD_TIME | Last update |
| delete_flag | char(1) | ci.DELETE_FLAG | Y / N |
| dt | date | ci.CREATE_TIME | Partition column |

---

### 3.2 dwd_person (Person Identity)

**Purpose:** Consolidated person identity information from realname verification.

**Grain:** One row per person realname record (ID)

**Source Tables:** pr (stg_cust_person_realname_info)

| Column | Type | Source | Description |
|--------|------|--------|-------------|
| id | bigint | pr.ID | Primary key |
| cust_id | bigint | pr.CUST_ID | Customer ID (FK) |
| real_name | varchar(100) | pr.REAL_NAME | Verified real name |
| en_name | varchar(255) | pr.EN_NAME | English name |
| cert_type | varchar(20) | pr.CERT_TYPE | ID_CARD / PASSPORT / etc. |
| cert_no | varchar(100) | pr.CERT_NO | Certificate number |
| cert_address | varchar(500) | pr.CERT_ADDRESS | Address on certificate |
| residence_address | varchar(500) | pr.RESIDENCE_ADDRESS | Current residence |
| mobile | varchar(50) | pr.MOBILE | Mobile number |
| email | varchar(100) | pr.EMAIL | Email address |
| verify_status | varchar(20) | pr.VERIFY_STATUS | VERIFIED / PENDING / REJECTED |
| verify_time | timestamp | pr.VERIFY_TIME | When verified |
| verify_remark | varchar(500) | pr.VERIFY_REMARK | Verification notes |
| create_user | varchar(100) | pr.CREATE_USER | Created by |
| create_time | timestamp | pr.CREATE_TIME | Record creation |
| lst_upd_user | varchar(100) | pr.LST_UPD_USER | Last updated by |
| lst_upd_time | timestamp | pr.LST_UPD_TIME | Last update |
| dt | date | pr.CREATE_TIME | Partition column |

---

### 3.3 dwd_enterprise (Enterprise Identity)

**Purpose:** Consolidated enterprise identity information from realname verification.

**Grain:** One row per enterprise realname record (ID)

**Source Tables:** er (stg_cust_enterprise_realname_info)

| Column | Type | Source | Description |
|--------|------|--------|-------------|
| id | bigint | er.ID | Primary key |
| cust_id | bigint | er.CUST_ID | Customer ID (FK) |
| enterprise_name | varchar(200) | er.ENTERPRISE_NAME | Company name (Chinese) |
| en_name | varchar(255) | er.EN_NAME | English name |
| unified_social_credit_code | varchar(50) | er.UNIFIED_SOCIAL_CREDIT_CODE | Credit code |
| legal_person_name | varchar(100) | er.LEGAL_PERSON_NAME | Legal representative |
| cert_no | varchar(100) | er.CERT_NO | Business license no |
| cert_address | varchar(500) | er.CERT_ADDRESS | Registered address |
| residence_address | varchar(500) | er.RESIDENCE_ADDRESS | Operating address |
| company_website_url | varchar(500) | er.COMPANY_WEBSITE_URL | Company website |
| verify_status | varchar(20) | er.VERIFY_STATUS | VERIFIED / PENDING / REJECTED |
| verify_time | timestamp | er.VERIFY_TIME | When verified |
| verify_remark | varchar(500) | er.VERIFY_REMARK | Verification notes |
| create_user | varchar(100) | er.CREATE_USER | Created by |
| create_time | timestamp | er.CREATE_TIME | Record creation |
| lst_upd_user | varchar(100) | er.LST_UPD_USER | Last updated by |
| lst_upd_time | timestamp | er.LST_UPD_TIME | Last update |
| dt | date | er.CREATE_TIME | Partition column |

---

### 3.4 dwd_transaction (Orders Unified)

**Purpose:** Unified view of collection orders and payment orders with counterparty information.

**Grain:** One row per order (COLL_ORDER_ID or PAY_ORDER_ID)

**Source Tables:** co (stg_pmp_coll_order), po (stg_pmp_pay_order)

| Column | Type | Source | Description |
|--------|------|--------|-------------|
| order_id | bigint | co.COLL_ORDER_ID / po.PAY_ORDER_ID | Primary key |
| order_type | varchar(10) | 'COLL' / 'PAY' | Order type |
| cust_id | bigint | co.CUST_ID / po.CUST_ID | Customer ID (FK) |
| order_no | varchar(64) | co.ORDER_NO / po.ORDER_NO | Business order number |
| order_status | varchar(32) | co.ORDER_STATUS / po.ORDER_STATUS | Current status |
| amount | decimal(18,2) | co.COLL_AMOUNT / po.PAY_AMOUNT | Order amount |
| currency | varchar(10) | co.CURRENCY / po.CURRENCY | Currency code |
| payee_name | varchar(200) | co.PAYEE_NAME | Payee name (coll) |
| payee_mobile | varchar(50) | co.PAYEE_MOBILE | Payee mobile (coll) |
| payee_address | varchar(500) | co.PAYEE_ADDRESS | Payee address (coll) |
| payer_name | varchar(200) | po.PAYER_NAME | Payer name (pay) |
| payer_mobile | varchar(50) | po.PAYER_MOBILE | Payer mobile (pay) |
| same_name_payer_mobile | varchar(50) | po.SAME_NAME_PAYER_MOBILE | Same-name payer mobile |
| same_name_payer_name | varchar(200) | po.SAME_NAME_PAYER_NAME | Same-name payer name |
| same_name_payer_cert_no | varchar(100) | po.SAME_NAME_PAYER_CERT_NO | Same-name payer cert |
| order_time | timestamp | co.CREATE_TIME / po.CREATE_TIME | Order creation |
| completed_time | timestamp | co.COMPLETED_TIME / po.COMPLETED_TIME | Completion time |
| remark | varchar(500) | co.REMARK / po.REMARK | Order remarks |
| create_user | varchar(100) | co.CREATE_USER / po.CREATE_USER | Created by |
| create_time | timestamp | co.CREATE_TIME / po.CREATE_TIME | Record creation |
| lst_upd_user | varchar(100) | co.LST_UPD_USER / po.LST_UPD_USER | Last updated by |
| lst_upd_time | timestamp | co.LST_UPD_TIME / po.LST_UPD_TIME | Last update |
| dt | date | co.CREATE_TIME / po.CREATE_TIME | Partition column |

---

### 3.5 dwd_pay_detail (Payment Details)

**Purpose:** Payment order line items with beneficiary and collection information.

**Grain:** One row per payment detail (ID)

**Source Tables:** pd (stg_pmp_pay_details)

| Column | Type | Source | Description |
|--------|------|--------|-------------|
| id | bigint | pd.ID | Primary key |
| pay_order_id | bigint | pd.PAY_ORDER_ID | Payment order ID (FK) |
| cust_id | bigint | pd.CUST_ID | Customer ID (FK) |
| detail_no | varchar(64) | pd.DETAIL_NO | Detail number |
| amount | decimal(18,2) | pd.AMOUNT | Detail amount |
| currency | varchar(10) | pd.CURRENCY | Currency code |
| pay_type | varchar(32) | pd.PAY_TYPE | Payment type |
| pay_status | varchar(32) | pd.PAY_STATUS | Payment status |
| coll_account_no | varchar(64) | pd.COLL_ACCOUNT_NO | Collection account |
| coll_account_name | varchar(200) | pd.COLL_ACCOUNT_NAME | Collection name |
| coll_en_address | varchar(500) | pd.COLL_EN_ADDRESS | Collection English address |
| coll_address | varchar(500) | pd.COLL_ADDRESS | Collection address |
| beneficiary_name | varchar(200) | pd.BENEFICIARY_NAME | Beneficiary name |
| beneficiary_email | varchar(100) | pd.BENEFICIARY_EMAIL | Beneficiary email |
| beneficiary_identification_no | varchar(100) | pd.BENEFICIARY_IDENTIFICATION_NO | Beneficiary ID |
| identity_no | varchar(100) | pd.IDENTITY_NO | Identity number |
| email | varchar(100) | pd.EMAIL | Email |
| mobile_no | varchar(50) | pd.MOBILE_NO | Mobile number |
| bank_code | varchar(32) | pd.BANK_CODE | Bank code |
| bank_name | varchar(100) | pd.BANK_NAME | Bank name |
| create_time | timestamp | pd.CREATE_TIME | Record creation |
| lst_upd_time | timestamp | pd.LST_UPD_TIME | Last update |
| dt | date | pd.CREATE_TIME | Partition column |

---

### 3.6 dwd_bank_account (Bank Accounts)

**Purpose:** Consolidated bank account information with identity details.

**Grain:** One row per bank account (ID)

**Source Tables:** ba (stg_cust_bank_acct_info), ca (stg_cust_collections_acct)

| Column | Type | Source | Description |
|--------|------|--------|-------------|
| id | bigint | ba.ID / ca.ID | Primary key |
| cust_id | bigint | ba.CUST_ID / ca.CUST_ID | Customer ID (FK) |
| acct_type | varchar(20) | 'BANK' / 'COLLECTION' | Account type |
| bank_name | varchar(100) | ba.BANK_NAME | Bank name |
| bank_code | varchar(32) | ba.BANK_CODE | Bank code |
| acct_no | varchar(64) | ba.ACCT_NO / ca.ACCT_NO | Account number |
| acct_name | varchar(200) | ba.ACCT_NAME / ca.ACCT_NAME | Account holder name |
| acct_en_name | varchar(200) | ba.ACCT_EN_NAME | English name |
| acct_status | varchar(32) | ba.ACCT_STATUS / ca.ACCT_STATUS | ACTIVE / FROZEN / CLOSED |
| id_card_no | varchar(100) | ba.ID_CARD_NO | ID card number |
| entity_identification_no | varchar(100) | ba.ENTITY_IDENTIFICATION_NO | Entity ID |
| ref_company_cert_no | varchar(100) | ba.REF_COMPANY_CERT_NO | Related company cert |
| phone_no | varchar(50) | ba.PHONE_NO | Phone number |
| reserved_mobile | varchar(50) | ba.RESERVED_MOBILE | Reserved mobile |
| entity_address | varchar(500) | ba.ENTITY_ADDRESS | Entity address |
| entity_en_address | varchar(500) | ba.ENTITY_EN_ADDRESS | Entity English address |
| entity_email | varchar(100) | ba.ENTITY_EMAIL | Entity email |
| create_user | varchar(100) | ba.CREATE_USER / ca.CREATE_USER | Created by |
| create_time | timestamp | ba.CREATE_TIME / ca.CREATE_TIME | Record creation |
| lst_upd_user | varchar(100) | ba.LST_UPD_USER / ca.LST_UPD_USER | Last updated by |
| lst_upd_time | timestamp | ba.LST_UPD_TIME / ca.LST_UPD_TIME | Last update |
| dt | date | ba.CREATE_TIME / ca.CREATE_TIME | Partition column |

---

### 3.7 dwd_store (Customer Stores)

**Purpose:** Customer store/platform information.

**Grain:** One row per store (ID)

**Source Tables:** si (stg_cust_store_info)

| Column | Type | Source | Description |
|--------|------|--------|-------------|
| id | bigint | si.ID | Primary key |
| cust_id | bigint | si.CUST_ID | Customer ID (FK) |
| store_name | varchar(200) | si.STORE_NAME | Store name |
| store_url | varchar(500) | si.STORE_URL | Store URL |
| store_type | varchar(50) | si.STORE_TYPE | Platform type |
| store_status | varchar(32) | si.STORE_STATUS | ACTIVE / INACTIVE |
| storeholder_name | varchar(100) | si.STOREHOLDER_NAME | Store holder |
| create_user | varchar(100) | si.CREATE_USER | Created by |
| create_time | timestamp | si.CREATE_TIME | Record creation |
| lst_upd_user | varchar(100) | si.LST_UPD_USER | Last updated by |
| lst_upd_time | timestamp | si.LST_UPD_TIME | Last update |
| dt | date | si.CREATE_TIME | Partition column |

---

### 3.8 dwd_foreign_trade_order (Foreign Trade)

**Purpose:** Foreign trade orders with logistics information.

**Grain:** One row per order (ID)

**Source Tables:** ft (stg_cust_foreign_trade_order), fl (stg_cust_foreign_trade_order_logistics)

| Column | Type | Source | Description |
|--------|------|--------|-------------|
| id | bigint | ft.ID | Primary key |
| cust_id | bigint | ft.CUST_ID | Customer ID (FK) |
| order_no | varchar(64) | ft.ORDER_NO | Order number |
| order_status | varchar(32) | ft.ORDER_STATUS | Order status |
| order_amount | decimal(18,2) | ft.ORDER_AMOUNT | Order amount |
| currency | varchar(10) | ft.CURRENCY | Currency code |
| buyer_name | varchar(200) | ft.BUYER_NAME | Buyer name |
| seller_name | varchar(200) | ft.SELLER_NAME | Seller name |
| logistics_no | varchar(64) | fl.LOGISTICS_NO | Logistics tracking |
| logistics_status | varchar(32) | fl.LOGISTICS_STATUS | Logistics status |
| ship_time | timestamp | fl.SHIP_TIME | Ship time |
| goods_store_url | varchar(500) | fl.GOODS_STORE_URL | Product store URL |
| create_user | varchar(100) | ft.CREATE_USER | Created by |
| create_time | timestamp | ft.CREATE_TIME | Record creation |
| lst_upd_user | varchar(100) | ft.LST_UPD_USER | Last updated by |
| lst_upd_time | timestamp | ft.LST_UPD_TIME | Last update |
| dt | date | ft.CREATE_TIME | Partition column |

---

### 3.9 dwd_login_log (Login History)

**Purpose:** Customer login history with IP and device information.

**Grain:** One row per login (ID)

**Source Tables:** ll (stg_cust_user_login_log)

| Column | Type | Source | Description |
|--------|------|--------|-------------|
| id | bigint | ll.ID | Primary key |
| cust_id | bigint | ll.CUST_ID | Customer ID (FK) |
| login_type | varchar(32) | ll.LOGIN_TYPE | WEB / APP / API |
| login_ip | varchar(50) | ll.LOGIN_IP | IP address |
| login_time | timestamp | ll.LOGIN_TIME | Login timestamp |
| device_type | varchar(50) | ll.DEVICE_TYPE | Device info |
| browser | varchar(100) | ll.BROWSER | Browser info |
| os | varchar(100) | ll.OS | Operating system |
| create_time | timestamp | ll.CREATE_TIME | Record creation |
| dt | date | ll.CREATE_TIME | Partition column |

---

## 4. Implementation Plan

### Phase 1: Core Tables (Week 1)
- [ ] `dwd_customer` - Customer master
- [ ] `dwd_person` - Person identity
- [ ] `dwd_enterprise` - Enterprise identity

### Phase 2: Transaction Tables (Week 2)
- [ ] `dwd_transaction` - Unified orders (coll + pay)
- [ ] `dwd_pay_detail` - Payment details
- [ ] `dwd_bank_account` - Bank accounts

### Phase 3: Supporting Tables (Week 3)
- [ ] `dwd_store` - Customer stores
- [ ] `dwd_foreign_trade_order` - Foreign trade with logistics
- [ ] `dwd_login_log` - Login history

### Phase 4: Quality & Documentation (Week 4)
- [ ] Data quality checks
- [ ] Lineage documentation
- [ ] Performance optimization

---

## 5. Technical Specifications

### Storage
- **Format:** Hudi (Copy-on-Write)
- **Partition:** `dt` (date, derived from CREATE_TIME)
- **Location:** `/user/hive/warehouse/usr_skyee_mw.db/dwd_*`

### Design Principles
- **No aggregations in DWD** - Aggregations belong in DWS layer
- **Detail-level only** - One row per business entity
- **Denormalized** - Join related data for analysis-ready tables
- **Cleansed** - Standardize names, handle nulls, remove duplicates

### Incremental Strategy
- **Daily sync:** Use `LST_UPD_TIME` for incremental extraction
- **Partition overwrite:** Replace affected date partitions
- **Deduplication:** Use primary key + `LST_UPD_TIME` as precombine

---

## 6. Glossary

| Term | Definition |
|------|------------|
| STG | Staging layer - 1:1 mirror of source |
| DWD | Data Warehouse Detail - cleansed, denormalized |
| DWS | Data Warehouse Summary - aggregated |
| ADS | Application Data Store - application-specific |
| Hudi | Apache Hudi - incremental data lake format |
| Grain | The level of detail in a table (one row = one what?) |
| Partition | Physical division of data for performance |

---

## Appendix: Source Table Reference

| Table | Description | Rows (June 2026) |
|-------|-------------|------------------|
| stg_cust_customer_info | Customer master | 1,729 |
| stg_cust_bank_acct_info | Bank accounts | 5,346 |
| stg_cust_collections_acct | Collection accounts | 4,005 |
| stg_cust_enterprise_realname_info | Enterprise KYC | 2,126 |
| stg_cust_person_realname_info | Person KYC | 5,145 |
| stg_cust_realname_enterprise_ref_person | Enterprise-person ref | 6,496 |
| stg_cust_store_info | Customer stores | 1,210 |
| stg_cust_user_login_log | Login history | 118,659 |
| stg_cust_foreign_trade_order | Foreign trade orders | 14,270 |
| stg_cust_foreign_trade_order_logistics | Logistics | 14,270 |
| stg_pmp_coll_order | Collection orders | 114,734 |
| stg_pmp_pay_order | Payment orders | 33,835 |
| stg_pmp_pay_details | Payment details | 36,194 |
