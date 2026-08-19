import 'server-only'
import {
  ETAPAS_INICIAIS,
  etapasEmOrdem,
  proximaOrdem,
  trocaDeLugar,
  type Cartao,
  type Etapa,
} from '@/core/quadros'
import { db, ehIdInvalido } from '../db'

/**
 * Os quadros de uma conta (0032).
 *
 * Como todo `repos/`: só ida ao banco. Quem decide o que é uma etapa válida e
 * como elas se ordenam é `core/quadros.ts`.
 */

export type Quadro = {
  id: string
  nome: string
  etapas: Etapa[]
}

type LinhaDoQuadro = {
  id: string
  nome: string
  quadro_colunas: { id: string; nome: string; ordem: number; criado_em: string }[] | null
}

const COLUNAS = 'id, nome, quadro_colunas (id, nome, ordem, criado_em)'

function paraQuadro(linha: LinhaDoQuadro): Quadro {
  return {
    id: linha.id,
    nome: linha.nome,
    etapas: etapasEmOrdem(
      (linha.quadro_colunas ?? []).map((coluna) => ({
        id: coluna.id,
        nome: coluna.nome,
        ordem: coluna.ordem,
        criadoEm: coluna.criado_em,
      })),
    ),
  }
}

export async function listarQuadros(clienteId: string): Promise<Quadro[]> {
  const { data, error } = await db()
    .from('quadros')
    .select(COLUNAS)
    .eq('client_id', clienteId)
    .order('criado_em', { ascending: true })

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para listar os quadros: ${error.message}`)
  return (data as unknown as LinhaDoQuadro[]).map(paraQuadro)
}

export async function acharQuadro(clienteId: string, quadroId: string): Promise<Quadro | null> {
  const { data, error } = await db()
    .from('quadros')
    .select(COLUNAS)
    .eq('id', quadroId)
    .eq('client_id', clienteId)
    .maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para buscar o quadro: ${error.message}`)
  return data ? paraQuadro(data as unknown as LinhaDoQuadro) : null
}

/**
 * Cria o quadro **já com etapas**.
 *
 * Um quadro vazio abre morto: a pessoa vê um retângulo e três cliques a separam
 * de qualquer coisa. As três etapas iniciais são neutras de propósito — ver
 * `ETAPAS_INICIAIS` sobre por que elas não podem descrever um ramo.
 *
 * Se as etapas falharem, o quadro fica de pé mesmo assim. É melhor um quadro
 * para renomear etapas do que um erro que apaga o nome que a pessoa acabou de
 * escrever.
 */
export async function criarQuadro(
  clienteId: string,
  nome: string,
): Promise<{ ok: true; id: string } | { ok: false; motivo: string }> {
  const limpo = nome.trim()
  if (limpo === '') return { ok: false, motivo: 'dê um nome ao quadro' }

  const { data, error } = await db()
    .from('quadros')
    .insert({ client_id: clienteId, nome: limpo })
    .select('id')
    .single()

  if (error?.code === '23505') return { ok: false, motivo: 'já existe um quadro com este nome' }
  if (error) throw new Error(`não deu para criar o quadro: ${error.message}`)

  const quadroId = (data as { id: string }).id
  const { error: erroDasEtapas } = await db()
    .from('quadro_colunas')
    .insert(
      ETAPAS_INICIAIS.map((nomeDaEtapa, indice) => ({
        quadro_id: quadroId,
        nome: nomeDaEtapa,
        ordem: indice,
      })),
    )

  if (erroDasEtapas) console.error('[quadros] o quadro nasceu sem etapas', erroDasEtapas.message)
  return { ok: true, id: quadroId }
}

