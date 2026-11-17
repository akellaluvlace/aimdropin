// Lightence: router base. Its "round-slider" dependency is a GitHub branch that
// Yarn would have to clone and build with the package's own scripts; drop it and
// stub the one place it's used (the night-mode slider in the settings dropdown).
import { addBasename, replaceOnce, editJson } from "./_react-cra.mjs";
addBasename("src/components/router/AppRouter.tsx");
editJson("package.json", (p) => {
  if (!p.dependencies["round-slider"]) throw new Error("patch: round-slider dependency is gone");
  delete p.dependencies["round-slider"];
});
const f = "src/components/header/dropdowns/settingsDropdown/settingsOverlay/nightModeSettings/NightTimeSlider/NightTimeSlider.tsx";
replaceOnce(f, "import { createComponent } from '@lit-labs/react';\nimport { RoundSlider } from 'round-slider';\n", "");
replaceOnce(
  f,
  "const RoundSliderComponent = createComponent(React, 'round-slider', RoundSlider, {\n  onValueChanged: 'value-changed',\n  onChange: 'value-changing',\n});",
  "// eslint-disable-next-line @typescript-eslint/no-explicit-any\nconst RoundSliderComponent: React.FC<any> = () => null;",
);
// No service worker: demos run in a sandbox where its script can't be registered.
replaceOnce("src/index.tsx", "serviceWorkerRegistration.register({", "serviceWorkerRegistration.unregister();\nexport const swOptions = {");
replaceOnce("src/index.tsx", "}); // app will reload", "}; // app will reload");
