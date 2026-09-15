/**
 * Os emojis que a caixa de resposta oferece, e como achá-los.
 *
 * ---------------------------------------------------------------------------
 * Por que uma lista escrita à mão, e não a lista inteira
 * ---------------------------------------------------------------------------
 *
 * Unicode tem mais de três mil emojis, e as bibliotecas que os trazem todos
 * custam centenas de kB no navegador — mais do que esta tela inteira. Quem
 * atende cliente não precisa da bandeira de Tuvalu: precisa achar 👍, 😂, ❤️ e
 * 📸 sem procurar. A lista curta é o recurso, como os seis da reação.
 *
 * ---------------------------------------------------------------------------
 * As palavras-chave são em português, e é isso que faz a busca servir
 * ---------------------------------------------------------------------------
 *
 * Os nomes oficiais do Unicode são em inglês ("grinning face"), e quem digita
 * "rindo" não acharia nada. Cada emoji aqui carrega as palavras que alguém
 * daqui digitaria — inclusive as erradas de propósito, como "risada" e "rs".
 *
 * Acrescentar emoji é acrescentar uma linha. Se a lista crescer muito, o
 * caminho é um pacote sob demanda, não abrir mão da busca em português.
 */

/** `emoji` seguido das palavras que acham ele, separadas por espaço. */
export type GrupoDeEmoji = {
  nome: string
  /** Um rosto do grupo, para a aba. */
  aba: string
  itens: string[]
}

