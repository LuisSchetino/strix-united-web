# Strix United FC 27

Projeto independente do Team OS atual. O site FC 26 continua em `strixunited.com.br` sem alterações.

## Ambientes

- Preview separado: `https://strix-united-fc27.pages.dev`
- Supabase separado: projeto `strix-united-fc27` (São Paulo)
- Produção FC 26: permanece independente.

## Princípio de permissões

O Discord é a fonte de verdade para entrada e cargos. E-mail e telefone não concedem acesso ao time.

1. O login confirma uma identidade Discord pelo ID do provedor, sem exigir e-mail verificado.
2. A API consulta o membro e os cargos atuais no servidor Discord.
3. Toda rota que altera dados reutiliza essa validação; o cargo salvo no navegador nunca autoriza uma mutação.
4. `team_members` recebe a sincronização e o cliente pode ouvi-la por Realtime para atualizar a UI aberta.
5. A sincronização agendada de membros será adicionada ao Worker próprio quando o bot e o mapeamento de cargos forem configurados.

## Variáveis de servidor

Configurar apenas como secrets no Cloudflare, nunca no frontend:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`
- `DISCORD_ROLE_TIER_MAP`

## Desenvolvimento

```powershell
pnpm install
pnpm dev
pnpm build
pnpm check
pnpm test
```

## Módulos FC27

- Partidas: importação EA progressiva, revisão, Agenda, aliases e edição manual em `src/features/matches`.
- Competições: providers CCB/LB, classificação, mata-mata, cenários e histórico em `src/features/competitions`, `shared/competition-providers.js` e `functions/api/competitions`.
- Game Day: editor existente integrado à Agenda, adversário e campeonato em `src/gameday`.
- Mídia: gerador automático da Agenda do Dia (MP4 Story 9:16 e Feed 4:5) em `src/features/media`. O encode H.264 acontece no navegador; o EA Sync permanece isolado.
- Persistência nova: migration aditiva `20260808014500_fc27_gameday_competitions_and_history.sql`.

Os testes de integração reais dos providers são opt-in para não depender da internet na suíte comum:

```powershell
$env:RUN_LIVE_PROVIDER_TESTS='1'
node --test tests/providers-live.test.js
```

`visual-test.html` é um fixture local de QA do Vite e não faz parte do entrypoint de produção.
