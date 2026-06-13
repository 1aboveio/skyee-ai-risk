/**
 * Simple Presto HTTP client for querying dim_forex in the data warehouse.
 *
 * Connection: http://172.16.100.213:9666 (catalog: hive, schema: usr_skyee_mw)
 */

const PRESTO_URL = process.env.PRESTO_URL ?? "http://172.16.100.213:9666";
const PRESTO_CATALOG = process.env.PRESTO_CATALOG ?? "hive";
const PRESTO_SCHEMA = process.env.PRESTO_SCHEMA ?? "usr_skyee_mw";

export interface PrestoRow {
  currency_code: string;
  rate_date: string;
  exchange_rate: string;
}

interface PrestoQueryResult {
  id: string;
  infoUri: string;
  columns?: Array<{ name: string; type: string }>;
  data?: unknown[][];
  error?: { message: string; errorCode: number };
  stats: { state: string };
  nextUri?: string;
}

/**
 * Execute a Presto query and return rows.
 * Polls the async result endpoint until the query finishes.
 *
 * Presto HTTP API does not support parameterized queries (`?` placeholders),
 * so we inline values using `escapePrestoString()` after upstream validation.
 */
const MAX_POLL_ITERATIONS = 60;
const POLL_INTERVAL_MS = 500;

export async function queryDimForex(
  currencyCode: string,
  startDate: string,
  endDate: string
): Promise<PrestoRow[]> {
  // Presto HTTP API doesn't support placeholders — inline values with escaping
  const sql = `
    SELECT currency_code, rate_date, exchange_rate
    FROM dim_forex
    WHERE base_currency = 'USD'
      AND currency_code = '${escapePrestoString(currencyCode)}'
      AND rate_date BETWEEN DATE '${startDate}' AND DATE '${endDate}'
    ORDER BY rate_date ASC
  `;

  const response = await fetch(`${PRESTO_URL}/v1/statement`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      "X-Presto-Catalog": PRESTO_CATALOG,
      "X-Presto-Schema": PRESTO_SCHEMA,
      "X-Presto-User": "graph-demo",
    },
    body: sql,
  });

  if (!response.ok) {
    throw new Error(
      `Presto query failed: ${response.status} ${response.statusText}`
    );
  }

  let result: PrestoQueryResult = await response.json();

  // Poll for results with timeout safeguard
  const allRows: unknown[][] = [];
  let pollCount = 0;
  while (result.nextUri) {
    if (result.error) {
      throw new Error(`Presto error: ${result.error.message}`);
    }
    if (result.data) {
      allRows.push(...result.data);
    }

    pollCount++;
    if (pollCount >= MAX_POLL_ITERATIONS) {
      throw new Error(
        `Presto query timed out after ${MAX_POLL_ITERATIONS} poll iterations`
      );
    }

    await sleep(POLL_INTERVAL_MS);
    const nextResponse = await fetch(result.nextUri);
    if (!nextResponse.ok) {
      throw new Error(
        `Presto poll failed: ${nextResponse.status} ${nextResponse.statusText}`
      );
    }
    result = await nextResponse.json();
  }

  // Collect final batch
  if (result.error) {
    throw new Error(`Presto error: ${result.error.message}`);
  }
  if (result.data) {
    allRows.push(...result.data);
  }

  return allRows.map((row) => ({
    currency_code: String(row[0]),
    rate_date: String(row[1]),
    exchange_rate: String(row[2]),
  }));
}

function escapePrestoString(value: string): string {
  return value.replace(/'/g, "''");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
