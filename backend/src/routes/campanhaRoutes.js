const express = require('express');
const router = express.Router();

const campanhaController = require('../controllers/campanhaController');
const authUsuarioExterno = require('../middlewares/authUsuarioExterno');
const authUsuarioInterno = require('../middlewares/authUsuarioInterno');
const requirePermission = require('../middlewares/requirePermission');
const uploadCampanhaDocumento = require('../middlewares/uploadCampanhaDocumento');
const { PERMISSIONS } = require('../config/permissions');

router.get('/', campanhaController.findAll);
router.get('/agenda', authUsuarioInterno, requirePermission(PERMISSIONS.CAMPANHAS_VIEW), campanhaController.findAgenda);
router.get('/relatorios/inscricoes.csv', authUsuarioInterno, requirePermission(PERMISSIONS.CAMPANHAS_EXPORT), campanhaController.exportInscricoesCsv);
router.get('/notificacoes', authUsuarioExterno, campanhaController.findMinhasNotificacoes);
router.patch('/notificacoes/:id/lida', authUsuarioExterno, campanhaController.markNotificacaoLida);
router.get('/inscricoes', authUsuarioInterno, requirePermission(PERMISSIONS.CAMPANHAS_VIEW), campanhaController.findAllInscricoes);
router.get('/minhas-inscricoes', authUsuarioExterno, campanhaController.findMinhasInscricoes);
router.post('/inscricoes', authUsuarioExterno, campanhaController.createInscricao);
router.get('/inscricoes/:id/documentos', authUsuarioExterno, campanhaController.findMeusDocumentos);
router.post(
  '/inscricoes/:id/documentos',
  authUsuarioExterno,
  uploadCampanhaDocumento.single('documento'),
  campanhaController.uploadDocumento
);
router.patch(
  '/inscricoes/:id/status',
  authUsuarioInterno,
  requirePermission(PERMISSIONS.CAMPANHAS_STATUS_UPDATE),
  campanhaController.updateInscricaoStatus
);
router.get('/documentos/:id/download', authUsuarioExterno, campanhaController.downloadMeuDocumento);
router.get('/admin/documentos/:id/download', authUsuarioInterno, requirePermission(PERMISSIONS.CAMPANHAS_DOWNLOAD_DOCUMENTS), campanhaController.downloadDocumentoInterno);

module.exports = router;
