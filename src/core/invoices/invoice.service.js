const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const logger = require('../../utils/logger');

/**
 * Service de génération de factures PDF
 * Crée des factures professionnelles avec design personnalisé
 */
class InvoiceService {
  constructor() {
    this.invoicePrefix = process.env.INVOICE_PREFIX || 'INV';
    this.invoiceNumberLength = parseInt(process.env.INVOICE_NUMBER_LENGTH) || 8;
    this.taxRate = parseFloat(process.env.INVOICE_TAX_RATE) || 0.20;
    this.companyInfo = {
      name: process.env.INVOICE_COMPANY_NAME || 'Event Planner SaaS',
      address: process.env.INVOICE_COMPANY_ADDRESS || '123 Business Street, City, Country',
      email: process.env.INVOICE_COMPANY_EMAIL || 'billing@eventplanner.com',
      phone: process.env.INVOICE_COMPANY_PHONE || '+33612345678',
      siret: process.env.INVOICE_COMPANY_SIRET || '12345678901234'
    };
    this.pdfConfig = {
      fontFamily: process.env.PDF_FONT_FAMILY || 'Helvetica',
      fontSize: parseInt(process.env.PDF_FONT_SIZE) || 12,
      logoPath: process.env.PDF_LOGO_PATH || './assets/logo.png',
      footerText: process.env.PDF_FOOTER_TEXT || 'Thank you for your business!'
    };
  }

  /**
   * Génère un numéro de facture unique
   * @returns {string} Numéro de facture
   */
  generateInvoiceNumber() {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substr(2, 4);
    const number = (timestamp + random).slice(-this.invoiceNumberLength);
    return `${this.invoicePrefix}-${number}`;
  }

  /**
   * Crée une facture PDF
   * @param {Object} invoiceData - Données de la facture
   * @returns {Promise<Object>} Facture créée
   */
  async createInvoice(invoiceData) {
    try {
      const {
        customerId,
        eventId,
        ticketIds,
        amount,
        taxIncluded = true,
        items = [],
        customerInfo,
        eventInfo,
        metadata = {}
      } = invoiceData;

      const invoiceNumber = this.generateInvoiceNumber();
      const createdAt = new Date().toISOString();
      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 jours

      // Calcul des montants
      const subtotal = amount;
      const taxAmount = taxIncluded ? (amount * this.taxRate) / (1 + this.taxRate) : amount * this.taxRate;
      const total = taxIncluded ? amount : amount + taxAmount;

      const invoice = {
        id: crypto.randomUUID(),
        invoiceNumber,
        customerId,
        eventId,
        ticketIds,
        createdAt,
        dueDate: dueDate.toISOString(),
        status: 'pending',
        amounts: {
          subtotal: Math.round(subtotal),
          taxAmount: Math.round(taxAmount),
          total: Math.round(total),
          taxRate: this.taxRate
        },
        items: items.length > 0 ? items : [{
          description: `Billets pour événement ${eventId}`,
          quantity: ticketIds.length,
          unitPrice: Math.round(subtotal / ticketIds.length),
          total: Math.round(subtotal)
        }],
        customerInfo,
        eventInfo,
        companyInfo: this.companyInfo,
        metadata
      };

      logger.invoice('Invoice created', {
        invoiceId: invoice.id,
        invoiceNumber,
        customerId,
        amount: total / 100,
        status: invoice.status
      });

      return {
        success: true,
        invoice
      };
    } catch (error) {
      logger.error('Failed to create invoice', {
        error: error.message,
        customerId: invoiceData.customerId
      });

      return {
        success: false,
        error: error.message,
        type: 'INVOICE_CREATION_FAILED'
      };
    }
  }

