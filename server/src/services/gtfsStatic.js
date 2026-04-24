const fs = require('node:fs');
const path = require('node:path');
const AdmZip = require('adm-zip');
const fetch = require('node-fetch');
const { parse } = require('csv-parse/sync');

const GTFS_URL = 'https://data.ptv.vic.gov.au/downloads/gtfs.zip';
const DATA_DIR = path.resolve(__dirname, '../../..', 'data', 'gtfs');
const ZIP_PATH = path.join(DATA_DIR, 'gtfs.zip');
const FEED_DIR = path.join(DATA_DIR, 'active_feed');

const REQUIRED_FILES = [
  'routes.txt',
  'trips.txt',
  'stop_times.txt',
  'stops.txt',
  'calendar.txt',
];

let parsedGtfs = null;

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function hasRequiredFiles() {
  return REQUIRED_FILES.every((file) => fs.existsSync(path.join(FEED_DIR, file)));
}

function findNestedTransitZip(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const matches = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      matches.push(...findNestedTransitZip(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name === 'google_transit.zip') {
      matches.push(fullPath);
    }
  }

  if (dirPath !== DATA_DIR) return matches;
  if (matches.length === 0) return null;

  const sortedBySize = matches.sort((a, b) => fs.statSync(a).size - fs.statSync(b).size);
  return sortedBySize[0];
}

async function downloadZipIfNeeded() {
  ensureDir();

  if (!fs.existsSync(ZIP_PATH)) {
    const res = await fetch(GTFS_URL);
    if (!res.ok) {
      throw new Error(`Failed to download GTFS zip: ${res.status} ${res.statusText}`);
    }

    const buffer = await res.buffer();
    fs.writeFileSync(ZIP_PATH, buffer);

    const zip = new AdmZip(ZIP_PATH);
    zip.extractAllTo(DATA_DIR, true);
  }

  if (hasRequiredFiles()) return;

  const nestedZip = findNestedTransitZip(DATA_DIR);
  if (!nestedZip) {
    throw new Error('Could not locate nested google_transit.zip in GTFS archive');
  }

  fs.mkdirSync(FEED_DIR, { recursive: true });
  const innerZip = new AdmZip(nestedZip);
  innerZip.extractAllTo(FEED_DIR, true);

  if (!hasRequiredFiles()) {
    throw new Error('GTFS feed extraction did not produce required CSV files');
  }
}

function parseCsv(fileName) {
  const filePath = path.join(FEED_DIR, fileName);
  const content = fs.readFileSync(filePath, 'utf8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });
}

async function loadGtfsStaticData() {
  if (parsedGtfs) return parsedGtfs;

  await downloadZipIfNeeded();

  parsedGtfs = {
    routes: parseCsv('routes.txt'),
    trips: parseCsv('trips.txt'),
    stopTimes: parseCsv('stop_times.txt'),
    stops: parseCsv('stops.txt'),
    calendar: parseCsv('calendar.txt'),
  };

  return parsedGtfs;
}

async function initStaticGtfsData() {
  try {
    await loadGtfsStaticData();
  } catch (error) {
    console.warn(`[WARN] Static GTFS bootstrap failed: ${error.message}`);
  }
}

module.exports = {
  initStaticGtfsData,
  loadGtfsStaticData,
};
