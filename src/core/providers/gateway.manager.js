// Importation des modules nécessaires pour le gestionnaire de passerelles
const BaseGateway = require('./base.gateway'); // Classe de base pour toutes les passerelles
const databaseWrapper = require("../../utils/database-wrapper"); // Utilitaire pour exécuter des requêtes SQL

/**
 * Gestionnaire de Passerelles de Paiement
 * Ce gestionnaire gère plusieurs fournisseurs de paiement (Stripe, PayPal, etc.)
 * Il sélectionne la meilleure passerelle, gère les secours et le routage des transactions
 */
class GatewayManager {
  // Constructeur de la classe
  constructor() {
    this.gateways = new Map(); // Map pour stocker les passerelles enregistrées (code -> instance)
    this.defaultGateway = null; // Passerelle par défaut utilisée si aucune n'est spécifiée
    this.initialized = false; // Indique si le gestionnaire a été initialisé
  }

  /**
   * Initialise toutes les passerelles actives depuis la base de données
   * Cette méthode charge la configuration des passerelles et les instancie
   * @returns {Promise<void>} - Ne retourne rien, mais prépare le gestionnaire
   */
  async initialize() {
    try {
      // ÉTAPE 1 : Charger la configuration des passerelles depuis la base de données
      const gatewaysConfig = await this.loadGatewaysFromDatabase();
      
      // ÉTAPE 2 : Enregistrer chaque passerelle trouvée
      for (const config of gatewaysConfig) {
        await this.registerGateway(config); // Crée et initialise la passerelle
      }

      // ÉTAPE 3 : Définir la passerelle par défaut (la première active)
      const activeGateways = Array.from(this.gateways.values()).filter(g => g.isActive);
      if (activeGateways.length > 0) {
        this.defaultGateway = activeGateways[0]; // Prend la première comme défaut
      }

      // ÉTAPE 4 : Marquer le gestionnaire comme initialisé
      this.initialized = true;
      console.log(`Gestionnaire de passerelles initialisé avec ${this.gateways.size} fournisseurs`);
      
    } catch (error) {
      console.error('Échec de l\'initialisation du gestionnaire de passerelles:', error);
      throw error; // Propage l'erreur pour qu'elle soit gérée par l'appelant
    }
  }

  /**
   * Charge la configuration des passerelles depuis la base de données
   * Cette méthode récupère toutes les passerelles actives configurées dans la BD
   * @returns {Promise<Array>} - Tableau des configurations des passerelles
   */
  async loadGatewaysFromDatabase() {
    // REQUÊTE SQL : Récupère toutes les passerelles actives
    // Trier par date de création pour avoir un ordre cohérent
    const query = `
      SELECT * FROM payment_gateways 
      WHERE is_active = true -- Uniquement les passerelles actives
      ORDER BY created_at ASC -- Les plus anciennes en premier
    `;
    
    const result = await databaseWrapper.query(query); // Exécute la requête
    return result.rows; // Retourne les lignes trouvées
  }

  /**
   * Enregistre une instance de passerelle
   * Cette méthode crée une instance de passerelle et l'ajoute au gestionnaire
   * @param {Object} config - Configuration de la passerelle (code, clés API, etc.)
   * @returns {Promise<void>} - Ne retourne rien, mais enregistre la passerelle
   */
  async registerGateway(config) {
    try {
      // ÉTAPE 1 : Obtenir la classe de la passerelle selon son code
      const GatewayClass = this.getGatewayClass(config.code);
      
      // ÉTAPE 2 : Créer une instance de la passerelle avec sa configuration
      const gateway = new GatewayClass(config);
      
      // ÉTAPE 3 : Initialiser la passerelle (connexion API, validation, etc.)
      await gateway.initialize();
      
      // ÉTAPE 4 : Stocker l'instance dans la Map des passerelles
      this.gateways.set(config.code, gateway);
      console.log(`Passerelle ${config.code} enregistrée avec succès`);
      
    } catch (error) {
      console.error(`Échec de l\'enregistrement de la passerelle ${config.code}:`, error);
      // Continue avec les autres passerelles même si celle-ci échoue
    }
  }

