/**
 * POST /api/campaign/format
 *
 * Recorta uma imagem de campanha pra um dos formatos do Instagram (Stories/
 * Feed 4:5/Feed 1:1) usando center-crop inteligente com prioridade para o
 * topo da imagem (onde fica o rosto).
 *
 * ⚠️  ZERO alteração de cor — sem blur, sem vinheta, sem brightness/saturation.
 *     Apenas resize + crop + preservação de perfil ICC sRGB.
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

/**
 * Smart crop — redimensiona e recorta a imagem pro formato alvo SEM
 * alterar cores, brilho ou saturação.
 *
 * Estratégia:
 *   - `fit: "cover"` → preenche o canvas inteiro, cortando o excesso
 *   - `position: "north"` → prioriza o topo (rosto/busto em fotos de moda)
 *   - `.toColourspace("srgb")` → normaliza o color space (evita drift de
 *     imagens em Display P3 / Adobe RGB vindas de geradores de IA)
 *   - `.withIccProfile("srgb")` → embute o perfil ICC sRGB no PNG de saída
 *     para que browsers e apps de galeria renderizem com fidelidade
 *   - `.withMetadata()` → preserva DPI e metadados básicos
 *
 * Antes usava blur+vignette+brightness que distorcia cores. Removido.
 */
async function smartCrop(
  input: Buffer,
  targetW: number,
  targetH: number,
): Promise<Buffer> {
  return sharp(input)
    .toColourspace("srgb")
    .resize(targetW, targetH, {
      fit: "cover",
      position: "north",
    })
    .withIccProfile("srgb")
    .withMetadata()
    .png({ compressionLevel: 6 })
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
    const out = await smartCrop(inputBuffer, fmt.w, fmt.h);
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
    return NextResponse.json({ error: `smartCrop failed: ${msg}` }, { status: 500 });
  }
}
