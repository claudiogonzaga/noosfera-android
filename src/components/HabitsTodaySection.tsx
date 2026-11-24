// A SEÇÃO DE HÁBITOS no topo da Home (v1.130): o que é para hoje, agrupado por
// manhã/tarde/noite, com um toque para marcar. Substitui o antigo cartão
// "Hábitos saudáveis e lembretes" — os lembretes (remédios, suplementos, jejum)
// continuam aqui embaixo, separados, porque não se formam: só lembram.
//
// Princípios que guiam as escolhas desta tela:
//  - marcar tem que custar UM toque (fricção mata registro, e registro é o que
//    alimenta a força); desfazer, também um toque (o "Desfazer" do aviso);
//  - o que já está formado sai da frente (recolhido): a atenção vai para o que
//    ainda está se formando;
//  - recompensa leve: vibração, um pulo no ✓, a coruja feliz no dia perfeito,
//    os marcos — nada de pontos;
//  - nenhum texto culpa. Falhou? "Voltou!" vale mais que a sequência;
//  - a CORRENTE à vista (v1.132): os últimos elos, o tamanho e os escudos em
//    cada hábito de fazer — saber o que se perde é o que faz proteger. Uma
//    falta gasta um escudo; sem escudo, a corrente se parte.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Card } from './Card';
import { Button } from './Button';
import { GreekIcon } from './GreekIcon';
import { HabitIcon } from './HabitIcon';
import { HabitDaySheet } from './HabitDaySheet';
import { SrbaiSheet } from './SrbaiSheet';
import { SlipSheet } from './SlipSheet';
import { HabitCelebration, milestoneText } from './HabitCelebration';
import { StrengthRing, withAlpha } from './habitShared';
import { ChainLine, ChainStrip, ShieldPips, chainA11y, chainCount, chainDoneToday, chainUndoneToday } from './HabitChain';
import { planSentence } from './habitShared';
import { ECOLOGICO, ESPACIAL } from '../theme/tema';
import { colors, radius, spacing, typography } from '../theme';
import {
  clearHabitDay,
  convertHabitToReminder,
  convertReminderToHabit,
  dismissCelebration,
  dismissMigrationReview,
  dismissRecomeco,
  dismissSlipContext,
  getDueSrbai,
  getMigrationReview,
  getPendingCelebration,
  getPendingSlipContexts,
  getRecomeco,
  getTodayHabits,
  listHabits,
  markHabit,
  setHabitValue,
} from '../services/habitos';
import { dismissWeeklyReviewCard, reviewWeekStart, shouldShowWeeklyReviewCard } from '../services/habitCoach';
import { getTodayTodos, type TodoItem } from '../services/todos';
import { listMedications } from '../services/database';
import { confirmMedication, resetMedicationToday, skipMedicationToday } from '../services/medications';
import type { HabitAction, HabitDayStatus, HabitDef, HabitPeriod, MarkResult, TodayHabit } from '../types/habits';

type Snack = (message: string, action?: { label: string; onPress: () => void }) => void;

interface Props {
  /** Muda a cada recarga da Home (foco e a cada 30 s): a seção relê junto. */
  refreshKey: number;
  /** Mostra o aviso curto no pé da Home (com "Desfazer"). */
  snack: Snack;
  /** Dia perfeito (todos os hábitos em formação feitos): a Home põe a coruja feliz. */
  onPerfectDay?: (perfect: boolean) => void;
  /** Quantos dos hábitos em formação de hoje já estão feitos (o anel do cabeçalho). */
  onProgress?: (done: number, total: number) => void;
  /** Um hábito acabou de ser marcado como feito (Atena olha e pisca). */
  onMarked?: () => void;
  /** O que a tela põe entre o cartão "Agora" e as correntes (Zazen, Kinesis, sono). */
  slot?: ReactNode;
  /** Linhas a mais no cartão das correntes (Zazen e Kinesis, que ainda não são hábitos). */
  extraChains?: { key: string; title: string; beads: string; note: string; onPress: () => void }[];
}

const PERIOD_LABEL: Record<HabitPeriod, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };

/** A ferramenta do app que É o hábito, e a rota que a abre. */
const ACTION_INFO: Record<HabitAction, { label: string; route: string; params?: object }> = {
  respiracao: { label: 'Abrir a respiração', route: 'Breathing' },
  ioga: { label: 'Abrir a Ioga Nidra', route: 'YogaNidra' },
  leia: { label: 'Abrir o Leia para mim', route: 'ReadAloud' },
  zazen: { label: 'Abrir o Zazen', route: 'Main', params: { screen: 'Zazen' } },
};

const isDone = (s: HabitDayStatus) => s === 'feito' || s === 'minimo';

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function cleanDaysText(n: number | null): string {
  if (n == null) return '';
  if (n <= 0) return 'Recomeçando hoje';
  return `${n} dia${n === 1 ? '' : 's'} limpo${n === 1 ? '' : 's'}`;
}

/** O feito e o fio das contas: verde no espacial e no Gaia; na terracota, o preto da figura. */
const BEAD_INK = ESPACIAL || ECOLOGICO ? colors.accent.success : colors.accent.gold;

function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
function hhmmMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/** O cartão "Agora" só mostra o que chega em até este tanto de minutos. */
const AGORA_ADIANTE_MIN = 30;

