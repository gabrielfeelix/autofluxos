/**
 * O esqueleto do Inbox enquanto o servidor monta a página.
 *
 * ---------------------------------------------------------------------------
 * Por que este arquivo existe: o rail parecia travado
 * ---------------------------------------------------------------------------
 *
 * As fichas do rail (`Todos`, `Sem dono`, `Meus`, cada atendente) são `<Link>`
 * para a mesma rota com outro `?de=`. Clicar refazia a página inteira no
 * servidor — seis consultas, das quais só a lista de conversas muda — e, sem
 * este arquivo, **nada acontecia na tela até tudo terminar**. O clique parecia
 * ignorado, e a reação natural é clicar de novo.
 *
 * A causa não era a lentidão em si, e sim a falta de resposta: rota dinâmica
 * **não é prefetchada** pelo Next a menos que exista um `loading.tsx`. É o que
 * a doc da versão instalada diz, literalmente — *"Dynamic Route: prefetching is
 * skipped, or the route is partially prefetched if `loading.tsx` is present"* —
 * e a recomendação que vem logo depois é adicionar o arquivo justamente para
 * *"trigger immediate navigation"*.
 *
 * Com ele, duas coisas mudam de uma vez: o Next passa a prefetchar a parte
 * estática da rota quando a ficha entra na viewport, e a troca de filtro
 * responde na hora — este esqueleto aparece imediatamente e é trocado pelo
 * conteúdo quando o servidor termina.
 *
 * ---------------------------------------------------------------------------
 * Por que ele imita a moldura em vez de ser um "carregando..."
 * ---------------------------------------------------------------------------
 *
 * A mesma grade de três colunas, com as mesmas medidas do `page.tsx`. Um
 * spinner centralizado trocaria a tela inteira por outra coisa e devolveria o
 * layout depois — o pulo que faz perder o lugar de onde se estava olhando.
 * Mantendo a moldura, só o conteúdo pisca.
 *
 * **As medidas precisam continuar iguais às do `page.tsx`.** Se a grade de lá
 * mudar e esta não, a troca volta a dar o pulo que este arquivo existe para
 * evitar.
 */
export default function Carregando() {
  return (
    /*
     * O `main` e o cabeçalho repetem os do `page.tsx` byte a byte (incluindo
     * `px-4 md:px-[42px] pt-[26px] pb-[42px]` e o `mb-3` do header). É o que
     * faz o esqueleto e a tela real ocuparem o mesmo lugar: qualquer diferença
     * aqui vira um salto no instante em que um troca pelo outro.
     */
    <main className="px-4 md:px-[42px] pt-[26px] pb-[42px]">
      <header className="mb-3">
        <p className="font-mono text-[10px] font-bold tracking-[0.14em] text-dim">ATENDIMENTO</p>
        <h1 className="mt-0.5 text-[19px] font-bold tracking-[-0.02em]">Inbox</h1>
      </header>

      <div className="grid h-[calc(100dvh-116px)] min-h-[420px] grid-cols-[292px_minmax(390px,1fr)_250px] overflow-hidden rounded-[16px] border border-white/[0.075] bg-[#0c1118] shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        {/* Coluna 1: a fila. */}
        <aside className="flex min-h-0 min-w-0 flex-col border-r border-white/[0.06] bg-white/[0.015]">
          <header className="border-b border-white/[0.06] px-4 py-[17px]">
            <Barra className="h-[14px] w-[72px]" />
            <Barra className="mt-2 h-[11px] w-[168px]" />
            <div className="mt-2.5 flex gap-1.5">
              <Barra className="h-[30px] flex-1 rounded-lg" />
              <Barra className="h-[30px] w-[56px] rounded-lg" />
            </div>
            {/*
              As fichas do rail: é o que a pessoa acabou de clicar, e vê-las no
              esqueleto é o que diz que o clique valeu.
            */}
            <div className="mt-2.5 flex gap-1">
              <Barra className="h-[22px] w-[64px] rounded-full" />
              <Barra className="h-[22px] w-[78px] rounded-full" />
              <Barra className="h-[22px] w-[62px] rounded-full" />
            </div>
          </header>

          <div className="min-h-0 flex-1 space-y-px overflow-hidden p-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-[10px] px-2 py-2.5">
                <Barra className="size-8 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1">
                  <Barra className="h-[11px] w-[112px]" />
                  <Barra className="mt-1.5 h-[10px] w-full max-w-[188px]" />
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Coluna 2: a conversa. */}
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="flex shrink-0 items-center gap-2.5 border-b border-white/[0.06] px-4 py-3">
            <Barra className="size-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <Barra className="h-[12px] w-[128px]" />
              <Barra className="mt-1.5 h-[10px] w-[96px]" />
            </div>
            <Barra className="h-[28px] w-[76px] rounded-lg" />
            <Barra className="h-[28px] w-[84px] rounded-lg" />
          </div>

          {/*
            As bolhas alternam lado como na conversa de verdade — entrada à
            esquerda, saída à direita. Um esqueleto todo de um lado só sugeriria
            uma conversa que não é a que vai aparecer.
          */}
          <div className="flex min-h-0 flex-1 flex-col justify-end gap-2.5 overflow-hidden p-5">
            {[
              'w-[38%]',
              'w-[52%] self-end',
              'w-[44%]',
              'w-[30%] self-end',
              'w-[58%]',
            ].map((largura, i) => (
              <Barra key={i} className={`h-[38px] rounded-[13px] ${largura}`} />
            ))}
          </div>

          <div className="shrink-0 border-t border-white/[0.06] p-4">
            <Barra className="h-[64px] w-full rounded-[12px]" />
          </div>
        </div>

        {/* Coluna 3: o contexto do lead. */}
        <aside className="min-h-0 border-l border-white/[0.06] bg-white/[0.015] p-4">
          <Barra className="h-[10px] w-[62px]" />
          <Barra className="mt-2 h-[13px] w-[124px]" />
          <Barra className="mt-4 h-[92px] w-full rounded-[12px]" />
          <Barra className="mt-5 h-[11px] w-[70px]" />
          <Barra className="mt-2 h-[10px] w-full" />
          <Barra className="mt-5 h-[11px] w-[110px]" />
          <Barra className="mt-2 h-[36px] w-full rounded-[10px]" />
        </aside>
      </div>
    </main>
  )
}

/**
 * Um retângulo que pulsa.
 *
 * `animate-pulse` e nada mais: o esqueleto não pode custar mais que a tela que
 * ele cobre, e uma animação por peça já é o suficiente para dizer "está vindo".
 */
function Barra({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.055] ${className}`} />
}
