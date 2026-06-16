const express = require('express');

const fiscalizacaoController = require('./fiscalizacao.controller');
const vistoriasController = require('../vistorias/vistorias.controller');
const requirePermission = require('../../middlewares/requirePermission');
const { PERMISSIONS } = require('../../config/permissions');

const router = express.Router();

router.get(
  '/',
  requirePermission(PERMISSIONS.FISCALIZACAO_VIEW),
  fiscalizacaoController.listFiscalizacoes
);

router.post(
  '/converter-demanda/:demandaId',
  requirePermission(PERMISSIONS.FISCALIZACAO_CREATE_FROM_DEMANDA),
  fiscalizacaoController.convertDemand
);

router.get(
  '/:id/vistorias',
  requirePermission(PERMISSIONS.FISCALIZACAO_VIEW),
  requirePermission(PERMISSIONS.VISTORIA_VIEW),
  vistoriasController.listVistoriasByFiscalizacao
);

router.post(
  '/:id/vistorias',
  requirePermission(PERMISSIONS.VISTORIA_CREATE),
  vistoriasController.createVistoria
);

router.get(
  '/:id/anexos',
  requirePermission(PERMISSIONS.FISCALIZACAO_VIEW),
  requirePermission(PERMISSIONS.FISCALIZACAO_VIEW_ANEXOS),
  requirePermission(PERMISSIONS.ANEXOS_VIEW),
  fiscalizacaoController.listInheritedAnexos
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.FISCALIZACAO_VIEW),
  fiscalizacaoController.getFiscalizacao
);

router.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.FISCALIZACAO_UPDATE_STATUS),
  fiscalizacaoController.updateStatus
);

router.patch(
  '/:id/responsavel',
  requirePermission(PERMISSIONS.FISCALIZACAO_ASSIGN),
  fiscalizacaoController.assignResponsible
);

router.post(
  '/:id/movimentacoes',
  requirePermission(PERMISSIONS.FISCALIZACAO_MOVE),
  fiscalizacaoController.createMovement
);

router.post(
  '/:id/encerrar-preliminarmente',
  requirePermission(PERMISSIONS.FISCALIZACAO_CLOSE_PRELIMINAR),
  fiscalizacaoController.closePreliminarily
);

module.exports = router;
