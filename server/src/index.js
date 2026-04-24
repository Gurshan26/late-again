require('dotenv').config();
const express = require('express');
const cors = require('cors');

const linesRouter = require('./routes/lines');
const alertsRouter = require('./routes/alerts');
const delaysRouter = require('./routes/delays');
const predictRouter = require('./routes/predict');
const weatherRouter = require('./routes/weather');
const commuteRouter = require('./routes/commute');
const errorHandler = require('./middleware/errorHandler');
const { initStaticGtfsData } = require('./services/gtfsStatic');

const app = express();
const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV !== 'test') {
  initStaticGtfsData();
}

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/lines', linesRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/delays', delaysRouter);
app.use('/api/predict', predictRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/commute', commuteRouter);

app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Late Again? server running on port ${PORT}`);
    if (!process.env.PTV_API_KEY) {
      console.warn('[WARN] PTV_API_KEY not set — running in demo mode with no live PTV data');
    }
  });
}

module.exports = app;
