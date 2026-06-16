const campanhaReadService = require('./campanha/campanhaReadService');
const campanhaInscricaoService = require('./campanha/campanhaInscricaoService');
const campanhaDocumentoService = require('./campanha/campanhaDocumentoService');
const campanhaNotificacaoService = require('./campanha/campanhaNotificacaoService');

module.exports = {
  ...campanhaReadService,
  ...campanhaInscricaoService,
  ...campanhaDocumentoService,
  ...campanhaNotificacaoService,
};
