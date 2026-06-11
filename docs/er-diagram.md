# ER Diagram — usr_skyee_mw Staging Tables

## Visual ER Diagram

![ER Diagram](er-diagram.svg)

## Mermaid ER Diagram

```mermaid
erDiagram
    stg_cust_customer_info {
        bigint CUST_ID PK
        varchar CUST_TYPE
        varchar CUST_NAME
        varchar CUST_MOBILE
        varchar EMAIL
        varchar CUST_STATUS
        varchar REALNAME_STATUS
        timestamp REG_TIME
        varchar RISK_LEVEL
        decimal RISK_SCORE
        date dt
    }

    stg_cust_bank_acct_info {
        bigint ID PK
        bigint CUST_ID FK
        varchar BANK_NAME
        varchar ACCT_NO
        varchar ACCT_NAME
        varchar ACCT_STATUS
        date dt
    }

    stg_cust_collections_acct {
        bigint ID PK
        bigint CUST_ID FK
        varchar ACCT_NO
        varchar ACCT_TYPE
        varchar ACCT_STATUS
        date dt
    }

    stg_cust_enterprise_realname_info {
        bigint ID PK
        bigint CUST_ID FK
        varchar ENTERPRISE_NAME
        varchar UNIFIED_SOCIAL_CREDIT_CODE
        varchar LEGAL_PERSON_NAME
        varchar VERIFY_STATUS
        date dt
    }

    stg_cust_person_realname_info {
        bigint ID PK
        bigint CUST_ID FK
        varchar REAL_NAME
        varchar ID_CARD_NO
        varchar VERIFY_STATUS
        date dt
    }

    stg_cust_realname_enterprise_ref_person {
        bigint ID PK
        bigint CUST_ID FK
        bigint REALNAME_ID FK
        varchar PERSON_TYPE
        date dt
    }

    stg_cust_store_info {
        bigint ID PK
        bigint CUST_ID FK
        varchar STORE_NAME
        varchar STORE_URL
        varchar STORE_TYPE
        varchar STORE_STATUS
        date dt
    }

    stg_cust_user_login_log {
        bigint ID PK
        bigint CUST_ID FK
        varchar LOGIN_TYPE
        varchar LOGIN_IP
        timestamp LOGIN_TIME
        date dt
    }

    stg_cust_foreign_trade_order {
        bigint ID PK
        bigint CUST_ID FK
        varchar ORDER_NO
        decimal ORDER_AMOUNT
        varchar ORDER_STATUS
        timestamp CREATE_TIME
        date dt
    }

    stg_cust_foreign_trade_order_logistics {
        bigint ID PK
        bigint ORDER_ID FK
        varchar LOGISTICS_NO
        varchar LOGISTICS_STATUS
        timestamp SHIP_TIME
        date dt
    }

    stg_pmp_coll_order {
        bigint COLL_ORDER_ID PK
        bigint CUST_ID FK
        varchar ORDER_NO
        decimal COLL_AMOUNT
        varchar ORDER_STATUS
        timestamp CREATE_TIME
        date dt
    }

    stg_pmp_pay_order {
        bigint PAY_ORDER_ID PK
        bigint CUST_ID FK
        varchar ORDER_NO
        decimal PAY_AMOUNT
        varchar PAY_STATUS
        timestamp CREATE_TIME
        date dt
    }

    stg_pmp_pay_details {
        bigint ID PK
        bigint CUST_ID FK
        bigint PAY_ORDER_ID FK
        varchar DETAIL_NO
        decimal AMOUNT
        varchar PAY_TYPE
        date dt
    }

    stg_cust_customer_info ||--o{ stg_cust_bank_acct_info : "has"
    stg_cust_customer_info ||--o{ stg_cust_collections_acct : "has"
    stg_cust_customer_info ||--o{ stg_cust_enterprise_realname_info : "has"
    stg_cust_customer_info ||--o{ stg_cust_person_realname_info : "has"
    stg_cust_customer_info ||--o{ stg_cust_realname_enterprise_ref_person : "has"
    stg_cust_customer_info ||--o{ stg_cust_store_info : "has"
    stg_cust_customer_info ||--o{ stg_cust_user_login_log : "has"
    stg_cust_customer_info ||--o{ stg_cust_foreign_trade_order : "places"
    stg_cust_customer_info ||--o{ stg_pmp_coll_order : "creates"
    stg_cust_customer_info ||--o{ stg_pmp_pay_order : "creates"
    
    stg_cust_foreign_trade_order ||--o{ stg_cust_foreign_trade_order_logistics : "has"
    stg_pmp_pay_order ||--o{ stg_pmp_pay_details : "contains"
    stg_cust_realname_enterprise_ref_person }o--|| stg_cust_enterprise_realname_info : "references"
```

