import { readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(new URL("../../src/", import.meta.url));

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return filesBelow(path);
    return extname(entry.name) === ".tsx" ? [path] : [];
  }));
  return nested.flat();
}

function replaceNestedButton(source, parentTag) {
  const pattern = new RegExp(
    `<${parentTag}(\\s[^>]*)?>\\s*<Button(\\s[^>]*)?>([\\s\\S]*?)<\\/Button>\\s*<\\/${parentTag}>`,
    "g",
  );
  return source.replace(pattern, (match, parentAttributes = "", buttonAttributes = "", content) => {
    if (/\basChild\b/.test(buttonAttributes)) return match;
    replacements += 1;
    return `<Button${buttonAttributes} asChild><${parentTag}${parentAttributes}>${content}</${parentTag}></Button>`;
  });
}

let changedFiles = 0;
let replacements = 0;
for (const path of await filesBelow(sourceRoot)) {
  const before = await readFile(path, "utf8");
  let after = replaceNestedButton(before, "Link");
  after = replaceNestedButton(after, "a");
  if (after === before) continue;
  await writeFile(path, after, "utf8");
  changedFiles += 1;
}

console.log(`Nested link buttons converted: ${replacements} in ${changedFiles} files.`);
