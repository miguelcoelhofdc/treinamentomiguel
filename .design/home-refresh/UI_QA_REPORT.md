# Verificação — Início

## Resultado
- 139 testes existentes passaram, em 19 grupos, sem falhas.
- `npm run typecheck`: passou.
- `npm run build -- --outDir tmp/routines-build/home-refresh`: passou, incluindo o aplicativo instalável.
- Navegador: verificações em Chrome com perfil temporário e dados fictícios; nenhum registro pessoal foi acessado ou modificado.
- Evidência detalhada: [browser-qa.json](browser-qa.json), [contraste](contrast-qa.json) e [script reproduzível](browser-qa.mjs).

## Cenários verificados
| Cenário | Resultado |
|---|---|
| Perfil vazio | Valores ausentes indicados com travessão, zero dias ativos e ação de registrar |
| Celular 390×844 e desktop 1440×1000 | Sem rolagem horizontal, texto cortado ou controles menores que 44 px |
| Larguras 320 e 768 | Quebra de texto e mudança para duas colunas corretas |
| Nome pessoal e atividade longos | Texto quebra sem ultrapassar cartões |
| Final da página móvel | Último treino fica inteiramente acima da navegação |
| Check-in | Falha preserva campos; nova tentativa salva decimais com vírgula e atualiza resumo |
| Painéis | Tema violeta herdado, Escape fecha e foco retorna à ação original |
| Último treino | Detalhes e edição atualizam o resumo, preservando tempo em minutos e segundos |
| Registrar treino | Atalho abre `modo=treino`; corrida detalhada salva e retorna ao Início |
| Análise | Cinco métricas disponíveis; período de sete dias e filtros específicos preservados |
| Carregamento e erro | Esqueleto correspondente e botão de tentar novamente recuperam a página |
| Modo escuro | Página, navegação e check-in com superfícies escuras |
| Acessibilidade | Foco visível, redução de movimento e contraste mínimo de 4,5:1 no texto e nas ações principais |
| Páginas fora do escopo | Estilos computados de Registrar, Perfil e Fichas iguais à referência anterior |

## Método e limites
O roteiro de captura foi adaptado ao acesso por perfil e à preparação de dados fictícios do projeto. A automação aguardou a montagem de cada tela antes de provocar atraso ou falha nas consultas. Não foram adicionadas dependências.

Inspeção visual realizada também nas capturas de celular, desktop, modo escuro, check-in e final da página. A compilação informa uma base Browserslist desatualizada; o aviso não impede a geração e não foi tratado nesta mudança de interface.
