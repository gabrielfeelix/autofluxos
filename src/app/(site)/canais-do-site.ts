import { GLIFO_INSTAGRAM, GLIFO_TELEGRAM, GLIFO_WHATSAPP } from '@/components/design/glifos-oficiais'

/** Os canais como o site os apresenta: menu Canais e a página do produto. Fatos em `docs/FUNCIONALIDADES.md` §2. */
export const CANAIS = [
  {
    nome: 'WhatsApp',
    cor: '#25d366',
    glifo: GLIFO_WHATSAPP,
    linha: 'No número que já está no seu cartão.',
    fatos: ['Continua no app do celular', 'Áudio vira texto no Inbox', 'Transmissões com modelo aprovado'],
  },
  {
    nome: 'Instagram',
    cor: '#e4405f',
    glifo: GLIFO_INSTAGRAM,
    linha: 'Direct e menções em story.',
    fatos: ['Foto, áudio e vídeo', 'Respostas com botões', 'Na mesma fila do WhatsApp'],
  },
  {
    nome: 'Chat do site',
    cor: '#6366f1',
    linha: 'Uma linha de código e o chat está na página.',
    fatos: ['Cor, saudação e mascote seus', 'Formulário de contato', 'Ligação de voz do visitante'],
  },
  {
    nome: 'Telegram',
    cor: '#26a5e4',
    glifo: GLIFO_TELEGRAM,
    linha: 'Conecta com o token do BotFather.',
    fatos: ['O mesmo fluxo dos outros canais', 'Conversa particular com o bot', 'Na mesma fila da equipe'],
  },
]
