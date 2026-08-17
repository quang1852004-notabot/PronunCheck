import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "",

  // Thiet lap muc do theo doi hieu nang (20% cac phien de toi uu quota)
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

  // Bat Session Replay 100% khi co loi, va 10% cho cac phien binh thuong
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  // Bo qua cac loi khong nghiem trong tu extensions cua browser
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "Non-Error promise rejection captured",
  ],
});
