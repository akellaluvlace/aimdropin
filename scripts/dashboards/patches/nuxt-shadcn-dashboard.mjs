// Nuxt shadcn dashboard: generate under the demo base.
import { replaceOnce } from "./_lib.mjs";
replaceOnce("nuxt.config.ts", "baseURL: '/nuxt-shadcn-dashboard/'", "baseURL: process.env.DEMO_BASE");
// NuxtHub (unused by the pages) refuses to run under `nuxt generate`.
replaceOnce("nuxt.config.ts", "    '@pinia/nuxt',\n    '@nuxtjs/color-mode',\n    '@nuxt/fonts',\n    '@nuxthub/core'\n", "    '@pinia/nuxt',\n    '@nuxtjs/color-mode',\n    '@nuxt/fonts'\n");
