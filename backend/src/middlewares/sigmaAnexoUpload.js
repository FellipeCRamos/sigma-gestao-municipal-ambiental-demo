const path = require('path');
const multer = require('multer');
const { UPLOAD_MAX_BYTES } = require('../config/env');

const allowedByMime = new Map([
  ['application/pdf', new Set(['.pdf'])],
  ['image/jpeg', new Set(['.jpg', '.jpeg'])],
  ['image/png', new Set(['.png'])],
  ['application/msword', new Set(['.doc'])],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', new Set(['.docx'])],
  ['application/vnd.ms-excel', new Set(['.xls'])],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', new Set(['.xlsx'])],
  ['application/vnd.google-earth.kml+xml', new Set(['.kml'])],
  ['application/vnd.google-earth.kmz', new Set(['.kmz'])],
  ['application/octet-stream', new Set(['.kmz'])],
]);

const dangerousExtensions = new Set([
  '.bat',
  '.cmd',
  '.com',
  '.dll',
  '.exe',
  '.hta',
  '.jar',
  '.js',
  '.jse',
  '.mjs',
  '.msi',
  '.php',
  '.ps1',
  '.scr',
  '.sh',
  '.vb',
  '.vbe',
  '.vbs',
  '.wsf',
]);

function hasSuspiciousName(originalName = '') {
  if (!originalName || originalName.includes('\0') || /[\\/]/.test(originalName)) {
    return true;
  }

  const extension = path.extname(originalName).toLowerCase();
  if (!extension) {
    return true;
  }

  const base = path.basename(originalName, extension);
  const previousExtension = path.extname(base).toLowerCase();
  return dangerousExtensions.has(extension) || dangerousExtensions.has(previousExtension);
}

module.exports = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: UPLOAD_MAX_BYTES,
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const allowedExtensions = allowedByMime.get(file.mimetype);

    if (hasSuspiciousName(file.originalname)) {
      return callback(new Error('Nome ou extensao de arquivo nao permitidos.'));
    }

    if (!allowedExtensions || !allowedExtensions.has(extension)) {
      return callback(new Error('Tipo de arquivo nao permitido.'));
    }

    return callback(null, true);
  },
});

module.exports.allowedByMime = allowedByMime;
module.exports.dangerousExtensions = dangerousExtensions;