  /**
   * Obtient la classe d'une passerelle selon son code
   * Cette méthode fait le mapping entre les codes et les classes JavaScript
   * @param {string} code - Code de la passerelle (ex: 'stripe', 'paypal')
   * @returns {Class} - Classe de la passerelle correspondante
   */
  getGatewayClass(code) {
    // MAPPING : Associe chaque code de passerelle à sa classe JavaScript correspondante
    const gatewayClasses = {
      'stripe': require('../stripe/stripe.gateway'), // Passerelle Stripe (cartes bancaires)
      'paypal': require('../paypal/paypal.gateway'), // Passerelle PayPal
      'paygate': require('../african/paygate.gateway'), // Passerelle PayGate (Afrique du Sud)
      'paydunya': require('../african/paydunya.gateway'), // Passerelle PayDunya (Afrique de l'Ouest)
      'cinetpay': require('../african/cinetpay.gateway'), // Passerelle CinetPay (Afrique)
      'mtn_momo': require('../african/mtn-momo.gateway'), // MTN Mobile Money
      'orange_money': require('../african/orange-money.gateway'), // Orange Money
      'mycoolpay': require('../african/mycoolpay.gateway') // MyCoolPay (Afrique)
    };

    const GatewayClass = gatewayClasses[code]; // Récupère la classe correspondante
    if (!GatewayClass) {
      throw new Error(`Code de passerelle inconnu: ${code}`); // Erreur si code non reconnu
    }

    return GatewayClass; // Retourne la classe trouvée
  }

  /**
   * Obtient une passerelle par son code
   * Cette méthode récupère une instance de passerelle spécifique
   * @param {string} code - Code de la passerelle (ex: 'stripe', 'paypal')
   * @returns {BaseGateway|null} - Instance de la passerelle ou null si non trouvée
   */
  getGateway(code) {
    return this.gateways.get(code) || null; // Retourne la passerelle ou null
  }

  /**
   * Obtient toutes les passerelles actives
   * Cette méthode retourne uniquement les passerelles qui sont fonctionnelles
   * @returns {BaseGateway[]} - Tableau des passerelles actives
   */
  getActiveGateways() {
    // Filtre les passerelles pour ne garder que celles qui sont actives
    return Array.from(this.gateways.values()).filter(g => g.isActive);
  }

  /**
   * Obtient la passerelle par défaut
   * C'est la passerelle utilisée si aucune n'est spécifiée
   * @returns {BaseGateway|null} - Passerelle par défaut ou null
   */
  getDefaultGateway() {
    return this.defaultGateway; // Retourne la passerelle par défaut
  }

  /**
   * Sélectionne la meilleure passerelle pour un paiement
   * Cette méthode choisit la passerelle la plus adaptée selon les critères
   * @param {Object} criteria - Critères de sélection
   * @param {number} criteria.amount - Montant du paiement
   * @param {string} criteria.currency - Code de la devise (EUR, USD, etc.)
   * @param {string} criteria.country - Code du pays (FR, US, etc.)
   * @param {string[]} criteria.preferredGateways - Passerelles préférées par ordre de priorité
   * @returns {BaseGateway|null} - Passerelle sélectionnée ou null
   */
  selectGateway(criteria) {
    // Extraction des critères de sélection
    const { amount, currency, country, preferredGateways = [] } = criteria;
    const activeGateways = this.getActiveGateways(); // Obtenir les passerelles actives

    // FILTRE 1 : Garder uniquement les passerelles qui supportent les exigences
    let suitableGateways = activeGateways.filter(gateway => {
      return gateway.isAmountValid(amount) && // Vérifie si le montant est valide
             gateway.isCurrencySupported(currency) && // Vérifie si la devise est supportée
             gateway.isCountrySupported(country); // Vérifie si le pays est supporté
    });

    // FILTRE 2 : Prioriser les passerelles préférées si spécifiées
    if (preferredGateways.length > 0) {
      const preferred = suitableGateways.filter(g => preferredGateways.includes(g.code));
      if (preferred.length > 0) {
        suitableGateways = preferred; // Utilise les passerelles préférées si disponibles
      }
    }

    // RETOUR : La première passerelle appropriée ou celle par défaut
    return suitableGateways.length > 0 ? suitableGateways[0] : this.defaultGateway;
  }

