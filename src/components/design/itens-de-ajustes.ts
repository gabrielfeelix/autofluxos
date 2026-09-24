export type TelaDeAjustes =
  | 'inicio'
  | 'contexto'
  | 'horario'
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
      { chave: 'negocio', rotulo: 'Dados da organização' },
      { chave: 'equipe', rotulo: 'Pessoas' },
      { chave: 'recursos', rotulo: 'Objetivo e recursos' },
      { chave: 'plano', rotulo: 'Plano e consumo' },
    ],
  },
  {
    // Canais, Respostas rápidas, Etiquetas e Catálogo saíram para a barra
    // lateral (plano de navegação de 24/set): são trabalho do dia, não ajuste.
    titulo: 'Atendimento e IA',
    itens: [
      { chave: 'contexto', rotulo: 'Conhecimento da IA' },
      { chave: 'horario', rotulo: 'Horário e retomada' },
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
