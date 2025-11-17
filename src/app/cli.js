import readline from 'node:readline';
import { loadEnv } from '../services/env.js';
import { collectCommercialSites, dedupeReferencesByTopic } from '../services/search.js';
import { API_URL, MODEL } from '../services/openrouter.js';
import { braveSearch } from '../services/brave.js';

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
    try { await braveSearch(f, braveKey, 'key check', 1); break; } catch {}
    const input = (await ask('Informe sua BRAVE_API_KEY: ')).trim();
    if (!input) { console.error('Chave Brave obrigatória. Encerrado.'); rl.close(); return; }
    braveKey = input;
    process.env.BRAVE_API_KEY = braveKey;
  }
  console.log('Brave API key OK.');

  let openKey = process.env.OPENROUTER_API_KEY;
  while (true) {
    try {
      const resp = await f(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openKey}`, 'X-Title': 'FinderGaps Key Check' }, body: JSON.stringify({ model: MODEL, temperature: 0, messages: [ { role: 'system', content: 'Responda apenas a palavra OK.' }, { role: 'user', content: 'OK' } ] }) });
      if (resp.ok) break;
    } catch {}
    const input2 = (await ask('Informe sua OPENROUTER_API_KEY: ')).trim();
    if (!input2) { console.error('OpenRouter API key obrigatória. Encerrado.'); rl.close(); return; }
    openKey = input2;
    process.env.OPENROUTER_API_KEY = openKey;
  }
  console.log('OpenRouter API key OK.');

  console.log('Busca comercial com Brave. Digite "sair" para encerrar.');

  while (true) {
    const userInput = (await ask('Você: ')).trim();
    if (!userInput || userInput.toLowerCase() === 'sair') break;
    try {
      console.log('Coletando referências comerciais...', { termo: userInput });
      const catalog = await collectCommercialSites(f, braveKey, userInput, 100, 20, openKey);
      const total = (catalog.competitors?.length || 0) + (catalog.references?.length || 0);
      if (!total) { console.log('Sem resultados.'); continue; }
      console.log(`Concorrentes (${catalog.competitors.length}):`);
      for (let i = 0; i < Math.min(catalog.competitors.length, 50); i++) {
        const r = catalog.competitors[i];
        console.log(`${i + 1}. ${r.title}`);
        console.log(r.url);
        if (r.description) console.log(r.description);
        if (r.product_service) console.log(r.product_service);
        console.log('');
      }
      console.log('Classificando relevância e removendo duplicatas de tópico...');
      const filteredRefs = await dedupeReferencesByTopic(f, openKey, userInput, catalog.references);
      console.log(`Referências (${filteredRefs.length}):`);
      for (let i = 0; i < Math.min(filteredRefs.length, 50); i++) {
        const r = filteredRefs[i];
        console.log(`${i + 1}. ${r.title}`);
        console.log(r.url);
        if (r.description) console.log(r.description);
        if (r.topic) console.log(r.topic);
        if (r.product_service) console.log(r.product_service);
        console.log('');
      }
    } catch (err) {
      console.error('Falha ao consultar a Brave API:', err?.message || err);
    }
  }

  rl.close();
  console.log('Encerrado.');
}

main();