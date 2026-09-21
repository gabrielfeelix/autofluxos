import 'server-only'
import { lerCredencial, listarConexoes } from './repos/conexoes'

/**
 * Onde o token de Ads mora: numa Conexão, como qualquer outra credencial.
 *
 * ---------------------------------------------------------------------------
 * Por que não um tipo novo de conexão, nem uma coluna nova
 * ---------------------------------------------------------------------------
 *
 * O cofre de Conexões já resolve o problema inteiro, valor no Vault, só a
 * referência no banco, `Conexao` sem campo de valor para que a tela não possa
 * vazá-lo nem por descuido. Um token da Marketing API é um `bearer`, que é um
 * dos três tipos que já existem. Criar `tipo: 'meta_ads'` significaria
 * migration, telas novas e um caminho paralelo para guardar exatamente a mesma
 * coisa do mesmo jeito.
 *
 * A convenção é **o nome**: uma conexão chamada `meta-ads` é a que este
 * resolvedor usa. É a mesma escolha do `PLANO-MESTRE.md` para a Fase 9 ,
 * "presets de blocos `http` preconfigurados, sem criar tipo novo de nó".
 *
 * ---------------------------------------------------------------------------
 * O que isto **não** é
 * ---------------------------------------------------------------------------
 *
 * Não é OAuth. O cliente cola um token que ele mesmo gerou no Business Manager,
 * como já faz para qualquer outra integração. OAuth com a Meta é a Fase 10 do
 * plano mestre ("OAuth2 como novo tipo de Conexão quando uma integração real
 * exigir") e pede fluxo de autorização, tela de consentimento e renovação ,
 * trabalho que só se paga quando houver cliente pedindo, e que não bloqueia
 * nada disto: um System User token do Business Manager não expira.
 */

/** O nome que a conexão precisa ter. Uma palavra, para caber na tela e no doc. */
export const NOME_DA_CONEXAO_DE_ADS = 'meta-ads'

/**
 * O token de Ads desta conta, ou `null` quando ela não conectou.
 *
 * **`null` é resposta normal, não falha.** A esmagadora maioria das contas não
 * vai conectar Ads nunca, elas atendem no WhatsApp e pronto. Quem não conectou
 * continua vendo o título do anúncio, que chega de graça no webhook. Por isso
 * aqui não há alerta nem erro: não conectar é uma escolha, e tratá-la como
 * defeito encheria a auditoria de ruído sobre contas que estão perfeitas.
 */
export async function tokenDeAnuncios(clienteId: string): Promise<string | null> {
  try {
    const conexoes = await listarConexoes(clienteId)
    const doAds = conexoes.find(
      (c) => c.nome.trim().toLowerCase() === NOME_DA_CONEXAO_DE_ADS && c.tipo === 'bearer',
    )
    if (!doAds) return null

    const credencial = await lerCredencial(doAds.id, clienteId)
    return credencial?.valor ?? null
  } catch {
    /*
     * Cofre fora do ar não pode derrubar o Inbox. Sem token a tela cai para o
     * `headline`, que é o degrau de ontem, e quem chama (`resolverAnuncios`)
     * já trata `null` como "esta conta não tem Ads", sem alertar.
     */
    return null
  }
}
