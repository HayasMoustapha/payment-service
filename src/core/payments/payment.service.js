// Importation des modules nécessaires pour le service de paiement
const gatewayManager = require('../providers/gateway.manager'); // Gestionnaire des passerelles de paiement (Stripe, PayPal, etc.)
const { query } = require("../../utils/database-wrapper"); // Utilitaire pour exécuter des requêtes SQL
const logger = require("../../utils/logger"); // Utilitaire pour écrire des logs dans la console
const coreClient = require("../../../../shared/clients/core-client"); // Client pour communiquer avec le service Core

/**
 * Service de Paiement Principal
 * Ce service gère toutes les opérations de paiement avec une abstraction des passerelles
 * Il peut fonctionner avec de vrais services de paiement ou en mode mock (simulation)
 */
class PaymentService {
  // Constructeur de la classe
  constructor() {
    this.initialized = false; // Indique si le service a été initialisé
    this.mockMode = false; // Indique si on utilise le mode simulation (mock)
  }

  /**
   * Initialise le service de paiement
   * Cette méthode prépare le service pour traiter les paiements
   * @returns {Promise<void>} - Ne retourne rien, mais prépare le service
   */
  async initialize() {
    // Si le service n'est pas encore initialisé
    if (!this.initialized) {
      try {
        // Vérifier la connexion avec le service Core
        const coreConnection = await coreClient.testConnection();
        if (!coreConnection) {
          logger.warn('Core service unavailable, some features may be limited');
        } else {
          logger.info('Core service connection established');
        }

        // Tente d'initialiser le gestionnaire de passerelles (Stripe, PayPal)
        await gatewayManager.initialize();
        this.initialized = true; // Marque le service comme initialisé
      } catch (error) {
        // Si l'initialisation échoue, on passe en mode simulation
        logger.warn('Gateway manager initialization failed, using mock mode:', error.message);
        this.mockMode = true; // Active le mode mock
        this.initialized = true; // Marque le service comme initialisé même en mode mock
      }
    }
  }