export function HabitsTodaySection({ refreshKey, snack, onPerfectDay, onProgress, onMarked, slot, extraChains }: Props) {
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<TodayHabit[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [meds, setMeds] = useState<TodoItem[]>([]);
  const [migration, setMigration] = useState<{
    habits: { type: string; title: string }[];
    reminders: { id: number; name: string }[];
  } | null>(null);
  const [dueSrbai, setDueSrbai] = useState<HabitDef[]>([]);
  const [recomeco, setRecomeco] = useState<{ reason: 'semana' | 'mes'; habits: HabitDef[] } | null>(null);
  const [celebration, setCelebration] = useState<Awaited<ReturnType<typeof getPendingCelebration>>>(null);
  const [weeklyCard, setWeeklyCard] = useState(false);
  const [showFormed, setShowFormed] = useState(false);
  const [showList, setShowList] = useState(false);
  const [showWeekDone, setShowWeekDone] = useState(false);
  const [dayHabit, setDayHabit] = useState<HabitDef | null>(null);
  const [srbaiHabit, setSrbaiHabit] = useState<HabitDef | null>(null);
  const [slipHabit, setSlipHabit] = useState<HabitDef | null>(null);
  // Deslizes marcados pela notificação da noite, ainda sem contexto.
  const [slipContexts, setSlipContexts] = useState<HabitDef[]>([]);
  const [contextHabit, setContextHabit] = useState<HabitDef | null>(null);
  const [party, setParty] = useState<{ title: string; text: string } | null>(null);
  const [moving, setMoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await getTodayHabits());
      setFailed(false);
    } catch (err) {
      console.warn('getTodayHabits:', err);
      setFailed(true);
      setItems((prev) => prev ?? []);
    }
    try {
      setMeds((await getTodayTodos()).filter((t) => t.kind === 'med'));
    } catch {
      /* lembretes opcionais */
    }
    // Os cartões são independentes: um que falhe não esconde os outros.
    getMigrationReview()
      .then(async (r) => {
        if (!r || (r.habits.length === 0 && r.reminders.length === 0)) return setMigration(null);
        const [habits, medsAll] = await Promise.all([
          listHabits({ includeArchived: true }).catch(() => [] as HabitDef[]),
          listMedications().catch(() => []),
        ]);
        const title = new Map(habits.map((h) => [h.type, h.title]));
        const name = new Map(medsAll.map((m) => [m.id, m.name]));
        setMigration({
          habits: r.habits.filter((t) => title.has(t)).map((t) => ({ type: t, title: title.get(t)! })),
          reminders: r.reminders.filter((id) => name.has(id)).map((id) => ({ id, name: name.get(id)! })),
        });
      })
      .catch(() => setMigration(null));
    getDueSrbai().then(setDueSrbai).catch(() => setDueSrbai([]));
    getPendingSlipContexts().then(setSlipContexts).catch(() => setSlipContexts([]));
    getRecomeco().then(setRecomeco).catch(() => setRecomeco(null));
    getPendingCelebration().then(setCelebration).catch(() => setCelebration(null));
    shouldShowWeeklyReviewCard().then(setWeeklyCard).catch(() => setWeeklyCard(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  // ——— grupos ———
  const groups = useMemo(() => {
    const all = items ?? [];
    const forming = all.filter((i) => !i.stats.formed && !i.doneForWeek);
    const formed = all.filter((i) => i.stats.formed && !i.doneForWeek);
    const weekDone = all.filter((i) => i.doneForWeek);
    const byPeriod: Record<HabitPeriod, TodayHabit[]> = { manha: [], tarde: [], noite: [] };
    for (const i of forming) byPeriod[i.period].push(i);
    // Folga não entra na conta: é dia neutro, não "faltou".
    const counted = forming.filter((i) => i.stats.today !== 'folga');
    const done = counted.filter((i) => isDone(i.stats.today)).length;
    return { forming, formed, weekDone, byPeriod, total: counted.length, done };
  }, [items]);

  const perfect = groups.total > 0 && groups.done === groups.total;
  useEffect(() => {
    onPerfectDay?.(perfect);
  }, [perfect, onPerfectDay]);
  useEffect(() => {
    onProgress?.(groups.done, groups.total);
  }, [groups.done, groups.total, onProgress]);

  // AGORA: o hábito em formação ainda por fazer que está na hora (até 90 min
  // atrasado) ou chega em até 30 min; sem nenhum assim, o último que passou.
  const nowItem = useMemo(() => {
    const pend = groups.forming
      .filter((i) => i.habit.kind === 'fazer' && ['pendente', 'sem_resposta', 'parcial'].includes(i.stats.today))
      .sort((a, b) => hhmmMin(a.habit.scheduleTime) - hhmmMin(b.habit.scheduleTime));
    if (pend.length === 0) return null;
    const now = nowMinutes();
    // Nada que esteja a mais de 30 min no futuro (pedido de 16/11/2026): "Agora" é agora.
    const perto = pend.filter((i) => hhmmMin(i.habit.scheduleTime) <= now + AGORA_ADIANTE_MIN);
    if (perto.length === 0) return null;
    return perto.find((i) => hhmmMin(i.habit.scheduleTime) >= now - 90) ?? perto[perto.length - 1];
  }, [groups.forming]);
  const chainItems = useMemo(() => groups.forming.filter((i) => i.habit.kind === 'fazer'), [groups.forming]);

  // ——— marcar ———
  const handleResult = useCallback(
    (r: MarkResult | null, habit: HabitDef, undo?: () => void) => {
      if (!r) return;
      if (r.milestone) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setParty(milestoneText(r.milestone, habit.title));
      }
      if (r.comeback) {
        snack('Voltou! É isso que forma hábito.', undo ? { label: 'Desfazer', onPress: undo } : undefined);
      } else if (undo) {
        snack(`${habit.kind === 'parar' ? 'Dia limpo' : 'Feito'}: ${habit.title}`, { label: 'Desfazer', onPress: undo });
      }
    },
    [snack],
  );

  const patchToday = (type: string, today: HabitDayStatus) =>
    setItems((prev) =>
      prev
        ? prev.map((i) =>
            i.habit.type === type
              ? {
                ...i,
                stats: {
                  ...i.stats,
                  today,
                  chain: isDone(today)
                    ? chainDoneToday(i.stats.chain)
                    : isDone(i.stats.today)
                      ? chainUndoneToday(i.stats.chain)
                      : i.stats.chain,
                },
              }
              : i,
          )
        : prev,
    );

  const onTap = async (it: TodayHabit) => {
    const { habit, stats } = it;
    const st = stats.today;
    // Quantidade ainda abaixo da meta: precisa do número — a folha abre com o stepper.
    if (habit.measure === 'quantidade' && habit.kind === 'fazer' && !isDone(st)) {
      setDayHabit(habit);
      return;
    }
    if (st === 'feito' || st === 'minimo') {
      // Tocar de novo desfaz — e o aviso deixa refazer, sem diálogo no caminho.
      patchToday(habit.type, 'pendente');
      Haptics.selectionAsync().catch(() => {});
      const prevValue = stats.todayValue;
      try {
        await clearHabitDay(habit.type);
      } catch (err) {
        console.warn('clearHabitDay:', err);
      }
      snack(`Desmarcado: ${habit.title}`, {
        label: 'Refazer',
        onPress: () => {
          const redo =
            habit.measure === 'quantidade' && prevValue != null
              ? setHabitValue(habit.type, prevValue, { via: 'home' })
              : markHabit(habit.type, st === 'minimo' ? 'minimo' : 'feito', { via: 'home' });
          redo.catch(() => {}).finally(() => void load());
        },
      });
      void load();
      return;
    }
    if (st === 'folga' || st === 'nao') {
      // Já tem um registro com motivo: mudar pede a folha, não um toque cego.
      setDayHabit(habit);
      return;
    }
    // Pendente (ou a coruja desistiu de cobrar): um toque = feito.
    patchToday(habit.type, 'feito');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onMarked?.();
    try {
      const r = await markHabit(habit.type, 'feito', { via: 'home' });
      handleResult(r, habit, () => {
        clearHabitDay(habit.type)
          .catch(() => {})
          .finally(() => void load());
      });
    } catch (err) {
      console.warn('markHabit:', err);
      patchToday(habit.type, st);
      snack('Não consegui marcar agora. Tente de novo.');
    }
    void load();
  };

  /** A versão mínima, direto do cartão "Agora": conta como feito. */
  const onMinimum = async (it: TodayHabit) => {
    const { habit, stats } = it;
    const st = stats.today;
    patchToday(habit.type, 'minimo');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onMarked?.();
    try {
      const r = await markHabit(habit.type, 'minimo', { via: 'home' });
      handleResult(r, habit, () => {
        clearHabitDay(habit.type)
          .catch(() => {})
          .finally(() => void load());
      });
    } catch (err) {
      console.warn('markHabit:', err);
      patchToday(habit.type, st);
      snack('Não consegui marcar agora. Tente de novo.');
    }
    void load();
  };

  const openTool = (action: HabitAction) => {
    const a = ACTION_INFO[action];
    navigation.navigate(a.route, a.params);
  };

  // ——— lembretes (remédios etc.) ———
  const medAction = async (item: TodoItem, action: 'done' | 'skip' | 'undo') => {
    if (item.medId == null) return;
    try {
      if (action === 'done') await confirmMedication(item.medId, { via: 'home' });
      else if (action === 'skip') await skipMedicationToday(item.medId, { via: 'home' });
      else await resetMedicationToday(item.medId);
    } catch {
      /* melhor esforço */
    }
    try {
      setMeds((await getTodayTodos()).filter((t) => t.kind === 'med'));
    } catch {
      /* mantém */
    }
  };

  // ——— cartões ———
  const moveToReminder = async (h: { type: string; title: string }) => {
    setMoving(h.type);
    try {
      const id = await convertHabitToReminder(h.type);
      setMigration((m) =>
        m ? { habits: m.habits.filter((x) => x.type !== h.type), reminders: [...m.reminders, { id, name: h.title }] } : m,
      );
      void load();
    } catch {
      Alert.alert('Não consegui mover agora', 'Tente de novo em instantes.');
    } finally {
      setMoving(null);
    }
  };
  const moveToHabit = async (r: { id: number; name: string }) => {
    setMoving(`m${r.id}`);
    try {
      const type = await convertReminderToHabit(r.id);
      setMigration((m) =>
        m ? { reminders: m.reminders.filter((x) => x.id !== r.id), habits: [...m.habits, { type, title: r.name }] } : m,
      );
      void load();
    } catch {
      Alert.alert('Não consegui mover agora', 'Tente de novo em instantes.');
    } finally {
      setMoving(null);
    }
  };

  const unresolvedTonight =
    new Date().getHours() >= 18 &&
    (groups.forming.some((i) => ['pendente', 'sem_resposta'].includes(i.stats.today)) ||
      meds.some((m) => !m.done));

  const noHabits = !failed && items !== null && items.length === 0;

  return (
    <View style={styles.wrap}>
      {/* Comemoração pendente (marco, formado, regressão) — some quando vista. */}
      {celebration && (
        <Card style={styles.card}>
          <View style={styles.cardHead}>
            <GreekIcon name={celebration.kind === 'regressao' ? 'leaf' : 'sparkle'} size={18} color={colors.accent.gold} />
            <Text style={styles.cardLabel}>
              {celebration.kind === 'marco'
                ? `${celebration.n ?? ''} DIAS`.trim()
                : celebration.kind === 'graduado'
                  ? 'HÁBITO FORMADO'
                  : 'VAMOS REFORÇAR'}
            </Text>
          </View>
          <Text style={styles.cardText}>{celebration.text}</Text>
          <View style={styles.cardActions}>
            <SmallButton
              label={celebration.kind === 'regressao' ? 'Combinado' : 'Que bom'}
              primary
              onPress={() => {
                const id = celebration.id;
                setCelebration(null);
                dismissCelebration(id).catch(() => {});
              }}
            />
          </View>
        </Card>
      )}

      {/* ——— HOJE ——— */}
      {noHabits ? (
        <Card style={styles.card}>
          <Text style={styles.emptyTitle}>Comece por um hábito pequeno</Text>
          <Text style={styles.cardText}>
            Um só, ligado a algo que você já faz todo dia — depois do café, ao chegar em casa. Os avisos
            lembram no começo e vai soltando conforme ele se forma.
          </Text>
          <View style={{ height: spacing.md }} />
          <Button label="Criar meu primeiro hábito" onPress={() => navigation.navigate('HabitEdit')} />
        </Card>
      ) : (
        <>
        {/* ——— AGORA: um hábito de cada vez ——— */}
        {nowItem ? (
          <Card style={styles.card}>
            <Text style={styles.nowLabel}>
              AGORA · {nowItem.habit.scheduleTime}
            </Text>
            <Pressable
              onLongPress={() => setDayHabit(nowItem.habit)}
              onPress={() => navigation.navigate('HabitDetail', { type: nowItem.habit.type })}
              accessibilityRole="button"
              accessibilityLabel={`${nowItem.habit.title}. Abrir o hábito.`}
            >
              <Text style={styles.nowTitle}>{cap(nowItem.habit.title)}</Text>
              <Text style={styles.nowPlan}>{planSentence(nowItem.habit)}</Text>
            </Pressable>
            <View style={styles.nowBtns}>
              {nowItem.habit.action ? (
                <Pressable style={styles.nowPrimary} onPress={() => openTool(nowItem.habit.action!)} accessibilityRole="button">
                  <Text style={styles.nowPrimaryText}>{ACTION_INFO[nowItem.habit.action].label}</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.nowPrimary} onPress={() => void onTap(nowItem)} accessibilityRole="button">
                  <Text style={styles.nowPrimaryText}>Feito</Text>
                </Pressable>
              )}
              {nowItem.habit.minimum ? (
                <Pressable style={styles.nowSecondary} onPress={() => void onMinimum(nowItem)} accessibilityRole="button">
                  <Text style={styles.nowSecondaryText} numberOfLines={1}>
                    Mínima: {nowItem.habit.minimum}
                  </Text>
                </Pressable>
              ) : nowItem.habit.action ? (
                <Pressable style={styles.nowSecondary} onPress={() => void onTap(nowItem)} accessibilityRole="button">
                  <Text style={styles.nowSecondaryText}>Já fiz</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.nowFoot}>
              <Text style={[styles.nowMeta, nowItem.stats.chain.atRisk && { color: colors.accent.danger }]} numberOfLines={1}>
                {nowItem.stats.chain.length > 0
                  ? `Corrente de ${chainCount(nowItem.stats.chain)}${nowItem.stats.chain.atRisk ? ' · sem escudo' : ''}`
                  : 'Hoje começa a corrente'}
              </Text>
              <ShieldPips shields={nowItem.stats.chain.shields} cap={nowItem.stats.chain.cap} size={13} />
            </View>
            {/* Plano incompleto: sem pista ou sem versão mínima, o hábito depende de lembrar. */}
            {(!nowItem.habit.cue || !nowItem.habit.minimum) && (
              <Pressable
                onPress={() => navigation.navigate('HabitEdit', { type: nowItem.habit.type })}
                style={styles.nowFix}
                accessibilityRole="button"
              >
                <Text style={styles.nowFixText}>
                  {!nowItem.habit.cue ? 'Falta a pista: depois de quê você faz isto?' : 'Falta a versão mínima, para os dias ruins.'} Completar →
                </Text>
              </Pressable>
            )}
          </Card>
        ) : groups.total > 0 ? (
          <Card style={styles.card}>
            <Text style={styles.nowLabel}>AGORA</Text>
            <Text style={styles.nowTitle}>{perfect ? 'Tudo de hoje, feito' : 'Nada pendente agora'}</Text>
            <Text style={styles.nowPlan}>
              {perfect ? 'As correntes de hoje estão fechadas.' : 'O que falta hoje está na lista, mais abaixo.'}
            </Text>
          </Card>
        ) : null}

        {slot}

        {/* ——— AS CORRENTES: uma conta por dia, ligadas pelo fio ——— */}
        {(chainItems.length > 0 || (extraChains?.length ?? 0) > 0) && (
          <Card style={styles.card}>
            <Text style={styles.nowLabel}>AS CORRENTES · ÚLTIMOS 7 DIAS</Text>
            {chainItems.map((it) => (
              <Pressable
                key={it.habit.type}
                style={styles.beadRow}
                onPress={() => void onTap(it)}
                onLongPress={() => setDayHabit(it.habit)}
                delayLongPress={350}
                accessibilityRole="button"
                accessibilityLabel={`${it.habit.title}, ${chainA11y(it.stats.chain)}`}
                accessibilityHint={isDone(it.stats.today) ? 'Toque para desmarcar hoje.' : 'Toque para marcar hoje.'}
              >
                <View style={styles.beadHead}>
                  <Text style={styles.beadTitle} numberOfLines={1}>
                    {cap(it.habit.title)}
                  </Text>
                  <Text style={[styles.beadNote, it.stats.chain.atRisk && { color: colors.accent.danger }]}>
                    {it.stats.chain.length > 0 ? chainCount(it.stats.chain) : it.stats.chain.unit === 'semana' ? 'por semana' : ''}
                  </Text>
                  <ShieldPips shields={it.stats.chain.shields} cap={it.stats.chain.cap} size={12} />
                </View>
                <ChainLine chain={it.stats.chain} count={7} fill contas ink={BEAD_INK} r={8} height={30} />
              </Pressable>
            ))}
            {(extraChains ?? []).map((x) => (
              <Pressable key={x.key} style={styles.beadRow} onPress={x.onPress} accessibilityRole="button" accessibilityLabel={`${x.title}, ${x.note}`}>
                <View style={styles.beadHead}>
                  <Text style={styles.beadTitle} numberOfLines={1}>
                    {x.title}
                  </Text>
                  <Text style={styles.beadNote}>{x.note}</Text>
                </View>
                <ChainLine
                  chain={{ unit: 'dia', length: 0, best: 0, shields: 0, cap: 1, nextShieldIn: null, lost: null, beads: x.beads, atRisk: false }}
                  count={7}
                  fill
                  contas
                  ink={BEAD_INK}
                  r={8}
                  height={30}
                />
              </Pressable>
            ))}
            <Text style={styles.beadLegend}>
              Cheia: feito. Escudo: a falta que o escudo segurou. Tracejada em vermelho: o elo que partiu. Toque na linha para marcar hoje.
            </Text>
          </Card>
        )}

        <Card style={styles.card}>
          <Pressable
            style={styles.todayHead}
            onPress={() => setShowList((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showList }}
          >
            <Text style={styles.listTitle} accessibilityRole="header">
              Todos de hoje
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              {groups.total > 0 && (
                <Text style={styles.todayCount} accessibilityLabel={`${groups.done} de ${groups.total} feitos`}>
                  {groups.done} de {groups.total}
                </Text>
              )}
              <View style={{ transform: [{ rotate: showList ? '90deg' : '0deg' }] }}>
                <GreekIcon name="chevronRight" size={16} color={colors.text.tertiary} />
              </View>
            </View>
          </Pressable>
          {groups.total > 0 && (
            <View style={styles.progress}>
              <View
                style={[styles.progressFill, { width: `${Math.round((groups.done / groups.total) * 100)}%` }]}
              />
            </View>
          )}

          {perfect && (
            <View style={styles.perfect} accessibilityLiveRegion="polite">
              <GreekIcon name="sparkle" size={18} color={colors.accent.gold} />
              <Text style={styles.perfectText}>Dia perfeito — tudo de hoje, feito.</Text>
            </View>
          )}

          {failed && items?.length === 0 && (
            <Text style={styles.quiet}>Os hábitos não carregaram agora. Tente reabrir a tela.</Text>
          )}

          {(['manha', 'tarde', 'noite'] as HabitPeriod[]).map((p) =>
            !showList || groups.byPeriod[p].length === 0 ? null : (
              <View key={p}>
                <Text style={styles.period}>{PERIOD_LABEL[p]}</Text>
                {groups.byPeriod[p].map((it) => (
                  <HabitRow
                    key={it.habit.type}
                    item={it}
                    onPress={() => void onTap(it)}
                    onLongPress={() => setDayHabit(it.habit)}
                    onTool={it.habit.action ? () => openTool(it.habit.action!) : undefined}
                    onUrge={() => navigation.navigate('UrgeSurf', { type: it.habit.type })}
                    onSlip={() => setSlipHabit(it.habit)}
                  />
                ))}
              </View>
            ),
          )}

          {showList && groups.weekDone.length > 0 && (
            <CollapsedGroup
              label={`Feitos esta semana (${groups.weekDone.length})`}
              open={showWeekDone}
              onToggle={() => setShowWeekDone((v) => !v)}
            >
              {groups.weekDone.map((it) => (
                <CompactRow
                  key={it.habit.type}
                  item={it}
                  detail={`feito esta semana${it.stats.weekDone != null && it.habit.perWeek ? ` · ${it.stats.weekDone}/${it.habit.perWeek}` : ''}`}
                  onPress={() => void onTap(it)}
                  onLongPress={() => setDayHabit(it.habit)}
                />
              ))}
            </CollapsedGroup>
          )}

          {showList && groups.formed.length > 0 && (
            <CollapsedGroup
              label={`Formados (${groups.formed.length})`}
              open={showFormed}
              onToggle={() => setShowFormed((v) => !v)}
            >
              {groups.formed.map((it) => (
                <CompactRow
                  key={it.habit.type}
                  item={it}
                  detail={it.habit.cue ?? it.habit.scheduleTime}
                  onPress={() => void onTap(it)}
                  onLongPress={() => setDayHabit(it.habit)}
                />
              ))}
            </CollapsedGroup>
          )}

          {unresolvedTonight && (
            <Pressable style={styles.closeDay} onPress={() => navigation.navigate('Review')} accessibilityRole="button">
              <Text style={styles.closeDayText}>Fechar o dia</Text>
            </Pressable>
          )}
        </Card>
        </>
      )}

      {/* ——— LEMBRETES DE HOJE ——— */}
      {meds.length > 0 && (
        <Card style={styles.card}>
          <Pressable
            style={styles.cardHeadRow}
            onPress={() => navigation.navigate('Reminders')}
            accessibilityRole="button"
            accessibilityLabel="Lembretes de hoje — abrir lembretes"
          >
            <View style={styles.cardHead}>
              <GreekIcon name="bell" size={18} color={colors.accent.gold} />
              <Text style={styles.cardLabel}>LEMBRETES DE HOJE</Text>
            </View>
            <GreekIcon name="chevronRight" size={18} color={colors.text.tertiary} />
          </Pressable>
          {meds.map((m) => (
            <View key={m.key} style={styles.medRow}>
              <View style={styles.medTop}>
                <View style={styles.icon}>
                  <GreekIcon name={m.icon} size={20} color={m.done ? colors.text.tertiary : colors.text.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, m.done && !m.skipped && styles.doneText]} numberOfLines={1}>
                    {m.title}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {m.time}
                    {m.subtitle ? ` · ${m.subtitle}` : ''}
                  </Text>
                </View>
                {m.done && (
                  <Pressable
                    onPress={() => void medAction(m, 'undo')}
                    hitSlop={8}
                    style={styles.medStatus}
                    accessibilityRole="button"
                    accessibilityLabel={`${m.skipped ? 'Não hoje' : 'Feito'} — desfazer`}
                  >
                    <Text style={[styles.medStatusText, m.skipped && { color: colors.text.tertiary }]}>
                      {m.skipped ? 'Não hoje' : 'Feito'} ✕
                    </Text>
                  </Pressable>
                )}
              </View>
              {!m.done && (
                <View style={styles.medActions}>
                  <SmallButton
                    label={m.icon === 'pill' || m.icon === 'leaf' ? 'Já tomei' : 'Já fiz'}
                    primary
                    onPress={() => void medAction(m, 'done')}
                  />
                  <SmallButton label="Não hoje" onPress={() => void medAction(m, 'skip')} />
                </View>
              )}
            </View>
          ))}
        </Card>
      )}

      <View style={styles.links}>
        <Pressable
          onPress={() => navigation.navigate('HabitEdit')}
          style={styles.link}
          accessibilityRole="button"
        >
          <Text style={styles.linkText}>+ Novo hábito</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Habits')} style={styles.link} accessibilityRole="button">
          <Text style={styles.linkText}>Todos →</Text>
        </Pressable>
      </View>

      {/* ——— CARTÕES (só quando houver) ——— */}
      {migration && (
        <Card style={styles.card}>
          <View style={styles.cardHead}>
            <GreekIcon name="leaf" size={18} color={colors.accent.gold} />
            <Text style={styles.cardLabel}>HÁBITOS E LEMBRETES, SEPARADOS</Text>
          </View>
          <Text style={styles.cardText}>
            Separei o que estava em “Meus hábitos”: {migration.habits.length} viraram hábitos (os avisos vão
            rareando conforme se formam) e {migration.reminders.length} ficaram como lembretes (esses lembram
            sempre). Algo no lugar errado? Mova.
          </Text>
          {migration.habits.length > 0 && <Text style={styles.subLabel}>Hábitos</Text>}
          {migration.habits.map((h) => (
            <View key={h.type} style={styles.moveRow}>
              <Text style={styles.moveName} numberOfLines={1}>
                {cap(h.title)}
              </Text>
              <SmallButton
                label="→ lembrete"
                onPress={() => void moveToReminder(h)}
                disabled={moving === h.type}
              />
            </View>
          ))}
          {migration.reminders.length > 0 && <Text style={styles.subLabel}>Lembretes</Text>}
          {migration.reminders.map((r) => (
            <View key={r.id} style={styles.moveRow}>
              <Text style={styles.moveName} numberOfLines={1}>
                {r.name}
              </Text>
              <SmallButton label="→ hábito" onPress={() => void moveToHabit(r)} disabled={moving === `m${r.id}`} />
            </View>
          ))}
          <View style={styles.cardActions}>
            <SmallButton
              label="Está certo"
              primary
              onPress={() => {
                setMigration(null);
                dismissMigrationReview().catch(() => {});
              }}
            />
          </View>
        </Card>
      )}

      {slipContexts.length > 0 && (
        <Card style={styles.card}>
          <View style={styles.cardHead}>
            <GreekIcon name="leaf" size={18} color={colors.accent.gold} />
            <Text style={styles.cardLabel}>UM DESLIZE PARA ANOTAR</Text>
          </View>
          <Text style={styles.cardText}>
            Você marcou “Escorreguei” pela notificação. Onde estava, como se sentia? Um toque basta — é o que
            faz o padrão aparecer.
          </Text>
          {slipContexts.map((h) => (
            <View key={h.type} style={styles.moveRow}>
              <Text style={styles.moveName} numberOfLines={1}>
                {cap(h.title)}
              </Text>
              <SmallButton label="Anotar" primary onPress={() => setContextHabit(h)} />
              <SmallButton
                label="Agora não"
                onPress={() => {
                  setSlipContexts((l) => l.filter((x) => x.type !== h.type));
                  dismissSlipContext(h.type).catch(() => {});
                }}
              />
            </View>
          ))}
        </Card>
      )}

      {dueSrbai.length > 0 && (
        <Card style={styles.card}>
          <View style={styles.cardHead}>
            <GreekIcon name="brain" size={18} color={colors.accent.gold} />
            <Text style={styles.cardLabel}>JÁ SAI SEM PENSAR?</Text>
          </View>
          <Text style={styles.cardText}>
            Quatro perguntas rápidas dizem se o hábito já está automático — e se os avisos podem rarear.
          </Text>
          {dueSrbai.map((h) => (
            <View key={h.type} style={styles.moveRow}>
              <Text style={styles.moveName} numberOfLines={1}>
                {cap(h.title)}
              </Text>
              <SmallButton label="Responder" primary onPress={() => setSrbaiHabit(h)} />
            </View>
          ))}
        </Card>
      )}

      {recomeco && recomeco.habits.length > 0 && (
        <Card style={styles.card}>
          <View style={styles.cardHead}>
            <GreekIcon name="sun" size={18} color={colors.accent.gold} />
            <Text style={styles.cardLabel}>
              {recomeco.reason === 'semana' ? 'SEMANA NOVA, RECOMEÇO' : 'MÊS NOVO, RECOMEÇO'}
            </Text>
          </View>
          <Text style={styles.cardText}>
            Estes tropeçaram nos últimos dias. Quase sempre é o plano, não você: uma pista mais concreta ou uma
            versão mínima menor costuma destravar.
          </Text>
          {recomeco.habits.map((h) => (
            <View key={h.type} style={styles.moveRow}>
              <Text style={styles.moveName} numberOfLines={1}>
                {cap(h.title)}
              </Text>
              <SmallButton label="Ajustar" onPress={() => navigation.navigate('HabitEdit', { type: h.type })} />
            </View>
          ))}
          <View style={styles.cardActions}>
            <SmallButton
              label="Dispensar"
              onPress={() => {
                setRecomeco(null);
                dismissRecomeco().catch(() => {});
              }}
            />
          </View>
        </Card>
      )}

      {weeklyCard && (
        <Card style={styles.card}>
          <View style={styles.cardHead}>
            <GreekIcon name="stats" size={18} color={colors.accent.gold} />
            <Text style={styles.cardLabel}>REVISÃO DA SEMANA</Text>
          </View>
          <Text style={styles.cardText}>Cinco minutos para olhar a semana e ajustar o plano do que emperrou.</Text>
          <View style={styles.cardActions}>
            <SmallButton label="Revisar" primary onPress={() => navigation.navigate('WeeklyReview')} />
            <SmallButton
              label="Agora não"
              onPress={() => {
                setWeeklyCard(false);
                dismissWeeklyReviewCard(reviewWeekStart()).catch(() => {});
              }}
            />
          </View>
        </Card>
      )}

      {/* ——— folhas ——— */}
      <HabitDaySheet
        visible={!!dayHabit}
        habit={dayHabit}
        onClose={() => setDayHabit(null)}
        onChanged={(r) => {
          if (dayHabit) handleResult(r, dayHabit);
          void load();
        }}
        onOpenHabit={(type) => navigation.navigate('HabitDetail', { type })}
        onSlip={() => dayHabit && setSlipHabit(dayHabit)}
      />
      <SrbaiSheet
        visible={!!srbaiHabit}
        habit={srbaiHabit}
        onClose={() => setSrbaiHabit(null)}
        onDone={() => void load()}
      />
      <SlipSheet visible={!!slipHabit} habit={slipHabit} onClose={() => setSlipHabit(null)} onSaved={() => void load()} />
      <SlipSheet
        mode="context"
        visible={!!contextHabit}
        habit={contextHabit}
        onClose={() => setContextHabit(null)}
        onSaved={() => void load()}
      />
      <HabitCelebration
        visible={!!party}
        title={party?.title ?? ''}
        text={party?.text ?? ''}
        onClose={() => setParty(null)}
      />
    </View>
  );
}

// ————————————————— linhas —————————————————

function HabitRow({
  item,
  onPress,
  onLongPress,
  onTool,
  onUrge,
  onSlip,
}: {
  item: TodayHabit;
  onPress: () => void;
  onLongPress: () => void;
  onTool?: () => void;
  onUrge: () => void;
  onSlip: () => void;
}) {
  const { habit, stats } = item;
  const st = stats.today;
  const parar = habit.kind === 'parar';
  const done = isDone(st);

  // O ✓ dá um pulinho quando o hábito vira feito (e só nessa hora).
  const scale = useRef(new Animated.Value(1)).current;
  const prev = useRef(st);
  useEffect(() => {
    if (!isDone(prev.current) && isDone(st)) {
      scale.setValue(0.6);
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
    }
    prev.current = st;
  }, [st, scale]);

  const meta = parar
    ? cleanDaysText(stats.cleanDays)
    : [habit.cue, habit.scheduleTime].filter(Boolean).join(' · ');

  const stateLabel =
    st === 'feito'
      ? parar
        ? 'dia limpo'
        : 'feito'
      : st === 'minimo'
        ? 'versão mínima'
        : st === 'parcial'
          ? 'parcial'
          : st === 'folga'
            ? 'folga'
            : st === 'nao'
              ? parar
                ? 'deslize'
                : 'não fiz'
              : 'pendente';

  return (
    <View style={styles.rowWrap}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityLabel={`${habit.title}, ${stateLabel}, ${parar ? `força ${Math.round(stats.strength * 100)}%` : chainA11y(stats.chain)}`}
        accessibilityHint={
          done ? 'Toque para desmarcar. Toque longo para mais opções.' : 'Toque para marcar. Toque longo para mais opções.'
        }
      >
        <View style={styles.icon}>
          <HabitIcon emoji={habit.emoji} size={22} color={done ? colors.text.tertiary : colors.text.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, done && styles.doneText]} numberOfLines={1}>
            {cap(habit.title)}
          </Text>
          {meta ? (
            <Text style={styles.meta} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
          {/* a corrente: o que se perde se hoje falhar */}
          {!parar && <ChainStrip chain={stats.chain} />}
        </View>
        {parar && <StrengthRing value={stats.strength} size={34} />}
        <Animated.View style={[styles.state, { transform: [{ scale }] }]}>
          <StateMark item={item} />
        </Animated.View>
      </Pressable>

      {parar && (
        <View style={styles.subActions}>
          <SmallButton label="Vontade agora" onPress={onUrge} />
          <SmallButton label="Escorreguei" onPress={onSlip} />
        </View>
      )}
      {!parar && onTool && !done && (
        <View style={styles.subActions}>
          <SmallButton label={ACTION_INFO[habit.action!].label} onPress={onTool} />
        </View>
      )}
    </View>
  );
}

/** O estado do dia, à direita: ✓ cheio, ✓ claro (mínimo), número (parcial), palavra (folga/não). */
function StateMark({ item }: { item: TodayHabit }) {
  const { habit, stats } = item;
  const st = stats.today;
  if (st === 'feito' || st === 'minimo') {
    return (
      <View style={[styles.check, styles.checkOn, st === 'minimo' && { opacity: 0.65 }]}>
        <GreekIcon name="check" size={18} color={colors.text.onGold} strokeWidth={2.4} />
      </View>
    );
  }
  if (st === 'parcial') {
    return (
      <Text style={styles.stateWord}>
        {stats.todayValue ?? 0}/{habit.target ?? '?'}
      </Text>
    );
  }
  if (st === 'folga') return <Text style={styles.stateWord}>folga</Text>;
  if (st === 'nao') return <Text style={styles.stateWord}>{habit.kind === 'parar' ? 'deslize' : 'não'}</Text>;
  return <View style={styles.check} />;
}

function CompactRow({
  item,
  detail,
  onPress,
  onLongPress,
}: {
  item: TodayHabit;
  detail: string;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const done = isDone(item.stats.today) || item.doneForWeek;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={styles.compact}
      accessibilityRole="button"
      accessibilityLabel={`${item.habit.title}, ${detail}`}
    >
      <View style={styles.icon}>
        <HabitIcon emoji={item.habit.emoji} size={18} color={colors.text.tertiary} />
      </View>
      <Text style={[styles.compactTitle, done && styles.doneText]} numberOfLines={1}>
        {cap(item.habit.title)}
      </Text>
      <Text style={styles.compactDetail} numberOfLines={1}>
        {detail}
      </Text>
      <View style={styles.compactState}>
        <StateMark item={item} />
      </View>
    </Pressable>
  );
}

function CollapsedGroup({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.group}>
      <Pressable
        onPress={onToggle}
        style={styles.groupHead}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.groupLabel}>{label}</Text>
        <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
          <GreekIcon name="chevronRight" size={16} color={colors.text.tertiary} />
        </View>
      </Pressable>
      {open && children}
    </View>
  );
}

