// Importações necessárias
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const express = require('express');
const pool = require('../db'); // Importa o pool de conexões do banco de dados
const router = express.Router();

// Configuração do cliente S3
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID, // Use variáveis de ambiente para segurança
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY, // Use variáveis de ambiente para segurança
    },
});

// Função que define o tipo de arquivo e cabeçalhos HTTP
function defineArqTipo(arquivo, res, modo) {
    if (!res || typeof res.setHeader !== 'function') {
        console.error('Erro: Objeto res inválido ou não é do Express.');
        throw new TypeError('Objeto res inválido ou não é do Express.');
    }

    const fileExtension = arquivo.nome.split('.').pop().toLowerCase();

    // Mapeia extensões de arquivos para os tipos MIME
    const mimeTypes = {
        pdf: 'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
    };

    // Obtém o tipo MIME ou define um padrão genérico
    const contentType = mimeTypes[fileExtension] || 'application/octet-stream';

    // Define os cabeçalhos HTTP
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `${modo}; filename="${arquivo.nome}"`);

    return contentType;
}

// Função que busca detalhes do arquivo no banco de dados por código criptografado
async function buscarArquivoPorCodigo(codigo) {
    let connection;
    try {
        console.error('Tentando conectar no banco de dados');
        const query = `SELECT nome_original AS nome, nome_s3, url AS url_s3 FROM arquivos WHERE codigo_criptografado = ? LIMIT 1`;
        const [rows] = await pool.query(query, [codigo]);
        console.error('Foi');
        if (rows.length === 0) {
            return null; // Nenhum arquivo encontrado
        }
        console.error('Retornando o arquivo!');
        return rows[0];
    } catch (err) {
        console.error('Erro ao consultar o banco de dados:', err);
        throw new Error('Erro interno ao buscar arquivo');
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Endpoint para visualizar ou baixar arquivos
router.get('/:codigo', async (req, res) => {
    const arquivoCodigo = req.params.codigo; // Código criptografado vindo da URL
    const modo = 'inline'; // Define o comportamento: 'inline' ou 'attachment'
    console.error('Vamos tentar ', arquivoCodigo);
    try {
        // Busca detalhes do arquivo no banco de dados
        const arquivo = await buscarArquivoPorCodigo(arquivoCodigo);

        if (!arquivo || !arquivo.url_s3) {
            return res.status(404).send('Arquivo não encontrado');
        }

        // Configura os parâmetros para buscar o arquivo no S3
        const params = {
            Bucket: process.env.AWS_BUCKET_NAME, // Nome do bucket S3 (via variável de ambiente)
            Key: arquivo.nome_s3,  // Caminho do arquivo no bucket
        };

        try {
            // Executa o comando e obtém a resposta do S3
            const response = await s3Client.send(new GetObjectCommand(params));

            if (response.Body) {
                console.log('arquivo.nome_s3 =', arquivo.url_s3);

                // Define os cabeçalhos e tipo de arquivo
                const contentType = defineArqTipo(arquivo, res, modo);

                // Decide se será visualizado ou baixado
                if (contentType.startsWith('image/') || contentType === 'application/pdf') {
                    // Exibe o arquivo no navegador
                    response.Body.pipe(res);
                } else {
                    // Força o download para arquivos não suportados
                    res.setHeader('Content-Disposition', `attachment; filename="${arquivo.nome}"`);
                    response.Body.pipe(res);
                }

                // Lida com erros no stream
                response.Body.on('error', (err) => {
                    console.error('Erro ao transmitir o arquivo:', err);
                    res.status(500).send('Erro ao transmitir o arquivo');
                });
            } else {
                console.error('Erro: O corpo da resposta do S3 está vazio.');
                res.status(404).send('Arquivo não encontrado no S3.');
            }
        } catch (err) {
            console.error('Erro ao obter o arquivo do S3:', err);
            res.status(500).send('Erro interno ao obter o arquivo do S3.');
        }
    } catch (err) {
        console.error('Erro na API:', err);
        res.status(500).send('Erro interno na API');
    }
});

// Exporta o roteador para ser usado em outros módulos
module.exports = router;