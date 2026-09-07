import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { env } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, 'migrations');

async function createMigration(name: string): Promise<void> {
  const slug = name.trim().toLowerCase().replace(/\s+/g, '-');
  const fileName = `${Date.now()}_${slug}.sql`;
  const filePath = path.join(migrationsDir, fileName);
  await fs.writeFile(filePath, `-- ${slug}\n`, 'utf8');
  console.log(`Created ${path.relative(process.cwd(), filePath)}`);
}

async function runMigrations(): Promise<void> {
  // multipleStatements is only enabled on this one-off connection (not the
  // app's shared pool in db/pool.ts) since migration files legitimately
  // contain several statements per file, and this script never touches
  // request-supplied input.
  const connection = await mysql.createConnection({
    uri: env.DATABASE_URL,
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
    multipleStatements: true,
  });

  try {
    await connection.query(`
      create table if not exists schema_migrations (
        name varchar(255) primary key,
        applied_at datetime not null default current_timestamp
      )
    `);

    const [appliedRows] = await connection.query<mysql.RowDataPacket[]>('select name from schema_migrations');
    const applied = new Set(appliedRows.map((r) => r.name as string));

    const files = (await fs.readdir(migrationsDir))
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const pending = files.filter((f) => !applied.has(f));
    if (pending.length === 0) {
      console.log('No pending migrations.');
      return;
    }

    for (const file of pending) {
      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
      console.log(`Applying ${file}...`);
      await connection.query(sql);
      await connection.query('insert into schema_migrations (name) values (?)', [file]);
      console.log(`Applied ${file}`);
    }
  } finally {
    await connection.end();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === '--create') {
    const name = args.slice(1).join(' ');
    if (!name) {
      console.error('Usage: migrate --create <migration-name>');
      process.exit(1);
    }
    await createMigration(name);
    return;
  }

  await runMigrations();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
