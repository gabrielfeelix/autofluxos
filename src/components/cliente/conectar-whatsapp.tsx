'use client'

import Script from 'next/script'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { LogoDoCanal } from '@/components/design/selo-do-canal'

/**
 * O botão que abre o Embedded Signup **pelo SDK do JavaScript**.
 *
 * ---------------------------------------------------------------------------
 * Por que SDK, e não o link hospedado que estava aqui antes
 * ---------------------------------------------------------------------------
 *
 * O hospedado é mais simples e **não serve**. A doc da Meta: *"Hosted Embedded
 * Signup can only be used to onboard business customers to Cloud API, and the
 * flow cannot be customized."* Sem customização não há como pedir coexistência,
 * e o cliente perderia o WhatsApp do celular, o oposto do que a tela promete.
 *
 * O hospedado também não devolve ninguém: ele não tem redirect de volta, e foi
 * isso que fez duas conexões reais terminarem com o cliente vendo "pronto" na
 * tela da Meta e o nosso banco vazio, em 13/set/2026.
 *
 * Aqui o `code` chega **em JavaScript**, na própria página, e vai para
 * `/api/whatsapp/concluir` pela nossa origem, com o cookie de sessão junto,
 * que é o que dispensa o `state` assinado do outro fluxo.
 *
 * ---------------------------------------------------------------------------
 * Duas respostas, e as duas são necessárias
 * ---------------------------------------------------------------------------
 *
 * 1. **O callback do `FB.login`** traz o `code`, e só ele. Vive **30
 *    segundos**, então é trocado no servidor imediatamente.
 * 2. **O `message` do session logging** traz `phone_number_id` e `waba_id`. Sem
 *    o número não há o que gravar, e o callback não o carrega.
 *
 * Elas chegam em **ordem imprevisível**, e é por isso que o envio só acontece
 * quando as duas estão na mão (`tentarConcluir`). Mandar na primeira que
 * chegar é o erro clássico aqui: metade das vezes falta o número, metade das
 * vezes falta o código, e o sintoma parece intermitência de rede.
 */

declare global {
  interface Window {
    FB?: {
      init: (opcoes: Record<string, unknown>) => void
      login: (cb: (r: RespostaDoLogin) => void, opcoes: Record<string, unknown>) => void
    }
  }
}

type RespostaDoLogin = { authResponse?: { code?: string } | null }

