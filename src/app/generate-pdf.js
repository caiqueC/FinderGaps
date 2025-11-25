import { readFile } from 'node:fs/promises';
import { loadEnv } from '../services/env.js';
import { generateReportNarrative } from '../services/openrouter.js';
import { renderHtmlReport, renderPdfReport } from '../services/report.js';

const fetchFn = async () => {
    if (typeof fetch !== 'undefined') return fetch;
    const mod = await import('node-fetch');
    return mod.default;
};

async function main() {
    const argPath = process.argv[2];
    if (!argPath) {
        console.error('Informe o caminho do arquivo JSON: node src/app/generate-pdf.js reports/<arquivo>.json');
        process.exit(1);
    }

    console.log('Carregando ambiente...');
    await loadEnv();
    const openKey = process.env.OPENROUTER_API_KEY;
    if (!openKey) {
        console.error('OPENROUTER_API_KEY não encontrada no .env');
        process.exit(1);
    }

    console.log(`Lendo arquivo: ${argPath}`);
    const raw = await readFile(argPath, 'utf8');
    const data = JSON.parse(raw);

    console.log('Gerando narrativas com IA (isso pode levar alguns segundos)...');
    const f = await fetchFn();
    const narratives = await generateReportNarrative(f, openKey, data.term, data);

    if (narratives) {
        console.log('Narrativas geradas com sucesso.');
    } else {
        console.warn('Falha ao gerar narrativas. O relatório será gerado sem textos explicativos.');
    }

    console.log('Renderizando HTML atualizado...');
    const html = renderHtmlReport({ ...data, narratives });

    const base = argPath.replace(/\.json$/i, '');
    const pdfPath = `${base}.pdf`;

    console.log(`Gerando PDF em: ${pdfPath}`);
    await renderPdfReport(html, pdfPath);

    console.log('Concluído!');
}

main();
