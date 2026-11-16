// ATUALIZAÇÃO DO APP pela VITRINE (v1.134+).
//
// Os repositórios de código são privados; as versões saem em
// https://consciencia.eco.br/noosfera (os instaladores ficam no repositório público
// noosfera-releases). O app consulta /noosfera/versao — que funciona também na rede
// do MPMT, que bloqueia o github.com — e, achando versão nova:
//  - no Wi-Fi, BAIXA SOZINHO o APK pelo link fixo do portal e CONFERE o SHA-256
//    publicado (no nativo, AppUpdate.kt): um byte diferente e o arquivo é descartado;
//  - pronto o download, pergunta "Instalar agora?" e abre o instalador do Android
//    (que pede o toque final: nenhum app instala sem ele).
// Nos dados móveis, só avisa; o "Baixar e instalar" dos Ajustes (ou o aviso da Home)
// faz o mesmo caminho na hora.

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Alert, AppState, Platform } from 'react-native';

import AspisMedia from '../../modules/aspis-media';

const VERSAO_URL = 'https://consciencia.eco.br/noosfera/versao';
export const PAGINA_VERSOES = 'https://consciencia.eco.br/noosfera/';
const ALLOWED = 'https://consciencia.eco.br/noosfera/';
const LAST_CHECK_KEY = 'comentor.lastUpdateCheckAt';
const SKIPPED_VERSION_KEY = 'comentor.skippedVersion';
/** Quando perguntou "Instalar agora?" por último (para não insistir): "<versão>|<ms>". */
const PROMPTED_KEY = 'noosfera.updatePrompted';
const PROMPT_AGAIN_MS = 12 * 60 * 60 * 1000;

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string | null;
  /** O link fixo do APK no portal (baixa sempre a versão mais nova). */
  downloadUrl: string | null;
  /** A página de versões. */
  releaseUrl: string | null;
  notes: string | null;
  publishedAt: string | null;
  sha256: string | null;
  size: number | null;
}

export function getCurrentVersion(): string {
  return (Constants.expoConfig?.version as string | undefined) ?? '1.0.0';
}

function normalize(v: string): string {
  return v.trim().replace(/^v/i, '');
}

function compare(a: string, b: string): number {
  const an = normalize(a).split(/[.+-]/).map((p) => parseInt(p, 10) || 0);
  const bn = normalize(b).split(/[.+-]/).map((p) => parseInt(p, 10) || 0);
  const len = Math.max(an.length, bn.length);
  for (let i = 0; i < len; i++) {
    const ai = an[i] ?? 0;
    const bi = bn[i] ?? 0;
    if (ai > bi) return 1;
    if (ai < bi) return -1;
  }
  return 0;
}

interface VersaoPlataforma {
  versao: string;
  publicada: string | null;
  notas: string;
  url: string;
  tamanho: number | null;
  sha256: string | null;
}

export async function checkForUpdate(force = false): Promise<UpdateInfo> {
  const current = getCurrentVersion();
  const empty: UpdateInfo = {
    available: false,
    currentVersion: current,
    latestVersion: null,
    downloadUrl: null,
    releaseUrl: null,
    notes: null,
    publishedAt: null,
    sha256: null,
    size: null,
  };

  if (!force) {
    const last = await AsyncStorage.getItem(LAST_CHECK_KEY);
    if (last && Date.now() - Number(last) < 6 * 60 * 60 * 1000) {
      // consultou há menos de 6 h; só segue se for pedido
      return empty;
    }
  }

  try {
    const res = await fetch(VERSAO_URL, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`vitrine ${res.status}`);
    const data = (await res.json()) as { pagina?: string; android?: VersaoPlataforma };
    await AsyncStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
    const a = data.android;
    if (!a?.versao) return empty;

    const url = typeof a.url === 'string' && a.url.startsWith(ALLOWED) ? a.url : null;
    const sha = typeof a.sha256 === 'string' && /^[0-9a-f]{64}$/i.test(a.sha256) ? a.sha256.toLowerCase() : null;
    const info: UpdateInfo = {
      available: compare(a.versao, current) > 0 && !!url,
      currentVersion: current,
      latestVersion: normalize(a.versao),
      downloadUrl: url,
      releaseUrl: data.pagina?.startsWith(ALLOWED) ? data.pagina : PAGINA_VERSOES,
      notes: a.notas || null,
      publishedAt: a.publicada,
      sha256: sha,
      size: typeof a.tamanho === 'number' ? a.tamanho : null,
    };
    if (info.available && !force) void autoUpdate(info);
    return info;
  } catch (err) {
    console.warn('update check failed:', err);
    return empty;
  }
}

