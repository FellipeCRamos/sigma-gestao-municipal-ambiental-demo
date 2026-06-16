const express = require('express');

const licenciamentoController = require('./licenciamento.controller');
const requirePermission = require('../../middlewares/requirePermission');
const { PERMISSIONS } = require('../../config/permissions');

const router = express.Router();

router.get(
  '/resumo',
  requirePermission(PERMISSIONS.LICENCIAMENTO_DASHBOARD_VIEW),
  licenciamentoController.getResumo
);

router.get(
  '/processos',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PROCESSOS_VIEW),
  licenciamentoController.listProcessos
);

router.post(
  '/processos',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PROCESSOS_CREATE),
  licenciamentoController.createProcesso
);

router.get(
  '/processos/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PROCESSOS_VIEW),
  licenciamentoController.getProcesso
);

router.put(
  '/processos/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PROCESSOS_UPDATE),
  licenciamentoController.updateProcesso
);

router.get(
  '/processos/:id/historico',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PROCESSOS_VIEW),
  licenciamentoController.getHistorico
);

router.get(
  '/parametrizacao/status',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW),
  licenciamentoController.getParametrizacaoStatus
);

router.get(
  '/parametrizacao/fase2d1/status',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW),
  licenciamentoController.getParametrizacaoFase2D1Status
);

router.get(
  '/parametrizacao/fase2d2/status',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW),
  licenciamentoController.getParametrizacaoFase2D2Status
);

router.get(
  '/parametrizacao/fase2d21/status',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW),
  licenciamentoController.getParametrizacaoFase2D21Status
);

router.get(
  '/parametrizacao/fase2d3/mapa-decreto/status',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW),
  licenciamentoController.getParametrizacaoFase2D3MapaDecretoStatus
);

router.get(
  '/parametrizacao/fase2d4a/grupo19/conferencia/status',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW),
  licenciamentoController.getParametrizacaoFase2D4AGrupo19ConferenciaStatus
);

router.get(
  '/parametrizacao/fase2d4b/grupo19/status',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW),
  licenciamentoController.getParametrizacaoFase2D4BGrupo19Status
);

router.get(
  '/parametrizacao/fase2d5a/mapa-decreto/status',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW),
  licenciamentoController.getParametrizacaoFase2D5AMapaPosGrupo19Status
);

router.get(
  '/parametrizacao/fase2d5b/complementacao-grupos/status',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW),
  licenciamentoController.getParametrizacaoFase2D5BComplementacaoGruposStatus
);

router.get(
  '/parametrizacao/fase2d5c/grupo21/status',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW),
  licenciamentoController.getParametrizacaoFase2D5CGrupo21ConferenciaStatus
);

router.get(
  '/parametrizacao/fase2d5c1/grupo21/conferencia-visual',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW),
  licenciamentoController.getParametrizacaoFase2D5C1Grupo21ConferenciaVisualStatus
);

router.get(
  '/parametrizacao/fase2d5c2/grupo21/bancada',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_VIEW),
  licenciamentoController.getParametrizacaoFase2D5C2Grupo21Bancada
);

router.get(
  '/parametrizacao/fase2d5c2/grupo21/bancada/:codigo',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_VIEW),
  licenciamentoController.getParametrizacaoFase2D5C2Grupo21BancadaCodigo
);

router.patch(
  '/parametrizacao/fase2d5c2/grupo21/bancada/:codigo',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_UPDATE),
  licenciamentoController.patchParametrizacaoFase2D5C2Grupo21BancadaCodigo
);

router.post(
  '/parametrizacao/fase2d5c2/grupo21/bancada/:codigo/validar',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_VALIDATE),
  licenciamentoController.validarParametrizacaoFase2D5C2Grupo21BancadaCodigo
);

router.get(
  '/parametrizacao/fase2d5c2/grupo21/bancada/:codigo/historico',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_AUDIT),
  licenciamentoController.getParametrizacaoFase2D5C2Grupo21BancadaCodigoHistorico
);

router.get(
  '/parametrizacao/fase2d5c2a/grupo21/previa-seed',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_VIEW),
  licenciamentoController.getParametrizacaoFase2D5C2AGrupo21PreviaSeed
);

router.get(
  '/parametrizacao/fase2d5c2b/grupo21/modelo-json',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_IMPORT_VIEW),
  licenciamentoController.getParametrizacaoFase2D5C2BGrupo21ModeloJson
);

router.post(
  '/parametrizacao/fase2d5c2b/grupo21/validar-importacao',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_IMPORT_VALIDATE),
  licenciamentoController.validarParametrizacaoFase2D5C2BGrupo21Importacao
);

