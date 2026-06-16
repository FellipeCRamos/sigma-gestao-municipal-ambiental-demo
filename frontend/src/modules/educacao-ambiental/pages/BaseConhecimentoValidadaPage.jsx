import { useEffect, useState } from 'react';
import { getBaseConhecimentoValidada } from '../services/educacaoAmbientalApi';
import { styles } from './shared';

const GROUPS = [
  ['conteudos', 'Conteudos publicados e aptos para IA', 'titulo'],
  ['normas', 'Normas publicadas e verificadas', 'titulo'],
  ['faq', 'FAQ publicada', 'pergunta'],
  ['materiais', 'Materiais publicados', 'titulo'],
  ['trilhas', 'Trilhas publicadas', 'titulo'],
];

export default function BaseConhecimentoValidadaPage() {
  const [base, setBase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError('');
        const response = await getBaseConhecimentoValidada();
        setBase(response.data || null);
      } catch (err) {
        setError(err.message || 'Nao foi possivel carregar base validada.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <div style={styles.page}>
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Base IA validada</h2>
        <p style={styles.sectionSubtitle}>
          Estrutura de conhecimento para futura IA Educadora Ambiental. Nao ha chamada externa ou IA real nesta sprint.
        </p>
        {loading ? <p style={styles.message}>Carregando base validada...</p> : null}
        {error ? <p style={styles.error}>{error}</p> : null}
        {base?.criterios ? (
          <div style={styles.grid2}>
            <p style={styles.message}>{base.criterios.escopo}</p>
            <p style={styles.message}>{base.criterios.limite_institucional}</p>
          </div>
        ) : null}
      </section>

      {GROUPS.map(([key, label, titleField]) => {
        const items = base?.[key] || [];
        return (
          <section key={key} style={styles.section}>
            <div style={styles.headerRow}>
              <div>
                <h3 style={styles.sectionTitle}>{label}</h3>
                <p style={styles.sectionSubtitle}>{items.length} registro(s) aptos para consulta interna.</p>
              </div>
            </div>
            {!items.length ? <p style={styles.message}>Nenhum registro validado nesta categoria.</p> : null}
            {items.length ? (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Registro</th>
                      <th style={styles.th}>Categoria/tema</th>
                      <th style={styles.th}>Fonte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={`${key}-${item.id}`}>
                        <td style={styles.td}>{item[titleField] || item.titulo || item.pergunta}</td>
                        <td style={styles.td}>{item.categoria || item.tema_principal || item.tipo_material || item.nivel || '-'}</td>
                        <td style={styles.td}>{item.fonte_referencia || item.link_fonte || item.fonte || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
