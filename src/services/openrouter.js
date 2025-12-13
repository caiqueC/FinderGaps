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
      }` },
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

export async function detectScenario(f, openKey, term, competitors, references) {
  if (!openKey) return 'BLUE_OCEAN'; // Default to scarce data if check fails
  try {
    const compCount = competitors.length;
    // Heuristic first:
    // High competitors -> Red Ocean
    if (compCount >= 3) return 'RED_OCEAN';

    // If few competitors, let LLM decide between Blue Ocean (Process/Workaround focus) and Visionary (Future/SciFi)
    const messages = [
      { role: 'system', content: 'Responda APENAS JSON: {"scenario":"BLUE_OCEAN"|"VISIONARY"}. Analise o termo/ideia. Se for uma ideia de negócio viável hoje mas sem players claros (ex: um nicho específico, uma ferramenta interna, um serviço local), é "BLUE_OCEAN" (foco em substituir processos manuais/planilhas). Se for algo futurista, sci-fi, que exija invenções tecnológicas não existentes ou mudança drástica de leis (ex: teletransporte, cidade em marte, cura da morte), é "VISIONARY".' },
      { role: 'user', content: `Termo: ${term}\nConcorrentes diretos encontrados: ${compCount}` },
    ];

    const resp = await f(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openKey}`, 'X-Title': 'FinderGaps Scenario' },
      body: JSON.stringify({ model: MODEL, temperature: 0, messages }),
    });

    if (!resp.ok) return 'BLUE_OCEAN';
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const parsed = parseJsonLoose(content);
    return parsed?.scenario === 'VISIONARY' ? 'VISIONARY' : 'BLUE_OCEAN';
  } catch {
    return 'BLUE_OCEAN';
  }
}

export async function generateScenarioNarrative(f, openKey, term, data, strategy) {
  if (!openKey) return null;
  try {
    // Determine prompt based on strategy
    let systemPrompt = '';

    if (strategy === 'RED_OCEAN') {
      systemPrompt = `Você é um estrategista de mercado "Tubarão".
      CENÁRIO DETECTADO: MAR VERMELHO (Muitos concorrentes).
      OBJETIVO: Diferenciação e Roubo de Market Share.
      
      Aprofunde-se nas reclamações sobre os concorrentes diretos.
      "Negative Search Data" contém o que os usuários ODEIAM nos produtos atuais. Use isso.
      
      Estrutura do JSON:
      {
        "idea_elaboration": "Contexto do mercado saturado...",
        "direct_competitors": "Analise os players [[Nome]]. Exponha suas fraquezas baseadas nos dados.",
        "indirect_competitors": "...",
        "gaps": "As falhas graves dos concorrentes que geram oportunidade.",
        "conclusion": "O Produto Matador: Como ser 10x melhor que o [[Líder]] corrigindo a falha X."
      }`;
    } else if (strategy === 'BLUE_OCEAN') {
      systemPrompt = `Você é um estrategista de inovação e eficiência.
      CENÁRIO DETECTADO: MAR AZUL (Poucos/Nenhum concorrente direto. Foco em substituir processos manuais).
      OBJETIVO: Validação de Dor e Automatização.
      
      Não existem grandes SaaS dominantes. O "concorrente" é o Excel, o Papel, o WhatsApp, a burocracia.
      "Negative Search Data" contém a FRICTION (fricção) dos usuários com o processo atual (workarounds).
      
      Estrutura do JSON:
      {
        "idea_elaboration": "Por que essa tarefa ainda é manual? Qual o custo do Status Quo?",
        "direct_competitors": "Não há gigantes. O concorrente é o [[Excel]] ou [[Processo Manual]]. Descreva a dor de fazer isso na mão.",
        "indirect_competitors": "Ferramentas genéricas usadas de forma adaptada (gambiarras).",
        "gaps": "A dor da ineficiência. Onde o usuário perde tempo/dinheiro hoje?",
        "conclusion": "O Primeiro Mover: A ferramenta que automatiza a dor. O MVP ideal."
      }`;
    } else { // VISIONARY
      systemPrompt = `Você é um futurista e analista de deep tech.
      CENÁRIO DETECTADO: VISIONÁRIO (Conceito futurista/Nicho inexplorado).
      OBJETIVO: Viabilidade e Roadmap.
      
      "Negative Search Data" contém "I wish" (desejos) e frustrações com os limites da física/tecnologia atual.
      
      Estrutura do JSON:
      {
        "idea_elaboration": "A visão do futuro. O impacto transformador.",
        "direct_competitors": "Não existem. Cite as barreiras (Física, Regulação).",
        "indirect_competitors": "Soluções pálidas atuais (ex: Jato vs Teletransporte).",
        "gaps": "O gap entre o desejo humano e a realidade tecnológica.",
        "conclusion": "O Salto Quântico: O caminho para tornar isso real. Riscos e potenciais."
      }`;
    }

    const fullPrompt = `${systemPrompt}
    
    Responda APENAS JSON válido. Escape aspas duplas (\\") no texto.
    
    Dados de Entrada:
    Termo: ${term}
    Competidores Encontrados: ${data.competitors?.length || 0}
    Negative Search Data (Reclamações/Dores): ${JSON.stringify(data.negativeData || []).slice(0, 15000)}
    Detalhes de Concorrentes: ${JSON.stringify(data.competitorDetails || []).slice(0, 5000)}
    `;

    const messages = [
      { role: 'system', content: fullPrompt },
      { role: 'user', content: `Gere o relatório para: ${term}` },
    ];

    const resp = await f(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openKey}`, 'X-Title': 'FinderGaps Scenario Narrative' },
      body: JSON.stringify({ model: MODEL, temperature: 0.7, messages }),
    });

    if (!resp.ok) return null;
    const respData = await resp.json();
    const content = respData?.choices?.[0]?.message?.content || '';
    return parseJsonLoose(content);
  } catch (e) {
    console.error('Scenario narrative gen error:', e);
    return null;
  }
}

/**
 * Checks if the OpenRouter key has remaining credits/limit.
 * @param {Function} f - fetch function
 * @param {string} openKey - API Key
 * @returns {Promise<boolean>} true if operational, false if quota exceeded
 */
export async function checkCreditBalance(f, openKey) {
  if (!openKey) return false;
  try {
    const keyResp = await f('https://openrouter.ai/api/v1/auth/key', {
      method: 'GET',
      headers: { Authorization: `Bearer ${openKey}` },
    });

    if (!keyResp.ok) return true; // Fail open if API error

    const data = await keyResp.json();
    const info = data?.data;

    if (!info) return true;

    // Check limit vs usage (if limit exists)
    if (info.limit !== null && info.limit !== undefined) {
      const remaining = info.limit - info.usage;
      // Block if less than $0.10 (safety margin)
      if (remaining < 0.1) return false;
    }

    return true;
  } catch (e) {
    console.error('Credit check error:', e);
    return true; // Fail open
  }
}