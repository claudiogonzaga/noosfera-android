# Revisão da parte de hábitos da Noosfera (15/11/2026)

Escopo: a aba "Comentora" do app do telefone (`CODIGO/COMENTOR`), o espelho no Mac (`CODIGO/Aspis/comentora.py`), e a relação com o Zazen e o Kinesis. Fontes: o código, os seus dados reais sincronizados no Mac (`~/.aspis`), quatro telas do celular, uma revisão da literatura (47 referências, no fim) e um levantamento de 20 e poucos apps de hábitos, abertos e comerciais.

## 1. Resumo

1. **O motor é bom.** A regra de força, os escudos, a retirada gradual dos lembretes, o plano se-então, a versão mínima, a revisão da semana e os hábitos de parar estão alinhados com a melhor evidência e à frente de quase todos os apps abertos que olhei.
2. **O resultado não é.** Você tem 7 hábitos em formação desde maio/junho, todos com força entre 0% e 18%. Nos 89 dias anteriores ao último mês, cada um tem de 0 a 2 registros. Nenhum tem pista, versão mínima, plano B ou porquê preenchidos.
3. **O problema não é falta de recurso.** É foco (7 de uma vez), plano (nenhum hábito tem o "quando"), volta depois da ausência (o app trata sumiço como falta e recebe você com tudo vermelho) e tela (o que é para fazer agora fica abaixo da coruja, fora da primeira tela).
4. **Zazen e Kinesis estão fora do sistema.** O Zazen só conta se você criar um hábito ligado a ele (não há nenhum). O Kinesis não tem ligação nenhuma. O sono corre num sistema antigo, à parte. São três contabilidades que não se enxergam.
5. **Proposta:** renomear a aba para **Héxis**, transformar a tela inicial num painel "Hoje" que junta hábitos marcados, sessões (Zazen), contagens (pausas do Kinesis) e dados automáticos (sono, treino), limitar a 3 hábitos em formação com fila, e criar o fluxo de volta.

## 2. O que o app já faz bem

| Recurso | Onde | Evidência por trás |
|---|---|---|
| Força como média exponencial (Loop Habit Tracker): uma falta tira pouco, faltas seguidas derrubam | `src/services/habitStrength.ts` | Lally 2010: falta isolada não prejudica; repetição é o que forma |
| Corrente com escudos limitados (1, depois 2; volta 1 a cada 7 feitos) | `chainOf` | Sharif e Shu: folga limitada e com custo aumenta a persistência; Duolingo mediu que 2 proteções rendem mais que 1 |
| "Voltou!" depois de uma falta | `MarkResult.comeback` | Megaestudo de Milkman 2021: premiar a volta depois da falta foi a melhor de 54 intervenções |
| Lembrete que se retira conforme o hábito firma | `habitStage.ts` | Stawarz 2015, Renfree 2016: lembrete garante repetição mas cria dependência |
| Graduação por automaticidade (4 perguntas do SRBAI), não por contagem de dias | `evaluateHabit` | Gardner 2012 |
| Pista, versão mínima, plano B, porquê; ajuda da IA para formular | `HabitEditScreen`, `habitCoach.ts` | Planos se-então, planejamento de enfrentamento |
| Folga, pausa, modo férias | `pauseHabit`, `pauseAllHabits` | Todos os bons apps convergem em "pular sem punir" |
| Hábito de parar com deslize, contexto, vontade superada, mapa de gatilhos | `logSlip`, `UrgeSurfScreen` | Substituição funciona melhor que inibição (Adriaanse 2011) |
| Marcação automática: Zazen, Leia para mim, treino do relógio | `habitActions.ts`, `exerciseDetection.ts` | Harkin 2016: registro sem atrito é o que sustenta o monitoramento |
| Um toque para marcar, "Desfazer", sem texto de culpa | `HabitsTodaySection.tsx` | Convergência dos melhores apps |
| Revisão da semana e "recomeço" na segunda e no dia 1º | `WeeklyReviewScreen`, `getRecomeco` | Efeito de recomeço (Dai 2014); evidência fraca, custo baixo |

Nada disso precisa ser refeito.

## 3. O que os seus dados mostram

Lidos em 15/11/2026 de `~/.aspis/comentora.json`, `kinesis.json` e `zazen.json`.

