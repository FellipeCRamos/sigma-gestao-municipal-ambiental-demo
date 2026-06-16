const express = require('express');

const vistoriasController = require('./vistorias.controller');
const requirePermission = require('../../middlewares/requirePermission');
const sigmaAnexoUpload = require('../../middlewares/sigmaAnexoUpload');
const { PERMISSIONS } = require('../../config/permissions');

const router = express.Router();

router.get(
  '/',
  requirePermission(PERMISSIONS.VISTORIA_VIEW),
  vistoriasController.listVistorias
);

router.get(
  '/:id/anexos',
  requirePermission(PERMISSIONS.VISTORIA_VIEW),
  requirePermission(PERMISSIONS.VISTORIA_VIEW_ANEXOS),
  requirePermission(PERMISSIONS.ANEXOS_VIEW),
  vistoriasController.listVistoriaAnexos
);

router.post(
  '/:id/anexos',
  requirePermission(PERMISSIONS.VISTORIA_VIEW),
  requirePermission(PERMISSIONS.ANEXOS_SEND),
  sigmaAnexoUpload.single('arquivo'),
  vistoriasController.createVistoriaAnexo
);

router.get(
  '/:id/anexos/:anexoId/download',
  requirePermission(PERMISSIONS.VISTORIA_VIEW),
  requirePermission(PERMISSIONS.VISTORIA_VIEW_ANEXOS),
  requirePermission(PERMISSIONS.ANEXOS_DOWNLOAD),
  vistoriasController.downloadVistoriaAnexo
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.VISTORIA_VIEW),
  vistoriasController.getVistoria
);

router.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.VISTORIA_UPDATE_STATUS),
  vistoriasController.updateVistoriaStatus
);

router.patch(
  '/:id/responsavel',
  requirePermission(PERMISSIONS.VISTORIA_ASSIGN),
  vistoriasController.assignVistoriaResponsible
);

router.post(
  '/:id/movimentacoes',
  requirePermission(PERMISSIONS.VISTORIA_MOVE),
  vistoriasController.createVistoriaMovement
);

router.post(
  '/:id/registrar-realizacao',
  requirePermission(PERMISSIONS.VISTORIA_REGISTER),
  vistoriasController.registerVistoriaRealizacao
);

router.post(
  '/:id/cancelar',
  requirePermission(PERMISSIONS.VISTORIA_CANCEL),
  vistoriasController.cancelVistoria
);

router.post(
  '/:id/relatorios-preliminares',
  requirePermission(PERMISSIONS.RELATORIO_PRELIMINAR_CREATE),
  vistoriasController.createRelatorio
);

module.exports = router;
