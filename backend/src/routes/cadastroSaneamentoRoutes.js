const express = require('express');
const router = express.Router();

const cadastroSaneamentoController = require('../controllers/cadastroSaneamentoController');
const requirePermission = require('../middlewares/requirePermission');
const { PERMISSIONS } = require('../config/permissions');

router.get('/estatisticas', requirePermission(PERMISSIONS.QUALIDADE_VIEW), cadastroSaneamentoController.getStats);
router.get('/casos', requirePermission(PERMISSIONS.QUALIDADE_VIEW), cadastroSaneamentoController.listCases);
router.get('/casos/:id', requirePermission(PERMISSIONS.QUALIDADE_VIEW), cadastroSaneamentoController.findCaseById);
router.patch('/casos/:id/revisao', requirePermission(PERMISSIONS.QUALIDADE_REVIEW), cadastroSaneamentoController.reviewCase);
router.post('/casos/:id/merge/tutores', requirePermission(PERMISSIONS.QUALIDADE_MERGE), cadastroSaneamentoController.mergeTutor);

module.exports = router;
