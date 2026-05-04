/**
 * POST /api/campaign/format
 *
 * Converte a foto principal (Stories 9:16) para Feed 4:5 ou Feed 1:1.
 * Mantém o corpo inteiro visível (fit: inside) e preenche as laterais
 * com blur da própria imagem.
 *
 * ⚠️  ZERO alteração de cor na foto principal — o blur é aplicado SOMENTE
 *     no fundo. A foto é composited por cima como camada 100% opaca.
 *
 * Stories NÃO precisa deste endpoint — o front baixa a imagem original
 * direto, sem processamento (é a saída padrão do gerador de IA).
 *
 * Body (JSON):
 *   { imageUrl: string, format: 'feed45' | 'feed11' }
 *   ou
 *   { imageBase64: string, format: ... }
 *
 * Resposta:
 *   JPEG binário (`image/jpeg`, quality 92, ~300KB) — pronto pra download.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import sharp from "sharp";
import { isAllowedImageUrl } from "@/lib/security/image-host-allowlist";
import { verifyImageMime } from "@/lib/security/verify-image-mime";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const FORMATS: Record<string, { w: number; h: number }> = {
  stories: { w: 1080, h: 1920 },
  feed45: { w: 1080, h: 1350 },
  feed11: { w: 1080, h: 1080 },
};

/**
 * Adapta a foto Stories (9:16) pra Feed 4:5 ou 1:1.
 *
 * 1. Fundo borrado: resize cover + blur(40). SEM brightness, SEM saturação.
 * 2. Foto principal: resize inside (corpo inteiro) centralizada por cima.
 *    Composited como camada 100% opaca → cores 100% preservadas.
 *
 * Para Stories (9:16): apenas resize simples — sem blur, sem crop.
 */
async function formatImage(
  input: Buffer,
  targetW: number,
  targetH: number,
): Promise<Buffer> {
  const meta = await sharp(input).metadata();
  const srcW = meta.width || targetW;
  const srcH = meta.height || targetH;

  const targetRatio = targetW / targetH;
  const srcRatio = srcW / srcH;

  // Se o ratio já bate (~2% tolerância), só redimensiona — sem blur
  if (Math.abs(srcRatio - targetRatio) < 0.02) {
    return sharp(input)
      .toColourspace("srgb")
      .resize(targetW, targetH, { fit: "cover", position: "north" })
      .withIccProfile("srgb")
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();
  }

  // Fundo: blur da própria imagem, SEM brightness/saturação/vinheta
  const bg = await sharp(input)
    .toColourspace("srgb")
    .resize(targetW, targetH, { fit: "cover" })
    .blur(40)
    .jpeg({ quality: 50 }) // qualidade baixa pro fundo (é borrado mesmo)
    .toBuffer();

  // Foto principal: corpo inteiro (inside = contain), centralizada
  const fg = await sharp(input)
    .toColourspace("srgb")
    .resize(targetW, targetH, { fit: "inside" })
    .withIccProfile("srgb")
    .png()
    .toBuffer();

  const fgMeta = await sharp(fg).metadata();
  const fgW = fgMeta.width || targetW;
  const fgH = fgMeta.height || targetH;
  const offsetX = Math.max(0, Math.round((targetW - fgW) / 2));
  const offsetY = Math.max(0, Math.round((targetH - fgH) / 2));

  // Compõe: fundo borrado → foto principal centralizada (100% opaca)
  return sharp(bg)
    .composite([
      { input: fg, top: offsetY, left: offsetX, blend: "over" },
    ])
    .withIccProfile("srgb")
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { imageUrl?: string; imageBase64?: string; format?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const formatId = body.format ?? "feed45";
  const fmt = FORMATS[formatId];
  if (!fmt) {
    return NextResponse.json({ error: `Unknown format: ${formatId}` }, { status: 400 });
  }

  // Carrega a imagem fonte
  let inputBuffer: Buffer;
  let sourceMime: string | null = null;
  if (body.imageUrl) {
    // D-15: SSRF allowlist (replaces the old /^https?:\/\// weak check).
    const allow = isAllowedImageUrl(body.imageUrl);
    if (!allow.allowed) {
      return NextResponse.json(
        { error: "imageUrl host not allowed", reason: allow.reason },
        { status: 400 },
      );
    }
    try {
      const res = await fetch(body.imageUrl);
      if (!res.ok) throw new Error(`fetch failed ${res.status}`);
      inputBuffer = Buffer.from(await res.arrayBuffer());
      sourceMime = res.headers.get("content-type") || "";
    } catch (e) {
      return NextResponse.json({ error: "Failed to fetch imageUrl" }, { status: 400 });
    }
  } else if (body.imageBase64) {
    try {
      const dataUriMatch = body.imageBase64.match(/^data:(image\/\w+);base64,/);
      if (dataUriMatch) sourceMime = dataUriMatch[1];
      const stripped = body.imageBase64.replace(/^data:image\/\w+;base64,/, "");
      inputBuffer = Buffer.from(stripped, "base64");
    } catch {
      return NextResponse.json({ error: "Invalid imageBase64" }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: "Provide imageUrl or imageBase64" }, { status: 400 });
  }

  // D-16: magic-byte MIME verification BEFORE any processing.
  // Default to image/jpeg if no claim available — sharp.metadata() will
  // reject any non-image buffer regardless.
  const claimedMime = sourceMime || "image/jpeg";
  const mimeCheck = await verifyImageMime(inputBuffer, claimedMime);
  if (!mimeCheck.ok) {
    return NextResponse.json(
      { error: "image MIME mismatch", reason: mimeCheck.reason },
      { status: 400 },
    );
  }

  try {
    const out = await formatImage(inputBuffer, fmt.w, fmt.h);
    const arrayBuffer = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: `formatImage failed: ${msg}` }, { status: 500 });
  }
}
