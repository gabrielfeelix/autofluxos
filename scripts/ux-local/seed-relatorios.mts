// Uma segunda conta de revisão, com 120 dias de movimento, para a tela de
// Relatórios (plano de UX, 11.1) e a validação da Fase 12.
//
// Por que conta separada: sessão exige canal, e canal ligado na "Studio Pilates
// Revisão" mudaria a home e o Inbox que os outros agentes fotografam. Aqui a
// conta é "Studio Relatórios Local", o dono é o mesmo revisao@local.test, e as
// três pessoas do seed.mts entram como membros.
//
// Uso: npx tsx scripts/ux-local/seed-relatorios.mts           (cria)
//      npx tsx scripts/ux-local/seed-relatorios.mts --apagar  (apaga a conta inteira)
// Prints dela: CONTA="Studio Relatórios Local" node scripts/ux-local/prints.mjs <saída> relatorios
// Roda só contra o container `supabase_db_autofluxos`.
import { execFileSync } from 'node:child_process'

const psql = (sql: string, entrada?: string) =>
  execFileSync('docker', ['exec', '-i', 'supabase_db_autofluxos', 'psql', '-U', 'postgres', '-q', '-v', 'ON_ERROR_STOP=1', '-At', ...(sql ? ['-c', sql] : [])], { input: entrada, encoding: 'utf8' }).trim()

const NOME = 'Studio Relatórios Local'
const existente = psql(`select id from clients where nome = '${NOME}' limit 1`)

if (process.argv.includes('--apagar')) {
  if (!existente) throw new Error('a conta não existe')
  psql(`delete from clients where id = '${existente}'`)
  console.log('apagada', existente)
  process.exit(0)
}
if (existente) throw new Error(`a conta já existe (${existente}); use --apagar antes`)

const EU = psql("select id from af_usuarios where email = 'revisao@local.test'")
if (!EU) throw new Error('rode o cadastro.mjs antes')
const membros = psql("select id from af_usuarios where email in ('ana@local.test','bruno@local.test','carla@local.test') order by email").split('\n').filter(Boolean)
if (membros.length !== 3) throw new Error('rode o seed.mts antes: faltam Ana, Bruno e Carla')
const pessoas = [EU, ...membros]

const u = (): string => crypto.randomUUID()
// Aleatório com semente, para o mesmo seed dar os mesmos números.
let semente = 42
const sorte = () => ((semente = (semente * 16807) % 2147483647) / 2147483647)
const C = u()
let sql = 'begin;\n'
sql += `insert into clients(id,nome,slug,crm_ativo,onboarding) values('${C}','${NOME}','studio-relatorios-local',true,'{"status":"concluido","respostas":{}}'::jsonb);\n`
sql += `insert into af_membros("organizationId","userId",role) values('${C}','${EU}','owner');\n`
for (const m of membros) sql += `insert into af_membros("organizationId","userId",role) values('${C}','${m}','member');\n`

const canal = u()
sql += `insert into channels(id,client_id,phone_number_id) values('${canal}','${C}','local-relatorios-${C.slice(0, 8)}');\n`
const fluxo = u(), versao = u()
const grafo = `'{"inicio":"a","nodes":[{"id":"a","type":"mensagem","position":{"x":0,"y":0},"data":{"partes":[{"tipo":"texto","texto":"Oi!"}]}}],"edges":[]}'::jsonb`
sql += `insert into flows(id,client_id,nome,rascunho) values('${fluxo}','${C}','Boas-vindas',${grafo});\n`
sql += `insert into flow_versions(id,flow_id,versao,grafo) values('${versao}','${fluxo}',1,${grafo});\n`

