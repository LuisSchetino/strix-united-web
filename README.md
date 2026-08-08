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
```