export async function renomearQuadro(
  clienteId: string,
  quadroId: string,
  nome: string,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const limpo = nome.trim()
  if (limpo === '') return { ok: false, motivo: 'escreva o nome do quadro' }

  const { data, error } = await db()
    .from('quadros')
    .update({ nome: limpo })
    .eq('id', quadroId)
    .eq('client_id', clienteId)
    .select('id')
    .maybeSingle()

  if (error?.code === '23505') return { ok: false, motivo: 'já existe um quadro com este nome' }
  if (ehIdInvalido(error)) return { ok: false, motivo: 'este quadro não existe mais' }
  if (error) throw new Error(`não deu para renomear o quadro: ${error.message}`)
  return data ? { ok: true } : { ok: false, motivo: 'este quadro não existe mais' }
}

/**
 * Apaga o quadro inteiro.
 *
 * Etapas e cartões vão junto por `cascade`, e aqui isso é o certo: o que some é
 * a **posição** das pessoas no funil, não as pessoas. Nenhum contato é tocado —
 * é a diferença entre apagar um quadro e apagar uma lista de gente, e é ela que
 * torna esta operação reversível na prática.
 */
export async function apagarQuadro(clienteId: string, quadroId: string): Promise<boolean> {
  const { data, error } = await db()
    .from('quadros')
    .delete()
    .eq('id', quadroId)
    .eq('client_id', clienteId)
    .select('id')
    .maybeSingle()

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não deu para apagar o quadro: ${error.message}`)
  return data !== null
}

// ---------------------------------------------------------------------------
// Etapas
// ---------------------------------------------------------------------------

export async function criarEtapa(
  clienteId: string,
  quadroId: string,
  nome: string,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const quadro = await acharQuadro(clienteId, quadroId)
  if (!quadro) return { ok: false, motivo: 'este quadro não existe mais' }

  const { error } = await db()
    .from('quadro_colunas')
    .insert({ quadro_id: quadroId, nome: nome.trim(), ordem: proximaOrdem(quadro.etapas) })

  if (error?.code === '23505') return { ok: false, motivo: 'já existe uma etapa com este nome' }
  if (error) throw new Error(`não deu para criar a etapa: ${error.message}`)
  return { ok: true }
}

export async function renomearEtapa(
  clienteId: string,
  quadroId: string,
  etapaId: string,
  nome: string,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  // O quadro é conferido contra o cliente **antes** de a etapa ser tocada: o id
  // da etapa chega da tela, e a chave estrangeira só sabe que ela existe.
  const quadro = await acharQuadro(clienteId, quadroId)
  if (!quadro || !quadro.etapas.some((etapa) => etapa.id === etapaId)) {
    return { ok: false, motivo: 'esta etapa não existe mais' }
  }

  const { error } = await db()
    .from('quadro_colunas')
    .update({ nome: nome.trim() })
    .eq('id', etapaId)
    .eq('quadro_id', quadroId)

  if (error?.code === '23505') return { ok: false, motivo: 'já existe uma etapa com este nome' }
  if (error) throw new Error(`não deu para renomear a etapa: ${error.message}`)
  return { ok: true }
}

/**
 * Move uma etapa um lugar para o lado.
 *
 * Só as **duas** envolvidas mudam de `ordem`. Renumerar a lista inteira a cada
 * clique reescreveria oito linhas para mover uma, e transformaria um botão de
 * arrumação numa escrita que compete com quem está arrastando cartão ao lado.
 */
export async function moverEtapa(
  clienteId: string,
  quadroId: string,
  etapaId: string,
  direcao: 'esquerda' | 'direita',
): Promise<boolean> {
  const quadro = await acharQuadro(clienteId, quadroId)
  if (!quadro) return false

  const troca = trocaDeLugar(quadro.etapas, etapaId, direcao)
  if (!troca) return false

  const { error } = await db()
    .from('quadro_colunas')
    .upsert([
      { id: troca.a.id, quadro_id: quadroId, nome: troca.a.nome, ordem: troca.b.ordem },
      { id: troca.b.id, quadro_id: quadroId, nome: troca.b.nome, ordem: troca.a.ordem },
    ])

  if (error) throw new Error(`não deu para mover a etapa: ${error.message}`)
  return true
}

/**
 * Apaga a etapa — e **recusa quando há gente nela**.
 *
 * A chave estrangeira do cartão é `restrict`, então o banco recusaria de
 * qualquer forma. O que este código acrescenta é o número: "3 contatos estão
 * aqui" é o que transforma "não deu" em "mova essas três primeiro". Mover os
 * cartões por conta própria seria decidir por outra pessoa onde eles vão parar.
 */
export async function apagarEtapa(
  clienteId: string,
  quadroId: string,
  etapaId: string,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const quadro = await acharQuadro(clienteId, quadroId)
  if (!quadro || !quadro.etapas.some((etapa) => etapa.id === etapaId)) {
    return { ok: false, motivo: 'esta etapa não existe mais' }
  }
  if (quadro.etapas.length === 1) {
    return {
      ok: false,
      motivo: 'um quadro precisa de pelo menos uma etapa — sem nenhuma, não há para onde os contatos irem',
    }
  }

  const { count, error: erroDaContagem } = await db()
    .from('quadro_cartoes')
    .select('id', { count: 'exact', head: true })
    .eq('coluna_id', etapaId)

  if (erroDaContagem) throw new Error(`não deu para contar os cartões: ${erroDaContagem.message}`)
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      motivo: `${count} contato(s) estão nesta etapa. Mova-os para outra antes de apagá-la — apagar agora perderia a posição deles no funil.`,
    }
  }

  const { error } = await db()
    .from('quadro_colunas')
    .delete()
    .eq('id', etapaId)
    .eq('quadro_id', quadroId)

  if (error) throw new Error(`não deu para apagar a etapa: ${error.message}`)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Cartões
// ---------------------------------------------------------------------------

type LinhaDoCartao = {
  id: string
  contact_id: string
  coluna_id: string
  entrou_na_coluna_em: string
  contacts: { nome_real: string | null; nome: string | null; wa_id: string } | null
}

/**
 * Os cartões de um quadro, com o nome de quem está neles.
 *
 * A junção com `contacts` vem na mesma consulta de propósito: um cartão sem nome
 * é um retângulo com um uuid, e buscar contato por contato seria N+1 na tela
 * cuja função é mostrar dezenas deles de uma vez.
 */
export async function listarCartoes(clienteId: string, quadroId: string): Promise<Cartao[]> {
  const { data, error } = await db()
    .from('quadro_cartoes')
    .select('id, contact_id, coluna_id, entrou_na_coluna_em, contacts (nome_real, nome, wa_id)')
    .eq('client_id', clienteId)
    .eq('quadro_id', quadroId)

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para listar os cartões: ${error.message}`)

  return (data as unknown as LinhaDoCartao[]).map((linha) => ({
    id: linha.id,
    contatoId: linha.contact_id,
    colunaId: linha.coluna_id,
    // `nome_real` (o que a equipe corrigiu) ganha de `nome` (o do perfil do
    // WhatsApp, que a própria pessoa muda quando quer). Sem nenhum dos dois, o
    // telefone — cartão sem identificação nenhuma não dá para usar.
    nome: linha.contacts?.nome_real || linha.contacts?.nome || linha.contacts?.wa_id || '',
    telefone: linha.contacts?.wa_id ?? '',
    entrouNaColunaEm: linha.entrou_na_coluna_em,
  }))
}

