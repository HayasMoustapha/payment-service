const { database } = require('../config/database');

/**
 * Database query wrapper to handle Pool queries properly
 */
async function executeQuery(text, params) {
  const client = await database.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

module.exports = {
  query: executeQuery,
  database,
  connect: () => database.connect()
};
