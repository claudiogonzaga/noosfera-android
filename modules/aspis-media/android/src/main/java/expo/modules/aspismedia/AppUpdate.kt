package expo.modules.aspismedia

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * A ATUALIZAÇÃO DO APP pela vitrine (consciencia.eco.br/noosfera, v1.134+).
 *
 * Baixa o APK novo para o cache do app CALCULANDO o SHA-256 no caminho e só o
 * entrega se bater com o publicado — um byte diferente e o arquivo é apagado. Aí
 * abre o instalador do Android, que pede um toque (nenhum app instala sem ele).
 *
 * Só aceita o link fixo do portal (https://consciencia.eco.br/noosfera/…).
 */
object AppUpdate {
  private const val ALLOWED = "https://consciencia.eco.br/noosfera/"
  private const val NAME = "Noosfera-update.apk"

  private fun dir(ctx: Context): File = File(ctx.cacheDir, "app-update").apply { mkdirs() }

  /** O APK já baixado e conferido desta versão, se houver. */
  fun ready(ctx: Context, sha256: String): String? {
    val f = File(dir(ctx), NAME)
    return if (f.exists() && hashOf(f) == sha256.lowercase()) f.absolutePath else null
  }

  fun download(ctx: Context, url: String, sha256: String): String {
    require(url.startsWith(ALLOWED)) { "Link de atualização fora da vitrine." }
    val want = sha256.lowercase()
    require(Regex("^[0-9a-f]{64}$").matches(want)) { "A versão publicada não traz o SHA-256." }
    ready(ctx, want)?.let { return it }
    val part = File(dir(ctx), "$NAME.part")
    val out = File(dir(ctx), NAME)
    out.delete()
    val digest = MessageDigest.getInstance("SHA-256")
    var conn = URL(url).openConnection() as HttpURLConnection
    conn.instanceFollowRedirects = true
    conn.connectTimeout = 20_000
    conn.readTimeout = 60_000
    conn.setRequestProperty("User-Agent", "Noosfera-Android")
    try {
      if (conn.responseCode !in 200..299) throw IllegalStateException("A vitrine respondeu ${conn.responseCode}.")
      conn.inputStream.use { input ->
        part.outputStream().use { output ->
          val buf = ByteArray(1 shl 16)
          while (true) {
            val n = input.read(buf)
            if (n < 0) break
            digest.update(buf, 0, n)
            output.write(buf, 0, n)
          }
        }
      }
    } finally {
      conn.disconnect()
    }
    val got = digest.digest().joinToString("") { "%02x".format(it) }
    if (got != want) {
      part.delete()
      throw IllegalStateException("O arquivo baixado não confere com o SHA-256 publicado: a atualização foi descartada.")
    }
    if (!part.renameTo(out)) throw IllegalStateException("Não consegui guardar o instalador.")
    return out.absolutePath
  }

  /** O Android deixa este app abrir o instalador? (Android 8+: "instalar apps desconhecidos".) */
  fun canInstall(ctx: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.O || ctx.packageManager.canRequestPackageInstalls()

  /** Abre a tela do sistema onde se permite que a Noosfera instale atualizações. */
  fun openInstallPermission(ctx: Context) {
    val i = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${ctx.packageName}"))
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    ctx.startActivity(i)
  }

  /** Abre o instalador do Android com o APK conferido. */
  fun install(ctx: Context, path: String) {
    val f = File(path)
    require(f.exists() && f.parentFile == dir(ctx)) { "Instalador não encontrado." }
    val uri = FileProvider.getUriForFile(ctx, "${ctx.packageName}.FileSystemFileProvider", f)
    val i = Intent(Intent.ACTION_VIEW)
      .setDataAndType(uri, "application/vnd.android.package-archive")
      .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
    ctx.startActivity(i)
  }

  private fun hashOf(f: File): String {
    val d = MessageDigest.getInstance("SHA-256")
    f.inputStream().use { input ->
      val buf = ByteArray(1 shl 16)
      while (true) {
        val n = input.read(buf)
        if (n < 0) break
        d.update(buf, 0, n)
      }
    }
    return d.digest().joinToString("") { "%02x".format(it) }
  }
}
