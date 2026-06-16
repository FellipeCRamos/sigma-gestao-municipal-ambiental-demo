export default function ModoTecnicoAvancado({ children, styles }) {
  return (
    <section id="simulador-licenciamento" style={styles.section}>
      <details>
        <summary style={{
          cursor: 'pointer',
          fontSize: 21,
          fontWeight: 900,
          color: '#0d1b3d',
          listStyle: 'none',
        }}>
          Ja sabe a atividade? Usar modo tecnico avancado.
        </summary>
        <p style={styles.sectionText}>
          Use esta area quando souber o grupo, codigo ou parametro tecnico da atividade. O resultado continua
          preliminar, sem licenca, dispensa, autorizacao, DAM real, protocolo definitivo ou cobranca oficial.
        </p>
        <div style={{ marginTop: 18 }}>
          {children}
        </div>
      </details>
    </section>
  );
}
