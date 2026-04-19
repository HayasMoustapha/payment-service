const { connect } = require('../../utils/database-wrapper');

function normalizeTrimmed(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeCardDetails(card = {}) {
  if (!card || typeof card !== 'object') {
    return {};
  }

  return {
    brand: normalizeTrimmed(card.brand),
    last4: normalizeTrimmed(card.last4),
    expMonth:
      Number.isFinite(Number(card.exp_month)) && Number(card.exp_month) > 0
        ? Number(card.exp_month)
        : null,
    expYear:
      Number.isFinite(Number(card.exp_year)) && Number(card.exp_year) > 0
        ? Number(card.exp_year)
        : null,
    holderName: normalizeTrimmed(card.holder_name),
  };
}

function normalizeBillingDetails(billing = {}) {
  if (!billing || typeof billing !== 'object') {
    return {};
  }

  return {
    email: normalizeTrimmed(billing.email),
    phone: normalizeTrimmed(billing.phone),
    addressLine1: normalizeTrimmed(billing.address_line1),
    addressLine2: normalizeTrimmed(billing.address_line2),
    city: normalizeTrimmed(billing.city),
    state: normalizeTrimmed(billing.state),
    postalCode: normalizeTrimmed(billing.postal_code),
    country: normalizeTrimmed(billing.country)?.toUpperCase() ?? null,
  };
}

function normalizeWalletDetails(wallet = {}) {
  if (!wallet || typeof wallet !== 'object') {
    return {};
  }

  return {
    mobileNumber: normalizeTrimmed(wallet.mobile_number),
    reference: normalizeTrimmed(wallet.reference),
  };
}

function mapPaymentMethodRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    user_id: row.user_id,
    provider_code: row.provider_code,
    type: row.type,
    label: row.label,
    is_default: row.is_default,
    external_customer_id: row.external_customer_id,
    external_method_id: row.external_method_id,
    token_reference: row.token_reference,
    card: {
      brand: row.card_brand,
      last4: row.card_last4,
      exp_month: row.exp_month,
      exp_year: row.exp_year,
      holder_name: row.cardholder_name,
    },
    billing: {
      email: row.billing_email,
      phone: row.billing_phone,
      address_line1: row.billing_address_line1,
      address_line2: row.billing_address_line2,
      city: row.billing_city,
      state: row.billing_state,
      postal_code: row.billing_postal_code,
      country: row.billing_country,
    },
    wallet: {
      mobile_number: row.mobile_number,
      reference: row.wallet_reference,
    },
    metadata: row.metadata ?? {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function validateSensitiveFields(input) {
  const forbiddenPaths = [
    input?.card?.number,
    input?.card?.cvc,
    input?.card?.cvv,
    input?.card_number,
    input?.number,
    input?.cvc,
    input?.cvv,
  ];

  if (forbiddenPaths.some((value) => normalizeTrimmed(String(value ?? '')))) {
    throw new Error(
      'Store only masked card metadata and provider references. Full card numbers and CVC values are not accepted.',
    );
  }
}

function validateRequiredFields(input) {
  const providerCode = normalizeTrimmed(input.provider_code)?.toLowerCase();
  const type = normalizeTrimmed(input.type)?.toLowerCase();
  const label = normalizeTrimmed(input.label);
  const card = normalizeCardDetails(input.card);
  const billing = normalizeBillingDetails(input.billing);
  const wallet = normalizeWalletDetails(input.wallet);

  if (!providerCode || !type || !label) {
    throw new Error('user_id, provider_code, type, and label are required.');
  }

  if (type === 'card') {
    if (!card.last4 || !card.expMonth || !card.expYear) {
      throw new Error(
        'Card payment methods require last4, exp_month, and exp_year.',
      );
    }
  }

  if (type === 'paypal' && !billing.email && !normalizeTrimmed(input.external_method_id)) {
    throw new Error(
      'PayPal payment methods require a billing email or a provider method reference.',
    );
  }

  if (
    (type === 'mobile_money' || providerCode === 'orange_money' || providerCode === 'mtn_momo') &&
    !wallet.mobileNumber
  ) {
    throw new Error('Mobile money payment methods require a mobile_number.');
  }
}

class PaymentMethodService {
  async listPaymentMethods({ user_id, provider_code } = {}) {
    const values = [];
    const clauses = ['deleted_at IS NULL'];
    let idx = 1;

    if (user_id !== undefined) {
      clauses.push(`user_id = $${idx++}`);
      values.push(user_id);
    }

    if (provider_code) {
      clauses.push(`provider_code = $${idx++}`);
      values.push(provider_code);
    }

    const result = await connect().then(async (client) => {
      try {
        return await client.query(
          `SELECT *
             FROM payment_methods
            WHERE ${clauses.join(' AND ')}
            ORDER BY is_default DESC, created_at DESC`,
          values,
        );
      } finally {
        client.release();
      }
    });

    return result.rows.map(mapPaymentMethodRow);
  }

  async createPaymentMethod(input) {
    validateSensitiveFields(input);
    validateRequiredFields(input);

    const client = await connect();
    try {
      await client.query('BEGIN');

      const userId = Number(input.user_id);
      const providerCode = normalizeTrimmed(input.provider_code)?.toLowerCase();
      const type = normalizeTrimmed(input.type)?.toLowerCase();
      const label = normalizeTrimmed(input.label);
      const externalCustomerId = normalizeTrimmed(input.external_customer_id);
      const externalMethodId = normalizeTrimmed(input.external_method_id);
      const tokenReference = normalizeTrimmed(input.token_reference);
      const metadata =
        input.metadata && typeof input.metadata === 'object' ? input.metadata : {};
      const card = normalizeCardDetails(input.card);
      const billing = normalizeBillingDetails(input.billing);
      const wallet = normalizeWalletDetails(input.wallet);

      const existingCount = await client.query(
        'SELECT COUNT(*)::int AS total FROM payment_methods WHERE user_id = $1 AND deleted_at IS NULL',
        [userId],
      );
      const shouldSetDefault =
        input.is_default === true || Number(existingCount.rows[0]?.total ?? 0) === 0;

      if (shouldSetDefault) {
        await client.query(
          `UPDATE payment_methods
              SET is_default = false, updated_at = NOW()
            WHERE user_id = $1 AND deleted_at IS NULL`,
          [userId],
        );
      }

      const result = await client.query(
        `INSERT INTO payment_methods (
          user_id,
          provider_code,
          type,
          label,
          is_default,
          external_customer_id,
          external_method_id,
          token_reference,
          card_brand,
          card_last4,
          exp_month,
          exp_year,
          cardholder_name,
          billing_email,
          billing_phone,
          billing_address_line1,
          billing_address_line2,
          billing_city,
          billing_state,
          billing_postal_code,
          billing_country,
          mobile_number,
          wallet_reference,
          metadata,
          updated_at
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,$18,
          $19,$20,$21,$22,$23,$24,NOW()
        )
        RETURNING *`,
        [
          userId,
          providerCode,
          type,
          label,
          shouldSetDefault,
          externalCustomerId,
          externalMethodId,
          tokenReference,
          card.brand,
          card.last4,
          card.expMonth,
          card.expYear,
          card.holderName,
          billing.email,
          billing.phone,
          billing.addressLine1,
          billing.addressLine2,
          billing.city,
          billing.state,
          billing.postalCode,
          billing.country,
          wallet.mobileNumber,
          wallet.reference,
          JSON.stringify(metadata),
        ],
      );

      await client.query('COMMIT');
      return mapPaymentMethodRow(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updatePaymentMethod(paymentMethodId, userId, fields = {}) {
    validateSensitiveFields(fields);

    const currentResult = await connect().then(async (client) => {
      try {
        return await client.query(
          `SELECT *
             FROM payment_methods
            WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
          [paymentMethodId, userId],
        );
      } finally {
        client.release();
      }
    });

    const current = currentResult.rows[0];
    if (!current) {
      return null;
    }

    const mergedInput = {
      user_id: userId,
      provider_code: fields.provider_code ?? current.provider_code,
      type: fields.type ?? current.type,
      label: fields.label ?? current.label,
      external_customer_id: fields.external_customer_id ?? current.external_customer_id,
      external_method_id: fields.external_method_id ?? current.external_method_id,
      token_reference: fields.token_reference ?? current.token_reference,
      is_default: fields.is_default ?? current.is_default,
      card: {
        brand: fields.card?.brand ?? current.card_brand,
        last4: fields.card?.last4 ?? current.card_last4,
        exp_month: fields.card?.exp_month ?? current.exp_month,
        exp_year: fields.card?.exp_year ?? current.exp_year,
        holder_name: fields.card?.holder_name ?? current.cardholder_name,
      },
      billing: {
        email: fields.billing?.email ?? current.billing_email,
        phone: fields.billing?.phone ?? current.billing_phone,
        address_line1: fields.billing?.address_line1 ?? current.billing_address_line1,
        address_line2: fields.billing?.address_line2 ?? current.billing_address_line2,
        city: fields.billing?.city ?? current.billing_city,
        state: fields.billing?.state ?? current.billing_state,
        postal_code: fields.billing?.postal_code ?? current.billing_postal_code,
        country: fields.billing?.country ?? current.billing_country,
      },
      wallet: {
        mobile_number: fields.wallet?.mobile_number ?? current.mobile_number,
        reference: fields.wallet?.reference ?? current.wallet_reference,
      },
      metadata:
        fields.metadata && typeof fields.metadata === 'object'
          ? fields.metadata
          : current.metadata ?? {},
    };

    validateRequiredFields(mergedInput);

    const client = await connect();
    try {
      await client.query('BEGIN');

      const shouldSetDefault = mergedInput.is_default === true;
      if (shouldSetDefault) {
        await client.query(
          `UPDATE payment_methods
              SET is_default = false, updated_at = NOW()
            WHERE user_id = $1 AND deleted_at IS NULL AND id <> $2`,
          [userId, paymentMethodId],
        );
      }

      const result = await client.query(
        `UPDATE payment_methods
            SET provider_code = $1,
                type = $2,
                label = $3,
                is_default = $4,
                external_customer_id = $5,
                external_method_id = $6,
                token_reference = $7,
                card_brand = $8,
                card_last4 = $9,
                exp_month = $10,
                exp_year = $11,
                cardholder_name = $12,
                billing_email = $13,
                billing_phone = $14,
                billing_address_line1 = $15,
                billing_address_line2 = $16,
                billing_city = $17,
                billing_state = $18,
                billing_postal_code = $19,
                billing_country = $20,
                mobile_number = $21,
                wallet_reference = $22,
                metadata = $23,
                updated_at = NOW()
          WHERE id = $24 AND user_id = $25 AND deleted_at IS NULL
          RETURNING *`,
        [
          normalizeTrimmed(mergedInput.provider_code)?.toLowerCase(),
          normalizeTrimmed(mergedInput.type)?.toLowerCase(),
          normalizeTrimmed(mergedInput.label),
          shouldSetDefault,
          normalizeTrimmed(mergedInput.external_customer_id),
          normalizeTrimmed(mergedInput.external_method_id),
          normalizeTrimmed(mergedInput.token_reference),
          normalizeTrimmed(mergedInput.card?.brand),
          normalizeTrimmed(mergedInput.card?.last4),
          Number(mergedInput.card?.exp_month) || null,
          Number(mergedInput.card?.exp_year) || null,
          normalizeTrimmed(mergedInput.card?.holder_name),
          normalizeTrimmed(mergedInput.billing?.email),
          normalizeTrimmed(mergedInput.billing?.phone),
          normalizeTrimmed(mergedInput.billing?.address_line1),
          normalizeTrimmed(mergedInput.billing?.address_line2),
          normalizeTrimmed(mergedInput.billing?.city),
          normalizeTrimmed(mergedInput.billing?.state),
          normalizeTrimmed(mergedInput.billing?.postal_code),
          normalizeTrimmed(mergedInput.billing?.country)?.toUpperCase() ?? null,
          normalizeTrimmed(mergedInput.wallet?.mobile_number),
          normalizeTrimmed(mergedInput.wallet?.reference),
          JSON.stringify(mergedInput.metadata ?? {}),
          paymentMethodId,
          userId,
        ],
      );

      await client.query('COMMIT');
      return mapPaymentMethodRow(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async deletePaymentMethod(paymentMethodId, userId) {
    const client = await connect();
    try {
      await client.query('BEGIN');

      const currentResult = await client.query(
        `SELECT id, is_default
           FROM payment_methods
          WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
        [paymentMethodId, userId],
      );

      const currentMethod = currentResult.rows[0];
      if (!currentMethod) {
        await client.query('ROLLBACK');
        return null;
      }

      const deletedResult = await client.query(
        `UPDATE payment_methods
            SET deleted_at = NOW(), is_default = false, updated_at = NOW()
          WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
          RETURNING *`,
        [paymentMethodId, userId],
      );

      const deletedMethod = deletedResult.rows[0];
      if (!deletedMethod) {
        await client.query('ROLLBACK');
        return null;
      }

      if (currentMethod.is_default) {
        await client.query(
          `UPDATE payment_methods
              SET is_default = true, updated_at = NOW()
            WHERE id = (
              SELECT id
                FROM payment_methods
               WHERE user_id = $1 AND deleted_at IS NULL
               ORDER BY created_at DESC
               LIMIT 1
            )`,
          [userId],
        );
      }

      await client.query('COMMIT');
      return mapPaymentMethodRow(deletedMethod);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new PaymentMethodService();