export function ConectarWhatsapp({
  clienteId,
  appId,
  configId,
  rotulo = 'Conectar meu WhatsApp',
}: {
  clienteId: string
  appId: string
  configId: string
  /** "Reconectar" no cartão de um número que caiu (tarefa 6.6). */
  rotulo?: string
}) {
  const router = useRouter()
  const [estado, setEstado] = useState<'parado' | 'abrindo' | 'concluindo' | 'erro'>('parado')
  const [erro, setErro] = useState<string | null>(null)
  const [pronto, setPronto] = useState(false)

  // `ref` e não `state`: as duas metades chegam por callbacks que não devem
  // reagir a re-render, e um `state` aqui traria valor velho para dentro deles.
  const codigo = useRef<string | null>(null)
  const numero = useRef<{ phoneNumberId?: string; wabaId?: string }>({})

  const concluir = useCallback(async () => {
    setEstado('concluindo')
    try {
      const resposta = await fetch('/api/whatsapp/concluir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId,
          code: codigo.current,
          phoneNumberId: numero.current.phoneNumberId,
          wabaId: numero.current.wabaId,
        }),
      })

      if (!resposta.ok) {
        const corpo = (await resposta.json().catch(() => ({}))) as { erro?: string }
        setErro(corpo.erro ?? 'não deu para concluir a conexão')
        setEstado('erro')
        return
      }

      // A tela lê o canal do servidor; `refresh` a repinta sem perder o lugar.
      router.refresh()
    } catch {
      setErro('não deu para falar com o servidor; tente de novo')
      setEstado('erro')
    }
  }, [clienteId, router])

  /** Só quando as duas metades chegaram. Ver o cabeçalho. */
  const tentarConcluir = useCallback(() => {
    if (codigo.current && numero.current.phoneNumberId) void concluir()
  }, [concluir])

  useEffect(() => {
    function aoReceber(evento: MessageEvent) {
      // A origem é conferida **antes** de olhar o conteúdo: esta janela recebe
      // `message` de qualquer um, e confiar no corpo sem saber quem mandou é
      // aceitar dado de terceiro como se fosse da Meta.
      if (!evento.origin.endsWith('facebook.com')) return

      /*
       * **`event.data` nem sempre é string, e presumir que é custou uma
       * conexão real.**
       *
       * A primeira escrita fazia `JSON.parse(evento.data)` direto dentro de um
       * `try` com `catch` vazio. Quando o Facebook manda o payload já como
       * **objeto**, e ele manda , o `parse` estoura, o `catch` engole, e o
       * `phone_number_id` é descartado em silêncio. Sem o número,
       * `tentarConcluir` nunca dispara: o cliente vê "Concluir" na tela da
       * Meta, tudo parece ter dado certo, e o nosso banco não recebe nada.
       *
       * Nem alerta sobrava para investigar, porque a rota do servidor jamais
       * chegava a ser chamada.
       */
      let dado: {
        type?: string
        event?: string
        data?: { phone_number_id?: string; waba_id?: string }
      }

      if (typeof evento.data === 'string') {
        try {
          dado = JSON.parse(evento.data)
        } catch {
          return // `message` que não é JSON. O Facebook manda vários.
        }
      } else if (evento.data && typeof evento.data === 'object') {
        dado = evento.data as typeof dado
      } else {
        return
      }

      if (dado.type !== 'WA_EMBEDDED_SIGNUP') return

      if (dado.data?.phone_number_id) {
        numero.current = {
          phoneNumberId: dado.data.phone_number_id,
          wabaId: dado.data.waba_id,
        }
        tentarConcluir()
      }

      // A pessoa fechou a janela no meio. Não é erro, é desistência.
      if (dado.event === 'CANCEL' && !codigo.current) setEstado('parado')
    }

    window.addEventListener('message', aoReceber)
    return () => window.removeEventListener('message', aoReceber)
  }, [tentarConcluir])

  function abrir() {
    if (!window.FB) {
      setErro('o SDK do Facebook não carregou; recarregue a página')
      setEstado('erro')
      return
    }

    setErro(null)
    setEstado('abrindo')
    codigo.current = null
    numero.current = {}

    window.FB.login(
      (resposta: RespostaDoLogin) => {
        const recebido = resposta.authResponse?.code
        if (!recebido) {
          // Sem `authResponse` = a pessoa cancelou ou negou. Voltar ao início
          // sem mensagem de erro: não há o que investigar numa decisão dela.
          setEstado('parado')
          return
        }
        codigo.current = recebido
        tentarConcluir()

        /*
         * **Se o número não chegar, manda mesmo assim depois de um instante.**
         *
         * O `code` vive 30 segundos, e ficar esperando um `message` que pode
         * não vir gasta essa janela calado, foi o que aconteceu na primeira
         * conexão real. Mandando, o servidor grava o que dá e **alerta** com o
         * que falta, que é infinitamente melhor que silêncio: alguém consegue
         * terminar à mão dentro das 24h.
         */
        setTimeout(() => {
          if (codigo.current && !numero.current.phoneNumberId) void concluir()
        }, 2500)
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        /*
         * **`featureType` continua sendo código, mesmo em v4.**
         *
         * A página de *Versions* da Meta diz que o `extras` de v4 é
         * "purposely empty", e ler só ela leva a tirar o `featureType` daqui ,
         * que foi o que aconteceu na primeira escrita deste arquivo. A doc de
         * Coexistence e os guias de quem implementou dizem o contrário, e é o
         * contrário que vale: **sem esta linha o cliente nunca vê a tela de
         * conectar a conta existente**, e o fluxo cai no onboarding comum, que
         * tira o WhatsApp do celular dele.
         *
         * A configuração do Facebook Login (o `config_id`) habilita; o
         * `featureType` pede. As duas coisas, não uma ou outra.
         *
         * Nascer em v4 não é preferência: o v2 morre em 15/out/2026.
         */
        /*
         * **São três campos, e faltava um.**
         *
         * O exemplo da doc de Coexistence traz `sessionInfoVersion: "3"` junto
         * do `featureType`, e nós tínhamos só o `featureType`. A v4 funciona
         * sem ele em fluxo comum, mas é o session logging que entrega o
         * `phone_number_id` pelo `message`, e a própria lista de requisitos da
         * Meta exige *"using Embedded Signup with session logging"*.
         *
         * Sem declarar a versão, o payload chega noutro formato, ou não chega.
         * Foi exatamente o sintoma de 13/set: cliente terminando o fluxo e o
         * número nunca aparecendo no navegador.
         */
        extras: {
          setup: {},
          featureType: 'whatsapp_business_app_onboarding',
          sessionInfoVersion: '3',
        },
      },
    )
  }

  return (
    <>
      <Script
        src="https://connect.facebook.net/pt_BR/sdk.js"
        strategy="afterInteractive"
        onLoad={() => {
          window.FB?.init({
            appId,
            autoLogAppEvents: true,
            xfbml: true,
            version: 'v25.0',
          })
          setPronto(true)
        }}
      />

      <button
        type="button"
        onClick={abrir}
        disabled={!pronto || estado === 'abrindo' || estado === 'concluindo'}
        style={{ backgroundColor: '#25D366' }}
        className="inline-flex items-center gap-2 rounded-[9px] px-[18px] py-3 text-[13.5px] font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <LogoDoCanal canal="whatsapp" tamanho={17} />
        {estado === 'concluindo'
          ? 'Conectando…'
          : estado === 'abrindo'
            ? 'Siga na janela da Meta…'
            : pronto
              ? rotulo
              : 'Carregando…'}
      </button>

      {erro && (
        <p role="alert" className="mt-3 text-[12px] leading-5 text-perigo">
          {erro}
        </p>
      )}
    </>
  )
}
