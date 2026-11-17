// Art Design Pro: history routing at the base (VITE_BASE_URL in the entry's
// env). Login and menus come from the project's public Apifox mock; the demo
// starts signed in (with a token the mock issued for its demo
// "Super" account) and in English.
import { replaceOnce } from "./_lib.mjs";
import { hashToHistory } from "./_vue.mjs";
hashToHistory("src/router/index.ts");
replaceOnce("src/store/modules/user.ts", "const isLogin = ref(false)", "const isLogin = ref(true)");
replaceOnce("src/store/modules/user.ts", "const accessToken = ref('')", "const accessToken = ref('eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiU3VwZXIiLCJhZG1pbiI6dHJ1ZSwicm9sZSI6InN1cGVyIn0.MTvD_3e8Y_03f6_--A_JL-_toP-_-Q2GKy_-8yR___-_k_8_32_3hKx72Wd61T-_-_D_-_0___CC7U--c_i___')");
replaceOnce("src/store/modules/user.ts", "const language = ref(LanguageEnum.ZH)", "const language = ref(LanguageEnum.EN)");
