import { telefoneCanonico } from './contatos/telefone'
import { cnpjValido, cpfValido } from './documentos'
import { linhasDoCard, type ProdutoDaLoja } from './loja'

/**
 * O chat do site: o que a conta configura e o que o visitante pode ver.
 *
 * Tudo aqui é puro, sem banco e sem rede, porque é aqui que moram as duas
 * decisões de segurança do canal: **de onde** o balão pode falar (a lista de
 * domínios) e **o que** sai do banco para um navegador que não é da equipe
 * (`mensagemPublica`). As duas precisam de teste que não dependa de subir nada.
 */

export type ConfigDoSite = {
  /** Os endereços onde o balão pode aparecer, só o host: `pcyes.com.br`. */
  dominios: string[]
  /** A cor do balão e dos botões, em `#rrggbb`. */
  cor: string
  /** O nome no topo da janela de conversa. */
  titulo: string
  /** A primeira frase, antes de a pessoa escrever. Só enfeite: não é o fluxo. */
  saudacao: string
  /**
   * O que o balão pede antes da conversa, na ordem em que aparece. Vazio = não
   * pede nada e a pessoa já começa escrevendo.
   */
  formulario: CampoDoFormulario[]
  /** A promessa de tempo no cartão "Nova conversa". */
  prazo: string
  /**
   * A animação do botão, quando a loja mandou a dela (o personagem da marca).
   * `null` = o robô padrão. A URL é sempre do nosso Storage: a tela sobe o
   * arquivo, e o balão nunca carrega mídia de endereço que alguém digitou.
   */
  mascote: Mascote | null
  /** O fundo do balão. A cor da marca vale nos dois. */
  tema: 'claro' | 'escuro'
}

export type Mascote = { url: string; tipo: 'imagem' | 'video' }

/** Os campos que o formulário do balão sabe pedir, na ordem em que aparecem. */
export const TIPOS_DO_FORMULARIO = ['nome', 'email', 'telefone', 'cpf', 'cnpj', 'proprio'] as const
export type TipoDoFormulario = (typeof TIPOS_DO_FORMULARIO)[number]

export type CampoDoFormulario = {
  tipo: TipoDoFormulario
  obrigatorio: boolean
  /** Só no `proprio`: a pergunta que a empresa escreveu. */
  rotulo?: string
}

/**
 * O formulário de quem já tinha o balão no ar antes de ele existir.
 *
 * O `pedirContato: true` antigo pedia nome e um WhatsApp ou e-mail, depois da
 * primeira resposta e com "Agora não". Agora o formulário vem antes da
 * conversa, e cobrar o WhatsApp de quem nunca escolheu isso seria mudar a loja
 * sem ela pedir: o nome fica obrigatório (é o mínimo para atender alguém pelo
 * nome) e o WhatsApp opcional.
 */
const FORMULARIO_DE_ANTES: CampoDoFormulario[] = [
  { tipo: 'nome', obrigatorio: true },
  { tipo: 'telefone', obrigatorio: false },
]

export const CONFIG_PADRAO: ConfigDoSite = {
  dominios: [],
  cor: '#6366F1',
  titulo: 'Atendimento',
  saudacao: 'Olá! Como podemos ajudar?',
  formulario: FORMULARIO_DE_ANTES,
  prazo: 'Costumamos responder em poucos minutos',
  mascote: null,
  tema: 'claro',
}

/** Tetos dos campos de texto, para o balão não virar outdoor. */
export const TETO_DO_TITULO = 40
export const TETO_DA_SAUDACAO = 160
export const TETO_DO_PRAZO = 60
/** A pergunta do campo próprio do formulário. */
export const TETO_DO_ROTULO = 40
/** Quantos domínios uma conta cadastra. Loja real tem dois ou três. */
export const TETO_DE_DOMINIOS = 10
/** O maior texto que um visitante manda numa mensagem. */
export const TETO_DA_MENSAGEM = 2_000

const COR = /^#[0-9a-fA-F]{6}$/

/**
 * Lê o `site_config` do banco, completando o que faltar.
 *
 * O jsonb pode vir de uma versão anterior da tela, sem um campo que esta
 * versão conhece. Completar com o padrão, em vez de recusar, é o que deixa um
 * campo novo nascer sem migration de dados.
 */
