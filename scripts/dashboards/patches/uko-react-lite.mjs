// Uko: router base, public images under the demo base, and open signed in as
// the template's demo user (the fake JWT API only knows demo@example.com).
import { addBasename, replaceOnce, prefixPublicPathsIn, BASE_NOSLASH } from "./_react-cra.mjs";
addBasename("src/index.tsx");
prefixPublicPathsIn("src", ["/static/"]);
const demoUser = { id: 1, role: "SA", name: "Jason Alexander", email: "demo@example.com", avatar: `${BASE_NOSLASH}/static/avatar/001-man.svg` };
replaceOnce(
  "src/contexts/JWTAuthContext.tsx",
  "        } else {\n          dispatch({\n            type: Types.Init,\n            payload: {\n              user: null,\n              isAuthenticated: false,\n            },\n          });",
  `        } else {\n          dispatch({\n            type: Types.Init,\n            payload: {\n              user: ${JSON.stringify(demoUser)},\n              isAuthenticated: true,\n            },\n          });`,
);
