import { useEffect, useState } from 'react';
import {
  getDashboardBiTerritorial,
  getDashboardGerencial,
  getDashboardQualidadeCadastral,
  getDashboardVacinacao,
  getOperacaoResumo,
} from '../services/api';
import { styles } from './dashboard/styles';
import {
  DataQualitySection,
  OperationalAlertsSection,
  OperationalQueueSection,
  OverviewSection,
  StatusOverviewSection,
  TerritorialBiSection,
  TerritorializationSection,
  TraceabilitySection,
  VaccinationSection,
} from './dashboard/DashboardSections';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [vacinacao, setVacinacao] = useState(null);
  const [qualidade, setQualidade] = useState(null);
  const [operacao, setOperacao] = useState(null);
  const [biTerritorial, setBiTerritorial] = useState(null);
  const [territorioFiltro, setTerritorioFiltro] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        setError('');

        const [
          gerencialResponse,
          vacinacaoResponse,
          qualidadeResponse,
          operacaoResponse,
          biResponse,
        ] = await Promise.all([
          getDashboardGerencial(),
          getDashboardVacinacao(),
          getDashboardQualidadeCadastral(),
          getOperacaoResumo(),
          getDashboardBiTerritorial(),
        ]);

        setData(gerencialResponse.data);
        setVacinacao(vacinacaoResponse.data);
        setQualidade(qualidadeResponse.data);
        setOperacao(operacaoResponse.data);
        setBiTerritorial(biResponse.data);
      } catch (err) {
        setError(err.message || 'Erro ao carregar dashboard gerencial.');
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  if (loading) return <p>Carregando painel gerencial...</p>;
  if (error) return <p style={{ color: '#b91c1c' }}>{error}</p>;

  const { totais, percentuais, por_especie, por_status, alertas, ocorrencias, territorial } = data;
  const vacinacaoTotais = vacinacao?.totais || {};
  const qualidadeAnimais = qualidade?.animais || {};
  const qualidadeTutores = qualidade?.tutores || {};
  const saneamento = qualidade?.saneamento || {};
  const operacaoFila = operacao?.fila || {};
  const operacaoCampanhas = operacao?.campanhas || {};
  const operacaoOcorrencias = operacao?.ocorrencias || {};
  const biTerritorialRows = biTerritorial?.territorial || territorial || [];
  const biSeries = biTerritorial?.series_historicas || [];
  const biDemanda = biTerritorial?.demanda_reprimida || {};
  const biCobertura = biTerritorial?.cobertura_vacinal || {};
  const biCampanhas = biTerritorial?.campanhas_operacao || [];
  const qualidadeTerritorial = biTerritorial?.qualidade_territorial || [];
  const gestaoTerritorial = biTerritorial?.gestao_territorial || {};
  const territorioOptions = Array.from(
    new Set(biTerritorialRows.map((item) => item.bairro).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const visibleBiTerritorialRows = territorioFiltro
    ? biTerritorialRows.filter((item) => item.bairro === territorioFiltro)
    : biTerritorialRows;
  const visibleDemandaBairro = territorioFiltro
    ? (biDemanda?.por_bairro || []).filter((item) => item.bairro === territorioFiltro)
    : biDemanda?.por_bairro || [];
  const visibleCoberturaBairro = territorioFiltro
    ? (biCobertura?.por_bairro || []).filter((item) => item.bairro === territorioFiltro)
    : biCobertura?.por_bairro || [];

  return (
    <div style={styles.page}>
      <OverviewSection totais={totais} percentuais={percentuais} />
      <TraceabilitySection
        totais={totais}
        percentuais={percentuais}
        por_especie={por_especie}
        ocorrencias={ocorrencias}
      />
      <OperationalAlertsSection alertas={alertas} ocorrencias={ocorrencias} />
      <OperationalQueueSection
        operacaoFila={operacaoFila}
        operacaoCampanhas={operacaoCampanhas}
        operacaoOcorrencias={operacaoOcorrencias}
        observacao={operacao?.observacao}
      />
      <TerritorialBiSection
        territorioFiltro={territorioFiltro}
        onTerritorioFiltroChange={setTerritorioFiltro}
        territorioOptions={territorioOptions}
        biDemanda={biDemanda}
        biCobertura={biCobertura}
        visibleBiTerritorialRows={visibleBiTerritorialRows}
        visibleDemandaBairro={visibleDemandaBairro}
        visibleCoberturaBairro={visibleCoberturaBairro}
        biTerritorial={biTerritorial}
        gestaoTerritorial={gestaoTerritorial}
        biSeries={biSeries}
        biCampanhas={biCampanhas}
        qualidadeTerritorial={qualidadeTerritorial}
      />
      <VaccinationSection vacinacaoTotais={vacinacaoTotais} vacinacao={vacinacao} />
      <DataQualitySection
        qualidadeAnimais={qualidadeAnimais}
        qualidadeTutores={qualidadeTutores}
        saneamento={saneamento}
        qualidade={qualidade}
      />
      <StatusOverviewSection por_status={por_status} />
      <TerritorializationSection rows={visibleBiTerritorialRows} />
    </div>
  );
}
