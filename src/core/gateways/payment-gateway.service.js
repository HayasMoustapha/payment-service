const { query } = require('../../utils/database-wrapper');

class PaymentGatewayService {
  async listGateways({ includeInactive = false } = {}) {
    const sql = includeInactive
      ? 'SELECT * FROM payment_gateways ORDER BY id ASC'
      : 'SELECT * FROM payment_gateways WHERE is_active = true ORDER BY id ASC';
    const result = await query(sql);
    return result.rows;
  }

  async getGateway(gatewayId) {
    const result = await query('SELECT * FROM payment_gateways WHERE id = $1', [gatewayId]);
    return result.rows[0] || null;
  }

  async createGateway({ name, code, is_active = true, config = {} }) {
    const result = await query(
      `INSERT INTO payment_gateways (name, code, is_active, config)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, code, is_active, JSON.stringify(config)]
    );
    return result.rows[0];
  }

  async updateGateway(gatewayId, { name, code, is_active, config }) {
    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(name);
    }
    if (code !== undefined) {
      fields.push(`code = $${idx++}`);
      values.push(code);
    }
    if (is_active !== undefined) {
      fields.push(`is_active = $${idx++}`);
      values.push(is_active);
    }
    if (config !== undefined) {
      fields.push(`config = $${idx++}`);
      values.push(JSON.stringify(config));
    }

    if (fields.length === 0) {
      return this.getGateway(gatewayId);
    }

    values.push(gatewayId);
    const result = await query(
      `UPDATE payment_gateways SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }
}

module.exports = new PaymentGatewayService();
