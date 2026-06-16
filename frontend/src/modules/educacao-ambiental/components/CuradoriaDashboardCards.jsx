import { styles } from '../pages/shared';

const METRICS = [
  ['conteudos_em_curadoria', 'Conteudos em curadoria'],
  ['conteudos_sem_fonte', 'Conteudos sem fonte'],
  ['pendentes_validacao_tecnica', 'Pendente validacao tecnica'],
  ['pendentes_validacao_juridica', 'Pendente validacao juridica'],
  ['normas_vigencia_nao_verificada', 'Normas nao verificadas'],
  ['especies_sem_fonte', 'Especies sem fonte'],
  ['areas_sem_validacao', 'Areas sem validacao'],
  ['aptos_publicacao', 'Aptos para publicacao'],
  ['aptos_ia', 'Aptos para IA'],
  ['publicados', 'Publicados'],
  ['revisao_vencida', 'Revisao vencida'],
  ['referencias_ativas', 'Referencias ativas'],
];

export default function CuradoriaDashboardCards({ totals = {} }) {
  return (
    <section style={styles.grid3}>
      {METRICS.map(([key, label]) => (
        <article key={key} style={styles.metric}>
          <p style={styles.metricLabel}>{label}</p>
          <p style={styles.metricValue}>{Number(totals[key] || 0).toLocaleString('pt-BR')}</p>
        </article>
      ))}
    </section>
  );
}
