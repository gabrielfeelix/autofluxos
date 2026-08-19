'use server'

/**
 * Sobrou o vazio: as ações da senha única do time moravam aqui.
 *
 * `acaoEntrar` conferia `PAINEL_SENHA` e assinava um cookie próprio;
 * `acaoSair` apagava esse cookie. As duas saíram junto com a rota `/login` —
 * hoje entrar e sair é trabalho do Better Auth, em `acoes-conta.ts`.
 *
 * O arquivo fica como marco: quem procurar `acaoEntrar` no histórico chega aqui
 * e descobre para onde ela foi, em vez de achar que o login sumiu.
 */
export {}
