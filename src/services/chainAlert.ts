// A ÚLTIMA CHAMADA DA CORRENTE (v1.132, pedido de 15/11/2026): à noite, um
// aviso só, e só quando há corrente em jogo — "a corrente de 12 dias de
// meditar se parte à meia-noite". É a aversão à perda que move a ofensiva do
// Duolingo, usada uma vez por dia e nunca para culpar: o texto diz o que se
// perde e que ainda dá tempo.
//
// Segue o modelo do "Fechar o dia" (review.ts): agendado só para HOJE e refeito
// a cada marcação e a cada reagendamento, então some sozinho quando tudo de
// hoje foi feito. Toca uma hora antes do fechamento (padrão 20h30), nunca
// antes das 18h.
//
// Fica de fora: hábito de parar (lá vale "dias limpos"), formado (a coruja já
// está em silêncio), sem avisos ("nenhum"), pausado, e o hábito cujo horário é
// tarde demais — esse ainda vai ter o próprio aviso.

import * as Notifications from 'expo-notifications';
import { format } from 'date-fns';
import { getKV, getUserConfig, setKV } from './database';
import { listHabitRows } from './habitDb';
import { statsFor } from './habitStage';
import { dowOf } from './habitStrength';
import { ensureChannel, gatedSchedule } from './notifications';
import type { HabitDef, HabitStats } from '../types/habits';

export const CHAIN_ALERT_TYPE = 'chain-alert';
const ENABLED_KV = 'chain_alert_enabled';
/** Quanto antes do "Fechar o dia" vem a última chamada. */
const BEFORE_REVIEW_MIN = 60;
const EARLIEST_MIN = 18 * 60;
/** O hábito precisa ter tido o próprio horário pelo menos isto antes do aviso. */
const MIN_GAP_MIN = 30;

export async function isChainAlertEnabled(): Promise<boolean> {
  try {
    return (await getKV(ENABLED_KV)) !== '0';
  } catch {
    return true;
  }
}

export async function setChainAlertEnabled(on: boolean): Promise<void> {
  await setKV(ENABLED_KV, on ? '1' : '0');
  await refreshChainAlert();
}

function minutesOf(hhmm: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '');
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** O horário da última chamada (minutos do dia): uma hora antes do fechamento, não antes das 18h. */
export function chainAlertMinute(reviewTime: string | null | undefined): number {
  const review = minutesOf(reviewTime) ?? 21 * 60 + 30;
  return Math.max(EARLIEST_MIN, review - BEFORE_REVIEW_MIN);
}

export interface ChainStake {
  title: string;
  /** O tamanho da corrente em jogo. */
  n: number;
  unit: 'dia' | 'semana';
  /** Faltar hoje parte a corrente (sem escudo). Senão, gasta um escudo. */
  breaks: boolean;
}

/**
 * O que está em jogo hoje neste hábito, ou null. Hoje pendente: a corrente de
 * agora. Hoje "sem resposta" (a coruja desistiu de cobrar): a falta já entrou na
 * conta — se gastou um escudo (E), fazer ainda o devolve; se partiu (Q), fazer
 * ainda salva a corrente perdida. No semanal, só no domingo e só se falta UM
 * para a cota (com mais de um, a semana já não fecha).
 */
export function chainStakeOf(def: HabitDef, stats: HabitStats, today: string, alertMin: number): ChainStake | null {
  if (def.kind !== 'fazer' || !def.enabled || def.archived || def.reminders === 'nenhum') return null;
  if (def.pausedUntil && def.pausedUntil >= today) return null;
  if (stats.formed) return null;
  const at = minutesOf(def.scheduleTime);
  if (at == null || at > alertMin - MIN_GAP_MIN) return null;
  const c = stats.chain;
  const last = c.beads.slice(-1);
  if (c.unit === 'semana') {
    if (dowOf(today) !== 0 || last !== 'H' || c.length === 0) return null;
    const per = Math.max(1, Math.min(7, def.perWeek ?? 3));
    if (stats.today !== 'pendente' || per - (stats.weekDone ?? 0) !== 1) return null;
    return { title: def.title, n: c.length, unit: 'semana', breaks: c.shields === 0 };
  }
  if (stats.today === 'pendente' && last === 'H') {
    return c.length > 0 ? { title: def.title, n: c.length, unit: 'dia', breaks: c.shields === 0 } : null;
  }
  if (stats.today === 'sem_resposta') {
    if (last === 'E' && c.length > 0) return { title: def.title, n: c.length, unit: 'dia', breaks: false };
    if (last === 'Q' && c.lost && c.lost.day === today) return { title: def.title, n: c.lost.n, unit: 'dia', breaks: true };
  }
  return null;
}

