import mysql, { type ExecuteValues } from "mysql2/promise";

function getConnectionUrl(): string {
  const url = process.env.SOURCE_EVIDENCE_MYSQL_URL;
  if (!url) {
    throw new Error(
      "SOURCE_EVIDENCE_MYSQL_URL environment variable is required."
    );
  }
  return url;
}

let pool: mysql.Pool | null = null;

function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      uri: getConnectionUrl(),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
  }
  return pool;
}

/**
 * Execute a read-only query against the Source Evidence MySQL database.
 * Use only for SELECT queries — writes go through Spark ETL.
 */
export async function query<T extends mysql.RowDataPacket[]>(
  sql: string,
  params?: ExecuteValues
): Promise<T> {
  const [rows] = await getPool().execute<T>(sql, params);
  return rows;
}

/**
 * Graceful shutdown — call explicitly when the pool is no longer needed.
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
