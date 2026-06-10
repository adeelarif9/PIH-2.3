// ── PIH NUTRITION DASHBOARD — SIDE-BY-SIDE COMPARISON ──

let _compareData = null;
let _compareRows = [];

const COMPARE_DIMENSIONS = {
  site:             { fr: 'Site', en: 'Site' },
  program:          { fr: 'Programme', en: 'Program' },
  typeIntervention: { fr: "Type d'intervention", en: 'Intervention type' },
  sex:              { fr: 'Sexe', en: 'Sex' },
  ageGroup:         { fr: "Groupe d'âge", en: 'Age group' },
  siteProgram:      { fr: 'Site + programme', en: 'Site + program' },
  typeProgram:      { fr: 'Type + programme', en: 'Type + program' },
};

function comparePct(n, d) {
  return d > 0 ? Math.round(n / d * 100) : null;
}

function compareAvg(vals) {
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
}

function compareValue(val, fallback = 'Non renseigné / Missing') {
  return val === null || val === undefined || val === '' ? fallback : String(val);
}

function compareAgeGroup(ageMonths) {
  if (ageMonths === null || ageMonths === undefined) return 'Non renseigné / Missing';
  if (ageMonths <= 5) return '0-5 mois';
  if (ageMonths <= 11) return '6-11 mois';
  if (ageMonths <= 23) return '12-23 mois';
  if (ageMonths <= 59) return '24-59 mois';
  return '>= 60 mois';
}

function compareGroupLabel(ep, dimension) {
  if (dimension === 'site') return compareValue(ep.site);
  if (dimension === 'program') return compareValue(ep.program);
  if (dimension === 'typeIntervention') return compareValue(ep.typeIntervention);
  if (dimension === 'sex') return compareValue(ep.sex);
  if (dimension === 'ageGroup') return compareAgeGroup(ep.ageMonths);
  if (dimension === 'siteProgram') return `${compareValue(ep.site)} / ${compareValue(ep.program)}`;
  if (dimension === 'typeProgram') return `${compareValue(ep.typeIntervention)} / ${compareValue(ep.program)}`;
  return 'Tous / All';
}

function compareProgramMix(episodes) {
  return {
    PNS: episodes.filter(e => e.program === 'PNS').length,
    PTA: episodes.filter(e => e.program === 'PTA').length,
    USN: episodes.filter(e => e.program === 'USN').length,
  };
}

function computeCompareMetrics(label, episodes) {
  const total       = episodes.length;
  const exited      = episodes.filter(e => e.outcome !== null);
  const recovered   = exited.filter(e => e.outcome === 'Guéri').length;
  const defaulted   = exited.filter(e => e.outcome === 'Abandon').length;
  const transferred = exited.filter(e => e.outcome === 'Transféré').length;
  const deceased    = exited.filter(e => e.outcome === 'Décédé').length;
  const losVals     = episodes.filter(e => e.losdays !== null).map(e => e.losdays);
  const visitVals   = episodes.filter(e => e.visitCount !== null && e.visitCount !== undefined).map(e => e.visitCount);
  const wgVals      = episodes.filter(e => e.weightGainG !== null).map(e => e.weightGainG);
  const mix         = compareProgramMix(episodes);

  return {
    label,
    total,
    exited: exited.length,
    active: total - exited.length,
    recovered,
    defaulted,
    transferred,
    deceased,
    recoveryRate: comparePct(recovered, exited.length),
    defaultRate: comparePct(defaulted, exited.length),
    avgLOS: compareAvg(losVals),
    avgVisits: compareAvg(visitVals),
    avgWeightGain: compareAvg(wgVals),
    PNS: mix.PNS,
    PTA: mix.PTA,
    USN: mix.USN,
  };
}

