/**
 * O catálogo da central de ajuda: categorias e artigos, na ordem em que
 * aparecem.
 *
 * **É a única lista.** A home monta os cartões de categoria daqui, a página do
 * artigo tira trilha, título e relacionados daqui, a busca procura aqui, e a
 * gaveta do "?" no cabeçalho da conta lê o `INDICE` derivado no fim do
 * arquivo. Artigo novo é uma linha aqui e um corpo em `corpos.tsx`.
 *
 * `palavras` são os termos que a pessoa digita e que não estão no título:
 * sinônimo, nome técnico, o sintoma. A busca olha título, resumo e palavras.
 */

export type Categoria = {
  id: string
  titulo: string
  descricao: string
  icone: 'fluxo' | 'conversa' | 'agenda' | 'atendimento'
}

export type Artigo = {
  id: string
  categoria: string
  titulo: string
  resumo: string
  palavras: string[]
}

export const CATEGORIAS: Categoria[] = [
  {
    id: 'primeiros-passos',
    titulo: 'Primeiros passos',
    descricao: 'Como a automação recebe uma mensagem, os blocos do editor e as variáveis.',
    icone: 'fluxo',
  },
  {
    id: 'perguntas-e-respostas',
    titulo: 'Perguntas e respostas',
    descricao: 'Perguntas, datas, menus vindos de outro sistema e o que fazer quando algo falha.',
    icone: 'conversa',
  },
  {
    id: 'agenda-e-integracoes',
    titulo: 'Agenda e integrações',
    descricao: 'Verandi, planilhas, CRM e qualquer sistema que aceite JSON.',
    icone: 'agenda',
  },
  {
    id: 'atendimento',
    titulo: 'Atendimento e dúvidas',
    descricao: 'O que acontece depois da conversa e as dúvidas mais comuns.',
    icone: 'atendimento',
  },
]

