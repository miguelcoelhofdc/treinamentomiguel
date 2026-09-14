# DESIGN

## Product Type

- Type: CRM / customer operations com painel de dados comercial.
- Main business object: venda mensal.
- Selected recipe: `recipes/crm-customer-ops.md`.
- Reference files: CRM reference, UI audit, visual QA, product risk, mobile e customer data safety.
- Selected patterns: CRM customer list detail, Tremor KPI chart grid e loading/empty/error set.
- User role: responsável comercial.
- Primary task: entender resultado e comissão do mês e gerenciar os registros de venda.

## Pattern Commitments

| Pattern | Where It Applies | What To Imitate | What Not To Copy |
|---|---|---|---|
| CRM customer list detail | Registros de vendas e ações | Densidade, escaneabilidade e isolamento da exclusão | Filtros, painel de cliente, tags ou novas informações |
| Tremor KPI chart grid | Resumo, indicadores, gráfico e comissão | Ordem analítica e tratamento tabular dos números | Métricas, gráficos ou dependências adicionais |
| Loading/empty/error set | Skeletons, vazios, erros e disabled | Estados compactos e contextualizados | Nova lógica ou novos fluxos |

## Design Goals

- Tornar a primeira dobra mais rápida de ler com menos containers concorrentes.
- Unificar tipografia, espaçamentos, controles, bordas e raios em um sistema discreto.
- Melhorar densidade e alinhamento em desktop e mobile sem mudar conteúdo ou ordem funcional.

## Screen Structure

- Navigation: mesma sidebar e mesmos três destinos; acabamento claro com ativo suave.
- Main content: mesmo cabeçalho, mesmo seletor de mês e mesmas ações.
- Secondary panel / details: mesmos blocos de gráfico, comissão, drawer e modal.
- Primary action: `Nova venda`, preservada em verde sólido.
- Risk / confirmation area: modal de exclusão preservado com vermelho apenas na ação destrutiva.

## Component Plan

| Component | Purpose | Desktop Behavior | Mobile Behavior |
|---|---|---|---|
| Sidebar | Navegação e informação de armazenamento | 216 px, clara, borda fina | Continua substituída pela identificação compacta atual |
| Header controls | Período e ações | Uma linha, alturas e raios uniformes | Mesma grade atual, espaçamento menor |
| Goal summary | Resultado, meta e progresso | Card principal sem decoração | Métricas em três colunas compactas |
| Secondary metrics | Comissão, setup e faturamento | Uma única superfície com divisores | Uma única superfície em sequência |
| Chart / commission | Explicação do resultado | Duas colunas existentes | Coluna única existente |
| Sales records | Detalhe operacional | Tabela compacta | Cartões/lista já existentes, com raios menores |
| Forms / dialogs | Entrada e confirmação | Drawer/modal atuais | Bottom sheet atual, visual simplificado |

## State Plan

- Loading: ajustar skeleton para os novos raios e fundo.
- Empty: manter textos e CTAs, reduzir altura e decoração.
- Error: manter mensagem e retry, simplificar container.
- Disabled: manter a lógica e reforçar aparência apenas com opacidade existente.
- Hover: manter feedback sutil sem animação nova.
- Selected: sidebar ativa com fundo verde muito claro e indicador discreto.
- Needs human review: confirmação de exclusão permanece obrigatória.

## Visual System

- Typography: fonte de sistema apenas dentro de `.goals-shell`; títulos 20–32 px, números 16–38 px, auxiliares 11–14 px.
- Color: canvas neutro `#f6f7f6`, superfícies brancas, texto `#18221e`, verde `#246348` somente para ação/estado.
- Spacing: ritmo 8/12/16/24/32 px.
- Radius / shadow / border: 10–16 px, borda `#dfe4e1`, sem sombra em cards; sombras apenas em drawer/modal.
- Density: mais compacta, preservando áreas de toque de 44 px.

## Responsive Plan

- Desktop viewport: 1440 × 1000.
- Mobile viewport: 390 × 844.
- Expected mobile layout: coluna única, seletor de mês e ações em grade, resumo compacto, demais blocos na ordem atual.
- Overflow prevention: manter tabela apenas a partir de `md` e lista mobile abaixo disso; valores com `break-words` e `tabular-nums`.

## Safety Plan

- Customer data: capturar apenas perfil temporário vazio.
- Permissions: fora do escopo.
- Secrets: não incluir em código ou relatório.
- Bulk send / export / writeback: inexistentes.
- External links: inexistentes.
- Human confirmation: preservar e verificar visualmente o modal de exclusão sem executar a ação.

## Implementation Notes

- Files to edit: `src/pages/Goals.tsx`, `src/components/goals/SalesChart.tsx`, `src/components/goals/SaleForm.tsx`, `src/components/goals/CommissionSettingsForm.tsx`, `src/index.css` apenas em seletores `.goals-*`.
- Files to avoid: banco de dados, API, tipos, cálculos, autenticação, navegação global e dependências.
- Existing design patterns to preserve: fluxo por seções, drawer de configuração, modal de venda, confirmação de exclusão, tabela desktop e lista mobile.
- Pattern files to keep open while editing: os três padrões selecionados e seus source maps/code notes.
- License / source constraints: usar somente princípios estruturais; nenhum código de Tremor, shadcn ou outra fonte será copiado.