/**
 * Põe contatos num quadro, na primeira etapa.
 *
 * Aceita lista porque o caminho real é a seleção em lote da tela de Contatos —
 * pôr trinta leads no funil de uma vez é o que se faz depois de uma importação,
 * e um laço de trinta `insert` seria trinta viagens.
 *
 * **Quem já está no quadro não é movido.** O `ignoreDuplicates` é o ponto: a
 * pessoa selecionou trinta contatos sem lembrar quais já estavam lá, e mover os
 * que já estavam de volta para a primeira etapa desfaria o trabalho de quem os
 * arrastou até o fim do funil.
 */
export async function porNoQuadro(
  clienteId: string,
  quadroId: string,
  contatos: string[],
): Promise<{ ok: true; postos: number } | { ok: false; motivo: string }> {
  if (contatos.length === 0) return { ok: false, motivo: 'escolha ao menos um contato' }

  const quadro = await acharQuadro(clienteId, quadroId)
  if (!quadro) return { ok: false, motivo: 'este quadro não existe mais' }

  const primeira = quadro.etapas[0]
  if (!primeira) return { ok: false, motivo: 'crie uma etapa antes de pôr gente no quadro' }

  // Os contatos são conferidos contra o **mesmo cliente**: os ids chegam de
  // formulário, e a chave estrangeira só sabe que eles existem.
  const { data: doCliente, error: erroDosContatos } = await db()
    .from('contacts')
    .select('id')
    .eq('client_id', clienteId)
    .in('id', contatos)

  if (ehIdInvalido(erroDosContatos)) return { ok: false, motivo: 'contato inválido' }
  if (erroDosContatos) throw new Error(`não deu para conferir os contatos: ${erroDosContatos.message}`)

  const validos = (doCliente as { id: string }[]).map((c) => c.id)
  if (validos.length === 0) return { ok: false, motivo: 'nenhum contato deste cliente na seleção' }

  const { data, error } = await db()
    .from('quadro_cartoes')
    .upsert(
      validos.map((contatoId) => ({
        client_id: clienteId,
        quadro_id: quadroId,
        coluna_id: primeira.id,
        contact_id: contatoId,
      })),
      { onConflict: 'quadro_id,contact_id', ignoreDuplicates: true },
    )
    .select('id')

  if (error) throw new Error(`não deu para pôr no quadro: ${error.message}`)
  return { ok: true, postos: (data as { id: string }[] | null)?.length ?? 0 }
}

