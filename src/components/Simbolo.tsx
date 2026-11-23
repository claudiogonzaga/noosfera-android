// O SÍMBOLO da Areté, um por tema (pedido de 16/11/2026):
//  - terracota: Atena de perfil (components/Atena.tsx);
//  - espacial: uma esfera de rede neural orgânica, com corpos celulares e nós
//    na casca e por todo o interior, ligações curvas e pulsos rápidos;
//  - Gaia (eco): a revoada dos estorninhos, um bando que muda de forma.
//
// Os dois desenhos animados são SVG com poucos elementos: os nós e as ligações
// vão em três caminhos por profundidade (longe, meio, perto), em vez de um
// elemento por nó. O quadro avança a ~20 por segundo e para quando `animated`
// é falso (aba fora de foco, ícone da barra).

import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Atena, ATENA_MINI } from './Atena';
import { colors } from '../theme';
import { ECOLOGICO, ESPACIAL } from '../theme/tema';
import { useTipoEsfera, type TipoEsfera } from '../theme/esfera';

export { ATENA_MINI };

interface Props {
  size?: number;
  animated?: boolean;
  /** Dormindo: mais lento e apagado. */
  dormindo?: boolean;
  /** Muda → o símbolo reage (um hábito marcado, a volta à tela). */
  olharKey?: number;
  /** Só a esfera: força um dos três desenhos (as amostras das Configurações). */
  tipo?: TipoEsfera;
}

export function Simbolo(props: Props) {
  if (ESPACIAL) return <EsferaNeural {...props} />;
  if (ECOLOGICO) return <Revoada {...props} />;
  return <Atena {...props} />;
}

// ————————————————— o relógio da animação —————————————————

/** Segundos de animação; avança só com `on`. `burst` conta o tempo desde a última reação. */
function useTempo(on: boolean, olharKey: number, passo = 50): { t: number; desde: number } {
  const [t, setT] = useState(0);
  const acc = useRef(0);
  const reacao = useRef(-10);
  const primeira = useRef(true);
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    reacao.current = acc.current;
  }, [olharKey]);
  useEffect(() => {
    if (!on) return;
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      acc.current += Math.min(0.2, (now - last) / 1000);
      last = now;
      setT(acc.current);
    }, passo);
    return () => clearInterval(id);
  }, [on, passo]);
  return { t, desde: t - reacao.current };
}

