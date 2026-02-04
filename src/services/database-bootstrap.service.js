const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const createConnection = (database) => {
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  });
};

class DatabaseBootstrap {
  constructor() {
    this.migrationsPath = path.join(__dirname, '../database/migrations');
  }

  async ensureDatabaseExists() {
    const databaseName = process.env.DB_NAME || 'event_planner_payments';
    const tempPool = createConnection('postgres');
    const client = await tempPool.connect();

    try {
      const result = await client.query(
        `SELECT 1 FROM pg_database WHERE datname = $1`,
        [databaseName]
      );

      if (result.rows.length === 0) {
        await client.query(`CREATE DATABASE "${databaseName}"`);
        console.log(`✅ Base de données ${databaseName} créée`);
      } else {
        console.log(`ℹ️  Base de données ${databaseName} déjà existante`);
      }
    } finally {
      client.release();
      await tempPool.end();
    }
  }

  async initialize() {
    if (process.env.DB_AUTO_BOOTSTRAP !== 'true') {
      console.log('⚠️  Bootstrap automatique désactivé (DB_AUTO_BOOTSTRAP != true)');
      return { success: true, message: 'Bootstrap désactivé' };
    }

    await this.ensureDatabaseExists();

    const databaseName = process.env.DB_NAME || 'event_planner_payments';
    const pool = createConnection(databaseName);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id SERIAL PRIMARY KEY,
          migration_name VARCHAR(255) NOT NULL UNIQUE,
          executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          checksum VARCHAR(64) NOT NULL,
          file_size BIGINT NOT NULL,
          execution_time_ms INTEGER,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      const files = (await fs.readdir(this.migrationsPath))
        .filter(file => file.endsWith('.sql'))
        .sort();

      for (const file of files) {
        const migrationPath = path.join(this.migrationsPath, file);
        const sql = await fs.readFile(migrationPath, 'utf8');
        const checksum = crypto.createHash('sha256').update(sql).digest('hex');

        const applied = await client.query(
          'SELECT 1 FROM schema_migrations WHERE migration_name = $1',
          [file]
        );

        if (applied.rows.length > 0) {
          continue;
        }

        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (migration_name, checksum, file_size, execution_time_ms) VALUES ($1, $2, $3, $4)',
          [file, checksum, Buffer.byteLength(sql, 'utf8'), 0]
        );
        console.log(`✅ Migration appliquée: ${file}`);
      }

      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
      await pool.end();
    }
  }
}

module.exports = new DatabaseBootstrap();