export type ContatoParaOQuadro = { id: string; nome: string; telefone: string }

/**
 * Quem ainda **não** está neste quadro, para o seletor de "adicionar contato".
 *
 * Excluir quem já está é metade da utilidade: uma lista que oferece gente que
 * já tem cartão faz a pessoa clicar para descobrir que não acontece nada. O
 * índice único recusaria de qualquer forma — o que muda aqui é ela não ser
 * oferecida.
 *
 * O teto de resultados existe porque a caixa é um seletor, não uma lista: conta
 * com dez mil contatos devolveria dez mil linhas para alguém escolher uma. Quem
 * precisa de lote usa a tela de Contatos, que tem filtro e paginação.
 */
export async function contatosForaDoQuadro(
  clienteId: string,
  quadroId: string,
  termo: string,
  limite = 20,
): Promise<ContatoParaOQuadro[]> {
  const busca = termo.trim()

  let consulta = db()
    .from('contacts')
    .select('id, nome, nome_real, wa_id')
    .eq('client_id', clienteId)
    .order('criado_em', { ascending: false })
    .limit(limite + 200)

  if (busca !== '') {
    // `,` e `)` têm significado no filtro do PostgREST — a mesma classe de
    // problema que injeção. Some tudo que não é letra, número ou espaço.
    const limpo = busca.replace(/[^\p{L}\p{N}\s@.+-]/gu, ' ').trim()
    if (limpo === '') return []
    consulta = consulta.or(
      [`nome.ilike.*${limpo}*`, `nome_real.ilike.*${limpo}*`, `wa_id.ilike.*${limpo}*`].join(','),
    )
  }

  const { data, error } = await consulta
  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para buscar contatos: ${error.message}`)

  const { data: jaEstao, error: erroDosCartoes } = await db()
    .from('quadro_cartoes')
    .select('contact_id')
    .eq('quadro_id', quadroId)

  if (erroDosCartoes) throw new Error(`não deu para ler o quadro: ${erroDosCartoes.message}`)
  const dentro = new Set((jaEstao as { contact_id: string }[]).map((l) => l.contact_id))

  return (data as { id: string; nome: string | null; nome_real: string | null; wa_id: string }[])
    .filter((linha) => !dentro.has(linha.id))
    .slice(0, limite)
    .map((linha) => ({
      id: linha.id,
      nome: linha.nome_real || linha.nome || linha.wa_id,
      telefone: linha.wa_id,
    }))
}

/**
 * Põe contatos **numa etapa específica**.
 *
 * Diferente de `porNoQuadro`, que joga na primeira: aqui a pessoa clicou em
 * "adicionar" **dentro de uma coluna**, e cair noutra seria ignorar o gesto.
 */
export async function porNaEtapa(
  clienteId: string,
  quadroId: string,
  colunaId: string,
  contatos: string[],
): Promise<{ ok: true; postos: number } | { ok: false; motivo: string }> {
  if (contatos.length === 0) return { ok: false, motivo: 'escolha ao menos um contato' }

  const quadro = await acharQuadro(clienteId, quadroId)
  if (!quadro) return { ok: false, motivo: 'este quadro não existe mais' }
  if (!quadro.etapas.some((etapa) => etapa.id === colunaId)) {
    return { ok: false, motivo: 'esta etapa não existe mais' }
  }

  const { data: doCliente, error: erroDosContatos } = await db()
    .from('contacts')
    .select('id')
    .eq('client_id', clienteId)
    .in('id', contatos)

  if (ehIdInvalido(erroDosContatos)) return { ok: false, motivo: 'contato inválido' }
  if (erroDosContatos) throw new Error(`não deu para conferir os contatos: ${erroDosContatos.message}`)

  const validos = (doCliente as { id: string }[]).map((c) => c.id)
  if (validos.length === 0) return { ok: false, motivo: 'nenhum contato deste cliente na seleção' }

  const { data, error } = await db()
    .from('quadro_cartoes')
    .upsert(
      validos.map((contatoId) => ({
        client_id: clienteId,
        quadro_id: quadroId,
        coluna_id: colunaId,
        contact_id: contatoId,
      })),
      { onConflict: 'quadro_id,contact_id', ignoreDuplicates: true },
    )
    .select('id')

  if (error) throw new Error(`não deu para pôr na etapa: ${error.message}`)
  return { ok: true, postos: (data as { id: string }[] | null)?.length ?? 0 }
}

/**
 * Move o cartão de etapa.
 *
 * Passa pela função do banco porque mover é **duas escritas que não podem se
 * separar** — a coluna e o relógio da etapa. Ver a 0032.
 */
export async function moverCartao(
  clienteId: string,
  cartaoId: string,
  colunaId: string,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const { data, error } = await db().rpc('mover_cartao', {
    p_cartao_id: cartaoId,
    p_coluna_id: colunaId,
    p_client_id: clienteId,
  })

  if (ehIdInvalido(error)) return { ok: false, motivo: 'este cartão não existe mais' }
  if (error) throw new Error(`não deu para mover o cartão: ${error.message}`)

  /**
   * **Lista vazia é a recusa**, e a função devolve `setof` justamente para
   * poder ser vazia (0033). Enquanto ela devolvia um composto, "nada casou"
   * chegava aqui como um objeto de campos nulos — verdadeiro em JavaScript — e
   * este `return` respondia "movi" para as duas tentativas que a função existe
   * para recusar: cartão de outra conta e etapa de outro quadro.
   */
  const movidos = (data ?? []) as { id: string }[]
  return movidos.length > 0
    ? { ok: true }
    : { ok: false, motivo: 'este cartão ou esta etapa não existem mais' }
}

/**
 * Tira o contato do quadro.
 *
 * Tirar do quadro **não é apagar o contato**, e a tela precisa dizer isso: a
 * pessoa continua na lista, na conversa e nas etiquetas. O que sai é a posição
 * dela no funil.
 */
export async function tirarDoQuadro(clienteId: string, cartaoId: string): Promise<boolean> {
  const { data, error } = await db()
    .from('quadro_cartoes')
    .delete()
    .eq('id', cartaoId)
    .eq('client_id', clienteId)
    .select('id')
    .maybeSingle()

  if (ehIdInvalido(error)) return false
  if (error) throw new Error(`não deu para tirar do quadro: ${error.message}`)
  return data !== null
}

/**
 * Põe o contato numa etapa **a partir de um fluxo** (C1b).
 *
 * Cria o cartão se ele não existe e move se já existe — as duas coisas, porque
 * do lado do fluxo elas são o mesmo pedido: "esta pessoa está agora nesta
 * etapa". Obrigar o desenho a saber se ela já estava no quadro seria empurrar
 * um detalhe de banco para quem está desenhando uma conversa.
 *
 * **Etapa que sumiu é nada-a-fazer, e não erro.** A versão publicada é imutável
 * e a etapa é estado vivo: quem arruma o quadro não pode matar a conversa de
 * alguém. É a mesma regra do papel de número que aponta para fluxo sem versão
 * publicada. Devolve `false` para quem chama poder registrar, sem estourar.
 */
export async function porContatoNaEtapa(
  clienteId: string,
  contatoId: string,
  quadroId: string,
  colunaId: string,
): Promise<boolean> {
  // A etapa precisa ser **do quadro indicado e do cliente indicado**. Os dois
  // ids vêm de uma versão publicada, que é imutável e pode ser de meses atrás.
  const { data: coluna, error: erroDaColuna } = await db()
    .from('quadro_colunas')
    .select('id, quadros!inner (id, client_id)')
    .eq('id', colunaId)
    .eq('quadro_id', quadroId)
    .eq('quadros.client_id', clienteId)
    .maybeSingle()

  if (ehIdInvalido(erroDaColuna)) return false
  if (erroDaColuna) {
    console.error('[quadros] não deu para conferir a etapa', erroDaColuna.message)
    return false
  }
  if (!coluna) return false

  const { data: existente, error: erroDoCartao } = await db()
    .from('quadro_cartoes')
    .select('id')
    .eq('quadro_id', quadroId)
    .eq('contact_id', contatoId)
    .maybeSingle()

  if (erroDoCartao) {
    console.error('[quadros] não deu para achar o cartão', erroDoCartao.message)
    return false
  }

  if (existente) {
    const movido = await moverCartao(clienteId, (existente as { id: string }).id, colunaId)
    return movido.ok
  }

  const { error } = await db().from('quadro_cartoes').insert({
    client_id: clienteId,
    quadro_id: quadroId,
    coluna_id: colunaId,
    contact_id: contatoId,
  })

  // Corrida com outra escrita para o mesmo contato: o índice único resolveu, e
  // "já está no quadro" é o resultado que se queria.
  if (error && error.code !== '23505') {
    console.error('[quadros] não deu para pôr o contato na etapa', error.message)
    return false
  }
  return true
}

/**
 * Em que quadros e etapas este contato está.
 *
 * É o que a ficha do contato mostra, e o que impede o quadro de virar uma
 * ilha: quem abre a conversa precisa ver em que ponto do funil a pessoa está
 * sem trocar de tela.
 */
export async function quadrosDoContato(
  clienteId: string,
  contatoId: string,
): Promise<{ quadro: string; etapa: string; entrouEm: string }[]> {
  const { data, error } = await db()
    .from('quadro_cartoes')
    .select('entrou_na_coluna_em, quadros!inner (nome), quadro_colunas!inner (nome)')
    .eq('client_id', clienteId)
    .eq('contact_id', contatoId)

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para ler os quadros do contato: ${error.message}`)

  return (
    data as unknown as {
      entrou_na_coluna_em: string
      quadros: { nome: string }
      quadro_colunas: { nome: string }
    }[]
  ).map((linha) => ({
    quadro: linha.quadros.nome,
    etapa: linha.quadro_colunas.nome,
    entrouEm: linha.entrou_na_coluna_em,
  }))
}
