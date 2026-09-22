import Link from 'next/link'
import { canalDoInstagram } from '@/server/repos/canais-instagram'
import { listarCanais } from '@/server/repos/conversas'
import { saudeDoInstagram, saudeDoWhatsApp } from '@/core/saude-da-conexao'

/**
 * A faixa que avisa, no Inbox, que um canal caiu.
 *
 * **Por que no Inbox, e não só em Configurações.** Canal fora do ar não parece
 * defeito: parece um dia fraco. As mensagens não voltam com erro, elas
 * simplesmente não chegam, e quem está atendendo não tem como distinguir
 * "ninguém escreveu hoje" de "o WhatsApp parou de entregar há três dias". O
 * lugar onde essa dúvida nasce é esta tela, e é aqui que ela precisa ser
 * respondida.
 *
 * **Só o que já caiu vira faixa.** Token vencendo aparece como selo em
 * Configurações e nada mais: interromper o atendimento com um aviso que pode
 * esperar uma semana é como se ensina alguém a ignorar faixas. Ver `pedeAcao`.
 *
 * É componente de servidor com consulta própria porque a alternativa ,
 * carregar canais junto do resto da página, colocaria mais duas consultas no
 * caminho de desenhar a conversa, que é o caminho mais quente do produto.
 */
export async function FaixaDeCanalCaido({ clienteId }: { clienteId: string }) {
  const [canais, instagram] = await Promise.all([
    listarCanais(clienteId),
    canalDoInstagram(clienteId),
  ])

  const whatsCaiu = saudeDoWhatsApp(canais) === 'reconectar'
  const igCaiu = saudeDoInstagram(instagram) === 'reconectar'
  if (!whatsCaiu && !igCaiu) return null

  const canal = whatsCaiu ? 'WhatsApp' : 'Instagram'
  const destino = whatsCaiu ? 'whatsapp' : 'instagram'

  return (
    <div className="border-b border-rose-400/25 bg-rose-400/[0.07] px-4 py-2.5 md:px-[42px]">
      <p className="text-[12.5px] leading-5 text-perigo">
        <strong className="font-bold">O {canal} desta conta está fora do ar.</strong>{' '}
        {whatsCaiu
          ? 'A Meta desconectou o número, costuma acontecer quando o celular é trocado ou o WhatsApp Business é reinstalado. Enquanto isso, nada entra nem sai por ele.'
          : 'A autorização da conta venceu. Enquanto isso, o direct não chega aqui.'}{' '}
        <Link
          href={`/clientes/${clienteId}/ajustes/${destino}`}
          className="font-bold underline underline-offset-2 transition hover:text-primary"
        >
          Resolver em Configurações
        </Link>
      </p>
    </div>
  )
}
