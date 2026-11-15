// O BLUESKY DO MAC (v1.133, pedido de 15/11/2026): um programa no Mac lê o
// Bluesky, filtra e dá nota aos posts e grava o resultado na pasta Aspis do
// Drive; o celular só lê esse feed e devolve as marcações (👍 1 · 👎 0 · ➡️ -1).
//
// Dois arquivos, ambos na pasta Aspis:
//  - bluesky_feed.json    → o Mac escreve, o celular lê;
//  - bluesky_rotulos.json → o celular escreve, o Mac lê.
//
// O escopo drive.file só deixa o app ESCREVER no que ele mesmo criou. Por isso é
// o celular que cria os dois arquivos, na primeira abertura, e guarda os ids; o
// Mac depois sobrescreve o conteúdo do feed pelo espelho do Drive para desktop (o
// id se mantém). Nunca se cria um segundo arquivo com o mesmo nome: se houver
// duplicata, vale o modificado por último e fica um aviso no log.
//
// Cada marcação entra numa fila local persistente (meta do SQLite) e o envio vai
// ~3 s depois da última. O envio lê os rótulos do Drive, mescla com a fila (por
// uri; o mais recente vence), guarda os 2000 mais recentes e regrava. Só depois de
// gravar com sucesso a fila é limpa; se falhar, tenta de novo na próxima abertura.

import { format } from 'date-fns';

import * as db from './db';
import { getAccessToken } from './auth';
import {
  createJsonFile,
  DriveError,
  ensureAspisFolder,
  fileInfo,
  findFilesNewestFirst,
  readJsonFile,
  updateJsonFile,
} from './drive';

export const FEED_FILE = 'bluesky_feed.json';
export const LABELS_FILE = 'bluesky_rotulos.json';
const EMPTY_FEED = JSON.stringify({ posts: [] });
const EMPTY_LABELS = JSON.stringify({ rotulos: [] });

/** Quantos rótulos o arquivo guarda (os mais recentes). */
export const MAX_LABELS = 2000;
/** Espera depois da última marcação antes de enviar. */
const FLUSH_DEBOUNCE_MS = 3000;
/** Feed mais velho que isto: o Mac provavelmente está desligado. */
export const STALE_MS = 2 * 3600 * 1000;

const K = {
  feedId: 'bsky_feed_file_id',
  labelsId: 'bsky_labels_file_id',
  queue: 'bsky_label_queue',
  sent: 'bsky_sent_uris',
  cache: 'bsky_feed_cache',
};

export interface BskyPost {
  uri: string;
  handle: string;
  nome: string;
  texto: string;
  nota: string;
  quando: string;
  link: string;
}

export interface BskyFeed {
  gerado_em: string | null;
  status: string | null;
  posts: BskyPost[];
}

/** 1 = quero mais · 0 = não quero · -1 = pular (neutro). */
export type BskyVote = 1 | 0 | -1;

export interface BskyLabel {
  uri: string;
  v: BskyVote;
  ts: string;
}

// ---- lógica pura (testada fora do app) -------------------------------------

const str = (x: unknown): string => (typeof x === 'string' ? x : typeof x === 'number' ? String(x) : '');

/** O JSON do Mac → um feed bem formado (campos que faltam viram texto vazio; post sem uri sai). */
export function normalizeFeed(raw: unknown): BskyFeed {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const list = Array.isArray(o.posts) ? o.posts : [];
  const posts: BskyPost[] = [];
  const seen = new Set<string>();
  for (const p of list) {
    if (!p || typeof p !== 'object') continue;
    const r = p as Record<string, unknown>;
    const uri = str(r.uri).trim();
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    posts.push({
      uri,
      handle: str(r.handle).replace(/^@/, ''),
      nome: str(r.nome),
      texto: str(r.texto),
      nota: str(r.nota),
      quando: str(r.quando),
      link: str(r.link),
    });
  }
  return {
    gerado_em: str(o.gerado_em) || null,
    status: str(o.status) || null,
    posts,
  };
}

function isVote(v: unknown): v is BskyVote {
  return v === 1 || v === 0 || v === -1;
}

/** Os rótulos de um arquivo qualquer → só os válidos. */
export function normalizeLabels(raw: unknown): BskyLabel[] {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const list = Array.isArray(o.rotulos) ? o.rotulos : [];
  const out: BskyLabel[] = [];
  for (const r of list) {
    if (!r || typeof r !== 'object') continue;
    const x = r as Record<string, unknown>;
    const uri = str(x.uri).trim();
    if (!uri || !isVote(x.v)) continue;
    out.push({ uri, v: x.v, ts: str(x.ts) });
  }
  return out;
}

