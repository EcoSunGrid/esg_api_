require('dotenv').config();
const express = require('express');
const pool = require('../db'); // Importa o pool de conexões do banco de dados

// Cria o roteador
const router = express.Router();

// Testa a conexão com o banco de dados
async function testConnection() {
    try {
        const connection = await pool.getConnection(); // Obtém uma conexão do pool
        console.log('Conexão com o banco de dados bem-sucedida!');
        connection.release(); // Libera a conexão
    } catch (err) {
        console.error('Erro ao conectar ao banco de dados:', err);
        throw new Error('Erro ao conectar ao banco de dados');
    }
}

// Configura a rota para testar a conexão
router.get('/', async (req, res) => {
    try {
        testConnection();
        res.status(200).json({ message: 'Sucesso ao acessar o banco de dados!' });
    } catch (err) {
        console.error('Erro ao acessar o banco de dados');
        res.status(500).json({ error: 'Erro ao acessar o banco de dados' });
    }
});

// Exporta o roteador e a função de teste
module.exports = router;