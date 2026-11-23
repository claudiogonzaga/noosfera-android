// O tipo da esfera do tema espacial (pedido de 16/11/2026): três desenhos, e a
// pessoa escolhe nas Configurações. A escolha fica num arquivo, lido de forma
// síncrona como o tema, e vale na hora, sem reiniciar.

import { useSyncExternalStore } from 'react';
import { File, Paths } from 'expo-file-system';

export type TipoEsfera = 'neuronios' | 'constelacao' | 'nucleo';

export const ESFERAS: { value: TipoEsfera; label: string; hint: string }[] = [
  { value: 'neuronios', label: 'Neurônios', hint: 'orgânica, pulsos rápidos' },
  { value: 'constelacao', label: 'Constelação', hint: 'regular e calma' },
  { value: 'nucleo', label: 'Núcleo', hint: 'pulsa do centro' },
];

const arquivo = () => new File(Paths.document, 'esfera.txt');

function ler(): TipoEsfera {
  try {
    const f = arquivo();
    if (!f.exists) return 'neuronios';
    const nome = f.textSync().trim() as TipoEsfera;
    return ESFERAS.some((e) => e.value === nome) ? nome : 'neuronios';
  } catch {
    return 'neuronios';
  }
}

let atual: TipoEsfera = ler();
const ouvintes = new Set<() => void>();

export function trocarEsfera(tipo: TipoEsfera): void {
  if (tipo === atual) return;
  atual = tipo;
  try {
    const f = arquivo();
    if (!f.exists) f.create();
    f.write(tipo);
  } catch {
    /* sem gravar, vale até fechar o app */
  }
  ouvintes.forEach((fn) => fn());
}

export function useTipoEsfera(): TipoEsfera {
  return useSyncExternalStore(
    (fn) => {
      ouvintes.add(fn);
      return () => ouvintes.delete(fn);
    },
    () => atual,
  );
}