export function lerConfigDoSite(bruto: unknown): ConfigDoSite {
  const o = bruto && typeof bruto === 'object' ? (bruto as Record<string, unknown>) : {}
  const texto = (v: unknown, padrao: string, teto: number) =>
    typeof v === 'string' && v.trim() !== '' ? v.trim().slice(0, teto) : padrao

  return {
    dominios: Array.isArray(o.dominios)
      ? o.dominios.map((d) => normalizarDominio(String(d))).filter((d): d is string => d !== null)
      : [],
    cor: typeof o.cor === 'string' && COR.test(o.cor) ? o.cor.toUpperCase() : CONFIG_PADRAO.cor,
    titulo: texto(o.titulo, CONFIG_PADRAO.titulo, TETO_DO_TITULO),
    saudacao: texto(o.saudacao, CONFIG_PADRAO.saudacao, TETO_DA_SAUDACAO),
    formulario: lerFormulario(o.formulario, o.pedirContato),
    prazo: texto(o.prazo, CONFIG_PADRAO.prazo, TETO_DO_PRAZO),
    mascote: lerMascote(o.mascote),
    tema: o.tema === 'escuro' ? 'escuro' : 'claro',
  }
}

/**
 * A lista de campos, limpa: um de cada tipo, na ordem fixa, e o próprio só com
 * pergunta escrita. Sem a lista no banco, vale o `pedirContato` de antes.
 */
export function lerFormulario(bruto: unknown, pedirContatoAntigo?: unknown): CampoDoFormulario[] {
  if (!Array.isArray(bruto)) return pedirContatoAntigo === false ? [] : FORMULARIO_DE_ANTES

  const porTipo = new Map<TipoDoFormulario, CampoDoFormulario>()
  for (const item of bruto) {
    const c = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    const tipo = TIPOS_DO_FORMULARIO.find((t) => t === c.tipo)
    if (!tipo || porTipo.has(tipo)) continue
    const campo: CampoDoFormulario = { tipo, obrigatorio: c.obrigatorio === true }
    if (tipo === 'proprio') {
      const rotulo = typeof c.rotulo === 'string' ? c.rotulo.trim().replace(/\s+/g, ' ').slice(0, TETO_DO_ROTULO) : ''
      if (!chaveDoCampoProprio(rotulo)) continue
      campo.rotulo = rotulo
    }
    porTipo.set(tipo, campo)
  }
  return TIPOS_DO_FORMULARIO.flatMap((t) => (porTipo.has(t) ? [porTipo.get(t)!] : []))
}

/**
 * Onde o campo próprio grava no contato: `Número do pedido` vira
 * `numero_do_pedido`. Sai da pergunta, e não de um id guardado, para a ficha
 * do lead mostrar a mesma frase (`rotuloDoCampo`) sem cadastro à parte.
 * Chave que já tem dono no contato ganha `site_` na frente, para a pergunta
 * "Telefone" não sobrescrever o telefone verdadeiro.
 */
export function chaveDoCampoProprio(rotulo: string): string | null {
  const chave = rotulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
  if (!/[a-z]/.test(chave)) return null
  return CHAVES_RESERVADAS.has(chave) ? `site_${chave}` : chave
}

const CHAVES_RESERVADAS = new Set(['nome', 'nome_real', 'email', 'telefone', 'whatsapp', 'waid', 'cpf', 'cnpj', 'pagina_do_site'])

/** Onde cada campo do formulário mora em `contacts.campos`. O nome vai na coluna. */
export function chaveNoContato(campo: CampoDoFormulario): string | null {
  switch (campo.tipo) {
    case 'nome':
      return null
    case 'email':
      return 'email'
    case 'telefone':
      return 'whatsapp'
    case 'cpf':
      return 'cpf'
    case 'cnpj':
      return 'cnpj'
    case 'proprio':
      return chaveDoCampoProprio(campo.rotulo ?? '')
  }
}

export type FichaLida =
  | { ok: true; nome: string | null; campos: Record<string, string> }
  | { ok: false; erros: Partial<Record<TipoDoFormulario, string>> }

