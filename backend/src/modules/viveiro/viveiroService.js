const viveiroCatalogService = require('./viveiroCatalogService');
const viveiroSolicitacaoService = require('./viveiroSolicitacaoService');
const viveiroEntregaService = require('./viveiroEntregaService');
const viveiroDashboardService = require('./viveiroDashboardService');

module.exports = {
  ...viveiroCatalogService,
  ...viveiroSolicitacaoService,
  ...viveiroEntregaService,
  ...viveiroDashboardService,
};
