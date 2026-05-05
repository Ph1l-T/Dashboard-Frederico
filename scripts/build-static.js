const fs = require("fs");
const path = require("path");

const root = process.cwd();
const outDir = path.join(root, "dist");

const excludeDirs = new Set([
  ".git",
  ".github",
  ".vscode",
  "dist",
  "node_modules",
  "docs",
  "sql",
  "Home-Main-Port-Kit",
  "hubitat",
  "scripts",
  "functions",
]);

const excludeFiles = new Set([
  ".gitignore",
  "ACCESS_CONTROL_SETUP.md",
  "AUTH_SETUP.md",
  "CACHE-SOLUTION.md",
  "COMO-ENVIAR-COMANDOS.md",
  "GRID-SYSTEM.md",
  "HUBITAT-API-COMMANDS.md",
  "LICENSE",
  "PROJECT_VARIABLES.md",
  "README-NOVO-CLIENTE.md",
  "README.md",
  "ROADMAP_CENARIOS.md",
  "VARIAVEIS_HUBITAT.md",
  "bun.lockb",
  "package-lock.json",
  "package.json",
  "pnpm-lock.yaml",
  "server.js",
  "setup-automated.ps1",
  "wrangler.json",
  "wrangler.jsonc",
  "wrangler.toml",
  "yarn.lock",
]);

function resetDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function copyDir(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      if (excludeDirs.has(entry.name)) {
        continue;
      }
      fs.mkdirSync(destPath, { recursive: true });
      copyDir(srcPath, destPath);
      continue;
    }

    if (entry.isFile()) {
      if (excludeFiles.has(entry.name)) {
        continue;
      }
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

resetDir(outDir);
copyDir(root, outDir);
console.log(`Static build output: ${outDir}`);
