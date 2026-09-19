'use server'

import { revalidatePath } from 'next/cache'
import { ehTemperatura, lerValor, type Estagio, type Situacao, type TipoDeEtapa } from '@/core/crm'
import { ehCorDaEtapa } from '@/core/quadros'
import { conferirFaixas } from '@/core/relacionamento'
import { definirFaixas } from './repos/relacionamento'
import type { CorDeEtiqueta } from '@/core/etiquetas'
import { LIMITE_DA_NOTA } from '@/core/flow/limites'
import type { EstadoSalvar } from '@/components/design/formulario-salvar'
import { anotar, linhaDoTempo } from './repos/eventos'
import { listarMotivos, criarMotivo, apagarMotivo } from './repos/motivos-de-perda'
import {
  contatoEhDoCliente,
  definirEstagio,
  definirTemperatura,
  fichaDoContato,
  resumoDoContato,
} from './repos/crm'
import { etiquetasDeContatos, listarEtiquetas } from './repos/etiquetas'
import { atribuirContato } from './repos/conversas'
import { agendadasDoContato } from './repos/mensagens-agendadas'
import { membrosDaConta } from './repos/usuarios'
import {
  atribuirCartao,
  criarQuadro,
  definirCorDaEtapa,
  definirTipoDaEtapa,
  descreverCartao,
  encadearQuadro,
  fecharCartao,
  reabrirCartao,
  quadrosDoContato,
  trazerTodosParaOQuadro,
} from './repos/quadros'
import { exigirAcessoAoCliente, sessaoAtual } from './sessao'

/**
 * As ações do funil (0058), em arquivo próprio.
 *
 * Separadas de `acoes.ts` pelo mesmo motivo que o agendamento foi: aquele
 * arquivo já passou de 2.500 linhas, e cada bloco novo lá é mais uma chance de
 * dois trabalhos paralelos colidirem no mesmo lugar.
 */

function quadros(clienteId: string) {
  revalidatePath(`/clientes/${clienteId}/quadros`)
}

/**
 * Ganhar ou perder.
 *
 * O valor chega como texto porque é o que a mão digita — "1.500", "R$ 89,90" —
 * e quem o entende é `core/crm.ts`. Recusar por formato seria transformar a
 * caixa de valor num teste de datilografia.
 */
export async function acaoFecharCartao(
  clienteId: string,
  cartaoId: string,
  situacao: Exclude<Situacao, 'aberta'>,
  dados: { valor?: string; motivo?: string; titulo?: string },
): Promise<{ ok: boolean; erro?: string; abriuEm?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const lido = lerValor(dados.valor ?? '')
  if (!lido.ok) return { ok: false, erro: lido.motivo }

  const quem = await sessaoAtual()
  const r = await fecharCartao(
    clienteId,
    cartaoId,
    situacao,
    { valor: lido.valor, motivo: dados.motivo ?? null, titulo: dados.titulo ?? null },
    quem?.usuario.nome ?? null,
  )

  if (!r.ok) return { ok: false, erro: r.motivo }

  quadros(clienteId)
  return { ok: true, abriuEm: r.abriuEm }
}

/** Fechar é um clique, e errar o clique é rotina. */
export async function acaoReabrirCartao(
  clienteId: string,
  cartaoId: string,
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const r = await reabrirCartao(clienteId, cartaoId)
  if (!r.ok) return { ok: false, erro: r.motivo }

  quadros(clienteId)
  return { ok: true }
}

/** `null` devolve o cartão à fila de ninguém — e isso é uma ação legítima. */
export async function acaoAtribuirCartao(
  clienteId: string,
  cartaoId: string,
  usuarioId: string | null,
): Promise<{ ok: boolean; erro?: string; quem?: string | null }> {
  await exigirAcessoAoCliente(clienteId)

  const quemFez = await sessaoAtual()
  const r = await atribuirCartao(clienteId, cartaoId, usuarioId, quemFez?.usuario.nome ?? null)
  if (!r.ok) return { ok: false, erro: r.motivo }

  quadros(clienteId)
  return { ok: true, quem: r.quem }
}

