# UI AUDIT

## Summary

- Product type: CRM / customer operations com data dashboard secundário.
- User role: responsável comercial que acompanha meta, comissão e registros do mês.
- Primary task: avaliar o resultado mensal e registrar, editar ou excluir uma venda.
- Current UI quality: funcional, responsiva e completa, mas visualmente fragmentada e mais ornamental do que o necessário para uso operacional.

## Findings

| Priority | Area | Issue | Evidence | Recommended Fix |
|---|---|---|---|---|
| P1 | Hierarquia | Meta, comissão e métricas secundárias competem como cards autônomos | Card principal grande, card escuro e dois cards claros empilhados | Manter o grid, mas agrupar métricas secundárias em uma única superfície discreta |
| P1 | Mobile | O resumo ocupa altura excessiva antes do conteúdo operacional | Card principal com três blocos em duas linhas e decoração de 160 px | Compactar tipografia, métricas e espaçamentos sem remover informações |
| P1 | Tipografia | Muitas legendas em 9–10 px, caixa alta e tracking amplo reduzem leitura | Navegação, KPIs, títulos de seção e tabela repetem o mesmo tratamento | Limitar caixa alta a rótulos curtos e elevar auxiliares essenciais para 11–12 px |
| P2 | Superfícies | Raios de 20–28 px e sombras em quase todo bloco deixam aspecto de protótipo | Resumo, gráfico, comissão, tabela, modais e formulários | Adotar raios 10–16 px, borda neutra e sombra apenas em sobreposições |
| P2 | Navegação | Sidebar muito escura concentra contraste fora do conteúdo principal | Área de 228 px em verde quase preto | Usar sidebar clara, borda e destaque ativo suave mantendo posições e ações |
| P2 | Cor | Verde aparece em fundos, ícones, botões, badge e decoração simultaneamente | Vários tons próximos na primeira dobra | Reservar verde ao CTA, progresso, estado ativo e valores-chave |

## Information Architecture

- Current structure: navegação lateral, cabeçalho com período e ações, resumo de meta, três métricas, gráfico, comissão e registros.
- Missing structure: nenhuma informação está ausente.
- Suggested structure: preservar exatamente essa ordem, reforçando a sequência meta → indicadores → tendência/comissão → registros.

## Component Review

- Navigation: rotas por rolagem e drawer de configuração são claras; apenas o contraste visual precisa ser reduzido.
- Tables / lists / cards: todos os campos estão presentes; a densidade desktop é boa, mas a quantidade de containers pesa.
- Forms / inputs: labels, erros e estados existem; raios e espaçamentos podem ficar mais consistentes.
- Buttons / actions: ação primária está clara; secundária e destrutiva já estão separadas.
- Status indicators: progresso, vazio e erro têm semântica adequada; manter.

## Visual Review

- Typography: boa distinção entre títulos e números, porém com excesso de microtexto em caixa alta e tracking.
- Color: paleta coerente, mas verde e bloco escuro estão presentes em elementos demais.
- Spacing: gaps 20–28 px predominam e criam muita altura no mobile.
- Borders / shadows / radius: bordas são suaves, porém raios e sombras são grandes e repetitivos.
- Density: desktop aceitável; mobile disperso na primeira dobra.

## State Coverage

- Loading: presente com skeleton.
- Empty: presente para gráfico e vendas, com ação contextual.
- Error: presente com retry para carga e alerta de ação.
- Disabled: presente durante salvamento de formulários.
- Hover: presente em navegação, botões e linhas.
- Selected: presente na navegação lateral.

## Mobile Review

- Layout: sem overflow e com fluxo em coluna.
- Text overflow: nenhum candidato na auditoria mecânica.
- Button size: nenhum alvo pequeno detectado; manter mínimo de 44 px nas ações principais.
- Horizontal scroll: ausente na viewport 390 px.
- Fixed bars / safe area: drawers e modais se ajustam ao viewport; manter.

## Risk Review

- Customer data: a lista pode exibir e-mails reais; QA deve permanecer em perfil temporário vazio.
- Permissions: não se aplicam.
- Secrets: não encontrados.
- Bulk send / export / writeback: inexistentes.
- External links: inexistentes.
- Human confirmation needed: manter confirmação existente para exclusão; não disparar exclusões durante a revisão visual.

## Decision

- Proceed with redesign: sim, como refinamento visual restrito.
- Must fix before delivery: fragmentação de cards, densidade mobile e consistência de tipografia/radius.
- Optional follow-up: nenhum; melhorias funcionais estão fora do escopo.
