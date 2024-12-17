require('dotenv').config(); // Carrega variáveis do arquivo .env
const mysql = require('mysql2/promise'); // Biblioteca MySQL com suporte a Promises

// Cria o pool de conexões
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10, // Número máximo de conexões simultâneas
    queueLimit: 0,       // Fila de conexões sem limite
});

module.exports = pool; // Exporta o pool para ser usado em outros arquivos