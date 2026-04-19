const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const REQUIRED_TABLES = [
  'payments',
  'payment_methods',
  'payment_gateways',
  'commissions',
  'refunds',
  'wallets',
  'withdrawals',
];

const REQUIRED_GATEWAY_CODES = ['stripe', 'paypal', 'orange_money', 'mtn_momo'];

const createConnection = (database) => {
  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
};

class DatabaseBootstrap {
  constructor() {
    this.migrationsPath = path.join(__dirname, '../database/migrations');
  }

  async inspectReadiness(client) {
    const tablesResult = await client.query(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ANY($1::text[])`,
      [REQUIRED_TABLES],
    );

    const presentTables = new Set(tablesResult.rows.map((row) => row.table_name));
    const missingTables = REQUIRED_TABLES.filter((tableName) => !presentTables.has(tableName));

    let missingGatewayCodes = [...REQUIRED_GATEWAY_CODES];

    if (!missingTables.includes('payment_gateways')) {
      const gatewayResult = await client.query(
        `SELECT code
           FROM payment_gateways
          WHERE code = ANY($1::text[])`,
        [REQUIRED_GATEWAY_CODES],
      );

      const presentGatewayCodes = new Set(
        gatewayResult.rows.map((row) => String(row.code || '').trim().toLowerCase()),
      );

      missingGatewayCodes = REQUIRED_GATEWAY_CODES.filter(
        (code) => !presentGatewayCodes.has(code),
      );
    }

    return {
      missingTables,
      missingGatewayCodes,
      ready: missingTables.length === 0 && missingGatewayCodes.length === 0,
    };
  }

  async ensureDatabaseExists() {
    const databaseName = process.env.DB_NAME || 'event_planner_payments';
    const tempPool = createConnection('postgres');
    const client = await tempPool.connect();

    try {
      const result = await client.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [databaseName],
      );

      if (result.rows.length === 0) {
        await client.query(`CREATE DATABASE "${databaseName}"`);
        console.log(`Payment database created: ${databaseName}`);
      } else {
        console.log(`Payment database already exists: ${databaseName}`);
      }
    } finally {
      client.release();
      await tempPool.end();
    }
  }

  async initialize() {
    await this.ensureDatabaseExists();

    const databaseName = process.env.DB_NAME || 'event_planner_payments';
    const pool = createConnection(databaseName);
    const client = await pool.connect();

    try {
      const autoBootstrapEnabled = process.env.DB_AUTO_BOOTSTRAP === 'true';
      const readiness = await this.inspectReadiness(client);

      if (!autoBootstrapEnabled && readiness.ready) {
        console.log('Payment schema already ready; automatic bootstrap remains disabled.');
        return { success: true, message: 'Bootstrap skipped because schema is already ready.' };
      }

      if (!autoBootstrapEnabled && !readiness.ready) {
        console.warn(
          `DB_AUTO_BOOTSTRAP=false but payment schema is incomplete. Missing tables: ${
            readiness.missingTables.join(', ') || 'none'
          }. Missing gateways: ${
            readiness.missingGatewayCodes.join(', ') || 'none'
          }. Applying bootstrap to restore service readiness.`,
        );
      }

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
        .filter((file) => file.endsWith('.sql'))
        .sort();

      for (const file of files) {
        const migrationPath = path.join(this.migrationsPath, file);
        const sql = await fs.readFile(migrationPath, 'utf8');
        const checksum = crypto.createHash('sha256').update(sql).digest('hex');

        const applied = await client.query(
          'SELECT 1 FROM schema_migrations WHERE migration_name = $1',
          [file],
        );

        if (applied.rows.length > 0) {
          continue;
        }

        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (migration_name, checksum, file_size, execution_time_ms) VALUES ($1, $2, $3, $4)',
          [file, checksum, Buffer.byteLength(sql, 'utf8'), 0],
        );
        console.log(`Payment migration applied: ${file}`);
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
