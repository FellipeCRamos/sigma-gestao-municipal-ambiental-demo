const express = require('express');
const router = express.Router();

const operacaoController = require('../controllers/operacaoController');
const requirePermission = require('../middlewares/requirePermission');
const { PERMISSIONS } = require('../config/permissions');

router.get('/fila', requirePermission(PERMISSIONS.OPERACAO_FILA_VIEW), operacaoController.getFilaOperacional);
router.get('/resumo', requirePermission(PERMISSIONS.OPERACAO_DASHBOARD_VIEW), operacaoController.getResumoOperacional);
router.get('/responsaveis', requirePermission(PERMISSIONS.OPERACAO_FILA_VIEW), operacaoController.listResponsaveis);
router.get('/notificacoes', requirePermission(PERMISSIONS.OPERACAO_NOTIFICACOES_VIEW), operacaoController.getMinhasNotificacoes);
router.get('/itens/:tipo/:id/historico', requirePermission(PERMISSIONS.OPERACAO_HISTORICO_VIEW), operacaoController.getHistorico);
router.patch('/itens/:tipo/:id/responsavel', requirePermission(PERMISSIONS.OPERACAO_RESPONSAVEL_ASSIGN), operacaoController.assignResponsavel);
router.patch('/itens/:tipo/:id/prazo', requirePermission(PERMISSIONS.OPERACAO_PRAZO_UPDATE), operacaoController.updatePrazo);
router.post('/itens/:tipo/:id/observacoes', requirePermission(PERMISSIONS.OPERACAO_OBSERVACAO_CREATE), operacaoController.createObservacao);

module.exports = router;
