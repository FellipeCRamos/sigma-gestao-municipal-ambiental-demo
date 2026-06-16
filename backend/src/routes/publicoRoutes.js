const express = require('express');
const router = express.Router();

const publicoController = require('../controllers/publicoController');
const demandasPublicasController = require('../modules/demandasPublicas/demandasPublicas.controller');
const licenciamentoController = require('../modules/licenciamento/licenciamento.controller');
const educacaoAmbientalController = require('../modules/educacao-ambiental/educacaoAmbiental.controller');
const viveiroPublicController = require('../modules/viveiro/viveiroPublicController');
const { publicReadRateLimit, publicWriteRateLimit } = require('../middlewares/rateLimit');

router.get('/indicadores', publicReadRateLimit, publicoController.getIndicadores);
router.get('/governanca', publicReadRateLimit, publicoController.getGovernanca);
router.get('/termo-uso', publicReadRateLimit, publicoController.getTermoUso);
router.get('/politica-privacidade', publicReadRateLimit, publicoController.getPoliticaPrivacidade);
router.get('/territorios', publicReadRateLimit, publicoController.getTerritorios);
router.get('/animais/:publicId', publicReadRateLimit, publicoController.getAnimal);
router.post('/demandas', publicWriteRateLimit, demandasPublicasController.createPublicDemand);
router.get('/licenciamento/atividades', publicReadRateLimit, licenciamentoController.listPublicAtividades);
router.get('/licenciamento/normas', publicReadRateLimit, licenciamentoController.listPublicNormas);
router.get('/licenciamento/legislacao', publicReadRateLimit, licenciamentoController.listPublicLegislacaoLicenciamento);
router.get('/licenciamento/avisos-normativos', publicReadRateLimit, licenciamentoController.listPublicAvisosNormativosLicenciamento);
router.get('/licenciamento/legislacao/:codigo', publicReadRateLimit, licenciamentoController.getPublicLegislacaoLicenciamento);
router.get('/educacao-ambiental/home', publicReadRateLimit, educacaoAmbientalController.getPublicHome);
router.get('/educacao-ambiental/conteudos', publicReadRateLimit, educacaoAmbientalController.listPublicConteudos);
router.get('/educacao-ambiental/conteudos/:slug', publicReadRateLimit, educacaoAmbientalController.getPublicConteudoBySlug);
router.get('/educacao-ambiental/normas', publicReadRateLimit, educacaoAmbientalController.listPublicNormas);
router.get('/educacao-ambiental/agenda', publicReadRateLimit, educacaoAmbientalController.listPublicAgenda);
router.get('/educacao-ambiental/materiais', publicReadRateLimit, educacaoAmbientalController.listPublicMateriais);
router.get('/educacao-ambiental/trilhas', publicReadRateLimit, educacaoAmbientalController.listPublicTrilhas);
router.get('/educacao-ambiental/trilhas/:id', publicReadRateLimit, educacaoAmbientalController.getPublicTrilha);
router.get('/educacao-ambiental/especies', publicReadRateLimit, educacaoAmbientalController.listPublicEspecies);
router.get('/educacao-ambiental/areas', publicReadRateLimit, educacaoAmbientalController.listPublicAreas);
router.get('/educacao-ambiental/programas', publicReadRateLimit, educacaoAmbientalController.listPublicProgramas);
router.get('/educacao-ambiental/faq', publicReadRateLimit, educacaoAmbientalController.listPublicFaq);
router.get('/viveiro/status', publicReadRateLimit, viveiroPublicController.getPublicStatus);
router.get('/viveiro/especies', publicReadRateLimit, viveiroPublicController.listPublicEspecies);
router.post('/viveiro/solicitacoes', publicWriteRateLimit, viveiroPublicController.createPublicSolicitacao);
router.post(
  '/licenciamento/assistente/analises',
  publicWriteRateLimit,
  licenciamentoController.createPublicAssistenteAnalise
);
router.post(
  '/licenciamento/simular-enquadramento',
  publicWriteRateLimit,
  licenciamentoController.simulatePublicEnquadramento
);
router.get(
  '/licenciamento/simulacoes/:protocolo',
  publicReadRateLimit,
  licenciamentoController.getPublicSimulacao
);

module.exports = router;