| Hábito | Criado | Horário | Força | Últimos 7 dias | Últimos 30 | Dias 31–120 | Total feito |
|---|---|---|---|---|---|---|---|
| Ver Sol Matutino para Sincronizar Ciclo Circadiano | 02/06 | 07:00 | 18% | 3 de 7 | 3 de 30 | 1 de 89 | 25 |
| 30min Zone 2 (dias fixos) | 07/06 | 08:00 | 17% | 2 de 5 | 2 de 21 | 1 de 64 | 15 |
| 20min 4x4 Norgian (dias fixos) | 06/06 | 08:00 | 10% | 1 de 2 | 1 de 9 | 1 de 25 | 5 |
| Pôr do sol | 27/05 | 18:00 | 12% | 1 de 7 | 2 de 30 | 0 de 89 | 23 |
| Skincare Noturno | 07/06 | 21:30 | 0% | 0 de 7 | 0 de 30 | 1 de 89 | 14 |
| Respiração 2-2-4 | 27/05 | 21:50 | 3% | 0 de 7 | 1 de 30 | 1 de 89 | 8 |
| Agradecer 3 coisas boas | 10/06 | 21:50 | 11% | 1 de 7 | 3 de 30 | 2 de 89 | 16 |

Outros fatos:

- **Plano:** os 7 têm pista, versão mínima, plano B e porquê vazios. Cinco vieram da migração de "Meus hábitos" e nunca passaram pelo assistente de 3 passos. O cartão da migração ainda está na tela inicial.
- **Automaticidade:** nenhuma resposta ao SRBAI; as 4 perguntas estão pendentes nos 7.
- **Noite:** três hábitos entre 21:30 e 21:50, com hora de dormir às 22:00 e silêncio a partir das 22:00. A pergunta e as cobranças (30, 70, 150 min depois) cairiam dentro do silêncio.
- **Som:** volume dos avisos no mudo; período silencioso de 01:00 a 20:00 nos dias de semana. Os avisos da manhã chegam só como texto. Nenhum hábito está em modo rigoroso.
- **Kinesis:** 102 rodadas em 36 dias, de 12/07 a 09/11. Trinta desses dias foram até 22/09; depois, só 05/10, 08/10 e 09/11. A configuração é 30 min de trabalho e 3 de pausa, que é a dose com melhor evidência.
- **Zazen:** um dia registrado (07/11, 25 min).
- **Retomada:** a atividade voltou em 11/11, depois da versão 1.130.

Isso é o padrão dos apps de comportamento, não um defeito seu: a retenção mediana em 30 dias é de cerca de 3% (Baumel 2019), e só 23% dos participantes de um estudo controlado formaram o hábito em 84 dias (Keller 2021). O app tem de ser desenhado para a volta, porque a ausência é a regra.

## 4. Diagnóstico: onde o app falha

### 4.1 Foco: sete hábitos de uma vez

O app avisa na criação que "a pesquisa sugere poucos por vez" (`countFormingHabits`), mas não limita nem oferece fila. A migração criou cinco de uma vez. Cada hábito novo pede atenção até pegar, e exercício leva de 4 a 7 meses (Buyalskaya 2023).

### 4.2 Plano: os recursos existem e não são usados

A parte que mais pesa (pista e versão mínima) só aparece no assistente de criação. Hábito migrado ou criado às pressas fica sem plano, e o app nunca volta a pedir. Na lista do dia, a linha mostra o horário no lugar da pista (`it.habit.cue ?? it.habit.scheduleTime`).

Os títulos também atrapalham: "Ver Sol Matutino para Sincronizar Ciclo Circadiano" é resultado, não ação, e não cabe na linha (aparece cortado). O campo pede "a AÇÃO, curta".

### 4.3 Ausência: sumiço vira falta

Dia sem registro conta como zero na força (`valueOf`: `vazio` → 0). Depois de três meses sem abrir, tudo está em 0%, as correntes aparecem cheias de falta e os 7 hábitos pedem as 4 perguntas. Não existe pausa automática nem tela de retorno. O `getRecomeco` só olha os últimos 7 dias e só na segunda ou no dia 1º.

A evidência aponta exatamente para esse ponto: o tempo desde a última vez é o melhor preditor de abandono (Buyalskaya 2023), e a queda depois de uma quebra é maior quando a pessoa se culpa e menor quando dá para consertar (Silverman e Barasch 2023).

