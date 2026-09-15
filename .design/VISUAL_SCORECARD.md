# VISUAL SCORECARD

Average score below 4 means the UI is not ready for delivery.

## Score Summary

- Product type: CRM / customer operations com painel comercial.
- Recipe: `recipes/crm-customer-ops.md`.
- Patterns: `crm/customer-list-detail`, `dashboard/tremor-kpi-chart-grid`, `states/loading-empty-error-set`.
- Desktop screenshot: `screenshots/after-desktop.png`.
- Mobile screenshot: `screenshots/after-mobile.png`.
- Reviewer: Codex, com inspeção visual das capturas e QA mecânico do kit.
- Date: 2026-09-14.
- Average score: 4.25.
- Delivery decision: Pass.

## 1-5 Scoring Rubric

| Score | Meaning |
|---:|---|
| 1 | Broken, prototype-like, or misleading |
| 2 | Functional but rough, weak hierarchy, incomplete states |
| 3 | Acceptable baseline, still visibly generic or uneven |
| 4 | Product-grade, clear, consistent, usable |
| 5 | Excellent, polished, domain-fit, resilient across states |

## Score Table

| Dimension | Score 1-5 | Evidence | Must Fix If Below 4 |
|---|---:|---|---|
| 产品真实感 | 4 | Superfícies sóbrias, densidade adequada e linguagem de operação comercial | — |
| 信息层级 | 5 | Meta → indicadores → evolução/comissão → registros fica clara na primeira leitura | — |
| 操作路径 | 5 | Período, configuração e nova venda permanecem juntos; exclusão continua isolada | — |
| 组件一致性 | 4 | Botões, inputs, cards, drawers e modais usam raios e bordas coerentes | — |
| 数据密度 | 4 | Métricas secundárias foram consolidadas sem perda de informação | — |
| 状态完整度 | 4 | Loading, empty, error, disabled, hover e selected permanecem cobertos | — |
| 移动端质量 | 4 | 390 px sem overflow, texto estourado ou alvo pequeno; primeira dobra mais compacta | — |
| 代码可维护性 | 4 | Stack e componentes existentes preservados; alterações restritas a classes visuais | — |

## Required Fixes Before Delivery

- [x] Resolver recarga de otimização do Vite e repetir o QA em servidor limpo.
- [x] Confirmar ausência de overflow e de alvos pequenos no mobile.
- [x] Confirmar que nenhuma dependência visual ou novo componente de produto foi introduzido.

## Human Review Gate

- [x] Customer data / sensitive data reviewed: capturas usam banco temporário vazio.
- [x] Permissions and roles reviewed: não se aplicam a esta tela.
- [x] Bulk send / export / writeback reviewed: inexistentes.
- [x] External links, dates, recipients and final copy reviewed: sem novas ações externas ou textos.
- [x] Delete / irreversible actions reviewed: confirmação existente preservada e não executada no QA.
- [x] Secrets, API keys and internal links reviewed: ausentes das capturas e dos artefatos.

## Decision

- Average score: 4.25.
- Pass threshold met: Yes.
- If no, next repair target: não se aplica.
