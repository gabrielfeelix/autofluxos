import { redirect } from 'next/navigation'
import { FormularioDeEmpresa } from '@/components/conta/formulario-empresa'
import { Portico } from '@/components/design/portico'
import { acaoPrimeiroAcesso } from '@/server/acoes-conta'
import { contasDoUsuario, ehAdminDaPlataforma, exigirUsuario } from '@/server/sessao'

export const dynamic = 'force-dynamic'

/**
 * O passo dois do cadastro aberto: a empresa.
 *
 * **É tela, e não modal sobre o painel.** A tentação era abrir um diálogo por
 * cima da primeira visita, mas não há painel embaixo para servir de fundo ,
 * quem chega aqui não tem empresa nenhuma, então o que ficaria atrás do modal é
 * exatamente a tela vazia que diz "fale com quem administra". Uma porta a mais,
 * com a mesma moldura das outras duas, conta a verdade: o cadastro tem dois
 * passos e este é o segundo.
 *
 * Quem já tem empresa não vê isto nunca. Não é arrumação: sem a conferência, um
 * `/primeiro-acesso` digitado à mão por quem já é cliente abriria um formulário
 * que cria uma segunda empresa vazia.
 */
export default async function PrimeiroAcesso({
  searchParams,
}: {
  searchParams: Promise<{ telefone?: string }>
}) {
  const sessao = await exigirUsuario()
  const { telefone } = await searchParams

  /*
   * O administrador da plataforma não passa por aqui.
   *
   * Ele não é dono de empresa nenhuma por definição, o caminho dele é
   * `/admin/contas`. Sem esta linha, um administrador que caísse nesta URL
   * criaria uma empresa em nome próprio e viraria cliente de si mesmo.
   */
  if (ehAdminDaPlataforma(sessao)) redirect('/admin/contas')

  const [primeira] = await contasDoUsuario(sessao.usuario.id)
  if (primeira) redirect(`/clientes/${primeira.id}`)

  return (
    <Portico
      titulo={`Bem-vindo, ${sessao.usuario.nome.split(' ')[0]}`}
      descricao="Falta só dizer de quem é a conta."
      rodape={
        <p>
          Depois, vamos ajudar você a escolher seu objetivo, preparar o sistema e conectar seu canal de atendimento.
        </p>
      }
    >
      <FormularioDeEmpresa action={acaoPrimeiroAcesso} telefoneInicial={telefone ?? ''} />
    </Portico>
  )
}
