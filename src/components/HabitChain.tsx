// A CORRENTE dos hábitos (v1.132, pedido de 14/11/2026): os dias feitos como
// elos de uma linha, os escudos que seguram uma falta e o cartão do detalhe.
//
// Por que uma corrente: ver a fila de dias feitos e saber que uma falta a parte
// inteira é o que faz a pessoa protegê-la (aversão à perda — o mesmo motor da
// ofensiva do Duolingo). O escudo é o "congelamento": uma falta isolada não
// destrói semanas de repetição (Lally et al. 2010 — perder uma oportunidade não
// afeta a formação), mas a folga tem de ser conquistada.
//
// Cores só do tema: elo = destaque, escudo = lavanda, quebra = vermelho de
// cerâmica. A regra mora em services/habitStrength.ts (chainOf).

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import { colors, spacing, typography } from '../theme';
import { CHAIN_RULES, nextChainMilestone, SHIELD_MAX } from '../services/habitStrength';
import type { HabitChain } from '../types/habits';
import { ECOLOGICO, ESPACIAL } from '../theme/tema';
import { shortDate, withAlpha } from './habitShared';

/** O escudo: lavanda no espacial e no Gaia; na terracota, o creme (o branco
 *  acrescentado dos vasos) — a lavanda de lá é marrom e some no fundo. */
const SHIELD_COLOR = ESPACIAL || ECOLOGICO ? colors.accent.lavender : colors.text.onGold;

const SHIELD_D = 'M12 2.5 L19.5 5.2 V11 C19.5 15.9 16.4 19.6 12 21.5 C7.6 19.6 4.5 15.9 4.5 11 V5.2 Z';

// ————————————————— textos —————————————————

/** "dia"/"dias" ou "semana"/"semanas". */
export function chainUnitWord(unit: HabitChain['unit'], n: number): string {
  if (unit === 'semana') return n === 1 ? 'semana' : 'semanas';
  return n === 1 ? 'dia' : 'dias';
}

/** "12 dias", "1 semana". */
export function chainCount(chain: Pick<HabitChain, 'unit' | 'length'>): string {
  return `${chain.length} ${chainUnitWord(chain.unit, chain.length)}`;
}

/** Para leitores de tela: "corrente de 12 dias, 1 escudo". */
export function chainA11y(chain: HabitChain): string {
  const sh = chain.shields === 0 ? 'sem escudo' : chain.shields === 1 ? '1 escudo' : `${chain.shields} escudos`;
  return chain.length > 0 ? `corrente de ${chainCount(chain)}, ${sh}` : `sem corrente ainda, ${sh}`;
}

function shieldLine(chain: HabitChain): string {
  const k = chain.nextShieldIn ?? 0;
  const done = (chain.unit === 'semana' ? 'cumprida' : 'feito') + (k === 1 ? '' : 's');
  const next = chain.nextShieldIn != null ? ` O próximo vem com mais ${k} ${chainUnitWord(chain.unit, k)} ${done}.` : '';
  if (chain.shields >= 2) return `2 escudos: seguram duas faltas.${next}`;
  if (chain.shields === 1) return `1 escudo: segura uma falta.${next}`;
  return `Sem escudo: a próxima falta parte a corrente.${next}`;
}

/**
 * O elo de hoje fechado na hora do toque (antes de a tela reler as contas):
 * a conta pendente vira feita e a corrente cresce. Só no hábito diário — na
 * semana, um dia feito nem sempre fecha a cota.
 */
export function chainDoneToday(chain: HabitChain): HabitChain {
  if (chain.unit !== 'dia' || !chain.beads.endsWith('H')) return chain;
  const { earnEvery, capAt } = CHAIN_RULES.dia;
  const length = chain.length + 1;
  const cap = length >= capAt ? SHIELD_MAX : 1;
  const shields = length % earnEvery === 0 ? Math.min(cap, chain.shields + 1) : chain.shields;
  return {
    ...chain,
    length,
    best: Math.max(chain.best, length),
    cap,
    shields,
    nextShieldIn: shields >= cap ? null : earnEvery - (length % earnEvery),
    beads: `${chain.beads.slice(0, -1)}F`,
    atRisk: false,
  };
}

/**
 * O contrário de chainDoneToday: o elo de hoje desfeito na hora do toque
 * (a releitura das contas acerta escudos e recorde logo depois).
 */
