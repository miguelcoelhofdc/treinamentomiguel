/**
 * Padrão de animação de exercícios — guia de autoria
 * ===================================================
 *
 * Cada exercício do app pode ter uma `ExerciseAnimation` registrada em
 * `src/animations/index.ts`, chaveada pelo `id` do exercício no plan.json.
 * O botão "Ver movimento" aparece automaticamente para todo id registrado.
 *
 * Para adicionar um exercício futuro:
 *   1. Escreva um objeto `ExerciseAnimation` no arquivo do grupo (forcaA.ts, …).
 *   2. Registre-o no objeto `animations` de `src/animations/index.ts`.
 *   3. Revise em DEV na galeria `/dev/viz` (lista também os ids sem animação).
 *
 * Convenção de ângulos (graus, ordem Euler XYZ):
 *   x — flexão/extensão. POSITIVO = flexão anatômica em TODAS as articulações
 *       (o motor aplica o sinal correto por articulação):
 *         root      +x = inclinar tronco/pelve à frente
 *         spine/chest/neck/head  +x = flexionar a coluna/pescoço à frente
 *         shoulder  +x = elevar o braço à frente (flexão de ombro)
 *         elbow     +x = dobrar o cotovelo
 *         wrist     +x = flexão de punho
 *         hip       +x = levar a coxa à frente (flexão de quadril)
 *         knee      +x = dobrar o joelho (calcanhar ao glúteo)
 *         ankle     +x = dorsiflexão (ponta do pé em direção à canela)
 *   y — rotação axial (rotação bruta em torno do eixo do osso; espelhe o sinal
 *       entre lados L/R para poses simétricas).
 *   z — abdução/adução (rotação bruta em torno do eixo ântero-posterior;
 *       lado esquerdo abre com +z, lado direito abre com −z).
 *
 * O boneco em pose neutra (todas as rotações 0) está EM PÉ, de frente para +Z,
 * braços ao lado do corpo. `rootPos` é a posição absoluta da pelve em metros
 * (padrão [0, 0.93, 0]); com `pinFeet` (padrão true) o motor ignora o Y e
 * ancora o pé mais baixo no chão automaticamente.
 *
 * Checklist de qualidade por animação (revisar em /dev/viz):
 *   - Pés plantados no chão (ou pinFeet:false com rootPos intencional).
 *   - Nenhuma articulação em hiperextensão irreal.
 *   - Simetria L/R exceto exercícios unilaterais.
 *   - Fase excêntrica mais lenta que a concêntrica (posicione os keyframes).
 *   - Em loop 'cycle', o primeiro e o último keyframe têm a mesma pose.
 *   - `cameraHint` mostra o plano do movimento na abertura.
 *   - `notes` descreve os ângulos-alvo nas posições extremas + cadência.
 */

export type JointName =
  | 'root'
  | 'spine'
  | 'chest'
  | 'neck'
  | 'head'
  | 'shoulderL'
  | 'elbowL'
  | 'wristL'
  | 'shoulderR'
  | 'elbowR'
  | 'wristR'
  | 'hipL'
  | 'kneeL'
  | 'ankleL'
  | 'hipR'
  | 'kneeR'
  | 'ankleR'

/** Ângulos [x, y, z] em graus — ver convenção no topo do arquivo. */
export type Euler3 = [number, number, number]

/** Pose parcial: articulações ausentes herdam da pose base da animação. */
export interface Pose extends Partial<Record<JointName, Euler3>> {
  /** Posição absoluta da pelve em metros. Y é ignorado quando pinFeet=true. */
  rootPos?: [number, number, number]
}

export type EaseName = 'inOut' | 'in' | 'out' | 'linear'

export interface Keyframe {
  /** Tempo normalizado no ciclo, 0–1. O primeiro deve ser 0 e o último 1. */
  t: number
  pose: Pose
  /** Easing usado ao interpolar EM DIREÇÃO a este keyframe (padrão 'inOut'). */
  ease?: EaseName
}

export type EquipmentSpec =
  | { type: 'barbell'; attach: 'hands' | 'back' | 'hips'; width?: number; plates?: boolean }
  | { type: 'dumbbell'; attach: 'both' | 'left' | 'right'; axis?: 'x' | 'z' }
  | {
      type: 'bench'
      height?: number
      incline?: number
      length?: number
      position?: [number, number, number]
      rotationY?: number
    }
  | { type: 'pullupBar'; height?: number; width?: number }
  | {
      type: 'box'
      size: [number, number, number]
      position?: [number, number, number]
      rotation?: Euler3
      attach?: 'world' | 'feet'
    }
  | { type: 'cable'; anchor: [number, number, number]; to: 'both' | 'left' | 'right' }
  | { type: 'band'; anchor: [number, number, number]; to: 'both' | 'left' | 'right' }

export interface CameraHint {
  /** Azimute em graus: 0 = de frente (+Z), 90 = lado esquerdo do boneco. */
  azimuth: number
  /** Elevação em graus acima do horizonte. */
  elevation: number
  /** Distância da câmera ao alvo, em metros (padrão 3.1). */
  distance?: number
  /** Ponto que a câmera orbita (padrão [0, 0.85, 0]); use em exercícios suspensos. */
  target?: [number, number, number]
}

export interface ExerciseAnimation {
  /** Mesmo id do exercício no plan.json (ou id próprio para sub-movimentos). */
  id: string
  /** Segundos por ciclo (uma repetição). Em 'pingpong', segundos por direção. */
  duration: number
  loop: 'cycle' | 'pingpong'
  /** Pose completa de referência; os keyframes sobrepõem articulações. */
  base: Pose
  keyframes: Keyframe[]
  /** Padrão true: ancora o pé mais baixo no chão a cada frame (FK, sem IK). */
  pinFeet?: boolean
  equipment?: EquipmentSpec[]
  cameraHint?: CameraHint
  /** Referência biomecânica: ângulos-alvo nos extremos + cadência. Obrigatória. */
  notes: string
}
