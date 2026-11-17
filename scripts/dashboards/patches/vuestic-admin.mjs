// Vuestic Admin: the Users and Projects pages fetch a REST API that the demo
// doesn't have; read the repo's sample databases instead (read-only).
import { replaceOnce } from "./_lib.mjs";
replaceOnce("src/data/pages/users.ts", "let filteredUsers: User[] = await fetch(api.allUsers()).then((r) => r.json())", "let filteredUsers: User[] = structuredClone((await import('./users-db.json')).default as any)");
replaceOnce("src/data/pages/projects.ts", "const projects: Project[] = await fetch(api.allProjects()).then((r) => r.json())", "const projects: Project[] = structuredClone((await import('./projects-db.json')).default as any)");
// One sample user's avatar is an emoji, which the projects table loads as an
// image URL (a 404): show initials for that user instead.
replaceOnce("src/data/pages/users-db.json", '"avatar": "😍",', '"avatar": "",');
