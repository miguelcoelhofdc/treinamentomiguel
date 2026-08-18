import type { Exercise, Plan, RunningWeek } from '@/types'

const baseIntervals = [
  '5 min de caminhada leve; 8 ciclos de 1 min de trote confortável + 1 min de caminhada; finalize caminhando até completar 30 min.',
  '5 min de caminhada leve; 8 ciclos de 1 min 15 s de trote + 1 min 15 s de caminhada; 5 min leves no final.',
  '5 min de caminhada leve; 8 ciclos de 1 min 30 s de trote + 1 min 30 s de caminhada; 3 min leves no final.',
  'Semana leve: 5 min de caminhada; 6 ciclos de 1 min de trote + 2 min de caminhada; 5 min leves no final.',
  '5 min de caminhada; 8 ciclos de 2 min de trote + 1 min de caminhada; 5 min leves no final.',
  '5 min de caminhada; 7 ciclos de 2 min 30 s de trote + 1 min 30 s de caminhada; finalize leve.',
  '5 min de caminhada; 7 ciclos de 3 min de trote + 1 min 30 s de caminhada; finalize leve.',
  'Semana leve: 5 min de caminhada; 6 ciclos de 2 min de trote + 1 min 30 s de caminhada; 4 min leves no final.',
]

const developmentIntervals = [
  '5 min de caminhada; 6 ciclos de 4 min de trote + 1 min de caminhada; 3 min leves no final.',
  '5 min de caminhada; 5 ciclos de 5 min de trote + 1 min de caminhada; 5 min leves no final.',
  '5 min de caminhada; 4 ciclos de 7 min de trote + 1 min 30 s de caminhada; finalize leve até 42 min.',
  'Semana leve: 5 min de caminhada; 6 ciclos de 3 min de trote + 1 min de caminhada; finalize leve até 34 min.',
  '5 min de caminhada; 3 ciclos de 9 min de trote + 2 min de caminhada; 4 min leves no final.',
  '5 min de caminhada; 3 ciclos de 10 min de trote + 2 min de caminhada; 4 min leves no final.',
  '5 min de caminhada; 2 blocos de 15 min de trote, separados por 3 min caminhando; 4 min leves no final.',
  'Semana leve: 5 min de caminhada; 5 ciclos de 4 min de trote + 1 min de caminhada; finalize leve até 36 min.',
  '5 min de caminhada; 20 min de trote, 3 min caminhando, 14 min de trote; 3 min leves no final.',
]

const performanceIntervals = [
  '5 min de caminhada; 25 min de trote, 3 min caminhando, 8 min de trote; 4 min leves no final.',
  '5 min de caminhada; 30 min de trote contínuo confortável; 10 min de caminhada leve para fechar.',
  'Semana leve: 5 min de caminhada; 4 ciclos de 5 min de trote + 2 min de caminhada; 5 min leves no final.',
  '5 min de caminhada; 30 min contínuos em ritmo conversável; finalize leve até 45 min.',
  '5 min de caminhada; 3 blocos de 10 min de trote um pouco mais firme + 2 min caminhando; finalize leve.',
  '5 min de caminhada; 35 min contínuos em ritmo confortável; 10 min leves no final.',
  'Semana leve: 5 min de caminhada; 25 min contínuos confortáveis; 10 min leves no final.',
  '5 min de caminhada; 40 min contínuos confortáveis ou com pausas curtas planejadas; 5 min leves no final.',
  'Reavaliação: após aquecer, percorra 30 min em ritmo sustentável e registre distância, esforço e como terminou.',
]

function runningDetail(week: number): string {
  if (week <= 8) return baseIntervals[week - 1]
  if (week <= 17) return developmentIntervals[week - 9]
  return performanceIntervals[week - 18]
}

