package expo.modules.echopdf

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import kotlin.math.floor
import kotlin.math.sqrt

class PdfOpenException : CodedException("The PDF could not be opened")
class PdfLockedException : CodedException("The PDF is password-protected")
class PdfPageException : CodedException("The PDF page could not be rendered")

class EchoPdfModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("EchoPdf")

    AsyncFunction("pageCount") { uri: String ->
      withRenderer(uri) { it.pageCount }
    }

    // Renders one page to a JPEG at most `maxWidth` pixels wide and at most
    // `maxPixels` in area, on a white background.
    AsyncFunction("renderPage") { uri: String, index: Int, maxWidth: Double, maxPixels: Double, outUri: String, quality: Double ->
      withRenderer(uri) { renderer ->
        if (index < 0 || index >= renderer.pageCount) throw PdfPageException()
        renderer.openPage(index).use { page ->
          val w = page.width.toDouble()
          val h = page.height.toDouble()
          if (w <= 0 || h <= 0) throw PdfPageException()
          var scale = maxWidth / w
          if (w * scale * h * scale > maxPixels) scale = sqrt(maxPixels / (w * h))
          val tw = floor(w * scale).toInt().coerceAtLeast(1)
          val th = floor(h * scale).toInt().coerceAtLeast(1)
          val bitmap = Bitmap.createBitmap(tw, th, Bitmap.Config.ARGB_8888)
          try {
            bitmap.eraseColor(Color.WHITE)
            page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
            val out = File(Uri.parse(outUri).path ?: throw PdfPageException())
            FileOutputStream(out).use { stream ->
              if (!bitmap.compress(Bitmap.CompressFormat.JPEG, (quality * 100).toInt().coerceIn(1, 100), stream)) throw PdfPageException()
            }
          } finally {
            bitmap.recycle()
          }
          mapOf("width" to tw, "height" to th)
        }
      }
    }
  }

  private fun <T> withRenderer(uri: String, block: (PdfRenderer) -> T): T {
    val path = Uri.parse(uri).path ?: throw PdfOpenException()
    val pfd = try {
      ParcelFileDescriptor.open(File(path), ParcelFileDescriptor.MODE_READ_ONLY)
    } catch (e: Exception) {
      throw PdfOpenException()
    }
    val renderer = try {
      PdfRenderer(pfd)
    } catch (e: SecurityException) {
      pfd.close()
      throw PdfLockedException()
    } catch (e: Exception) {
      pfd.close()
      throw PdfOpenException()
    }
    return try {
      block(renderer)
    } finally {
      renderer.close()
      pfd.close()
    }
  }
}
