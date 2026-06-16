import { AlertCard, DashboardSection, MetricCard, MiniTable, StatusCard } from './DashboardPrimitives';
import { styles } from './styles';

export function OverviewSection({ totais, percentuais }) {
  return (
    <DashboardSection title="Painel gerencial" subtitle="Indicadores consolidados do módulo de Bem-estar Animal.">
      <div style={styles.grid4}>
        <MetricCard title="Total de animais" value={totais.animais} subtitle="Base total cadastrada" />
        <MetricCard title="Total de tutores" value={totais.tutores} subtitle="Cadastros vinculados" />
        <MetricCard title="Animais castrados" value={totais.castrados} subtitle={`${percentuais.castracao}% da base`} />
        <MetricCard title="Animais vacinados" value={totais.vacinados} subtitle={`${percentuais.vacinacao}% da base`} />
      </div>
    </DashboardSection>
  );
}

export function TraceabilitySection({ totais, percentuais, por_especie, ocorrencias }) {
  return (
    <DashboardSection title="Rastreabilidade e controle" subtitle="Indicadores operacionais da base atual.">
      <div style={styles.grid4}>
        <MetricCard title="Microchipados" value={totais.microchipados} subtitle={`${percentuais.microchipagem}% identificados`} />
        <MetricCard title="Sem tutor" value={totais.sem_tutor} subtitle="Registros sem vinculo" />
        <MetricCard title="Caninos / Felinos" value={`${por_especie.caninos} / ${por_especie.felinos}`} subtitle="Distribuicao por espécie" />
        <MetricCard title="Ocorrências totais" value={ocorrencias?.total ?? 0} subtitle={`${ocorrencias?.abertas ?? 0} abertas`} />
      </div>
    </DashboardSection>
  );
}

export function OperationalAlertsSection({ alertas, ocorrencias }) {
  return (
    <DashboardSection title="Alertas operacionais" subtitle="Pendências que exigem atuação da gestão.">
      <div style={styles.grid4}>
        <AlertCard title="Sem microchip" value={alertas.sem_microchip} />
        <AlertCard title="Sem tutor" value={alertas.sem_tutor} />
        <AlertCard title="Pendentes vacinação" value={alertas.pendentes_vacinacao} />
        <AlertCard title="Pendentes castração" value={alertas.pendentes_castracao} />
        <AlertCard title="Perdas ativas" value={ocorrencias?.perdas_ativas ?? 0} />
        <AlertCard title="Encontrados ativos" value={ocorrencias?.encontrados_ativos ?? 0} />
      </div>
    </DashboardSection>
  );
}

export function OperationalQueueSection({ operacaoFila, operacaoCampanhas, operacaoOcorrencias, observacao }) {
  return (
    <DashboardSection title="Fila operacional SMAD" subtitle="Pendências e etapas ativas de campanhas e ocorrências.">
      <div style={styles.grid4}>
        <AlertCard title="Itens ativos na fila" value={operacaoFila.total ?? 0} />
        <AlertCard title="Alta criticidade" value={operacaoFila.alta_criticidade ?? 0} />
        <AlertCard title="Itens vencidos" value={operacaoFila.vencidos ?? 0} />
        <AlertCard title="Perto do prazo" value={operacaoFila.em_atencao ?? 0} />
        <MetricCard title="Sem responsável" value={operacaoFila.sem_responsavel ?? 0} subtitle="Itens ainda não atribuidos" />
        <MetricCard title="Inscrições em triagem" value={operacaoCampanhas.pendentes_triagem ?? 0} subtitle={`${operacaoCampanhas.com_pendencia ?? 0} com pendencia`} />
        <MetricCard title="Inscrições agendadas" value={operacaoCampanhas.agendadas ?? 0} subtitle={`${operacaoCampanhas.aptas_agendamento ?? 0} aptas a agendar`} />
        <MetricCard title="Ocorrências recebidas" value={operacaoOcorrencias.recebidas ?? 0} subtitle={`${operacaoOcorrencias.em_analise ?? 0} em analise`} />
        <MetricCard title="Ocorrências em atendimento" value={operacaoOcorrencias.em_atendimento ?? 0} subtitle={`${operacaoOcorrencias.pendentes_informacao ?? 0} com pendencia`} />
      </div>
      {observacao ? <p style={styles.note}>{observacao}</p> : null}
    </DashboardSection>
  );
}

