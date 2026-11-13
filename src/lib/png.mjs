// Small PNG helpers for previews and the website.
import { PNG } from 'pngjs';

/** Scale a PNG up by a whole factor (pixel art stays crisp). */
export function upscale(buf, k) {
  const src = PNG.sync.read(buf);
  const out = new PNG({ width: src.width * k, height: src.height * k });
  for (let y = 0; y < out.height; y++)
    for (let x = 0; x < out.width; x++) {
      const s = (Math.floor(y / k) * src.width + Math.floor(x / k)) * 4;
      out.data.set(src.data.subarray(s, s + 4), (y * out.width + x) * 4);
    }
  return PNG.sync.write(out);
}

/** The first 16x16 frame of an animated strip (a lava lamp), or the picture itself. */
export function firstFrame(buf) {
  const src = PNG.sync.read(buf);
  if (src.height <= src.width) return buf;
  const out = new PNG({ width: src.width, height: src.width });
  src.data.copy(out.data, 0, 0, src.width * src.width * 4);
  return PNG.sync.write(out);
}