## Key Relationships

| Relationship | Type | Description |
|--------------|------|-------------|
| `stg_cust_customer_info` → `stg_cust_bank_acct_info` | 1:N | Customer has bank accounts |
| `stg_cust_customer_info` → `stg_cust_collections_acct` | 1:N | Customer has collection accounts |
| `stg_cust_customer_info` → `stg_cust_enterprise_realname_info` | 1:N | Customer has enterprise realname records |
| `stg_cust_customer_info` → `stg_cust_person_realname_info` | 1:N | Customer has person realname records |
| `stg_cust_customer_info` → `stg_cust_store_info` | 1:N | Customer has stores |
| `stg_cust_customer_info` → `stg_cust_user_login_log` | 1:N | Customer has login logs |
| `stg_cust_customer_info` → `stg_cust_foreign_trade_order` | 1:N | Customer places foreign trade orders |
| `stg_cust_customer_info` → `stg_pmp_coll_order` | 1:N | Customer creates collection orders |
| `stg_cust_customer_info` → `stg_pmp_pay_order` | 1:N | Customer creates payment orders |
| `stg_cust_foreign_trade_order` → `stg_cust_foreign_trade_order_logistics` | 1:N | Order has logistics records |
| `stg_pmp_pay_order` → `stg_pmp_pay_details` | 1:N | Payment order has details |
| `stg_cust_enterprise_realname_info` → `stg_cust_realname_enterprise_ref_person` | 1:N | Enterprise realname has referenced persons |

## Domain Grouping

### Customer Domain
- `stg_cust_customer_info` — Core customer master data
- `stg_cust_bank_acct_info` — Customer bank accounts
- `stg_cust_collections_acct` — Customer collection accounts
- `stg_cust_store_info` — Customer stores/platforms
- `stg_cust_user_login_log` — Customer login history

### Identity Domain
- `stg_cust_enterprise_realname_info` — Enterprise realname verification
- `stg_cust_person_realname_info` — Person realname verification
- `stg_cust_realname_enterprise_ref_person` — Enterprise-person references

### Trade Domain
- `stg_cust_foreign_trade_order` — Foreign trade orders
- `stg_cust_foreign_trade_order_logistics` — Logistics for trade orders

### Payment Domain
- `stg_pmp_coll_order` — Collection orders
- `stg_pmp_pay_order` — Payment orders
- `stg_pmp_pay_details` — Payment order line items

## Primary Keys

| Table | Primary Key | Type |
|-------|-------------|------|
| stg_cust_customer_info | CUST_ID | bigint |
| stg_cust_bank_acct_info | ID | bigint |
| stg_cust_collections_acct | ID | bigint |
| stg_cust_enterprise_realname_info | ID | bigint |
| stg_cust_person_realname_info | ID | bigint |
| stg_cust_realname_enterprise_ref_person | ID | bigint |
| stg_cust_store_info | ID | bigint |
| stg_cust_user_login_log | ID | bigint |
| stg_cust_foreign_trade_order | ID | bigint |
| stg_cust_foreign_trade_order_logistics | ID | bigint |
| stg_pmp_coll_order | COLL_ORDER_ID | bigint |
| stg_pmp_pay_order | PAY_ORDER_ID | bigint |
| stg_pmp_pay_details | ID | bigint |

## Table Statistics

| Table | Rows | Columns | Domain |
|-------|------|---------|--------|
| stg_cust_customer_info | 1,729 | 72 | Customer |
| stg_cust_bank_acct_info | 5,346 | 96 | Customer |
| stg_cust_collections_acct | 4,005 | 83 | Customer |
| stg_cust_enterprise_realname_info | 2,126 | 67 | Identity |
| stg_cust_person_realname_info | 5,145 | 76 | Identity |
| stg_cust_realname_enterprise_ref_person | 6,496 | 23 | Identity |
| stg_cust_store_info | 1,210 | 55 | Customer |
| stg_cust_user_login_log | 118,659 | 25 | Customer |
| stg_cust_foreign_trade_order | 14,270 | 49 | Trade |
| stg_cust_foreign_trade_order_logistics | 14,270 | 25 | Trade |
| stg_pmp_coll_order | 114,734 | 111 | Payment |
| stg_pmp_pay_order | 33,835 | 138 | Payment |
| stg_pmp_pay_details | 36,194 | 108 | Payment |
| **Total** | **358,019** | | |