### 4.4 Tela inicial: o que é para fazer agora está fora da primeira tela

Na primeira tela aparecem a saudação, o volume, a coruja de 180 pontos e um cartão de comemoração. O "Hoje" começa abaixo. Depois dele vêm dez blocos sem relação com hábito: hora de dormir, inspiração, Escudo, saúde, chat, respiração, "vou dormir", Leia para mim, Ioga Nidra, sequência, estatísticas (`HomeScreen.tsx`).

Na linha de cada hábito, a corrente é uma fileira de pontos de poucos pixels, com o texto cortado ("comece ..") e o escudo quase invisível. Para quem está em 0 a 2 dias, ela mostra principalmente faltas. Somando anel de força, fase, corrente, escudos, mapa de calor e SRBAI, são seis medidas por hábito; a crítica mais comum aos apps de pontuação (Whoop, Oura) é justamente o excesso de números.

O rótulo da aba também não cabe: aparece "Coment..".

### 4.5 Zazen, Kinesis e sono fora do sistema

- **Zazen:** existe a ação `zazen` (`confirmHabitsByAction`), mas só marca um hábito que você tenha criado com ela. Não há nenhum. Os minutos por dia ficam em `zazen:dias`, sem força, corrente ou meta.
- **Kinesis:** nenhuma ligação com hábitos. O histórico (`kinesis:history`) guarda cada rodada; a tela mostra só "exercício(s) hoje".
- **Sentado, em dobro:** além do Kinesis, existe o "Trabalho sentado" (`sedentary.ts`), que manda avisos a cada X minutos por conta própria.
- **Sono:** corre no sistema antigo (tabelas `habits`, `daily_log`, `streaks`), com sequência própria e o botão "Vou dormir agora".
- **Treino e passos:** o treino do relógio confirma um hábito pelo título; passos e sono do Health Connect aparecem só no cartão de saúde.

### 4.6 Lembretes presos ao relógio

A pista vira um horário (`CUE_TIME`) e o aviso toca no relógio, não no evento. Com o som no mudo e o silêncio de dia, vira uma notificação de texto entre outras. A literatura é mais favorável à pista por evento (Stawarz 2015), e janela rígida de horário reduziu a frequência de exercício (Beshears 2021).

Ponto a favor: o app manda um único aviso de perda por dia (a "última chamada" das 20h30). É a regra do Duolingo de proteger o canal e não deve mudar.

### 4.7 Medidas pedidas cedo demais

As 4 perguntas de automaticidade ficam pendentes a partir de 14 dias de idade, com qualquer força (`srbaiDueOf`). Perguntar "já sai sem pensar?" de um hábito com 3% é ruído e mais um item pendente.

### 4.8 Sem atalho fora do app

Há botões na notificação, mas não há widget na tela do celular. O Duolingo relata retenção bem maior entre quem usa o widget (sem número publicado), e os melhores apps abertos (Loop, Kadō, Streak) têm widget com marcação direta.

### 4.9 Pequenos desalinhamentos com a evidência

- Os textos do código dizem que o plano se-então "dobra a chance" (d = 0,65, de 2006). A meta-análise nova (Sheeran 2025, 642 testes) dá efeito menor para comportamento (em torno de 0,27). Continua valendo, mas sem a promessa.
- Marco de 21 dias: não tem base empírica. O de 66 é uma mediana (faixa de 18 a 254 dias).
- Exercício em dias fixos às 08:00: "3 vezes por semana, em qualquer dia" combina melhor com a evidência e o app já tem essa frequência.

## 5. O que a evidência diz, e como o app está