/** O que está sendo vendido, e por quanto. Texto livre: não há catálogo. */
export async function acaoDescreverCartao(
  clienteId: string,
  cartaoId: string,
  dados: { titulo?: string; valor?: string },
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const lido = lerValor(dados.valor ?? '')
  if (!lido.ok) return { ok: false, erro: lido.motivo }

  const r = await descreverCartao(clienteId, cartaoId, {
    titulo: dados.titulo ?? null,
    valor: lido.valor,
  })
  if (!r.ok) return { ok: false, erro: r.motivo }

  quadros(clienteId)
  return { ok: true }
}

/**
 * Liga este funil ao seguinte: o SDR entrega ao vendedor, o vendedor ao
 * pós-venda. Ganhar aqui abre o cartão lá.
 */
export async function acaoEncadearQuadro(
  clienteId: string,
  quadroId: string,
  seguinteId: string | null,
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const r = await encadearQuadro(clienteId, quadroId, seguinteId)
  if (!r.ok) return { ok: false, erro: r.motivo }

  quadros(clienteId)
  return { ok: true }
}

/** O papel da etapa: cair em `ganho` fecha a venda; em `perdido`, pede motivo. */
export async function acaoDefinirTipoDaEtapa(
  clienteId: string,
  quadroId: string,
  etapaId: string,
  tipo: TipoDeEtapa,
  limiteDeDias: number | null,
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  if (limiteDeDias !== null && (!Number.isInteger(limiteDeDias) || limiteDeDias < 1 || limiteDeDias > 365)) {
    return { ok: false, erro: 'o limite vai de 1 a 365 dias' }
  }

  const r = await definirTipoDaEtapa(clienteId, quadroId, etapaId, tipo, limiteDeDias)
  if (!r.ok) return { ok: false, erro: r.motivo }

  quadros(clienteId)
  return { ok: true }
}

/**
 * A cor do cabeçalho da etapa. `null` volta ao cinza.
 *
 * A cor chega da tela como texto, e `ehCorDaEtapa` é a porta: sem ela, um valor
 * inventado passaria pelo TypeScript (que não roda no cliente) e só seria
 * barrado pelo `check` do banco, como erro 500 em vez de recusa limpa.
 */
export async function acaoDefinirCorDaEtapa(
  clienteId: string,
  quadroId: string,
  etapaId: string,
  cor: string | null,
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  if (cor !== null && !ehCorDaEtapa(cor)) return { ok: false, erro: 'esta cor não existe' }

  const r = await definirCorDaEtapa(clienteId, quadroId, etapaId, cor)
  if (!r.ok) return { ok: false, erro: r.motivo }

  quadros(clienteId)
  return { ok: true }
}

/**
 * O que é ouro e o que é prata nesta conta.
 *
 * Os valores chegam como texto porque é o que a mão digita — "5.000", "R$
 * 5000", "5000,00" — e quem os entende é `lerValor`, o mesmo do valor do
 * cartão. Recusar por formato seria transformar a caixa num teste de
 * datilografia.
 *
 * Vazio é recusado aqui, e não tratado como zero: apagar o campo e salvar é
 * quase sempre engano, e "ouro a partir de R$ 0" faria toda a base virar ouro
 * de uma vez.
 */
export async function acaoDefinirFaixas(
  clienteId: string,
  ouroBruto: string,
  prataBruto: string,
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const ouro = lerValor(ouroBruto)
  const prata = lerValor(prataBruto)
  if (!ouro.ok) return { ok: false, erro: `ouro: ${ouro.motivo}` }
  if (!prata.ok) return { ok: false, erro: `prata: ${prata.motivo}` }
  if (ouro.valor === null || prata.valor === null) {
    return { ok: false, erro: 'preencha os dois valores' }
  }

  const conferido = conferirFaixas({ ouro: ouro.valor, prata: prata.valor })
  if (!conferido.ok) return { ok: false, erro: conferido.motivo }

  await definirFaixas(clienteId, { ouro: ouro.valor, prata: prata.valor })
  revalidatePath(`/clientes/${clienteId}/leads`)
  revalidatePath(`/clientes/${clienteId}/ajustes/negocio`)
  return { ok: true }
}

