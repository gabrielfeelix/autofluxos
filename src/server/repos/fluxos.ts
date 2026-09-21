import 'server-only'
import { CANAL_PADRAO, type CanalId } from '@/core/canais'
import { fluxoSchema, type Fluxo } from '@/core/flow/schema'
import { LIMITE_NOME_DO_FLUXO } from '@/core/flow/limites'
import { validar, type Problema } from '@/core/flow/validar'
import { validarPublicacao } from '@/core/validar-publicacao'
import { db, ehIdInvalido, pareceUuid } from '../db'
import { listarConexoes } from './conexoes'
import { sequenciasQueUsamOFluxo } from './sequencias'
import { listarEtiquetas } from './etiquetas'
import { listarQuadros } from './quadros'
import { acharCliente } from './clientes'

/**
 * Um fluxo salvo no banco. `rascunho` é o grafo mutável, o que o editor
 * escreve. O publicado vira linha imutável em `flow_versions` no passo 5.
 */
export type FluxoSalvo = {
  id: string
  clienteId: string
  nome: string
  rascunho: Fluxo
  atualizadoEm: string
  /** `null` = nunca publicado. */
  versaoPublicadaId: string | null
  /**
   * Etapa 2 contratada **para esta automação** (0005).
   *
   * Fica no fluxo e não no cliente porque é a automação que se vende: o mesmo
   * negócio pode ter uma triagem simples e uma automação com IA.
   */
  iaHabilitada: boolean
  /** A gaveta em que ele aparece na lista (0029). Nulo = raiz. */
  pastaId: string | null
  /**
   * Ligado? (0036)
   *
   * Desligado **não abre conversa nova**, nenhum papel do número, nenhum
   * gatilho, nenhuma campanha e nenhum salto de outro fluxo entram aqui. O que
   * já estava andando termina: cortar no meio de uma pergunta deixaria a pessoa
   * falando sozinha, e quem desligou queria parar de captar.
   *
   * É diferente de publicar: publicado diz **o que** o fluxo faz quando roda;
   * ativo diz **se** ele roda. Sem esta coluna, "pausar por uns dias" só existia
   * como apagar ou desligar o número inteiro.
   */
  ativo: boolean
  /**
   * Por onde esta automação conversa (0037).
   *
   * É escolhido ao criar e não muda depois: os limites que o `validar()` cobra
   * são os do canal, então trocar o canal de um desenho pronto transformaria um
   * fluxo válido em inválido, ou, pior, num fluxo aceito por medidas que não
   * são as de quem vai executá-lo. Quem quer o mesmo atendimento em dois canais
   * duplica a automação, que é o que ManyChat e Chatfuel também fazem.
   */
  canal: CanalId
}

/** Uma foto imutável do fluxo. É isto que as conversas executam. */
export type VersaoPublicada = {
  id: string
  /**
   * De qual fluxo esta versão saiu.
   *
   * A sessão guarda a **versão**, não o fluxo, e até a A6 dava para deduzir o
   * fluxo pelo número que a conversa entrou (era um só). Com quatro papéis por
   * número e gatilhos que abrem qualquer fluxo, deduzir passou a errar, e
   * quem lê isso é o portão comercial da IA, que não pode olhar para o contrato
   * do fluxo errado.
   */
  fluxoId: string
  versao: number
  publicadoEm: string
  grafo: Fluxo
}

type Linha = {
  id: string
  client_id: string
  nome: string
  rascunho: unknown
  atualizado_em: string
  versao_publicada_id: string | null
  ia_habilitada: boolean
  pasta_id: string | null
  ativo: boolean
  canal: string
  ordem: number | null
}

const COLUNAS =
  'id, client_id, nome, rascunho, atualizado_em, versao_publicada_id, ia_habilitada, pasta_id, ativo, canal, ordem'

/**
 * `rascunho` é `jsonb`: o banco aceita qualquer coisa ali. Uma migração
 * malfeita, um `update` na mão pelo painel, uma versão antiga do schema, e o
 * motor receberia lixo. Validar na leitura é a mesma disciplina da fronteira
 * de rede, e o erro aponta o fluxo culpado em vez de estourar lá dentro.
 */
function paraFluxo(linha: Linha): FluxoSalvo {
  const analise = fluxoSchema.safeParse(linha.rascunho)
  if (!analise.success) {
    throw new Error(
      `o fluxo "${linha.nome}" (${linha.id}) está com o grafo inválido no banco: ` +
        analise.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; '),
    )
  }

  return {
    id: linha.id,
    clienteId: linha.client_id,
    nome: linha.nome,
    rascunho: analise.data,
    atualizadoEm: linha.atualizado_em,
    versaoPublicadaId: linha.versao_publicada_id,
    iaHabilitada: linha.ia_habilitada,
    pastaId: linha.pasta_id,
    ativo: linha.ativo,
    // O `check` do banco já garante o conjunto; o `as` aqui é a fronteira entre
    // `text` e o tipo do domínio, como em todo `paraFluxo`.
    canal: (linha.canal as CanalId) ?? CANAL_PADRAO,
  }
}

