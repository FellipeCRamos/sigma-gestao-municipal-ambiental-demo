const express = require('express');
const router = express.Router();

const territorioController = require('../controllers/territorioController');
const requirePermission = require('../middlewares/requirePermission');
const { PERMISSIONS } = require('../config/permissions');

router.get(
  '/',
  requirePermission(PERMISSIONS.TERRITORIOS_VIEW),
  territorioController.findAll
);

router.post(
  '/',
  requirePermission(PERMISSIONS.TERRITORIOS_MANAGE),
  territorioController.createTerritorio
);

router.get(
  '/qualidade',
  requirePermission(PERMISSIONS.DASHBOARD_VIEW_RESTRICTED),
  territorioController.getQualidade
);

router.get(
  '/gestao/resumo',
  requirePermission(PERMISSIONS.TERRITORIOS_VIEW),
  territorioController.getGestaoStats
);

router.get(
  '/legado',
  requirePermission(PERMISSIONS.TERRITORIOS_REVIEW),
  territorioController.listLegado
);

router.post(
  '/legado/revisoes',
  requirePermission(PERMISSIONS.TERRITORIOS_REVIEW),
  territorioController.reviewLegado
);

router.get(
  '/aliases',
  requirePermission(PERMISSIONS.TERRITORIOS_VIEW),
  territorioController.listAliases
);

router.put(
  '/aliases/:aliasId',
  requirePermission(PERMISSIONS.TERRITORIOS_ALIAS_MANAGE),
  territorioController.updateAlias
);

router.patch(
  '/aliases/:aliasId/status',
  requirePermission(PERMISSIONS.TERRITORIOS_ALIAS_MANAGE),
  territorioController.updateAliasStatus
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.TERRITORIOS_VIEW),
  territorioController.findById
);

router.put(
  '/:id',
  requirePermission(PERMISSIONS.TERRITORIOS_MANAGE),
  territorioController.updateTerritorio
);

router.patch(
  '/:id/status',
  requirePermission(PERMISSIONS.TERRITORIOS_MANAGE),
  territorioController.updateTerritorioStatus
);

router.get(
  '/:id/aliases',
  requirePermission(PERMISSIONS.TERRITORIOS_VIEW),
  territorioController.listAliases
);

router.post(
  '/:id/aliases',
  requirePermission(PERMISSIONS.TERRITORIOS_ALIAS_MANAGE),
  territorioController.createAlias
);

module.exports = router;
