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

export async function generateKeywordsFromInput(f, openKey, inputText) {
  if (!openKey) return { competitor: [], reference: [], confidence: 0.0, questions: [] };
  try {
    const messages = [
      { role: 'system', content: 'Responda apenas JSON: {"competitor":[...],"reference":[...],"confidence":0-1,"questions":[...]}. Extraia palavras‑chave altamente precisas a partir do texto do usuário para duas finalidades: buscar concorrentes (quem vende um produto/serviço diretamente relacionado) e buscar referências (conteúdos informativos). Se o texto permitir múltiplas interpretações, reduza "confidence" e inclua perguntas específicas e objetivas para eliminar ambiguidade. Não invente termos sem suporte do texto; prefira termos amplos apenas se necessários.' },
      { role: 'user', content: String(inputText || '') },
    ];
    const resp = await f(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openKey}`, 'X-Title': 'FinderGaps Keyword Gen' },
      body: JSON.stringify({ model: MODEL, temperature: 0, messages }),
    });
    if (!resp.ok) return { competitor: [], reference: [], confidence: 0.0, questions: [] };
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const parsed = parseJsonLoose(content);
    const competitor = Array.isArray(parsed?.competitor) ? parsed.competitor : [];
    const reference = Array.isArray(parsed?.reference) ? parsed.reference : [];
    const confidence = typeof parsed?.confidence === 'number' ? parsed.confidence : 0.5;
    const questions = Array.isArray(parsed?.questions) ? parsed.questions : [];
    return {
      competitor: competitor.filter((s) => typeof s === 'string').map((s) => s.trim()).filter(Boolean),
      reference: reference.filter((s) => typeof s === 'string').map((s) => s.trim()).filter(Boolean),
      confidence,
      questions: questions.filter((s) => typeof s === 'string').map((s) => s.trim()).filter(Boolean),
    };
  } catch {
    return { competitor: [], reference: [], confidence: 0.0, questions: [] };
  }
}

export async function summarizeCompetitorOffering(f, openKey, term, item, pageText) {
  if (!openKey) return null;
  try {
    const messages = [
      { role: 'system', content: 'Responda apenas JSON: {"summary":"...","features":[...],"target":"...","pricing":"...","category":"..."}. Com base no título, URL e conteúdo da página, resuma claramente o que este concorrente oferece (produto/serviço), principais funcionalidades, público-alvo, modelo de preço e a categoria geral. Seja objetivo e não invente informações ausentes.' },
      { role: 'user', content: `Termo: ${term}\nTitulo: ${item.title}\nURL: ${item.url}\nDescricao: ${item.description || ''}\nConteudo: ${pageText || ''}` },
    ];
    const resp = await f(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openKey}`, 'X-Title': 'FinderGaps Offering Summary' },
      body: JSON.stringify({ model: MODEL, temperature: 0, messages }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const parsed = parseJsonLoose(content);
    const summary = typeof parsed?.summary === 'string' ? parsed.summary : '';
    const features = Array.isArray(parsed?.features) ? parsed.features.filter((s) => typeof s === 'string').map((s) => s.trim()).filter(Boolean) : [];
    const target = typeof parsed?.target === 'string' ? parsed.target : '';
    const pricing = typeof parsed?.pricing === 'string' ? parsed.pricing : '';
    const category = typeof parsed?.category === 'string' ? parsed.category : '';
    return { summary, features, target, pricing, category };
  } catch {
    return null;
  }
}

export async function summarizeComplaint(f, openKey, brand, url, pageText) {
  if (!openKey) return null;
  try {
    const messages = [
      { role: 'system', content: 'Responda apenas JSON: {"summary":"..."}. Resuma em uma frase objetiva o conteúdo desta reclamação, sem detalhes sensíveis e sem inventar fatos.' },
      { role: 'user', content: `Marca: ${brand}\nURL: ${url}\nConteudo: ${String(pageText || '').slice(0, 6000)}` },
    ];
    const resp = await f(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openKey}`, 'X-Title': 'FinderGaps Complaint Summary' },
      body: JSON.stringify({ model: MODEL, temperature: 0, messages }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const parsed = parseJsonLoose(content);
    const summary = typeof parsed?.summary === 'string' ? parsed.summary : '';
    return { summary };
  } catch {
    return null;
  }
}

export async function generateReportNarrative(f, openKey, term, data) {
  if (!openKey) return null;
  try {
    const context = JSON.stringify({
      term,
      keywords: data.keywordPlan,
      competitors: data.competitorDetails.map(c => ({ title: c.title, summary: c.summary, features: c.features, complaints: c.reclameAqui.map(r => r.summary) })),
      references: data.extraKeywords // Using keywords as proxy for references context if needed
    }).slice(0, 30000); // Limit context size

    const messages = [
      {
        role: 'system', content: `Você é um consultor de negócios sênior especializado em análise de mercado e estratégia.
      Seu objetivo é gerar um relatório executivo de alto nível, focado em OPORTUNIDADES.
      
      Responda APENAS JSON válido.
      CRÍTICO: O texto gerado será longo. Você DEVE garantir que todas as aspas duplas dentro do texto sejam escapadas (\\") e que não haja quebras de linha reais no meio das strings (use \\n).
      Se necessário, simplifique a formatação interna do texto para garantir o JSON válido.
      
      Formato esperado:
      {
        "idea_elaboration": "Texto...",
        "direct_competitors": "Texto...",
        "indirect_competitors": "Texto...",
        "gaps": "Texto...",
        "conclusion": "Texto..."
      }
      
      Instruções de conteúdo:
      - idea_elaboration: Texto EXTENSO, aprofundado e envolvente sobre o termo pesquisado. Contextualize o mercado, tendências atuais e por que esse tema é relevante agora. Use storytelling corporativo. Não seja breve. Explore todas as nuances do tema.
      - direct_competitors: Texto narrativo DETALHADO que CITE os nomes dos concorrentes encontrados dentro do contexto da análise. Use os dados específicos (preços, features, reclamações) que estão no JSON para embasar sua análise. O foco NÃO é julgar os concorrentes, mas sim usar seus modelos para identificar oportunidades de mercado. Mostre o que eles estão deixando passar. Seja específico.
      - indirect_competitors: Texto narrativo sobre soluções alternativas. Novamente, cite exemplos se houver, mas foque em como essas alternativas deixam espaço para uma nova solução inovadora. Explique POR QUE elas não são suficientes.
      - gaps: Análise PROFUNDA e EXTENSIVA das lacunas de mercado. Baseie-se nas reclamações reais para identificar o que FALTA no mercado. Não apenas liste os gaps, explique o impacto deles no consumidor e a oportunidade de negócio que eles geram.
      - conclusion: A síntese final. Deve ser MUITO DETALHADA e VISIONÁRIA. Junte a visão da ideia com os gaps identificados para descrever o "Produto Ideal" em detalhes. Como ele deve ser para vencer nesse mercado? Quais features ele deve ter? Qual deve ser o posicionamento? Termine com uma visão inspiradora e estratégica.
      ` },
      { role: 'user', content: `Dados do relatório: ${context}` },
    ];

    const resp = await f(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openKey}`, 'X-Title': 'FinderGaps Narrative Gen' },
      body: JSON.stringify({ model: MODEL, temperature: 0.7, messages }),
    });

    if (!resp.ok) return null;
    const respData = await resp.json();
    const content = respData?.choices?.[0]?.message?.content || '';
    return parseJsonLoose(content);
  } catch (e) {
    console.error('Narrative gen error:', e);
    return null;
  }
}