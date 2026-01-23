const stripeService = require('../../core/stripe/stripe.service');
const paypalService = require('../../core/paypal/paypal.service');
const invoiceService = require('../../core/invoices/invoice.service');
const refundService = require('../../core/refunds/refund.service');
const { 
  successResponse, 
  createdResponse, 
  paymentResponse,
  refundResponse,
  invoiceResponse,
  notFoundResponse,
  errorResponse,
  paymentErrorResponse,
  providerErrorResponse
} = require('../../utils/response');
const logger = require('../../utils/logger');

/**
 * Contrôleur pour les paiements
 * Gère les paiements Stripe et PayPal avec facturation et remboursements
 */
class PaymentsController {
  /**
   * Crée un Payment Intent Stripe
   */
  async createStripePaymentIntent(req, res) {
    try {
      const { amount, customerId, eventId, ticketIds, metadata = {} } = req.body;
      
      logger.payment('Creating Stripe Payment Intent', {
        amount,
        eventId,
        ticketIds,
        userId: req.user?.id
      });

      const result = await stripeService.createPaymentIntent({
        amount,
        customerId,
        eventId,
        ticketIds,
        metadata: {
          ...metadata,
          userId: req.user?.id
        }
      });

      if (!result.success) {
        return res.status(400).json(
          paymentErrorResponse(result.error, result.type)
        );
      }

      return res.status(201).json(
        paymentResponse({
          id: result.paymentIntent.id,
          status: result.paymentIntent.status,
          amount: result.paymentIntent.amount,
          currency: result.paymentIntent.currency,
          provider: 'stripe',
          createdAt: new Date().toISOString(),
          clientSecret: result.paymentIntent.clientSecret
        })
      );
    } catch (error) {
      logger.error('Failed to create Stripe Payment Intent', {
        error: error.message,
        userId: req.user?.id
      });

      return res.status(500).json(
        errorResponse('Échec de la création du Payment Intent', null, 'STRIPE_PAYMENT_INTENT_FAILED')
      );
    }
  }

  /**
   * Crée une Checkout Session Stripe
   */
  async createStripeCheckoutSession(req, res) {
    try {
      const { amount, customerId, eventId, ticketIds, successUrl, cancelUrl, metadata = {} } = req.body;
      
      logger.payment('Creating Stripe Checkout Session', {
        amount,
        eventId,
        ticketIds,
        userId: req.user?.id
      });

      const result = await stripeService.createCheckoutSession({
        amount,
        customerId,
        eventId,
        ticketIds,
        successUrl,
        cancelUrl,
        metadata: {
          ...metadata,
          userId: req.user?.id
        }
      });

      if (!result.success) {
        return res.status(400).json(
          paymentErrorResponse(result.error, result.type)
        );
      }

      return res.status(201).json(
        paymentResponse({
          id: result.session.id,
          status: result.session.paymentStatus,
          amount: result.session.amount,
          currency: result.session.currency,
          provider: 'stripe',
          createdAt: new Date().toISOString(),
          redirectUrl: result.session.url
        })
      );
    } catch (error) {
      logger.error('Failed to create Stripe Checkout Session', {
        error: error.message,
        userId: req.user?.id
      });

      return res.status(500).json(
        errorResponse('Échec de la création de la Checkout Session', null, 'STRIPE_CHECKOUT_FAILED')
      );
    }
  }

  /**
   * Crée un ordre PayPal
   */
  async createPayPalOrder(req, res) {
    try {
      const { amount, eventId, ticketIds, returnUrl, cancelUrl, metadata = {} } = req.body;
      
      logger.payment('Creating PayPal Order', {
        amount,
        eventId,
        ticketIds,
        userId: req.user?.id
      });

      const result = await paypalService.createOrder({
        amount,
        eventId,
        ticketIds,
        returnUrl,
        cancelUrl,
        metadata: {
          ...metadata,
          userId: req.user?.id
        }
      });

      if (!result.success) {
        return res.status(400).json(
          paymentErrorResponse(result.error, result.type)
        );
      }

      return res.status(201).json(
        paymentResponse({
          id: result.order.id,
          status: result.order.status,
          amount: result.order.purchaseUnits[0].amount.value,
          currency: result.order.purchaseUnits[0].amount.currency_code,
          provider: 'paypal',
          createdAt: result.order.createTime,
          redirectUrl: result.order.links.find(link => link.rel === 'approve')?.href
        })
      );
    } catch (error) {
      logger.error('Failed to create PayPal Order', {
        error: error.message,
        userId: req.user?.id
      });

      return res.status(500).json(
        errorResponse('Échec de la création de l\'ordre PayPal', null, 'PAYPAL_ORDER_FAILED')
      );
    }
  }

