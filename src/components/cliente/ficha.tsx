'use client'

import { useState } from 'react'
import { FormularioSalvar, type EstadoSalvar } from '@/components/design/formulario-salvar'
import { LogoDoCliente } from '@/components/design/logo-cliente'
import type { Cliente } from '@/server/repos/clientes'

/**
 * A ficha do cliente: lê fechada, edita quando pedem.
 *
 * Nasceu aberta, com os cinco campos preenchíveis o tempo todo, e estava
 * errado: a tela é visitada muitas vezes para **olhar** — quem é o responsável,
 * qual o telefone — e uma vez para mudar. Formulário aberto por padrão dá o
 * peso da edição a quem só queria conferir, e ainda convida a alterar sem
 * querer um campo enquanto se rola a página.
 *
 * Fechada ela é o que a maioria das visitas precisa: o dado, legível. A edição
 * fica a um clique, que é o custo justo para a minoria das visitas.
 */
export function FichaDoCliente({
  cliente,
  salvarCadastro,
  salvarLogo,
  removerLogo,
}: {
  cliente: Cliente
  salvarCadastro: (estado: EstadoSalvar, formData: FormData) => Promise<EstadoSalvar>
  salvarLogo: (estado: EstadoSalvar, formData: FormData) => Promise<EstadoSalvar>
  removerLogo: () => Promise<void>
}) {
  const [editando, setEditando] = useState(false)

  return (
    <section className="app-card overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-6 py-4">
        <div>
          <h2 className="text-[14.5px] font-bold">Cadastro</h2>
          <p className="mt-0.5 text-[12px] text-dim">
            Quem é este cliente e como falar com ele. É a nossa ficha — nada daqui vai para o
            WhatsApp.
          </p>
        </div>
        <button
          onClick={() => setEditando((antes) => !antes)}
          className="shrink-0 rounded-lg border border-white/[0.1] px-3 py-1.5 text-[12px] font-bold text-soft transition hover:border-white/20 hover:bg-white/[0.05]"
        >
          {editando ? 'Cancelar' : 'Editar'}
        </button>
      </header>

      {editando ? (
        <div className="p-6">
          <Logo cliente={cliente} salvarLogo={salvarLogo} removerLogo={removerLogo} />

          <FormularioSalvar action={salvarCadastro} rotulo="Salvar cadastro">
            <div className="grid grid-cols-2 gap-4">
              <Campo rotulo="Nome do cliente" nome="nome" valor={cliente.nome} obrigatorio />
              <Campo
                rotulo="Quem responde"
                nome="responsavel"
                valor={cliente.responsavel}
                dica="a pessoa com quem a gente fala"
                exemplo="ex.: Daniel, dono do estúdio"
              />
              <Campo
                rotulo="Telefone"
                nome="telefone"
                valor={cliente.telefone}
                tipo="tel"
                dica="o contato dessa pessoa, não o número que o bot atende"
                exemplo="(11) 99999-0000"
              />
              <Campo
                rotulo="E-mail"
                nome="email"
                valor={cliente.email}
                tipo="email"
                exemplo="nome@empresa.com.br"
              />
              <Campo
                rotulo="CNPJ"
                nome="cnpj"
                valor={cliente.cnpj}
                dica="para emitir nota"
                exemplo="00.000.000/0001-00"
              />
            </div>

            <label className="mt-5 block">
              <Rotulo>Observações</Rotulo>
              <textarea
                name="observacoes"
                rows={4}
                defaultValue={cliente.observacoes}
                placeholder="Escopo combinado, prazo, o que já foi cobrado."
                className="app-field resize-y px-3.5 py-3 text-[13px] leading-6"
              />
            </label>
          </FormularioSalvar>
        </div>
      ) : (
        <div className="flex items-start gap-6 p-6">
          <LogoDoCliente cliente={cliente} tamanho={72} />
          <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-4">
            <Leitura rotulo="Quem responde" valor={cliente.responsavel} />
            <Leitura rotulo="Telefone" valor={cliente.telefone} />
            <Leitura rotulo="E-mail" valor={cliente.email} />
            <Leitura rotulo="CNPJ" valor={cliente.cnpj} />
            <Leitura rotulo="Observações" valor={cliente.observacoes} largo />
          </dl>
        </div>
      )}
    </section>
  )
}

function Logo({
  cliente,
  salvarLogo,
  removerLogo,
}: {
  cliente: Cliente
  salvarLogo: (estado: EstadoSalvar, formData: FormData) => Promise<EstadoSalvar>
  removerLogo: () => Promise<void>
}) {
  return (
    <div className="mb-6 flex items-center gap-5 border-b border-white/[0.06] pb-6">
      <LogoDoCliente cliente={cliente} tamanho={72} />
      <div className="min-w-0 flex-1">
        <FormularioSalvar action={salvarLogo} rotulo="Enviar logo">
          <Rotulo>Logo</Rotulo>
          <input
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="block w-full text-[12px] text-muted file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-white/[0.12] file:bg-white/[0.05] file:px-3 file:py-1.5 file:text-[12px] file:font-bold file:text-soft hover:file:bg-white/[0.09]"
          />
          <p className="mt-1.5 text-[11px] text-dim">PNG, JPG ou WebP, até 512 KB.</p>
        </FormularioSalvar>
      </div>
      {cliente.logoUrl && (
        <form action={removerLogo}>
          <button className="shrink-0 rounded-lg border border-white/[0.1] px-3 py-1.5 text-[12px] font-semibold text-dim transition hover:border-rose-400/30 hover:text-rose-300">
            Tirar logo
          </button>
        </form>
      )}
    </div>
  )
}

function Leitura({ rotulo, valor, largo }: { rotulo: string; valor: string; largo?: boolean }) {
  return (
    <div className={largo ? 'col-span-2' : ''}>
      <dt className="text-[11px] font-bold tracking-[0.05em] text-muted uppercase">{rotulo}</dt>
      <dd className={`mt-1 text-[13px] leading-6 ${valor.trim() === '' ? 'text-dim' : 'text-soft'}`}>
        {valor.trim() === '' ? 'não preenchido' : valor}
      </dd>
    </div>
  )
}

function Campo({
  rotulo,
  nome,
  valor,
  tipo = 'text',
  dica,
  exemplo,
  obrigatorio,
}: {
  rotulo: string
  nome: string
  valor: string
  tipo?: string
  dica?: string
  exemplo?: string
  obrigatorio?: boolean
}) {
  return (
    <label className="block">
      <Rotulo>{rotulo}</Rotulo>
      <input
        name={nome}
        type={tipo}
        required={obrigatorio}
        defaultValue={valor}
        placeholder={exemplo}
        className="app-field px-3.5 py-2.5 text-[13px]"
      />
      {/* A dica vem depois do campo: dois campos lado a lado em que só um tem
          dica ficavam com os inputs em alturas diferentes. */}
      {dica && <span className="mt-1.5 block text-[11px] text-dim">{dica}</span>}
    </label>
  )
}

function Rotulo({ children }: { children: string }) {
  return (
    <span className="mb-1.5 block text-[11px] font-bold tracking-[0.05em] text-muted uppercase">
      {children}
    </span>
  )
}
