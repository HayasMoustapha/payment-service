#!/usr/bin/env node

/**
 * Script de Test Complet des Routes du Payment Service
 * 
 * Ce script teste toutes les routes API du service de paiement
 * après la suppression des couches de sécurité (authentification, permissions)
 * 
 * Objectif : Valider que la logique métier fonctionne correctement
 * sans aucune restriction de sécurité
 */

const axios = require('axios');

// Configuration du service
const BASE_URL = 'http://localhost:3003';
const API_BASE = `${BASE_URL}/api`;

// Configuration des couleurs pour l'affichage console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Fonction utilitaire pour les délais entre les requêtes
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fonction principale pour tester une route API
 * @param {string} method - Méthode HTTP (GET, POST, PUT, DELETE)
 * @param {string} url - URL de la route à tester
 * @param {Object} data - Données à envoyer (pour POST/PUT)
 * @param {string} description - Description du test pour l'affichage
 * @returns {Object} - Résultat du test (success, status, data, error)
 */
async function testRoute(method, url, data = null, description = '') {
  try {
    let response;
    
    // ÉTAPE 1 : Exécuter la requête selon la méthode HTTP
    if (method === 'GET') {
      response = await axios.get(url, { timeout: 5000 }); // GET avec timeout de 5 secondes
    } else if (method === 'POST') {
      response = await axios.post(url, data, { timeout: 5000 }); // POST avec timeout
    } else if (method === 'PUT') {
      response = await axios.put(url, data, { timeout: 5000 }); // PUT avec timeout
    } else if (method === 'DELETE') {
      response = await axios.delete(url, { timeout: 5000 }); // DELETE avec timeout
    }

    // ÉTAPE 2 : Retourner le succès avec les détails de la réponse
    return {
      success: true,
      status: response.status,
      data: response.data,
      headers: response.headers
    };
    
  } catch (error) {
    // ÉTAPE 3 : Gérer les erreurs de requête
    if (error.response) {
      // Erreur HTTP (4xx, 5xx)
      return {
        success: false,
        status: error.response.status,
        error: error.response.data?.error || error.response.data?.message || 'Request failed',
        data: error.response.data
      };
    } else {
      // Erreur réseau ou timeout
      return {
        success: false,
        status: 0,
        error: error.message || 'Network error'
      };
    }
  }
}

/**
 * Fonction principale d'exécution des tests
 * Teste toutes les routes dans un ordre logique
 */
