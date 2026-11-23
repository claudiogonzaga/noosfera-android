// Trazer o texto de um documento para o "Leia para mim": um Google Docs (pelo link,
// exportado como texto pelo Drive com a conta Google do app) ou um arquivo Word
// (.docx, lido aqui mesmo). O seletor de arquivos do Android não entrega o
// conteúdo de um Google Docs — por isso o link.

import { strFromU8, unzipSync } from 'fflate';

import { getAccessToken, NotSignedInError } from '../aspis/services/auth';

/** Falta conectar a conta Google à Noosfera: a tela oferece o login ali mesmo. */
export class GoogleAccountNeeded extends Error {
  constructor() {
    super('Conecte a sua conta Google à Noosfera para ler o documento.');
    this.name = 'GoogleAccountNeeded';
  }
}

const GOOGLE_DOC = /docs\.google\.com\/document\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]{20,})/;

// Um pedido de token por vez: a biblioteca do login do Google só acompanha UMA
// chamada nativa de cada vez, e duas simultâneas (nome e texto do documento
// pedidos juntos) derrubavam uma à outra — o que parecia "conta não conectada".
let tokenFlight: Promise<string> | null = null;
function driveToken(): Promise<string> {
  if (!tokenFlight) {
    tokenFlight = getAccessToken()
      .catch((e) => {
        if (e instanceof NotSignedInError) throw new GoogleAccountNeeded();
        throw e;
      })
      .finally(() => {
        tokenFlight = null;
      });
  }
  return tokenFlight;
}

/** O id do documento, se o texto for (ou contiver só) um link do Google Docs. */
export function googleDocId(text: string): string | null {
  const t = text.trim();
  if (!t || t.length > 600) return null;
  return GOOGLE_DOC.exec(t)?.[1] ?? null;
}

/** O texto do Google Docs, exportado pelo Drive. Lança Error com uma mensagem para a pessoa. */
export async function fetchGoogleDocText(id: string): Promise<string> {
  const token = await driveToken();
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}/export?mimeType=text%2Fplain`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.status === 404 || res.status === 403) {
    throw new Error('A sua conta Google não abre esse documento (ele é seu ou foi compartilhado com você?).');
  }
  if (!res.ok) throw new Error(`O Drive não entregou o documento (HTTP ${res.status}).`);
  return tidy(await res.text());
}

/**
 * O nome e a data da última alteração de um Google Docs — barato, para saber se
 * o documento mudou sem baixar o texto. Lança Error com uma mensagem para a pessoa.
 */
export async function fetchGoogleDocInfo(id: string): Promise<{ name: string; modifiedTime: string }> {
  const token = await driveToken();
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=name%2CmodifiedTime&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.status === 404 || res.status === 403) {
    throw new Error('A sua conta Google não abre esse documento (ele é seu ou foi compartilhado com você?).');
  }
  if (!res.ok) throw new Error(`O Drive não respondeu sobre o documento (HTTP ${res.status}).`);
  const j = (await res.json()) as { name?: string; modifiedTime?: string };
  return { name: j.name ?? '', modifiedTime: j.modifiedTime ?? '' };
}

/** O texto de um .docx: os parágrafos de word/document.xml, sem a formatação. */
export function docxToText(bytes: Uint8Array): string {
  const files = unzipSync(bytes, { filter: (f) => f.name === 'word/document.xml' });
  const xml = files['word/document.xml'];
  if (!xml) throw new Error('Esse arquivo Word não tem texto que eu consiga ler.');
  const src = strFromU8(xml);
  let out = '';
  const re = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:(?:br|cr)(?:\s[^>]*)?\/>|<\/w:p>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m[1] !== undefined) out += m[1];
    else if (m[0] === '<w:tab/>') out += '\t';
    else if (m[0] === '</w:p>') out += '\n\n';
    else out += '\n';
  }
  return tidy(decodeEntities(out));
}

/** Parece um .docx (zip de Word)? */
export function isDocx(name: string | undefined, mime: string | undefined, bytes?: Uint8Array): boolean {
  if (/\.docx$/i.test(name ?? '') || (mime ?? '').includes('wordprocessingml')) return true;
  return !!bytes && bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && /\.docx?$/i.test(name ?? '');
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function tidy(s: string): string {
  return s
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
