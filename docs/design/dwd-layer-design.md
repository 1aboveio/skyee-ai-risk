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

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           SOURCE (MySQL)                            │
│  usr_skyee_mw: cust_*, pmp_*                                       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         STG LAYER (Hudi)                            │
│  stg_cust_customer_info, stg_pmp_pay_order, ...                    │
│  • 1:1 mirror of source                                             │
│  • Partitioned by dt (CREATE_TIME)                                  │
│  • Incremental sync daily                                           │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         DWD LAYER (Hudi)                            │
│  dwd_customer, dwd_transaction, dwd_person, dwd_enterprise, ...    │
│  • Business-domain oriented                                         │
│  • Denormalized & cleansed                                          │
│  • Ready for analytics, graph, ML                                   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
              ┌─────────┐ ┌───────┐ ┌───────┐
              │Analytics│ │  ML   │ │ Graph │
              │& BI     │ │Models │ │ Engine│
              └─────────┘ └───────┘ └───────┘
```

---

## 3. DWD Table Designs

### 3.1 dwd_customer (Customer Master)

**Purpose:** Consolidated customer profile with contact information, risk attributes, and business metrics.

**Grain:** One row per customer (CUST_ID)

**Source Tables:**
- `stg_cust_customer_info` (primary)
- `stg_cust_store_info` (store aggregation)
- `stg_cust_user_login_log` (login aggregation)

| Column | Type | Nullable | Source | Description |
|--------|------|----------|--------|-------------|
| cust_id | bigint | NO | cust_customer_info.CUST_ID | Primary key |
| cust_type | varchar(20) | NO | cust_customer_info.CUST_TYPE | PERSONAL / COMPANY |
| cust_name | varchar(150) | YES | cust_customer_info.CUST_NAME | Customer name (Chinese) |
| en_name | varchar(255) | YES | cust_customer_info.EN_NAME | English name |
| old_cust_name | varchar(40) | YES | cust_customer_info.OLD_CUST_NAME | Previous name |
| mobile_code | varchar(20) | YES | cust_customer_info.MOBILE_CODE | Country code (86, etc.) |
| cust_mobile | varchar(255) | YES | cust_customer_info.CUST_MOBILE | Primary mobile (encrypted) |
| email | varchar(255) | YES | cust_customer_info.EMAIL | Primary email |
| contact_mobile | varchar(255) | YES | cust_customer_info.CONTACT_MOBILE | Secondary mobile |
| regist_country | varchar(10) | YES | cust_customer_info.REGIST_COUNTRY | Registration country |
| merchant_platform | varchar(20) | YES | cust_customer_info.MERCHANT_PLATFORM | GENERAL / etc. |
| merchant_platform_sub_type | varchar(50) | YES | cust_customer_info.MERCHANT_PLATFORM_SUB_TYPE | Platform subtype |
| cust_status | varchar(20) | YES | cust_customer_info.CUST_STATUS | NORMAL / FROZEN / STOPPED |
| realname_status | char(1) | YES | cust_customer_info.REALNAME_STATUS | Y / N |
| realname_finish_time | timestamp | YES | cust_customer_info.REALNAME_FINISH_TIME | KYC completion time |
| risk_level | varchar(20) | YES | cust_customer_info.RISK_LEVEL | HIGH / MEDIUM_HIGH / MEDIUM / LOW |
| risk_score | decimal(4,2) | YES | cust_customer_info.RISK_SCORE | Numeric risk score (0-100) |
| sanctioned | char(1) | YES | cust_customer_info.SANCTIONED | Y / N |
| high_risk | char(1) | YES | cust_customer_info.HIGH_RISK | Y / N |
| last_risk_scan_id | bigint | YES | cust_customer_info.LAST_RISK_SCAN_ID | Last risk scan ID |
| last_risk_scan_time | timestamp | YES | cust_customer_info.LAST_RISK_SCAN_TIME | Last scan time |
| last_risk_scan_desc | varchar(255) | YES | cust_customer_info.LAST_RISK_SCAN_DESC | Scan result |
| primary_prod | varchar(50) | YES | cust_customer_info.PRIMARY_PROD | Primary product |
| business_model | varchar(50) | YES | cust_customer_info.BUSINESS_MODEL | Business model |
| industry | varchar(100) | YES | cust_customer_info.INDUSTRY | Industry category |
| staff_count_desc | varchar(50) | YES | cust_customer_info.STAFF_COUNT_DESC | Staff size |
| bussiness_scale | varchar(50) | YES | cust_customer_info.BUSSINESS_SCALE | Business scale |
| expected_annual_turnover | int | YES | cust_customer_info.EXPECTED_ANNUAL_TURNOVER | Expected turnover |
| expected_monthly_turnover | varchar(100) | YES | cust_customer_info.EXPECTED_MONTHLY_TURNOVER | Expected monthly |
| cust_biz_category | varchar(40) | YES | cust_customer_info.CUST_BIZ_CATEGORY | Business category |
| source | varchar(30) | YES | cust_customer_info.SOURCE | Customer source |
| channel_partner | varchar(255) | YES | cust_customer_info.CHANNEL_PARTNER | Channel partner |
| cust_label | varchar(50) | YES | cust_customer_info.CUST_LABEL | Customer labels |
| invite_code | varchar(50) | YES | cust_customer_info.INVITE_CODE | Invite code |
| invitor | varchar(50) | YES | cust_customer_info.INVITOR | Invitor ID |
| proxy_user | varchar(50) | YES | cust_customer_info.PROXY_USER | Proxy user |
| manage_user | varchar(50) | YES | cust_customer_info.MANAGE_USER | Manager |
| cust_relation_type | varchar(50) | YES | cust_customer_info.CUST_RELATION_TYPE | CUST_SELF / AGENT / etc. |
| import_agent_type | varchar(20) | YES | cust_customer_info.IMPORT_AGENT_TYPE | Import type |
| pay_quota | decimal(18,2) | YES | cust_customer_info.PAY_QUOTA | Payment quota |
| active_status | char(1) | YES | cust_customer_info.ACTIVE_STATUS | Y / N |
| active_time | timestamp | YES | cust_customer_info.ACTIVE_TIME | Activation time |
| stopped_time | timestamp | YES | cust_customer_info.STOPPED_TIME | Stop time |
| frozen_time | timestamp | YES | cust_customer_info.FROZEN_TIME | Freeze time |
| frozen_reason | varchar(255) | YES | cust_customer_info.FROZEN_REASON | Freeze reason |
| reg_time | timestamp | YES | cust_customer_info.REG_TIME | Registration time |
| first_realname_submit_time | timestamp | YES | cust_customer_info.FIRST_REALNAME_SUBMIT_TIME | First KYC submit |
| first_realname_success_time | timestamp | YES | cust_customer_info.FIRST_REALNAME_SUCCESS_TIME | First KYC success |
| store_count | int | NO | Derived (COUNT from stg_cust_store_info) | Number of stores |
| last_login_time | timestamp | YES | Derived (MAX from stg_cust_user_login_log) | Last login time |
| login_count_30d | int | NO | Derived (COUNT from stg_cust_user_login_log) | Logins in last 30 days |
| create_user | varchar(100) | YES | cust_customer_info.CREATE_USER | Created by |
| create_time | timestamp | YES | cust_customer_info.CREATE_TIME | Record creation |
| lst_upd_user | varchar(100) | YES | cust_customer_info.LST_UPD_USER | Last updated by |
| lst_upd_time | timestamp | YES | cust_customer_info.LST_UPD_TIME | Last update |
| delete_flag | char(1) | YES | cust_customer_info.DELETE_FLAG | Y / N |
| dt | date | NO | Derived from CREATE_TIME | Partition column |

---

### 3.2 dwd_person (Person Identity)

**Purpose:** Consolidated person identity information from realname verification with contact details.

**Grain:** One row per person realname record (ID)

**Source Tables:**
- `stg_cust_person_realname_info` (primary)
- `stg_cust_customer_info` (for additional customer info)

| Column | Type | Nullable | Source | Description |
|--------|------|----------|--------|-------------|
| id | bigint | NO | PK | Primary key |
| cust_id | bigint | NO | FK | Customer ID |
| real_name | varchar(100) | YES | REAL_NAME | Verified real name |
| en_name | varchar(255) | YES | EN_NAME | English name |
| cert_type | varchar(20) | YES | CERT_TYPE | ID_CARD / PASSPORT / etc. |
| cert_no | varchar(100) | YES | CERT_NO | Certificate number |
| cert_address | varchar(500) | YES | CERT_ADDRESS | Address on certificate |
| residence_address | varchar(500) | YES | RESIDENCE_ADDRESS | Current residence |
| mobile | varchar(50) | YES | MOBILE | Mobile number |
| email | varchar(100) | YES | EMAIL | Email address |
| verify_status | varchar(20) | YES | VERIFY_STATUS | VERIFIED / PENDING / REJECTED |
| verify_time | timestamp | YES | VERIFY_TIME | When verified |
| verify_remark | varchar(500) | YES | VERIFY_REMARK | Verification notes |
| create_user | varchar(100) | YES | CREATE_USER | Created by |
| create_time | timestamp | YES | CREATE_TIME | Record creation |
| lst_upd_user | varchar(100) | YES | LST_UPD_USER | Last updated by |
| lst_upd_time | timestamp | YES | LST_UPD_TIME | Last update |
| dt | date | NO | Derived from CREATE_TIME | Partition column |

---

### 3.3 dwd_enterprise (Enterprise Identity)

**Purpose:** Consolidated enterprise identity information from realname verification.

**Grain:** One row per enterprise realname record (ID)

**Source Tables:**
- `stg_cust_enterprise_realname_info` (primary)
- `stg_cust_realname_enterprise_ref_person` (legal person ref)

| Column | Type | Nullable | Source | Description |
|--------|------|----------|--------|-------------|
| id | bigint | NO | PK | Primary key |
| cust_id | bigint | NO | FK | Customer ID |
| enterprise_name | varchar(200) | YES | ENTERPRISE_NAME | Company name (Chinese) |
| en_name | varchar(255) | YES | EN_NAME | English name |
| unified_social_credit_code | varchar(50) | YES | UNIFIED_SOCIAL_CREDIT_CODE | Credit code |
| legal_person_name | varchar(100) | YES | LEGAL_PERSON_NAME | Legal representative |
| cert_no | varchar(100) | YES | CERT_NO | Business license no |
| cert_address | varchar(500) | YES | CERT_ADDRESS | Registered address |
| residence_address | varchar(500) | YES | RESIDENCE_ADDRESS | Operating address |
| company_website_url | varchar(500) | YES | COMPANY_WEBSITE_URL | Company website |
| verify_status | varchar(20) | YES | VERIFY_STATUS | VERIFIED / PENDING / REJECTED |
| verify_time | timestamp | YES | VERIFY_TIME | When verified |
| verify_remark | varchar(500) | YES | VERIFY_REMARK | Verification notes |
| create_user | varchar(100) | YES | CREATE_USER | Created by |
| create_time | timestamp | YES | CREATE_TIME | Record creation |
| lst_upd_user | varchar(100) | YES | LST_UPD_USER | Last updated by |
| lst_upd_time | timestamp | YES | LST_UPD_TIME | Last update |
| dt | date | NO | Derived from CREATE_TIME | Partition column |

---

### 3.4 dwd_transaction (Orders Unified)

**Purpose:** Unified view of collection orders and payment orders with counterparty information.

**Grain:** One row per order (COLL_ORDER_ID or PAY_ORDER_ID)

**Source Tables:**
- `stg_pmp_coll_order` (collection orders)
- `stg_pmp_pay_order` (payment orders)
- `stg_pmp_pay_details` (payment details aggregation)

| Column | Type | Nullable | Source | Description |
|--------|------|----------|--------|-------------|
| order_id | bigint | NO | COLL_ORDER_ID or PAY_ORDER_ID | Primary key |
| order_type | varchar(10) | NO | Derived | COLL / PAY |
| cust_id | bigint | NO | FK | Customer who owns the order |
| order_no | varchar(64) | YES | ORDER_NO | Business order number |
| order_status | varchar(32) | YES | ORDER_STATUS | Current status |
| amount | decimal(18,2) | YES | COLL_AMOUNT or PAY_AMOUNT | Order amount |
| currency | varchar(10) | YES | Derived | Currency code |
| payee_name | varchar(200) | YES | PAYEE_NAME (coll) | Payee name |
| payee_mobile | varchar(50) | YES | PAYEE_MOBILE (coll) | Payee mobile |
| payee_address | varchar(500) | YES | PAYEE_ADDRESS (coll) | Payee address |
| payer_name | varchar(200) | YES | PAYER_NAME (pay) | Payer name |
| payer_mobile | varchar(50) | YES | PAYER_MOBILE (pay) | Payer mobile |
| same_name_payer_mobile | varchar(50) | YES | SAME_NAME_PAYER_MOBILE | Same-name payer mobile |
| same_name_payer_name | varchar(200) | YES | SAME_NAME_PAYER_NAME | Same-name payer name |
| same_name_payer_cert_no | varchar(100) | YES | SAME_NAME_PAYER_CERT_NO | Same-name payer cert |
| order_time | timestamp | YES | CREATE_TIME | Order creation |
| completed_time | timestamp | YES | Derived from status | Completion time |
| remark | varchar(500) | YES | REMARK | Order remarks |
| create_user | varchar(100) | YES | CREATE_USER | Created by |
| create_time | timestamp | YES | CREATE_TIME | Record creation |
| lst_upd_user | varchar(100) | YES | LST_UPD_USER | Last updated by |
| lst_upd_time | timestamp | YES | LST_UPD_TIME | Last update |
| dt | date | NO | Derived from CREATE_TIME | Partition column |

---

### 3.5 dwd_pay_detail (Payment Details)

**Purpose:** Payment order line items with beneficiary and collection information.

**Grain:** One row per payment detail (ID)

**Source Tables:**
- `stg_pmp_pay_details` (primary)
- `stg_pmp_pay_order` (for order context)

| Column | Type | Nullable | Source | Description |
|--------|------|----------|--------|-------------|
| id | bigint | NO | PK | Primary key |
| pay_order_id | bigint | NO | FK | Payment order ID |
| cust_id | bigint | NO | FK | Customer ID |
| detail_no | varchar(64) | YES | DETAIL_NO | Detail number |
| amount | decimal(18,2) | YES | AMOUNT | Detail amount |
| currency | varchar(10) | YES | CURRENCY | Currency code |
| pay_type | varchar(32) | YES | PAY_TYPE | Payment type |
| pay_status | varchar(32) | YES | PAY_STATUS | Payment status |
| coll_account_no | varchar(64) | YES | COLL_ACCOUNT_NO | Collection account |
| coll_account_name | varchar(200) | YES | COLL_ACCOUNT_NAME | Collection name |
| coll_en_address | varchar(500) | YES | COLL_EN_ADDRESS | Collection address |
| coll_address | varchar(500) | YES | COLL_ADDRESS | Collection address |
| beneficiary_name | varchar(200) | YES | BENEFICIARY_NAME | Beneficiary name |
| beneficiary_email | varchar(100) | YES | BENEFICIARY_EMAIL | Beneficiary email |
| beneficiary_identification_no | varchar(100) | YES | BENEFICIARY_IDENTIFICATION_NO | Beneficiary ID |
| identity_no | varchar(100) | YES | IDENTITY_NO | Identity number |
| email | varchar(100) | YES | EMAIL | Email |
| mobile_no | varchar(50) | YES | MOBILE_NO | Mobile number |
| bank_code | varchar(32) | YES | BANK_CODE | Bank code |
| bank_name | varchar(100) | YES | BANK_NAME | Bank name |
| create_time | timestamp | YES | CREATE_TIME | Record creation |
| lst_upd_time | timestamp | YES | LST_UPD_TIME | Last update |
| dt | date | NO | Derived from CREATE_TIME | Partition column |

---

### 3.6 dwd_bank_account (Bank Accounts)

**Purpose:** Consolidated bank account information with identity details.

**Grain:** One row per bank account (ID)

**Source Tables:**
- `stg_cust_bank_acct_info` (primary)
- `stg_cust_collections_acct` (collection accounts)

| Column | Type | Nullable | Source | Description |
|--------|------|----------|--------|-------------|
| id | bigint | NO | PK | Primary key |
| cust_id | bigint | NO | FK | Customer ID |
| acct_type | varchar(20) | NO | Derived | BANK / COLLECTION |
| bank_name | varchar(100) | YES | BANK_NAME | Bank name |
| bank_code | varchar(32) | YES | BANK_CODE | Bank code |
| acct_no | varchar(64) | YES | ACCT_NO | Account number |
| acct_name | varchar(200) | YES | ACCT_NAME | Account holder name |
| acct_en_name | varchar(200) | YES | ACCT_EN_NAME | English name |
| acct_status | varchar(32) | YES | ACCT_STATUS | ACTIVE / FROZEN / CLOSED |
| id_card_no | varchar(100) | YES | ID_CARD_NO | ID card number |
| entity_identification_no | varchar(100) | YES | ENTITY_IDENTIFICATION_NO | Entity ID |
| ref_company_cert_no | varchar(100) | YES | REF_COMPANY_CERT_NO | Related company cert |
| phone_no | varchar(50) | YES | PHONE_NO | Phone number |
| reserved_mobile | varchar(50) | YES | RESERVED_MOBILE | Reserved mobile |
| entity_address | varchar(500) | YES | ENTITY_ADDRESS | Entity address |
| entity_en_address | varchar(500) | YES | ENTITY_EN_ADDRESS | Entity English address |
| entity_email | varchar(100) | YES | ENTITY_EMAIL | Entity email |
| create_user | varchar(100) | YES | CREATE_USER | Created by |
| create_time | timestamp | YES | CREATE_TIME | Record creation |
| lst_upd_user | varchar(100) | YES | LST_UPD_USER | Last updated by |
| lst_upd_time | timestamp | YES | LST_UPD_TIME | Last update |
| dt | date | NO | Derived from CREATE_TIME | Partition column |

---

### 3.7 dwd_store (Customer Stores)

**Purpose:** Customer store/platform information.

**Grain:** One row per store (ID)

**Source Tables:**
- `stg_cust_store_info`

| Column | Type | Nullable | Source | Description |
|--------|------|----------|--------|-------------|
| id | bigint | NO | PK | Primary key |
| cust_id | bigint | NO | FK | Customer ID |
| store_name | varchar(200) | YES | STORE_NAME | Store name |
| store_url | varchar(500) | YES | STORE_URL | Store URL |
| store_type | varchar(50) | YES | STORE_TYPE | Platform type |
| store_status | varchar(32) | YES | STORE_STATUS | ACTIVE / INACTIVE |
| storeholder_name | varchar(100) | YES | STOREHOLDER_NAME | Store holder |
| create_user | varchar(100) | YES | CREATE_USER | Created by |
| create_time | timestamp | YES | CREATE_TIME | Record creation |
| lst_upd_user | varchar(100) | YES | LST_UPD_USER | Last updated by |
| lst_upd_time | timestamp | YES | LST_UPD_TIME | Last update |
| dt | date | NO | Derived from CREATE_TIME | Partition column |

---

### 3.8 dwd_foreign_trade_order (Foreign Trade)

**Purpose:** Foreign trade orders with logistics information.

**Grain:** One row per order (ID)

**Source Tables:**
- `stg_cust_foreign_trade_order`
- `stg_cust_foreign_trade_order_logistics`

| Column | Type | Nullable | Source | Description |
|--------|------|----------|--------|-------------|
| id | bigint | NO | PK | Primary key |
| cust_id | bigint | NO | FK | Customer ID |
| order_no | varchar(64) | YES | ORDER_NO | Order number |
| order_status | varchar(32) | YES | ORDER_STATUS | Order status |
| order_amount | decimal(18,2) | YES | ORDER_AMOUNT | Order amount |
| currency | varchar(10) | YES | CURRENCY | Currency code |
| buyer_name | varchar(200) | YES | BUYER_NAME | Buyer name |
| seller_name | varchar(200) | YES | SELLER_NAME | Seller name |
| logistics_no | varchar(64) | YES | LOGISTICS_NO | Logistics tracking |
| logistics_status | varchar(32) | YES | LOGISTICS_STATUS | Logistics status |
| ship_time | timestamp | YES | SHIP_TIME | Ship time |
| goods_store_url | varchar(500) | YES | GOODS_STORE_URL | Product store URL |
| create_user | varchar(100) | YES | CREATE_USER | Created by |
| create_time | timestamp | YES | CREATE_TIME | Record creation |
| lst_upd_user | varchar(100) | YES | LST_UPD_USER | Last updated by |
| lst_upd_time | timestamp | YES | LST_UPD_TIME | Last update |
| dt | date | NO | Derived from CREATE_TIME | Partition column |

---

### 3.9 dwd_login_log (Login History)

**Purpose:** Customer login history with IP and device information.

**Grain:** One row per login (ID)

**Source Tables:**
- `stg_cust_user_login_log`

| Column | Type | Nullable | Source | Description |
|--------|------|----------|--------|-------------|
| id | bigint | NO | PK | Primary key |
| cust_id | bigint | NO | FK | Customer ID |
| login_type | varchar(32) | YES | LOGIN_TYPE | WEB / APP / API |
| login_ip | varchar(50) | YES | LOGIN_IP | IP address |
| login_time | timestamp | YES | LOGIN_TIME | Login timestamp |
| device_type | varchar(50) | YES | DEVICE_TYPE | Device info |
| browser | varchar(100) | YES | BROWSER | Browser info |
| os | varchar(100) | YES | OS | Operating system |
| create_time | timestamp | YES | CREATE_TIME | Record creation |
| dt | date | NO | Derived from CREATE_TIME | Partition column |

---

## 4. Data Lineage

```
┌─────────────────────────────────────────────────────────────────────┐
│ STG Layer                                                            │
├─────────────────────────────────────────────────────────────────────┤
│ stg_cust_customer_info ──────────────────────┐                      │
│ stg_cust_store_info ─────────────────────┐   │                      │
│ stg_cust_user_login_log ──────────────┐  │   │                      │
│ stg_cust_person_realname_info ────┐   │  │   │                      │
│ stg_cust_enterprise_realname_     │   │  │   │                      │
│   info ──────────────────────┐    │   │  │   │                      │
│ stg_cust_bank_acct_info ─┐   │    │   │  │   │                      │
│ stg_cust_collections_    │   │    │   │  │   │                      │
│   acct ──────────────┐   │   │    │   │  │   │                      │
│ stg_pmp_coll_order ──┤   │   │    │   │  │   │                      │
│ stg_pmp_pay_order ───┤   │   │    │   │  │   │                      │
│ stg_pmp_pay_details ─┤   │   │    │   │  │   │                      │
│ stg_cust_foreign_    │   │   │    │   │  │   │                      │
│   trade_order ───────┤   │   │    │   │  │   │                      │
│ stg_cust_foreign_    │   │   │    │   │  │   │                      │
│   trade_order_       │   │   │    │   │  │   │                      │
│   logistics ─────────┘   │   │    │   │  │   │                      │
└──────────────────────────┼───┼────┼───┼──┼───┼──────────────────────┘
                           │   │    │   │  │   │
                           ▼   │    │   │  │   │
                    ┌──────────┤    │   │  │   │
                    │ dwd_     │    │   │  │   │
                    │ bank_    │    │   │  │   │
                    │ account  │    │   │  │   │
                    └──────────┘    │   │  │   │
                                    │   │  │   │
                           ┌────────┘   │  │   │
                           ▼            │  │   │
                    ┌──────────┐        │  │   │
                    │ dwd_     │        │  │   │
                    │ person   │        │  │   │
                    └──────────┘        │  │   │
                                        │  │   │
                           ┌────────────┘  │   │
                           ▼               │   │
                    ┌──────────┐           │   │
                    │ dwd_     │           │   │
                    │ store    │           │   │
                    └──────────┘           │   │
                                            │   │
                           ┌────────────────┘   │
                           ▼                    │
                    ┌──────────┐                │
                    │ dwd_     │                │
                    │ customer │◄───────────────┘
                    └──────────┘
                           │
                           ▼
                    ┌──────────┐
                    │ dwd_     │
                    │ transaction
                    └──────────┘