  /**
   * Génère le PDF d'une facture
   * @param {Object} invoice - Données de la facture
   * @returns {Promise<Buffer>} Buffer du PDF
   */
  async generateInvoicePDF(invoice) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: {
            top: 50,
            bottom: 50,
            left: 50,
            right: 50
          }
        });

        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // En-tête avec logo et informations de l'entreprise
        this.addHeader(doc, invoice);

        // Informations de la facture et du client
        this.addInvoiceInfo(doc, invoice);

        // Tableau des articles
        this.addItemsTable(doc, invoice);

        // Totaux
        this.addTotals(doc, invoice);

        // Pied de page
        this.addFooter(doc, invoice);

        doc.end();
      } catch (error) {
        logger.error('Failed to generate invoice PDF', {
          error: error.message,
          invoiceId: invoice.id
        });
        reject(error);
      }
    });
  }

  /**
   * Ajoute l'en-tête du PDF
   * @param {PDFDocument} doc - Document PDF
   * @param {Object} invoice - Données de la facture
   */
  addHeader(doc, invoice) {
    // Logo (si disponible)
    if (this.pdfConfig.logoPath) {
      try {
        const logoBuffer = fs.readFileSync(this.pdfConfig.logoPath);
        doc.image(logoBuffer, 50, 50, { width: 100 });
      } catch (error) {
        logger.warn('Logo file not found, using text header', {
          logoPath: this.pdfConfig.logoPath
        });
      }
    }

    // Informations de l'entreprise
    doc.fontSize(16).font('Helvetica-Bold').text(this.companyInfo.name, 50, 50, { align: 'right' });
    doc.fontSize(10).font('Helvetica').text(this.companyInfo.address, 50, 70, { align: 'right' });
    doc.text(`Email: ${this.companyInfo.email}`, 50, 85, { align: 'right' });
    doc.text(`Tél: ${this.companyInfo.phone}`, 50, 100, { align: 'right' });
    doc.text(`SIRET: ${this.companyInfo.siret}`, 50, 115, { align: 'right' });

    // Ligne de séparation
    doc.moveTo(50, 140).lineTo(545, 140).stroke();
  }

  /**
   * Ajoute les informations de la facture et du client
   * @param {PDFDocument} doc - Document PDF
   * @param {Object} invoice - Données de la facture
   */
  addInvoiceInfo(doc, invoice) {
    const y = 160;

    // Informations de la facture (gauche)
    doc.fontSize(12).font('Helvetica-Bold').text('FACTURE', 50, y);
    doc.fontSize(10).font('Helvetica').text(`Numéro: ${invoice.invoiceNumber}`, 50, y + 20);
    doc.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString('fr-FR')}`, 50, y + 35);
    doc.text(`Échéance: ${new Date(invoice.dueDate).toLocaleDateString('fr-FR')}`, 50, y + 50);
    doc.text(`Statut: ${this.getStatusLabel(invoice.status)}`, 50, y + 65);

    // Informations du client (droite)
    doc.fontSize(12).font('Helvetica-Bold').text('CLIENT', 350, y);
    doc.fontSize(10).font('Helvetica').text(invoice.customerInfo.name || '', 350, y + 20);
    doc.text(invoice.customerInfo.email || '', 350, y + 35);
    if (invoice.customerInfo.phone) {
      doc.text(invoice.customerInfo.phone, 350, y + 50);
    }
    if (invoice.customerInfo.address) {
      doc.text(invoice.customerInfo.address, 350, y + 65);
    }

    // Informations de l'événement
    if (invoice.eventInfo) {
      doc.fontSize(10).font('Helvetica-Bold').text('ÉVÉNEMENT:', 50, y + 90);
      doc.font('Helvetica').text(invoice.eventInfo.title || '', 50, y + 105);
      if (invoice.eventInfo.date) {
        doc.text(`Date: ${new Date(invoice.eventInfo.date).toLocaleDateString('fr-FR')}`, 50, y + 120);
      }
    }
  }

  /**
   * Ajoute le tableau des articles
   * @param {PDFDocument} doc - Document PDF
   * @param {Object} invoice - Données de la facture
   */
  addItemsTable(doc, invoice) {
    const startY = 320;
    const lineHeight = 20;

    // En-tête du tableau
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Description', 50, startY);
    doc.text('Quantité', 300, startY, { width: 80, align: 'center' });
    doc.text('Prix unitaire', 380, startY, { width: 80, align: 'right' });
    doc.text('Total', 460, startY, { width: 80, align: 'right' });

    // Ligne de séparation
    doc.moveTo(50, startY + 15).lineTo(545, startY + 15).stroke();

    // Articles
    let currentY = startY + 25;
    doc.fontSize(10).font('Helvetica');

    invoice.items.forEach((item, index) => {
      // Description
      doc.text(item.description, 50, currentY, { width: 240 });
      
      // Quantité
      doc.text(item.quantity.toString(), 300, currentY, { width: 80, align: 'center' });
      
      // Prix unitaire
      doc.text(`${(item.unitPrice / 100).toFixed(2)}€`, 380, currentY, { width: 80, align: 'right' });
      
      // Total
      doc.text(`${(item.total / 100).toFixed(2)}€`, 460, currentY, { width: 80, align: 'right' });

      currentY += lineHeight;

      // Ligne de séparation entre les articles
      if (index < invoice.items.length - 1) {
        doc.moveTo(50, currentY - 5).lineTo(545, currentY - 5).stroke();
      }
    });

    // Ligne de séparation finale
    doc.moveTo(50, currentY + 5).lineTo(545, currentY + 5).stroke();
  }

  /**
   * Ajoute les totaux
   * @param {PDFDocument} doc - Document PDF
   * @param {Object} invoice - Données de la facture
   */
  addTotals(doc, invoice) {
    const startY = 480;
    const lineHeight = 20;

    doc.fontSize(10).font('Helvetica');

    // Sous-total
    doc.text('Sous-total:', 380, startY, { width: 80, align: 'right' });
    doc.text(`${(invoice.amounts.subtotal / 100).toFixed(2)}€`, 460, startY, { width: 80, align: 'right' });

    // TVA
    doc.text(`TVA (${(invoice.amounts.taxRate * 100).toFixed(0)}%):`, 380, startY + lineHeight, { width: 80, align: 'right' });
    doc.text(`${(invoice.amounts.taxAmount / 100).toFixed(2)}€`, 460, startY + lineHeight, { width: 80, align: 'right' });

    // Total
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text('Total:', 380, startY + lineHeight * 2, { width: 80, align: 'right' });
    doc.text(`${(invoice.amounts.total / 100).toFixed(2)}€`, 460, startY + lineHeight * 2, { width: 80, align: 'right' });

    // Ligne de séparation
    doc.moveTo(350, startY + lineHeight * 2 - 5).lineTo(545, startY + lineHeight * 2 - 5).stroke();
    doc.moveTo(350, startY + lineHeight * 2 + 15).lineTo(545, startY + lineHeight * 2 + 15).stroke();
  }

  /**
   * Ajoute le pied de page
   * @param {PDFDocument} doc - Document PDF
   * @param {Object} invoice - Données de la facture
   */
  addFooter(doc, invoice) {
    const footerY = 650;

    // Texte du pied de page
    doc.fontSize(9).font('Helvetica').text(this.pdfConfig.footerText, 50, footerY, { align: 'center' });

    // Mentions légales
    doc.fontSize(8).text(
      'En cas de retard de paiement, une pénalité de trois fois le taux d\'intérêt légal sera appliquée.',
      50,
      footerY + 15,
      { align: 'center' }
    );

    // Numéro de page
    doc.text(`Page 1/1`, 545, footerY + 30, { align: 'right' });
  }

  /**
   * Sauvegarde une facture en PDF
   * @param {Object} invoice - Données de la facture
   * @param {string} outputPath - Chemin de sortie
   * @returns {Promise<Object>} Résultat de la sauvegarde
   */
  async saveInvoicePDF(invoice, outputPath) {
    try {
      const pdfBuffer = await this.generateInvoicePDF(invoice);
      
      // Créer le répertoire si nécessaire
      const dir = path.dirname(outputPath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(outputPath, pdfBuffer);

      logger.invoice('Invoice PDF saved', {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        outputPath
      });

      return {
        success: true,
        path: outputPath,
        size: pdfBuffer.length
      };
    } catch (error) {
      logger.error('Failed to save invoice PDF', {
        error: error.message,
        invoiceId: invoice.id,
        outputPath
      });

      return {
        success: false,
        error: error.message,
        type: 'PDF_SAVE_FAILED'
      };
    }
  }

  /**
   * Génère et sauvegarde une facture complète
   * @param {Object} invoiceData - Données de la facture
   * @param {string} outputDir - Répertoire de sortie
   * @returns {Promise<Object>} Facture générée
   */
  async generateAndSaveInvoice(invoiceData, outputDir = './invoices') {
    try {
      // Créer la facture
      const invoiceResult = await this.createInvoice(invoiceData);
      if (!invoiceResult.success) {
        return invoiceResult;
      }

      const invoice = invoiceResult.invoice;

      // Générer le PDF
      const pdfBuffer = await this.generateInvoicePDF(invoice);

      // Sauvegarder le PDF
      const fileName = `${invoice.invoiceNumber}.pdf`;
      const outputPath = path.join(outputDir, fileName);
      
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(outputPath, pdfBuffer);

      logger.invoice('Invoice generated and saved', {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        outputPath,
        size: pdfBuffer.length
      });

      return {
        success: true,
        invoice,
        pdf: {
          path: outputPath,
          fileName,
          size: pdfBuffer.length,
          buffer: pdfBuffer.toString('base64')
        }
      };
    } catch (error) {
      logger.error('Failed to generate and save invoice', {
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        type: 'INVOICE_GENERATION_FAILED'
      };
    }
  }

  /**
   * Récupère une facture par son ID
   * @param {string} invoiceId - ID de la facture
   * @returns {Promise<Object>} Facture
   */
  async getInvoice(invoiceId) {
    try {
      // Pour l'instant, retourne une erreur car nous n'avons pas de base de données
      // Dans une implémentation complète, cela interrogerait la base de données
      
      return {
        success: false,
        error: 'Invoice not found in database',
        type: 'INVOICE_NOT_FOUND'
      };
    } catch (error) {
      logger.error('Failed to retrieve invoice', {
        error: error.message,
        invoiceId
      });

      return {
        success: false,
        error: error.message,
        type: 'INVOICE_RETRIEVAL_FAILED'
      };
    }
  }

  /**
   * Met à jour le statut d'une facture
   * @param {string} invoiceId - ID de la facture
   * @param {string} status - Nouveau statut
   * @returns {Promise<Object>} Facture mise à jour
   */
  async updateInvoiceStatus(invoiceId, status) {
    try {
      // Pour l'instant, retourne une erreur car nous n'avons pas de base de données
      // Dans une implémentation complète, cela mettrait à jour la base de données
      
      logger.invoice('Invoice status updated', {
        invoiceId,
        status
      });

      return {
        success: true,
        invoiceId,
        status,
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to update invoice status', {
        error: error.message,
        invoiceId,
        status
      });

      return {
        success: false,
        error: error.message,
        type: 'INVOICE_STATUS_UPDATE_FAILED'
      };
    }
  }

  /**
   * Liste les factures d'un client
   * @param {string} customerId - ID du client
   * @param {Object} options - Options de pagination
   * @returns {Promise<Object>} Liste des factures
   */
  async listCustomerInvoices(customerId, options = {}) {
    try {
      // Pour l'instant, retourne une liste vide car nous n'avons pas de base de données
      // Dans une implémentation complète, cela interrogerait la base de données
      
      return {
        success: true,
        invoices: [],
        total: 0,
        page: options.page || 1,
        limit: options.limit || 10
      };
    } catch (error) {
      logger.error('Failed to list customer invoices', {
        error: error.message,
        customerId
      });

      return {
        success: false,
        error: error.message,
        type: 'INVOICE_LIST_FAILED'
      };
    }
  }

  /**
   * Récupère le libellé du statut
   * @param {string} status - Statut
   * @returns {string} Libellé du statut
   */
  getStatusLabel(status) {
    const labels = {
      pending: 'En attente',
      paid: 'Payée',
      overdue: 'En retard',
      cancelled: 'Annulée',
      refunded: 'Remboursée'
    };
    
    return labels[status] || status;
  }

  /**
   * Vérifie la santé du service de facturation
   * @returns {Promise<Object>} État de santé
   */
  async healthCheck() {
    try {
      // Tester la génération d'un PDF simple
      const testInvoice = {
        id: 'test',
        invoiceNumber: 'TEST-12345678',
        createdAt: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        status: 'pending',
        amounts: {
          subtotal: 10000,
          taxAmount: 2000,
          total: 12000,
          taxRate: this.taxRate
        },
        items: [{
          description: 'Test item',
          quantity: 1,
          unitPrice: 10000,
          total: 10000
        }],
        customerInfo: {
          name: 'Test Customer',
          email: 'test@example.com'
        },
        companyInfo: this.companyInfo
      };

      await this.generateInvoicePDF(testInvoice);

      return {
        success: true,
        healthy: true,
        config: {
          invoicePrefix: this.invoicePrefix,
          taxRate: this.taxRate,
          currency: process.env.CURRENCY || 'EUR'
        }
      };
    } catch (error) {
      logger.error('Invoice service health check failed', {
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
   * Récupère les statistiques du service de facturation
   * @returns {Object} Statistiques
   */
  getStats() {
    return {
      config: {
        invoicePrefix: this.invoicePrefix,
        invoiceNumberLength: this.invoiceNumberLength,
        taxRate: this.taxRate,
        currency: process.env.CURRENCY || 'EUR'
      },
      company: this.companyInfo,
      pdf: this.pdfConfig
    };
  }
}

module.exports = new InvoiceService();
