# Auditoria de interface — coaching

## Contexto e problemas resolvidos

Miguel e Cíntia precisam entrar e identificar o treino adequado ao objetivo, tempo e condições disponíveis. A grade anterior dependia de ajustes separados de meta e treino.

| Prioridade | Problema | Solução implementada |
|---|---|---|
| P1 | Objetivo e disponibilidade espalhados | Uma configuração guiada em quatro etapas |
| P1 | A grade fixa não representa a disponibilidade escolhida | Um motor compartilhado por Início, Treino, Rotina e Evolução |
| P1 | Nível sozinho recalcula exercícios | Prescrição recebida pela sessão e preservada após o início |
| P1 | Resultado e execução podem ser confundidos | Adesão ao calendário separada da meta numérica |
| P2 | Calendário sem orientação de futuro | Semana e mês identificam previsões sujeitas a ajustes |
| P2 | Feedback exige decisões técnicas | Opções fácil, adequado e pesado, todas opcionais |

## Hierarquia, componentes e aparência

O Início começa com “O que fazer hoje”, tempo estimado, sequência curta e “Começar treino”. Check-in, semana e indicadores vêm depois. Rotina oferece semana/mês e detalhe dos blocos. Formulário mostra uma decisão por etapa e uma prévia antes de salvar.

Foram preservados Outfit, paleta verde, superfícies e raios do aplicativo. As listas de blocos usam os cartões existentes; o calendário evita cartões aninhados. No desktop o conteúdo continua legível na coluna central, com a navegação existente. No celular os controles se empilham e as ações principais ocupam a largura disponível.

## Estados e acessibilidade

- Carregamento e erro com nova tentativa para o plano.
- Recuperação com motivo e próxima sessão; modo antigo sem coaching continua disponível.
- Campos inválidos bloqueiam gravação e mostram erro visível.
- Estado selecionado, hover e foco seguem as classes do aplicativo.
- Botões desabilitados durante gravação; etapas levam o foco ao novo título.
- Folha de conclusão mantém foco de teclado e aceita fechamento.
- Sessão iniciada explica que alterações valem para as próximas sessões.
- Meta atingida ou vencida oferece revisão sem aumentar a cobrança.

## Celular e riscos

Verificados 375, 390, 430, 768, 1024 e 1440 px, em ambos os temas: sem rolagem horizontal ou ações habilitadas abaixo de 44 px na matriz testada. Espaçamento inferior preserva acesso ao conteúdo junto à navegação fixa. Calendário tem sete colunas compactas e detalhe expansível.

Os bancos dos dois perfis continuam separados. Backups incluem as prescrições e validam o conteúdo antes de gravar; aceitam versões antigas. As verificações usaram dados sintéticos e nenhum serviço externo. Não há novos fluxos de envio, compartilhamento ou permissões.

Pendências fora desta versão: CrossFit, agilidade, cadastro de novos usuários e chat com IA.
