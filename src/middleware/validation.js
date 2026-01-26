const logger = require('../utils/logger');

/**
 * Validation Middleware
 * Validates request bodies using Joi schemas
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const data = source === 'body' ? req.body : 
                   source === 'query' ? req.query : 
                   source === 'params' ? req.params : req.body;

      // Permettre les champs injectés par le contexte
      const options = {
        abortEarly: false,
        stripUnknown: false, // Ne pas supprimer les champs injectés
        convert: true,
        allowUnknown: true // Permettre les champs injectés par le contexte
      };

      const { error, value } = schema.validate(data, options);

      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context.value
        }));

        logger.validation('Validation failed', {
          errors,
          source,
          userId: req.user?.id
        });

        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: errors
          }
        });
      }

      // Fusionner les données validées avec les données existantes
      if (source === 'body') {
        req.body = { ...req.body, ...value };
      } else if (source === 'query') {
        req.query = { ...req.query, ...value };
      } else if (source === 'params') {
        req.params = { ...req.params, ...value };
      }

      next();
    } catch (error) {
      logger.error('Validation middleware error', {
        error: error.message,
        source,
        userId: req.user?.id
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Internal validation error'
        }
      });
    }
  };
};

module.exports = {
  validate
};
