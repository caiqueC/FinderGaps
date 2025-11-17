export const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const MODEL = 'google/gemini-2.5-flash';

export function parseJsonLoose(text) {
  const s = String(text || '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('no json');
  const slice = s.slice(start, end + 1);
  return JSON.parse(slice);
}

export async function classifyWithOpenRouter(f, openKey, term, item) {
  const messages = [
    { role: 'system', content: 'Responda apenas JSON: {"label":"competitor"|"reference","product_service":"..."}. "competitor" somente se este URL vende diretamente um produto/serviço SaaS ou oferece ferramenta/serviço para criar/operar SaaS (ex.: billing de assinatura, multi-tenant, SaaS builder, subscription management). Páginas explicativas/"o que é"/documentação/blog são "reference" mesmo que o domínio tenha produtos.' },
    { role: 'user', content: `Termo: ${term}\nTitulo: ${item.title}\nURL: ${item.url}\nDescricao: ${item.description || ''}` },
  ];
  const resp = await f(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openKey}`, 'X-Title': 'FinderGaps Classification' },
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

export async function topicWithOpenRouter(f, openKey, term, item) {
  const messages = [
    { role: 'system', content: 'Extraia {"topic":"...","relevance":0.0-1.0}. Relevancia reflete autoridade/qualidade/adequacao ao termo. Responda apenas JSON.' },
    { role: 'user', content: `Termo: ${term}\nTitulo: ${item.title}\nURL: ${item.url}\nDescricao: ${item.description || ''}` },
  ];
  const resp = await f(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openKey}`, 'X-Title': 'FinderGaps Topic' },
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

export async function generateCompetitorKeywords(f, openKey, term) {
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