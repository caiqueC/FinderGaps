import { findComplaintsLinks } from './reclameaqui.js';
import { searchYouTube, searchForums } from './search.js';
import { fetchPageText, isBlockedContent } from './content.js';
import { summarizeComplaint } from './openrouter.js';

export async function runNegativeSearch(f, braveKey, openKey, term, strategy, competitors) {
    const negativeData = [];

    // Strategy 1: Red Ocean -> Focus on ReclameAqui for specific brands
    if (strategy === 'RED_OCEAN') {
        // Limit to top 3 competitors to save time/tokens
        const topCompetitors = competitors.slice(0, 3);

        for (const comp of topCompetitors) {
            let host = '';
            try { host = new URL(comp.url).hostname.toLowerCase(); } catch { }
            const brand = comp.title || host;

            console.log(`[NEGATIVE SEARCH] Buscando reclamações para: ${brand}`);
            const complaints = await findComplaintsLinks(f, braveKey, brand, host, 5); // 5 complaints per competitor

            for (const c of complaints) {
                const cText = await fetchPageText(f, c.url, 6000);
                const blocked = isBlockedContent(cText) || !cText;
                const baseText = blocked ? (c.description || c.title || '') : cText;
                const cSum = await summarizeComplaint(f, openKey, brand, c.url, baseText);
                if (cSum?.summary) {
                    negativeData.push({ source: 'ReclameAqui', brand, summary: cSum.summary, url: c.url });
                }
            }
        }
    }

    // Strategy 2 & 3: Blue Ocean / Visionary -> Focus on Process Friction & Workarounds
    // We search YouTube and Forums for "general pains" about the TERM, not a brand.
    if (strategy === 'BLUE_OCEAN' || strategy === 'VISIONARY') {
        console.log(`[NEGATIVE SEARCH] Buscando fricção em Fóruns e YouTube para: ${term}`);

        // forums
        const forumResults = await searchForums(f, braveKey, term);
        for (const r of forumResults) {
            // We don't need deep summarization for every forum post, title/description is often enough or we can summarize batch
            // For quality, let's summarize the content if we can fetch it.
            // But scraping forums is hard (blocking). Let's trust description/title mostly or try fetch.
            const text = await fetchPageText(f, r.url, 4000);
            const summary = await summarizeComplaint(f, openKey, 'General Market', r.url, text || r.description);
            if (summary?.summary) {
                negativeData.push({ source: 'Forum', title: r.title, summary: summary.summary, url: r.url });
            }
        }

        // youtube
        const videoResults = await searchYouTube(f, braveKey, term);
        for (const r of videoResults) {
            // YouTube video pages are heavy. Summarizing title/desc is usually safer/faster.
            negativeData.push({ source: 'YouTube', title: r.title, summary: `Video Title: ${r.title}. Description: ${r.description}`, url: r.url });
        }
    }

    return negativeData;
}
