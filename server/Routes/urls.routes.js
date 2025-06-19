// routes/urls.js
const express = require('express');
const router = express.Router();
const Url = require('../models/urls');

router.get('/:shortUrl', async (req, res) => {
  const { shortUrl } = req.params;
  const url = await Url.findOne({ shortUrl });

  if (url) {
    return res.redirect(url.longUrl);
  } else {
    return res.status(404).json({ message: 'URL not found' });
  }
});

module.exports = router;
