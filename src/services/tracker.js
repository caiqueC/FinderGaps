import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const STATS_FILE = resolve(process.cwd(), 'stats.json');

export async function getStats() {
    try {
        const data = await readFile(STATS_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return { count: 0, totalTimeMs: 0, averageMs: 0 };
    }
}

export async function saveRunTime(durationMs) {
    const stats = await getStats();

    // Simple rolling average
    stats.count += 1;
    stats.totalTimeMs += durationMs;
    stats.averageMs = Math.round(stats.totalTimeMs / stats.count);

    try {
        await writeFile(STATS_FILE, JSON.stringify(stats, null, 2));
    } catch (err) {
        console.error('Failed to save stats:', err);
    }
    return stats;
}

export async function getFormattedAverage() {
    const stats = await getStats();
    if (stats.count === 0) return 0; // No history yet

    // Return in minutes, rounded up
    return Math.ceil(stats.averageMs / 60000);
}
