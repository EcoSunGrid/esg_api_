const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const mammoth = require('mammoth');
const puppeteer = require('puppeteer');

const router = express.Router();

// Configuração do Multer para upload
const upload = multer({ dest: process.env.UPLOAD_DIR });

// Função para converter HTML para PDF
async function convertHtmlToPdf(htmlContent, outputPath) {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(htmlContent);
    await page.pdf({ path: outputPath, format: 'A4' });
    await browser.close();
}

// Rota para processar o arquivo Word
router.post('/', upload.single('template'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Arquivo não enviado' });
    }

    const variables = req.body;
    const format = req.query.format || 'docx';
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

        if (format === 'pdf') {
            const { value: htmlContent } = await mammoth.convertToHtml({ path: modifiedDocPath });
            const pdfPath = `${process.env.UPLOAD_DIR}/output_${Date.now()}.pdf`;
            await convertHtmlToPdf(htmlContent, pdfPath);

            // Enviar PDF gerado
            res.sendFile(path.resolve(pdfPath), (err) => {
                if (err) {
                    console.error('Erro ao enviar o PDF:', err);
                    res.status(500).json({ message: 'Erro ao enviar o PDF' });
                } else {
                    fs.unlinkSync(modifiedDocPath);
                    fs.unlinkSync(pdfPath);
                }
            });
        }else if (format === 'xlsx' || format === 'excel'){
            // Lê as variáveis enviadas no corpo da requisição
            const variables = req.body;

            // Cria um novo workbook
            const workbook = xlsx.utils.book_new();

            // Cria a worksheet diretamente a partir de variables
            const worksheet = xlsx.utils.json_to_sheet(
                Object.entries(variables).map(([key, value]) => ({
                    Variável: key,
                    Valor: typeof value === 'object' ? JSON.stringify(value) : value,
                }))
            );

            // Adiciona a worksheet ao workbook
            xlsx.utils.book_append_sheet(workbook, worksheet, 'Dados');

            // Gera o buffer para o Excel
            const excelBuffer = xlsx.write(workbook, {
                type: 'buffer',
                bookType: 'xlsx',
            });

            // Define os cabeçalhos para envio do Excel
            res.setHeader(
                'Content-Type',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );
            res.setHeader(
                'Content-Disposition',
                'attachment; filename=output.xlsx'
            );

            // Envia o arquivo Excel gerado
            return res.send(excelBuffer);
        }else if (format === 'docx' || format === 'word'){
            // Enviar Word gerado
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Disposition', `attachment; filename=output.docx`);
            res.send(buffer);
        }else{
            console.error('Erro ao processar o documento:', error);
            return res.status(400).json({
                error: "Invalid format",
                message: "The 'format' parameter is required and must be one of the following values: pdf, word or docx, excel or xlsx."
            });
        }
    } catch (error) {
        console.error('Erro ao processar o documento:', error);
        res.status(500).json({ message: 'Erro ao processar o documento', error });
    } finally {
        fs.unlinkSync(templatePath);
    }
});

module.exports = router;