/**
 * Confere o que o visitante preencheu contra o formulário da conta.
 *
 * Campo que a conta não pede é ignorado, nunca gravado: o navegador é de
 * terceiro, e mandar `cpf` para uma loja que não pede CPF não pode criar dado
 * pessoal que ninguém escolheu guardar. Obrigatório vazio é erro; opcional
 * vazio é só "não quis dizer".
 */
export function lerFicha(formulario: CampoDoFormulario[], bruto: unknown): FichaLida {
  const dados = bruto && typeof bruto === 'object' ? (bruto as Record<string, unknown>) : {}
  const erros: Partial<Record<TipoDoFormulario, string>> = {}
  const campos: Record<string, string> = {}
  let nome: string | null = null

  for (const campo of formulario) {
    const valor = typeof dados[campo.tipo] === 'string' ? (dados[campo.tipo] as string).trim() : ''
    if (valor === '') {
      if (campo.obrigatorio) erros[campo.tipo] = 'Preencha este campo.'
      continue
    }

    const lido = lerValor(campo.tipo, valor)
    if (lido === null) {
      erros[campo.tipo] = MOTIVO[campo.tipo]
      continue
    }
    if (campo.tipo === 'nome') nome = lido
    else campos[chaveNoContato(campo)!] = lido
  }

  return Object.keys(erros).length ? { ok: false, erros } : { ok: true, nome, campos }
}

const MOTIVO: Record<TipoDoFormulario, string> = {
  nome: 'Escreva seu nome.',
  email: 'Confira o e-mail.',
  telefone: 'Confira o número, com DDD.',
  cpf: 'CPF inválido. Confira os números.',
  cnpj: 'CNPJ inválido. Confira os números.',
  proprio: 'Resposta longa demais.',
}

function lerValor(tipo: TipoDoFormulario, valor: string): string | null {
  switch (tipo) {
    case 'nome': {
      const nome = valor.replace(/\s+/g, ' ').slice(0, 60)
      return nome.length >= 2 ? nome : null
    }
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor) && valor.length <= 120 ? valor.toLowerCase() : null
    case 'telefone':
      return telefoneComDdi(valor)
    case 'cpf':
      return cpfValido(valor)
    case 'cnpj':
      return cnpjValido(valor)
    case 'proprio':
      return valor.length <= 200 ? valor : null
  }
}

/**
 * O telefone chega como `+<DDI> <número>`. Brasil passa pela régua de sempre
 * (DDD e nono dígito, ver `telefoneCanonico`); outro país só pelo tamanho que
 * o E.164 permite, porque não há DDD para conferir.
 */
export function telefoneComDdi(valor: string): string | null {
  const so = valor.replace(/\D/g, '')
  if (so.startsWith('55')) {
    if (so.length !== 12 && so.length !== 13) return null
    return telefoneCanonico(so)
  }
  return so.length >= 8 && so.length <= 15 ? so : null
}

/**
 * Os campos que este contato ainda não respondeu. É o que o balão usa para
 * saber se mostra o formulário de novo: quem já disse o nome não é perguntado
 * outra vez, mas um CPF que a loja passou a pedir aparece na próxima conversa.
 */
export function camposQueFaltam(
  formulario: CampoDoFormulario[],
  contato: { nome: string | null; campos: Record<string, string> } | null,
): TipoDoFormulario[] {
  return formulario
    .filter((campo) => {
      if (!contato) return true
      if (campo.tipo === 'nome') return !contato.nome
      const chave = chaveNoContato(campo)
      return !chave || !contato.campos[chave]
    })
    .map((campo) => campo.tipo)
}