/**
 * Junta os rótulos do Drive com os novos: um por uri, vence o de `ts` mais
 * recente (empate: o novo). Devolve os `max` mais recentes, do mais novo ao mais velho.
 */
export function mergeLabels(remote: BskyLabel[], incoming: BskyLabel[], max = MAX_LABELS): BskyLabel[] {
  const byUri = new Map<string, BskyLabel>();
  for (const l of remote) {
    const prev = byUri.get(l.uri);
    if (!prev || l.ts > prev.ts) byUri.set(l.uri, l);
  }
  for (const l of incoming) {
    const prev = byUri.get(l.uri);
    if (!prev || l.ts >= prev.ts) byUri.set(l.uri, l);
  }
  return [...byUri.values()].sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0)).slice(0, max);
}

/** A fila com mais uma marcação (a anterior do mesmo post é trocada). */
export function enqueue(queue: BskyLabel[], label: BskyLabel): BskyLabel[] {
  return [...queue.filter((l) => l.uri !== label.uri), label];
}

/** O que sobra na fila depois de um envio: só o que chegou (ou mudou) durante ele. */
export function afterSend(queue: BskyLabel[], sent: BskyLabel[]): BskyLabel[] {
  const done = new Set(sent.map((l) => `${l.uri}\u0000${l.ts}\u0000${l.v}`));
  return queue.filter((l) => !done.has(`${l.uri}\u0000${l.ts}\u0000${l.v}`));
}

/** Os posts do feed que ainda não foram marcados, na ordem recebida. */
export function visiblePosts(feed: BskyFeed, hidden: Set<string>): BskyPost[] {
  return feed.posts.filter((p) => !hidden.has(p.uri));
}

/** "2026-11-15T16:40:00" (hora do Mac, sem fuso) ou ISO com fuso → Date; null se não der. */
export function parseGenerated(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/.exec(s.trim());
  if (m) {
    const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], m[6] ? +m[6] : 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t) : null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "16:40" (hoje) ou "14/11 16:40". */
export function shortWhen(d: Date, now: Date = new Date()): string {
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return d.toDateString() === now.toDateString() ? hm : `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${hm}`;
}

/** O aviso de feed parado (mais de 2 h), ou null. */
export function staleWarning(gerado: string | null, now: Date = new Date()): string | null {
  const d = parseGenerated(gerado);
  if (!d || now.getTime() - d.getTime() <= STALE_MS) return null;
  return `O Mac não atualiza o feed desde ${shortWhen(d, now)} (desligado?)`;
}

/** A nota do Mac ("0.87") em texto discreto: "nota 0,87". */
export function noteLabel(nota: string): string {
  const n = Number(String(nota).replace(',', '.'));
  if (!nota || !Number.isFinite(n)) return nota ? `nota ${nota}` : '';
  return `nota ${n.toFixed(2).replace('.', ',')}`;
}

// ---- estado local (meta do SQLite) -----------------------------------------

