// log in db
const { pool } = require('./dbConfig');

const DBLog = async (domain, type, message) => {
	  try {
	const result = await pool.query(
	  'INSERT INTO logs_webapp (domain, type, message) VALUES ($1, $2, $3) RETURNING *',
	  [domain, type, message]
	);
	return result.rows;
  } catch (error) {
	console.error(error);
  }
}

module.exports = { DBLog };