function lerMascote(bruto: unknown): Mascote | null {
  const m = bruto && typeof bruto === 'object' ? (bruto as Record<string, unknown>) : null
  if (!m || typeof m.url !== 'string' || !/^https?:\/\//.test(m.url)) return null
  return { url: m.url, tipo: m.tipo === 'video' ? 'video' : 'imagem' }
}

/**
 * `https://www.PCYES.com.br/loja?x=1` vira `www.pcyes.com.br`.
 *
 * Aceita o que o lojista cola, com protocolo, caminho ou barra no fim, porque
 * é o que ele copia da barra do navegador. Devolve `null` para o que não tem
 * cara de domínio: um host sem ponto (`localhost`, `loja`) não é endereço
 * público, e aceitá-lo abriria o canal para qualquer página servida na máquina
 * de quem quisesse.
 */
export function normalizarDominio(entrada: string): string | null {
  let bruto = entrada.trim().toLowerCase()
  if (bruto === '') return null
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(bruto)) bruto = `https://${bruto}`

  let host: string
  try {
    host = new URL(bruto).hostname
  } catch {
    return null
  }

  if (!host.includes('.')) return null
  if (!/^[a-z0-9.-]+$/.test(host)) return null
  if (host.startsWith('.') || host.endsWith('.') || host.includes('..')) return null
  return host
}

/** O mesmo domínio com e sem `www.` conta como um só. */
function semWww(host: string): string {
  return host.startsWith('www.') ? host.slice(4) : host
}

/**
 * Este navegador pode falar com o canal?
 *
 * O `Origin` é o cabeçalho que o navegador escreve sozinho e o JavaScript da
 * página não consegue trocar, e é por isso que ele é a porta: um site de
 * terceiro que copiasse o trecho do lojista chegaria aqui com a origem dele, e
 * seria recusado. Um script fora do navegador (curl) forja o `Origin` à
 * vontade, e contra isso o que vale é o limite por IP, não esta função.
 *
 * `https` obrigatório: o segredo do visitante viaja nestas chamadas.
 *
 * Só o host exato, com a única folga do `www.`. Subdomínio não herda: liberar
 * `pcyes.com.br` não libera `blog.pcyes.com.br`, que pode ser de outra empresa
 * contratada, com outro código rodando.
 */
export function origemPermitida(
  origem: string | null,
  dominios: string[],
  /** Só no ambiente local: aceita `http://localhost`, onde se testa o balão. */
  permitirLocal = false,
): boolean {
  if (!origem) return false

  let url: URL
  try {
    url = new URL(origem)
  } catch {
    return false
  }
  if (permitirLocal && url.hostname === 'localhost') return true
  if (url.protocol !== 'https:') return false

  const host = semWww(url.hostname.toLowerCase())
  return dominios.some((d) => semWww(d) === host)
}

/**
 * Lê a lista de domínios que a tela mandou, uma por linha ou por vírgula.
 *
 * Devolve os válidos, sem repetição, e os que não deu para ler, para a tela
 * dizer quais foram recusados em vez de sumir com eles calada.
 */
export function lerListaDeDominios(texto: string): { validos: string[]; recusados: string[] } {
  const validos: string[] = []
  const recusados: string[] = []
  for (const parte of texto.split(/[\s,;]+/)) {
    if (parte.trim() === '') continue
    const dominio = normalizarDominio(parte)
    if (!dominio) recusados.push(parte.trim())
    else if (!validos.includes(dominio)) validos.push(dominio)
  }
  return { validos: validos.slice(0, TETO_DE_DOMINIOS), recusados }
}

/**
 * O segredo do visitante tem forma de segredo?
 *
 * O navegador gera 32 bytes aleatórios em base64url (43 caracteres). A
 * conferência de tamanho não é enfeite: um segredo curto seria adivinhável, e
 * adivinhar o segredo é ler a conversa de outra pessoa.
 */
export function segredoValido(valor: unknown): valor is string {
  return typeof valor === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(valor)
}

/** Uma opção de botão ou lista, como o visitante a vê. */
export type OpcaoPublica = { id: string; rotulo: string }

/** Um produto do card, só o que o balão desenha. */
export type ProdutoPublico = {
  nome: string
  /** Preço e estoque numa linha, a mesma do card do WhatsApp. */
  detalhe?: string
  foto?: string
  link?: string
}

/**
 * Uma mensagem como o navegador do visitante a recebe.
 *
 * **Lista do que sai, e não do que fica de fora.** O `payload` guarda o corpo
 * cru que o canal recebeu, o autor com id de usuário da equipe, e o que mais o
 * futuro puser lá. Copiar o objeto e apagar o sensível vazaria o próximo campo
 * que alguém acrescentasse sem lembrar desta tela. Aqui só passa o que foi
 * escolhido, campo por campo.
 */
