/**
 * base64url → bytes, que é o formato em que o `PushManager` exige a chave.
 *
 * O VAPID é publicado em base64url — alfabeto com `-` e `_` no lugar de `+` e
 * `/`, e sem o `=` do fim. Passar a string crua para `applicationServerKey`
 * falha com um erro que não diz o que está errado, e passar base64 comum
 * produz bytes silenciosamente diferentes: a assinatura simplesmente não
 * confere e nenhum push chega, sem erro em lugar nenhum.
 *
 * Mora no `core` para poder ser testado sem navegador — é a única parte de
 * `components/inbox/assinar-push.ts` que erra em silêncio.
 */
export function base64urlParaBytes(
  base64url: string,
  decodificar: (texto: string) => string,
): Uint8Array<ArrayBuffer> {
  const preenchida = base64url.padEnd(
    base64url.length + ((4 - (base64url.length % 4)) % 4),
    '=',
  )
  const bruto = decodificar(preenchida.replace(/-/g, '+').replace(/_/g, '/'))
  // O buffer é fixado em `ArrayBuffer` porque `applicationServerKey` não
  // aceita o `SharedArrayBuffer` que o `Uint8Array` genérico admite.
  const bytes = new Uint8Array(new ArrayBuffer(bruto.length))
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i)
  return bytes
}
