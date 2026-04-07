/**
 * P0-4: Consolidated stage export utility.
 * Replaces 3 duplicated scale→export→restore blocks across compositors.
 */

import Konva from "konva";

interface ExportOptions {
  pixelRatio?: number;
  mimeType?: string;
  quality?: number;
  width: number;
  height: number;
}

/**
 * Temporarily resets stage to original scale, performs an export operation,
 * then restores the preview scale. Prevents code duplication.
 */
export function withOriginalScale<T>(
  stage: Konva.Stage,
  opts: ExportOptions,
  fn: (stage: Konva.Stage) => T
): T {
  const savedScaleX = stage.scaleX();
  const savedScaleY = stage.scaleY();
  const savedWidth = stage.width();
  const savedHeight = stage.height();

  stage.scale({ x: 1, y: 1 });
  stage.width(opts.width);
  stage.height(opts.height);
  stage.batchDraw();

  try {
    return fn(stage);
  } finally {
    stage.scale({ x: savedScaleX, y: savedScaleY });
    stage.width(savedWidth);
    stage.height(savedHeight);
    stage.batchDraw();
  }
}

/**
 * Exports a stage as a data URL at full resolution.
 */
export function exportStageAsDataURL(
  stage: Konva.Stage,
  opts: ExportOptions
): string {
  return withOriginalScale(stage, opts, (s) =>
    s.toDataURL({
      pixelRatio: opts.pixelRatio ?? 2,
      mimeType: opts.mimeType ?? "image/png",
      quality: opts.quality,
      x: 0,
      y: 0,
      width: opts.width,
      height: opts.height,
    })
  );
}

/**
 * Exports a stage as a Blob for API upload.
 */
export async function exportStageAsBlob(
  stage: Konva.Stage,
  opts: ExportOptions
): Promise<Blob> {
  const dataUrl = exportStageAsDataURL(stage, opts);
  const res = await fetch(dataUrl);
  return res.blob();
}
