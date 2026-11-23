// AVISOS CURTOS (v1.135, decisão de 15/11/2026): sai, por enquanto, a Comentora
// que conversa e que fala. Ficam avisos curtos, no estilo do Duolingo:
//
//  • um aviso por hábito, na hora, com "Feito" e "Mais tarde" (uma vez só);
//  • no dia seguinte a uma falta, o aviso é de volta ("nunca duas vezes");
//  • uma só notificação de perda por dia: a última chamada (chainAlert.ts);
//  • o selo do ícone conta o que falta hoje.
//
// Nada de aviso antes, pergunta meia hora depois nem escada de cobranças. A
// escada e a voz continuam no código, atrás destas duas chaves, para voltarem
// se ele pedir.

import * as Notifications from 'expo-notifications';
import { getDoneNudgeTypes } from './database';
import { listHabitRows } from './habitDb';
import { isScheduledDay } from './habitStrength';
import type { HabitDef, HabitStats } from '../types/habits';

export { AVISOS_CURTOS, VOZ_DA_COMENTORA } from './avisoFlags';

function dias(n: number, semana: boolean): string {
  if (semana) return `${n} ${n === 1 ? 'semana' : 'semanas'}`;
  return `${n} ${n === 1 ? 'dia' : 'dias'}`;
}

function minuscula(s: string): string {
  return s ? s.charAt(0).toLocaleLowerCase('pt-BR') + s.slice(1) : s;
}

/** O texto do aviso na hora: uma ou duas frases curtas, com a corrente em jogo. */
export function avisoCurto(def: HabitDef, stats: HabitStats): string {
  const n = stats.streak ?? 0;
  const semana = def.freq === 'semana';
  const minimo = def.minimum?.trim();
  if (stats.missedYesterday) {
    return minimo
      ? `Ontem escapou. Hoje vale até a versão mínima: ${minuscula(minimo)}.`
      : 'Ontem escapou. Hoje é dia de voltar: nunca duas vezes seguidas.';
  }
  const pista = def.cue?.trim();
  const inicio = pista ? `${pista.charAt(0).toLocaleUpperCase('pt-BR')}${pista.slice(1)}: é agora.` : 'É agora.';
  if (n >= 2) return `${inicio} Corrente de ${dias(n, semana)}: falta só hoje.`;
  if (n === 1) return `${inicio} Segundo dia da corrente.`;
  return `${inicio} Hoje começa a corrente.`;
}

/** O aviso do "Mais tarde": o mesmo hábito, de novo, sem outro adiamento. */
export function avisoAdiado(def: object): string {
  // Aceita a linha do hábito ou a do lembrete antigo (que não tem versão mínima).
  const minimo = (def as { minimum?: string | null }).minimum?.trim();
  return minimo ? `Ainda dá tempo. Se apertar, a versão mínima: ${minuscula(minimo)}.` : 'Ainda dá tempo de fazer hoje.';
}

/** Selo do ícone: quantos hábitos de hoje ainda esperam resposta. Best-effort (depende do launcher). */
export async function refreshBadge(): Promise<void> {
  try {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const [habits, done] = await Promise.all([listHabitRows(), getDoneNudgeTypes(today)]);
    const settled = new Set(done.map((t) => t.replace(/:(skip|folga|missed)$/, '')));
    let pending = 0;
    for (const h of habits) {
      if (!h.enabled || h.archived || h.kind !== 'fazer') continue;
      if (h.pausedUntil && h.pausedUntil >= today) continue;
      if (!isScheduledDay(h, today)) continue;
      if (!settled.has(h.type)) pending++;
    }
    await Notifications.setBadgeCountAsync(pending);
  } catch {
    /* o selo é um extra */
  }
}