router.post(
  '/parametrizacao/fase2d5c2b/grupo21/aplicar-importacao',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_IMPORT_APPLY),
  licenciamentoController.aplicarParametrizacaoFase2D5C2BGrupo21Importacao
);

router.get(
  '/parametrizacao/fase2d5c2b/grupo21/importacoes/historico',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_IMPORT_VIEW),
  licenciamentoController.getParametrizacaoFase2D5C2BGrupo21HistoricoImportacoes
);

router.get(
  '/parametrizacao/fase2d5c2c/grupo21/preparacao-matriz-real',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_VIEW),
  licenciamentoController.getParametrizacaoFase2D5C2CGrupo21PreparacaoMatrizReal
);

router.get(
  '/parametrizacao/fase2d5c2c/grupo21/modelo-oficial-real',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_IMPORT_VIEW),
  licenciamentoController.getParametrizacaoFase2D5C2CGrupo21ModeloOficialReal
);

router.post(
  '/parametrizacao/fase2d5c2c/grupo21/limpar-rascunhos-homologacao',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_CLEANUP),
  licenciamentoController.limparParametrizacaoFase2D5C2CGrupo21RascunhosHomologacao
);

router.get(
  '/parametrizacao/fase2d5c3a/grupo21/conferencia-complementar',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_VIEW),
  licenciamentoController.getParametrizacaoFase2D5C3AGrupo21ConferenciaComplementar
);

router.post(
  '/parametrizacao/fase2d5c3a/grupo21/aplicar-complementacao',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_UPDATE),
  licenciamentoController.aplicarParametrizacaoFase2D5C3AGrupo21Complementacao
);

router.get(
  '/parametrizacao/fase2d5c3b/grupo21/bloqueio-normativo',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_VIEW),
  licenciamentoController.getParametrizacaoFase2D5C3BGrupo21BloqueioNormativo
);

router.post(
  '/parametrizacao/fase2d5c3b/grupo21/registrar-bloqueio',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_BLOCK),
  licenciamentoController.registrarParametrizacaoFase2D5C3BGrupo21Bloqueio
);

router.get(
  '/parametrizacao/fase2d5c4/grupo21/revisao-normativa',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_VIEW),
  licenciamentoController.getParametrizacaoFase2D5C4Grupo21RevisaoNormativa
);

router.get(
  '/parametrizacao/fase2d5c4/grupo21/previa-seed',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_VIEW),
  licenciamentoController.getParametrizacaoFase2D5C4Grupo21PreviaSeed
);

router.get(
  '/parametrizacao/fase2d5c5/grupo21/previa-seed-controlado',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_VIEW),
  licenciamentoController.getParametrizacaoFase2D5C5Grupo21PreviaSeedControlado
);

router.post(
  '/parametrizacao/fase2d5c5/grupo21/aplicar-seed-controlado',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETRIZACAO_CONFERENCIA_IMPORT_APPLY),
  licenciamentoController.aplicarParametrizacaoFase2D5C5Grupo21SeedControlado
);

router.get(
  '/assistente/analises',
  requirePermission(PERMISSIONS.LICENCIAMENTO_ASSISTENTE_VIEW),
  licenciamentoController.listAssistenteAnalises
);

router.get(
  '/assistente/analises/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_ASSISTENTE_VIEW),
  licenciamentoController.getAssistenteAnalise
);

router.patch(
  '/assistente/analises/:id/status',
  requirePermission(PERMISSIONS.LICENCIAMENTO_ASSISTENTE_VALIDATE),
  licenciamentoController.updateAssistenteAnaliseStatus
);

router.patch(
  '/assistente/analises/:id/validacao',
  requirePermission(PERMISSIONS.LICENCIAMENTO_ASSISTENTE_VALIDATE),
  licenciamentoController.validarAssistenteAnalise
);

router.get(
  '/assistente/analises/:id/historico',
  requirePermission(PERMISSIONS.LICENCIAMENTO_ASSISTENTE_VIEW),
  licenciamentoController.listAssistenteAnaliseHistorico
);

router.post(
  '/assistente/analises/:id/converter-pre-requerimento',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PRE_REQUERIMENTO_CONVERT),
  licenciamentoController.converterAssistenteAnalisePreRequerimento
);

router.get(
  '/pre-requerimentos',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PRE_REQUERIMENTO_VIEW),
  licenciamentoController.listPreRequerimentos
);

router.get(
  '/pre-requerimentos/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PRE_REQUERIMENTO_VIEW),
  licenciamentoController.getPreRequerimento
);

