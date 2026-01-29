/**
 * SCRIPT DE TEST DE COMMUNICATION AVEC EVENT-PLANNER-CORE
 * 
 * OBJECTIF : Tester la communication entre le payment-service et l'event-planner-core
 * Ce script vérifie que l'intégration des paiements de templates fonctionne correctement
 * 
 * UTILISATION :
 * node test-core-communication.js
 * 
 * PRÉREQUIS :
 * - Event Planner Core Service démarré (port 3001)
 * - Payment Service configuré pour communiquer avec Core
 */

// Importation des modules nécessaires
const axios = require('axios');
require('dotenv').config();

// Configuration des tests
const CORE_BASE_URL = process.env.CORE_SERVICE_URL || 'http://localhost:3001';
const PAYMENT_BASE_URL = process.env.BASE_URL || 'http://localhost:3003';

// Variables globales pour les résultats
const results = {
  core: { total: 0, passed: 0, failed: 0, details: {} },
  payment: { total: 0, passed: 0, failed: 0, details: {} },
  integration: { total: 0, passed: 0, failed: 0, details: {} }
};

/**
 * Fonction utilitaire pour afficher des messages colorés
 */
function log(message, color = 'white') {
  const colors = {
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
  };
  console.log(`${colors[color]}${message}\x1b[0m`);
}

/**
 * Fonction pour tester une route API
 */
async function testRoute(method, url, data = null, description = '') {
  try {
    let response;
    
    if (method === 'GET') {
      response = await axios.get(url, { timeout: 5000 });
    } else if (method === 'POST') {
      response = await axios.post(url, data, { timeout: 5000 });
    } else if (method === 'PATCH') {
      response = await axios.patch(url, data, { timeout: 5000 });
    }

    return {
      success: true,
      status: response.status,
      data: response.data
    };
    
  } catch (error) {
    if (error.response) {
      return {
        success: false,
        status: error.response.status,
        error: error.response.data?.error || error.response.data?.message || 'Request failed',
        data: error.response.data
      };
    } else {
      return {
        success: false,
        status: 0,
        error: error.message || 'Network error'
      };
    }
  }
}

/**
 * Test 1 : Vérifier la santé du service Core
 */
async function testCoreHealth() {
  log('\n🏥 TESTS DE SANTÉ DU SERVICE CORE', 'yellow');
  log('=====================================', 'yellow');
  
  results.core.total++;
  const healthResult = await testRoute('GET', `${CORE_BASE_URL}/health`, null, 'Health check Core');
  if (healthResult.success) {
    results.core.passed++;
    log('✅ Service Core en bonne santé', 'green');
  } else {
    results.core.failed++;
    log(`❌ Service Core indisponible: ${healthResult.error}`, 'red');
  }
  results.core.details.health = healthResult;
}

/**
 * Test 2 : Vérifier la santé du service Payment
 */
async function testPaymentHealth() {
  log('\n💳 TESTS DE SANTÉ DU SERVICE PAYMENT', 'yellow');
  log('========================================', 'yellow');
  
  results.payment.total++;
  const healthResult = await testRoute('GET', `${PAYMENT_BASE_URL}/health`, null, 'Health check Payment');
  if (healthResult.success) {
    results.payment.passed++;
    log('✅ Service Payment en bonne santé', 'green');
  } else {
    results.payment.failed++;
    log(`❌ Service Payment indisponible: ${healthResult.error}`, 'red');
  }
  results.payment.details.health = healthResult;
}

/**
 * Test 3 : Tester la récupération d'un template
 */
async function testTemplateRetrieval() {
  log('\n📄 TESTS DE RÉCUPÉRATION DE TEMPLATES', 'yellow');
  log('========================================', 'yellow');
  
  results.core.total++;
  const templateResult = await testRoute('GET', `${CORE_BASE_URL}/api/templates/template_test_123`, null, 'Récupération template');
  if (templateResult.success) {
    results.core.passed++;
    log('✅ Template récupéré avec succès', 'green');
    log(`📋 Nom: ${templateResult.data.data?.name || 'N/A'}`, 'blue');
  } else {
    results.core.failed++;
    log(`❌ Échec récupération template: ${templateResult.error}`, 'red');
  }
  results.core.details.template = templateResult;
}

/**
 * Test 4 : Tester la disponibilité d'un template
 */
async function testTemplateAvailability() {
  log('\n✅ TESTS DE DISPONIBILITÉ DE TEMPLATES', 'yellow');
  log('==========================================', 'yellow');
  
  results.core.total++;
  const availabilityResult = await testRoute('GET', `${CORE_BASE_URL}/api/templates/template_test_123/availability`, null, 'Disponibilité template');
  if (availabilityResult.success) {
    results.core.passed++;
    log('✅ Disponibilité vérifiée avec succès', 'green');
    log(`📋 Disponible: ${availabilityResult.data.available ? 'Oui' : 'Non'}`, 'blue');
  } else {
    results.core.failed++;
    log(`❌ Échec vérification disponibilité: ${availabilityResult.error}`, 'red');
  }
  results.core.details.availability = availabilityResult;
}

/**
 * Test 5 : Tester l'achat de template via Payment Service
 */
