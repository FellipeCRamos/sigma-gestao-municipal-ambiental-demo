import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createGeoLocalizacao,
  createGeoVinculo,
  getGeoLocalizacao,
  listGeoCamadas,
  listGeoLocalizacoes,
  listGeoVinculos,
  simulateGeoIntersecoes,
  updateGeoLocalizacao,
} from '../api/geoambientalApi';
import GeoLocationField from '../components/GeoLocationField';
import { hasPermission, PERMISSIONS } from '../../utils/permissions';

const EMPTY_FORM = {
  titulo: '',
  descricao: '',
  tipo_geometria: 'PONTO',
  sistema_referencia: 'WGS84',
  zona_utm: '',
  coordenadas_texto: '',
  latitude: '',
  longitude: '',
  area_m2: '',
  perimetro_m: '',
  distrito: '',
  bairro_localidade: '',
  zona_urbana_rural: 'NAO_INFORMADA',
  observacoes_tecnicas: '',
  sensibilidade_lgpd: 'NAO_SENSIVEL',
  status: 'RASCUNHO',
};

const EMPTY_VINCULO = {
  modulo_origem: 'anuencia',
  entidade_origem_tipo: 'preparacao_sprint_4b',
  entidade_origem_id: '',
  processo_numero: '',
  protocolo_numero: '',
  finalidade_vinculo: 'Base geoambiental para analise interna.',
};

function displayLabel(value = '') {
  return String(value || '-').replace(/_/g, ' ');
}

function compactError(error) {
  return error?.message || 'Nao foi possivel concluir a operacao geoambiental.';
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}

function toForm(item) {
  return {
    ...EMPTY_FORM,
    ...Object.fromEntries(Object.entries(item || {}).map(([key, value]) => [key, value ?? ''])),
  };
}