  /**
   * Traite un paiement avec sélection automatique de passerelle
   * C'est la méthode principale pour traiter les paiements
   * @param {Object} paymentData - Données du paiement (montant, devise, etc.)
   * @param {Object} options - Options de traitement
   * @param {boolean} options.enableFallback - Activer les passerelles de secours
   * @returns {Promise<Object>} - Résultat du paiement
   */
  async processPayment(paymentData, options = {}) {
    // Vérifie si le gestionnaire est initialisé
    if (!this.initialized) {
      await this.initialize(); // Initialise si nécessaire
    }

    // Extraction des données du paiement
    const { amount, currency = 'EUR', country = 'FR', preferredGateways } = paymentData;
    
    // ÉTAPE 1 : Sélectionner la passerelle appropriée
    const gateway = this.selectGateway({
      amount, // Montant du paiement
      currency, // Devise
      country, // Pays
      preferredGateways // Passerelles préférées
    });

    // VÉRIFICATION : Si aucune passerelle n'est disponible
    if (!gateway) {
      throw new Error('Aucune passerelle de paiement appropriée disponible');
    }

    try {
      // ÉTAPE 2 : Traiter le paiement avec la passerelle sélectionnée
      const result = await gateway.processPayment(paymentData);
      
      // RETOUR : Succès avec informations sur la passerelle utilisée
      return {
        success: true, // Indique le succès
        gateway: gateway.code, // Code de la passerelle utilisée
        ...result // Autres informations retournées par la passerelle
      };

    } catch (error) {
      // GESTION DES ERREURS : Essayer les passerelles de secours si configuré
      if (options.enableFallback && preferredGateways.length > 1) {
        const fallbackGateways = preferredGateways.filter(code => code !== gateway.code);
        
        // ESSAI DES PASSERELLES DE SECOURS
        for (const fallbackCode of fallbackGateways) {
          const fallbackGateway = this.getGateway(fallbackCode);
          if (fallbackGateway && fallbackGateway.isAmountValid(amount)) {
            try {
              const result = await fallbackGateway.processPayment(paymentData);
              return {
                success: true,
                gateway: fallbackGateway.code, // Passerelle de secours utilisée
                fallback: true, // Indique qu'on a utilisé une passerelle de secours
                originalGateway: gateway.code, // Passerelle originale qui a échoué
                ...result
              };
            } catch (fallbackError) {
              console.warn(`La passerelle de secours ${fallbackCode} a aussi échoué:`, fallbackError.message);
              continue; // Essayer la passerelle de secours suivante
            }
          }
        }
      }

      throw error; // Si tout échoue, propager l'erreur originale
    }
  }

  /**
   * Vérifie un webhook avec la passerelle appropriée
   * Les webhooks sont des notifications envoyées par les passerelles pour informer des changements
   * @param {string} gatewayCode - Code de la passerelle (stripe, paypal, etc.)
   * @param {Object} webhookData - Données du webhook (payload, signature, secret)
   * @returns {Promise<Object>} - Résultat de la vérification
   */
  async verifyWebhook(gatewayCode, webhookData) {
    // Obtenir la passerelle correspondante
    const gateway = this.getGateway(gatewayCode);
    if (!gateway) {
      throw new Error(`Passerelle inconnue: ${gatewayCode}`);
    }

    // Déléguer la vérification à la passerelle spécifique
    return await gateway.verifyWebhookSignature(
      webhookData.payload, // Contenu du webhook
      webhookData.signature, // Signature pour vérifier l'authenticité
      webhookData.secret // Secret pour la vérification
    );
  }

  /**
   * Analyse un événement de webhook
   * Convertit les données brutes du webhook en événement structuré
   * @param {string} gatewayCode - Code de la passerelle
   * @param {Object} webhookData - Données du webhook
   * @returns {Promise<Object>} - Événement analysé et structuré
   */
  async parseWebhookEvent(gatewayCode, webhookData) {
    // Obtenir la passerelle correspondante
    const gateway = this.getGateway(gatewayCode);
    if (!gateway) {
      throw new Error(`Passerelle inconnue: ${gatewayCode}`);
    }

    // Déléguer l'analyse à la passerelle spécifique
    return await gateway.parseWebhookEvent(webhookData);
  }

