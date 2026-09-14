'use client'

import { useEffect, useMemo, useState } from 'react'
import { FichaDoRail } from '@/components/inbox/ficha-do-rail'
import type { FiltroDeEstado } from '@/server/repos/leads'

/**
 * O estado dos dois rails quando a fila inteira está no navegador.
 *
 * ---------------------------------------------------------------------------
 * O problema que ele resolve
 * ---------------------------------------------------------------------------
 *
 * Cada ficha do rail era um `<Link>` para a mesma rota com outro `?estado=` ou
 * `?de=`. Clicar refazia a página no servidor — sete consultas — e a tela
 * ficava parada até a resposta. Dois segundos para trocar de aba, num gesto
 * que é só mostrar um subconjunto do que já estava na tela.
 *
 * Aqui a fila inteira já veio. Trocar de aba é um `filter()`.
 *
 * ---------------------------------------------------------------------------
 * Por que a URL continua mudando
 * ---------------------------------------------------------------------------
 *
 * `history.replaceState` em vez de `router.push`: o endereço acompanha a
 * escolha — dá para recarregar a página na aba certa, e o link continua
 * compartilhável — **sem** disparar a navegação do Next, que é justamente o
 * que se está evitando.
 *
 * `replace` e não `push` porque trocar de aba não é lugar novo: é a mesma
 * tela com outro recorte. Empilhar cada clique faria o botão Voltar do
 * navegador andar por dez filtros antes de sair do Inbox.
 */
export function useFilaLocal(entrada: {
  clienteId: string
  estadoInicial: FiltroDeEstado
  atribuicaoInicial: string
  busca: string
  conversaAberta: string | null
}) {
  const [estado, setEstado] = useState<FiltroDeEstado>(entrada.estadoInicial)
  const [atribuicao, setAtribuicao] = useState(entrada.atribuicaoInicial)

  /*
   * A URL segue a escolha, e o efeito roda **depois** da pintura: o filtro já
   * aconteceu na tela quando o endereço é reescrito. Fazer isso durante o
   * clique atrasaria o que este arquivo existe para acelerar.
   */
  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('estado', estado)
    url.searchParams.set('de', atribuicao)
    if (entrada.busca) url.searchParams.set('busca', entrada.busca)
    else url.searchParams.delete('busca')
    if (entrada.conversaAberta) url.searchParams.set('conversa', entrada.conversaAberta)
    window.history.replaceState(null, '', url)
  }, [estado, atribuicao, entrada.busca, entrada.conversaAberta])

  return { estado, setEstado, atribuicao, setAtribuicao }
}

/**
 * O recorte da fila para os dois rails escolhidos.
 *
 * **Pura de propósito.** É a regra que decide o que a pessoa vê, e é o tipo de
 * coisa que erra em silêncio — mostrar conversa resolvida na aba de abertas, ou
 * esconder a de alguém ao filtrar por dono. Função sem React é o que torna isso
 * provável por `npm test`.
 *
 * Lê `estadoEfetivo`, nunca `estado`: um adiamento cujo prazo venceu **é** uma
 * conversa aberta, e a view já resolve essa conta. Ler o cru aqui deixaria a
 * conversa escondida na aba de adiadas no dia em que ela deveria reaparecer.
 */
export function recortarFila<
  T extends { estadoEfetivo: 'aberta' | 'adiada' | 'resolvida'; atribuidoA: string | null },
>(leads: T[], estado: FiltroDeEstado, atribuicao: string): T[] {
  return leads.filter((lead) => {
    if (estado !== 'todas' && lead.estadoEfetivo !== estado) return false
    if (atribuicao === 'sem-dono') return lead.atribuidoA === null
    if (atribuicao !== 'todos') return lead.atribuidoA === atribuicao
    return true
  })
}

/** Quantas conversas em cada estado, contadas na própria lista carregada. */
export function contarEstados<T extends { estadoEfetivo: 'aberta' | 'adiada' | 'resolvida' }>(
  leads: T[],
): { aberta: number; adiada: number; resolvida: number } {
  const total = { aberta: 0, adiada: 0, resolvida: 0 }
  for (const lead of leads) total[lead.estadoEfetivo] += 1
  return total
}

/**
 * Quantas conversas por dono, **dentro do estado escolhido**.
 *
 * O recorte importa: com a aba "Abertas" ligada, "Sem dono 8" tem que contar
 * as oito abertas sem dono, não todas as sem dono do histórico. Contar fora do
 * estado faria o número do rail não bater com a lista logo abaixo dele — e um
 * número que não bate com o que se vê é pior que número nenhum.
 */
export function contarDonos<
  T extends { estadoEfetivo: 'aberta' | 'adiada' | 'resolvida'; atribuidoA: string | null },
>(leads: T[], estado: FiltroDeEstado): { total: number; semDono: number; porUsuario: Map<string, number> } {
  const noEstado = estado === 'todas' ? leads : leads.filter((l) => l.estadoEfetivo === estado)

  const porUsuario = new Map<string, number>()
  let semDono = 0
  for (const lead of noEstado) {
    if (!lead.atribuidoA) semDono += 1
    else porUsuario.set(lead.atribuidoA, (porUsuario.get(lead.atribuidoA) ?? 0) + 1)
  }
  return { total: noEstado.length, semDono, porUsuario }
}


