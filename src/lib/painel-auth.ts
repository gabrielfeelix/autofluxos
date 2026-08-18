export const COOKIE_PAINEL = 'autofluxos_painel'
export const DURACAO_SESSAO_SEGUNDOS = 60 * 60 * 12

/**
 * A sessão do painel.
 *
 * **O que havia antes:** o cookie era `SHA-256(senha)` — o mesmo valor para
 * todo mundo, para sempre. Sem nonce, sem carimbo de tempo. Não expirava (o
 * `maxAge` de 12h é combinado com o navegador, e navegador nenhum é obrigado a
 * cumprir), e um cookie copiado de um print valia até alguém trocar a senha.
 *
 * **Cookie assinado, e não sessão em banco.** A tentação é uma tabela
 * `painel_sessions`, mas quem confere a sessão é o `proxy.ts`, que roda antes da
 * renderização de toda requisição e não é lugar de ir ao banco. Um cookie
 * `id.expira.HMAC(segredo, id.expira)` dá o que falta sem nenhuma consulta: é
 * **único por sessão** (id aleatório), **expira de verdade** (quem confere é o
 * servidor, não o navegador) e **revoga todo mundo** ao trocar o segredo.
 *
 * Revogar *uma* sessão específica continua exigindo banco, e isso é problema de
 * papéis de usuário — quando existir mais de uma pessoa. Fica escrito aqui, não
 * fica feito.
 */

/** `id.expira` — o que é assinado. O `.` não aparece em hex nem em número. */
const FORMATO_DO_ID = /^[0-9a-f]{32}$/

/**
 * O segredo que assina a sessão.
 *
 * Separado da senha de propósito: trocar a senha e encerrar todas as sessões
 * viraram duas decisões diferentes, e a segunda não obriga mais a avisar todo
 * mundo de uma senha nova.
 *
 * Sem `PAINEL_SEGREDO` no ambiente, ele é **derivado** da senha em vez de o
 * painel falhar fechado. Um ambiente que já estava no ar não pode parar de
 * autenticar por causa de uma variável que ninguém preencheu ainda — e o valor
 * derivado nunca é a senha, é uma string que só serve para assinar.
 */
export function segredoDeSessao(senha: string): string {
  return process.env.PAINEL_SEGREDO || `autofluxos:derivado-da-senha:v1:${senha}`
}

/** Emite uma sessão nova. Cada login gera um id que nunca existiu antes. */
export async function criarSessao(
  segredo: string,
  agoraMs: number = Date.now(),
  duracaoSegundos: number = DURACAO_SESSAO_SEGUNDOS,
): Promise<string> {
  const corpo = `${idAleatorio()}.${Math.floor(agoraMs / 1000) + duracaoSegundos}`
  return `${corpo}.${await assinar(corpo, segredo)}`
}

/**
 * Confere uma sessão. Recusa cookie adulterado, expirado ou de outro segredo.
 *
 * A assinatura é conferida **antes** da validade: o prazo está dentro do cookie,
 * e acreditar num prazo que ainda não foi provado é acreditar em quem escreveu o
 * cookie.
 */
export async function conferirSessao(
  cookie: string,
  segredo: string,
  agoraMs: number = Date.now(),
): Promise<boolean> {
  const [id = '', expira = '', assinatura = '', ...sobra] = cookie.split('.')
  if (sobra.length > 0) return false
  if (!FORMATO_DO_ID.test(id) || !/^[0-9]{1,15}$/.test(expira)) return false

  if (!iguais(assinatura, await assinar(`${id}.${expira}`, segredo))) return false
  return Math.floor(agoraMs / 1000) < Number(expira)
}

function idAleatorio(): string {
  return paraHex(crypto.getRandomValues(new Uint8Array(16)).buffer)
}

async function assinar(mensagem: string, segredo: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(segredo),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return paraHex(await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(mensagem)))
}

function paraHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Compara sem sair cedo no primeiro caractere diferente. */
export function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diferenca = 0
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diferenca === 0
}

/**
 * Basic Auth, aceito por compatibilidade com acessos já configurados.
 *
 * Mora aqui, e não no `proxy.ts`, porque **duas** camadas precisam da mesma
 * resposta desde que existem duas portas: o proxy, que deixa a requisição
 * passar, e o servidor que renderiza, que precisa saber se quem chegou tem a
 * sessão do painel antes de exigir uma conta de usuário. Uma cópia em cada
 * lugar viraria um caminho que abre e outro que fecha.
 */
export function basicAuthConfere(cabecalho: string | null, senha: string): boolean {
  if (!cabecalho?.startsWith('Basic ')) return false

  try {
    const [, informada] = atob(cabecalho.slice(6)).split(':')
    return informada !== undefined && iguais(informada, senha)
  } catch {
    return false
  }
}
