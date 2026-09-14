/**
 * Monet / Material Design 3 dynamic color extraction from a wallpaper image.
 * Pure Node: jimp decodes the image, @material/material-color-utilities does
 * quantization (Celebi), scoring and scheme generation.
 */

import { Jimp } from "jimp";
import {
  QuantizerCelebi,
  Score,
  argbFromRgb,
  themeFromSourceColor,
  type Theme,
} from "@material/material-color-utilities";

export interface WallpaperAssets {
  /** Processed wallpaper as a data URI (resized + JPEG-compressed). */
  dataUri: string;
  /** MD3 source color extracted from the image (ARGB int). */
  sourceArgb: number;
  /** Light and dark MD3 themes generated from the source color. */
  theme: Theme;
}

const MAX_WIDTH = 2560;
const JPEG_QUALITY = 82;

export async function loadWallpaper(imagePath: string, maxDimension = MAX_WIDTH): Promise<WallpaperAssets> {
  const image = await Jimp.read(imagePath);

  // Downscale so the embedded data URI and the quantizer stay fast.
  const { width, height } = image.bitmap;
  if (Math.max(width, height) > maxDimension) {
    const scale = maxDimension / Math.max(width, height);
    image.resize({ w: Math.round(width * scale), h: Math.round(height * scale) });
  }

  const sourceArgb = extractSourceColor(image.bitmap);
  const theme = themeFromSourceColor(sourceArgb);

  const jpeg = await image.getBuffer("image/jpeg", { quality: JPEG_QUALITY });
  const dataUri = `data:image/jpeg;base64,${jpeg.toString("base64")}`;

  return { dataUri, sourceArgb, theme };
}

/** Celebi quantization + MD3 scoring, on a decimated pixel sample. */
function extractSourceColor(bitmap: { width: number; height: number; data: Uint8Array | Buffer }): number {
  const { width, height, data } = bitmap;
  const pixels: number[] = [];
  const stride = Math.max(1, Math.floor(Math.sqrt((width * height) / 24000)));
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) * 4;
      const alpha = data[i + 3];
      if (alpha < 255) continue;
      pixels.push(argbFromRgb(data[i], data[i + 1], data[i + 2]));
    }
  }
  if (pixels.length === 0) pixels.push(argbFromRgb(255, 255, 255));
  const quantized = QuantizerCelebi.quantize(pixels, 64);
  const ranked = Score.score(quantized);
  return ranked[0] ?? argbFromRgb(103, 80, 164);
}

export function argbToCss(argb: number, alpha = 1): string {
  const r = (argb & 0xff0000) >> 16;
  const g = (argb & 0x00ff00) >> 8;
  const b = argb & 0x0000ff;
  return alpha >= 1
    ? `#${toHex(r)}${toHex(g)}${toHex(b)}`
    : `rgba(${r}, ${g}, ${b}, ${round2(alpha)})`;
}

function toHex(v: number): string {
  return v.toString(16).padStart(2, "0");
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
