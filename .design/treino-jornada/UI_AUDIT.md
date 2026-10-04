# Auditoria — Jornada de treino

## Base inspecionada

O aplicativo tinha treino diário, consulta de plano de 26 semanas, gráficos, check-in detalhado, dois bancos separados e configuração de PWA. A abertura priorizava a sessão; constância e metas não formavam uma jornada. As semanas da consulta começavam visualmente na segunda-feira mesmo quando o ciclo começava em outra data. A identidade do treinamento era predominantemente neutra.

A avaliação inicial veio da leitura do código. Não há captura anterior do treinamento nesta pasta; as capturas antigas da pasta superior pertencem ao painel comercial e foram preservadas.

## Resultado

- A abertura mostra sequência, presença recente, check-in, meta semanal, treino e trilha.
- Etapas usam datas reais do ciclo; a semana corrente abre por padrão e as outras 25 podem ser consultadas.
- O check-in rápido exige energia e preserva os campos anteriores. Conclusão e desfazer treino preservam a presença.
- Metas têm edição centralizada em painéis, com validação por unidade, inclusive metas qualitativas.
- Estilos ficam sob `training-theme`; `/metas` e `/quadro` mantêm a estrutura existente.
- Botões, campos, foco, tema escuro, área segura e espaço do teclado foram revisados.
- Os painéis usam portal para não ficarem presos à animação da página nem abaixo da navegação.

## Estados

| Estado | Comportamento |
|---|---|
| Carregamento | Esqueleto e indicadores sem valores inventados |
| Primeiro uso | Sequência zero, metas do perfil e orientação para o primeiro registro |
| Erro de leitura | Mensagem, nova tentativa e navegação disponível |
| Erro de gravação | Confirmação preservada até a gravação; erro perto do formulário |
| Pendente | Check-in de hoje e sessão atual separados |
| Futuro/passado | Prescrição disponível e status explícito |
| Meta alcançada | Feedback calculado a partir do registro e objetivo |
| Ciclo antes/depois | Data de início ou resumo das sessões realmente entregues |

Não houve acesso ao histórico real em QA, envio externo, exportação de dados reais, mudança de permissão ou exclusão de dados do usuário.
