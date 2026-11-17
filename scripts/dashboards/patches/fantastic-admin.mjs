// Fantastic-admin basic (v5.10.1): history routing at the bundler base; the
// fake-server mocks are bundled (VITE_BUILD_MOCK in the entry's env). Starts
// signed in as the mock admin account.
import { replaceOnce } from "./_lib.mjs";
import { hashToHistory } from "./_vue.mjs";
hashToHistory("src/router/index.ts");
replaceOnce("src/store/modules/user.ts", "const account = ref(localStorage.account ?? '')", "const account = ref(localStorage.account ?? 'admin')");
replaceOnce("src/store/modules/user.ts", "const token = ref(localStorage.token ?? '')", "const token = ref(localStorage.token ?? 'admin:demo-token')");
