import { origemDoContato } from '@/core/contatos/origem'
import { AcoesDoTelefone } from './acoes-do-telefone'
import { telefoneLegivel } from '@/core/contatos/telefone'
import { horaExata, quando } from '@/lib/quando'
import { IconeDaSecao, iconeFicha } from './icones'

/**
 * Quem é a pessoa, em fatos datados.
 *
 * **Tudo aqui já estava no banco e não aparecia em lugar nenhum da ficha.** A
 * tela tinha "o que o fluxo coletou", que é o que o bot perguntou, e mais
 * nada sobre a pessoa: nem desde quando ela é nossa, nem quando falou pela
 * última vez, nem em que pé está a conversa dela. Para ver o telefone era
 * preciso ler o cabeçalho; para saber se a conversa estava adiada, abrir o
 * Inbox.
 *
 * **Cada linha é um fato medido, e linha sem fato não aparece.** Origem só
 * existe para quem chegou depois que o `referral` do CTWA passou a ser lido;
 * escrever "Direto" para os outros seria afirmar o que ninguém mediu, que é o
 * erro que este produto evita desde o começo.
 *
 * O que **não** está aqui, e por quê: consentimento de marketing, aberturas e
 * cliques de campanha são de quem manda e-mail em massa, e este produto não
 * manda. Empresa e cargo exigiriam tabela nova, inventar campo vazio na tela é
 * como um CRM começa a mentir.
 */
export function Informacoes({
  waId,
  campos,
  criadoEm,
  ultimaEntradaEm,
  estagioDesde,
  estado,
  adiadaAte,
  adiadaNota,
}: {
  waId: string
  campos: Record<string, string>
  criadoEm: string
  /** A última vez que **a pessoa** falou. `null` = ela nunca escreveu. */
  ultimaEntradaEm: string | null
  /** Quando o estágio mudou pela última vez. `null` = nunca mudou. */
  estagioDesde: string | null
  estado: 'aberta' | 'adiada' | 'resolvida'
  adiadaAte: string | null
  adiadaNota: string | null
}) {
  const origem = origemDoContato(campos)

  return (
    <section className="app-card overflow-hidden">
      <h2 className="flex items-center gap-2 border-b border-line px-[18px] py-3.5 text-[13px] font-bold">
        <IconeDaSecao>{iconeFicha}</IconeDaSecao>
        Informações
      </h2>
      {/*
        **Grade, não torre.** Sete linhas de uma coluna só era o desenho da
        antiga faixa de 280px: na largura da ficha, cada fato ganhava uma linha
        inteira e a lista descia mais que a negociação ao lado, que é o que
        importa. O `gap-px` sobre o fundo `--line` desenha as divisórias entre
        as células sem borda em cada uma, e a última ocupa a linha inteira
        quando sobra sozinha: sem isso o fundo das divisórias aparecia como um
        retângulo cinza vazio ao lado dela, que parece dado faltando.
      */}
      <dl className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2">
        <Linha rotulo="Telefone">
          {/* `tel:` sozinho resolvia o celular e abandonava o desktop, que é
              onde o time passa o dia. Ver `acoes-do-telefone.tsx`. */}
          <AcoesDoTelefone waId={waId} legivel={telefoneLegivel(waId)} />
        </Linha>

        <Linha rotulo="Canal">WhatsApp</Linha>

        {origem && (
          <Linha rotulo="Origem">
            <span className="font-semibold">{origem.rotulo}</span>
            {origem.titulo && (
              <span className="mt-0.5 block text-[11.5px] font-normal text-dim">
                {origem.titulo}
              </span>
            )}
          </Linha>
        )}

        <Linha rotulo="Chegou">
          <span title={horaExata(criadoEm)}>{quando(criadoEm)}</span>
        </Linha>

        <Linha rotulo="Falou pela última vez">
          {ultimaEntradaEm ? (
            <span title={horaExata(ultimaEntradaEm)}>{quando(ultimaEntradaEm)}</span>
          ) : (
            <span className="font-normal text-dim">nunca escreveu</span>
          )}
        </Linha>

        {estagioDesde && (
          /* O estágio sem data engana: "negociando desde abril" é uma venda que
             ninguém teve coragem de marcar como perdida. */
          <Linha rotulo="Neste estágio">
            <span title={horaExata(estagioDesde)}>{quando(estagioDesde)}</span>
          </Linha>
        )}

        <Linha rotulo="Conversa">
          {estado === 'resolvida' ? (
            <span className="text-ok">resolvida</span>
          ) : estado === 'adiada' ? (
            <>
              <span className="text-aviso">
                adiada{adiadaAte ? ` até ${horaExata(adiadaAte)}` : ''}
              </span>
              {adiadaNota && (
                <span className="mt-0.5 block text-[11.5px] font-normal text-dim">
                  {adiadaNota}
                </span>
              )}
            </>
          ) : (
            'aberta'
          )}
        </Linha>
      </dl>
    </section>
  )
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-panel px-[18px] py-[11px] sm:last:odd:col-span-2">
      <dt className="text-[10.5px] font-semibold text-dim">{rotulo}</dt>
      <dd className="mt-1 text-[12.5px] font-semibold">{children}</dd>
    </div>
  )
}
