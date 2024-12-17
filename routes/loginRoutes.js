const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db'); // Configure para conectar ao seu banco de dados
require('dotenv').config();

const loginRoutes = express.Router();

// Função para criar o hash da senha usando SHA-256
// function hashSenha(senha) {
//     return crypto.createHash('sha256').update(senha, 'utf8').digest('hex').toUpperCase();
// }

loginRoutes.post('/', async (req, res) => {
    const { cpf, senha_longa } = req.body;

    try {
        // Gera o hash da senha fornecida
        // const senhaHashed = hashSenha(senha_longa);
        const senhaHashed = senha_longa;

        // Verifica se o cliente existe no banco de dados com o CPF e a senha hashada
        const query = 'SELECT * FROM funcionario WHERE cpf = ? AND senha_longa = ?';
        console.log(`SELECT * FROM funcionario WHERE cpf = ${cpf} AND senha_longa = ${senhaHashed}`)
        const [results] = await db.query(query, [cpf, senhaHashed]);
        console.log('Results:', results);
        console.log('Results length:', results.length);
        // Verificação correta para verificar se o registro existe
        if (!results || results.length === 0) {
            return res.status(401).json({ message: 'CPF ou senha inválidos' });
        }

        const cliente = results[0];
        console.log('cliente == '+cliente)
        // Geração do token JWT
        const token = jwt.sign(
            { id: cliente.id, cpf: cliente.cpf },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao processar o login' });
    }
});

module.exports = loginRoutes;