export function chainUndoneToday(chain: HabitChain): HabitChain {
  if (chain.unit !== 'dia' || !chain.beads.endsWith('F')) return chain;
  const { earnEvery } = CHAIN_RULES.dia;
  const hadShieldNow = chain.length % earnEvery === 0 && chain.shields > 0;
  const length = Math.max(0, chain.length - 1);
  const shields = hadShieldNow ? chain.shields - 1 : chain.shields;
  return {
    ...chain,
    length,
    shields,
    nextShieldIn: shields >= chain.cap ? null : earnEvery - (length % earnEvery),
    beads: `${chain.beads.slice(0, -1)}H`,
  };
}

// ————————————————— escudos —————————————————

/** O escudo, sozinho (cheio = guardado; vazado = espaço livre). */
export function ShieldGlyph({ size = 14, filled = true, color = SHIELD_COLOR }: { size?: number; filled?: boolean; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={SHIELD_D}
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        opacity={filled ? 1 : 0.45}
      />
    </Svg>
  );
}

/** Os escudos guardados e os espaços livres (1 na primeira semana, 2 depois). */
export function ShieldPips({ shields, cap, size = 14 }: { shields: number; cap: number; size?: number }) {
  const slots = Math.max(1, Math.min(SHIELD_MAX, cap));
  return (
    <View
      style={{ flexDirection: 'row', gap: 2 }}
      accessibilityLabel={shields === 0 ? 'sem escudo' : `${shields} ${shields === 1 ? 'escudo' : 'escudos'}`}
    >
      {Array.from({ length: slots }, (_, i) => (
        <ShieldGlyph key={i} size={size} filled={i < shields} />
      ))}
    </View>
  );
}

// ————————————————— a linha de elos —————————————————

/**
 * Os últimos `count` elos da corrente, ligados por uma linha. Feito = conta
 * cheia; escudo = o escudo no lugar do elo (a linha continua); folga = conta
 * pequena vazada (a linha continua); quebra = um × vermelho, a linha se parte e
 * o que veio antes fica apagado; hoje pendente = conta vazada que pulsa (em
 * vermelho se faltar hoje partir a corrente). `ghost` acrescenta contas
 * fantasmas rumo ao próximo marco.
 */
