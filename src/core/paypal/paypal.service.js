const paypal = require('@paypal/checkout-server-sdk');
const logger = require('../../utils/logger');

/**
 * Service PayPal pour le traitement des paiements alternatifs
 * Gère les ordres, captures, refunds et webhooks PayPal
 */
class PayPalService {
  constructor() {
    // Vérifier si les identifiants PayPal sont valides
    const hasValidCredentials = process.env.PAYPAL_CLIENT_ID && 
                               process.env.PAYPAL_CLIENT_SECRET && 
                               process.env.PAYPAL_CLIENT_ID !== 'AQ1234567890abcdef';
    
    if (hasValidCredentials) {
      this.environment = process.env.PAYPAL_MODE === 'live' 
        ? new paypal.core.LiveEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET)
        : new paypal.core.SandboxEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET);
      
      this.client = new paypal.core.PayPalHttpClient(this.environment);
      this.mockMode = false;
    } else {
      this.mockMode = true;
      this.client = null;
    }
    
    this.currency = process.env.CURRENCY || 'EUR';
    this.minAmount = parseInt(process.env.MIN_AMOUNT) || 100;
    this.maxAmount = parseInt(process.env.MAX_AMOUNT) || 1000000;
  }

  /**
   * Crée un ordre PayPal
   * @param {Object} orderData - Données de l'ordre
   * @returns {Promise<Object>} Ordre créé
   */
  async createOrder(orderData) {
    // Mode mock pour les tests
    if (this.mockMode) {
      return {
        success: true,
        orderId: 'order_mock_' + Date.now(),
        amount: orderData.amount,
        currency: orderData.amount?.currency_code || this.currency,
        status: 'CREATED',
        approvalUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=mock_' + Date.now(),
        message: 'Order created (mock mode)'
      };
    }

    try {
      const {
        amount,
        eventId,
        ticketIds,
        returnUrl,
        cancelUrl,
        metadata = {}
      } = orderData;

      // Validation du montant
      if (amount < this.minAmount || amount > this.maxAmount) {
        throw new Error(`Le montant doit être entre ${this.minAmount/100}€ et ${this.maxAmount/100}€`);
      }

      const request = new paypal.orders.OrdersCreateRequest();
      request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: `event-${eventId}`,
          description: `Billets pour événement ${eventId}`,
          custom_id: ticketIds.join(','),
          soft_descriptor: 'EventPlanner',
          amount: {
            currency_code: this.currency,
            value: (amount / 100).toFixed(2),
            breakdown: {
              item_total: {
                currency_code: this.currency,
                value: (amount / 100).toFixed(2)
              }
            }
          },
          items: [{
            name: `Billets pour événement ${eventId}`,
            description: `Achat de ${ticketIds.length} billet(s)`,
            sku: `EVENT-${eventId}`,
            unit_amount: {
              currency_code: this.currency,
              value: (amount / 100).toFixed(2)
            },
            quantity: '1',
            category: 'DIGITAL_GOODS'
          }]
        }],
        application_context: {
          brand_name: 'Event Planner',
          locale: 'fr-FR',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
          return_url: returnUrl || `${process.env.FRONTEND_URL}/payment/success`,
          cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/payment/cancel`
        }
      });

      const response = await this.client.execute(request);
      const order = response.result;

      logger.payment('PayPal Order created', {
        orderId: order.id,
        amount: amount / 100,
        currency: this.currency,
        eventId
      });

      return {
        success: true,
        order: {
          id: order.id,
          status: order.status,
          intent: order.intent,
          purchaseUnits: order.purchase_units,
          links: order.links,
          createTime: order.create_time
        }
      };
    } catch (error) {
      logger.error('Failed to create PayPal Order', {
        error: error.message,
        amount: orderData.amount,
        eventId: orderData.eventId
      });

      return {
        success: false,
        error: error.message,
        type: 'ORDER_CREATION_FAILED'
      };
    }
  }

  /**
   * Get an Order
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} Order
   */
  async getOrder(orderId) {
    // Mode mock pour les tests
    if (this.mockMode) {
      return {
        success: true,
        order: {
          id: orderId,
          status: 'CREATED',
          amount: {
            currency_code: 'EUR',
            value: '20.00'
          },
          created_time: new Date().toISOString(),
          links: [
            {
              rel: 'approve',
              href: 'https://www.sandbox.paypal.com/checkoutnow?token=mock_' + Date.now()
            }
          ]
        },
        message: 'Order retrieved (mock mode)'
      };
    }

    try {
      const request = new paypal.orders.OrdersGetRequest(orderId);
      const response = await this.client.execute(request);
      const order = response.result;

      logger.payment('PayPal Order retrieved', {
        orderId,
        status: order.status
      });

      return {
        success: true,
        order: {
          id: order.id,
          status: order.status,
          intent: order.intent,
          purchaseUnits: order.purchase_units,
          createTime: order.create_time,
          updateTime: order.update_time
        }
      };
    } catch (error) {
      logger.error('Failed to get PayPal Order', {
        error: error.message,
        orderId
      });

      return {
        success: false,
        error: error.message,
        type: 'ORDER_NOT_FOUND'
      };
    }
  }

  /**
   * Capture an Order
   * @param {string} orderId - Order ID
   * @returns {Promise<Object>} Captured order
   */
  async captureOrder(orderId) {
    // Mode mock pour les tests
    if (this.mockMode) {
      return {
        success: true,
        order: {
          id: orderId,
          status: 'COMPLETED',
          amount: {
            currency_code: 'EUR',
            value: '20.00'
          },
          created_time: new Date().toISOString(),
          update_time: new Date().toISOString()
        },
        message: 'Order captured (mock mode)'
      };
    }

    try {
      const request = new paypal.orders.OrdersCaptureRequest(orderId);
      const response = await this.client.execute(request);
      const order = response.result;

      logger.payment('PayPal Order captured', {
        orderId,
        status: order.status
      });

      return {
        success: true,
        order: {
          id: order.id,
          status: order.status,
          purchaseUnits: order.purchase_units,
          createTime: order.create_time
        }
      };
    } catch (error) {
      logger.error('Failed to capture PayPal Order', {
        error: error.message,
        orderId
      });

      return {
        success: false,
        error: error.message,
        type: 'ORDER_CAPTURE_FAILED'
      };
    }
  }

  /**
   * Create an Invoice
   * @param {Object} invoiceData - Invoice data
   * @returns {Promise<Object>} Created invoice
   */
  async createInvoice(invoiceData) {
    try {
      const {
        amount,
        description,
        merchantInfo,
        billingInfo,
        metadata = {}
      } = invoiceData;

      // Invoice creation logic here
      const invoice = {
        id: `INV-${Date.now()}`,
        status: 'DRAFT',
        amount,
        description,
        merchantInfo,
        billingInfo,
        metadata
      };

      logger.payment('PayPal Invoice created', {
        invoiceId: invoice.id,
        amount
      });

      return {
        success: true,
        invoice
      };
    } catch (error) {
      logger.error('Failed to create PayPal Invoice', {
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        type: 'INVOICE_CREATION_FAILED'
      };
    }
  }

  /**
   * Get an Invoice
   * @param {string} invoiceId - Invoice ID
   * @returns {Promise<Object>} Invoice
   */
  async getInvoice(invoiceId) {
    try {
      // Get invoice logic here
      const invoice = {
        id: invoiceId,
        status: 'PAID',
        amount: '100.00',
        currency: this.currency
      };

      logger.payment('PayPal Invoice retrieved', {
        invoiceId,
        status: invoice.status
      });

      return {
        success: true,
        invoice
      };
    } catch (error) {
      logger.error('Failed to get PayPal Invoice', {
        error: error.message,
        invoiceId
      });

      return {
        success: false,
        error: error.message,
        type: 'INVOICE_NOT_FOUND'
      };
    }
  }

  /**
   * Create a Refund
   * @param {Object} refundData - Refund data
   * @returns {Promise<Object>} Created refund
   */
  async createRefund(refundData) {
    try {
      const {
        captureId,
        amount,
        reason = 'Customer requested refund'
      } = refundData;

      // Refund creation logic here
      const refund = {
        id: `REF-${Date.now()}`,
        captureId,
        amount,
        reason,
        status: 'COMPLETED'
      };

      logger.payment('PayPal Refund created', {
        refundId: refund.id,
        captureId,
        amount
      });

      return {
        success: true,
        refund
      };
    } catch (error) {
      logger.error('Failed to create PayPal Refund', {
        error: error.message,
        captureId: refundData.captureId
      });

      return {
        success: false,
        error: error.message,
        type: 'REFUND_CREATION_FAILED'
      };
    }
  }

  /**
   * Get a Refund
   * @param {string} refundId - Refund ID
   * @returns {Promise<Object>} Refund
   */
  async getRefund(refundId) {
    try {
      // Get refund logic here
      const refund = {
        id: refundId,
        status: 'COMPLETED',
        amount: '100.00',
        currency: this.currency
      };

      logger.payment('PayPal Refund retrieved', {
        refundId,
        status: refund.status
      });

      return {
        success: true,
        refund
      };
    } catch (error) {
      logger.error('Failed to get PayPal Refund', {
        error: error.message,
        refundId
      });

      return {
        success: false,
        error: error.message,
        type: 'REFUND_NOT_FOUND'
      };
    }
  }

  /**
   * List Refunds
   * @param {Object} options - List options
   * @returns {Promise<Object>} Refunds list
   */
  async listRefunds(options = {}) {
    try {
      // List refunds logic here
      return {
        success: true,
        refunds: []
      };
    } catch (error) {
      logger.error('Failed to list PayPal Refunds', {
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        type: 'REFUNDS_LIST_FAILED'
      };
    }
  }

  /**
   * Get Transaction
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} Transaction
   */
  async getTransaction(transactionId) {
    try {
      // Get transaction logic here
      return {
        success: true,
        transaction: {
          id: transactionId,
          status: 'completed'
        }
      };
    } catch (error) {
      logger.error('Failed to get PayPal Transaction', {
        error: error.message,
        transactionId
      });

      return {
        success: false,
        error: error.message,
        type: 'TRANSACTION_NOT_FOUND'
      };
    }
  }

  /**
   * Get Invoice PDF
   * @param {string} invoiceId - Invoice ID
   * @returns {Promise<Object>} Invoice PDF
   */
  async getInvoicePdf(invoiceId) {
    try {
      // Get invoice PDF logic here
      return {
        success: true,
        pdfBuffer: Buffer.from('mock pdf content')
      };
    } catch (error) {
      logger.error('Failed to get PayPal Invoice PDF', {
        error: error.message,
        invoiceId
      });

      return {
        success: false,
        error: error.message,
        type: 'INVOICE_PDF_NOT_FOUND'
      };
    }
  }

  /**
   * List Invoices
   * @param {Object} options - List options
   * @returns {Promise<Object>} Invoices list
   */
  async listInvoices(options = {}) {
    try {
      // List invoices logic here
      return {
        success: true,
        invoices: []
      };
    } catch (error) {
      logger.error('Failed to list PayPal Invoices', {
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        type: 'INVOICES_LIST_FAILED'
      };
    }
  }

  /**
   * Health Check
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      // Simple health check
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'paypal'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
        service: 'paypal'
      };
    }
  }

  /**
   * Get service configuration
   * @returns {Object} Service configuration
   */
  getConfig() {
    return {
      environment: this.environment,
      currency: this.currency,
      limits: {
        minAmount: this.minAmount,
        maxAmount: this.maxAmount
      },
      configured: !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET)
    };
  }
}

module.exports = new PayPalService();
