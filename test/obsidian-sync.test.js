const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { sync } = require('../bin/obsidian-sync');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'paul-obsidian-'));

try {
  const project = path.join(temporaryRoot, 'example-project');
  const vault = path.join(temporaryRoot, 'vault');
  fs.mkdirSync(path.join(project, '.paul', 'phases', '01-start'), { recursive: true });
  fs.mkdirSync(path.join(vault, '.obsidian'), { recursive: true });
  fs.writeFileSync(path.join(project, '.paul', 'PROJECT.md'), '# Project\n');
  fs.writeFileSync(path.join(project, '.paul', 'STATE.md'), '# State\n');
  fs.writeFileSync(path.join(project, '.paul', 'phases', '01-start', '01-PLAN.md'), '# Plan\n');

  const preview = sync(project, vault, true);
  assert.strictEqual(preview.count, 4);
  assert.ok(!fs.existsSync(preview.destination));

  const result = sync(project, vault);
  const overview = path.join(result.destination, 'Overview.md');
  assert.ok(fs.readFileSync(overview, 'utf8').includes('01-PLAN'));
  assert.ok(fs.readFileSync(path.join(result.destination, 'phases', '01-start', '01-PLAN.md'), 'utf8').includes('# Plan'));

  fs.writeFileSync(path.join(result.destination, 'PROJECT.md'), '# Personal note\n');
  fs.writeFileSync(path.join(project, '.paul', 'STATE.md'), '# Updated state\n');
  assert.throws(() => sync(project, vault), /Refusing to replace an existing note/);
  assert.strictEqual(fs.readFileSync(path.join(result.destination, 'PROJECT.md'), 'utf8'), '# Personal note\n');
  assert.ok(!fs.readFileSync(path.join(result.destination, 'STATE.md'), 'utf8').includes('Updated state'));
  console.log('ok - Obsidian sync mirrors PAUL notes and preserves unmanaged notes');
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