| Regra | Força da evidência | No app hoje |
|---|---|---|
| Registrar sem esforço e mostrar progresso, com meta | Forte (Harkin 2016, d = 0,40; Eckerstorfer 2018) | Bom para hábitos marcados; Zazen, Kinesis e sono de fora |
| Otimizar repetição em contexto estável; esperar 2 a 5 meses, mais para exercício | Forte (Lally 2010; Singh 2024; Buyalskaya 2023) | A força faz isso; os marcos de dias passam a ideia errada |
| Falta isolada não importa; o perigo é o intervalo; premiar a volta | Forte (megaestudo de 2021; Buyalskaya 2023) | "Voltou!" existe; ausência longa não é tratada |
| Um plano se-então por hábito; nos de parar, uma resposta substituta | Forte, efeito pequeno a médio (Sheeran 2025; Adriaanse 2011) | Campos existem; vazios nos 7 hábitos |
| Folga limitada e com custo; corrente consertável | Moderada (Sharif e Shu; Silverman 2023) | Escudos certos; editar o dia passado já serve de conserto |
| Ancorar numa rotina existente; manhã para meditação | Moderada (Stecher 2021; Berardi 2023; Keller 2021 não achou diferença) | Chips de pista existem; o aviso é por relógio |
| Começar pelo mais simples, escolhido pela pessoa | Moderada | Versão mínima existe; vazia |
| Não impor janela rígida de horário | Moderada (Beshears 2021) | Exercício preso a 08:00 em dias fixos |
| Pausa de sentar: a cada 30 min, 2 a 5 min andando | Moderada, estudos pequenos (Dunstan 2012; Duran 2023); avisos reduzem 12,5 min sentados por dia (Leppe-Zamora 2025) | Kinesis configurado assim; uso caiu e não conta como hábito |
| Meditação: 10 a 13 min por dia; efeito por volta de 8 semanas | Moderada (Basso 2019) | Zazen com padrão de 25 min e sem versão mínima |
| Retirar lembretes conforme a automaticidade sobe | Fraca (estudos pequenos) | Implementado |
| Pontos e jogos | Fraca, ganho pequeno que some (Mazeas 2022) | Não usa; manter assim |
| Recomeço e empilhar com algo prazeroso | Fraca, custo baixo | Recomeço existe |

Mitos que o app deve evitar repetir: "21 dias", "66 dias" como prazo, "mesmo horário todo dia é essencial", "sequência forma hábito" (forma repetição), "mais minutos de meditação é melhor".

## 6. O que os melhores apps fazem

Os quinze pontos em que os melhores convergem, e a situação do app:

| # | Padrão | App |
|---|---|---|
| 1 | Marcar com um gesto na lista inicial | Tem |
| 2 | Barra baixa para "conta hoje" | Tem (versão mínima), sem uso |
| 3 | Frequência flexível | Tem; falta "a cada N dias" |
| 4 | Pular ou pausar sem punir | Tem |
| 5 | Perdão para faltas | Tem (força e escudos) |
| 6 | Editar dias passados | Tem |
| 7 | Lembrete com botões de ação | Tem |
| 8 | Widget interativo | **Falta** |
| 9 | Calendário ou mapa de calor | Tem, por hábito |
| 10 | Sequência à vista, mas não como única medida | Tem; medidas demais na linha |
| 11 | Hábitos numéricos e de tempo com crédito parcial | Tem numérico; **tempo falta** |
| 12 | Conclusão automática por dados de saúde | Parcial (só treino) |
| 13 | Agrupar por período do dia | Tem |
| 14 | Exportar; dados locais | Tem |
| 15 | Comemoração pequena | Tem |

Ideias específicas que valem copiar:

- **Uma forma só no topo, depois linhas por tipo** (Apple Fitness, Oura). Um anel do dia e, abaixo, cada linha com o controle do seu tipo: toque para sim/não, −/+ para contagem, "Começar" para sessão, "automático" para sono e treino (Kadō, Streaks).
- **Mostrar só o que vence agora**; o feito recolhe (Strides, Habitify).
- **Rotina como sequência** que cresce um passo por vez (Fabulous).
- **Grade de hábitos × dias da semana**, editável no lugar (Loop, Mhabit, Kadō).
- **Sessão com cronômetro dentro do rastreador**: terminar a sessão marca o hábito (InlitX Streak). É o caso do Zazen.
- **Células divididas no mapa de calor** para o que acontece várias vezes ao dia (Neohabit). É o caso das pausas do Kinesis.
- **"Em que horas você de fato faz"** (InlitX): o app já guarda o horário de cada marcação.
- **Pausar sem perder** por doença ou viagem, com estado visível (Gentler Streak, anéis da Apple desde 2024).

O que não copiar: dano por falta (Habitica), conserto pago, mais notificações, várias notas competindo na mesma tela, texto de culpa, contar abertura do app como hábito (Finch).

