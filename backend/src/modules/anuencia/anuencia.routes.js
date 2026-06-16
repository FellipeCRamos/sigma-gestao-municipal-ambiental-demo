const express = require('express');

const service = require('./anuencia.service');
const requirePermission = require('../../middlewares/requirePermission');
const { PERMISSIONS } = require('../../config/permissions');
const { logControllerError } = require('../../utils/controllerLogger');

const router = express.Router();

function sendError(req, res, error, event, fallback) {
  logControllerError(req, event, error);
  return res.status(error.statusCode || 500).json({
    success: false,
    error: error.statusCode ? error.message : fallback,
    details: error.details || undefined,
  });
}

function asyncHandler(event, fallback, handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      sendError(req, res, error, event, fallback);
    }
  };
}

router.get(
  '/dashboard/resumo',
  requirePermission(PERMISSIONS.ANUENCIA_DASHBOARD),
  asyncHandler('anuencia.dashboard.error', 'Erro ao carregar dashboard de anuencias.', async (req, res) => {
    const data = await service.getDashboardResumo();
    res.status(200).json({ success: true, data });
  })
);

router.get(
  '/',
  requirePermission(PERMISSIONS.ANUENCIA_VISUALIZAR),
  asyncHandler('anuencia.list.error', 'Erro ao listar anuencias.', async (req, res) => {
    const data = await service.listAnuencias(req.query || {});
    res.status(200).json({ success: true, data });
  })
);

router.post(
  '/',
  requirePermission(PERMISSIONS.ANUENCIA_CRIAR),
  asyncHandler('anuencia.create.error', 'Erro ao criar anuencia.', async (req, res) => {
    const data = await service.createAnuencia(req.body || {}, req.usuarioInterno, req);
    res.status(201).json({ success: true, data });
  })
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.ANUENCIA_VISUALIZAR),
  asyncHandler('anuencia.detail.error', 'Erro ao carregar anuencia.', async (req, res) => {
    const data = await service.getAnuencia(req.params.id);
    if (!data) return res.status(404).json({ success: false, error: 'Anuencia nao encontrada.' });
    return res.status(200).json({ success: true, data });
  })
);

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.ANUENCIA_EDITAR),
  asyncHandler('anuencia.update.error', 'Erro ao atualizar anuencia.', async (req, res) => {
    const data = await service.updateAnuencia(req.params.id, req.body || {}, req.usuarioInterno, req);
    if (!data) return res.status(404).json({ success: false, error: 'Anuencia nao encontrada.' });
    return res.status(200).json({ success: true, data });
  })
);

router.post(
  '/:id/interessados',
  requirePermission(PERMISSIONS.ANUENCIA_EDITAR),
  asyncHandler('anuencia.interessado.create.error', 'Erro ao registrar interessado.', async (req, res) => {
    const data = await service.addInteressado(req.params.id, req.body || {}, req.usuarioInterno, req);
    if (!data) return res.status(404).json({ success: false, error: 'Anuencia nao encontrada.' });
    return res.status(201).json({ success: true, data });
  })
);

router.get(
  '/:id/interessados',
  requirePermission(PERMISSIONS.ANUENCIA_VISUALIZAR),
  asyncHandler('anuencia.interessado.list.error', 'Erro ao listar interessados.', async (req, res) => {
    res.status(200).json({ success: true, data: await service.listInteressados(req.params.id) });
  })
);

router.post(
  '/:id/documentos',
  requirePermission(PERMISSIONS.ANUENCIA_EDITAR),
  asyncHandler('anuencia.documento.create.error', 'Erro ao registrar documento.', async (req, res) => {
    res.status(201).json({ success: true, data: await service.addDocumento(req.params.id, req.body || {}, req.usuarioInterno, req) });
  })
);

router.get(
  '/:id/documentos',
  requirePermission(PERMISSIONS.ANUENCIA_VISUALIZAR),
  asyncHandler('anuencia.documento.list.error', 'Erro ao listar documentos.', async (req, res) => {
    res.status(200).json({ success: true, data: await service.listDocumentos(req.params.id) });
  })
);

