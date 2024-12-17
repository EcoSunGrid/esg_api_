const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const router = express.Router();
const pool = require('../db'); // Configuração do banco de dados
const { uploadToS3 } = require('../services/s3'); // Função para upload ao S3
const upload = require('../middlewares/upload'); // Middleware de upload existente

// Diretório de uploads
const uploadDir = path.join(__dirname, '../uploads');

// Configuração do cliente S3
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// Certifique-se de que o diretório existe
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Rota para upload de arquivos para o S3
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Nenhum arquivo enviado' });
        }

        // Nome único para o arquivo
        const uniqueFilename = `${Date.now()}-${req.file.originalname}`;

        // Função para remover o arquivo local após o upload
        const removeLocalFile = (filePath) => {
            fs.unlink(filePath, (err) => {
                if (err) console.error('Erro ao remover arquivo local:', err);
            });
        };

        // Envia o arquivo para o S3
        const s3Url = await uploadToS3(req.file, uniqueFilename);

        // Remove o arquivo local
        removeLocalFile(req.file.path);

        // Salva as informações do arquivo no banco de dados
        const query = `
            INSERT INTO arquivos (nome_original, nome_s3, url, tipo, data_upload)
            VALUES (?, ?, ?, ?, NOW())
        `;
        const values = [
            req.file.originalname, // Nome original do arquivo
            uniqueFilename,        // Nome gerado no S3
            s3Url,                 // URL do arquivo no S3
            req.file.mimetype,     // Tipo do arquivo
        ];

        await pool.query(query, values);

        // Retorna a URL do arquivo no S3
        res.status(200).json({
            message: 'Arquivo enviado com sucesso para o S3',
            fileUrl: s3Url,
        });
    } catch (err) {
        console.error('Erro ao salvar arquivo:', err);
        res.status(500).json({ message: 'Erro ao salvar arquivo no banco de dados', error: err.message });
    }
});

// Rota para listar todos os arquivos
router.get('/files', async (req, res) => {
    const params = { Bucket: process.env.AWS_BUCKET_NAME };

    try {
        const command = new ListObjectsV2Command(params);
        const data = await s3Client.send(command);

        // Verifique se existem arquivos no bucket
        const files = data.Contents ? data.Contents.map((file) => ({
            key: file.Key,
            lastModified: file.LastModified,
            size: file.Size,
            url: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${file.Key}`,
        })) : [];

        res.status(200).json({ files });
    } catch (err) {
        console.error('Erro ao listar arquivos do S3:', err);
        res.status(500).json({ message: 'Erro ao listar arquivos do S3', error: err.message });
    }
});

// Rota para buscar um arquivo específico
router.get('/files/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);

    try {
        if (fs.existsSync(filePath)) {
            res.sendFile(filePath); // Envia o arquivo como resposta
        } else {
            res.status(404).json({ message: 'Arquivo não encontrado' });
        }
    } catch (err) {
        console.error('Erro ao buscar arquivo:', err);
        res.status(500).json({ message: 'Erro ao buscar arquivo', error: err.message });
    }
});

module.exports = router;