function longDetail(week: number): string {
  const isDeload = [4, 8, 12, 16, 20, 24].includes(week)
  const minutes = isDeload
    ? Math.min(45, 28 + week)
    : Math.min(65, 34 + Math.round(week * 1.25))
  const runPrompt = week <= 4
    ? 'Mantenha caminhada firme; se estiver confortável, inclua 4 a 6 trotes de 1 min.'
    : week <= 12
      ? 'Alterne 4 a 8 min de trote com 1 a 2 min caminhando, sempre em ritmo conversável.'
      : 'Busque blocos contínuos confortáveis, usando caminhada antes que a técnica ou a respiração se percam.'

  return `${minutes} min totais em percurso plano. ${runPrompt} Esforço alvo 4–6/10; termine sentindo que conseguiria continuar.`
}

function createRunningWeeks(): RunningWeek[] {
  return Array.from({ length: 26 }, (_, index) => {
    const week = index + 1
    return {
      week,
      thursday: {
        label: week === 26 ? 'Reavaliação de 30 minutos' : 'Intervalos por percepção de esforço',
        detail: runningDetail(week),
      },
      sunday: {
        label: [4, 8, 12, 16, 20, 24].includes(week) ? 'Caminhada regenerativa' : 'Caminhada + corrida contínua',
        detail: longDetail(week),
      },
    }
  })
}

const fullBodyA: Exercise[] = [
  {
    id: 'sintia-legpress',
    name: 'Leg Press 45°',
    category: 'compound',
    equipment: 'Máquina',
    phases: {
      base: { sets: 2, reps: '10–12', rest: '75s' },
      desenvolvimento: { sets: 3, reps: '10–12', rest: '90s', variation: 'Suba a carga apenas ao concluir 12 repetições com técnica estável.' },
      performance: { sets: 3, reps: '8–10', rest: '90s', variation: 'Mantenha 2–3 repetições possíveis ao terminar cada série.' },
    },
    technique: 'Pés firmes na plataforma, joelhos alinhados com os pés e descida controlada. Não trave os joelhos no topo.',
    caution: null,
    cautionNote: null,
  },
  {
    id: 'sintia-supino-maquina',
    name: 'Supino na Máquina',
    category: 'compound',
    equipment: 'Máquina ou halteres',
    phases: {
      base: { sets: 2, reps: '10–12', rest: '75s' },
      desenvolvimento: { sets: 3, reps: '10–12', rest: '90s' },
      performance: { sets: 3, reps: '8–10', rest: '90s' },
    },
    technique: 'Ajuste o banco para as mãos ficarem na linha do peito. Ombros apoiados e movimento sem impulso.',
    caution: null,
    cautionNote: null,
  },
  {
    id: 'sintia-remada',
    name: 'Remada Sentada',
    category: 'compound',
    equipment: 'Máquina ou polia',
    phases: {
      base: { sets: 2, reps: '12', rest: '60s' },
      desenvolvimento: { sets: 3, reps: '10–12', rest: '75s' },
      performance: { sets: 3, reps: '8–10', rest: '90s' },
    },
    technique: 'Peito aberto, tronco estável e cotovelos puxando para trás. Retorne o peso devagar.',
    caution: null,
    cautionNote: null,
  },
  {
    id: 'sintia-flexora',
    name: 'Mesa ou Cadeira Flexora',
    category: 'isolation',
    equipment: 'Máquina',
    phases: {
      base: { sets: 2, reps: '12', rest: '60s' },
      desenvolvimento: { sets: 3, reps: '10–12', rest: '75s' },
      performance: { sets: 3, reps: '10', rest: '75s' },
    },
    technique: 'Quadril apoiado, movimento controlado e sem tirar o corpo do banco.',
    caution: null,
    cautionNote: null,
  },
  {
    id: 'sintia-pallof',
    name: 'Pallof Press',
    category: 'core',
    equipment: 'Polia ou elástico',
    phases: {
      base: { sets: 2, reps: '10/lado', rest: '45s' },
      desenvolvimento: { sets: 3, reps: '10/lado', rest: '45s' },
      performance: { sets: 3, reps: '12/lado', rest: '45s' },
    },
    technique: 'Costelas alinhadas sobre o quadril; estenda os braços sem deixar o tronco girar.',
    caution: null,
    cautionNote: null,
  },
  {
    id: 'sintia-cardio-a',
    name: 'Caminhada Pós-força',
    category: 'cardio',
    equipment: 'Esteira',
    phases: {
      base: { sets: 1, reps: '15 min', rest: '—' },
      desenvolvimento: { sets: 1, reps: '20 min', rest: '—' },
      performance: { sets: 1, reps: '20–25 min', rest: '—' },
    },
    technique: 'Ritmo moderado: respiração mais rápida, mas ainda capaz de conversar em frases completas.',
    caution: null,
    cautionNote: null,
  },
]

