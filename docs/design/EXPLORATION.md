# STRIX UNITED FC27 — Exploração de direções

Data: 02/10/2026. Base: `81a73e4` + trabalho não commitado da sessão anterior (snapshot `68f3e4a`).
Escopo: Navegação, Home, Agenda, Perfil e Central Media. Cada área teve de 3 a 4 direções com arquiteturas diferentes, avaliadas pelos mesmos critérios. A decisão é autônoma; os descartes ficam registrados.

Restrições confirmadas que filtram as direções:

- Home mostra **contexto do clube**, para o jogador do elenco. Sem estatística individual e sem vínculo jogador↔login por nome.
- Central Media continua **dev-only**. ACL não muda.
- Rastro Blue `#2F80FF` só dentro do escopo Rastro.
- Nada de dado inventado. Ausência de dado EA = "—".

Escala dos critérios: 1 (fraco) a 5 (forte). Critérios: clareza, identidade STRIX, relação com a Agenda, hierarquia, compreensão imediata, experiência do jogador, relevância do agora, estados, first viewport, escalabilidade, responsividade/mobile, acessibilidade, performance, consistência com o sistema, potencial de motion, complexidade (5 = simples), manutenção.

---

## 1. Navegação

### A. Rail editorial + barra inferior no mobile
- **Conceito:** a navegação é organizada por propósito, não por lista: *Clube* (Central, Agenda, Partidas, Elenco, Campeonatos), *Dados* (Estatísticas, Análise, Biblioteca) e *Estúdio* (Mídia, Desenvolvedor). Grupos vazios pela ACL desaparecem.
- **Modelo mental:** "onde está o clube, onde estão os números, onde se produz".
- **Composição:** sidebar 248px em ink-0 com hairline; item ativo = preenchimento graphite + texto off-white (o mesmo tratamento do segmento ativo da Agenda), não o pill claro atual. Topbar fina: título da página, busca, ação Novo. O botão de notificações sem função é removido.
- **Mobile:** barra inferior com Central, Agenda, Partidas, Elenco e Mais (abre folha com o restante + conta). O chip "Próxima partida" acopla acima da barra, só quando há jogo hoje.
- **Estados:** compacto (72px) com tooltip; drawer acessível com `inert`; foco visível; rotas restritas não aparecem.
- **Vantagens:** escala com 7–9 itens variando por cargo; polegar alcança o essencial; zero dependência nova.
- **Riscos:** "Mais" esconde Estatísticas no mobile (mitigado: busca Ctrl K e folha com dois toques).

### B. Masthead horizontal (publicação esportiva)
- Sem sidebar; crest + navegação horizontal como manchete de jornal esportivo; mobile com barra inferior.
- **Vantagens:** mais largura útil; leitura editorial forte.
- **Riscos:** 9 destinos com ACL variável estouram a linha; Mídia/Dev viram overflow; perde-se o padrão de app de operação que diretoria/dev usam o dia inteiro.

### C. Command-first
- Shell mínimo; tudo via palette (Ctrl K) e Home como lançador.
- **Riscos:** descoberta ruim para jogadores no celular; teclado como premissa num produto mobile-first.

| Critério | A | B | C |
|---|---|---|---|
| Clareza / compreensão | 5 | 4 | 2 |
| Identidade + Agenda | 4 | 5 | 3 |
| Escalabilidade (ACL) | 5 | 2 | 4 |
| Mobile | 5 | 4 | 2 |
| Acessibilidade | 5 | 4 | 3 |
| Complexidade / manutenção | 4 | 3 | 4 |

**RECOMMENDED DIRECTION: A — Rail editorial + barra inferior.** Resolve o maior problema mobile (menu hambúrguer como única navegação e topbar sem título) e organiza a IA por propósito. B foi descartada pela ACL variável; C pela descoberta no celular.

---

## 2. Home

