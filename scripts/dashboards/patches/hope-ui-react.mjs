// Hope UI: the router already takes PUBLIC_URL as basename. Open on the
// dashboard; the design-system page moves from / to /design-system and the
// sidebar links that pointed at / follow it.
import { replaceOnce } from "./_react-cra.mjs";
replaceOnce("src/index.js", 'import { createBrowserRouter, RouterProvider } from "react-router-dom";', 'import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";');
replaceOnce(
  "src/index.js",
  'path: "/",\n    element: <Index />,\n  },',
  'path: "/",\n    element: <Navigate to="/dashboard" replace />,\n  },\n  {\n    path: "/design-system",\n    element: <Index />,\n  },',
);
const nav = "src/components/partials/dashboard/SidebarStyle/vertical-nav.js";
replaceOnce(nav, 'target="blank" to="/">', 'target="blank" to="/design-system">');
replaceOnce(nav, '<Link className="nav-link" to="/">', '<Link className="nav-link" to="/design-system">');
