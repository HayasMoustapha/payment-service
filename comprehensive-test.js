#!/usr/bin/env node

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3003';
const API_BASE = `${BASE_URL}/api`;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Utility functions
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

const makeRequest = async (method, url, data = null, params = null) => {
  try {
    const config = {
      method,
      url: url.startsWith('http') ? url : `${API_BASE}${url}`,
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

// Test data generators
const generateTestData = {
  stripePaymentIntent: () => ({
    amount: Math.floor(Math.random() * 10000) + 1000, // 10-110 EUR in cents
    currency: 'eur',
    customerEmail: `test${Date.now()}@example.com`,
    description: `Test payment for event ${Date.now()}`,
    metadata: {
      eventId: `evt_${Math.random().toString(36).substr(2, 9)}`,
      userId: `user_${Math.random().toString(36).substr(2, 9)}`
    }
  }),
  
  stripeCustomer: () => ({
    email: `customer${Date.now()}@example.com`,
    name: `Test Customer ${Date.now()}`,
    phone: `+336${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`
  }),
  
  paypalOrder: () => ({
    amount: {
      currency_code: 'EUR',
      value: (Math.random() * 100 + 10).toFixed(2)
    },
    description: `Test PayPal order ${Date.now()}`,
    returnUrl: 'https://example.com/success',
    cancelUrl: 'https://example.com/cancel'
  }),
  
  stripeRefund: () => ({
    paymentIntentId: `pi_test_${Math.random().toString(36).substr(2, 9)}`,
    amount: Math.floor(Math.random() * 5000) + 500, // 5-55 EUR
    reason: 'requested_by_customer',
    metadata: {
      refundReason: 'Customer requested refund'
    }
  }),
  
  paypalRefund: () => ({
    paymentId: `PAY-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    amount: Math.floor(Math.random() * 3000) + 300, // 3-33 EUR
    reason: 'duplicate',
    note: 'Duplicate payment refund'
  }),
  
  invoiceGeneration: () => ({
    transactionId: `txn_${Math.random().toString(36).substr(2, 9)}`,
    template: 'default',
    includeTax: true
  }),
  
  paymentMethod: () => ({
    type: 'card',
    provider: 'stripe',
    token: `tok_${Math.random().toString(36).substr(2, 9)}`,
    isDefault: false,
    metadata: {
      cardType: 'visa',
      last4: Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    }
  }),
  
  legacyPayment: () => ({
    amount: Math.floor(Math.random() * 5000) + 1000,
    currency: 'eur',
    gateway: 'stripe',
    customerEmail: `legacy${Date.now()}@example.com`,
    description: 'Legacy payment test'
  })
};

// Test functions by file
const testServerRoutes = async () => {
  log('\n📡 Testing Server Routes (server.js)', 'cyan');
  log('=====================================', 'cyan');
  
  const results = [];
  
  // Test root route
  log('Testing GET /', 'blue');
  const root = await makeRequest('GET', '/');
  results.push({ route: 'GET /', success: root.success, status: root.status });
  log(root.success ? '✅ Root route works' : '❌ Root route failed', root.success ? 'green' : 'red');
  if (!root.success) log(`   Error: ${JSON.stringify(root.error)}`, 'red');
  
  // Test API root route
  log('Testing GET /api', 'blue');
  const apiRoot = await makeRequest('GET', '/api');
  results.push({ route: 'GET /api', success: apiRoot.success, status: apiRoot.status });
  log(apiRoot.success ? '✅ API root works' : '❌ API root failed', apiRoot.success ? 'green' : 'red');
  if (!apiRoot.success) log(`   Error: ${JSON.stringify(apiRoot.error)}`, 'red');
  
  await delay(500);
  return results;
};

const testHealthRoutes = async () => {
  log('\n🏥 Testing Health Routes', 'cyan');
  log('========================', 'cyan');
  
  const results = [];
  
  // Test health route
  log('Testing GET /health', 'blue');
  const health = await makeRequest('GET', '/health');
  results.push({ route: 'GET /health', success: health.success, status: health.status });
  log(health.success ? '✅ Health check works' : '❌ Health check failed', health.success ? 'green' : 'red');
  if (!health.success) log(`   Error: ${JSON.stringify(health.error)}`, 'red');
  
  await delay(500);
  return results;
};

const testPaymentsRoutes = async () => {
  log('\n💳 Testing Payments Routes (payments.routes.js)', 'cyan');
  log('==============================================', 'cyan');
  
  const results = [];
  
  // Test service info
  log('Testing GET /api/payments', 'blue');
  const serviceInfo = await makeRequest('GET', '/payments');
  results.push({ route: 'GET /api/payments', success: serviceInfo.success, status: serviceInfo.status });
  log(serviceInfo.success ? '✅ Service info works' : '❌ Service info failed', serviceInfo.success ? 'green' : 'red');
  if (!serviceInfo.success) log(`   Error: ${JSON.stringify(serviceInfo.error)}`, 'red');
  
  // Test process payment
  log('Testing POST /api/payments/process', 'blue');
  const processPayment = await makeRequest('POST', '/payments/process', generateTestData.legacyPayment());
  results.push({ route: 'POST /api/payments/process', success: processPayment.success, status: processPayment.status });
  log(processPayment.success ? '✅ Process payment works' : '❌ Process payment failed', processPayment.success ? 'green' : 'red');
  if (!processPayment.success) log(`   Error: ${JSON.stringify(processPayment.error)}`, 'red');
  
  // Test purchase template
  log('Testing POST /api/payments/templates/purchase', 'blue');
  const purchaseTemplate = await makeRequest('POST', '/payments/templates/purchase', {
    templateId: `tpl_${Math.random().toString(36).substr(2, 9)}`,
    customerEmail: `template${Date.now()}@example.com`,
    paymentMethod: 'stripe'
  });
  results.push({ route: 'POST /api/payments/templates/purchase', success: purchaseTemplate.success, status: purchaseTemplate.status });
  log(purchaseTemplate.success ? '✅ Purchase template works' : '❌ Purchase template failed', purchaseTemplate.success ? 'green' : 'red');
  if (!purchaseTemplate.success) log(`   Error: ${JSON.stringify(purchaseTemplate.error)}`, 'red');
  
  // Test webhook
  log('Testing POST /api/payments/webhooks/stripe', 'blue');
  const webhook = await makeRequest('POST', '/payments/webhooks/stripe', {
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: `pi_${Math.random().toString(36).substr(2, 9)}`,
        amount: 2000,
        currency: 'eur'
      }
    }
  });
  results.push({ route: 'POST /api/payments/webhooks/stripe', success: webhook.success, status: webhook.status });
  log(webhook.success ? '✅ Webhook works' : '❌ Webhook failed', webhook.success ? 'green' : 'red');
  if (!webhook.success) log(`   Error: ${JSON.stringify(webhook.error)}`, 'red');
  
  // Test payment status
  log('Testing GET /api/payments/status/test123', 'blue');
  const status = await makeRequest('GET', '/payments/status/test123');
  results.push({ route: 'GET /api/payments/status/:id', success: status.success, status: status.status });
  log(status.success ? '✅ Payment status works' : '❌ Payment status failed', status.success ? 'green' : 'red');
  if (!status.success) log(`   Error: ${JSON.stringify(status.error)}`, 'red');
  
  // Test statistics
  log('Testing GET /api/payments/statistics', 'blue');
  const stats = await makeRequest('GET', '/payments/statistics');
  results.push({ route: 'GET /api/payments/statistics', success: stats.success, status: stats.status });
  log(stats.success ? '✅ Statistics works' : '❌ Statistics failed', stats.success ? 'green' : 'red');
  if (!stats.success) log(`   Error: ${JSON.stringify(stats.error)}`, 'red');
  
  // Test gateways
  log('Testing GET /api/payments/gateways', 'blue');
  const gateways = await makeRequest('GET', '/payments/gateways');
  results.push({ route: 'GET /api/payments/gateways', success: gateways.success, status: gateways.status });
  log(gateways.success ? '✅ Gateways works' : '❌ Gateways failed', gateways.success ? 'green' : 'red');
  if (!gateways.success) log(`   Error: ${JSON.stringify(gateways.error)}`, 'red');
  
  await delay(500);
  return results;
};

const testStripeRoutes = async () => {
  log('\n🟡 Testing Stripe Routes (stripe.routes.js)', 'cyan');
  log('==========================================', 'cyan');
  
  const results = [];
  
  // Test payment intent creation
  log('Testing POST /api/payments/stripe/payment-intent', 'blue');
  const paymentIntent = await makeRequest('POST', '/payments/stripe/payment-intent', generateTestData.stripePaymentIntent());
  results.push({ route: 'POST /api/payments/stripe/payment-intent', success: paymentIntent.success, status: paymentIntent.status });
  log(paymentIntent.success ? '✅ Payment intent works' : '❌ Payment intent failed', paymentIntent.success ? 'green' : 'red');
  if (!paymentIntent.success) log(`   Error: ${JSON.stringify(paymentIntent.error)}`, 'red');
  
  // Test customer creation
  log('Testing POST /api/payments/stripe/customers', 'blue');
  const customer = await makeRequest('POST', '/payments/stripe/customers', generateTestData.stripeCustomer());
  results.push({ route: 'POST /api/payments/stripe/customers', success: customer.success, status: customer.status });
  log(customer.success ? '✅ Customer creation works' : '❌ Customer creation failed', customer.success ? 'green' : 'red');
  if (!customer.success) log(`   Error: ${JSON.stringify(customer.error)}`, 'red');
  
  // Test payment method creation
  log('Testing POST /api/payments/stripe/payment-methods', 'blue');
  const paymentMethod = await makeRequest('POST', '/payments/stripe/payment-methods', generateTestData.paymentMethod());
  results.push({ route: 'POST /api/payments/stripe/payment-methods', success: paymentMethod.success, status: paymentMethod.status });
  log(paymentMethod.success ? '✅ Payment method works' : '❌ Payment method failed', paymentMethod.success ? 'green' : 'red');
  if (!paymentMethod.success) log(`   Error: ${JSON.stringify(paymentMethod.error)}`, 'red');
  
  // Test get payment intent
  log('Testing GET /api/payments/stripe/payment-intent/test123', 'blue');
  const getIntent = await makeRequest('GET', '/payments/stripe/payment-intent/test123');
  results.push({ route: 'GET /api/payments/stripe/payment-intent/:id', success: getIntent.success, status: getIntent.status });
  log(getIntent.success ? '✅ Get payment intent works' : '❌ Get payment intent failed', getIntent.success ? 'green' : 'red');
  if (!getIntent.success) log(`   Error: ${JSON.stringify(getIntent.error)}`, 'red');
  
  // Test confirm payment
  log('Testing POST /api/payments/stripe/confirm', 'blue');
  const confirm = await makeRequest('POST', '/payments/stripe/confirm', {
    paymentIntentId: `pi_test_${Math.random().toString(36).substr(2, 9)}`,
    paymentMethodId: `pm_test_${Math.random().toString(36).substr(2, 9)}`
  });
  results.push({ route: 'POST /api/payments/stripe/confirm', success: confirm.success, status: confirm.status });
  log(confirm.success ? '✅ Confirm payment works' : '❌ Confirm payment failed', confirm.success ? 'green' : 'red');
  if (!confirm.success) log(`   Error: ${JSON.stringify(confirm.error)}`, 'red');
  
  // Test get customer
  log('Testing GET /api/payments/stripe/customers/test123', 'blue');
  const getCustomer = await makeRequest('GET', '/payments/stripe/customers/test123');
  results.push({ route: 'GET /api/payments/stripe/customers/:id', success: getCustomer.success, status: getCustomer.status });
  log(getCustomer.success ? '✅ Get customer works' : '❌ Get customer failed', getCustomer.success ? 'green' : 'red');
  if (!getCustomer.success) log(`   Error: ${JSON.stringify(getCustomer.error)}`, 'red');
  
  // Test get customer payment methods
  log('Testing GET /api/payments/stripe/customers/test123/payment-methods', 'blue');
  const getMethods = await makeRequest('GET', '/payments/stripe/customers/test123/payment-methods');
  results.push({ route: 'GET /api/payments/stripe/customers/:id/payment-methods', success: getMethods.success, status: getMethods.status });
  log(getMethods.success ? '✅ Get customer methods works' : '❌ Get customer methods failed', getMethods.success ? 'green' : 'red');
  if (!getMethods.success) log(`   Error: ${JSON.stringify(getMethods.error)}`, 'red');
  
  await delay(500);
  return results;
};

const testPayPalRoutes = async () => {
  log('\n🅿️ Testing PayPal Routes (paypal.routes.js)', 'cyan');
  log('==========================================', 'cyan');
  
  const results = [];
  
  // Test order creation
  log('Testing POST /api/payments/paypal/orders', 'blue');
  const order = await makeRequest('POST', '/payments/paypal/orders', generateTestData.paypalOrder());
  results.push({ route: 'POST /api/payments/paypal/orders', success: order.success, status: order.status });
  log(order.success ? '✅ PayPal order works' : '❌ PayPal order failed', order.success ? 'green' : 'red');
  if (!order.success) log(`   Error: ${JSON.stringify(order.error)}`, 'red');
  
  // Test get order
  log('Testing GET /api/payments/paypal/orders/test123', 'blue');
  const getOrder = await makeRequest('GET', '/payments/paypal/orders/test123');
  results.push({ route: 'GET /api/payments/paypal/orders/:id', success: getOrder.success, status: getOrder.status });
  log(getOrder.success ? '✅ Get PayPal order works' : '❌ Get PayPal order failed', getOrder.success ? 'green' : 'red');
  if (!getOrder.success) log(`   Error: ${JSON.stringify(getOrder.error)}`, 'red');
  
  // Test capture order
  log('Testing POST /api/payments/paypal/orders/test123/capture', 'blue');
  const capture = await makeRequest('POST', '/payments/paypal/orders/test123/capture', {
    orderId: 'test123',
    amount: {
      currency_code: 'EUR',
      value: '25.50'
    }
  });
  results.push({ route: 'POST /api/payments/paypal/orders/:id/capture', success: capture.success, status: capture.status });
  log(capture.success ? '✅ Capture PayPal order works' : '❌ Capture PayPal order failed', capture.success ? 'green' : 'red');
  if (!capture.success) log(`   Error: ${JSON.stringify(capture.error)}`, 'red');
  
  await delay(500);
  return results;
};

const testRefundsRoutes = async () => {
  log('\n💰 Testing Refunds Routes (refunds.routes.js)', 'cyan');
  log('=========================================', 'cyan');
  
  const results = [];
  
  // Test stripe refund
  log('Testing POST /api/payments/refunds/stripe', 'blue');
  const stripeRefund = await makeRequest('POST', '/payments/refunds/stripe', generateTestData.stripeRefund());
  results.push({ route: 'POST /api/payments/refunds/stripe', success: stripeRefund.success, status: stripeRefund.status });
  log(stripeRefund.success ? '✅ Stripe refund works' : '❌ Stripe refund failed', stripeRefund.success ? 'green' : 'red');
  if (!stripeRefund.success) log(`   Error: ${JSON.stringify(stripeRefund.error)}`, 'red');
  
  // Test paypal refund
  log('Testing POST /api/payments/refunds/paypal', 'blue');
  const paypalRefund = await makeRequest('POST', '/payments/refunds/paypal', generateTestData.paypalRefund());
  results.push({ route: 'POST /api/payments/refunds/paypal', success: paypalRefund.success, status: paypalRefund.status });
  log(paypalRefund.success ? '✅ PayPal refund works' : '❌ PayPal refund failed', paypalRefund.success ? 'green' : 'red');
  if (!paypalRefund.success) log(`   Error: ${JSON.stringify(paypalRefund.error)}`, 'red');
  
  // Test get refund status
  log('Testing GET /api/payments/refunds/status/test123', 'blue');
  const refundStatus = await makeRequest('GET', '/payments/refunds/status/test123');
  results.push({ route: 'GET /api/payments/refunds/status/:id', success: refundStatus.success, status: refundStatus.status });
  log(refundStatus.success ? '✅ Refund status works' : '❌ Refund status failed', refundStatus.success ? 'green' : 'red');
  if (!refundStatus.success) log(`   Error: ${JSON.stringify(refundStatus.error)}`, 'red');
  
  // Test list refunds
  log('Testing GET /api/payments/refunds', 'blue');
  const refundsList = await makeRequest('GET', '/payments/refunds');
  results.push({ route: 'GET /api/payments/refunds', success: refundsList.success, status: refundsList.status });
  log(refundsList.success ? '✅ Refunds list works' : '❌ Refunds list failed', refundsList.success ? 'green' : 'red');
  if (!refundsList.success) log(`   Error: ${JSON.stringify(refundsList.error)}`, 'red');
  
  await delay(500);
  return results;
};

const testInvoicesRoutes = async () => {
  log('\n📄 Testing Invoices Routes (invoices.routes.js)', 'cyan');
  log('==========================================', 'cyan');
  
  const results = [];
  
  // Test invoice generation
  log('Testing POST /api/payments/invoices/generate', 'blue');
  const generateInvoice = await makeRequest('POST', '/payments/invoices/generate', generateTestData.invoiceGeneration());
  results.push({ route: 'POST /api/payments/invoices/generate', success: generateInvoice.success, status: generateInvoice.status });
  log(generateInvoice.success ? '✅ Invoice generation works' : '❌ Invoice generation failed', generateInvoice.success ? 'green' : 'red');
  if (!generateInvoice.success) log(`   Error: ${JSON.stringify(generateInvoice.error)}`, 'red');
  
  // Test get invoice
  log('Testing GET /api/payments/invoices/test123', 'blue');
  const getInvoice = await makeRequest('GET', '/payments/invoices/test123');
  results.push({ route: 'GET /api/payments/invoices/:id', success: getInvoice.success, status: getInvoice.status });
  log(getInvoice.success ? '✅ Get invoice works' : '❌ Get invoice failed', getInvoice.success ? 'green' : 'red');
  if (!getInvoice.success) log(`   Error: ${JSON.stringify(getInvoice.error)}`, 'red');
  
  // Test download invoice
  log('Testing GET /api/payments/invoices/test123/download', 'blue');
  const downloadInvoice = await makeRequest('GET', '/payments/invoices/test123/download');
  results.push({ route: 'GET /api/payments/invoices/:id/download', success: downloadInvoice.success, status: downloadInvoice.status });
  log(downloadInvoice.success ? '✅ Download invoice works' : '❌ Download invoice failed', downloadInvoice.success ? 'green' : 'red');
  if (!downloadInvoice.success) log(`   Error: ${JSON.stringify(downloadInvoice.error)}`, 'red');
  
  // Test list invoices
  log('Testing GET /api/payments/invoices', 'blue');
  const invoicesList = await makeRequest('GET', '/payments/invoices');
  results.push({ route: 'GET /api/payments/invoices', success: invoicesList.success, status: invoicesList.status });
  log(invoicesList.success ? '✅ Invoices list works' : '❌ Invoices list failed', invoicesList.success ? 'green' : 'red');
  if (!invoicesList.success) log(`   Error: ${JSON.stringify(invoicesList.error)}`, 'red');
  
  await delay(500);
  return results;
};

const testPaymentMethodsRoutes = async () => {
  log('\n💳 Testing Payment Methods Routes (payment-methods.routes.js)', 'cyan');
  log('================================================', 'cyan');
  
  const results = [];
  
  // Test list payment methods
  log('Testing GET /api/payments/payment-methods', 'blue');
  const methodsList = await makeRequest('GET', '/payments/payment-methods');
  results.push({ route: 'GET /api/payments/payment-methods', success: methodsList.success, status: methodsList.status });
  log(methodsList.success ? '✅ Payment methods list works' : '❌ Payment methods list failed', methodsList.success ? 'green' : 'red');
  if (!methodsList.success) log(`   Error: ${JSON.stringify(methodsList.error)}`, 'red');
  
  // Test add payment method
  log('Testing POST /api/payments/payment-methods', 'blue');
  const addMethod = await makeRequest('POST', '/payments/payment-methods', generateTestData.paymentMethod());
  results.push({ route: 'POST /api/payments/payment-methods', success: addMethod.success, status: addMethod.status });
  log(addMethod.success ? '✅ Add payment method works' : '❌ Add payment method failed', addMethod.success ? 'green' : 'red');
  if (!addMethod.success) log(`   Error: ${JSON.stringify(addMethod.error)}`, 'red');
  
  // Test update payment method
  log('Testing PUT /api/payments/payment-methods/test123', 'blue');
  const updateMethod = await makeRequest('PUT', '/payments/payment-methods/test123', {
    isDefault: true,
    metadata: { updated: true }
  });
  results.push({ route: 'PUT /api/payments/payment-methods/:id', success: updateMethod.success, status: updateMethod.status });
  log(updateMethod.success ? '✅ Update payment method works' : '❌ Update payment method failed', updateMethod.success ? 'green' : 'red');
  if (!updateMethod.success) log(`   Error: ${JSON.stringify(updateMethod.error)}`, 'red');
  
  // Test delete payment method
  log('Testing DELETE /api/payments/payment-methods/test123', 'blue');
  const deleteMethod = await makeRequest('DELETE', '/payments/payment-methods/test123');
  results.push({ route: 'DELETE /api/payments/payment-methods/:id', success: deleteMethod.success, status: deleteMethod.status });
  log(deleteMethod.success ? '✅ Delete payment method works' : '❌ Delete payment method failed', deleteMethod.success ? 'green' : 'red');
  if (!deleteMethod.success) log(`   Error: ${JSON.stringify(deleteMethod.error)}`, 'red');
  
  await delay(500);
  return results;
};

// Main test runner
const runAllTests = async () => {
  log('🚀 Starting Comprehensive Payment Service API Tests', 'cyan');
  log('================================================', 'cyan');
  log(`Testing against: ${BASE_URL}`, 'yellow');
  
  // Check if service is running
  log('\n🔍 Checking if service is running...', 'blue');
  try {
    await axios.get(`${BASE_URL}/`, { timeout: 3000 });
    log('✅ Service is running!', 'green');
  } catch (error) {
    log('❌ Service is not running!', 'red');
    log('Please start the service with: npm start', 'yellow');
    return;
  }
  
  const allResults = [];
  
  // Test each file in order
  allResults.push(...await testServerRoutes());
  allResults.push(...await testHealthRoutes());
  allResults.push(...await testPaymentsRoutes());
  allResults.push(...await testStripeRoutes());
  allResults.push(...await testPayPalRoutes());
  allResults.push(...await testRefundsRoutes());
  allResults.push(...await testInvoicesRoutes());
  allResults.push(...await testPaymentMethodsRoutes());
  
  // Summary
  log('\n📊 Final Test Results Summary', 'cyan');
  log('=============================', 'cyan');
  
  const totalTests = allResults.length;
  const passedTests = allResults.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;
  
  // Group by file
  const groupedResults = {};
  allResults.forEach(result => {
    const fileName = result.route.includes('GET /') || result.route.includes('POST /') ? 'server.js' : 
                     result.route.includes('/health') ? 'health.routes.js' :
                     result.route.includes('/payments') && !result.route.includes('/stripe') && !result.route.includes('/paypal') && !result.route.includes('/refunds') && !result.route.includes('/invoices') && !result.route.includes('/payment-methods') ? 'payments.routes.js' :
                     result.route.includes('/stripe') ? 'stripe.routes.js' :
                     result.route.includes('/paypal') ? 'paypal.routes.js' :
                     result.route.includes('/refunds') ? 'refunds.routes.js' :
                     result.route.includes('/invoices') ? 'invoices.routes.js' :
                     result.route.includes('/payment-methods') ? 'payment-methods.routes.js' : 'unknown';
    
    if (!groupedResults[fileName]) {
      groupedResults[fileName] = { total: 0, passed: 0, failed: 0, routes: [] };
    }
    groupedResults[fileName].total++;
    groupedResults[fileName].routes.push(result);
    if (result.success) {
      groupedResults[fileName].passed++;
    } else {
      groupedResults[fileName].failed++;
    }
  });
  
  // Display results by file
  Object.entries(groupedResults).forEach(([fileName, stats]) => {
    const successRate = ((stats.passed / stats.total) * 100).toFixed(1);
    const color = stats.failed === 0 ? 'green' : stats.failed < stats.total / 2 ? 'yellow' : 'red';
    log(`${fileName}: ${stats.passed}/${stats.total} (${successRate}%)`, color);
  });
  
  log('\n🎯 Overall Statistics', 'cyan');
  log(`Total Routes Tested: ${totalTests}`, 'blue');
  log(`Passed: ${passedTests}`, 'green');
  log(`Failed: ${failedTests}`, failedTests > 0 ? 'red' : 'green');
  log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`, 
      passedTests === totalTests ? 'green' : failedTests < totalTests / 2 ? 'yellow' : 'red');
  
  if (failedTests > 0) {
    log('\n❌ Failed Routes:', 'red');
    allResults.filter(r => !r.success).forEach(result => {
      log(`   ${result.route} (Status: ${result.status})`, 'red');
    });
  }
  
  if (passedTests === totalTests) {
    log('\n🎉 All tests passed! Payment service is working perfectly!', 'green');
  } else if (passedTests > totalTests / 2) {
    log('\n⚠️  Some tests failed, but most routes are working.', 'yellow');
  } else {
    log('\n🚨 Many tests failed. Service needs attention.', 'red');
  }
};

// Run tests
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests };
