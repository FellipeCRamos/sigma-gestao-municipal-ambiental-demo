const express = require('express');
const router = express.Router();

const usuarioExternoController = require('../controllers/usuarioExternoController');
const animalVacinaController = require('../controllers/animalVacinaController');
const authUsuarioExterno = require('../middlewares/authUsuarioExterno');
const { loginRateLimit, passwordResetRateLimit } = require('../middlewares/rateLimit');

router.post('/register', usuarioExternoController.register);
router.post('/login', loginRateLimit, usuarioExternoController.login);
router.post('/password-reset/request', passwordResetRateLimit, usuarioExternoController.requestPasswordReset);
router.post('/password-reset/confirm', passwordResetRateLimit, usuarioExternoController.resetPassword);
router.get('/me', authUsuarioExterno, usuarioExternoController.me);
router.get('/me/mobile', authUsuarioExterno, usuarioExternoController.mobileResumo);
router.get('/me/mobile/documentos', authUsuarioExterno, usuarioExternoController.mobileDocumentos);
router.get('/me/mobile/notificacoes', authUsuarioExterno, usuarioExternoController.mobileNotificacoes);
router.patch('/me/mobile/notificacoes/lidas', authUsuarioExterno, usuarioExternoController.markTodasNotificacoesLidas);
router.get('/me/mobile/animais/:id/carteira', authUsuarioExterno, usuarioExternoController.mobileAnimalCarteiraDetalhada);
router.get('/me/mobile/animais/:id', authUsuarioExterno, usuarioExternoController.mobileAnimalDetalhe);
router.get('/me/mobile/inscricoes/:id', authUsuarioExterno, usuarioExternoController.mobileInscricaoDetalhe);
router.get('/me/mobile/ocorrencias/:id', authUsuarioExterno, usuarioExternoController.mobileOcorrenciaDetalhe);
router.get('/me/mobile/preferencias', authUsuarioExterno, usuarioExternoController.getMobilePreferencias);
router.put('/me/mobile/preferencias', authUsuarioExterno, usuarioExternoController.updateMobilePreferencias);
router.post('/me/mobile/web-push/subscriptions', authUsuarioExterno, usuarioExternoController.registerWebPushSubscription);
router.delete('/me/mobile/web-push/subscriptions', authUsuarioExterno, usuarioExternoController.revokeWebPushSubscription);
router.post('/me/mobile/web-push/teste', authUsuarioExterno, usuarioExternoController.sendWebPushTeste);
router.get('/me/animais/:id/vacinacoes', authUsuarioExterno, animalVacinaController.findMinhaCarteira);

module.exports = router;
