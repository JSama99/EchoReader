import ExpoModulesCore
import PDFKit
import UIKit

final class PdfOpenException: Exception {
  override var reason: String { "The PDF could not be opened" }
}

final class PdfLockedException: Exception {
  override var reason: String { "The PDF is password-protected" }
}

final class PdfPageException: Exception {
  override var reason: String { "The PDF page could not be rendered" }
}

public final class EchoPdfModule: Module {
  public func definition() -> ModuleDefinition {
    Name("EchoPdf")

    AsyncFunction("pageCount") { (uri: URL) -> Int in
      let doc = try Self.open(uri)
      return doc.pageCount
    }

    // Renders one page to a JPEG at most `maxWidth` pixels wide and at most
    // `maxPixels` in area, on a white background, honoring page rotation.
    AsyncFunction("renderPage") { (uri: URL, index: Int, maxWidth: Double, maxPixels: Double, outUri: URL, quality: Double) -> [String: Int] in
      let doc = try Self.open(uri)
      guard index >= 0, index < doc.pageCount, let page = doc.page(at: index) else { throw PdfPageException() }

      var size = page.bounds(for: .mediaBox).size
      if page.rotation % 180 != 0 { size = CGSize(width: size.height, height: size.width) }
      guard size.width > 0, size.height > 0 else { throw PdfPageException() }

      var scale = maxWidth / Double(size.width)
      if Double(size.width) * scale * Double(size.height) * scale > maxPixels {
        scale = (maxPixels / Double(size.width * size.height)).squareRoot()
      }
      let target = CGSize(width: floor(Double(size.width) * scale), height: floor(Double(size.height) * scale))

      let format = UIGraphicsImageRendererFormat()
      format.scale = 1
      format.opaque = true
      let image = UIGraphicsImageRenderer(size: target, format: format).image { ctx in
        UIColor.white.setFill()
        ctx.fill(CGRect(origin: .zero, size: target))
        let thumb = page.thumbnail(of: target, for: .mediaBox)
        thumb.draw(in: CGRect(origin: .zero, size: target))
      }
      guard let data = image.jpegData(compressionQuality: CGFloat(quality)), let cg = image.cgImage else { throw PdfPageException() }
      try data.write(to: outUri, options: .atomic)
      return ["width": cg.width, "height": cg.height]
    }
  }

  private static func open(_ uri: URL) throws -> PDFDocument {
    guard let doc = PDFDocument(url: uri) else { throw PdfOpenException() }
    if doc.isLocked { throw PdfLockedException() }
    return doc
  }
}
