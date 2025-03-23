const { Pool } = require("pg");
const fs = require('fs');

require("dotenv").config();

const pool = new Pool({
  connectionString: `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`,
  ssl: {
    rejectUnauthorized: true,
    ca: process.env.DB_SSL_CERT
  }
});

module.exports = { pool };
