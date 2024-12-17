const https = require('https');
const fs = require('fs');
const express = require('express');
const pool = require('./db');
const verificarToken = require('./middlewares/auth');

// importar rotas
const loginRoutes = require('./routes/loginRoutes'); // Caminho para o arquivo de rotas
const docxRoutes = require('./routes/docx'); // Caminho para o arquivo de rotas
const pdfRoutes = require('./routes/pdf'); // Caminho para o arquivo de rotas
const xlsxRoutes = require('./routes/xlsx'); // Caminho para o arquivo de rotas
const dbRouter = require('./routes/ConectDB');
const uploadRoutes = require('./routes/uploadRoutes'); // Importa as rotas de upload
// Lógica de inserção e utilização de documentos editáveis
const formatedDocument = require('./routes/formatedDocument'); // Importa as rotas de formatedDocument
const updateDocx = require('./routes/updateDocx'); // Importa as rotas de updateDocx

const app = express();
require('dotenv').config();
app.use(express.json());

app.use((req, res, next) => {
    const rotasPublicas = ['/login', '/signup']; // Liste aqui as rotas que não precisam de autenticação
    if (rotasPublicas.includes(req.path)) {
        return next(); // Ignora verificação de token para rotas públicas
    }
    // Aplica a verificação de token para rotas protegidas
    verificarToken(req, res, next);
});

// Lê os certificados
const options = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
};

// Inicia o servidor HTTPS
const PORT = process.env.PORT || 3000;
https.createServer(options, app).listen(PORT, () => {
    console.log(`Servidor rodando em HTTPS na porta ${PORT}`);
});

const http = require('http');

// Redireciona HTTP para HTTPS
const HTTP_PORT = 8080; // Porta para redirecionamento HTTP
http.createServer((req, res) => {
    const host = req.headers.host.replace(/:\d+$/, `:${PORT}`); // Ajusta a porta para HTTPS
    res.writeHead(301, { Location: `https://${host}${req.url}` });
    res.end();
}).listen(HTTP_PORT, () => {
    console.log(`Redirecionamento HTTP ativo na porta ${HTTP_PORT}`);
});

//-----------------------Rotas----------------------------
// Rota de Login
app.use('/login', loginRoutes)
app.use('/docx', docxRoutes);
app.use('/pdf', pdfRoutes);
app.use('/xlsx', xlsxRoutes);
// Adiciona o roteador da rota `/db`
app.use('/db', dbRouter);
// Usa as rotas de upload
app.use('/', uploadRoutes);
app.use('/upload', formatedDocument);
app.use('/docx', updateDocx);
//---------------------------------------------------------

// Testar conexão com o banco
app.get('/db-test', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT 1 + 1 AS result');
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Erro ao conectar ao banco de dados:', error);
        res.status(500).json({ success: false, error: 'Erro ao conectar ao banco' });
    }
});

// Rota de exemplo
app.get('/', (req, res) => {
    res.send('Bem-vindo à API segura com HTTPS!');
});