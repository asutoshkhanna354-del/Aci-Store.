const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: 'drn5onxvd',
  api_key: process.env.CLOUDINARY_API_KEY || '582146857682658',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'IsXIkXYM8mvpL8vIODdPo9OFkaY'
});

module.exports = cloudinary;
