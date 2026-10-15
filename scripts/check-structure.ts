import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
const root = process.cwd();
async function files(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory()
          ? files(path.join(dir, e.name))
          : [path.join(dir, e.name)],
      ),
    )
  ).flat();
}
const failures: string[] = [];
for (const file of ["README.md", ...(await files("docs"))].filter((f) =>
  f.endsWith(".md"),
)) {
  const content = await readFile(file, "utf8");
  for (const match of content.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1].split("#")[0];
    if (!target || /^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(target)) continue;
    try {
      await stat(path.resolve(path.dirname(file), decodeURIComponent(target)));
    } catch {
      failures.push(`${file}: broken link ${target}`);
    }
  }
}
for (const file of [...(await files("src")), ...(await files("server"))].filter(
  (f) => /\.tsx?$/.test(f),
)) {
  const content = await readFile(file, "utf8");
  for (const match of content.matchAll(
    /(?:from\s*|import\s*\()\s*["'](\.[^"']+)["']/g,
  )) {
    const target = path.resolve(path.dirname(file), match[1]);
    if (
      file.startsWith("src/") &&
      target.startsWith(path.join(root, "server") + path.sep)
    )
      failures.push(`${file}: browser code imports server code`);
    if (
      /^server\/(?:auth|db|integrations)\//.test(file) &&
      target === path.join(root, "server/cloud")
    )
      failures.push(`${file}: foundational code depends on route composition`);
  }
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    "Documentation links and browser/server dependency boundaries passed.",
  );
