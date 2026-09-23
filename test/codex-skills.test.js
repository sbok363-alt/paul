const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { installCodexSkills } = require('../bin/codex-skills');

const root = path.join(__dirname, '..');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'paul-codex-skills-'));

try {
  const skillsRoot = path.join(temporaryRoot, '.agents', 'skills');
  const count = installCodexSkills({ root, target: skillsRoot });
  const commandCount = fs.readdirSync(path.join(root, 'src', 'commands'))
    .filter(file => file.endsWith('.md')).length;
  assert.strictEqual(count, commandCount, 'all PAUL commands should become Codex skills');

  const pending = [skillsRoot];
  const files = [];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(entryPath);
      else files.push(entryPath);
    }
  }

  const generated = files.map(file => fs.readFileSync(file, 'utf8')).join('\n');
  assert.ok(!generated.includes('~/.claude/'), 'generated resources must not contain Claude home paths');
  assert.ok(!generated.includes('/paul:'), 'generated resources must use Codex skill names');
  assert.ok(!generated.includes('$ARGUMENTS'), 'generated resources must not retain Claude argument placeholders');
  assert.ok(!/claude/i.test(generated), 'generated resources must identify Codex as the active agent');
  assert.ok(!generated.includes('anthropic.com'), 'generated resources must not add Anthropic commit attribution');
  assert.ok(!generated.includes('{{PAUL_OBSIDIAN_SYNC_SCRIPT}}'), 'Obsidian script path must be resolved');
  for (const name of ['init', 'plan', 'apply', 'unify']) {
    assert.ok(fs.existsSync(path.join(skillsRoot, `paul-${name}`, 'obsidian-sync.js')), `${name} must bundle the sync script`);
  }

  console.log(`ok - generated ${count} Codex skills without Claude-only tokens`);
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