export async function listarFluxos(clienteId: string): Promise<FluxoSalvo[]> {
  const { data, error } = await db()
    .from('flows')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    /*
     * A posição escolhida primeiro; quem nunca foi arrastado vai para o fim,
     * na ordem em que nasceu, que é como a lista sempre saiu (migration 0046).
     */
    .order('ordem', { ascending: true, nullsFirst: false })
    .order('criado_em', { ascending: true })

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para listar os fluxos: ${error.message}`)
  return (data as Linha[]).map(paraFluxo)
}

export async function acharFluxo(id: string): Promise<FluxoSalvo | null> {
  const { data, error } = await db().from('flows').select(COLUNAS).eq('id', id).maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para buscar o fluxo: ${error.message}`)
  return data ? paraFluxo(data as Linha) : null
}

export async function criarFluxo(
  clienteId: string,
  nome: string,
  rascunho: Fluxo,
  iaHabilitada = false,
  canal: CanalId = CANAL_PADRAO,
): Promise<FluxoSalvo> {
  const { data, error } = await db()
    .from('flows')
    .insert({
      client_id: clienteId,
      nome: nome.trim(),
      rascunho: fluxoSchema.parse(rascunho),
      ia_habilitada: iaHabilitada,
      canal,
    })
    .select(COLUNAS)
    .single()

  if (error) throw new Error(`não deu para criar o fluxo: ${error.message}`)
  return paraFluxo(data as Linha)
}

/** Salva o desenho. Valida antes de gravar, o banco nunca recebe grafo torto. */
export async function salvarRascunho(
  fluxoId: string,
  clienteId: string,
  rascunho: Fluxo,
): Promise<void> {
  const { data, error } = await db()
    .from('flows')
    .update({ rascunho: fluxoSchema.parse(rascunho) })
    .eq('id', fluxoId)
    .eq('client_id', clienteId)
    .select('id')
    .maybeSingle()

  if (error) throw new Error(`não deu para salvar o rascunho: ${error.message}`)
  if (!data) throw new Error('esta automação não existe mais')
}

export async function acharVersao(id: string): Promise<VersaoPublicada | null> {
  const { data, error } = await db()
    .from('flow_versions')
    .select('id, flow_id, versao, publicado_em, grafo')
    .eq('id', id)
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para buscar a versão publicada: ${error.message}`)
  if (!data) return null

  return {
    id: data.id as string,
    fluxoId: data.flow_id as string,
    versao: data.versao as number,
    publicadoEm: data.publicado_em as string,
    grafo: fluxoSchema.parse(data.grafo),
  }
}

/**
 * Uma versão específica **desta** automação.
 *
 * O par (versão, fluxo) vem junto porque o id da versão chega da tela, e a tela
 * é adivinhável. Sem o `flow_id` no filtro, mandar o id de uma versão de outro
 * cliente publicaria o desenho dele aqui dentro, o mesmo buraco que a fase 1
 * fechou nas outras escritas.
 */
export async function acharVersaoDoFluxo(
  versaoId: string,
  fluxoId: string,
): Promise<VersaoPublicada | null> {
  const { data, error } = await db()
    .from('flow_versions')
    .select('id, flow_id, versao, publicado_em, grafo')
    .eq('id', versaoId)
    .eq('flow_id', fluxoId)
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para buscar a versão publicada: ${error.message}`)
  if (!data) return null

  return {
    id: data.id as string,
    fluxoId: data.flow_id as string,
    versao: data.versao as number,
    publicadoEm: data.publicado_em as string,
    grafo: fluxoSchema.parse(data.grafo),
  }
}

