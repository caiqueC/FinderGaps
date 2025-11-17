import readline from 'node:readline';

const fetchFn = async () => {
  if (typeof fetch !== 'undefined') return fetch;
  const mod = await import('node-fetch');
  return mod.default;
};

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash';
const BRAVE_API_URL = 'https://api.search.brave.com/res/v1/web/search';
const includesTokens = [
  'pricing',
  'prices',
  'precos',
  'preço',
  'planos',
  'plans',
  'product',
  'products',
  'produto',
  'solucao',
  'soluções',
  'solutions',
  'platform',
  'plataforma',
  'features',
  'recursos',
  'signup',
  'try',
  'demo',
];
const excludeTokens = [
  'wiki',
  'wikipedia',
  'blog',
  'docs',
  'documentation',
  'support',
  'help',
  'glossário',
  'glossario',
  'definição',
  'definicao',
  'o que é',
  'what is',
];
const allowedTlds = ['.com', '.io', '.co', '.ai', '.app'];
const blockedTlds = ['.gov', '.edu'];

function buildCommercialQuery(term) {
  const inc = 'pricing product platform solutions';
  const tlds = 'site:.com site:.io';
  const exc = '-wikipedia -blog -docs -support -help -learn -resources -o que e -what is -glossario -definicao';
  return `${term} ${inc} ${tlds} ${exc}`;
}

function isCommercialResult(r) {
  const t = (r?.title || '').toLowerCase();
  const u = (r?.url || '').toLowerCase();
  let host = '';
  let path = '';
  try {
    const parsed = new URL(r?.url || '');
    host = parsed.hostname.toLowerCase();
    path = parsed.pathname.toLowerCase();
  } catch {}
  const includePaths = ['/pricing', '/plans', '/planos', '/product', '/products', '/produto', '/solutions', '/platform', '/features', '/signup', '/demo'];
  const excludePaths = ['/blog', '/learn', '/resources', '/docs', '/support', '/help', '/wiki'];
  const blockedSubdomains = ['blog.', 'docs.', 'support.', 'help.', 'developer.', 'dev.'];
  const hasExc = excludeTokens.some((s) => t.includes(s) || u.includes(s));
  const tldBlocked = blockedTlds.some((s) => host.endsWith(s));
  const pathBlocked = excludePaths.some((p) => path.includes(p));
  const subBlocked = blockedSubdomains.some((sub) => host.startsWith(sub));
  return !hasExc && !tldBlocked && !pathBlocked && !subBlocked;
}

async function findCommercialPage(host, f) {
  const candidates = ['/pricing', '/plans', '/planos', '/product', '/products', '/solutions', '/platform', '/features'];
  for (const p of candidates) {
    const url = `https://${host}${p}`;
    try {
      const resp = await f(url, { method: 'GET' });
      if (resp.ok) return url;
    } catch {}
  }
  return null;
}

async function classifyWithOpenRouter(f, openKey, term, item) {
  const messages = [
    { role: 'system', content: 'Responda apenas JSON: {"label":"competitor"|"reference","product_service":"..."}. "competitor" somente se este URL vende diretamente um produto/serviço SaaS ou oferece ferramenta/serviço para criar/operar SaaS (ex.: billing de assinatura, multi-tenant, SaaS builder, subscription management). Páginas explicativas/"o que é"/documentação/blog são "reference" mesmo que o domínio tenha produtos.' },
    { role: 'user', content: `Termo: ${term}\nTitulo: ${item.title}\nURL: ${item.url}\nDescricao: ${item.description || ''}` },
  ];
  const resp = await f(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openKey}`,
      'X-Title': 'FinderGaps Classification',
    },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0 }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenRouter ${resp.status}: ${text}`);
  }
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content || '';
  try {
    const parsed = parseJsonLoose(content);
    const label = parsed?.label === 'competitor' ? 'competitor' : 'reference';
    const product_service = typeof parsed?.product_service === 'string' ? parsed.product_service : '';
    return { label, product_service };
  } catch {
    return { label: 'reference', product_service: '' };
  }
}

async function topicWithOpenRouter(f, openKey, term, item) {
  const messages = [
    { role: 'system', content: 'Extraia {"topic":"...","relevance":0.0-1.0}. Relevancia reflete autoridade/qualidade/adequacao ao termo. Responda apenas JSON.' },
    { role: 'user', content: `Termo: ${term}\nTitulo: ${item.title}\nURL: ${item.url}\nDescricao: ${item.description || ''}` },
  ];
  const resp = await f(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openKey}`,
      'X-Title': 'FinderGaps Topic',
    },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0 }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenRouter ${resp.status}: ${text}`);
  }
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content || '';
  try {
    const parsed = parseJsonLoose(content);
    const topic = typeof parsed?.topic === 'string' ? parsed.topic : '';
    const relevance = typeof parsed?.relevance === 'number' ? parsed.relevance : 0.5;
    return { topic, relevance };
  } catch {
    return { topic: '', relevance: 0.5 };
  }
}

