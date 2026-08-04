import miguelPlan from '@/data/plan.json'
import { sintiaPlan } from '@/data/plan-sintia'
import { getStoredProfileId } from '@/lib/auth'
import type { Plan } from '@/types'

const activePlan = getStoredProfileId() === 'sintia'
  ? sintiaPlan
  : miguelPlan as unknown as Plan

export default activePlan
