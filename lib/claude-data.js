import { readFile } from 'node:fs/promises';
import path from 'node:path';

const FILE_PATH = path.join(process.cwd(), 'data', 'claude-data.json');

export async function getClaudeData() {
  try {
    const raw = await readFile(FILE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
