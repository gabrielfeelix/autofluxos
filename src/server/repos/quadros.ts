import 'server-only'
import {
  ETAPAS_INICIAIS,
  etapasEmOrdem,
  proximaOrdem,
  trocaDeLugar,
  type Cartao,
  ehCorDaEtapa,
  type CorDaEtapa,
  type Etapa,
  type Situacao,
  type TipoDeEtapa,
} from '@/core/quadros'
import { podeEncadear, LIMITE_DO_TITULO } from '@/core/crm'
import {
  aceitaQuadroMaisAntigo,
  criaCartaoSozinho,
  entradaNoFunil,
  ENTRADA_NO_FUNIL_PADRAO,
  ENTRADAS_NO_FUNIL,
  type EntradaNoFunil,
} from '@/core/regras-de-entrada'
import { etapasDoModelo, finalidadeDoModelo, type EtapaDoModelo } from '@/core/quadros-modelos'
import { db, ehIdInvalido } from '../db'
import { anotar } from './eventos'
import { concluirProcesso } from '../servicos/concluir-processo'

/**
 * Os quadros de uma conta (0032).
 *
 * Como todo `repos/`: só ida ao banco. Quem decide o que é uma etapa válida e
 * como elas se ordenam é `core/quadros.ts`.
 */

export type Quadro = {
  id: string
  nome: string
  /** Recebe contato novo sozinho. No máximo um por conta (0043). */
  padrao: boolean
  /** Ganhar aqui abre cartão lá. Null = fim da cadeia (0058). */
  seguinteId: string | null
  etapas: Etapa[]
}

type LinhaDoQuadro = {
  id: string
  nome: string
  padrao: boolean
  seguinte_id: string | null
  quadro_colunas:
    | {
        id: string
        nome: string
        ordem: number
        criado_em: string
        tipo: TipoDeEtapa | null
        limite_de_dias: number | null
        cor: string | null
      }[]
    | null
}

/**
 * Por que o responsável é lido como `nome:name`.
 *
 * `af_usuarios` é a tabela do **better-auth** — só o nome dela foi traduzido,
 * pelo `modelName` em `server/auth.ts`; as colunas continuam as da biblioteca
 * (`name`, `emailVerified`, `createdAt`, `banned`). Renomear a coluna no banco
 * obrigaria a mapear campo por campo na configuração e quebraria os `update`
 * que a própria lib faz, em troca de nada.
 *
 * O apelido do PostgREST resolve no lugar certo: o banco continua sendo o que a
 * biblioteca espera, e o TypeScript daqui para dentro fala português como o
 * resto do repositório. `membrosDaConta` já fazia o mesmo apelido, em SQL.
 */
const COLUNAS =
  'id, nome, padrao, seguinte_id, quadro_colunas (id, nome, ordem, criado_em, tipo, limite_de_dias, cor)'

