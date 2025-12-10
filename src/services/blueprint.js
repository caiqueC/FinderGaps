export function renderBlueprintHtml(term) {
    // Icons (SVGs) - Re-colored for strict monochrome palette
    const iconStyle = 'stroke="#333" stroke-width="2"';
    const iconBA = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" ${iconStyle} stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;
    const iconBrain = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" ${iconStyle} stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg>`;
    const iconPO = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" ${iconStyle} stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`;
    const iconTech = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" ${iconStyle} stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>`;
    const iconDev = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" ${iconStyle} stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;
    const iconArrowRight = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
    const iconArrowDown = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`;
    const iconPlus = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
    const iconEqual = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="9" x2="19" y2="9"/><line x1="5" y1="15" x2="19" y2="15"/></svg>`;
    const iconCheck = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

    return `
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <title>Plan Genie - Blueprint de Produto</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap');
        
        :root {
            /* Palette based on Report PDF (Monochrome) */
            --bg-dark: #1a1a1a;
            --text-light: #f5f5f7;
            --text-dark: #333;
            --section-num: #999;
        }

        body {
            font-family: 'Montserrat', sans-serif;
            margin: 0;
            padding: 0;
            color: var(--text-dark);
            background: #fff;
            line-height: 1.8;
        }

        .page {
            min-height: 100vh;
            width: 100%;
            position: relative;
            padding: 0;
            box-sizing: border-box;
            page-break-after: always;
            display: flex;
            flex-direction: column;
            background: #fff;
        }

        /* Cover */
        .cover {
            height: 100vh;
            background: var(--bg-dark);
            color: var(--text-light);
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding: 40px;
            box-sizing: border-box;
            position: relative;
        }
        .cover-logo {
            position: absolute;
            top: 40px;
            left: 50%;
            transform: translateX(-50%);
            text-align: center;
            font-weight: 700;
            letter-spacing: 2px;
            text-transform: uppercase;
        }
        .cover h1 {
            font-size: 3.5rem;
            font-weight: 700;
            line-height: 1.1;
            margin: 0;
            max-width: 800px;
        }
        .cover .term-highlight {
            color: #fff;
            opacity: 0.8;
            font-size: 1.5rem;
            margin-top: 20px;
            font-weight: 400;
        }
        .cover-footer {
            position: absolute;
            bottom: 40px;
            width: 100%;
            text-align: center;
            font-size: 0.9rem;
            opacity: 0.7;
        }

        /* Sections */
        section {
            padding: 50px 40px;
            max-width: 900px;
            margin: 0 auto;
            flex: 1;
            display: flex;
            flex-direction: column;
        }
        
        .section-header {
            display: flex;
            align-items: baseline;
            margin-bottom: 30px;
            border-bottom: 2px solid #000;
            padding-bottom: 15px;
        }
        .section-num {
            font-size: 2rem;
            color: var(--section-num);
            margin-right: 20px;
            font-weight: 300;
        }
        .section-title {
            font-size: 2.2rem;
            font-weight: 700;
            margin: 0;
            color: #000;
        }

        p {
            font-size: 1rem;
            margin-bottom: 25px;
            text-align: justify;
            color: #444;
        }

        h3 {
            font-size: 1.3rem;
            margin-top: 30px;
            margin-bottom: 15px;
            color: #000;
            font-weight: 600;
        }

        ol {
            margin-bottom: 25px;
            padding-left: 20px;
        }
        ol li {
            margin-bottom: 12px;
            color: #444;
        }

        /* Diagram Boxes */
        .diagram-box {
            background: #fff;
            border: 1px solid #eee;
            border-radius: 8px;
            padding: 30px;
            margin: 30px 0;
            display: flex;
            justify-content: center;
            align-items: center;
            flex-wrap: wrap;
        }
        .box {
            border: 2px solid #333;
            border-radius: 8px;
            padding: 20px;
            margin: 10px;
            background: #fafafa;
            text-align: center;
            font-weight: 600;
            color: var(--text-dark);
            min-width: 250px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            box-shadow: 4px 4px 0px rgba(0,0,0,0.1);
        }
        .arrow {
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 10px 0;
            color: #666;
        }

        /* Specialized Boxes */
        .note-box {
            border-left: 4px solid #000;
            padding-left: 20px;
            background: transparent;
            font-style: italic;
            font-size: 1rem;
            color: #444;
            margin: 20px 0;
        }
        .quote-box {
            margin-top: 30px; 
            font-style: normal; 
            border-left: 4px solid #333; 
            background: #fafafa; 
            padding: 25px;
            border-radius: 0 8px 8px 0;
        }
        .warning-box {
            border: 1px solid #333;
            background-color: #f7f7f7;
            padding: 25px;
            border-radius: 8px;
            margin: 30px 0;
        }
        .warning-title {
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 15px;
            text-transform: uppercase;
            font-size: 0.9rem;
        }

        .glossary-item {
            margin-bottom: 30px;
            border-bottom: 1px solid #eee;
            padding-bottom: 15px;
        }
        .glossary-term {
            font-weight: 700;
            font-size: 1.15rem;
            color: #000;
            display: block;
            margin-bottom: 8px;
        }
        .glossary-def {
            display: block;
            margin-bottom: 10px;
        }
        .glossary-exa {
            font-size: 0.9rem;
            color: #666;
            font-style: italic;
            background: #f9f9f9;
            padding: 10px;
            border-radius: 4px;
        }

        .code-block {
            background: #1a1a1a;
            color: #f5f5f7;
            padding: 25px;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            font-size: 0.85rem;
            line-height: 1.5;
            white-space: pre-wrap;
            margin: 25px 0;
            border: 1px solid #333;
        }
        
        .flow-grid {
            display: flex;
            flex-direction: column;
            align-items: center;
            width: 100%;
        }

    </style>
</head>
<body>

    <!-- Capa -->
    <div class="page cover">
        <div class="cover-logo">PLAN GENIE</div>
        <div>
            <h1>Blueprint de<br>Produto</h1>
            <p style="color: rgba(255,255,255,0.7); text-align: center; margin-top: 10px;">Guia Tático de Implementação e Autonomia</p>
            ${term ? `<div class="term-highlight">${term}</div>` : ''}
        </div>
        <div class="cover-footer">Plan Genie Framework v2.0 - Product Blueprint</div>
    </div>

    <!-- 00 - Filosofia -->
    <div class="page">
        <section>
            <div class="section-header">
                <span class="section-num">00</span>
                <h2 class="section-title">O Fim da Fórmula Mágica</h2>
            </div>
            <p>
                Vivemos em uma era de ruído. Prometem a você diariamente que a IA "fará tudo sozinha", que você pode criar o próximo unicórnio enquanto dorme, e que o código é uma commodity que não requer mais supervisão. 
                <strong>Isso é uma meia-verdade perigosa.</strong>
            </p>
            <p>
                A tecnologia evoluiu, sim. Hoje, uma pessoa sozinha tem o poder de fogo de uma equipe de 20 engenheiros de dez anos atrás. Mas poder sem controle não cria produtos; cria caos.
                O Plan Genie não está aqui para te vender um sonho impossível. Estamos aqui para te dar um <strong>Método</strong>.
            </p>
            <p>
                A IA é uma ferramenta de alavancagem infinita. Mas uma alavanca precisa de um ponto de apoio e de alguém para aplicar a força na direção certa. 
                <strong>Você é esse alguém.</strong> Sua responsabilidade é deixar de ser apenas um "usuário" de ferramentas e tornar-se um "Arquiteto de Processos".
            </p>
            
            <div class="quote-box">
                <p style="margin:0; font-weight:600; font-size:1rem; font-style: italic;">
                    "Os processos são a espinha dorsal de todo projeto bem-sucedido. Embora as ferramentas de IA sejam incríveis para executar esses processos com eficiência, o design do processo em si é o que realmente importa. Ótimos processos + IA = resultados poderosos. Processos ruins + IA = caos executado com eficiência. Projete primeiro, automatize depois."
                </p>
            </div>
            <p style="font-size: 0.95rem; margin-top: 20px;">
                <strong>O que isso significa na prática?</strong><br> 
                Imagine que a IA é uma equipe de construtores com supervelocidade, mas que seguem ordens cegamente. Se você entregar a eles uma planta (o Processo) com as paredes tortas, eles levantarão o prédio torto em segundos — e ele cairá na sua cabeça logo em seguida.
                A IA não corrige processos ruins; ela os acelera. Se o seu processo de decisão for confuso, a IA vai gerar confusão em escala industrial.
                Neste documento, nós te ensinamos a desenhar a planta correta. As ferramentas mudam, mas a lógica de construção sólida é eterna.
            </p>
        </section>
    </div>

    <!-- 01 - Glossário Expandido -->
    <div class="page">
        <section>
            <div class="section-header">
                <span class="section-num">01</span>
                <h2 class="section-title">Glossário & Fundamentos</h2>
            </div>
            <div class="warning-box" style="margin-top: 0; margin-bottom: 30px; padding: 15px;">
                <p style="margin:0; font-size: 0.9rem;">
                    <strong>Importante:</strong> As explicações abaixo são simplificações para dar contexto. Recomendamos fortemente que você <strong>pesquise a fundo</strong> não apenas os termos descritos aqui, mas qualquer palavra ou conceito técnico que você não entenda completamente ao longo destes dois documentos. A verdadeira autonomia vem da curiosidade incansável.
                </p>
            </div>
            <p>
                Para comandar essa nova força de trabalho digital, você precisa aprender o idioma dela. Não vamos falar "tech-ês" complicado, vamos usar analogias para solidificar o entendimento.
            </p>

            <div class="glossary-item">
                <span class="glossary-term">LLM (Large Language Model)</span>
                <span class="glossary-def">É o "cérebro" incorpóreo. Pense nele como um gênio numa lâmpada muito inteligente, mas que não tem mãos. Ele sabe tudo o que está na internet até a data de seu treinamento, mas não consegue "tocar" no seu computador.</span>
                <span class="glossary-exa">Recomendações: Claude 3.5 Sonnet (ou 4.5 quando disponível), Gemini 1.5 Pro (ou 3.0). Use sempre o modelo mais inteligente disponível.</span>
            </div>

            <div class="glossary-item">
                <span class="glossary-term">IDE (Integrated Development Environment)</span>
                <span class="glossary-def">É o "chão de fábrica" ou o "ateliê". É o programa instalado no seu computador onde os arquivos de código realmente existem. Sem uma IDE, o código é apenas texto num chat; na IDE, ele vira software real.</span>
                <span class="glossary-exa">Exemplos Modernos (com IA): Trae, Antigravity, Cursor, VS Code (com plugins).</span>
            </div>

            <div class="glossary-item">
                <span class="glossary-term">Agente</span>
                <span class="glossary-def">Se a LLM é o cérebro, o Agente é o "funcionário". Ele tem permissão de usar o cérebro (LLM) para pensar e "mãos" (ferramentas) para agir. Ele pode criar arquivos, ler pastas e rodar comandos.</span>
                <span class="glossary-exa">Analogia: Uma LLM te diz como fazer um bolo. Um Agente vai na cozinha, pega os ovos e faz o bolo para você.</span>
            </div>

            <div class="glossary-item">
                <span class="glossary-term">MCP (Model Context Protocol)</span>
                <span class="glossary-def">São os "super-poderes" ou "ferramentas especializadas" que damos aos Agentes. Por padrão, uma IA não sabe ver suas tarefas no ClickUp ou seu calendário. O MCP é um padrão universal que conecta a IA a serviços externos.</span>
                <span class="glossary-exa">Exemplo: O "MCP do ClickUp" permite que seu Agente na IDE leia: "Tarefa 1: Criar Tela de Login" diretamente do seu gerenciador, sem você precisar copiar e colar nada.</span>
            </div>

            <div class="glossary-item">
                <span class="glossary-term">Context Window (Janela de Contexto)</span>
                <span class="glossary-def">A "memória de curto prazo" da IA. Imagine que a IA tem uma prancheta. Se você passar 5 horas conversando, a prancheta enche e ela começa a apagar o início para escrever o fim. Isso causa o esquecimento de regras iniciais (alucinação).</span>
                <span class="glossary-exa">Solução: Nós "resetamos" a memória trocando de chats ou agentes a cada nova fase do projeto.</span>
            </div>
        </section>
    </div>

    <!-- 02 - A Metodologia (Deep Dive) -->
    <div class="page">
        <section>
            <div class="section-header">
                <span class="section-num">02</span>
                <h2 class="section-title">A Metodologia em 4 Atos</h2>
            </div>
            <p>
                Por que dividir o trabalho? Por que não pedir para a IA "fazer tudo" de uma vez?
                Porque complexidade gera erro. Em engenharia de software, dividimos problemas grandes em problemas pequenos. Nossa metodologia aplica esse princípio ao uso de IA, criando "silos de contexto" para evitar alucinações.
            </p>
            
            <div class="diagram-box">
                <div class="flow-grid">
                    <div class="box">
                        <strong>1. O Estrategista (Business Analyst)</strong><br>
                        <span style="font-size:0.9em; font-weight:400;">Ferramenta: Plan Genie (Nós)</span><br>
                        <span style="font-size:0.8em; color:#666;">Entrega: O Mapa do Tesouro (PDF de Mercado)</span>
                    </div>
                    <div class="arrow">${iconArrowDown}</div>
                    <div class="box">
                        <strong>2. O Tradutor (Product Owner)</strong><br>
                        <span style="font-size:0.9em; font-weight:400;">Ferramenta: Claude (Web) + Extended Thinking</span><br>
                        <span style="font-size:0.8em; color:#666;">Entrega: A Planta Baixa (Manual Funcional)</span>
                    </div>
                    <div class="arrow">${iconArrowDown}</div>
                    <div class="box">
                        <strong>3. O Arquiteto (Tech Lead 1)</strong><br>
                        <span style="font-size:0.9em; font-weight:400;">Ferramenta: Claude (Desktop) + MCP ClickUp</span><br>
                        <span style="font-size:0.8em; color:#666;">Entrega: O Canteiro de Obras (Tasks Organizadas)</span>
                    </div>
                    <div class="arrow">${iconArrowDown}</div>
                    <div class="box" style="background: #333; color: #fff; border:none;">
                        <strong>4. A Fábrica (Execução & Review)</strong><br>
                        <span style="font-size:0.9em; font-weight:400;">Ferramenta: IDE (Trae/Cursor)</span><br>
                        <span style="font-size:0.8em; color:#ccc;">Ciclo Contínuo: Dev (Agente) ↔ Revisor (Agente)</span>
                    </div>
                </div>
            </div>

            <div class="warning-box">
                <div class="warning-title">⚠️ O Perigo da "Conversa Infinita"</div>
                <p style="margin:0; font-size: 0.95rem;">
                    Um erro comum é tentar fazer tudo isso em um único chat (uma única thread). No começo, a IA é brilhante. Na centésima mensagem, ela começa a esquecer nomes de variáveis, inventar bibliotecas e ignorar suas ordens.<br><br>
                    <strong>Nossa Regra de Ouro:</strong> Cada caixinha acima é um Chat (ou Agente) NOVO. Contexto limpo = Inteligência máxima.
                </p>
            </div>
        </section>
    </div>

    <!-- 03 - PO (Product Owner) Detalhado -->
    <div class="page">
        <section>
            <div class="section-header">
                <span class="section-num">03</span>
                <h2 class="section-title">O Tradutor (PO)</h2>
            </div>
            <p>
                <strong>O Problema:</strong> Desenvolvedores (humanos ou IAs) odeiam ambiguidade. Se você disser "quero um app tipo Uber", existem 10.000 maneiras de interpretar isso.
            </p>
            <p>
                <strong>A Solução:</strong> O Product Owner (PO) é o papel que traduz "necessidades de negócio" (identificadas no PDF de Mercado) em "requisitos funcionais". Ele não se preocupa com código, mas sim com comportamento. "Quando o usuário clica aqui, acontece X".
            </p>
            
            <h3>Passo A: Preparando o Terreno</h3>
            <ol>
                <li>Abra sua LLM favorita (Recomendamos Claude 3.5 Sonnet pela capacidade de raciocínio).</li>
                <li>Ative o modo <strong>"Extended Thinking"</strong> (se disponível). Isso força a IA a gastar "segundos de silêncio" planejando antes de escrever.</li>
                <li>Anexe o PDF de Estudo de Mercado que o Plan Genie gerou.</li>
            </ol>

            <h3>Passo B: O Prompt de Definição</h3>
            <div class="code-block">
CONTEXTO:
Você é um Product Owner Sênior especializado em tradução de negócios para tech.
Você recebeu o Estudo de Mercado em anexo.

OBJETIVO:
Criar a DOCUMENTAÇÃO FUNCIONAL para o MVP (Minimum Viable Product).

INSTRUÇÕES:
1. Ignore tecnologias por enquanto (não decida se é React ou Python). Foque no PRODUTO.
2. Liste os Eixos Principais (Épicos) baseados nos Gaps de Mercado identificados.
3. Para cada Épico, crie Histórias de Usuário detalhadas ("Como usuário, eu quero... para que...").
4. Adicione Critérios de Aceite para cada história (Isso é crucial para testarmos depois).

SAÍDA:
Gere um documento estruturado. Se possível, estruture em Markdown para fácil leitura.
            </div>

            <p class="note-box">
                Guarde o resultado. Esse texto gerado é a "Bíblia" do seu produto. Se algo não está escrito aqui, não existirá no software.
            </p>
        </section>
    </div>

    <!-- 04 - Tech Lead Arquiteto Detalhado -->
    <div class="page">
        <section>
            <div class="section-header">
                <span class="section-num">04</span>
                <h2 class="section-title">O Arquiteto (Tech Lead 1)</h2>
            </div>
            <p>
                Agora temos a Planta Baixa (Funcional). Precisamos de um Engenheiro Civil para decidir os materiais e organizar a equipe de construção.
            </p>
            <p>
                Nesta etapa, o Tech Lead deve usar o <strong>Claude Desktop App</strong> (ou uma IDE) para ter acesso ao MCP. IAs via navegador web geralmente não acessam MCPs locais por segurança.
            </p>

            <h3>Passo C: Configuração e MCP</h3>
            <ol>
                <li>Abra o <strong>Claude Desktop App</strong> ou sua IDE.</li>
                <li>Conecte o <strong>MCP do ClickUp</strong> (ou do gerenciador de sua escolha).</li>
                <li>Anexe a "Bíblia Funcional" que o PO criou no passo anterior.</li>
            </ol>

            <h3>Passo D: O Prompt de Arquitetura</h3>
            <div class="code-block">
ROLE:
Você é um Tech Lead e Arquiteto de Software Sênior.

INPUT:
Documentação Funcional em anexo.

AÇÃO 1 - ARQUITETURA:
Defina a Stack Tecnológica ideal para este projeto. (Ex: React + Node ou Next.js + Supabase?). Justifique suas escolhas pensando em velocidade de MVP e escalabilidade futura.

AÇÃO 2 - GESTÃO (Via MCP):
1. Verifique se tem acesso ao meu ClickUp.
2. Crie uma nova Lista/Projeto chamado "Projeto MVP".
3. Crie as colunas de status OBRIGATÓRIAS: "Backlog", "In Progress", "To Review", "To Fix", "Done".
4. Traduza as Histórias de Usuário do anexo em TASKS TÉCNICAS no ClickUp. Cada task deve ser pequena e clara.

EXECUTE AGORA.
            </div>
            
            <p>
                Acompanhe a IA criando task por task no seu gerenciador. Quando ela terminar, você terá um plano de batalha pronto.
            </p>
        </section>
    </div>

    <!-- 05 - Execução Detalhado -->
    <div class="page">
        <section>
            <div class="section-header">
                <span class="section-num">05</span>
                <h2 class="section-title">A Fábrica (IDE)</h2>
            </div>
            <p>
                Chegamos ao coração da operação. Saímos do navegador e entramos na IDE (Trae, Cursor, etc). Aqui a mágica acontece, mas ela precisa de regras rígidas para não sair do controle.
            </p>
            <p>
                Você vai configurar um Agente na sua IDE. Diferente do chat do navegador, este agente tem acesso aos seus arquivos locais E ao ClickUp.
            </p>

            <h3>Passo E: O Prompt do "Operário Padrão" (Dev)</h3>
            <p>Cole isso nas "Rules" ou "System Prompt" do seu Agente na IDE. Este prompt ensina a ele ética de trabalho e priorização em ciclo único.</p>
            
            <div class="code-block" style="font-size: 0.8rem;">
IDENTITY:
Você é o Desenvolvedor Full-Stack Sênior deste projeto.

FERRAMENTAS:
Você tem acesso ao Filesystem (para codar) e ao ClickUp (para saber o que fazer).

ALGORITMO DE TRABALHO (Ciclo Único - Execute APENAS UMA vez):

1. CHECK PRIORIDADE 'CRÍTICA' (Status: To Fix):
   - Vá ao ClickUp. Existe algo em 'To Fix'?
   - SIM: PARE TUDO. Isso é um bug ou reprovação. Leia o comentário do Tech Lead. Corrija o arquivo imediatamente. Mova de volta para 'To Review' quando corrigir.

2. CHECK PRIORIDADE 'CONTINUIDADE' (Status: In Progress):
   - Não há nada em 'To Fix'. Existe algo em 'In Progress'?
   - SIM: Significa que você começou e não terminou. Continue essa task.

3. CHECK PRIORIDADE 'NOVA' (Status: Backlog):
   - Não há nada com pendência. Pegue a task DO TOPO do Backlog.
   - Mova ela para 'In Progress' IMEDIATAMENTE (para sinalizar que está trabalhando).
   - Leia a descrição. Crie/Edite os arquivos necessários.

DEFINIÇÃO DE PRONTO (DoD):
- O código roda?
- Seguiu os requisitos?
- Mova a task para 'To Review'.
- Comente: "Pronto para análise. Notas do Dev: [Liste aqui qualquer dificuldade, dúvida técnica ou decisão de design que precise de atenção do Tech Lead]."
- NÃO FAÇA COMMIT NA MAIN AINDA.
- AGUARDE novas instruções.
            </div>
            
            <p>
                Com esse prompt, você só precisa dizer "Trabalhe" no chat da IDE. O Agente vai buscar UMA task, executar e pedir revisão. Ele não deve entrar em loop infinito.
            </p>
        </section>
    </div>

    <!-- 06 - Revisão e Ciclo Final -->
    <div class="page">
        <section>
            <div class="section-header">
                <span class="section-num">06</span>
                <h2 class="section-title">O Guardião (Tech Lead 2)</h2>
            </div>
            <p>
                Aqui está o segredo que separa amadores de profissionais. Amadores confiam cegamente no código da IA. Profissionais revisam.
            </p>
            <p>
                Como você (talvez) não saiba ler código, usaremos a própria IA para revisar a si mesma, mas num papel diferente. Isso quebra o viés de confirmação e garante qualidade.
            </p>

            <h3>Passo F: O Ciclo de Revisão</h3>
            <p>
                Quando o Dev disser "Pronto para análise" e mover a task para <strong>To Review</strong>, você muda de "Persona" na IDE e roda este prompt:
            </p>

            <div class="code-block">
ROLE:
Você agora é o Tech Lead Revisor (Conhecido como "O Chato").

AÇÃO:
1. Olhe o ClickUp, coluna 'To Review'.
2. Para cada task lá:
   - Leia o código que foi alterado nos arquivos.
   - Compare com o que a Task pedia.
   - ANÁLISE DE SEGURANÇA: Há senhas expostas? Há loops infinitos? O código está sujo?

VEREDITO:
- Se estiver RUIM: Mova para 'To Fix'. Escreva um comentário no ClickUp explicando EXATAMENTE o que o Dev deve corrigir.
- Se estiver BOM: Mova para 'Done'. (Opcional: Faça o commit no git: "feat: task X concluída").
            </div>

            <div class="quote-box" style="margin-top: 30px; border-left-color: #000; background: #fff; border: 2px solid #333;">
                <p style="font-weight: 700; margin-bottom: 15px; font-size: 1.1rem;">Conclusão Final: Autonomia e Evolução</p>
                
                <strong style="display:block; margin-bottom:5px;">A Empresa de Uma Pessoa Só</strong>
                <p style="margin-top:0;">
                    Percebeu o que fizemos? Montamos uma empresa inteira dentro do seu computador.
                    Você tem o Visionário (Você/BA), o Tradutor (PO), o Arquiteto, o Operário (Dev) e o Auditor (Revisor).
                    Sua função deixou de ser "escrever código" e passou a ser "gerenciar o fluxo". 
                    Se o Dev erra, o Revisor pega. Se o sistema engasga, o Arquiteto ajusta. 
                    Este ecossistema digital é o que te permite construir como um time de dez.
                </p>

                <strong style="display:block; margin-bottom:5px; margin-top:20px;">A Evolução Contínua</strong>
                <p style="margin-top:0;">
                    Este Blueprint é apenas o seu "Ponto Zero". As tecnologias de IA evoluem semanalmente (novos MCPs, novos modelos, novos agentes).
                    O que te entregamos aqui é uma base sólida e testada. Porém, o verdadeiro poder está em suas mãos para adaptar e evoluir este processo. 
                    Sinta-se livre para criar novos agentes e testar novos fluxos. O limite não é mais técnico; é a sua imaginação.
                </p>
            </div>
        </section>
    </div>

</body>
</html>
    `;
}