export const GRUPOS_DE_EMOJI: GrupoDeEmoji[] = [
  {
    nome: 'Rostos',
    aba: '😀',
    itens: [
      '😀 sorriso feliz alegre',
      '😃 sorriso feliz animado',
      '😄 sorriso feliz rindo',
      '😁 sorriso dentes feliz',
      '😆 rindo risada gargalhada',
      '😅 rindo suor alivio nervoso',
      '😂 chorando de rir risada gargalhada rs',
      '🤣 rolando de rir risada gargalhada rs',
      '🙂 sorriso leve ok',
      '😉 piscada piscar',
      '😊 sorriso timido feliz fofo',
      '😇 anjo santo inocente',
      '🥰 apaixonado amor coracoes fofo',
      '😍 apaixonado amor olhos coracao',
      '😘 beijo beijinho amor',
      '😗 beijo',
      '😋 delicia gostoso lingua',
      '😛 lingua brincadeira',
      '😜 lingua piscada brincadeira',
      '🤪 doido maluco brincadeira',
      '🤗 abraco abracar acolher',
      '🤔 pensando duvida hmm',
      '🤫 silencio segredo shh',
      '🤐 boca fechada calado segredo',
      '😐 neutro sem reacao',
      '😑 sem expressao chateado',
      '🙄 revirando os olhos ah',
      '😏 sarcasmo malicia',
      '😒 chateado desanimado',
      '😔 triste desanimado',
      '😞 triste decepcionado',
      '😟 preocupado',
      '😕 confuso',
      '🙁 triste',
      '😣 aflito',
      '😖 aflito frustrado',
      '😫 cansado exausto',
      '😩 cansado desesperado',
      '🥺 pedindo suplicando por favor fofo',
      '😢 chorando triste',
      '😭 chorando muito triste',
      '😤 bufando irritado determinado',
      '😠 bravo irritado',
      '😡 furioso raiva bravo',
      '🤯 explodindo mente chocado',
      '😳 chocado vergonha surpreso',
      '🥵 calor quente',
      '🥶 frio congelando',
      '😱 grito medo susto',
      '😨 medo assustado',
      '😰 ansioso suor nervoso',
      '😥 aliviado triste',
      '🤝 aperto de mao acordo fechado negocio',
      '😴 dormindo sono',
      '🤤 babando desejo',
      '😪 sono cansado',
      '🤒 doente febre',
      '🤕 machucado ferido',
      '🤧 espirro resfriado',
      '😷 mascara doente',
      '🥳 festa comemorando parabens',
      '😎 oculos estiloso tranquilo',
      '🤓 nerd estudioso',
      '🧐 analisando monoculo',
      '🙃 de cabeca para baixo ironia',
      '😬 sem graca constrangido',
      '🤥 mentira pinoquio',
      '😶 sem boca calado',
    ],
  },
  {
    nome: 'Gestos',
    aba: '👍',
    itens: [
      '👍 joia positivo ok curtir legal',
      '👎 negativo nao ruim',
      '👏 palmas parabens aplauso',
      '🙌 comemorando maos para cima aleluia',
      '🙏 obrigado por favor orando agradecido',
      '👌 ok certo perfeito',
      '🤌 italiano gesto dedos',
      '✌️ paz vitoria',
      '🤞 dedos cruzados torcendo sorte',
      '🤙 me liga shaka',
      '👋 oi tchau aceno ola',
      '🤚 mao parada pare',
      '✋ mao pare',
      '💪 forca musculo bombado',
      '👊 soco toca aqui',
      '✊ punho forca',
      '👆 apontando para cima',
      '👇 apontando para baixo',
      '👉 apontando para a direita',
      '👈 apontando para a esquerda',
      '☝️ um dedo atencao',
      '🖐️ mao aberta',
      '🤲 maos abertas pedindo',
      '💅 unha esmalte cuidado',
      '👀 olhos olhando atencao',
      '🧠 cerebro ideia inteligente',
      '👤 pessoa contato usuario',
      '👨‍💻 trabalhando computador programador',
      '🕺 dancando comemorando',
      '💃 dancando comemorando',
    ],
  },
  {
    nome: 'Coração',
    aba: '❤️',
    itens: [
      '❤️ coracao amor vermelho',
      '🧡 coracao laranja',
      '💛 coracao amarelo',
      '💚 coracao verde',
      '💙 coracao azul',
      '💜 coracao roxo',
      '🖤 coracao preto',
      '🤍 coracao branco',
      '💔 coracao partido triste',
      '💕 coracoes amor',
      '💖 coracao brilhando amor',
      '💗 coracao crescendo amor',
      '💘 coracao flecha paixao',
      '💝 coracao presente',
      '❣️ coracao exclamacao',
      '💋 beijo batom',
      '💐 buque flores',
      '🌹 rosa flor',
      '🌷 tulipa flor',
      '🌻 girassol flor',
      '🎉 festa comemorando parabens',
      '🎊 confete festa',
      '🎁 presente',
      '🎂 bolo aniversario parabens',
      '🥂 brinde comemorar taca',
      '🍾 champanhe comemorar',
    ],
  },
  {
    nome: 'Trabalho',
    aba: '📌',
    itens: [
      '✅ certo feito concluido ok',
      '❌ errado nao cancelado',
      '⚠️ atencao aviso cuidado',
      '❗ atencao importante exclamacao',
      '❓ duvida pergunta interrogacao',
      '📌 fixar importante alfinete',
      '📍 localizacao endereco lugar',
      '📅 data calendario agenda',
      '⏰ horario alarme lembrete',
      '⏳ esperando tempo ampulheta',
      '🔔 aviso notificacao sino',
      '📞 telefone ligar',
      '📱 celular whatsapp',
      '💻 computador notebook',
      '✉️ email mensagem carta',
      '📄 documento arquivo pdf',
      '📎 anexo clipe',
      '🔗 link endereco',
      '🔒 seguro cadeado privado',
      '🔑 chave acesso senha',
      '📷 foto camera',
      '🎥 video filmadora',
      '🎤 audio microfone',
      '📊 grafico relatorio resultado',
      '📈 subindo crescimento resultado',
      '📉 caindo queda',
      '💰 dinheiro pagamento valor',
      '💳 cartao pagamento credito',
      '🧾 nota recibo comprovante',
      '🛒 compra carrinho pedido',
      '🏷️ etiqueta preco desconto',
      '🚀 lancamento rapido foguete',
      '🔥 fogo bombando quente',
      '⭐ estrela favorito avaliacao',
      '✨ brilho novidade',
      '💡 ideia lampada sugestao',
      '🎯 alvo meta objetivo',
      '🏆 trofeu vitoria premio',
      '🤖 bot robo automacao',
      '🔎 procurar busca lupa',
      '🛠️ ferramenta conserto manutencao',
      '📦 pacote entrega encomenda',
      '🚚 entrega caminhao frete',
      '🏠 casa endereco imovel',
      '🏥 hospital clinica saude',
      '🏫 escola aula curso',
    ],
  },
  {
    nome: 'Comida',
    aba: '☕',
    itens: [
      '☕ cafe',
      '🍵 cha',
      '🍺 cerveja',
      '🍷 vinho',
      '🥤 refrigerante bebida',
      '💧 agua',
      '🍕 pizza',
      '🍔 hamburguer lanche',
      '🍟 batata frita',
      '🌭 cachorro quente',
      '🥗 salada saudavel',
      '🍝 macarrao massa',
      '🍣 sushi japones',
      '🍗 frango',
      '🥩 carne churrasco',
      '🍞 pao padaria',
      '🧀 queijo',
      '🍎 maca fruta',
      '🍌 banana fruta',
      '🍓 morango fruta',
      '🍫 chocolate doce',
      '🍦 sorvete',
      '🍩 rosquinha doce',
      '🎂 bolo doce',
    ],
  },
  {
    nome: 'Outros',
    aba: '🌎',
    itens: [
      '🌎 mundo planeta terra',
      '☀️ sol dia',
      '🌙 lua noite',
      '⛅ nuvem tempo',
      '🌧️ chuva',
      '❄️ neve frio',
      '🌈 arco iris',
      '⚽ futebol bola',
      '🏀 basquete',
      '🎾 tenis',
      '🏃 correndo corrida',
      '🧘 yoga meditacao pilates',
      '🚗 carro',
      '✈️ aviao viagem',
      '🏖️ praia ferias',
      '🎵 musica nota',
      '🎧 fone musica',
      '📺 tv televisao',
      '🎮 jogo videogame',
      '🐶 cachorro dog pet',
      '🐱 gato pet',
      '🐾 pata pet animal',
      '🌱 planta muda crescer',
      '🍀 trevo sorte',
      '💤 sono dormindo',
      '♻️ reciclagem sustentavel',
    ],
  },
]

/** Só o emoji, sem as palavras. */
export function emojiDoItem(item: string): string {
  return item.slice(0, item.indexOf(' '))
}

/**
 * Os emojis que casam com o que foi digitado, em todos os grupos.
 *
 * Busca por **prefixo de palavra**, e não por trecho solto: "car" acha "carro"
 * e "cartão", e não acha "mascara". Trecho solto devolveria resultados que
 * ninguém consegue explicar, e numa lista de emoji isso parece defeito.
 *
 * Sem acento nem maiúscula dos dois lados — quem digita rápido não acentua, e
 * exigir isso faria a busca falhar justamente para quem tem pressa.
 */
export function buscarEmojis(termo: string, teto = 60): string[] {
  const alvo = semAcento(termo)
  if (alvo === '') return []

  const achados: string[] = []
  for (const grupo of GRUPOS_DE_EMOJI) {
    for (const item of grupo.itens) {
      const palavras = semAcento(item).split(' ').slice(1)
      if (palavras.some((p) => p.startsWith(alvo))) {
        achados.push(emojiDoItem(item))
        if (achados.length >= teto) return achados
      }
    }
  }
  return achados
}

function semAcento(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}
