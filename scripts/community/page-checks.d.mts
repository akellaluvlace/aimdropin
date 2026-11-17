export interface PageFinding {
  level: "block" | "warn";
  rule: string;
  detail: string;
}

export function checkPageSource(
  source: string,
  stack: "html" | "jsx",
): {
  verdict: "pass" | "review" | "reject";
  findings: PageFinding[];
  bytes: number;
};