### A. Agora — a noite ancorada no presente
- **Conceito:** a Home é um ledger da noite com uma linha do agora. A próxima partida senta sobre a linha; acima, o último resultado; abaixo, o resto da noite e os próximos dias.
- **Modelo mental:** "o que está acontecendo agora e o que vem em seguida".
- **First viewport (desktop):** saudação curta com nome e cargo do perfil autenticado; à esquerda, o bloco Agora: horário em numerais grandes, STRIX × adversário com escudos, competição, contagem ("em 1h 12min" / "começou há 8 min"), estado da escalação (definida / pendente) e ações Ver escalação / Abrir Agenda; à direita, "Esta noite" no ritmo de horário da Agenda. Abaixo: Último resultado (placar grande) e Temporada (V-E-D, aproveitamento, gols, sequência recente).
- **Estados:** noite com jogos; jogo em andamento (status `live`/atrasado); noite livre (o último resultado e a temporada assumem o topo, com a próxima data marcada); início de temporada sem histórico (estado vazio honesto); carregando (skeleton fiel).
- **Vantagens:** máxima relevância do agora; 100% dados existentes; reaproveita a linguagem da Agenda; a contagem dá motion com propósito.
- **Riscos:** noite vazia + histórico curto deixam a página rasa → estados vazios escritos com cuidado e temporada sempre presente.
- **Mobile:** coluna única na ordem saudação → Agora → Esta noite → Último resultado → Temporada.

### B. Semana em faixa
- Faixa Seg–Dom; o dia escolhido abre abaixo.
- **Riscos:** um passo a mais para chegar ao agora; em noites cheias a faixa vira detalhe; sete colunas no celular.

### C. Mural do vestiário (eventos prioritários)
- Avisos ordenados por urgência.
- **Riscos:** não existe sistema de eventos/notificações no produto; o mural dependeria de sinais derivados ou ficaria vazio — tentação de inventar conteúdo.

| Critério | A | B | C |
|---|---|---|---|
| Relevância do agora | 5 | 3 | 4 |
| Compreensão imediata | 5 | 3 | 3 |
| Estados (noite livre / vazio) | 4 | 4 | 2 |
| Dados reais disponíveis | 5 | 5 | 2 |
| Mobile | 5 | 2 | 4 |
| Motion com propósito | 4 | 3 | 2 |
| Complexidade | 4 | 3 | 3 |

**RECOMMENDED DIRECTION: A — Agora (híbrido).** Leva de B uma cauda leve "Próximos dias" e de C apenas sinais reais no próprio bloco Agora (escalação definida/pendente, jogo atrasado), sem feed. Resolve: Home atual sem identidade do usuário, hero e cards repetindo o mesmo jogo, nomes truncados no mobile, temporada e último resultado ausentes.

---

## 3. Agenda

### A. Ledger de horários refinado
- Mantém a arquitetura (Hoje / Próximos / Concluídos + lista por horário) e a eleva: o próximo jogo ganha a marcação do agora (mesma da Home), linha com anatomia fixa (horário | escudo | adversário + competição | estado | ações), cabeçalho sem kicker redundante, linhas que não truncam o adversário no mobile.

### B. Linha do tempo vertical
- A noite como trilho vertical de horários com nós.
- **Riscos:** troca o padrão que o time já domina por algo mais decorativo e menos denso.

### C. Calendário mensal
- **Riscos:** baixa densidade por noite; péssimo no celular; a operação é por noite, não por mês.

**RECOMMENDED DIRECTION: A — Ledger refinado.** A Agenda é a referência do produto; o ganho está em consistência e estados, não em nova arquitetura. B e C trocam densidade e familiaridade por forma.

---

## 4. Perfil

Hoje não existe perfil próprio: a ficha do jogador vive dentro de Estatísticas › Dados individuais; o contrato aparece no menu do card no Elenco; e há um modal `Profile` legado no shell com números fixos ("34 partidas", "nota 7.8") — dado inventado, ainda montado no App.

### A. Ficha única do jogador
- **Conceito:** um único componente de ficha usado onde quer que um jogador seja aberto (Elenco e Estatísticas): identidade (foto, nome, posições, vínculo, número), temporada com dados EA reais, forma recente, recordes e acesso ao contrato quando a regra permitir.
- **Composição:** folha lateral no desktop, folha cheia no mobile; mesma hierarquia nos dois pontos de entrada.
- **Vantagens:** elimina duplicação; o Elenco passa a abrir pessoas, não só cards; zero dado novo, zero ACL nova.
- **Riscos:** extrair a ficha de Estatísticas exige cuidado com os testes que fixam seu conteúdo.

