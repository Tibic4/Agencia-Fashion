/**
 * POST /api/campaign/format
 *
 * Recorta uma imagem de campanha pra um dos formatos do Instagram (Stories/
 * Feed 4:5/Feed 1:1) usando "smart fit" — preenche as áreas sobrando com
 * versão borrada da própria imagem + vinheta. Espelha visualmente o que o
 * site fazia em HTML Canvas, agora server-side via `sharp` para que web e
 * mobile compartilhem a MESMA implementação.
 *
 * Por que server-side:
 *   - paridade de pixel entre web e mobile (1 source of truth)
 *   - mobile não precisa de canvas/skia/etc no bundle
 *   - sharp é ~30-80ms por imagem 1080×1920 numa VPS de 2 vCPU
 *
 * Body (JSON):
 *   { imageUrl: string, format: 'stories' | 'feed45' | 'feed11' }
 *   ou
 *   { imageBase64: string, format: ... }
 *
 * Resposta:
 *   PNG binário (`image/png`) — pronto pra Sharing/save/download direto.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import sharp from "sharp";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const FORMATS: Record<string, { w: number; h: number }> = {
  stories: { w: 1080, h: 1920 },
  feed45: { w: 1080, h: 1350 },
  feed11: { w: 1080, h: 1080 },
};

const RATIO_TOLERANCE = 0.02;

/**
 * Vinheta sutil — overlay radial preto 0% (centro) → 35% (borda).
 * Reaproveita o mesmo gradient do site (`createRadialGradient` na linha 159
 * de gerar/demo/page.tsx). Implementado como SVG pra usar com `sharp.composite`.
 */
function vignetteSvg(width: number, height: number): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
       <defs>
         <radialGradient id="v" cx="50%" cy="50%" r="60%">
           <stop offset="40%" stop-color="black" stop-opacity="0"/>
           <stop offset="100%" stop-color="black" stop-opacity="0.35"/>
         </radialGradient>
       </defs>
       <rect width="${width}" height="${height}" fill="url(#v)"/>
     </svg>`,
  );
}

async function smartFit(input: Buffer, targetW: number, targetH: number): Promise<Buffer> {
  const meta = await sharp(input).metadata();
  const srcW = meta.width || targetW;
  const srcH = meta.height || targetH;

  const targetRatio = targetW / targetH;
  const srcRatio = srcW / srcH;

  // Aspect bate (até 2% de tolerância) — só redimensiona, sem blur.
  if (Math.abs(srcRatio - targetRatio) < RATIO_TOLERANCE) {
    return sharp(input).resize(targetW, targetH, { fit: "cover" }).png({ quality: 95 }).toBuffer();
  }

  // 1. Fundo borrado — escala pra cobrir o canvas, blur 40, escurece (0.7), satura (1.3)
  const bg = await sharp(input)
    .resize(targetW, targetH, { fit: "cover" })
    .blur(40)
    .modulate({ brightness: 0.7, saturation: 1.3 })
    .png()
    .toBuffer();

  // 2. Foto principal — fit inside (contain), preserva a foto inteira
  const fg = await sharp(input).resize(targetW, targetH, { fit: "inside" }).png().toBuffer();
  const fgMeta = await sharp(fg).metadata();
  const fgW = fgMeta.width || targetW;
  const fgH = fgMeta.height || targetH;
  const offsetX = Math.max(0, Math.round((targetW - fgW) / 2));
  const offsetY = Math.max(0, Math.round((targetH - fgH) / 2));

  // 3. Compõe: fundo borrado → vinheta → foto principal centralizada
  return sharp(bg)
    .composite([
      { input: vignetteSvg(targetW, targetH), top: 0, left: 0, blend: "over" },
      { input: fg, top: offsetY, left: offsetX, blend: "over" },
    ])
    .png({ quality: 95 })
    .toBuffer();
}

export async function POST(req: NextRequest) {
  // Auth: este endpoint roda uma operação razoavelmente cara — só logados.
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

  // Carrega a imagem fonte — URL HTTPS ou base64.
  let inputBuffer: Buffer;
  if (body.imageUrl) {
    if (!/^https?:\/\//.test(body.imageUrl)) {
      return NextResponse.json({ error: "imageUrl must be http(s)" }, { status: 400 });
    }
    try {
      const res = await fetch(body.imageUrl);
      if (!res.ok) throw new Error(`fetch failed ${res.status}`);
      inputBuffer = Buffer.from(await res.arrayBuffer());
    } catch (e) {
      return NextResponse.json({ error: "Failed to fetch imageUrl" }, { status: 400 });
    }
  } else if (body.imageBase64) {
    try {
      const stripped = body.imageBase64.replace(/^data:image\/\w+;base64,/, "");
      inputBuffer = Buffer.from(stripped, "base64");
    } catch {
      return NextResponse.json({ error: "Invalid imageBase64" }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: "Provide imageUrl or imageBase64" }, { status: 400 });
  }

  try {
    const out = await smartFit(inputBuffer, fmt.w, fmt.h);
    const arrayBuffer = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: `smartFit failed: ${msg}` }, { status: 500 });
  }
}