```

---

## 5. Implementation Plan

### Phase 1: Core Tables (Week 1)
- [ ] `dwd_customer` - Customer master with aggregations
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

## 6. Technical Specifications

### Storage
- **Format:** Hudi (Copy-on-Write)
- **Partition:** `dt` (date, derived from CREATE_TIME)
- **Location:** `/user/hive/warehouse/usr_skyee_mw.db/dwd_*`

### Incremental Strategy
- **Daily sync:** Use `LST_UPD_TIME` for incremental extraction
- **Partition overwrite:** Replace affected date partitions
- **Deduplication:** Use primary key + `LST_UPD_TIME` as precombine

### Data Quality Checks
- Null percentage monitoring
- Duplicate detection
- Referential integrity validation
- Data freshness alerts

---

## 7. Glossary

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

## Appendix A: Source Table Reference

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

## Appendix B: DWD Table Summary

| Table | Grain | Primary Key | Key Aggregations |
|-------|-------|-------------|------------------|
| dwd_customer | 1 row per customer | cust_id | store_count, last_login_time, login_count_30d |
| dwd_person | 1 row per KYC record | id | - |
| dwd_enterprise | 1 row per KYC record | id | - |
| dwd_transaction | 1 row per order | order_id | - |
| dwd_pay_detail | 1 row per detail | id | - |
| dwd_bank_account | 1 row per account | id | - |
| dwd_store | 1 row per store | id | - |
| dwd_foreign_trade_order | 1 row per order | id | - |
| dwd_login_log | 1 row per login | id | - |
