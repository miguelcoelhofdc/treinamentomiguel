# Design — Treino e saúde
## Estrutura
Início, Treino, Evolução, Guias e Perfil. Barra inferior abaixo de 1024 px; menu lateral de 208 px acima.
Home: check-in, sessão, meta compacta e presença. Evolução: Resumo, Saúde, Histórico e Metas, com seleção na URL.
Rotina mantém consulta por datas. Guias abre um assunto por vez. Perfil abre um grupo de preferências por vez.
## Padrões e componentes
mobile-app/notes-workbench, settings/settings-form-page e states/loading-empty-error-set.
Cabeçalho, abas acessíveis, listas abertas, expansões e painéis compartilham o vocabulário visual.
BottomSheet unifica foco preso, Escape, retorno de foco, área segura e ajuste ao teclado.
## Visual
Fundo #F7F9F7, ação #327355, texto #18221E e apoio #617068. Verde tem função; âmbar e vermelho indicam atenção e erro.
Outfit 400/500/600. Texto 28/20/16/13 px. Controles 12 px, superfícies 16 px, painéis 20 px.
Sem relevo, trilha ornamental, cores por fase ou cards aninhados. Tema escuro conserva a hierarquia.
## Estado e compatibilidade
Regras, cálculos, duas bases por perfil, schema, backup e cache offline preservados.
Não há APIs novas nem migração. Parâmetro aba em /progresso: resumo, saude, historico, metas.
Prescrições e avisos continuam acessíveis; dados ausentes não são convertidos em medidas fictícias.
## QA
375, 390, 430, 768, 1024 e 1440 px. Dois perfis e temas. Flows de check-in, registro, conclusão/desfazer, metas, backup, rotina e 3D.
Capturas com dados sintéticos; verificação de tipos, testes e build; scorecard mínimo 4/5.
