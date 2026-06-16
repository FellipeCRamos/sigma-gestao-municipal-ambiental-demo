const express = require('express');
const router = express.Router();

const dashboardController = require('../controllers/dashboardController');
const requirePermission = require('../middlewares/requirePermission');
const { PERMISSIONS } = require('../config/permissions');

router.get('/', requirePermission(PERMISSIONS.DASHBOARD_VIEW), dashboardController.getSummary);
router.get('/gerencial', requirePermission(PERMISSIONS.DASHBOARD_VIEW_RESTRICTED), dashboardController.getGerencialDashboard);
router.get('/vacinacao', requirePermission(PERMISSIONS.DASHBOARD_VIEW_RESTRICTED), dashboardController.getVacinacaoDashboard);
router.get('/qualidade-cadastral', requirePermission(PERMISSIONS.DASHBOARD_VIEW_RESTRICTED), dashboardController.getQualidadeCadastralDashboard);
router.get('/bi-territorial', requirePermission(PERMISSIONS.DASHBOARD_VIEW_RESTRICTED), dashboardController.getBiTerritorialDashboard);

module.exports = router;
