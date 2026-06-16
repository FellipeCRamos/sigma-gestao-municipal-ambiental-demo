const express = require('express');

const service = require('./portalRequerente.service');
const authUsuarioInterno = require('../../middlewares/authUsuarioInterno');
const authUsuarioExterno = require('../../middlewares/authUsuarioExterno');
const requirePermission = require('../../middlewares/requirePermission');
const { PERMISSIONS } = require('../../config/permissions');
const { isPortalRequerenteEnabled } = require('../../config/env');
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

function portalEnabled(req, res, next) {
  if (!isPortalRequerenteEnabled()) {
    return res.status(503).json({
      success: false,
      error: 'Portal do Requerente indisponivel para acesso externo neste ambiente de homologacao assistida.',
    });
  }
  return next();
}

const external = [portalEnabled, authUsuarioExterno];

router.get(
  '/admin/dashboard/resumo',
  authUsuarioInterno,
  requirePermission(PERMISSIONS.PORTAL_REQUERENTE_ADMIN_DASHBOARD),
  asyncHandler('portal_requerente.admin.dashboard.error', 'Erro ao carregar dashboard do portal.', async (req, res) => {
    res.status(200).json({ success: true, data: await service.getDashboardResumo() });
  })
);

router.get(
  '/admin/requerentes',
  authUsuarioInterno,
  requirePermission(PERMISSIONS.PORTAL_REQUERENTE_ADMIN_VISUALIZAR),
  asyncHandler('portal_requerente.admin.requerente.list.error', 'Erro ao listar requerentes.', async (req, res) => {
    res.status(200).json({ success: true, data: await service.listRequerentes(req.query || {}) });
  })
);

router.post(
  '/admin/requerentes',
  authUsuarioInterno,
  requirePermission(PERMISSIONS.PORTAL_REQUERENTE_ADMIN_CRIAR_REQUERENTE),
  asyncHandler('portal_requerente.admin.requerente.create.error', 'Erro ao criar requerente.', async (req, res) => {
    res.status(201).json({ success: true, data: await service.createRequerente(req.body || {}, req.usuarioInterno, req) });
  })
);

router.get(
  '/admin/requerentes/:id',
  authUsuarioInterno,
  requirePermission(PERMISSIONS.PORTAL_REQUERENTE_ADMIN_VISUALIZAR),
  asyncHandler('portal_requerente.admin.requerente.detail.error', 'Erro ao carregar requerente.', async (req, res) => {
    const data = await service.getRequerente(req.params.id);
    if (!data) return res.status(404).json({ success: false, error: 'Requerente nao encontrado.' });
    return res.status(200).json({ success: true, data });
  })
);

router.patch(
  '/admin/requerentes/:id',
  authUsuarioInterno,
  requirePermission(PERMISSIONS.PORTAL_REQUERENTE_ADMIN_EDITAR_REQUERENTE),
  asyncHandler('portal_requerente.admin.requerente.update.error', 'Erro ao atualizar requerente.', async (req, res) => {
    const data = await service.updateRequerente(req.params.id, req.body || {}, req.usuarioInterno, req);
    if (!data) return res.status(404).json({ success: false, error: 'Requerente nao encontrado.' });
    return res.status(200).json({ success: true, data });
  })
);

router.get(
  '/admin/pre-protocolos',
  authUsuarioInterno,
  requirePermission(PERMISSIONS.PORTAL_REQUERENTE_ADMIN_VISUALIZAR),
  asyncHandler('portal_requerente.admin.pre_protocolo.list.error', 'Erro ao listar pre-protocolos.', async (req, res) => {
    res.status(200).json({ success: true, data: await service.listPreProtocolos(req.query || {}) });
  })
);

router.get(
  '/admin/pre-protocolos/:id',
  authUsuarioInterno,
  requirePermission(PERMISSIONS.PORTAL_REQUERENTE_ADMIN_VISUALIZAR),
  asyncHandler('portal_requerente.admin.pre_protocolo.detail.error', 'Erro ao carregar pre-protocolo.', async (req, res) => {
    const data = await service.getPreProtocoloAdmin(req.params.id);
    if (!data) return res.status(404).json({ success: false, error: 'Pre-protocolo nao encontrado.' });
    return res.status(200).json({ success: true, data });
  })
);

router.post(
  '/admin/pre-protocolos/:id/triar',
  authUsuarioInterno,
  requirePermission(PERMISSIONS.PORTAL_REQUERENTE_ADMIN_TRIAR),
  asyncHandler('portal_requerente.admin.pre_protocolo.triar.error', 'Erro ao triar pre-protocolo.', async (req, res) => {
    const data = await service.triarPreProtocolo(req.params.id, req.body || {}, req.usuarioInterno, req);
    if (!data) return res.status(404).json({ success: false, error: 'Pre-protocolo nao encontrado.' });
    return res.status(200).json({ success: true, data });
  })
);

router.post(
  '/admin/pre-protocolos/:id/devolver',
  authUsuarioInterno,
  requirePermission(PERMISSIONS.PORTAL_REQUERENTE_ADMIN_DEVOLVER),
  asyncHandler('portal_requerente.admin.pre_protocolo.devolver.error', 'Erro ao devolver pre-protocolo.', async (req, res) => {
    const data = await service.devolverPreProtocolo(req.params.id, req.body || {}, req.usuarioInterno, req);
    if (!data) return res.status(404).json({ success: false, error: 'Pre-protocolo nao encontrado.' });
    return res.status(200).json({ success: true, data });
  })
);