router.patch(
  '/pre-requerimentos/:id/status',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PRE_REQUERIMENTO_UPDATE),
  licenciamentoController.updatePreRequerimentoStatus
);

router.patch(
  '/pre-requerimentos/:id/minuta-despacho',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PRE_REQUERIMENTO_UPDATE),
  licenciamentoController.updatePreRequerimentoMinuta
);

router.patch(
  '/pre-requerimentos/:id/documentos',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PRE_REQUERIMENTO_UPDATE),
  licenciamentoController.updatePreRequerimentoDocumento
);

router.get(
  '/pre-requerimentos/:id/historico',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PRE_REQUERIMENTO_VIEW),
  licenciamentoController.listPreRequerimentoHistorico
);

router.get(
  '/governanca-normativa/status',
  requirePermission(PERMISSIONS.LICENCIAMENTO_GOVERNANCA_NORMATIVA_VIEW),
  licenciamentoController.getGovernancaNormativaStatus
);

router.get(
  '/governanca-normativa/normas',
  requirePermission(PERMISSIONS.LICENCIAMENTO_GOVERNANCA_NORMATIVA_VIEW),
  licenciamentoController.listGovernancaNormas
);

router.get(
  '/governanca-normativa/divergencias',
  requirePermission(PERMISSIONS.LICENCIAMENTO_DIVERGENCIAS_NORMATIVAS_VIEW),
  licenciamentoController.listGovernancaDivergencias
);

router.get(
  '/governanca-normativa/tabelas-taxas',
  requirePermission(PERMISSIONS.LICENCIAMENTO_GOVERNANCA_NORMATIVA_VIEW),
  licenciamentoController.listGovernancaTabelasTaxas
);

router.get(
  '/governanca-normativa/matrizes',
  requirePermission(PERMISSIONS.LICENCIAMENTO_GOVERNANCA_NORMATIVA_VIEW),
  licenciamentoController.listGovernancaMatrizes
);

router.get(
  '/governanca-normativa/homologacao',
  requirePermission(PERMISSIONS.LICENCIAMENTO_HOMOLOGACAO_VIEW),
  licenciamentoController.listGovernancaHomologacao
);

router.put(
  '/governanca-normativa/homologacao/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_HOMOLOGACAO_MANAGE),
  licenciamentoController.updateGovernancaHomologacao
);

router.post(
  '/governanca-normativa/homologacao/diagnostico',
  requirePermission(PERMISSIONS.LICENCIAMENTO_HOMOLOGACAO_DIAGNOSTICO_RUN),
  licenciamentoController.runGovernancaHomologacaoDiagnostico
);

router.get(
  '/governanca-normativa/homologacao/relatorio',
  requirePermission(PERMISSIONS.LICENCIAMENTO_HOMOLOGACAO_RELATORIO_VIEW),
  licenciamentoController.getGovernancaHomologacaoRelatorio
);

router.get(
  '/homologacao-assistida/status',
  requirePermission(PERMISSIONS.LICENCIAMENTO_HOMOLOGACAO_ASSISTIDA_VIEW),
  licenciamentoController.getGovernancaNormativaStatus
);

router.get(
  '/homologacao-assistida/checklist',
  requirePermission(PERMISSIONS.LICENCIAMENTO_HOMOLOGACAO_ASSISTIDA_VIEW),
  licenciamentoController.listGovernancaHomologacao
);

router.put(
  '/homologacao-assistida/checklist/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_HOMOLOGACAO_ASSISTIDA_MANAGE),
  licenciamentoController.updateGovernancaHomologacao
);

router.post(
  '/homologacao-assistida/diagnostico',
  requirePermission(PERMISSIONS.LICENCIAMENTO_HOMOLOGACAO_DIAGNOSTICO_RUN),
  licenciamentoController.runGovernancaHomologacaoDiagnostico
);

router.get(
  '/homologacao-assistida/relatorio',
  requirePermission(PERMISSIONS.LICENCIAMENTO_HOMOLOGACAO_RELATORIO_VIEW),
  licenciamentoController.getGovernancaHomologacaoRelatorio
);

router.get(
  '/homologacao-fechamento/status',
  requirePermission(PERMISSIONS.LICENCIAMENTO_HOMOLOGACAO_FECHAMENTO_VIEW),
  licenciamentoController.getHomologacaoFechamentoStatus
);

router.get(
  '/homologacao-fechamento/pendencias',
  requirePermission(PERMISSIONS.LICENCIAMENTO_HOMOLOGACAO_FECHAMENTO_VIEW),
  licenciamentoController.listHomologacaoFechamentoPendencias
);

