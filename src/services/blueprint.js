
export function renderBlueprintHtml() {
    return `
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <title>Plan Genie - Blueprint de Produto</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600;700&display=swap');
        
        body {
            font-family: 'Montserrat', sans-serif;
            margin: 0;
            padding: 0;
            color: #333;
            background: #fff;
            line-height: 1.6;
        }

        .page {
            height: 100vh;
            width: 100%;
            position: relative;
            padding: 40px;
            box-sizing: border-box;
            page-break-after: always;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }

        /* Cover */
        .cover {
            background: #1a1a1a;
            color: #f5f5f7;
            justify-content: center;
        }
        .cover h1 {
            font-size: 3.5rem;
            text-transform: uppercase;
            margin-bottom: 20px;
        }
        .cover p {
            font-size: 1.2rem;
            opacity: 0.8;
        }

        /* Diagrams */
        .diagram-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }

        .box {
            border: 2px solid #333;
            border-radius: 12px;
            padding: 20px;
            margin: 10px;
            background: #f9f9f9;
            text-align: center;
            box-shadow: 4px 4px 0px rgba(0,0,0,0.1);
        }

        .role-box {
            display: inline-block;
            width: 150px;
            margin: 10px;
            font-weight: bold;
        }

        .arrow {
            font-size: 20px;
            margin: 0 10px;
        }

        /* Typography */
        h2 {
            font-size: 2rem;
            margin-bottom: 30px;
            text-align: center;
            border-bottom: 3px solid #000;
            display: inline-block;
            padding-bottom: 5px;
        }

        .note-box {
            border: 2px dashed #666;
            padding: 20px;
            border-radius: 10px;
            background: #f0f0f0;
            margin-top: 30px;
            font-size: 0.9rem;
            width: 100%;
            max-width: 800px;
        }

        .formula-row {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
            margin: 20px 0;
            font-size: 1.5rem;
            font-weight: bold;
        }

        .plus, .result {
            font-size: 2rem;
            color: #666;
        }
        
    </style>
</head>
<body>

    <!-- Capa -->
    <div class="page cover">
        <h1>Blueprint de Construção<br>de Produto</h1>
        <p>O guia definitivo para transformar seu Estudo de Mercado em Software.</p>
        <p><strong>Metodologia Plan Genie</strong></p>
    </div>

    <!-- Página 1: Papéis e Fluxo -->
    <div class="page">
        <h2>Resumo de Criação de Produtos</h2>
        
        <div class="diagram-container">
            <!-- Fluxo Simplificado -->
            <div style="display: flex; align-items: center; justify-content: center;">
                <div class="box role-box">BA<br><span style="font-size:0.7em; font-weight:400;">(Business Analyst)</span></div>
                <div class="arrow">→</div>
                <div class="box role-box">PO<br><span style="font-size:0.7em; font-weight:400;">(Product Owner)</span></div>
                <div class="arrow">→</div>
                <div class="box role-box">Tech Lead</div>
                <div class="arrow">→</div>
                <div class="box role-box" style="border-style:dashed;">Dev</div>
            </div>

            <div class="note-box">
                <strong>Quem é quem?</strong><br><br>
                • <strong>BA</strong>: Foca na análise de dados e necessidades de negócio (Gera o Estudo).<br>
                • <strong>PO</strong>: Gerencia o Backlog e define o que será feito (Funcional).<br>
                • <strong>Tech Lead</strong>: Define a arquitetura e garante a qualidade técnica.<br>
                • <strong>Dev</strong>: O programador que escreve o código.
            </div>
        </div>
    </div>

    <!-- Página 2: A Fórmula -->
    <div class="page">
        <h2>A Fórmula de Criação</h2>
        
        <div class="diagram-container">
            
            <div class="formula-row">
                <div class="box">Estudo de<br>Mercado</div>
                <div class="plus">+</div>
                <div class="box">Produto<br>(Escopos)</div>
                <div class="result">=</div>
                <div class="box" style="background:#e0f7fa;">Estrutura<br>Funcional</div>
            </div>

            <div class="formula-row">
                <div class="box" style="background:#e0f7fa;">Estrutura<br>Funcional</div>
                <div class="plus">+</div>
                <div class="box">Produto<br>(Escopos)</div>
                <div class="result">=</div>
                <div class="box" style="background:#fff3e0;">Estrutura<br>Técnica</div>
            </div>

            <div class="note-box" style="text-align: center;">
                Com a <strong>Estrutura Técnica</strong> pronta, o Tech Lead cria as tasks no ClickUp utilizando ferramentas de IA (Cursor/Claude) e servidores MCP.
            </div>
        </div>
    </div>

    <!-- Página 3: Escopos e Granularidade -->
    <div class="page">
        <h2>Granulação de Escopo</h2>
        
        <div class="diagram-container">
            <div class="box" style="width: 80%; padding: 40px; background: #fafafa;">
                <h3 style="font-size: 2.5rem; margin:0;">PRODUTO</h3>
                
                <div style="display: flex; gap: 20px; justify-content: center; margin-top: 20px;">
                    <div class="box" style="flex:1; border-color: #2196F3;">
                        <strong style="color: #2196F3;">ÉPICO 1</strong>
                        <div style="margin-top:10px; font-size:0.8rem; border:1px solid #ddd; padding:5px;">Feature A</div>
                        <div style="margin-top:5px; font-size:0.8rem; border:1px solid #ddd; padding:5px;">Feature B</div>
                    </div>
                    <div class="box" style="flex:1; border-color: #2196F3;">
                        <strong style="color: #2196F3;">ÉPICO 2</strong>
                        <div style="margin-top:10px; font-size:0.8rem; border:1px solid #ddd; padding:5px;">Feature C</div>
                        <div style="margin-top:5px; font-size:0.8rem; border:1px solid #ddd; padding:5px;">Feature D</div>
                    </div>
                </div>
            </div>

            <div class="note-box">
                A estrutura não é rígida. Em projetos menores, pode-se ir direto do Épico para a Task. O importante é a clareza para o desenvolvedor.
            </div>
        </div>
    </div>

    <!-- Página 4: ClickUp Workflow -->
    <div class="page">
        <h2>Ciclo de Qualidade (ClickUp)</h2>
        
        <div class="diagram-container">
            <div style="display:flex; gap:10px; width:100%; justify-content:space-between; margin-bottom: 20px;">
                <div class="box" style="flex:1; background:#eee;">BACKLOG</div>
                <div class="box" style="flex:1; background:#e3f2fd;">IN PROGRESS</div>
                <div class="box" style="flex:1; background:#fff9c4;">TO REVIEW</div>
                <div class="box" style="flex:1; background:#ffcdd2;">TO FIX</div>
                <div class="box" style="flex:1; background:#c8e6c9;">DONE</div>
            </div>

            <div class="note-box">
                <strong>O Ciclo de Ouro:</strong><br>
                1. <strong>Dev</strong> move para <em>In Progress</em> e trabalha.<br>
                2. Ao terminar, move para <em>To Review</em>.<br>
                3. <strong>Tech Lead</strong> revisa.<br>
                &nbsp;&nbsp;&nbsp;• Se OK: Move para <em>DONE</em>.<br>
                &nbsp;&nbsp;&nbsp;• Se Ruim: Move para <em>To Fix</em> (com comentários) -> Dev corrige -> Devolve para <em>To Review</em>.
            </div>
        </div>
    </div>

</body>
</html>
  `;
}