function buildCompareRows(episodes, dimension, minN, sortKey) {
  const groups = {};
  for (const ep of episodes) {
    const label = compareGroupLabel(ep, dimension);
    if (!groups[label]) groups[label] = [];
    groups[label].push(ep);
  }

  const rows = Object.entries(groups)
    .map(([label, eps]) => computeCompareMetrics(label, eps))
    .filter(r => r.total >= minN);

  rows.sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av === null && bv === null) return a.label.localeCompare(b.label);
    if (av === null) return 1;
    if (bv === null) return -1;
    if (bv !== av) return bv - av;
    return a.label.localeCompare(b.label);
  });

  return rows;
}

function compareFmt(value, suffix = '') {
  return value === null || value === undefined ? '-' : `${value}${suffix}`;
}

function renderCompareStats(episodes, rows) {
  const el = document.getElementById('compare-stat-grid');
  if (!el) return;
  const groups = rows.length;
  const exited = episodes.filter(e => e.outcome !== null);
  const recovered = exited.filter(e => e.outcome === 'Guéri').length;
  const defaulted = exited.filter(e => e.outcome === 'Abandon').length;
  const avgLOS = compareAvg(episodes.filter(e => e.losdays !== null).map(e => e.losdays));

  el.innerHTML = `
    ${statCard('Admissions filtrées', 'Filtered admissions', episodes.length, `${groups} groupes comparés`, 'blue')}
    ${statCard('Taux de guérison', 'Recovery rate', compareFmt(comparePct(recovered, exited.length), '%'), `${recovered} / ${exited.length} sortis`, 'green')}
    ${statCard("Taux d'abandon", 'Default rate', compareFmt(comparePct(defaulted, exited.length), '%'), `${defaulted} patients`, 'yellow')}
    ${statCard('Durée séjour moy.', 'Avg. length of stay', compareFmt(avgLOS), 'jours / days', 'blue')}
  `;
}

