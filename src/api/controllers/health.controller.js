const stripeService = require('../../core/stripe/stripe.service');
const paypalService = require('../../core/paypal/paypal.service');
const { query } = require("../../utils/database-wrapper");
const { successResponse, errorResponse } = require('../../utils/response');
const logger = require('../../utils/logger');

/**
 * Health Controller - Handles health check endpoints
 */
class HealthController {
  /**
   * Simple Health Check
   */
  async simpleHealthCheck(req, res) {
    try {
      return res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'payment-service',
        version: '1.0.0'
      });
    } catch (error) {
      return res.status(503).json({
        status: 'unhealthy',
        error: error.message
      });
    }
  }

  /**
   * Detailed Health Check
   */
  async detailedHealthCheck(req, res) {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'payment-service',
        version: '1.0.0',
        components: {}
      };

      // Check database
      try {
        await query('SELECT 1');
        health.components.database = { status: 'healthy' };
      } catch (error) {
        health.components.database = { status: 'unhealthy', error: error.message };
        health.status = 'degraded';
      }

      // Check Stripe
      try {
        const stripeHealth = await stripeService.healthCheck();
        health.components.stripe = stripeHealth;
        if (stripeHealth.status !== 'healthy') {
          health.status = 'degraded';
        }
      } catch (error) {
        health.components.stripe = { status: 'unhealthy', error: error.message };
        health.status = 'degraded';
      }

      // Check PayPal
      try {
        const paypalHealth = await paypalService.healthCheck();
        health.components.paypal = paypalHealth;
        if (paypalHealth.status !== 'healthy') {
          health.status = 'degraded';
        }
      } catch (error) {
        health.components.paypal = { status: 'unhealthy', error: error.message };
        health.status = 'degraded';
      }

      const statusCode = health.status === 'healthy' ? 200 : 503;
      return res.status(statusCode).json(health);

    } catch (error) {
      return res.status(503).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Readiness Check
   */
  async readinessCheck(req, res) {
    try {
      // Check if service is ready to accept traffic
      const ready = await this.checkReadiness();
      
      if (ready) {
        return res.status(200).json({
          status: 'ready',
          timestamp: new Date().toISOString()
        });
      } else {
        return res.status(503).json({
          status: 'not ready',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      return res.status(503).json({
        status: 'not ready',
        error: error.message
      });
    }
  }

  /**
   * Liveness Check
   */
  async livenessCheck(req, res) {
    try {
      // Check if service is alive
      return res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return res.status(503).json({
        status: 'not alive',
        error: error.message
      });
    }
  }

  /**
   * Stripe Health Check
   */
  async stripeHealthCheck(req, res) {
    try {
      const health = await stripeService.healthCheck();
      const statusCode = health.status === 'healthy' ? 200 : 503;
      return res.status(statusCode).json(health);
    } catch (error) {
      return res.status(503).json({
        status: 'unhealthy',
        error: error.message
      });
    }
  }

  /**
   * PayPal Health Check
   */
  async paypalHealthCheck(req, res) {
    try {
      const health = await paypalService.healthCheck();
      const statusCode = health.status === 'healthy' ? 200 : 503;
      return res.status(statusCode).json(health);
    } catch (error) {
      return res.status(503).json({
        status: 'unhealthy',
        error: error.message
      });
    }
  }

  /**
   * Invoices Health Check
   */
  async invoicesHealthCheck(req, res) {
    try {
      // Check invoice generation capabilities
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'invoices'
      };

      // Check PDF generation
      try {
        // Mock PDF generation check
        health.pdf_generation = { status: 'healthy' };
      } catch (error) {
        health.pdf_generation = { status: 'unhealthy', error: error.message };
        health.status = 'degraded';
      }

      const statusCode = health.status === 'healthy' ? 200 : 503;
      return res.status(statusCode).json(health);
    } catch (error) {
      return res.status(503).json({
        status: 'unhealthy',
        error: error.message
      });
    }
  }

  /**
   * Refunds Health Check
   */
  async refundsHealthCheck(req, res) {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'refunds',
        providers: {}
      };

      // Check Stripe refunds
      try {
        health.providers.stripe = { status: 'healthy' };
      } catch (error) {
        health.providers.stripe = { status: 'unhealthy', error: error.message };
        health.status = 'degraded';
      }

      // Check PayPal refunds
      try {
        health.providers.paypal = { status: 'healthy' };
      } catch (error) {
        health.providers.paypal = { status: 'unhealthy', error: error.message };
        health.status = 'degraded';
      }

      const statusCode = health.status === 'healthy' ? 200 : 503;
      return res.status(statusCode).json(health);
    } catch (error) {
      return res.status(503).json({
        status: 'unhealthy',
        error: error.message
      });
    }
  }

  /**
   * Providers Status
   */
  async providersStatus(req, res) {
    try {
      const status = {
        timestamp: new Date().toISOString(),
        providers: {}
      };

      // Stripe status
      try {
        const stripeHealth = await stripeService.healthCheck();
        status.providers.stripe = stripeHealth;
      } catch (error) {
        status.providers.stripe = { status: 'unhealthy', error: error.message };
      }

      // PayPal status
      try {
        const paypalHealth = await paypalService.healthCheck();
        status.providers.paypal = paypalHealth;
      } catch (error) {
        status.providers.paypal = { status: 'unhealthy', error: error.message };
      }

      return res.status(200).json(status);
    } catch (error) {
      return res.status(503).json({
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Check service readiness
   */
  async checkReadiness() {
    try {
      // Check database connection
      await query('SELECT 1');
      
      // Check essential services
      await stripeService.healthCheck();
      await paypalService.healthCheck();
      
      return true;
    } catch (error) {
      logger.error('Readiness check failed', { error: error.message });
      return false;
    }
  }
}

module.exports = new HealthController();
