#!/usr/bin/env node
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_BASE_URL = 'https://aiberm.com/v1';
const DEFAULT_MODEL = 'gpt-image-2';

const RATIO_SIZES = {
  '1:1': '1536x1536',
  '4:5': '1280x1600',
  '9:16': '1088x1920',
};

function usage() {
  console.log(`Usage:
  node generate-aiberm-image.mjs --prompt-file <file> --output <image.png> [options]

Options:
  --prompt-file          Markdown/text prompt file. Required.
  --output               Output image path. Required.
  --model                Image model. Defaults to gpt-image-2.
  --ratio                1:1, 4:5, or 9:16. Defaults to 4:5.
  --size                 Exact WxH size. Overrides --ratio.
  --quality              auto, low, medium, or high. Defaults to low for fast tests.
  --output-format        png, jpeg, or webp. Defaults to png.
  --output-compression   0-100. Applies only to jpeg and webp.
  --moderation           auto or low. Defaults to auto.
  --ref                  Reference image path. Repeatable. Uses /images/edits.
  --mask                 Optional mask image for /images/edits.
  --base-url             Defaults to AIBERM_BASE_URL / AIBEAM_BASE_URL or https://aiberm.com/v1.
`);
}

function parseArgs(argv) {
  const args = {
    model: DEFAULT_MODEL,
    ratio: '4:5',
    quality: 'low',
    outputFormat: 'png',
    moderation: 'auto',
    refs: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);

    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
    index += 1;

    if (key === 'ref') args.refs.push(value);
    else args[key.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase())] = value;
  }

  return args;
}

function sizeFromRatio(ratio) {
  const normalized = normalizeRatio(ratio);
  if (RATIO_SIZES[normalized]) return RATIO_SIZES[normalized];
  throw new Error(`Unsupported ratio: ${ratio}. Supported ratios: 1:1, 4:5, 9:16.`);
}

function normalizeRatio(value) {
  return String(value).trim().replace(/：/g, ':');
}

function validateSize(size) {
  const match = String(size).match(/^(\d+)x(\d+)$/i);
  if (!match) throw new Error(`Invalid size: ${size}. Expected WIDTHxHEIGHT.`);
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width <= 0 || height <= 0) throw new Error(`Invalid size: ${size}`);
  if (width % 16 !== 0 || height % 16 !== 0) {
    throw new Error(`Size must use multiples of 16 for gpt-image-2: ${size}`);
  }
  const pixels = width * height;
  if (pixels < 655_360 || pixels > 8_294_400) {
    throw new Error(`Size total pixels must be between 655,360 and 8,294,400 for gpt-image-2: ${size}`);
  }
  if (Math.max(width, height) > 3840) {
    throw new Error(`Size long edge must not exceed 3840px for gpt-image-2: ${size}`);
  }
  if (Math.max(width, height) / Math.min(width, height) > 3) {
    throw new Error(`Size ratio must not exceed 3:1 for gpt-image-2: ${size}`);
  }
}

function validateQuality(quality) {
  if (!['auto', 'low', 'medium', 'high'].includes(quality)) {
    throw new Error(`Invalid quality: ${quality}. Expected auto, low, medium, or high.`);
  }
}

function validateOutputFormat(format) {
  if (!['png', 'jpeg', 'webp'].includes(format)) {
    throw new Error(`Invalid output format: ${format}. Expected png, jpeg, or webp.`);
  }
}

function validateCompression(value, format) {
  if (value === undefined) return;
  if (format === 'png') throw new Error('--output-compression only applies to jpeg and webp.');
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100) {
    throw new Error(`Invalid output compression: ${value}. Expected integer 0-100.`);
  }
}

function validateModeration(value) {
  if (!['auto', 'low'].includes(value)) {
    throw new Error(`Invalid moderation: ${value}. Expected auto or low.`);
  }
}

