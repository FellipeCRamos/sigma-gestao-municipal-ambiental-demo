const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const auditService = require('../../services/auditService');
const demandasRepository = require('../demandasPublicas/demandasPublicas.repository');
const vistoriasRepository = require('../vistorias/vistorias.repository');
const repository = require('./anexos.repository');
const {
  createValidationError,
  getExtension,
  normalizeInteger,
  validateRemovePayload,
  validateUploadMetadata,
} = require('./anexos.validation');

const STORAGE_ROOT = path.resolve(__dirname, '..', '..', '..', 'uploads', 'sigma-anexos');

function normalizeInternalUserId(user) {
  const id = Number(user?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function sanitizeAnexo(anexo, { includeHash = true } = {}) {
  if (!anexo) return null;

  const {
    caminho_armazenamento,
    ...safe
  } = anexo;

  if (!includeHash) {
    delete safe.hash_sha256;
  }

  return safe;
}

function buildStoredPath({ modulo_origem, extensao }) {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const directory = path.join(STORAGE_ROOT, modulo_origem, year, month);
  const fileName = `${Date.now()}-${crypto.randomUUID()}${extensao}`;
  const absolutePath = path.join(directory, fileName);

  if (!absolutePath.startsWith(STORAGE_ROOT)) {
    throw createValidationError('Caminho de armazenamento invalido.');
  }

  return { directory, fileName, absolutePath };
}

function writeFileSecurely(file, metadata) {
  if (!file?.buffer?.length) {
    throw createValidationError('Envie um arquivo no campo arquivo.', { field: 'arquivo' });
  }

  const extensao = getExtension(file);
  const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');
  const stored = buildStoredPath({ modulo_origem: metadata.modulo_origem, extensao });

  fs.mkdirSync(stored.directory, { recursive: true });
  fs.writeFileSync(stored.absolutePath, file.buffer, { flag: 'wx' });

  return {
    nome_armazenado: stored.fileName,
    caminho_armazenamento: stored.absolutePath,
    extensao,
    hash_sha256: hash,
  };
}

async function getDemandForAttachment(demandId, client = repository.db) {
  const demand = await demandasRepository.getDemandById(demandId, client);

  if (!demand) {
    const error = new Error('Demanda publica nao encontrada para vinculo de anexo.');
    error.statusCode = 404;
    throw error;
  }

  return demand;
}

async function resolveEntity(metadata, client = repository.db) {
  if (metadata.modulo_origem === 'demandas_publicas' && metadata.entidade_tipo === 'demanda_publica') {
    const demand = await getDemandForAttachment(metadata.entidade_id, client);
    return {
      protocolo: demand.protocolo,
      entity: demand,
    };
  }

  if (metadata.modulo_origem === 'fiscalizacao' && metadata.entidade_tipo === 'vistoria_ambiental') {
    const vistoria = await vistoriasRepository.getVistoriaById(metadata.entidade_id, client);

    if (!vistoria) {
      const error = new Error('Vistoria ambiental nao encontrada para vinculo de anexo.');
      error.statusCode = 404;
      throw error;
    }

    return {
      protocolo: vistoria.protocolo_vistoria,
      entity: vistoria,
    };
  }

  if (metadata.modulo_origem === 'fiscalizacao' && metadata.entidade_tipo === 'relatorio_tecnico_preliminar') {
    const relatorio = await vistoriasRepository.getRelatorioById(metadata.entidade_id, client);

    if (!relatorio) {
      const error = new Error('Relatorio preliminar nao encontrado para vinculo de anexo.');
      error.statusCode = 404;
      throw error;
    }

    return {
      protocolo: relatorio.protocolo_relatorio,
      entity: relatorio,
    };
  }

  throw createValidationError('Vinculo de entidade ainda nao suportado nesta sprint.', {
    modulo_origem: metadata.modulo_origem,
    entidade_tipo: metadata.entidade_tipo,
  });
}

async function createAnexo(payload, file, user, req, defaults = {}) {
  const metadata = validateUploadMetadata(payload, defaults);
  const userId = normalizeInternalUserId(user);
  let stored = null;

  try {
    const result = await repository.db.connect().then(async (client) => {
      try {
        await client.query('BEGIN');
        const entity = await resolveEntity(metadata, client);
        stored = writeFileSecurely(file, metadata);

        const created = await repository.createAnexo(client, {
          ...metadata,
          protocolo: entity.protocolo,
          nome_original: file.originalname,
          mime_type: file.mimetype,
          tamanho_bytes: file.size,
          origem_upload: 'area_interna_sigma',
          enviado_por_tipo: 'usuario_interno',
          enviado_por_id: userId,
          ...stored,
        });

        await client.query('COMMIT');
        return created;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    });

    await auditService.log({
      ator_tipo: 'usuario_interno',
      ator_id: userId,
      acao: 'anexos.upload',
      entidade: 'sigma_anexos',
      entidade_id: result.id,
      dados: {
        protocolo: result.protocolo,
        modulo_origem: result.modulo_origem,
        entidade_tipo: result.entidade_tipo,
        entidade_id: result.entidade_id,
        mime_type: result.mime_type,
        extensao: result.extensao,
        tamanho_bytes: result.tamanho_bytes,
        hash_sha256: result.hash_sha256,
        sensivel: result.sensivel,
      },
      req,
    });

    return sanitizeAnexo(result);
  } catch (error) {
    if (stored?.caminho_armazenamento) {
      fs.rm(stored.caminho_armazenamento, { force: true }, () => {});
    }
    throw error;
  }
}

async function listAnexos(filters = {}) {
  const normalized = {
    modulo_origem: filters.modulo_origem || null,
    entidade_tipo: filters.entidade_tipo || null,
    entidade_id: filters.entidade_id ? normalizeInteger(filters.entidade_id, 'entidade_id') : null,
    protocolo: filters.protocolo || null,
  };
  const anexos = await repository.listAnexos(normalized);
  return anexos.map((anexo) => sanitizeAnexo(anexo));
}

async function listDemandAnexos(demandId) {
  await getDemandForAttachment(demandId);
  return listAnexos({
    modulo_origem: 'demandas_publicas',
    entidade_tipo: 'demanda_publica',
    entidade_id: demandId,
  });
}

async function getAnexo(id, filters = {}) {
  const anexoId = normalizeInteger(id, 'anexo_id');
  const anexo = filters.entidade_id
    ? await repository.getAnexoForEntity(anexoId, {
        modulo_origem: filters.modulo_origem,
        entidade_tipo: filters.entidade_tipo,
        entidade_id: normalizeInteger(filters.entidade_id, 'entidade_id'),
      })
    : await repository.getAnexoById(anexoId);

  return sanitizeAnexo(anexo);
}

async function getAnexoForDownload(id, user, req, filters = {}) {
  const anexoId = normalizeInteger(id, 'anexo_id');
  const anexo = filters.entidade_id
    ? await repository.getAnexoForEntity(anexoId, {
        modulo_origem: filters.modulo_origem,
        entidade_tipo: filters.entidade_tipo,
        entidade_id: normalizeInteger(filters.entidade_id, 'entidade_id'),
      })
    : await repository.getAnexoById(anexoId);

  if (!anexo) {
    return null;
  }

  await auditService.log({
    ator_tipo: 'usuario_interno',
    ator_id: normalizeInternalUserId(user),
    acao: anexo.sensivel ? 'anexos.download_sensitive' : 'anexos.download',
    entidade: 'sigma_anexos',
    entidade_id: anexo.id,
    dados: {
      protocolo: anexo.protocolo,
      modulo_origem: anexo.modulo_origem,
      entidade_tipo: anexo.entidade_tipo,
      entidade_id: anexo.entidade_id,
      mime_type: anexo.mime_type,
      tamanho_bytes: anexo.tamanho_bytes,
      sensivel: anexo.sensivel,
    },
    req,
  });

  return anexo;
}

async function removeAnexo(id, payload, user, req, filters = {}) {
  const anexoId = normalizeInteger(id, 'anexo_id');
  const normalized = validateRemovePayload(payload);
  const before = filters.entidade_id
    ? await repository.getAnexoForEntity(anexoId, {
        modulo_origem: filters.modulo_origem,
        entidade_tipo: filters.entidade_tipo,
        entidade_id: normalizeInteger(filters.entidade_id, 'entidade_id'),
      })
    : await repository.getAnexoById(anexoId);

  if (!before) {
    return null;
  }

  const userId = normalizeInternalUserId(user);
  const after = await repository.db.connect().then(async (client) => {
    try {
      await client.query('BEGIN');
      const removed = await repository.softRemoveAnexo(client, anexoId, {
        motivo_remocao: normalized.motivo_remocao,
        removido_por_id: userId,
      });
      await client.query('COMMIT');
      return removed;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  await auditService.logChange({
    ator_tipo: 'usuario_interno',
    ator_id: userId,
    acao: 'anexos.remove',
    entidade: 'sigma_anexos',
    entidade_id: anexoId,
    before: sanitizeAnexo(before),
    after: sanitizeAnexo(after),
    dados: {
      motivo_remocao: normalized.motivo_remocao,
    },
    req,
  });

  return sanitizeAnexo(after);
}

function fileExists(anexo) {
  return Boolean(anexo?.caminho_armazenamento && fs.existsSync(anexo.caminho_armazenamento));
}

module.exports = {
  STORAGE_ROOT,
  createAnexo,
  listAnexos,
  listDemandAnexos,
  getAnexo,
  getAnexoForDownload,
  removeAnexo,
  fileExists,
  sanitizeAnexo,
};
