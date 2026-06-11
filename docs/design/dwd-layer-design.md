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

## 3. ISO 20022 Payment Model Reference

Based on ISO 20022 standard for financial messaging:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ISO 20022 Payment Model                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐│
│  │   DEBTOR     │         │   CREDITOR   │         │   INITIATING ││
│  │   (Payer)    │────────▶│   (Payee)    │         │   PARTY      ││
│  └──────────────┘         └──────────────┘         └──────────────┘│
│         │                           │                      │       │
│         │                           │                      │       │
│         ▼                           ▼                      ▼       │
│  ┌──────────────┐         ┌──────────────┐         ┌──────────────┐│
│  │    DEBTOR    │         │   CREDITOR   │         │  INITIATING  ││
│  │    AGENT     │         │    AGENT     │         │    PARTY     ││
│  │ (Payer Bank) │         │ (Payee Bank) │         │   (if agent) ││
│  └──────────────┘         └──────────────┘         └──────────────┘│
│                                                                     │
│  ┌──────────────┐         ┌──────────────┐                         │
│  │   ULTIMATE   │         │   ULTIMATE   │                         │
│  │    DEBTOR    │         │   CREDITOR   │                         │
│  │(Original     │         │(Original     │                         │
│  │ payer)       │         │ payee)       │                         │
│  └──────────────┘         └──────────────┘                         │
│                                                                     │
│  Key Relationships:                                                 │
│  • Debtor ≠ Ultimate Debtor → POBO (Pay On Behalf Of)              │
│  • Creditor ≠ Ultimate Creditor → Onward Payment                   │
│  • Initiating Party → Can be Debtor, Creditor, or Agent            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. DWD Table Designs

### 4.1 dwd_customer (Customer Master)

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

### 4.2 dwd_transaction (ISO 20022 Model)

**Purpose:** Unified transaction view following ISO 20022 payment model with Debtor, Creditor, and their Agents.

**Grain:** One row per payment detail (pd.ID) — the most granular level

**Source Tables:** 
- po (stg_pmp_pay_order) — order header
- pd (stg_pmp_pay_details) — line items
- co (stg_pmp_coll_order) — collection orders
- ci (stg_cust_customer_info) — customer risk flags

