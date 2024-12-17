const express = require('express');
const multer = require('multer');
const fs = require('fs');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const router = express.Router();

// Configuração do Multer para upload
const upload = multer({ dest: process.env.UPLOAD_DIR });

// Rota para processar o arquivo Word
router.post('/', upload.single('template'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Arquivo não enviado' });
    }

    const variables = req.body;
    const templatePath = req.file.path;

    try {
        const content = fs.readFileSync(templatePath, 'binary');
        const zip = new PizZip(content);

        const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            delimiters: {
                start: '${',
                end: '}',
            },
        });

        // Substituir variáveis
        doc.render(variables);

        const buffer = doc.getZip().generate({ type: 'nodebuffer' });
        const modifiedDocPath = `${process.env.UPLOAD_DIR}/output_${Date.now()}.docx`;
        fs.writeFileSync(modifiedDocPath, buffer);
        
        // Enviar Word gerado
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename=output.docx`);
        res.send(buffer);
    } catch (error) {
        console.error('Erro ao processar o documento:', error);
        res.status(500).json({ message: 'Erro ao processar o documento', error });
    } finally {
        fs.unlinkSync(templatePath);
    }
});

module.exports = router;
