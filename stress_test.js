
const FETCH_URL = 'http://localhost:3000/api/generate';

async function startStressTest() {
    console.log('🚀 Iniciando Teste de Estresse (Custo Zero)...');
    console.log('🎯 Objetivo: Disparar 6 Jobs simultâneos.');
    console.log('🛡️ Expectativa: 4 Jobs "Processando" e 2 Jobs "Na Fila".');
    console.log('--------------------------------------------------');

    const requests = [];

    for (let i = 1; i <= 6; i++) {
        const email = `test_user_${i}@stress.test`;
        const prompt = `[TEST] Simulação de Carga ${i}`;

        console.log(`[Disparando] Usuário ${i} (${email})...`);

        // Fire and forget (don't await response validation strictly, just trigger)
        const req = fetch(FETCH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, prompt })
        }).then(res => {
            console.log(`[Resposta] Usuário ${i}: Status ${res.status}`);
            if (res.body) {
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                // Read first chunk to confirm connection
                return reader.read().then(({ value }) => {
                    console.log(`[Stream] Usuário ${i} conectado! Chunk inicial: ${decoder.decode(value).substring(0, 50)}...`);
                });
            }
        }).catch(err => console.error(`[Erro] Usuário ${i}:`, err.message));

        requests.push(req);

        // Small delay to simulate realistic click-storm
        await new Promise(r => setTimeout(r, 200));
    }

    await Promise.all(requests);
    console.log('--------------------------------------------------');
    console.log('✅ Todos os requests disparados.');
    console.log('👀 Verifique o terminal do servidor: 4 Workers devem estar rodando e 2 na espera.');
}

startStressTest();