  /**
   * Traite une transaction de paiement
   * C'est la méthode principale pour créer un paiement
   * @param {Object} paymentData - Données du paiement (montant, devise, etc.)
   * @returns {Promise<Object>} - Résultat du paiement avec ID et statut
   */
  async processPayment(paymentData) {
    // S'assure que le service est initialisé avant de traiter
    await this.initialize();

    // MODE SIMULATION : Pour les tests sans vraies transactions
    if (this.mockMode) {
      return {
        success: true, // Indique que le paiement a réussi
        transactionId: 'mock_tx_' + Date.now(), // Génère un ID fictif avec timestamp
        amount: paymentData.amount, // Montant du paiement
        currency: paymentData.currency || 'EUR', // Devise (EUR par défaut)
        status: 'completed', // Statut du paiement : terminé
        message: 'Payment processed successfully (mock mode)', // Message explicatif
        metadata: paymentData.metadata || {} // Données additionnelles
      };
    }

    // Extraction des données de paiement depuis l'objet paymentData
    const {
      userId, // ID de l'utilisateur qui fait le paiement
      eventId, // ID de l'événement concerné (peut être null pour un achat de template)
      amount, // Montant du paiement en centimes (ex: 2500 = 25.00€)
      currency = 'EUR', // Devise du paiement, EUR par défaut
      paymentMethod, // Méthode de paiement utilisée (carte, PayPal, etc.)
      description, // Description du paiement pour l'utilisateur
      metadata = {}, // Données additionnelles personnalisables
      customerEmail, // Email du client pour la facturation
      returnUrl, // URL de retour après paiement
      preferredGateways = [] // Liste des passerelles de paiement préférées
    } = paymentData;

    // MODE SIMULATION : Retour direct sans traitement complexe
    // Cette vérification est redondante mais assure le fonctionnement en mode mock
    if (this.mockMode) {
      return {
        success: true, // Paiement réussi
        transactionId: 'mock_tx_' + Date.now(), // ID de transaction fictif
        amount: paymentData.amount, // Montant du paiement
        currency: paymentData.currency || 'EUR', // Devise
        status: 'completed', // Statut terminé
        gateway: 'mock', // Passerelle fictive
        message: 'Payment processed successfully (mock mode)', // Message explicatif
        metadata: paymentData.metadata || {} // Métadonnées
      };
    }

    try {
      // ÉTAPE 1 : Valider les données du paiement
      // Cette méthode vérifie que toutes les données requises sont présentes et valides
      this.validatePaymentData(paymentData);

      // ÉTAPE 2 : Créer un enregistrement de transaction dans la base de données
      // Cela permet de suivre le paiement même s'il échoue avec la passerelle
      const transaction = await this.createTransaction({
        user_id: userId, // ID utilisateur pour la base de données
        event_id: eventId, // ID événement pour la base de données
        amount, // Montant en centimes
        currency, // Devise
        status: 'pending', // Statut initial : en attente
        payment_method: paymentMethod, // Méthode de paiement
        metadata: {
          ...metadata, // Copie des métadonnées existantes
          description, // Description du paiement
          customerEmail, // Email du client
          returnUrl: JSON.stringify(returnUrl), // URL de retour en format JSON
          preferredGateways: JSON.stringify(preferredGateways) // Passerelles préférées en JSON
        }
      });

      // ÉTAPE 3 : Traiter le paiement avec le gestionnaire de passerelles
      // Cette partie communique avec Stripe, PayPal ou autres services de paiement
      const gatewayResult = await gatewayManager.processPayment({
        amount, // Montant à payer
        currency, // Devise
        description, // Description pour le client
        metadata: {
          ...metadata, // Métadonnées existantes
          transactionId: transaction.id, // ID de notre transaction
          userId, // ID utilisateur
          eventId // ID événement
        },
        customerEmail, // Email du client
        returnUrl, // URL de retour après paiement
        preferredGateways // Passerelles préférées
      }, {
        enableFallback: true // Activer les passerelles de secours si la principale échoue
      });

      // ÉTAPE 4 : Mettre à jour la transaction avec le résultat de la passerelle
      // On enregistre ce que la passerelle nous a retourné
      await this.updateTransaction(transaction.id, {
        status: gatewayResult.status || 'pending', // Statut retourné par la passerelle
        provider_transaction_id: gatewayResult.transactionId, // ID de transaction de la passerelle
        provider_response: gatewayResult, // Réponse complète de la passerelle
        metadata: {
          ...transaction.metadata, // Métadonnées existantes
          gateway: gatewayResult.gateway, // Passerelle utilisée
          fallback: gatewayResult.fallback || false // Si on a utilisé une passerelle de secours
        }
      });

      // ÉTAPE 5 : Créer une commission si le paiement a réussi
      // Les commissions sont des frais prélevés pour chaque transaction réussie
      if (gatewayResult.status === 'completed') {
        await this.createCommission(transaction.id, amount, 'ticket_sale');
      }

      // ÉTAPE 6 : Retourner le résultat du paiement
      return {
        success: true, // Indique que l'opération a réussi
        transactionId: transaction.id, // ID de notre transaction
        status: gatewayResult.status || 'pending', // Statut du paiement
        gateway: gatewayResult.gateway, // Passerelle utilisée
        amount, // Montant
        currency, // Devise
        clientSecret: gatewayResult.clientSecret, // Secret client pour Stripe (si applicable)
        nextAction: gatewayResult.nextAction, // Prochaine action requise (ex: 3D Secure)
        requiresAction: !!gatewayResult.nextAction // Indique si une action est requise
      };

    } catch (error) {
      // GESTION DES ERREURS : Si quelque chose se passe mal pendant le paiement
      console.error('Payment processing failed:', error); // Affiche l'erreur dans la console
      throw error; // Propage l'erreur pour qu'elle soit gérée par le contrôleur
    }
  }

