import { readFile } from 'node:fs/promises';

export async function loadEnv() {
  try {
    const s = await readFile('.env', 'utf8');
    const lines = s.split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2];
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val.startsWith('\'') && val.endsWith('\'')) val = val.slice(1, -1);
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {}
}