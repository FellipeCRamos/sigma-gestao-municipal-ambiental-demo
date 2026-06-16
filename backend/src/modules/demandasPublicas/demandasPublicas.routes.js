const express = require('express');

const demandasPublicasController = require('./demandasPublicas.controller');
const anexosController = require('../anexos/anexos.controller');
const requirePermission = require('../../middlewares/requirePermission');
const sigmaAnexoUpload = require('../../middlewares/sigmaAnexoUpload');
const { PERMISSIONS } = require('../../config/permissions');

const router = express.Router();

router.get(
  '/',
  requirePermission(PERMISSIONS.DEMANDAS_PUBLICAS_VIEW),
  demandasPublicasController.listDemands
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.DEMANDAS_PUBLICAS_VIEW),
  demandasPublicasController.getDemand
);

router.post(
  '/:id/anexos',
  requirePermission(PERMISSIONS.DEMANDAS_PUBLICAS_VIEW),
  requirePermission(PERMISSIONS.ANEXOS_SEND),
  sigmaAnexoUpload.single('arquivo'),
  anexosController.createDemandAnexo
);

router.get(
  '/:id/anexos',
  requirePermission(PERMISSIONS.DEMANDAS_PUBLICAS_VIEW),
  requirePermission(PERMISSIONS.ANEXOS_VIEW),
  anexosController.listDemandAnexos
);

router.get(
  '/:id/anexos/:anexoId/download',
  requirePermission(PERMISSIONS.DEMANDAS_PUBLICAS_VIEW),
  requirePermission(PERMISSIONS.ANEXOS_DOWNLOAD),
  anexosController.downloadDemandAnexo
);

router.delete(
  '/:id/anexos/:anexoId',
  requirePermission(PERMISSIONS.DEMANDAS_PUBLICAS_VIEW),
  requirePermission(PERMISSIONS.ANEXOS_REMOVE),
  anexosController.removeDemandAnexo
);

router.put(
  '/:id/status',
  requirePermission(PERMISSIONS.DEMANDAS_PUBLICAS_TRIAGEM),
  demandasPublicasController.updateStatus
);

router.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.DEMANDAS_PUBLICAS_TRIAGEM),
  demandasPublicasController.updateStatus
);

router.patch(
  '/:id/responsavel',
  requirePermission(PERMISSIONS.DEMANDAS_PUBLICAS_ASSIGN),
  demandasPublicasController.assignResponsible
);

router.post(
  '/:id/movimentacoes',
  requirePermission(PERMISSIONS.DEMANDAS_PUBLICAS_MANAGE),
  demandasPublicasController.createMovement
);

router.post(
  '/:id/encerrar',
  requirePermission(PERMISSIONS.DEMANDAS_PUBLICAS_CLOSE),
  demandasPublicasController.closeDemand
);

module.exports = router;
