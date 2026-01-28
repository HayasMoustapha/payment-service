#!/usr/bin/env node

// Load environment variables first
require('dotenv').config();

// Diagnostic script for payment service
const logger = require('./src/utils/logger');

async function diagnoseService() {
  console.log('🔍 Payment Service Diagnostic Tool');
  console.log('==================================');
  
  // Test 1: Database Connection
  console.log('\n1. Testing Database Connection...');
  try {
    const { database } = require('./src/config');
    const result = await database.query('SELECT 1 as test');
    console.log('✅ Database connection: OK');
    console.log(`   Query result: ${JSON.stringify(result.rows[0])}`);
  } catch (error) {
    console.log('❌ Database connection: FAILED');
    console.log(`   Error: ${error.message}`);
  }
  
  // Test 2: Stripe Service
  console.log('\n2. Testing Stripe Service...');
  try {
    const stripeService = require('./src/core/stripe/stripe.service');
    console.log('✅ Stripe service: Loaded');
    
    // Test health check
    const health = await stripeService.healthCheck();
    console.log(`   Health check: ${health.success ? 'OK' : 'FAILED'}`);
    if (!health.success) {
      console.log(`   Error: ${health.error}`);
    }
  } catch (error) {
    console.log('❌ Stripe service: FAILED');
    console.log(`   Error: ${error.message}`);
  }
  
  // Test 3: PayPal Service
  console.log('\n3. Testing PayPal Service...');
  try {
    const paypalService = require('./src/core/paypal/paypal.service');
    console.log('✅ PayPal service: Loaded');
    
    // Test health check
    const health = await paypalService.healthCheck();
    console.log(`   Health check: ${health.success ? 'OK' : 'FAILED'}`);
    if (!health.success) {
      console.log(`   Error: ${health.error}`);
    }
  } catch (error) {
    console.log('❌ PayPal service: FAILED');
    console.log(`   Error: ${error.message}`);
  }
  
  // Test 4: Payment Service
  console.log('\n4. Testing Payment Service...');
  try {
    const paymentService = require('./src/core/payments/payment.service');
    console.log('✅ Payment service: Loaded');
    
    // Test initialization
    await paymentService.initialize();
    console.log('   Initialization: OK');
    
    // Test statistics
    const stats = await paymentService.getStatistics({});
    console.log(`   Statistics query: ${stats.transactions ? 'OK' : 'FAILED'}`);
    if (stats.transactions) {
      console.log(`   Found ${stats.transactions.length} transaction records`);
    }
  } catch (error) {
    console.log('❌ Payment service: FAILED');
    console.log(`   Error: ${error.message}`);
    console.log(`   Stack: ${error.stack}`);
  }
  
  // Test 5: Validation Middleware
  console.log('\n5. Testing Validation Middleware...');
  try {
    const { ValidationMiddleware } = require('../../shared');
    console.log('✅ Validation middleware: Loaded');
    
    // Test basic validation
    const Joi = require('joi');
    const testSchema = Joi.object({
      test: Joi.string().required()
    });
    
    console.log('   Schema creation: OK');
  } catch (error) {
    console.log('❌ Validation middleware: FAILED');
    console.log(`   Error: ${error.message}`);
  }
  
  // Test 6: Environment Variables
  console.log('\n6. Checking Environment Variables...');
  const requiredEnvVars = [
    'DB_HOST',
    'DB_NAME',
    'STRIPE_SECRET_KEY',
    'PAYPAL_CLIENT_ID',
    'PAYPAL_CLIENT_SECRET'
  ];
  
  requiredEnvVars.forEach(envVar => {
    const value = process.env[envVar];
    if (value) {
      console.log(`✅ ${envVar}: Set (${value.substring(0, 10)}...)`);
    } else {
      console.log(`❌ ${envVar}: Missing`);
    }
  });
  
  console.log('\n🏁 Diagnostic Complete');
}

// Run diagnostic
if (require.main === module) {
  diagnoseService().catch(console.error);
}

module.exports = { diagnoseService };