function renderCompareTable(rows) {
  const tbody = document.getElementById('compare-table-body');
  if (!tbody) return;

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;color:var(--gray-400);padding:24px;">
      Aucun groupe avec assez de données / No groups meet the selected minimum size
    </td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td class="compare-group-cell" title="${r.label}">${r.label}</td>
      <td style="font-weight:700;">${r.total}</td>
      <td>${r.exited}</td>
      <td style="color:var(--green);font-weight:700;">${r.recovered}</td>
      <td style="color:var(--yellow);font-weight:700;">${r.defaulted}</td>
      <td>${compareFmt(r.recoveryRate, '%')}</td>
      <td>${compareFmt(r.defaultRate, '%')}</td>
      <td>${compareFmt(r.avgLOS, 'j')}</td>
      <td>${compareFmt(r.avgVisits)}</td>
      <td>${compareFmt(r.avgWeightGain, 'g')}</td>
      <td><span style="color:var(--green);font-weight:700;">${r.PNS}</span>/<span style="color:var(--blue);font-weight:700;">${r.PTA}</span>/<span style="color:var(--pih-red);font-weight:700;">${r.USN}</span></td>
    </tr>
  `).join('');
}

function renderCompareChart(containerId, rows, key, suffix, color, emptyMsg) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const data = rows
    .filter(r => r[key] !== null && r[key] !== undefined)
    .slice(0, 12);

  if (data.length === 0) {
    el.innerHTML = noDataHtml(emptyMsg || 'Aucune donnée / No data');
    return;
  }

  const max = Math.max(...data.map(r => r[key]), 1);
  el.innerHTML = data.map(r => `
    <div class="compare-bar-row">
      <div class="compare-bar-label" title="${r.label}">${r.label}</div>
      <div class="compare-bar-track">
        <div class="compare-bar-fill" style="width:${r[key] / max * 100}%;background:${color};"></div>
      </div>
      <div class="compare-bar-value">${r[key]}${suffix}</div>
    </div>
  `).join('');
}

function compareRowsToCSV(rows) {
  return rows.map(r => ({
    groupe: r.label,
    admissions: r.total,
    sortis: r.exited,
    actifs: r.active,
    gueris: r.recovered,
    abandons: r.defaulted,
    transferes: r.transferred,
    decedes: r.deceased,
    taux_guerison_pct: r.recoveryRate !== null ? r.recoveryRate : '',
    taux_abandon_pct: r.defaultRate !== null ? r.defaultRate : '',
    duree_sejour_moy_j: r.avgLOS !== null ? r.avgLOS : '',
    visites_moy: r.avgVisits !== null ? r.avgVisits : '',
    gain_poids_moy_g: r.avgWeightGain !== null ? r.avgWeightGain : '',
    pns: r.PNS,
    pta: r.PTA,
    usn: r.USN,
  }));
}

function compareRender() {
  if (!_compareData) return;

  const dimension = document.getElementById('compare-dimension')?.value || 'site';
  const program   = document.getElementById('compare-program')?.value || '';
  const minN      = parseInt(document.getElementById('compare-min-n')?.value || '1', 10);
  const sortKey   = document.getElementById('compare-sort')?.value || 'total';
  const filters   = getFilters();
  let episodes    = getFilteredEpisodes(_compareData.cases, filters);

  if (program) episodes = episodes.filter(e => e.program === program);

  _compareRows = buildCompareRows(episodes, dimension, minN, sortKey);

  const dim = COMPARE_DIMENSIONS[dimension] || COMPARE_DIMENSIONS.site;
  const summary = document.getElementById('compare-summary');
  if (summary) {
    summary.textContent = `${dim.fr} / ${dim.en} · ${episodes.length} admissions filtrées · ${_compareRows.length} groupes affichés`;
  }

  renderCompareStats(episodes, _compareRows);
  renderCompareTable(_compareRows);
  renderCompareChart('compare-recovery-chart', _compareRows, 'recoveryRate', '%', 'var(--green)', 'Aucun résultat de sortie / No exit outcomes');
  renderCompareChart('compare-default-chart', _compareRows, 'defaultRate', '%', 'var(--yellow)', 'Aucun résultat de sortie / No exit outcomes');
  renderCompareChart('compare-los-chart', _compareRows, 'avgLOS', 'j', 'var(--blue)', 'Aucune durée de séjour / No LOS data');
  renderCompareChart('compare-weight-chart', _compareRows, 'avgWeightGain', 'g', 'var(--pih-red)', 'Aucun gain de poids / No weight gain data');

  const exportBtn = document.getElementById('compare-export-btn');
  if (exportBtn) exportBtn.onclick = () => exportCSV(compareRowsToCSV(_compareRows), 'pih_comparaison.csv');
}

function initCompareControls() {
  ['compare-dimension', 'compare-program', 'compare-min-n', 'compare-sort',
   'date-start', 'date-end', 'filter-site', 'filter-type', 'filter-sex', 'filter-age']
    .forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        if (id === 'date-start' || id === 'date-end') {
          document.querySelectorAll('.date-quick-btn').forEach(b => b.classList.remove('active'));
        }
        compareRender();
      });
    });

  document.querySelectorAll('.date-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.date-quick-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const days = btn.dataset.days;
      if (days === 'all') {
        document.getElementById('date-start').value = '';
        document.getElementById('date-end').value = '';
      } else {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - parseInt(days, 10));
        document.getElementById('date-start').value = start.toISOString().slice(0, 10);
        document.getElementById('date-end').value = end.toISOString().slice(0, 10);
      }

      compareRender();
    });
  });
}

async function initCompare() {
  if (!document.getElementById('compare-table-body')) return;
  _compareData = await loadDashboardData();

  if (!_compareData) {
    document.getElementById('no-data-banner').style.display = 'block';
    document.getElementById('analytics-content').style.display = 'none';
    return;
  }

  document.getElementById('analytics-content').style.display = 'block';
  populateSiteFilter(_compareData.cases);
  initCompareControls();
  document.querySelector('.date-quick-btn[data-days="all"]')?.classList.add('active');
  compareRender();
}

document.addEventListener('DOMContentLoaded', initCompare);
