/**
 * O gênero provável de um primeiro nome brasileiro, para o retrato ilustrado
 * de quem usa o sistema (`lib/retrato.ts`).
 *
 * É palpite, e só serve para isso: escolher cabelo e barba de um desenho. Nada
 * de regra de negócio, texto ou permissão pode depender daqui. Errar custa um
 * desenho trocado, que some no dia em que a pessoa sobe a foto dela.
 *
 * A regra é a do português: nome terminado em "a" é feminino, o resto é
 * masculino. As duas listas corrigem o que a regra erra entre os nomes comuns.
 */
export type GeneroDoNome = 'feminino' | 'masculino'

const FEMININOS = new Set([
  'adriele', 'agnes', 'alice', 'aline', 'beatriz', 'carmen', 'caroline', 'cristiane', 'daniele',
  'danielle', 'deborah', 'dulce', 'edith', 'eliane', 'ellen', 'emily', 'emilly', 'ester', 'evelyn',
  'gabrielle', 'gisele', 'helen', 'ines', 'ingrid', 'irene', 'iris', 'isabel', 'isis', 'ivone',
  'jacqueline', 'jaqueline', 'jasmin', 'judite', 'karoline', 'kelly', 'lais', 'liz', 'lis',
  'lurdes', 'maite', 'marlene', 'mel', 'mercedes', 'michele', 'michelle', 'miriam', 'monique',
  'nathalie', 'natalie', 'nicole', 'rachel', 'raquel', 'rose', 'ruth', 'rute', 'sarah',
  'simone', 'sophie', 'suelen', 'tais', 'thais', 'yasmin',
])

const MASCULINOS = new Set(['joshua', 'jonatha', 'luca', 'lucca', 'nikita', 'batista'])

export function generoDoNome(nome: string): GeneroDoNome {
  const primeiro = (nome.trim().split(/\s+/)[0] ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
  if (FEMININOS.has(primeiro)) return 'feminino'
  if (MASCULINOS.has(primeiro)) return 'masculino'
  return primeiro.endsWith('a') ? 'feminino' : 'masculino'
}
