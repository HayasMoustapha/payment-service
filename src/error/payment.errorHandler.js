const { ErrorHandlerFactory } = require('../../../shared');

/**
 * Error Handler personnalisé pour Payment Service
 * Gère les erreurs spécifiques aux paiements (Stripe, PayPal, facturation, webhooks)
 */

const paymentErrorHandler = ErrorHandlerFactory.create('Payment Service', {
  logLevel: 'error',
  includeStackTrace: process.env.NODE_ENV === 'development',
  customErrorTypes: {
    // Erreurs de paiement
    'PaymentProcessingError': {
      category: 'business',
      statusCode: 400,
      severity: 'high',
      retryable: true
    },
    'PaymentDeclined': {
      category: 'business',
      statusCode: 402,
      severity: 'medium',
      retryable: false
    },
    'InsufficientFunds': {
      category: 'business',
      statusCode: 402,
      severity: 'high',
      retryable: false
    },
    'CurrencyMismatch': {
      category: 'validation',
      statusCode: 400,
      severity: 'medium',
      retryable: false
    },
    'InvalidAmount': {
      category: 'validation',
      statusCode: 400,
      severity: 'low',
      retryable: false
    },
    
    // Erreurs Stripe
    'StripeAPIError': {
      category: 'technical',
      statusCode: 502,
      severity: 'high',
      retryable: true
    },
    'StripeWebhookError': {
      category: 'technical',
      statusCode: 400,
      severity: 'medium',
      retryable: false
    },
    'StripeInvalidSignature': {
      category: 'security',
      statusCode: 401,
      severity: 'high',
      retryable: false
    },
    
    // Erreurs PayPal
    'PayPalAPIError': {
      category: 'technical',
      statusCode: 502,
      severity: 'high',
      retryable: true
    },
    'PayPalWebhookError': {
      category: 'technical',
      statusCode: 400,
      severity: 'medium',
      retryable: false
    },
    'PayPalInvalidSignature': {
      category: 'security',
      statusCode: 401,
      severity: 'high',
      retryable: false
    },
    
    // Erreurs de facturation
    'InvoiceGenerationError': {
      category: 'technical',
      statusCode: 500,
      severity: 'high',
      retryable: true
    },
    'InvoiceNotFound': {
      category: 'not_found',
      statusCode: 404,
      severity: 'medium',
      retryable: false
    },
    'InvoiceAlreadyPaid': {
      category: 'business',
      statusCode: 409,
      severity: 'medium',
      retryable: false
    },
    
    // Erreurs de rembourse
    'RefundProcessingError': {
      category: 'technical',
      statusCode: 500,
      severity: 'high',
      retryable: true
    },
    'RefundNotFound': {
      category: 'not_found',
      statusCode: 404,
      severity: 'medium',
      retryable: false
    },
    'RefundAlreadyProcessed': {
      category: 'business',
      statusCode: 409,
      severity: 'medium',
      retryable: false
    },
    'RefundWindowExpired': {
      category: 'business',
      statusCode: 410,
      severity: 'medium',
      retryable: false
    },
    
    // Erreurs de portefeuille
    'WalletInsufficientFunds': {
      category: 'business',
      statusCode: 402,
      severity: 'high',
      retryable: false
    },
    'WalletNotFound': {
      category: 'not_found',
      statusCode: 404,
      severity: 'medium',
      retryable: false
    },
    'WalletTransactionFailed': {
      category: 'technical',
      statusCode: 500,
      severity: 'high',
      retryable: true
    },
    
    // Erreurs de méthodes de paiement
    'PaymentMethodNotAvailable': {
      category: 'business',
      statusCode: 400,
      severity: 'medium',
      retryable: false
    },
    'PaymentMethodInvalid': {
      category: 'validation',
      statusCode: 400,
      severity: 'low',
      retryable: false
    },
    
    // Erreurs techniques communes
    'DatabaseConnectionError': {
      category: 'technical',
      statusCode: 503,
      severity: 'high',
      retryable: true
    },
    'ExternalServiceError': {
      category: 'technical',
      statusCode: 502,
      severity: 'medium',
      retryable: true
    },
    'ConfigurationError': {
      category: 'technical',
      statusCode: 500,
      severity: 'medium',
      retryable: false
    },
    'TimeoutError': {
      category: 'technical',
      statusCode: 408,
      severity: 'medium',
      retryable: true
    },
    'RateLimitError': {
      category: 'security',
      statusCode: 429,
      severity: 'medium',
      retryable: false
    }
  }
});

module.exports = paymentErrorHandler;