async function runAllTests() {
  log('🚀 DÉMARRAGE DES TESTS COMPLETS DU PAYMENT SERVICE', 'yellow');
  log('================================================', 'yellow');
  
  // ==========================================
  // TESTS DES ROUTES PRINCIPALES
  // ==========================================
  
  log('\n🏠 TESTS DES ROUTES PRINCIPALES', 'yellow');
  log('================================', 'yellow');
  
  // Test 1: Route racine
  results.total++;
  const rootResult = await testRoute('GET', BASE_URL, null, 'Route racine du service');
  if (rootResult.success) results.passed++;
  else results.failed++;
  results.details.root = rootResult;
  
  // Test 2: Route health
  results.total++;
  const healthResult = await testRoute('GET', `${BASE_URL}/health`, null, 'Health check du service');
  if (healthResult.success) results.passed++;
  else results.failed++;
  results.details.health = healthResult;
  
  // Test 3: Route API info
  results.total++;
  const apiInfoResult = await testRoute('GET', API_BASE, null, 'Information API');
  if (apiInfoResult.success) results.passed++;
  else results.failed++;
  results.details.api_info = apiInfoResult;
  
  // ==========================================
  // TESTS DES ROUTES DE PAIEMENTS
  // ==========================================
  
  log('\n💳 TESTS DES ROUTES DE PAIEMENTS', 'yellow');
  log('===============================', 'yellow');
  
  // Données de test pour les paiements
  const paymentData = {
    amount: 2500, // 25.00€ en centimes
    currency: 'eur',
    gateway: 'stripe', // Ajout du gateway requis
    customerEmail: 'test@example.com', // Ajout de l'email requis
    description: 'Test payment after security removal',
    userId: 'anonymous_user',
    eventId: 'event_test_123'
  };
  
  // Test 4: Processus de paiement
  results.total++;
  const paymentResult = await testRoute('POST', `${API_BASE}/payments/process`, paymentData, 'Processus de paiement');
  if (paymentResult.success) results.passed++;
  else results.failed++;
  results.details.payment_process = paymentResult;
  
  // Test 5: Template d'achat
  const templateData = {
    templateId: 'template_123', // Ajout du templateId requis
    customerEmail: 'test@example.com', // Ajout de l'email requis
    paymentMethod: 'card' // Ajout du paymentMethod requis
  };
  results.total++;
  const templateResult = await testRoute('POST', `${API_BASE}/payments/templates/purchase`, templateData, 'Template d\'achat');
  if (templateResult.success) results.passed++;
  else results.failed++;
  results.details.template_purchase = templateResult;
  
  // Test 6: Webhook Stripe
  const webhookData = {
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: 'pi_test_123',
        amount: 2500,
        currency: 'eur'
      }
    }
  };
  results.total++;
  const webhookResult = await testRoute('POST', `${API_BASE}/payments/webhooks/stripe`, webhookData, 'Webhook Stripe');
  if (webhookResult.success) results.passed++;
  else results.failed++;
  results.details.webhook_stripe = webhookResult;
  
  // Test 7: Statut de paiement
  results.total++;
  const statusResult = await testRoute('GET', `${API_BASE}/payments/status/pay_test_123`, null, 'Statut de paiement');
  if (statusResult.success) results.passed++;
  else results.failed++;
  results.details.payment_status = statusResult;
  
  // Test 8: Statistiques de paiements
  results.total++;
  const statsResult = await testRoute('GET', `${API_BASE}/payments/statistics`, null, 'Statistiques de paiements');
  if (statsResult.success) results.passed++;
  else results.failed++;
  results.details.payment_stats = statsResult;
  
  // Test 9: Passerelles disponibles
  results.total++;
  const gatewaysResult = await testRoute('GET', `${API_BASE}/payments/gateways`, null, 'Passerelles de paiement');
  if (gatewaysResult.success) results.passed++;
  else results.failed++;
  results.details.gateways = gatewaysResult;
  
  // ==========================================
  // TESTS DES ROUTES STRIPE
  // ==========================================
  
  log('\n🟡 TESTS DES ROUTES STRIPE', 'yellow');
  log('==========================', 'yellow');
  
  // Données de test pour Stripe
  const stripePaymentIntentData = {
    amount: 1500, // 15.00€
    currency: 'eur',
    customerEmail: 'test@example.com',
    description: 'Test Stripe payment intent'
  };
  
  // Test 10: Création Payment Intent
  results.total++;
  const stripeIntentResult = await testRoute('POST', `${API_BASE}/payments/stripe/payment-intent`, stripePaymentIntentData, 'Stripe Payment Intent');
  if (stripeIntentResult.success) results.passed++;
  else results.failed++;
  results.details.stripe_payment_intent = stripeIntentResult;
  
  // Test 11: Création client Stripe
  const stripeCustomerData = {
    email: 'customer@example.com',
    name: 'Test Customer',
    phone: '+33612345678'
  };
  results.total++;
  const stripeCustomerResult = await testRoute('POST', `${API_BASE}/payments/stripe/customers`, stripeCustomerData, 'Création client Stripe');
  if (stripeCustomerResult.success) results.passed++;
  else results.failed++;
  results.details.stripe_customer = stripeCustomerResult;
  
  // Test 12: Ajout méthode de paiement Stripe
  const stripePaymentMethodData = {
    customerId: 'cus_test_123',
    paymentMethodId: 'pm_test_123',
    isDefault: true
  };
  results.total++;
  const stripePaymentMethodResult = await testRoute('POST', `${API_BASE}/payments/stripe/payment-methods`, stripePaymentMethodData, 'Méthode de paiement Stripe');
  if (stripePaymentMethodResult.success) results.passed++;
  else results.failed++;
  results.details.stripe_payment_method = stripePaymentMethodResult;
  
  // Test 13: Récupération Payment Intent
  results.total++;
  const getStripeIntentResult = await testRoute('GET', `${API_BASE}/payments/stripe/payment-intent/pi_test_123`, null, 'Récupération Payment Intent');
  if (getStripeIntentResult.success) results.passed++;
  else results.failed++;
  results.details.get_stripe_intent = getStripeIntentResult;
  
  // Test 14: Confirmation paiement Stripe
  const stripeConfirmData = {
    paymentIntentId: 'pi_test_123',
    paymentMethodId: 'pm_test_123'
  };
  results.total++;
  const stripeConfirmResult = await testRoute('POST', `${API_BASE}/payments/stripe/confirm`, stripeConfirmData, 'Confirmation paiement Stripe');
  if (stripeConfirmResult.success) results.passed++;
  else results.failed++;
  results.details.stripe_confirm = stripeConfirmResult;
  
  // Test 15: Récupération client Stripe
  results.total++;
  const getStripeCustomerResult = await testRoute('GET', `${API_BASE}/payments/stripe/customers/cus_test_123`, null, 'Récupération client Stripe');
  if (getStripeCustomerResult.success) results.passed++;
  else results.failed++;
  results.details.get_stripe_customer = getStripeCustomerResult;
  
  // Test 16: Méthodes de paiement client
  results.total++;
  const stripeCustomerMethodsResult = await testRoute('GET', `${API_BASE}/payments/stripe/customers/cus_test_123/payment-methods`, null, 'Méthodes paiement client Stripe');
  if (stripeCustomerMethodsResult.success) results.passed++;
  else results.failed++;
  results.details.stripe_customer_methods = stripeCustomerMethodsResult;
  
  // ==========================================
  // TESTS DES ROUTES PAYPAL
  // ==========================================
  
  log('\n🅿️ TESTS DES ROUTES PAYPAL', 'yellow');
  log('===========================', 'yellow');
  
  // Données de test pour PayPal
  const paypalOrderData = {
    amount: {
      currency_code: 'EUR', // Format correct pour PayPal
      value: '20.00' // En string pour PayPal
    },
    description: 'Test PayPal order',
    returnUrl: 'http://localhost:3000/success',
    cancelUrl: 'http://localhost:3000/cancel'
  };
  
  // Test 17: Création ordre PayPal
  results.total++;
  const paypalOrderResult = await testRoute('POST', `${API_BASE}/payments/paypal/orders`, paypalOrderData, 'Création ordre PayPal');
  if (paypalOrderResult.success) results.passed++;
  else results.failed++;
  results.details.paypal_order = paypalOrderResult;
  
  // Test 18: Récupération ordre PayPal
  results.total++;
  const getPaypalOrderResult = await testRoute('GET', `${API_BASE}/payments/paypal/orders/order_test_123`, null, 'Récupération ordre PayPal');
  if (getPaypalOrderResult.success) results.passed++;
  else results.failed++;
  results.details.get_paypal_order = getPaypalOrderResult;
  
  // Test 19: Capture ordre PayPal
  results.total++;
  const capturePaypalData = {
    orderId: 'order_test_123'
  };
  const capturePaypalResult = await testRoute('POST', `${API_BASE}/payments/paypal/orders/order_test_123/capture`, capturePaypalData, 'Capture ordre PayPal');
  if (capturePaypalResult.success) results.passed++;
  else results.failed++;
  results.details.capture_paypal = capturePaypalResult;
  
  // ==========================================
  // TESTS DES ROUTES DE REMBOURSEMENTS
  // ==========================================
  
  log('\n💰 TESTS DES ROUTES DE REMBOURSEMENTS', 'yellow');
  log('===================================', 'yellow');
  
  // Données de test pour les remboursements
  const stripeRefundData = {
    paymentIntentId: 'pi_test_123',
    amount: 1000, // 10.00€
    reason: 'requested_by_customer'
  };
  
  // Test 20: Remboursement Stripe
  results.total++;
  const stripeRefundResult = await testRoute('POST', `${API_BASE}/payments/refunds/stripe`, stripeRefundData, 'Remboursement Stripe');
  if (stripeRefundResult.success) results.passed++;
  else results.failed++;
  results.details.stripe_refund = stripeRefundResult;
  
  // Test 21: Remboursement PayPal
  const paypalRefundData = {
    paymentId: 'paypal_payment_123', // Utiliser paymentId au lieu d'orderId
    amount: 800, // 8.00€
    reason: 'requested_by_customer'
  };
  results.total++;
  const paypalRefundResult = await testRoute('POST', `${API_BASE}/payments/refunds/paypal`, paypalRefundData, 'Remboursement PayPal');
  if (paypalRefundResult.success) results.passed++;
  else results.failed++;
  results.details.paypal_refund = paypalRefundResult;
  
  // Test 22: Statut de remboursement
  results.total++;
  const refundStatusResult = await testRoute('GET', `${API_BASE}/payments/refunds/status/ref_test_123`, null, 'Statut remboursement');
  if (refundStatusResult.success) results.passed++;
  else results.failed++;
  results.details.refund_status = refundStatusResult;
  
  // Test 23: Liste des remboursements
  results.total++;
  const refundsListResult = await testRoute('GET', `${API_BASE}/payments/refunds`, null, 'Liste des remboursements');
  if (refundsListResult.success) results.passed++;
  else results.failed++;
  results.details.refunds_list = refundsListResult;
  
  // ==========================================
  // TESTS DES ROUTES DE FACTURES
  // ==========================================
  
  log('\n📄 TESTS DES ROUTES DE FACTURES', 'yellow');
  log('===============================', 'yellow');
  
  // Données de test pour les factures
  const invoiceData = {
    transactionId: 'transaction_123', // Ajout du transactionId requis
    template: 'default',
    includeTax: true
  };
  
  // Test 24: Génération facture
  results.total++;
  const invoiceGenerateResult = await testRoute('POST', `${API_BASE}/payments/invoices/generate`, invoiceData, 'Génération facture');
  if (invoiceGenerateResult.success) results.passed++;
  else results.failed++;
  results.details.invoice_generate = invoiceGenerateResult;
  
  // Test 25: Récupération facture
  results.total++;
  const getInvoiceResult = await testRoute('GET', `${API_BASE}/payments/invoices/inv_test_123`, null, 'Récupération facture');
  if (getInvoiceResult.success) results.passed++;
  else results.failed++;
  results.details.get_invoice = getInvoiceResult;
  
  // Test 26: Téléchargement facture
  results.total++;
  const downloadInvoiceResult = await testRoute('GET', `${API_BASE}/payments/invoices/inv_test_123/download`, null, 'Téléchargement facture');
  if (downloadInvoiceResult.success) results.passed++;
  else results.failed++;
  results.details.download_invoice = downloadInvoiceResult;
  
  // Test 27: Liste des factures
  results.total++;
  const invoicesListResult = await testRoute('GET', `${API_BASE}/payments/invoices`, null, 'Liste des factures');
  if (invoicesListResult.success) results.passed++;
  else results.failed++;
  results.details.invoices_list = invoicesListResult;
  
  // ==========================================
  // TESTS DES ROUTES DE MÉTHODES DE PAIEMENT
  // ==========================================
  
  log('\n💳 TESTS DES ROUTES DE MÉTHODES DE PAIEMENT', 'yellow');
  log('==========================================', 'yellow');
  
  // Données de test pour les méthodes de paiement
  const paymentMethodData = {
    type: 'card',
    provider: 'stripe',
    token: 'tok_test_123', // Ajout du token requis
    isDefault: true
  };
  
  // Test 28: Liste des méthodes de paiement
  results.total++;
  const paymentMethodsListResult = await testRoute('GET', `${API_BASE}/payments/payment-methods`, null, 'Liste méthodes de paiement');
  if (paymentMethodsListResult.success) results.passed++;
  else results.failed++;
  results.details.payment_methods_list = paymentMethodsListResult;
  
  // Test 29: Ajout méthode de paiement
  results.total++;
  const addPaymentMethodResult = await testRoute('POST', `${API_BASE}/payments/payment-methods`, paymentMethodData, 'Ajout méthode de paiement');
  if (addPaymentMethodResult.success) results.passed++;
  else results.failed++;
  results.details.add_payment_method = addPaymentMethodResult;
  
  // Test 30: Mise à jour méthode de paiement
  const updatePaymentMethodData = {
    isDefault: false,
    metadata: { updated: true }
  };
  results.total++;
  const updatePaymentMethodResult = await testRoute('PUT', `${API_BASE}/payments/payment-methods/pm_test_123`, updatePaymentMethodData, 'Mise à jour méthode de paiement');
  if (updatePaymentMethodResult.success) results.passed++;
  else results.failed++;
  results.details.update_payment_method = updatePaymentMethodResult;
  
  // Test 31: Suppression méthode de paiement
  results.total++;
  const deletePaymentMethodResult = await testRoute('DELETE', `${API_BASE}/payments/payment-methods/pm_test_123`, null, 'Suppression méthode de paiement');
  if (deletePaymentMethodResult.success) results.passed++;
  else results.failed++;
  results.details.delete_payment_method = deletePaymentMethodResult;
  
  // ==========================================
  // AFFICHAGE DES RÉSULTATS FINAUX
  // ==========================================
  
  log('\n📊 RÉSULTATS FINAUX DES TESTS', 'yellow');
  log('=============================', 'yellow');
  
  log(`\n📈 Statistiques générales:`, 'cyan');
  log(`   • Total des tests: ${results.total}`, 'blue');
  log(`   • Réussis: ${results.passed}`, 'green');
  log(`   • Échoués: ${results.failed}`, 'red');
  log(`   • Taux de succès: ${((results.passed / results.total) * 100).toFixed(1)}%`, 
      results.passed === results.total ? 'green' : results.passed > results.total * 0.5 ? 'yellow' : 'red');
  
  // Affichage des routes échouées
  if (results.failed > 0) {
    log(`\n❌ Routes échouées:`, 'red');
    for (const [routeName, result] of Object.entries(results.details)) {
      if (!result.success) {
        log(`   • ${routeName}: ${result.error} (Status: ${result.status})`, 'red');
      }
    }
  }
  
  // Affichage des routes réussies
  if (results.passed > 0) {
    log(`\n✅ Routes réussies:`, 'green');
    for (const [routeName, result] of Object.entries(results.details)) {
      if (result.success) {
        log(`   • ${routeName} (Status: ${result.status})`, 'green');
      }
    }
  }
  
  // Conclusion
  log(`\n🏁 FIN DES TESTS`, 'yellow');
  if (results.passed === results.total) {
    log('🎉 Tous les tests sont passés avec succès !', 'green');
    log('Le payment service fonctionne correctement sans la sécurité.', 'green');
  } else if (results.passed > results.total * 0.7) {
    log('⚠️  La plupart des tests sont passés, mais des problèmes subsistent.', 'yellow');
    log('Une investigation supplémentaire est nécessaire.', 'yellow');
  } else {
    log('🚨 Beaucoup de tests ont échoué. Le service nécessite des corrections.', 'red');
    log('Veuillez vérifier les erreurs ci-dessus pour diagnostiquer les problèmes.', 'red');
  }
  
  return results;
}

// Exécution du script si appelé directement
if (require.main === module) {
  runAllTests()
    .then(results => {
      log('\n📋 Tests terminés avec succès.', 'blue');
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      log(`\n💥 Erreur lors de l'exécution des tests: ${error.message}`, 'red');
      console.error(error);
      process.exit(1);
    });
}

module.exports = { runAllTests, testRoute };