export function TerritorialBiSection({
  territorioFiltro,
  onTerritorioFiltroChange,
  territorioOptions,
  biDemanda,
  biCobertura,
  visibleBiTerritorialRows,
  visibleDemandaBairro,
  visibleCoberturaBairro,
  biTerritorial,
  gestaoTerritorial,
  biSeries,
  biCampanhas,
  qualidadeTerritorial,
}) {
  return (
    <DashboardSection title="BI territorial" subtitle="Bairros, demanda reprimida, vacinação e ocorrências da base cadastrada.">
      <label style={styles.filterField}>
        <span>Filtro territorial</span>
        <select
          value={territorioFiltro}
          onChange={(event) => onTerritorioFiltroChange(event.target.value)}
          style={styles.filterInput}
        >
          <option value="">Todos os territórios</option>
          {territorioOptions.map((territorio) => (
            <option key={territorio} value={territorio}>
              {territorio}
            </option>
          ))}
        </select>
      </label>

      <div style={styles.grid4}>
        <MetricCard
          title="Demanda reprimida operacional"
          value={biDemanda?.totais?.total_operacional_reprimido ?? 0}
          subtitle={`${biDemanda?.totais?.campanha_inscricoes_pendentes ?? 0} inscricoes / ${biDemanda?.totais?.ocorrencias_ativas ?? 0} ocorrencias`}
        />
        <MetricCard
          title="Base com carteira estruturada"
          value={biCobertura?.geral?.animais_com_vacinacao_estruturada ?? 0}
          subtitle={`${biCobertura?.geral?.percentual_base_cadastrada ?? 0}% dos animais cadastrados`}
        />
        <MetricCard
          title="Registros vacinais ativos"
          value={biCobertura?.geral?.registros_ativos ?? 0}
          subtitle={`${biCobertura?.geral?.animais_apenas_legado ?? 0} animais ainda so com legado`}
        />
        <AlertCard
          title="Territórios sem bairro informado"
          value={visibleBiTerritorialRows.filter((item) => item.bairro === 'Não informado').reduce((acc, item) => acc + Number(item.animais || 0), 0)}
        />
        <MetricCard
          title="Aliases territoriais ativos"
          value={gestaoTerritorial?.aliases?.ativos ?? 0}
          subtitle={`${gestaoTerritorial?.territorios?.homologados ?? 0} territorios homologados`}
        />
        <AlertCard
          title="Legado territorial pendente"
          value={gestaoTerritorial?.revisoes?.pendentes_legado ?? 0}
        />
      </div>

      {biTerritorial?.metodologia?.limites?.length ? (
        <div style={styles.methodBox}>
          {biTerritorial.metodologia.limites.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      ) : null}

      <div style={styles.twoColumns}>
        <MiniTable
          title="Pressao por bairro"
          rows={visibleDemandaBairro}
          columns={[
            ['bairro', 'Bairro'],
            ['campanha_demanda_reprimida', 'Campanhas'],
            ['ocorrencias_ativas', 'Ocorrências'],
            ['fila_vencida', 'Vencidos'],
          ]}
        />
        <MiniTable
          title="Cobertura vacinal por bairro"
          rows={visibleCoberturaBairro}
          columns={[
            ['bairro', 'Bairro'],
            ['animais', 'Animais'],
            ['animais_com_vacinacao_estruturada', 'Carteira'],
            ['percentual_base_cadastrada', '% base'],
          ]}
        />
        <MiniTable
          title="Series historicas mensais"
          rows={biSeries}
          columns={[
            ['periodo', 'Periodo'],
            ['campanha_inscricoes', 'Inscrições'],
            ['campanha_atendimentos', 'Atend.'],
            ['vacinacoes_estruturadas', 'Vacinas'],
            ['ocorrencias_registradas', 'Ocorr.'],
          ]}
        />
        <MiniTable
          title="Campanhas e resultados"
          rows={biCampanhas}
          columns={[
            ['nome', 'Campanha'],
            ['inscricoes', 'Inscrições'],
            ['atendidas', 'Atendidas'],
            ['demanda_reprimida', 'Reprimida'],
            ['vacinas_aplicadas_estruturadas', 'Vacinas'],
          ]}
        />
        <MiniTable
          title="Qualidade territorial"
          rows={qualidadeTerritorial}
          columns={[
            ['modulo', 'Módulo'],
            ['total', 'Total'],
            ['controlado', 'Catálogo'],
            ['legado_textual', 'Legado'],
            ['nao_informado', 'Não informado'],
            ['percentual_controlado', '% catálogo'],
          ]}
        />
      </div>
    </DashboardSection>
  );
}

export function VaccinationSection({ vacinacaoTotais, vacinacao }) {
  return (
    <DashboardSection title="Painel vacinal" subtitle="Cobertura estruturada por origem, campanha e comprovação.">
      <div style={styles.grid4}>
        <MetricCard
          title="Registros estruturados"
          value={vacinacaoTotais.registros_ativos ?? 0}
          subtitle={`${vacinacaoTotais.animais_com_registro_estruturado ?? 0} animais com carteira`}
        />
        <MetricCard
          title="Vindos de campanha"
          value={vacinacaoTotais.registros_campanha ?? 0}
          subtitle={`${vacinacaoTotais.registros_campanha_estruturados ?? 0} estruturados / ${vacinacaoTotais.registros_campanha_genericos ?? 0} genericos`}
        />
        <MetricCard
          title="Com comprovante"
          value={vacinacaoTotais.registros_com_documento ?? 0}
          subtitle={`${vacinacaoTotais.registros_comprovados ?? 0} registros comprovados`}
        />
        <MetricCard
          title="Legado importado"
          value={vacinacaoTotais.registros_legado_importados ?? 0}
          subtitle={`${vacinacaoTotais.animais_apenas_legado_jsonb ?? 0} animais ainda so no legado`}
        />
      </div>

      {vacinacao?.observacao ? <p style={styles.note}>{vacinacao.observacao}</p> : null}

      <div style={styles.twoColumns}>
        <MiniTable
          title="Vacinas mais registradas"
          rows={vacinacao?.por_vacina || []}
          columns={[
            ['vacina', 'Vacina'],
            ['registros', 'Registros'],
            ['campanha_estruturados', 'Estruturados'],
          ]}
        />
        <MiniTable
          title="Origem dos registros"
          rows={vacinacao?.por_origem || []}
          columns={[
            ['origem_registro', 'Origem'],
            ['registros', 'Registros'],
            ['animais', 'Animais'],
          ]}
        />
        <MiniTable
          title="Campanhas"
          rows={vacinacao?.por_campanha || []}
          columns={[
            ['campanha', 'Campanha'],
            ['registros', 'Registros'],
            ['estruturados', 'Estruturados'],
            ['genericos', 'Genericos'],
          ]}
        />
        <MiniTable
          title="Bairros"
          rows={vacinacao?.por_bairro || []}
          columns={[
            ['bairro', 'Bairro'],
            ['registros', 'Registros'],
            ['registros_campanha', 'Campanha'],
          ]}
        />
      </div>
    </DashboardSection>
  );
}

export function DataQualitySection({ qualidadeAnimais, qualidadeTutores, saneamento, qualidade }) {
  return (
    <DashboardSection title="Qualidade cadastral" subtitle="Sinais para saneamento de duplicidade, completude e confiabilidade.">
      <div style={styles.grid4}>
        <AlertCard title="Animais baixa confiabilidade" value={qualidadeAnimais.baixa_confiabilidade ?? 0} />
        <AlertCard title="Tutores baixa confiabilidade" value={qualidadeTutores.baixa_confiabilidade ?? 0} />
        <AlertCard title="Animais com alerta duplicidade" value={qualidadeAnimais.com_alerta_duplicidade ?? 0} />
        <AlertCard title="Tutores com alerta duplicidade" value={qualidadeTutores.com_alerta_duplicidade ?? 0} />
        <MetricCard title="Animais sem microchip" value={qualidadeAnimais.sem_microchip ?? 0} subtitle="Afeta rastreabilidade cadastral" />
        <MetricCard title="Tutores sem contato mínimo" value={qualidadeTutores.sem_contato_minimo ?? 0} subtitle="Sem email e sem telefone" />
        <MetricCard title="Animais alta confiabilidade" value={qualidadeAnimais.alta_confiabilidade ?? 0} subtitle={`${qualidadeAnimais.media_confiabilidade ?? 0} em nivel medio`} />
        <MetricCard title="Tutores alta confiabilidade" value={qualidadeTutores.alta_confiabilidade ?? 0} subtitle={`${qualidadeTutores.media_confiabilidade ?? 0} em nivel medio`} />
        <AlertCard title="Casos de saneamento pendentes" value={saneamento.pendentes ?? 0} />
        <MetricCard title="Merges de tutores" value={saneamento.merges_realizados ?? 0} subtitle={`${saneamento.criticos_abertos ?? 0} casos criticos abertos`} />
      </div>

      {qualidade?.observacao ? <p style={styles.note}>{qualidade.observacao}</p> : null}

      <div style={styles.twoColumns}>
        <MiniTable
          title="Animais com possível duplicidade"
          rows={qualidade?.duplicidades?.animais || []}
          columns={[
            ['nome', 'Animal'],
            ['tutor_nome', 'Tutor'],
            ['confiabilidade_score', 'Score'],
          ]}
        />
        <MiniTable
          title="Tutores com possível duplicidade"
          rows={qualidade?.duplicidades?.tutores || []}
          columns={[
            ['nome', 'Tutor'],
            ['cpf', 'Documento'],
            ['confiabilidade_score', 'Score'],
          ]}
        />
      </div>
    </DashboardSection>
  );
}

export function StatusOverviewSection({ por_status }) {
  return (
    <DashboardSection title="Situação por status" subtitle="Distribuicao operacional dos registros.">
      <div style={styles.statusGrid}>
        <StatusCard label="Ativo" value={por_status.ativo ?? 0} />
        <StatusCard label="Acompanhamento" value={por_status.acompanhamento ?? 0} />
        <StatusCard label="Tratamento" value={por_status.tratamento ?? 0} />
        <StatusCard label="Disponível para adoao" value={por_status.disponivel_adocao ?? 0} />
        <StatusCard label="Adotado" value={por_status.adotado ?? 0} />
        <StatusCard label="Inativo" value={por_status.inativo ?? 0} />
      </div>
    </DashboardSection>
  );
}

export function TerritorializationSection({ rows }) {
  return (
    <DashboardSection title="Territorializacao" subtitle="Leitura por bairro para orientar a política pública.">
      {!rows || rows.length === 0 ? (
        <p>Nenhum dado territorial informado ainda.</p>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Bairro</th>
                <th style={styles.th}>Animais</th>
                <th style={styles.th}>Castrados</th>
                <th style={styles.th}>Vacinados</th>
                <th style={styles.th}>Microchipados</th>
                <th style={styles.th}>Inscrições</th>
                <th style={styles.th}>Demanda</th>
                <th style={styles.th}>Ocorrências ativas</th>
                <th style={styles.th}>% catálogo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.bairro}>
                  <td style={styles.td}>{item.bairro}</td>
                  <td style={styles.td}>{item.animais}</td>
                  <td style={styles.td}>{item.castrados}</td>
                  <td style={styles.td}>{item.vacinados}</td>
                  <td style={styles.td}>{item.microchipados}</td>
                  <td style={styles.td}>{item.campanha_inscricoes ?? '-'}</td>
                  <td style={styles.td}>{item.campanha_demanda_reprimida ?? '-'}</td>
                  <td style={styles.td}>{item.ocorrencias_ativas ?? item.ocorrencias_abertas ?? '-'}</td>
                  <td style={styles.td}>{item.territorio_controlado_percentual ?? 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardSection>
  );
}
