export type TelaDeAjustes =
  | 'inicio'
  | 'whatsapp'
  | 'instagram'
  | 'contexto'
  | 'horario'
  | 'respostas-rapidas'
  | 'etiquetas'
  | 'produtos'
  | 'acervo'
  | 'integracoes'
  | 'anuncios'
  | 'chaves'
  | 'negocio'
  | 'equipe'
  | 'plano'
  | 'recursos'

export const GRUPOS: { titulo: string | null; itens: { chave: TelaDeAjustes; rotulo: string }[] }[] = [
  // O índice fica solto no topo, sem rótulo de grupo: ele não é um assunto, é
  // o caminho de volta para a visão geral.
  { titulo: null, itens: [{ chave: 'inicio', rotulo: 'Visão geral' }] },
  /*
   * Grupos por intenção (tarefa 10.1 do plano de UX de 23/09), na mesma ordem
   * da Visão geral. As rotas não mudaram; só nome e lugar.
   *
   * Objetivo e recursos mora em Organização porque o que se decide ali é que
   * partes do produto esta empresa usa, e não como ela atende.
   */
  {
    titulo: 'Organização',
    itens: [
      { chave: 'negocio', rotulo: 'Dados da empresa' },
      { chave: 'equipe', rotulo: 'Pessoas e acesso' },
      { chave: 'recursos', rotulo: 'Objetivo e recursos' },
      { chave: 'plano', rotulo: 'Plano e consumo' },
    ],
  },
  {
    titulo: 'Canais',
    itens: [
      { chave: 'whatsapp', rotulo: 'WhatsApp' },
      { chave: 'instagram', rotulo: 'Instagram' },
    ],
  },
  {
    titulo: 'Automação de resposta',
    itens: [
      { chave: 'contexto', rotulo: 'Conhecimento da IA' },
      { chave: 'horario', rotulo: 'Horário e retomada' },
    ],
  },
  {
    titulo: 'Ferramentas do atendimento',
    itens: [
      { chave: 'respostas-rapidas', rotulo: 'Respostas rápidas' },
      { chave: 'etiquetas', rotulo: 'Etiquetas' },
      { chave: 'produtos', rotulo: 'Catálogo' },
      { chave: 'acervo', rotulo: 'Arquivos e mídias' },
    ],
  },
  {
    titulo: 'Conexões e APIs',
    itens: [
      // "Todas" primeiro porque é a visão, e as outras duas são o detalhe dela.
      { chave: 'integracoes', rotulo: 'Todas as conexões' },
      { chave: 'anuncios', rotulo: 'Anúncios' },
      { chave: 'chaves', rotulo: 'Chaves de API' },
    ],
  },
]
