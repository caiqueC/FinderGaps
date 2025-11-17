export const BRAVE_API_URL = 'https://api.search.brave.com/res/v1/web/search';
export const blockedTlds = ['.gov', '.edu'];

export async function braveSearch(f, key, q, count = 20) {
  const url = BRAVE_API_URL + '?' + new URLSearchParams({ q, count: String(count), search_lang: 'pt-br', country: 'br' });
  const resp = await f(url, { headers: { Accept: 'application/json', 'X-Subscription-Token': key } });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Brave ${resp.status}: ${text}`);
  }
  const data = await resp.json();
  return data?.web?.results || [];
}

export async function findCommercialPage(host, f) {
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

export function buildQueryVariants(term) {
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