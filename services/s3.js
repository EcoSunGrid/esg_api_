const fs = require('fs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// Verifica se as variáveis de ambiente necessárias estão definidas
if (!process.env.AWS_BUCKET_NAME || !process.env.AWS_REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error('Configuração da AWS incompleta. Certifique-se de definir AWS_BUCKET_NAME, AWS_REGION, AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY.');
}

// Configuração do cliente S3
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// Função para fazer upload de arquivo ao S3
async function uploadToS3(file, filename) {
    // Lê o conteúdo do arquivo localmente
    const fileContent = fs.readFileSync(file.path);

    // Parâmetros do upload
    const params = {
        Bucket: process.env.AWS_BUCKET_NAME, // Nome do bucket
        Key: filename, // Nome do arquivo no S3
        Body: fileContent, // Conteúdo do arquivo
        ContentType: file.mimetype, // Tipo do conteúdo
    };

    try {
        // Executa o comando de upload no S3
        const command = new PutObjectCommand(params);
        const result = await s3Client.send(command);

        console.log('Upload bem-sucedido:', result);

        // Retorna a URL pública do arquivo
        return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${filename}`;
    } catch (error) {
        console.error('Erro ao fazer upload para o S3:', error);
        throw new Error('Falha no upload para o S3');
    }
}

module.exports = { uploadToS3 };
