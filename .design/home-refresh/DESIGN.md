# Design — Início

## Estrutura e padrões
Aplicativo pessoal de saúde. Receita mobile-notes-app; padrões notes-workbench e loading-empty-error-set, aplicados a captura rápida, navegação, painéis de detalhe e estados recuperáveis.

1. Cabeçalho com saudação e avatar.
2. Cartão violeta com ação branca de registrar treino; check-in branco secundário.
3. Resumo de peso, sono e atividade, preservando os cálculos existentes.
4. Calendário semanal e último treino compacto, com acesso à Análise.

## Sistema visual
- Fundo #F4F4F6; superfícies #FFFFFF; violeta #655CF2; texto #292933; texto secundário #686875.
- Outfit existente; títulos 26–30 px; corpo 14–16 px; metadados 12–13 px.
- Cartões com raio 20–24 px, bordas discretas, sem degradês ou brilhos; animações limitadas a feedback de interação.
- Celular: 20 px nas laterais, uma coluna, navegação branca com quatro rótulos, espaço inferior reservado.
- A partir de 768 px: ações em duas colunas, calendário e último treino lado a lado. Desktop com navegação lateral existente e conteúdo até 1120 px.
- Modo escuro com neutros escuros e violeta. Área de toque de 44 px e foco visível.

## Implementação e estados
- TrackingHome mantém useTracking, cálculos e formulários; novos nomes de classe evitam herdar efeitos antigos.
- App aplica `home-theme` somente na rota inicial, inclusive aos portais e navegação; estilos em folha própria importada por último.
- Análise ganha HomeTrends na visão geral, com o período já selecionado; filtros específicos preservados.
- Esqueletos correspondem à nova estrutura. Vazio oferece registrar; erro oferece tentar novamente. Atualizações continuam pelo IndexedDB e liveQuery existentes.
- Sem bibliotecas, APIs, tipos públicos, migrações, mudanças de permissões ou conteúdo externo novos.

## Verificação
Capturas 390×844 e 1440×1000; larguras 320 e 768; vazio, dados, nome longo, erro, carregamento, escuro, foco e redução de movimento. Exercitar os formulários existentes e comparar páginas fora do escopo antes/depois em navegador descartável. Executar testes, typecheck e build.
