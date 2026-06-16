const syncService = require('./cadastroSaneamento/cadastroSaneamentoSyncService');
const caseService = require('./cadastroSaneamento/cadastroSaneamentoCaseService');
const mergeService = require('./cadastroSaneamento/cadastroSaneamentoMergeService');

module.exports = {
  ...caseService,
  ...mergeService,
  syncCases: syncService.syncCases,
};
