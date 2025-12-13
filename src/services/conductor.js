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
import { saveLead, saveReport } from './supabase.js';
import archiver from 'archiver';
import { createWriteStream } from 'node:fs';
import { renderBlueprintHtml } from './blueprint.js';
import { resolve } from 'node:path';
import { getFormattedAverage, saveRunTime } from './tracker.js';

// Polyfill removed, using import from cli.js

export async function runAnalysis(prompt, options = {}) {
    // Options: email, onLog, jobId, initialState, onCheckpoint
    const { email: userEmail, onLog, jobId, initialState = {}, onCheckpoint } = options;
    const log = (msg, type = 'info') => {
        if (onLog) onLog({ message: msg, type });
        console.log(`[CONDUCTOR] ${msg}`);
    };

    // Helper to checkpoint state
    const saveState = async (step, data) => {
        if (onCheckpoint) {
            await onCheckpoint(step, data);
        }
    };

    // 1. Save Lead (Fire-and-forget or await? Fast enough to await to get ID)
    let leadId = null;
    if (userEmail) {
        saveLead(userEmail).then(id => {
            leadId = id;
            if (id) console.log(`[SUPABASE] Lead tracked: ${id}`);
        });
    }

    const startTime = Date.now();
    log(`Iniciando análise para: ${prompt.substring(0, 50)}...`);

    try {
        await loadEnv();

        const f = await fetchFn();
        const braveKey = process.env.BRAVE_API_KEY;
        const openKey = process.env.OPENROUTER_API_KEY;

        if (!braveKey || !openKey) {
            throw new Error('Missing BRAVE_API_KEY or OPENROUTER_API_KEY');
        }

        // Email setup
        let sendEmail = !!userEmail;
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

        let userInput = prompt;

        // --- ZERO COST TEST MODE ---
        if (userInput.startsWith('[TEST]')) {
            log('⚠️ MODO TESTE DETECTADO: Simulando análise sem custo...', 'warning');

            const steps = [
                { step: 'keywords', label: 'Gerando palavras-chave fake...', time: 2000 },
                { step: 'search', label: 'Simulando busca no Google...', time: 2000 },
                { step: 'analysis', label: 'Lendo sites simulados...', time: 3000 },
                { step: 'narrative', label: 'Escrevendo relatório fake...', time: 2000 }
            ];

            for (const s of steps) {
                log(s.label);
                // Checkpoint
                await saveState(s.step, { test_data: 'mock', ...initialState });
                // Sleep
                await new Promise(r => setTimeout(r, s.time));
            }

            log('Teste concluído com sucesso.', 'success');
            return {
                pdfPath: 'mock_report.pdf',
                zipPath: 'mock_kit.zip',
                jsonPath: 'mock_data.json',
                htmlPath: 'mock_view.html'
            };
        }

        // --- STEP 1: KEYWORDS ---
        let keywordPlan = initialState.keywordPlan;
        if (!keywordPlan) {
            log('Definindo estratégia e palavras-chave...', 'info');
            keywordPlan = await generateKeywordsFromInput(f, openKey, userInput);
            await saveState('keywords', { ...initialState, keywordPlan });
        } else {
            log('Recuperando estratégia de palavras-chave do banco...', 'success');
        }

        const extraKw = Array.from(new Set([...(keywordPlan.competitor || []), ...(keywordPlan.reference || [])]));

        // --- STEP 2: BROAD SEARCH (CATALOG) ---
        let catalog = initialState.catalog;
        if (!catalog) {
            log(`Explorando o mercado (${extraKw.length} variações)...`, 'info');
            catalog = await collectCommercialSites(f, braveKey, userInput, 100, 20, openKey, extraKw, (info) => {
                if (info.event === 'variants') {
                    log(`Estratégia definida: Investigando ${info.count} ângulos de busca...`, 'info');
                } else if (info.event === 'searching_variant') {
                    if (info.current % 3 === 0 || info.current === info.total) {
                        log(`Analisando dimensão: ${info.query} (${info.current}/${info.total})...`, 'info');
                    }
                } else if (info.event === 'domains') {
                    log(`Scanner concluído: ${info.count} sites candidatos encontrados.`, 'success');
                } else if (info.event === 'classified') {
                    log(`Classificação de IA: ${info.competitors} concorrentes diretos e ${info.references} referências.`, 'info');
                }
            });
            await saveState('search', { ...initialState, keywordPlan, catalog });
        } else {
            log('Recuperando catálogo de concorrentes do banco...', 'success');
        }

        // --- STEP 3: SCENARIO ---
        let scenario = initialState.scenario;
        if (!scenario) {
            scenario = await detectScenario(f, openKey, userInput, catalog.competitors, catalog.references);
            log(`Cenário de Mercado Detectado: ${scenario}`, 'success');
            await saveState('scenario', { ...initialState, keywordPlan, catalog, scenario });
        } else {
            log(`Cenário recuperado: ${scenario}`, 'success');
        }

        // --- STEP 4: ADAPTIVE SEARCH (BLUE OCEAN) ---
        let substitutesAdded = initialState.substitutesAdded;
        if (scenario === 'BLUE_OCEAN' && catalog.competitors.length < 3 && !substitutesAdded) {
            log('Cenário Mar Azul: Buscando soluções substitutas...', 'info');
            const substitutes = await expandSearchForSubstitutes(f, braveKey, userInput);
            for (const sub of substitutes) {
                if (!catalog.competitors.find(c => c.url === sub.url)) {
                    catalog.competitors.push({ title: sub.title, url: sub.url, description: sub.description, product_service: 'Solução Substituta (Workaround)' });
                }
            }
            await saveState('adaptive_search', { ...initialState, keywordPlan, catalog, scenario, substitutesAdded: true });
        }

        const total = (catalog.competitors?.length || 0) + (catalog.references?.length || 0);
        if (!total) throw new Error('Nenhum resultado relevante encontrado para este termo.');

        log(`${catalog.competitors.length} concorrentes/substitutos identificados.`, 'info');

        // --- STEP 5: COMPETITOR ANALYSIS (PARTIAL RESUME) ---
        log('Analisando concorrentes em profundidade...', 'info');

        let competitorDetails = initialState.competitorDetails || [];
        const processedUrls = new Set(competitorDetails.map(c => c.url));
        const queue = catalog.competitors.filter(c => !processedUrls.has(c.url));

        if (queue.length > 0) {
            log(`Retomando análise de ${queue.length} concorrentes restantes...`);

            const processCompetitor = async (r, i) => {
                try {
                    const text = await fetchPageText(f, r.url, 8000);
                    const sum = await summarizeCompetitorOffering(f, openKey, userInput, r, text);
                    return { ...r, ...sum };
                } catch (err) {
                    return { ...r, error: err.message };
                }
            };

            let index = processedUrls.size;
            const CHUNK_SIZE = 3;
            for (let i = 0; i < queue.length; i += CHUNK_SIZE) {
                const chunk = queue.slice(i, i + CHUNK_SIZE);
                const results = await Promise.all(chunk.map(item => processCompetitor(item, index++)));
                competitorDetails.push(...results);

                log(`Processados ${competitorDetails.length}/${catalog.competitors.length}...`);

                await saveState('analysis_partial', { ...initialState, keywordPlan, catalog, scenario, substitutesAdded: true, competitorDetails });
            }

            await saveState('analysis_complete', { ...initialState, keywordPlan, catalog, scenario, substitutesAdded: true, competitorDetails });
        } else {
            log('Análise de concorrentes já concluída.', 'success');
        }

        // --- STEP 6: NEGATIVE SEARCH ---
        let negativeData = initialState.negativeData;
        if (!negativeData) {
            log('Investigando reclamações e dores de usuários (Negative Search)...', 'info');
            negativeData = await runNegativeSearch(f, braveKey, openKey, userInput, scenario, competitorDetails);
            await saveState('negative_search', { ...initialState, keywordPlan, catalog, scenario, substitutesAdded: true, competitorDetails, negativeData });
        } else {
            log('Dados de reclamações recuperados.', 'success');
        }

        // --- STEP 7: NARRATIVE ---
        let narratives = initialState.narratives;
        let filteredRefs = initialState.filteredRefs;

        if (!filteredRefs) {
            log('Refinando e filtrando dados...', 'info');
            filteredRefs = await dedupeReferencesByTopic(f, openKey, userInput, catalog.references);
        }

        const reportData = {
            keywordPlan,
            extraKeywords: extraKw,
            competitors: catalog.competitors,
            competitorDetails: competitorDetails.map(c => ({ ...c, reclameAqui: (negativeData || []).filter(n => n.brand === c.title || n.brand === c.host) })),
            negativeData: negativeData || [],
            referencesBefore: catalog.references.length,
            referencesAfter: (filteredRefs || []).length,
        };

        if (!narratives) {
            log('Escrevendo narrativa estratégica final...', 'info');
            narratives = await generateScenarioNarrative(f, openKey, userInput, reportData, scenario);
            await saveState('narrative', { ...initialState, keywordPlan, catalog, scenario, substitutesAdded: true, competitorDetails, negativeData, filteredRefs, narratives });
        } else {
            log('Narrativa recuperada.', 'success');
        }

        const finalData = { ...reportData, narratives, scenario };

        // --- STEP 8: FILES ---
        log('Gerando arquivos do relatório...', 'info');
        const files = await saveReports(userInput, finalData);
        log(`Arquivos salvos.`, 'success');

        log('Renderizando PDF do Estudo...', 'info');
        await renderPdfReport(await readFile(files.html, 'utf8'), files.pdf);

        // --- STEP 9: BLUEPRINT ---
        log('Gerando Blueprint de Produto...', 'info');
        const blueprintHtml = renderBlueprintHtml(userInput);
        const blueprintPath = files.pdf.replace('.pdf', '_Blueprint.pdf');
        await renderPdfReport(blueprintHtml, blueprintPath);

        // --- STEP 10: ZIP ---
        log('Empacotando Kit Plan Genie...', 'info');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const zipPath = resolve(files.pdf.replace(files.pdf.split('/').pop(), `PlanGenie_Export_RAW_${timestamp}.zip`));

        const output = createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });
        const absPdfPath = resolve(files.pdf);
        const absBlueprintPath = resolve(blueprintPath);

        await new Promise((resolve, reject) => {
            output.on('close', resolve);
            archive.on('error', reject);
            archive.pipe(output);
            archive.file(absPdfPath, { name: '01_LEIA_PRIMEIRO_Diagnostico_de_Mercado.pdf' });
            archive.file(absBlueprintPath, { name: '02_EXECUCAO_Blueprint_Tatico.pdf' });
            archive.finalize();
        });

        // 11. Final Save (Supabase Report Table - Legacy)
        if (leadId) {
            await saveReport(leadId, {
                prompt: userInput,
                reportData: { ...reportData, narratives },
                zipPath: zipPath
            });
        }

        if (sendEmail && zipPath) {
            log(`Iniciando envio de email em segundo plano para ${userEmail}...`, 'info');
            sendReportEmail(userEmail, zipPath, userInput, smtpConfig)
                .then(() => console.log(`[EMAIL] Sucesso: Relatório enviado para ${userEmail}`))
                .catch((emailErr) => console.error(`[EMAIL] Falha ao enviar em background: ${emailErr.message}`));
        }

        const endTime = Date.now();
        await saveRunTime(endTime - startTime);

        return {
            pdfPath: files.pdf,
            zipPath: zipPath,
            jsonPath: files.json,
            htmlPath: files.html
        };

    } catch (err) {
        log(`Falha crítica: ${err.message}`, 'error');
        throw err;
    }
}
