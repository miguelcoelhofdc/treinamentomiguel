# PATTERN MATCH

## Summary

- Product type: CRM / customer operations com painel de desempenho comercial.
- Main business object: venda mensal e sua contribuição para meta e comissão.
- Selected recipe: `recipes/crm-customer-ops.md`.
- Selected patterns: `crm/customer-list-detail`, `dashboard/tremor-kpi-chart-grid`, `states/loading-empty-error-set`.
- Patterns deliberately not selected: app shells completos, tabela facetada, settings page e micro-interações. A tela já tem navegação, não possui filtros complexos e não deve ganhar novas funções.

## Product Type Decision

| Signal | Evidence | Decision Impact |
|---|---|---|
| User role | Pessoa responsável por acompanhar vendas e comissão | Priorizar leitura rápida, densidade operacional e ações explícitas |
| Primary task | Entender resultado do mês e registrar ou revisar vendas | Meta e evolução primeiro; registros logo depois |
| Data object | Venda com data, e-mail, plano e setup | Preservar campos e tornar linhas mais escaneáveis |
| Risk level | Exibe e-mail e possui exclusão local com confirmação | Não capturar dados reais; manter ação destrutiva isolada e confirmada |
| Mobile need | Layout já possui tabela convertida em cartões | Preservar o fluxo e reduzir altura/fragmentação dos blocos |

## Recipe Selection

- Recipe: CRM Customer Ops.
- Why this recipe: a tela é uma operação comercial recorrente centrada em registros de venda e identificação do cliente por e-mail.
- References to read: `references/crm-customer-ops-ui.md` e `samples/SAMPLE_QUALITY_REPORT.md`.
- Checklists to read: UI audit, visual QA, product risk, mobile responsive e customer data safety.

## Pattern Selection

| Pattern | Role In This Redesign | Why Selected | What To Imitate | What Not To Copy |
|---|---|---|---|---|
| `crm/customer-list-detail` | Main | Ajuda a tratar vendas como registros operacionais, com identificação e ações claras | Densidade, ordem consistente de campos, ações secundárias e destrutivas separadas | Painel de detalhe, filtros, tags ou dados de cliente inexistentes |
| `dashboard/tremor-kpi-chart-grid` | Secondary | O painel precisa responder desempenho, motivo e detalhe na mesma sequência | Hierarquia KPI → tendência → registros, números tabulares e cores semânticas contidas | Novos KPIs, métricas de exemplo, dependências ou paletas aleatórias |
| `states/loading-empty-error-set` | State | A tela já cobre loading, vazio, erro, hover e disabled | Estados compactos, próximos do contexto e com ação clara | Novos estados ou mudanças de regra de negócio |

## Business Object Mapping

| Target Project Object | Pattern Object | Fields / Components To Map | Notes |
|---|---|---|---|
| Venda mensal | Registro de cliente/oportunidade | data, e-mail, plano, setup, editar, excluir | Manter todos os campos e ações atuais |
| Resumo de meta | KPI comercial | total, meta, falta, atingimento, quantidade | Não inventar comparações ou indicadores |
| Comissão | Breakdown operacional | faixa, percentuais e valores | Manter cálculo e textos existentes |

## State Coverage From Patterns

- Loading: skeleton de página, sem alterar carregamento.
- Empty: gráfico e lista explicam o estado e oferecem a ação já existente.
- Error: alerta contextual com nova tentativa permanece.
- Disabled: botões de formulários permanecem desabilitados durante salvamento.
- Hover: feedback discreto em botões, navegação e linhas.
- Selected: navegação ativa preservada.
- Needs human review: exclusão continua exigindo confirmação; nenhuma ação externa existe.

## License And Source Risk

| Pattern | Source | License | Risk / Required Action |
|---|---|---|---|
| CRM list detail | Padrão composto do kit + referência shadcn | Documentação local / MIT | Usar apenas estrutura; não copiar dados ou código externo |
| KPI chart grid | Tremor + shadcn charts | Apache-2.0 / MIT | Usar apenas princípios; manter Recharts atual |
| State set | Padrão interno + shadcn | Documentação local / MIT | Adaptar ao estilo existente, sem importar primitivas |

## Human Confirmation Required

- [x] Customer data: screenshots de QA usam o banco local vazio do perfil temporário.
- [x] Permissions: não há controles de permissão nesta tela.
- [x] Bulk send / export / writeback: não existem.
- [x] External links: não existem.
- [x] Delete / irreversible actions: confirmação existente será preservada; nenhuma exclusão será executada no QA.
- [x] Secrets / API keys / internal links: não existem no painel.
- [x] Final copy / dates / recipients: textos e campos existentes serão preservados.

## Decision

- Proceed with selected patterns: sim.
- Need more source verification: não; os arquivos de padrão e source maps foram verificados.
- Must avoid: novos componentes de produto, novos dados, dependências, mudanças de cálculo, gradientes, glassmorphism, decoração e animação adicional.