async function readCommonEnv() {
  const envPath = path.join(os.homedir(), '.secrets', 'common.env');
  try {
    const text = await readFile(envPath, 'utf8');
    const values = {};
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      values[key] = rawValue.replace(/^(['"])(.*)\1$/, '$2');
    }
    return values;
  } catch {
    return {};
  }
}

async function resolveEndpoint(args) {
  const commonEnv = await readCommonEnv();
  const apiKey = process.env.AIBERM_API_KEY || process.env.AIBEAM_API_KEY || process.env.API_KEY;
  const fileApiKey = commonEnv.AIBERM_API_KEY || commonEnv.AIBEAM_API_KEY || commonEnv.API_KEY;
  if (apiKey) {
    return {
      apiKey,
      baseUrl: args.baseUrl || process.env.AIBERM_BASE_URL || process.env.AIBEAM_BASE_URL || DEFAULT_BASE_URL,
      source: 'aiberm',
    };
  }
  if (fileApiKey) {
    return {
      apiKey: fileApiKey,
      baseUrl: args.baseUrl || process.env.AIBERM_BASE_URL || process.env.AIBEAM_BASE_URL || commonEnv.AIBERM_BASE_URL || commonEnv.AIBEAM_BASE_URL || DEFAULT_BASE_URL,
      source: 'aiberm',
    };
  }

  throw new Error('AIBERM_API_KEY, AIBEAM_API_KEY, or API_KEY is required for image-card-generator real generation through Aiberm.');
}

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/png';
}

async function extractImage(result) {
  const first = result?.data?.[0];
  if (first?.b64_json) return Buffer.from(first.b64_json, 'base64');

  if (first?.url) {
    const response = await fetch(first.url);
    if (!response.ok) throw new Error(`Failed to download generated image: ${response.status} ${await response.text()}`);
    return Buffer.from(await response.arrayBuffer());
  }

  throw new Error('Image provider returned no b64_json or url in data[0].');
}

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
}

async function backupExisting(filePath) {
  try {
    await access(filePath);
  } catch {
    return null;
  }

  const parsed = path.parse(filePath);
  const backupPath = path.join(parsed.dir, `${parsed.name}-backup-${timestamp()}${parsed.ext}`);
  await rename(filePath, backupPath);
  return backupPath;
}

async function generate(endpoint, args, prompt, size) {
  if (args.refs.length > 0 || args.mask) {
    const form = new FormData();
    form.append('model', args.model);
    form.append('prompt', prompt);
    form.append('size', size);
    form.append('quality', args.quality);
    form.append('output_format', args.outputFormat);
    form.append('moderation', args.moderation);
    if (args.outputCompression !== undefined) form.append('output_compression', args.outputCompression);

    for (const ref of args.refs) {
      const bytes = await readFile(ref);
      const blob = new Blob([bytes], { type: mimeType(ref) });
      form.append('image[]', blob, path.basename(ref));
    }
    if (args.mask) {
      const bytes = await readFile(args.mask);
      const blob = new Blob([bytes], { type: mimeType(args.mask) });
      form.append('mask', blob, path.basename(args.mask));
    }

    const response = await fetch(`${endpoint.baseUrl}/images/edits`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${endpoint.apiKey}` },
      body: form,
    });

    if (!response.ok) throw new Error(`Aiberm image edits error: ${response.status} ${await response.text()}`);
    return extractImage(await response.json());
  }

  const response = await fetch(`${endpoint.baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${endpoint.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: args.model,
      prompt,
      size,
      quality: args.quality,
      output_format: args.outputFormat,
      ...(args.outputCompression !== undefined ? { output_compression: Number(args.outputCompression) } : {}),
      moderation: args.moderation,
      n: 1,
    }),
  });

  if (!response.ok) throw new Error(`Aiberm image generation error: ${response.status} ${await response.text()}`);
  return extractImage(await response.json());
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  if (!args.promptFile || !args.output) {
    usage();
    throw new Error('--prompt-file and --output are required');
  }
  if (args.model !== DEFAULT_MODEL) {
    throw new Error(`image-card-generator requires ${DEFAULT_MODEL}; got ${args.model}`);
  }

  const prompt = await readFile(args.promptFile, 'utf8');
  const size = args.size || sizeFromRatio(args.ratio);
  validateSize(size);
  validateQuality(args.quality);
  validateOutputFormat(args.outputFormat);
  validateCompression(args.outputCompression, args.outputFormat);
  validateModeration(args.moderation);
  if (args.mask && args.refs.length === 0) {
    throw new Error('--mask requires at least one --ref image for /images/edits.');
  }

  const endpoint = await resolveEndpoint(args);
  const image = await generate(endpoint, args, prompt, size);
  const outputPath = path.resolve(args.output);
  await mkdir(path.dirname(outputPath), { recursive: true });
  const backupPath = await backupExisting(outputPath);
  await writeFile(outputPath, image);

  console.log(`Generated ${args.output}`);
  if (backupPath) console.log(`Backup: ${backupPath}`);
  console.log(`Source: ${endpoint.source}`);
  console.log(`Model: ${args.model}`);
  console.log(`Size: ${size}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
