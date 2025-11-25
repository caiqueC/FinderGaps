export async function fetchPageText(f, url, maxChars = 8000) {
  try {
    const resp = await f(url, {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        Referer: 'https://www.google.com/',
        'Cache-Control': 'no-cache',
      },
    });
    if (!resp.ok) return '';
    const html = await resp.text();
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<head[\s\S]*?<\/head>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned.slice(0, maxChars);
  } catch {
    return '';
  }
}

export function isBlockedContent(text) {
  const s = String(text || '').toLowerCase();
  return (
    s.includes('enable javascript') ||
    s.includes('você precisa habilitar javascript') ||
    s.includes('cloudflare') ||
    s.includes('captcha') ||
    s.includes('acesso negado')
  );
}