import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import Svg, { Circle } from 'react-native-svg';
import { Simbolo } from '../components/Simbolo';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { HealthCard } from '../components/HealthCard';
import { GreekIcon } from '../components/GreekIcon';
import { ScreenContainer } from '../components/ScreenContainer';
import { colors, radius, spacing, typography } from '../theme';
import { getDashboardData, markSleepDone, rearmSleepReminders } from '../services/coach';
import { SequenceCard } from '../components/SequenceCard';
import { InspirationHomeCard } from '../components/InspirationHomeCard';
import { HabitsTodaySection } from '../components/HabitsTodaySection';
import { useSnackbar } from '../components/Snackbar';
import { checkExerciseEvidence } from '../services/exerciseDetection';
import { cancelSleepEscalationReminders } from '../services/notifications';
import { checkForUpdate, type UpdateInfo } from '../services/updateChecker';
import { dayKey, useKinesis } from '../kinesis/store';
import { PHASE_LABEL, fmtTime, remainingSeconds, type TimerState } from '../kinesis/timer';
import { useZazen } from '../zazen/store';

// A aba ARETÉ (v1.134): o painel "Hoje". Um hábito de cada vez no cartão
// "Agora", os três módulos de saúde à mão (Zazen, Kinesis, sono) e as correntes
// da semana como contas num fio. A Comentora que conversa (chat e voz) saiu da
// tela por enquanto, a pedido (16/11/2026): ficam os avisos.

interface Dashboard {
  config: { bedtime: string; name: string | null };
  minutesToBedtime: number | null;
  todayLog: { completed: boolean } | null;
  sleepHabit: { id: number } | null;
}

function formatCountdown(mins: number): { value: string; unit: string } {
  if (mins < 0) {
    const late = Math.abs(mins);
    if (late < 60) return { value: `${late}`, unit: 'min atrasado' };
    return { value: `${Math.floor(late / 60)}h${String(late % 60).padStart(2, '0')}`, unit: 'atrasado' };
  }
  if (mins < 60) return { value: `${mins}`, unit: 'min até dormir' };
  return { value: `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}`, unit: 'até dormir' };
}


/** As contas dos últimos 7 dias de um módulo que ainda não é hábito: feito ou vazio, hoje em aberto. */
function beadsOf(done: (day: string) => boolean): string {
  let out = '';
  for (let i = 6; i >= 0; i--) {
    const ok = done(dayKey(Date.now() - i * 86_400_000));
    out += ok ? 'F' : i === 0 ? 'H' : 'N';
  }
  return out;
}

function DayRing({ done, total }: { done: number; total: number }) {
  const size = 54;
  const sw = 5;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const v = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <View style={{ width: size, height: size }} accessible accessibilityLabel={`${done} de ${total} hábitos feitos hoje`}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.bg.surfaceStrong} strokeWidth={sw} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={v >= 1 ? colors.accent.success : colors.accent.gold}
          strokeWidth={sw}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={styles.ringText}>
          {done}/{total}
        </Text>
      </View>
    </View>
  );
}

