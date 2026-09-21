# UI AUDIT

## Summary

- Product type: dashboard comercial operacional.
- User role: pessoa que registra vendas e acompanha remuneração.
- Primary task: saber quanto conta para a meta, quanto gera comissão e quais semanas atingiram bônus.
- Current base: consistente e responsiva, mas o mesmo valor alimentava meta e comissão e não havia leitura semanal.

## Findings

| Priority | Area | Issue | Fix |
|---|---|---|---|
| P0 | Data meaning | “Plano” misturava farol e valor real | Separar MRR farol e MRR comissão em formulário, KPIs, gráfico e registros |
| P0 | Calculation | Bônus semanal não existia | Mostrar quatro períodos, atingimento e bônus individual |
| P1 | Settings | Faixas livres permitiam regras incompatíveis | Fixar três intervalos e editar somente percentuais |
| P1 | Monthly state | Mês novo não orientava repetição | Criar escolha repetir/alterar e deixar meta exclusiva do mês |
| P1 | History | Edição antiga não alertava recálculo | Exigir confirmação para mês passado |

## Component and Mobile Review

- Dashboard: meta primeiro, KPIs reais ao lado, cálculo e semanas antes dos registros.
- Forms: labels, explicações, validação e estados saving/saved presentes.
- Table: colunas distintas para farol, comissão e setup; cartões equivalentes no mobile.
- Mobile: ações com 44px, conteúdo em uma coluna e sem rolagem horizontal.
- Risk: e-mails de clientes permanecem apenas na aplicação; screenshots de QA usam estado vazio.

## Decision

- Proceed with the existing restrained visual system and add semantic separation without a broad redesign.
