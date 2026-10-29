import { GLIFO_INSTAGRAM, GLIFO_TELEGRAM, GLIFO_WHATSAPP } from '@/components/design/glifos-oficiais'
import { DEFINICAO_DO_CANAL } from '@/core/canais'
import type { ChaveDaConversa } from './previa-whatsapp'

/**
 * Os canais como o site os apresenta: menu Canais, a página do produto e
 * `/canais/[slug]`. Fatos em `docs/FUNCIONALIDADES.md` §2 e §4; os limites vêm
 * de `src/core/canais.ts`, para a página nunca prometer um botão a mais do que
 * o motor aceita.
 */
export type CanalDoSite = {
  slug: string
  nome: string
  cor: string
  glifo?: string
  linha: string
  fatos: string[]
  titulo: string
  subtitulo: string
  /** Aviso honesto quando o canal ainda não liga conta de cliente. */
  aviso?: string
  passos: { titulo: string; texto: string }[]
  recursos: { titulo: string; texto: string }[]
  ficha: { rotulo: string; valor: string }[]
  conversas?: ChaveDaConversa[]
}

const wa = DEFINICAO_DO_CANAL.whatsapp.limites
const ig = DEFINICAO_DO_CANAL.instagram.limites
const tg = DEFINICAO_DO_CANAL.telegram.limites

