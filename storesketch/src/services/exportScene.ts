import type { SketchLayer, SketchObject, ViewState } from '../types';
import { drawGrid, drawObjects } from '../engine/render';
import { drawObjectDimensions } from '../engine/overlays';
import { preloadSketchImages } from '../engine/imageCache';

export type ExportSceneInput = {
  width: number;
  height: number;
  view: ViewState;
  objects: SketchObject[];
  layers: SketchLayer[];
  dimensionObjectIds: number[];
  gridVisible: boolean;
  metersPerSquare: number;
};

function orderedVisibleObjects(input: ExportSceneInput): SketchObject[] {
  return input.layers.flatMap((layer) => (
    layer.visible
      ? input.objects.filter((object) => object.layerId === layer.id && object.visible !== false)
      : []
  ));
}

export async function renderSceneCanvas(input: ExportSceneInput, pixelRatio = 1): Promise<HTMLCanvasElement> {
  const ratio = Math.max(1, Math.min(3, pixelRatio));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(input.width * ratio));
  canvas.height = Math.max(1, Math.round(input.height * ratio));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  const exportView: ViewState = {
    s: input.view.s * ratio,
    tx: input.view.tx * ratio,
    ty: input.view.ty * ratio,
  };
  const objects = orderedVisibleObjects(input);
  const imageSources = objects
    .filter((object): object is Extract<SketchObject, { type: 'image' }> => object.type === 'image' && Boolean(object.src))
    .map((object) => object.src!);
  await preloadSketchImages(imageSources);

  if (input.gridVisible) drawGrid(ctx, exportView, canvas.width, canvas.height, input.metersPerSquare);
  else {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  drawObjects(
    ctx,
    objects,
    exportView,
    canvas.width,
    canvas.height,
    null,
    [],
    input.metersPerSquare,
    [],
    false,
  );

  for (const objectId of input.dimensionObjectIds) {
    const object = objects.find((item) => item.id === objectId);
    if (object) drawObjectDimensions(ctx, object, exportView, input.metersPerSquare);
  }
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Export failed')), type, quality);
  });
}

export function downloadBlob(blob: Blob, fileName: string) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.download = fileName;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportScenePng(input: ExportSceneInput, fileName: string) {
  const canvas = await renderSceneCanvas(input, 1);
  downloadBlob(await canvasToBlob(canvas, 'image/png'), `${fileName}.png`);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function ascii(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function dataUrlBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function buildJpegPdf(jpeg: Uint8Array, imageWidth: number, imageHeight: number): Uint8Array {
  const pageWidth = 841.89; // A4 landscape in points
  const pageHeight = 595.28;
  const margin = 24;
  const fit = Math.min((pageWidth - margin * 2) / imageWidth, (pageHeight - margin * 2) / imageHeight);
  const drawWidth = imageWidth * fit;
  const drawHeight = imageHeight * fit;
  const x = (pageWidth - drawWidth) / 2;
  const y = (pageHeight - drawHeight) / 2;
  const content = `q\n${drawWidth.toFixed(3)} 0 0 ${drawHeight.toFixed(3)} ${x.toFixed(3)} ${y.toFixed(3)} cm\n/Im0 Do\nQ\n`;

  const bodies: Uint8Array[] = [
    ascii('<< /Type /Catalog /Pages 2 0 R >>'),
    ascii('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`),
    concatBytes([ascii(`<< /Length ${ascii(content).length} >>\nstream\n`), ascii(content), ascii('endstream')]),
    concatBytes([
      ascii(`<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),
      jpeg,
      ascii('\nendstream'),
    ]),
  ];

  const header = ascii('%PDF-1.4\n%StoreSketch\n');
  const chunks: Uint8Array[] = [header];
  const offsets = [0];
  let current = header.length;
  bodies.forEach((body, index) => {
    const prefix = ascii(`${index + 1} 0 obj\n`);
    const suffix = ascii('\nendobj\n');
    offsets.push(current);
    chunks.push(prefix, body, suffix);
    current += prefix.length + body.length + suffix.length;
  });
  const xrefOffset = current;
  let xref = `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= bodies.length; i += 1) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  xref += `trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  chunks.push(ascii(xref));
  return concatBytes(chunks);
}

export async function exportScenePdf(input: ExportSceneInput, fileName: string) {
  const canvas = await renderSceneCanvas(input, 1);
  const jpegUrl = canvas.toDataURL('image/jpeg', 0.92);
  const jpeg = dataUrlBytes(jpegUrl);
  const pdf = buildJpegPdf(jpeg, canvas.width, canvas.height);
  downloadBlob(new Blob([pdf as unknown as BlobPart], { type: 'application/pdf' }), `${fileName}.pdf`);
}
