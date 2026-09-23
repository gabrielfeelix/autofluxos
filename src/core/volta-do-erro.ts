/**
 * Para onde o botão de voltar da tela de erro leva, a partir do endereço (S12).
 *
 * Dentro de uma conta, volta para o Início dela: é o contexto que a pessoa
 * tinha. No próprio Início, voltar para ele repetiria o erro, então vai para a
 * escolha de conta. Na área admin, volta para a lista de contas do admin. Fora
 * disso, `/voltar` decide pela sessão.
 */
export function voltaDoErro(caminho: string): { href: string; rotulo: string } {
  const conta = /^\/clientes\/([^/?#]+)(\/[^?#]*)?/.exec(caminho)
  if (conta) {
    const resto = (conta[2] ?? '').replace(/\/+$/, '')
    if (resto !== '') return { href: `/clientes/${conta[1]}`, rotulo: 'Voltar para o início da conta' }
    return { href: '/contas', rotulo: 'Escolher outra conta' }
  }
  if (caminho.startsWith('/admin')) return { href: '/admin/contas', rotulo: 'Voltar para as contas' }
  return { href: '/voltar', rotulo: 'Voltar para o início' }
}
