/**
 * Script de seed: lê Plano_Performance_6meses_Miguel.xlsx e gera src/data/plan.json
 * Uso: npm run seed
 *
 * Requer: xlsx (já listado em devDependencies)
 */
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import * as XLSX from 'xlsx'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const XLSX_PATH = join(ROOT, 'Plano_Performance_6meses_Miguel.xlsx')
const OUT_PATH  = join(ROOT, 'src', 'data', 'plan.json')

console.log('📖 Lendo planilha:', XLSX_PATH)

let wb
try {
  wb = XLSX.readFile(XLSX_PATH)
} catch (e) {
  console.error('❌ Não foi possível abrir a planilha. Certifique-se de que o arquivo está na raiz do projeto.')
  console.error(e.message)
  process.exit(1)
}

const sheets = wb.SheetNames
console.log('📋 Abas encontradas:', sheets.join(', '))

function sheetToJson(name) {
  const ws = wb.Sheets[name]
  if (!ws) { console.warn(`⚠️  Aba "${name}" não encontrada.`); return [] }
  return XLSX.utils.sheet_to_json(ws, { defval: '' })
}

// ─── Read each sheet ─────────────────────────────────────────────────────────
const profileRows   = sheetToJson(sheets.find(s => /perfil/i.test(s)) ?? 'Perfil & Metas')
const periodRows    = sheetToJson(sheets.find(s => /period/i.test(s)) ?? 'Periodização')
const strengthRows  = sheetToJson(sheets.find(s => /força/i.test(s))  ?? 'Treino — Força')
const runRows       = sheetToJson(sheets.find(s => /corrida/i.test(s)) ?? 'Treino — Corrida')
const calRows       = sheetToJson(sheets.find(s => /calist/i.test(s)) ?? 'Calistenia')
const mobRows       = sheetToJson(sheets.find(s => /mobil/i.test(s))  ?? 'Mobilidade & Prehab')
const nutRows       = sheetToJson(sheets.find(s => /aliment/i.test(s)) ?? 'Alimentação')
const supRows       = sheetToJson(sheets.find(s => /suplem/i.test(s)) ?? 'Suplementos')

// ─── Build plan object ────────────────────────────────────────────────────────
// NOTE: The mapping below is a starting point.
// Adjust field names to match the actual column headers in your spreadsheet.
// Run `npm run seed` and check the console output to debug field names.

console.log('\n🔍 Amostra da aba Perfil:',  profileRows.slice(0, 3))
console.log('🔍 Amostra da aba Corrida:',  runRows.slice(0, 3))
console.log('🔍 Amostra da aba Força:',    strengthRows.slice(0, 3))

// Build running weeks from spreadsheet data
const runningWeeks = runRows.slice(0, 26).map((row, i) => ({
  week: i + 1,
  thursday: {
    label: String(row['Quinta - Qualidade'] ?? row['quinta'] ?? row['Qualidade'] ?? `Sessão qualidade semana ${i+1}`),
    detail: String(row['Detalhe Quinta'] ?? row['detalhe_qui'] ?? ''),
  },
  sunday: {
    label: String(row['Domingo - Longa'] ?? row['domingo'] ?? row['Longa'] ?? `Corrida longa semana ${i+1}`),
    detail: String(row['Detalhe Domingo'] ?? row['detalhe_dom'] ?? ''),
  },
}))

// Read existing plan.json as base (we only override running weeks from spreadsheet)
const existingPlan = JSON.parse(readFileSync(OUT_PATH, 'utf8'))

const plan = {
  ...existingPlan,
  meta: { ...existingPlan.meta, source: 'xlsx', generatedAt: new Date().toISOString() },
  running: { weeks: runningWeeks.length >= 26 ? runningWeeks : existingPlan.running.weeks },
}

// Override profile if spreadsheet has data
if (profileRows.length > 0) {
  const p = profileRows[0]
  if (p['Nome'] ?? p['name'])          plan.profile.name          = p['Nome'] ?? p['name']
  if (p['Idade'] ?? p['age'])           plan.profile.age           = Number(p['Idade'] ?? p['age'])
  if (p['Altura'] ?? p['height'])       plan.profile.height        = Number(p['Altura'] ?? p['height'])
  if (p['Peso Inicial'] ?? p['initialWeight']) plan.profile.initialWeight = Number(p['Peso Inicial'] ?? p['initialWeight'])
  if (p['Data de Início'] ?? p['startDate'])   plan.profile.startDate     = String(p['Data de Início'] ?? p['startDate'])
}

writeFileSync(OUT_PATH, JSON.stringify(plan, null, 2), 'utf8')
console.log('\n✅ plan.json gerado com sucesso em:', OUT_PATH)
console.log('ℹ️  Verifique os nomes das colunas acima e ajuste o script se necessário.')
