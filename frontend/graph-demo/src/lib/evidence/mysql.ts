import mysql from "mysql2/promise";

const connectionUrl =
  process.env.SOURCE_EVIDENCE_MYSQL_URL ??
  "mysql://root:root@localhost:3306/usr_skyee_mw";

let pool: mysql.Pool | null = null;

function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      uri: connectionUrl,
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
  params?: unknown[]
): Promise<T> {
  const [rows] = await getPool().execute<T>(sql, params);
  return rows;
}

/**
 * Graceful shutdown — call during SIGTERM / process exit.
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// Register shutdown hooks once
let hooksRegistered = false;

function registerShutdownHooks() {
  if (hooksRegistered) return;
  hooksRegistered = true;

  const shutdown = async () => {
    await closePool();
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

registerShutdownHooks();
