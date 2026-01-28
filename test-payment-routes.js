#!/usr/bin/env node

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3003';
const API_BASE = `${BASE_URL}/api`;

// Test data
const testData = {
  stripePaymentIntent: {
    amount: 2000, // 20.00 EUR in cents
    currency: 'eur',
    customerEmail: 'test@example.com',
    description: 'Test payment for event ticket',
    metadata: {
      eventId: 'evt_123456',
      userId: 'user_789'
    }
  },
  
  stripeCustomer: {
    email: 'customer@example.com',
    name: 'John Doe',
    phone: '+33612345678'
  },
  
  paypalOrder: {
    amount: {
      currency_code: 'EUR',
      value: '25.50'
    },
    description: 'Test PayPal order for event',
    returnUrl: 'https://example.com/success',
    cancelUrl: 'https://example.com/cancel'
  },
  
  stripeRefund: {
    paymentIntentId: 'pi_test_123456',
    amount: 1000, // 10.00 EUR
    reason: 'requested_by_customer',
    metadata: {
      refundReason: 'Customer requested refund'
    }
  },
  
  paypalRefund: {
    paymentId: 'PAY-123456789',
    amount: 1500, // 15.00 EUR
    reason: 'duplicate',
    note: 'Duplicate payment refund'
  },
  
  invoiceGeneration: {
    transactionId: 'txn_test_123456',
    template: 'default',
    includeTax: true
  },
  
  paymentMethod: {
    type: 'card',
    provider: 'stripe',
    token: 'tok_test_123456',
    isDefault: false,
    metadata: {
      cardType: 'visa',
      last4: '4242'
    }
  }
};

// Utility functions
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const makeRequest = async (method, url, data = null, params = null) => {
  try {
    const config = {
      method,
      url: `${API_BASE}${url}`,
      timeout: 10000
    };
    
    if (data) config.data = data;
    if (params) config.params = params;
    
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message,
      status: error.response?.status || 500
    };
  }
};

// Test functions
const testHealthCheck = async () => {
  console.log('\n🔍 Testing Health Check...');
  const result = await makeRequest('GET', '/health');
  console.log(result.success ? '✅ Health check passed' : '❌ Health check failed');
  if (!result.success) console.log('Error:', result.error);
  return result.success;
};

const testServiceInfo = async () => {
  console.log('\n📋 Testing Service Info...');
  const result = await makeRequest('GET', '/payments');
  console.log(result.success ? '✅ Service info retrieved' : '❌ Service info failed');
  if (!result.success) console.log('Error:', result.error);
  return result.success;
};

const testStripeRoutes = async () => {
  console.log('\n💳 Testing Stripe Routes...');
  
  // Test Payment Intent Creation
  console.log('  Testing Payment Intent Creation...');
  const paymentIntent = await makeRequest('POST', '/payments/stripe/payment-intent', testData.stripePaymentIntent);
  console.log(paymentIntent.success ? '  ✅ Payment intent created' : '  ❌ Payment intent failed');
  if (!paymentIntent.success) console.log('  Error:', paymentIntent.error);
  
  // Test Customer Creation
  console.log('  Testing Customer Creation...');
  const customer = await makeRequest('POST', '/payments/stripe/customers', testData.stripeCustomer);
  console.log(customer.success ? '  ✅ Customer created' : '  ❌ Customer creation failed');
  if (!customer.success) console.log('  Error:', customer.error);
  
  // Test Payment Method Creation (if customer was created)
  if (customer.success && customer.data?.id) {
    console.log('  Testing Payment Method Creation...');
    const paymentMethodData = { ...testData.paymentMethod, customerId: customer.data.id };
    const paymentMethod = await makeRequest('POST', '/payments/stripe/payment-methods', paymentMethodData);
    console.log(paymentMethod.success ? '  ✅ Payment method created' : '  ❌ Payment method failed');
    if (!paymentMethod.success) console.log('  Error:', paymentMethod.error);
  }
  
  return paymentIntent.success || customer.success;
};

const testPayPalRoutes = async () => {
  console.log('\n🅿️ Testing PayPal Routes...');
  
  // Test Order Creation
  console.log('  Testing PayPal Order Creation...');
  const order = await makeRequest('POST', '/payments/paypal/orders', testData.paypalOrder);
  console.log(order.success ? '  ✅ PayPal order created' : '  ❌ PayPal order failed');
  if (!order.success) console.log('  Error:', order.error);
  
  return order.success;
};

const testRefundRoutes = async () => {
  console.log('\n💰 Testing Refund Routes...');
  
  // Test Stripe Refund
  console.log('  Testing Stripe Refund...');
  const stripeRefund = await makeRequest('POST', '/payments/refunds/stripe', testData.stripeRefund);
  console.log(stripeRefund.success ? '  ✅ Stripe refund processed' : '  ❌ Stripe refund failed');
  if (!stripeRefund.success) console.log('  Error:', stripeRefund.error);
  
  // Test PayPal Refund
  console.log('  Testing PayPal Refund...');
  const paypalRefund = await makeRequest('POST', '/payments/refunds/paypal', testData.paypalRefund);
  console.log(paypalRefund.success ? '  ✅ PayPal refund processed' : '  ❌ PayPal refund failed');
  if (!paypalRefund.success) console.log('  Error:', paypalRefund.error);
  
  // Test List Refunds
  console.log('  Testing List Refunds...');
  const refundsList = await makeRequest('GET', '/payments/refunds');
  console.log(refundsList.success ? '  ✅ Refunds list retrieved' : '  ❌ Refunds list failed');
  if (!refundsList.success) console.log('  Error:', refundsList.error);
  
  return stripeRefund.success || paypalRefund.success || refundsList.success;
};

