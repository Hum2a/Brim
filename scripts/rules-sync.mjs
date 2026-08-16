#!/usr/bin/env node
/**
 * Generate agent rule files from AGENTS.md.
 * Usage: node scripts/rules-sync.mjs [--check]
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const agentsPath = join(root, "AGENTS.md");
const checkMode = process.argv.includes("--check");

const SECTION_MAP = [
  {
    heading: "Hard rules",
    extraHeadings: [
      "Engine purity",
      "Workers factories",
      "Registration-mark privacy",
      "Public repository",
      "Scripts",
      "Stack",
    ],
    file: "00_core.mdc",
    frontmatter: {
      description: "Brim core agent rules — purity, factories, privacy, public repo",
    },
  },
  {
    heading: "Engine (packages/engine)",
    extraHeadings: [],
    file: "10_engine.mdc",
    frontmatter: {
      description: "packages/engine purity and estimate rules",
      globs: "packages/engine/**",
    },
  },
  {
    heading: "API (apps/api, workers/sync)",
    extraHeadings: [],
    file: "20_api.mdc",
    frontmatter: {
      description: "Workers API factories, keys, logging, fixtures",
      globs: "apps/api/**,workers/sync/**",
    },
  },
  {
    heading: "Web (apps/web, packages/ui-kit, apps/extension)",
    extraHeadings: [],
    file: "30_web.mdc",
    frontmatter: {
      description: "Web, ui-kit, and extension UI rules",
      globs: "apps/web/**,packages/ui-kit/**,apps/extension/**",
    },
  },
  {
    heading: "Data (data, scripts)",
    extraHeadings: [],
    file: "40_data.mdc",
    frontmatter: {
      description: "Data, zones, and with-env command rules",
      globs: "data/**,scripts/**",
    },
  },
];

function parseSections(markdown) {
  const lines = markdown.split(/\r?\n/);
  const sections = new Map();
  let current = null;
  let buf = [];
  for (const line of lines) {
    const match = /^## (.+)$/.exec(line);
    if (match) {
      if (current) sections.set(current, buf.join("\n").trim());
      current = match[1];
      buf = [line];
    } else if (current) {
      buf.push(line);
    }
  }
  if (current) sections.set(current, buf.join("\n").trim());
  return sections;
}

function yamlFrontmatter(meta) {
  const lines = ["---"];
  for (const [k, v] of Object.entries(meta)) {
    lines.push(`${k}: ${v}`);
  }
  lines.push("---", "");
  return lines.join("\n");
}

function buildTargets(markdown) {
  const sections = parseSections(markdown);
  const cursorRules = {};
  for (const spec of SECTION_MAP) {
    const parts = [spec.heading, ...spec.extraHeadings].map((h) => {
      const body = sections.get(h);
      if (!body) {
        throw new Error(`AGENTS.md missing section "## ${h}"`);
      }
      return body;
    });
    cursorRules[spec.file] = `${yamlFrontmatter(spec.frontmatter)}${parts.join("\n\n")}\n`;
  }

  const header =
    "# Generated from AGENTS.md — do not edit. Run `npm run rules:sync`.\n\n";
  return {
    ".cursor/rules/00_core.mdc": cursorRules["00_core.mdc"],
    ".cursor/rules/10_engine.mdc": cursorRules["10_engine.mdc"],
    ".cursor/rules/20_api.mdc": cursorRules["20_api.mdc"],
    ".cursor/rules/30_web.mdc": cursorRules["30_web.mdc"],
    ".cursor/rules/40_data.mdc": cursorRules["40_data.mdc"],
    "CLAUDE.md": `${header}${markdown}`,
    ".windsurfrules": `${header}${markdown}`,
    ".github/copilot-instructions.md": `${header}${markdown}`,
    ".aider.conf.yml": `# Generated from AGENTS.md — do not edit. Run \`npm run rules:sync\`.\nread: AGENTS.md\n`,
  };
}

function writeTree(base, files) {
  for (const [rel, contents] of Object.entries(files)) {
    const dest = join(base, rel);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, contents, "utf8");
  }
}

function normalize(s) {
  return s.replace(/\r\n/g, "\n");
}

const markdown = readFileSync(agentsPath, "utf8");
const files = buildTargets(markdown);

if (checkMode) {
  const tmp = mkdtempSync(join(tmpdir(), "brim-rules-"));
  try {
    writeTree(tmp, files);
    const drifts = [];
    for (const rel of Object.keys(files)) {
      const expected = normalize(files[rel]);
      let actual = "";
      try {
        actual = normalize(readFileSync(join(root, rel), "utf8"));
      } catch {
        drifts.push(`${rel} (missing)`);
        continue;
      }
      if (actual !== expected) drifts.push(rel);
    }
    if (drifts.length > 0) {
      console.error("rules:check failed — AGENTS.md is out of sync with:");
      for (const d of drifts) console.error(`  - ${d}`);
      console.error("Run `npm run rules:sync` and commit the result.");
      process.exit(1);
    }
    console.log("rules:check ok");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
} else {
  writeTree(root, files);
  console.log(`rules:sync wrote ${Object.keys(files).length} files`);
}
