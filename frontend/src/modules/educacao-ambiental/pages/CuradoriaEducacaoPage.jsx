import { useCallback, useEffect, useState } from 'react';
import CuradoriaDashboardCards from '../components/CuradoriaDashboardCards';
import PendenciasCuradoriaTable from '../components/PendenciasCuradoriaTable';
import {
  getCuradoriaDashboard,
  listCuradoriaPendencias,
  setConteudoAptoIa,
  setConteudoAptoPortal,
  updateConteudoStatusCuradoria,
  validarConteudoTecnicamente,
} from '../services/educacaoAmbientalApi';
import { confiabilidadeOptions, curadoriaStatusOptions } from './pageConfigs';
import { styles, unpackList } from './shared';

export default function CuradoriaEducacaoPage() {
  const [dashboard, setDashboard] = useState(null);
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ q: '', status_curadoria: '', grau_confiabilidade: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [dashboardResponse, pendenciasResponse] = await Promise.all([
        getCuradoriaDashboard(),
        listCuradoriaPendencias({ ...filters, limit: 30, orderBy: 'updated_at' }),
      ]);
      setDashboard(dashboardResponse.data || null);
      setItems(unpackList(pendenciasResponse.data).items);
    } catch (err) {
      setError(err.message || 'Nao foi possivel carregar curadoria.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAction(item, action) {
    try {
      setSaving(true);
      setError('');
      setMessage('');

      if (action === 'validar_tecnica') {
        await validarConteudoTecnicamente(item.id, { parecer_curadoria: 'Validacao tecnica registrada no painel.' });
      } else if (action === 'apto_portal') {
        await setConteudoAptoPortal(item.id, true);
      } else if (action === 'apto_ia') {
        await setConteudoAptoIa(item.id, true);
      } else {
        await updateConteudoStatusCuradoria(item.id, { status_curadoria: action });
      }

      setMessage('Curadoria atualizada.');
      await load();
    } catch (err) {
      setError(err.message || 'Nao foi possivel executar a acao de curadoria.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.page}>
      <section style={styles.section}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.sectionTitle}>Curadoria tecnica</h2>
            <p style={styles.sectionSubtitle}>
              Revisao, fontes, validacao tecnica e aptidao para portal publico e futura IA Educadora Ambiental.
            </p>
          </div>
          <button type="button" style={styles.buttonSecondary} onClick={load} disabled={saving}>
            Atualizar
          </button>
        </div>
        {error ? <p style={styles.error}>{error}</p> : null}
        {message ? <p style={styles.message}>{message}</p> : null}
      </section>

      <CuradoriaDashboardCards totals={dashboard?.totais || {}} />

      <section style={styles.section}>
        <div style={styles.headerRow}>
          <div>
            <h3 style={styles.sectionTitle}>Pendencias de validacao</h3>
            <p style={styles.sectionSubtitle}>Acoes rapidas mantem auditoria e respeitam bloqueios de publicacao.</p>
          </div>
          <div style={{ ...styles.filters, minWidth: 'min(720px, 100%)' }}>
            <input
              style={styles.input}
              value={filters.q}
              placeholder="Buscar por titulo, resumo ou tema"
              onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
            />
            <select
              style={styles.input}
              value={filters.status_curadoria}
              onChange={(event) => setFilters((prev) => ({ ...prev, status_curadoria: event.target.value }))}
            >
              <option value="">Todos os status</option>
              {curadoriaStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select
              style={styles.input}
              value={filters.grau_confiabilidade}
              onChange={(event) => setFilters((prev) => ({ ...prev, grau_confiabilidade: event.target.value }))}
            >
              <option value="">Todas confiabilidades</option>
              {confiabilidadeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? <p style={styles.message}>Carregando pendencias...</p> : null}
        {!loading ? <PendenciasCuradoriaTable items={items} onAction={handleAction} /> : null}
      </section>
    </div>
  );
}