const fullBodyB: Exercise[] = [
  {
    id: 'sintia-agachamento-goblet',
    name: 'Agachamento Goblet até o Banco',
    category: 'compound',
    equipment: 'Halter e banco',
    phases: {
      base: { sets: 2, reps: '10', rest: '75s' },
      desenvolvimento: { sets: 3, reps: '10–12', rest: '90s' },
      performance: { sets: 3, reps: '8–10', rest: '90s' },
    },
    technique: 'Segure o halter junto ao peito, toque o banco com controle e levante empurrando o chão.',
    caution: null,
    cautionNote: null,
  },
  {
    id: 'sintia-puxada',
    name: 'Puxada Frontal',
    category: 'compound',
    equipment: 'Máquina ou polia',
    phases: {
      base: { sets: 2, reps: '10–12', rest: '75s' },
      desenvolvimento: { sets: 3, reps: '10–12', rest: '90s' },
      performance: { sets: 3, reps: '8–10', rest: '90s' },
    },
    technique: 'Puxe a barra até a parte alta do peito sem balançar o tronco; suba com controle.',
    caution: null,
    cautionNote: null,
  },
  {
    id: 'sintia-romeno',
    name: 'Levantamento Romeno com Halteres',
    category: 'compound',
    equipment: 'Halteres',
    phases: {
      base: { sets: 2, reps: '10', rest: '75s' },
      desenvolvimento: { sets: 3, reps: '10', rest: '90s' },
      performance: { sets: 3, reps: '8–10', rest: '90s' },
    },
    technique: 'Joelhos levemente flexionados, quadril para trás, coluna neutra e halteres próximos das pernas.',
    caution: null,
    cautionNote: null,
  },
  {
    id: 'sintia-desenvolvimento',
    name: 'Desenvolvimento Sentado',
    category: 'compound',
    equipment: 'Máquina ou halteres leves',
    phases: {
      base: { sets: 2, reps: '10', rest: '60s' },
      desenvolvimento: { sets: 3, reps: '10', rest: '75s' },
      performance: { sets: 3, reps: '8–10', rest: '90s' },
    },
    technique: 'Costas apoiadas, abdômen firme e cotovelos levemente à frente do corpo. Não force amplitude desconfortável.',
    caution: null,
    cautionNote: null,
  },
  {
    id: 'sintia-ponte',
    name: 'Elevação de Quadril',
    category: 'compound',
    equipment: 'Máquina, banco ou halter',
    phases: {
      base: { sets: 2, reps: '12', rest: '60s' },
      desenvolvimento: { sets: 3, reps: '10–12', rest: '75s' },
      performance: { sets: 3, reps: '10', rest: '75s' },
    },
    technique: 'Suba contraindo glúteos, pare antes de arquear a lombar e desça em dois segundos.',
    caution: null,
    cautionNote: null,
  },
  {
    id: 'sintia-cardio-b',
    name: 'Bicicleta ou Elíptico Pós-força',
    category: 'cardio',
    equipment: 'Bicicleta ou elíptico',
    phases: {
      base: { sets: 1, reps: '15 min', rest: '—' },
      desenvolvimento: { sets: 1, reps: '20 min', rest: '—' },
      performance: { sets: 1, reps: '20–25 min', rest: '—' },
    },
    technique: 'Mantenha esforço 4–6/10. Reduza a intensidade se não conseguir falar uma frase completa.',
    caution: null,
    cautionNote: null,
  },
]