/** A lista de motivos da conta, semeada na primeira leitura. */
export async function acaoListarMotivos(
  clienteId: string,
): Promise<{ motivos: { id: string; nome: string }[] }> {
  await exigirAcessoAoCliente(clienteId)
  const motivos = await listarMotivos(clienteId)
  return { motivos: motivos.map(({ id, nome }) => ({ id, nome })) }
}

export async function acaoCriarMotivo(
  clienteId: string,
  nome: string,
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const r = await criarMotivo(clienteId, nome)
  if (!r.ok) return { ok: false, erro: r.motivo }

  quadros(clienteId)
  return { ok: true }
}

/** Apagar o motivo **não reescreve as perdas antigas** — elas guardam o texto. */
export async function acaoApagarMotivo(
  clienteId: string,
  motivoId: string,
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const apagou = await apagarMotivo(clienteId, motivoId)
  quadros(clienteId)
  return apagou ? { ok: true } : { ok: false, erro: 'este motivo não existe mais' }
}

/**
 * Tudo que o painel lateral mostra, numa chamada.
 *
 * Numa só porque o painel abre inteiro — buscar bloco a bloco seria a tela
 * montando em sete tempos debaixo do cursor de quem já está lendo.
 *
 * **O que entra aqui saiu de como os CRMs de verdade montam esse painel**
 * (HubSpot, Pipedrive, RD Station, Close, Copper). A ordem que todos repetem é
 * identidade → valor e etapa → responsável → **próxima ação** → atividade
 * recente, e o campo mais citado da pesquisa inteira é o par "último contato /
 * próximo contato agendado": a RD o põe no próprio cartão, a Close põe tarefas
 * no topo da coluna. `agendadas` é a nossa versão disso, e o dado já existia
 * sem tela nenhuma no funil.
 *
 * `funis` responde a pergunta que o painel não sabia responder: a mesma pessoa
 * pode ter cartão no funil do SDR e no de pós-venda, e o painel mostrava só o
 * cartão clicado, como se fosse o único.
 *
 * **O que deliberadamente não entra**: a jornada de anúncios (dezenas de
 * linhas) e os campos coletados pelo fluxo (despejo do bot). Os dois ficam na
 * ficha completa. É a lição unânime da pesquisa — HubSpot limita o painel por
 * arquitetura, Salesforce corta em sete campos, Copper recomenda 4 a 5: painel
 * que mostra tudo vira a ficha completa e perde a razão de existir.
 */
export async function acaoAbrirPainelDoContato(
  clienteId: string,
  contatoId: string,
): Promise<{
  ficha: Awaited<ReturnType<typeof fichaDoContato>>
  eventos: Awaited<ReturnType<typeof linhaDoTempo>>
  resumo: { total: number; compras: number; ultimaEm: string | null }
  etiquetas: { id: string; nome: string; cor: CorDeEtiqueta }[]
  aplicadas: string[]
  equipe: { id: string; nome: string }[]
  /** O que já está marcado para sair. Vazio é o caso comum. */
  agendadas: { id: string; texto: string; quando: string; estado: string }[]
  /** Um por funil em que a pessoa está — inclusive o que não foi clicado. */
  funis: Awaited<ReturnType<typeof quadrosDoContato>>
  /** Os motivos da conta, para fechar como perdida sem sair do painel. */
  motivos: { id: string; nome: string }[]
}> {
  await exigirAcessoAoCliente(clienteId)

  const [ficha, eventos, resumo, etiquetas, porContato, equipe, agendadas, funis, motivos] =
    await Promise.all([
      fichaDoContato(clienteId, contatoId),
      linhaDoTempo(clienteId, contatoId),
      resumoDoContato(clienteId, contatoId),
      listarEtiquetas(clienteId),
      etiquetasDeContatos([contatoId]),
      membrosDaConta(clienteId),
      agendadasDoContato(clienteId, contatoId),
      quadrosDoContato(clienteId, contatoId),
      listarMotivos(clienteId),
    ])

  return {
    ficha,
    eventos,
    resumo,
    etiquetas: etiquetas.map(({ id, nome, cor }) => ({ id, nome, cor })),
    aplicadas: (porContato.get(contatoId) ?? []).map((etiqueta) => etiqueta.id),
    equipe: equipe.map(({ id, nome }) => ({ id, nome })),
    // Só o que o painel desenha: o texto inteiro de uma agendada pode ter mil
    // caracteres, e mandar tudo para mostrar duas linhas é peso por nada.
    agendadas: agendadas.map(({ id, texto, quando, estado }) => ({
      id,
      texto: texto.slice(0, 160),
      quando,
      estado,
    })),
    funis,
    motivos: motivos.map(({ id, nome }) => ({ id, nome })),
  }
}

