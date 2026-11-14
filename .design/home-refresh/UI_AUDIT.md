# UI audit — Início

## Situação
O Início atual usa fundo com degradês verdes, sombras marcadas, animações de entrada, duas ações de peso semelhante e gráficos entre calendário e último treino. No desktop o conteúdo fica limitado a uma coluna de 560 px.

| Prioridade | Problema | Correção |
|---|---|---|
| P1 | Gráficos alongam a página de captura rápida | Disponibilizar a visão geral na Análise |
| P1 | Paleta e efeitos divergem da referência | Tema violeta e superfícies neutras isolados na rota `/` |
| P1 | Navegação móvel preta tem peso visual alto | Barra branca, rótulos visíveis e seleção violeta |
| P2 | Último treino expõe séries e cargas longas | Linha de resumo com detalhes no painel existente |
| P2 | Desktop mantém uma coluna estreita | Duas colunas a partir de 768 px |

## Estados e riscos
- Manter carregamento, recuperação de erro, vazio, feedback de salvamento, controles desabilitados e indicação de seleção.
- Verificar largura de 320 px, nomes longos, áreas de toque, foco, contraste e segurança da navegação fixa.
- Os painéis usam portal dentro do app; o tema deve envolver também `training-overlays`.
- Preservar as edições locais de `src/tracking.css`. Não alterar armazenamento, dados reais, autenticação, permissões, exportações ou páginas comerciais.
- As verificações de navegador usarão perfil descartável e dados fictícios.

