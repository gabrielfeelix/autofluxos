// Dados de revisão no Supabase LOCAL: 4 pessoas, 60 contatos com 6 campos,
// 250 atividades (230 abertas, para passar do limite de 200), funil com 24
// cartões, 10 automações (publicadas, rascunho, desligadas), 4 palavras-chave,
// 1 sequência e 1 modelo aprovado.
//
// Uso: npx tsx scripts/ux-local/seed.mts   (depois do cadastro.mjs)
// Roda só contra o container `supabase_db_autofluxos`; não existe caminho daqui
// para produção. Recusa rodar duas vezes na mesma conta.
import { execFileSync } from 'node:child_process'
import { triagem } from '../../src/exemplos/triagem'

const psql = (sql: string, entrada?: string) =>
  execFileSync('docker', ['exec', '-i', 'supabase_db_autofluxos', 'psql', '-U', 'postgres', '-q', '-v', 'ON_ERROR_STOP=1', '-At', ...(sql ? ['-c', sql] : [])], { input: entrada, encoding: 'utf8' }).trim()

const C = psql("select id from clients where nome = 'Studio Pilates Revisão' limit 1")
const EU = psql("select id from af_usuarios where email = 'revisao@local.test'")
if (!C || !EU) throw new Error('rode o cadastro.mjs antes')
if (Number(psql(`select count(*) from contacts where client_id = '${C}'`)) > 0) throw new Error('a conta de revisão já tem dados')