export function ChainLine({
  chain,
  count = 10,
  step = 14,
  r = 4.5,
  height = 20,
  ghost = 0,
  fill = false,
  contas = false,
  ink: inkProp,
}: {
  chain: HabitChain;
  count?: number;
  /** Distância entre os elos (ignorada com `fill`). */
  step?: number;
  r?: number;
  height?: number;
  ghost?: number;
  /** Ocupa a largura disponível. */
  fill?: boolean;
  /** As contas no fio (painel Hoje): fio mais grosso e a quebra como conta vazia e tracejada. */
  contas?: boolean;
  /** Cor do feito e do fio (padrão: o destaque do tema). */
  ink?: string;
}) {
  const [measured, setMeasured] = useState(0);
  const beads = chain.beads.slice(-count).split('');
  const n = beads.length + ghost;
  const pad = r * 1.6 + 1.5;
  const gap = fill ? (measured > 0 && n > 1 ? Math.min(contas ? 64 : 34, (measured - 2 * pad) / (n - 1)) : 0) : step;
  const width = fill ? measured : pad * 2 + gap * Math.max(0, n - 1);
  const x = (i: number) => pad + i * gap;
  const y = height / 2;
  const lastQ = beads.lastIndexOf('Q');

  const ink = inkProp ?? colors.accent.gold;
  const fio = contas ? 2.4 : 1.6;
  const shield = SHIELD_COLOR;
  const danger = colors.accent.danger;
  const faint = colors.text.tertiary;
  const hIndex = beads[beads.length - 1] === 'H' ? beads.length - 1 : -1;

  const svg =
    width > 0 ? (
      <Svg width={width} height={height}>
        {/* as ligações */}
        {beads.map((c, i) => {
          if (i === 0) return null;
          const a = beads[i - 1];
          if (a === 'Q' || a === 'N' || c === 'N') return null;
          if (c === 'Q') {
            // a corrente se parte: meia ligação vermelha que não chega
            return (
              <Line key={`l${i}`} x1={x(i - 1)} y1={y} x2={(x(i - 1) + x(i)) / 2} y2={y} stroke={danger} strokeWidth={fio} opacity={0.7} />
            );
          }
          const lost = i < lastQ;
          return (
            <Line
              key={`l${i}`}
              x1={x(i - 1)}
              y1={y}
              x2={x(i)}
              y2={y}
              stroke={ink}
              strokeWidth={fio}
              strokeDasharray={c === 'H' ? '2 3' : undefined}
              opacity={lost ? 0.25 : c === 'O' || a === 'O' ? 0.55 : 1}
            />
          );
        })}
        {/* rumo ao próximo marco */}
        {ghost > 0 && beads.length > 0 && (
          <Line
            x1={x(beads.length - 1)}
            y1={y}
            x2={x(n - 1)}
            y2={y}
            stroke={faint}
            strokeWidth={1}
            strokeDasharray="2 4"
            opacity={0.6}
          />
        )}
        {/* os elos */}
        {beads.map((c, i) => {
          const lost = i < lastQ;
          const cx = x(i);
          switch (c) {
            case 'F':
              return <Circle key={i} cx={cx} cy={y} r={r} fill={ink} opacity={lost ? 0.3 : 1} />;
            case 'E': {
              const s = r * 2.7;
              return (
                <G key={i} opacity={lost ? 0.35 : 1} transform={`translate(${cx - s / 2} ${y - s / 2}) scale(${s / 24})`}>
                  <Path d={SHIELD_D} fill={shield} stroke={shield} strokeWidth={1.5} strokeLinejoin="round" />
                </G>
              );
            }
            case 'O':
              return <Circle key={i} cx={cx} cy={y} r={r * 0.55} fill="none" stroke={ink} strokeWidth={1.2} opacity={lost ? 0.25 : 0.6} />;
            case 'Q': {
              if (contas) {
                return <Circle key={i} cx={cx} cy={y} r={r - 1} fill="none" stroke={danger} strokeWidth={1.6} strokeDasharray="3 3" />;
              }
              const k = r * 0.85;
              return (
                <G key={i}>
                  <Line x1={cx - k} y1={y - k} x2={cx + k} y2={y + k} stroke={danger} strokeWidth={1.8} strokeLinecap="round" />
                  <Line x1={cx - k} y1={y + k} x2={cx + k} y2={y - k} stroke={danger} strokeWidth={1.8} strokeLinecap="round" />
                </G>
              );
            }
            case 'N':
              return <Circle key={i} cx={cx} cy={y} r={r * 0.5} fill="none" stroke={faint} strokeWidth={1} />;
            default:
              return null; // H: desenhado por cima, para pulsar
          }
        })}
        {Array.from({ length: ghost }, (_, g) => (
          <Circle key={`g${g}`} cx={x(beads.length + g)} cy={y} r={r * 0.8} fill="none" stroke={faint} strokeWidth={1} opacity={0.7} />
        ))}
      </Svg>
    ) : null;

  return (
    <View
      // fill: estica na largura do pai (coluna); flex: 1 ali cresceria na altura
      style={fill ? { alignSelf: 'stretch', height } : { width, height }}
      onLayout={fill ? (e) => setMeasured(e.nativeEvent.layout.width) : undefined}
      accessible
      accessibilityLabel={chainA11y(chain)}
    >
      {svg}
      {hIndex >= 0 && width > 0 && <TodayBead cx={x(hIndex)} cy={y} r={r} color={chain.atRisk ? danger : contas ? colors.accent.gold : ink} />}
    </View>
  );
}

/** Hoje, ainda por fazer: a conta vazada que pulsa devagar. */
function TodayBead({ cx, cy, r, color }: { cx: number; cy: number; r: number; color: string }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const d = r * 2 + 1;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: cx - d / 2,
        top: cy - d / 2,
        width: d,
        height: d,
        borderRadius: d / 2,
        borderWidth: 1.6,
        borderColor: color,
        opacity: pulse,
      }}
    />
  );
}

// ————————————————— resumo de uma linha (Hoje, lista) —————————————————

/** A linha curta das listas: os últimos elos, "12 dias" e os escudos. */
export function ChainStrip({ chain, count = 9 }: { chain: HabitChain; count?: number }) {
  const pending = chain.beads.endsWith('H');
  const label =
    chain.length > 0 ? `${chainCount(chain)}${chain.atRisk ? ' · sem escudo' : ''}` : pending ? 'comece a corrente hoje' : 'sem corrente';
  return (
    <View style={styles.strip}>
      {chain.beads.length > 0 && <ChainLine chain={chain} count={count} step={13} r={4} height={18} />}
      <Text style={[styles.stripText, chain.atRisk && styles.stripRisk]} numberOfLines={1}>
        {label}
      </Text>
      <ShieldPips shields={chain.shields} cap={chain.cap} size={13} />
    </View>
  );
}

