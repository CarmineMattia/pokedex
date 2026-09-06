import type { GraphModel, Tensor, Tensor4D } from "@tensorflow/tfjs";
import { COSMIDEX_LABELS } from "./labels";

export type Prediction = {
  label: string;
  prob: number;
};

/** Prefer local copy if present; otherwise Cosmidex via jsDelivr (≈6.3 MB). */
const LOCAL_MODEL = "/model/model.json";
const REMOTE_MODEL =
  "https://cdn.jsdelivr.net/gh/Ansh9045/Cosmidex@main/frontend/public/model/model.json";

/** Cosmidex web confidence threshold. */
export const CONFIDENCE_THRESHOLD = 0.4;

let modelPromise: Promise<GraphModel> | null = null;

async function resolveModelUrl(): Promise<string> {
  try {
    const res = await fetch(LOCAL_MODEL, { method: "HEAD" });
    if (res.ok) return LOCAL_MODEL;
  } catch {
    /* fall through to CDN */
  }
  return REMOTE_MODEL;
}

/** Lazy-loads @tensorflow/tfjs only when the camera scan path runs. */
export async function loadCosmidexModel(): Promise<GraphModel> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const tf = await import("@tensorflow/tfjs");
      await tf.ready();
      const url = await resolveModelUrl();
      return tf.loadGraphModel(url);
    })().catch((err) => {
      modelPromise = null;
      throw err;
    });
  }
  return modelPromise;
}

/** Center-crop to square, resize 224×224, RGB float [0,1], batch dim. */
export async function preprocessVideoFrame(video: HTMLVideoElement): Promise<{
  tensor: Tensor4D;
  dataUrl: string;
}> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) throw new Error("Camera frame not ready");

  const side = Math.min(w, h);
  const x = (w - side) / 2;
  const y = (h - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = 224;
  canvas.height = 224;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  ctx.drawImage(video, x, y, side, side, 0, 0, 224, 224);

  const tf = await import("@tensorflow/tfjs");
  const tensor = tf.tidy(() => {
    return tf.browser
      .fromPixels(canvas)
      .toFloat()
      .div(255)
      .expandDims(0) as Tensor4D;
  });

  return { tensor, dataUrl: canvas.toDataURL("image/jpeg") };
}

export async function recognizeFrame(
  model: GraphModel,
  video: HTMLVideoElement,
): Promise<{ top: Prediction; top5: Prediction[]; dataUrl: string }> {
  const { tensor, dataUrl } = await preprocessVideoFrame(video);
  let output: Tensor | undefined;
  try {
    try {
      output = model.execute(tensor) as Tensor;
    } catch {
      output = (await model.executeAsync(tensor)) as Tensor;
    }
    const probabilities = await output.data();
    const ranked = Array.from(probabilities)
      .map((prob, i) => ({
        label: COSMIDEX_LABELS[i] ?? `class-${i}`,
        prob: Number(prob),
      }))
      .sort((a, b) => b.prob - a.prob);

    return { top: ranked[0], top5: ranked.slice(0, 5), dataUrl };
  } finally {
    tensor.dispose();
    output?.dispose();
  }
}
