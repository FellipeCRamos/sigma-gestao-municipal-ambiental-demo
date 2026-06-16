const queryService = require('./animalVacina/animalVacinaQueryService');
const mutationService = require('./animalVacina/animalVacinaMutationService');
const campanhaService = require('./animalVacina/animalVacinaCampanhaService');
const legacyService = require('./animalVacina/animalVacinaLegacyService');

module.exports = {
  ...queryService,
  ...mutationService,
  ...campanhaService,
  ...legacyService,
};
