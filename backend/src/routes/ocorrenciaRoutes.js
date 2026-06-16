const express = require('express');
const router = express.Router();

const ocorrenciaController = require('../controllers/ocorrenciaController');
const authUsuarioExterno = require('../middlewares/authUsuarioExterno');
const authUsuarioInterno = require('../middlewares/authUsuarioInterno');
const requirePermission = require('../middlewares/requirePermission');
const { PERMISSIONS } = require('../config/permissions');

router.get('/', authUsuarioInterno, requirePermission(PERMISSIONS.OCORRENCIAS_VIEW), ocorrenciaController.findAll);
router.post('/', authUsuarioInterno, requirePermission(PERMISSIONS.OCORRENCIAS_CREATE), ocorrenciaController.createByInterno);
router.get('/minhas', authUsuarioExterno, ocorrenciaController.findMinhas);
router.post('/minhas', authUsuarioExterno, ocorrenciaController.createByTutor);
router.patch('/:id/status', authUsuarioInterno, requirePermission(PERMISSIONS.OCORRENCIAS_UPDATE_STATUS), ocorrenciaController.updateStatus);

module.exports = router;
