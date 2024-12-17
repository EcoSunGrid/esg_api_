const express = require('express');
const fs = require('fs');
const path = require('path');
const { uploadToS3 } = require('../services/s3'); // Função para upload ao S3
const upload = require('../middlewares/upload'); // Middleware de upload
const pool = require('../db'); // Conexão com o banco de dados
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');

const router = express.Router();

// Rota para upload de arquivos e processamento de contratos
router.post('/formatedDocument', upload.single('file'), async (req, res) => {
    const connection = await pool.getConnection(); // Iniciar conexão com transação
    try {
        // Verifica se o arquivo foi enviado
        if (!req.file) {
            return res.status(400).json({ message: 'Nenhum arquivo foi enviado!' });
        }

        const file = req.file;

        // Verifica se o arquivo é um documento Word (.docx)
        const fileExt = path.extname(file.originalname).toLowerCase();
        if (fileExt !== '.docx') {
            return res.status(400).json({ message: 'Apenas arquivos .docx são permitidos!' });
        }

        const { titulo, descricao } = req.body;
        if (!titulo || !descricao) {
            throw new Error('Título e descrição são obrigatórios!');
        }

        // Nome único para o arquivo no S3
        const uniqueFilename = `${Date.now()}-${file.originalname}`;

        // Faz o upload para o S3
        const s3Url = await uploadToS3(file, uniqueFilename);

        // Processar o arquivo Word com docxtemplater
        const content = fs.readFileSync(file.path, 'binary'); // Lê o conteúdo do arquivo como binário
        const zip = new PizZip(content); // Usa PizZip para carregar o conteúdo do arquivo
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
        });

        // Obter o texto completo do documento
        const fullText = doc.getFullText();

        // Usar regex para capturar variáveis no formato ${variavel}
        const regex = /\{([^}]+)\}/g; // Nova regex (para {variavel})
        const variables = [];
        let match;
        while ((match = regex.exec(fullText)) !== null) {
            variables.push(match[1]); // Adiciona apenas o nome da variável
        }

        // Iniciar transação
        await connection.beginTransaction();

        // Salvar na tabela `arquivos`
        const arquivoQuery = `
            INSERT INTO arquivos (nome_original, nome_s3, url, tipo, data_upload)
            VALUES (?, ?, ?, ?, NOW());
        `;
        const arquivoValues = [
            file.originalname, // Nome original do arquivo
            uniqueFilename,    // Nome gerado no S3
            s3Url,             // URL do arquivo no S3
            file.mimetype,     // Tipo do arquivo
        ];
        const [arquivoResult] = await connection.query(arquivoQuery, arquivoValues);
        const arquivoId = arquivoResult.insertId;

        // Salvar na tabela `documentos_formatados`
        const docQuery = `
            INSERT INTO documentos_formatados (fk_arquivo_id, titulo, descricao)
            VALUES (?, ?, ?);
        `;
        await connection.query(docQuery, [arquivoId, titulo, descricao]);

        // Salvar na tabela `variaveis_editaveis`
        const varQuery = `
            INSERT INTO variaveis_editaveis (fk_arquivo_id, nome_variavel)
            VALUES (?, ?);
        `;
        for (const variable of variables) {
            await connection.query(varQuery, [arquivoId, variable]);
        }

        // Confirmar transação
        await connection.commit();

        // Responder com informações do upload e as variáveis encontradas
        res.status(200).json({
            message: 'Arquivo enviado e processado com sucesso!',
            fileUrl: s3Url,
            variables,
        });

        // Remover o arquivo temporário
        fs.unlinkSync(file.path);
    } catch (error) {
        await connection.rollback(); // Reverter transação em caso de erro
        console.error('Erro ao processar o upload do contrato:', error);
        res.status(500).json({ message: 'Erro ao processar o arquivo!', error: error.message });
    } finally {
        connection.release(); // Liberar conexão
    }
});

module.exports = router;