// ————————————————— o cartão do detalhe —————————————————

export function ChainCard({ chain }: { chain: HabitChain }) {
  const next = nextChainMilestone(chain);
  const pending = chain.beads.endsWith('H');
  const toNext = next != null ? next - chain.length : null;
  const ghost = toNext != null ? Math.max(0, Math.min(4, toNext - (pending ? 1 : 0))) : 0;
  const recentBreak = !!chain.lost && chain.beads.slice(-14).includes('Q') && chain.lost.n >= 2;
  const fem = chain.unit === 'semana';
  const { earnEvery } = CHAIN_RULES[chain.unit];

  return (
    <View>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.big} accessibilityLabel={chainA11y(chain)}>
            {chain.length}
          </Text>
          <Text style={styles.bigUnit}>
            {chainUnitWord(chain.unit, chain.length)} {fem ? (chain.length === 1 ? 'seguida' : 'seguidas') : chain.length === 1 ? 'seguido' : 'seguidos'}
          </Text>
        </View>
        <View style={styles.shieldBox}>
          <ShieldPips shields={chain.shields} cap={chain.cap} size={26} />
          <Text style={styles.shieldText}>{shieldLine(chain)}</Text>
        </View>
      </View>

      <View style={{ height: spacing.md }} />
      <ChainLine chain={chain} count={14} fill r={6} height={30} ghost={ghost} />
      <View style={styles.underLine}>
        <Text style={styles.small}>
          Recorde: {chain.best} {chainUnitWord(chain.unit, chain.best)}
        </Text>
        {next != null && toNext != null && (
          <Text style={styles.small}>
            {toNext === 1 ? `falta 1 para ${next}` : `faltam ${toNext} para ${next}`}
          </Text>
        )}
      </View>

      {chain.atRisk && (
        <Text style={[styles.note, styles.noteRisk]}>
          {fem ? 'Esta semana' : 'Hoje'} sem escudo: se faltar, a corrente de {chainCount(chain)} se parte.
        </Text>
      )}
      {recentBreak && chain.lost && (
        <Text style={styles.note}>
          A corrente de {chain.lost.n} {chainUnitWord(chain.unit, chain.lost.n)} se partiu em {shortDate(chain.lost.day)}. Toda corrente
          começa com um elo.
        </Text>
      )}
      <Text style={styles.rule}>
        {fem
          ? `Cada semana com a cota cumprida é um elo. Uma semana abaixo da cota gasta um escudo; sem escudo, a corrente se parte. Cabem dois escudos a partir da segunda semana, e volta um a cada ${earnEvery} semanas cumpridas.`
          : `Cada dia feito é um elo. Uma falta gasta um escudo; sem escudo, a corrente se parte inteira. A corrente começa com um escudo, cabem dois a partir de 7 dias, e volta um a cada ${earnEvery} dias feitos. Folga e pausa não contam.`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  stripText: { ...typography.small, color: colors.text.secondary, flexShrink: 1 },
  stripRisk: { color: colors.text.primary, fontFamily: typography.label.fontFamily },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  big: { fontFamily: typography.label.fontFamily, fontSize: 44, lineHeight: 50, color: colors.text.primary },
  bigUnit: { ...typography.bodyMedium, color: colors.text.secondary, marginTop: -2 },
  shieldBox: { alignItems: 'flex-end', maxWidth: '58%', gap: 6, paddingTop: 6 },
  shieldText: { ...typography.small, color: colors.text.secondary, textAlign: 'right', lineHeight: 18 },
  underLine: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  small: { ...typography.small, color: colors.text.tertiary },
  note: {
    ...typography.small,
    color: colors.text.secondary,
    marginTop: spacing.md,
    lineHeight: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: withAlpha(colors.accent.gold, 0.08),
  },
  noteRisk: {
    color: colors.text.primary,
    fontFamily: typography.label.fontFamily,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent.danger,
  },
  rule: { ...typography.small, color: colors.text.tertiary, marginTop: spacing.md, lineHeight: 18 },
});
