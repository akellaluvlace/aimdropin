// DevUI Admin: the demo starts signed in as the template's demo Admin user.
import { replaceOnce } from "./_lib.mjs";
replaceOnce(
  "src/app/@core/services/auth.service.ts",
  "constructor() {}",
  `constructor() {
    if (!localStorage.getItem('userinfo')) {
      const { userName, gender, phoneNumber, email } = USERS[0];
      this.setSession({ userName, gender, phoneNumber, email } as User);
    }
  }`,
);
