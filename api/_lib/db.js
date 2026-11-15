// Acces la baza de date. In productie: Neon (HTTP). Local, pentru teste: pg.
let runner;

async function getRunner() {
  if (runner) return runner;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL lipseste');
  if (process.env.PG_LOCAL) {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: url });
    runner = async (text, params) => (await pool.query(text, params)).rows;
  } else {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(url);
    runner = (text, params) => sql.query(text, params);
  }
  return runner;
}

export async function q(text, params = []) {
  const run = await getRunner();
  return run(text, params);
}