function paraQuadro(linha: LinhaDoQuadro): Quadro {
  return {
    id: linha.id,
    nome: linha.nome,
    padrao: linha.padrao ?? false,
    seguinteId: linha.seguinte_id ?? null,
    etapas: etapasEmOrdem(
      (linha.quadro_colunas ?? []).map((coluna) => ({
        id: coluna.id,
        nome: coluna.nome,
        ordem: coluna.ordem,
        criadoEm: coluna.criado_em,
        tipo: coluna.tipo ?? 'normal',
        limiteDeDias: coluna.limite_de_dias ?? null,
        // Cor desconhecida vira "sem cor": melhor a coluna cinza de sempre do
        // que uma classe CSS que não existe. Ver `ehCorDaEtapa`.
        cor: ehCorDaEtapa(coluna.cor) ? coluna.cor : null,
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
  /** Qual funil desenhar. Ver `core/quadros-modelos.ts`; nulo nasce em branco. */
  modeloId?: string | null,
): Promise<{ ok: true; id: string } | { ok: false; motivo: string }> {
  const limpo = nome.trim()
  if (limpo === '') return { ok: false, motivo: 'dê um nome ao quadro' }

  const { data, error } = await db()
    .from('quadros')
    .insert({
      client_id: clienteId,
      nome: limpo,
      // A finalidade vem do modelo (0071). Sem modelo, nasce operacional: um
      // quadro que ninguém classificou não pode começar produzindo receita.
      finalidade: finalidadeDoModelo(modeloId),
    })
    .select('id')
    .single()

  if (error?.code === '23505') return { ok: false, motivo: 'já existe um quadro com este nome' }
  if (error) throw new Error(`não deu para criar o quadro: ${error.message}`)

  const quadroId = (data as { id: string }).id

  /*
   * Sem modelo escolhido, as três etapas neutras de sempre — é o que a criação
   * antiga fazia, e quem chama de outro lugar (teste, importação) não precisa
   * saber que modelos existem.
   */
  const etapas: readonly EtapaDoModelo[] = modeloId
    ? etapasDoModelo(modeloId)
    : ETAPAS_INICIAIS.map((nomeDaEtapa) => ({ nome: nomeDaEtapa }))

  const { error: erroDasEtapas } = await db()
    .from('quadro_colunas')
    .insert(
      etapas.map((etapa, indice) => ({
        quadro_id: quadroId,
        nome: etapa.nome,
        ordem: indice,
        tipo: etapa.tipo ?? 'normal',
        limite_de_dias: etapa.dias ?? null,
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

/**
 * O quadro que recebe contato novo sozinho.
 *
 * **Lead novo cai no funil sempre, sem ninguém marcar nada.** A `0043` nasceu
 * opt-in — só entrava quem tivesse marcado a caixa — e a consequência apareceu
 * na primeira vez que alguém foi olhar: nenhum dos cinco quadros em produção
 * estava marcado, então lead nenhum entrava em quadro nenhum. Do lado de fora
 * isso é indistinguível de recurso quebrado, e a queixa que gerou a rodada 1
 * (*"o lead não vai automático, tem que clicar e puxar"*) continuava valendo
 * inteira.
 *
 * Então a caixa deixou de decidir **se** entra e passou a decidir **onde**:
 *
 * - quadro marcado → é aquele;
 * - nenhum marcado → o **mais antigo** da conta, que é o primeiro que a pessoa
 *   criou e o que a tela de quadros já mostra primeiro (`listarQuadros` ordena
 *   por `criado_em`). Coincide com o quadro que quem tem um só está olhando;
 * - conta sem quadro nenhum → `null`, e aí não há mesmo o que fazer.
 *
 * ---------------------------------------------------------------------------
 * E por que ela mudou nesta fase
 * ---------------------------------------------------------------------------
 *
 * Porque o segundo item adivinha. "O primeiro quadro que a pessoa criou" não é
 * o mesmo que "onde os leads devem cair", e as duas coisas divergem no dia em
 * que alguém cria um quadro de teste antes do de verdade. A RB-12 é explícita:
 * "Nenhum fallback pode selecionar o quadro mais antigo".
 *
 * A regra agora vem da conta, em `clients.entrada_no_funil` (0075), e esta
 * função deixou de decidir: ela **aplica** a política que recebe. Quem já
 * existia foi convertido para `mais_antigo` pela migration, então nada mudou de
 * comportamento para ninguém; o que mudou é que a escolha está escrita, aparece
 * na tela e dá para revisar.
 *
 * `null` continua sendo resposta legítima, e quem chama isto no caminho da
 * mensagem segue em frente sem reclamar.
 *
 * Devolve só o id porque o único uso é `porNoQuadro` logo em seguida; puxar as
 * etapas aqui seria carregar a junção inteira em **toda** mensagem recebida
 * para descartá-la.
 */
export async function acharQuadroPadrao(clienteId: string): Promise<string | null> {
  const politica = await politicaDeEntrada(clienteId)
  if (!criaCartaoSozinho(politica)) return null

  const consulta = db().from('quadros').select('id').eq('client_id', clienteId)

  if (aceitaQuadroMaisAntigo(politica)) {
    /*
     * O legado. `padrao` primeiro, `criado_em` como desempate — numa consulta
     * só: `padrao` desc põe `true` na frente, e sem nenhum `true` a lista
     * inteira desempata por idade e o primeiro é o mais antigo.
     */
    const { data, error } = await consulta
      .order('padrao', { ascending: false })
      .order('criado_em', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (ehIdInvalido(error)) return null
    if (error) throw new Error(`não deu para achar o quadro padrão: ${error.message}`)
    return data ? (data as { id: string }).id : null
  }

  /*
   * `quadro_marcado`: só o marcado serve. Sem marcação a resposta é `null`, e
   * **isso não é falha** — é a conta dizendo "não quero que entre sozinho onde
   * eu não escolhi". A tela de quadros é quem avisa que não há marcação.
   */
  const { data, error } = await consulta.eq('padrao', true).limit(1).maybeSingle()

  if (ehIdInvalido(error)) return null
  if (error) throw new Error(`não deu para achar o quadro padrão: ${error.message}`)
  return data ? (data as { id: string }).id : null
}

/**
 * A política de entrada da conta (0075).
 *
 * Falha de leitura vira o default seguro em vez de exceção: este caminho roda em
 * **toda mensagem de contato novo**, e um erro aqui não pode derrubar o
 * atendimento nem fazer o webhook responder erro à Meta. `nao_criar` é o lado
 * certo de errar — ninguém entra num funil que a conta não escolheu.
 */
export async function politicaDeEntrada(clienteId: string): Promise<EntradaNoFunil> {
  const { data, error } = await db()
    .from('clients')
    .select('entrada_no_funil')
    .eq('id', clienteId)
    .maybeSingle()

  if (error) return ENTRADA_NO_FUNIL_PADRAO
  return entradaNoFunil((data as { entrada_no_funil: string | null } | null)?.entrada_no_funil)
}

/**
 * Troca a política de entrada da conta.
 *
 * Devolve objeto, e não booleano, porque a tela precisa dizer **por que** não
 * deu. Ver a armadilha do handoff da F2: `if (!objeto)` é sempre falso.
 */
export async function definirEntradaNoFunil(
  clienteId: string,
  politica: EntradaNoFunil,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  if (!ENTRADAS_NO_FUNIL.includes(politica)) {
    return { ok: false, motivo: 'essa política de entrada não existe' }
  }

  const { error } = await db()
    .from('clients')
    .update({ entrada_no_funil: politica })
    .eq('id', clienteId)

  if (error) return { ok: false, motivo: `não deu para gravar: ${error.message}` }
  return { ok: true }
}

/**
 * Marca (ou desmarca, com `null`) o quadro que recebe contato novo.
 *
 * **Desmarcar vem antes de marcar, e não é ordem à toa.** O índice parcial
 * `quadros_padrao_unico_idx` recusa a segunda linha marcada da mesma conta, e
 * marcar primeiro estouraria com `23505` justamente no caso normal — trocar o
 * padrão de um quadro para outro. Limpar a conta inteira primeiro deixa a
 * marcação sempre livre.
 *
 * O intervalo entre as duas escritas é o preço: por um instante a conta fica
 * sem padrão, e uma mensagem que chegue exatamente ali não põe ninguém no
 * quadro. É aceitável de propósito — a alternativa seria uma transação, que o
 * PostgREST não dá, e o custo do azar é um cartão que a tela cria com um
 * clique, contra o risco de deixar a conta com dois padrões.
 */
export async function definirQuadroPadrao(
  clienteId: string,
  quadroId: string | null,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const { error: erroAoLimpar } = await db()
    .from('quadros')
    .update({ padrao: false })
    .eq('client_id', clienteId)
    .eq('padrao', true)

  if (erroAoLimpar) throw new Error(`não deu para limpar o quadro padrão: ${erroAoLimpar.message}`)
  if (quadroId === null) return { ok: true }

  const { data, error } = await db()
    .from('quadros')
    .update({ padrao: true })
    .eq('id', quadroId)
    .eq('client_id', clienteId)
    .select('id')
    .maybeSingle()

  if (ehIdInvalido(error)) return { ok: false, motivo: 'este quadro não existe mais' }
  if (error) throw new Error(`não deu para definir o quadro padrão: ${error.message}`)
  return data ? { ok: true } : { ok: false, motivo: 'este quadro não existe mais' }
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
  titulo: string | null
  valor: string | number | null
  situacao: Situacao
  responsavel: string | null
  contacts: {
    nome_real: string | null
    nome: string | null
    wa_id: string
    ultima_mensagem_em: string | null
  } | null
  af_usuarios: { nome: string | null } | null
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
    .select(
      'id, contact_id, coluna_id, entrou_na_coluna_em, titulo, valor, situacao, responsavel, ' +
        /*
         * `nome:name` é apelido, e não capricho: a coluna de `af_usuarios`
         * chama `name`, em inglês, porque a tabela nasceu do Better Auth e não
         * do nosso vocabulário. Pedir `nome` direto devolve
         * `column af_usuarios_1.nome does not exist` — e o erro só aparece em
         * tempo de execução, porque o PostgREST não é conferido pelo TypeScript.
         *
         * O apelido mantém o resto do arquivo em português, que é onde ele deve
         * estar. Traduzir a coluna no banco seria mexer numa tabela que o Auth
         * gerencia.
         */
        'contacts (nome_real, nome, wa_id, ultima_mensagem_em), af_usuarios (nome:name)',
    )
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
    titulo: linha.titulo,
    // `numeric` chega como string no supabase-js. Sem converter, o cabeçalho da
    // coluna somaria "200" com "350.50" e escreveria "200350.50".
    valor: linha.valor === null || linha.valor === undefined ? null : Number(linha.valor),
    situacao: linha.situacao ?? 'aberta',
    responsavelId: linha.responsavel,
    responsavelNome: linha.af_usuarios?.nome ?? null,
    ultimaMensagemEm: linha.contacts?.ultima_mensagem_em ?? null,
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
/**
 * Quais destes contatos **já têm cartão aberto** neste quadro.
 *
 * Existe por causa da 0071. Antes, a unicidade era permanente
 * (`quadro_cartoes_unico_idx`) e o `upsert ... onConflict` do PostgREST a
 * usava para ignorar repetição. A 0071 trocou essa unicidade por uma parcial,
 * só entre os cartões abertos, para que recompra e retorno tenham onde existir
 * (RB-02, A12) — e o PostgREST não aceita `onConflict` apontando para índice
 * parcial: responde "there is no unique or exclusion constraint matching the
 * ON CONFLICT specification".
 *
 * Então a filtragem passa a ser explícita: lê quem já está aberto e insere só
 * o resto. O índice parcial continua sendo a garantia final contra a corrida
 * entre duas requisições; isto aqui evita o erro no caminho comum.
 */
async function jaAbertosNoQuadro(
  quadroId: string,
  contatos: string[],
): Promise<Set<string>> {
  if (contatos.length === 0) return new Set()

  const { data, error } = await db()
    .from('quadro_cartoes')
    .select('contact_id')
    .eq('quadro_id', quadroId)
    .eq('situacao', 'aberta')
    .in('contact_id', contatos)

  if (error) throw new Error(`não deu para conferir quem já está no quadro: ${error.message}`)
  return new Set((data as { contact_id: string }[]).map((linha) => linha.contact_id))
}

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

  const jaEstao = await jaAbertosNoQuadro(quadroId, validos)
  const aInserir = validos.filter((contatoId) => !jaEstao.has(contatoId))
  if (aInserir.length === 0) return { ok: true, postos: 0 }

  const { data, error } = await db()
    .from('quadro_cartoes')
    .insert(
      aInserir.map((contatoId) => ({
        client_id: clienteId,
        quadro_id: quadroId,
        coluna_id: primeira.id,
        contact_id: contatoId,
      })),
    )
    .select('id')

  // 23505 é a corrida: outra requisição abriu o cartão entre a leitura e o
  // insert. O índice parcial fez o seu trabalho, e o resultado é o mesmo que
  // o `ignoreDuplicates` dava antes — a pessoa está no quadro.
  if (error && error.code !== '23505') {
    throw new Error(`não deu para pôr no quadro: ${error.message}`)
  }
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

  const jaEstao = await jaAbertosNoQuadro(quadroId, validos)
  const aInserir = validos.filter((contatoId) => !jaEstao.has(contatoId))
  if (aInserir.length === 0) return { ok: true, postos: 0 }

  const { data, error } = await db()
    .from('quadro_cartoes')
    .insert(
      aInserir.map((contatoId) => ({
        client_id: clienteId,
        quadro_id: quadroId,
        coluna_id: colunaId,
        contact_id: contatoId,
      })),
    )
    .select('id')

  if (error && error.code !== '23505') {
    throw new Error(`não deu para pôr na etapa: ${error.message}`)
  }
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
  autor: string | null = null,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  /**
   * De onde ele saiu, lido **antes** do update.
   *
   * A função do banco devolve o cartão já movido, então a etapa de origem não
   * existe mais depois dela — e "saiu de X para Y" sem o X é metade da frase.
   * É uma consulta a mais numa ação que já era duas escritas; mover cartão é
   * gesto humano, não laço, e o histórico é a razão de a tela existir.
   *
   * Falhar aqui não pode impedir o movimento: sem a origem o evento ainda se lê
   * ("entrou em Proposta"), e é o que `comoFrase` já faz quando `de` vem vazio.
   */
  const { data: antes } = await db()
    .from('quadro_cartoes')
    .select('coluna_id, quadro_colunas (nome)')
    .eq('client_id', clienteId)
    .eq('id', cartaoId)
    .maybeSingle()

  const origem = antes as { coluna_id: string; quadro_colunas: { nome: string } | null } | null

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
  const movidos = (data ?? []) as { id: string; contact_id: string; coluna_id: string }[]
  const movido = movidos[0]
  if (!movido) return { ok: false, motivo: 'este cartão ou esta etapa não existem mais' }

  /**
   * O evento que faltava.
   *
   * A tabela existia desde a 0058, `'mudou-de-etapa'` estava na lista de tipos e
   * `comoFrase` já sabia escrevê-lo — mas **ninguém o emitia**, e arrastar o
   * cartão é o gesto principal da tela. O histórico dizia "Nada registrado
   * ainda" depois de o time trabalhar o dia inteiro, que é pior do que não ter
   * histórico: a aba promete por escrito que a mudança de etapa aparece ali.
   *
   * **Voltar para a mesma etapa não é evento.** É engano de mão, e a função do
   * banco já trata assim quando decide não reiniciar o relógio. Registrar aqui
   * encheria a linha do tempo de "saiu de Proposta para Proposta" e enterraria
   * o que importa — o mesmo motivo pelo qual a conversa não entra nesta lista.
   */
  if (origem?.coluna_id !== movido.coluna_id) {
    const destino = await nomeDaEtapa(clienteId, movido.coluna_id)
    await anotar(
      clienteId,
      movido.contact_id,
      'mudou-de-etapa',
      { de: origem?.quadro_colunas?.nome ?? '', para: destino ?? '' },
      autor,
    )
  }

  return { ok: true }
}

/**
 * O nome de uma etapa, para a frase do histórico.
 *
 * Devolve `null` em vez de lançar: o histórico é dado de apoio, e derrubar a
 * movimentação do cartão porque o nome da coluna não veio inverteria a
 * importância das duas coisas — a mesma decisão que `anotar` toma ao engolir o
 * próprio erro.
 */
async function nomeDaEtapa(clienteId: string, colunaId: string): Promise<string | null> {
  const { data } = await db()
    .from('quadro_colunas')
    .select('nome, quadros!inner (client_id)')
    .eq('id', colunaId)
    .eq('quadros.client_id', clienteId)
    .maybeSingle()

  return (data as { nome: string } | null)?.nome ?? null
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

/** Onde um contato está num quadro, com o que é preciso para movê-lo de lá. */
export type PosicaoNoFunil = {
  /** O cartão. É por ele que `moverCartao` anda — não pelo contato. */
  cartaoId: string
  quadroId: string
  quadro: string
  etapaId: string
  etapa: string
  entrouEm: string
  /** A negociação (0058). `titulo` e `valor` são nulos enquanto ninguém anotou. */
  titulo: string | null
  valor: number | null
  situacao: Situacao
}

/**
 * Em que quadros e etapas este contato está.
 *
 * É o que a ficha do contato mostra, e o que impede o quadro de virar uma
 * ilha: quem abre a conversa precisa ver em que ponto do funil a pessoa está
 * sem trocar de tela.
 *
 * **Devolve os ids junto dos nomes**, e não só os nomes. Ver a conversa e não
 * poder mover o cartão dali é a metade inútil do recurso — quem descobre que a
 * pessoa fechou negócio no meio do atendimento tem que sair para o quadro,
 * achar o cartão e arrastar. Com `cartaoId` e `quadroId` na mão, a própria
 * conversa move.
 *
 * Nome não serve como id: dois quadros podem ter etapa "Fechado", e casar por
 * texto moveria o cartão do funil errado.
 */
export async function quadrosDoContato(
  clienteId: string,
  contatoId: string,
): Promise<PosicaoNoFunil[]> {
  const { data, error } = await db()
    .from('quadro_cartoes')
    .select(
      'id, entrou_na_coluna_em, titulo, valor, situacao, ' +
        'quadros!inner (id, nome), quadro_colunas!inner (id, nome)',
    )
    .eq('client_id', clienteId)
    .eq('contact_id', contatoId)

  if (ehIdInvalido(error)) return []
  if (error) throw new Error(`não deu para ler os quadros do contato: ${error.message}`)

  return (
    data as unknown as {
      id: string
      entrou_na_coluna_em: string
      titulo: string | null
      valor: string | number | null
      situacao: Situacao | null
      quadros: { id: string; nome: string }
      quadro_colunas: { id: string; nome: string }
    }[]
  ).map((linha) => ({
    cartaoId: linha.id,
    quadroId: linha.quadros.id,
    quadro: linha.quadros.nome,
    etapaId: linha.quadro_colunas.id,
    etapa: linha.quadro_colunas.nome,
    entrouEm: linha.entrou_na_coluna_em,
    titulo: linha.titulo,
    valor: linha.valor === null || linha.valor === undefined ? null : Number(linha.valor),
    situacao: linha.situacao ?? 'aberta',
  }))
}

// ---------------------------------------------------------------------------
// A negociação: ganhar, perder, assumir, encadear (0058)
// ---------------------------------------------------------------------------

/**
 * Fecha o cartão como ganho ou perdido.
 *
 * As três coisas que acontecem, e por quê:
 *
 * 1. **o cartão fecha e fica onde está.** Cartão fechado não some do quadro: é
 *    assim que o time enxerga o próprio resultado no fim do mês. Quem desce ele
 *    para o fim da coluna é `cartoesPorEtapa`, na tela;
 * 2. **o contato muda de estágio**, mas só se a régua deixar — quem já é cliente
 *    não vira `perdido` por causa de uma negociação nova que não deu certo;
 * 3. **ganhar abre o cartão seguinte**, quando o quadro aponta para outro. É a
 *    passagem do SDR para o vendedor, e do vendedor para o pós-venda, sem botão
 *    novo: o gesto continua sendo ganhar.
 *
 * **Agora é transação, e esta função é só a porta.** Até a T1.2 os quatro
 * passos aconteciam em quatro idas ao banco em fila, e o comentário daqui
 * admitia "não é transação": uma queda no meio deixava o cartão ganho com o
 * histórico em branco. Quem coordena isso passou a ser
 * `servicos/concluir-processo.ts`, sobre a `concluir_processo` da 0072, onde
 * estado final e evento valem juntos ou não valem.
 *
 * A assinatura ficou de pé porque há chamadores vivos. O que ela **não** tem é
 * a chave da operação, e por isso quem a usa continua protegido só pelo
 * `situacao = 'aberta'` do update: bom contra duplo clique, insuficiente
 * contra retry de resposta perdida. Quem precisa dos dois chama o serviço
 * direto — é o que `acoes-crm.ts` faz.
 */
export async function fecharCartao(
  clienteId: string,
  cartaoId: string,
  situacao: Exclude<Situacao, 'aberta'>,
  dados: { valor?: number | null; motivo?: string | null; titulo?: string | null },
  autor: string | null = null,
): Promise<{ ok: true; abriuEm?: string } | { ok: false; motivo: string }> {
  const r = await concluirProcesso({
    clienteId,
    cartaoId,
    situacao,
    valor: dados.valor ?? null,
    motivo: dados.motivo ?? null,
    titulo: dados.titulo ?? null,
    autor,
  })

  if (!r.ok) return { ok: false, motivo: r.motivo }

  // `abriuEm` é o nome do quadro de destino, e a tela o usa para dizer "foi
  // para Pós-venda" — passagem silenciosa faria o cartão sumir do funil do SDR
  // sem explicação nenhuma.
  //
  // Ele só sai quando a continuidade **de fato** aconteceu. Enquanto ela está
  // pendente ou falhou, a resposta não promete o que não entregou: é
  // literalmente o que o A26 recusa chamar de entrega completa.
  if (r.conclusao.continuidade !== 'feita' || !r.conclusao.destinoQuadroId) {
    return { ok: true }
  }

  const destino = await acharQuadro(clienteId, r.conclusao.destinoQuadroId)
  return destino ? { ok: true, abriuEm: destino.nome } : { ok: true }
}

/**
 * Reabre um cartão fechado.
 *
 * Existe porque fechar é um clique e errar o clique é rotina. **Não desfaz o
 * estágio do contato**: quem virou cliente comprou de verdade em algum momento,
 * e reabrir uma negociação não apaga o histórico. O estágio se corrige sozinho
 * no próximo fato, ou na mão.
 */
export async function reabrirCartao(
  clienteId: string,
  cartaoId: string,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const { data, error } = await db()
    .from('quadro_cartoes')
    .update({ situacao: 'aberta', motivo: null, fechado_em: null })
    .eq('client_id', clienteId)
    .eq('id', cartaoId)
    .select('id')
    .maybeSingle()

  if (ehIdInvalido(error)) return { ok: false, motivo: 'este cartão não existe mais' }
  if (error) throw new Error(`não deu para reabrir o cartão: ${error.message}`)
  if (!data) return { ok: false, motivo: 'este cartão não existe mais' }

  /*
   * A conclusão sai junto (0072).
   *
   * `conclusoes_uma_por_cartao_idx` é único por cartão, então deixá-la para
   * trás impediria a **próxima** conclusão desta mesma ocorrência — reabrir
   * por engano de clique deixaria o cartão impossível de fechar de novo.
   *
   * Apagar é o certo aqui, e não marcar como desfeita: reabrir é a correção do
   * clique errado, e o fato que ela corrige nunca deveria ter existido. O que
   * **não** é apagado é a venda — aquela tem cancelamento auditado próprio
   * (RB-31), e `vendas.cartao_id` é `restrict` justamente para que sumir em
   * silêncio seja impossível.
   *
   * A continuidade que já tiver acontecido fica: o cartão aberto no processo
   * seguinte é trabalho de alguém, e reabrir a origem não é motivo para
   * apagá-lo. O `on delete set null` de `destino_cartao_id` existe para essa
   * assimetria ser explícita.
   */
  const { error: erroDaConclusao } = await db()
    .from('conclusoes_de_processo')
    .delete()
    .eq('client_id', clienteId)
    .eq('cartao_id', cartaoId)

  // Falhar aqui não desfaz a reabertura, que já está gravada. O efeito
  // visível é a próxima conclusão deste cartão ser recusada pelo índice — e
  // isso vira frase na tela, não estado inconsistente.
  if (erroDaConclusao) {
    console.error('[quadros] não deu para limpar a conclusão:', erroDaConclusao.message)
  }

  return { ok: true }
}

/**
 * Quem assumiu o cartão.
 *
 * `null` devolve à fila de ninguém — e isso é uma ação legítima, não um engano:
 * quem sai de férias precisa poder largar o que pegou.
 */
export async function atribuirCartao(
  clienteId: string,
  cartaoId: string,
  usuarioId: string | null,
  autor: string | null = null,
): Promise<{ ok: true; quem: string | null } | { ok: false; motivo: string }> {
  const { data, error } = await db()
    .from('quadro_cartoes')
    .update({ responsavel: usuarioId })
    .eq('client_id', clienteId)
    .eq('id', cartaoId)
    // `nome:name` pelo mesmo motivo de `listarCartoes` — ver o comentário lá.
    .select('id, contact_id, af_usuarios (nome:name)')
    .maybeSingle()

  if (ehIdInvalido(error)) return { ok: false, motivo: 'este cartão não existe mais' }
  if (error) throw new Error(`não deu para atribuir o cartão: ${error.message}`)
  if (!data) return { ok: false, motivo: 'este cartão não existe mais' }

  const linha = data as unknown as {
    contact_id: string
    af_usuarios: { nome: string | null } | null
  }
  const quem = linha.af_usuarios?.nome ?? null

  await anotar(clienteId, linha.contact_id, 'assumiu', { quem: quem ?? '' }, autor)
  return { ok: true, quem }
}

/**
 * O que está sendo vendido, e por quanto.
 *
 * Texto livre e número, sem catálogo: exigir cadastro de produto antes de poder
 * anotar uma venda é o imposto que este CRM não cobra (ver `docs/MODELO-CRM.md`).
 */
export async function descreverCartao(
  clienteId: string,
  cartaoId: string,
  dados: { titulo?: string | null; valor?: number | null },
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const titulo = dados.titulo?.trim() ?? null
  if (titulo && titulo.length > LIMITE_DO_TITULO) {
    return { ok: false, motivo: `o título cabe em ${LIMITE_DO_TITULO} caracteres` }
  }

  const { data, error } = await db()
    .from('quadro_cartoes')
    .update({ titulo: titulo || null, valor: dados.valor ?? null })
    .eq('client_id', clienteId)
    .eq('id', cartaoId)
    .select('id')
    .maybeSingle()

  if (ehIdInvalido(error)) return { ok: false, motivo: 'este cartão não existe mais' }
  if (error) throw new Error(`não deu para descrever o cartão: ${error.message}`)
  return data ? { ok: true } : { ok: false, motivo: 'este cartão não existe mais' }
}

/**
 * Liga este quadro ao seguinte da cadeia — ou desliga, com `null`.
 *
 * A checagem de ciclo mora em `core/crm.ts` e acontece **antes** da escrita: o
 * banco barra só `A → A`, e A → B → C → A passaria por ele sem reclamar,
 * produzindo um repasse que não termina.
 */
export async function encadearQuadro(
  clienteId: string,
  quadroId: string,
  seguinteId: string | null,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const { data, error } = await db()
    .from('quadros')
    .select('id, seguinte_id')
    .eq('client_id', clienteId)

  if (error) throw new Error(`não deu para ler a cadeia: ${error.message}`)

  const quadros = (data as { id: string; seguinte_id: string | null }[]) ?? []
  if (!quadros.some((q) => q.id === quadroId)) {
    return { ok: false, motivo: 'este quadro não existe mais' }
  }
  if (seguinteId && !quadros.some((q) => q.id === seguinteId)) {
    return { ok: false, motivo: 'o quadro de destino não existe mais' }
  }

  const cadeia = new Map(quadros.map((q) => [q.id, q.seguinte_id]))
  const pode = podeEncadear(quadroId, seguinteId, cadeia)
  if (!pode.ok) return { ok: false, motivo: pode.motivo }

  const { error: erroDaEscrita } = await db()
    .from('quadros')
    .update({ seguinte_id: seguinteId })
    .eq('client_id', clienteId)
    .eq('id', quadroId)

  if (erroDaEscrita) throw new Error(`não deu para encadear: ${erroDaEscrita.message}`)
  return { ok: true }
}

/** O papel de uma etapa: `normal`, `ganho` ou `perdido`. */
export async function definirTipoDaEtapa(
  clienteId: string,
  quadroId: string,
  etapaId: string,
  tipo: TipoDeEtapa,
  limiteDeDias: number | null = null,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const quadro = await acharQuadro(clienteId, quadroId)
  if (!quadro || !quadro.etapas.some((e) => e.id === etapaId)) {
    return { ok: false, motivo: 'esta etapa não existe mais' }
  }

  const { error } = await db()
    .from('quadro_colunas')
    .update({ tipo, limite_de_dias: limiteDeDias })
    .eq('id', etapaId)
    .eq('quadro_id', quadroId)

  if (error) throw new Error(`não deu para mudar a etapa: ${error.message}`)
  return { ok: true }
}

/**
 * A cor do cabeçalho da etapa (0069).
 *
 * `null` apaga a cor, e isso é uma ação legítima: quem pintou o funil inteiro e
 * se arrependeu precisa poder voltar ao cinza sem apagar a etapa.
 */
export async function definirCorDaEtapa(
  clienteId: string,
  quadroId: string,
  etapaId: string,
  cor: CorDaEtapa | null,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  // A conferência é a mesma de `definirTipoDaEtapa`, e pelo mesmo motivo: o id
  // da etapa chega da tela, e sem ela pintar a etapa de outra conta passaria.
  const quadro = await acharQuadro(clienteId, quadroId)
  if (!quadro || !quadro.etapas.some((e) => e.id === etapaId)) {
    return { ok: false, motivo: 'esta etapa não existe mais' }
  }

  const { error } = await db()
    .from('quadro_colunas')
    .update({ cor })
    .eq('id', etapaId)
    .eq('quadro_id', quadroId)

  if (error) throw new Error(`não deu para mudar a cor: ${error.message}`)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Trazer quem já existia
// ---------------------------------------------------------------------------
//
// A entrada automática (0043) só alcança contato **criado agora**, e está certo:
// quem já existia e voltou a escrever não pode ser jogado de volta para a
// primeira etapa a cada mensagem. O efeito colateral é que quadro novo em conta
// antiga abre vazio com o inbox cheio — que é a tela dizendo que não há nada a
// fazer quando há dezenas de pessoas esperando.
//
// Estas duas funções existem para esse momento, e só para ele: contar quem está
// de fora e trazer todos de uma vez.

/** Quantos contatos da conta ainda não têm cartão neste quadro. */
export async function contarForaDoQuadro(clienteId: string, quadroId: string): Promise<number> {
  const [{ count: total, error: erroDosContatos }, { data: dentro, error: erroDosCartoes }] =
    await Promise.all([
      db()
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clienteId),
      db().from('quadro_cartoes').select('contact_id').eq('quadro_id', quadroId),
    ])

  if (ehIdInvalido(erroDosContatos) || ehIdInvalido(erroDosCartoes)) return 0
  if (erroDosContatos) throw new Error(`não deu para contar os contatos: ${erroDosContatos.message}`)
  if (erroDosCartoes) throw new Error(`não deu para ler o quadro: ${erroDosCartoes.message}`)

  return Math.max(0, (total ?? 0) - new Set((dentro as { contact_id: string }[]).map((l) => l.contact_id)).size)
}

/**
 * Põe no quadro todo mundo que ainda está de fora.
 *
 * Teto de 500 por chamada, e não porque o banco sofreria: quinhentos cartões já
 * são mais do que qualquer pessoa consegue olhar, e uma conta com milhares de
 * contatos antigos quer escolher quem entra — não despejar o histórico inteiro
 * num funil de trabalho. Acima do teto a tela avisa e a pessoa repete.
 */
export async function trazerTodosParaOQuadro(
  clienteId: string,
  quadroId: string,
  teto = 500,
): Promise<{ ok: true; postos: number; faltaram: number } | { ok: false; motivo: string }> {
  const quadro = await acharQuadro(clienteId, quadroId)
  if (!quadro) return { ok: false, motivo: 'este quadro não existe mais' }
  if (!quadro.etapas[0]) {
    return { ok: false, motivo: 'crie uma etapa antes de trazer gente para o quadro' }
  }

  const { data, error } = await db()
    .from('contacts')
    .select('id')
    .eq('client_id', clienteId)
    .order('criado_em', { ascending: false })

  if (ehIdInvalido(error)) return { ok: false, motivo: 'conta inválida' }
  if (error) throw new Error(`não deu para listar os contatos: ${error.message}`)

  const { data: jaEstao, error: erroDosCartoes } = await db()
    .from('quadro_cartoes')
    .select('contact_id')
    .eq('quadro_id', quadroId)

  if (erroDosCartoes) throw new Error(`não deu para ler o quadro: ${erroDosCartoes.message}`)

  const dentro = new Set((jaEstao as { contact_id: string }[]).map((l) => l.contact_id))
  const fora = (data as { id: string }[]).map((l) => l.id).filter((id) => !dentro.has(id))
  if (fora.length === 0) return { ok: true, postos: 0, faltaram: 0 }

  const agora = fora.slice(0, teto)
  const posto = await porNoQuadro(clienteId, quadroId, agora)
  if (!posto.ok) return posto

  return { ok: true, postos: posto.postos, faltaram: fora.length - agora.length }
}