// Movimento que cresce ao longo dos 120 dias, com fim de semana mais fraco e
// alguns dias sem nada, para o gráfico mostrar os zeros.
const DIA = 86400000
const hoje = Date.now()
let n = 0
for (let d = 119; d >= 0; d--) {
  const quando = new Date(hoje - d * DIA)
  const fds = [0, 6].includes(quando.getUTCDay())
  const base = 1 + (119 - d) / 30
  if (sorte() < 0.08) continue
  const conversas = Math.round(base * (fds ? 0.4 : 1) * (0.6 + sorte()))
  for (let i = 0; i < conversas; i++) {
    const contato = u(), sessao = u()
    const hora = new Date(quando.getTime() - Math.floor(sorte() * 10) * 3600000)
    const dono = sorte() < 0.15 ? null : pessoas[Math.floor(sorte() * pessoas.length)]
    n++
    sql += `insert into contacts(id,client_id,wa_id,nome,criado_em,atribuido_a) values('${contato}','${C}','5544988${String(n).padStart(6, '0')}','Contato ${n}','${hora.toISOString()}',${dono ? `'${dono}'` : 'null'});\n`
    const r = sorte()
    // 55% o bot resolve, 30% vai para a equipe como previsto, 8% por falha, o resto em andamento.
    const status = r < 0.55 ? 'encerrada' : r < 0.93 ? 'humano' : 'ativa'
    sql += `insert into sessions(id,contact_id,channel_id,flow_version_id,status,criado_em) values('${sessao}','${contato}','${canal}','${versao}','${status}','${hora.toISOString()}');\n`
    if (status === 'humano') {
      const entrou = new Date(hora.getTime() + 5 * 60000)
      const origem = r < 0.85 ? 'prevista' : 'falha'
      const esperou = Math.round(2 + sorte() * sorte() * 180)
      // Fila ainda aberta só nos últimos dias: esquecida há 100 dias seria outro problema.
      const fechou = d > 2 || sorte() < 0.5 ? new Date(entrou.getTime() + (esperou + 20 + sorte() * 600) * 60000) : null
      sql += `insert into handoffs(session_id,motivo,origem,criado_em,resolvido_em) values('${sessao}','Pediu para falar com uma pessoa','${origem}','${entrou.toISOString()}',${fechou ? `'${fechou.toISOString()}'` : 'null'});\n`
      if (sorte() < 0.92) sql += `insert into messages(contact_id,session_id,direcao,texto,ts) values('${contato}','${sessao}','saida','Oi, aqui é da equipe!','${new Date(entrou.getTime() + esperou * 60000).toISOString()}');\n`
    }
    if (sorte() < 0.25) {
      const nota = [10, 10, 9, 9, 9, 8, 8, 7, 6, 4][Math.floor(sorte() * 10)]
      sql += `insert into avaliacoes(cliente_id,contato_id,nota,criada_em) values('${C}','${contato}',${nota},'${new Date(hora.getTime() + 3600000).toISOString()}');\n`
    }
  }
}

// Funil com alguns fechamentos, para o cartão de ganhos e perdas.
const qd = u(), col = u(), colGanho = u()
sql += `insert into quadros(id,client_id,nome,padrao,finalidade) values('${qd}','${C}','Matrículas',true,'comercial');\n`
sql += `insert into quadro_colunas(id,quadro_id,nome,ordem,tipo) values('${col}','${qd}','Novo contato',0,'normal'),('${colGanho}','${qd}','Matriculado',1,'ganho');\n`
const alguns = Array.from({ length: 40 }, (_, i) => i)
sql += 'commit;\n'
psql('', sql)

const contatos = psql(`select id from contacts where client_id='${C}' order by criado_em`).split('\n')
let cartoes = 'begin;\n'
for (const i of alguns) {
  const contato = contatos[Math.floor((i / 40) * contatos.length)]
  const ganhou = sorte() < 0.6
  const fechado = new Date(hoje - Math.floor(sorte() * 119) * DIA).toISOString()
  cartoes += `insert into quadro_cartoes(quadro_id,coluna_id,contact_id,client_id,titulo,valor,responsavel,situacao,fechado_em) values('${qd}','${ganhou ? colGanho : col}','${contato}','${C}','Plano',${ganhou ? [290, 790, 2890][i % 3] : 'null'},'${pessoas[i % 4]}','${ganhou ? 'ganha' : 'perdida'}','${fechado}');\n`
}
cartoes += 'commit;\n'
psql('', cartoes)
console.log(`conta ${C}: ${n} contatos com conversa, 40 fechamentos`)
