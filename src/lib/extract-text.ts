/**
 * Best-effort text extraction for AI context. PDF + plain text supported today;
 * DOCX/XLSX can be added later. Never throws into the request path.
 */
export async function extractText(buffer: Buffer, mime: string, fileName: string): Promise<string | null> {
  try {
    if (mime === "text/plain" || /\.txt$/i.test(fileName)) {
      return buffer.toString("utf8").slice(0, 20000);
    }
    if (mime === "application/pdf" || /\.pdf$/i.test(fileName)) {
      // Import the lib file directly to avoid pdf-parse's index debug harness
      // (which tries to read a bundled test PDF and throws).
      const mod = await import("pdf-parse/lib/pdf-parse.js");
      const pdfParse = mod.default ?? mod;
      const out = await pdfParse(buffer);
      return out.text?.replace(/\s+\n/g, "\n").slice(0, 20000) ?? null;
    }
  } catch (e) {
    console.error("text extraction failed", e);
  }
  return null;
}
