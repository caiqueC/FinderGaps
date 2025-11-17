import { mkdir, writeFile } from 'node:fs/promises';

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60) || 'relatorio';
}

function htmlEscape(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderHtmlReport({ term, keywordPlan, extraKeywords, competitors, competitorDetails, referencesBefore, referencesAfter }) {
  const head = `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Estudo: ${htmlEscape(term)}</title><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;line-height:1.5;padding:24px;max-width:1000px;margin:auto}h1,h2,h3{margin:0 0 8px}section{margin:24px 0}code,pre{background:#f5f5f7;border-radius:6px;padding:8px}ul{padding-left:20px}li{margin:4px 0}a{color:#0366d6;text-decoration:none}</style></head><body>`;
  const kwComp = (keywordPlan?.competitor || []).map((k) => `<code>${htmlEscape(k)}</code>`).join(' ');
  const kwRef = (keywordPlan?.reference || []).map((k) => `<code>${htmlEscape(k)}</code>`).join(' ');
  const kwExtra = (extraKeywords || []).map((k) => `<code>${htmlEscape(k)}</code>`).join(' ');
  const compList = competitors.map((c, i) => `<li><strong>${htmlEscape(c.title || '')}</strong><br><a href="${htmlEscape(c.url || '')}">${htmlEscape(c.url || '')}</a>${c.product_service ? `<br><small>${htmlEscape(c.product_service)}</small>` : ''}</li>`).join('');
  const compDetails = competitorDetails.map((d, i) => {
    const feats = (d.features || []).map((f) => `<li>${htmlEscape(f)}</li>`).join('');
    return `<li><strong>${htmlEscape(d.title || '')}</strong><br><a href="${htmlEscape(d.url || '')}">${htmlEscape(d.url || '')}</a>${d.product_service ? `<br><small>${htmlEscape(d.product_service)}</small>` : ''}${d.summary ? `<p>${htmlEscape(d.summary)}</p>` : ''}${d.target ? `<p><em>Público-alvo:</em> ${htmlEscape(d.target)}</p>` : ''}${d.pricing ? `<p><em>Modelo de preço:</em> ${htmlEscape(d.pricing)}</p>` : ''}${d.category ? `<p><em>Categoria:</em> ${htmlEscape(d.category)}</p>` : ''}${feats ? `<p><em>Funcionalidades:</em></p><ul>${feats}</ul>` : ''}</li>`;
  }).join('');
  const refsSummary = `<p>Total antes: ${referencesBefore} • Após dedupe: ${referencesAfter}</p>`;
  const tail = `</body></html>`;
  return head + `<h1>Estudo: ${htmlEscape(term)}</h1>` +
    `<section><h2>Palavras‑chave</h2><p><strong>Concorrentes:</strong> ${kwComp || '—'}</p><p><strong>Referências:</strong> ${kwRef || '—'}</p><p><strong>Usadas na busca:</strong> ${kwExtra || '—'}</p><p><strong>Confiança:</strong> ${typeof keywordPlan?.confidence === 'number' ? keywordPlan.confidence.toFixed(2) : '—'}</p></section>` +
    `<section><h2>Concorrentes (${competitors.length})</h2><ul>${compList}</ul></section>` +
    `<section><h2>Resumo dos Concorrentes</h2><ul>${compDetails}</ul></section>` +
    `<section><h2>Referências</h2>${refsSummary}</section>` + tail;
}

export async function saveHtmlReport(term, data) {
  const dir = 'reports';
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = `${dir}/${stamp}_${slugify(term)}.html`;
  const html = renderHtmlReport({ term, ...data });
  await writeFile(file, html, 'utf8');
  return file;
}