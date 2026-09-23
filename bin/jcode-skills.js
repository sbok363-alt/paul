#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function titleCase(name) {
  return name.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join(' ');
}

function yaml(value) {
  return JSON.stringify(value);
}

function skillDescription(name, command) {
  const description = command.match(/^description:\s*(.+)$/m);
  return description ? description[1].replace(/^['"]|['"]$/g, '') : `Run the PAUL ${titleCase(name)} workflow`;
}

function stripFrontmatter(content) {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
}

function adaptJcodeText(content) {
  return content
    .replace(/\$ARGUMENTS/g, 'the arguments supplied with this skill request')
    .replace(/CLAUDE\.md/g, 'AGENTS.md')
    .replace(/~\/\.claude\/commands\//g, '~/.agents/skills/')
    .replace(/\.claude\/commands\//g, '.agents/skills/')
    .replace(/~\/\.claude\/paul-framework\//g, './paul-framework/')
    .replace(/\/paul:([a-z][a-z0-9-]*)/g, (_, commandName) => `/paul-${commandName}`)
    .replace(/\$paul-([a-z][a-z0-9-]*)/g, (_, commandName) => `/paul-${commandName}`)
    .replace(/Use AskUserQuestion/g, 'Ask the user directly')
    .replace(/via AskUserQuestion/g, 'directly in the conversation')
    .replace(/AskUserQuestion/g, 'a direct user question')
    .replace(/Use Task tool/g, 'Use the `subagent` tool')
    .replace(/Task tool parameters/g, '`subagent` tool parameters')
    .replace(/\bWebSearch\b/g, '`websearch`')
    .replace(/\bWebFetch\b/g, '`webfetch`')
    .replace(/Co-Authored-By: Claude <noreply@anthropic\.com>/g, 'Generated with Jcode')
    .replace(/Claude Code/g, 'Jcode')
    .replace(/CLAUDE/g, 'JCODE')
    .replace(/Claude/g, 'Jcode')
    .replace(/claude/g, 'jcode');
}

function copyResource(category, file, root, skillDir, copied) {
  const key = `${category}/${file}`;
  if (copied.has(key)) return;

  const sourcePath = path.join(root, 'src', category, file);
  if (!fs.existsSync(sourcePath)) return;
  copied.add(key);

  const destination = path.join(skillDir, 'paul-framework', category, file);
  const source = fs.readFileSync(sourcePath, 'utf8');
  const resolved = resolveResourceReferences(source, root, skillDir, copied);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(
    destination,
    adaptJcodeText(resolved.body)
      .replace(/\{\{PAUL_OBSIDIAN_SYNC_SCRIPT\}\}/g, path.join(skillDir, 'obsidian-sync.js')),
  );
}

function resolveResourceReferences(content, root, skillDir, copied = new Set()) {
  const referencePattern = /@~\/\.claude\/paul-framework\/(templates|workflows|references|rules)\/([A-Za-z0-9._/-]+\.md)/g;
  const references = [];
  const body = content.replace(referencePattern, (reference, category, file) => {
    copyResource(category, file, root, skillDir, copied);
    references.push(
      `Read \`${category}/${file}\` from the adjacent \`paul-framework\` directory and follow it.`,
    );
    return `the skill's \`paul-framework/${category}/${file}\` resource`;
  });
  return { body, references: [...new Set(references)] };
}

function installJcodeSkills(options = {}) {
  const root = options.root || path.join(__dirname, '..');
  const target = options.target || path.join(process.cwd(), '.agents', 'skills');
  const commandsDir = path.join(root, 'src', 'commands');
  const commandNames = fs.readdirSync(commandsDir)
    .filter(file => file.endsWith('.md'))
    .map(file => path.basename(file, '.md'))
    .sort();

  for (const name of commandNames) {
    const commandPath = path.join(commandsDir, `${name}.md`);
    const command = fs.readFileSync(commandPath, 'utf8');
    const skillDir = path.join(target, `paul-${name}`);
    fs.mkdirSync(skillDir, { recursive: true });

    if (command.includes('references/obsidian-sync.md')) {
      fs.copyFileSync(
        path.join(root, 'bin', 'obsidian-sync.js'),
        path.join(skillDir, 'obsidian-sync.js'),
      );
    }

    const resolved = resolveResourceReferences(stripFrontmatter(command), root, skillDir);
    const body = adaptJcodeText(resolved.body);
    const references = resolved.references.length
      ? `\n## Required PAUL resources\n\n${resolved.references.map(reference => `- ${reference}`).join('\n')}\n`
      : '';
    const description = adaptJcodeText(skillDescription(name, command));
    const resourceResolution = `
## Jcode resource resolution

Bundled PAUL resources live under \`paul-framework/\` beside this skill's \`SKILL.md\`.
Before following any bundled resource reference, call \`skill_manage\` with
\`{"action":"read","name":"paul-${name}"}\`. Use the parent directory of the returned
\`Path\` as this skill's base directory, then resolve \`paul-framework/...\` from there.
Do not guess the skill's filesystem path.
`;
    const skill = `---\nname: paul-${name}\ndescription: ${yaml(description)}\n---\n\n${resourceResolution.trim()}\n\n${body.trim()}\n${references}`;
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skill);
  }

  return commandNames.length;
}

if (require.main === module) {
  const target = process.argv[2] || path.join(process.cwd(), '.agents', 'skills');
  const count = installJcodeSkills({ target });
  console.log(`Installed ${count} PAUL skills for Jcode to ${target}`);
}

module.exports = {
  adaptJcodeText,
  installJcodeSkills,
  resolveResourceReferences,
  stripFrontmatter,
};
