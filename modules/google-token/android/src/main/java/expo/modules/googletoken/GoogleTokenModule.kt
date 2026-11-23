package expo.modules.googletoken

import android.accounts.Account
import android.app.Activity
import com.google.android.gms.auth.GoogleAuthUtil
import com.google.android.gms.auth.UserRecoverableAuthException
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.concurrent.thread

private const val RC_CONSENT = 53917

/**
 * Token de acesso do Google para UM grupo de escopos.
 *
 * O Google passou a recusar YouTube e Drive no mesmo pedido de autorização
 * ("This request contains scopes that cannot be requested together"). A
 * biblioteca do login pede o token de TODOS os escopos concedidos de uma vez,
 * então cada serviço (YouTube, Drive) pega aqui o seu próprio token, e a janela
 * de permissão, quando precisa aparecer, pede só os escopos daquele serviço.
 */
class GoogleTokenModule : Module() {
  private class Pending(val email: String, val scope: String, val promise: Promise)

  @Volatile
  private var pending: Pending? = null

  override fun definition() = ModuleDefinition {
    Name("GoogleToken")

    AsyncFunction("getToken") { email: String, scopes: List<String>, interactive: Boolean, promise: Promise ->
      val scope = "oauth2:" + scopes.joinToString(" ")
      thread { fetch(email, scope, interactive, promise) }
    }

    AsyncFunction("clearToken") { token: String ->
      val ctx = appContext.reactContext
      if (ctx != null) {
        try {
          GoogleAuthUtil.clearToken(ctx, token)
        } catch (_: Exception) {
          // token já fora do cache
        }
      }
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode == RC_CONSENT) {
        val p = pending
        pending = null
        if (p != null) {
          if (payload.resultCode == Activity.RESULT_OK) {
            thread { fetch(p.email, p.scope, false, p.promise) }
          } else {
            p.promise.reject("E_CANCELLED", "A permissão não foi dada.", null)
          }
        }
      }
    }
  }

  private fun fetch(email: String, scope: String, interactive: Boolean, promise: Promise) {
    val ctx = appContext.reactContext
    if (ctx == null) {
      promise.reject("E_TOKEN", "App fora do ar.", null)
      return
    }
    try {
      promise.resolve(GoogleAuthUtil.getToken(ctx, Account(email, "com.google"), scope))
    } catch (e: UserRecoverableAuthException) {
      val activity = appContext.currentActivity
      val intent = e.intent
      if (!interactive || activity == null || intent == null) {
        promise.reject("E_NEEDS_CONSENT", "Falta a permissão da conta Google.", e)
        return
      }
      if (pending != null) {
        promise.reject("E_NEEDS_CONSENT", "Já há um pedido de permissão aberto.", e)
        return
      }
      pending = Pending(email, scope, promise)
      try {
        activity.startActivityForResult(intent, RC_CONSENT)
      } catch (err: Exception) {
        pending = null
        promise.reject("E_TOKEN", err.message ?: "Não consegui abrir a janela do Google.", err)
      }
    } catch (e: Exception) {
      promise.reject("E_TOKEN", e.message ?: "Falha ao pedir o token do Google.", e)
    }
  }
}
