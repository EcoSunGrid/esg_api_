const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const pool = require('../db'); // Conexão com o banco de dados
const { uploadToS3 } = require('../services/s3'); // Função para upload ao S3

const router = express.Router();

// Rota para modificar um documento existente
router.post('/edit', async (req, res) => {
    try {
        const { file_identifier, variables, cliente_id, funcionario_id, titulo, versao, descricao, originalname } = req.body;
        // Validação de entrada
        if (!file_identifier || !variables || typeof variables !== 'object' || !cliente_id || !funcionario_id) {
            return res.status(400).json({ message: 'Parâmetros obrigatórios ausentes!' });
        }

        // Buscar o arquivo no banco de dados
        const query = `SELECT * FROM arquivos WHERE nome_original = ? OR url = ? OR id = ? LIMIT 1`;
        const [results] = await pool.query(query, [file_identifier, file_identifier, file_identifier]);

        if (results.length === 0) {
            return res.status(404).json({ message: 'Arquivo não encontrado!' });
        }

        const fileData = results[0];

        // Baixar o arquivo do S3
        console.log('fileData:', fileData);
        const filePath = path.resolve(__dirname, '../temp', `${Date.now()}-${fileData.nome_original}`);
        const response = await axios({
            url: fileData.url, // URL do S3 salva na tabela arquivos
            method: 'GET',
            responseType: 'arraybuffer',
        });
        fs.writeFileSync(filePath, response.data);

        // Processar o documento
        const content = fs.readFileSync(filePath, 'binary');
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
        });

        // Compilar e renderizar
        try {
            await doc.resolveData(variables); // Esse método ainda pode ser usado se estiver atualizado
            doc.render();
        } catch (error) {
            console.error('Erro ao renderizar o documento:', error);
            return res.status(500).json({ message: 'Erro ao processar o documento', error: error.message });
        }

        // Salvar o arquivo processado em local temporário
        const outputPath = path.resolve(__dirname, '../temp', `modified-${Date.now()}-${fileData.nome_original}`);
        const buffer = doc.getZip().generate({ type: 'nodebuffer' });
        console.log('Buffer gerado:', buffer);
        fs.writeFileSync(outputPath, buffer);

        // Nome único para o arquivo
        const uniqueFilename = `${Date.now()}-${originalname}`;
        console.log('Buffer enviado para S3:', buffer);
        console.log('Nome do arquivo único:', uniqueFilename);

        const file = {
            path: outputPath, // Passa o caminho do arquivo temporário
            mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // Tipo do documento
        };
        const s3Url = await uploadToS3(file, uniqueFilename);

        // Verifica se o arquivo já existe e o insere se necessário
        const insertArquivoQuery = `
        INSERT INTO arquivos (nome_original, nome_s3, url, tipo)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)
        `;

        const [arquivoResult] = await pool.query(insertArquivoQuery, [
        originalname,       // nome_original
        uniqueFilename,     // nome_s3
        s3Url,              // url
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'        // tipo
        ]);

        // Obtém o ID do arquivo recém-criado ou já existente
        const arquivoId = arquivoResult.insertId;

        // Agora, insere os dados na tabela link_documentos_formatados_clientes
        const insertQuery = `
        INSERT INTO link_documentos_formatados_clientes (
            documentos_formatados_id, titulo, versao, descricao, fk_arquivo_id, fk_cliente_id, fk_funcionario_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const [insertResult] = await pool.query(insertQuery, [
        fileData.id,       // documentos_formatados_id
        titulo,            // titulo
        versao,            // versao
        descricao,         // descricao
        arquivoId,         // fk_arquivo_id
        cliente_id,        // fk_cliente_id
        funcionario_id     // fk_funcionario_id
        ]);

        console.log('Dados inseridos na tabela:', insertResult);
        // Retornar o arquivo para download
        console.log('Output path:', outputPath);
        console.log('Modified file name:', `modified-${fileData.nome_original}`);
        res.download(outputPath, `modified-${fileData.nome_original}`, (err) => {
            if (err) {
                console.error('Erro ao enviar o arquivo:', err);
                return res.status(500).json({ message: 'Erro ao enviar o arquivo modificado' });
            }

            // Remover arquivos temporários
            fs.unlinkSync(filePath);
            fs.unlinkSync(outputPath);
        });
    } catch (error) {
        console.error('Erro ao processar o arquivo:', error);
        res.status(500).json({ message: 'Erro ao processar o arquivo!', error: error.message });
    }
});

module.exports = router;
