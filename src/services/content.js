export async function fetchPageText(f, url, maxChars = 8000) {
  try {
    const resp = await f(url, { method: 'GET', headers: { Accept: 'text/html,application/xhtml+xml' } });
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