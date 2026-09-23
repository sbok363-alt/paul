const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { installJcodeSkills } = require('../bin/jcode-skills');

const root = path.join(__dirname, '..');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'paul-jcode-skills-'));

try {
  const skillsRoot = path.join(temporaryRoot, '.agents', 'skills');
  const count = installJcodeSkills({ root, target: skillsRoot });
  const commandCount = fs.readdirSync(path.join(root, 'src', 'commands'))
    .filter(file => file.endsWith('.md')).length;
  assert.strictEqual(count, commandCount, 'all PAUL commands should become Jcode skills');

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
  assert.ok(!generated.includes('/paul:'), 'generated resources must use Jcode skill names');
  assert.ok(!generated.includes('$paul-'), 'generated resources must not use Codex-only skill invocation');
  assert.ok(!generated.includes('$ARGUMENTS'), 'generated resources must not retain Claude argument placeholders');
  assert.ok(!generated.includes('AskUserQuestion'), 'generated resources must not require Claude question tooling');
  assert.ok(!generated.includes('Task tool'), 'generated resources must use Jcode subagent tooling');
  assert.ok(!generated.includes('WebSearch'), 'generated resources must use Jcode websearch tooling');
  assert.ok(!generated.includes('WebFetch'), 'generated resources must use Jcode webfetch tooling');
  assert.ok(!/claude/i.test(generated), 'generated resources must identify Jcode as the active agent');
  assert.ok(!generated.includes('anthropic.com'), 'generated resources must not add Anthropic commit attribution');
  assert.ok(!generated.includes('{{PAUL_OBSIDIAN_SYNC_SCRIPT}}'), 'Obsidian script path must be resolved');
  assert.ok(
    generated.includes('/paul-plan') || generated.includes('/paul-apply') || generated.includes('/paul-unify'),
    'generated resources should contain Jcode slash-skill invocations',
  );
  assert.ok(
    generated.includes('{"action":"read","name":"paul-plan"}'),
    'generated skills should resolve their resource base through skill_manage',
  );
  assert.ok(
    generated.includes('Do not guess the skill\'s filesystem path.'),
    'generated skills should forbid guessed resource paths',
  );

  for (const name of ['init', 'plan', 'apply', 'unify']) {
    assert.ok(
      fs.existsSync(path.join(skillsRoot, `paul-${name}`, 'obsidian-sync.js')),
      `${name} must bundle the sync script`,
    );
  }

  console.log(`ok - generated ${count} Jcode skills without Claude/Codex-only tokens`);
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
