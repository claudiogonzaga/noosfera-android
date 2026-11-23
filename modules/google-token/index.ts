// Token de acesso do Google para UM grupo de escopos (YouTube ou Drive): o
// Google recusa os dois no mesmo pedido. Ver GoogleTokenModule.kt.
import { requireOptionalNativeModule } from 'expo-modules-core';

type Spec = {
  /** Rejeita com code E_NEEDS_CONSENT (falta permissão), E_CANCELLED ou E_TOKEN. */
  getToken(email: string, scopes: string[], interactive: boolean): Promise<string>;
  clearToken(token: string): Promise<void>;
};

export default requireOptionalNativeModule<Spec>('GoogleToken');
