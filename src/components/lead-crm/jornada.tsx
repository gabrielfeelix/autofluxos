import { passagensComNome, type AnuncioEmCache, type Passagem } from '@/core/anuncios'
import { horaExata, quando } from '@/lib/quando'

/**
 * Por onde a pessoa chegou, todas as vezes.
 *
 * **Origem não é um fato único, é um histórico.** O contato guarda a primeira
 * origem dele e a ficha mostrava só ela; quem clicou em três anúncios diferentes
 * em dois meses aparecia como se tivesse vindo uma vez. Cada passagem pelo CTWA
 * é uma linha em `passagens` desde a 0044, com o `ad_id` e o título que a
 * pessoa leu no dia, o dado estava gravado e não tinha tela.
 *
 * É a coisa que mais se pergunta antes de responder alguém que voltou: "esse
 * aqui é o do anúncio de setembro ou o daquela campanha antiga?".
 *
 * Sem o Ads conectado a lista aparece igual, com o título do dia em vez do nome
 * atual do anúncio. Conectar melhora o rótulo; não conectar não esconde nada.
 */
export function Jornada({
  passagens,
  nomesDosAnuncios,
}: {
  passagens: Passagem[]
  nomesDosAnuncios: Map<string, AnuncioEmCache>
}) {
  if (passagens.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-[12px] leading-5 text-dim">
        Esta pessoa não chegou por anúncio, ou chegou antes de o sistema passar a registrar isso.
      </p>
    )
  }

  const linhas = passagensComNome(passagens, nomesDosAnuncios)

  return (
    <ol className="flex flex-col gap-0">
      {linhas.map((linha, indice) => (
        <li
          key={`${linha.adId}-${linha.criadoEm}`}
          className="flex gap-2.5 border-l border-line pb-4 pl-4 last:pb-0"
        >
          <span className="mt-[6px] -ml-[21px] size-[7px] shrink-0 rounded-full bg-primary/60 ring-2 ring-panel" />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] leading-5 font-semibold">{linha.texto}</span>
            {linha.detalhe && (
              <span className="block truncate text-[11.5px] text-muted">{linha.detalhe}</span>
            )}
            <span className="text-[11px] text-dim" title={horaExata(linha.criadoEm)}>
              {quando(linha.criadoEm)}
              {/* A primeira da lista é a mais recente, dizer qual foi a que
                  trouxe a pessoa evita ler a ordem ao contrário. */}
              {indice === linhas.length - 1 && ' · foi por aqui que ela chegou'}
            </span>
          </span>
        </li>
      ))}
    </ol>
  )
}