export async function listarVersoes(
  fluxoId: string,
): Promise<Omit<VersaoPublicada, 'grafo' | 'fluxoId'>[]> {
  const { data, error } = await db()
    .from('flow_versions')
    .select('id, versao, publicado_em')
    .eq('flow_id', fluxoId)
    .order('versao', { ascending: false })

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para listar as versões: ${error.message}`)
  return (data as { id: string; versao: number; publicado_em: string }[]).map((v) => ({
    id: v.id,
    versao: v.versao,
    publicadoEm: v.publicado_em,
  }))
}

/**
 * Publica o desenho: guarda o rascunho como versão imutável e aponta o fluxo
 * para ela.
 *
 * **O portão de qualidade é aqui, não no botão.** O botão desabilitado é
 * conveniência; um fluxo sem saída para humano tem que ser recusado mesmo que
 * a chamada venha de outro lugar.
 *
 * Salva o rascunho junto, de propósito: publicar tem que publicar exatamente o
 * que está na tela de quem clicou, e não uma versão anterior que por acaso
 * estava no banco.
 *
 * O contrato de IA é lido **aqui**, do banco, e não recebido por parâmetro. Um
 * booleano que chega de fora é um booleano que a chamada errada manda `true` ,
 * e este é o portão que separa quem paga pela Etapa 2 de quem não paga.
 */
export async function publicar(
  fluxoId: string,
  clienteId: string,
  grafo: unknown,
): Promise<{ ok: true; versao: VersaoPublicada } | { ok: false; erros: Problema[] }> {
  const analise = fluxoSchema.safeParse(grafo)
  if (!analise.success) {
    return {
      ok: false,
      erros: [{ codigo: 'ESTRUTURA_INVALIDA', mensagem: 'O desenho chegou com formato inválido.' }],
    }
  }

  const fluxo = await acharFluxo(fluxoId)
  if (!fluxo || fluxo.clienteId !== clienteId) {
    return {
      ok: false,
      erros: [{ codigo: 'FLUXO_SUMIU', mensagem: 'Este fluxo não existe mais.' }],
    }
  }

  // As conexões entram aqui, e não só no editor: uma aba aberta há uma hora
  // publicaria fluxo apontando para credencial já apagada. Recusa de tela é
  // conveniência; a que vale é esta.
  const conexoes = (await listarConexoes(fluxo.clienteId)).map((c) => c.id)
  const cliente = await acharCliente(fluxo.clienteId)
  // As etapas entram pelo mesmo motivo das conexões: uma aba aberta há uma hora
  // publicaria fluxo apontando para etapa já apagada, e o bloco não moveria
  // ninguém, em silêncio, que é o pior jeito de um fluxo deixar de funcionar.
  const etapas = (await listarQuadros(fluxo.clienteId)).flatMap((quadro) =>
    quadro.etapas.map((etapa) => etapa.id),
  )
  // E as etiquetas pelo mesmo motivo das etapas (0044): publicar apontando para
  // etiqueta apagada entrega um bloco que não marca ninguém, calado.
  const etiquetas = (await listarEtiquetas(fluxo.clienteId)).map((e) => e.id)
  const conferido = validar(analise.data, {
    iaHabilitada: fluxo.iaHabilitada,
    conexoes,
    etapas,
    etiquetas,
    temContextoDeNegocio: (cliente?.contextoNegocio ?? '').trim() !== '',
    // Sem isto, um fluxo de Instagram publicava com as medidas do WhatsApp, e
    // era o adaptador quem cortava depois, calado, na conversa de alguém.
    canal: fluxo.canal,
  })
  if (!conferido.ok) return { ok: false, erros: conferido.erros }

  /*
   * A segunda conferência: o desenho funciona, mas está **pronto para receber
   * gente de verdade**? (RB-45, T7.2)
   *
   * Ela vem depois de `validar()` de propósito: desenho quebrado é a notícia
   * mais urgente, e quem tem fluxo sem saída humana não precisa ouvir antes
   * sobre o endereço de exemplo.
   *
   * O que ela pega e `validar()` não: o texto de demonstração que veio do
   * modelo. Os modelos de `exemplos/` trazem "Rua Exemplo, 123", "a partir de
   * R$ 000" e "cole aqui o link", e a RB-43 manda copiá-los para um rascunho
   * editável: publicar sem trocar manda isso para o cliente de verdade de
   * alguém.
   */
  const daPublicacao = validarPublicacao(analise.data, {
    temEntrada: await temEntradaLigada(fluxo.clienteId, fluxoId),
  })
  if (!daPublicacao.ok) return { ok: false, erros: daPublicacao.erros }

  await salvarRascunho(fluxoId, clienteId, analise.data)

  const { data, error } = await db().rpc('publicar_fluxo', {
    p_flow_id: fluxoId,
    p_grafo: analise.data,
  })

  if (error) throw new Error(`não deu para publicar: ${error.message}`)

  const linha = data as {
    id: string
    flow_id: string
    versao: number
    publicado_em: string
    grafo: unknown
  }
  return {
    ok: true,
    versao: {
      id: linha.id,
      fluxoId: linha.flow_id,
      versao: linha.versao,
      publicadoEm: linha.publicado_em,
      grafo: fluxoSchema.parse(linha.grafo),
    },
  }
}

/**
 * Apaga uma automação.
 *
 * Recusa quando ela está no ar em algum número: apagar um fluxo publicado que
 * um número executa deixa o bot mudo no WhatsApp de gente de verdade, e o
 * caminho honesto é desligar o número do fluxo primeiro, um ato deliberado, em
 * vez de um efeito colateral de "apagar aquele teste ali".
 *
 * O par (fluxo, cliente) vem junto porque a URL é adivinhável, como em toda
 * escrita por aqui.
 */
export async function apagarFluxo(
  clienteId: string,
  fluxoId: string,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  // O filtro abaixo é uma string do PostgREST, e id que vira sintaxe é a mesma
  // classe de erro que injeção. Conferir a forma antes é mais barato do que
  // escapar, e um id que não parece uuid não existe mesmo.
  if (!pareceUuid(fluxoId)) return { ok: false, motivo: 'esta automação não existe mais' }

  // **Os quatro papéis, não só o principal** (0024). Um fluxo que só é o
  // "padrão para mídia" de um número não aparecia nesta conferência quando ela
  // olhava apenas `flow_id`, e apagá-lo devolveria a mídia ao handoff sem
  // ninguém ter pedido, em silêncio, que é o pior jeito de um produto mudar.
  const { data: canais, error: erroDosCanais } = await db()
    .from('channels')
    .select('phone_number_id')
    .or(
      [
        `flow_id.eq.${fluxoId}`,
        `flow_boas_vindas_id.eq.${fluxoId}`,
        `flow_midia_id.eq.${fluxoId}`,
        `flow_pos_atendimento_id.eq.${fluxoId}`,
      ].join(','),
    )

  if (ehIdInvalido(erroDosCanais)) return { ok: false, motivo: 'esta automação não existe mais' }
  if (erroDosCanais) throw new Error(`não deu para conferir os números: ${erroDosCanais.message}`)

  const ligados = (canais as { phone_number_id: string }[]) ?? []
  if (ligados.length > 0) {
    const numeros = [...new Set(ligados.map((c) => c.phone_number_id))]
    return {
      ok: false,
      motivo: `esta automação está ligada ao número ${numeros.join(', ')}. Desligue lá primeiro, apagar agora deixaria o bot mudo no WhatsApp.`,
    }
  }

  // **E as sequências (0031)**, pela mesma razão dos quatro papéis: um fluxo
  // que é o passo 2 de um acompanhamento está tão em uso quanto o principal, e
  // apagá-lo pararia a sequência em silêncio. A chave estrangeira do passo é
  // `on delete restrict`, então o banco recusaria de qualquer forma, o que
  // esta conferência acrescenta é a frase que diz onde ir desligar.
  const sequencias = await sequenciasQueUsamOFluxo(fluxoId)
  if (sequencias.length > 0) {
    return {
      ok: false,
      motivo: `esta automação é um passo da sequência ${sequencias.join(', ')}. Tire o passo de lá primeiro, apagar agora pararia o acompanhamento no meio.`,
    }
  }

  /*
   * **E os outros fluxos que saltam para este.**
   *
   * O bloco `ir-fluxo` vive dentro do grafo, não numa tabela, então não existe
   * chave estrangeira para o banco recusar, diferente do número e da
   * sequência acima. Sem esta conferência, apagar um fluxo de destino deixava
   * o salto apontando para o vazio: quem chegasse ali ia para uma pessoa, e o
   * único lugar onde isso aparecia era o validador **do outro fluxo**, na
   * próxima vez que alguém fosse publicá-lo.
   */
  const apontam = await fluxosQueSaltamPara(clienteId, fluxoId)
  if (apontam.length > 0) {
    return {
      ok: false,
      motivo: `${apontam.length === 1 ? 'a automação' : 'as automações'} ${apontam.join(', ')} ${apontam.length === 1 ? 'salta' : 'saltam'} para esta. Tire o bloco "ir para outra automação" de lá primeiro, apagar agora deixaria o salto sem destino.`,
    }
  }

  const { error } = await db().from('flows').delete().eq('id', fluxoId).eq('client_id', clienteId)
  if (error) throw new Error(`não deu para apagar a automação: ${error.message}`)
  return { ok: true }
}

/**
 * Quem salta para este fluxo, a consulta reversa do bloco `ir-fluxo`.
 *
 * **Existe porque o salto não tem chave estrangeira.** O destino mora dentro do
 * `rascunho`, que é `jsonb`, então o banco não sabe que uma automação depende
 * da outra: apagar a de destino é aceito sem reclamar e quebra a de origem em
 * silêncio.
 *
 * Filtra por `client_id` como toda leitura daqui, e aqui isso importa duas
 * vezes: sem o filtro, a frase de recusa citaria o **nome de uma automação de
 * outro cliente**, que é vazamento de dado por mensagem de erro.
 *
 * Lê o rascunho, e não a versão publicada, de propósito: quem está desenhando
 * um salto para este fluxo agora ainda não publicou, e apagar o destino
 * quebraria justamente o trabalho em curso.
 */
export async function fluxosQueSaltamPara(
  clienteId: string,
  fluxoId: string,
): Promise<string[]> {
  if (!pareceUuid(fluxoId)) return []

  const { data, error } = await db()
    .from('flows')
    .select('id, nome, rascunho')
    .eq('client_id', clienteId)
    .neq('id', fluxoId)

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para conferir os saltos: ${error.message}`)

  const linhas = (data ?? []) as unknown as { id: string; nome: string; rascunho: unknown }[]

  return linhas
    .filter((linha) => {
      /*
       * Lê o grafo cru, sem passar pelo schema.
       *
       * Um rascunho que não dá parse, grafo de uma versão antiga, meio
       * salvo, não pode fazer a conferência estourar e impedir que alguém
       * apague qualquer coisa. Aqui só interessa uma pergunta: existe um nó
       * `ir-fluxo` apontando para este id?
       */
      const nos = (linha.rascunho as { nodes?: unknown } | null)?.nodes
      if (!Array.isArray(nos)) return false
      return nos.some(
        (no) =>
          (no as { type?: string })?.type === 'ir-fluxo' &&
          (no as { data?: { fluxoId?: string } })?.data?.fluxoId === fluxoId,
      )
    })
    .map((linha) => linha.nome)
}

