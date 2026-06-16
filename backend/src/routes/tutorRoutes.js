const express = require('express');
const router = express.Router();

const tutorController = require('../controllers/tutorController');
const validateTutor = require('../middlewares/validateTutor');
const requirePermission = require('../middlewares/requirePermission');
const { PERMISSIONS } = require('../config/permissions');

router.post('/', requirePermission(PERMISSIONS.TUTORES_CREATE), validateTutor, tutorController.create);
router.get('/', requirePermission(PERMISSIONS.TUTORES_VIEW), tutorController.findAll);
router.get('/:id/animais', requirePermission(PERMISSIONS.TUTORES_VIEW), tutorController.findWithAnimalsById);
router.get('/:id', requirePermission(PERMISSIONS.TUTORES_VIEW), tutorController.findById);
router.put('/:id', requirePermission(PERMISSIONS.TUTORES_UPDATE), validateTutor, tutorController.update);
router.delete('/:id', requirePermission(PERMISSIONS.TUTORES_DELETE), tutorController.remove);

module.exports = router;
