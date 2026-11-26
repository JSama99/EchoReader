import { requireOptionalNativeModule } from 'expo';

/**
 * Local Expo module: renders PDF pages with the platform's own PDF engine
 * (PDFKit on iOS, android.graphics.pdf.PdfRenderer on Android). Nothing is
 * bundled or downloaded. Returns null where the native module isn't present
 * (web, Expo Go, Jest), so callers can explain that PDF import needs the app.
 */
type EchoPdfNative = {
  pageCount(uri: string): Promise<number>;
  renderPage(uri: string, index: number, maxWidth: number, maxPixels: number, outUri: string, quality: number): Promise<{ width: number; height: number }>;
};

export const EchoPdf = requireOptionalNativeModule<EchoPdfNative>('EchoPdf');
