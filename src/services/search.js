import { braveSearch, buildQueryVariants, findCommercialPage, blockedTlds } from './brave.js';
import { classifyWithOpenRouter, topicWithOpenRouter, generateCompetitorKeywords } from './openrouter.js';

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

export async function dedupeReferencesByTopic(f, openKey, term, refs) {
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

export function classifyHeuristic(term, r) {
  const t = (r?.title || '').toLowerCase();
  const d = (r?.description || '').toLowerCase();
  const u = (r?.url || '').toLowerCase();
  let path = '';
  try { path = new URL(r?.url || '').pathname.toLowerCase(); } catch {}
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

export async function collectCommercialSites(f, braveKey, term, maxDomains = 100, maxResultsPerVariant = 20, openKey) {
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