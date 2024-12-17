const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuração de armazenamento do multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/'; // Diretório local para salvar arquivos temporários

        // Verifica se o diretório existe, caso contrário, cria
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Gera um nome único para o arquivo
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
    },
});

// Configuração de filtros para tipos de arquivo
const fileFilter = (req, file, cb) => {
    const allowedExtensions = ['.docx', '.pdf', '.jpg', '.jpeg', '.png', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (!allowedExtensions.includes(ext)) {
        return cb(new Error('Tipo de arquivo não suportado. Use: .docx, .pdf, .jpg, .png, .txt'));
    }

    cb(null, true);
};

// Configuração do middleware de upload
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // Limite de 10 MB por arquivo
    },
});

module.exports = upload;