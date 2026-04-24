const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const AdmZip = require('adm-zip');
const fetch = require('node-fetch');
const { parse } = require('csv-parse/sync');

const GTFS_URL = 'https://data.ptv.vic.gov.au/downloads/gtfs.zip';
const MODE_ID = '2';

const BASE_DATA_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), 'late-again')
  : path.resolve(__dirname, '../../..', 'data');
const DATA_DIR = path.join(BASE_DATA_DIR, 'gtfs');
const ZIP_PATH = path.join(DATA_DIR, 'gtfs.zip');
const MODE_ZIP_PATH = path.join(DATA_DIR, `${MODE_ID}.zip`);
const BUNDLED_MODE_ZIP_PATH = path.resolve(__dirname, '..', 'data', 'metro_google_transit.zip');

const REQUIRED_FILES = [
  'routes.txt',
  'trips.txt',
  'stop_times.txt',
  'stops.txt',
  'calendar.txt',
  'calendar_dates.txt',
];

let parsedGtfs = null;

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function resolveMetroZipPath() {
  if (fs.existsSync(BUNDLED_MODE_ZIP_PATH)) return BUNDLED_MODE_ZIP_PATH;
  if (fs.existsSync(MODE_ZIP_PATH)) return MODE_ZIP_PATH;
  return null;
}

function hasRequiredEntries(zipPath) {
  if (!zipPath || !fs.existsSync(zipPath)) return false;

  const zip = new AdmZip(zipPath);
  return REQUIRED_FILES.every((fileName) => Boolean(zip.getEntry(fileName)));
}

function extractModeZipFromMaster() {
  if (!fs.existsSync(ZIP_PATH)) {
    throw new Error('GTFS master zip is missing.');
  }

  const zip = new AdmZip(ZIP_PATH);
  const modeEntry = zip.getEntry(`${MODE_ID}/google_transit.zip`);
  if (!modeEntry) {
    throw new Error(`Could not locate ${MODE_ID}/google_transit.zip in GTFS archive`);
  }

  const modeBuffer = modeEntry.getData();
  fs.writeFileSync(MODE_ZIP_PATH, modeBuffer);

  // Keep the disk footprint low in serverless runtimes.
  fs.rmSync(ZIP_PATH, { force: true });
}

async function downloadZipIfNeeded() {
  const readyZip = resolveMetroZipPath();
  if (hasRequiredEntries(readyZip)) return;

  ensureDir();

  if (!fs.existsSync(ZIP_PATH)) {
    const res = await fetch(GTFS_URL);
    if (!res.ok) {
      throw new Error(`Failed to download GTFS zip: ${res.status} ${res.statusText}`);
    }

    const buffer = await res.buffer();
    fs.writeFileSync(ZIP_PATH, buffer);
  }

  extractModeZipFromMaster();

  if (!hasRequiredEntries(MODE_ZIP_PATH)) {
    throw new Error('Metro GTFS extraction did not produce required CSV entries');
  }
}

function parseCsvFromZip(zipPath, fileName) {
  const zip = new AdmZip(zipPath);
  const entry = zip.getEntry(fileName);
  if (!entry) {
    throw new Error(`Missing ${fileName} in metro GTFS zip`);
  }

  const content = entry.getData().toString('utf8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });
}

async function loadGtfsStaticData() {
  if (parsedGtfs) return parsedGtfs;

  await downloadZipIfNeeded();

  const zipPath = resolveMetroZipPath();
  if (!zipPath) {
    throw new Error('Metro GTFS zip could not be resolved');
  }

  parsedGtfs = {
    routes: parseCsvFromZip(zipPath, 'routes.txt'),
    trips: parseCsvFromZip(zipPath, 'trips.txt'),
    stopTimes: parseCsvFromZip(zipPath, 'stop_times.txt'),
    stops: parseCsvFromZip(zipPath, 'stops.txt'),
    calendar: parseCsvFromZip(zipPath, 'calendar.txt'),
    calendarDates: parseCsvFromZip(zipPath, 'calendar_dates.txt'),
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
