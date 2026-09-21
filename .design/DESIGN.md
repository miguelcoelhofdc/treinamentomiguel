# DESIGN

## Product Type

- Type: data dashboard + settings form.
- Main object: venda mensal e seus valores de meta/comissão.
- Recipe: `data-dashboard`.
- Patterns: KPI chart grid, settings form, complete states.

## Design Goals

- Tornar impossível confundir o valor que conta para a meta com o valor remunerado.
- Explicar a composição da comissão sem esconder o bônus semanal.
- Fazer a inicialização mensal exigir poucos passos e nunca propagar alterações retroativamente.

## Screen Structure

- Header: mês, configuração e nova venda.
- KPI layer: MRR de meta, objetivo, restante, MRR comissão, setup e comissão prevista.
- Explanation layer: gráfico diário, composição da comissão e quatro períodos semanais.
- Detail layer: tabela no desktop e cartões no mobile.
- Settings drawer: inicialização, valores mensais e três faixas fixas.
- Confirmation: edição histórica e exclusão de venda.

## State and Responsive Plan

- Unconfigured month: valores registrados aparecem, cálculos ficam “Pendentes” e CTA configura o mês.
- New month with predecessor: choice between repeat and change; goal remains blank.
- Legacy config: calculation stays legacy until an explicitly confirmed save.
- Desktop: existing sidebar and two-column analytical layout.
- Mobile: single-column cards, compact actions and sales cards instead of table.
- No external UI dependency or copied source; existing tokens remain authoritative.