Não existe app de hábitos forte em React Native/Expo de código aberto (o maior tem 48 estrelas). Não há base para reaproveitar; o caminho é evoluir o que já está feito.

## 7. Plano de ação

### Etapa 0: arrumar os seus hábitos (hoje, sem código)

1. Escolher **2 ou 3** hábitos para formar agora. Sugestão: sol da manhã (o que mais avançou), Zazen de manhã, e as pausas do Kinesis nos dias de trabalho.
2. Pausar os outros sem data. Eles ficam na fila.
3. Escrever o plano de cada um: pista por evento ("depois do café, eu…"), versão mínima e plano B. O botão "Me ajude a formular" faz o rascunho.
4. Encurtar os títulos para a ação: "tomar sol 10 min".
5. Juntar a noite numa rotina só, mais cedo (por exemplo 21:15: skincare, respiração, três gratidões), para quando ela sair da fila.
6. Passar Zone 2 e 4x4 para "X vezes por semana".

### Etapa 1: Héxis e o painel "Hoje" (v1.134)

- Renomear a aba para **Héxis** (cabe na barra; resolve o "Coment..").
- Tela inicial vira o painel: anel do dia e "Agora" (o próximo hábito, com a frase do plano e o botão) na primeira tela.
- A coruja vira um avatar pequeno no cabeçalho, que reage (feliz no dia completo, dormindo depois de "vou dormir").
- Respiração, Ioga Nidra, Leia para mim, chat e sequência vão para uma faixa "Ferramentas"; inspiração, Escudo e saúde saem da tela de hábitos ou descem para o fim.
- Linha do hábito mais limpa: título, pista, botão. Corrente e força aparecem no detalhe e na grade da semana.

### Etapa 2: Zazen, Kinesis e sono como hábitos (v1.135)

- Novo tipo de medida: **tempo** (minutos), além de sim/não e quantidade.
- **Fontes automáticas:** um hábito pode ser alimentado por um módulo.
  - Zazen: minutos sentados no dia (`zazen:dias`); meta padrão de 10 min, mínima de 3 min; botão "Sentar" na linha.
  - Kinesis: rodadas concluídas no dia (`kinesis:history`, que já sincroniza com o Mac); dias de trabalho; meta de 4 rodadas, mínima de 1; "hoje não trabalho sentado" vale como folga.
  - Sono: "na cama até 22h", pelo "Vou dormir agora" ou pelo Health Connect; substitui o sistema antigo de sequência.
  - Treino: já existe; passa a aparecer como "automático".
- Unificar o "Trabalho sentado" dentro do Kinesis (um aviso só, para iniciar o Kinesis na primeira hora de trabalho).
- Os três hábitos de fábrica (Zazen, pausas, sono) vêm desligados e são oferecidos, não impostos.

### Etapa 3: foco e volta (v1.136)

- **Limite de 3 em formação**, com **fila**. Ao graduar ou arquivar um, o app oferece o próximo.
- **Plano incompleto:** hábito sem pista ou sem versão mínima ganha um cartão "falta o quando", uma vez por semana, até preencher.
- **Pausa automática:** 3 dias seguidos sem nenhum registro e sem abrir o app pausam tudo a partir do primeiro dia vazio. A força fica onde estava.
- **Tela de retorno:** ao voltar, "Que bom que voltou", com três opções: retomar tudo, retomar só 1 ou 2, ou rever os planos. Sem mapa de faltas.
- **Volta no dia seguinte:** depois de uma falta, o primeiro aviso do dia seguinte é o da volta, com a versão mínima em destaque.
- **SRBAI só com força a partir de 50%.**
- Textos: tirar "dobra a chance"; trocar o marco de 21 por 14.

### Etapa 4: painel da semana e do mês (v1.137)

- Grade hábitos × 7 dias, editável, com Zazen em minutos e Kinesis em células divididas.
- Tela "Panorama": mapa de calor geral, força por hábito, e "em que horas você de fato faz".
- Revisão da semana passa a incluir Zazen, Kinesis e sono.
- A tela antiga "Ver estatísticas" (só sono) é absorvida.

### Etapa 5: fora do app (v1.138)

