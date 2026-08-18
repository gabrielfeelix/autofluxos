import { horaExata, quando } from '@/lib/quando'
import { listarAtos, type LinhaDeAuditoria } from '@/server/repos/auditoria'

export const dynamic = 'force-dynamic'

/**
 * Quem fez o quê.
 *
 * A tabela é **append-only no banco** (migration 0021): `service_role` só tem
 * `insert` e `select`. Não existe botão de apagar aqui porque não existe
 * permissão para apagar lá — um log que a aplicação consegue editar não prova
 * nada.
 *
 * A linha de impersonação é destacada de propósito. É a que separa "o cliente
 * fez" de "a 4YU fez em nome do cliente", e é a que alguém vai procurar com
 * pressa no dia em que precisar.
 */
export default async function Auditoria() {
  const atos = await listarAtos()

  return (
    <main className="max-w-[980px] px-4 pt-[38px] pb-[46px] md:px-[46px]">
      <header className="mb-7">
        <h1 className="text-[25px] font-bold tracking-[-0.02em]">Auditoria</h1>
        <p className="mt-1 text-[13px] text-muted">
          O que aconteceu na plataforma, do mais novo para o mais velho. Não dá para editar nem
          apagar — nem por aqui, nem pelo código.
        </p>
      </header>

      {atos.length === 0 ? (
        <section className="app-card border-dashed px-8 py-12 text-center">
          <p className="text-[14px] font-semibold text-soft">Nada registrado ainda</p>
          <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-6 text-dim">
            O registro começa a encher quando alguém cadastrar uma pessoa, ligar alguém a uma conta
            ou entrar como outro usuário.
          </p>
        </section>
      ) : (
        <ul className="app-card divide-y divide-white/[0.045] overflow-hidden">
          {atos.map((ato) => (
            <li key={ato.id}>
              <Linha ato={ato} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

/**
 * A ação vem como verbo em `snake_case` (`entrou_como`, `trocou_papel`), e é
 * texto livre no banco de propósito — enum obrigaria migration a cada ação
 * nova, e o custo de uma ação não registrada é maior que o de um nome torto.
 *
 * Aqui a gente traduz o que conhece e mostra cru o que não conhece. Cair no
 * cru é a prova de que faltou passar por aqui, e é melhor que uma linha em
 * branco.
 */
const VERBOS: Record<string, string> = {
  criou_primeiro_administrador: 'criou o primeiro administrador',
  criou_usuario: 'cadastrou',
  criou_conta: 'criou a conta',
  vinculou_membro: 'ligou à conta',
  trocou_papel: 'mudou o papel de',
  revogou_sessoes: 'derrubou as sessões de',
  suspendeu_acesso: 'suspendeu',
  devolveu_acesso: 'devolveu o acesso de',
  entrou_como: 'entrou como',
  saiu_do_entrar_como: 'saiu de',
}

function Linha({ ato }: { ato: LinhaDeAuditoria }) {
  const impersonacao = ato.acao === 'entrou_como' || ato.impersonadoPor !== null

  return (
    <article className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-4 py-3">
      <span
        aria-hidden
        className={`text-[11px] ${impersonacao ? 'text-amber-300' : 'text-transparent'}`}
      >
        ⚠
      </span>

      <p className="min-w-0 flex-1 text-[12.5px] leading-6">
        <strong className="font-semibold text-soft">{ato.autorEmail || 'alguém'}</strong>{' '}
        <span className={impersonacao ? 'text-amber-300' : 'text-muted'}>
          {VERBOS[ato.acao] ?? ato.acao}
        </span>{' '}
        {ato.alvoNome && <strong className="font-semibold text-soft">{ato.alvoNome}</strong>}
        {ato.contaNome && <span className="text-dim"> · {ato.contaNome}</span>}
        {ato.impersonadoPor && (
          <span className="text-amber-300/80"> · feito de dentro de um “entrar como”</span>
        )}
      </p>

      <time
        dateTime={ato.quando}
        title={horaExata(ato.quando)}
        className="shrink-0 text-[11.5px] text-dim"
      >
        {quando(ato.quando)}
      </time>
    </article>
  )
}