  /**
   * Capture un paiement PayPal
   */
  async capturePayPalPayment(req, res) {
    try {
      const { orderId } = req.params;
      
      logger.payment('Capturing PayPal payment', {
        orderId,
        userId: req.user?.id
      });

      const result = await paypalService.capturePayment(orderId);

      if (!result.success) {
        return res.status(400).json(
          paymentErrorResponse(result.error, result.type)
        );
      }

      return res.status(200).json(
        paymentResponse({
          id: result.capture.id,
          status: result.capture.status,
          amount: result.capture.purchaseUnits[0].payments.captures[0].amount.value,
          currency: result.capture.purchaseUnits[0].payments.captures[0].amount.currency_code,
          provider: 'paypal',
          createdAt: result.capture.createTime
        })
      );
    } catch (error) {
      logger.error('Failed to capture PayPal payment', {
        error: error.message,
        orderId: req.params.orderId
      });

      return res.status(500).json(
        errorResponse('Échec de la capture du paiement PayPal', null, 'PAYPAL_CAPTURE_FAILED')
      );
    }
  }

  /**
   * Récupère les détails d'un paiement
   */
  async getPayment(req, res) {
    try {
      const { paymentId, provider } = req.params;
      
      logger.payment('Retrieving payment details', {
        paymentId,
        provider,
        userId: req.user?.id
      });

      let result;

      switch (provider) {
        case 'stripe':
          result = await stripeService.getPaymentIntent(paymentId);
          break;
        case 'paypal':
          result = await paypalService.getOrder(paymentId);
          break;
        default:
          return res.status(400).json(
            errorResponse('Provider non supporté', null, 'UNSUPPORTED_PROVIDER')
          );
      }

      if (!result.success) {
        return res.status(404).json(
          notFoundResponse('Paiement', paymentId)
        );
      }

      const paymentData = provider === 'stripe' 
        ? result.paymentIntent
        : result.order;

      return res.status(200).json(
        successResponse('Détails du paiement récupérés', {
          id: paymentData.id,
          status: paymentData.status,
          amount: provider === 'stripe' ? paymentData.amount : paymentData.purchaseUnits[0].amount.value,
          currency: provider === 'stripe' ? paymentData.currency : paymentData.purchaseUnits[0].amount.currency_code,
          provider,
          metadata: paymentData.metadata,
          createdAt: provider === 'stripe' ? paymentData.created : paymentData.createTime
        })
      );
    } catch (error) {
      logger.error('Failed to retrieve payment details', {
        error: error.message,
        paymentId: req.params.paymentId,
        provider: req.params.provider
      });

      return res.status(500).json(
        errorResponse('Échec de la récupération des détails du paiement', null, 'PAYMENT_RETRIEVAL_FAILED')
      );
    }
  }

  /**
   * Annule un paiement
   */
  async cancelPayment(req, res) {
    try {
      const { paymentId, provider } = req.params;
      const { reason = 'requested_by_customer' } = req.body;
      
      logger.payment('Cancelling payment', {
        paymentId,
        provider,
        reason,
        userId: req.user?.id
      });

      let result;

      switch (provider) {
        case 'stripe':
          result = await stripeService.cancelPaymentIntent(paymentId, reason);
          break;
        case 'paypal':
          result = await paypalService.cancelOrder(paymentId);
          break;
        default:
          return res.status(400).json(
            errorResponse('Provider non supporté', null, 'UNSUPPORTED_PROVIDER')
          );
      }

      if (!result.success) {
        return res.status(400).json(
          paymentErrorResponse(result.error, result.type)
        );
      }

      return res.status(200).json(
        successResponse('Paiement annulé avec succès', {
          id: result.paymentIntent?.id || result.order?.id,
          status: 'cancelled',
          provider
        })
      );
    } catch (error) {
      logger.error('Failed to cancel payment', {
        error: error.message,
        paymentId: req.params.paymentId,
        provider: req.params.provider
      });

      return res.status(500).json(
        errorResponse('Échec de l\'annulation du paiement', null, 'PAYMENT_CANCELLATION_FAILED')
      );
    }
  }

  /**
   * Crée un client Stripe
   */
  async createStripeCustomer(req, res) {
    try {
      const { email, name, phone, metadata = {} } = req.body;
      
      logger.payment('Creating Stripe customer', {
        email,
        name,
        userId: req.user?.id
      });

      const result = await stripeService.createCustomer({
        email,
        name,
        phone,
        metadata: {
          ...metadata,
          userId: req.user?.id
        }
      });

      if (!result.success) {
        return res.status(400).json(
          providerErrorResponse(result.error, 'stripe')
        );
      }

      return res.status(201).json(
        successResponse('Client Stripe créé avec succès', result.customer)
      );
    } catch (error) {
      logger.error('Failed to create Stripe customer', {
        error: error.message,
        userId: req.user?.id
      });

      return res.status(500).json(
        errorResponse('Échec de la création du client Stripe', null, 'STRIPE_CUSTOMER_CREATION_FAILED')
      );
    }
  }