| Column | Type | Source | Description |
|--------|------|--------|-------------|
| **Order Header** | | | |
| txn_id | bigint | pd.ID | Primary key (detail level) |
| order_id | bigint | po.PAY_ORDER_ID | Payment order ID |
| order_no | varchar(64) | po.ORDER_NO | Business order number |
| cust_id | bigint | po.CUST_ID | Account holder (FK) |
| order_type | varchar(10) | 'PAY' / 'COLL' | Order type |
| txn_status | varchar(32) | pd.PAY_STATUS | Transaction status |
| txn_time | timestamp | pd.PAYMENT_TIME | Transaction time |
| **Flags** | | | |
| is_pobo | char(1) | CASE WHEN po.SAME_NAME_PAYER_NAME IS NOT NULL THEN 'Y' ELSE 'N' END | Pay On Behalf Of |
| is_cross_border | char(1) | CASE WHEN po.COUNTRY_CD != pd.COLL_COUNTRY_CD THEN 'Y' ELSE 'N' END | Cross-border transaction |
| is_exchange | char(1) | po.IS_EXCHANGE | Has currency exchange |
| is_refund | char(1) | pd.HAS_REFUND | Has refund |
| is_refund_commission | char(1) | pd.HAS_REFUND_COMMISSION | Has refund commission |
| is_same_name_pay | char(1) | pd.USE_SAME_NAME_PAY | Uses same-name payer |
| is_agent_initiated | char(1) | CASE WHEN po.PROXY_USER IS NOT NULL THEN 'Y' ELSE 'N' END | Initiated by agent |
| is_high_risk | char(1) | ci.HIGH_RISK | Customer high risk flag |
| is_sanctioned | char(1) | ci.SANCTIONED | Customer sanctioned flag |
| is_declared | char(1) | po.NEED_DECLEAR | Needs declaration |
| is_cross_border_purchase | char(1) | po.IS_CROSS_BORDER_PURCHASE | Cross-border purchase |
| **Amount** | | | |
| txn_amount | decimal(15,2) | pd.PAY_TXN_AMT | Transaction amount |
| txn_currency | varchar(10) | pd.CURRENCY_CD | Transaction currency |
| settlement_amount | decimal(15,2) | po.SETTLE_AMT | Settlement amount |
| settlement_currency | varchar(10) | po.SETTLE_CURR_CD | Settlement currency |
| commission_amount | decimal(15,2) | pd.COMMISSION_AMT | Commission |
| real_commission_amount | decimal(15,2) | pd.REAL_COMMISSION_AMT | Actual commission |
| **Debtor (Payer)** | | | |
| debtor_name | varchar(200) | po.NAME | Payer name |
| debtor_mobile | varchar(50) | pd.MOBILE_NO | Payer mobile |
| debtor_email | varchar(100) | pd.EMAIL | Payer email |
| debtor_cert_no | varchar(100) | pd.IDENTITY_NO | Payer ID |
| debtor_country | varchar(10) | po.COUNTRY_CD | Payer country |
| **Ultimate Debtor (POBO - Pay On Behalf Of)** | | | |
| is_pobo | char(1) | CASE WHEN po.SAME_NAME_PAYER_NAME IS NOT NULL THEN 'Y' ELSE 'N' END | Is POBO transaction |
| ultimate_debtor_name | varchar(200) | po.SAME_NAME_PAYER_NAME | Actual payer name |
| ultimate_debtor_en_name | varchar(150) | po.SAME_NAME_PAYER_EN_NAME | Actual payer English name |
| ultimate_debtor_cert_type | varchar(100) | po.SAME_NAME_PAYER_CERT_TYPE | Actual payer cert type |
| ultimate_debtor_cert_no | varchar(255) | po.SAME_NAME_PAYER_CERT_NO | Actual payer cert no |
| ultimate_debtor_mobile | varchar(50) | po.SAME_NAME_PAYER_MOBILE | Actual payer mobile |
| ultimate_debtor_address | varchar(255) | po.SAME_NAME_PAYER_ADDRESS | Actual payer address |
| ultimate_debtor_country_code | varchar(10) | po.SAME_NAME_PAYER_COUNTRY_CODE | Actual payer country |
| ultimate_debtor_country_name | varchar(100) | po.SAME_NAME_PAYER_COUNTRY_NAME | Actual payer country name |
| ultimate_debtor_birthday | timestamp | po.SAME_NAME_PAYER_BIRTHDAY | Actual payer birthday |
| ultimate_debtor_bank_acct_no | varchar(50) | po.SAME_NAME_PAYER_BANK_ACCT_NO | Actual payer bank acct |
| ultimate_debtor_province | varchar(255) | po.SAME_NAME_PAYER_PROVINCE | Actual payer province |
| ultimate_debtor_city | varchar(255) | po.SAME_NAME_PAYER_CITY | Actual payer city |
| ultimate_debtor_postcode | varchar(50) | po.SAME_NAME_PAYER_POSTCODE | Actual payer postcode |
| **Creditor (Payee)** | | | |
| creditor_name | varchar(200) | pd.SUBJECT_NAME | Payee name |
| creditor_mobile | varchar(50) | pd.MOBILE_NO | Payee mobile |
| creditor_email | varchar(100) | pd.BENEFICIARY_EMAIL | Payee email |
| creditor_cert_type | varchar(50) | pd.BENEFICIARY_IDENTIFICATION_TYPE | Payee cert type |
| creditor_cert_no | varchar(100) | pd.BENEFICIARY_IDENTIFICATION_NO | Payee cert no |
| creditor_address | varchar(255) | pd.COLL_ADDRESS | Payee address |
| creditor_en_address | varchar(255) | pd.COLL_EN_ADDRESS | Payee English address |
| creditor_country | varchar(10) | pd.COLL_COUNTRY_CD | Payee country |
| creditor_province | varchar(255) | pd.BENEFICIARY_PROVINCE | Payee province |
| creditor_city | varchar(255) | pd.BENEFICIARY_CITY | Payee city |
| creditor_postcode | varchar(255) | pd.BENEFICIARY_POST_CODE | Payee postcode |
| **Debtor Agent (Payer's Bank)** | | | |
| debtor_agent_name | varchar(100) | pd.BANK_NAME | Payer's bank name |
| debtor_agent_code | varchar(50) | pd.BANK_CODE | Payer's bank code |
| debtor_agent_swift | varchar(32) | pd.SWIFT_CODE | Payer's bank SWIFT |
| debtor_agent_bic | varchar(32) | pd.INTER_SWIFT_BIC | Payer's bank BIC |
| debtor_agent_country | varchar(10) | pd.BANK_COUNTRY | Payer's bank country |
| debtor_agent_branch_name | varchar(128) | pd.BANK_BRANCH_NAME | Payer's bank branch |
| debtor_agent_branch_no | varchar(128) | pd.BANK_BRANCH_NO | Payer's bank branch no |
| **Creditor Agent (Payee's Bank)** | | | |
| creditor_agent_name | varchar(200) | pd.bank_acct_name | Payee's bank name |
| creditor_agent_code | varchar(50) | pd.BANK_CODE | Payee's bank code |
| creditor_agent_acct_no | varchar(150) | pd.BANK_ACCT_NO | Payee's bank acct |
| creditor_agent_acct_name | varchar(200) | pd.bank_acct_name | Payee's bank acct name |
| creditor_agent_country | varchar(10) | pd.COLL_COUNTRY_CD | Payee's bank country |
| creditor_agent_province | varchar(128) | pd.PROVINCE | Payee's bank province |
| creditor_agent_city | varchar(128) | pd.CITY | Payee's bank city |
| creditor_agent_branch_name | varchar(128) | pd.BANK_BRANCH_NAME | Payee's bank branch |
| creditor_agent_branch_no | varchar(128) | pd.BANK_BRANCH_NO | Payee's bank branch no |
| **Initiating Party** | | | |
| initiating_party_name | varchar(200) | po.NAME | Who initiated the payment |
| initiating_party_type | varchar(20) | CASE WHEN po.PROXY_USER IS NOT NULL THEN 'AGENT' ELSE 'SELF' END | Self or Agent |
| initiating_party_id | varchar(50) | po.PROXY_USER | Agent user ID |
| **Payment Details** | | | |
| pay_type | varchar(30) | po.PAY_TYPE | Payment type |
| pay_method | varchar(20) | pd.PAY_METHOD | Payment method |
| fund_purpose | varchar(200) | pd.FUND_PURPOSE | Fund purpose |
| trade_type | varchar(50) | po.TRADE_TYPE | Trade type |
| business_type | varchar(50) | po.BUSINESS_TYPE | Business type |
| sub_biz_type | varchar(20) | po.SUB_BIZ_TYPE | Sub business type |
| **Clearing & Settlement** | | | |
| clear_status | varchar(20) | pd.CLEAR_STATUS | Clearing status |
| clear_time | timestamp | pd.CLEAR_TIME | Clearing time |
| clear_memo | varchar(500) | pd.clear_memo | Clearing memo |
| clear_channel_code | varchar(20) | pd.CLEAR_CHL_CODE | Clearing channel |
| clear_channel_name | varchar(40) | pd.CLEAR_CHL_NAME | Clearing channel name |
| clear_channel_seq | varchar(100) | pd.CLEAR_CHL_SEQ | Clearing channel seq |
| **Exchange** | | | |
| is_exchange | char(1) | po.IS_EXCHANGE | Has exchange |
| exchange_status | varchar(20) | po.EXCHANGE_STATUS | Exchange status |
| exchange_currency | varchar(10) | po.EXCHANGE_CURR_CD | Exchange currency |
| exchange_amount | decimal(15,2) | po.EXCHANGE_AMT | Exchange amount |
| exchange_rate | decimal(20,8) | po.EXCHANGE_RATE | Exchange rate |
| exchange_time | timestamp | po.EXCHANGE_TIME | Exchange time |
| **Audit** | | | |
| audit_status | varchar(20) | po.QUALIFIED_STATUS | Audit status |
| audit_time | timestamp | po.QUALIFIED_TIME | Audit time |
| audit_no | varchar(64) | po.QUALIFIED_NO | Audit number |
| **Remarks** | | | |
| pay_memo | varchar(255) | pd.pay_memo | Payment memo |
| remark | varchar(100) | pd.REMARK | Remark |
| **Record Info** | | | |
| create_user | varchar(100) | pd.CREATE_USER | Created by |
| create_time | timestamp | pd.CREATE_TIME | Record creation |
| lst_upd_user | varchar(100) | pd.LST_UPD_USER | Last updated by |
| lst_upd_time | timestamp | pd.LST_UPD_TIME | Last update |
| dt | date | pd.CREATE_TIME | Partition column |

---

### 4.3 dwd_person (Person Identity)

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

### 4.4 dwd_enterprise (Enterprise Identity)

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

### 4.5 dwd_store (Customer Stores)

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

### 4.6 dwd_foreign_trade_order (Foreign Trade)

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

### 4.7 dwd_login_log (Login History)

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

## 5. Implementation Plan

### Phase 1: Core Tables (Week 1)
- [ ] `dwd_customer` - Customer master
- [ ] `dwd_person` - Person identity
- [ ] `dwd_enterprise` - Enterprise identity

### Phase 2: Transaction Table (Week 2)
- [ ] `dwd_transaction` - ISO 20022 model with POBO

### Phase 3: Supporting Tables (Week 3)
- [ ] `dwd_store` - Customer stores
- [ ] `dwd_foreign_trade_order` - Foreign trade with logistics
- [ ] `dwd_login_log` - Login history

### Phase 4: Quality & Documentation (Week 4)
- [ ] Data quality checks
- [ ] Lineage documentation
- [ ] Performance optimization

---

## 6. Technical Specifications

### Storage
- **Format:** Hudi (Copy-on-Write)
- **Partition:** `dt` (date, derived from CREATE_TIME)
- **Location:** `/user/hive/warehouse/usr_skyee_mw.db/dwd_*`

### Design Principles
- **No aggregations in DWD** - Aggregations belong in DWS layer
- **Detail-level only** - One row per business entity
- **Denormalized** - Join related data for analysis-ready tables
- **Cleansed** - Standardize names, handle nulls, remove duplicates
- **ISO 20022 Compliant** - Use standard payment terminology

### Incremental Strategy
- **Daily sync:** Use `LST_UPD_TIME` for incremental extraction
- **Partition overwrite:** Replace affected date partitions
- **Deduplication:** Use primary key + `LST_UPD_TIME` as precombine

---

## 7. Glossary

| Term | ISO 20022 Definition |
|------|---------------------|
| STG | Staging layer - 1:1 mirror of source |
| DWD | Data Warehouse Detail - cleansed, denormalized |
| DWS | Data Warehouse Summary - aggregated |
| ADS | Application Data Store - application-specific |
| Hudi | Apache Hudi - incremental data lake format |
| Grain | The level of detail in a table (one row = one what?) |
| Partition | Physical division of data for performance |
| **Debtor** | Party that owes an amount of money to the (ultimate) creditor |
| **Creditor** | Party to which an amount of money is due |
| **Debtor Agent** | Financial institution servicing an account for the debtor |
| **Creditor Agent** | Financial institution servicing an account for the creditor |
| **Ultimate Debtor** | Ultimate party that owes money (when different from debtor) |
| **Ultimate Creditor** | Ultimate party to receive money (when different from creditor) |
| **Initiating Party** | Party initiating the payment (can be debtor, creditor, or agent) |
| **POBO** | Pay On Behalf Of - when Ultimate Debtor ≠ Debtor |

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
