import { CabecalhoDaTela } from '@/components/design/cabecalho-da-tela'
import { Miolo } from '@/components/design/miolo'
import { notFound } from 'next/navigation'
import { AjustesShell } from '@/components/design/ajustes-shell'
import { GerenciadorDoAcervo } from '@/components/acervo/gerenciador'
import { acaoApagarDoAcervo } from '@/server/acoes'
import { listarAcervo } from '@/server/repos/acervo'
import { acharCliente } from '@/server/repos/clientes'

export const dynamic = 'force-dynamic'

export default async function Pagina({ params }: { params: Promise<{ clienteId: string }> }) {
  const { clienteId } = await params
  const [cliente, arquivos] = await Promise.all([acharCliente(clienteId), listarAcervo(clienteId)])
  if (!cliente) notFound()

  return (
    <AjustesShell cliente={cliente} ativa="acervo">
      <Miolo largura="larga">
        <CabecalhoDaTela
          trilha={[
            { rotulo: 'Configurações', href: `/clientes/${cliente.id}/ajustes` },
            { rotulo: 'Arquivos e mídias' },
          ]}
          titulo={<>Arquivos e mídias</>}
          descricao={<>Os arquivos que o bloco de Mídia pode enviar: foto da sala, vídeo do trabalho, PDF do
          plano. Copie o endereço de um arquivo e cole no bloco.{' '}
          <strong className="font-semibold text-soft">
            Eles ficam num endereço público enquanto estiverem aqui
          </strong>{' '}
         , é o que permite o WhatsApp baixá-los para entregar. Não guarde documento pessoal de
          ninguém.</>}
        />

        <GerenciadorDoAcervo
          arquivos={arquivos}
          clienteId={cliente.id}
          apagar={acaoApagarDoAcervo.bind(null, cliente.id)}
        />
      </Miolo>
    </AjustesShell>
  )
}
