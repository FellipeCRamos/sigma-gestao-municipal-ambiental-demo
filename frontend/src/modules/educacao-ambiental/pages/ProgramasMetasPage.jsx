import EducacaoCrudPage from './EducacaoCrudPage';
import { metasConfig, programasConfig } from './pageConfigs';
import { styles } from './shared';

export default function ProgramasMetasPage() {
  return (
    <div style={styles.page}>
      <EducacaoCrudPage config={programasConfig} />
      <EducacaoCrudPage config={metasConfig} />
    </div>
  );
}
