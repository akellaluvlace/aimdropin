// Nuxt UI dashboard: generate under the demo base. Its data comes from Nitro
// API routes; prerender them so client-side fetches get static JSON.
import { replaceOnce } from "./_lib.mjs";
replaceOnce(
  "nuxt.config.ts",
  "compatibilityDate: '2026-06-30',",
  `compatibilityDate: '2026-06-30',

  app: { baseURL: process.env.DEMO_BASE },

  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/', '/api/customers', '/api/mails', '/api/members', '/api/notifications']
    }
  },`,
);
