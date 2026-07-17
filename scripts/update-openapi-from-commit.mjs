import { execFileSync } from 'node:child_process';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const specPath = resolve(repositoryRoot, 'app/backend/api/openapi.yml');
const maximumDiffLength = 80_000;

function getRequiredEnvironment(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} must be configured before updating OpenAPI with AI.`);
  }

  return value;
}

function getChangedSource() {
  const changedSourcePaths = [
    'app/backend/src',
    'app/backend/prisma/schema.prisma',
  ];
  let revisions;

  try {
    execFileSync('git', ['rev-parse', '--verify', 'HEAD^'], {
      cwd: repositoryRoot,
      stdio: 'ignore',
    });
    revisions = ['HEAD^', 'HEAD'];
  } catch {
    revisions = ['--root', 'HEAD'];
  }

  return execFileSync(
    'git',
    ['diff', '--no-ext-diff', '--unified=3', ...revisions, '--', ...changedSourcePaths],
    { cwd: repositoryRoot, encoding: 'utf8' },
  );
}

function stripMarkdownFence(content) {
  return content
    .trim()
    .replace(/^```(?:yaml|yml)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function validateOpenApiYaml(content) {
  const document = parseDocument(content, { uniqueKeys: true });
  const parsedSpec = document.toJS();

  if (content.includes('\0') || document.errors.length > 0 || typeof parsedSpec !== 'object' || parsedSpec === null) {
    throw new Error('AI response is not valid YAML.');
  }

  if (typeof parsedSpec.openapi !== 'string' || !parsedSpec.openapi.startsWith('3.')) {
    throw new Error('AI response is not an OpenAPI 3 YAML document.');
  }

  if (typeof parsedSpec.info !== 'object' || parsedSpec.info === null || typeof parsedSpec.paths !== 'object' || parsedSpec.paths === null) {
    throw new Error("AI response is missing the required 'info' or 'paths' object.");
  }
}

async function main() {
  const apiUrl = getRequiredEnvironment('CI_AI_API_URL');
  const apiKey = getRequiredEnvironment('CI_AI_API_KEY');
  const model = getRequiredEnvironment('CI_AI_MODEL');
  const [currentSpec, diff] = await Promise.all([
    readFile(specPath, 'utf8'),
    Promise.resolve(getChangedSource()),
  ]);

  if (!diff.trim()) {
    console.log('No backend contract changes found; OpenAPI document is unchanged.');
    return;
  }

  const prompt = [
    'You maintain an OpenAPI 3.1 YAML document for a NestJS service.',
    'Update the complete document only when the supplied backend diff changes the public HTTP API contract.',
    'Preserve existing documented endpoints that are unaffected. Do not invent endpoints, fields, auth schemes, or response codes.',
    'Return only the complete YAML document; do not use Markdown fences or add commentary.',
    '',
    'Current OpenAPI document:',
    currentSpec,
    '',
    'Backend diff:',
    diff.slice(0, maximumDiffLength),
  ].join('\n');

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: 'You output valid OpenAPI 3.1 YAML only.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const generatedContent = payload.choices?.[0]?.message?.content;

  if (typeof generatedContent !== 'string') {
    throw new Error('AI API response did not contain a Chat Completions message.');
  }

  const updatedSpec = `${stripMarkdownFence(generatedContent)}\n`;
  validateOpenApiYaml(updatedSpec);

  if (updatedSpec === currentSpec) {
    console.log('AI confirmed that the OpenAPI document is unchanged.');
    return;
  }

  const temporarySpecPath = `${specPath}.tmp`;
  await writeFile(temporarySpecPath, updatedSpec, 'utf8');
  await rename(temporarySpecPath, specPath);
  console.log('Updated app/backend/api/openapi.yml.');
}

await main();
