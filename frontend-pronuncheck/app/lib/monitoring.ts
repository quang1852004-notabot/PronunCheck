import * as Sentry from "@sentry/nextjs";

/**
 * Bat dau do luong thoi gian xu ly cham diem AI
 */
export function startAiTimer(markerName = "ai-assess") {
  if (typeof performance !== "undefined" && performance.mark) {
    performance.mark(`${markerName}-start`);
  }
  return Date.now();
}

/**
 * Ket thuc do luong va ghi nhan chi so hieu nang
 */
export function endAiTimer(word: string, startTime: number, markerName = "ai-assess") {
  const durationMs = Date.now() - startTime;

  if (typeof performance !== "undefined" && performance.mark && performance.measure) {
    try {
      performance.mark(`${markerName}-end`);
      performance.measure(
        `AI Scoring: ${word}`,
        `${markerName}-start`,
        `${markerName}-end`
      );
    } catch {
      // Ignored if marks were cleared
    }
  }

  // Ghi nhan breadcrumb vao Sentry
  Sentry.addBreadcrumb({
    category: "ai_latency",
    message: `AI Assessment completed for '${word}' in ${durationMs}ms`,
    level: "info",
    data: { word, durationMs },
  });

  return durationMs;
}

/**
 * Bao cao loi truc tiep ve Sentry kem context chi tiet
 */
export function captureAppError(error: unknown, context?: Record<string, any>) {
  console.error("[PronunCheck Monitor] Error captured:", error, context);
  Sentry.withScope((scope) => {
    if (context) {
      scope.setExtras(context);
    }
    Sentry.captureException(error);
  });
}
