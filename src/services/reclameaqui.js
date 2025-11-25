import { braveSearch } from './brave.js';

function normalizeBrand(s) {
  const base = String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return base.replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function brandFromHost(host) {
  const h = String(host || '').toLowerCase();
  const parts = h.split('.').filter(Boolean).filter((p) => p !== 'www');
  if (!parts.length) return '';
  let pick = parts.reduce((a, b) => (b.length > a.length ? b : a), parts[0]);
  pick = pick.replace(/[-_]/g, ' ').trim();
  return normalizeBrand(pick);
}

function isComplaintUrl(u) {
  const url = String(u || '').toLowerCase();
  if (!url.includes('reclameaqui.com.br')) return false;
  return /reclamacao|lista-reclamacoes/.test(url);
}

function extractCompanySlugFromUrl(u) {
  const s = String(u || '').toLowerCase();
  const m = s.match(/\/empresa\/([^\/?#]+)/);
  return m ? m[1] : '';
}

function uniqByUrl(arr) {
  const seen = new Set();
  const out = [];
  for (const r of arr) {
    const u = r?.url || '';
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(r);
  }
  return out;
}

export async function findComplaintsLinks(f, braveKey, brand, host, max = 20) {
  const h = String(host || '').trim();
  const derived = brandFromHost(h);
  const b = normalizeBrand(brand || derived);
  const baseTokens = Array.from(new Set([b, h].filter(Boolean)));
  const queries = [
    `${b} site:reclameaqui.com.br inurl:reclamacao`,
    `${b} site:reclameaqui.com.br inurl:reclamacoes`,
    `${b} site:reclameaqui.com.br inurl:lista-reclamacoes`,
    `${h} site:reclameaqui.com.br inurl:reclamacao`,
    `${h} site:reclameaqui.com.br inurl:reclamacoes`,
    `${b} "Reclame Aqui" site:reclameaqui.com.br inurl:reclamacao`,
    `${b} site:reclameaqui.com.br inurl:empresa inurl:lista-reclamacoes`,
  ];
  let results = [];
  for (const q of queries) {
    try {
      const rs = await braveSearch(f, braveKey, q, max);
      results = results.concat(rs);
    } catch {}
  }
  results = results.filter((r) => (r?.url || '').includes('reclameaqui.com.br'));
  results = uniqByUrl(results);
  const complaints = [];
  for (const r of results) {
    const u = r?.url || '';
    if (!isComplaintUrl(u)) continue;
    complaints.push({ url: u, title: r?.title || '', description: r?.description || '', type: 'complaint' });
    if (complaints.length >= max) break;
  }
  // Fallback: tentar focar pelo slug da empresa se coletamos pouco
  if (complaints.length < Math.min(5, max)) {
    let slug = '';
    for (const r of results) {
      slug = extractCompanySlugFromUrl(r?.url || '');
      if (slug) break;
    }
    if (slug) {
      const q2 = [
        `site:reclameaqui.com.br inurl:${slug} inurl:reclamacao`,
        `site:reclameaqui.com.br inurl:${slug} inurl:reclamacoes`,
        `site:reclameaqui.com.br/empresa/${slug}/lista-reclamacoes`,
      ];
      for (const q of q2) {
        try {
          const rs = await braveSearch(f, braveKey, q, max);
          for (const r of rs) {
            const u = r?.url || '';
            if (!u.includes('reclameaqui.com.br')) continue;
            if (!isComplaintUrl(u)) continue;
            if (complaints.find((c) => c.url === u)) continue;
            complaints.push({ url: u, title: r?.title || '', description: r?.description || '', type: 'complaint' });
            if (complaints.length >= max) break;
          }
        } catch {}
        if (complaints.length >= max) break;
      }
    }
  }
  return complaints.slice(0, max);
}