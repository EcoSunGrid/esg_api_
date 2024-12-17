const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const router = express.Router();

const upload = multer({ dest: process.env.UPLOAD_DIR });

router.post('/', upload.single('template'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Arquivo não enviado' });
    }

    const variables = req.body; // Dados enviados na requisição
    const templatePath = req.file.path;

    try {
        // Lê o arquivo Excel
        const workbook = xlsx.readFile(templatePath);

        // Substituir variáveis no Excel
        workbook.SheetNames.forEach((sheetName) => {
            const sheet = workbook.Sheets[sheetName];

            // Itera sobre as células da planilha
            Object.keys(sheet).forEach((cell) => {
                if (cell[0] === '!') return; // Ignora metadados

                const cellValue = sheet[cell].v; // Valor da célula

                // Substitui placeholders (${variavel}) pelos valores de variables
                if (typeof cellValue === 'string' && cellValue.includes('${')) {
                    const variableName = cellValue.match(/\${(.*?)}/)?.[1]; // Extrai o nome da variável
                    if (variableName && variables[variableName] !== undefined) {
                        sheet[cell].v = variables[variableName]; // Substitui o valor
                    }
                }
            });
        });

        // Gera o Excel atualizado
        const excelBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=output.xlsx');
        res.send(excelBuffer);

    } catch (error) {
        console.error('Erro ao processar o documento:', error);
        res.status(500).json({ message: 'Erro ao processar o documento', error });
    } finally {
        fs.unlinkSync(templatePath); // Remove o arquivo temporário
    }
});

module.exports = router;