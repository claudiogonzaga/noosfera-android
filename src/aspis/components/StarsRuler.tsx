import { useState } from 'react';
import { GestureResponderEvent, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, G, Line } from 'react-native-svg';

import { ALIGN_MAX, colors, typography } from '../theme';
import { ECOLOGICO, ESPACIAL } from '../../theme/tema';

interface Props {
  value: number; // nível de alinhamento mínimo, 0–4 (escala Likert)
  onChange: (n: number) => void;
}

const HEIGHT = 34;
const MID = HEIGHT / 2;
const SUN_R = 5;
const SUN_X = SUN_R + 9; // folga para a órbita do sol, quando ele é o escolhido
const SUN_ORBIT = SUN_R + 7.5; // fora dos raios
const RAYS = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);
const SUN_GAP = 22; // do sol até o primeiro planeta
const PLANETS = Array.from({ length: ALIGN_MAX }, (_, i) => i + 1); // [1,2,3,4]
const PLANET_R = [0, 3.2, 3.8, 4.4, 5]; // índice = nível (o 0 é o sol); crescem rumo ao "muito alinhado"
const RIGHT_PAD = PLANET_R[ALIGN_MAX] + 1.5 + 4 + 3; // o anel do escolhido não encosta na borda

/** Depois do escolhido, o planeta sai do eixo: os ímpares sobem, os pares descem, e
 *  tanto mais longe quanto mais longe do nível escolhido. */
function offAxis(level: number, chosen: number): number {
  if (level <= chosen) return 0;
  const far = Math.min(1, (level - chosen) / ALIGN_MAX);
  return (level % 2 === 1 ? -1 : 1) * (6 + 3 * far);
}

// Régua de alinhamento como uma conjunção, lida da esquerda para a direita: o sol na
// ponta esquerda e quatro planetas. O nível escolhido diz quantos planetas entram em
// linha com o sol — do sol até o escolhido, todos cheios sobre o eixo firme; os de
// depois saem do eixo, apagados, e o eixo até eles fica tracejado. No sol (nível 0)
// nada é exigido: tudo entra no feed. Toque ou arraste escolhe um dos 5 níveis.
export function StarsRuler({ value, onChange }: Props) {
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);

  const current = drag ?? value;
  const first = SUN_X + SUN_GAP;
  const span = Math.max(1, width - RIGHT_PAD - first);
  const xOf = (level: number) => (level === 0 ? SUN_X : first + ((level - 1) / (ALIGN_MAX - 1)) * span);

  // nível mais próximo do toque (o sol conta como o nível 0)
  const valueAt = (e: GestureResponderEvent) => {
    if (!width) return current;
    const x = e.nativeEvent.locationX;
    let best = 0;
    for (let lvl = 1; lvl <= ALIGN_MAX; lvl++) {
      if (Math.abs(x - xOf(lvl)) < Math.abs(x - xOf(best))) best = lvl;
    }
    return best;
  };

  const ink = colors.text.primary;
  // O sol: quente no espacial, âmbar no ecológico; no terracota, da mesma tinta dos planetas.
  const sun = ESPACIAL ? '#FAC775' : ECOLOGICO ? '#C98A2B' : ink;

  return (
    <View style={styles.row}>
      <Text style={styles.lbl}>não alinhado</Text>
      <View
        style={styles.trackWrap}
        accessibilityRole="adjustable"
        accessibilityLabel={
          current === 0
            ? 'Alinhamento mínimo: nenhum, entra tudo no feed'
            : `Alinhamento mínimo: ${current} de ${ALIGN_MAX} planetas em linha com o sol`
        }
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => setDrag(valueAt(e))}
        onResponderMove={(e) => {
          const n = valueAt(e);
          if (n !== drag) setDrag(n);
        }}
        onResponderRelease={(e) => {
          const n = valueAt(e);
          setDrag(null);
          Haptics.selectionAsync();
          onChange(n);
        }}
      >
        {width > 0 && (
          <Svg width={width} height={HEIGHT} pointerEvents="none">
            {/* o eixo: firme do sol até o escolhido, tracejado e apagado dali em diante */}
            {current > 0 && <Line x1={SUN_X} y1={MID} x2={xOf(current)} y2={MID} stroke={ink} strokeWidth={1.4} />}
            {current < ALIGN_MAX && (
              <Line x1={xOf(current)} y1={MID} x2={xOf(ALIGN_MAX)} y2={MID} stroke={ink} strokeWidth={1} strokeDasharray="2 4" opacity={0.3} />
            )}
            {/* o sol: disco com raios curtos, colorido nos temas espacial e ecológico */}
            {RAYS.map((a) => (
              <Line
                key={a}
                x1={SUN_X + Math.cos(a) * (SUN_R + 2)}
                y1={MID + Math.sin(a) * (SUN_R + 2)}
                x2={SUN_X + Math.cos(a) * (SUN_R + 5)}
                y2={MID + Math.sin(a) * (SUN_R + 5)}
                stroke={sun}
                strokeWidth={1.2}
                strokeLinecap="round"
              />
            ))}
            <Circle cx={SUN_X} cy={MID} r={SUN_R} fill={sun} />
            {current === 0 && <Circle cx={SUN_X} cy={MID} r={SUN_ORBIT} fill="none" stroke={ink} strokeWidth={1} opacity={0.55} />}
            {PLANETS.map((lvl) => {
              const aligned = lvl <= current;
              const cy = MID + offAxis(lvl, current);
              const r = PLANET_R[lvl] + (lvl === current ? 1.5 : 0);
              return (
                <G key={lvl}>
                  {lvl === current && (
                    <Circle cx={xOf(lvl)} cy={cy} r={r + 4} fill="none" stroke={ink} strokeWidth={1} opacity={0.55} />
                  )}
                  <Circle
                    cx={xOf(lvl)}
                    cy={cy}
                    r={r}
                    fill={aligned ? ink : 'none'}
                    stroke={ink}
                    strokeWidth={1.2}
                    opacity={aligned ? 1 : 0.35}
                  />
                </G>
              );
            })}
          </Svg>
        )}
      </View>
      <Text style={styles.lbl}>muito alinhado</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lbl: {
    ...typography.label,
    fontSize: 10,
    color: colors.text.tertiary,
    textTransform: 'none',
    letterSpacing: 0,
  },
  trackWrap: {
    flex: 1,
    height: HEIGHT,
    justifyContent: 'center',
  },
});
