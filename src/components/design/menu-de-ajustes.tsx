import Link from 'next/link'

/**
 * A segunda barra — a das Configurações.
 *
 * ---------------------------------------------------------------------------
 * Por que existem duas barras
 * ---------------------------------------------------------------------------
 *
 * Com uma só, trocar de tela dentro de Configurações exigia voltar ao índice e
 * escolher de novo: a lista de destinos morava numa página, e página não
 * acompanha quem já entrou. A segunda barra transforma Configurações de uma
 * *página com uma lista* num **lugar por onde se circula** — que é o desenho do
 * Intercom, do HubSpot e da Brevo, e o motivo é o mesmo nos três.
 *
 * Os grupos são os mesmos quatro decididos em `docs/PLANO-CONFIGURACOES.md`, e
 * não uma segunda organização inventada aqui. Duas verdades sobre a mesma coisa
 * divergem no primeiro item novo.
 *
 * ---------------------------------------------------------------------------
 * A barra global encolhe, e isso é parte do desenho
 * ---------------------------------------------------------------------------
 *
 * Duas colunas de texto lado a lado competem: a pessoa lê as duas antes de
 * saber em qual clicar. Com a global em ícones, sobra um só lugar com nomes —
 * e é o desta seção. Ver `forcarRecolhida` em `ClienteShell`.
 */

export type TelaDeAjustes =
  | 'inicio'
  | 'whatsapp'
  | 'instagram'
  | 'contexto'
  | 'horario'
  | 'respostas-rapidas'
  | 'etiquetas'
  | 'acervo'
  | 'integracoes'
  | 'anuncios'
  | 'chaves'
  | 'negocio'
  | 'equipe'

const GRUPOS: { titulo: string | null; itens: { chave: TelaDeAjustes; rotulo: string }[] }[] = [
  // O índice fica solto no topo, sem rótulo de grupo: ele não é um assunto, é
  // o caminho de volta para a visão geral.
  { titulo: null, itens: [{ chave: 'inicio', rotulo: 'Visão geral' }] },
  {
    titulo: 'Canais',
    itens: [
      { chave: 'whatsapp', rotulo: 'WhatsApp' },
      { chave: 'instagram', rotulo: 'Instagram' },
    ],
  },
  {
    titulo: 'Atendimento',
    itens: [
      { chave: 'contexto', rotulo: 'Contexto do negócio' },
      { chave: 'horario', rotulo: 'Horário de atendimento' },
      { chave: 'respostas-rapidas', rotulo: 'Respostas rápidas' },
      { chave: 'etiquetas', rotulo: 'Etiquetas' },
      { chave: 'acervo', rotulo: 'Acervo' },
    ],
  },
  {
    titulo: 'Integrações',
    itens: [
      // "Todas" primeiro porque é a visão, e as outras duas são o detalhe dela.
      { chave: 'integracoes', rotulo: 'Todas as integrações' },
      { chave: 'anuncios', rotulo: 'Anúncios' },
      { chave: 'chaves', rotulo: 'Chaves de API' },
    ],
  },
  {
    titulo: 'Conta',
    itens: [
      { chave: 'negocio', rotulo: 'Dados do negócio' },
      { chave: 'equipe', rotulo: 'Equipe' },
    ],
  },
]

/** A rota de cada tela. `inicio` é o próprio índice. */
function enderecoDe(clienteId: string, chave: TelaDeAjustes) {
  const base = `/clientes/${clienteId}/ajustes`
  return chave === 'inicio' ? base : `${base}/${chave}`
}

export function MenuDeAjustes({
  clienteId,
  ativa,
}: {
  clienteId: string
  ativa: TelaDeAjustes
}) {
  return (
    <nav
      aria-label="Configurações"
      /*
        No celular vira uma tira que rola na horizontal, igual à navegação
        global: coluna de doze itens empurraria o conteúdo da tela para baixo da
        dobra, e ninguém abre Configurações para ler o menu.
      */
      className="shrink-0 border-line md:w-[228px] md:border-r md:py-[26px] md:pr-4 md:pl-[26px]"
    >
      <p className="hidden pl-2.5 text-[11px] font-bold tracking-[0.06em] text-dim uppercase md:mb-3 md:block">
        Configurações
      </p>

      <div className="flex gap-1 overflow-x-auto border-b border-line px-4 py-2 md:flex-col md:gap-0 md:overflow-visible md:border-0 md:p-0">
        {GRUPOS.map((grupo, indice) => (
          <div key={grupo.titulo ?? 'topo'} className="contents md:block">
            {grupo.titulo && (
              <p
                className={`hidden px-2.5 text-[10.5px] font-bold tracking-[0.05em] text-dim uppercase md:block ${
                  indice === 0 ? 'md:mb-1.5' : 'md:mt-5 md:mb-1.5'
                }`}
              >
                {grupo.titulo}
              </p>
            )}
            {grupo.itens.map((item) => (
              <Link
                key={item.chave}
                href={enderecoDe(clienteId, item.chave)}
                aria-current={item.chave === ativa ? 'page' : undefined}
                className={`flex shrink-0 items-center rounded-[9px] px-2.5 py-[7px] text-[12.5px] transition ${
                  item.chave === ativa
                    ? 'bg-primary-weak font-bold text-primary'
                    : 'font-medium text-muted hover:bg-surface hover:text-ink'
                }`}
              >
                {item.rotulo}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </nav>
  )
}