router.get(
  '/homologacao-fechamento/roteiro',
  requirePermission(PERMISSIONS.LICENCIAMENTO_HOMOLOGACAO_FECHAMENTO_VIEW),
  licenciamentoController.getHomologacaoFechamentoRoteiro
);

router.put(
  '/homologacao-fechamento/checklist/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_HOMOLOGACAO_FECHAMENTO_MANAGE),
  licenciamentoController.updateHomologacaoFechamentoChecklist
);

router.post(
  '/homologacao-fechamento/diagnostico',
  requirePermission(PERMISSIONS.LICENCIAMENTO_HOMOLOGACAO_DIAGNOSTICO_RUN),
  licenciamentoController.runHomologacaoFechamentoDiagnostico
);

router.get(
  '/homologacao-fechamento/relatorio',
  requirePermission(PERMISSIONS.LICENCIAMENTO_HOMOLOGACAO_RELATORIO_VIEW),
  licenciamentoController.getHomologacaoFechamentoRelatorio
);

router.post(
  '/homologacao-fechamento/registrar-liberacao-fase2d',
  requirePermission(PERMISSIONS.LICENCIAMENTO_HOMOLOGACAO_FECHAMENTO_LIBERAR_FASE2D),
  licenciamentoController.registrarHomologacaoFechamentoLiberacaoFase2D
);

router.get(
  '/checklist-assistido/status',
  requirePermission(PERMISSIONS.LICENCIAMENTO_CHECKLIST_ASSISTIDO_VIEW),
  licenciamentoController.getChecklistAssistidoStatus
);

router.get(
  '/checklist-assistido/itens',
  requirePermission(PERMISSIONS.LICENCIAMENTO_CHECKLIST_ASSISTIDO_VIEW),
  licenciamentoController.listChecklistAssistidoItens
);

router.get(
  '/checklist-assistido/itens/pendentes',
  requirePermission(PERMISSIONS.LICENCIAMENTO_CHECKLIST_ASSISTIDO_VIEW),
  licenciamentoController.listChecklistAssistidoPendencias
);

router.get(
  '/checklist-assistido/itens/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_CHECKLIST_ASSISTIDO_VIEW),
  licenciamentoController.getChecklistAssistidoItem
);

router.get(
  '/checklist-assistido/itens/:id/sugestao',
  requirePermission(PERMISSIONS.LICENCIAMENTO_CHECKLIST_ASSISTIDO_VIEW),
  licenciamentoController.getChecklistAssistidoSugestao
);

router.put(
  '/checklist-assistido/itens/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_CHECKLIST_ASSISTIDO_MANAGE),
  licenciamentoController.updateChecklistAssistidoItem
);

router.post(
  '/checklist-assistido/diagnostico',
  requirePermission(PERMISSIONS.LICENCIAMENTO_CHECKLIST_ASSISTIDO_DIAGNOSTICO),
  licenciamentoController.runChecklistAssistidoDiagnostico
);

router.post(
  '/checklist-assistido/aplicar-observacao-sugerida/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_CHECKLIST_ASSISTIDO_MANAGE),
  licenciamentoController.applyChecklistAssistidoSugestao
);

router.get(
  '/checklist-assistido/relatorio-pendencias',
  requirePermission(PERMISSIONS.LICENCIAMENTO_CHECKLIST_ASSISTIDO_RELATORIO),
  licenciamentoController.getChecklistAssistidoRelatorioPendencias
);

router.post(
  '/governanca-normativa/seed-fase2c',
  requirePermission(PERMISSIONS.LICENCIAMENTO_GOVERNANCA_NORMATIVA_MANAGE),
  licenciamentoController.runGovernancaSeedFase2C
);

router.get(
  '/atividades',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW),
  licenciamentoController.listAtividades
);

router.post(
  '/atividades',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_MANAGE),
  licenciamentoController.createAtividade
);

router.get(
  '/atividades/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW),
  licenciamentoController.getAtividade
);

router.put(
  '/atividades/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_MANAGE),
  licenciamentoController.updateAtividade
);

router.delete(
  '/atividades/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_MANAGE),
  licenciamentoController.deleteAtividade
);

router.get(
  '/tipos-licenca',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW),
  licenciamentoController.listTiposLicenca
);

router.post(
  '/tipos-licenca',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_MANAGE),
  licenciamentoController.createTipoLicenca
);

router.put(
  '/tipos-licenca/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_MANAGE),
  licenciamentoController.updateTipoLicenca
);

router.delete(
  '/tipos-licenca/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_MANAGE),
  licenciamentoController.deleteTipoLicenca
);

