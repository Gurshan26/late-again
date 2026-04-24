const express = require('express');
const lines = require('../data/lines.json');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ lines });
});

module.exports = router;