function Tile({ label, value, unit, onPress, on }: { label: string; value: string; unit: string; onPress: () => void; on?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, on && styles.tileOn, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value} ${unit}`}
    >
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.tileUnit} numberOfLines={1}>
        {unit}
      </Text>
    </Pressable>
  );
}

export function HomeScreen() {
  const navigation = useNavigation<any>();
  const focused = useIsFocused();
  const [data, setData] = useState<Dashboard | null>(null);
  const [marking, setMarking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  // A seção de hábitos relê junto com a Home (foco e a cada 30 s).
  const [habitsKey, setHabitsKey] = useState(0);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  // Muda a cada hábito marcado e a cada volta à tela: Atena olha e pisca.
  const [olharKey, setOlharKey] = useState(0);
  const snackbar = useSnackbar();

  const zazenDias = useZazen((s) => s.dias);
  const zazenSessao = useZazen((s) => s.sessao);
  const kinHistory = useKinesis((s) => s.history);
  const kinTimer = useKinesis((s) => s.timer);

  useEffect(() => {
    // Throttled background check (only fires if 6h+ since last check).
    checkForUpdate(false).then((info) => {
      if (info.available) setUpdateInfo(info);
    });
  }, []);

  const reload = useCallback(async () => {
    const d = await getDashboardData();
    setData({
      config: { bedtime: d.config.bedtime, name: d.config.name },
      minutesToBedtime: d.minutesToBedtime,
      todayLog: d.todayLog ? { completed: d.todayLog.completed } : null,
      sleepHabit: d.sleepHabit ? { id: d.sleepHabit.id } : null,
    });
    // Treino gravado no relógio confirma o hábito de exercício (no máx. uma
    // leitura a cada 10 min); a seção de hábitos relê depois, já atualizada.
    await checkExerciseEvidence().catch(() => []);
    setHabitsKey((k) => k + 1);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
      setOlharKey((k) => k + 1);
      const interval = setInterval(reload, 30_000);
      return () => clearInterval(interval);
    }, [reload]),
  );

  const handleMarkDone = async () => {
    if (!data?.sleepHabit) return;
    setMarking(true);
    try {
      await markSleepDone(data.sleepHabit.id);
      // Só encerra a corrente de lembretes do sono desta noite — preserva
      // os nudges de inspiração, de conscientização e os diários.
      await cancelSleepEscalationReminders();
      // …e arma as noites seguintes (a desta noite fica de fora: já foi dormir).
      await rearmSleepReminders().catch(() => {});
      await reload();
    } finally {
      setMarking(false);
    }
  };

  const onProgress = useCallback((done: number, total: number) => setProgress({ done, total }), []);
  const onMarked = useCallback(() => setOlharKey((k) => k + 1), []);

  const asleep = !!data?.todayLog?.completed;
  const countdown =
    data?.minutesToBedtime !== null && data?.minutesToBedtime !== undefined ? formatCountdown(data.minutesToBedtime) : null;
  const late = data?.minutesToBedtime != null && data.minutesToBedtime < 0;
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 6) return 'Boa madrugada';
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  })();
  const dateLine = new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' });

  // Zazen e Kinesis: os números de hoje e as contas da semana (ainda sem escudo:
  // viram hábitos de verdade, com fonte automática, na próxima etapa).
  const today = dayKey();
  const zazenMin = Math.round(zazenDias[today] ?? 0);
  const kinByDay = useMemo(() => {
    const m: Record<string, number> = {};
    for (const h of kinHistory) m[h.date] = (m[h.date] ?? 0) + 1;
    return m;
  }, [kinHistory]);
  const kinToday = kinByDay[today] ?? 0;
  const kinRunning = !!kinTimer?.running;
  const goZazen = () => navigation.navigate('Main', { screen: 'Zazen' });
  const goKinesis = () => navigation.navigate('Main', { screen: 'Kinesis' });
  const extraChains = [
    {
      key: 'zazen',
      title: 'Zazen',
      beads: beadsOf((d) => (zazenDias[d] ?? 0) > 0),
      note: zazenMin > 0 ? `${zazenMin} min hoje` : 'hoje ainda não',
      onPress: goZazen,
    },
    {
      key: 'kinesis',
      title: 'Kinesis',
      beads: beadsOf((d) => (kinByDay[d] ?? 0) > 0),
      note: kinToday > 0 ? `${kinToday} ${kinToday === 1 ? 'pausa' : 'pausas'} hoje` : kinRunning ? 'rodando' : 'hoje ainda não',
      onPress: goKinesis,
    },
  ];

  const sleepTile = asleep ? (
    <Tile label="SONO" value="Boa noite" unit="até amanhã" onPress={() => {}} on />
  ) : (
    <Tile
      label="SONO"
      value={countdown?.value ?? data?.config.bedtime ?? '—'}
      unit={countdown?.unit ?? 'hora de dormir'}
      onPress={() =>
        Alert.alert('Vou dormir agora', 'Marco que você foi dormir e paro os avisos desta noite.', [
          { text: 'Ainda não', style: 'cancel' },
          { text: 'Vou dormir', onPress: () => void handleMarkDone() },
        ])
      }
    />
  );

  return (
    <ScreenContainer edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {updateInfo?.available && updateInfo.latestVersion && (
          <Pressable
            onPress={() => {
              const url = updateInfo.downloadUrl ?? updateInfo.releaseUrl;
              if (url) Linking.openURL(url);
            }}
            style={styles.updateBanner}
          >
            <GreekIcon name="sparkle" size={18} color={colors.accent.gold} />
            <Text style={styles.updateBannerText}>
              Atualização: v{updateInfo.latestVersion} disponível — toque para baixar
            </Text>
          </Pressable>
        )}

        {kinRunning && kinTimer && <KinesisFaixa timer={kinTimer} ativo={focused} onPress={goKinesis} />}

        <View style={styles.header}>
          <Pressable onPress={() => setOlharKey((k) => k + 1)} accessibilityLabel="Símbolo da Areté">
            <Simbolo size={84} dormindo={asleep} olharKey={olharKey} animated={focused} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.greeting} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
              {greeting}
              {data?.config.name ? `,\n${data.config.name}` : ''}
            </Text>
            <Text style={styles.dateLine} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {dateLine}
            </Text>
          </View>
          {progress.total > 0 && <DayRing done={progress.done} total={progress.total} />}
          <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={10} accessibilityLabel="Configurações" style={styles.gear}>
            <GreekIcon name="settings" size={22} color={colors.text.secondary} />
          </Pressable>
        </View>

        <HabitsTodaySection
          refreshKey={habitsKey}
          snack={snackbar.show}
          onProgress={onProgress}
          onMarked={onMarked}
          extraChains={extraChains}
          slot={
            <View style={styles.tiles}>
              <Tile
                label="ZAZEN"
                value={zazenSessao ? 'sentado' : `${zazenMin}`}
                unit={zazenSessao ? 'agora' : 'min hoje'}
                onPress={goZazen}
                on={zazenMin > 0}
              />
              <Tile
                label="KINESIS"
                value={kinRunning ? 'ligado' : `${kinToday}`}
                unit={kinRunning ? `${kinToday} ${kinToday === 1 ? 'pausa' : 'pausas'}` : kinToday === 1 ? 'pausa hoje' : 'pausas'}
                onPress={goKinesis}
                on={kinToday > 0}
              />
              {sleepTile}
            </View>
          }
        />

        <Text style={styles.section}>FERRAMENTAS</Text>
        <View style={styles.tools}>
          <View style={styles.tool}>
            <Button label="Respiração" variant="secondary" onPress={() => navigation.navigate('Breathing')} />
          </View>
          <View style={styles.tool}>
            <Button label="Ioga Nidra" variant="secondary" onPress={() => navigation.navigate('YogaNidra')} />
          </View>
          <View style={styles.tool}>
            <Button label="Leia para mim" variant="secondary" onPress={() => navigation.navigate('ReadAloud')} />
          </View>
          {!asleep && (
            <View style={styles.tool}>
              <Button label="Vou dormir agora" variant="secondary" onPress={handleMarkDone} loading={marking} />
            </View>
          )}
        </View>

        {/* Playlist: tocar respiração + ioga nidra + leia para mim em sequência. */}
        <SequenceCard />

        <InspirationHomeCard />
        <HealthCard />

        <Pressable onPress={() => navigation.navigate('History')} style={styles.historyLink}>
          <Text style={[typography.bodyMedium, { color: colors.accent.gold }]}>Ver estatísticas →</Text>
        </Pressable>
      </ScrollView>
      {/* "Feito: … · Desfazer" — fica no pé da tela, por cima do que rola. */}
      {snackbar.node}
    </ScreenContainer>
  );
}

/** O Kinesis ligado, à vista no alto da Areté (pedido de 16/11/2026): a fase,
 *  o tempo que falta e a série; um toque abre o Kinesis. */
function KinesisFaixa({ timer, ativo, onPress }: { timer: TimerState; ativo: boolean; onPress: () => void }) {
  const [, setBatida] = useState(0);
  useEffect(() => {
    if (!ativo) return;
    const id = setInterval(() => {
      useKinesis.getState().tick(); // põe o timer em dia: as fases mudam mesmo fora da aba dele
      setBatida((n) => n + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [ativo]);
  const chamando = timer.phase === 'rest' || timer.phase === 'snooze';
  const fase = timer.paused ? 'pausado' : timer.phase === 'work' ? 'trabalhando' : PHASE_LABEL[timer.phase].toLocaleLowerCase('pt-BR');
  const falta = timer.paused ? timer.pauseRemainingMs / 1000 : remainingSeconds(timer, Date.now());
  return (
    <Pressable
      onPress={onPress}
      style={[styles.kinFaixa, chamando && styles.kinFaixaChamando]}
      accessibilityRole="button"
      accessibilityLabel={`Kinesis ligado, ${fase}, faltam ${fmtTime(falta)}`}
    >
      <View style={[styles.kinPonto, chamando && { backgroundColor: colors.accent.gold }]} />
      <Text style={styles.kinRotulo}>KINESIS</Text>
      <Text style={styles.kinFase} numberOfLines={1}>
        {fase} · {timer.currentSet}/{timer.config.sets}
      </Text>
      <Text style={styles.kinTempo}>{fmtTime(falta)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    marginBottom: spacing.lg,
  },
  headerText: { flex: 1 },
  greeting: { ...typography.subtitle, color: colors.text.primary },
  dateLine: { ...typography.small, color: colors.text.secondary, marginTop: 1 },
  gear: { alignSelf: 'flex-start', paddingTop: 2 },
  ringText: { ...typography.label, fontSize: 13, letterSpacing: 0, color: colors.text.primary },
  tiles: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  tile: {
    flex: 1,
    minHeight: 86,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  tileOn: { borderColor: colors.accent.success },
  tileLabel: { ...typography.label, fontSize: 11, color: colors.text.tertiary },
  tileValue: { ...typography.title, fontSize: 22, lineHeight: 28, color: colors.text.primary, marginTop: 4 },
  tileUnit: { ...typography.small, fontSize: 12, lineHeight: 16, color: colors.text.secondary },
  section: { ...typography.label, color: colors.text.tertiary, marginTop: spacing.sm, marginBottom: spacing.sm },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  tool: { flexBasis: '47%', flexGrow: 1 },
  historyLink: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  kinFaixa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    minHeight: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  kinFaixaChamando: { borderColor: colors.accent.gold, backgroundColor: 'rgba(244,197,83,0.14)' },
  kinPonto: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent.success },
  kinRotulo: { ...typography.label, color: colors.text.secondary },
  kinFase: { ...typography.small, color: colors.text.primary, flex: 1 },
  kinTempo: { ...typography.bodyMedium, color: colors.text.primary, fontVariant: ['tabular-nums'] },
  updateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    backgroundColor: 'rgba(244,197,83,0.18)',
    borderColor: colors.accent.gold,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  updateBannerText: {
    ...typography.bodyMedium,
    color: colors.accent.gold,
    textAlign: 'center',
  },
});
