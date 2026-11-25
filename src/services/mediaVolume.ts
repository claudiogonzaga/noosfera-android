// VOLUME DAS TRILHAS do app (respiração, "Leia para mim", Ioga Nidra, Sequência),
// à parte do volume do celular: para fazer a respiração com um vídeo do YouTube
// tocando junto e baixar só a trilha (pedido de 24/11/2026). 0–1, guardado.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AudioPlayer } from 'expo-audio';

const KEY = 'media.volume.v1';
let volume = 1;
let loaded = false;
const players = new Set<AudioPlayer>();
const listeners = new Set<(v: number) => void>();

export function getMediaVolume(): number {
  return volume;
}

/** Lê o volume guardado (uma vez) e aplica aos tocadores vivos. */
export async function loadMediaVolume(): Promise<number> {
  if (loaded) return volume;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const v = raw == null ? NaN : Number(raw);
    if (Number.isFinite(v)) setMediaVolume(v, { persist: false });
  } catch {
    /* fica 100% */
  }
  return volume;
}

export function setMediaVolume(v: number, opts: { persist?: boolean } = {}): void {
  volume = Math.max(0, Math.min(1, Math.round(v * 100) / 100));
  for (const p of players) {
    try {
      p.volume = volume;
    } catch {
      players.delete(p); // já liberado
    }
  }
  listeners.forEach((l) => l(volume));
  if (opts.persist !== false) AsyncStorage.setItem(KEY, String(volume)).catch(() => {});
}

/** Registra um tocador: nasce com o volume das trilhas e acompanha as mudanças. */
export function trackMediaPlayer(p: AudioPlayer): void {
  players.add(p);
  try {
    p.volume = volume;
  } catch {
    /* tocador sem volume */
  }
  if (!loaded) void loadMediaVolume();
}

export function untrackMediaPlayer(p: AudioPlayer | null | undefined): void {
  if (p) players.delete(p);
}

export function onMediaVolume(fn: (v: number) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
