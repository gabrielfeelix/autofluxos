'use client'

import { useRef } from 'react'
import { Dica } from '@/components/design/dica'
import { IconeClipe } from '@/components/lead/icones-da-barra'
import { BOTAO_DA_BARRA } from '@/components/lead/botao-da-barra'
import { TIPOS_ACEITOS, useEntrega } from '@/components/lead/entrega-de-arquivos'

/**
 * O clipe de anexar, na caixa de resposta.
 *
 * ---------------------------------------------------------------------------
 * Ele só escolhe: quem revisa e envia é a área da conversa
 * ---------------------------------------------------------------------------
 *
 * O clipe já teve dentro de si o diálogo de revisão inteiro, prévia, legenda,
 * upload e envio. O problema não era o tamanho: era haver **dois caminhos** para
 * a mesma coisa assim que arrastar um arquivo para dentro da conversa passou a
 * funcionar. Dois caminhos viram duas regras de legenda, dois limites e dois
 * jeitos de errar.
 *
 * Agora o clipe entrega os arquivos ao `ProvedorDeEntrega` e sai de cena. Quem
 * desenha a revisão, cuida do `blob:`, soma mais um e envia em fila é ele ,
 * exatamente o mesmo painel que abre ao soltar o arquivo na conversa.
 *
 * `multiple` porque a revisão aceita vários: escolher cinco fotos numa vez é o
 * gesto normal de quem manda tabela de preço.
 */
export function BotaoDeAnexo({ desabilitado = false }: { desabilitado?: boolean }) {
  const entrada = useRef<HTMLInputElement>(null)
  const entrega = useEntrega()

  /*
   * Sem provedor não há onde revisar, e revisar é a única defesa contra mandar
   * o arquivo errado, que a Cloud API não deixa desfazer. Melhor não oferecer o
   * clipe do que oferecer um que envia sem mostrar.
   */
  if (!entrega) return null

  return (
    <>
      <input
        ref={entrada}
        type="file"
        hidden
        multiple
        accept={TIPOS_ACEITOS}
        onChange={(evento) => {
          // Escolher **não** envia: só abre a revisão.
          if (evento.target.files) entrega.adicionar(evento.target.files)
          // Zera o input: sem isso, escolher o **mesmo** arquivo de novo não
          // dispara `change`, e a segunda tentativa parece não ter funcionado.
          evento.target.value = ''
        }}
      />

      <Dica texto="Foto, vídeo, áudio ou PDF" lado="cima">
        <button
          type="button"
          disabled={desabilitado || entrega.ocupada}
          onClick={() => entrada.current?.click()}
          aria-label="Enviar foto, vídeo, áudio ou PDF"
          className={BOTAO_DA_BARRA}
        >
          <IconeClipe />
        </button>
      </Dica>
    </>
  )
}
