// Base PostgreSQL de test : stub Supabase + migration du projet, sur une base neuve.
// Serveur : variable MS_PG (ex. postgres://postgres@127.0.0.1:54329). Sans elle, les tests
// qui en ont besoin sont ignorés.
import pg from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
export const PG_URL = process.env.MS_PG || '';

export function migrationSQL() {
  const dir = join(ROOT, 'supabase/migrations');
  return readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
}

export async function freshDatabase(name) {
  const admin = new pg.Client({ connectionString: PG_URL });
  await admin.connect();
  await admin.query(`select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()`, [name]);
  await admin.query(`drop database if exists ${name}`);
  await admin.query(`create database ${name}`);
  await admin.end();
  const url = PG_URL.replace(/\/[^/]*$/, '') + '/' + name;
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  await db.query(readFileSync(join(ROOT, 'tests/stack/supabase-stub.sql'), 'utf8'));
  await db.query(migrationSQL());
  return { db, url };
}

// Exécute fn(client) avec le rôle et l'identité d'un utilisateur, comme PostgREST.
export async function as(db, role, sub, fn) {
  await db.query('begin');
  try {
    await db.query(`select set_config('role', $1, true), set_config('request.jwt.claims', $2, true)`, [role, JSON.stringify(sub ? { sub, role } : { role })]);
    const out = await fn(db);
    await db.query('commit');
    return out;
  } catch (e) {
    await db.query('rollback');
    throw e;
  }
}