  /**
   * Obtient le statut d'un paiement depuis la passerelle appropriée
   * Permet de suivre l'état d'une transaction auprès du fournisseur
   * @param {string} gatewayCode - Code de la passerelle
   * @param {string} transactionId - ID de la transaction
   * @returns {Promise<Object>} - Statut du paiement
   */
  async getPaymentStatus(gatewayCode, transactionId) {
    // Obtenir la passerelle correspondante
    const gateway = this.getGateway(gatewayCode);
    if (!gateway) {
      throw new Error(`Passerelle inconnue: ${gatewayCode}`);
    }

    // Déléguer la requête de statut à la passerelle
    return await gateway.getPaymentStatus(transactionId);
  }

  /**
   * Rembourse un paiement avec la passerelle appropriée
   * Traite les remboursements partiels ou complets
   * @param {string} gatewayCode - Code de la passerelle
   * @param {string} transactionId - ID de la transaction à rembourser
   * @param {number} amount - Montant à rembourser (en centimes)
   * @param {string} reason - Raison du remboursement
   * @returns {Promise<Object>} - Résultat du remboursement
   */
  async refundPayment(gatewayCode, transactionId, amount, reason) {
    // Obtenir la passerelle correspondante
    const gateway = this.getGateway(gatewayCode);
    if (!gateway) {
      throw new Error(`Passerelle inconnue: ${gatewayCode}`);
    }

    // Déléguer le remboursement à la passerelle
    return await gateway.refundPayment(transactionId, amount, reason);
  }

  /**
   * Crée un paiement (payout) avec la passerelle appropriée
   * Les payouts sont des paiements sortants (vers les designers, etc.)
   * @param {string} gatewayCode - Code de la passerelle
   * @param {Object} payoutData - Données du payout (montant, bénéficiaire, etc.)
   * @returns {Promise<Object>} - Résultat du payout
   */
  async createPayout(gatewayCode, payoutData) {
    // Obtenir la passerelle correspondante
    const gateway = this.getGateway(gatewayCode);
    if (!gateway) {
      throw new Error(`Passerelle inconnue: ${gatewayCode}`);
    }

    // Déléguer la création du payout à la passerelle
    return await gateway.createPayout(payoutData);
  }

  /**
   * Obtient les statistiques des passerelles
   * Génère un rapport sur l'état et les capacités des passerelles
   * @returns {Object} - Statistiques détaillées des passerelles
   */
  getStatistics() {
    const gateways = Array.from(this.gateways.values()); // Convertir la Map en tableau
    
    // RETOUR : Statistiques complètes sur les passerelles
    return {
      total: gateways.length, // Nombre total de passerelles configurées
      active: gateways.filter(g => g.isActive).length, // Nombre de passerelles actives
      default: this.defaultGateway?.code || null, // Code de la passerelle par défaut
      gateways: gateways.map(g => ({ // Détails de chaque passerelle
        code: g.code, // Code de la passerelle
        name: g.name, // Nom affiché de la passerelle
        active: g.isActive, // État actif/inactif
        currencies: g.getSupportedCurrencies(), // Devises supportées
        countries: g.getSupportedCountries(), // Pays supportés
        minAmount: g.getMinimumAmount(), // Montant minimum accepté
        maxAmount: g.getMaximumAmount() // Montant maximum accepté
      }))
    };
  }

  /**
   * Recharge les configurations des passerelles depuis la base de données
   * Utile pour mettre à jour les configurations sans redémarrer le service
   * @returns {Promise<void>} - Ne retourne rien, mais recharge les configurations
   */
  async reload() {
    // Nettoyer l'état actuel
    this.gateways.clear(); // Vide la Map des passerelles
    this.defaultGateway = null; // Réinitialise la passerelle par défaut
    this.initialized = false; // Marque comme non initialisé
    
    // Recharger depuis la base de données
    await this.initialize(); // Réinitialise complètement le gestionnaire
  }
}

// Instance unique (Singleton) du gestionnaire de passerelles
// Cela garantit qu'il n'y a qu'une seule instance dans toute l'application
const gatewayManager = new GatewayManager();

module.exports = gatewayManager; // Exporte l'instance unique
