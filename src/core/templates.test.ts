import { describe, expect, it } from 'vitest'
import {
  BOTOES_SEGUROS_NO_DESKTOP,
  condutaPara,
  explicarErro,
  lerStatusDeEnvio,
  LIMITE_BODY,
  LIMITE_FOOTER,
  normalizarNome,
  nomeValido,
  numeracaoContinua,
  podeEnviar,
  temErro,
  validarTemplate,
  variaveisDe,
  type Componentes,
} from './templates'

const CORPO_OK: Componentes = { corpo: 'Oi {{1}}, sua consulta é amanhã às {{2}}.' }

describe('podeEnviar', () => {
  it('só aprovado entrega', () => {
    expect(podeEnviar('aprovado')).toBe(true)
  })

  /**
   * O caso que engana: **pausado não é "quase aprovado".**
   *
   * A Meta despausa sozinha em 3h ou 6h, então parece temporário e inofensivo.
   * Mas enquanto está pausado todo envio falha — e uma transmissão de 2.000
   * pessoas disparada nesse estado vira 2.000 erros.
   */
  it('pausado não entrega, por mais temporário que pareça', () => {
    expect(podeEnviar('pausado')).toBe(false)
  })

  it('rascunho, pendente, recusado e desativado também não', () => {
    expect(podeEnviar('rascunho')).toBe(false)
    expect(podeEnviar('pendente')).toBe(false)
    expect(podeEnviar('recusado')).toBe(false)
    expect(podeEnviar('desativado')).toBe(false)
  })
})

describe('normalizarNome', () => {
  it('tira acento, maiúscula e espaço', () => {
    expect(normalizarNome('Lembrete de Consulta')).toBe('lembrete_de_consulta')
  })

  it('cedilha e til viram letra simples', () => {
    expect(normalizarNome('Confirmação de Inscrição')).toBe('confirmacao_de_inscricao')
  })

  it('não deixa underscore sobrando na borda', () => {
    expect(normalizarNome('  !!oi!!  ')).toBe('oi')
  })

  it('o que sai de normalizarNome sempre passa em nomeValido', () => {
    for (const bruto of ['Olá, tudo bem?', 'PROMOÇÃO 50%', 'a', 'çãé']) {
      const nome = normalizarNome(bruto)
      if (nome) expect(nomeValido(nome)).toBe(true)
    }
  })
})

describe('variaveisDe', () => {
  it('acha na ordem e sem repetir', () => {
    expect(variaveisDe('{{2}} e {{1}} e {{2}} de novo')).toEqual([1, 2])
  })

  it('texto sem variável devolve lista vazia', () => {
    expect(variaveisDe('mensagem fixa')).toEqual([])
  })
})

describe('numeracaoContinua', () => {
  it('1,2,3 passa', () => {
    expect(numeracaoContinua([1, 2, 3])).toBe(true)
  })

  /**
   * `{{1}} {{3}}` é recusa da Meta: o envio manda um array e a **posição** é o
   * que liga valor e lacuna. Com buraco, o valor 2 iria para a lacuna 3.
   */
  it('pular número não passa', () => {
    expect(numeracaoContinua([1, 3])).toBe(false)
  })

  it('começar em 2 não passa', () => {
    expect(numeracaoContinua([2, 3])).toBe(false)
  })
})