const grafo = JSON.stringify(triagem).replace(/'/g, "''")
const q = (s: unknown) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`)
const u = (): string => crypto.randomUUID()
let sql = 'begin;\n'
sql += `update clients set crm_ativo=true, onboarding='{"status":"concluido","respostas":{}}'::jsonb where id='${C}';\n`
const pessoas = [[EU, 'Gabriel Teste']]
for (const [n, e] of [['Ana Souza', 'ana@local.test'], ['Bruno Lima', 'bruno@local.test'], ['Carla Mendes', 'carla@local.test']]) {
  const id = u(); pessoas.push([id, n])
  sql += `insert into af_usuarios(id,name,email,"emailVerified") values('${id}',${q(n)},${q(e)},true);\n`
  sql += `insert into af_membros("organizationId","userId",role) values('${C}','${id}','member');\n`
}
const etq = ['Aula experimental', 'Plano mensal', 'Plano anual', 'Inadimplente', 'Indicação'].map((n) => { const id = u(); sql += `insert into etiquetas(id,client_id,nome,cor) values('${id}','${C}',${q(n)},'azul');\n`; return id })
const campos = [['cidade', 'Cidade', 'texto_curto'], ['plano', 'Plano', 'texto_curto'], ['aniversario', 'Aniversário', 'data'], ['objetivo', 'Objetivo', 'texto_longo'], ['instagram', 'Instagram', 'texto_curto'], ['indicado_por', 'Indicado por', 'texto_curto']]
for (const [k, r, t] of campos) sql += `insert into campos_definidos(client_id,chave,rotulo,tipo) values('${C}',${q(k)},${q(r)},${q(t)});\n`
const nomes = ['Mariana Alves','João Pedro Rocha','Fernanda Costa','Lucas Martins','Beatriz Ribeiro','Rafael Gomes','Camila Barbosa','Thiago Ferreira','Juliana Castro','Gustavo Pereira','Larissa Nunes','Diego Carvalho','Patrícia Moura','André Teixeira','Aline Cardoso','Rodrigo Pinto','Vanessa Duarte','Felipe Araújo','Renata Lopes','Marcelo Freitas']
const estagios = ['novo','qualificado','negociando','cliente','perdido','inativo'], temps = ['frio','morno','quente']
const contatos = []
for (let i = 0; i < 60; i++) {
  const id = u(); contatos.push(id)
  const nome = `${nomes[i % 20]}${i >= 20 ? ' ' + (i >= 40 ? 'Neto' : 'Filho') : ''}`
  const camposJ = JSON.stringify({ cidade: ['Maringá','Londrina','Cianorte','Sarandi'][i%4], plano: ['Mensal','Trimestral','Anual'][i%3], aniversario: `1990-0${1+i%9}-1${i%9}`, objetivo: 'Melhorar postura e aliviar dor nas costas', instagram: '@aluno' + i, indicado_por: i%5==0 ? 'Daniel' : '' })
  sql += `insert into contacts(id,client_id,wa_id,nome,campos,estado,estagio,temperatura,ultima_mensagem_em,atribuido_a) values('${id}','${C}','55449990${String(1000+i)}',${q(nome)},'${camposJ}'::jsonb,'${['aberta','aberta','resolvida','adiada'][i%4]}','${estagios[i%6]}','${temps[i%3]}',now()-interval '${i*3} hours',${i%4==3?'null':`'${pessoas[i%4][0]}'`});\n`
  sql += `insert into contato_etiquetas(contato_id,etiqueta_id) values('${id}','${etq[i%5]}');\n`
  if (i % 3 == 0) sql += `insert into contato_etiquetas(contato_id,etiqueta_id) values('${id}','${etq[(i+2)%5]}');\n`
}
// funil
const qd = u(); sql += `insert into quadros(id,client_id,nome,padrao,finalidade) values('${qd}','${C}','Matrículas',true,'comercial');\n`
const cols = ['Novo contato','Aula experimental','Proposta enviada','Matriculado'].map((n, i) => { const id = u(); sql += `insert into quadro_colunas(id,quadro_id,nome,ordem,tipo) values('${id}','${qd}',${q(n)},${i},'${i==3?'ganho':'normal'}');\n`; return id })
const cartoes = []
for (let i = 0; i < 24; i++) { const id = u(); cartoes.push(id); sql += `insert into quadro_cartoes(id,quadro_id,coluna_id,contact_id,client_id,titulo,valor,responsavel,situacao) values('${id}','${qd}','${cols[i%4]}','${contatos[i]}','${C}','Plano ${['mensal','trimestral','anual'][i%3]}',${[290,790,2890][i%3]},'${pessoas[i%4][0]}','aberta');\n` }
// atividades: 230 abertas + 20 concluídas
const tipos = ['tarefa','ligacao','reuniao','visita','proposta']
const titulos = { tarefa: 'Enviar contrato', ligacao: 'Ligar para confirmar aula', reuniao: 'Avaliação postural', visita: 'Visita ao estúdio', proposta: 'Enviar proposta do plano anual' }
for (let i = 0; i < 250; i++) {
  const t = tipos[i % 5]; const dias = (i % 30) - 8; const hora = i % 3 == 0
  const prazo = i % 17 == 0 ? 'null' : `date_trunc('day', now()) + interval '${dias} days'${hora ? ` + interval '${8 + i % 10} hours'` : ''}`
  const concl = i >= 230
  sql += `insert into atividades(client_id,contact_id,cartao_id,tipo,titulo,nota,prazo,responsavel,situacao,concluida_em,criada_por,onde,hora_marcada) values('${C}','${contatos[i%60]}',${i%3==0?`'${cartoes[i%24]}'`:'null'},'${t}',${q(titulos[t])},${i%4==0?q('Cliente pediu para ligar depois das 18h'):'null'},${prazo},'${pessoas[i%4][0]}','${concl?'concluida':'aberta'}',${concl?'now()':'null'},'${EU}',${t=='reuniao'?q('https://meet.google.com/abc-defg-hij'):t=='visita'?q('Av. Brasil, 1200 - Maringá'):'null'},${hora});\n`
}
// automações
const pasta = u(); sql += `insert into pastas(id,client_id,nome) values('${pasta}','${C}','Recepção');\n`
const fl = []
const fnomes = ['Boas-vindas','Agendar aula experimental','Reagendamento','Não comparecimento','Pesquisa NPS','Cobrança amigável','Aluno inativo','Menu de atendimento','Aniversariantes','Pós-aula']
fnomes.forEach((n, i) => {
  const id = u(); fl.push(id)
  sql += `insert into flows(id,client_id,nome,rascunho,ativo,canal,ordem,pasta_id,ia_habilitada) values('${id}','${C}',${q(n)},'${grafo}'::jsonb,${i%3!=2},'${i==7?'instagram':'whatsapp'}',${i},${i<3?`'${pasta}'`:'null'},${i==1});\n`
  if (i % 4 != 3) { const v = u(); sql += `insert into flow_versions(id,flow_id,versao,grafo) values('${v}','${id}',1,'${grafo}'::jsonb);\nupdate flows set versao_publicada_id='${v}' where id='${id}';\n` }
})
;[['aula', 'contem', 1], ['remarcar', 'contem', 2], ['menu', 'igual', 7], ['boleto', 'contem', 3]].forEach(([f, o, i]) => { sql += `insert into gatilhos(client_id,frase,operador,flow_id,ativo,execucoes) values('${C}',${q(f)},'${o}','${fl[i]}',true,${i*7});\n` })
const sq = u(); sql += `insert into sequencias(id,client_id,nome,evento,ativa) values('${sq}','${C}','Nutrição pós-aula experimental','atendimento_encerrado',true);\n`
;[[60,9],[720,4],[1380,6]].forEach(([m, i]) => { sql += `insert into sequencia_passos(sequencia_id,atraso_minutos,flow_id) values('${sq}',${m},'${fl[i]}');\n` })
sql += `insert into templates(cliente_id,nome,idioma,categoria,status,componentes) values('${C}','lembrete_de_aula','pt_BR','UTILITY','aprovado','[{"type":"BODY","text":"Oi {{1}}, sua aula é amanhã às {{2}}."}]'::jsonb);\n`
sql += 'commit;\n'
psql('', sql)
console.log('dados de revisão criados na conta', C)