- Widget do Android: o próximo hábito com botão de feito, e o anel do dia.
- Pistas por evento onde o Android permite sem bateria: "ao tirar do carregador de manhã", "ao conectar ao Wi-Fi do trabalho" (inicia o Kinesis), "ao desligar o despertador".
- Nenhuma notificação a mais: o teto continua sendo a última chamada das 20h30.

### Etapa 6: Mac (Noosfera 1.11)

- O mesmo painel "Hoje" na aba do Mac; as rodadas do Kinesis feitas no Mac contam no hábito.

## 8. O painel "Hoje"

De cima para baixo:

1. **Cabeçalho:** "Héxis", a data, a coruja pequena, o anel do dia (feitos de hoje sobre o total).
2. **Agora:** o próximo hábito pendente, com a frase do plano ("Depois do café, eu tomo sol 10 min"), o botão "Feito" e o atalho "Versão mínima".
3. **Corpo e mente:** três blocos pequenos e sempre visíveis: Zazen (minutos de hoje, "Sentar"), Kinesis (rodadas de hoje, "Iniciar"), Sono (última noite, automático).
4. **Hoje:** o restante, por período; o que já foi feito recolhe numa linha.
5. **Semana:** a grade hábitos × 7 dias.
6. **Na fila:** os hábitos pausados à espera de vaga.
7. **Ferramentas e lembretes** (remédios e suplementos), no fim.

Regras: uma medida por linha; nenhum vermelho na tela inicial (a falta aparece vazia, não marcada); nada de contagem regressiva.

## 9. O nome

| Nome | Sentido | Observação |
|---|---|---|
| **Héxis** (ἕξις) | Em Aristóteles, a disposição estável que se adquire pela repetição: o hábito já formado | Curto, cabe na barra, combina com Kinesis e Kairós. Recomendado |
| Éthos (ἔθος) | Hábito, costume; de onde vem "ética" | Confunde com "ethos" no sentido de caráter |
| Áskesis (ἄσκησις) | Exercício, treino | Já foi o nome do app inteiro; ainda aparece no código |
| Meléte (μελέτη) | Prática, cuidado | Menos conhecido |

A coruja e a "Comentora" continuam como a voz que lembra e conversa, dentro do Héxis.

## 10. Referências

Verificação: [A] aberto na fonte nesta revisão; [B] visto só em resumo ou fonte secundária; [C] de conhecimento prévio.

