const paypal = require('@paypal/checkout-server-sdk');
const logger = require('../../utils/logger');

/**
 * Service PayPal pour le traitement des paiements alternatifs
 * Gère les ordres, captures, refunds et webhooks PayPal
 */
class PayPalService {
  constructor() {
    this.environment = process.env.PAYPAL_MODE === 'live' 
      ? new paypal.core.LiveEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET)
      : new paypal.core.SandboxEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_CLIENT_SECRET);
    
    this.client = new paypal.core.PayPalHttpClient(this.environment);
    this.currency = process.env.CURRENCY || 'EUR';
    this.minAmount = parseInt(process.env.MIN_AMOUNT) || 100; // 1€ en centimes
    this.maxAmount = parseInt(process.env.MAX_AMOUNT) || 1000000; // 10000€ en centimes
  }

  /**
   * Crée un ordre PayPal
   * @param {Object} orderData - Données de l'ordre
   * @returns {Promise<Object>} Ordre créé
   */
  async createOrder(orderData) {
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
        eventId,
        status: order.status
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
   * Récupère un ordre PayPal
   * @param {string} orderId - ID de l'ordre
   * @returns {Promise<Object>} Ordre
   */
  async getOrder(orderId) {
    try {
      const request = new paypal.orders.OrdersGetRequest(orderId);
      const response = await this.client.execute(request);
      const order = response.result;

      return {
        success: true,
        order: {
          id: order.id,
          status: order.status,
          intent: order.intent,
          purchaseUnits: order.purchase_units,
          payer: order.payer,
          links: order.links,
          createTime: order.create_time,
          updateTime: order.update_time
        }
      };
    } catch (error) {
      logger.error('Failed to retrieve PayPal Order', {
        error: error.message,
        orderId
      });

      return {
        success: false,
        error: error.message,
        type: 'ORDER_RETRIEVAL_FAILED'
      };
    }
  }

  /**
   * Capture un paiement PayPal
   * @param {string} orderId - ID de l'ordre
   * @returns {Promise<Object>} Paiement capturé
   */
  async capturePayment(orderId) {
    try {
      const request = new paypal.orders.OrdersCaptureRequest(orderId);
      request.requestBody({});

      const response = await this.client.execute(request);
      const capture = response.result;

      logger.payment('PayPal payment captured', {
        orderId,
        captureId: capture.purchase_units[0].payments.captures[0].id,
        status: capture.status
      });

      return {
        success: true,
        capture: {
          id: capture.id,
          status: capture.status,
          purchaseUnits: capture.purchase_units,
          payer: capture.payer,
          createTime: capture.create_time
        }
      };
    } catch (error) {
      logger.error('Failed to capture PayPal payment', {
        error: error.message,
        orderId
      });

      return {
        success: false,
        error: error.message,
        type: 'PAYMENT_CAPTURE_FAILED'
      };
    }
  }

  /**
   * Annule un ordre PayPal
   * @param {string} orderId - ID de l'ordre
   * @returns {Promise<Object>} Ordre annulé
   */
  async cancelOrder(orderId) {
    try {
      const request = new paypal.orders.OrdersPatchRequest(orderId);
      request.requestBody([
        {
          op: 'replace',
          path: '/intent',
          value: 'CANCEL'
        }
      ]);

      const response = await this.client.execute(request);

      logger.payment('PayPal Order cancelled', {
        orderId
      });

      return {
        success: true,
        order: {
          id: response.result.id,
          status: 'CANCELLED'
        }
      };
    } catch (error) {
      logger.error('Failed to cancel PayPal Order', {
        error: error.message,
        orderId
      });

      return {
        success: false,
        error: error.message,
        type: 'ORDER_CANCELLATION_FAILED'
      };
    }
  }

  /**
   * Crée un client PayPal
   * @param {Object} customerData - Données du client
   * @returns {Promise<Object>} Client créé
   */
  async createCustomer(customerData) {
    try {
      const {
        email,
        name,
        phone,
        address
      } = customerData;

      // PayPal n'a pas de concept de "client" comme Stripe,
      // mais on peut stocker les informations dans les métadonnées
      const customer = {
        id: `paypal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email,
        name,
        phone,
        address,
        provider: 'paypal',
        created: new Date().toISOString()
      };

      logger.payment('PayPal Customer created', {
        customerId: customer.id,
        email,
        name
      });

      return {
        success: true,
        customer
      };
    } catch (error) {
      logger.error('Failed to create PayPal Customer', {
        error: error.message,
        email: customerData.email
      });

      return {
        success: false,
        error: error.message,
        type: 'CUSTOMER_CREATION_FAILED'
      };
    }
  }

  /**
   * Crée un remboursement PayPal
   * @param {string} captureId - ID de la capture
   * @param {Object} refundData - Données du remboursement
   * @returns {Promise<Object>} Remboursement créé
   */
  async createRefund(captureId, refundData) {
    try {
      const {
        amount,
        reason = 'Requested by customer'
      } = refundData;

      const request = new paypal.payments.CapturesRefundRequest(captureId);
      
      if (amount) {
        request.requestBody({
          amount: {
            value: (amount / 100).toFixed(2),
            currency_code: this.currency
          }
        });
      } else {
        // Remboursement complet
        request.requestBody({});
      }

      const response = await this.client.execute(request);
      const refund = response.result;

      logger.payment('PayPal refund created', {
        refundId: refund.id,
        captureId,
        amount: refund.amount ? refund.amount.value : 'full',
        status: refund.status
      });

      return {
        success: true,
        refund: {
          id: refund.id,
          status: refund.status,
          amount: refund.amount,
          sellerPayableBreakdown: refund.seller_payable_breakdown,
          createTime: refund.create_time
        }
      };
    } catch (error) {
      logger.error('Failed to create PayPal refund', {
        error: error.message,
        captureId,
        amount: refundData.amount
      });

      return {
        success: false,
        error: error.message,
        type: 'REFUND_CREATION_FAILED'
      };
    }
  }

  /**
   * Récupère les détails d'un remboursement
   * @param {string} refundId - ID du remboursement
   * @returns {Promise<Object>} Détails du remboursement
   */
  async getRefund(refundId) {
    try {
      const request = new paypal.payments.RefundsGetRequest(refundId);
      const response = await this.client.execute(request);
      const refund = response.result;

      return {
        success: true,
        refund: {
          id: refund.id,
          status: refund.status,
          amount: refund.amount,
          sellerPayableBreakdown: refund.seller_payable_breakdown,
          createTime: refund.create_time,
          updateTime: refund.update_time
        }
      };
    } catch (error) {
      logger.error('Failed to retrieve PayPal refund', {
        error: error.message,
        refundId
      });

      return {
        success: false,
        error: error.message,
        type: 'REFUND_RETRIEVAL_FAILED'
      };
    }
  }

  /**
   * Vérifie un webhook PayPal
   * @param {Object} webhookData - Données du webhook
   * @param {Array} headers - Headers HTTP
   * @returns {Promise<Object>} Webhook vérifié
   */
  async verifyWebhook(webhookData, headers) {
    try {
      // Pour l'instant, on retourne les données brutes
      // La vérification complète nécessiterait la configuration avancée de PayPal
      
      logger.payment('PayPal webhook received', {
        eventType: webhookData.event_type,
        resourceId: webhookData.resource?.id
      });

      return {
        success: true,
        webhook: {
          eventType: webhookData.event_type,
          resource: webhookData.resource,
          summary: webhookData.summary,
          createTime: webhookData.create_time,
          resourceType: webhookData.resource_type
        }
      };
    } catch (error) {
      logger.error('Failed to verify PayPal webhook', {
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        type: 'WEBHOOK_VERIFICATION_FAILED'
      };
    }
  }

  /**
   * Crée une facture PayPal
   * @param {Object} invoiceData - Données de la facture
   * @returns {Promise<Object>} Facture créée
   */
  async createInvoice(invoiceData) {
    try {
      const {
        customerId,
        amount,
        description,
        dueDate,
        metadata = {}
      } = invoiceData;

      const request = new paypal.invoices.InvoicesCreateRequest();
      request.requestBody({
        detail: {
          invoice_number: `INV-${Date.now()}`,
          currency_code: this.currency,
          note: description,
          payment_term: {
            due_type: 'DUE_ON_DATE',
            due_date: dueDate
          }
        },
        invoicer: {
          business_name: process.env.INVOICE_COMPANY_NAME || 'Event Planner',
          website: 'https://eventplanner.com',
          tax_id: process.env.INVOICE_COMPANY_SIRET,
          logo_url: process.env.PAYPAL_LOGO_URL
        },
        primary_recipients: [{
          billing_info: {
            email: customerId
          }
        }],
        items: [{
          name: description,
          quantity: '1',
          unit_amount: {
            currency_code: this.currency,
            value: (amount / 100).toFixed(2)
          }
        }],
        configuration: {
          partial_payment: {
            allow_partial_payment: false
          },
          tax_calculated_after_discount: false,
          tax_inclusive: false
        }
      });

      const response = await this.client.execute(request);
      const invoice = response.result;

      logger.payment('PayPal invoice created', {
        invoiceId: invoice.id,
        invoiceNumber: invoice.detail.invoice_number,
        amount: amount / 100
      });

      return {
        success: true,
        invoice: {
          id: invoice.id,
          number: invoice.detail.invoice_number,
          status: invoice.status,
          amount: invoice.detail.total_amount,
          dueDate: invoice.detail.payment_term.due_date
        }
      };
    } catch (error) {
      logger.error('Failed to create PayPal invoice', {
        error: error.message,
        amount: invoiceData.amount
      });

      return {
        success: false,
        error: error.message,
        type: 'INVOICE_CREATION_FAILED'
      };
    }
  }

  /**
   * Envoie une facture PayPal
   * @param {string} invoiceId - ID de la facture
   * @returns {Promise<Object>} Facture envoyée
   */
  async sendInvoice(invoiceId) {
    try {
      const request = new paypal.invoices.InvoicesSendRequest(invoiceId);
      const response = await this.client.execute(request);

      logger.payment('PayPal invoice sent', {
        invoiceId
      });

      return {
        success: true,
        sent: true
      };
    } catch (error) {
      logger.error('Failed to send PayPal invoice', {
        error: error.message,
        invoiceId
      });

      return {
        success: false,
        error: error.message,
        type: 'INVOICE_SEND_FAILED'
      };
    }
  }

  /**
   * Récupère le solde du compte PayPal
   * @returns {Promise<Object>} Solde du compte
   */
  async getBalance() {
    try {
      const request = new paypal.payments.BalancesGetRequest();
      const response = await this.client.execute(request);
      const balance = response.result;

      return {
        success: true,
        balance: {
          available: balance.available_balance,
          pending: balance.pending_balance,
          currency: balance.available_balance[0]?.currency_code || this.currency
        }
      };
    } catch (error) {
      logger.error('Failed to get PayPal balance', {
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        type: 'BALANCE_RETRIEVAL_FAILED'
      };
    }
  }

  /**
   * Liste les transactions PayPal
   * @param {Object} options - Options de filtrage
   * @returns {Promise<Object>} Liste des transactions
   */
  async listTransactions(options = {}) {
    try {
      const {
        startDate,
        endDate,
        pageSize = 20,
        page = 1
      } = options;

      const request = new paypal.payments.TransactionsSearchRequest();
      
      if (startDate || endDate) {
        const searchParams = {};
        if (startDate) searchParams.start_date = startDate;
        if (endDate) searchParams.end_date = endDate;
        request.requestBody(searchParams);
      }

      const response = await this.client.execute(request);
      const transactions = response.result;

      return {
        success: true,
        transactions: transactions.transaction_details || [],
        totalItems: transactions.total_items || 0,
        totalPages: Math.ceil((transactions.total_items || 0) / pageSize)
      };
    } catch (error) {
      logger.error('Failed to list PayPal transactions', {
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        type: 'TRANSACTIONS_LIST_FAILED'
      };
    }
  }

  /**
   * Vérifie la santé du service PayPal
   * @returns {Promise<Object>} État de santé
   */
  async healthCheck() {
    try {
      // Tester une requête simple à l'API PayPal
      const request = new paypal.payments.BalancesGetRequest();
      await this.client.execute(request);

      return {
        success: true,
        healthy: true,
        environment: process.env.PAYPAL_MODE || 'sandbox',
        currency: this.currency
      };
    } catch (error) {
      logger.error('PayPal health check failed', {
        error: error.message
      });

      return {
        success: false,
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Récupère les statistiques du service PayPal
   * @returns {Object} Statistiques
   */
  getStats() {
    return {
      environment: process.env.PAYPAL_MODE || 'sandbox',
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
