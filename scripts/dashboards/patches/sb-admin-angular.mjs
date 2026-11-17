// SB Admin Angular: the version file is fetched relative to the <base href>.
import { replaceOnce } from "./_lib.mjs";
replaceOnce("src/modules/utility/services/utility.service.ts", "this.http.get('/assets/version'", "this.http.get('assets/version'");