function readJsonMeta<T>(key: string, fallback: T): T {
  try {
    const raw = db.getMeta(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function queue(): BskyLabel[] {
  return normalizeLabels({ rotulos: readJsonMeta<unknown[]>(K.queue, []) });
}

function saveQueue(q: BskyLabel[]): void {
  db.setMeta(K.queue, JSON.stringify(q));
}

function sentUris(): string[] {
  const list = readJsonMeta<unknown[]>(K.sent, []);
  return Array.isArray(list) ? list.filter((u): u is string => typeof u === 'string') : [];
}

/** Os posts já marcados (na fila ou já enviados): não reaparecem no feed. */
export function hiddenUris(): Set<string> {
  return new Set([...sentUris(), ...queue().map((l) => l.uri)]);
}

/** Quantas marcações esperam envio. */
export function pendingCount(): number {
  return queue().length;
}

/** O último feed baixado, para abrir a tela sem rede. */
export function cachedFeed(): BskyFeed | null {
  const raw = readJsonMeta<unknown>(K.cache, null);
  return raw ? normalizeFeed(raw) : null;
}

// ---- Drive ------------------------------------------------------------------

/**
 * O id do arquivo: o guardado (se ainda existe), senão o achado pelo nome na
 * pasta Aspis, senão um arquivo novo com o conteúdo vazio. Nunca cria duplicata.
 */
async function locate(token: string, name: string, key: string, empty: string): Promise<string> {
  const cached = db.getMeta(key);
  if (cached) {
    const info = await fileInfo(token, cached);
    if (info) return info.id;
  }
  const folderId = await ensureAspisFolder(token);
  const found = await findFilesNewestFirst(token, folderId, name);
  if (found.length > 1) {
    console.warn(
      `[aspis] bluesky: ${found.length} arquivos "${name}" na pasta Aspis; uso o mais recente (${found[0].id}).`,
    );
  }
  const id = found[0]?.id ?? (await createJsonFile(token, folderId, name, empty));
  db.setMeta(key, id);
  return id;
}

export interface BskyFileIds {
  feed: string;
  labels: string;
}

/** Garante os dois arquivos na pasta Aspis (cria o que faltar) e devolve os ids. */
export async function ensureFiles(token?: string): Promise<BskyFileIds> {
  const t = token ?? (await getAccessToken());
  const feed = await locate(t, FEED_FILE, K.feedId, EMPTY_FEED);
  const labels = await locate(t, LABELS_FILE, K.labelsId, EMPTY_LABELS);
  return { feed, labels };
}

/** Os ids guardados (para conferir nos Ajustes ou no log). */
export function storedFileIds(): Partial<BskyFileIds> {
  return { feed: db.getMeta(K.feedId) ?? undefined, labels: db.getMeta(K.labelsId) ?? undefined };
}

/**
 * Baixa o feed do Drive (alt=media). Lança NotSignedInError / DriveError; um
 * JSON pela metade (o Mac gravando agora) também lança — basta puxar de novo.
 */
export async function fetchFeed(): Promise<BskyFeed> {
  const token = await getAccessToken();
  const { feed: id } = await ensureFiles(token);
  const raw = await readJsonFile<unknown>(token, id);
  if (raw == null) {
    // apagado entre o locate e a leitura: esquece o id; a próxima abertura recria
    db.setMeta(K.feedId, '');
    throw new DriveError('O arquivo do feed sumiu do Drive.', 404);
  }
  const feed = normalizeFeed(raw);
  db.setMeta(K.cache, JSON.stringify(feed));
  return feed;
}

// ---- marcar e enviar --------------------------------------------------------

type Listener = () => void;
const listeners = new Set<Listener>();
/** Avisa a tela quando a fila muda (envio feito ou falho). */
export function onLabelsChange(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function emit(): void {
  for (const cb of listeners) {
    try {
      cb();
    } catch {
      /* a tela que falhe não derruba o envio */
    }
  }
}

let lastError: string | null = null;
/** A última falha de envio (null depois de um envio bom). */
export function lastSendError(): string | null {
  return lastError;
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Marca um post: entra na fila na hora e o envio sai ~3 s depois da última marcação. */
export function markPost(uri: string, v: BskyVote, now: Date = new Date()): void {
  saveQueue(enqueue(queue(), { uri, v, ts: format(now, "yyyy-MM-dd'T'HH:mm:ss") }));
  scheduleFlush();
}

export function scheduleFlush(delay = FLUSH_DEBOUNCE_MS): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void flushLabels();
  }, delay);
}

let running: Promise<boolean> | null = null;

async function sendOnce(): Promise<boolean> {
  const batch = queue();
  if (batch.length === 0) return true;
  const token = await getAccessToken();
  const { labels: id } = await ensureFiles(token);
  const remote = normalizeLabels(await readJsonFile<unknown>(token, id));
  const merged = mergeLabels(remote, batch);
  await updateJsonFile(token, id, JSON.stringify({ rotulos: merged }));
  // gravou: tira da fila só o que foi junto (marcações feitas durante o envio ficam)
  saveQueue(afterSend(queue(), batch));
  db.setMeta(K.sent, JSON.stringify(merged.map((l) => l.uri)));
  return true;
}

/**
 * Envia a fila. Nunca lança: sem rede ou com o token vencido, a fila fica e o
 * envio se repete na próxima abertura/atualização da tela. Devolve se enviou.
 */
export function flushLabels(): Promise<boolean> {
  if (running) {
    // já há um envio: depois dele, mais uma passada pega o que entrou no meio
    return running.then(() => (queue().length ? flushLabels() : true));
  }
  running = (async () => {
    try {
      const ok = await sendOnce();
      lastError = null;
      return ok;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      console.warn('[aspis] bluesky: envio dos rótulos falhou (fica na fila):', e);
      return false;
    } finally {
      running = null;
      emit();
    }
  })();
  return running;
}