/** Sorteio com semente (o desenho é sempre o mesmo). */
function semente(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const ponto = (x: number, y: number, r: number) =>
  `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(2 * r).toFixed(1)} 0a${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(-2 * r).toFixed(1)} 0`;

// ————————————————— a esfera de rede neural —————————————————
//
// Pedido de 16/11/2026 (noite): mais complexa e mais orgânica, que lembre
// neurônios. Os nós não ficam numa grade regular: há corpos celulares maiores
// (com muitos ramos) e nós pequenos, na casca e por todo o interior; as
// ligações são curvas, como dendritos; cada nó oscila um pouco no lugar; os
// pulsos são rápidos, deixam rastro, e o nó que recebe um pulso acende e
// dispara outro adiante.

interface No {
  x: number;
  y: number;
  z: number;
  /** Tamanho relativo: os corpos celulares são maiores. */
  g: number;
  /** Fase da oscilação. */
  f: number;
}
interface Elo {
  a: number;
  b: number;
  /** Ponto de controle da curva, em 3D. */
  cx: number;
  cy: number;
  cz: number;
}
interface Rede {
  nos: No[];
  elos: Elo[];
  /** Por nó, as ligações que saem dele. */
  viz: number[][];
}

/** Como cada um dos três desenhos é montado e se move. */
interface Receita {
  casca: number;
  dentro: number;
  corpos: number;
  /** 0 = grade regular, linhas retas; 1 = tudo fora do lugar, ramos curvos. */
  torto: number;
  /** Camadas concêntricas ligadas de dentro para fora (o Núcleo). */
  camadas?: boolean;
  pulsos: number;
  /** Velocidade dos pulsos (ligações por segundo, mais ou menos). */
  vPulso: number;
  giro: number;
  rastro: boolean;
}

const RECEITAS: Record<TipoEsfera, { cheia: Receita; mini: Receita }> = {
  neuronios: {
    cheia: { casca: 48, dentro: 34, corpos: 9, torto: 1, pulsos: 14, vPulso: 1.6, giro: 0.26, rastro: true },
    mini: { casca: 22, dentro: 9, corpos: 4, torto: 1, pulsos: 4, vPulso: 1.6, giro: 0.26, rastro: true },
  },
  constelacao: {
    cheia: { casca: 44, dentro: 12, corpos: 0, torto: 0, pulsos: 6, vPulso: 0.9, giro: 0.32, rastro: false },
    mini: { casca: 20, dentro: 4, corpos: 0, torto: 0, pulsos: 3, vPulso: 0.9, giro: 0.32, rastro: false },
  },
  nucleo: {
    cheia: { casca: 40, dentro: 34, corpos: 0, torto: 0.35, camadas: true, pulsos: 12, vPulso: 1.3, giro: 0.2, rastro: true },
    mini: { casca: 18, dentro: 10, corpos: 0, torto: 0.35, camadas: true, pulsos: 4, vPulso: 1.3, giro: 0.2, rastro: true },
  },
};

function montarRede(rc: Receita): Rede {
  const { casca: nCasca, dentro: nDentro, corpos: nCorpos, torto } = rc;
  const rnd = semente(26);
  const nos: No[] = [];
  const ouro = Math.PI * (3 - Math.sqrt(5));
  // a casca: espiral de Fibonacci, tirada do lugar para não parecer grade
  for (let i = 0; i < nCasca; i++) {
    const y = 1 - (2 * (i + 0.5)) / nCasca + (rnd() - 0.5) * 0.09 * torto;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * ouro + (rnd() - 0.5) * 0.5 * torto;
    const rr = 1 - (0.1 - rnd() * 0.12) * torto;
    nos.push({ x: Math.cos(a) * r * rr, y: y * rr, z: Math.sin(a) * r * rr, g: 1 - (0.3 - rnd() * 0.5) * torto, f: rnd() * 6.28 });
  }
  // o interior: do centro até perto da casca
  for (let i = 0; i < nDentro; i++) {
    const u = rnd() * 2 - 1;
    const a = rnd() * Math.PI * 2;
    // no Núcleo: um miolo apertado e uma camada do meio; nos outros, do centro até a casca
    const rr = rc.camadas ? (i < nDentro * 0.35 ? 0.14 + rnd() * 0.1 : 0.5 + rnd() * 0.1) : torto ? 0.12 + Math.cbrt(rnd()) * 0.66 : 0.28 + rnd() * 0.3;
    const q = Math.sqrt(1 - u * u);
    nos.push({ x: Math.cos(a) * q * rr, y: u * rr, z: Math.sin(a) * q * rr, g: 0.55 + rnd() * 0.45, f: rnd() * 6.28 });
  }
  // os corpos celulares: alguns nós, espalhados, ficam maiores e ganham mais ramos
  const corpos = new Set<number>();
  while (corpos.size < nCorpos) corpos.add(Math.floor(rnd() * nos.length));
  corpos.forEach((i) => (nos[i].g = 1.7 + rnd() * 0.6));

  const d2 = (a: No, b: No) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
  const chave = new Set<string>();
  const elos: Elo[] = [];
  const viz: number[][] = nos.map(() => []);
  const liga = (i: number, j: number) => {
    const k = i < j ? `${i}-${j}` : `${j}-${i}`;
    if (i === j || chave.has(k)) return;
    chave.add(k);
    const a = nos[i], b = nos[j];
    const len = Math.sqrt(d2(a, b));
    // a curva: o meio do caminho empurrado para um lado qualquer
    const e = len * 0.32 * torto;
    viz[i].push(elos.length);
    viz[j].push(elos.length);
    elos.push({
      a: i,
      b: j,
      cx: (a.x + b.x) / 2 + (rnd() - 0.5) * e,
      cy: (a.y + b.y) / 2 + (rnd() - 0.5) * e,
      cz: (a.z + b.z) / 2 + (rnd() - 0.5) * e,
    });
  };
  const raio = (n: No) => Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
  nos.forEach((n, i) => {
    const perto = nos
      .map((m, j) => ({ j, d: d2(n, m), casca: j < nCasca, r: raio(m) }))
      .filter((o) => o.j !== i)
      .sort((a, b) => a.d - b.d);
    if (rc.camadas) {
      // Núcleo: cada nó se liga a dois da camada de dentro e a um da própria camada
      const r = raio(n);
      perto.filter((o) => o.r < r - 0.15).slice(0, 2).forEach((o) => liga(i, o.j));
      perto.filter((o) => Math.abs(o.r - r) <= 0.15).slice(0, r < 0.3 ? 3 : 1).forEach((o) => liga(i, o.j));
    } else if (!torto) {
      // Constelação: na casca, três vizinhos da casca; no fundo, dois da casca e um do fundo
      const naCasca = i < nCasca;
      perto.filter((o) => o.casca).slice(0, naCasca ? 3 : 2).forEach((o) => liga(i, o.j));
      if (!naCasca) perto.filter((o) => !o.casca).slice(0, 1).forEach((o) => liga(i, o.j));
    } else if (corpos.has(i)) {
      // corpo celular: seis ramos, dois deles longos (axônios)
      perto.slice(0, 4).forEach((o) => liga(i, o.j));
      liga(i, perto[8 + Math.floor(rnd() * 6)].j);
      liga(i, perto[14 + Math.floor(rnd() * 8)].j);
    } else {
      // os outros: de um a três vizinhos, de forma irregular
      const n3 = 1 + Math.floor(rnd() * 2.6);
      perto.slice(0, n3).forEach((o) => liga(i, o.j));
    }
  });
  return { nos, elos, viz };
}

/** As redes são montadas uma vez, na primeira vez que cada desenho aparece.
 *  Nos ícones pequenos, uma rede mais rala (a cheia vira um borrão). */
const REDES = new Map<Receita, Rede>();
function redeDe(rc: Receita): Rede {
  let r = REDES.get(rc);
  if (!r) {
    r = montarRede(rc);
    REDES.set(rc, r);
  }
  return r;
}

interface Pulso {
  elo: number;
  /** Nó de chegada. */
  para: number;
  prog: number;
  vel: number;
}

const bez = (a: number, c: number, b: number, u: number) => (1 - u) * (1 - u) * a + 2 * (1 - u) * u * c + u * u * b;

export function EsferaNeural({ size = 96, animated = true, dormindo = false, olharKey = 0, tipo }: Props) {
  const { t, desde } = useTempo(animated, olharKey, dormindo ? 110 : 45);
  const escolhido = useTipoEsfera();
  const rc = RECEITAS[tipo ?? escolhido][size < 44 ? 'mini' : 'cheia'];
  const rede = redeDe(rc);
  const vel = dormindo ? rc.giro * 0.4 : rc.giro;
  const R = size * 0.43;
  const c = size / 2;

  // O estado dos pulsos e dos disparos vive fora do React: só o relógio redesenha.
  const estado = useRef<{ t: number; pulsos: Pulso[]; fogo: Float32Array; sorte: () => number; rede: Rede } | null>(null);
  if (!estado.current || estado.current.rede !== rede) {
    const sorte = semente(7);
    estado.current = {
      t,
      rede,
      sorte,
      fogo: new Float32Array(rede.nos.length).fill(-10),
      pulsos: Array.from({ length: rc.pulsos }, () => {
        const e = Math.floor(sorte() * rede.elos.length);
        return { elo: e, para: rede.elos[e].b, prog: sorte(), vel: rc.vPulso * (1 + sorte()) };
      }),
    };
  }

  const quadro = useMemo(() => {
    const st = estado.current!;
    const dt = Math.max(0, Math.min(0.2, t - st.t));
    st.t = t;
    const ritmo = dormindo ? 0.3 : 1;

    // a esfera gira e respira; cada nó oscila um pouco no lugar
    const ay = t * vel;
    const ax = 0.42 + Math.sin(t * 0.17) * 0.14;
    const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
    const folego = 1 + Math.sin(t * 0.9) * 0.02;
    const girar = (x: number, y: number, z: number) => {
      const x1 = x * cy + z * sy;
      const z1 = -x * sy + z * cy;
      const y1 = y * cx - z1 * sx;
      const z2 = y * sx + z1 * cx;
      const k = (1 + z2 * 0.18) * folego; // um pouco de perspectiva
      return { x: c + x1 * R * k, y: c + y1 * R * k, z: z2 };
    };
    const w = 0.035 * rc.torto;
    const p = st.rede.nos.map((n) => {
      const q = girar(
        n.x + Math.sin(t * 1.1 * ritmo + n.f) * w,
        n.y + Math.cos(t * 0.9 * ritmo + n.f * 1.7) * w,
        n.z + Math.sin(t * 1.3 * ritmo + n.f * 2.3) * w,
      );
      return { ...q, g: n.g };
    });
    const pc = st.rede.elos.map((e) => girar(e.cx, e.cy, e.cz));

    // os pulsos avançam; ao chegar, o nó acende e o pulso segue por outro ramo
    for (const u of st.pulsos) {
      u.prog += dt * u.vel * ritmo;
      if (u.prog >= 1) {
        st.fogo[u.para] = t;
        const ramos = st.rede.viz[u.para];
        let prox = ramos[Math.floor(st.sorte() * ramos.length)];
        if (prox === u.elo && ramos.length > 1) prox = ramos[(ramos.indexOf(prox) + 1) % ramos.length];
        // beco sem saída ou sorteio: às vezes o pulso nasce em outro canto da rede
        let de = u.para;
        if (rc.camadas) {
          // Núcleo: o pulso só anda para fora; na casca, renasce no miolo
          const r2 = (k: number) => st.rede.nos[k].x ** 2 + st.rede.nos[k].y ** 2 + st.rede.nos[k].z ** 2;
          const outro = (k: number) => (st.rede.elos[k].a === de ? st.rede.elos[k].b : st.rede.elos[k].a);
          const fora = ramos.filter((k) => r2(outro(k)) > r2(de) + 0.02);
          if (fora.length) prox = fora[Math.floor(st.sorte() * fora.length)];
          else {
            de = rc.casca + Math.floor(st.sorte() * rc.dentro * 0.35);
            const saidas = st.rede.viz[de];
            prox = saidas[Math.floor(st.sorte() * saidas.length)];
          }
        } else if (ramos.length <= 1 || st.sorte() < 0.12) {
          prox = Math.floor(st.sorte() * st.rede.elos.length);
          de = ramos.includes(prox) ? u.para : st.rede.elos[prox].a;
        }
        const e = st.rede.elos[prox];
        u.elo = prox;
        u.para = e.a === de ? e.b : e.a;
        u.prog = 0;
        u.vel = rc.vPulso * (1 + st.sorte());
      }
    }

    // três faixas de profundidade
    const faixa = (z: number) => (z < -0.3 ? 0 : z < 0.3 ? 1 : 2);
    const elos = ['', '', ''];
    st.rede.elos.forEach((e, i) => {
      const a = p[e.a], b = p[e.b], k = pc[i];
      elos[faixa((a.z + b.z) / 2)] +=
        `M${a.x.toFixed(1)} ${a.y.toFixed(1)}Q${k.x.toFixed(1)} ${k.y.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    });
    const nos = ['', '', ''];
    let acesos = '';
    const base = Math.max(0.55, size / 74);
    p.forEach((n, i) => {
      const f = faixa(n.z);
      const r = base * n.g * (0.7 + f * 0.22);
      nos[f] += ponto(n.x, n.y, r);
      const brilho = 1 - (t - st.fogo[i]) / 0.4;
      if (brilho > 0) acesos += ponto(n.x, n.y, r * (1.3 + brilho * 1.5));
    });
    // cada pulso: a cabeça e um rastro curto, sobre a curva da ligação
    let cabecas = '';
    let rastros = '';
    for (const u of st.pulsos) {
      const e = st.rede.elos[u.elo];
      const ida = e.b === u.para;
      const a = p[ida ? e.a : e.b], b = p[ida ? e.b : e.a], k = pc[u.elo];
      const em = (q: number) => ({ x: bez(a.x, k.x, b.x, q), y: bez(a.y, k.y, b.y, q) });
      const perto = 0.75 + ((a.z + b.z) / 2 + 1) * 0.3;
      const h = em(u.prog);
      cabecas += ponto(h.x, h.y, base * 1.25 * perto);
      for (let i = 1; rc.rastro && i <= 3; i++) {
        const q = u.prog - i * 0.13;
        if (q <= 0) break;
        const m = em(q);
        rastros += ponto(m.x, m.y, base * (1.05 - i * 0.22) * perto);
      }
    }
    return { elos, nos, acesos, cabecas, rastros };
  }, [t, vel, R, c, size, dormindo, rc]);

  // A reação: um clarão que se apaga em ~1,2 s.
  const clarao = desde >= 0 && desde < 1.2 ? 1 - desde / 1.2 : 0;
  const fio = Math.max(0.4, size / 190);
  const tinta = colors.accent.gold;
  const elo = colors.accent.lavender;
  const pulso = colors.accent.success;
  const apagado = dormindo ? 0.6 : 1;

  return (
    <View style={{ width: size, height: size, opacity: apagado }} accessible accessibilityRole="image" accessibilityLabel="Rede neural">
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={R * 1.1} fill={tinta} opacity={0.035 + clarao * 0.1} />
        <Path d={quadro.elos[0]} stroke={elo} strokeWidth={fio} opacity={0.22} fill="none" strokeLinecap="round" />
        <Path d={quadro.nos[0]} fill={tinta} opacity={0.3} />
        <Path d={quadro.elos[1]} stroke={elo} strokeWidth={fio} opacity={0.42 + clarao * 0.3} fill="none" strokeLinecap="round" />
        <Path d={quadro.nos[1]} fill={tinta} opacity={0.6} />
        <Path d={quadro.elos[2]} stroke={clarao > 0 ? tinta : elo} strokeWidth={fio * 1.3} opacity={0.75} fill="none" strokeLinecap="round" />
        <Path d={quadro.nos[2]} fill={tinta} opacity={1} />
        <Path d={quadro.acesos} fill={pulso} opacity={0.28 + clarao * 0.3} />
        <Path d={quadro.rastros} fill={pulso} opacity={0.5} />
        <Path d={quadro.cabecas} fill={pulso} opacity={1} />
      </Svg>
    </View>
  );
}

// ————————————————— a revoada dos estorninhos —————————————————

const AVES = (() => {
  const rnd = semente(11);
  const out: { u: number; v: number; w: number; f: number }[] = [];
  while (out.length < 150) {
    const u = rnd() * 2 - 1, v = rnd() * 2 - 1, w = rnd() * 2 - 1;
    if (u * u + v * v + w * w <= 1) out.push({ u, v, w, f: rnd() * Math.PI * 2 });
  }
  return out;
})();

export function Revoada({ size = 96, animated = true, dormindo = false, olharKey = 0 }: Props) {
  const { t, desde } = useTempo(animated, olharKey, dormindo ? 110 : 50);
  const c = size / 2;

  const d = useMemo(() => {
    const tt = t * (dormindo ? 0.3 : 0.75);
    // o centro do bando passeia; a ave da frente (u = 1) vai adiante no tempo, a de trás atrasada:
    // o bando se dobra como uma fita.
    const centro = (s: number) => ({
      x: Math.sin(s * 0.9) * 0.15 + Math.sin(s * 0.37 + 1.3) * 0.06,
      y: Math.sin(s * 1.3 + 0.6) * 0.1 + Math.cos(s * 0.53) * 0.05,
    });
    const abre = desde >= 0 && desde < 1.4 ? Math.sin((desde / 1.4) * Math.PI) * 0.35 : 0; // a reação: o bando se abre e fecha
    const estica = 0.3 + Math.sin(tt * 0.6) * 0.08 + abre * 0.4;
    const alto = 0.17 + Math.cos(tt * 0.8) * 0.05 + abre * 0.3;
    const giro = Math.sin(tt * 0.45) * 0.9;
    const cg = Math.cos(giro), sg = Math.sin(giro);
    const faixas = ['', ''];
    const r0 = Math.max(0.55, size / 120);
    for (const a of AVES) {
      const ce = centro(tt + a.u * 0.55);
      // onda que percorre o bando (a mancha escura que corre na revoada)
      const onda = Math.sin(tt * 2.2 - a.u * 3.2 + a.f * 0.15) * 0.05;
      const lx = a.u * estica;
      const ly = a.v * alto + onda + Math.sin(tt * 3 + a.f) * 0.012;
      const x = ce.x + lx * cg - ly * sg;
      const y = ce.y + lx * sg + ly * cg;
      const perto = a.w > 0 ? 1 : 0;
      faixas[perto] += ponto(c + x * size, c + y * size, r0 * (0.7 + (a.w + 1) * 0.3));
    }
    return faixas;
  }, [t, desde, c, size, dormindo]);

  const tinta = colors.text.primary;
  return (
    <View style={{ width: size, height: size, opacity: dormindo ? 0.6 : 1 }} accessible accessibilityRole="image" accessibilityLabel="Revoada de estorninhos">
      <Svg width={size} height={size}>
        <Path d={d[0]} fill={tinta} opacity={0.42} />
        <Path d={d[1]} fill={tinta} opacity={0.9} />
      </Svg>
    </View>
  );
}
