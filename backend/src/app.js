const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const dashboardRoutes = require('./routes/dashboardRoutes');
const animaisRoutes = require('./routes/animalRoutes');
const tutoresRoutes = require('./routes/tutorRoutes');
const campanhaRoutes = require('./routes/campanhaRoutes');
const ocorrenciaRoutes = require('./routes/ocorrenciaRoutes');
const publicoRoutes = require('./routes/publicoRoutes');
const integracaoRoutes = require('./routes/integracaoRoutes');
const usuarioExternoRoutes = require('./routes/usuarioExternoRoutes');
const usuarioInternoRoutes = require('./routes/usuarioInternoRoutes');
const cadastroSaneamentoRoutes = require('./routes/cadastroSaneamentoRoutes');
const operacaoRoutes = require('./routes/operacaoRoutes');
const territorioRoutes = require('./routes/territorioRoutes');
const viveiroRoutes = require('./routes/viveiroRoutes');
const licenciamentoRoutes = require('./routes/licenciamentoRoutes');
const demandasPublicasRoutes = require('./routes/demandasPublicasRoutes');
const comunicacaoRoutes = require('./routes/comunicacaoRoutes');
const anexosRoutes = require('./routes/anexosRoutes');
const protocolosRoutes = require('./routes/protocolosRoutes');
const fiscalizacaoRoutes = require('./routes/fiscalizacaoRoutes');
const vistoriasRoutes = require('./routes/vistoriasRoutes');
const relatoriosPreliminaresRoutes = require('./routes/relatoriosPreliminaresRoutes');
const educacaoAmbientalRoutes = require('./routes/educacaoAmbientalRoutes');
const geoRoutes = require('./routes/geoRoutes');
const anuenciaRoutes = require('./routes/anuenciaRoutes');
const portalRequerenteRoutes = require('./routes/portalRequerenteRoutes');
const authUsuarioInterno = require('./middlewares/authUsuarioInterno');
const requestContext = require('./middlewares/requestContext');
const requestLogger = require('./middlewares/requestLogger');
const healthService = require('./services/healthService');
const logger = require('./utils/logger');
const { CORS_ORIGINS, REQUEST_BODY_LIMIT, TRUST_PROXY, UPLOAD_MAX_BYTES } = require('./config/env');

const app = express();

if (TRUST_PROXY) {
  app.set('trust proxy', 1);
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || CORS_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      const error = new Error('Origem nao permitida pelo CORS.');
      error.statusCode = 403;
      return callback(error);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-sigba-api-key', 'x-request-id']
  })
);

app.use(helmet());
app.use(requestContext);
app.use(requestLogger);
app.use(express.json({ limit: REQUEST_BODY_LIMIT }));

app.get('/health', (req, res) => {
  return res.status(200).json(healthService.getHealth());
});

app.get('/ready', async (req, res) => {
  try {
    const result = await healthService.getReadiness();
    return res.status(200).json(result);
  } catch (error) {
    logger.error('api.readiness.error', {
      request_id: req.requestId,
      message: error.message,
      code: error.code
    });

    return res.status(503).json({
      success: false,
      status: 'not_ready',
      error: 'API indisponivel para producao no momento.'
    });
  }
});

app.use('/dashboard', authUsuarioInterno, dashboardRoutes);
app.use('/animais', authUsuarioInterno, animaisRoutes);
app.use('/tutores', authUsuarioInterno, tutoresRoutes);
app.use('/campanhas', campanhaRoutes);
app.use('/ocorrencias', ocorrenciaRoutes);
app.use('/publico', publicoRoutes);
app.use('/integracoes', integracaoRoutes);
app.use('/usuarios-externos', usuarioExternoRoutes);
app.use('/usuarios-internos', usuarioInternoRoutes);
app.use('/saneamento-cadastral', authUsuarioInterno, cadastroSaneamentoRoutes);
app.use('/operacao', authUsuarioInterno, operacaoRoutes);
app.use('/territorios', authUsuarioInterno, territorioRoutes);
app.use('/viveiro', authUsuarioInterno, viveiroRoutes);
app.use('/licenciamento', authUsuarioInterno, licenciamentoRoutes);
app.use('/demandas-publicas', authUsuarioInterno, demandasPublicasRoutes);
app.use('/comunicacao', authUsuarioInterno, comunicacaoRoutes);
app.use('/anexos', authUsuarioInterno, anexosRoutes);
app.use('/protocolos', authUsuarioInterno, protocolosRoutes);
app.use('/fiscalizacoes', authUsuarioInterno, fiscalizacaoRoutes);
app.use('/vistorias', authUsuarioInterno, vistoriasRoutes);
app.use('/relatorios-preliminares', authUsuarioInterno, relatoriosPreliminaresRoutes);
app.use('/educacao-ambiental', authUsuarioInterno, educacaoAmbientalRoutes);
app.use('/geo', authUsuarioInterno, geoRoutes);
app.use('/anuencias', authUsuarioInterno, anuenciaRoutes);
app.use('/portal-requerente', portalRequerenteRoutes);

app.use((err, req, res, next) => {
  if (err?.statusCode === 403 && err?.message === 'Origem nao permitida pelo CORS.') {
    return res.status(403).json({
      success: false,
      error: err.message
    });
  }

  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: `Arquivo acima do limite de ${Math.round(UPLOAD_MAX_BYTES / (1024 * 1024))}MB.`
    });
  }

  if (err?.message === 'Tipo de arquivo nao permitido.') {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }

  if (err?.message === 'Nome ou extensao de arquivo nao permitidos.') {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }

  logger.error('api.unhandled_error', {
    request_id: req.requestId,
    method: req.method,
    path: req.originalUrl,
    message: err?.message
  });

  return res.status(500).json({
    success: false,
    error: 'Erro interno da API.'
  });
});

module.exports = app;
