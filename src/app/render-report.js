import { readFile, readdir, writeFile } from 'node:fs/promises';
import { renderHtmlReport } from '../services/report.js';

function toSlug(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60) || 'relatorio';
}

async function findLatestJson(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = entries.filter((e) => e.isFile() && e.name.endsWith('.json')).map((e) => e.name).sort().reverse();
    if (files.length === 0) return null;
    return `${dir}/${files[0]}`;
  } catch {
    return null;
  }
}

async function main() {
  const argPath = process.argv[2] || '';
  const jsonPath = argPath || (await findLatestJson('reports'));
  if (!jsonPath) {
    console.error('Nenhum arquivo JSON encontrado em reports/. Informe o caminho: npm run report reports/<arquivo>.json');
    process.exit(1);
  }
  const raw = await readFile(jsonPath, 'utf8');
  const data = JSON.parse(raw);
  const html = renderHtmlReport(data);
  const base = jsonPath.replace(/\.json$/i, '');
  const outPath = `${base}.html`;
  await writeFile(outPath, html, 'utf8');
  console.log('Relatório HTML gerado:', outPath);
}

main();