import { query } from "./mysql";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CustomerType = "PERSONAL" | "COMPANY" | "UNKNOWN";

export interface CustomerProfileBase {
  custId: string;
  custType: CustomerType;
  custName: string | null;
  enName: string | null;
  custMobile: string | null;
  email: string | null;
  registCountry: string | null;
  custStatus: string | null;
  realnameStatus: string | null;
  riskLevel: string | null;
  riskScore: number | null;
  highRisk: boolean;
  sanctioned: boolean;
  regTime: string | null;
  freshness: {
    mainTable: { createTime: string | null; lastUpdateTime: string | null };
    realnameTable: { createTime: string | null; lastUpdateTime: string | null };
  };
}

export interface PersonalRealname {
  name: string | null;
  enName: string | null;
  certType: string | null;
  certNo: string | null;
  residenceAddress: string | null;
}

export interface EnterpriseRealname {
  enterpriseName: string | null;
  enName: string | null;
  certNo: string | null;
  legalPersonName: string | null;
  businessStatus: string | null;
}

export type CustomerProfile = CustomerProfileBase &
  (
    | { custType: "PERSONAL"; personal: PersonalRealname; enterprise: null }
    | { custType: "COMPANY"; personal: null; enterprise: EnterpriseRealname }
    | { custType: "UNKNOWN"; personal: null; enterprise: null }
  );

// ---------------------------------------------------------------------------
// MySQL row types
// ---------------------------------------------------------------------------

interface CustCustomerInfoRow {
  CUST_ID: string;
  CUST_TYPE: string | null;
  CUST_NAME: string | null;
  EN_NAME: string | null;
  CUST_MOBILE: string | null;
  EMAIL: string | null;
  REGIST_COUNTRY: string | null;
  CUST_STATUS: string | null;
  REALNAME_STATUS: string | null;
  RISK_LEVEL: string | null;
  RISK_SCORE: number | null;
  HIGH_RISK: string | number | null;
  SANCTIONED: string | number | null;
  REG_TIME: Date | string | null;
  CREATE_TIME: Date | string | null;
  LST_UPD_TIME: Date | string | null;
}

interface PersonalRealnameRow {
  NAME: string | null;
  EN_NAME: string | null;
  CERT_TYPE: string | null;
  CERT_NO: string | null;
  RESIDENCE_ADDRESS: string | null;
  CREATE_TIME: Date | string | null;
  LST_UPD_TIME: Date | string | null;
}

interface EnterpriseRealnameRow {
  ENTERPRISE_NAME: string | null;
  EN_NAME: string | null;
  CERT_NO: string | null;
  LEGAL_PERSON_NAME: string | null;
  BUSINESS_STATUS: string | null;
  CREATE_TIME: Date | string | null;
  LST_UPD_TIME: Date | string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function toBoolean(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return value !== 0;
  return value === "1" || value.toUpperCase() === "Y" || value.toUpperCase() === "TRUE";
}

function normalizeCustType(raw: string | null): CustomerType {
  switch (raw?.toUpperCase()) {
    case "PERSONAL":
      return "PERSONAL";
    case "COMPANY":
    case "ENTERPRISE":
      return "COMPANY";
    default:
      return "UNKNOWN";
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export async function getCustomerProfile(
  custId: string
): Promise<CustomerProfile | null> {
  // 1. Fetch main customer info
  const mainRows = await query<CustCustomerInfoRow[]>(
    `SELECT CUST_ID, CUST_TYPE, CUST_NAME, EN_NAME, CUST_MOBILE, EMAIL,
            REGIST_COUNTRY, CUST_STATUS, REALNAME_STATUS,
            RISK_LEVEL, RISK_SCORE, HIGH_RISK, SANCTIONED,
            REG_TIME, CREATE_TIME, LST_UPD_TIME
     FROM cust_customer_info
     WHERE CUST_ID = ?
     LIMIT 1`,
    [custId]
  );

  if (mainRows.length === 0) return null;

  const main = mainRows[0];
  const custType = normalizeCustType(main.CUST_TYPE);

  const base: CustomerProfileBase = {
    custId: main.CUST_ID,
    custType,
    custName: main.CUST_NAME,
    enName: main.EN_NAME,
    custMobile: main.CUST_MOBILE,
    email: main.EMAIL,
    registCountry: main.REGIST_COUNTRY,
    custStatus: main.CUST_STATUS,
    realnameStatus: main.REALNAME_STATUS,
    riskLevel: main.RISK_LEVEL,
    riskScore: main.RISK_SCORE,
    highRisk: toBoolean(main.HIGH_RISK),
    sanctioned: toBoolean(main.SANCTIONED),
    regTime: formatDate(main.REG_TIME),
    freshness: {
      mainTable: {
        createTime: formatDate(main.CREATE_TIME),
        lastUpdateTime: formatDate(main.LST_UPD_TIME),
      },
      realnameTable: { createTime: null, lastUpdateTime: null },
    },
  };

  // 2. Fetch realname info based on type
  if (custType === "PERSONAL") {
    const rows = await query<PersonalRealnameRow[]>(
      `SELECT NAME, EN_NAME, CERT_TYPE, CERT_NO, RESIDENCE_ADDRESS,
              CREATE_TIME, LST_UPD_TIME
       FROM cust_person_realname_info
       WHERE CUST_ID = ?
       LIMIT 1`,
      [custId]
    );

    if (rows.length > 0) {
      const r = rows[0];
      base.freshness.realnameTable = {
        createTime: formatDate(r.CREATE_TIME),
        lastUpdateTime: formatDate(r.LST_UPD_TIME),
      };
      return {
        ...base,
        personal: {
          name: r.NAME,
          enName: r.EN_NAME,
          certType: r.CERT_TYPE,
          certNo: r.CERT_NO,
          residenceAddress: r.RESIDENCE_ADDRESS,
        },
        enterprise: null,
      };
    }

    return { ...base, personal: null, enterprise: null };
  }

  if (custType === "COMPANY") {
    const rows = await query<EnterpriseRealnameRow[]>(
      `SELECT ENTERPRISE_NAME, EN_NAME, CERT_NO, LEGAL_PERSON_NAME,
              BUSINESS_STATUS, CREATE_TIME, LST_UPD_TIME
       FROM cust_enterprise_realname_info
       WHERE CUST_ID = ?
       LIMIT 1`,
      [custId]
    );

    if (rows.length > 0) {
      const r = rows[0];
      base.freshness.realnameTable = {
        createTime: formatDate(r.CREATE_TIME),
        lastUpdateTime: formatDate(r.LST_UPD_TIME),
      };
      return {
        ...base,
        personal: null,
        enterprise: {
          enterpriseName: r.ENTERPRISE_NAME,
          enName: r.EN_NAME,
          certNo: r.CERT_NO,
          legalPersonName: r.LEGAL_PERSON_NAME,
          businessStatus: r.BUSINESS_STATUS,
        },
      };
    }

    return { ...base, personal: null, enterprise: null };
  }

  return { ...base, personal: null, enterprise: null };
}
