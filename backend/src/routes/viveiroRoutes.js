const express = require('express');
const router = express.Router();

const viveiroController = require('../modules/viveiro/viveiroController');
const requirePermission = require('../middlewares/requirePermission');
const { PERMISSIONS } = require('../config/permissions');

router.get(
  '/dashboard',
  requirePermission(PERMISSIONS.VIVEIRO_DASHBOARD_VIEW),
  viveiroController.getDashboard
);

router.get(
  '/especies',
  requirePermission(PERMISSIONS.VIVEIRO_ESPECIES_VIEW),
  viveiroController.listEspecies
);

router.post(
  '/especies',
  requirePermission(PERMISSIONS.VIVEIRO_ESPECIES_MANAGE),
  viveiroController.createEspecie
);

router.put(
  '/especies/:id',
  requirePermission(PERMISSIONS.VIVEIRO_ESPECIES_MANAGE),
  viveiroController.updateEspecie
);

router.get(
  '/lotes',
  requirePermission(PERMISSIONS.VIVEIRO_LOTES_VIEW),
  viveiroController.listLotes
);

router.post(
  '/lotes',
  requirePermission(PERMISSIONS.VIVEIRO_LOTES_MANAGE),
  viveiroController.createLote
);

router.put(
  '/lotes/:id',
  requirePermission(PERMISSIONS.VIVEIRO_LOTES_MANAGE),
  viveiroController.updateLote
);

router.get(
  '/estoque',
  requirePermission(PERMISSIONS.VIVEIRO_ESTOQUE_VIEW),
  viveiroController.getEstoqueConsolidado
);

router.get(
  '/movimentacoes',
  requirePermission(PERMISSIONS.VIVEIRO_MOVIMENTACOES_VIEW),
  viveiroController.listMovimentacoes
);

router.post(
  '/movimentacoes',
  requirePermission(PERMISSIONS.VIVEIRO_MOVIMENTACOES_MANAGE),
  viveiroController.createMovimentacaoAjuste
);

router.get(
  '/solicitacoes',
  requirePermission(PERMISSIONS.VIVEIRO_SOLICITACOES_VIEW),
  viveiroController.listSolicitacoes
);

router.get(
  '/solicitacoes/:id',
  requirePermission(PERMISSIONS.VIVEIRO_SOLICITACOES_VIEW),
  viveiroController.getSolicitacaoDetalhe
);

router.post(
  '/solicitacoes',
  requirePermission(PERMISSIONS.VIVEIRO_SOLICITACOES_CREATE),
  viveiroController.createSolicitacao
);

router.patch(
  '/solicitacoes/:id/analise',
  requirePermission(PERMISSIONS.VIVEIRO_SOLICITACOES_ANALISE),
  viveiroController.analisarSolicitacao
);

router.get(
  '/entregas',
  requirePermission(PERMISSIONS.VIVEIRO_ENTREGAS_VIEW),
  viveiroController.listEntregas
);

router.get(
  '/entregas/:id/comprovante',
  requirePermission(PERMISSIONS.VIVEIRO_ENTREGAS_VIEW),
  viveiroController.getComprovanteEntrega
);

router.post(
  '/entregas',
  requirePermission(PERMISSIONS.VIVEIRO_ENTREGAS_REGISTER),
  viveiroController.registrarEntrega
);

router.patch(
  '/entregas/:id/cancelamento',
  requirePermission(PERMISSIONS.VIVEIRO_ENTREGAS_CANCEL),
  viveiroController.cancelarEntrega
);

module.exports = router;
