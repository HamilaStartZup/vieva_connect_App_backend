// utils/urlShortener.js
const Url = require('../models/urls');

const generateShortUrl = () => {
  return Math.random().toString(36).substring(2, 8);
};

const createShortUrl = async (longUrl) => {
  let shortUrl;
  let url;

  do {
    shortUrl = generateShortUrl();
    url = await Url.findOne({ shortUrl });
  } while (url);

  url = new Url({ shortUrl, longUrl });
  await url.save();

  return shortUrl;
};

module.exports = { createShortUrl };
