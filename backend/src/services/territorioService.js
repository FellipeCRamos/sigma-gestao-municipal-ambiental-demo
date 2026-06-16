const shared = require('./territorio/shared');
const territorioCatalogService = require('./territorio/territorioCatalogService');
const territorioAliasService = require('./territorio/territorioAliasService');
const territorioMetricsService = require('./territorio/territorioMetricsService');
const territorioReviewService = require('./territorio/territorioReviewService');

module.exports = {
  ...territorioCatalogService,
  ...territorioAliasService,
  ...territorioMetricsService,
  ...territorioReviewService,
  findById: shared.findById,
  findByName: shared.findByName,
  enrichTerritorioPayload: shared.enrichTerritorioPayload,
  normalizeTerritorioName: shared.normalizeTerritorioName,
  ORIGEM_CATALOGO: shared.ORIGEM_CATALOGO,
  ORIGEM_LEGADO: shared.ORIGEM_LEGADO,
  ORIGEM_NAO_INFORMADO: shared.ORIGEM_NAO_INFORMADO,
};
