import readline from 'node:readline';
import { readFile } from 'node:fs/promises';
import { loadEnv } from '../services/env.js';
import { braveSearch } from '../services/brave.js';
import { sendReportEmail } from '../services/email.js';
import { runNegativeSearch } from '../services/negative_search.js';
import { saveReports, renderPdfReport, closeBrowser } from '../services/report.js';
import { findComplaintsLinks } from '../services/reclameaqui.js';
import { expandSearchForSubstitutes, collectCommercialSites, dedupeReferencesByTopic } from '../services/search.js';



import { fetchFn } from '../services/fetch.js';

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
      console.log('[INÍCIO] Iniciando a pesquisa de mercado...');

      let keywordPlan = await generateKeywordsFromInput(f, openKey, userInput);
      console.log('[PESQUISA] Definindo estratégia e palavras-chave...', { confidence: keywordPlan.confidence });

      if ((keywordPlan.confidence || 0) < 0.7 && keywordPlan.questions && keywordPlan.questions.length) {
        console.log('[PERGUNTA] Detectamos ambiguidade, precisamos de clarificação...');
        for (const q of keywordPlan.questions.slice(0, 5)) {
          const ans = (await ask(`${q} `)).trim();
          if (ans) userInput = `${userInput}\n${ans}`;
        }
        keywordPlan = await generateKeywordsFromInput(f, openKey, userInput);
      }
      const extraKw = Array.from(new Set([...(keywordPlan.competitor || []), ...(keywordPlan.reference || [])]));
      console.log('[VARREDURA] Explorando o mercado em busca de referências...');

      console.log('[VARREDURA] Explorando o mercado em busca de referências...');

      // 1. Initial Broad Search
      let catalog = await collectCommercialSites(f, braveKey, userInput, 100, 20, openKey, extraKw, (info) => { });

      // 2. Scenario Detection
      const scenario = await detectScenario(f, openKey, userInput, catalog.competitors, catalog.references);
      console.log(`[CENÁRIO] Detectado: ${scenario === 'RED_OCEAN' ? 'Mar Vermelho (Alta Concorrência)' : scenario === 'BLUE_OCEAN' ? 'Mar Azul (Dados Escassos/Inovação)' : 'Visionário (Futurista)'}`);

      // 3. Adaptive Search (Blue Ocean Pivot)
      if (scenario === 'BLUE_OCEAN' && catalog.competitors.length < 3) {
        console.log('[ADAPTAÇÃO] Buscando soluções substitutas (Excel, Processos Manuais)...');
        const substitutes = await expandSearchForSubstitutes(f, braveKey, userInput);
        // Treat substitutes as "Competitors" for analysis purposes
        for (const sub of substitutes) {
          catalog.competitors.push({ title: sub.title, url: sub.url, description: sub.description, product_service: 'Solução Substituta (Workaround)' });
        }
      }

      const total = (catalog.competitors?.length || 0) + (catalog.references?.length || 0);
      if (!total) { console.log('[AVISO] Nenhum resultado relevante encontrado.'); continue; }

      console.log(`[ANÁLISES] ${catalog.competitors.length} concorrentes/substitutos identificados. Analisando dados...`);

      // 4. Competitor Analysis (Standard)
      const processCompetitor = async (r, i) => {
        try {
          const text = await fetchPageText(f, r.url, 8000);
          const sum = await summarizeCompetitorOffering(f, openKey, userInput, r, text);
          console.log(`[ANÁLISES] [${i + 1}/${catalog.competitors.length}] Processado: ${r.title}`);
          return { ...r, ...sum };
        } catch (err) {
          console.error(`[ERRO] [${i + 1}] Falha ao processar ${r.title}:`, err.message);
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
        }
      };
      await Promise.all(Array(Math.min(5, queue.length)).fill(null).map(() => worker()));

      // 5. Negative Search (Unified & Adaptive)
      console.log('[INVESTIGAÇÃO] Buscando dores reais e reclamações (Negative Search)...');
      const negativeData = await runNegativeSearch(f, braveKey, openKey, userInput, scenario, competitorDetails);
      console.log(`[INSIGHTS] ${negativeData.length} pontos de dor/reclamação identificados.`);

      console.log('[FILTRO] Refinando os melhores resultados...');
      const filteredRefs = await dedupeReferencesByTopic(f, openKey, userInput, catalog.references);

      // Data object for report
      const reportData = {
        keywordPlan,
        extraKeywords: extraKw,
        competitors: catalog.competitors,
        competitorDetails: competitorDetails.map(c => ({ ...c, reclameAqui: negativeData.filter(n => n.brand === c.title || n.brand === c.host) })), // Map basic brand complaints if any
        negativeData, // Full negative data (inc. forums/youtube)
        referencesBefore: catalog.references.length,
        referencesAfter: filteredRefs.length,
      };

      console.log('[CRIAÇÃO] Redigindo narrativa estratégica (Motor Adaptativo)...');
      const narratives = await generateScenarioNarrative(f, openKey, userInput, reportData, scenario);

      const finalData = { ...reportData, narratives, scenario };

      // Saving
      const files = await saveReports(userInput, finalData);
      console.log(`[SALVAR] Relatórios gerados em: ${files.json} e ${files.html}`);

      console.log('[PDF] Formatando documento final...');
      await renderPdfReport(await readFile(files.html, 'utf8'), files.pdf);
      console.log(`[PRONTO] Relatório PDF finalizado: ${files.pdf}`);

      if (sendEmail && files.pdf) {
        console.log('[EMAIL] Enviando relatório para você...');
        await sendReportEmail(userEmail, files.pdf, userInput, smtpConfig);
      }

      const endTime = Date.now();
      const durationMs = endTime - startTime;
      const minutes = Math.floor(durationMs / 60000);
      const seconds = ((durationMs % 60000) / 1000).toFixed(0);
      console.log(`Tempo total do processo: ${minutes}m ${seconds}s`);
    } catch (err) {
      console.error('Falha geral:', err?.message || err);
    }
  }



  rl.close();
  await closeBrowser();
  console.log('Encerrado.');
}

main();