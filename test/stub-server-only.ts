/**
 * Substitui o pacote `server-only` durante os testes.
 *
 * Aquele pacote existe para o build quebrar se um módulo de servidor for
 * importado por um componente de cliente. Fora do Next não há essa distinção,
 * e o pacote lança erro só de ser carregado — então nos testes ele vira isto:
 * nada. A proteção continua valendo onde importa, que é no `next build`.
 */
export {}
