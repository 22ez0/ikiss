import pkg from "pg";
const { Pool } = pkg;

export interface RpcRow {
  iconUrl?: string;
  statusType: "playing" | "watching" | "streaming";
  title: string;
  subtitle: string;
  detail: string;
  customUrl: string;
  buttonLabel?: string;
  buttonUrl?: string;
}

export interface DbUser {
  user_id: string;
  token?: string;
  rpc?: RpcRow;
}

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const INITIAL_ALLOWED_IDS = [
  "1495245938116005908",
  "1499585365328134247",
  "1424456058012696769",
];

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      user_id TEXT PRIMARY KEY,
      token   TEXT,
      rpc     JSONB,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log("[db] user_sessions pronta");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_allowed_users (
      user_id  TEXT PRIMARY KEY,
      added_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  for (const id of INITIAL_ALLOWED_IDS) {
    await pool.query(
      `INSERT INTO email_allowed_users (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [id]
    );
  }
  console.log("[db] email_allowed_users pronta");
}

export async function getEmailAllowedUsers(): Promise<Set<string>> {
  const res = await pool.query("SELECT user_id FROM email_allowed_users");
  return new Set(res.rows.map((r: any) => r.user_id as string));
}

export async function addEmailAllowedUser(userId: string): Promise<void> {
  await pool.query(
    `INSERT INTO email_allowed_users (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
    [userId]
  );
}

export async function removeEmailAllowedUser(userId: string): Promise<void> {
  await pool.query("DELETE FROM email_allowed_users WHERE user_id = $1", [userId]);
}

export async function loadAllUsers(): Promise<DbUser[]> {
  const res = await pool.query(
    "SELECT user_id, token, rpc FROM user_sessions WHERE token IS NOT NULL"
  );
  return res.rows.map((r) => ({
    user_id: r.user_id,
    token: r.token ?? undefined,
    rpc: r.rpc ?? undefined,
  }));
}

export async function dbSetToken(userId: string, token: string): Promise<void> {
  await pool.query(
    `INSERT INTO user_sessions (user_id, token, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id) DO UPDATE SET token = $2, updated_at = NOW()`,
    [userId, token]
  );
}

export async function dbSetRpc(userId: string, rpc: RpcRow): Promise<void> {
  await pool.query(
    `INSERT INTO user_sessions (user_id, rpc, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (user_id) DO UPDATE SET rpc = $2::jsonb, updated_at = NOW()`,
    [userId, JSON.stringify(rpc)]
  );
}

export async function dbClearRpc(userId: string): Promise<void> {
  await pool.query(
    "UPDATE user_sessions SET rpc = NULL, updated_at = NOW() WHERE user_id = $1",
    [userId]
  );
}
