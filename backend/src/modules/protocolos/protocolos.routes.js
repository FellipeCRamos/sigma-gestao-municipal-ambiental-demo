const express = require('express');

const protocolosController = require('./protocolos.controller');
const requirePermission = require('../../middlewares/requirePermission');
const { PERMISSIONS } = require('../../config/permissions');

const router = express.Router();

router.get(
  '/',
  requirePermission(PERMISSIONS.PROTOCOLOS_VIEW),
  requirePermission(PERMISSIONS.PROTOCOLOS_CONSULT),
  protocolosController.searchProtocolos
);

router.get(
  '/:protocolo',
  requirePermission(PERMISSIONS.PROTOCOLOS_VIEW),
  requirePermission(PERMISSIONS.PROTOCOLOS_CONSULT),
  protocolosController.getProtocolDetail
);

module.exports = router;