/**
 * Liga ou desliga a automação inteira (0036).
 *
 * Devolve `false` quando o fluxo não é deste cliente, o par (fluxo, cliente)
 * anda junto em toda escrita daqui, porque a URL é adivinhável.
 */
export async function definirAtivo(
  clienteId: string,
  fluxoId: string,
  ativo: boolean,
): Promise<boolean> {
  if (!pareceUuid(fluxoId)) return false

  const { data, error } = await db()
    .from('flows')
    .update({ ativo })
    .eq('id', fluxoId)
    .eq('client_id', clienteId)
    .select('id')
    .maybeSingle()

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não deu para ligar/desligar a automação: ${error.message}`)
  return data !== null
}

/**
 * Renomear a automação.
 *
 * **Isto não existia**, e a falta apareceu do jeito mais direto possível: quem
 * estava usando escreveu "não consigo editar o nome dos fluxos". O nome era
 * decidido no modal de criação e nunca mais, então um "Fluxo - teste" nascido
 * às pressas ficava assim para sempre, ou virava um fluxo novo e um desenho
 * copiado à mão.
 *
 * Renomear **não** toca o rascunho nem as versões publicadas: o nome é rótulo
 * de gaveta, não parte do desenho. Uma conversa em andamento não sente nada.
 */
export async function renomearFluxo(
  clienteId: string,
  fluxoId: string,
  nome: string,
): Promise<{ ok: true; nome: string } | { ok: false; motivo: string }> {
  const limpo = nome.trim()
  if (limpo === '') return { ok: false, motivo: 'o nome não pode ficar vazio' }
  if (limpo.length > LIMITE_NOME_DO_FLUXO) {
    return { ok: false, motivo: `o nome passa de ${LIMITE_NOME_DO_FLUXO} caracteres` }
  }

  const { data, error } = await db()
    .from('flows')
    .update({ nome: limpo })
    .eq('id', fluxoId)
    .eq('client_id', clienteId)
    .select('id')

  if (ehIdInvalido(error)) return { ok: false, motivo: 'esta automação não existe mais' }
  if (error) throw new Error(`não deu para renomear a automação: ${error.message}`)
  if ((data?.length ?? 0) !== 1) return { ok: false, motivo: 'esta automação não existe mais' }
  return { ok: true, nome: limpo }
}

/**
 * Duplicar uma automação.
 *
 * O pedido foi literal: *"tem que ser possível duplicar algum fluxo existente
 * também"*. Quem opera monta uma variação do fluxo que já funciona, o mesmo
 * atendimento com outro texto, outro canal, e até aqui a única saída era
 * redesenhar tudo à mão e errar um nó no meio.
 *
 * **A cópia nasce desligada e sem versão publicada, e isso não é detalhe.**
 * `ativo` é o que decide se o gatilho entra; `versao_publicada_id` é o que o
 * motor executa. Copiar os dois colocaria um bot novo no ar no instante do
 * clique, atendendo gente de verdade com um desenho que ninguém revisou. A
 * cópia é rascunho até alguém publicar, que é o mesmo caminho de qualquer
 * automação nova.
 *
 * O que vem junto: o desenho, o canal, a pasta e o ajuste de IA, tudo que
 * descreve **como** ela funciona. O que fica para trás: o estado de publicação,
 * as métricas e o histórico de versões, que descrevem o que a original fez e
 * não pertencem à cópia.
 */
export async function duplicarFluxo(
  clienteId: string,
  fluxoId: string,
): Promise<{ ok: true; id: string; nome: string } | { ok: false; motivo: string }> {
  if (!pareceUuid(fluxoId)) return { ok: false, motivo: 'esta automação não existe mais' }

  const original = await acharFluxo(fluxoId)
  if (!original || original.clienteId !== clienteId) {
    return { ok: false, motivo: 'esta automação não existe mais' }
  }

  /*
   * O nome precisa caber no limite depois do sufixo, e não antes: "(cópia)"
   * são sete caracteres, e um nome no teto viraria um `check` recusado pelo
   * banco, erro de banco numa tela que devia só copiar.
   */
  const SUFIXO = ' (cópia)'
  const base = original.nome.slice(0, LIMITE_NOME_DO_FLUXO - SUFIXO.length).trimEnd()

  const { data, error } = await db()
    .from('flows')
    .insert({
      client_id: clienteId,
      nome: `${base}${SUFIXO}`,
      rascunho: original.rascunho,
      ia_habilitada: original.iaHabilitada,
      canal: original.canal,
      pasta_id: original.pastaId,
      ativo: false,
    })
    .select('id, nome')
    .single()

  if (error) throw new Error(`não deu para duplicar a automação: ${error.message}`)
  return { ok: true, id: data.id as string, nome: data.nome as string }
}

/**
 * A nova ordem da lista, inteira.
 *
 * Recebe os ids na ordem desejada e grava a posição de cada um. Reescrever
 * todos numa passada, em vez de "troque o 3 com o 4", é o que mantém a lista
 * consistente quando duas abas arrastam ao mesmo tempo: a última a gravar
 * ganha por inteiro, em vez de as duas aplicarem trocas parciais e sobrar uma
 * ordem que ninguém pediu.
 *
 * Ids que não são do cliente são ignorados pelo `eq('client_id')` de cada
 * escrita, a URL é adivinhável, e reordenar não pode virar uma forma de
 * descobrir se um id existe em outra conta.
 */
export async function reordenarFluxos(
  clienteId: string,
  idsNaOrdem: string[],
): Promise<void> {
  const ids = idsNaOrdem.filter(pareceUuid)
  if (ids.length === 0) return

  /*
   * Uma escrita por linha. São dezenas, não milhares, e a alternativa
   * (`upsert` em lote) exigiria mandar a linha inteira de volta, inclusive o
   * `rascunho`, que é o campo grande, só para mudar um inteiro.
   */
  for (const [posicao, id] of ids.entries()) {
    const { error } = await db()
      .from('flows')
      .update({ ordem: posicao })
      .eq('id', id)
      .eq('client_id', clienteId)

    if (error) throw new Error(`não deu para reordenar as automações: ${error.message}`)
  }
}

/** Liga ou desliga a IA desta automação. É o que se vende, então é explícito. */
export async function definirIa(
  fluxoId: string,
  clienteId: string,
  habilitada: boolean,
): Promise<void> {
  const { data, error } = await db()
    .from('flows')
    .update({ ia_habilitada: habilitada })
    .eq('id', fluxoId)
    .eq('client_id', clienteId)
    .select('id')
    .maybeSingle()

  if (error) throw new Error(`não deu para mudar a IA do fluxo: ${error.message}`)
  if (!data) throw new Error('esta automação não existe mais')
}

export type ResumoDeAutomacoes = { total: number; comIa: number }

/**
 * Quantas automações cada cliente tem, e quantas usam IA.
 *
 * Uma consulta só para a lista inteira, e não uma por cliente: a tela de
 * clientes é a primeira coisa que abre, e N+1 ali aparece como lentidão logo no
 * login. Devolve mapa para a tela não precisar procurar.
 */
export async function resumirAutomacoes(): Promise<Map<string, ResumoDeAutomacoes>> {
  const { data, error } = await db().from('flows').select('client_id, ia_habilitada')

  if (error) throw new Error(`não deu para contar as automações: ${error.message}`)

  const mapa = new Map<string, ResumoDeAutomacoes>()
  for (const linha of data as { client_id: string; ia_habilitada: boolean }[]) {
    const atual = mapa.get(linha.client_id) ?? { total: 0, comIa: 0 }
    atual.total += 1
    if (linha.ia_habilitada) atual.comIa += 1
    mapa.set(linha.client_id, atual)
  }
  return mapa
}

/**
 * Existe alguma automação capaz de responder por este cliente?
 *
 * ---------------------------------------------------------------------------
 * Por que a pergunta precisa existir
 * ---------------------------------------------------------------------------
 *
 * O Inbox dizia **"BOT RESPONDENDO"** para uma conta sem fluxo nenhum, e
 * oferecia um botão "Pausar bot" que pausava o que não existia. O card se
 * contradizia na própria altura: o título afirmava que o bot respondia, e a
 * linha de baixo dizia que as mensagens "não receberão resposta automática".
 *
 * A causa era ler só `leads.automacao_ativa`, que é um **interruptor por
 * conversa**, ele nasce ligado e significa "esta conversa não foi silenciada",
 * não "existe robô". Sem fluxo, ele fica ligado para sempre e a tela afirma um
 * estado impossível.
 *
 * ---------------------------------------------------------------------------
 * O que conta como automação
 * ---------------------------------------------------------------------------
 *
 * Os dois caminhos que fazem o produto responder sozinho:
 *
 * - um **canal com fluxo** em qualquer um dos quatro papéis (`flow_id` é o
 *   principal; boas-vindas, mídia e pós-atendimento são os outros três);
 * - um **gatilho ativo**, que dispara fluxo sem depender do papel do número.
 *
 * Fluxo que existe mas não está ligado a papel nem a gatilho **não conta**: ele
 * é rascunho, e rascunho não responde ninguém. É por isso que a pergunta não é
 * "tem linha em `flows`?".
 *
 * Devolve `false` na dúvida, **nunca estoura**. Esta resposta decide um texto
 * de tela, e derrubar o Inbox inteiro porque uma contagem falhou seria trocar
 * um rótulo errado por uma página quebrada.
 */
export async function clienteTemAutomacao(clienteId: string): Promise<boolean> {
  const banco = db()

  const [canais, gatilhos] = await Promise.all([
    banco
      .from('channels')
      .select('id')
      .eq('client_id', clienteId)
      .or(
        'flow_id.not.is.null,flow_boas_vindas_id.not.is.null,flow_midia_id.not.is.null,flow_pos_atendimento_id.not.is.null',
      )
      .limit(1),
    banco.from('gatilhos').select('id').eq('client_id', clienteId).eq('ativo', true).limit(1),
  ])

  if (canais.error && !ehIdInvalido(canais.error)) return false
  if (gatilhos.error && !ehIdInvalido(gatilhos.error)) return false

  return (canais.data?.length ?? 0) > 0 || (gatilhos.data?.length ?? 0) > 0
}

/**
 * Este fluxo está ligado a alguma entrada? (RB-45, T7.2)
 *
 * ---------------------------------------------------------------------------
 * As quatro portas, e por que todas contam
 * ---------------------------------------------------------------------------
 *
 * O §12.1, passo 7, manda oferecer "Configurar entrada" quando o chatbot não
 * tem por onde receber conversa, e a RB-45 manda avisar sobre "bot publicado
 * sem entrada". Para isso, "entrada" tem que ser a lista inteira:
 *
 *   1. **papel de número**, os quatro de `PAPEIS_DO_NUMERO`, e não só o
 *      principal: um fluxo que é o "padrão para mídia" de um número está tão no
 *      ar quanto o principal, e avisar "sem entrada" sobre ele seria mentira;
 *   2. **palavra-chave** (`gatilhos`);
 *   3. **evento** (`gatilhos_de_evento`);
 *   4. **campanha de entrada** (`campanhas`).
 *
 * Esquecer qualquer uma das quatro produziria o pior tipo de aviso: o que
 * aparece em cima de trabalho correto. Quem já ligou a palavra-chave e lê "este
 * chatbot não atende ninguém" aprende, na primeira vez, a ignorar os avisos
 * desta tela.
 *
 * **É uma consulta por porta, e isso é aceitável aqui** porque roda só no clique
 * de publicar, e não no caminho de mensagem. As quatro vão juntas.
 */
export async function temEntradaLigada(clienteId: string, fluxoId: string): Promise<boolean> {
  const [canais, palavras, eventos, campanhas] = await Promise.all([
    db()
      .from('channels')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clienteId)
      .or(
        [
          `flow_id.eq.${fluxoId}`,
          `flow_boas_vindas_id.eq.${fluxoId}`,
          `flow_midia_id.eq.${fluxoId}`,
          `flow_pos_atendimento_id.eq.${fluxoId}`,
        ].join(','),
      ),
    db()
      .from('gatilhos')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clienteId)
      .eq('flow_id', fluxoId),
    db()
      .from('gatilhos_de_evento')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clienteId)
      .eq('flow_id', fluxoId),
    db()
      .from('campanhas')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clienteId)
      .eq('flow_id', fluxoId),
  ])

  /*
   * Erro vira "tem entrada", e não "não tem".
   *
   * É o lado certo de errar: o desfecho deste booleano é um **aviso**, e aviso
   * falso-positivo é pior do que aviso ausente. Dizer "este bot não atende
   * ninguém" a quem acabou de ligar o número, porque uma contagem falhou, é
   * exatamente o que ensina alguém a ignorar a tela.
   */
  const contar = (r: { count: number | null; error: unknown }) =>
    r.error ? 1 : (r.count ?? 0)

  return (
    contar(canais) + contar(palavras) + contar(eventos) + contar(campanhas) > 0
  )
}

/**
 * Quantas conversas estão rodando este fluxo agora (RB-44, T7.2).
 *
 * ---------------------------------------------------------------------------
 * Por que a pergunta é por versão, e não por fluxo
 * ---------------------------------------------------------------------------
 *
 * `sessions.flow_version_id` aponta para a **versão**, e não para o fluxo: é
 * assim que uma conversa aberta às 14h continua rodando o grafo de 14h depois de
 * alguém publicar às 15h (RB-44: "publicar nova versão não altera sessões em
 * andamento, que concluem na versão iniciada"). O preço é que contar as conversas
 * de um fluxo exige passar pelas versões dele.
 *
 * Duas consultas, e é o mínimo: a Data API não faz `join` numa contagem, e uma
 * view nova para isto seria migration em produção compartilhada para responder
 * uma pergunta de modal.
 *
 * ---------------------------------------------------------------------------
 * O que conta como "em andamento"
 * ---------------------------------------------------------------------------
 *
 * `ativa`, `aguardando_ia`, `aguardando_http` e `aguardando_confirmacao`. As
 * quatro são conversas que o bot ainda vai responder.
 *
 * `humano` e `encerrada` **não contam**, e a escolha é o que faz o número ser
 * útil: `encerrada` é conversa que terminou, e `humano` é conversa que uma pessoa
 * assumiu, em que o bot já está calado. Contá-las diria "120 conversas serão
 * interrompidas" para quem tem três, e um aviso que exagera é um aviso que se
 * aprende a ignorar: exatamente quando ele diz "três" e são três de verdade.
 */
export async function conversasEmAndamento(
  clienteId: string,
  fluxoId: string,
): Promise<number> {
  if (!pareceUuid(fluxoId)) return 0

  const { data: versoes, error: erroDasVersoes } = await db()
    .from('flow_versions')
    .select('id')
    .eq('flow_id', fluxoId)

  if (ehIdInvalido(erroDasVersoes) || erroDasVersoes) return 0
  const ids = (versoes ?? []).map((v) => (v as { id: string }).id)
  if (ids.length === 0) return 0

  const { count, error } = await db()
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .in('flow_version_id', ids)
    .in('status', ['ativa', 'aguardando_ia', 'aguardando_http', 'aguardando_confirmacao'])

  /*
   * Erro vira zero, e aqui o lado certo de errar é o oposto do de
   * `temEntradaLigada`: este número aparece num modal de confirmação, e inventar
   * "há conversas em andamento" quando a leitura falhou faria alguém desistir de
   * pausar um bot que precisa ser pausado. Zero deixa o modal mudo sobre
   * conversas, que é honesto: não sabemos.
   */
  if (error) return 0
  return count ?? 0
}

/**
 * Conversas em andamento de **vários** fluxos, num par de consultas.
 *
 * É a versão em lote de `conversasEmAndamento`, e ela existe pela mesma razão de
 * `relacionamentoDeMuitos`: a lista de automações desenha uma linha por fluxo, e
 * chamar a versão de um por um seria duas idas ao banco **por fluxo**, o N+1
 * clássico, numa tela que já faz cinco consultas.
 *
 * Aqui são duas, independentes do tamanho da lista. A agregação é em JavaScript
 * pelo mesmo motivo registrado em `repos/relacionamento.ts`: `group by` pela Data
 * API exigiria uma view nova, e o volume que passa aqui é o de uma conta.
 *
 * Fluxo sem conversa **aparece no mapa com zero**: quem chama precisa poder
 * desenhar a linha sem conferir se a chave existe, e um `undefined` na tela vira
 * `cannot read property`.
 */
export async function conversasEmAndamentoDeMuitos(
  fluxoIds: string[],
): Promise<Map<string, number>> {
  const mapa = new Map<string, number>()
  for (const id of fluxoIds) mapa.set(id, 0)

  const ids = fluxoIds.filter(pareceUuid)
  if (ids.length === 0) return mapa

  const { data: versoes, error: erroDasVersoes } = await db()
    .from('flow_versions')
    .select('id, flow_id')
    .in('flow_id', ids)

  if (ehIdInvalido(erroDasVersoes) || erroDasVersoes) return mapa

  const fluxoDaVersao = new Map<string, string>()
  for (const linha of (versoes ?? []) as { id: string; flow_id: string }[]) {
    fluxoDaVersao.set(linha.id, linha.flow_id)
  }
  if (fluxoDaVersao.size === 0) return mapa

  const { data: sessoes, error } = await db()
    .from('sessions')
    .select('flow_version_id')
    .in('flow_version_id', [...fluxoDaVersao.keys()])
    .in('status', ['ativa', 'aguardando_ia', 'aguardando_http', 'aguardando_confirmacao'])

  if (error) return mapa

  for (const linha of (sessoes ?? []) as { flow_version_id: string }[]) {
    const fluxoId = fluxoDaVersao.get(linha.flow_version_id)
    if (fluxoId) mapa.set(fluxoId, (mapa.get(fluxoId) ?? 0) + 1)
  }

  return mapa
}