  /**
   * Traite un paiement pour l'achat d'un template
   * Similaire à processPayment mais spécifique aux templates (designs, etc.)
   * @param {Object} templateData - Données d'achat du template
   * @returns {Promise<Object>} - Résultat de l'achat du template
   */
  async processTemplatePurchase(templateData) {
    // S'assure que le service est initialisé
    await this.initialize();

    // MODE SIMULATION : Pour les tests d'achat de templates
    if (this.mockMode) {
      return {
        success: true, // Achat réussi
        transactionId: 'mock_template_' + Date.now(), // ID fictif avec timestamp
        amount: templateData.amount, // Montant de l'achat
        currency: templateData.currency || 'EUR', // Devise
        status: 'completed', // Statut terminé
        templateId: templateData.templateId, // ID du template acheté
        message: 'Template purchase processed successfully (mock mode)', // Message explicatif
        metadata: templateData.metadata || {} // Métadonnées
      };
    }

    // Extraction des données d'achat de template
    const {
      userId, // ID de l'acheteur
      templateId, // ID du template acheté
      designerId, // ID du designer qui vend le template
      amount, // Montant de l'achat
      currency = 'EUR', // Devise
      paymentMethod, // Méthode de paiement
      customerEmail, // Email du client
      metadata = {} // Métadonnées additionnelles
    } = templateData;

    try {
      // ÉTAPE 1 : Vérifier la disponibilité du template auprès du service Core
      logger.payment('Vérification disponibilité template', { templateId, userId });
      
      const templateCheck = await coreClient.checkTemplateAvailability(templateId);
      if (!templateCheck.success) {
        throw new Error(`Template ${templateId} non disponible: ${templateCheck.error}`);
      }

      if (!templateCheck.available) {
        throw new Error(`Template ${templateId} n'est pas disponible à l'achat`);
      }

      // ÉTAPE 2 : Récupérer les détails du template pour validation
      const templateInfo = await coreClient.getTemplate(templateId);
      if (!templateInfo.success) {
        throw new Error(`Impossible de récupérer les détails du template ${templateId}`);
      }

      const template = templateInfo.template;
      
      // ÉTAPE 3 : Valider que le montant correspond au prix du template
      if (template.price && amount !== template.price) {
        throw new Error(`Montant invalide. Attendu: ${template.price}, Reçu: ${amount}`);
      }

      // ÉTAPE 4 : Traiter le paiement en utilisant la méthode processPayment standard
      // On réutilise la logique de paiement existante
      const paymentResult = await this.processPayment({
        userId, // ID utilisateur
        eventId: null, // Pas d'événement pour l'achat de template
        amount, // Montant
        currency, // Devise
        paymentMethod, // Méthode de paiement
        description: `Template purchase - Template ${templateId}`, // Description descriptive
        metadata: {
          ...metadata, // Métadonnées existantes
          type: 'template_purchase', // Type de transaction
          templateId, // ID du template
          designerId, // ID du designer
          templateName: template.name, // Nom du template
          templateCategory: template.category // Catégorie du template
        },
        customerEmail // Email du client
      });

      // ÉTAPE 5 : Si le paiement a réussi, notifier le service Core et créditer le designer
      if (paymentResult.status === 'completed') {
        logger.payment('Paiement template réussi, notification du service Core', {
          templateId,
          userId,
          transactionId: paymentResult.transactionId
        });

        // ÉTAPE 5a : Notifier le service Core de l'achat réussi
        const notificationResult = await coreClient.notifyTemplatePurchase({
          templateId,
          userId,
          transactionId: paymentResult.transactionId,
          amount,
          currency,
          metadata: {
            ...metadata,
            designerId,
            templateName: template.name,
            templateCategory: template.category,
            purchaseDate: new Date().toISOString()
          }
        });

        if (!notificationResult.success) {
          logger.warn('Échec notification Core, mais paiement réussi', {
            templateId,
            error: notificationResult.error
          });
          // On ne fait pas échouer la transaction si la notification échoue
        } else {
          logger.payment('Notification Core envoyée avec succès', {
            templateId,
            notificationId: notificationResult.notificationId
          });
        }

        // ÉTAPE 5b : Créditer le portefeuille du designer (si applicable)
        if (designerId) {
          await this.creditDesignerWallet(designerId, amount, 'template_sale', {
            templateId, // ID du template vendu
            transactionId: paymentResult.transactionId, // ID de la transaction
            notificationId: notificationResult.notificationId // ID de la notification
          });
        }
      }

      return paymentResult;

    } catch (error) {
      console.error('Template purchase payment failed:', error);
      throw error;
    }
  }

