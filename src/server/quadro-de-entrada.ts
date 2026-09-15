import 'server-only'
import { alertar } from './alertar'
import { acharQuadroPadrao, porNoQuadro } from './repos/quadros'

/**
 * O contato novo entra sozinho no quadro padrão (0043).
 *
 * ---------------------------------------------------------------------------
 * Por que mora aqui, e não dentro de `receber-mensagem.ts`
 * ---------------------------------------------------------------------------
 *
 * Porque entrar no funil não é consequência de **ter mandado mensagem** — é
 * consequência de **ser um contato novo**. Enquanto isto viveu dentro do
 * tratamento da mensagem, essa distinção não existia na prática: contato criado
 * por qualquer outro caminho (a importação de planilha, o botão "criar contato"
 * do quadro, e amanhã um formulário de anúncio) nascia fora do quadro, e a
 * queixa que originou a 0043 — *"o lead não vai automático, tem que clicar e
 * puxar"* — voltava inteira por essas portas.
 *
 * Mover não muda o comportamento de hoje: quem chama continua sendo
 * `receber-mensagem.ts`, com a mesma condição de `criadoAgora`. O que muda é
 * que agora existe **um lugar** para chamar, quando a segunda porta aparecer.
 *
 * ---------------------------------------------------------------------------
 * As garantias, que são as mesmas de antes
 * ---------------------------------------------------------------------------
 *
 * **Só contato recém-criado.** Quem já existia e voltou a escrever não pode ser
 * jogado de volta para a primeira etapa — isso apagaria o progresso de alguém
 * que a equipe já arrastou até o fim do funil, e apagaria a cada mensagem.
 * `porNoQuadro` ignora duplicata, mas a garantia certa é não chamar. Quem chama
 * decide isso; esta função confia.
 *
 * **Nada aqui pode derrubar quem chamou.** É a mesma regra do bloco de etapa:
 * um quadro mal configurado — sem etapa, apagado entre a leitura e a escrita —
 * não pode fazer alguém deixar de ser atendido, nem fazer um webhook responder
 * erro para a Meta. Vira alerta e a vida segue.
 *
 * Conta sem quadro marcado sai em uma consulta e não faz nada, que é o
 * comportamento correto para quem não quer a automação.
 */
export async function porNoQuadroPadrao(contato: {
  id: string
  clienteId: string
}): Promise<void> {
  try {
    const quadroId = await acharQuadroPadrao(contato.clienteId)
    if (!quadroId) return

    const posto = await porNoQuadro(contato.clienteId, quadroId, [contato.id])
    if (!posto.ok) {
      await alertar('o contato novo não entrou no quadro padrão', posto.motivo, {
        contato: contato.id,
      })
    }
  } catch (erro) {
    const detalhe = erro instanceof Error ? erro.message : String(erro)
    await alertar('o quadro padrão falhou ao receber o contato novo', detalhe, {
      contato: contato.id,
    })
  }
}
