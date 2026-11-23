// Login Google nativo (@react-native-google-signin). O cliente OAuth do tipo
// Android é casado automaticamente por package name + SHA-1 do keystore — não
// há segredo embarcado no app.
//
// O Google passou a recusar YouTube e Drive no MESMO pedido de autorização
// ("This request contains scopes that cannot be requested together", visto em
// 23/11/2026). Por isso o login pede só a conta (e-mail e perfil) e cada
// serviço tem o seu próprio token e a sua própria janela de permissão.

import { GoogleSignin } from '@react-native-google-signin/google-signin';

import GoogleToken from '../../../modules/google-token';
import type { GoogleUser } from '../types';

export type GoogleService = 'drive' | 'youtube';

export const SERVICE_SCOPES: Record<GoogleService, string[]> = {
  youtube: ['https://www.googleapis.com/auth/youtube.readonly'],
  drive: [
    'https://www.googleapis.com/auth/drive.file',
    // Ler o vault inteiro Drive:/Aspis (inclui notas criadas no desktop), para o
    // leitor de notas in-app. drive.file só enxerga arquivos que o app criou.
    'https://www.googleapis.com/auth/drive.readonly',
  ],
};

export class NotSignedInError extends Error {
  constructor() {
    super('Conecte a sua conta Google em Configurações para usar este recurso.');
    this.name = 'NotSignedInError';
  }
}

export function configureGoogle(): void {
  // Só a conta: os escopos de cada serviço são pedidos à parte (ver acima).
  GoogleSignin.configure({ scopes: [] });
}

function toUser(data: { user: { email: string; name: string | null; photo: string | null } }): GoogleUser {
  return {
    email: data.user.email,
    name: data.user.name || data.user.email,
    photo: data.user.photo,
  };
}

/**
 * Conecta a conta e pede, uma janela por vez, a permissão de cada serviço.
 * Com a conta já conectada, pula a escolha de conta e só pede o que falta.
 */
export async function signIn(): Promise<GoogleUser | null> {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  let user = await restoreSignIn();
  if (!user) {
    const resp = await GoogleSignin.signIn();
    if (resp.type !== 'success') return null; // cancelado pelo usuário
    user = toUser(resp.data);
  }
  for (const service of ['drive', 'youtube'] as const) {
    try {
      await getAccessToken(service, { interactive: true });
    } catch {
      // permissão recusada: o serviço fica sem acesso e pede de novo depois
    }
  }
  return user;
}

export async function restoreSignIn(): Promise<GoogleUser | null> {
  try {
    if (!GoogleSignin.hasPreviousSignIn()) return null;
    const current = GoogleSignin.getCurrentUser();
    if (current) return toUser(current);
    const resp = await GoogleSignin.signInSilently();
    if (resp.type === 'success') return toUser(resp.data);
  } catch {
    // sessão expirada/sem rede → segue deslogado
  }
  return null;
}

// As janelas de permissão abrem uma de cada vez.
let consentLine: Promise<unknown> = Promise.resolve();

async function currentEmail(): Promise<string> {
  if (!GoogleSignin.hasPreviousSignIn()) throw new NotSignedInError();
  let current = GoogleSignin.getCurrentUser();
  if (!current) {
    const resp = await GoogleSignin.signInSilently();
    current = resp.type === 'success' ? resp.data : null;
  }
  const email = current?.user.email;
  if (!email) throw new NotSignedInError();
  return email;
}

/**
 * Token de acesso de UM serviço. Sem `interactive`, nunca abre janela: se a
 * permissão do serviço faltar, lança NotSignedInError (quem chama oferece o
 * "Entrar com o Google").
 */
export async function getAccessToken(
  service: GoogleService = 'drive',
  opts: { interactive?: boolean } = {},
): Promise<string> {
  try {
    const email = await currentEmail();
    const scopes = SERVICE_SCOPES[service];
    if (!GoogleToken) throw new NotSignedInError();
    if (!opts.interactive) return await GoogleToken.getToken(email, scopes, false);
    const run = consentLine.then(() => GoogleToken!.getToken(email, scopes, true));
    consentLine = run.catch(() => undefined);
    return await run;
  } catch (e) {
    if (e instanceof NotSignedInError) throw e;
    throw new NotSignedInError();
  }
}

export async function signOutGoogle(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // já deslogado
  }
}
