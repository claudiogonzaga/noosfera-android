// "Leia para mim" com um Google Docs VINCULADO (pedido de 22/11/2026).
//
// O texto salvo guarda o id do documento. A cada vez que vai tocar, o app
// confere no Drive se o documento mudou (pela data da última alteração, que é
// barata; o texto só é baixado se ela mudou). Se mudou, o áudio é gerado de
// novo — mas só os trechos alterados: os trechos prontos ficam guardados em
// disco pelo seu texto, e o rechunkText mantém iguais os trechos do começo e do
// fim que não mudaram. "Gerar tudo de novo" ignora o que está guardado.

import { File } from 'expo-file-system';

import type { ReadAloudDocAudio, ReadAloudText } from '../types';
import { getReadAloudText, setReadAloudTextDoc } from './database';
import { getActiveTtsModel } from './geminiTTS';
import { fetchGoogleDocInfo, fetchGoogleDocText, GoogleAccountNeeded } from './importText';
import { readAloudChunks } from './voice';

/** O que define o áudio além do texto: modelo de voz do Gemini, voz e leitura pausada. */
export function docAudioKey(voice: string, paused: boolean): string {
  return `${getActiveTtsModel()}|${voice}|${paused ? 1 : 0}`;
}

export interface DocSync {
  item: ReadAloudText;
  /** O Drive respondeu? (false = sem rede ou sem acesso: segue com o texto guardado) */
  checked: boolean;
  /** O texto do documento mudou desde a última vez. */
  changed: boolean;
  error?: string;
  /** Não conferiu porque falta conectar a conta Google à Noosfera. */
  needsGoogle?: boolean;
}

/** Confere o documento no Drive e, se mudou, traz o texto novo para o texto salvo. */
export async function syncReadAloudDoc(item: ReadAloudText): Promise<DocSync> {
  if (!item.docId) return { item, checked: false, changed: false };
  try {
    const info = await fetchGoogleDocInfo(item.docId);
    if (info.modifiedTime && info.modifiedTime === item.docModified) {
      return { item, checked: true, changed: false };
    }
    const text = await fetchGoogleDocText(item.docId);
    if (!text.trim()) throw new Error('O documento está vazio.');
    const changed = text.trim() !== item.content.trim();
    await setReadAloudTextDoc(item.id, { content: text, docModified: info.modifiedTime || null });
    const fresh = await getReadAloudText(item.id);
    return { item: fresh ?? { ...item, content: text, docModified: info.modifiedTime }, checked: true, changed };
  } catch (e) {
    return {
      item,
      checked: false,
      changed: false,
      error: e instanceof Error ? e.message : String(e),
      needsGoogle: e instanceof GoogleAccountNeeded,
    };
  }
}

export interface DocPlan {
  /** Trechos do áudio guardado que podem ser reaproveitados (null = nenhum). */
  prevChunks: string[] | null;
  /** Trechos do texto de agora. */
  chunks: string[];
  /** Quantos desses trechos ainda não têm áudio (os que mudaram). */
  novos: number;
  /** O áudio guardado já é o do texto de agora, nesta voz e neste modelo. */
  upToDate: boolean;
  key: string;
}

/** O que falta gerar para o áudio de um texto vinculado ficar em dia. */
export function planReadAloudDoc(item: ReadAloudText, voice: string, paused: boolean): DocPlan {
  const key = docAudioKey(voice, paused);
  const prevChunks = item.docAudio?.key === key ? item.docAudio.chunks : null;
  const chunks = readAloudChunks(item.content, { paused, prevChunks });
  const old = new Set(prevChunks ?? []);
  const novos = chunks.filter((c) => !old.has(c)).length;
  let hasFile = false;
  try {
    hasFile = !!item.audioUri && new File(item.audioUri).exists;
  } catch {
    hasFile = false;
  }
  const same =
    !!prevChunks && prevChunks.length === chunks.length && prevChunks.every((c, i) => c === chunks[i]);
  return { prevChunks, chunks, novos, upToDate: hasFile && item.audioVoice === voice && same, key };
}

export function docAudioOf(plan: DocPlan, chunks: string[]): ReadAloudDocAudio {
  return { key: plan.key, chunks };
}
