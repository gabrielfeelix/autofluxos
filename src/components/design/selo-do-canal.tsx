/**
 * Por onde esta automação fala.
 *
 * **Hoje a resposta é uma só: WhatsApp.** Não existe fluxo de Telegram nem de
 * Instagram para distinguir — o produto inteiro fala Cloud API, e as regras que
 * o editor cobra são regras da Meta: no máximo 3 botões, 10 itens de lista, 20
 * caracteres de rótulo, 4096 de texto, janela de 24 horas. Um desenho feito aqui
 * não é "quase" de outro canal: ele é dessas medidas.
 *
 * Então por que um selo, se só há um canal? Porque **"óbvio para quem construiu"
 * não é óbvio para quem abre a tela**, e a pergunta apareceu na primeira vez que
 * alguém de fora olhou. O selo responde sem custo e, no dia em que existir um
 * segundo canal, o lugar de dizê-lo já existe — em vez de a resposta ficar
 * espalhada por dez telas de uma vez.
 *
 * O que **não** foi feito, e de propósito: pintar a tela de verde-WhatsApp. Cor
 * é a coisa mais cara de desfazer numa interface, e ela só valeria como
 * distinção se houvesse do que distinguir. Com um canal só, "tudo verde" não
 * informa nada — vira só a identidade de outra empresa dentro da nossa.
 */
export function SeloDoCanal({ compacto = false }: { compacto?: boolean }) {
  return (
    <span
      title="Esta automação atende no WhatsApp. Os limites do editor (3 botões, 10 itens de lista, janela de 24h) são os da Cloud API da Meta."
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#25D366]/25 bg-[#25D366]/[0.09] text-[#5be49b] ${
        compacto ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
      }`}
    >
      <LogoDoWhatsApp />
      WhatsApp
    </span>
  )
}

/**
 * O logo em SVG inline, e não um `<img>`.
 *
 * Ele acompanha a cor do texto (`currentColor`), não pede uma requisição a mais
 * e não some quando alguém mexer na pasta de assets — para um glifo de 12px é
 * tudo que importa.
 */
function LogoDoWhatsApp() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-3 fill-current">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23a8.23 8.23 0 0 1 8.24 8.24c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.13-1.47-.72-1.69-.8-.23-.09-.39-.13-.56.12-.16.25-.64.8-.79.97-.14.16-.29.19-.54.06-.25-.12-1.05-.38-1.99-1.23-.74-.65-1.24-1.46-1.38-1.71-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.44.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.85-.2-.48-.4-.42-.56-.43h-.47c-.16 0-.42.06-.64.31-.22.25-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.02.4 1.37.51.58.18 1.1.16 1.52.1.46-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.29Z" />
    </svg>
  )
}
