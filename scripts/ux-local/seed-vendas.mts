// Negócios fechados na conta de revisão, para Análise > Vendas (F3 do plano de
// navegação e CRM). Doze meses de ganhos e perdas no funil padrão, com valor,
// motivo e responsável, espalhados entre as quatro pessoas da conta.
//
// Todo negócio daqui nasce com `chave_de_criacao = 'seed-vendas-<n>'`, e é
// por ela que o --apagar acha o que é deste seed sem encostar no resto.
//
// Uso: npx tsx scripts/ux-local/seed-vendas.mts           (cria)
//      npx tsx scripts/ux-local/seed-vendas.mts --apagar  (apaga só o que criou)
// Roda só contra o container `supabase_db_autofluxos`.
import { execFileSync } from 'node:child_process'

const psql = (sql: string) =>
  execFileSync('docker', ['exec', '-i', 'supabase_db_autofluxos', 'psql', '-U', 'postgres', '-q', '-v', 'ON_ERROR_STOP=1', '-At'], {
    input: sql,
    encoding: 'utf8',
  }).trim()

const CONTA = 'afacb27c-ec60-44a7-be3e-a66f4fc60976'

if (process.argv.includes('--apagar')) {
  console.log(psql(`delete from quadro_cartoes where client_id = '${CONTA}' and chave_de_criacao like 'seed-vendas-%' returning 1`).split('\n').filter(Boolean).length, 'apagados')
  process.exit(0)
}
if (psql(`select count(*) from quadro_cartoes where client_id = '${CONTA}' and chave_de_criacao like 'seed-vendas-%'`) !== '0') {
  throw new Error('o seed já rodou; use --apagar antes')
}

const QUADRO = psql(`select id from quadros where client_id = '${CONTA}' and padrao limit 1`)
const colunas = psql(`select id || '|' || ordem || '|' || tipo from quadro_colunas where quadro_id = '${QUADRO}' order by ordem`)
  .split('\n')
  .map((l) => {
    const [id, ordem, tipo] = l.split('|')
    return { id: id!, ordem: Number(ordem), tipo: tipo! }
  })
const normais = colunas.filter((c) => c.tipo === 'normal')
const ganho = colunas.find((c) => c.tipo === 'ganho')
if (!ganho || normais.length === 0) throw new Error('o funil padrão precisa de etapas normais e uma de ganho')

const contatos = psql(`select id from contacts where client_id = '${CONTA}' order by criado_em`).split('\n').filter(Boolean)
const pessoas = psql(`select distinct responsavel from quadro_cartoes where client_id = '${CONTA}' and responsavel is not null order by 1`)
  .split('\n')
  .filter(Boolean)
const motivos = ['Preço', 'Sem resposta', 'Comprou de outro', 'Fora do perfil', 'Sem interesse agora', null]

// Aleatório com semente, para o mesmo seed dar os mesmos números.
let semente = 7
const sorte = () => (semente = (semente * 16807) % 2147483647) / 2147483647
const um = <T,>(lista: T[]): T => lista[Math.floor(sorte() * lista.length)]!

const HOJE = new Date('2026-09-24T15:00:00-03:00').getTime()
const DIA = 86400000
let sql = 'begin;\n'
for (let n = 0; n < 90; n++) {
  // Mais negócio nos meses recentes: a conta está crescendo.
  const diasAtras = Math.floor(Math.pow(sorte(), 1.4) * 360)
  const fechado = new Date(HOJE - diasAtras * DIA - Math.floor(sorte() * 10) * 3600000)
  const criado = new Date(fechado.getTime() - (2 + Math.floor(sorte() * 35)) * DIA)
  const pessoa = um(pessoas)
  // Cada pessoa tem uma taxa diferente, para a aba Equipe ter o que comparar.
  const ganhou = sorte() < 0.3 + pessoas.indexOf(pessoa) * 0.1
  const coluna = ganhou ? ganho : um(normais)
  const valor = sorte() < 0.9 ? (180 + Math.floor(sorte() * 12) * 60).toFixed(2) : null
  const motivo = ganhou ? null : um(motivos)
  sql += `insert into quadro_cartoes (quadro_id, coluna_id, contact_id, client_id, entrou_na_coluna_em, criado_em, titulo, valor, responsavel, situacao, motivo, fechado_em, chave_de_criacao)
values ('${QUADRO}', '${coluna.id}', '${um(contatos)}', '${CONTA}', '${fechado.toISOString()}', '${criado.toISOString()}',
  'Plano ${um(['mensal', 'trimestral', 'semestral'])}', ${valor ?? 'null'}, '${pessoa}', '${ganhou ? 'ganha' : 'perdida'}',
  ${motivo ? `'${motivo}'` : 'null'}, '${fechado.toISOString()}', 'seed-vendas-${n}');\n`
}
sql += 'commit;\n'
psql(sql)
console.log('criados 90 negócios fechados no funil', QUADRO)