export type MensagemPublica = {
  id: string
  de: 'visitante' | 'empresa'
  texto: string
  em: string
  /**
   * O id que o balão deu à mensagem do visitante antes de mandar. É o que
   * deixa o balão trocar a bolha otimista pela gravada sem piscar nem duplicar.
   */
  ref?: string
  /** O primeiro nome de quem respondeu, quando foi uma pessoa. */
  autor?: string
  opcoes?: OpcaoPublica[]
  produtos?: ProdutoPublico[]
  midia?: { tipo: string; url: string; nomeArquivo?: string }
}

type LinhaDeMensagem = {
  id: string
  direcao: string
  texto: string | null
  ts: string
  payload: unknown
  wa_message_id?: string | null
}

function textoSeguro(v: unknown, teto = 500): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v.slice(0, teto) : undefined
}

function urlSegura(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  try {
    const url = new URL(v)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

/** Preço e estoque pela mesma régua do card do WhatsApp; nada, se o produto vier torto. */
function detalheDoProduto(o: Record<string, unknown>): string | undefined {
  const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
  try {
    const { detalhe } = linhasDoCard({
      produtoId: '',
      nome: '',
      link: '',
      emEstoque: o.emEstoque !== false,
      preco: numero(o.preco),
      precoDe: numero(o.precoDe),
      precoAPartirDe: numero(o.precoAPartirDe),
      quantidade: numero(o.quantidade),
      ...(o.semControleDeEstoque === true ? { semControleDeEstoque: true } : {}),
    } as ProdutoDaLoja)
    return detalhe || undefined
  } catch {
    return undefined
  }
}

export function mensagemPublica(linha: LinhaDeMensagem): MensagemPublica {
  const p = linha.payload && typeof linha.payload === 'object' ? (linha.payload as Record<string, unknown>) : {}
  const saida = linha.direcao === 'saida'

  const publica: MensagemPublica = {
    id: linha.id,
    de: saida ? 'empresa' : 'visitante',
    texto: linha.texto ?? '',
    em: linha.ts,
  }

  if (!saida) {
    // `site:<endereço>:<ref>`, ver `receber-do-site.ts`. Só o último pedaço sai.
    const ref = linha.wa_message_id?.split(':').pop()
    if (ref && linha.wa_message_id?.startsWith('site:')) publica.ref = ref
    return publica
  }

  const autor = p.autor as { tipo?: unknown; nome?: unknown } | undefined
  if (autor?.tipo === 'pessoa' && typeof autor.nome === 'string') {
    // Só o primeiro nome: sobrenome de funcionário não é da conta do visitante.
    const primeiro = autor.nome.trim().split(/\s+/)[0]
    if (primeiro) publica.autor = primeiro.slice(0, 40)
  }

  if (Array.isArray(p.opcoes)) {
    publica.opcoes = p.opcoes
      .map((o) => o as { id?: unknown; rotulo?: unknown })
      .filter((o) => typeof o.id === 'string' && typeof o.rotulo === 'string')
      .map((o) => ({ id: (o.id as string).slice(0, 200), rotulo: (o.rotulo as string).slice(0, 80) }))
  }

  if (Array.isArray(p.produtos)) {
    publica.produtos = p.produtos.slice(0, 10).map((bruto) => {
      const o = (bruto ?? {}) as Record<string, unknown>
      const produto: ProdutoPublico = { nome: textoSeguro(o.nome, 160) ?? 'Produto' }
      const detalhe = detalheDoProduto(o)
      const foto = urlSegura(o.foto)
      const link = urlSegura(o.link)
      if (detalhe) produto.detalhe = detalhe
      if (foto) produto.foto = foto
      if (link) produto.link = link
      return produto
    })
  }

  const url = urlSegura(p.url)
  if (typeof p.midia === 'string' && url) {
    publica.midia = { tipo: p.midia, url, ...(textoSeguro(p.nomeArquivo, 120) ? { nomeArquivo: textoSeguro(p.nomeArquivo, 120) } : {}) }
  }

  return publica
}