  /**
   * Récupère un client Stripe
   */
  async getStripeCustomer(req, res) {
    try {
      const { customerId } = req.params;
      
      logger.payment('Retrieving Stripe customer', {
        customerId,
        userId: req.user?.id
      });

      const result = await stripeService.getCustomer(customerId);

      if (!result.success) {
        return res.status(404).json(
          notFoundResponse('Client Stripe', customerId)
        );
      }

      return res.status(200).json(
        successResponse('Client Stripe récupéré', result.customer)
      );
    } catch (error) {
      logger.error('Failed to retrieve Stripe customer', {
        error: error.message,
        customerId: req.params.customerId
      });

      return res.status(500).json(
        errorResponse('Échec de la récupération du client Stripe', null, 'STRIPE_CUSTOMER_RETRIEVAL_FAILED')
      );
    }
  }

  /**
   * Crée une méthode de paiement Stripe
   */
  async createStripePaymentMethod(req, res) {
    try {
      const { customerId, paymentMethodData } = req.body;
      
      logger.payment('Creating Stripe payment method', {
        customerId,
        type: paymentMethodData.type,
        userId: req.user?.id
      });

      const result = await stripeService.createPaymentMethod(customerId, paymentMethodData);

      if (!result.success) {
        return res.status(400).json(
          providerErrorResponse(result.error, 'stripe')
        );
      }

      return res.status(201).json(
        successResponse('Méthode de paiement Stripe créée', result.paymentMethod)
      );
    } catch (error) {
      logger.error('Failed to create Stripe payment method', {
        error: error.message,
        customerId: req.body.customerId
      });

      return res.status(500).json(
        errorResponse('Échec de la création de la méthode de paiement', null, 'PAYMENT_METHOD_CREATION_FAILED')
      );
    }
  }

  /**
   * Liste les méthodes de paiement d'un client
   */
  async listStripePaymentMethods(req, res) {
    try {
      const { customerId } = req.params;
      const { type = 'card' } = req.query;
      
      logger.payment('Listing Stripe payment methods', {
        customerId,
        type,
        userId: req.user?.id
      });

      const result = await stripeService.listPaymentMethods(customerId, type);

      if (!result.success) {
        return res.status(400).json(
          providerErrorResponse(result.error, 'stripe')
        );
      }

      return res.status(200).json(
        successResponse('Méthodes de paiement récupérées', {
          paymentMethods: result.paymentMethods,
          count: result.paymentMethods.length
        })
      );
    } catch (error) {
      logger.error('Failed to list Stripe payment methods', {
        error: error.message,
        customerId: req.params.customerId
      });

      return res.status(500).json(
        errorResponse('Échec de la récupération des méthodes de paiement', null, 'PAYMENT_METHODS_LIST_FAILED')
      );
    }
  }

  /**
   * Crée un remboursement
   */
  async createRefund(req, res) {
    try {
      const { paymentId, paymentProvider, amount, reason, metadata = {} } = req.body;
      
      logger.refund('Creating refund', {
        paymentId,
        paymentProvider,
        amount,
        reason,
        userId: req.user?.id
      });

      const result = await refundService.createRefund({
        paymentId,
        paymentProvider,
        amount,
        reason,
        metadata: {
          ...metadata,
          userId: req.user?.id
        },
        userId: req.user?.id
      });

      if (!result.success) {
        return res.status(400).json(
          paymentErrorResponse(result.error, result.type)
        );
      }

      return res.status(201).json(
        refundResponse(result.refund)
      );
    } catch (error) {
      logger.error('Failed to create refund', {
        error: error.message,
        paymentId: req.body.paymentId,
        paymentProvider: req.body.paymentProvider
      });

      return res.status(500).json(
        errorResponse('Échec de la création du remboursement', null, 'REFUND_CREATION_FAILED')
      );
    }
  }

  /**
   * Récupère les détails d'un remboursement
   */
  async getRefund(req, res) {
    try {
      const { refundId, provider } = req.params;
      
      logger.refund('Retrieving refund details', {
        refundId,
        provider,
        userId: req.user?.id
      });

      const result = await refundService.getRefund(refundId, provider);

      if (!result.success) {
        return res.status(404).json(
          notFoundResponse('Remboursement', refundId)
        );
      }

      return res.status(200).json(
        successResponse('Détails du remboursement récupérés', result.refund)
      );
    } catch (error) {
      logger.error('Failed to retrieve refund details', {
        error: error.message,
        refundId: req.params.refundId,
        provider: req.params.provider
      });

      return res.status(500).json(
        errorResponse('Échec de la récupération des détails du remboursement', null, 'REFUND_RETRIEVAL_FAILED')
      );
    }
  }

