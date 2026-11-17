// PanJiaChen Vue CLI admin: publicPath and history routing at the demo base;
// MockJS already fakes the API in production builds. The demo starts signed
// in as the mock "admin" user instead of on the login page.
import { replaceOnce, BASE } from "./_lib.mjs";
replaceOnce("vue.config.js", "publicPath: '/',", `publicPath: ${JSON.stringify(BASE)},`);
replaceOnce("src/router/index.js", "// mode: 'history', // require service support", "mode: 'history',\n  base: process.env.BASE_URL,");
replaceOnce("src/utils/auth.js", "return Cookies.get(TokenKey)", "return Cookies.get(TokenKey) || 'admin-token'");
// TinyMCE (loaded from a CDN at runtime) can't run in the demo sandbox: its
// editor iframe is blocked. Show the content in a plain textarea instead.
import { writeFileSync } from "node:fs";
replaceOnce("src/components/Tinymce/index.vue", "const tinymceCDN = 'https://cdn.jsdelivr.net/npm/tinymce-all-in-one@4.9.3/tinymce.min.js'", "");
writeFileSync(
  "src/components/Tinymce/index.vue",
  `<template>
  <div class="tinymce-container" :style="{ width: typeof width === 'number' ? width + 'px' : width }">
    <textarea class="tinymce-textarea" :value="value" :style="{ width: '100%', height: (typeof height === 'number' ? height + 'px' : height), padding: '10px', border: '1px solid #dcdfe6', borderRadius: '4px', fontFamily: 'monospace' }" @input="$emit('input', $event.target.value)" />
  </div>
</template>

<script>
// Demo build: rich-text editor replaced by a textarea (TinyMCE can't run here).
export default {
  name: 'Tinymce',
  props: {
    id: { type: String, default: '' },
    value: { type: String, default: '' },
    toolbar: { type: Array, required: false, default() { return [] } },
    menubar: { type: String, default: '' },
    height: { type: [Number, String], required: false, default: 360 },
    width: { type: [Number, String], required: false, default: 'auto' }
  },
  methods: {
    setContent(value) { this.$emit('input', value) },
    getContent() { return this.value }
  }
}
</script>
`,
);
