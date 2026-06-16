const express = require('express');
const router = express.Router();

const comunicacaoController = require('../controllers/comunicacaoController');
const requirePermission = require('../middlewares/requirePermission');
const { PERMISSIONS } = require('../config/permissions');

router.get('/resumo', requirePermission(PERMISSIONS.COMUNICACAO_VIEW), comunicacaoController.getResumo);
router.get('/entregas', requirePermission(PERMISSIONS.COMUNICACAO_VIEW), comunicacaoController.listEntregas);
router.get('/eventos', requirePermission(PERMISSIONS.COMUNICACAO_VIEW), comunicacaoController.getEventos);

module.exports = router;
