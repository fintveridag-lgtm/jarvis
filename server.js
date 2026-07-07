import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';

import { aggregateData } from './lib/data-aggregate.js';
import { buildBriefSections } from './lib/brief-script.js';
import { synthesizeBriefWithTimestamps } from './lib/elevenlabs.js';
import { computeCues } from './lib/cues.js';
import { getWeather } from './lib/weather.js';
import { getAccount } from './lib/account.js';

const app = express();
const PORT = process.env.PORT || 3000;

await mkdir(path.join(process.cwd(), 'public', 'audio'), { recursive: true });

app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/data', async (req, res) => {
  try {
    const data = await aggregateData();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Planet-endepunkter: hver planet rundt orben har sitt eget datakall.
app.get('/api/planets/weather', async (req, res) => {
  try {
    res.json(await getWeather());
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/planets/account', async (req, res) => {
  try {
    res.json(await getAccount());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/brief', async (req, res) => {
  try {
    const data = await aggregateData();
    const sections = buildBriefSections(data);
    const fullText = sections.map((s) => s.text).join(' ');

    const { audioUrl, alignment } = await synthesizeBriefWithTimestamps(fullText);
    const cues = computeCues(sections, alignment);

    res.json({ audioUrl, cues, sections, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Jarvis dashboard running at http://localhost:${PORT}`);
});
