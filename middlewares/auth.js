const jwt = require('jsonwebtoken');
require('dotenv').config();

function verificarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ message: 'Token não fornecido' });
    }

    const token = authHeader.split(' ')[1]; // Remove o "Bearer" e pega o token
    if (!token) {
        return res.status(401).json({ message: 'Token inválido' });
    }

    try {
        // Verifica o token
        const payload = jwt.verify(token, process.env.JWT_SECRET);

        // Adicione aqui lógica extra para invalidar tokens se necessário
        if (tokenDeveSerInvalidado(payload)) {
            return res.status(403).json({ message: 'Token inválido ou revogado' });
        }

        // Adicione o usuário ao objeto req, caso necessário
        req.user = payload;

        next(); // Continua para a próxima função de rota
    } catch (error) {
        return res.status(403).json({ message: 'Token inválido ou expirado', error: error.message });
    }
}

function tokenDeveSerInvalidado(payload) {
    // Aqui você pode adicionar qualquer lógica para invalidar tokens.
    return false; // Mude para true se o token não for mais válido.
}

// Exporta ambas as funções
module.exports = verificarToken;
