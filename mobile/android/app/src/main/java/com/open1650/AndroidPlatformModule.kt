package com.open1650

import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.view.WindowManager
import androidx.core.content.FileProvider
import com.facebook.react.bridge.*
import com.facebook.react.ReactPackage
import com.facebook.react.uimanager.ViewManager
import java.io.File
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.URLDecoder
import java.util.concurrent.Executors

/** Local assets use a loopback origin so ES modules and WebRTC work offline. */
class AndroidPlatformModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private var server: ServerSocket? = null
  private val clients = Executors.newFixedThreadPool(4)
  override fun getName() = "AndroidPlatform"

  @ReactMethod
  fun startServer(promise: Promise) {
    try {
      synchronized(this) {
        if (server == null) {
          // Keep the origin stable so WebView tempo/autoplay preferences survive restarts.
          val preferences = context.getSharedPreferences("offline-assets", android.content.Context.MODE_PRIVATE)
          val preferredPort = preferences.getInt("port", 17650)
          val socket = try {
            ServerSocket(preferredPort, 32, InetAddress.getByName("127.0.0.1"))
          } catch (_: java.net.BindException) {
            ServerSocket(0, 32, InetAddress.getByName("127.0.0.1"))
          }
          preferences.edit().putInt("port", socket.localPort).apply()
          server = socket
          Thread({
            while (!socket.isClosed) {
              try {
                val client = socket.accept()
                clients.execute { serve(client) }
              } catch (_: Exception) { if (socket.isClosed) break }
            }
          }, "Open1650-assets").apply { isDaemon = true; start() }
        }
        promise.resolve("http://127.0.0.1:${server!!.localPort}")
      }
    } catch (error: Exception) { promise.reject("ASSETS", "Unable to open the offline library", error) }
  }

  private fun serve(socket: Socket) {
    socket.use { client ->
      try {
        client.soTimeout = 5000
        val reader = client.getInputStream().bufferedReader()
        val request = reader.readLine()?.take(8192) ?: return
        var headers = 0
        while (true) {
          val line = reader.readLine() ?: break
          if (line.isEmpty()) break
          headers += line.length
          if (headers > 16384) return
        }
        val parts = request.split(' ')
        if (parts.size < 2 || parts[0] != "GET") return
        val path = URLDecoder.decode(parts[1].substringBefore('?'), "UTF-8")
        if (path.contains("..") || path.contains('\\') || path.contains('\u0000')) return
        val asset = when {
          path == "/" || path.startsWith("/psalms/") || path in listOf("/sources", "/downloads", "/about") -> "index.html"
          else -> path.removePrefix("/")
        }
        val mime = when (asset.substringAfterLast('.')) {
          "html" -> "text/html; charset=utf-8"
          "js" -> "text/javascript; charset=utf-8"
          "css" -> "text/css; charset=utf-8"
          "json" -> "application/json"
          "svg" -> "image/svg+xml"
          "png" -> "image/png"
          "woff2" -> "font/woff2"
          else -> "text/plain; charset=utf-8"
        }
        val output = client.getOutputStream()
        val input = try { context.assets.open("psalter/$asset") } catch (_: Exception) {
          output.write("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".toByteArray())
          return
        }
        input.use {
          output.write(("HTTP/1.1 200 OK\r\nContent-Type: $mime\r\n" +
            "Cache-Control: no-cache\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n").toByteArray())
          it.copyTo(output)
        }
        output.flush()
      } catch (_: Exception) { /* A navigation may cancel an asset request. */ }
    }
  }

  @ReactMethod
  fun keepAwake(enabled: Boolean) {
    context.currentActivity?.runOnUiThread {
      if (enabled) context.currentActivity?.window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      else context.currentActivity?.window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
  }

  @ReactMethod
  fun saveFile(filename: String, mime: String, base64: String, promise: Promise) {
    clients.execute {
      var uri: Uri? = null
      try {
        require(filename.matches(Regex("[A-Za-z0-9._-]{1,160}"))) { "Invalid export name" }
        require(base64.length <= 16 * 1024 * 1024) { "Export exceeds 12 MB" }
        val bytes = Base64.decode(base64, Base64.DEFAULT)
        val values = ContentValues().apply {
          put(MediaStore.Downloads.DISPLAY_NAME, filename)
          put(MediaStore.Downloads.MIME_TYPE, mime)
          put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Open1650")
          put(MediaStore.Downloads.IS_PENDING, 1)
        }
        uri = context.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
          ?: error("Could not create download")
        context.contentResolver.openOutputStream(uri)!!.use { it.write(bytes) }
        context.contentResolver.update(uri, ContentValues().apply { put(MediaStore.Downloads.IS_PENDING, 0) }, null, null)
        // Cache a copy for the Android share sheet; no storage permission is needed.
        val directory = File(context.cacheDir, "exports").apply { mkdirs() }
        File(directory, filename).writeBytes(bytes)
        promise.resolve(Arguments.createMap().apply {
          putString("uri", uri.toString()); putString("filename", filename); putString("mime", mime)
        })
      } catch (error: Exception) {
        uri?.let { context.contentResolver.delete(it, null, null) }
        promise.reject("EXPORT", "The file could not be saved", error)
      }
    }
  }

  @ReactMethod
  fun shareFile(filename: String, mime: String, promise: Promise) {
    try {
      require(filename.matches(Regex("[A-Za-z0-9._-]{1,160}")))
      val file = File(File(context.cacheDir, "exports"), filename)
      require(file.isFile) { "Export this file again before sharing" }
      val uri = FileProvider.getUriForFile(context, context.packageName + ".exports", file)
      val intent = Intent(Intent.ACTION_SEND).apply {
        type = mime; putExtra(Intent.EXTRA_STREAM, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      val activity = context.currentActivity ?: error("The app is not active")
      activity.startActivity(Intent.createChooser(intent, "Share $filename"))
      promise.resolve(null)
    } catch (error: Exception) { promise.reject("SHARE", error.message, error) }
  }

  override fun invalidate() {
    server?.close()
    clients.shutdownNow()
    super.invalidate()
  }
}

class AndroidPlatformPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(AndroidPlatformModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