async function testTemplatePurchase() {
  log('\n💰 TESTS D\'ACHAT DE TEMPLATE', 'yellow');
  log('==============================', 'yellow');
  
  const purchaseData = {
    templateId: 'template_test_123',
    userId: 'user_test_456',
    designerId: 'designer_test_789',
    amount: 2500, // 25.00€ en centimes
    currency: 'EUR',
    paymentMethod: 'stripe',
    customerEmail: 'test@example.com',
    metadata: {
      source: 'integration_test',
      testRun: new Date().toISOString()
    }
  };

  results.integration.total++;
  const purchaseResult = await testRoute('POST', `${PAYMENT_BASE_URL}/api/payments/payments/templates/purchase`, purchaseData, 'Achat template');
  if (purchaseResult.success) {
    results.integration.passed++;
    log('✅ Achat de template réussi', 'green');
    log(`📋 Transaction ID: ${purchaseResult.data.data?.transactionId || 'N/A'}`, 'blue');
    log(`📋 Statut: ${purchaseResult.data.data?.status || 'N/A'}`, 'blue');
  } else {
    results.integration.failed++;
    log(`❌ Échec achat template: ${purchaseResult.error}`, 'red');
  }
  results.integration.details.purchase = purchaseResult;
}

/**
 * Test 6 : Tester la notification d'achat au service Core
 */
async function testPurchaseNotification() {
  log('\n📢 TESTS DE NOTIFICATION D\'ACHAT', 'yellow');
  log('==================================', 'yellow');
  
  const notificationData = {
    templateId: 'template_test_123',
    userId: 'user_test_456',
    transactionId: 'tx_test_' + Date.now(),
    amount: 2500,
    currency: 'EUR',
    purchaseDate: new Date().toISOString(),
    metadata: {
      source: 'integration_test',
      designerId: 'designer_test_789'
    }
  };

  results.core.total++;
  const notificationResult = await testRoute('POST', `${CORE_BASE_URL}/api/templates/purchase-notification`, notificationData, 'Notification achat');
  if (notificationResult.success) {
    results.core.passed++;
    log('✅ Notification envoyée avec succès', 'green');
    log(`📋 Notification ID: ${notificationResult.data.data?.notificationId || 'N/A'}`, 'blue');
  } else {
    results.core.failed++;
    log(`❌ Échec notification: ${notificationResult.error}`, 'red');
  }
  results.core.details.notification = notificationResult;
}

/**
 * Fonction principale d'exécution des tests
 */
async function runAllTests() {
  log('🚀 DÉMARRAGE DES TESTS DE COMMUNICATION CORE-PAYMENT', 'yellow');
  log('=====================================================', 'yellow');
  
  try {
    // Tests de santé des services
    await testCoreHealth();
    await testPaymentHealth();
    
    // Tests des fonctionnalités Core
    await testTemplateRetrieval();
    await testTemplateAvailability();
    
    // Tests d'intégration
    await testTemplatePurchase();
    await testPurchaseNotification();
    
    // Affichage des résultats
    displayResults();
    
  } catch (error) {
    log(`❌ Erreur critique lors des tests: ${error.message}`, 'red');
    console.error(error);
  }
}

/**
 * Affichage des résultats des tests
 */
function displayResults() {
  log('\n📊 RÉSULTATS DES TESTS', 'yellow');
  log('=====================', 'yellow');
  
  // Résultats Core Service
  log('\n🏥 SERVICE CORE:', 'cyan');
  log(`   • Total: ${results.core.total}`);
  log(`   • Réussis: ${results.core.passed}`);
  log(`   • Échoués: ${results.core.failed}`);
  log(`   • Taux: ${results.core.total > 0 ? ((results.core.passed / results.core.total) * 100).toFixed(1) : 0}%`);
  
  // Résultats Payment Service
  log('\n💳 SERVICE PAYMENT:', 'cyan');
  log(`   • Total: ${results.payment.total}`);
  log(`   • Réussis: ${results.payment.passed}`);
  log(`   • Échoués: ${results.payment.failed}`);
  log(`   • Taux: ${results.payment.total > 0 ? ((results.payment.passed / results.payment.total) * 100).toFixed(1) : 0}%`);
  
  // Résultats d'intégration
  log('\n🔗 INTÉGRATION:', 'cyan');
  log(`   • Total: ${results.integration.total}`);
  log(`   • Réussis: ${results.integration.passed}`);
  log(`   • Échoués: ${results.integration.failed}`);
  log(`   • Taux: ${results.integration.total > 0 ? ((results.integration.passed / results.integration.total) * 100).toFixed(1) : 0}%`);
  
  // Résultats globaux
  const totalTests = results.core.total + results.payment.total + results.integration.total;
  const totalPassed = results.core.passed + results.payment.passed + results.integration.passed;
  const successRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0;
  
  log('\n📈 RÉSULTATS GLOBAUX:', 'yellow');
  log(`   • Total des tests: ${totalTests}`);
  log(`   • Réussis: ${totalPassed}`);
  log(`   • Échoués: ${totalTests - totalPassed}`);
  log(`   • Taux de succès: ${successRate}%`);
  
  if (successRate >= 80) {
    log('\n🎉 COMMUNICATION CORE-PAYMENT FONCTIONNELLE !', 'green');
  } else if (successRate >= 60) {
    log('\n⚠️  COMMUNICATION PARTIELLE - Vérifier les erreurs', 'yellow');
  } else {
    log('\n❌ COMMUNICATION ÉCHECÉE - Investigation requise', 'red');
  }
  
  log('\n🏁 FIN DES TESTS', 'white');
}

// Démarrage des tests
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests, testCoreHealth, testPaymentHealth, testTemplatePurchase };
