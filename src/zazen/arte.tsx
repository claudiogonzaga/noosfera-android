// A arte do Zazen: papel washi, tinta sumi, o selo vermelho (hanko), a inscrição
// vertical e o ○△□ do Sengai (o ícone da aba). Identidade própria, como a do
// Kinesis: não usa a paleta da Noosfera. No tema espacial, a variante noturna
// (papel sumi, tinta clara); nos outros, o washi.

import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { ESPACIAL } from '../theme/tema';
import { falhasDoSelo, misturar, papel, quadradoDoSelo } from './pincel';

export interface Paleta {
  papel: string;
  tinta: string;
  /** O cinza do lavado: textos secundários e controles não escolhidos. */
  lavado: string;
  selo: string;
  /** O entalhe do selo (o ensō): o papel aparecendo onde a pedra foi cavada. */
  seloTexto: string;
  /** As fibras mais claras que o papel (no papel escuro, mais escuras). */
  fibraClara: string;
  /** O corpo do traço: a tinta com um nada de papel, para o miolo carregado aparecer. */
  corpo: string;
  /** O degrau entre o corpo e o miolo (tinta cheia): a carga de tinta sem borda dura. */
  meio: string;
  noturno: boolean;
}

const WASHI = { papel: '#F3EEE4', tinta: '#1C1B18' };
const SUMI = { papel: '#15140F', tinta: '#E9E3D6' };

export const PALETA: Paleta = ESPACIAL
  ? {
      ...SUMI,
      lavado: 'rgba(233,227,214,0.35)',
      selo: '#B5382A',
      seloTexto: SUMI.papel,
      fibraClara: '#000000',
      // No papel escuro, o miolo claro viraria brilho de tubo: o degrau é bem menor.
      corpo: misturar(SUMI.tinta, SUMI.papel, 0.06),
      meio: misturar(SUMI.tinta, SUMI.papel, 0.03),
      noturno: true,
    }
  : {
      ...WASHI,
      lavado: 'rgba(28,27,24,0.35)',
      selo: '#B5382A',
      seloTexto: WASHI.papel,
      fibraClara: '#FFFFFF',
      corpo: misturar(WASHI.tinta, WASHI.papel, 0.07),
      meio: misturar(WASHI.tinta, WASHI.papel, 0.035),
      noturno: false,
    };

/** A serifa do sistema (Noto Serif no Android): fina e discreta. */
export const SERIFA = 'serif';

/** O papel: cor lisa, nuvens e fibras quase invisíveis, e um escurecer leve nas bordas. */
export const Washi = memo(function Washi({ width, height, p = PALETA }: { width: number; height: number; p?: Paleta }) {
  const { fibras, manchas } = useMemo(() => papel(width, height), [width, height]);
  if (width <= 0 || height <= 0) return null;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="zzNuvem" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={p.tinta} stopOpacity={1} />
          <Stop offset="1" stopColor={p.tinta} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="zzVinheta" cx="50%" cy="45%" r="75%">
          <Stop offset="0.55" stopColor={p.noturno ? '#000000' : p.tinta} stopOpacity={0} />
          <Stop offset="1" stopColor={p.noturno ? '#000000' : p.tinta} stopOpacity={p.noturno ? 0.22 : 0.05} />
        </RadialGradient>
      </Defs>
      <Rect width={width} height={height} fill={p.papel} />
      {manchas.map((m, i) => (
        <Circle key={`m${i}`} cx={m.cx} cy={m.cy} r={m.r} fill="url(#zzNuvem)" opacity={m.opacidade} />
      ))}
      {fibras.map((fb, i) => (
        <Path
          key={`f${i}`}
          d={fb.d}
          stroke={fb.clara ? p.fibraClara : p.tinta}
          strokeWidth={fb.largura}
          strokeOpacity={p.noturno && fb.clara ? fb.opacidade * 0.6 : fb.opacidade}
          strokeLinecap="round"
          fill="none"
        />
      ))}
      <Rect width={width} height={height} fill="url(#zzVinheta)" />
    </Svg>
  );
});

/** O selo hanko: quadrado vermelho de borda gasta, com um ensō (o círculo de um só
 *  traço, aberto no alto) entalhado — sem ideograma, que ninguém precisa decifrar. */
export const Hanko = memo(function Hanko({ size, p = PALETA }: { size: number; p?: Paleta }) {
  const quadrado = useMemo(() => quadradoDoSelo(size), [size]);
  const falhas = useMemo(() => falhasDoSelo(size), [size]);
  return (
    <View style={{ width: size, height: size, transform: [{ rotate: '-3deg' }] }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Path d={quadrado} fill={p.selo} />
        {falhas.map((c, i) => (
          <Circle key={i} cx={c.cx} cy={c.cy} r={c.r} fill={p.papel} opacity={0.55} />
        ))}
      </Svg>
      <Svg width={size} height={size} viewBox="0 0 60 60" style={StyleSheet.absoluteFill}>
        <Path d="M38.4 20.0 A13 13 0 1 1 32.3 17.2" fill="none" stroke={p.seloTexto} strokeWidth={4.4} strokeLinecap="round" />
        <Path d="M32.3 17.2 Q30.6 16.9 29.2 17.0" fill="none" stroke={p.seloTexto} strokeWidth={2.2} strokeLinecap="round" />
      </Svg>
    </View>
  );
});

/** A inscrição do canto: só a palavra "zazen", como a assinatura de uma pintura. */
export function Inscricao({ p = PALETA }: { p?: Paleta }) {
  return (
    <View style={styles.inscricao} accessible accessibilityLabel="Zazen">
      <Text allowFontScaling={false} style={[styles.latim, { color: p.tinta }]}>zazen</Text>
    </View>
  );
}

/**
 * O ○△□ do Sengai, a traço de pincel: o ícone da aba. viewBox 41×24 (mais largo
 * que alto): passe a altura; a largura sai da proporção.
 */
export function SengaiIcon({ height, color }: { height: number; color: string }) {
  const width = (height * 41) / 24;
  return (
    <Svg width={width} height={height} viewBox="0 0 41 24" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
      <Path
        d="M2.6 7.2 C2.4 10.4 2.5 14.6 2.8 18.6 C6.4 18.9 10.1 18.8 13.6 18.5 C13.9 14.8 13.8 10.9 13.5 7.0 C9.9 6.8 6.2 6.9 2.9 7.3"
        strokeWidth={1.9}
      />
      <Path d="M10.9 18.4 L17.8 5.4 C20.1 9.8 22.4 14.2 24.9 18.6 C20.3 18.8 15.6 18.7 11.1 18.5" strokeWidth={1.8} />
      <Path
        d="M31.4 6.0 C35.4 6.2 38.3 9.2 38.2 12.9 C38.1 16.7 35.0 19.4 31.2 19.2 C27.4 19.0 24.5 16.2 24.6 12.5 C24.7 9.0 27.4 6.4 30.6 6.1"
        strokeWidth={2.0}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  inscricao: { alignItems: 'center' },
  latim: { fontFamily: SERIFA, fontStyle: 'italic', fontSize: 17, letterSpacing: 3, opacity: 0.82 },
});
