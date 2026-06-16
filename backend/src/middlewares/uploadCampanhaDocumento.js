const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { UPLOAD_MAX_BYTES } = require('../config/env');

const uploadDir = path.resolve(__dirname, '..', '..', 'uploads', 'campanhas');
const allowedByMime = new Map([
  ['application/pdf', new Set(['.pdf'])],
  ['image/jpeg', new Set(['.jpg', '.jpeg'])],
  ['image/png', new Set(['.png'])],
  ['image/webp', new Set(['.webp'])]
]);
const dangerousExtensions = new Set([
  '.bat',
  '.cmd',
  '.com',
  '.dll',
  '.exe',
  '.hta',
  '.js',
  '.mjs',
  '.php',
  '.ps1',
  '.sh',
  '.vbs'
]);

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, uploadDir);
  },
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    file.safeExtension = extension;
    callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
  }
});

module.exports = multer({
  storage,
  limits: {
    fileSize: UPLOAD_MAX_BYTES
  },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const allowedExtensions = allowedByMime.get(file.mimetype);

    if (!allowedExtensions || !allowedExtensions.has(extension)) {
      return callback(new Error('Tipo de arquivo nao permitido.'));
    }

    if (dangerousExtensions.has(extension) || file.originalname?.includes('\0')) {
      return callback(new Error('Nome ou extensao de arquivo nao permitidos.'));
    }

    return callback(null, true);
  }
});
