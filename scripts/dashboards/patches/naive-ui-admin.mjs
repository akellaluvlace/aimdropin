// Naive UI Admin: router at the base (VITE_PUBLIC_PATH in the entry's env);
// the alova mocks already run in production. Starts signed in.
import { replaceOnce } from "./_lib.mjs";
import { historyAtBase } from "./_vue.mjs";
historyAtBase("src/router/index.ts", "createWebHistory()");
replaceOnce("src/router/guards.ts", "const token = storage.get(ACCESS_TOKEN);", "const token = storage.get(ACCESS_TOKEN) || 'demo-token';");
// element-resize-detector's default "object" strategy reads an <object>'s
// contentDocument, which the demo sandbox blocks; the scroll strategy works.
replaceOnce("src/layout/components/TagsView/index.vue", "const observer = elementResizeDetectorMaker();", "const observer = elementResizeDetectorMaker({ strategy: 'scroll' });");
