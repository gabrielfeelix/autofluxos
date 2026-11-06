/**
 * Resposta dos arquivos para agentes (`/llms.txt`, `/precos.md`...): UTF-8
 * declarado, senão o "ç" vira lixo em cliente que assume Latin-1, e cache de
 * uma hora na borda, porque o conteúdo só muda com deploy.
 */
export function respostaEmTexto(corpo: string, tipo: 'text/plain' | 'text/markdown') {
  return new Response(corpo, {
    headers: {
      'Content-Type': `${tipo}; charset=utf-8`,
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}
