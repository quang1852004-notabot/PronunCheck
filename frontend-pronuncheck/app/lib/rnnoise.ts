import { loadRnnoise, RnnoiseWorkletNode } from '@sapphi-red/web-noise-suppressor';

let wasmBinaryCache: ArrayBuffer | null = null;
const loadedContexts = new WeakSet<AudioContext>();

/**
 * Khởi tạo và kết nối bộ lọc khử ồn RNNoise AI (WASM AudioWorklet).
 * Trả về instance RnnoiseWorkletNode hoặc null nếu trình duyệt không hỗ trợ / xảy ra lỗi.
 */
export async function createRnnoiseNode(audioCtx: AudioContext): Promise<RnnoiseWorkletNode | null> {
  try {
    if (typeof window === 'undefined' || !audioCtx.audioWorklet) {
      return null;
    }

    // 1. Tải và cache WASM binary (SIMD hoặc scalar)
    if (!wasmBinaryCache) {
      wasmBinaryCache = await loadRnnoise({
        url: '/worklets/rnnoise.wasm',
        simdUrl: '/worklets/rnnoise_simd.wasm',
      });
    }

    // 2. Nạp Worklet module vào AudioContext hiện tại (nếu chưa nạp)
    if (!loadedContexts.has(audioCtx)) {
      await audioCtx.audioWorklet.addModule('/worklets/rnnoise/workletProcessor.js');
      loadedContexts.add(audioCtx);
    }

    // 3. Tạo RNNoise AudioWorklet Node (mono channel)
    const rnnoiseNode = new RnnoiseWorkletNode(audioCtx, {
      maxChannels: 1,
      wasmBinary: wasmBinaryCache,
    });

    return rnnoiseNode;
  } catch (err) {
    console.warn('RNNoise AI Worklet init fallback to Native DSP:', err);
    return null;
  }
}
