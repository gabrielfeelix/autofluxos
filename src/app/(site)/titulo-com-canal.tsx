import { GLIFO_INSTAGRAM, GLIFO_META, GLIFO_TELEGRAM, GLIFO_WHATSAPP } from '@/components/design/glifos-oficiais'

/*
 * O título de uma janela ou linha que começa pelo nome de um canal ("WhatsApp ·
 * Marina Costa") ganha a logo oficial na frente: quem olha reconhece o canal
 * antes de ler (pedido do Gabriel, 29/out). Sem canal no começo, só o texto.
 */
const CANAIS = [
  { nome: 'WhatsApp', glifo: GLIFO_WHATSAPP, cor: '#25d366' },
  { nome: 'Instagram', glifo: GLIFO_INSTAGRAM, cor: '#e4405f' },
  { nome: 'Telegram', glifo: GLIFO_TELEGRAM, cor: '#26a5e4' },
  { nome: 'Meta', glifo: GLIFO_META, cor: '#0866ff' },
]

export function TituloComCanal({ texto, tamanho = 13 }: { texto: string; tamanho?: number }) {
  const canal = CANAIS.find((c) => texto.startsWith(c.nome))
  if (!canal) return <>{texto}</>
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill={canal.cor} aria-hidden style={{ flex: 'none' }}>
        <path d={canal.glifo} />
      </svg>
      {texto}
    </span>
  )
}
