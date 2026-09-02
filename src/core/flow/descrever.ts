import { textoDaMensagem } from './mensagem'
import {
  SAIDA_ESCOLHEU,
  SAIDA_FALSO,
  SAIDA_MIDIA,
  SAIDA_TIMEOUT,
  SAIDA_VAZIO,
  SAIDA_VERDADEIRO,
  type No,
} from './schema'

/**
 * Como chamar um bloco dentro de uma mensagem para quem desenhou.
 *
 * Existe porque as listas de impedimento e de aviso são do **fluxo inteiro**,
 * não do bloco selecionado. Sem isto, dois blocos soltos viravam duas linhas
 * idênticas dizendo "Este bloco está solto" — e "este" não respondia qual, que
 * é exatamente o que a pessoa precisa saber para consertar.
 *
 * O texto do bloco é o que identifica melhor, porque é o que se lê no desenho.
 * Quando ele está vazio sobra o tipo, que ao menos estreita a busca.
 *
 * Mora aqui, e não em `validar.ts`, porque o motor também precisa dele: quando
 * a conversa cai num beco sem saída, dizer **qual** bloco acabou é a diferença
 * entre "a conversa terminou" e um defeito que se conserta sozinho.
 */
export function descrever(no: No): string {
  const rotular = (tipo: string, detalhe: string) =>
    detalhe === '' ? `O bloco de ${tipo}` : `${tipo} ${detalhe}`

  switch (no.type) {
    case 'mensagem':
      return rotular('Mensagem', curto(textoDaMensagem(no)))
    case 'pergunta':
      return rotular('Pergunta', curto(no.data.texto))
    case 'condicao':
      return rotular('Condição sobre', curto(no.data.variavel))
    case 'salvar-campo':
      return rotular('Guardar em', curto(no.data.campo))
    case 'ia':
      return rotular('IA', curto(no.data.instrucao))
    case 'handoff':
      return rotular('Falar com humano', curto(no.data.motivo))
    case 'http':
      return rotular('Serviços externos', curto(no.data.url))
    case 'midia':
      return rotular('Mídia', curto(no.data.legenda ?? no.data.url))
    case 'etapa':
      // O bloco de etapa não tem texto nenhum para citar — os dois campos são
      // ids. Sobra o tipo, que é o que já acontece com qualquer bloco vazio.
      return 'O bloco de etapa do quadro'
    case 'ir-fluxo':
      // `rotulo` é o nome do fluxo de destino guardado na hora da escolha. É
      // exatamente o que identifica o bloco para quem lê a lista de problemas.
      return rotular('Ir para', curto(no.data.rotulo))
    case 'voltar':
      // `rotulo` é o nome do bloco de destino no instante da escolha. Vazio
      // quer dizer o início do fluxo, que é o padrão do bloco.
      return rotular('Voltar', curto(no.data.rotulo || 'ao início'))
  }
}

/**
 * Como chamar **uma saída** de um bloco, na língua de quem desenhou.
 *
 * A saída é o que a pessoa arrasta na tela, e é onde o desenho costuma acabar
 * por engano: um botão desenhado e não ligado parece pronto no card. Dizer "a
 * opção «Voltar ao Menu»" em vez de `sourceHandle: "a3f9b1c2"` é o que
 * transforma um beco sem saída num conserto de dez segundos.
 */
export function nomeDaSaida(no: No, saida: string | undefined): string | null {
  if (no.type === 'pergunta') {
    if (saida === SAIDA_TIMEOUT) return 'a saída de "ninguém respondeu no prazo"'
    if (saida === SAIDA_MIDIA) return 'a saída de "mandou arquivo"'
    if (saida === SAIDA_ESCOLHEU) return 'a saída de "escolheu"'
    if (saida === SAIDA_VAZIO) return 'a saída de "a lista veio vazia"'

    const opcao = no.data.opcoes.find((o) => o.id === saida)
    if (opcao) return `a opção ${curto(opcao.rotulo) || '(sem rótulo)'}`
  }

  if (no.type === 'condicao') {
    if (saida === SAIDA_VERDADEIRO) return 'a saída de "sim"'
    if (saida === SAIDA_FALSO) return 'a saída de "não"'
  }

  return null
}

function curto(texto: string): string {
  const limpo = texto.trim().replace(/\s+/g, ' ')
  if (limpo === '') return ''
  return limpo.length > 38 ? `"${limpo.slice(0, 38)}…"` : `"${limpo}"`
}
