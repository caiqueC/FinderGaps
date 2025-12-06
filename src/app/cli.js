import readline from 'node:readline';
import { readFile } from 'node:fs/promises';
import { loadEnv } from '../services/env.js';
import { collectCommercialSites, dedupeReferencesByTopic } from '../services/search.js';
import { API_URL, MODEL, generateKeywordsFromInput, summarizeCompetitorOffering, summarizeComplaint, generateReportNarrative } from '../services/openrouter.js';
import { fetchPageText, isBlockedContent } from '../services/content.js';
import { saveReports, renderPdfReport } from '../services/report.js';
import { findComplaintsLinks } from '../services/reclameaqui.js';
import { braveSearch } from '../services/brave.js';
import { sendReportEmail } from '../services/email.js';


const fetchFn = async () => {
  if (typeof fetch !== 'undefined') return fetch;
  const mod = await import('node-fetch');
  return mod.default;
};

async function main() {
  console.log('Inicializando...');
  await loadEnv();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));
  const f = await fetchFn();

  let braveKey = process.env.BRAVE_API_KEY;
  while (true) {
    try { await braveSearch(f, braveKey, 'key check', 1); break; } catch { }
    const input = (await ask('Informe sua BRAVE_API_KEY: ')).trim();
    if (!input) { console.error('Chave Brave obrigatória. Encerrado.'); rl.close(); return; }
    braveKey = input;
    process.env.BRAVE_API_KEY = braveKey;
  }
  console.log('Brave API key OK.');

  let openKey = process.env.OPENROUTER_API_KEY;
  while (true) {
    try {
      const resp = await f(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openKey}`, 'X-Title': 'FinderGaps Key Check' }, body: JSON.stringify({ model: MODEL, temperature: 0, messages: [{ role: 'system', content: 'Responda apenas a palavra OK.' }, { role: 'user', content: 'OK' }] }) });
      if (resp.ok) break;
    } catch { }
    const input2 = (await ask('Informe sua OPENROUTER_API_KEY: ')).trim();
    if (!input2) { console.error('OpenRouter API key obrigatória. Encerrado.'); rl.close(); return; }
    openKey = input2;
    process.env.OPENROUTER_API_KEY = openKey;
  }
  console.log('OpenRouter API key OK.');

  // Email Config Setup (Optional)
  let sendEmail = false;
  let userEmail = '';
  let smtpConfig = {};

  const wantEmail = (await ask('Deseja receber os relatórios por email? (S/N): ')).trim().toLowerCase();
  if (wantEmail === 's' || wantEmail === 'sim' || wantEmail === 'y' || wantEmail === 'yes') {
    sendEmail = true;

    // Check Env
    smtpConfig = {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    };

    if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
      console.log('Configurações de SMTP não encontradas no .env (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS).');
      console.log('Por favor, informe-as agora (apenas para esta sessão):');

      if (!smtpConfig.host) smtpConfig.host = (await ask('SMTP Host (ex: smtp.gmail.com): ')).trim();
      if (!smtpConfig.port) smtpConfig.port = (await ask('SMTP Port (ex: 587 ou 465): ')).trim();
      if (!smtpConfig.user) smtpConfig.user = (await ask('SMTP User: ')).trim();
      if (!smtpConfig.pass) smtpConfig.pass = (await ask('SMTP Password: ')).trim();
    }

    userEmail = (await ask('Informe o E-MAIL para recebimento do relatório: ')).trim();
    if (!userEmail) {
      console.log('Email não informado. O envio de email será ignorado.');
      sendEmail = false;
    }
  }


  console.log('Busca comercial com Brave. Digite "sair" para encerrar.');

  while (true) {
    const userInput = (await ask('Você: ')).trim();
    if (!userInput || userInput.toLowerCase() === 'sair') break;
    try {
      const startTime = Date.now();
      console.log('[ETAPA: BUSCA] Iniciando processo...');

      let keywordPlan = await generateKeywordsFromInput(f, openKey, userInput);
      console.log('[ETAPA: BUSCA] Gerando palavras‑chave...', { confidence: keywordPlan.confidence });

      if ((keywordPlan.confidence || 0) < 0.7 && keywordPlan.questions && keywordPlan.questions.length) {
        console.log('[ETAPA: BUSCA] Ambiguidade detectada, coletando clarificações...');
        for (const q of keywordPlan.questions.slice(0, 5)) {
          const ans = (await ask(`${q} `)).trim();
          if (ans) userInput = `${userInput}\n${ans}`;
        }
        keywordPlan = await generateKeywordsFromInput(f, openKey, userInput);
      }
      const extraKw = Array.from(new Set([...(keywordPlan.competitor || []), ...(keywordPlan.reference || [])]));
      console.log('[ETAPA: BUSCA] Coletando referências comerciais...');

      const catalog = await collectCommercialSites(f, braveKey, userInput, 100, 20, openKey, extraKw, (info) => {
        // Optional: Add verbose flag check here if needed, keeping it quiet for now as requested
      });

      const total = (catalog.competitors?.length || 0) + (catalog.references?.length || 0);
      if (!total) { console.log('[ETAPA: BUSCA] Sem resultados.'); continue; }

      console.log(`[ETAPA: ANÁLISE] ${catalog.competitors.length} concorrentes identificados. Iniciando processamento paralelo...`);

      // Helper for concurrency
      const processCompetitor = async (r, i) => {
        // console.log(`[ETAPA: ANÁLISE] [${i + 1}/${catalog.competitors.length}] Processando: ${r.title}`); // Too verbose?
        try {
          const text = await fetchPageText(f, r.url, 8000);
          const sum = await summarizeCompetitorOffering(f, openKey, userInput, r, text);

          let host = '';
          try { host = new URL(r.url).hostname.toLowerCase(); } catch { }

          const complaints = await findComplaintsLinks(f, braveKey, r.title || host, host, 20);
          const enrichedComplaints = [];

          for (const c of complaints) {
            const cText = await fetchPageText(f, c.url, 6000);
            const blocked = isBlockedContent(cText) || !cText;
            const baseText = blocked ? (c.description || c.title || '') : cText;
            const cSum = await summarizeComplaint(f, openKey, r.title || host, c.url, baseText);
            enrichedComplaints.push({ ...c, summary: cSum?.summary || '' });
          }

          console.log(`[ETAPA: ANÁLISE] [${i + 1}/${catalog.competitors.length}] Concluído: ${r.title}`);
          return { title: r.title, url: r.url, description: r.description, product_service: r.product_service, ...(sum || {}), reclameAqui: enrichedComplaints };
        } catch (err) {
          console.error(`[ETAPA: ANÁLISE] [${i + 1}] Erro ao processar ${r.title}:`, err.message);
          return { title: r.title, url: r.url, error: err.message };
        }
      };

      // Concurrency Control
      const CONCURRENCY_LIMIT = 5;
      const competitorDetails = [];
      const queue = [...catalog.competitors];
      let activeWorkers = 0;
      let index = 0;

      const worker = async () => {
        while (queue.length > 0) {
          const item = queue.shift();
          const i = index++;
          const result = await processCompetitor(item, i);
          competitorDetails.push(result);
        }
      };

      const workers = Array(Math.min(CONCURRENCY_LIMIT, queue.length)).fill(null).map(() => worker());
      await Promise.all(workers);

      // Sort to maintain some order if needed, or just keep as is (async order is random)
      // competitorDetails.sort((a, b) => ...); // Optional

      console.log('[ETAPA: ANÁLISE] Classificando relevância e removendo duplicatas...');
      const filteredRefs = await dedupeReferencesByTopic(f, openKey, userInput, catalog.references);

      // Data object for report
      const reportData = {
        keywordPlan,
        extraKeywords: extraKw,
        competitors: catalog.competitors,
        competitorDetails,
        referencesBefore: catalog.references.length,
        referencesAfter: filteredRefs.length,
      };

      console.log('[ETAPA: GERAÇÃO] Criando narrativas estratégicas (Consultor Sênior)...');
      const narratives = await generateReportNarrative(f, openKey, userInput, reportData);

      const finalData = { ...reportData, narratives };

      const files = await saveReports(userInput, finalData);
      console.log(`[ETAPA: GERAÇÃO] Arquivos salvos: JSON e HTML em ${files.json} e ${files.html}`);

      console.log('[ETAPA: GERAÇÃO] Renderizando PDF final...');
      await renderPdfReport(await readFile(files.html, 'utf8'), files.pdf);
      console.log(`[ETAPA: CONCLUÍDO] PDF gerado com sucesso: ${files.pdf}`);

      if (sendEmail && files.pdf) {
        console.log('[ETAPA: EMAIL] Enviando relatório...');
        await sendReportEmail(userEmail, files.pdf, userInput, smtpConfig);
      }


      const endTime = Date.now();
      const durationMs = endTime - startTime;
      const minutes = Math.floor(durationMs / 60000);
      const seconds = ((durationMs % 60000) / 1000).toFixed(0);
      console.log(`Tempo total do processo: ${minutes}m ${seconds}s`);
    } catch (err) {
      console.error('Falha ao consultar a Brave API:', err?.message || err);
    }
  }

  rl.close();
  console.log('Encerrado.');
}

main();