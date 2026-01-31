const { Pool } = require('pg');

// Configuration de la base de données
const databaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'event_planner_payments',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

async function initPaymentDatabase() {
  const pool = new Pool(databaseConfig);
  
  try {
    console.log('🔧 Initialisation de la base de données Payment Service...');
    
    // Créer la table payments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        transaction_id VARCHAR(255) UNIQUE,
        amount INTEGER NOT NULL,
        currency VARCHAR(3) DEFAULT 'EUR',
        status VARCHAR(50) DEFAULT 'pending',
        gateway VARCHAR(50),
        customer_email VARCHAR(255),
        description TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Créer la table gateways
    await pool.query(`
      CREATE TABLE IF NOT EXISTS gateways (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE,
        name VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        config JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Insérer des gateways de test
    await pool.query(`
      INSERT INTO gateways (code, name, is_active, config) 
      VALUES 
        ('stripe', 'Stripe', true, '{"test_mode": true}'),
        ('paypal', 'PayPal', true, '{"sandbox": true}')
      ON CONFLICT (code) DO NOTHING
    `);
    
    console.log('✅ Base de données Payment Service initialisée avec succès');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error.message);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  initPaymentDatabase();
}

module.exports = initPaymentDatabase;