/**
 * A temperatura na mão (0068).
 *
 * Recusa valor que a régua não conhece: ele chega da tela, e `check` no banco
 * devolveria erro de Postgres em vez de frase. Ver `core/crm.ts`.
 */
export async function acaoDefinirTemperatura(
  clienteId: string,
  contatoId: string,
  temperatura: string,
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  if (!ehTemperatura(temperatura)) return { ok: false, erro: 'essa temperatura não existe' }

  const quem = await sessaoAtual()
  const mudou = await definirTemperatura(
    clienteId,
    contatoId,
    temperatura,
    quem?.usuario.nome ?? null,
  )
  if (!mudou) return { ok: false, erro: 'este contato não existe mais' }

  quadros(clienteId)
  revalidatePath(`/clientes/${clienteId}/leads/${contatoId}`)
  return { ok: true }
}

/** O ajuste na mão do estágio. Existe, e é exceção. */
export async function acaoDefinirEstagio(
  clienteId: string,
  contatoId: string,
  estagio: Estagio,
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const quem = await sessaoAtual()
  const mudou = await definirEstagio(clienteId, contatoId, estagio, quem?.usuario.nome ?? null)
  if (!mudou) return { ok: false, erro: 'este contato não existe mais' }

  quadros(clienteId)
  revalidatePath(`/clientes/${clienteId}/leads/${contatoId}`)
  return { ok: true }
}

/**
 * Traz para o funil todo mundo que ainda está de fora.
 *
 * Existe porque a entrada automática só alcança contato **criado agora** — e
 * está certo assim: quem já existia e voltou a escrever não pode ser jogado de
 * volta para a primeira etapa a cada mensagem. O preço disso é quadro novo em
 * conta antiga abrindo vazio com o inbox cheio, e este botão é o conserto.
 */
export async function acaoTrazerTodosParaOQuadro(
  clienteId: string,
  quadroId: string,
): Promise<{ ok: boolean; erro?: string; postos?: number; faltaram?: number }> {
  await exigirAcessoAoCliente(clienteId)

  const r = await trazerTodosParaOQuadro(clienteId, quadroId)
  if (!r.ok) return { ok: false, erro: r.motivo }

  quadros(clienteId)
  return { ok: true, postos: r.postos, faltaram: r.faltaram }
}

/**
 * Cria o quadro a partir de um modelo, e devolve o que aconteceu.
 *
 * Existe separada de `acaoCriarQuadro` porque o modal de criação **não é mais um
 * formulário**: ele precisa fechar sozinho no sucesso e mostrar a recusa sem
 * recarregar — "já existe um quadro com este nome" chegava como nada, e a tela
 * ficava parada com o botão clicado, parecendo travada.
 */
export async function acaoCriarQuadroComModelo(
  clienteId: string,
  nome: string,
  modeloId: string | null,
): Promise<{ ok: boolean; erro?: string; id?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const r = await criarQuadro(clienteId, String(nome ?? ''), modeloId)
  if (!r.ok) return { ok: false, erro: r.motivo }

  quadros(clienteId)
  return { ok: true, id: r.id }
}

