const express = require('express');
const router = express.Router();

const integracaoController = require('../controllers/integracaoController');
const authUsuarioInterno = require('../middlewares/authUsuarioInterno');
const requirePermission = require('../middlewares/requirePermission');
const { integrationRateLimit } = require('../middlewares/rateLimit');
const { PERMISSIONS } = require('../config/permissions');

router.get('/parceiros', authUsuarioInterno, requirePermission(PERMISSIONS.INTEGRACOES_VIEW), integracaoController.findParceiros);
router.post(
  '/parceiros',
  authUsuarioInterno,
  requirePermission(PERMISSIONS.INTEGRACOES_CREATE),
  integracaoController.createParceiro
);
router.patch(
  '/parceiros/:id/revogar',
  authUsuarioInterno,
  requirePermission(PERMISSIONS.INTEGRACOES_REVOKE),
  integracaoController.revokeParceiro
);
router.post(
  '/parceiros/:id/rotacionar',
  authUsuarioInterno,
  requirePermission(PERMISSIONS.INTEGRACOES_ROTATE),
  integracaoController.rotateParceiro
);

router.get('/v1/indicadores', integrationRateLimit, integracaoController.getIndicadores);
router.get('/v1/animais/:publicId', integrationRateLimit, integracaoController.getAnimal);

module.exports = router;