export async function isVersionSkipped(version: string): Promise<boolean> {
  const skipped = await AsyncStorage.getItem(SKIPPED_VERSION_KEY);
  return skipped === normalize(version);
}

export async function skipVersion(version: string) {
  await AsyncStorage.setItem(SKIPPED_VERSION_KEY, normalize(version));
}

export async function clearSkip() {
  await AsyncStorage.removeItem(SKIPPED_VERSION_KEY);
}

let downloading: Promise<string> | null = null;

/** Baixa (ou reaproveita) o APK conferido. Lança Error com mensagem para a pessoa. */
async function fetchApk(info: UpdateInfo): Promise<string> {
  if (Platform.OS !== 'android') throw new Error('A atualização automática é só no Android.');
  if (!info.downloadUrl || !info.sha256) throw new Error('A versão publicada não traz o SHA-256: não instalo sem conferir.');
  const ready = AspisMedia.appUpdateReady(info.sha256);
  if (ready) return ready;
  downloading ??= AspisMedia.downloadAppUpdate(info.downloadUrl, info.sha256).finally(() => {
    downloading = null;
  });
  return downloading;
}

/** Abre o instalador do Android; sem a permissão, leva à tela de permitir. */
function openInstaller(path: string): void {
  if (!AspisMedia.canInstallUpdates()) {
    Alert.alert(
      'Permitir atualizações',
      'Para a Noosfera instalar as próprias atualizações, o Android pede uma permissão, uma vez só: ative "Permitir desta fonte" na tela que vai abrir e volte.',
      [
        { text: 'Agora não', style: 'cancel' },
        { text: 'Abrir', onPress: () => AspisMedia.openInstallPermission() },
      ],
    );
    return;
  }
  AspisMedia.installAppUpdate(path);
}

/**
 * O "Baixar e instalar" (Ajustes, aviso da Home): baixa na hora (qualquer rede),
 * confere e abre o instalador. Devolve false se falhou (já avisou a pessoa).
 */
export async function downloadAndInstall(info: UpdateInfo): Promise<boolean> {
  try {
    const path = await fetchApk(info);
    openInstaller(path);
    return true;
  } catch (err) {
    Alert.alert('Atualização', err instanceof Error ? err.message : String(err));
    return false;
  }
}

/**
 * Sozinho, depois de achar versão nova: no Wi-Fi baixa e confere; com o app na
 * frente, pergunta "Instalar agora?" (no máximo a cada 12 h por versão).
 */
async function autoUpdate(info: UpdateInfo): Promise<void> {
  try {
    if (Platform.OS !== 'android' || !info.latestVersion || !info.sha256) return;
    if (await isVersionSkipped(info.latestVersion)) return;
    let path = AspisMedia.appUpdateReady(info.sha256);
    if (!path) {
      if (!AspisMedia.isUnmeteredNetwork()) return; // nos dados móveis, só o aviso
      path = await fetchApk(info);
    }
    const prompted = (await AsyncStorage.getItem(PROMPTED_KEY)) ?? '';
    const [pv, pms] = prompted.split('|');
    if (pv === info.latestVersion && Date.now() - Number(pms || 0) < PROMPT_AGAIN_MS) return;
    if (AppState.currentState !== 'active') return;
    await AsyncStorage.setItem(PROMPTED_KEY, `${info.latestVersion}|${Date.now()}`);
    const apk = path;
    Alert.alert(
      `Noosfera ${info.latestVersion}`,
      'A versão nova já foi baixada e conferida. Instalar agora? Os seus dados ficam.',
      [
        { text: 'Depois', style: 'cancel' },
        { text: 'Pular esta versão', onPress: () => void skipVersion(info.latestVersion as string) },
        { text: 'Instalar', onPress: () => openInstaller(apk) },
      ],
    );
  } catch (err) {
    console.warn('[update] automático falhou:', err);
  }
}