/**
 * Quem cuida desta pessoa, mudado da ficha dela.
 *
 * O Inbox já tinha o gesto ("Assumir"), e ele era sobre si mesmo: eu pego, eu
 * largo. Na ficha a pergunta é outra — quem *deveria* cuidar —, e a resposta
 * costuma ser outra pessoa. Por isso aqui a lista é a equipe inteira, e
 * `null` devolve o contato à fila de ninguém, que é estado legítimo.
 *
 * Grava o mesmo evento `assumiu` que o cartão grava: a linha do tempo não tem
 * por que distinguir se o nome mudou pelo funil ou pela ficha.
 */
export async function acaoAtribuirContato(
  clienteId: string,
  contatoId: string,
  usuarioId: string | null,
): Promise<{ ok: boolean; erro?: string }> {
  await exigirAcessoAoCliente(clienteId)

  const equipe = await membrosDaConta(clienteId)
  const escolhido = usuarioId === null ? null : equipe.find((membro) => membro.id === usuarioId)
  if (usuarioId !== null && !escolhido) {
    return { ok: false, erro: 'essa pessoa não atende nesta conta' }
  }

  const ok = await atribuirContato(clienteId, contatoId, usuarioId)
  if (!ok) return { ok: false, erro: 'este contato não é deste cliente' }

  const quemFez = await sessaoAtual()
  await anotar(
    clienteId,
    contatoId,
    'assumiu',
    { quem: escolhido?.nome ?? '' },
    quemFez?.usuario.nome ?? null,
  )

  revalidatePath(`/clientes/${clienteId}/leads/${contatoId}`)
  revalidatePath(`/clientes/${clienteId}/inbox`)
  return { ok: true }
}

/**
 * Uma anotação no diário do contato.
 *
 * ---------------------------------------------------------------------------
 * Por que evento, e não uma segunda tabela
 * ---------------------------------------------------------------------------
 *
 * `eventos_do_contato` já é "o que aconteceu em volta da conversa, em ordem, com
 * autor e hora". Uma nota escrita à mão é exatamente isso, e `'nota'` já estava
 * no enum de tipos desde a 0058 com `comoFrase` sabendo lê-la: faltava só quem
 * escrevesse. Tabela nova guardaria os mesmos cinco campos e obrigaria a ficha a
 * juntar duas listas ordenadas para mostrar uma linha do tempo só.
 *
 * ---------------------------------------------------------------------------
 * O diário não substitui `contacts.notas`
 * ---------------------------------------------------------------------------
 *
 * São perguntas diferentes, e é por isso que os dois continuam existindo. A
 * anotação do contato responde *"o que eu preciso saber sobre esta pessoa antes
 * de falar com ela"* e por isso é sobrescrita: preferência de horário muda, e o
 * valor velho não interessa. O diário responde *"o que aconteceu, e quando"*, e
 * por isso nunca é reescrito. Misturar os dois faria a primeira virar uma
 * rolagem que ninguém lê antes de atender.
 *
 * `anotar` engole o próprio erro (ver `repos/eventos.ts`), então a conferência de
 * dono acontece **antes**: sem ela, anotar num contato de outra conta falharia
 * calado e a tela diria que salvou.
 */
export async function acaoAnotarNoDiario(
  clienteId: string,
  contatoId: string,
  _estado: EstadoSalvar,
  formData: FormData,
): Promise<EstadoSalvar> {
  await exigirAcessoAoCliente(clienteId)

  const texto = String(formData.get('texto') ?? '')
    .trim()
    .slice(0, LIMITE_DA_NOTA)
  if (texto === '') return { erro: 'escreva alguma coisa antes de salvar' }

  if (!(await contatoEhDoCliente(clienteId, contatoId))) {
    return { erro: 'este contato não é deste cliente' }
  }

  const quemFez = await sessaoAtual()
  await anotar(clienteId, contatoId, 'nota', { texto }, quemFez?.usuario.nome ?? null)

  revalidatePath(`/clientes/${clienteId}/leads/${contatoId}`)
  revalidatePath(`/clientes/${clienteId}/quadros`)
  return { ok: true }
}
