import { readFile } from 'node:fs/promises';
import { loadEnv } from './env.js';
import { fetchFn } from './fetch.js'; // Reusing shared fetch setup
import {
    generateKeywordsFromInput,
    detectScenario,
    summarizeCompetitorOffering,
    generateScenarioNarrative
} from './openrouter.js';
import {
    collectCommercialSites,
    expandSearchForSubstitutes,
    dedupeReferencesByTopic
} from './search.js';
import { runNegativeSearch } from './negative_search.js';
import { fetchPageText } from './content.js';
import { saveReports, renderPdfReport } from './report.js';
import { sendReportEmail } from './email.js';
import archiver from 'archiver';
import { createWriteStream } from 'node:fs';
import { renderBlueprintHtml } from './blueprint.js';
import { resolve } from 'node:path';
import { getFormattedAverage, saveRunTime } from './tracker.js';

// Polyfill removed, using import from cli.js

export async function runAnalysis(prompt, options = {}) {
    // Helper to log to both console and callback
    const log = (msg, type = 'info') => {
        console.log(`[CONDUCTOR] ${msg}`);
        if (options.onLog) options.onLog({ text: msg, type });
    };

    const startTime = Date.now();
    const estMinutes = await getFormattedAverage();
    if (estMinutes > 0) {
        log(`Tempo estimado: ~${estMinutes} minutos (baseado no histórico).`, 'info');
    } else {
        log(`Calculando estimativa de tempo inicial...`, 'info');
    }

    log(`Iniciando análise para: ${prompt}`);

    try {
        // Ensure Env is loaded
        await loadEnv();

        // And I also need to save the time at the end.
        // Since I can't do non-contiguous edits easily without MultiReplace, and I want to be safe...
        // I will use MultiReplaceFileContent.

        // Ensure Env is loaded
        // await loadEnv(); // This line is moved inside the try block of runAnalysis

        const f = await fetchFn();
        const braveKey = process.env.BRAVE_API_KEY;
        const openKey = process.env.OPENROUTER_API_KEY;

        if (!braveKey || !openKey) {
            throw new Error('Missing BRAVE_API_KEY or OPENROUTER_API_KEY');
        }

        // Email setup
        let sendEmail = !!options.email;
        let userEmail = options.email || '';
        const smtpConfig = {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        };

        if (sendEmail && (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass)) {
            log('Email solicitado mas configuração SMTP incompleta. Pulando envio.', 'warning');
            sendEmail = false;
        }

        // try { // This try block is now part of the outer runAnalysis try block
        // const startTime = Date.now(); // Already defined at the top of runAnalysis
        log('Iniciando a pesquisa de mercado...', 'info');
        let userInput = prompt;

        // 1. Keyword Generation
        log('Definindo estratégia e palavras-chave...', 'info');
        let keywordPlan = await generateKeywordsFromInput(f, openKey, userInput);

        // Handle Ambiguity
        if ((keywordPlan.confidence || 0) < 0.7) {
            log('Confiança da análise inicial baixa, mas prosseguindo...', 'warning');
        }

        const extraKw = Array.from(new Set([...(keywordPlan.competitor || []), ...(keywordPlan.reference || [])]));
        log(`Explorando o mercado (${extraKw.length} variações)...`, 'info');

        // 2. Initial Broad Search
        let catalog = await collectCommercialSites(f, braveKey, userInput, 100, 20, openKey, extraKw, (info) => {
            // Optional: finer grained logging from search
        });

        // 3. Scenario Detection
        const scenario = await detectScenario(f, openKey, userInput, catalog.competitors, catalog.references);
        log(`Cenário de Mercado Detectado: ${scenario}`, 'success');

        // 4. Adaptive Search (Blue Ocean Pivot)
        if (scenario === 'BLUE_OCEAN' && catalog.competitors.length < 3) {
            log('Cenário Mar Azul: Buscando soluções substitutas...', 'info');
            const substitutes = await expandSearchForSubstitutes(f, braveKey, userInput);
            for (const sub of substitutes) {
                catalog.competitors.push({ title: sub.title, url: sub.url, description: sub.description, product_service: 'Solução Substituta (Workaround)' });
            }
        }

        const total = (catalog.competitors?.length || 0) + (catalog.references?.length || 0);
        if (!total) {
            throw new Error('Nenhum resultado relevante encontrado para este termo.');
        }

        log(`${catalog.competitors.length} concorrentes/substitutos identificados.`, 'info');

        // 5. Competitor Analysis
        log('Analisando concorrentes em profundidade...', 'info');
        const processCompetitor = async (r, i) => {
            try {
                // log(`Lendo página: ${r.title || r.url}`); // Too verbose?
                const text = await fetchPageText(f, r.url, 8000);
                const sum = await summarizeCompetitorOffering(f, openKey, userInput, r, text);
                return { ...r, ...sum };
            } catch (err) {
                return { ...r, error: err.message };
            }
        };

        const competitorDetails = [];
        const queue = [...catalog.competitors];
        let index = 0;
        const worker = async () => {
            while (queue.length > 0) {
                const item = queue.shift();
                const result = await processCompetitor(item, index++);
                competitorDetails.push(result);
                if (index % 2 === 0) log(`Analisados ${index}/${catalog.competitors.length} concorrentes...`);
            }
        };
        await Promise.all(Array(Math.min(5, queue.length)).fill(null).map(() => worker()));

        // 6. Negative Search
        log('Investigando reclamações e dores de usuários (Negative Search)...', 'info');
        const negativeData = await runNegativeSearch(f, braveKey, openKey, userInput, scenario, competitorDetails);

        log('Refinando e filtrando dados...', 'info');
        const filteredRefs = await dedupeReferencesByTopic(f, openKey, userInput, catalog.references);

        // 7. Generative Narrative
        const reportData = {
            keywordPlan,
            extraKeywords: extraKw,
            competitors: catalog.competitors,
            competitorDetails: competitorDetails.map(c => ({ ...c, reclameAqui: negativeData.filter(n => n.brand === c.title || n.brand === c.host) })),
            negativeData,
            referencesBefore: catalog.references.length,
            referencesAfter: filteredRefs.length,
        };

        log('Escrevendo narrativa estratégica final...', 'info');
        const narratives = await generateScenarioNarrative(f, openKey, userInput, reportData, scenario);
        const finalData = { ...reportData, narratives, scenario };

        // 8. Save Files
        log('Gerando arquivos do relatório...', 'info');
        const files = await saveReports(userInput, finalData);
        log(`Arquivos salvos.`, 'success');

        log('Renderizando PDF do Estudo...', 'info');
        await renderPdfReport(await readFile(files.html, 'utf8'), files.pdf);

        // 9. Generate Blueprint
        log('Gerando Blueprint de Produto...', 'info');
        const blueprintHtml = renderBlueprintHtml(userInput);
        const blueprintPath = files.pdf.replace('.pdf', '_Blueprint.pdf');
        await renderPdfReport(blueprintHtml, blueprintPath);

        // 10. Create ZIP
        log('Empacotando Kit Plan Genie...', 'info');
        const zipPath = files.pdf.replace('.pdf', '_Kit.zip');
        const output = createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        const absPdfPath = resolve(files.pdf);
        const absBlueprintPath = resolve(blueprintPath);

        await new Promise((resolve, reject) => {
            output.on('close', resolve);
            archive.on('error', reject);
            archive.pipe(output);
            archive.file(absPdfPath, { name: 'Estudo_de_Mercado_PlanGenie.pdf' });
            archive.file(absBlueprintPath, { name: 'Blueprint_de_Produto_PlanGenie.pdf' });
            archive.finalize();
        });

        if (sendEmail && zipPath) {
            log(`Enviando email para ${userEmail}...`, 'info');
            try {
                // Modified to send ZIP or both files. Let's send the ZIP for convenience.
                // Assuming sendReportEmail can handle a generic path or we need to update it.
                // For now, let's pass the ZIP path but update email.js to handle attachment name dynamically if needed, 
                // OR just update the call logic in email.js.
                // Note: The variable passed is 'files.pdf' in original code. 
                // We will reuse the function but pass zipPath.
                await sendReportEmail(userEmail, zipPath, userInput, smtpConfig);
                log('Email enviado com sucesso!', 'success');
            } catch (emailErr) {
                log(`Falha no envio de email: ${emailErr.message}`, 'error');
            }
        }

        const endTime = Date.now();
        await saveRunTime(endTime - startTime);

        return {
            pdfPath: files.pdf, // Keep for legacy reference if needed
            zipPath: zipPath,   // New return
            jsonPath: files.json,
            htmlPath: files.html
        };

    } catch (err) {
        log(`Falha crítica: ${err.message}`, 'error');
        throw err;
    }
}
