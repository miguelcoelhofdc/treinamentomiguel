# Avaliação visual — diário de treino

## Resultado

- Produto: acompanhamento pessoal de treino e bem-estar.
- Receita: `data-dashboard`.
- Padrões: `dashboard/tremor-kpi-chart-grid` e `states/loading-empty-error-set`.
- Capturas principais: [computador](screenshots/after-desktop.png) e [celular](screenshots/after-mobile.png).
- Avaliador: Codex, por inspeção visual das capturas; esta nota não representa aprovação humana.
- Data: 2026-10-05.
- Média: **4,5/5**. Critério mínimo de 4/5 atendido.

## Notas de 1 a 5

| Dimensão | Nota | Evidência |
|---|---:|---|
| Adequação ao produto | 4 | A tela privilegia registros reais, evolução e último treino. Rotinas sugeridas e coaching saíram do fluxo principal. |
| Hierarquia da informação | 5 | Registrar tem destaque; resumo, um gráfico e último treino têm ordem clara. Seletor de métrica evita vários gráficos competindo. |
| Caminho das ações | 4 | Treino e check-in têm entradas próprias; edição parte do histórico ou último treino; fichas ficam no Perfil. |
| Consistência dos componentes | 5 | Outfit, ícones arredondados, bordas, espaçamento e base dos botões se repetem nas telas. Verde usa texto escuro. |
| Densidade de informação | 4 | Resumo compacto e detalhes de séries expansíveis. Em telas pequenas, o último treino e check-in exigem rolagem vertical. |
| Cobertura de estados | 5 | Carregamento, vazio, erro com tentativa novamente, formulário preservado após falha, confirmação e offline verificados. |
| Qualidade no celular | 5 | Navegação inferior com quatro destinos; controles de pelo menos 44 px; sem rolagem horizontal ou texto cortado em 320 e 390 px. |
| Manutenção | 4 | Regras, transações, backup, consultas e componentes separados. Stack existente preservada; estilos de acompanhamento delimitados. |

## Ajustes feitos na revisão

- Corrigida a navegação inferior para quatro colunas.
- Aumentados os controles de métrica da corrida para 44 px.
- Reduzida a altura do resumo e do gráfico no celular.
- Nome do treino movido para uma área expansível, aproximando os exercícios do início do formulário.
- Tabela de valores do gráfico mantida para acessibilidade sem competir visualmente com o gráfico.
- Respeitada a preferência existente de tema escuro e movimento reduzido.

## Escopo da revisão

As capturas usam dados fictícios em um perfil descartável. Os cenários de migração, importação e edição foram executados em bancos de teste, sem acessar os registros pessoais do usuário. Não há correções visuais pendentes abaixo do critério mínimo.
