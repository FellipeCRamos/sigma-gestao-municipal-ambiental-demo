import { useEffect, useState } from 'react';
import { getEducacaoDashboard } from '../services/educacaoAmbientalApi';
import { styles } from './shared';

const METRICS = [
  ['conteudos_total', 'Conteudos cadastrados'],
  ['conteudos_publicados', 'Conteudos publicados'],
  ['conteudos_em_revisao', 'Em revisao'],
  ['normas_total', 'Normas cadastradas'],
  ['normas_nao_verificadas', 'Normas nao verificadas'],
  ['agenda_mes', 'Agenda do mes'],
  ['materiais_publicados', 'Materiais publicados'],
  ['trilhas_total', 'Trilhas cadastradas'],
  ['especies_total', 'Especies cadastradas'],
  ['areas_total', 'Areas ambientais'],
  ['pendencias_validacao', 'Pendencias de validacao'],
];

export default function EducacaoAmbientalDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError('');
        const response = await getEducacaoDashboard();
        setDashboard(response.data || null);
      } catch (err) {
        setError(err.message || 'Nao foi possivel carregar o dashboard.');
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  if (loading) {
    return <p style={styles.message}>Carregando dashboard de Educacao Ambiental...</p>;
  }

  if (error) {
    return <p style={styles.error}>{error}</p>;
  }

  const totals = dashboard?.totais || {};

  return (
    <div style={styles.page}>
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Educacao Ambiental</h2>
        <p style={styles.sectionSubtitle}>
          Fundacao institucional do Centro Municipal de Conhecimento Ambiental: conteudos, normas,
          agenda, materiais, trilhas, biodiversidade, areas, programas, metas e FAQ.
        </p>
      </section>

      <section style={styles.grid3}>
        {METRICS.map(([key, label]) => (
          <article key={key} style={styles.metric}>
            <p style={styles.metricLabel}>{label}</p>
            <p style={styles.metricValue}>{Number(totals[key] || 0).toLocaleString('pt-BR')}</p>
          </article>
        ))}
      </section>

      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Governanca da sprint</h3>
        <div style={styles.grid2}>
          {(dashboard?.avisos || []).map((aviso) => (
            <p key={aviso} style={styles.message}>{aviso}</p>
          ))}
        </div>
      </section>
    </div>
  );
}
