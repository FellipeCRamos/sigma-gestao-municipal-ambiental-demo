const express = require('express');

const geoambientalController = require('./geoambiental.controller');
const requirePermission = require('../../middlewares/requirePermission');
const { PERMISSIONS } = require('../../config/permissions');

const router = express.Router();

router.get(
  '/localizacoes',
  requirePermission(PERMISSIONS.GEOAMBIENTAL_VISUALIZAR),
  geoambientalController.listLocalizacoes
);

router.get(
  '/localizacoes/:id',
  requirePermission(PERMISSIONS.GEOAMBIENTAL_VISUALIZAR),
  geoambientalController.getLocalizacao
);

router.post(
  '/localizacoes',
  requirePermission(PERMISSIONS.GEOAMBIENTAL_CRIAR),
  geoambientalController.createLocalizacao
);

router.patch(
  '/localizacoes/:id',
  requirePermission(PERMISSIONS.GEOAMBIENTAL_EDITAR),
  geoambientalController.updateLocalizacao
);

router.post(
  '/localizacoes/:id/vinculos',
  requirePermission(PERMISSIONS.GEOAMBIENTAL_VINCULAR),
  geoambientalController.createVinculo
);

router.get(
  '/localizacoes/:id/vinculos',
  requirePermission(PERMISSIONS.GEOAMBIENTAL_VISUALIZAR),
  geoambientalController.listVinculos
);

router.get(
  '/camadas',
  requirePermission(PERMISSIONS.GEOAMBIENTAL_VISUALIZAR),
  geoambientalController.listCamadas
);

router.post(
  '/intersecoes/simular',
  requirePermission(PERMISSIONS.GEOAMBIENTAL_VISUALIZAR),
  geoambientalController.simularIntersecoes
);

module.exports = router;
