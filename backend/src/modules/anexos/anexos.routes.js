const express = require('express');

const anexosController = require('./anexos.controller');
const requirePermission = require('../../middlewares/requirePermission');
const sigmaAnexoUpload = require('../../middlewares/sigmaAnexoUpload');
const { PERMISSIONS } = require('../../config/permissions');

const router = express.Router();

router.post(
  '/',
  requirePermission(PERMISSIONS.ANEXOS_SEND),
  sigmaAnexoUpload.single('arquivo'),
  anexosController.createAnexo
);

router.get(
  '/',
  requirePermission(PERMISSIONS.ANEXOS_VIEW),
  anexosController.listAnexos
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.ANEXOS_VIEW),
  anexosController.getAnexo
);

router.get(
  '/:id/download',
  requirePermission(PERMISSIONS.ANEXOS_DOWNLOAD),
  anexosController.downloadAnexo
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.ANEXOS_REMOVE),
  anexosController.removeAnexo
);

module.exports = router;
