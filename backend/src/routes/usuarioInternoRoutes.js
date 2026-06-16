const express = require('express');
const router = express.Router();

const usuarioInternoController = require('../controllers/usuarioInternoController');
const authUsuarioInterno = require('../middlewares/authUsuarioInterno');
const { loginRateLimit, passwordResetRateLimit } = require('../middlewares/rateLimit');

router.post('/login', loginRateLimit, usuarioInternoController.login);
router.post('/password-reset/request', passwordResetRateLimit, usuarioInternoController.requestPasswordReset);
router.post('/password-reset/confirm', passwordResetRateLimit, usuarioInternoController.resetPassword);
router.get('/me', authUsuarioInterno, usuarioInternoController.me);

module.exports = router;