const homeOption: Exercise[] = [
  {
    id: 'sintia-casa-sentar',
    name: 'Sentar e Levantar com Halter',
    category: 'compound',
    equipment: 'Cadeira e peso de mão',
    phases: {
      base: { sets: 2, reps: '10', rest: '60s' },
      desenvolvimento: { sets: 3, reps: '12', rest: '75s' },
      performance: { sets: 3, reps: '12–15', rest: '75s' },
    },
    technique: 'Use cadeira firme encostada na parede; levante sem impulso e sente com controle.',
    caution: null,
    cautionNote: null,
  },
  {
    id: 'sintia-casa-remada',
    name: 'Remada com Elástico',
    category: 'compound',
    equipment: 'Elástico',
    phases: {
      base: { sets: 2, reps: '12', rest: '60s' },
      desenvolvimento: { sets: 3, reps: '12', rest: '60s' },
      performance: { sets: 3, reps: '15', rest: '60s' },
    },
    technique: 'Prenda o elástico em ponto seguro, mantenha o tronco estável e aproxime as escápulas.',
    caution: null,
    cautionNote: null,
  },
  {
    id: 'sintia-casa-supino',
    name: 'Supino com Halteres no Chão',
    category: 'compound',
    equipment: 'Halteres',
    phases: {
      base: { sets: 2, reps: '10', rest: '60s' },
      desenvolvimento: { sets: 3, reps: '10–12', rest: '75s' },
      performance: { sets: 3, reps: '12', rest: '75s' },
    },
    technique: 'Deite com joelhos flexionados; desça até os braços tocarem suavemente o chão e empurre sem bater os pesos.',
    caution: null,
    cautionNote: null,
  },
]

