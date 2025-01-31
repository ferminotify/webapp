// log in db
const { pool } = require('./dbConfig');

const DBLog = async (domain) => {
	try {
	const result = await pool.query(
	  'INSERT INTO webapp_stats (timestamp, domain) VALUES (NOW(), $1)',
	  [domain]
	);
	return result.rows;
  } catch (error) {
	// do nothing
  }
}

const DBLogError = async (errorMessage) => {
	try {
	const result = await pool.query(
	  `INSERT INTO logs_webapp (timestamp, type, message) VALUES (NOW(), 'error', $1)`,
	  [errorMessage]
	);
	return result.rows;
  } catch (error) {
	console.log(error);
  }
}

module.exports = { DBLog, DBLogError };