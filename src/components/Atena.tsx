// ATENA no lugar da coruja (v1.134, pedido de 16/11/2026): a deusa em perfil,
// desenhada a partir do logo do Akoé, sem as ondas sonoras do ouvido.
// Só de perfil e só no tema terracota: figura negra sobre o laranja, num medalhão
// redondo. Nos outros temas o símbolo é outro (components/Simbolo.tsx).
//
// A vida vem só do OLHO: a base não muda e quatro recortes se alternam por cima
// dela (aberto, olhando para quem vê, meio fechado, fechado). Ela pisca de vez
// em quando e, ao abrir a tela ou quando `olharKey` muda (um hábito marcado),
// olha para o usuário e pisca. Depois da hora de dormir, fica de olhos fechados.
//
// Os arquivos saem de um script (assets/atena); a caixa do olho é a mesma nos
// dois temas: x 830–1010 e y 430–530 num quadro de 1200.

import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, View } from 'react-native';
import { useAppStore } from '../store/useAppStore';

type Quadro = 'aberto' | 'olhar' | 'meio' | 'fechado';

const ARTE = {
  // figura negra sobre o laranja
  t: {
    base: require('../../assets/atena/t-base.png'),
    aberto: require('../../assets/atena/t-olho-aberto.png'),
    olhar: require('../../assets/atena/t-olho-olhar.png'),
    meio: require('../../assets/atena/t-olho-meio.png'),
    fechado: require('../../assets/atena/t-olho-fechado.png'),
  },
} as const;

/** A imagem pequena e parada (aba, listas). */
export const ATENA_MINI = require('../../assets/atena/t-mini.png');

const OLHO = { x: 830 / 1200, y: 430 / 1200, w: 180 / 1200, h: 100 / 1200 };
const QUADROS: Quadro[] = ['aberto', 'olhar', 'meio', 'fechado'];

/** Estamos na janela de sono? (hora de dormir → 6h, hora local) */
function janelaDeSono(bedtime: string | null | undefined): boolean {
  if (!bedtime) return false;
  const [h, m] = bedtime.split(':').map((n) => parseInt(n, 10));
  if (!Number.isFinite(h)) return false;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = h * 60 + (Number.isFinite(m) ? m : 0);
  const end = 6 * 60;
  return start <= end ? cur >= start && cur < end : cur >= start || cur < end;
}

interface Props {
  size?: number;
  animated?: boolean;
  /** Dormindo por fora (o usuário marcou que foi dormir). */
  dormindo?: boolean;
  /** Muda → ela olha para o usuário e pisca (um hábito marcado, por exemplo). */
  olharKey?: number;
}

export function Atena({ size = 96, animated = true, dormindo = false, olharKey = 0 }: Props) {
  const { config } = useAppStore();
  const [quadro, setQuadro] = useState<Quadro>('aberto');
  const [, setRelogio] = useState(0);
  const flutua = useRef(new Animated.Value(0)).current;
  const fila = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const t = setInterval(() => setRelogio((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const dorme = dormindo || janelaDeSono(config?.bedtime);
  const viva = animated && !dorme;

  // Uma sequência de quadros com as durações de cada um; a nova cancela a anterior.
  const tocar = (seq: [Quadro, number][], fim?: () => void) => {
    fila.current.forEach(clearTimeout);
    fila.current = [];
    let t = 0;
    for (const [q, ms] of seq) {
      fila.current.push(setTimeout(() => setQuadro(q), t));
      t += ms;
    }
    if (fim) fila.current.push(setTimeout(fim, t));
  };

  useEffect(() => {
    if (dorme) {
      fila.current.forEach(clearTimeout);
      setQuadro('fechado');
      return;
    }
    setQuadro('aberto');
    if (!viva) return;
    let vivo = true;
    let espera: ReturnType<typeof setTimeout> | null = null;

    const piscar = (de: Quadro): [Quadro, number][] => [
      ['meio', 60],
      ['fechado', 100],
      ['meio', 60],
      [de, 0],
    ];
    const olhar = (): [Quadro, number][] => [
      ['olhar', 900],
      ...piscar('olhar'),
      ['olhar', 1400],
      ['aberto', 0],
    ];
    const proxima = () => {
      // Uma piscada a cada 5–20 s; uma em cada quatro vezes, olha para quem vê.
      espera = setTimeout(
        () => {
          if (!vivo) return;
          tocar(Math.random() < 0.25 ? olhar() : piscar('aberto'), proxima);
        },
        5000 + Math.random() * 15000,
      );
    };
    // Ao aparecer (e a cada `olharKey`): olha para o usuário e pisca.
    espera = setTimeout(() => vivo && tocar(olhar(), proxima), 500);

    return () => {
      vivo = false;
      if (espera) clearTimeout(espera);
      fila.current.forEach(clearTimeout);
      fila.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viva, dorme, olharKey]);

  useEffect(() => {
    if (!viva) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flutua, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(flutua, { toValue: 0, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [viva, flutua]);

  const arte = ARTE.t;
  const translateY = flutua.interpolate({ inputRange: [0, 1], outputRange: [0, -Math.min(4, size / 30)] });

  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Atena"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        opacity: dorme ? 0.8 : 1,
        transform: [{ translateY }],
      }}
    >
      <Image source={arte.base} style={{ width: size, height: size }} fadeDuration={0} />
      {/* Os quatro recortes ficam montados; só um aparece (trocar a fonte piscaria). */}
      {QUADROS.map((q) => (
        <Image
          key={q}
          source={arte[q]}
          fadeDuration={0}
          style={{
            position: 'absolute',
            left: size * OLHO.x,
            top: size * OLHO.y,
            width: size * OLHO.w,
            height: size * OLHO.h,
            opacity: quadro === q ? 1 : 0,
          }}
        />
      ))}
    </Animated.View>
  );
}