  /**
   * Liste les remboursements d'un utilisateur
   */
  async listUserRefunds(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;
      
      logger.refund('Listing user refunds', {
        userId: req.user?.id,
        page,
        limit
      });

      const result = await refundService.listUserRefunds(req.user?.id, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      if (!result.success) {
        return res.status(400).json(
          errorResponse(result.error, null, result.type)
        );
      }

      return res.status(200).json(
        successResponse('Remboursements récupérés', {
          refunds: result.refunds,
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total
          }
        })
      );
    } catch (error) {
      logger.error('Failed to list user refunds', {
        error: error.message,
        userId: req.user?.id
      });

      return res.status(500).json(
        errorResponse('Échec de la récupération des remboursements', null, 'REFUNDS_LIST_FAILED')
      );
    }
  }

  /**
   * Génère une facture
   */
  async generateInvoice(req, res) {
    try {
      const { customerId, eventId, ticketIds, amount, customerInfo, eventInfo, metadata = {} } = req.body;
      
      logger.invoice('Generating invoice', {
        customerId,
        eventId,
        amount,
        userId: req.user?.id
      });

      const result = await invoiceService.generateAndSaveInvoice({
        customerId,
        eventId,
        ticketIds,
        amount,
        customerInfo,
        eventInfo,
        metadata: {
          ...metadata,
          userId: req.user?.id
        }
      });

      if (!result.success) {
        return res.status(400).json(
          errorResponse(result.error, null, result.type)
        );
      }

      return res.status(201).json(
        invoiceResponse({
          id: result.invoice.id,
          invoiceNumber: result.invoice.invoiceNumber,
          status: result.invoice.status,
          amount: result.invoice.amounts.total,
          dueDate: result.invoice.dueDate,
          pdfUrl: `/api/payments/invoices/${result.invoice.id}/download`,
          createdAt: result.invoice.createdAt
        })
      );
    } catch (error) {
      logger.error('Failed to generate invoice', {
        error: error.message,
        userId: req.user?.id
      });

      return res.status(500).json(
        errorResponse('Échec de la génération de la facture', null, 'INVOICE_GENERATION_FAILED')
      );
    }
  }

  /**
   * Télécharge une facture PDF
   */
  async downloadInvoice(req, res) {
    try {
      const { invoiceId } = req.params;
      
      logger.invoice('Downloading invoice PDF', {
        invoiceId,
        userId: req.user?.id
      });

      // Pour l'instant, retourne une erreur car nous n'avons pas de base de données
      // Dans une implémentation complète, cela récupérerait la facture et le PDF
      
      return res.status(404).json(
        notFoundResponse('Facture', invoiceId)
      );
    } catch (error) {
      logger.error('Failed to download invoice PDF', {
        error: error.message,
        invoiceId: req.params.invoiceId
      });

      return res.status(500).json(
        errorResponse('Échec du téléchargement de la facture', null, 'INVOICE_DOWNLOAD_FAILED')
      );
    }
  }

  /**
   * Vérifie la santé du service de paiement
   */
  async healthCheck(req, res) {
    try {
      const [stripeHealth, paypalHealth, invoiceHealth, refundHealth] = await Promise.all([
        stripeService.healthCheck(),
        paypalService.healthCheck(),
        invoiceService.healthCheck(),
        refundService.healthCheck()
      ]);

      const overallHealthy = stripeHealth.healthy || paypalHealth.healthy;

      return res.status(200).json(
        successResponse('Service de paiement opérationnel', {
          stripe: stripeHealth,
          paypal: paypalHealth,
          invoice: invoiceHealth,
          refund: refundHealth,
          overall: {
            healthy: overallHealthy,
            providers: {
              stripe: stripeHealth.healthy,
              paypal: paypalHealth.healthy
            }
          }
        })
      );
    } catch (error) {
      logger.error('Health check failed', {
        error: error.message
      });

      return res.status(503).json(
        errorResponse('Service de paiement indisponible', null, 'HEALTH_CHECK_FAILED')
      );
    }
  }

  /**
   * Récupère les statistiques du service
   */
  async getStats(req, res) {
    try {
      const [stripeStats, paypalStats, invoiceStats, refundStats] = await Promise.all([
        stripeService.getStats(),
        paypalService.getStats(),
        invoiceService.getStats(),
        refundService.getStats()
      ]);

      return res.status(200).json(
        successResponse('Statistiques du service de paiement', {
          stripe: stripeStats,
          paypal: paypalStats,
          invoice: invoiceStats,
          refund: refundStats
        })
      );
    } catch (error) {
      logger.error('Failed to get service stats', {
        error: error.message
      });

      return res.status(500).json(
        errorResponse('Échec de la récupération des statistiques', null, 'STATS_FAILED')
      );
    }
  }
}

module.exports = new PaymentsController();