function count(s: Pick<ChainStake, 'n' | 'unit'>): string {
  if (s.unit === 'semana') return `${s.n} ${s.n === 1 ? 'semana' : 'semanas'}`;
  return `${s.n} ${s.n === 1 ? 'dia' : 'dias'}`;
}

function list(items: ChainStake[]): string {
  const shown = items.slice(0, 3).map((s) => `“${s.title}” (${count(s)})`);
  const rest = items.length - shown.length;
  if (rest > 0) shown.push(`mais ${rest}`);
  return shown.length > 1 ? `${shown.slice(0, -1).join(', ')} e ${shown[shown.length - 1]}` : shown[0];
}

/** O texto da última chamada (null sem corrente em jogo). As que se partem vêm primeiro. */
export function chainAlertText(stakes: ChainStake[]): { title: string; body: string } | null {
  if (stakes.length === 0) return null;
  const byN = (a: ChainStake, b: ChainStake) => b.n - a.n;
  const breaks = stakes.filter((s) => s.breaks).sort(byN);
  const spends = stakes.filter((s) => !s.breaks).sort(byN);
  const parts: string[] = [];
  if (breaks.length === 1) {
    const s = breaks[0];
    parts.push(
      s.unit === 'semana'
        ? `Falta uma vez hoje para fechar a semana de “${s.title}”; sem ela, a corrente de ${count(s)} se parte.`
        : `A corrente de ${count(s)} de “${s.title}” se parte à meia-noite.`,
    );
  } else if (breaks.length > 1) {
    parts.push(`Se partem à meia-noite as correntes de ${list(breaks)}.`);
  }
  if (spends.length === 1) {
    const s = spends[0];
    parts.push(`“${s.title}” ainda espera: faltar gasta um escudo da corrente de ${count(s)}.`);
  } else if (spends.length > 1) {
    parts.push(`Faltar hoje gasta um escudo de ${list(spends)}.`);
  }
  if (breaks.length) parts.push('Ainda dá tempo.');
  return {
    title: breaks.length ? '🔗 Corrente em risco' : '🔗 A corrente espera',
    body: parts.join(' '),
  };
}

async function cancelChainAlerts(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const s of scheduled) {
    const data = s.content.data as { type?: string };
    if (data?.type === CHAIN_ALERT_TYPE) await Notifications.cancelScheduledNotificationAsync(s.identifier);
  }
}

/**
 * Agenda (ou cancela) a última chamada de HOJE. Chamada a cada marcação e a
 * cada reagendamento; um erro aqui nunca atrapalha o resto dos avisos.
 */
export async function refreshChainAlert(): Promise<void> {
  try {
    await cancelChainAlerts();
    if (!(await isChainAlertEnabled())) return;
    const config = await getUserConfig();
    const alertMin = chainAlertMinute(config.reviewTime);
    const at = new Date();
    at.setHours(Math.floor(alertMin / 60), alertMin % 60, 0, 0);
    if (at.getTime() <= Date.now()) return; // já passou: a Home mostra a corrente
    const today = format(new Date(), 'yyyy-MM-dd');
    const stakes: ChainStake[] = [];
    for (const def of await listHabitRows()) {
      try {
        const s = chainStakeOf(def, await statsFor(def, today), today, alertMin);
        if (s) stakes.push(s);
      } catch {
        /* um hábito que falhe não derruba o aviso dos outros */
      }
    }
    const text = chainAlertText(stakes);
    if (!text) return;
    const channelId = await ensureChannel();
    await gatedSchedule({
      content: { title: text.title, body: text.body, data: { type: CHAIN_ALERT_TYPE } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId },
    });
  } catch (err) {
    console.warn('[chainAlert] refresh falhou:', err);
  }
}
