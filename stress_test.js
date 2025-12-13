
const FETCH_URL = 'http://localhost:3000/api/generate';
const STREAM_URL = 'http://localhost:3000/api/stream';

async function startStressTest() {
    console.log('🚀 Iniciando Teste de Estresse (Custo Zero)...');
    console.log('🎯 Objetivo: Disparar 6 Jobs simultâneos.');
    console.log('🛡️ Expectativa: 4 Jobs "Processando" e 2 Jobs "Na Fila" (com aviso imediato).');
    console.log('--------------------------------------------------');

    const requests = [];

    for (let i = 1; i <= 6; i++) {
        const email = `test_user_${i}@stress.test`;
        const prompt = `[TEST] Simulação de Carga ${i}`;

        console.log(`[Disparando] Usuário ${i} (${email})...`);

        // Trigger Job
        const triggerPromise = fetch(FETCH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, prompt })
        }).then(res => res.json())
            .then(data => console.log(`[Trigger] Usuário ${i}: ${data.message}`));

        requests.push(triggerPromise);

        // For User 6 (guaranteed queue), connect to STREAM to check for "queued" message
        if (i === 6) {
            // Wait for trigger to DEFINITELY complete
            await triggerPromise;
            console.log('[Test] Trigger User 6 completed. Connecting to stream...');

            const streamReq = new Promise((resolve) => {
                const esUrl = `${STREAM_URL}?email=${encodeURIComponent(email)}`;
                console.log(`[Stream] Conectando Usuário 6 em: ${esUrl}`);

                // Fetch implementation of EventSource reader
                fetch(esUrl).then(async res => {
                    const reader = res.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = '';

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        const chunk = decoder.decode(value, { stream: true });
                        console.log(`[Stream Log - User 6] ${chunk.trim()}`);

                        // Stop if we see the queue message
                        if (chunk.includes('Solicitação na fila')) {
                            console.log('✅ SUCCESSO: Mensagem de fila detectada!');
                            resolve();
                            // In real test we'd keep going, but here we just want to prove it works
                            reader.cancel();
                        }
                        if (chunk.includes('Iniciando processamento')) {
                            console.log('⚠️ AVISO: Já iniciou processamento (não pegou fila ou foi rápido demais).');
                            resolve();
                            reader.cancel();
                        }
                    }
                }).catch(e => console.error("Stream Error", e));
            });
            requests.push(streamReq);
        }

        // Small delay to simulate realistic click-storm
        await new Promise(r => setTimeout(r, 200));
    }

    await Promise.all(requests);
    console.log('--------------------------------------------------');
    console.log('✅ Teste finalizado.');
}

startStressTest();
