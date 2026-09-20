import type { TelaDeAjustes } from './menu-de-ajustes'

/**
 * Um ícone por tela de Configurações.
 *
 * **Para que serve um ícone aqui**, já que o título diz tudo: para a segunda
 * visita. Na primeira a pessoa lê os doze títulos; da terceira em diante ela
 * procura a forma, e achar por forma é mais rápido do que ler. É o que faz uma
 * grade de cards ser navegável e uma lista de doze linhas ser varrida.
 *
 * Todos no mesmo desenho: traço de 1,6, 20×20, `currentColor`, sem preenchimento:
 * misturar linha com sólido faz um deles parecer selecionado sem estar.
 *
 * `currentColor` é o que permite o ícone mudar junto com o cartão sem que
 * nenhuma cor seja escrita aqui: quem pinta é a classe do cartão, e a regra de
 * cor só em `globals.css` continua valendo.
 */

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

export const ICONE_DA_TELA: Record<TelaDeAjustes, React.ReactNode> = {
  inicio: (
    <Svg>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </Svg>
  ),
  whatsapp: (
    <Svg>
      <path d="M21 11.5a8.5 8.5 0 0 1-12.8 7.3L3 20.5l1.7-5.1A8.5 8.5 0 1 1 21 11.5Z" />
      <path d="M8.6 9.2c0 3 2.2 5.2 5.2 5.2l1-1.2 1.6.8" />
    </Svg>
  ),
  instagram: (
    <Svg>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="3.6" />
      <circle cx="17.2" cy="6.8" r="0.9" />
    </Svg>
  ),
  contexto: (
    <Svg>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5Z" />
      <path d="M11 4h7.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H11" />
      <path d="m16 8 .7 1.8 1.8.7-1.8.7L16 13l-.7-1.8-1.8-.7 1.8-.7Z" />
    </Svg>
  ),
  horario: (
    <Svg>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </Svg>
  ),
  'respostas-rapidas': (
    <Svg>
      <path d="M20 14.5a2.5 2.5 0 0 1-2.5 2.5H9l-4 3.5V6.5A2.5 2.5 0 0 1 7.5 4h10A2.5 2.5 0 0 1 20 6.5Z" />
      <path d="m13 7.5-2.6 3.8h3L11 15" />
    </Svg>
  ),
  etiquetas: (
    <Svg>
      <path d="M3.5 11.6V4.5a1 1 0 0 1 1-1h7.1a1 1 0 0 1 .7.3l8 8a1 1 0 0 1 0 1.4l-7.1 7.1a1 1 0 0 1-1.4 0l-8-8a1 1 0 0 1-.3-.7Z" />
      <circle cx="7.8" cy="7.8" r="1.4" />
    </Svg>
  ),
  produtos: (
    <Svg>
      {/* Uma caixa: o catálogo é o que a empresa vende, produto ou serviço. */}
      <path d="M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4v-9Z" />
      <path d="M3.5 7.5 12 11.5l8.5-4" />
      <path d="M12 11.5v9" />
    </Svg>
  ),
  acervo: (
    <Svg>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <circle cx="8.5" cy="10" r="1.6" />
      <path d="m3.6 17 4.6-4.3a1.6 1.6 0 0 1 2.2 0L16 18" />
      <path d="m14 14.5 1.8-1.7a1.6 1.6 0 0 1 2.2 0l2.4 2.2" />
    </Svg>
  ),
  integracoes: (
    <Svg>
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
      <path d="M10.5 6.8h4a2.5 2.5 0 0 1 2.5 2.5v4.2" />
      <path d="M13.5 17.2h-4A2.5 2.5 0 0 1 7 14.7v-4.2" />
    </Svg>
  ),
  anuncios: (
    <Svg>
      <path d="M4 9.5h3l8-4.5v14l-8-4.5H4a1.5 1.5 0 0 1-1.5-1.5v-2A1.5 1.5 0 0 1 4 9.5Z" />
      <path d="M18.5 9.2a4 4 0 0 1 0 5.6" />
      <path d="M7 14.5V20" />
    </Svg>
  ),
  chaves: (
    <Svg>
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h9" />
      <path d="M17.5 12v3" />
      <path d="M20.5 12v2" />
    </Svg>
  ),
  negocio: (
    <Svg>
      <path d="M4 9.5 5.5 5h13L20 9.5" />
      <path d="M4 9.5a2.2 2.2 0 0 0 4 1.3 2.2 2.2 0 0 0 4 0 2.2 2.2 0 0 0 4 0 2.2 2.2 0 0 0 4-1.3" />
      <path d="M5.5 11.8V19h13v-7.2" />
      <path d="M10 19v-4h4v4" />
    </Svg>
  ),
  equipe: (
    <Svg>
      <circle cx="9.5" cy="8.5" r="3.2" />
      <path d="M3.5 19.5a6 6 0 0 1 12 0" />
      <path d="M16.5 6.2a3.2 3.2 0 0 1 0 6.1" />
      <path d="M18 14.6a6 6 0 0 1 3 4.9" />
    </Svg>
  ),
  // Três barras subindo: é consumo contra faixa, que é o que a tela mostra.
  plano: (
    <Svg>
      <path d="M4 20h16" />
      <path d="M7 20v-5.5" />
      <path d="M12 20V8.5" />
      <path d="M17 20v-9" />
    </Svg>
  ),
}
