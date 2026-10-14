-- "Em campo" de verdade: o vigia que roda no PC de quem joga lê o placar na tela e manda para
-- /api/internal/live-signal, que grava aqui o último placar lido do jogo da Agenda. Só o servidor
-- (service role) escreve esses campos; quem lê a Agenda passa a ver o placar parcial e o minuto.
alter table public.agenda_matches
  add column if not exists live_seen_at timestamptz,
  add column if not exists live_started_at timestamptz,
  add column if not exists live_strix_score smallint check (live_strix_score between 0 and 99),
  add column if not exists live_opponent_score smallint check (live_opponent_score between 0 and 99),
  add column if not exists live_minute smallint check (live_minute between 0 and 130);
