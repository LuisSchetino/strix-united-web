# STRIX FC27 — qualidade visual local

Data: 05/09/2026. Base: `ba868c7`. Status: localmente pronto para revisão; não publicado e sem novo commit.

## Logos

Causa reproduzida: imagens já carregadas (`complete`, `naturalWidth > 0`) permaneciam com opacity 0. O efeito de reset do ClubLogo executava depois do evento de carregamento em cache e apagava o estado loaded. A inspeção somente leitura da produção também confirmou esse estado na identidade Strix.

Correção compartilhada: ciclo de vida vinculado à URL, ref que reconhece imagem já carregada, retry limitado após erro e nova tentativa ao voltar online. Falhas de preload deixam de permanecer no conjunto de URLs supostamente aquecidas. Não foi acrescentado um desvio por nome de clube. A otimização responsive da marca, que já existia, foi preservada.

Testados no navegador: identidade/sidebar, Central, Agenda, Histórico, competições/classificação, escalação, Mídia e matriz de assets. Matriz inclui PNG transparente, responsive AVIF/WebP, URL CCB real do Tudo Nosso EC, imagem remota, ausência de URL, URL quebrada trocada por válida e remount com cache. Fotos preservam crop circular; logos usam contain e dimensões estáveis.

## Auditoria e UI

| Área | Problema / ajuste |
| --- | --- |
| Navegação | Logo invisível; menu fechado ainda acessível por teclado no mobile. Corrigidos lifecycle, inert e aria-current. |
| Central | Superfície decorativa azul residual. Neutralizada, preservando seleção temporal existente. |
| Agenda / escalação | Competição salva sem opção correspondente aparecia como Amistoso no editor. Preservada opção atual; fechamento acessível e seleção com alvos maiores. Status atrasado corrigido no card da noite. |
| Histórico | Regras de grid concorrentes desalinhavam header/linhas em largura intermediária. Header e rows agora compartilham a mesma definição e ações permanecem visíveis. |
| Estatísticas | Excesso de caixas equivalentes e metadata pequena. Métricas com hairlines, melhor leitura e modal de ranking com scroll/foco corretos. |
| Competições | Navy residual e renderização de logos divergente. Superfícies neutras e ClubLogo reutilizado; accent Next restrito à competição. |
| Elenco | Metadata e ações pequenas. Ajustadas legibilidade, botão de ações e apresentação circular das fotos. |
| Biblioteca | Superfície azul residual nos tabs. Neutralizada; filtros e player preservados. |
| Análise | Inspeção visual dos painéis e filtros; estrutura funcional preservada. |
| Desenvolvedor | Inspeção do estado indisponível no ambiente de teste; cores semânticas preservadas. Nenhuma operação executada. |

Meus Dados e Central da Diretoria não foram validados como rotas independentes nesta passagem; não estavam na navegação usada pelo ambiente de revisão. Isso não constitui validação de permissões/perfis de produção.

## Motion e acessibilidade

Preservado o sistema existente, com durações curtas e reduced-motion. Segmented control deixa de usar scrollIntoView, que movia a página inteira: agora rola apenas seu próprio eixo horizontal. Navegação por setas/Home/End e tabindex ativo.

Ranking recebe contenção de foco, Escape, restauração de foco e scroll lock. Viewer da Mídia usa dialog nativo, fechamento por Escape e restauração de scroll/foco. Preview pode ser pausado, respeita reduced-motion e interrompe o trabalho de frames quando a página está oculta.

## Mídia

Apresentação como Central de conteúdo; templates preservados. No desktop, contexto/controles e preview grande em duas colunas. No mobile, coluna única com Story ocupando a largura útil. Cache apresentado como vídeos disponíveis, sem grupo de ações desabilitadas quando não há vídeo. Hierarquia de gerar, visualizar e baixar preservada.

Executada geração local de Agenda Story com 351 frames, abertura/reprodução no viewer e estado de cache disponível. Viewer conferido em desktop e mobile. Painters, timelines, muxer e encode não foram alterados.

## Mobile e QA no navegador

Resoluções inspecionadas ao longo das passagens: 1440×900, 1180×820, 768×1024, 390×844 e 360×800.

Screenshots capturados e revisados na conversa: Central, Agenda, seleção de posição/escalação, Histórico, Estatísticas/ranking, Competições, Elenco, Análise, Biblioteca, Desenvolvedor, Mídia e viewer. Foram feitas passagens após implementação e novos refinamentos; não apenas inspeção de código.

Fluxo local: Agenda → ações → editar → posição GOL → João com foto → salvar. Estado de teste atualizado e feedback exibido. Não houve gravação remota. Escape/foco/scroll do ranking e viewer foram conferidos. Na última verificação da Mídia em 360px: largura do documento 360px, viewport 360px, nenhuma imagem quebrada.

Limite importante: o Vite isolado não executa a sessão das Pages Functions. Foi criado `quality-review.html`, que usa componentes reais com fixtures identificadas explicitamente e mutações apenas em memória. Não é bypass de autenticação e não integra o build de produção. Somente o endpoint público de imagens existente é encaminhado pelo proxy de desenvolvimento. QA autenticado de escrita em produção não foi feito nem seria adequado a esta rodada sem publicação.

## Performance

Sem dependência nova. Cache/navegação de dados existentes preservados. Correção evita imagens em cache invisíveis e permite recuperar preloads falhos. Preview oculto deixa de consumir frames. Não foi realizado benchmark controlado antes/depois; não se afirma ganho numérico de navegação.

Build final: entrada JS 423,83 kB / 126,92 kB gzip; chunk Mídia 107,50 kB / 31,76 kB gzip. Harness de revisão fora da entrada de produção.

## Testes

- `pnpm test`: exit 0; 180 testes, 174 aprovados, 6 skipped, 0 falhas (1.245,6 ms reportados pelo runner).
- `pnpm check`: exit 0.
- `pnpm build`: exit 0; 8,41 s reportados pelo Vite.
- `git diff --check`: sem erros de whitespace; apenas avisos de normalização LF/CRLF do Git no Windows.

## Preservação e entrega

Não alterados EA Sync, Railway, secrets, schema, migrations, RPC, regras de autorização ou conteúdo dos vídeos. Sem deploy, sem novo projeto e sem escrita em dados de produção.

Revisão: http://127.0.0.1:5173/quality-review.html

**LOCALMENTE PRONTO PARA REVISÃO — NÃO PUBLICADO.**