### B. Página "Meu perfil" (/perfil)
- **Riscos:** depende do vínculo login↔jogador por nome, recusado para a Home; nova rota = mudança de arquitetura/ACL.

### C. Melhorar só a ficha dentro de Estatísticas
- **Riscos:** mantém o perfil escondido atrás de uma aba de dados; o Elenco continua sem ficha.

**RECOMMENDED DIRECTION: A — Ficha única.** B fica registrada como evolução futura quando existir um vínculo confiável login↔jogador. O modal legado com números fixos é removido.

---

## 5. Central Media

### A. Pauta → Peça → Resultado
- **Conceito:** uma sala de edição. À esquerda, a pauta da noite: cada peça (Agenda do dia, Relacionados da noite, Resumo do dia, Resumo da semana, Anúncio FC27) com o que ela usa e se está pronta ("3 jogos · pronta", "falta salvar a lista", "nenhum jogo concluído"). No centro, a peça em escala real, protagonista; o formato (Reels 9:16 / Post 4:5) fica colado ao preview. A geração acontece sobre o próprio preview (progresso no palco); o resultado substitui o preview no lugar, com Baixar, Ver em tela cheia e Gerar de novo. Conteúdo e personalização ficam num painel lateral progressivo.
- **Modelo mental:** "o que a noite pede → como vai ficar → pronto para postar".
- **Estados:** pronta, incompleta (com a ação que falta), vazia (sem dados reais), gerando, pronta para baixar, dados mudaram desde o último render, erro com nova tentativa.
- **Mobile:** pauta vira faixa horizontal de peças no topo; preview ocupa a largura útil; ações fixas no rodapé com safe area.
- **Vantagens:** o usuário começa pelo resultado, não por conceito técnico; a prontidão fica visível antes de clicar; preview é protagonista.
- **Riscos:** o Anúncio FC27 tem muitos controles (pessoas, filtros, frases, ordem) — precisa de disclosure progressivo para não lotar o painel.

### B. Galeria de modelos
- Grade de miniaturas por tipo de peça, clique abre o editor.
- **Riscos:** cara de template (o oposto do pedido); as peças dependem dos dados da noite e a prontidão some atrás das miniaturas; miniaturas vivas custam um canvas cada.

### C. Assistente em etapas
- O que criar → contexto → formato → personalizar → gerar.
- **Riscos:** lento para quem gera as mesmas peças toda noite; o preview só aparece no fim.

| Critério | A | B | C |
|---|---|---|---|
| Começa pelo resultado | 5 | 4 | 4 |
| Preview protagonista | 5 | 3 | 2 |
| Prontidão / estados | 5 | 2 | 3 |
| Uso recorrente (toda noite) | 5 | 3 | 2 |
| Mobile | 4 | 4 | 5 |
| Performance | 5 | 2 | 5 |
| Complexidade | 3 | 3 | 4 |

**RECOMMENDED DIRECTION: A — Pauta → Peça → Resultado.** De C fica a ordem de leitura (o quê → formato → personalizar → gerar) expressa no layout, sem etapas bloqueantes. B foi descartada pela estética de template e pelo custo de miniaturas vivas.

---

## Decisões transversais

- **Cor:** estratégia restrita — ink/graphite/off-white com hairlines; cor apenas para estado do sistema (erro, aviso, sucesso) e para escopos de parceiros (Rastro, Next Clubs, cor da competição).
- **Tipografia:** uma família (Inter). Contraste por tamanho, peso e tracking; numerais tabulares em horários, placares e tabelas.
- **Kickers:** o rótulo acima do título de página repete o breadcrumb da topbar e sai; rótulos em maiúsculas ficam para metadados de dados (colunas, legendas), não como sobretítulo.
- **Motion:** uma linguagem — entrada desacelerada a partir de estado visível, troca de conteúdo dentro de shell estável, progresso real no palco da Mídia, contagem do agora. Nada de bounce, glow ou parallax.