/* -------------------------------------------------------------------------- */
/* Os rails, quando a fila inteira está no navegador                           */
/* -------------------------------------------------------------------------- */

/** O mínimo de um lead para os rails filtrarem e contarem. */
export type LeadDoRail = {
  contatoId: string
  estadoEfetivo: 'aberta' | 'adiada' | 'resolvida'
  atribuidoA: string | null
}

/**
 * Os dois rails e a lista recortada, sem ida ao servidor.
 *
 * **Render prop, e não um componente que desenha a lista.** A linha de cada
 * conversa é grande e mora na `Fila` do `page.tsx`, junto de meia dúzia de
 * ajudantes que só ela usa (o relógio da janela, o resumo, a insígnia de não
 * lidas). Trazer tudo para cá seria mover trezentas linhas para ganhar um
 * filtro — e mover trezentas linhas no fim de uma sessão é como se quebra
 * coisa que estava funcionando.
 *
 * Então este componente cuida do que é dele — o estado dos rails, o recorte, as
 * contagens — e devolve a lista já filtrada para quem sabe desenhá-la.
 */
export function RailsLocais<T extends LeadDoRail>({
  clienteId,
  leads,
  estadoInicial,
  atribuicaoInicial,
  busca,
  conversaAberta,
  equipe,
  usuarioId,
  aoRecortar,
}: {
  clienteId: string
  leads: T[]
  estadoInicial: FiltroDeEstado
  atribuicaoInicial: string
  busca: string
  conversaAberta: string | null
  equipe: { id: string; nome: string; presenca?: string }[]
  usuarioId: string | null
  /**
   * Recebe o recorte a cada mudança de rail.
   *
   * **Callback e não render prop.** A lista de conversas mora fora do
   * `<header>` onde os rails vivem, e envolvê-la neste componente exigiria
   * reorganizar o JSX da `Fila` inteira. Publicando o recorte para cima, quem
   * desenha continua onde está — e este componente cuida só do que é dele.
   */
  aoRecortar: (recorte: T[]) => void
}) {
  const { estado, setEstado, atribuicao, setAtribuicao } = useFilaLocal({
    clienteId,
    estadoInicial,
    atribuicaoInicial,
    busca,
    conversaAberta,
  })

  const porEstado = useMemo(() => contarEstados(leads), [leads])
  const donos = useMemo(() => contarDonos(leads, estado), [leads, estado])
  const recorte = useMemo(
    () => recortarFila(leads, estado, atribuicao),
    [leads, estado, atribuicao],
  )

  /*
   * Publica o recorte **depois** da pintura, e não durante o render: chamar o
   * pai enquanto este componente renderiza é `setState` em render alheio, que
   * o React recusa em modo estrito.
   */
  useEffect(() => {
    aoRecortar(recorte)
  }, [recorte, aoRecortar])

  return (
    <>
      <nav
        aria-label="Estado da conversa"
        className="-mx-1 mt-2.5 flex gap-1 overflow-x-auto pb-0.5"
      >
        <FichaDoRail
          href="#"
          aoEscolher={() => setEstado('aberta')}
          acesa={estado === 'aberta'}
          rotulo="Abertas"
          contagem={porEstado.aberta}
        />
        <FichaDoRail
          href="#"
          aoEscolher={() => setEstado('adiada')}
          acesa={estado === 'adiada'}
          rotulo="Adiadas"
          contagem={porEstado.adiada}
        />
        <FichaDoRail
          href="#"
          aoEscolher={() => setEstado('resolvida')}
          acesa={estado === 'resolvida'}
          rotulo="Resolvidas"
          contagem={porEstado.resolvida}
        />
      </nav>

      {(equipe.length > 0 || donos.semDono < donos.total) && (
        <nav
          aria-label="Filtrar por quem atende"
          className="-mx-1 mt-2.5 flex gap-1 overflow-x-auto pb-0.5"
        >
          <FichaDoRail
            href="#"
            aoEscolher={() => setAtribuicao('todos')}
            acesa={atribuicao === 'todos'}
            rotulo="Todos"
            contagem={donos.total}
          />
          <FichaDoRail
            href="#"
            aoEscolher={() => setAtribuicao('sem-dono')}
            acesa={atribuicao === 'sem-dono'}
            rotulo="Sem dono"
            contagem={donos.semDono}
            alerta
          />
          {usuarioId && (
            <FichaDoRail
              href="#"
              aoEscolher={() => setAtribuicao(usuarioId)}
              acesa={atribuicao === usuarioId}
              rotulo="Meus"
              contagem={donos.porUsuario.get(usuarioId) ?? 0}
            />
          )}
          {equipe
            .filter((membro) => membro.id !== usuarioId)
            .map((membro) => (
              <FichaDoRail
                key={membro.id}
                href="#"
                aoEscolher={() => setAtribuicao(membro.id)}
                acesa={atribuicao === membro.id}
                rotulo={membro.nome.split(' ')[0] ?? membro.nome}
                contagem={donos.porUsuario.get(membro.id) ?? 0}
                ausente={membro.presenca !== undefined && membro.presenca !== 'disponivel'}
              />
            ))}
        </nav>
      )}

    </>
  )
}