describe('validarTemplate', () => {
  it('template simples e correto não gera reparo', () => {
    expect(validarTemplate('lembrete', CORPO_OK, 'UTILITY')).toEqual([])
  })

  it('corpo vazio é erro', () => {
    const reparos = validarTemplate('x', { corpo: '   ' }, 'UTILITY')
    expect(temErro(reparos)).toBe(true)
    expect(reparos.some((r) => r.campo === 'corpo')).toBe(true)
  })

  it('corpo acima do limite é erro', () => {
    const reparos = validarTemplate('x', { corpo: 'a'.repeat(LIMITE_BODY + 1) }, 'UTILITY')
    expect(temErro(reparos)).toBe(true)
  })

  it('nome com acento é erro', () => {
    const reparos = validarTemplate('lembrete_de_consulta_ç', CORPO_OK, 'UTILITY')
    expect(reparos.some((r) => r.campo === 'nome' && r.gravidade === 'erro')).toBe(true)
  })

  it('numeração com buraco é erro, e o recado mostra o que achou', () => {
    const reparos = validarTemplate('x', { corpo: 'Oi {{1}}, veja {{3}}' }, 'UTILITY')
    expect(temErro(reparos)).toBe(true)
    expect(reparos.find((r) => r.campo === 'corpo')?.recado).toContain('{{3}}')
  })

  it('rodapé com variável é erro', () => {
    const reparos = validarTemplate('x', { ...CORPO_OK, rodape: 'de {{1}}' }, 'UTILITY')
    expect(reparos.some((r) => r.campo === 'rodape' && r.gravidade === 'erro')).toBe(true)
  })

  it('rodapé longo demais é erro', () => {
    const reparos = validarTemplate('x', { ...CORPO_OK, rodape: 'a'.repeat(LIMITE_FOOTER + 1) }, 'UTILITY')
    expect(reparos.some((r) => r.campo === 'rodape')).toBe(true)
  })

  it('cabeçalho com duas variáveis é erro', () => {
    const reparos = validarTemplate(
      'x',
      { ...CORPO_OK, cabecalho: { tipo: 'texto', texto: '{{1}} e {{2}}' } },
      'UTILITY',
    )
    expect(reparos.some((r) => r.campo === 'cabecalho' && r.gravidade === 'erro')).toBe(true)
  })

  /**
   * **Aviso, não erro** — e a distinção é a regra do arquivo inteiro.
   *
   * Quatro botões são aprovados pela Meta e funcionam no celular. Só somem no
   * WhatsApp Desktop. Recusar seria inventar regra que a Meta não tem, e passar
   * por cima de quem só atende por celular.
   */
  it('quatro botões avisa, mas não impede', () => {
    const reparos = validarTemplate(
      'x',
      {
        ...CORPO_OK,
        botoes: Array.from({ length: BOTOES_SEGUROS_NO_DESKTOP + 1 }, (_, i) => ({
          tipo: 'QUICK_REPLY' as const,
          texto: `op${i}`,
        })),
      },
      'MARKETING',
    )
    expect(temErro(reparos)).toBe(false)
    expect(reparos.some((r) => r.gravidade === 'aviso' && r.campo === 'botoes')).toBe(true)
  })

  it('misturar resposta rápida com link também avisa', () => {
    const reparos = validarTemplate(
      'x',
      {
        ...CORPO_OK,
        botoes: [
          { tipo: 'QUICK_REPLY', texto: 'Sim' },
          { tipo: 'URL', texto: 'Site', valor: 'https://4yu.com.br' },
        ],
      },
      'MARKETING',
    )
    expect(temErro(reparos)).toBe(false)
    expect(reparos.some((r) => r.gravidade === 'aviso')).toBe(true)
  })

  it('dois botões de telefone é erro, porque a Meta aceita um', () => {
    const reparos = validarTemplate(
      'x',
      {
        ...CORPO_OK,
        botoes: [
          { tipo: 'PHONE_NUMBER', texto: 'Ligar', valor: '+5511999999999' },
          { tipo: 'PHONE_NUMBER', texto: 'Ligar 2', valor: '+5511888888888' },
        ],
      },
      'UTILITY',
    )
    expect(temErro(reparos)).toBe(true)
  })

  it('autenticação só aceita botão de copiar código', () => {
    const reparos = validarTemplate(
      'codigo',
      { corpo: 'Seu código é {{1}}', botoes: [{ tipo: 'QUICK_REPLY', texto: 'ok' }] },
      'AUTHENTICATION',
    )
    expect(temErro(reparos)).toBe(true)
  })

  it('variável na borda avisa', () => {
    const reparos = validarTemplate('x', { corpo: '{{1}}, bom dia' }, 'UTILITY')
    expect(temErro(reparos)).toBe(false)
    expect(reparos.some((r) => r.gravidade === 'aviso')).toBe(true)
  })
})

describe('lerStatusDeEnvio', () => {
  it('accepted é aceita', () => {
    expect(lerStatusDeEnvio('accepted')).toBe('aceita')
  })

  /**
   * **O teste que justifica o estado existir.**
   *
   * `held_for_quality_assessment` vem junto de um HTTP 200. Quem trata 200 como
   * sucesso mostra "campanha enviada" para o cliente — e a mensagem pode ser
   * descartada depois, chegando como `failed 132015`. `retida` nunca pode
   * colapsar em `aceita`.
   */
  it('held_for_quality_assessment é retida, não aceita', () => {
    expect(lerStatusDeEnvio('held_for_quality_assessment')).toBe('retida')
  })

  it('paused já nasce falha', () => {
    expect(lerStatusDeEnvio('paused')).toBe('falhou')
  })

  it('ausente é aceita — a Meta nem sempre manda o campo', () => {
    expect(lerStatusDeEnvio(undefined)).toBe('aceita')
  })
})

describe('condutaPara', () => {
  it('rate limit e manutenção se repete', () => {
    expect(condutaPara(130429)).toBe('repetir')
    expect(condutaPara(80007)).toBe('repetir')
    expect(condutaPara(131057)).toBe('repetir')
  })

  /**
   * 131026 é terminal **de propósito**: a Meta não diz se é número inexistente,
   * bloqueio ou país restrito, por privacidade. Do nosso lado a ação é a mesma,
   * e repetir queima a nota de qualidade sem chance de sucesso.
   */
  it('131026 é desistir, não repetir', () => {
    expect(condutaPara(131026)).toBe('desistir')
  })

  /**
   * O erro mais perigoso de tratar errado: repetir antes de 24h **suspende o
   * destinatário por mais 24h**. A tentativa extra piora o resultado.
   */
  it('131049 espera 24h', () => {
    expect(condutaPara(131049)).toBe('esperar_24h')
  })

  it('erro de payload é bug nosso, não retry', () => {
    expect(condutaPara(132000)).toBe('corrigir_codigo')
    expect(condutaPara(132012)).toBe('corrigir_codigo')
  })

  it('132015 mata o template inteiro', () => {
    expect(condutaPara(132015)).toBe('template_pausado')
  })

  /**
   * Código novo da Meta não pode derrubar uma campanha inteira em silêncio.
   * Repetir uma vez é o erro mais barato dos dois.
   */
  it('código desconhecido tenta de novo', () => {
    expect(condutaPara(999999)).toBe('repetir')
  })
})

describe('explicarErro', () => {
  it('fala português, sem número entre parênteses', () => {
    expect(explicarErro(131026)).toContain('não recebe')
  })

  it('código desconhecido ainda diz qual foi', () => {
    expect(explicarErro(4242)).toContain('4242')
  })
})
