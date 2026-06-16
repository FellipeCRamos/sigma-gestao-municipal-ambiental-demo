import { useEffect, useState } from 'react';
import {
  createViveiroLote,
  getViveiroEspecies,
  getViveiroLotes,
  updateViveiroLote,
} from '../services/viveiroAdminApi';
import { hasPermission, PERMISSIONS } from '../../../utils/permissions';
import PaginationControls from './PaginationControls';
import { formatDate, formatDateOnly, formatNumber, pageStyles, statusPill, unpackListPayload } from './shared';

const INITIAL_FORM = {
  especie_id: '',
  codigo: '',
  origem_lote: 'producao_interna',
  local_armazenamento: '',
  data_entrada: new Date().toISOString().slice(0, 10),
  quantidade_inicial: '',
  status: 'ativo',
  observacoes: '',
};

export default function ViveiroLotesPage({ usuarioInterno }) {
  const [especies, setEspecies] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  const canManage = hasPermission(usuarioInterno, PERMISSIONS.VIVEIRO_LOTES_MANAGE);

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      const [especiesResponse, lotesResponse] = await Promise.all([
        getViveiroEspecies(),
        getViveiroLotes({
          status: statusFilter,
          busca: search,
          page,
          page_size: 10,
        }),
      ]);
      const lotesPayload = unpackListPayload(lotesResponse.data);
      setEspecies(Array.isArray(especiesResponse.data) ? especiesResponse.data : []);
      setLotes(lotesPayload.items);
      setPagination(lotesPayload.pagination);
    } catch (err) {
      setError(err.message || 'Não foi possível carregar os lotes do viveiro.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, page]);

  function resetForm() {
    setForm(INITIAL_FORM);
    setEditingId('');
  }

  function startEdit(item) {
    setEditingId(String(item.id));
    setForm({
      especie_id: String(item.especie_id || ''),
      codigo: item.codigo || '',
      origem_lote: item.origem_lote || 'producao_interna',
      local_armazenamento: item.local_armazenamento || '',
      data_entrada: formatDateOnly(item.data_entrada),
      quantidade_inicial: String(item.quantidade_inicial ?? ''),
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
        await updateViveiroLote(editingId, form);
        setMessage('Lote atualizado com sucesso.');
      } else {
        await createViveiroLote(form);
        setMessage('Lote cadastrado com sucesso.');
      }

      resetForm();
      setPage(1);
      await loadData();
    } catch (err) {
      setError(err.message || 'Não foi possível salvar o lote.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.grid2}>
        <article style={pageStyles.section}>
          <h2 style={pageStyles.sectionTitle}>Lotes do Viveiro</h2>
          <p style={pageStyles.sectionSubtitle}>
            Cada lote registra entrada inicial, reserva operacional e movimentações de estoque do Viveiro.
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
                  Espécie
                  <select
                    style={pageStyles.input}
                    value={form.especie_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, especie_id: e.target.value }))}
                    disabled={Boolean(editingId)}
                  >
                    <option value="">Selecione</option>
                    {especies.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Código do lote
                  <input style={pageStyles.input} value={form.codigo} onChange={(e) => setForm((prev) => ({ ...prev, codigo: e.target.value }))} disabled={Boolean(editingId)} />
                </label>
                <label>
                  Origem
                  <input style={pageStyles.input} value={form.origem_lote} onChange={(e) => setForm((prev) => ({ ...prev, origem_lote: e.target.value }))} />
                </label>
                <label>
                  Local
                  <input style={pageStyles.input} value={form.local_armazenamento} onChange={(e) => setForm((prev) => ({ ...prev, local_armazenamento: e.target.value }))} />
                </label>
                <label>
                  Data de entrada
                  <input style={pageStyles.input} type="date" value={form.data_entrada} onChange={(e) => setForm((prev) => ({ ...prev, data_entrada: e.target.value }))} />
                </label>
                <label>
                  Quantidade inicial
                  <input style={pageStyles.input} type="number" min="0.01" step="0.01" value={form.quantidade_inicial} onChange={(e) => setForm((prev) => ({ ...prev, quantidade_inicial: e.target.value }))} disabled={Boolean(editingId)} />
                </label>
                <label>
                  Status
                  <select style={pageStyles.input} value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
                    <option value="ativo">Ativo</option>
                    <option value="esgotado">Esgotado</option>
                    <option value="encerrado">Encerrado</option>
                    <option value="bloqueado">Bloqueado</option>
                  </select>
                </label>
              </div>

              <label style={{ display: 'block', marginTop: '12px' }}>
                Observações
                <textarea style={pageStyles.textarea} value={form.observacoes} onChange={(e) => setForm((prev) => ({ ...prev, observacoes: e.target.value }))} />
              </label>

              <div style={pageStyles.actions}>
                <button type="submit" style={pageStyles.buttonPrimary} disabled={saving}>
                  {saving ? 'Salvando...' : editingId ? 'Atualizar lote' : 'Cadastrar lote'}
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
          <h3 style={pageStyles.sectionTitle}>Lotes cadastrados</h3>
          <div style={{ ...pageStyles.actions, marginTop: 0, marginBottom: '12px' }}>
            <input
              style={{ ...pageStyles.input, maxWidth: '260px' }}
              placeholder="Buscar lote ou espécie"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
            <select
              style={{ ...pageStyles.input, maxWidth: '220px' }}
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value);
              }}
            >
              <option value="">Todos os status</option>
              <option value="ativo">Ativo</option>
              <option value="esgotado">Esgotado</option>
              <option value="bloqueado">Bloqueado</option>
              <option value="encerrado">Encerrado</option>
            </select>
          </div>
          {loading ? <p>Carregando lotes...</p> : null}
          <div style={pageStyles.tableWrap}>
            <table style={pageStyles.table}>
              <thead>
                <tr>
                  <th style={pageStyles.th}>Código</th>
                  <th style={pageStyles.th}>Espécie</th>
                  <th style={pageStyles.th}>Entrada</th>
                  <th style={pageStyles.th}>Físico</th>
                  <th style={pageStyles.th}>Reservado</th>
                  <th style={pageStyles.th}>Livre</th>
                  <th style={pageStyles.th}>Status</th>
                  {canManage ? <th style={pageStyles.th}>Ações</th> : null}
                </tr>
              </thead>
              <tbody>
                {lotes.map((item) => {
                  const pill = statusPill(item.status);
                  return (
                    <tr key={item.id}>
                      <td style={pageStyles.td}>
                        <strong>{item.codigo}</strong>
                        <div style={pageStyles.sectionSubtitle}>{item.local_armazenamento || '-'}</div>
                      </td>
                      <td style={pageStyles.td}>{item.especie_nome}</td>
                      <td style={pageStyles.td}>
                        {formatDate(item.data_entrada)}
                        <div style={pageStyles.sectionSubtitle}>Inicial: {formatNumber(item.quantidade_inicial)}</div>
                      </td>
                      <td style={pageStyles.td}>{formatNumber(item.quantidade_disponivel)}</td>
                      <td style={pageStyles.td}>{formatNumber(item.quantidade_reservada)}</td>
                      <td style={pageStyles.td}>{formatNumber(item.quantidade_livre)}</td>
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