router.get(
  '/potenciais-poluidor',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW),
  licenciamentoController.listPotenciaisPoluidor
);

router.post(
  '/potenciais-poluidor',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_MANAGE),
  licenciamentoController.createPotencialPoluidor
);

router.put(
  '/potenciais-poluidor/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_MANAGE),
  licenciamentoController.updatePotencialPoluidor
);

router.delete(
  '/potenciais-poluidor/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_MANAGE),
  licenciamentoController.deletePotencialPoluidor
);

router.get(
  '/classes',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW),
  licenciamentoController.listClasses
);

router.post(
  '/classes',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_MANAGE),
  licenciamentoController.createClasse
);

router.put(
  '/classes/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_MANAGE),
  licenciamentoController.updateClasse
);

router.delete(
  '/classes/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_MANAGE),
  licenciamentoController.deleteClasse
);

router.get(
  '/regras-enquadramento',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW),
  licenciamentoController.listRegrasEnquadramento
);

router.post(
  '/regras-enquadramento',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_MANAGE),
  licenciamentoController.createRegraEnquadramento
);

router.get(
  '/regras-enquadramento/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW),
  licenciamentoController.getRegraEnquadramento
);

router.put(
  '/regras-enquadramento/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_MANAGE),
  licenciamentoController.updateRegraEnquadramento
);

router.delete(
  '/regras-enquadramento/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_MANAGE),
  licenciamentoController.deleteRegraEnquadramento
);

router.get(
  '/regra-parametros',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW),
  licenciamentoController.listRegraParametros
);

router.post(
  '/regra-parametros',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_MANAGE),
  licenciamentoController.createRegraParametro
);

router.put(
  '/regra-parametros/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_MANAGE),
  licenciamentoController.updateRegraParametro
);

router.delete(
  '/regra-parametros/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_MANAGE),
  licenciamentoController.deleteRegraParametro
);

router.get(
  '/documentos-exigidos',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW),
  licenciamentoController.listDocumentosExigidos
);

router.post(
  '/documentos-exigidos',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_MANAGE),
  licenciamentoController.createDocumentoExigido
);

router.put(
  '/documentos-exigidos/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_MANAGE),
  licenciamentoController.updateDocumentoExigido
);

router.delete(
  '/documentos-exigidos/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_MANAGE),
  licenciamentoController.deleteDocumentoExigido
);

router.get(
  '/regras-taxas',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW),
  licenciamentoController.listRegrasTaxas
);

router.post(
  '/regras-taxas',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_MANAGE),
  licenciamentoController.createRegraTaxa
);

router.put(
  '/regras-taxas/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_MANAGE),
  licenciamentoController.updateRegraTaxa
);

router.delete(
  '/regras-taxas/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_MANAGE),
  licenciamentoController.deleteRegraTaxa
);

router.get(
  '/vrte',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_VIEW),
  licenciamentoController.listVrte
);

router.post(
  '/vrte',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_MANAGE),
  licenciamentoController.createVrte
);

router.put(
  '/vrte/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_MANAGE),
  licenciamentoController.updateVrte
);

router.delete(
  '/vrte/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_PARAMETROS_MANAGE),
  licenciamentoController.deleteVrte
);

router.get(
  '/normas',
  requirePermission(PERMISSIONS.LICENCIAMENTO_NORMAS_VIEW),
  licenciamentoController.listNormas
);

router.post(
  '/normas',
  requirePermission(PERMISSIONS.LICENCIAMENTO_NORMAS_MANAGE),
  licenciamentoController.createNorma
);

router.get(
  '/normas/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_NORMAS_VIEW),
  licenciamentoController.getNorma
);

router.put(
  '/normas/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_NORMAS_MANAGE),
  licenciamentoController.updateNorma
);

router.delete(
  '/normas/:id',
  requirePermission(PERMISSIONS.LICENCIAMENTO_NORMAS_MANAGE),
  licenciamentoController.deleteNorma
);

router.post(
  '/normas/:id/vinculos',
  requirePermission(PERMISSIONS.LICENCIAMENTO_NORMAS_MANAGE),
  licenciamentoController.createNormaVinculo
);

router.delete(
  '/normas-vinculos/:vinculoId',
  requirePermission(PERMISSIONS.LICENCIAMENTO_NORMAS_MANAGE),
  licenciamentoController.deleteNormaVinculo
);

router.get(
  '/simulacoes',
  requirePermission(PERMISSIONS.LICENCIAMENTO_SIMULACOES_VIEW),
  licenciamentoController.listSimulacoes
);

module.exports = router;
