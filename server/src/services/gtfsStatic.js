const fs = require('node:fs');
const path = require('node:path');
const AdmZip = require('adm-zip');
const fetch = require('node-fetch');
const { parse } = require('csv-parse/sync');

const GTFS_URL = 'https://data.ptv.vic.gov.au/downloads/gtfs.zip';
const DATA_DIR = path.resolve(__dirname, '../../..', 'data', 'gtfs');
const ZIP_PATH = path.join(DATA_DIR, 'gtfs.zip');
const FEED_DIR = path.join(DATA_DIR, 'active_feed');
const MODE_ID = '2';
const MODE_ZIP_PATH = path.join(DATA_DIR, MODE_ID, 'google_transit.zip');
const SOURCE_MARKER_PATH = path.join(FEED_DIR, '.source-mode');

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

function hasRequiredFiles() {
  return REQUIRED_FILES.every((file) => fs.existsSync(path.join(FEED_DIR, file)));
}

function hasMetroMarker() {
  if (!fs.existsSync(SOURCE_MARKER_PATH)) return false;
  return fs.readFileSync(SOURCE_MARKER_PATH, 'utf8').trim() === MODE_ID;
}

function isMetroRoutesFile() {
  const routesPath = path.join(FEED_DIR, 'routes.txt');
  if (!fs.existsSync(routesPath)) return false;

  const sample = fs.readFileSync(routesPath, 'utf8').slice(0, 2048);
  return sample.includes('vic-02-');
}

function hasMetroFeedReady() {
  if (!hasRequiredFiles()) return false;
  if (hasMetroMarker()) return true;
  return isMetroRoutesFile();
}

function ensureArchiveExtracted() {
  if (fs.existsSync(MODE_ZIP_PATH)) return;
  if (!fs.existsSync(ZIP_PATH)) return;

  const zip = new AdmZip(ZIP_PATH);
  zip.extractAllTo(DATA_DIR, true);
}

function extractMetroFeed() {
  ensureArchiveExtracted();

  if (!fs.existsSync(MODE_ZIP_PATH)) {
    throw new Error(`Could not locate metro GTFS zip at ${MODE_ZIP_PATH}`);
  }

  fs.rmSync(FEED_DIR, { recursive: true, force: true });
  fs.mkdirSync(FEED_DIR, { recursive: true });

  const metroZip = new AdmZip(MODE_ZIP_PATH);
  metroZip.extractAllTo(FEED_DIR, true);
  fs.writeFileSync(SOURCE_MARKER_PATH, MODE_ID, 'utf8');

  if (!hasRequiredFiles()) {
    throw new Error('Metro GTFS extraction did not produce required CSV files');
  }
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

  if (hasMetroFeedReady()) return;
  extractMetroFeed();
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
    calendarDates: parseCsv('calendar_dates.txt'),
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
