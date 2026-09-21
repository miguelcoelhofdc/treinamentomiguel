# PATTERN MATCH

## Summary

- Product type: painel de dados comerciais com configuração mensal.
- Main business object: venda, atingimento de meta e comissão.
- Selected recipe: `recipes/data-dashboard.md`.
- Selected patterns: `dashboard/tremor-kpi-chart-grid`, `settings/settings-form-page` e `states/loading-empty-error-set`.
- Not selected: tabela facetada, porque não há busca, filtros ou ações em lote.

## Pattern Selection

| Pattern | Role | Why | Adopted | Avoided |
|---|---|---|---|---|
| Tremor KPI chart grid | Main | Meta, comissão e evolução precisam ser lidas em sequência | KPI com contexto, gráfico e detalhamento | Dependência ou identidade visual externa |
| Settings form page | Secondary | Regras mensais exigem validação e estados de salvamento | Seções, ajuda por campo, salvar visível | Navegação de configurações desnecessária |
| Loading/empty/error set | State | Há nuvem, cache, mês vazio e configuração pendente | Estados acionáveis e próximos à origem | Alertas genéricos sem ação |

## Business Mapping

| Project object | Pattern object | Mapping |
|---|---|---|
| Meta mensal | KPI/threshold | Realizado farol, objetivo, percentual e restante |
| Comissão | KPI breakdown | MRR, setup, bônus semanal e total |
| Venda | Detail record | Cliente, data, farol, comissão, setup e ações |
| Configuração mensal | Settings section | Meta, percentuais fixos e bônus |

## State and Risk Coverage

- Loading: skeleton do painel existente.
- Empty: primeira venda com ação direta.
- Error/offline: alerta e tentativa de sincronização.
- Pending: vendas continuam visíveis sem uma configuração mensal.
- Historical edit: confirmação explícita antes de recalcular um mês passado.
- Customer data: capturas de QA não contêm nomes ou e-mails reais.
- Delete: confirmação existente preservada.

## License and Decision

- Tremor (Apache-2.0) e shadcn (MIT) foram usados apenas como referência estrutural.
- Nenhum componente ou código externo foi copiado; a implementação preserva React, Tailwind e Recharts existentes.
- Proceed: yes.