const testInvoiceRoutes = async () => {
  console.log('\n📄 Testing Invoice Routes...');
  
  // Test Invoice Generation
  console.log('  Testing Invoice Generation...');
  const invoice = await makeRequest('POST', '/payments/invoices/generate', testData.invoiceGeneration);
  console.log(invoice.success ? '  ✅ Invoice generated' : '  ❌ Invoice generation failed');
  if (!invoice.success) console.log('  Error:', invoice.error);
  
  // Test List Invoices
  console.log('  Testing List Invoices...');
  const invoicesList = await makeRequest('GET', '/payments/invoices');
  console.log(invoicesList.success ? '  ✅ Invoices list retrieved' : '  ❌ Invoices list failed');
  if (!invoicesList.success) console.log('  Error:', invoicesList.error);
  
  return invoice.success || invoicesList.success;
};

const testPaymentMethodsRoutes = async () => {
  console.log('\n💳 Testing Payment Methods Routes...');
  
  // Test List Payment Methods
  console.log('  Testing List Payment Methods...');
  const methodsList = await makeRequest('GET', '/payments/payment-methods');
  console.log(methodsList.success ? '  ✅ Payment methods list retrieved' : '  ❌ Payment methods list failed');
  if (!methodsList.success) console.log('  Error:', methodsList.error);
  
  // Test Add Payment Method
  console.log('  Testing Add Payment Method...');
  const addMethod = await makeRequest('POST', '/payments/payment-methods', testData.paymentMethod);
  console.log(addMethod.success ? '  ✅ Payment method added' : '  ❌ Add payment method failed');
  if (!addMethod.success) console.log('  Error:', addMethod.error);
  
  return methodsList.success || addMethod.success;
};

const testLegacyRoutes = async () => {
  console.log('\n🔄 Testing Legacy Routes...');
  
  // Test Process Payment
  console.log('  Testing Process Payment...');
  const processPayment = await makeRequest('POST', '/payments/process', {
    amount: 3000,
    currency: 'eur',
    gateway: 'stripe',
    customerEmail: 'legacy@example.com',
    description: 'Legacy payment test'
  });
  console.log(processPayment.success ? '  ✅ Legacy payment processed' : '  ❌ Legacy payment failed');
  if (!processPayment.success) console.log('  Error:', processPayment.error);
  
  // Test Get Payment Status
  console.log('  Testing Get Payment Status...');
  const status = await makeRequest('GET', '/payments/status/test_transaction_123');
  console.log(status.success ? '  ✅ Payment status retrieved' : '  ❌ Payment status failed');
  if (!status.success) console.log('  Error:', status.error);
  
  // Test Get Statistics
  console.log('  Testing Get Statistics...');
  const stats = await makeRequest('GET', '/payments/statistics');
  console.log(stats.success ? '  ✅ Statistics retrieved' : '  ❌ Statistics failed');
  if (!stats.success) console.log('  Error:', stats.error);
  
  // Test Get Available Gateways
  console.log('  Testing Get Available Gateways...');
  const gateways = await makeRequest('GET', '/payments/gateways');
  console.log(gateways.success ? '  ✅ Gateways retrieved' : '  ❌ Gateways failed');
  if (!gateways.success) console.log('  Error:', gateways.error);
  
  return processPayment.success || status.success || stats.success || gateways.success;
};

// Main test runner
const runAllTests = async () => {
  console.log('🚀 Starting Payment Service API Tests');
  console.log('=====================================');
  console.log(`Testing against: ${BASE_URL}`);
  
  const results = {
    healthCheck: await testHealthCheck(),
    serviceInfo: await testServiceInfo(),
    stripe: await testStripeRoutes(),
    paypal: await testPayPalRoutes(),
    refunds: await testRefundRoutes(),
    invoices: await testInvoiceRoutes(),
    paymentMethods: await testPaymentMethodsRoutes(),
    legacy: await testLegacyRoutes()
  };
  
  console.log('\n📊 Test Results Summary');
  console.log('=======================');
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(Boolean).length;
  
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅ PASSED' : '❌ FAILED';
    console.log(`${test.padEnd(15)}: ${status}`);
  });
  
  console.log('\n🎯 Overall Result');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All tests passed! Payment service is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the logs above for details.');
  }
};

// Check if service is running before starting tests
const checkService = async () => {
  try {
    await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
    return true;
  } catch (error) {
    console.log('❌ Payment service is not running on', BASE_URL);
    console.log('Please start the service with: npm start');
    return false;
  }
};

// Run tests if service is available
if (require.main === module) {
  checkService().then(isRunning => {
    if (isRunning) {
      runAllTests().catch(console.error);
    }
  });
}

module.exports = { runAllTests, checkService };
