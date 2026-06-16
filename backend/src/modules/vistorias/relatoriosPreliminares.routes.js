const express = require('express');

const vistoriasController = require('./vistorias.controller');
const requirePermission = require('../../middlewares/requirePermission');
const { PERMISSIONS } = require('../../config/permissions');

const router = express.Router();

router.get(
  '/',
  requirePermission(PERMISSIONS.RELATORIO_PRELIMINAR_VIEW),
  vistoriasController.listRelatorios
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.RELATORIO_PRELIMINAR_VIEW),
  vistoriasController.getRelatorio
);

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.RELATORIO_PRELIMINAR_EDIT),
  vistoriasController.updateRelatorio
);

router.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.RELATORIO_PRELIMINAR_UPDATE_STATUS),
  vistoriasController.updateRelatorioStatus
);

router.post(
  '/:id/movimentacoes',
  requirePermission(PERMISSIONS.RELATORIO_PRELIMINAR_MOVE),
  vistoriasController.createRelatorioMovement
);

module.exports = router;