export default function GeoambientalAdmin({ user }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [vinculos, setVinculos] = useState([]);
  const [camadas, setCamadas] = useState([]);
  const [intersecoes, setIntersecoes] = useState(null);
  const [filters, setFilters] = useState({ busca: '', status: '', tipo_geometria: '' });
  const [form, setForm] = useState(EMPTY_FORM);
  const [vinculoForm, setVinculoForm] = useState(EMPTY_VINCULO);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const canCreate = useMemo(() => hasPermission(user, PERMISSIONS.GEOAMBIENTAL_CRIAR), [user]);
  const canEdit = useMemo(() => hasPermission(user, PERMISSIONS.GEOAMBIENTAL_EDITAR), [user]);
  const canLink = useMemo(() => hasPermission(user, PERMISSIONS.GEOAMBIENTAL_VINCULAR), [user]);

  const loadData = useCallback(async (nextFilters = filters) => {
    setLoading(true);
    setError('');

    try {
      const [localizacoesResponse, camadasResponse] = await Promise.all([
        listGeoLocalizacoes(nextFilters),
        listGeoCamadas(),
      ]);
      setItems(Array.isArray(localizacoesResponse.data) ? localizacoesResponse.data : []);
      setCamadas(Array.isArray(camadasResponse.data) ? camadasResponse.data : []);
    } catch (err) {
      setError(compactError(err));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  async function openItem(item) {
    setError('');
    setMessage('');
    setIntersecoes(null);

    try {
      const detailResponse = await getGeoLocalizacao(item.id);
      const detail = detailResponse.data;
      const vinculosResponse = await listGeoVinculos(item.id);
      setSelected(detail);
      setForm(toForm(detail));
      setVinculos(Array.isArray(vinculosResponse.data) ? vinculosResponse.data : []);
    } catch (err) {
      setError(compactError(err));
    }
  }

  function startNew() {
    setSelected(null);
    setForm(EMPTY_FORM);
    setVinculos([]);
    setIntersecoes(null);
    setMessage('Novo registro geoambiental em rascunho.');
  }

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        ...form,
        latitude: form.latitude === '' ? null : form.latitude,
        longitude: form.longitude === '' ? null : form.longitude,
        area_m2: form.area_m2 === '' ? null : form.area_m2,
        perimetro_m: form.perimetro_m === '' ? null : form.perimetro_m,
      };
      const response = selected?.id
        ? await updateGeoLocalizacao(selected.id, payload)
        : await createGeoLocalizacao(payload);
      setSelected(response.data);
      setForm(toForm(response.data));
      setMessage(selected?.id ? 'Localizacao atualizada.' : 'Localizacao criada.');
      await loadData();
    } catch (err) {
      setError(compactError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateVinculo(event) {
    event.preventDefault();
    if (!selected?.id) return;

    setSaving(true);
    setError('');

    try {
      await createGeoVinculo(selected.id, {
        ...vinculoForm,
        entidade_origem_id: vinculoForm.entidade_origem_id || null,
      });
      const response = await listGeoVinculos(selected.id);
      setVinculos(Array.isArray(response.data) ? response.data : []);
      setVinculoForm(EMPTY_VINCULO);
      setMessage('Vinculo geoambiental criado.');
    } catch (err) {
      setError(compactError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleSimulate() {
    if (!selected?.id) return;

    setSaving(true);
    setError('');

    try {
      const response = await simulateGeoIntersecoes({
        geo_localizacao_id: selected.id,
        camadas: camadas.slice(0, 6).map((item) => item.codigo),
      });
      setIntersecoes(response.data);
      setMessage('Simulacao preliminar registrada para analise interna.');
    } catch (err) {
      setError(compactError(err));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div style={styles.page}>
      <section style={styles.section}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Nucleo geoambiental</h2>
            <p style={styles.subtitle}>
              Cadastro interno de localizacoes, geometrias e vinculos territoriais para apoio transversal aos modulos SIGMA.
            </p>
          </div>
          {canCreate ? (
            <button type="button" style={styles.primaryButton} onClick={startNew}>
              Nova localizacao
            </button>
          ) : null}
        </div>

        <form
          style={styles.filters}
          onSubmit={(event) => {
            event.preventDefault();
            loadData(filters);
          }}
        >
          <input
            style={styles.input}
            value={filters.busca}
            onChange={(event) => setFilters((prev) => ({ ...prev, busca: event.target.value }))}
            placeholder="Buscar por codigo ou titulo"
          />
          <select
            style={styles.input}
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
          >
            <option value="">Todos os status</option>
            <option value="RASCUNHO">Rascunho</option>
            <option value="EM_ANALISE">Em analise</option>
            <option value="VALIDADA">Validada</option>
            <option value="SUBSTITUIDA">Substituida</option>
            <option value="CANCELADA">Cancelada</option>
          </select>
          <select
            style={styles.input}
            value={filters.tipo_geometria}
            onChange={(event) => setFilters((prev) => ({ ...prev, tipo_geometria: event.target.value }))}
          >
            <option value="">Todas as geometrias</option>
            <option value="PONTO">Ponto</option>
            <option value="LINHA">Linha</option>
            <option value="POLIGONO">Poligono</option>
            <option value="MULTIPOLIGONO">Multipoligono</option>
          </select>
          <button type="submit" style={styles.secondaryButton}>Filtrar</button>
        </form>

        {error ? <div style={styles.alertError}>{error}</div> : null}
        {message ? <div style={styles.alertInfo}>{message}</div> : null}
      </section>

      <section style={styles.grid}>
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Localizacoes cadastradas</h3>
          {loading ? <p style={styles.subtitle}>Carregando localizacoes...</p> : null}
          <div style={styles.list}>
            {items.map((item) => (
              <button key={item.id} type="button" style={styles.listItem} onClick={() => openItem(item)}>
                <strong>{item.codigo}</strong>
                <span>{item.titulo}</span>
                <small>{displayLabel(item.tipo_geometria)} - {displayLabel(item.status)}</small>
              </button>
            ))}
            {!loading && items.length === 0 ? <p style={styles.subtitle}>Nenhuma localizacao encontrada.</p> : null}
          </div>
        </div>

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>{selected?.id ? 'Ficha tecnica' : 'Cadastro geoambiental'}</h3>
          <GeoLocationField value={selected} helperText="Resumo reutilizavel para formularios futuros, incluindo Anuencia Ambiental." />

          <form style={styles.form} onSubmit={handleSave}>
            <label style={styles.field}>
              <span style={styles.label}>Titulo</span>
              <input style={styles.input} value={form.titulo} onChange={(event) => updateForm('titulo', event.target.value)} required />
            </label>
            <label style={styles.field}>
              <span style={styles.label}>Descricao</span>
              <textarea style={styles.textarea} value={form.descricao} onChange={(event) => updateForm('descricao', event.target.value)} />
            </label>
            <div style={styles.twoCols}>
              <label style={styles.field}>
                <span style={styles.label}>Tipo de geometria</span>
                <select style={styles.input} value={form.tipo_geometria} onChange={(event) => updateForm('tipo_geometria', event.target.value)}>
                  <option value="PONTO">Ponto</option>
                  <option value="LINHA">Linha</option>
                  <option value="POLIGONO">Poligono</option>
                  <option value="MULTIPOLIGONO">Multipoligono</option>
                </select>
              </label>
              <label style={styles.field}>
                <span style={styles.label}>Sistema de referencia</span>
                <select style={styles.input} value={form.sistema_referencia} onChange={(event) => updateForm('sistema_referencia', event.target.value)}>
                  <option value="WGS84">WGS84</option>
                  <option value="SIRGAS_2000_UTM">SIRGAS 2000 UTM</option>
                  <option value="OUTRO">Outro</option>
                </select>
              </label>
            </div>
            <div style={styles.twoCols}>
              <label style={styles.field}>
                <span style={styles.label}>Latitude</span>
                <input style={styles.input} value={form.latitude} onChange={(event) => updateForm('latitude', event.target.value)} />
              </label>
              <label style={styles.field}>
                <span style={styles.label}>Longitude</span>
                <input style={styles.input} value={form.longitude} onChange={(event) => updateForm('longitude', event.target.value)} />
              </label>
            </div>
            <label style={styles.field}>
              <span style={styles.label}>Coordenadas / memorial descritivo</span>
              <textarea style={styles.textarea} value={form.coordenadas_texto} onChange={(event) => updateForm('coordenadas_texto', event.target.value)} />
            </label>
            <div style={styles.twoCols}>
              <label style={styles.field}>
                <span style={styles.label}>Distrito</span>
                <input style={styles.input} value={form.distrito} onChange={(event) => updateForm('distrito', event.target.value)} />
              </label>
              <label style={styles.field}>
                <span style={styles.label}>Bairro/localidade</span>
                <input style={styles.input} value={form.bairro_localidade} onChange={(event) => updateForm('bairro_localidade', event.target.value)} />
              </label>
            </div>
            <div style={styles.twoCols}>
              <label style={styles.field}>
                <span style={styles.label}>Status</span>
                <select style={styles.input} value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
                  <option value="RASCUNHO">Rascunho</option>
                  <option value="EM_ANALISE">Em analise</option>
                  <option value="VALIDADA">Validada</option>
                  <option value="SUBSTITUIDA">Substituida</option>
                  <option value="CANCELADA">Cancelada</option>
                </select>
              </label>
              <label style={styles.field}>
                <span style={styles.label}>Sensibilidade LGPD</span>
                <select style={styles.input} value={form.sensibilidade_lgpd} onChange={(event) => updateForm('sensibilidade_lgpd', event.target.value)}>
                  <option value="NAO_SENSIVEL">Nao sensivel</option>
                  <option value="POTENCIALMENTE_SENSIVEL">Potencialmente sensivel</option>
                  <option value="SENSIVEL">Sensivel</option>
                </select>
              </label>
            </div>
            <label style={styles.field}>
              <span style={styles.label}>Observacoes tecnicas</span>
              <textarea style={styles.textarea} value={form.observacoes_tecnicas} onChange={(event) => updateForm('observacoes_tecnicas', event.target.value)} />
            </label>
            <button type="submit" style={styles.primaryButton} disabled={saving || (!selected?.id && !canCreate) || (selected?.id && !canEdit)}>
              {selected?.id ? 'Salvar edicao' : 'Cadastrar'}
            </button>
          </form>
        </div>
      </section>

      {selected?.id ? (
        <section style={styles.grid}>
          <div style={styles.section}>
            <div style={styles.header}>
              <div>
                <h3 style={styles.sectionTitle}>Vinculos da localizacao</h3>
                <p style={styles.subtitle}>Vinculos internos com processos, protocolos ou entidades de modulos SIGMA.</p>
              </div>
            </div>
            <form style={styles.form} onSubmit={handleCreateVinculo}>
              <div style={styles.twoCols}>
                <input style={styles.input} value={vinculoForm.modulo_origem} onChange={(event) => setVinculoForm((prev) => ({ ...prev, modulo_origem: event.target.value }))} placeholder="Modulo" />
                <input style={styles.input} value={vinculoForm.entidade_origem_tipo} onChange={(event) => setVinculoForm((prev) => ({ ...prev, entidade_origem_tipo: event.target.value }))} placeholder="Tipo de entidade" />
              </div>
              <div style={styles.twoCols}>
                <input style={styles.input} value={vinculoForm.processo_numero} onChange={(event) => setVinculoForm((prev) => ({ ...prev, processo_numero: event.target.value }))} placeholder="Processo" />
                <input style={styles.input} value={vinculoForm.protocolo_numero} onChange={(event) => setVinculoForm((prev) => ({ ...prev, protocolo_numero: event.target.value }))} placeholder="Protocolo" />
              </div>
              <input style={styles.input} value={vinculoForm.finalidade_vinculo} onChange={(event) => setVinculoForm((prev) => ({ ...prev, finalidade_vinculo: event.target.value }))} placeholder="Finalidade" />
              <button type="submit" style={styles.secondaryButton} disabled={!canLink || saving}>Criar vinculo</button>
            </form>
            <div style={styles.list}>
              {vinculos.map((item) => (
                <div key={item.id} style={styles.vinculoItem}>
                  <strong>{displayLabel(item.modulo_origem)}</strong>
                  <span>{item.entidade_origem_tipo} - {item.protocolo_numero || item.processo_numero || `#${item.entidade_origem_id}`}</span>
                  <small>{item.finalidade_vinculo} - {formatDate(item.created_at)}</small>
                </div>
              ))}
              {vinculos.length === 0 ? <p style={styles.subtitle}>Nenhum vinculo cadastrado.</p> : null}
            </div>
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Intersecoes preliminares</h3>
            <p style={styles.subtitle}>
              Analise interna preliminar sem motor GIS real. O resultado nao emite ato administrativo e exige validacao tecnica.
            </p>
            <button type="button" style={styles.secondaryButton} onClick={handleSimulate} disabled={saving}>
              Simular intersecoes
            </button>
            {intersecoes ? (
              <div style={styles.list}>
                <div style={styles.alertInfo}>{intersecoes.aviso}</div>
                {(intersecoes.items || []).map((item) => (
                  <div key={item.id} style={styles.vinculoItem}>
                    <strong>{item.camada_nome || item.camada_codigo}</strong>
                    <span>{displayLabel(item.resultado)}</span>
                    <small>{item.observacao}</small>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

const styles = {
  page: { display: 'grid', gap: '24px' },
  grid: { display: 'grid', gridTemplateColumns: 'minmax(300px, 0.9fr) minmax(360px, 1.2fr)', gap: '24px', alignItems: 'start' },
  section: { background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '24px' },
  header: { display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '18px' },
  title: { margin: 0, marginBottom: '8px', fontSize: '24px', color: '#111827' },
  sectionTitle: { margin: '0 0 12px', fontSize: '18px', color: '#111827' },
  subtitle: { margin: 0, color: '#4b5563', fontSize: '14px', lineHeight: 1.5 },
  filters: { display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) 180px 180px auto', gap: '10px', alignItems: 'center' },
  form: { display: 'grid', gap: '12px', marginTop: '16px' },
  field: { display: 'grid', gap: '6px' },
  label: { color: '#374151', fontSize: '13px', fontWeight: 800 },
  input: { minHeight: '42px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0 12px', fontSize: '14px', background: '#ffffff', color: '#111827' },
  textarea: { minHeight: '84px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', background: '#ffffff', color: '#111827', resize: 'vertical' },
  twoCols: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  primaryButton: { minHeight: '42px', border: 'none', borderRadius: '8px', background: '#0f766e', color: '#ffffff', cursor: 'pointer', fontWeight: 800, padding: '0 16px' },
  secondaryButton: { minHeight: '42px', border: '1px solid #0f766e', borderRadius: '8px', background: '#ffffff', color: '#0f766e', cursor: 'pointer', fontWeight: 800, padding: '0 14px' },
  list: { display: 'grid', gap: '10px', marginTop: '12px' },
  listItem: { display: 'grid', gap: '4px', textAlign: 'left', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', color: '#0f172a', padding: '12px', cursor: 'pointer' },
  vinculoItem: { display: 'grid', gap: '4px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', color: '#0f172a', padding: '12px', fontSize: '13px' },
  alertError: { border: '1px solid #fecaca', borderRadius: '8px', background: '#fef2f2', color: '#b91c1c', padding: '12px', fontSize: '14px', marginTop: '12px' },
  alertInfo: { border: '1px solid #bae6fd', borderRadius: '8px', background: '#f0f9ff', color: '#075985', padding: '12px', fontSize: '14px', marginTop: '12px' },
};
