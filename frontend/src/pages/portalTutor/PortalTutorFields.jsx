import { styles } from './styles';

export function Input({ label, name, value, onChange, type = 'text', required = false }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>
        {label}
        {required ? ' *' : ''}
      </span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        style={styles.input}
        required={required}
      />
    </label>
  );
}

export function Select({ label, name, value, onChange, children }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <select name={name} value={value} onChange={onChange} style={styles.input}>
        {children}
      </select>
    </label>
  );
}

export function Textarea({ label, name, value, onChange }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <textarea name={name} value={value} onChange={onChange} style={styles.textarea} rows={4} />
    </label>
  );
}
