const express = require('express');
const router = express.Router();

const animalController = require('../controllers/animalController');
const animalVacinaController = require('../controllers/animalVacinaController');
const validateAnimal = require('../middlewares/validateAnimal');
const requirePermission = require('../middlewares/requirePermission');
const { PERMISSIONS } = require('../config/permissions');

router.post('/', requirePermission(PERMISSIONS.ANIMAIS_CREATE), validateAnimal, animalController.create);
router.get('/', requirePermission(PERMISSIONS.ANIMAIS_VIEW), animalController.findAll);
router.get('/vacinas/catalogo', requirePermission(PERMISSIONS.ANIMAIS_VIEW), animalVacinaController.findCatalogo);
router.get('/:id/eventos', requirePermission(PERMISSIONS.ANIMAIS_VIEW), animalController.findTimeline);
router.post('/:id/eventos', requirePermission(PERMISSIONS.ANIMAIS_EVENT_CREATE), animalController.createTimelineEvent);
router.get('/:id/vacinacoes', requirePermission(PERMISSIONS.ANIMAIS_VIEW), animalVacinaController.findCarteiraByAnimal);
router.post('/:id/vacinacoes', requirePermission(PERMISSIONS.ANIMAIS_VACINACOES_MANAGE), animalVacinaController.create);
router.put('/:id/vacinacoes/:vacinacaoId', requirePermission(PERMISSIONS.ANIMAIS_VACINACOES_MANAGE), animalVacinaController.update);
router.delete('/:id/vacinacoes/:vacinacaoId', requirePermission(PERMISSIONS.ANIMAIS_VACINACOES_MANAGE), animalVacinaController.cancel);
router.get('/:id', requirePermission(PERMISSIONS.ANIMAIS_VIEW), animalController.findById);
router.put('/:id', requirePermission(PERMISSIONS.ANIMAIS_UPDATE), validateAnimal, animalController.update);
router.delete('/:id', requirePermission(PERMISSIONS.ANIMAIS_DELETE), animalController.remove);

module.exports = router;