router.patch(
  '/:id/documentos/:documentoId/conferencia',
  requirePermission(PERMISSIONS.ANUENCIA_TRIAR),
  asyncHandler('anuencia.documento.conferencia.error', 'Erro ao conferir documento.', async (req, res) => {
    const data = await service.conferirDocumento(req.params.id, req.params.documentoId, req.body || {}, req.usuarioInterno, req);
    if (!data) return res.status(404).json({ success: false, error: 'Documento nao encontrado.' });
    return res.status(200).json({ success: true, data });
  })
);

router.post(
  '/:id/analises',
  requirePermission(PERMISSIONS.ANUENCIA_ANALISAR),
  asyncHandler('anuencia.analise.create.error', 'Erro ao registrar analise.', async (req, res) => {
    res.status(201).json({ success: true, data: await service.addAnalise(req.params.id, req.body || {}, req.usuarioInterno, req) });
  })
);

router.get(
  '/:id/analises',
  requirePermission(PERMISSIONS.ANUENCIA_VISUALIZAR),
  asyncHandler('anuencia.analise.list.error', 'Erro ao listar analises.', async (req, res) => {
    res.status(200).json({ success: true, data: await service.listAnalises(req.params.id) });
  })
);

router.post(
  '/:id/pendencias',
  requirePermission(PERMISSIONS.ANUENCIA_PENDENCIAR),
  asyncHandler('anuencia.pendencia.create.error', 'Erro ao registrar pendencia.', async (req, res) => {
    res.status(201).json({ success: true, data: await service.addPendencia(req.params.id, req.body || {}, req.usuarioInterno, req) });
  })
);

router.patch(
  '/:id/pendencias/:pendenciaId',
  requirePermission(PERMISSIONS.ANUENCIA_PENDENCIAR),
  asyncHandler('anuencia.pendencia.update.error', 'Erro ao atualizar pendencia.', async (req, res) => {
    const data = await service.updatePendencia(req.params.id, req.params.pendenciaId, req.body || {}, req.usuarioInterno, req);
    if (!data) return res.status(404).json({ success: false, error: 'Pendencia nao encontrada.' });
    return res.status(200).json({ success: true, data });
  })
);

router.post(
  '/:id/condicionantes',
  requirePermission(PERMISSIONS.ANUENCIA_CONDICIONANTES),
  asyncHandler('anuencia.condicionante.create.error', 'Erro ao registrar condicionante.', async (req, res) => {
    res.status(201).json({ success: true, data: await service.addCondicionante(req.params.id, req.body || {}, req.usuarioInterno, req) });
  })
);

router.get(
  '/:id/condicionantes',
  requirePermission(PERMISSIONS.ANUENCIA_VISUALIZAR),
  asyncHandler('anuencia.condicionante.list.error', 'Erro ao listar condicionantes.', async (req, res) => {
    res.status(200).json({ success: true, data: await service.listCondicionantes(req.params.id) });
  })
);

router.post(
  '/:id/decisao',
  requirePermission(PERMISSIONS.ANUENCIA_DECIDIR),
  asyncHandler('anuencia.decisao.create.error', 'Erro ao registrar decisao.', async (req, res) => {
    res.status(201).json({ success: true, data: await service.addDecisao(req.params.id, req.body || {}, req.usuarioInterno, req) });
  })
);

router.post(
  '/:id/emissao',
  requirePermission(PERMISSIONS.ANUENCIA_EMITIR),
  asyncHandler('anuencia.emissao.create.error', 'Erro ao emitir anuencia.', async (req, res) => {
    res.status(201).json({ success: true, data: await service.emitir(req.params.id, req.body || {}, req.usuarioInterno, req) });
  })
);

router.get(
  '/:id/historico',
  requirePermission(PERMISSIONS.ANUENCIA_VISUALIZAR),
  asyncHandler('anuencia.historico.error', 'Erro ao carregar historico.', async (req, res) => {
    res.status(200).json({ success: true, data: await service.getHistorico(req.params.id) });
  })
);

module.exports = router;
