/**
 * Onde mora a agenda, e o nome que ela tem na tela.
 *
 * O endereço estava escrito dez vezes — uma por preset — e cada cópia era um
 * lugar para esquecer no dia em que ele mudasse. Aqui é um lugar só, e ele vale
 * tanto para os blocos prontos quanto para a conferência da chave.
 *
 * Mora em `core/` porque os presets moram, e presets são dado puro.
 */

/** A base da API v1 da agenda. Sem barra no fim: quem usa acrescenta a rota. */
export const ENDERECO_DA_AGENDA = 'https://verandi.4yu.com.br/api/v1'

/** O nome do produto na tela de quem opera. */
export const NOME_DA_AGENDA = 'Verandi'

/**
 * O nome que a credencial da agenda recebe ao ser criada pela tela.
 *
 * Fixo porque a tela precisa **reconhecer** a credencial da agenda entre as
 * outras para dizer se ela está ligada — e reconhecer por nome é frágil, mas é
 * o que existe sem uma coluna nova. Quem renomear à mão perde o cartão de
 * estado, não a integração: os blocos apontam pelo id.
 */
export const NOME_DA_CREDENCIAL_DA_AGENDA = 'Verandi (agenda)'

/** O prefixo que toda chave da agenda tem. Serve para pegar cola errada cedo. */
export const PREFIXO_DA_CHAVE = 'vr_'
