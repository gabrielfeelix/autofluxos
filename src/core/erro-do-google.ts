/** A frase de cada recusa que o Google devolve para `/entrar?error=`. */
export function fraseDoErroDoGoogle(codigo: string | undefined): string | undefined {
  if (!codigo) return undefined
  if (codigo === 'account_not_linked') {
    return 'Este e-mail já tem conta com senha e ainda não foi confirmado. Entre com a senha.'
  }
  if (codigo === 'BANNED_USER' || codigo === 'banned_user') {
    return 'Este acesso está suspenso. Fale com quem administra o painel.'
  }
  if (codigo === 'unable_to_create_session') {
    return 'Esta conta usa verificação em duas etapas. Entre com e-mail e senha.'
  }
  return 'O Google não confirmou o acesso. Tente de novo.'
}