export const CANAIS: CanalDoSite[] = [
  {
    slug: 'whatsapp',
    nome: 'WhatsApp',
    cor: '#25d366',
    glifo: GLIFO_WHATSAPP,
    linha: 'No número que já está no seu cartão.',
    fatos: ['Continua no app do celular', 'Áudio vira texto no Inbox', 'Transmissões com modelo aprovado'],
    titulo: 'O WhatsApp da empresa atendendo no mesmo número',
    subtitulo:
      'Pela API oficial da Meta, com coexistência: o número segue no app do celular, e o chatbot, a IA e a equipe respondem pelo AutoFluxos.',
    passos: [
      {
        titulo: 'Entra com a conta da Meta',
        texto: 'A janela de conexão é da própria Meta. Você autoriza e escolhe o número, sem copiar token nem chave.',
      },
      {
        titulo: 'Contatos e histórico chegam juntos',
        texto: 'Na coexistência, os contatos e as conversas recentes do celular entram no Inbox, com barra de progresso.',
      },
      {
        titulo: 'Escolhe o fluxo do número',
        texto: 'Um fluxo principal, um de boas-vindas, um para mídia recebida e um para depois do atendimento.',
      },
    ],
    recursos: [
      { titulo: 'API oficial da Meta', texto: 'Cloud API, sem aparelho ligado no escritório e sem conexão paralela que põe o número em risco.' },
      { titulo: 'Celular e Inbox juntos', texto: 'O que a equipe responde pelo celular aparece no Inbox, e o que o chatbot responde aparece no celular.' },
      { titulo: 'Áudio vira texto', texto: 'O áudio do cliente é transcrito com um toque, e a IA lê a foto recebida dentro da conversa.' },
      { titulo: 'Botões e listas', texto: `Até ${wa.botoes} botões ou uma lista com ${wa.opcoes} opções, do jeito que o WhatsApp mostra.` },
      { titulo: 'Transmissões', texto: 'Campanhas com modelo aprovado pela Meta, com entrega e resposta de cada contato.' },
      { titulo: 'Mais de um número', texto: 'Cada unidade com o seu número e o seu fluxo, a partir do plano Operação.' },
    ],
    ficha: [
      { rotulo: 'Conexão', valor: 'Cadastro oficial da Meta' },
      { rotulo: 'Botões por mensagem', valor: String(wa.botoes) },
      { rotulo: 'Opções numa lista', valor: String(wa.opcoes) },
      { rotulo: 'Texto do botão', valor: `${wa.rotulo} caracteres` },
      { rotulo: 'Janela para responder', valor: `${wa.janelaHoras} horas` },
      { rotulo: 'Fora da janela', valor: 'Só modelo aprovado' },
      { rotulo: 'Custo da mensagem', valor: 'Tarifa da Meta, sem acréscimo' },
    ],
    conversas: ['loja', 'clinica', 'restaurante'],
  },
  {
    slug: 'instagram',
    nome: 'Instagram',
    cor: '#e4405f',
    glifo: GLIFO_INSTAGRAM,
    linha: 'Direct e menções em story.',
    fatos: ['Foto, áudio e vídeo', 'Respostas com botões', 'Na mesma fila do WhatsApp'],
    titulo: 'O Direct do Instagram na mesma fila do WhatsApp',
    subtitulo: 'Mensagem, foto, áudio e menção em story chegam no Inbox, e a equipe responde sem abrir o celular.',
    // `disponivel: false` em `src/core/canais.ts`: Standard Access até o App Review.
    aviso:
      'A conexão de contas de clientes depende da revisão de acesso da Meta, em andamento. A integração já funciona nas contas da 4YU e será liberada para todos assim que a Meta aprovar.',
    passos: [
      { titulo: 'Entra com o Instagram', texto: 'Login oficial do Instagram, na conta profissional da empresa.' },
      { titulo: 'O acesso se renova sozinho', texto: 'A autorização vale 60 dias e é renovada antes de vencer, sem você fazer nada.' },
      { titulo: 'O Direct entra no Inbox', texto: 'As conversas chegam na mesma fila do WhatsApp, com a ficha do cliente ao lado.' },
    ],
    recursos: [
      { titulo: 'Tudo o que chega no Direct', texto: 'Texto, foto, vídeo, áudio, arquivo, publicação compartilhada e menção em story.' },
      { titulo: 'Respostas rápidas', texto: `Até ${ig.opcoes} opções para o cliente tocar, no formato do Instagram.` },
      { titulo: 'Digitando', texto: 'O cliente vê que alguém está escrevendo, como numa conversa normal.' },
      { titulo: 'Uma fila só', texto: 'Direct e WhatsApp na mesma lista, com a mesma equipe e as mesmas etiquetas.' },
      { titulo: 'A mesma ficha', texto: 'Funil, negócios e histórico do contato, venha ele de onde vier.' },
      { titulo: 'Mídia enviada', texto: 'A equipe manda foto, vídeo e arquivo pelo Inbox, sem trocar de aparelho.' },
    ],
    ficha: [
      { rotulo: 'Conexão', valor: 'Login do Instagram' },
      { rotulo: 'Validade do acesso', valor: '60 dias, renovado sozinho' },
      { rotulo: 'Opções de resposta', valor: String(ig.opcoes) },
      { rotulo: 'Texto da opção', valor: `${ig.rotulo} caracteres` },
      { rotulo: 'Janela para responder', valor: `${ig.janelaHoras} horas` },
      { rotulo: 'Situação', valor: 'Em revisão pela Meta' },
    ],
  },
  {
    slug: 'site',
    nome: 'Chat do site',
    cor: '#6366f1',
    linha: 'Uma linha de código e o chat está na página.',
    fatos: ['Cor, saudação e mascote seus', 'Formulário de contato', 'Ligação de voz do visitante'],
    titulo: 'Um chat no seu site, com a cara da sua marca',
    subtitulo:
      'Uma linha de código e o visitante conversa com o mesmo chatbot do WhatsApp. Quando precisa de gente, liga para a equipe direto da página.',
    passos: [
      { titulo: 'Personaliza na tela', texto: 'Cor, tema claro ou escuro, título, saudação e mascote, com a prévia ao vivo.' },
      { titulo: 'Cola uma linha no site', texto: 'O código vem pronto com a chave da sua conta. Funciona em qualquer plataforma.' },
      { titulo: 'Libera os seus domínios', texto: 'Até 10 endereços autorizados, para o chat não abrir no site de outra pessoa.' },
    ],
    recursos: [
      { titulo: 'Ligação de voz', texto: 'O visitante liga pelo navegador e o telefone toca no Inbox. Sem número e sem aplicativo.' },
      { titulo: 'Formulário de contato', texto: 'Nome, e-mail, telefone, CPF, CNPJ ou um campo seu, obrigatório ou não.' },
      { titulo: 'Mascote animado', texto: 'Imagem ou vídeo no balão, com convite para conversar.' },
      { titulo: 'Várias conversas', texto: 'O visitante volta depois e encontra o histórico, com contador de não lidas.' },
      { titulo: 'O mesmo fluxo', texto: 'O chatbot e a IA que atendem no WhatsApp atendem aqui também.' },
      { titulo: 'Sem custo por mensagem', texto: 'O chat é nosso, não da Meta: não há tarifa por conversa.' },
    ],
    ficha: [
      { rotulo: 'Instalação', valor: 'Uma linha de código' },
      { rotulo: 'Domínios autorizados', valor: 'Até 10' },
      { rotulo: 'Voz', valor: 'Navegador a navegador' },
      { rotulo: 'Ligação sem resposta', valor: 'Vira perdida em 45 s' },
      { rotulo: 'Janela para responder', valor: 'Sem limite' },
      { rotulo: 'Custo da mensagem', valor: 'Nenhum' },
    ],
  },
  {
    slug: 'telegram',
    nome: 'Telegram',
    cor: '#26a5e4',
    glifo: GLIFO_TELEGRAM,
    linha: 'Conecta com o token do BotFather.',
    fatos: ['O mesmo fluxo dos outros canais', 'Conversa particular com o bot', 'Na mesma fila da equipe'],
    titulo: 'Um bot no Telegram, sem número e sem custo por conversa',
    subtitulo: 'Crie o bot no BotFather, cole o token e o mesmo fluxo do WhatsApp passa a atender no Telegram.',
    passos: [
      { titulo: 'Cria o bot no BotFather', texto: 'No próprio Telegram, com o nome e o @ que você quiser.' },
      { titulo: 'Cola o token', texto: 'Em Conversas, Canais, Telegram. A conexão é conferida na hora.' },
      { titulo: 'Escolhe o fluxo', texto: 'O bot passa a responder com o fluxo escolhido, e a equipe assume no Inbox.' },
    ],
    recursos: [
      { titulo: 'Sem número de telefone', texto: 'O cliente acha o bot pelo @ ou por um link, sem salvar contato.' },
      { titulo: 'Sem janela de 24 horas', texto: 'Dá para responder a qualquer hora, sem modelo aprovado.' },
      { titulo: 'Botões mais longos', texto: `Até ${tg.botoes} botões com ${tg.rotulo} caracteres cada.` },
      { titulo: 'Na mesma fila', texto: 'Telegram, WhatsApp e site na mesma lista da equipe.' },
      { titulo: 'Conexão protegida', texto: 'Cada mensagem chega com um segredo conferido antes de entrar.' },
      { titulo: 'Sem custo por mensagem', texto: 'O Telegram não cobra por conversa de bot.' },
    ],
    ficha: [
      { rotulo: 'Conexão', valor: 'Token do BotFather' },
      { rotulo: 'Botões por mensagem', valor: String(tg.botoes) },
      { rotulo: 'Texto do botão', valor: `${tg.rotulo} caracteres` },
      { rotulo: 'Conversas', valor: 'Particulares com o bot' },
      { rotulo: 'Janela para responder', valor: 'Sem limite' },
      { rotulo: 'Custo da mensagem', valor: 'Nenhum' },
    ],
  },
]

export const canalPorSlug = (slug: string) => CANAIS.find((c) => c.slug === slug)