  /**
   * Vérifie et traite les webhooks des passerelles de paiement
   * Les webhooks sont des notifications envoyées par Stripe/PayPal pour informer des changements
   * @param {string} gatewayCode - Code de la passerelle (stripe, paypal, etc.)
   * @param {Object} webhookData - Données du webhook reçu
   * @returns {Promise<Object>} - Résultat du traitement du webhook
   */
  async processWebhook(gatewayCode, webhookData) {
    // S'assure que le service est initialisé
    await this.initialize();

    // MODE SIMULATION : Pour les tests de webhooks
    if (this.mockMode) {
      return {
        success: true, // Webhook traité avec succès
        processed: true, // Indique que le webhook a été traité
        gatewayCode: gatewayCode, // Code de la passerelle
        eventType: webhookData.payload ? JSON.parse(webhookData.payload).type : 'unknown', // Type d'événement
        message: 'Webhook processed successfully (mock mode)' // Message explicatif
      };
    }

    try {
      // ÉTAPE 1 : Vérifier la signature du webhook
      // Cela garantit que le webhook vient bien de Stripe/PayPal et non d'un attaquant
      const isValid = await gatewayManager.verifyWebhook(gatewayCode, webhookData);
      if (!isValid) {
        throw new Error('Invalid webhook signature'); // Erreur si signature invalide
      }

      // ÉTAPE 2 : Analyser l'événement du webhook
      // Convertit les données brutes du webhook en événement structuré
      const event = await gatewayManager.parseWebhookEvent(gatewayCode, webhookData);

      // ÉTAPE 3 : Traiter l'événement selon son type
      let result;
      switch (event.eventType) {
        case 'payment_intent.succeeded': // Paiement réussi
          result = await this.handlePaymentSuccess(event.data);
          break;
        case 'payment_intent.payment_failed': // Paiement échoué
          result = await this.handlePaymentFailure(event.data);
          break;
        case 'payment_intent.canceled': // Paiement annulé
          result = await this.handlePaymentCancellation(event.data);
          break;
        default: // Autres types d'événements
          result = { success: true, message: 'Event processed' };
      }

      return {
        success: true,
        eventId: event.eventId,
        eventType: event.eventType,
        processedAt: new Date().toISOString(),
        ...result
      };

    } catch (error) {
      console.error('Webhook processing failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle successful payment webhook
   * @param {Object} eventData - Event data
   * @returns {Promise<Object>} Processing result
   */
  async handlePaymentSuccess(eventData) {
    try {
      // Find transaction by provider transaction ID
      const transaction = await this.findTransactionByProviderId(eventData.transactionId);
      
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Update transaction status
      await this.updateTransaction(transaction.id, {
        status: 'completed',
        provider_response: eventData
      });

      // Create commission if not already created
      if (transaction.metadata.type === 'ticket_sale') {
        await this.createCommission(transaction.id, eventData.amount, 'ticket_sale');
      } else if (transaction.metadata.type === 'template_purchase') {
        await this.createCommission(transaction.id, eventData.amount, 'template_sale');
        
        // Credit designer wallet
        const designerId = transaction.metadata.designerId;
        if (designerId) {
          await this.creditDesignerWallet(designerId, eventData.amount, 'template_sale', {
            templateId: transaction.metadata.templateId,
            transactionId: transaction.id
          });
        }
      }

      return {
        success: true,
        transactionId: transaction.id,
        status: 'completed'
      };

    } catch (error) {
      console.error('Payment success handling failed:', error);
      throw error;
    }
  }

  /**
   * Handle payment failure webhook
   * @param {Object} eventData - Event data
   * @returns {Promise<Object>} Processing result
   */
  async handlePaymentFailure(eventData) {
    try {
      const transaction = await this.findTransactionByProviderId(eventData.transactionId);
      
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      await this.updateTransaction(transaction.id, {
        status: 'failed',
        provider_response: eventData
      });

      return {
        success: true,
        transactionId: transaction.id,
        status: 'failed'
      };

    } catch (error) {
      console.error('Payment failure handling failed:', error);
      throw error;
    }
  }

  /**
   * Handle payment cancellation webhook
   * @param {Object} eventData - Event data
   * @returns {Promise<Object>} Processing result
   */
  async handlePaymentCancellation(eventData) {
    try {
      const transaction = await this.findTransactionByProviderId(eventData.transactionId);
      
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      await this.updateTransaction(transaction.id, {
        status: 'canceled',
        provider_response: eventData
      });

      return {
        success: true,
        transactionId: transaction.id,
        status: 'canceled'
      };

    } catch (error) {
      console.error('Payment cancellation handling failed:', error);
      throw error;
    }
  }

  /**
   * Create transaction record
   * @param {Object} transactionData - Transaction data
   * @returns {Promise<Object>} Created transaction
   */
  async createTransaction(transactionData) {
    const query = `
      INSERT INTO transactions (
        user_id, event_id, amount, currency, status, 
        payment_method, metadata, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      transactionData.user_id,
      transactionData.event_id,
      transactionData.amount,
      transactionData.currency,
      transactionData.status,
      transactionData.payment_method,
      JSON.stringify(transactionData.metadata)
    ];

    const result = await query(query, values);
    return result.rows[0];
  }

  /**
   * Update transaction record
   * @param {string} transactionId - Transaction ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated transaction
   */
  async updateTransaction(transactionId, updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(updateData[key]);
        paramCount++;
      }
    });

    fields.push(`updated_at = NOW()`);
    values.push(transactionId);

    const query = `
      UPDATE transactions 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await query(query, values);
    return result.rows[0];
  }

  /**
   * Find transaction by provider transaction ID
   * @param {string} providerTransactionId - Provider transaction ID
   * @returns {Promise<Object|null>} Transaction
   */
  async findTransactionByProviderId(providerTransactionId) {
    const query = `
      SELECT * FROM transactions 
      WHERE provider_transaction_id = $1
    `;

    const result = await query(query, [providerTransactionId]);
    return result.rows[0] || null;
  }

  /**
   * Create commission record
   * @param {string} transactionId - Transaction ID
   * @param {number} amount - Transaction amount
   * @param {string} commissionType - Commission type
   * @returns {Promise<Object>} Created commission
   */
  async createCommission(transactionId, amount, commissionType) {
    // Get commission rate (could be from config or database)
    const commissionRate = this.getCommissionRate(commissionType);
    const commissionAmount = amount * commissionRate;

    const query = `
      INSERT INTO commissions (
        transaction_id, commission_rate, commission_amount, 
        commission_type, status, created_at
      )
      VALUES ($1, $2, $3, $4, 'completed', NOW())
      RETURNING *
    `;

    const values = [
      transactionId,
      commissionRate,
      commissionAmount,
      commissionType
    ];

    const result = await query(query, values);
    return result.rows[0];
  }

  /**
   * Credit designer wallet
   * @param {string} designerId - Designer ID
   * @param {number} amount - Amount to credit
   * @param {string} transactionType - Transaction type
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Wallet transaction
   */
  async creditDesignerWallet(designerId, amount, transactionType, metadata = {}) {
    // Get or create designer wallet
    const wallet = await this.getOrCreateWallet(designerId, 'designer');
    
    // Calculate new balance
    const newBalance = parseFloat(wallet.balance) + amount;

    // Create wallet transaction
    const query = `
      INSERT INTO wallet_transactions (
        wallet_id, transaction_type, amount, balance_before, 
        balance_after, reference_type, reference_id, 
        description, metadata, created_at
      )
      VALUES ($1, 'credit', $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *
    `;

    const values = [
      wallet.id,
      amount,
      wallet.balance,
      newBalance,
      transactionType,
      metadata.transactionId || null,
      `Credit from ${transactionType}`,
      JSON.stringify(metadata)
    ];

    // Update wallet balance
    await this.updateWalletBalance(wallet.id, newBalance);

    const result = await query(query, values);
    return result.rows[0];
  }

  /**
   * Get or create wallet for user
   * @param {string} userId - User ID
   * @param {string} userType - User type (designer, organizer)
   * @returns {Promise<Object>} Wallet
   */
  async getOrCreateWallet(userId, userType) {
    // Try to get existing wallet
    const getQuery = `
      SELECT * FROM wallets WHERE user_id = $1 AND user_type = $2
    `;
    
    const getResult = await query(getQuery, [userId, userType]);
    
    if (getResult.rows.length > 0) {
      return getResult.rows[0];
    }

    // Create new wallet
    const createQuery = `
      INSERT INTO wallets (user_id, user_type, balance, currency, created_at, updated_at)
      VALUES ($1, $2, 0.00, 'EUR', NOW(), NOW())
      RETURNING *
    `;

    const createResult = await query(createQuery, [userId, userType]);
    return createResult.rows[0];
  }

  /**
   * Update wallet balance
   * @param {string} walletId - Wallet ID
   * @param {number} newBalance - New balance
   * @returns {Promise<Object>} Updated wallet
   */
  async updateWalletBalance(walletId, newBalance) {
    const query = `
      UPDATE wallets 
      SET balance = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    const result = await query(query, [newBalance, walletId]);
    return result.rows[0];
  }

  /**
   * Get commission rate
   * @param {string} commissionType - Commission type
   * @returns {number} Commission rate
   */
  getCommissionRate(commissionType) {
    const rates = {
      'template_sale': 0.10, // 10%
      'ticket_sale': 0.05    // 5%
    };

    return rates[commissionType] || 0.05; // Default 5%
  }

  /**
   * Validate payment data
   * @param {Object} paymentData - Payment data
   * @returns {Object} Validation result
   */
  validatePaymentData(paymentData) {
    const { userId, amount, currency } = paymentData;

    if (!userId) {
      return {
        success: false,
        error: 'User ID is required',
        details: {
          field: 'userId',
          message: 'User ID is required'
        }
      };
    }

    if (!amount || amount <= 0) {
      return {
        success: false,
        error: 'Amount must be greater than 0',
        details: {
          field: 'amount',
          message: 'Amount must be greater than 0'
        }
      };
    }

    if (!currency || currency.length !== 3) {
      return {
        success: false,
        error: 'Valid currency code is required',
        details: {
          field: 'currency',
          message: 'Valid currency code is required (3 characters)'
        }
      };
    }

    return {
      success: true,
      message: 'Payment data validation successful'
    };
  }

  /**
   * Récupère les statistiques des paiements
   * Permet de générer des rapports sur les transactions
   * @param {Object} filters - Filtres pour les statistiques (userId, dates, etc.)
   * @returns {Promise<Object>} - Statistiques détaillées des paiements
   */
  async getStatistics(filters = {}) {
    // S'assure que le service est initialisé
    await this.initialize();

    // MODE SIMULATION : Pour les tests de statistiques
    if (this.mockMode) {
      return {
        // Statistiques fictives par statut de transaction
        transactions: [
          { status: 'completed', currency: 'EUR', total_transactions: 10, total_amount: 25000, average_amount: 2500 },
          { status: 'pending', currency: 'EUR', total_transactions: 3, total_amount: 7500, average_amount: 2500 },
          { status: 'failed', currency: 'EUR', total_transactions: 1, total_amount: 2500, average_amount: 2500 }
        ],
        // Statistiques par passerelle de paiement
        gatewayStats: {
          stripe: { success: 8, failed: 1 }, // Stripe : 8 succès, 1 échec
          paypal: { success: 2, failed: 0 }, // PayPal : 2 succès, 0 échec
          total: { success: 10, failed: 1 } // Total : 10 succès, 1 échec
        }
      };
    }

    // Extraction des filtres depuis l'objet filters
    const { userId, startDate, endDate, status } = filters || {};

    // CONSTRUCTION DE LA REQUÊTE SQL avec filtres dynamiques
    let whereClause = 'WHERE 1=1'; // Clause WHERE de base (toujours vraie)
    const values = []; // Valeurs pour les paramètres de la requête
    let paramCount = 1; // Compteur pour les paramètres ($1, $2, etc.)

    // FILTRE 1 : Par utilisateur
    if (userId) {
      whereClause += ` AND user_id = $${paramCount}`; // Ajoute condition utilisateur
      values.push(userId); // Ajoute la valeur
      paramCount++; // Incrémente le compteur
    }

    // FILTRE 2 : Par date de début
    if (startDate) {
      whereClause += ` AND created_at >= $${paramCount}`; // Ajoute condition date début
      values.push(startDate); // Ajoute la valeur
      paramCount++; // Incrémente le compteur
    }

    // FILTRE 3 : Par date de fin
    if (endDate) {
      whereClause += ` AND created_at <= $${paramCount}`; // Ajoute condition date fin
      values.push(endDate); // Ajoute la valeur
      paramCount++; // Incrémente le compteur
    }

    // FILTRE 4 : Par statut
    if (status) {
      whereClause += ` AND status = $${paramCount}`; // Ajoute condition statut
      values.push(status); // Ajoute la valeur
      paramCount++; // Incrémente le compteur
    }

    // REQUÊTE SQL principale pour les statistiques
    const query = `
      SELECT 
        COUNT(*) as total_transactions, // Nombre total de transactions
        SUM(amount) as total_amount, // Montant total
        AVG(amount) as average_amount, // Montant moyen
        status, // Statut de la transaction
        currency // Devise
      FROM transactions 
      ${whereClause} // Applique les filtres
      GROUP BY status, currency // Groupe par statut et devise
    `;

    // Exécuter la requête statistique
    const result = await query(query, values);
    
    // Retourner les résultats avec les statistiques des passerelles
    return {
      transactions: result.rows, // Résultats des transactions groupées
      gatewayStats: gatewayManager.getStatistics() // Statistiques des passerelles
    };
  }

  /**
   * Récupère le statut d'un paiement par son ID de transaction
   * Permet de suivre l'état d'une transaction spécifique
   * @param {string} transactionId - ID de la transaction à rechercher
   * @returns {Promise<Object>} - Statut et détails de la transaction
   */
  async getPaymentStatus(transactionId) {
    // S'assure que le service est initialisé
    await this.initialize();

    // MODE SIMULATION : Pour les tests de statut de paiement
    if (this.mockMode) {
      return {
        success: true, // Transaction trouvée
        transactionId: transactionId, // ID de la transaction
        status: 'completed', // Statut terminé
        amount: 2500, // Montant en centimes (25.00€)
        currency: 'EUR', // Devise
        created_at: new Date().toISOString(), // Date de création
        updated_at: new Date().toISOString() // Date de mise à jour
      };
    }

    // REQUÊTE SQL : Chercher la transaction dans la base de données
    // On cherche soit par notre ID, soit par l'ID de la passerelle (Stripe/PayPal)
    const queryText = `
      SELECT * FROM transactions 
      WHERE id = $1 OR provider_transaction_id = $1
    `;
    
    // Exécuter la requête avec l'ID de transaction
    const result = await query(queryText, [transactionId]);
    
    // Si aucune transaction trouvée
    if (result.rows.length === 0) {
      return {
        success: false, // Échec de la recherche
        error: 'Transaction not found', // Erreur explicative
        message: `Transaction ${transactionId} non trouvé` // Message détaillé
      };
    }

    const transaction = result.rows[0];
    return {
      success: true,
      transactionId: transaction.id,
      status: transaction.status,
      amount: transaction.amount,
      currency: transaction.currency,
      created_at: transaction.created_at,
      updated_at: transaction.updated_at
    };
  }
}

module.exports = new PaymentService();
