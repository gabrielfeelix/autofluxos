/**
 * O cookie da barra lateral recolhida, fora de `tema.tsx` porque aquele módulo
 * é de cliente e o servidor também precisa ler este nome (`barraRecolhida`).
 * O porquê de cookie, e não `localStorage`, está em `PREFERENCIAS`.
 */
export const COOKIE_DA_BARRA = 'autofluxos-barra'
export const BARRA_RECOLHIDA = 'recolhida'
