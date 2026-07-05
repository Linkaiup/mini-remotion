export const extractCode = (text: string): string => {
  const m = text.match(/```(?:tsx|ts|jsx|js)?\s*\n([\s\S]*?)```/);
  return (m ? m[1] : text).trim();
};

export const staticCheck = (code: string): string[] => {
  const issues: string[] = [];
  if (!/export\s+const\s+meta\s*=/.test(code)) {
    issues.push("缺少 export const meta");
  }
  if (!/export\s+const\s+VideoComposition\s*:/.test(code)) {
    issues.push("缺少 export const VideoComposition");
  }
  const importRe = /import[^;]*?from\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(code))) {
    if (m[1] !== "react" && m[1] !== "../core") {
      issues.push(`禁止 import "${m[1]}"`);
    }
  }
  const forbidden: [RegExp, string][] = [
    [/Math\.random\s*\(/, "禁止 Math.random()"],
    [/Date\.now\s*\(/, "禁止 Date.now()"],
    [/new\s+Date\s*\(/, "禁止 new Date()"],
    [/\bfetch\s*\(/, "禁止 fetch()"],
    [/setTimeout\s*\(/, "禁止 setTimeout()"],
    [/requestAnimationFrame\s*\(/, "禁止 requestAnimationFrame()"],
  ];
  for (const [re, msg] of forbidden) {
    if (re.test(code)) issues.push(msg);
  }
  return issues;
};