router.post(
  '/admin/pre-protocolos/:id/aceitar',
  authUsuarioInterno,
  requirePermission(PERMISSIONS.PORTAL_REQUERENTE_ADMIN_ACEITAR),
  asyncHandler('portal_requerente.admin.pre_protocolo.aceitar.error', 'Erro ao aceitar pre-protocolo.', async (req, res) => {
    const data = await service.aceitarPreProtocolo(req.params.id, req.body || {}, req.usuarioInterno, req);
    if (!data) return res.status(404).json({ success: false, error: 'Pre-protocolo nao encontrado.' });
    return res.status(200).json({ success: true, data });
  })
);

router.post(
  '/admin/pre-protocolos/:id/recusar',
  authUsuarioInterno,
  requirePermission(PERMISSIONS.PORTAL_REQUERENTE_ADMIN_RECUSAR),
  asyncHandler('portal_requerente.admin.pre_protocolo.recusar.error', 'Erro ao recusar pre-protocolo.', async (req, res) => {
    const data = await service.recusarPreProtocolo(req.params.id, req.body || {}, req.usuarioInterno, req);
    if (!data) return res.status(404).json({ success: false, error: 'Pre-protocolo nao encontrado.' });
    return res.status(200).json({ success: true, data });
  })
);

router.get(
  '/me',
  external,
  asyncHandler('portal_requerente.me.error', 'Erro ao carregar dados do requerente.', async (req, res) => {
    res.status(200).json({ success: true, data: await service.getMe(req.usuarioExterno, req) });
  })
);

router.get(
  '/me/termos',
  external,
  asyncHandler('portal_requerente.me.termos.error', 'Erro ao carregar termos.', async (req, res) => {
    res.status(200).json({ success: true, data: await service.getTermos(req.usuarioExterno, req) });
  })
);

router.post(
  '/me/termos/aceitar',
  external,
  asyncHandler('portal_requerente.me.termos.aceitar.error', 'Erro ao registrar aceite de termos.', async (req, res) => {
    res.status(201).json({ success: true, data: await service.aceitarTermos(req.usuarioExterno, req.body || {}, req) });
  })
);

router.get(
  '/me/requerimentos',
  external,
  asyncHandler('portal_requerente.me.requerimento.list.error', 'Erro ao listar requerimentos.', async (req, res) => {
    res.status(200).json({ success: true, data: await service.listMeuRequerimentos(req.usuarioExterno, req.query || {}, req) });
  })
);

router.post(
  '/me/requerimentos',
  external,
  asyncHandler('portal_requerente.me.requerimento.create.error', 'Erro ao criar requerimento.', async (req, res) => {
    res.status(201).json({ success: true, data: await service.createMeuRequerimento(req.usuarioExterno, req.body || {}, req) });
  })
);

router.get(
  '/me/requerimentos/:id',
  external,
  asyncHandler('portal_requerente.me.requerimento.detail.error', 'Erro ao carregar requerimento.', async (req, res) => {
    res.status(200).json({ success: true, data: await service.getMeuRequerimento(req.usuarioExterno, req.params.id, req) });
  })
);

router.patch(
  '/me/requerimentos/:id',
  external,
  asyncHandler('portal_requerente.me.requerimento.update.error', 'Erro ao atualizar requerimento.', async (req, res) => {
    res.status(200).json({ success: true, data: await service.updateMeuRequerimento(req.usuarioExterno, req.params.id, req.body || {}, req) });
  })
);

router.post(
  '/me/requerimentos/:id/enviar',
  external,
  asyncHandler('portal_requerente.me.requerimento.enviar.error', 'Erro ao enviar requerimento.', async (req, res) => {
    res.status(200).json({ success: true, data: await service.enviarMeuRequerimento(req.usuarioExterno, req.params.id, req) });
  })
);

router.post(
  '/me/requerimentos/:id/documentos',
  external,
  asyncHandler('portal_requerente.me.documento.create.error', 'Erro ao anexar documento.', async (req, res) => {
    res.status(201).json({ success: true, data: await service.addDocumentoMeuRequerimento(req.usuarioExterno, req.params.id, req.body || {}, req) });
  })
);

router.get(
  '/me/requerimentos/:id/documentos',
  external,
  asyncHandler('portal_requerente.me.documento.list.error', 'Erro ao listar documentos.', async (req, res) => {
    res.status(200).json({ success: true, data: await service.listMeusDocumentos(req.usuarioExterno, req.params.id, req) });
  })
);

router.get(
  '/me/requerimentos/:id/pendencias',
  external,
  asyncHandler('portal_requerente.me.pendencia.list.error', 'Erro ao listar pendencias.', async (req, res) => {
    res.status(200).json({ success: true, data: await service.listMinhasPendencias(req.usuarioExterno, req.params.id, req) });
  })
);

router.post(
  '/me/requerimentos/:id/pendencias/:pendenciaId/responder',
  external,
  asyncHandler('portal_requerente.me.pendencia.responder.error', 'Erro ao responder pendencia.', async (req, res) => {
    res.status(201).json({
      success: true,
      data: await service.responderPendencia(req.usuarioExterno, req.params.id, req.params.pendenciaId, req.body || {}, req),
    });
  })
);

router.get(
  '/me/requerimentos/:id/historico',
  external,
  asyncHandler('portal_requerente.me.historico.error', 'Erro ao carregar historico.', async (req, res) => {
    res.status(200).json({ success: true, data: await service.getMeuHistorico(req.usuarioExterno, req.params.id, req) });
  })
);

module.exports = router;
