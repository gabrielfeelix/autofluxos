import Link from 'next/link'

/**
 * A tela de quem abriu, pelo link, uma seção que o acesso dela não inclui (E7).
 *
 * Substitui o 404 silencioso: "página não existe" fazia a pessoa achar que o
 * link estava quebrado, e ela ia reclamar de defeito em vez de pedir acesso.
 * O motivo é dito, e com quem resolver. A ação continua recusada no servidor;
 * esta tela é só a explicação.
 */
export function SemAcesso({ clienteId, oQue }: { clienteId: string; oQue: string }) {
  return (
    <Aviso
      titulo={`Sem acesso a ${oQue}`}
      texto={`Seu acesso não inclui ${oQue}. Fale com o proprietário da organização.`}
      acao={{ rotulo: 'Voltar ao Painel', href: `/clientes/${clienteId}` }}
    />
  )
}

/**
 * O funil existe, mas a conta desligou o CRM (E8).
 *
 * É outra resposta, e por isso outra tela: não é falta de acesso, é uma
 * escolha da conta, e quem pode desfazê-la ganha o caminho direto.
 */
export function FunilDesligado({ clienteId, podeLigar }: { clienteId: string; podeLigar: boolean }) {
  return (
    <Aviso
      titulo="O funil está desligado nesta organização"
      texto={
        podeLigar
          ? 'Os funis e as negociações continuam guardados. Para voltar a usar, ligue o funil em Objetivo e recursos.'
          : 'Os funis e as negociações continuam guardados. Quem pode ligar de volta é o proprietário da conta.'
      }
      acao={
        podeLigar
          ? { rotulo: 'Abrir Objetivo e recursos', href: `/clientes/${clienteId}/ajustes/recursos` }
          : { rotulo: 'Voltar ao Painel', href: `/clientes/${clienteId}` }
      }
    />
  )
}

function Aviso({
  titulo,
  texto,
  acao,
}: {
  titulo: string
  texto: string
  acao: { rotulo: string; href: string }
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <section className="app-card w-full max-w-[440px] p-7 text-center">
        <span
          aria-hidden
          className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-surface text-dim"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
        </span>
        <h1 className="text-[19px] font-bold tracking-[-0.01em]">{titulo}</h1>
        <p className="mt-2 text-[13px] leading-6 text-dim">{texto}</p>
        <Link
          href={acao.href}
          className="mt-5 inline-flex rounded-lg border border-line px-3.5 py-2 text-[12.5px] font-semibold text-muted transition hover:text-primary"
        >
          {acao.rotulo}
        </Link>
      </section>
    </main>
  )
}
