import { styles } from './styles';

export function DashboardSection({ title, subtitle, children }) {
  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <h2 style={styles.sectionTitle}>{title}</h2>
        <p style={styles.sectionSubtitle}>{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

export function MetricCard({ title, value, subtitle }) {
  return (
    <div style={styles.metricCard}>
      <span style={styles.metricTitle}>{title}</span>
      <strong style={styles.metricValue}>{value}</strong>
      <span style={styles.metricSubtitle}>{subtitle}</span>
    </div>
  );
}

export function AlertCard({ title, value }) {
  return (
    <div style={styles.alertCard}>
      <span style={styles.alertTitle}>{title}</span>
      <strong style={styles.alertValue}>{value}</strong>
    </div>
  );
}

export function StatusCard({ label, value }) {
  return (
    <div style={styles.statusCard}>
      <span style={styles.statusLabel}>{label}</span>
      <strong style={styles.statusValue}>{value}</strong>
    </div>
  );
}

export function MiniTable({ title, rows, columns }) {
  return (
    <div style={styles.miniTableCard}>
      <h3 style={styles.miniTableTitle}>{title}</h3>
      {rows.length === 0 ? (
        <p style={styles.sectionSubtitle}>Sem dados estruturados ainda.</p>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                {columns.map(([, label]) => (
                  <th key={label} style={styles.th}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${title}-${index}`}>
                  {columns.map(([key]) => (
                    <td key={key} style={styles.td}>{row[key] ?? '-'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
