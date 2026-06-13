import { query } from "./mysql";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SignalSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export interface RiskSignal {
  signalType: string;
  label: string;
  value: string;
  severity: SignalSeverity;
  source: string;
  timestamp: string | null;
}

// ---------------------------------------------------------------------------
// MySQL row type
// ---------------------------------------------------------------------------

interface RiskFieldsRow {
  RISK_LEVEL: string | null;
  RISK_SCORE: number | null;
  HIGH_RISK: string | number | null;
  SANCTIONED: string | number | null;
  LAST_RISK_SCAN_DESC: string | null;
  FROZEN_REASON: string | null;
  CUST_LABEL: string | null;
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

function isTruthy(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return value !== 0;
  return value === "1" || value.toUpperCase() === "Y" || value.toUpperCase() === "TRUE";
}

function riskLevelSeverity(level: string | null): SignalSeverity {
  switch (level?.toUpperCase()) {
    case "VERY_HIGH":
    case "CRITICAL":
      return "CRITICAL";
    case "HIGH":
      return "HIGH";
    case "MEDIUM":
      return "MEDIUM";
    case "LOW":
      return "LOW";
    default:
      return "INFO";
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export async function getRiskSignals(custId: string): Promise<RiskSignal[]> {
  const rows = await query<RiskFieldsRow[]>(
    `SELECT RISK_LEVEL, RISK_SCORE, HIGH_RISK, SANCTIONED,
            LAST_RISK_SCAN_DESC, FROZEN_REASON, CUST_LABEL,
            LST_UPD_TIME
     FROM cust_customer_info
     WHERE CUST_ID = ?
     LIMIT 1`,
    [custId]
  );

  if (rows.length === 0) return [];

  const row = rows[0];
  const timestamp = formatDate(row.LST_UPD_TIME);
  const signals: RiskSignal[] = [];

  // Risk Level
  if (row.RISK_LEVEL) {
    signals.push({
      signalType: "RISK_LEVEL",
      label: "Risk Level",
      value: row.RISK_LEVEL,
      severity: riskLevelSeverity(row.RISK_LEVEL),
      source: "cust_customer_info.RISK_LEVEL",
      timestamp,
    });
  }

  // Risk Score
  if (row.RISK_SCORE !== null && row.RISK_SCORE !== undefined) {
    const score = row.RISK_SCORE;
    signals.push({
      signalType: "RISK_SCORE",
      label: "Risk Score",
      value: String(score),
      severity: score >= 80 ? "CRITICAL" : score >= 60 ? "HIGH" : score >= 40 ? "MEDIUM" : "LOW",
      source: "cust_customer_info.RISK_SCORE",
      timestamp,
    });
  }

  // High Risk flag
  if (isTruthy(row.HIGH_RISK)) {
    signals.push({
      signalType: "HIGH_RISK",
      label: "High Risk Flag",
      value: "Yes",
      severity: "HIGH",
      source: "cust_customer_info.HIGH_RISK",
      timestamp,
    });
  }

  // Sanctioned
  if (isTruthy(row.SANCTIONED)) {
    signals.push({
      signalType: "SANCTIONED",
      label: "Sanctioned",
      value: "Yes",
      severity: "CRITICAL",
      source: "cust_customer_info.SANCTIONED",
      timestamp,
    });
  }

  // Last Risk Scan Description
  if (row.LAST_RISK_SCAN_DESC) {
    signals.push({
      signalType: "RISK_SCAN_DESC",
      label: "Last Risk Scan",
      value: row.LAST_RISK_SCAN_DESC,
      severity: "INFO",
      source: "cust_customer_info.LAST_RISK_SCAN_DESC",
      timestamp,
    });
  }

  // Frozen Reason
  if (row.FROZEN_REASON) {
    signals.push({
      signalType: "FROZEN_REASON",
      label: "Account Frozen",
      value: row.FROZEN_REASON,
      severity: "HIGH",
      source: "cust_customer_info.FROZEN_REASON",
      timestamp,
    });
  }

  // Customer Labels
  if (row.CUST_LABEL) {
    signals.push({
      signalType: "CUST_LABEL",
      label: "Customer Labels",
      value: row.CUST_LABEL,
      severity: "INFO",
      source: "cust_customer_info.CUST_LABEL",
      timestamp,
    });
  }

  return signals;
}