export const sintiaPlan: Plan = {
  meta: {
    version: '1.0-sintia',
    source: 'Questionário preenchido por Sintia Said Coelho em agosto de 2026',
  },
  ui: {
    showJointPainCheckin: false,
    simplifiedExerciseLog: true,
    showMovementVisualizer: false,
  },
  profile: {
    name: 'Sintia Said Coelho',
    age: 58,
    height: 170,
    initialWeight: 83,
    startDate: '2026-08-03',
    goals: {
      weight: 73,
      primary: 'Emagrecer com definição',
      conditioning: 'Melhorar o fôlego',
      consistency: 'Treinar 4 dias por semana',
      plankSeconds: 60,
    },
    healthNotes: [
      'Nenhuma lesão, dor ou movimento proibido foi relatado no questionário.',
      'Liberação médica para treinar foi informada pela usuária.',
      'Interromper a sessão e buscar avaliação se houver dor no peito, desmaio, falta de ar fora do esperado, palpitação persistente ou dor aguda.',
      'O plano organiza treino e hábitos, mas não substitui avaliação médica, de educação física ou nutricional.',
    ],
  },
  phases: [
    {
      id: 'base',
      name: 'Base segura',
      startWeek: 1,
      endWeek: 8,
      description: 'Aprender cargas, registrar o ponto de partida e construir caminhada + corrida sem pressa. Termine as séries com 3–4 repetições possíveis.',
      color: '#3F7660',
    },
    {
      id: 'desenvolvimento',
      name: 'Desenvolvimento',
      startWeek: 9,
      endWeek: 17,
      description: 'Aumentar gradualmente o tempo de trote e as cargas, mantendo técnica e recuperação. A maior parte do cardio continua em ritmo conversável.',
      color: '#B06D32',
    },
    {
      id: 'performance',
      name: 'Consolidação',
      startWeek: 18,
      endWeek: 26,
      description: 'Consolidar 30 minutos ou mais de caminhada/corrida sustentável e preservar força durante a redução de peso, sem treinar até a falha.',
      color: '#9B4A3F',
    },
  ],
  weekTemplate: {
    '0': { type: 'descanso', subtype: null, label: 'Descanso ativo opcional', icon: 'recovery' },
    '1': { type: 'forca', subtype: 'forcaA', label: 'Força A — Corpo inteiro', icon: 'strength' },
    '2': { type: 'corrida', subtype: 'qualidade', label: 'Caminhada + corrida — Intervalos', icon: 'run' },
    '3': { type: 'descanso', subtype: null, label: 'Mobilidade ou caminhada leve', icon: 'recovery' },
    '4': { type: 'forca', subtype: 'forcaB', label: 'Força B — Corpo inteiro', icon: 'strength' },
    '5': { type: 'descanso', subtype: null, label: 'Recuperação', icon: 'recovery' },
    '6': { type: 'corrida', subtype: 'longa', label: 'Caminhada + corrida — Contínua', icon: 'run' },
  },
  deloadWeeks: [4, 8, 12, 16, 20, 24],
  exercises: {
    forcaA: fullBodyA,
    forcaB: fullBodyB,
    forcaC: homeOption,
    calistenia: {
      pushProgression: [
        { id: 'sintia-flexao-parede', name: 'Flexão na Parede', forPhase: 'base', sets: 2, reps: '10', rest: '60s', technique: 'Corpo alinhado e mãos na altura do peito.', caution: null, cautionNote: null },
        { id: 'sintia-flexao-banco', name: 'Flexão Inclinada', forPhase: 'desenvolvimento', sets: 3, reps: '8–10', rest: '75s', technique: 'Use apoio firme e mantenha o corpo alinhado.', caution: null, cautionNote: null },
        { id: 'sintia-flexao-progressiva', name: 'Flexão Inclinada Baixa', forPhase: 'performance', sets: 3, reps: '10–12', rest: '75s', technique: 'Reduza a altura do apoio apenas com técnica estável.', caution: null, cautionNote: null },
      ],
      pullProgression: [
        { id: 'sintia-puxada-elastico-base', name: 'Puxada com Elástico', forPhase: 'base', sets: 2, reps: '12', rest: '60s', technique: 'Prenda o elástico em ponto seguro.', caution: null, cautionNote: null },
        { id: 'sintia-puxada-elastico-dev', name: 'Puxada com Elástico Forte', forPhase: 'desenvolvimento', sets: 3, reps: '12', rest: '60s', technique: 'Controle o retorno por dois segundos.', caution: null, cautionNote: null },
        { id: 'sintia-puxada-elastico-perf', name: 'Puxada Unilateral com Elástico', forPhase: 'performance', sets: 3, reps: '10/lado', rest: '60s', technique: 'Evite girar o tronco.', caution: null, cautionNote: null },
      ],
      dipsProgression: [
        { id: 'sintia-triceps-base', name: 'Tríceps com Elástico', forPhase: 'base', sets: 2, reps: '12', rest: '60s', technique: 'Cotovelos próximos do corpo.', caution: null, cautionNote: null },
        { id: 'sintia-triceps-dev', name: 'Tríceps na Polia', forPhase: 'desenvolvimento', sets: 3, reps: '10–12', rest: '60s', technique: 'Ombros baixos e movimento controlado.', caution: null, cautionNote: null },
        { id: 'sintia-triceps-perf', name: 'Tríceps na Polia', forPhase: 'performance', sets: 3, reps: '12', rest: '60s', technique: 'Pare antes de perder a posição dos cotovelos.', caution: null, cautionNote: null },
      ],
      core: [
        { id: 'sintia-prancha', name: 'Prancha Inclinada', sets: 3, reps: '20–40s', rest: '45s', technique: 'Apoio alto, corpo alinhado e respiração contínua.' },
        { id: 'sintia-deadbug', name: 'Dead Bug', sets: 2, reps: '8/lado', rest: '45s', technique: 'Mantenha a lombar apoiada e mova devagar.' },
      ],
      metcon: {
        base: { format: '2 voltas leves', exercises: ['Sentar e levantar × 8', 'Remada com elástico × 10', 'Marcha no lugar × 60s'] },
        desenvolvimento: { format: '3 voltas moderadas', exercises: ['Sentar e levantar × 10', 'Remada com elástico × 12', 'Marcha no lugar × 75s'] },
        performance: { format: '3 voltas controladas', exercises: ['Agachamento ao banco × 12', 'Remada com elástico × 15', 'Marcha rápida × 90s'] },
      },
    },
  },
  running: { weeks: createRunningWeeks() },
  mobility: {
    shoulder: [
      { id: 'sintia-circulos-ombro', name: 'Círculos de Ombro', sets: 1, reps: '8/direção', freq: 'Antes do treino', technique: 'Movimentos lentos e sem elevar os ombros.' },
      { id: 'sintia-rotacao-toracica', name: 'Rotação Torácica em Pé', sets: 1, reps: '8/lado', freq: 'Antes do treino', technique: 'Quadril parado e rotação confortável do tronco.' },
      { id: 'sintia-pullapart', name: 'Band Pull-apart Leve', sets: 2, reps: '12', freq: '2–3×/sem', technique: 'Abra o elástico na altura do peito sem arquear a lombar.' },
    ],
    knee: [
      { id: 'sintia-mobilidade-tornozelo', name: 'Mobilidade de Tornozelo', sets: 1, reps: '10/lado', freq: 'Antes do treino', technique: 'Leve o joelho à frente mantendo o calcanhar apoiado.' },
      { id: 'sintia-marcha', name: 'Marcha no Lugar', sets: 2, reps: '45s', freq: 'Antes do treino', technique: 'Postura alta e passos leves.' },
      { id: 'sintia-alongamento-quadril', name: 'Alongamento do Flexor do Quadril', sets: 2, reps: '25s/lado', freq: 'Após o treino', technique: 'Contraia o glúteo da perna de trás e não arqueie a lombar.' },
    ],
  },
  nutrition: {
    dailyTargets: {
      trainingDay: { kcal: 1800, protein: 110, carbs: 210, fat: 58 },
      restDay: { kcal: 1700, protein: 110, carbs: 180, fat: 60 },
    },
    mealPlan: [
      { meal: 'Café da manhã', time: '08:15', items: ['2 ovos + 1 fatia de pão integral ou tapioca pequena', '1 fruta', 'Café sem excesso de açúcar'] },
      { meal: 'Pós-treino', time: '11:00', items: ['Iogurte natural + banana + 1 colher de aveia', 'Em dia sem treino, use como lanche apenas se houver fome'] },
      { meal: 'Almoço', time: '13:00', items: ['Metade do prato de verduras e legumes', '1 porção de frango, peixe, carne magra, ovos ou feijão', 'Arroz + feijão em porção habitual, sem repetir automaticamente'] },
      { meal: 'Lanche', time: '16:30', items: ['1 fruta + iogurte ou queijo branco', 'Ou pequena porção de castanhas'] },
      { meal: 'Jantar', time: '20:00', items: ['Repita a estrutura do almoço', 'Ajuste arroz, massa ou pão à fome e ao treino do dia'] },
      { meal: 'Ceia opcional', time: '22:00', items: ['Leite ou iogurte se houver fome real', 'Evite transformar vontade de doce em refeição automática'] },
    ],
    tips: [
      'As metas de calorias e macros são uma estimativa inicial, não uma prescrição clínica; ajuste com nutricionista se possível.',
      'Busque redução gradual de peso. Fome intensa, tontura, queda persistente de energia ou piora do treino pedem revisão da ingestão.',
      'Inclua proteína em todas as refeições principais e varie entre ovos, carnes magras, peixes, laticínios e feijões.',
      'Mantenha água disponível ao longo do dia; urina muito escura costuma indicar que é hora de beber mais.',
      'Doces não precisam ser proibidos: planeje uma porção, coma devagar e retome a rotina na refeição seguinte.',
      'Registre o peso 1–3 vezes por semana, nas mesmas condições, e avalie a tendência de quatro semanas em vez de um único dia.',
    ],
    shoppingList: [
      { category: 'Proteínas', items: ['Ovos', 'Frango', 'Peixe', 'Carne magra', 'Iogurte natural', 'Queijo branco', 'Feijão e lentilha'] },
      { category: 'Hortifruti', items: ['Folhas variadas', 'Tomate', 'Cenoura', 'Abobrinha', 'Brócolis', 'Banana', 'Maçã ou pera', 'Fruta da estação'] },
      { category: 'Carboidratos', items: ['Arroz', 'Aveia', 'Pão integral', 'Batata ou mandioca', 'Tapioca'] },
      { category: 'Gorduras e apoio', items: ['Azeite', 'Castanhas', 'Ervas e temperos', 'Café ou chá'] },
    ],
  },
  supplements: [
    {
      id: 'sintia-sem-suplemento',
      name: 'Sem suplemento definido',
      essential: false,
      dose: 'Não se aplica',
      timing: 'Reavaliar apenas se necessário',
      notes: 'O questionário informa que Cíntia não usa suplementos. Não iniciar vitaminas, estimulantes ou outros produtos por conta própria; alimentação e treino vêm primeiro.',
      brand: null,
    },
  ],
  dailyRoutines: {
    morning: {
      label: 'Treino de manhã',
      schedule: [
        { time: '08:00', activity: 'Acordar e beber água' },
        { time: '08:15', activity: 'Café da manhã leve' },
        { time: '09:00', activity: 'Mobilidade e aquecimento por 8–10 min' },
        { time: '09:10', activity: 'Treino principal' },
        { time: '10:20', activity: 'Desacelerar, beber água e observar como terminou' },
        { time: '11:00', activity: 'Lanche ou refeição pós-treino' },
        { time: '13:00', activity: 'Almoço' },
        { time: '20:00', activity: 'Jantar' },
        { time: '22:30', activity: 'Reduzir telas e preparar o sono' },
        { time: '23:00', activity: 'Dormir' },
      ],
    },
    evening: {
      label: 'Alternativa à noite',
      schedule: [
        { time: '08:00', activity: 'Acordar e beber água' },
        { time: '08:30', activity: 'Café da manhã' },
        { time: '13:00', activity: 'Almoço' },
        { time: '16:30', activity: 'Lanche pré-treino simples' },
        { time: '18:00', activity: 'Mobilidade e aquecimento por 8–10 min' },
        { time: '18:10', activity: 'Treino principal' },
        { time: '20:00', activity: 'Jantar e recuperação' },
        { time: '23:00', activity: 'Dormir' },
      ],
    },
  },
  tests: [
    { id: 'sintia-t30', name: 'Caminhada/corrida contínua', unit: 'min', lower: false, initial: 'A registrar', target: 30, description: 'Na semana 1, registre quantos minutos mantém em ritmo confortável; repita a cada 4 semanas.' },
    { id: 'sintia-dist30', name: 'Distância em 30 minutos', unit: 'km', lower: false, initial: 'A registrar', target: 'Evoluir com conforto', description: 'Percorra 30 minutos em terreno plano e registre a distância sem transformar o teste em sprint.' },
    { id: 'sintia-flexoes', name: 'Flexões declaradas', unit: 'reps', lower: false, initial: 50, target: 'Reavaliar técnica', description: 'Confirme o número com a mesma variação e amplitude antes de definir uma nova meta.' },
    { id: 'sintia-prancha', name: 'Prancha', unit: 'seg', lower: false, initial: 30, target: 60, description: 'Tempo com respiração contínua e postura estável; pare quando perder a forma.' },
    { id: 'sintia-peso', name: 'Peso corporal', unit: 'kg', lower: true, initial: 83, target: 73, description: 'Registre pela manhã, em condições semelhantes, e observe a tendência mensal.' },
  ],
}
