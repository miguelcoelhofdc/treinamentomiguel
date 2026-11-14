# Design — Padrão visual do Meu ritmo

## Sistema
Estender o Início: fundo #F4F4F6, branco #FFFFFF, violeta #655CF2 e texto #292933. Fonte Outfit existente; títulos 26–30 px; seções 16–18 px; corpo 14–16 px. Cartões com raio 20–24 px, borda fina e sem brilhos. Estados sem animações decorativas.

## Arquitetura
- Tema comum `app-theme` em todas as rotas de saúde e no acesso; manter `home-theme` no Início para sua composição específica.
- Extrair tokens, controles e navegação de `home.css` para `app-theme.css`, importado depois dos estilos antigos e antes do Início.
- Tratar portais, gráficos, listas, formulários e preferências pelo mesmo tema. Preservar os estilos e estados semânticos de erro e ações permanentes.
- Adicionar classes de página apenas para limitar largura e organizar os respectivos conteúdos. Sem APIs, modelos de dados, rotas ou dependências novos.

## Composição
- Registrar: largura confortável para formulário; cartões brancos e opções com seleção violeta.
- Análise: filtros juntos, gráfico branco e listas de registros leves.
- Perfil: resumo branco, grupos em cartões e navegação lateral no desktop; grupos expansíveis no celular.
- Rotinas e Fichas: listas de cartões, controles consistentes, uma coluna no celular.
- Guias: cartões expansíveis com conteúdo organizado internamente.
- Acesso: formulário centralizado em cartão branco, mantendo a autenticação.
- Desktop: navegação lateral atual; celular/tablet: barra branca com rótulos e área inferior reservada.

## Validação
Comparar o Início antes/depois, capturar todas as páginas em desktop e celular, testar 320 px e tablet, salvar registros/fichas/hábitos/perfil em dados fictícios, filtros da Análise, detalhes, preferências, modo escuro, carregamento, erro, seleção e teclado. Executar testes, tipos e compilação. O quadro e o painel comercial não recebem o tema de saúde.