function normalizeTopic(t) {
  const s = String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return s.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function brandBoost(host) {
  const brands = {
    'microsoft.com': 0.3,
    'google.com': 0.3,
    'aws.amazon.com': 0.3,
    'oracle.com': 0.25,
    'ibm.com': 0.25,
    'salesforce.com': 0.25,
    'cloud.google.com': 0.3,
  };
  const h = String(host || '').toLowerCase();
  for (const k of Object.keys(brands)) {
    if (h.endsWith(k)) return brands[k];
  }
  return 0;
}

function parseJsonLoose(text) {
  const s = String(text || '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('no json');
  const slice = s.slice(start, end + 1);
  return JSON.parse(slice);
}

async function dedupeReferencesByTopic(f, openKey, term, refs) {
  const enriched = [];
  for (const r of refs) {
    let topic = '';
    let relevance = 0.5;
    try {
      const res = await topicWithOpenRouter(f, openKey, term, r);
      topic = res.topic;
      relevance = res.relevance;
    } catch {}
    let host = '';
    try { host = new URL(r?.url || '').hostname.toLowerCase(); } catch {}
    const totalRel = Math.max(0, Math.min(1, relevance + brandBoost(host)));
    enriched.push({ ...r, topic, relevance: totalRel });
  }
  const groups = new Map();
  for (const r of enriched) {
    const key = normalizeTopic(r.topic || r.title);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const selected = [];
  for (const [_, arr] of groups.entries()) {
    arr.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
    if (arr.length) selected.push(arr[0]);
  }
  return selected;
}

function classifyHeuristic(term, r) {
  const t = (r?.title || '').toLowerCase();
  const d = (r?.description || '').toLowerCase();
  const u = (r?.url || '').toLowerCase();
  let host = '';
  let path = '';
  try {
    const parsed = new URL(r?.url || '');
    host = parsed.hostname.toLowerCase();
    path = parsed.pathname.toLowerCase();
  } catch {}
  const compWords = ['pricing','plans','planos','preço','product','produto','solutions','platform','features','signup','demo','free trial','start','buy','contact sales'];
  const refWords = ['what is','o que é','guide','guia','tutorial','blog','wiki','wikipedia','docs','documentation','learn','resources','how to','overview','case study','whitepaper'];
  const compPath = ['/pricing','/plans','/planos','/product','/products','/solutions','/platform','/features','/signup','/demo'];
  const refPath = ['/blog','/learn','/resources','/docs','/wiki'];
  const isComp = compWords.some((w) => t.includes(w) || d.includes(w) || u.includes(w)) || compPath.some((p) => path.includes(p));
  const isRef = refWords.some((w) => t.includes(w) || d.includes(w) || u.includes(w)) || refPath.some((p) => path.includes(p));
  if (isComp) return 'competitor';
  if (isRef) return 'reference';
  return 'reference';
}

async function braveSearch(f, key, q, count = 20) {
  const url = BRAVE_API_URL + '?' + new URLSearchParams({ q, count: String(count), search_lang: 'pt-br', country: 'br' });
  const resp = await f(url, { headers: { Accept: 'application/json', 'X-Subscription-Token': key } });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Brave ${resp.status}: ${text}`);
  }
  const data = await resp.json();
  return data?.web?.results || [];
}

function buildQueryVariants(term) {
  const base = term.trim();
  const variants = [
    base,
    `${base} pricing`,
    `${base} product`,
    `${base} solutions`,
    `${base} platform`,
    `${base} planos`,
    `${base} produto`,
    `${base} empresa`,
  ];
  return Array.from(new Set(variants));
}

async function collectCommercialSites(f, braveKey, term, maxDomains = 100, maxResultsPerVariant = 20, openKey) {
  const variants = buildQueryVariants(term);
  const extra = await generateCompetitorKeywords(f, openKey, term);
  for (const k of extra) {
    variants.push(`${term} ${k}`);
    variants.push(k);
  }
  const seenHosts = new Set();
  const domains = [];
  for (const v of variants) {
    let results = [];
    try {
      results = await braveSearch(f, braveKey, v, maxResultsPerVariant);
    } catch {}
    results = results.filter((r) => {
      const u = (r?.url || '').toLowerCase();
      let host = '';
      try { host = new URL(u).hostname.toLowerCase(); } catch {}
      if (!host) return false;
      const tldBlocked = blockedTlds.some((s) => host.endsWith(s));
      return !tldBlocked;
    });
    for (const r of results) {
      let host = '';
      try { host = new URL(r?.url || '').hostname.toLowerCase(); } catch {}
      if (!host || seenHosts.has(host)) continue;
      seenHosts.add(host);
      domains.push({ host, title: r?.title || '', description: r?.description || '', url: r?.url || '' });
      if (domains.length >= maxDomains) break;
    }
    if (domains.length >= maxDomains) break;
  }
  const competitors = [];
  const references = [];
  for (const d of domains) {
    const baseItem = { title: d.title, url: d.url || `https://${d.host}`, description: d.description };
    let label = 'reference';
    let product_service = '';
    if (openKey) {
      try {
        const res = await classifyWithOpenRouter(f, openKey, term, baseItem);
        label = res.label;
        product_service = res.product_service;
      } catch {}
    } else {
      label = classifyHeuristic(term, baseItem);
    }
    let enriched = product_service ? { ...baseItem, product_service } : baseItem;
    if (label === 'competitor') {
      const commercialUrl = await findCommercialPage(d.host, f);
      if (commercialUrl) enriched = { ...enriched, url: commercialUrl };
    }
    if (label === 'competitor') competitors.push(enriched);
    else references.push(enriched);
    if (competitors.length + references.length >= maxDomains) break;
  }
  return { competitors, references };
}

async function main() {
  console.log('Inicializando...');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));
  const f = await fetchFn();

  let braveKey = process.env.BRAVE_API_KEY;
  while (true) {
    if (await (async () => { try { await braveSearch(f, braveKey, 'key check', 1); return true; } catch { return false; } })()) break;
    const input = (await ask('Informe sua BRAVE_API_KEY: ')).trim();
    if (!input) {
      console.error('Chave Brave obrigatória. Encerrado.');
      rl.close();
      return;
    }
    braveKey = input;
    process.env.BRAVE_API_KEY = braveKey;
  }
  console.log('Brave API key OK.');

  let openKey = process.env.OPENROUTER_API_KEY;
  while (true) {
    const ok = await (async () => {
      if (!openKey) return false;
      try {
        const resp = await f(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openKey}`,
            'X-Title': 'FinderGaps Key Check',
          },
          body: JSON.stringify({ model: MODEL, temperature: 0, messages: [ { role: 'system', content: 'Responda apenas a palavra OK.' }, { role: 'user', content: 'OK' } ] }),
        });
        return resp.ok;
      } catch { return false; }
    })();
    if (ok) break;
    const input2 = (await ask('Informe sua OPENROUTER_API_KEY: ')).trim();
    if (!input2) {
      console.error('OpenRouter API key obrigatória. Encerrado.');
      rl.close();
      return;
    }
    openKey = input2;
    process.env.OPENROUTER_API_KEY = openKey;
  }
  console.log('OpenRouter API key OK.');

  const messages = [];

  console.log('Busca comercial com Brave. Digite "sair" para encerrar.');


  while (true) {
    const userInput = (await ask('Você: ')).trim();
    if (!userInput || userInput.toLowerCase() === 'sair') break;
    try {
      console.log('Coletando referências comerciais...', { termo: userInput });
      const catalog = await collectCommercialSites(f, braveKey, userInput, 100, 20, openKey);
      const total = (catalog.competitors?.length || 0) + (catalog.references?.length || 0);
      if (!total) {
        console.log('Sem resultados.');
        continue;
      }
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
async function generateCompetitorKeywords(f, openKey, term) {
  if (!openKey) return [];
  try {
    const messages = [
      { role: 'system', content: 'Gere JSON {"keywords":[...]} com termos de busca para achar empresas que vendem produtos/serviços relacionados a SaaS ou que sejam SaaS. Inclua termos como subscription billing, subscription management, multi-tenant, saas builder, saas platform, no-code saas, b2b saas, saas hosting, saas analytics, saas marketing, customer success, churn, pricing, trials.' },
      { role: 'user', content: `Termo: ${term}` },
    ];
    const resp = await f(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openKey}`, 'X-Title': 'FinderGaps Keywords' },
      body: JSON.stringify({ model: MODEL, temperature: 0, messages }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const parsed = parseJsonLoose(content);
    const arr = Array.isArray(parsed?.keywords) ? parsed.keywords : [];
    return arr.filter((s) => typeof s === 'string').map((s) => s.trim()).filter(Boolean);
  } catch { return []; }
}