export function SmallButton({
  label,
  onPress,
  primary,
  disabled,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      hitSlop={4}
      style={({ pressed }) => [
        styles.smallBtn,
        primary && styles.smallBtnPrimary,
        pressed && { opacity: 0.85 },
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text style={[styles.smallBtnText, primary && { color: colors.text.onGold }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.sm },
  card: { marginBottom: spacing.lg },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 },
  cardHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
    marginBottom: spacing.xs,
  },
  cardLabel: { ...typography.label, color: colors.accent.gold, textTransform: 'uppercase', flexShrink: 1 },
  cardText: { ...typography.body, color: colors.text.secondary, marginTop: spacing.sm, lineHeight: 22 },
  cardActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' },
  subLabel: {
    ...typography.label,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    marginTop: spacing.md,
  },
  moveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
  },
  moveName: { ...typography.bodyMedium, color: colors.text.primary, flex: 1 },
  emptyTitle: { ...typography.subtitle, color: colors.text.primary },

  nowLabel: { ...typography.label, color: colors.text.tertiary, textTransform: 'uppercase' },
  nowTitle: { ...typography.title, color: colors.text.primary, marginTop: spacing.xs },
  nowPlan: { ...typography.body, fontSize: 15, lineHeight: 21, color: colors.text.secondary, marginTop: 2 },
  nowBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  nowPrimary: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.accent.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  nowPrimaryText: { ...typography.button, color: colors.text.onGold },
  nowSecondary: {
    minHeight: 46,
    maxWidth: '55%',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  nowSecondaryText: { ...typography.button, fontSize: 14, color: colors.accent.gold },
  nowFoot: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  nowMeta: { ...typography.small, color: colors.text.tertiary, flexShrink: 1 },
  nowFix: { marginTop: spacing.sm, minHeight: 36, justifyContent: 'center' },
  nowFixText: { ...typography.small, color: colors.accent.gold, lineHeight: 18 },

  beadRow: { paddingTop: spacing.md },
  beadHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  beadTitle: { ...typography.bodyMedium, fontSize: 15, color: colors.text.primary, flex: 1 },
  beadNote: { ...typography.small, color: colors.text.secondary },
  beadLegend: { ...typography.small, fontSize: 12, lineHeight: 17, color: colors.text.tertiary, marginTop: spacing.md },
  listTitle: { ...typography.subtitle, color: colors.text.primary },

  todayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 },
  todayTitle: { ...typography.title, color: colors.text.primary },
  todayCount: { ...typography.bodyMedium, color: colors.text.secondary },
  progress: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bg.surfaceStrong,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  progressFill: { height: '100%', backgroundColor: colors.accent.gold, borderRadius: 3 },
  perfect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: withAlpha(colors.accent.gold, 0.14),
  },
  perfectText: { ...typography.bodyMedium, color: colors.text.primary, flex: 1 },
  quiet: { ...typography.small, color: colors.text.tertiary, marginTop: spacing.md },
  period: {
    ...typography.label,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },

  rowWrap: { borderTopWidth: 1, borderTopColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 60, paddingVertical: spacing.sm },
  icon: { width: 28, alignItems: 'center' },
  title: { ...typography.bodyMedium, color: colors.text.primary },
  doneText: { color: colors.text.tertiary },
  meta: { ...typography.small, color: colors.text.secondary, marginTop: 1 },
  state: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  check: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.accent.gold, borderColor: colors.accent.gold },
  stateWord: { ...typography.small, color: colors.text.tertiary, textAlign: 'center' },
  subActions: { flexDirection: 'row', gap: spacing.sm, paddingLeft: 36, paddingBottom: spacing.sm, flexWrap: 'wrap' },

  group: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  groupLabel: { ...typography.bodyMedium, color: colors.text.secondary },
  compact: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  compactTitle: { ...typography.body, color: colors.text.primary, flexShrink: 1 },
  compactDetail: { ...typography.small, color: colors.text.tertiary, flex: 1, textAlign: 'right' },
  compactState: { width: 40, alignItems: 'center' },

  closeDay: {
    marginTop: spacing.md,
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accent.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeDayText: { ...typography.bodyMedium, color: colors.text.onGold },

  medRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: spacing.xs },
  medTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52 },
  medStatus: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
  medStatusText: { ...typography.small, color: colors.accent.gold },
  medActions: { flexDirection: 'row', gap: spacing.sm, paddingLeft: 36, paddingBottom: spacing.sm },

  links: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
  },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
  linkText: { ...typography.bodyMedium, color: colors.accent.gold },

  smallBtn: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnPrimary: { backgroundColor: colors.accent.gold },
  smallBtnText: { ...typography.small, fontFamily: typography.label.fontFamily, color: colors.accent.gold },
});
