import { useEffect, useState } from 'react';
import { createViveiroEspecie, getViveiroEspecies, updateViveiroEspecie } from '../services/viveiroAdminApi';
import { hasPermission, PERMISSIONS } from '../../../utils/permissions';
import PaginationControls from './PaginationControls';
import { formatNumber, pageStyles, statusPill, unpackListPayload } from './shared';

const INITIAL_FORM = {
  nome: '',
  nome_cientifico: '',
  categoria: 'ornamental',
  porte: 'medio',
  unidade_medida: 'unidade',
  estoque_minimo_alerta: '0',
  fator_arvometro: '1',
  area_media_m2: '1',
  status: 'ativo',
  observacoes: '',
};

export default function ViveiroEspeciesPage({ usuarioInterno }) {
  const [especies, setEspecies] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  const canManage = hasPermission(usuarioInterno, PERMISSIONS.VIVEIRO_ESPECIES_MANAGE);

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      const response = await getViveiroEspecies({
        incluir_inativas: true,
        busca: search,
        page,
        page_size: 10,
      });
      const payload = unpackListPayload(response.data);
      setEspecies(payload.items);
      setPagination(payload.pagination);
    } catch (err) {
      setError(err.message || 'Não foi possível carregar as espécies do viveiro.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page]);

  function resetForm() {
    setForm(INITIAL_FORM);
    setEditingId('');
  }

  function startEdit(item) {
    setEditingId(String(item.id));
    setForm({
      nome: item.nome || '',
      nome_cientifico: item.nome_cientifico || '',
      categoria: item.categoria || 'ornamental',
      porte: item.porte || 'medio',
      unidade_medida: item.unidade_medida || 'unidade',
      estoque_minimo_alerta: String(item.estoque_minimo_alerta ?? '0'),
      fator_arvometro: String(item.fator_arvometro ?? '1'),
      area_media_m2: String(item.area_media_m2 ?? '1'),
      status: item.status || 'ativo',
      observacoes: item.observacoes || '',
    });
    setMessage('');
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setSaving(true);
      setMessage('');
      setError('');

      if (editingId) {
        await updateViveiroEspecie(editingId, form);
        setMessage('Espécie atualizada com sucesso.');
      } else {
        await createViveiroEspecie(form);
        setMessage('Espécie cadastrada com sucesso.');
      }

      resetForm();
      setPage(1);
      await loadData();
    } catch (err) {
      setError(err.message || 'Não foi possível salvar a espécie.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.grid2}>
        <article style={pageStyles.section}>
          <h2 style={pageStyles.sectionTitle}>Espécies de mudas</h2>
          <p style={pageStyles.sectionSubtitle}>
            Cadastro base do Viveiro com fator do Arvômetro e estoque mínimo por espécie.
          </p>

          {message ? (
            <div style={{ ...pageStyles.message, background: '#dcfce7', color: '#166534', marginTop: '12px' }}>{message}</div>
          ) : null}
          {error ? (
            <div style={{ ...pageStyles.message, background: '#fee2e2', color: '#991b1b', marginTop: '12px' }}>{error}</div>
          ) : null}

          {canManage ? (
            <form onSubmit={handleSubmit} style={{ marginTop: '16px' }}>
              <div style={pageStyles.formGrid}>
                <label>
                  Nome
                  <input style={pageStyles.input} value={form.nome} onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))} />
                </label>
                <label>
                  Nome científico
                  <input style={pageStyles.input} value={form.nome_cientifico} onChange={(e) => setForm((prev) => ({ ...prev, nome_cientifico: e.target.value }))} />
                </label>
                <label>
                  Categoria
                  <select style={pageStyles.input} value={form.categoria} onChange={(e) => setForm((prev) => ({ ...prev, categoria: e.target.value }))}>
                    <option value="ornamental">Ornamental</option>
                    <option value="frutifera">Frutífera</option>
                    <option value="nativa">Nativa</option>
                    <option value="medicinal">Medicinal</option>
                    <option value="arborizacao">Arborização</option>
                    <option value="hortalica">Hortaliça</option>
                    <option value="outra">Outra</option>
                  </select>
                </label>
                <label>
                  Porte
                  <select style={pageStyles.input} value={form.porte} onChange={(e) => setForm((prev) => ({ ...prev, porte: e.target.value }))}>
                    <option value="pequeno">Pequeno</option>
                    <option value="medio">Médio</option>
                    <option value="grande">Grande</option>
                  </select>
                </label>
                <label>
                  Unidade
                  <input style={pageStyles.input} value={form.unidade_medida} onChange={(e) => setForm((prev) => ({ ...prev, unidade_medida: e.target.value }))} />
                </label>
                <label>
                  Estoque mínimo
                  <input style={pageStyles.input} type="number" min="0" step="0.01" value={form.estoque_minimo_alerta} onChange={(e) => setForm((prev) => ({ ...prev, estoque_minimo_alerta: e.target.value }))} />
                </label>
                <label>
                  Fator do Arvômetro
                  <input style={pageStyles.input} type="number" min="0.01" step="0.01" value={form.fator_arvometro} onChange={(e) => setForm((prev) => ({ ...prev, fator_arvometro: e.target.value }))} />
                </label>
                <label>
                  Área média m²
                  <input style={pageStyles.input} type="number" min="0.01" step="0.01" value={form.area_media_m2} onChange={(e) => setForm((prev) => ({ ...prev, area_media_m2: e.target.value }))} />
                </label>
                <label>
                  Status
                  <select style={pageStyles.input} value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </label>
              </div>

              <label style={{ display: 'block', marginTop: '12px' }}>
                Observações
                <textarea style={pageStyles.textarea} value={form.observacoes} onChange={(e) => setForm((prev) => ({ ...prev, observacoes: e.target.value }))} />
              </label>

              <div style={pageStyles.actions}>
                <button type="submit" style={pageStyles.buttonPrimary} disabled={saving}>
                  {saving ? 'Salvando...' : editingId ? 'Atualizar espécie' : 'Cadastrar espécie'}
                </button>
                {editingId ? (
                  <button type="button" style={pageStyles.buttonSecondary} onClick={resetForm}>
                    Cancelar edição
                  </button>
                ) : null}
              </div>
            </form>
          ) : null}
        </article>

        <article style={pageStyles.section}>
          <h3 style={pageStyles.sectionTitle}>Espécies cadastradas</h3>
          <div style={{ ...pageStyles.actions, marginTop: 0, marginBottom: '12px' }}>
            <input
              style={{ ...pageStyles.input, maxWidth: '320px' }}
              placeholder="Buscar espécie"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
          </div>
          {loading ? <p>Carregando espécies...</p> : null}
          <div style={pageStyles.tableWrap}>
            <table style={pageStyles.table}>
              <thead>
                <tr>
                  <th style={pageStyles.th}>Nome</th>
                  <th style={pageStyles.th}>Categoria</th>
                  <th style={pageStyles.th}>Disponível</th>
                  <th style={pageStyles.th}>Reservado</th>
                  <th style={pageStyles.th}>Arvômetro</th>
                  <th style={pageStyles.th}>Status</th>
                  {canManage ? <th style={pageStyles.th}>Ações</th> : null}
                </tr>
              </thead>
              <tbody>
                {especies.map((item) => {
                  const pill = statusPill(item.status);
                  return (
                    <tr key={item.id}>
                      <td style={pageStyles.td}>
                        <strong>{item.nome}</strong>
                        <div style={pageStyles.sectionSubtitle}>{item.nome_cientifico || '-'}</div>
                      </td>
                      <td style={pageStyles.td}>{item.categoria}</td>
                      <td style={pageStyles.td}>{formatNumber(item.estoque_total_disponivel)}</td>
                      <td style={pageStyles.td}>{formatNumber(item.estoque_total_reservado)}</td>
                      <td style={pageStyles.td}>
                        fator {formatNumber(item.fator_arvometro)} / área {formatNumber(item.area_media_m2)} m²
                      </td>
                      <td style={pageStyles.td}>
                        <span style={{ padding: '6px 10px', borderRadius: '999px', background: pill.background, color: pill.color, fontWeight: 700, fontSize: '12px' }}>
                          {pill.label}
                        </span>
                      </td>
                      {canManage ? (
                        <td style={pageStyles.td}>
                          <button type="button" style={pageStyles.buttonSecondary} onClick={() => startEdit(item)}>
                            Editar
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationControls pagination={pagination} onPageChange={setPage} />
        </article>
      </section>
    </div>
  );
}
