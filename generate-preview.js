import { renderBlueprintHtml } from './src/services/blueprint.js';
import { renderPdfReport } from './src/services/report.js';
import { loadEnv } from './src/services/env.js';

async function generate() {
    try {
        console.log('Generating Preview PDF...');
        await loadEnv(); // Ensure env vars are loaded if needed by puppeteer
        const html = renderBlueprintHtml('Projeto Demonstração');
        const outputPath = 'preview_blueprint.pdf';
        await renderPdfReport(html, outputPath);
        console.log(`PDF generated at ${outputPath}`);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

generate();
