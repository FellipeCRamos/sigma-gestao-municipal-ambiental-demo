import { assistenteStyles } from './assistenteStyles';

export default function ChecklistDocumentalPreliminar({ documentos }) {
  if (!documentos?.length) return null;

  return (
    <div style={assistenteStyles.card}>
      <h3 style={{ ...assistenteStyles.title, fontSize: 20 }}>Checklist documental preliminar</h3>
      <ul style={assistenteStyles.list}>
        {documentos.map((documento) => (
          <li key={documento}>{documento}</li>
        ))}
      </ul>
    </div>
  );
}
