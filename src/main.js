(function () {
  const STORAGE_KEYS = {
    session: "cirugiahls-session",
    activeCases: "cirugiahls-active-cases",
    history: "cirugiahls-history-cases",
  };

  const DEFAULT_CREDENTIALS = {
    username: "admin@cirugiahls.cl",
    password: "CirugiaHLS2026!",
    name: "Equipo de Cirugia",
  };

  const TEAM_OPTIONS = [
    { value: "Torax", label: "Torax", bg: "#f3e8ff", color: "#6d28d9", border: "#ddd6fe", line: "#8b5cf6" },
    { value: "Digestivo Alto", label: "Digestivo Alto", bg: "#fef9c3", color: "#a16207", border: "#fde68a", line: "#ca8a04" },
    { value: "Coloproctologia", label: "Coloproctologia", bg: "#fef3c7", color: "#92400e", border: "#fcd34d", line: "#92400e" },
    { value: "Cabeza y Cuello", label: "Cabeza y Cuello", bg: "#e2e8f0", color: "#1e3a8a", border: "#cbd5e1", line: "#1e3a8a" },
    { value: "Mama", label: "Mama", bg: "#ffedd5", color: "#c2410c", border: "#fdba74", line: "#ea580c" },
    { value: "Vascular", label: "Vascular", bg: "#dcfce7", color: "#15803d", border: "#86efac", line: "#16a34a" },
    { value: "General", label: "General", bg: "#e0f2fe", color: "#0369a1", border: "#7dd3fc", line: "#0ea5e9" },
    { value: "Medicina y Otros", label: "Medicina y Otros", bg: "#ffe4e6", color: "#be123c", border: "#fda4af", line: "#dc2626" },
  ];

  const SECTORS = [
    {
      key: "hombres",
      name: "Sector Hombres",
      start: 115,
      end: 140,
      rooms: [
        { name: "Sala 1", start: 115, end: 120 },
        { name: "Sala 2", start: 121, end: 126 },
        { name: "Sala 3", start: 127, end: 129 },
        { name: "Sala 4", start: 130, end: 132 },
        { name: "Sala 5", start: 133, end: 134 },
        { name: "Sala 6", start: 135, end: 136 },
        { name: "Sala 7", start: 137, end: 138 },
        { name: "Sala 8", start: 139, end: 140 },
      ],
    },
    {
      key: "mujeres",
      name: "Sector Mujeres",
      start: 141,
      end: 160,
      rooms: [
        { name: "Sala 1", start: 141, end: 143 },
        { name: "Sala 2", start: 144, end: 145 },
        { name: "Sala 3", start: 146, end: 149 },
        { name: "Sala 4", start: 150, end: 151 },
        { name: "Sala 5", start: 152, end: 154 },
        { name: "Sala 6", start: 155, end: 160 },
      ],
    },
    {
      key: "uceq",
      name: "Sector UCEQ",
      start: 161,
      end: 165,
      rooms: [{ name: "UCEQ", start: 161, end: 165 }],
    },
  ];

  const DEFAULT_EXAMS = ["Hemoglobina", "Leucocitos", "PCR", "Creatinina", "Lactato"];

  const state = {
    view: "dashboard",
    session: readStorage(STORAGE_KEYS.session, null),
    activeCases: readStorage(STORAGE_KEYS.activeCases, {}),
    history: readStorage(STORAGE_KEYS.history, []),
    modal: null,
    releaseCase: null,
    reactivateCase: null,
    loginError: "",
    historyExpandedId: null,
    historyFilters: {
      search: "",
      sector: "",
      team: "",
      dischargeFrom: "",
      dischargeTo: "",
      surgeon: "",
      diagnosis: "",
      surgeryName: "",
    },
    dashboardTeamFilters: [],
    showHeaderStats: false,
    showDashboardFilters: false,
    showHistoryFilters: false,
  };

  const app = document.getElementById("app");

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function readStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function saveActiveCases() {
    writeStorage(STORAGE_KEYS.activeCases, state.activeCases);
  }

  function saveHistory() {
    writeStorage(STORAGE_KEYS.history, state.history);
  }

  function saveSession() {
    writeStorage(STORAGE_KEYS.session, state.session);
  }

  function nowIsoDate() {
    return new Date().toISOString().slice(0, 10);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function getBeds() {
    const beds = [];
    SECTORS.forEach((sector) => {
      sector.rooms.forEach((room) => {
        for (let number = room.start; number <= room.end; number += 1) {
          beds.push({
            bedNumber: number,
            sector: sector.name,
            sectorKey: sector.key,
            roomName: room.name,
          });
        }
      });
    });
    return beds;
  }

  function getTeam(teamValue) {
    return TEAM_OPTIONS.find((team) => team.value === teamValue) || TEAM_OPTIONS[0];
  }

  function getDayCount(admissionDate, dischargeDate) {
    if (!admissionDate) return 0;
    const start = new Date(`${admissionDate}T00:00:00`);
    const end = new Date(`${dischargeDate || nowIsoDate()}T00:00:00`);
    const diff = Math.max(0, end.getTime() - start.getTime());
    return Math.floor(diff / 86400000) + 1;
  }

  function emptyCase(bed) {
    const labs = {};
    DEFAULT_EXAMS.forEach((exam) => {
      labs[exam] = {};
    });
    return {
      id: uid(),
      bedNumber: bed.bedNumber,
      sector: bed.sector,
      patientName: "",
      rut: "",
      admissionDate: nowIsoDate(),
      dischargeDate: "",
      team: TEAM_OPTIONS[0].value,
      tags: [],
      diagnoses: [""],
      surgeries: [{ id: uid(), name: "", date: "", surgeon: "" }],
      labs: { dates: [nowIsoDate()], exams: labs },
      images: [],
      notes: "",
      noteDraft: "",
      notesEntries: [],
    };
  }

  function occupancyStats() {
    const beds = getBeds();
    return SECTORS.map((sector) => {
      const sectorBeds = beds.filter((bed) => bed.sectorKey === sector.key);
      const occupied = sectorBeds.filter((bed) => state.activeCases[String(bed.bedNumber)]).length;
      return {
        sector: sector.name,
        occupied,
        free: sectorBeds.length - occupied,
        total: sectorBeds.length,
        percent: Math.round((occupied / sectorBeds.length) * 100),
      };
    });
  }

  function getSectorFilteredBeds(sectorBeds) {
    if (!state.dashboardTeamFilters.length) return sectorBeds;
    return sectorBeds.filter((bed) => {
      const caseData = state.activeCases[String(bed.bedNumber)];
      return caseData && state.dashboardTeamFilters.includes(caseData.team);
    });
  }

  function nextUniqueLabDate(existingDates, baseDate) {
    const used = new Set(existingDates.filter(Boolean));
    let current = baseDate || nowIsoDate();
    while (used.has(current)) {
      const date = new Date(`${current}T00:00:00`);
      date.setDate(date.getDate() + 1);
      current = date.toISOString().slice(0, 10);
    }
    return current;
  }

  function countActiveHistoryFilters() {
    return Object.values(state.historyFilters).filter((value) => String(value || "").trim()).length;
  }

  function getCaseNotesEntries(caseItem) {
    const entries = Array.isArray(caseItem.notesEntries) ? caseItem.notesEntries.filter((item) => String(item.text || "").trim()) : [];
    if (entries.length) return entries;
    if (String(caseItem.notes || "").trim()) {
      return [
        {
          id: uid(),
          text: caseItem.notes,
          createdAt: caseItem.updatedAt || caseItem.archivedAt || caseItem.createdAt || new Date().toISOString(),
        },
      ];
    }
    return [];
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("es-CL", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getPrimaryDiagnosis(caseItem) {
    return (caseItem.diagnoses || []).find((item) => String(item || "").trim()) || "";
  }

  function renderNotesHistory(caseItem) {
    const entries = getCaseNotesEntries(caseItem);
    if (!entries.length) {
      return `<div style="margin-top:12px; color:#78716c;">Sin notas registradas.</div>`;
    }
    return `
      <div class="stack" style="margin-top:12px;">
        ${entries
          .slice()
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
          .map(
            (entry) => `
              <div class="card" style="box-shadow:none; background:white; padding:14px;">
                <div class="small" style="margin-bottom:8px;">${formatDateTime(entry.createdAt)}</div>
                <div style="white-space:pre-wrap; line-height:1.7; color:#57534e;">${escapeHtml(entry.text || "")}</div>
              </div>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function matchesFilters(caseItem) {
    const filters = state.historyFilters;
    const bundle = [
      caseItem.patientName,
      caseItem.rut,
      caseItem.bedNumber,
      caseItem.sector,
      caseItem.notes,
      ...getCaseNotesEntries(caseItem).map((item) => item.text),
      ...(caseItem.diagnoses || []),
      ...((caseItem.surgeries || []).map((item) => `${item.name} ${item.surgeon}`)),
    ]
      .join(" ")
      .toLowerCase();

    if (filters.search && !bundle.includes(filters.search.toLowerCase())) return false;
    if (filters.sector && caseItem.sector !== filters.sector) return false;
    if (filters.team && caseItem.team !== filters.team) return false;
    if (filters.dischargeFrom && (caseItem.dischargeDate || "") < filters.dischargeFrom) return false;
    if (filters.dischargeTo && (caseItem.dischargeDate || "") > filters.dischargeTo) return false;
    if (
      filters.surgeon &&
      !(caseItem.surgeries || []).some((item) => (item.surgeon || "").toLowerCase().includes(filters.surgeon.toLowerCase()))
    ) return false;
    if (
      filters.diagnosis &&
      !(caseItem.diagnoses || []).some((item) => (item || "").toLowerCase().includes(filters.diagnosis.toLowerCase()))
    ) return false;
    if (
      filters.surgeryName &&
      !(caseItem.surgeries || []).some((item) => (item.name || "").toLowerCase().includes(filters.surgeryName.toLowerCase()))
    ) return false;
    return true;
  }

  function render() {
    app.innerHTML = state.session ? renderApp() : renderLogin();
    bindGlobalEvents();
  }

  function renderLogin() {
    return `
      <div class="login-wrap">
        <div class="login-grid">
          <section class="login-card">
            ${renderHospitalBrand("Monitor de Pacientes", true)}
            <p class="lead">Gestion clinica precisa para camas quirurgicas, seguimiento longitudinal y archivo reutilizable de casos.</p>
            <div class="metrics">
              <div class="metric">
                <div class="stat-label">Camas fijas</div>
                <div class="metric-value">51</div>
              </div>
              <div class="metric">
                <div class="stat-label">Sectores</div>
                <div class="metric-value">3</div>
              </div>
              <div class="metric">
                <div class="stat-label">Equipos</div>
                <div class="metric-value">8</div>
              </div>
            </div>
          </section>
          <section class="login-card">
            <div class="stat-label">Acceso</div>
            <h2 style="margin-top:10px;">Iniciar sesion</h2>
            <p class="lead" style="margin-top:10px; max-width:unset;">La autenticacion es local para esta version. Todo queda guardado en este navegador.</p>
            <form id="login-form" class="stack" style="margin-top:28px;">
              <div class="field">
                <label>Correo</label>
                <input class="input" name="username" value="${escapeHtml(DEFAULT_CREDENTIALS.username)}" />
              </div>
              <div class="field">
                <label>Contrasena</label>
                <input class="input" name="password" type="password" value="${escapeHtml(DEFAULT_CREDENTIALS.password)}" />
              </div>
              ${state.loginError ? `<div class="error">${escapeHtml(state.loginError)}</div>` : ""}
              <button class="btn btn-dark" type="submit">Entrar a Monitor de Pacientes</button>
            </form>
            <div class="muted-box">
              Usuario demo: <strong>${escapeHtml(DEFAULT_CREDENTIALS.username)}</strong><br />
              Contrasena demo: <strong>${escapeHtml(DEFAULT_CREDENTIALS.password)}</strong>
            </div>
          </section>
        </div>
      </div>
    `;
  }

  function renderApp() {
    const beds = getBeds();
    const occupied = Object.keys(state.activeCases).length;
    const free = beds.length - occupied;
    const stats = occupancyStats();
    return `
      <div class="app-shell">
        <header class="header">
          <div class="container header-inner">
            <div class="header-top">
              <div>
                ${renderHospitalBrand("Monitor de Pacientes")}
                <p class="lead">Gestion activa de camas, seguimiento clinico y archivo estructurado de casos quirurgicos.</p>
              </div>
              <div class="row wrap">
                <div class="session-badge">${escapeHtml(state.session.name)}</div>
                <button class="btn btn-light" data-action="logout">Cerrar sesion</button>
              </div>
            </div>
            <div class="panel compact-panel">
              <div class="collapsible-head">
                <div class="collapsible-title">
                  <div style="font-weight:700;">Resumen de ocupacion</div>
                  <div class="small">Ocupadas ${occupied} · Libres ${free} · Total ${beds.length}</div>
                </div>
                <div class="row wrap">
                  <div class="compact-summary">
                    ${stats.map((item) => `<span class="compact-chip">${escapeHtml(item.sector)} ${item.percent}%</span>`).join("")}
                  </div>
                  <div class="tabs">
                    <button class="btn btn-compact ${state.view === "dashboard" ? "btn-dark" : "btn-light"}" data-view="dashboard">Tablero</button>
                    <button class="btn btn-compact ${state.view === "history" ? "btn-dark" : "btn-light"}" data-view="history">Historial</button>
                  </div>
                  ${
                    state.view === "dashboard"
                      ? `
                        ${state.dashboardTeamFilters.length ? `<button class="btn btn-ghost btn-compact" data-action="clear-dashboard-team-filters">Limpiar equipos</button>` : ""}
                        <button class="btn btn-ghost btn-compact" data-action="toggle-dashboard-filters">
                          ${state.showDashboardFilters ? "Ocultar equipos" : "Filtrar equipos"}
                        </button>
                      `
                      : ""
                  }
                  <button class="btn btn-ghost btn-compact" data-action="toggle-header-stats">
                    ${state.showHeaderStats ? "Ocultar detalle" : "Ver detalle"}
                  </button>
                </div>
              </div>
              ${
                state.view === "dashboard" && state.showDashboardFilters
                  ? `
                    <div class="collapsible-body">
                      <div class="row wrap">
                        ${TEAM_OPTIONS.map((team) => `
                          <button
                            class="team-badge"
                            data-action="toggle-dashboard-team-filter"
                            data-team="${escapeHtml(team.value)}"
                            style="background:${state.dashboardTeamFilters.includes(team.value) ? team.bg : "#fafaf9"}; color:${state.dashboardTeamFilters.includes(team.value) ? team.color : "#57534e"}; border-color:${state.dashboardTeamFilters.includes(team.value) ? team.border : "#d6d3d1"}; cursor:pointer;"
                          >
                            ${escapeHtml(team.label)}
                          </button>
                        `).join("")}
                      </div>
                    </div>
                  `
                  : ""
              }
              ${state.showHeaderStats ? `
                <div class="collapsible-body">
                  <div class="stats-grid">
                    ${renderStat("Camas ocupadas", occupied, `${free} libres en total`)}
                    ${renderStat("Camas libres", free, `${beds.length} camas habilitadas`)}
                    ${stats.map((item) => renderStat(item.sector, `${item.percent}%`, `${item.occupied} ocupadas / ${item.total} camas`)).join("")}
                  </div>
                </div>
              ` : ""}
            </div>
          </div>
        </header>
        <main class="main">
          <div class="container">
            ${state.view === "dashboard" ? renderDashboard() : renderHistory()}
          </div>
        </main>
        ${renderBedModal()}
        ${renderReleaseDialog()}
        ${renderReactivateDialog()}
      </div>
    `;
  }

  function renderStat(title, value, helper) {
    return `
      <div class="card">
        <div class="stat-label">${escapeHtml(title)}</div>
        <div class="stat-value">${escapeHtml(value)}</div>
        <div class="stat-help">${escapeHtml(helper)}</div>
      </div>
    `;
  }

  function renderHospitalBrand(title, large = false) {
    return `
      <div class="brand-lockup">
        <div class="brand-logo-wrap ${large ? "large" : ""}" aria-hidden="true">
          <img src="./logo1.png" alt="" class="brand-logo-banner ${large ? "large" : ""}" />
        </div>
        <div class="brand-meta">
          <div class="brand-hospital ${large ? "large" : ""}">Hospital de La Serena</div>
          <h1 style="margin:0; font-size:${large ? "clamp(30px, 4vw, 42px)" : "clamp(28px, 3.4vw, 40px)"};">${escapeHtml(title)}</h1>
          <div class="brand-subtle">Servicio de Cirugia</div>
        </div>
      </div>
    `;
  }

  function getRoomCardClass(sector, room) {
    const bedCount = room.end - room.start + 1;
    if (sector.key === "hombres") {
      const customMap = {
        "Sala 1": "span-12 beds-6",
        "Sala 2": "span-12 beds-6",
        "Sala 3": "span-6 beds-3",
        "Sala 4": "span-6 beds-3",
        "Sala 5": "span-3 beds-2-vertical",
        "Sala 6": "span-3 beds-2-vertical",
        "Sala 7": "span-3 beds-2-vertical",
        "Sala 8": "span-3 beds-2-vertical",
      };
      return customMap[room.name] || "span-6";
    }

    if (sector.key === "uceq") {
      return "span-12 beds-5";
    }

    if (bedCount <= 2) return "span-4 beds-2";
    if (bedCount <= 3) return "span-6 beds-3";
    if (bedCount <= 4) return "span-8 beds-4";
    if (bedCount <= 5) return "span-10 beds-5";
    return "span-12 beds-6";
  }

  function renderDashboard() {
    const beds = getBeds();
    return `
      ${SECTORS.map((sector) => {
      const sectorBeds = beds.filter((bed) => bed.sectorKey === sector.key);
      const occupied = sectorBeds.filter((bed) => state.activeCases[String(bed.bedNumber)]).length;
      const visibleBeds = getSectorFilteredBeds(sectorBeds);
      return `
        <section class="panel sector-section">
          <div class="section-top">
            <div>
              <h2>${escapeHtml(sector.name)}</h2>
              <p class="lead" style="margin-top:6px;">Camas ${sector.start} a ${sector.end}</p>
            </div>
            <div class="session-badge">${occupied} ocupadas / ${sectorBeds.length}</div>
          </div>
          ${
            visibleBeds.length
              ? `<div class="room-grid">
                  ${sector.rooms.map((room) => {
                    const roomBeds = visibleBeds.filter((bed) => bed.roomName === room.name);
                    if (!roomBeds.length) return "";
                    return `
                      <section class="item-card room-card ${getRoomCardClass(sector, room)}">
                        <div class="section-top" style="margin-bottom:14px;">
                          <div>
                            <h3>${escapeHtml(room.name)}</h3>
                            <div class="small" style="margin-top:6px;">Camas ${room.start} a ${room.end}</div>
                          </div>
                          <div class="session-badge">${roomBeds.filter((bed) => state.activeCases[String(bed.bedNumber)]).length} visibles</div>
                        </div>
                        <div class="sector-beds">
                          ${roomBeds.map((bed) => renderBedCard(bed)).join("")}
                        </div>
                      </section>
                    `;
                  }).join("")}
                </div>`
              : `<div class="empty-box">No hay camas para los equipos seleccionados en este sector.</div>`
          }
        </section>
      `;
    }).join("")}
    `;
  }

  function renderBedCard(bed) {
    const caseData = state.activeCases[String(bed.bedNumber)];
    if (!caseData) {
      return `
        <button class="bed-card" data-action="open-bed" data-bed="${bed.bedNumber}">
          <div class="bed-head">
            <div class="small">Cama ${bed.bedNumber}</div>
            <div class="status free">Libre</div>
          </div>
          <div class="bed-body">
            <div class="empty-box">Asignar paciente</div>
          </div>
        </button>
      `;
    }
    const team = getTeam(caseData.team);
    const primaryDiagnosis = getPrimaryDiagnosis(caseData);
    return `
      <button class="bed-card occupied" data-action="open-bed" data-bed="${bed.bedNumber}">
        <div class="bed-team-line" style="background:${team.line};"></div>
        <div class="bed-head">
          <div class="small">Cama ${bed.bedNumber}</div>
          <div class="status occupied">Ocupada</div>
        </div>
        <div class="bed-body">
          <div class="patient-name">${escapeHtml(caseData.patientName || "Sin nombre")}</div>
          ${primaryDiagnosis ? `<div class="small" style="margin-top:6px;">Dx: ${escapeHtml(primaryDiagnosis)}</div>` : ""}
          <div class="small" style="margin-top:8px;">${getDayCount(caseData.admissionDate, caseData.dischargeDate)} dias hospitalizado</div>
          <div class="small" style="margin-top:8px;">${escapeHtml(bed.roomName || bed.sector)}</div>
          <div class="tags">
            ${(caseData.tags || []).slice(0, 4).map((tag) => renderTag(tag)).join("")}
          </div>
        </div>
      </button>
    `;
  }

  function renderHistory() {
    const filtered = state.history.filter(matchesFilters);
    const activeFilterCount = countActiveHistoryFilters();
    return `
      <section class="panel compact-panel">
        <div class="collapsible-head">
          <div class="collapsible-title">
            <div style="font-weight:700;">Filtros del historial</div>
            <div class="small">
              ${
                activeFilterCount
                  ? `${activeFilterCount} filtro(s) activos · ${filtered.length} caso(s) visibles`
                  : `Sin filtros activos · ${filtered.length} caso(s) visibles`
              }
            </div>
          </div>
          <div class="row wrap">
            ${activeFilterCount ? `<button class="btn btn-ghost" data-action="clear-history-filters">Limpiar</button>` : ""}
            <button class="btn btn-ghost" data-action="toggle-history-filters">
              ${state.showHistoryFilters ? "Ocultar filtros" : "Mostrar filtros"}
            </button>
          </div>
        </div>
        ${state.showHistoryFilters ? `
          <div class="collapsible-body">
            <div class="filters-grid">
              ${renderField("Busqueda libre", "search", state.historyFilters.search)}
              ${renderSelectField("Sector", "sector", [
                { value: "", label: "Todos" },
                ...SECTORS.map((sector) => ({ value: sector.name, label: sector.name })),
              ], state.historyFilters.sector)}
              ${renderSelectField("Equipo", "team", [
                { value: "", label: "Todos" },
                ...TEAM_OPTIONS.map((team) => ({ value: team.value, label: team.label })),
              ], state.historyFilters.team)}
              ${renderField("Cirujano", "surgeon", state.historyFilters.surgeon)}
              ${renderField("Alta desde", "dischargeFrom", state.historyFilters.dischargeFrom, "date")}
              ${renderField("Alta hasta", "dischargeTo", state.historyFilters.dischargeTo, "date")}
              ${renderField("Diagnostico", "diagnosis", state.historyFilters.diagnosis)}
              ${renderField("Nombre de cirugia", "surgeryName", state.historyFilters.surgeryName)}
            </div>
          </div>
        ` : ""}
      </section>
      <section class="history-list" style="margin-top:18px;">
        ${
          filtered.length
            ? filtered.map((caseItem) => renderHistoryCard(caseItem)).join("")
            : `<div class="panel" style="text-align:center; color:#78716c;">No hay casos archivados que coincidan con los filtros.</div>`
        }
      </section>
    `;
  }

  function renderHistoryCard(caseItem) {
    const team = getTeam(caseItem.team);
    const expanded = state.historyExpandedId === caseItem.id;
    return `
      <article class="panel">
        <div class="history-top">
          <div>
            <div class="row wrap">
              <h2 style="font-size:28px;">${escapeHtml(caseItem.patientName)}</h2>
              ${renderTeamBadge(team)}
              <div class="session-badge">Cama ${caseItem.bedNumber} · ${escapeHtml(caseItem.sector)}</div>
            </div>
            <div class="tags">${(caseItem.tags || []).map((tag) => renderTag(tag)).join("")}</div>
            <p class="meta-line">RUT ${escapeHtml(caseItem.rut)} · Ingreso ${escapeHtml(caseItem.admissionDate || "-")} · Alta ${escapeHtml(caseItem.dischargeDate || "-")} · ${caseItem.daysHospitalized || getDayCount(caseItem.admissionDate, caseItem.dischargeDate)} dias hospitalizado</p>
          </div>
          <div class="history-actions">
            <button class="btn btn-light" data-action="toggle-history" data-case-id="${caseItem.id}">
              ${expanded ? "Ocultar detalles" : "Ver detalles"}
            </button>
            <button class="btn btn-dark" data-action="open-reactivate" data-case-id="${caseItem.id}">
              Reactivar caso
            </button>
          </div>
        </div>
        ${expanded ? renderCaseDetail(caseItem) : ""}
      </article>
    `;
  }

  function renderCaseDetail(caseItem) {
    const examNames = Object.keys((caseItem.labs && caseItem.labs.exams) || {});
    const selectedExam = caseItem.chartExam && examNames.includes(caseItem.chartExam) ? caseItem.chartExam : examNames[0];
    return `
      <div class="subgrid two" style="margin-top:22px;">
        <div class="stack">
          <div class="item-card">
            <h3>Diagnosticos</h3>
            <div class="stack" style="margin-top:12px;">
              ${(caseItem.diagnoses || []).map((item) => `<div>${escapeHtml(item)}</div>`).join("") || "<div class='small'>Sin diagnosticos.</div>"}
            </div>
          </div>
          <div class="item-card">
            <h3>Cirugias</h3>
            <div class="stack" style="margin-top:12px;">
              ${(caseItem.surgeries || []).map((item) => `
                <div class="card" style="box-shadow:none; background:white; padding:14px;">
                  <div style="font-weight:700;">${escapeHtml(item.name || "Cirugia sin nombre")}</div>
                  <div class="small" style="margin-top:8px;">Fecha: ${escapeHtml(item.date || "-")}</div>
                  <div class="small">Primer cirujano: ${escapeHtml(item.surgeon || "-")}</div>
                </div>
              `).join("") || "<div class='small'>Sin cirugias.</div>"}
            </div>
          </div>
          <div class="item-card">
            <h3>Notas</h3>
            ${renderNotesHistory(caseItem)}
          </div>
        </div>
        <div class="stack">
          <div class="item-card">
            <div class="section-top" style="margin-bottom:14px;">
              <h3>Laboratorio</h3>
              <select class="select" style="max-width:220px;" data-action="history-chart-exam" data-case-id="${caseItem.id}">
                ${examNames.map((exam) => `<option value="${escapeHtml(exam)}" ${selectedExam === exam ? "selected" : ""}>${escapeHtml(exam)}</option>`).join("")}
              </select>
            </div>
            <div class="labs-wrap">${renderLabsTable(caseItem)}</div>
            <div style="margin-top:14px;" class="chart-box">
              ${renderChart(caseItem.labs, selectedExam, getTeam(caseItem.team).line)}
            </div>
          </div>
          <div class="item-card">
            <h3>Imagenes</h3>
            <div class="gallery" style="margin-top:12px;">
              ${(caseItem.images || []).length
                ? caseItem.images.map((image) => `
                    <div class="gallery-item">
                      <img src="${image.dataUrl}" alt="${escapeHtml(image.name)}" />
                      <div style="padding:12px; font-size:14px; color:#57534e;">${escapeHtml(image.name)}</div>
                    </div>
                  `).join("")
                : "<div class='small'>Sin imagenes registradas.</div>"}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderTeamBadge(team) {
    return `<span class="team-badge" style="background:${team.bg}; color:${team.color}; border-color:${team.border};">${escapeHtml(team.label)}</span>`;
  }

  function renderTag(tag) {
    const bg = hexToRgba(tag.color || "#dc2626", 0.14);
    const border = hexToRgba(tag.color || "#dc2626", 0.35);
    return `<span class="tag" style="background:${bg}; color:${tag.color}; border-color:${border};">${escapeHtml(tag.label)}</span>`;
  }

  function renderField(label, key, value, type = "text") {
    return `
      <div class="field">
        <label>${escapeHtml(label)}</label>
        <input class="input" type="${type}" data-filter="${escapeHtml(key)}" value="${escapeHtml(value || "")}" />
      </div>
    `;
  }

  function renderSelectField(label, key, options, value) {
    return `
      <div class="field">
        <label>${escapeHtml(label)}</label>
        <select class="select" data-filter="${escapeHtml(key)}">
          ${options.map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
        </select>
      </div>
    `;
  }

  function renderBedModal() {
    if (!state.modal) return "";
    const caseData = state.modal;
    const bed = { bedNumber: caseData.bedNumber, sector: caseData.sector };
    return `
      <div class="modal-backdrop">
        <div class="drawer">
          <div class="drawer-head">
            <div class="section-top" style="margin-bottom:0;">
              <div>
                <div class="small">${escapeHtml(bed.sector)}</div>
                <h2 style="margin-top:6px;">Cama ${bed.bedNumber}</h2>
              </div>
              <div class="row wrap">
                ${state.activeCases[String(bed.bedNumber)] ? `<button class="btn btn-danger" data-action="request-release">Liberar cama</button>` : ""}
                <button class="btn btn-light" data-action="close-modal">Cerrar</button>
              </div>
            </div>
          </div>
          <div class="drawer-body">
            <section class="panel">
              <h3>Paciente y hospitalizacion</h3>
              <div class="form-grid" style="margin-top:16px;">
                ${modalInput("Nombre", "patientName", caseData.patientName)}
                ${modalInput("RUT", "rut", caseData.rut)}
                ${modalInput("Fecha de ingreso", "admissionDate", caseData.admissionDate, "date")}
                ${modalInput("Fecha de alta", "dischargeDate", caseData.dischargeDate, "date")}
              </div>
              <div style="margin-top:20px;">
                <div class="field">
                  <label>Equipo tratante</label>
                  <div class="team-grid">
                    ${TEAM_OPTIONS.map((team) => `
                      <button class="team-option ${caseData.team === team.value ? "selected" : ""}" data-action="set-team" data-team="${escapeHtml(team.value)}" style="background:${caseData.team === team.value ? team.bg : "#fafaf9"}; color:${caseData.team === team.value ? team.color : "#44403c"}; border-color:${caseData.team === team.value ? team.border : "#e7e5e4"};">
                        ${escapeHtml(team.label)}
                      </button>
                    `).join("")}
                  </div>
                </div>
              </div>
            </section>

            <div class="subgrid two">
              <section class="panel">
                <h3>Tags clinicos</h3>
                <div class="tags" style="margin-top:14px;">
                  ${(caseData.tags || []).map((tag, index) => `
                    <span class="tag" style="background:${hexToRgba(tag.color, 0.14)}; color:${tag.color}; border-color:${hexToRgba(tag.color, 0.35)};">
                      ${escapeHtml(tag.label)}
                      <button class="btn" style="padding:2px 8px; margin-left:8px; background:white; color:#57534e;" data-action="remove-tag" data-index="${index}">x</button>
                    </span>
                  `).join("")}
                </div>
                <div class="form-grid" style="margin-top:16px; grid-template-columns:minmax(0,1fr) 130px auto;">
                  <input class="input" id="new-tag-label" placeholder="Ej. ayuno, drenaje, biopsia pendiente" />
                  <input class="input" id="new-tag-color" type="color" value="#dc2626" style="padding:8px;" />
                  <button class="btn btn-dark" data-action="add-tag">Agregar tag</button>
                </div>
              </section>

              <section class="panel">
                <div class="section-top">
                  <h3>Diagnosticos</h3>
                  <button class="btn btn-light" data-action="add-diagnosis">Agregar diagnostico</button>
                </div>
                <div class="stack">
                  ${(caseData.diagnoses || []).map((item, index) => `
                    <div class="row">
                      <input class="input" data-action="diagnosis-input" data-index="${index}" value="${escapeHtml(item)}" />
                      <button class="btn btn-light" data-action="remove-diagnosis" data-index="${index}">Quitar</button>
                    </div>
                  `).join("")}
                </div>
              </section>
            </div>

            <section class="panel">
              <div class="section-top">
                <h3>Cirugias</h3>
                <button class="btn btn-light" data-action="add-surgery">Agregar cirugia</button>
              </div>
              <div class="stack">
                ${(caseData.surgeries || []).map((item, index) => `
                  <div class="item-card">
                    <div class="form-grid" style="grid-template-columns:1.3fr 180px 1fr auto;">
                      ${modalInput("Nombre", `surgery-name-${index}`, item.name, "text", "surgery-name", index)}
                      ${modalInput("Fecha", `surgery-date-${index}`, item.date, "date", "surgery-date", index)}
                      ${modalInput("Primer cirujano", `surgery-surgeon-${index}`, item.surgeon, "text", "surgery-surgeon", index)}
                      <div class="field" style="align-self:end;">
                        <button class="btn btn-light" data-action="remove-surgery" data-index="${index}">Quitar</button>
                      </div>
                    </div>
                  </div>
                `).join("")}
              </div>
            </section>

            <section class="panel">
              <div class="section-top">
                <div>
                  <h3>Laboratorio</h3>
                  <p class="lead" style="margin-top:6px;">Grilla editable por examen y fecha, con visualizacion de tendencias.</p>
                </div>
                <div class="row wrap">
                  <button class="btn btn-light" data-action="add-lab-date">Agregar fecha</button>
                  <input class="input" id="new-exam-name" placeholder="Nuevo examen" style="width:180px;" />
                  <button class="btn btn-dark" data-action="add-exam">Agregar examen</button>
                </div>
              </div>
              <div class="labs-wrap">${renderEditableLabsTable(caseData)}</div>
              <div class="subgrid two" style="margin-top:16px;">
                <div class="item-card">
                  <div class="field">
                    <label>Examen para grafico</label>
                    <select class="select" data-action="modal-chart-exam">
                      ${Object.keys(caseData.labs.exams).map((exam) => `<option value="${escapeHtml(exam)}" ${caseData.selectedExam === exam || (!caseData.selectedExam && exam === Object.keys(caseData.labs.exams)[0]) ? "selected" : ""}>${escapeHtml(exam)}</option>`).join("")}
                    </select>
                  </div>
                </div>
                <div class="chart-box">
                  ${renderChart(caseData.labs, caseData.selectedExam || Object.keys(caseData.labs.exams)[0], getTeam(caseData.team).line)}
                </div>
              </div>
            </section>

            <div class="subgrid two">
              <section class="panel">
                <h3>Galeria de imagenes</h3>
                <div class="dropzone" id="dropzone" style="margin-top:14px;">
                  <div class="small" style="color:#57534e;">Arrastra imagenes aqui, pega desde portapapeles o usa el selector de archivos.</div>
                  <div class="row wrap" style="margin-top:14px;">
                    <button class="btn btn-dark" data-action="pick-images">Seleccionar imagenes</button>
                    <input id="image-input" type="file" multiple accept="image/*" class="hidden" />
                  </div>
                </div>
                <div class="gallery" style="margin-top:16px;">
                  ${(caseData.images || []).map((image, index) => `
                    <div class="gallery-item">
                      <img src="${image.dataUrl}" alt="${escapeHtml(image.name)}" />
                      <div style="padding:12px; display:flex; justify-content:space-between; gap:10px; align-items:center;">
                        <div style="font-size:14px; color:#57534e; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(image.name)}</div>
                        <button class="btn btn-light" style="padding:8px 12px;" data-action="remove-image" data-index="${index}">Eliminar</button>
                      </div>
                    </div>
                  `).join("")}
                </div>
              </section>

              <section class="panel">
                <h3>Notas libres</h3>
                <textarea class="textarea" data-modal-field="noteDraft" style="margin-top:14px; min-height:140px;" placeholder="Evolucion, indicaciones, pendientes y observaciones clinicas.">${escapeHtml(caseData.noteDraft || "")}</textarea>
                <div class="row end" style="margin-top:12px;">
                  <button class="btn btn-dark" data-action="add-note-entry" ${!String(caseData.noteDraft || "").trim() ? "disabled" : ""}>Registrar</button>
                </div>
                <div class="item-card" style="margin-top:14px;">
                  <h3 style="font-size:16px;">Historial de notas</h3>
                  ${renderNotesHistory(caseData)}
                </div>
              </section>
            </div>
          </div>
          <div class="drawer-foot">
            <div class="small">${caseData.patientName ? `${escapeHtml(caseData.patientName)} · ${escapeHtml(caseData.rut || "sin RUT")}` : "Paciente pendiente de asignacion"}</div>
            <button id="save-bed-button" class="btn btn-dark" data-action="save-bed" ${!caseData.patientName.trim() || !caseData.rut.trim() ? "disabled" : ""}>Guardar cama</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderReleaseDialog() {
    if (!state.releaseCase) return "";
    return `
      <div class="modal-backdrop">
        <div class="dialog">
          <h2>Liberar cama ${state.releaseCase.bedNumber}</h2>
          <p class="lead" style="margin-top:10px;">El caso se archivara con laboratorio, imagenes, tags, equipo, diagnosticos, cirugias, notas y dias hospitalizados.</p>
          <div class="field" style="margin-top:18px;">
            <label>Fecha de alta</label>
            <input class="input" id="release-date" type="date" value="${escapeHtml(state.releaseCase.dischargeDate || nowIsoDate())}" />
          </div>
          <div class="row end" style="margin-top:22px;">
            <button class="btn btn-light" data-action="cancel-release">Cancelar</button>
            <button class="btn btn-danger" data-action="confirm-release">Confirmar alta</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderReactivateDialog() {
    if (!state.reactivateCase) return "";
    const freeBeds = getBeds().filter((bed) => !state.activeCases[String(bed.bedNumber)]);
    return `
      <div class="modal-backdrop">
        <div class="dialog">
          <h2>Reactivar caso</h2>
          <p class="lead" style="margin-top:10px;">El caso volvera al tablero activo en una cama libre y se eliminara del historial.</p>
          <div class="field" style="margin-top:18px;">
            <label>Cama disponible</label>
            ${
              freeBeds.length
                ? `<select class="select" id="reactivate-bed">
                    ${freeBeds.map((bed) => `<option value="${bed.bedNumber}">Cama ${bed.bedNumber} · ${escapeHtml(bed.sector)} · ${escapeHtml(bed.roomName || "")}</option>`).join("")}
                  </select>`
                : `<div class="error">No hay camas libres disponibles para reactivar este caso.</div>`
            }
          </div>
          <div class="row end" style="margin-top:22px;">
            <button class="btn btn-light" data-action="cancel-reactivate">Cancelar</button>
            <button class="btn btn-dark" data-action="confirm-reactivate" ${freeBeds.length ? "" : "disabled"}>Reactivar</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderEditableLabsTable(caseData) {
    return `
      <table>
        <thead>
          <tr>
            <th>Examen</th>
            ${caseData.labs.dates.map((date, dateIndex) => `
              <th>
                <div class="row">
                  <input class="input" type="date" data-action="lab-date-input" data-index="${dateIndex}" value="${escapeHtml(date)}" style="padding:8px 10px; min-width:140px;" />
                  <button class="btn btn-light" style="padding:8px 12px;" data-action="remove-lab-date" data-index="${dateIndex}">x</button>
                </div>
              </th>
            `).join("")}
          </tr>
        </thead>
        <tbody>
          ${Object.keys(caseData.labs.exams).map((exam, examIndex) => `
            <tr>
              <td>
                <div class="row" style="justify-content:space-between;">
                  <strong>${escapeHtml(exam)}</strong>
                  <button class="btn btn-light" style="padding:6px 10px;" data-action="remove-exam" data-exam="${escapeHtml(exam)}">x</button>
                </div>
              </td>
              ${caseData.labs.dates.map((date) => `
                <td>
                  <input class="input" data-action="lab-value-input" data-exam="${escapeHtml(exam)}" data-date="${escapeHtml(date)}" value="${escapeHtml(caseData.labs.exams[exam][date] || "")}" />
                </td>
              `).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  function renderLabsTable(caseData) {
    const labs = caseData.labs || { dates: [], exams: {} };
    return `
      <table>
        <thead>
          <tr>
            <th>Examen</th>
            ${labs.dates.map((date) => `<th>${escapeHtml(date)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${Object.keys(labs.exams).map((exam) => `
            <tr>
              <td><strong>${escapeHtml(exam)}</strong></td>
              ${labs.dates.map((date) => `<td>${escapeHtml(labs.exams[exam][date] || "-")}</td>`).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  function renderChart(labs, exam, color) {
    if (!labs || !exam || !labs.exams[exam] || !labs.dates.length) {
      return `<div class="chart-empty">Sin datos suficientes para el grafico.</div>`;
    }
    const points = labs.dates
      .map((date) => ({ date, value: Number(labs.exams[exam][date]) }))
      .filter((item) => Number.isFinite(item.value));
    if (points.length < 2) {
      return `<div class="chart-empty">Agrega al menos dos valores numericos para ver la tendencia.</div>`;
    }
    const width = 640;
    const height = 260;
    const padX = 52;
    const padY = 26;
    const min = Math.min(...points.map((item) => item.value));
    const max = Math.max(...points.map((item) => item.value));
    const spread = max - min || 1;
    const xStep = (width - padX * 2) / (points.length - 1);
    const polyline = points.map((point, index) => {
      const x = padX + xStep * index;
      const y = height - padY - ((point.value - min) / spread) * (height - padY * 2);
      return `${x},${y}`;
    }).join(" ");
    const labels = points.map((point, index) => {
      const x = padX + xStep * index;
      return `<text x="${x}" y="${height - 6}" text-anchor="middle" font-size="11" fill="#78716c">${escapeHtml(point.date.slice(5))}</text>`;
    }).join("");
    const dots = points.map((point, index) => {
      const x = padX + xStep * index;
      const y = height - padY - ((point.value - min) / spread) * (height - padY * 2);
      return `
        <circle cx="${x}" cy="${y}" r="4.5" fill="${color}" />
        <text x="${x}" y="${y - 10}" text-anchor="middle" font-size="11" fill="#57534e">${point.value}</text>
      `;
    }).join("");
    return `
      <svg viewBox="0 0 ${width} ${height}" class="svg-chart" role="img" aria-label="Grafico de tendencia de ${escapeHtml(exam)}">
        <line x1="${padX}" y1="${padY}" x2="${padX}" y2="${height - padY}" stroke="#d6d3d1" />
        <line x1="${padX}" y1="${height - padY}" x2="${width - padX}" y2="${height - padY}" stroke="#d6d3d1" />
        <text x="12" y="${padY + 6}" font-size="11" fill="#78716c">${max}</text>
        <text x="12" y="${height - padY}" font-size="11" fill="#78716c">${min}</text>
        <polyline fill="none" stroke="${color}" stroke-width="3.5" points="${polyline}" />
        ${labels}
        ${dots}
      </svg>
    `;
  }

  function modalInput(label, name, value, type = "text", action = "modal-field", index = "") {
    const indexAttr = index !== "" ? `data-index="${index}"` : "";
    return `
      <div class="field">
        <label>${escapeHtml(label)}</label>
        <input class="input" type="${type}" data-action="${action}" data-field="${escapeHtml(name)}" ${indexAttr} value="${escapeHtml(value || "")}" />
      </div>
    `;
  }

  function bindGlobalEvents() {
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
      loginForm.addEventListener("submit", onLoginSubmit);
    }

    app.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => {
        state.view = button.dataset.view;
        render();
      });
    });

    app.querySelectorAll("[data-action]").forEach((element) => {
      element.addEventListener("click", handleActionClick);
    });

    app.querySelectorAll("[data-filter]").forEach((input) => {
      input.addEventListener("input", () => {
        state.historyFilters[input.dataset.filter] = input.value;
        render();
      });
    });

    app.querySelectorAll("[data-modal-field]").forEach((input) => {
      input.addEventListener("input", () => {
        state.modal[input.dataset.modalField || "notes"] = input.value;
      });
    });

    bindModalFieldInputs();
    bindFileInteractions();
    syncModalSaveButtonState();
  }

  function syncModalSaveButtonState() {
    const button = document.getElementById("save-bed-button");
    if (!state.modal) return;
    if (button) {
      button.disabled = !String(state.modal.patientName || "").trim() || !String(state.modal.rut || "").trim();
    }
    const noteButton = app.querySelector('[data-action="add-note-entry"]');
    if (noteButton) {
      noteButton.disabled = !String(state.modal.noteDraft || "").trim();
    }
  }

  function bindModalFieldInputs() {
    app.querySelectorAll('[data-action="modal-field"]').forEach((input) => {
      input.addEventListener("input", () => {
        state.modal[input.dataset.field] = input.value;
        syncModalSaveButtonState();
      });
    });

    app.querySelectorAll('[data-action="diagnosis-input"]').forEach((input) => {
      input.addEventListener("input", () => {
        state.modal.diagnoses[Number(input.dataset.index)] = input.value;
      });
    });

    app.querySelectorAll('[data-action="surgery-name"]').forEach((input) => {
      input.addEventListener("input", () => {
        state.modal.surgeries[Number(input.dataset.index)].name = input.value;
      });
    });
    app.querySelectorAll('[data-action="surgery-date"]').forEach((input) => {
      input.addEventListener("input", () => {
        state.modal.surgeries[Number(input.dataset.index)].date = input.value;
      });
    });
    app.querySelectorAll('[data-action="surgery-surgeon"]').forEach((input) => {
      input.addEventListener("input", () => {
        state.modal.surgeries[Number(input.dataset.index)].surgeon = input.value;
      });
    });
    app.querySelectorAll('[data-action="lab-date-input"]').forEach((input) => {
      input.addEventListener("input", () => {
        const index = Number(input.dataset.index);
        const previous = state.modal.labs.dates[index];
        const siblingDates = state.modal.labs.dates.filter((_, itemIndex) => itemIndex !== index);
        const next = nextUniqueLabDate(siblingDates, input.value || nowIsoDate());
        state.modal.labs.dates[index] = next;
        input.value = next;
        Object.keys(state.modal.labs.exams).forEach((exam) => {
          const values = state.modal.labs.exams[exam];
          if (Object.prototype.hasOwnProperty.call(values, previous)) {
            values[next] = values[previous];
            delete values[previous];
          }
        });
      });
    });
    app.querySelectorAll('[data-action="lab-value-input"]').forEach((input) => {
      input.addEventListener("input", () => {
        state.modal.labs.exams[input.dataset.exam][input.dataset.date] = input.value;
      });
    });
    app.querySelectorAll('[data-action="modal-chart-exam"]').forEach((select) => {
      select.addEventListener("change", () => {
        state.modal.selectedExam = select.value;
        render();
      });
    });
    app.querySelectorAll('[data-action="history-chart-exam"]').forEach((select) => {
      select.addEventListener("change", () => {
        const caseItem = state.history.find((item) => item.id === select.dataset.caseId);
        if (caseItem) caseItem.chartExam = select.value;
        render();
      });
    });
  }

  function bindFileInteractions() {
    const fileInput = document.getElementById("image-input");
    const dropzone = document.getElementById("dropzone");
    if (fileInput) {
      fileInput.addEventListener("change", async (event) => {
        await appendFiles(event.target.files);
        event.target.value = "";
      });
    }
    if (dropzone) {
      dropzone.addEventListener("dragover", (event) => {
        event.preventDefault();
      });
      dropzone.addEventListener("drop", async (event) => {
        event.preventDefault();
        await appendFiles(event.dataTransfer.files);
      });
      dropzone.addEventListener("paste", async (event) => {
        const files = Array.from(event.clipboardData.items || [])
          .filter((item) => item.kind === "file")
          .map((item) => item.getAsFile())
          .filter(Boolean);
        if (files.length) {
          await appendFiles(files);
        }
      });
    }
  }

  async function appendFiles(fileList) {
    const files = await Promise.all(Array.from(fileList || []).map(fileToImageData));
    state.modal.images = [...(state.modal.images || []), ...files];
    render();
  }

  function fileToImageData(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({ id: uid(), name: file.name, dataUrl: reader.result, createdAt: new Date().toISOString() });
      };
      reader.readAsDataURL(file);
    });
  }

  function onLoginSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") || "");
    const password = String(form.get("password") || "");
    if (username === DEFAULT_CREDENTIALS.username && password === DEFAULT_CREDENTIALS.password) {
      state.session = { name: DEFAULT_CREDENTIALS.name, username: DEFAULT_CREDENTIALS.username };
      state.loginError = "";
      saveSession();
      render();
      return;
    }
    state.loginError = "Credenciales invalidas. Usa las credenciales de demo precargadas.";
    render();
  }

  function handleActionClick(event) {
    const action = event.currentTarget.dataset.action;
    if (action === "logout") {
      state.session = null;
      localStorage.removeItem(STORAGE_KEYS.session);
      render();
      return;
    }
    if (action === "open-bed") {
      const bedNumber = Number(event.currentTarget.dataset.bed);
      const bed = getBeds().find((item) => item.bedNumber === bedNumber);
      state.modal = normalizeCaseData(cloneCase(state.activeCases[String(bedNumber)] || emptyCase(bed)));
      render();
      return;
    }
    if (action === "toggle-dashboard-team-filter") {
      const team = event.currentTarget.dataset.team;
      if (state.dashboardTeamFilters.includes(team)) {
        state.dashboardTeamFilters = state.dashboardTeamFilters.filter((item) => item !== team);
      } else {
        state.dashboardTeamFilters = [...state.dashboardTeamFilters, team];
      }
      render();
      return;
    }
    if (action === "toggle-header-stats") {
      state.showHeaderStats = !state.showHeaderStats;
      render();
      return;
    }
    if (action === "toggle-dashboard-filters") {
      state.showDashboardFilters = !state.showDashboardFilters;
      render();
      return;
    }
    if (action === "toggle-history-filters") {
      state.showHistoryFilters = !state.showHistoryFilters;
      render();
      return;
    }
    if (action === "clear-dashboard-team-filters") {
      state.dashboardTeamFilters = [];
      render();
      return;
    }
    if (action === "clear-history-filters") {
      state.historyFilters = {
        search: "",
        sector: "",
        team: "",
        dischargeFrom: "",
        dischargeTo: "",
        surgeon: "",
        diagnosis: "",
        surgeryName: "",
      };
      render();
      return;
    }
    if (action === "close-modal") {
      state.modal = null;
      render();
      return;
    }
    if (action === "set-team") {
      state.modal.team = event.currentTarget.dataset.team;
      render();
      return;
    }
    if (action === "add-tag") {
      const label = document.getElementById("new-tag-label").value.trim();
      const color = document.getElementById("new-tag-color").value;
      if (!label) return;
      state.modal.tags.push({ id: uid(), label, color });
      render();
      return;
    }
    if (action === "remove-tag") {
      state.modal.tags.splice(Number(event.currentTarget.dataset.index), 1);
      render();
      return;
    }
    if (action === "add-diagnosis") {
      state.modal.diagnoses.push("");
      render();
      return;
    }
    if (action === "remove-diagnosis") {
      state.modal.diagnoses.splice(Number(event.currentTarget.dataset.index), 1);
      render();
      return;
    }
    if (action === "add-surgery") {
      state.modal.surgeries.push({ id: uid(), name: "", date: "", surgeon: "" });
      render();
      return;
    }
    if (action === "remove-surgery") {
      state.modal.surgeries.splice(Number(event.currentTarget.dataset.index), 1);
      render();
      return;
    }
    if (action === "add-lab-date") {
      state.modal.labs.dates.push(nextUniqueLabDate(state.modal.labs.dates, nowIsoDate()));
      render();
      return;
    }
    if (action === "remove-lab-date") {
      const index = Number(event.currentTarget.dataset.index);
      const removed = state.modal.labs.dates[index];
      state.modal.labs.dates.splice(index, 1);
      Object.keys(state.modal.labs.exams).forEach((exam) => {
        delete state.modal.labs.exams[exam][removed];
      });
      render();
      return;
    }
    if (action === "add-exam") {
      const input = document.getElementById("new-exam-name");
      const exam = input.value.trim();
      if (!exam || state.modal.labs.exams[exam]) return;
      state.modal.labs.exams[exam] = {};
      state.modal.selectedExam = exam;
      render();
      return;
    }
    if (action === "remove-exam") {
      delete state.modal.labs.exams[event.currentTarget.dataset.exam];
      render();
      return;
    }
    if (action === "pick-images") {
      document.getElementById("image-input").click();
      return;
    }
    if (action === "remove-image") {
      state.modal.images.splice(Number(event.currentTarget.dataset.index), 1);
      render();
      return;
    }
    if (action === "add-note-entry") {
      const text = String(state.modal.noteDraft || "").trim();
      if (!text) return;
      state.modal.notesEntries = [
        ...(state.modal.notesEntries || []),
        {
          id: uid(),
          text,
          createdAt: new Date().toISOString(),
        },
      ];
      state.modal.noteDraft = "";
      render();
      return;
    }
    if (action === "save-bed") {
      if (!state.modal.patientName.trim() || !state.modal.rut.trim()) return;
      const nextCase = cleanCase(state.modal);
      state.activeCases[String(nextCase.bedNumber)] = nextCase;
      saveActiveCases();
      state.modal = null;
      render();
      return;
    }
    if (action === "request-release") {
      state.releaseCase = cloneCase(state.modal);
      render();
      return;
    }
    if (action === "cancel-release") {
      state.releaseCase = null;
      render();
      return;
    }
    if (action === "confirm-release") {
      const dischargeDate = document.getElementById("release-date").value || nowIsoDate();
      const archived = {
        ...cleanCase(state.releaseCase),
        dischargeDate,
        archivedAt: new Date().toISOString(),
        daysHospitalized: getDayCount(state.releaseCase.admissionDate, dischargeDate),
      };
      delete state.activeCases[String(archived.bedNumber)];
      state.history.unshift(archived);
      saveActiveCases();
      saveHistory();
      state.releaseCase = null;
      state.modal = null;
      state.view = "dashboard";
      render();
      return;
    }
    if (action === "toggle-history") {
      const caseId = event.currentTarget.dataset.caseId;
      state.historyExpandedId = state.historyExpandedId === caseId ? null : caseId;
      render();
      return;
    }
    if (action === "open-reactivate") {
      const caseItem = state.history.find((item) => item.id === event.currentTarget.dataset.caseId);
      state.reactivateCase = cloneCase(caseItem);
      render();
      return;
    }
    if (action === "cancel-reactivate") {
      state.reactivateCase = null;
      render();
      return;
    }
    if (action === "confirm-reactivate") {
      const select = document.getElementById("reactivate-bed");
      if (!select || !select.value) {
        return;
      }
      const targetNumber = Number(select.value);
      const targetBed = getBeds().find((bed) => bed.bedNumber === targetNumber);
      if (!targetBed) {
        return;
      }
      const revived = cleanCase({
        ...state.reactivateCase,
        id: uid(),
        bedNumber: targetNumber,
        sector: targetBed.sector,
        dischargeDate: "",
        archivedAt: "",
      });
      state.activeCases[String(targetNumber)] = revived;
      state.history = state.history.filter((item) => item.id !== state.reactivateCase.id);
      saveActiveCases();
      saveHistory();
      state.reactivateCase = null;
      state.view = "dashboard";
      render();
    }
  }

  function cleanCase(caseData) {
    const normalized = normalizeCaseData(caseData);
    return {
      ...cloneCase(normalized),
      tags: (normalized.tags || []).filter((tag) => String(tag.label || "").trim()),
      diagnoses: (normalized.diagnoses || []).filter((item) => String(item || "").trim()),
      surgeries: (normalized.surgeries || []).filter((item) => item.name || item.date || item.surgeon),
      notesEntries: getCaseNotesEntries(normalized),
      noteDraft: "",
      notes: "",
    };
  }

  function cloneCase(caseData) {
    return JSON.parse(JSON.stringify(caseData));
  }

  function normalizeCaseData(caseData) {
    const nextCase = cloneCase(caseData);
    if (!Array.isArray(nextCase.notesEntries)) {
      nextCase.notesEntries = [];
    }
    if (String(nextCase.notes || "").trim() && !nextCase.notesEntries.length) {
      nextCase.notesEntries.push({
        id: uid(),
        text: nextCase.notes,
        createdAt: nextCase.updatedAt || nextCase.archivedAt || nextCase.createdAt || new Date().toISOString(),
      });
    }
    if (typeof nextCase.noteDraft !== "string") {
      nextCase.noteDraft = "";
    }
    return nextCase;
  }

  function hexToRgba(hex, alpha) {
    const clean = (hex || "#000000").replace("#", "");
    const full = clean.length === 3 ? clean.split("").map((char) => char + char).join("") : clean;
    const int = parseInt(full, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  render();
})();