1. Lally P, et al. Eur J Soc Psychol 2010;40:998–1009. https://doi.org/10.1002/ejsp.674 [A, via 2 e 3]
2. Gardner B, Lally P, Wardle J. Br J Gen Pract 2012;62:664–666. https://pmc.ncbi.nlm.nih.gov/articles/PMC3505409/ [A]
3. Singh B, et al. Healthcare 2024;12:2488. https://doi.org/10.3390/healthcare12232488 [A]
4. Keller J, et al. Br J Health Psychol 2021;26:807–824. https://doi.org/10.1111/bjhp.12504 [A]
5. Buyalskaya A, et al. PNAS 2023;120:e2216115120. https://pmc.ncbi.nlm.nih.gov/articles/PMC10151500/ [A]
6. Fournier M, et al. Health Psychol 2017. https://pubmed.ncbi.nlm.nih.gov/28650196/ [B]
7. Ma H, et al. Int J Behav Nutr Phys Act 2023;20:109. https://doi.org/10.1186/s12966-023-01493-3 [A]
8. Gardner B, et al. Int J Behav Nutr Phys Act 2012;9:102. https://pmc.ncbi.nlm.nih.gov/articles/PMC3552971/ [B]
9. Wood W, Neal DT. Psychol Rev 2007;114:843–863. [C]
10. Quinn JM, et al. Pers Soc Psychol Bull 2010. https://doi.org/10.1177/0146167209360665 [B]
11. Adriaanse MA, et al. Pers Soc Psychol Bull 2011;37:502–512. https://doi.org/10.1177/0146167211399102 [B]
12. Stawarz K, Cox AL, Blandford A. CHI 2015:2653–2662. https://doi.org/10.1145/2702123.2702230 [A, resumo]
13. Renfree I, et al. CHI EA 2016:2932–2939. https://doi.org/10.1145/2851581.2892495 [A, resumo]
14. Gollwitzer PM, Sheeran P. Adv Exp Soc Psychol 2006;38:69–119. [B]
15. Sheeran P, Listrom O, Gollwitzer PM. Eur Rev Soc Psychol 2025;36:162–194. https://doi.org/10.1080/10463283.2024.2334563 [A, resumo]
16. Wang G, et al. Front Psychol 2021;12:565202. https://doi.org/10.3389/fpsyg.2021.565202 [B]
17. Harkin B, et al. Psychol Bull 2016;142:198–229. https://doi.org/10.1037/bul0000025 [A]
18. Michie S, et al. Health Psychol 2009;28:690–701. https://doi.org/10.1037/a0016136 [B]
19. Eckerstorfer LV, et al. JMIR mHealth uHealth 2018;6:e10076. https://doi.org/10.2196/10076 [A]
20. Laranjo L, et al. Br J Sports Med 2021;55:422. [B]
21. Silverman J, Barasch A. J Consum Res 2023;49:1095–1117. https://doi.org/10.1093/jcr/ucac029 [A, resumo]
22. Sharif MA, Shu SB. J Mark Res 2017;54:495–509. https://doi.org/10.1509/jmr.15.0231 [B]; experimento de campo (texto de trabalho) [A]
23. Beshears J, et al. Manage Sci 2021;67:4139–4171. https://doi.org/10.1287/mnsc.2020.3706 [A, resumo]
24. Duolingo. https://blog.duolingo.com/improving-the-streak ; https://blog.duolingo.com/how-duolingo-streak-builds-habit/ [A; dados da empresa, sem revisão por pares]
25. Mazeas A, et al. J Med Internet Res 2022;24:e26779. https://doi.org/10.2196/26779 [A]
26. Deci EL, Koestner R, Ryan RM. Psychol Bull 1999;125:627–668. [B]
27. Milkman KL, et al. Nature 2021;600:478–483. https://pmc.ncbi.nlm.nih.gov/articles/PMC8822539/ [A]
28. Dai H, Milkman KL, Riis J. Manage Sci 2014;60:2563–2582. https://doi.org/10.1287/mnsc.2014.1901 [B]
29. Klasnja P, et al. Ann Behav Med 2019;53:573–582. https://doi.org/10.1093/abm/kay067 [B]
30. Nahum-Shani I, et al. Ann Behav Med 2018;52:446–462. https://doi.org/10.1007/s12160-016-9830-8 [B]
31. Baumel A, et al. J Med Internet Res 2019;21:e14567. https://doi.org/10.2196/14567 [A]
32. Dunstan DW, et al. Diabetes Care 2012;35:976–983. https://doi.org/10.2337/dc11-1931 [A]
33. Diaz KM, et al. Ann Intern Med 2017;167:465–475. https://doi.org/10.7326/M17-0212 [A]
34. Duran AT, et al. Med Sci Sports Exerc 2023;55:847–855. https://doi.org/10.1249/MSS.0000000000003109 [A]
35. Leppe-Zamora J, et al. Int J Behav Nutr Phys Act 2025;22:75. https://doi.org/10.1186/s12966-025-01781-0 [A]
36. Basso JC, et al. Behav Brain Res 2019;356:208–220. https://doi.org/10.1016/j.bbr.2018.08.023 [A, resumo]
37. Stecher C, Sullivan M, Huberty J. JMIR mHealth uHealth 2021;9:e32794. https://doi.org/10.2196/32794 [A, resumo]
38. Berardi V, et al. J Med Internet Res 2023;25:e42482. https://doi.org/10.2196/42482 [A]

Apps e repositórios: Loop Habit Tracker (https://github.com/iSoron/uhabits), Mhabit/Table Habit (https://github.com/FriesI23/mhabit), Kadō (https://github.com/scastiel/kado), Streak da InlitX (https://github.com/InlitX/streak), Habo (https://github.com/xpavle00/Habo), Beaver (https://github.com/daya0576/beaverhabits), Habit-Maker (https://github.com/dessalines/habit-maker), Neohabit (https://github.com/Vsein/Neohabit), Habitica (https://github.com/HabitRPG/habitica), Streaks (https://streaks.app/), Strides (https://www.stridesapp.com/), Habitify (https://www.habitify.me/), Atoms (https://atoms.jamesclear.com/), Gentler Streak (https://gentlerstories.com/gentlerstreak/).
