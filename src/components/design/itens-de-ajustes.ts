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
      { chave: 'contexto', rotulo: 'Conhecimento da IA' },
      { chave: 'horario', rotulo: 'Horário de atendimento' },
      { chave: 'respostas-rapidas', rotulo: 'Respostas rápidas' },
      { chave: 'etiquetas', rotulo: 'Etiquetas' },
      { chave: 'produtos', rotulo: 'Catálogo' },
      { chave: 'acervo', rotulo: 'Arquivos e mídias' },
    ],
  },
  {
    titulo: 'Integrações',
    itens: [
      // "Todas" primeiro porque é a visão, e as outras duas são o detalhe dela.
      { chave: 'integracoes', rotulo: 'Todas as integrações' },
      { chave: 'anuncios', rotulo: 'Captação por anúncios' },
      { chave: 'chaves', rotulo: 'Chaves de API' },
    ],
  },
  {
    titulo: 'Conta',
    itens: [
      { chave: 'negocio', rotulo: 'Dados da empresa' },
      { chave: 'equipe', rotulo: 'Pessoas e acesso' },
      /*
       * Recursos entra em "Conta", e não em "Atendimento".
       *
       * O que se decide ali é **que partes do produto esta empresa usa**, e não
       * como ela atende. É a tradução do §4.2: "CRM fica disponível em
       * Configurações → Recursos, com explicação e botão Ativar CRM".
       */
      { chave: 'recursos', rotulo: 'Personalizar sistema' },
      { chave: 'plano', rotulo: 'Plano e consumo' },
    ],
  },
]

