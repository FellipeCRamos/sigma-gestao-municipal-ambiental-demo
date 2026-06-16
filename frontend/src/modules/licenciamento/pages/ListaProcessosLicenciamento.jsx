import { useEffect, useState } from 'react';
import { getLicenciamentoProcessos } from '../services/licenciamentoAdminApi';
import DetalheProcessoLicenciamento from './DetalheProcessoLicenciamento';
import {
  formatDateOnly,
  LICENCIAMENTO_STATUS_OPTIONS,
  pageStyles,
  statusPill,
  unpackListPayload,
} from './shared';

export default function ListaProcessosLicenciamento({ navigateToPage }) {
  const [filters, setFilters] = useState({ busca: '', status: '', page: 1, page_size: 15 });
  const [processos, setProcessos] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadProcessos(nextFilters = filters) {
    setLoading(true);
    setError('');

    try {
      const response = await getLicenciamentoProcessos(nextFilters);
      const unpacked = unpackListPayload(response.data);
      setProcessos(unpacked.items);
      setPagination(unpacked.pagination);
    } catch (loadError) {
      setError(loadError.message || 'Erro ao carregar processos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProcessos(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFilterChange(field, value) {
    setFilters((current) => ({
      ...current,
      [field]: value,
      page: 1,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    loadProcessos({ ...filters, page: 1 });
  }

  return (
    <div style={pageStyles.page}>
      <section style={pageStyles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={pageStyles.sectionTitle}>Processos de Licenciamento</h2>
            <p style={pageStyles.sectionSubtitle}>
              Cadastro inicial para organização de requerentes, empreendimentos e tramitação ambiental.
            </p>
          </div>
          <button type="button" style={pageStyles.buttonPrimary} onClick={() => navigateToPage?.('novo')}>
            Novo processo
          </button>
        </div>
      </section>

      <section style={pageStyles.section}>
        <form onSubmit={handleSubmit} style={pageStyles.formGrid}>
          <label style={pageStyles.label}>
            Buscar
            <input
              style={pageStyles.input}
              value={filters.busca}
              onChange={(event) => handleFilterChange('busca', event.target.value)}
              placeholder="Número, requerente, empreendimento ou atividade"
            />
          </label>
          <label style={pageStyles.label}>
            Status
            <select
              style={pageStyles.input}
              value={filters.status}
              onChange={(event) => handleFilterChange('status', event.target.value)}
            >
              <option value="">Todos</option>
              {LICENCIAMENTO_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div style={{ ...pageStyles.actions, alignItems: 'end' }}>
            <button type="submit" style={pageStyles.buttonSecondary}>
              Filtrar
            </button>
          </div>
        </form>

        {error ? <div style={{ ...pageStyles.message, ...pageStyles.dangerText }}>{error}</div> : null}

        <div style={{ ...pageStyles.tableWrap, marginTop: '16px' }}>
          <table style={pageStyles.table}>
            <thead>
              <tr>
                <th style={pageStyles.th}>Processo</th>
                <th style={pageStyles.th}>Requerente</th>
                <th style={pageStyles.th}>Empreendimento</th>
                <th style={pageStyles.th}>Status</th>
                <th style={pageStyles.th}>Protocolo</th>
                <th style={pageStyles.th}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {processos.length > 0 ? (
                processos.map((processo) => {
                  const pill = statusPill(processo.status);

                  return (
                    <tr key={processo.id}>
                      <td style={pageStyles.td}>
                        <strong>{processo.numero_processo}</strong>
                        <div style={pageStyles.sectionSubtitle}>{processo.tipo_licenca}</div>
                      </td>
                      <td style={pageStyles.td}>{processo.requerente_nome || '-'}</td>
                      <td style={pageStyles.td}>{processo.empreendimento_nome || '-'}</td>
                      <td style={pageStyles.td}>
                        <span style={{ ...pageStyles.pill, background: pill.background, color: pill.color }}>
                          {pill.label}
                        </span>
                      </td>
                      <td style={pageStyles.td}>{formatDateOnly(processo.data_protocolo) || '-'}</td>
                      <td style={pageStyles.td}>
                        <button type="button" style={pageStyles.buttonSecondary} onClick={() => setSelectedId(processo.id)}>
                          Ver detalhes
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td style={pageStyles.td} colSpan={6}>
                    {loading ? 'Carregando...' : 'Nenhum processo encontrado.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pagination ? (
          <p style={pageStyles.sectionSubtitle}>
            Página {pagination.page} de {pagination.total_pages} - {pagination.total_items} registro(s)
          </p>
        ) : null}
      </section>

      {selectedId ? (
        <DetalheProcessoLicenciamento
          processoId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={() => loadProcessos(filters)}
        />
      ) : null}
    </div>
  );
}