export const ARTIGOS: Artigo[] = [
  {
    id: 'como-funciona',
    categoria: 'primeiros-passos',
    titulo: 'Como uma mensagem percorre a automação',
    resumo: 'Da mensagem do cliente até a resposta: as etapas que o sistema segue e onde a equipe entra.',
    palavras: ['mensagem', 'caminho', 'fluxo', 'publicar', 'começar', 'equipe'],
  },
  {
    id: 'blocos',
    categoria: 'primeiros-passos',
    titulo: 'Os blocos do editor e quando usar cada um',
    resumo: 'Mensagem, pergunta, condição, espera, IA, integração e os demais blocos, com o uso de cada um.',
    palavras: ['bloco', 'editor', 'condição', 'espera', 'ia', 'http', 'api', 'ramificação', 'arrastar'],
  },
  {
    id: 'entrada',
    categoria: 'primeiros-passos',
    titulo: 'Qual automação responde cada mensagem',
    resumo: 'A ordem que o sistema segue quando um número tem mais de uma automação ligada.',
    palavras: ['gatilho', 'palavra-chave', 'entrada', 'prioridade', 'canal', 'número'],
  },
  {
    id: 'variaveis',
    categoria: 'primeiros-passos',
    titulo: 'Variáveis da conversa',
    resumo: 'O que a automação já sabe sobre o contato e como reaproveitar o que ele responde.',
    palavras: ['variável', 'nome', 'telefone', 'chaves', 'memória', 'campo'],
  },
  {
    id: 'perguntas',
    categoria: 'perguntas-e-respostas',
    titulo: 'Configurar perguntas: rótulo, valor e padrão',
    resumo: 'A diferença entre o que o cliente vê, o que o sistema guarda e o formato que ele aceita.',
    palavras: ['pergunta', 'botão', 'opção', 'validação', 'formato', 'rótulo', 'valor'],
  },
  {
    id: 'datas',
    categoria: 'perguntas-e-respostas',
    titulo: 'Fazer a automação entender datas e horários',
    resumo: 'Formatos aceitos, datas inválidas e como a resposta vira uma data pronta para a agenda.',
    palavras: ['data', 'horário', 'dia', 'hora', 'agendamento', 'formato'],
  },
  {
    id: 'listas',
    categoria: 'perguntas-e-respostas',
    titulo: 'Transformar uma lista da API em botões',
    resumo: 'Como exibir horários, profissionais ou produtos de outro sistema como opções da conversa.',
    palavras: ['lista', 'menu', 'botões', 'api', 'json', 'opções'],
  },
  {
    id: 'erros',
    categoria: 'perguntas-e-respostas',
    titulo: 'Quando uma integração falha ou o cliente não responde',
    resumo: 'Caminhos alternativos para chamada com erro, prazo esgotado e vaga indisponível, e como testar.',
    palavras: ['erro', 'falha', 'timeout', 'prazo', 'testar', 'teste', 'sumiu'],
  },
  {
    id: 'verandi',
    categoria: 'agenda-e-integracoes',
    titulo: 'Conectar a automação à agenda da Verandi',
    resumo: 'Como ligar a conta da Verandi e usar a agenda dentro das conversas.',
    palavras: ['verandi', 'agenda', 'conectar', 'chave', 'integração'],
  },
  {
    id: 'verandi-dados',
    categoria: 'agenda-e-integracoes',
    titulo: 'Dados da Verandi disponíveis na automação',
    resumo: 'As consultas prontas da agenda e o que cada variável traz.',
    palavras: ['verandi', 'preset', 'variáveis', 'agenda', 'professores', 'horários'],
  },
  {
    id: 'receitas',
    categoria: 'agenda-e-integracoes',
    titulo: 'Seis modelos de conversa com a agenda',
    resumo: 'Marcar, remarcar, listar professores e horários, lista de espera e aviso de falta, bloco a bloco.',
    palavras: ['receita', 'modelo', 'marcar', 'remarcar', 'fila', 'falta', 'aula'],
  },
  {
    id: 'outros-sistemas',
    categoria: 'agenda-e-integracoes',
    titulo: 'Integrar com planilha, CRM ou sistema próprio',
    resumo: 'O bloco de integração conversa com qualquer sistema que aceite JSON. Modelos prontos para os casos comuns.',
    palavras: ['planilha', 'crm', 'webhook', 'api', 'sistema', 'integração', 'json'],
  },
  {
    id: 'depois',
    categoria: 'atendimento',
    titulo: 'O que acontece depois da conversa',
    resumo: 'Como a automação alimenta contatos, funil e o atendimento da equipe.',
    palavras: ['contato', 'funil', 'crm', 'atendimento', 'equipe', 'inbox'],
  },
  {
    id: 'duvidas',
    categoria: 'atendimento',
    titulo: 'Perguntas frequentes',
    resumo: 'Respostas para o que costuma travar ao desenhar, publicar e atender.',
    palavras: ['dúvida', 'faq', 'problema', 'não funciona', 'publicar'],
  },
]

/** Os mais procurados, na home. A ordem é a da prioridade. */
export const MAIS_PROCURADOS = ['datas', 'verandi', 'perguntas', 'erros', 'entrada', 'duvidas']

export function categoriaDe(artigo: Artigo): Categoria {
  return CATEGORIAS.find((categoria) => categoria.id === artigo.categoria)!
}

export function artigosDa(categoria: string): Artigo[] {
  return ARTIGOS.filter((artigo) => artigo.categoria === categoria)
}

export function acharArtigo(id: string): Artigo | undefined {
  return ARTIGOS.find((artigo) => artigo.id === id)
}

/** Sem acento e em minúsculas: "horario" acha "Horário". */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** A busca: todo termo digitado precisa aparecer no título, resumo ou palavras. */
export function buscarArtigos(busca: string): Artigo[] {
  const termos = normalizar(busca).split(/\s+/).filter(Boolean)
  if (termos.length === 0) return []
  return ARTIGOS.map((artigo) => {
    const titulo = normalizar(artigo.titulo)
    const resto = normalizar(`${artigo.resumo} ${artigo.palavras.join(' ')} ${categoriaDe(artigo).titulo}`)
    let pontos = 0
    for (const termo of termos) {
      if (titulo.includes(termo)) pontos += 3
      else if (resto.includes(termo)) pontos += 1
      else return { artigo, pontos: 0 }
    }
    return { artigo, pontos }
  })
    .filter((item) => item.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos)
    .map((item) => item.artigo)
}

/** O formato que a gaveta de ajuda do cabeçalho lê: grupos com itens. */
export const INDICE = CATEGORIAS.map((categoria) => ({
  grupo: categoria.titulo,
  itens: artigosDa(categoria.id).map((artigo) => ({ id: artigo.id, rotulo: artigo.titulo })),
}))
