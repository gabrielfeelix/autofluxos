-- A mídia que o cliente manda passa a ter cópia nossa.
--
-- **Por que isto é urgente e não é melhoria.** O `id` de mídia que chega no
-- webhook vive 7 dias; a URL de download, 5 minutos. Os termos da Cloud API
-- (4.5) dizem que a Meta não guarda cópia e que o backup é responsabilidade
-- nossa. Até esta migration, a foto do comprovante virava
-- "(áudio, imagem ou documento)" na tela e sumia do mundo em uma semana.
-- Levantamento completo em docs/PLANO-MIDIA-RECEBIDA.md.
--
-- **Bucket novo, e privado — não dá para reusar o `autofluxos-acervo`.** A
-- 0017 o criou público por decisão consciente (a Meta precisa baixar do `link`
-- que mandamos) e escreveu a fronteira na mesma frase: "documento pessoal não
-- entra, e isso é regra de uso, não de banco". Mídia recebida é exatamente o
-- documento pessoal que aquele parágrafo exclui — RG, comprovante, exame. Num
-- bucket público isso seria URL permanente e adivinhável para dado sensível,
-- que é o que os Meta Platform Terms 6.a.i proíbem ("impedir qualquer
-- Tratamento não autorizado", com proteções "considerando a sensibilidade") e
-- o que a Resolução CD/ANPD nº 15/2024 transforma em comunicação obrigatória
-- em 3 dias úteis quando vaza.
--
-- **Sem policy de RLS, e isso é a decisão, não um esquecimento.** Bucket
-- privado sem policy nenhuma significa: `anon` e `authenticated` não leem nada,
-- nunca. O acesso é só pela `service_role`, do servidor, que assina uma URL de
-- validade curta depois de conferir que a pessoa pode ver aquela conversa.
-- Criar policy aqui seria abrir caminho de leitura direta pelo navegador, que é
-- precisamente o que não queremos.
--
-- **Objeto do AutoFluxos.** Não toca `app_verandi`. A única coisa global que
-- encosta é o Storage — avaliada: bucket novo não muda bucket existente, e a
-- cota de 1 GB do plano gratuito é compartilhada (ver docs/BANCO-COMPARTILHADO.md
-- e a conta de volume no anexo A.1 do plano).

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- O bucket
-- ---------------------------------------------------------------------------
--
-- 16 MB de teto por arquivo, e não os 100 MB que a Meta aceita em documento.
-- Um PDF de 100 MB ocuparia um décimo do plano gratuito inteiro. 16 MB é o
-- número da própria Meta para vídeo e áudio — o maior arquivo que ela mesma
-- deixa sair. O que passar disso fica registrado como recebido e sem cópia.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'autofluxos-recebidos',
  'autofluxos-recebidos',
  false,
  16777216,
  array[
    -- Imagem, incluindo a figurinha: ela é um WebP e o navegador desenha igual.
    'image/jpeg',
    'image/png',
    'image/webp',
    -- Vídeo e áudio, com os formatos que a Cloud API documenta na entrada.
    'video/mp4',
    'video/3gpp',
    'audio/aac',
    'audio/amr',
    'audio/mpeg',
    'audio/mp4',
    'audio/ogg',
    -- Documento. A lista é a da Meta, e fechada de propósito: o que não está
    -- aqui não sobe, e isso é uma defesa e não uma limitação.
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- SVG fica de fora pelo mesmo motivo dos outros dois buckets: ele carrega
-- script. Aqui o bucket é privado, então não seria XSS hospedado por nós — mas
-- a URL assinada abre no navegador de quem atende, e é o mesmo estrago. O
-- WhatsApp também não entrega SVG, então não há caso de uso perdido.

-- ---------------------------------------------------------------------------
-- Onde o registro do arquivo mora
-- ---------------------------------------------------------------------------
--
-- Coluna própria, e não mais uma chave dentro do `payload`.
--
-- O `payload` da entrada é a mensagem **crua da Meta** — é o que ela mandou, e
-- misturar chaves nossas lá dentro já confunde quem lê `anexoDoPayload`, que
-- hoje procura `midia`/`url` gravados por nós na saída e formato da Meta na
-- entrada. Duas coisas diferentes no mesmo lugar é como se perde uma tarde.
--
-- `jsonb` e não colunas soltas porque o conteúdo é um registro fechado que só a
-- aplicação lê ({midia, caminho, mime, bytes, nomeArquivo}), e porque um campo
-- novo amanhã não vira migration.

alter table public.messages
  add column if not exists arquivo jsonb;

comment on column public.messages.arquivo is
  'Cópia nossa da mídia recebida: {midia, caminho, mime, bytes, nomeArquivo}. '
  '`caminho` é a chave no bucket privado autofluxos-recebidos — NUNCA uma URL. '
  'URL assinada é gerada na hora de desenhar a tela, com validade curta. '
  'Nulo = mensagem sem arquivo, ou arquivo grande demais para o teto de 16 MB.';

-- O índice cobre as duas perguntas que o expurgo faz, e só elas: "quais
-- mensagens deste contato têm arquivo para apagar do bucket?". Parcial porque a
-- esmagadora maioria das linhas é texto, e um índice cheio de nulos seria
-- espaço gasto para responder mais devagar.
create index if not exists messages_arquivo_idx
  on public.messages (contact_id)
  where arquivo is not null;

notify pgrst, 'reload schema';
