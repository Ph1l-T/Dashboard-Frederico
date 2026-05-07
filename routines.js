/* eslint-disable no-console */
(function (global) {
  "use strict";

  const API_URL = "/rule-engine-proxy";
  const ROUTINE_SOURCE = "dashboard-routine-v1";
  const MAX_ROUTINE_DEVICES = 200;
  const ROOM_FALLBACK_LABEL = "Sem ambiente";
  const DAY_LABELS = {
    mon: "Seg",
    tue: "Ter",
    wed: "Qua",
    thu: "Qui",
    fri: "Sex",
    sat: "Sáb",
    sun: "Dom",
  };
  const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

  const state = {
    devices: [],
    rules: [],
    editingRoutineId: "",
    loading: false,
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function makeId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  }

  function normalizeTime(value) {
    const raw = String(value || "").trim();
    const colonMatch = raw.match(/^(\d{1,2}):([0-5]\d)$/);
    if (colonMatch) {
      const hour = Number(colonMatch[1]);
      if (hour >= 0 && hour <= 23) {
        return `${String(hour).padStart(2, "0")}:${colonMatch[2]}`;
      }
      return "";
    }

    const digits = raw.replace(/\D/g, "");
    if (digits.length === 3 || digits.length === 4) {
      const hourText = digits.slice(0, digits.length - 2);
      const minuteText = digits.slice(-2);
      const hour = Number(hourText);
      const minute = Number(minuteText);
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        return `${String(hour).padStart(2, "0")}:${minuteText}`;
      }
    }

    return "";
  }

  function sanitizeTimeText(value) {
    return String(value || "")
      .replace(/[^\d:]/g, "")
      .slice(0, 5);
  }

  function setFeedback(message, type) {
    const el = byId("routines-feedback");
    if (!el) return;
    const normalized = String(message || "").trim();
    el.textContent = /^HTTP\s+\d{3}$/i.test(normalized) ? "" : normalized;
    el.dataset.state = type || "neutral";
  }

  function isEditMode() {
    const builder = document.querySelector(".routines-builder-page");
    return builder?.dataset.mode === "edit" || global.location?.hash === "#routines-editar";
  }

  async function api(path, options = {}) {
    const response = await fetch(
      `${API_URL}?path=${encodeURIComponent(path)}`,
      {
        method: options.method || "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          ...(options.body ? { "Content-Type": "application/json" } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      },
    );

    const text = await response.text();
    let payload = {};
    if (text.trim()) {
      try {
        payload = JSON.parse(text);
      } catch (error) {
        payload = { raw: text };
      }
    }

    if (!response.ok) {
      throw new Error(payload?.error || payload?.message || `HTTP ${response.status}`);
    }

    return payload;
  }

  function canScheduleDevice(device) {
    const commands = Array.isArray(device?.commands) ? device.commands : [];
    return commands.includes("on") && commands.includes("off");
  }

  function sortDevices(devices) {
    return devices.slice().sort((a, b) => {
      const aLabel = String(a?.label || a?.name || a?.id || "");
      const bLabel = String(b?.label || b?.name || b?.id || "");
      return aLabel.localeCompare(bLabel, "pt-BR");
    });
  }

  async function loadDevices() {
    const payload = await api("/devices");
    state.devices = sortDevices(
      (Array.isArray(payload.devices) ? payload.devices : []).filter(
        canScheduleDevice,
      ),
    );
    return state.devices;
  }

  async function loadRules() {
    const payload = await api("/rules");
    state.rules = Array.isArray(payload.rules) ? payload.rules : [];
    return state.rules;
  }

  function getDeviceLabel(deviceId) {
    const id = String(deviceId || "");
    const device = state.devices.find((item) => String(item.id) === id);
    return device?.label || device?.name || id || "Dispositivo";
  }

  function firstDeviceAction(rule) {
    return (Array.isArray(rule?.actions) ? rule.actions : []).find(
      (action) => action?.type === "deviceCommand",
    );
  }

  function deviceActions(rule) {
    return (Array.isArray(rule?.actions) ? rule.actions : []).filter(
      (action) => action?.type === "deviceCommand",
    );
  }

  function firstTimeTrigger(rule) {
    return (Array.isArray(rule?.triggers) ? rule.triggers : []).find(
      (trigger) => trigger?.type === "time",
    );
  }

  function commandFromRule(rule) {
    return String(firstDeviceAction(rule)?.command || "").toLowerCase();
  }

  function deviceIdsFromRules(...rules) {
    const ids = new Set();
    rules.forEach((rule) => {
      deviceActions(rule).forEach((action) => {
        const id = String(action?.deviceId || "").trim();
        if (id) ids.add(id);
      });
    });
    return Array.from(ids);
  }

  function groupRoutines(rules) {
    const groups = new Map();
    rules.forEach((rule) => {
      const routineId = String(rule?.routineId || "").trim();
      if (!routineId) return;
      if (!groups.has(routineId)) {
        groups.set(routineId, {
          id: routineId,
          rules: [],
        });
      }
      groups.get(routineId).rules.push(rule);
    });

    return Array.from(groups.values())
      .map((group) => {
        const onRule = group.rules.find((rule) => commandFromRule(rule) === "on");
        const offRule = group.rules.find((rule) => commandFromRule(rule) === "off");
        const reference = onRule || offRule || group.rules[0] || {};
        const trigger = firstTimeTrigger(onRule || reference);
        const offTrigger = firstTimeTrigger(offRule || {});
        const days = trigger?.days || offTrigger?.days || [];
        const deviceIds = deviceIdsFromRules(onRule, offRule, reference);

        return {
          ...group,
          onRule,
          offRule,
          name: String(reference.name || "Rotina").replace(/\s+-\s+(ligar|desligar)$/i, ""),
          enabled: group.rules.every((rule) => rule.enabled !== false),
          deviceId: deviceIds[0] || "",
          deviceIds,
          onTime: firstTimeTrigger(onRule || {})?.time || "",
          offTime: firstTimeTrigger(offRule || {})?.time || "",
          days: Array.isArray(days) ? days : [],
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }

  function getRoutines() {
    return groupRoutines(state.rules);
  }

  function getRoutineById(routineId) {
    const id = String(routineId || "").trim();
    return getRoutines().find((routine) => routine.id === id);
  }

  function formatDays(days) {
    const normalized = Array.isArray(days) && days.length ? days : DAY_ORDER;
    if (DAY_ORDER.every((day) => normalized.includes(day))) return "Todos os dias";
    return DAY_ORDER.filter((day) => normalized.includes(day))
      .map((day) => DAY_LABELS[day])
      .join(", ");
  }

  function formatRoutineSchedule(routine) {
    const parts = [];
    if (routine.onTime) parts.push(`Liga ${routine.onTime}`);
    if (routine.offTime) parts.push(`Desliga ${routine.offTime}`);
    return parts.length ? parts.join(" | ") : "Sem horário";
  }

  function actionButtonHtml(action, label, icon, variant = "ghost") {
    return `
      <button type="button" class="routines-btn routines-btn--${variant}" data-routine-action="${escapeHtml(action)}" aria-label="${escapeHtml(label)}">
        <img class="routines-btn__icon" src="${escapeHtml(icon)}" alt="" aria-hidden="true">
        <span class="routines-btn__label">${escapeHtml(label)}</span>
      </button>
    `;
  }

  function renderRoutineCard(routine) {
    const deviceLabel = formatRoutineDeviceSummary(routine);
    const runButtons = [
      routine.onRule
        ? actionButtonHtml("run-on", "Ligar agora", "images/icons/icon-small-light-on.svg")
        : "",
      routine.offRule
        ? actionButtonHtml("run-off", "Desligar agora", "images/icons/icon-small-light-off.svg")
        : "",
    ].filter(Boolean).join("");

    return `
      <article class="routine-card" data-routine-id="${escapeHtml(routine.id)}">
        <div class="routine-card__top">
          <div>
            <h3 class="routine-card__name">${escapeHtml(routine.name)}</h3>
            <p class="routine-card__meta">${escapeHtml(deviceLabel)}</p>
            <p class="routine-card__schedule">
              ${escapeHtml(formatRoutineSchedule(routine))}<br>
              ${escapeHtml(formatDays(routine.days))}
            </p>
          </div>
          <span class="routine-status" data-enabled="${routine.enabled ? "true" : "false"}">
            ${routine.enabled ? "Ativa" : "Pausada"}
          </span>
        </div>
        <div class="routine-card__actions">
          ${runButtons ? `<div class="routine-card__action-group routine-card__action-group--run">${runButtons}</div>` : ""}
          <div class="routine-card__action-group routine-card__action-group--manage">
            ${actionButtonHtml("edit", "Editar", "images/icons/icon-settings.svg", "secondary")}
            ${actionButtonHtml(routine.enabled ? "disable" : "enable", routine.enabled ? "Pausar" : "Ativar", routine.enabled ? "images/icons/icon-pause.svg" : "images/icons/icon-play.svg", "secondary")}
            ${actionButtonHtml("delete", "Excluir", "images/icons/icon-limpar.svg", "danger")}
          </div>
        </div>
      </article>
    `;
  }

  async function renderListPage() {
    const list = byId("routines-list");
    if (!list) return;

    setFeedback("Carregando rotinas...", "neutral");
    list.innerHTML = '<p class="routines-empty">Carregando...</p>';

    try {
      await Promise.all([loadDevices(), loadRules()]);
      const routines = getRoutines();
      if (!routines.length) {
        list.innerHTML =
          '<p class="routines-empty">Nenhuma rotina criada ainda.</p>';
      } else {
        list.innerHTML = routines.map(renderRoutineCard).join("");
      }
      setFeedback("", "neutral");
    } catch (error) {
      list.innerHTML =
        '<p class="routines-empty">Nao foi possivel carregar as rotinas.</p>';
      setFeedback(error?.message || "Falha ao carregar rotinas.", "error");
    }
  }

  function selectedDays() {
    return Array.from(document.querySelectorAll(".routine-day.is-selected"))
      .map((button) => button.dataset.day)
      .filter(Boolean);
  }

  function selectedDeviceIds() {
    return Array.from(document.querySelectorAll(".routine-device.is-selected"))
      .map((button) => String(button.dataset.deviceId || "").trim())
      .filter(Boolean);
  }

  function setDeviceButtonSelected(button, selected) {
    if (!button) return;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  }

  function setDeviceSelectionById(deviceId, selected) {
    const id = String(deviceId || "").trim();
    document.querySelectorAll(".routine-device").forEach((button) => {
      if (String(button.dataset.deviceId || "").trim() === id) {
        setDeviceButtonSelected(button, selected);
      }
    });
  }

  function setSelectedDeviceIds(deviceIds) {
    const selected = new Set(
      (Array.isArray(deviceIds) ? deviceIds : [deviceIds])
        .map((id) => String(id || "").trim())
        .filter(Boolean),
    );

    document.querySelectorAll(".routine-device").forEach((button) => {
      const isSelected = selected.has(String(button.dataset.deviceId || "").trim());
      setDeviceButtonSelected(button, isSelected);
    });
    updateSelectedDeviceUi();
  }

  function setSelectedDays(days) {
    const selected = new Set(
      (Array.isArray(days) && days.length ? days : DAY_ORDER).filter(Boolean),
    );

    document.querySelectorAll(".routine-day").forEach((button) => {
      button.classList.toggle("is-selected", selected.has(button.dataset.day));
    });
  }

  function formatDeviceLabels(deviceIds) {
    const ids = (Array.isArray(deviceIds) ? deviceIds : [deviceIds])
      .map((id) => String(id || "").trim())
      .filter(Boolean);
    if (!ids.length) return "Dispositivo";
    const labels = ids.map(getDeviceLabel);
    if (labels.length <= 3) return labels.join(", ");
    return `${labels.slice(0, 3).join(", ")} +${labels.length - 3}`;
  }

  function formatRoutineDeviceSummary(routine) {
    const ids = (Array.isArray(routine?.deviceIds) ? routine.deviceIds : [routine?.deviceId])
      .map((id) => String(id || "").trim())
      .filter(Boolean);
    const label = formatDeviceLabels(ids);
    if (ids.length <= 1) return label;
    return `${label} (${ids.length} dispositivos)`;
  }

  function formatDeviceCount(count) {
    return `${count} dispositivo${count === 1 ? "" : "s"}`;
  }

  function renderSelectedDeviceChips(deviceIds) {
    const container = byId("routine-selected-devices");
    if (!container) return;

    if (!deviceIds.length) {
      container.hidden = true;
      container.innerHTML = "";
      return;
    }

    const visibleIds = deviceIds.slice(0, 12);
    const extraCount = deviceIds.length - visibleIds.length;
    const chips = visibleIds.map((id) => {
      const label = getDeviceLabel(id);
      return `
        <button
          type="button"
          class="routines-selected-chip"
          data-remove-device-id="${escapeHtml(id)}"
          aria-label="Remover ${escapeHtml(label)}"
        >
          <span>${escapeHtml(label)}</span>
          <span aria-hidden="true">&times;</span>
        </button>
      `;
    });

    if (extraCount > 0) {
      chips.push(`<span class="routines-selected-chip routines-selected-chip--more">+${extraCount}</span>`);
    }

    container.hidden = false;
    container.innerHTML = `
      <span class="routines-selected-devices__label">Selecionados</span>
      ${chips.join("")}
    `;

    container.querySelectorAll("[data-remove-device-id]").forEach((button) => {
      button.onclick = () => {
        setDeviceSelectionById(button.dataset.removeDeviceId, false);
        updatePreview();
      };
    });
  }

  function updateSaveSummary(deviceIds, days, onEnabled, offEnabled, onTime, offTime) {
    const summary = byId("routine-save-summary");
    if (!summary) return;

    const activeActions = [];
    if (onEnabled) activeActions.push(`Liga ${onTime}`);
    if (offEnabled) activeActions.push(`Desliga ${offTime}`);

    const items = [
      formatDeviceCount(deviceIds.length),
      ...(activeActions.length ? activeActions : ["Nenhuma ação ativa"]),
      formatDays(days),
    ];

    summary.dataset.state = activeActions.length ? "ready" : "warning";
    summary.innerHTML = items
      .map((item) => `<span class="routines-save-summary__item">${escapeHtml(item)}</span>`)
      .join("");
  }

  function normalizeRoomName(device) {
    const roomName = String(device?.roomName || "").trim();
    return roomName || ROOM_FALLBACK_LABEL;
  }

  function roomKeyForDevice(device) {
    const roomId = String(device?.roomId || "").trim();
    if (roomId) return `room-${roomId}`;

    const roomName = normalizeRoomName(device);
    const slug = roomName
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "");
    return `room-${slug || "sem-ambiente"}`;
  }

  function groupedDevicesByRoom() {
    const groups = new Map();

    state.devices.forEach((device) => {
      const roomName = normalizeRoomName(device);
      const key = roomKeyForDevice(device);
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          name: roomName,
          devices: [],
        });
      }
      groups.get(key).devices.push(device);
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        devices: group.devices.sort((a, b) =>
          getDeviceLabel(a.id).localeCompare(getDeviceLabel(b.id), "pt-BR"),
        ),
      }))
      .sort((a, b) => {
        if (a.name === ROOM_FALLBACK_LABEL && b.name !== ROOM_FALLBACK_LABEL) return 1;
        if (b.name === ROOM_FALLBACK_LABEL && a.name !== ROOM_FALLBACK_LABEL) return -1;
        return a.name.localeCompare(b.name, "pt-BR");
      });
  }

  function routineActionEnabled(action) {
    const checkbox = byId(action === "on" ? "routine-on-enabled" : "routine-off-enabled");
    return checkbox ? checkbox.checked === true : true;
  }

  function setRoutineActionEnabled(action, enabled) {
    const checkbox = byId(action === "on" ? "routine-on-enabled" : "routine-off-enabled");
    const input = byId(action === "on" ? "routine-on-time" : "routine-off-time");
    const field = document.querySelector(`[data-routine-action-field="${action}"]`);

    if (checkbox) checkbox.checked = enabled;
    if (input) input.disabled = !enabled;
    if (field) field.classList.toggle("is-disabled", !enabled);
  }

  function updateActionEmptyState(onEnabled = routineActionEnabled("on"), offEnabled = routineActionEnabled("off")) {
    const hasAction = onEnabled || offEnabled;
    const panel = document.querySelector(".routines-builder-panel");
    if (panel) panel.classList.toggle("has-no-active-action", !hasAction);
    document.querySelectorAll(".routines-action-field").forEach((field) => {
      field.classList.toggle("needs-action", !hasAction);
    });
  }

  function updateRoutineActionFields() {
    setRoutineActionEnabled("on", routineActionEnabled("on"));
    setRoutineActionEnabled("off", routineActionEnabled("off"));
    updateActionEmptyState();
  }

  function updateSelectedDeviceUi() {
    const deviceIds = selectedDeviceIds();
    const selectedCount = deviceIds.length;
    const summary = byId("routine-devices-selected-count");
    if (summary) {
      summary.textContent = selectedCount
        ? `${selectedCount} selecionado${selectedCount === 1 ? "" : "s"}`
        : "Nenhum selecionado";
    }
    renderSelectedDeviceChips(deviceIds);

    document.querySelectorAll(".routine-room-tab").forEach((tab) => {
      const roomKey = tab.dataset.roomKey;
      const panel = document.querySelector(`.routine-room-panel[data-room-key="${roomKey}"]`);
      const buttons = Array.from(panel?.querySelectorAll(".routine-device") || []);
      const roomSelectedCount = buttons.filter((button) =>
        button.classList.contains("is-selected"),
      ).length;
      const count = tab.querySelector(".routine-room-tab__count");
      if (count) {
        count.textContent = roomSelectedCount
          ? `${roomSelectedCount}/${buttons.length}`
          : `${buttons.length}`;
      }
      tab.classList.toggle("has-selection", roomSelectedCount > 0);
    });
  }

  function updatePreview() {
    const preview = byId("routine-preview");
    if (!preview) return;
    updateSelectedDeviceUi();

    const deviceIds = selectedDeviceIds();
    const deviceLabel = deviceIds.length
      ? formatDeviceLabels(deviceIds)
      : "dispositivos selecionados";
    const onEnabled = routineActionEnabled("on");
    const offEnabled = routineActionEnabled("off");
    const onTime = normalizeTime(byId("routine-on-time")?.value) || "--:--";
    const offTime = normalizeTime(byId("routine-off-time")?.value) || "--:--";
    const days = selectedDays();
    const lines = [];
    updateActionEmptyState(onEnabled, offEnabled);

    if (onEnabled) {
      lines.push(`Quando for <strong>${escapeHtml(onTime)}</strong>, a Hubitat vai ligar <strong>${escapeHtml(deviceLabel)}</strong>.`);
    }
    if (offEnabled) {
      lines.push(`Quando for <strong>${escapeHtml(offTime)}</strong>, a Hubitat vai desligar <strong>${escapeHtml(deviceLabel)}</strong>.`);
    }
    if (!lines.length) {
      lines.push("Ative pelo menos uma ação para salvar a rotina.");
    }

    preview.innerHTML = `
      ${lines.join("<br>")}<br>
      <span>${escapeHtml(formatDays(days))}</span>
    `;
    updateSaveSummary(deviceIds, days, onEnabled, offEnabled, onTime, offTime);
  }

  function populateDeviceSelect() {
    const list = byId("routine-device-list");
    if (!list) return;

    if (!state.devices.length) {
      list.innerHTML =
        '<p class="routines-empty routines-empty--inline">Nenhum switch/dimmer com on/off encontrado</p>';
      return;
    }

    const groups = groupedDevicesByRoom();
    const activeKey = groups[0]?.key || "";

    list.innerHTML = `
      <div class="routine-room-tabs" role="tablist" aria-label="Ambientes">
        ${groups
          .map(
            (group) => `
              <button
                type="button"
                class="routine-room-tab${group.key === activeKey ? " is-active" : ""}"
                data-room-key="${escapeHtml(group.key)}"
                role="tab"
                aria-selected="${group.key === activeKey ? "true" : "false"}"
              >
                <span>${escapeHtml(group.name)}</span>
                <span class="routine-room-tab__count">${group.devices.length}</span>
              </button>
            `,
          )
          .join("")}
      </div>
      <div id="routine-selected-devices" class="routines-selected-devices" hidden></div>
      ${groups
        .map(
          (group) => `
            <div class="routine-room-panel${group.key === activeKey ? " is-active" : ""}" data-room-key="${escapeHtml(group.key)}" role="tabpanel">
              <div class="routine-room-panel__head">
                <span>${group.devices.length} dispositivo${group.devices.length === 1 ? "" : "s"}</span>
                <div class="routines-inline-actions">
                  <button type="button" class="routines-btn routines-btn--ghost" data-room-device-action="select" data-room-key="${escapeHtml(group.key)}">Selecionar ambiente</button>
                  <button type="button" class="routines-btn routines-btn--ghost" data-room-device-action="clear" data-room-key="${escapeHtml(group.key)}">Limpar ambiente</button>
                </div>
              </div>
              <div class="routine-room-grid">
                ${group.devices
                  .map((device) => {
                    const label = device.label || device.name || device.id;
                    return `
                      <button type="button" class="routine-device" data-device-id="${escapeHtml(device.id)}" aria-pressed="false">
                        ${escapeHtml(label)}
                      </button>
                    `;
                  })
                  .join("")}
              </div>
            </div>
          `,
        )
        .join("")}
    `;
  }

  function buildRoutineRules(existingRoutine = null) {
    const name = String(byId("routine-name-input")?.value || "").trim();
    const deviceIds = selectedDeviceIds();
    const onEnabled = routineActionEnabled("on");
    const offEnabled = routineActionEnabled("off");
    const onTime = normalizeTime(byId("routine-on-time")?.value);
    const offTime = normalizeTime(byId("routine-off-time")?.value);
    const days = selectedDays();

    if (!name) throw new Error("Informe um nome para a rotina.");
    if (!deviceIds.length) throw new Error("Selecione ao menos um dispositivo.");
    if (deviceIds.length > MAX_ROUTINE_DEVICES) {
      throw new Error(`Selecione ate ${MAX_ROUTINE_DEVICES} dispositivos por rotina.`);
    }
    if (!onEnabled && !offEnabled) throw new Error("Ative ao menos uma ação da rotina.");
    if (onEnabled && !onTime) throw new Error("Informe um horário válido para ligar.");
    if (offEnabled && !offTime) throw new Error("Informe um horário válido para desligar.");
    if (onEnabled && offEnabled && onTime === offTime) {
      throw new Error("Os horários de ligar e desligar precisam ser diferentes.");
    }
    if (!days.length) throw new Error("Selecione ao menos um dia.");

    const routineId = existingRoutine?.id || makeId("routine");
    const enabled = existingRoutine ? existingRoutine.enabled !== false : true;
    const base = {
      routineId,
      source: ROUTINE_SOURCE,
      enabled,
      conditions: [],
    };

    const rules = [];

    if (onEnabled) {
      rules.push({
        ...base,
        id: existingRoutine?.onRule?.id || `${routineId}_on`,
        name: `${name} - ligar`,
        triggers: [{ type: "time", time: onTime, days }],
        actions: deviceIds.map((deviceId) => ({
          type: "deviceCommand",
          deviceId,
          command: "on",
          args: [],
        })),
      });
    }

    if (offEnabled) {
      rules.push({
        ...base,
        id: existingRoutine?.offRule?.id || `${routineId}_off`,
        name: `${name} - desligar`,
        triggers: [{ type: "time", time: offTime, days }],
        actions: deviceIds.map((deviceId) => ({
          type: "deviceCommand",
          deviceId,
          command: "off",
          args: [],
        })),
      });
    }

    return rules;
  }

  async function saveRoutine() {
    const saveBtn = byId("routine-save-btn");
    let created = [];

    try {
      const editMode = isEditMode();
      const existingRoutine = editMode ? getRoutineById(state.editingRoutineId) : null;
      if (editMode && !existingRoutine) {
        throw new Error("Rotina nao encontrada para editar.");
      }

      const rules = buildRoutineRules(existingRoutine);
      const desiredRuleIds = new Set(rules.map((rule) => rule.id));
      if (saveBtn) saveBtn.disabled = true;
      setFeedback(
        editMode ? "Atualizando rotina na Hubitat..." : "Salvando rotina na Hubitat...",
        "neutral",
      );

      for (const rule of rules) {
        const existingRule = editMode
          ? existingRoutine.rules.find((item) => item.id === rule.id)
          : null;

        if (existingRule) {
          await api(`/rules/${rule.id}`, { method: "PUT", body: rule });
        } else {
          const saved = await api("/rules", { method: "POST", body: rule });
          created.push(saved);
        }
      }

      if (editMode) {
        const staleRules = [existingRoutine.onRule, existingRoutine.offRule]
          .filter((rule) => rule?.id)
          .filter((rule) => !desiredRuleIds.has(rule.id));
        await Promise.all(
          staleRules.map((rule) => api(`/rules/${rule.id}`, { method: "DELETE" })),
        );
      }

      if (editMode) {
        global.sessionStorage?.removeItem("routineEditId");
      }
      setFeedback(editMode ? "Rotina atualizada na Hubitat." : "Rotina salva na Hubitat.", "success");
      setTimeout(() => {
        if (typeof global.spaNavigate === "function") {
          global.spaNavigate("scenes");
        }
      }, 350);
    } catch (error) {
      if (created.length) {
        await Promise.allSettled(
          created
            .map((rule) => rule?.id)
            .filter(Boolean)
            .map((id) => api(`/rules/${id}`, { method: "DELETE" })),
        );
      }
      setFeedback(error?.message || "Falha ao salvar rotina.", "error");
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  async function setRoutineEnabled(routineId, enabled) {
    const routine = getRoutineById(routineId);
    if (!routine) return;

    setFeedback(enabled ? "Ativando rotina..." : "Pausando rotina...", "neutral");
    const suffix = enabled ? "enable" : "disable";
    await Promise.all(
      routine.rules.map((rule) => api(`/rules/${rule.id}/${suffix}`, { method: "POST" })),
    );
    await renderListPage();
  }

  async function deleteRoutine(routineId) {
    const routine = getRoutineById(routineId);
    if (!routine) return;

    if (!global.confirm(`Excluir a rotina "${routine.name}"?`)) return;

    setFeedback("Excluindo rotina...", "neutral");
    await Promise.all(
      routine.rules.map((rule) => api(`/rules/${rule.id}`, { method: "DELETE" })),
    );
    await renderListPage();
  }

  function editRoutine(routineId) {
    if (!getRoutineById(routineId)) {
      setFeedback("Rotina nao encontrada para editar.", "error");
      return;
    }

    global.sessionStorage?.setItem("routineEditId", routineId);
    if (typeof global.spaNavigate === "function") {
      global.spaNavigate("routines-editar");
    } else {
      global.location.hash = "routines-editar";
    }
  }

  async function runRoutineRule(routineId, command) {
    const routine = getRoutineById(routineId);
    const rule = command === "on" ? routine?.onRule : routine?.offRule;
    const label = command === "on" ? "ligar" : "desligar";
    if (!rule?.id) throw new Error(`Regra de ${label} nao encontrada.`);

    setFeedback(`Executando ${label} agora...`, "neutral");
    await api(`/rules/${rule.id}/run`, { method: "POST" });
    setFeedback(`Comando de ${label} enviado para a Hubitat.`, "success");
  }

  function bindListPage() {
    const newBtn = byId("routine-new-btn");
    if (newBtn) {
      newBtn.onclick = () => {
        if (typeof global.spaNavigate === "function") {
          global.spaNavigate("routines-criar");
        }
      };
    }

    const list = byId("routines-list");
    if (list) {
      list.onclick = async (event) => {
        const button = event.target.closest("[data-routine-action]");
        const card = event.target.closest("[data-routine-id]");
        if (!button || !card) return;

        try {
          const action = button.dataset.routineAction;
          const routineId = card.dataset.routineId;
          if (action === "edit") editRoutine(routineId);
          if (action === "run-on") await runRoutineRule(routineId, "on");
          if (action === "run-off") await runRoutineRule(routineId, "off");
          if (action === "enable") await setRoutineEnabled(routineId, true);
          if (action === "disable") await setRoutineEnabled(routineId, false);
          if (action === "delete") await deleteRoutine(routineId);
        } catch (error) {
          setFeedback(error?.message || "Falha ao alterar rotina.", "error");
        }
      };
    }
  }

  function setBuilderModeText(editMode) {
    const title = byId("routine-page-title");
    const saveBtn = byId("routine-save-btn");
    if (title) title.textContent = editMode ? "Editar Rotina" : "Criar Rotina";
    if (saveBtn) saveBtn.textContent = editMode ? "Salvar alterações" : "Salvar na Hubitat";
  }

  function applyRoutineToForm(routine) {
    const nameInput = byId("routine-name-input");
    const onInput = byId("routine-on-time");
    const offInput = byId("routine-off-time");

    if (nameInput) nameInput.value = routine.name || "";
    if (onInput) onInput.value = routine.onTime || "23:00";
    if (offInput) offInput.value = routine.offTime || "06:00";
    setRoutineActionEnabled("on", Boolean(routine.onTime || routine.onRule));
    setRoutineActionEnabled("off", Boolean(routine.offTime || routine.offRule));
    setSelectedDays(routine.days);
    setSelectedDeviceIds(routine.deviceIds || [routine.deviceId]);
    updatePreview();
  }

  function bindRoutineRoomTabs() {
    document.querySelectorAll(".routine-room-tab").forEach((tab) => {
      tab.onclick = () => {
        const roomKey = tab.dataset.roomKey;
        document.querySelectorAll(".routine-room-tab").forEach((item) => {
          const active = item.dataset.roomKey === roomKey;
          item.classList.toggle("is-active", active);
          item.setAttribute("aria-selected", active ? "true" : "false");
        });
        document.querySelectorAll(".routine-room-panel").forEach((panel) => {
          panel.classList.toggle("is-active", panel.dataset.roomKey === roomKey);
        });
      };
    });
  }

  function bindRoutineRoomActions() {
    document.querySelectorAll("[data-room-device-action]").forEach((button) => {
      button.onclick = () => {
        const roomKey = button.dataset.roomKey;
        const action = button.dataset.roomDeviceAction;
        const panel = document.querySelector(`.routine-room-panel[data-room-key="${roomKey}"]`);
        panel?.querySelectorAll(".routine-device").forEach((deviceButton) => {
          const selected = action === "select";
          setDeviceButtonSelected(deviceButton, selected);
        });
        updatePreview();
      };
    });
  }

  function bindRoutineDeviceButtons() {
    document.querySelectorAll(".routine-device").forEach((button) => {
      button.onclick = () => {
        const selected = !button.classList.contains("is-selected");
        setDeviceButtonSelected(button, selected);
        updatePreview();
      };
    });
  }

  function bindTimeInput(id) {
    const input = byId(id);
    if (!input) return;

    input.oninput = () => {
      input.value = sanitizeTimeText(input.value);
      updatePreview();
    };

    const normalizeInput = () => {
      const normalized = normalizeTime(input.value);
      if (normalized) input.value = normalized;
      updatePreview();
    };

    input.onchange = normalizeInput;
    input.onblur = normalizeInput;
  }

  function bindRoutineBuilderScroll() {
    const shell = document.querySelector(".routines-builder-page .routines-shell--builder");
    if (!shell || shell.dataset.routineScrollBound === "true") return;
    shell.dataset.routineScrollBound = "true";
    shell.addEventListener(
      "scroll",
      () => {
        if (typeof global.notifyBottomNavScroll === "function") {
          global.notifyBottomNavScroll(shell);
        }
      },
      { passive: true },
    );
  }

  async function bindBuilderPage() {
    const editMode = isEditMode();
    bindRoutineBuilderScroll();
    state.editingRoutineId = editMode
      ? String(global.sessionStorage?.getItem("routineEditId") || "").trim()
      : "";
    if (!editMode) global.sessionStorage?.removeItem("routineEditId");

    setBuilderModeText(editMode);
    setFeedback(
      editMode ? "Carregando rotina e dispositivos autorizados..." : "Carregando dispositivos autorizados...",
      "neutral",
    );

    try {
      await Promise.all([loadDevices(), editMode ? loadRules() : Promise.resolve()]);
      populateDeviceSelect();
      bindRoutineRoomTabs();
      bindRoutineRoomActions();
      bindRoutineDeviceButtons();
      if (editMode) {
        const routine = getRoutineById(state.editingRoutineId);
        if (!state.editingRoutineId || !routine) {
          throw new Error("Escolha uma rotina existente para editar.");
        }
        applyRoutineToForm(routine);
      }
      setFeedback("", "neutral");
    } catch (error) {
      populateDeviceSelect();
      bindRoutineRoomTabs();
      bindRoutineRoomActions();
      bindRoutineDeviceButtons();
      setFeedback(error?.message || "Falha ao carregar dispositivos.", "error");
      const saveBtn = byId("routine-save-btn");
      if (editMode && saveBtn) saveBtn.disabled = true;
    }

    const backBtn = byId("routine-back-btn");
    if (backBtn) {
      backBtn.onclick = () => global.spaNavigate?.("scenes");
    }

    const saveBtn = byId("routine-save-btn");
    if (saveBtn) saveBtn.onclick = saveRoutine;

    ["routine-on-enabled", "routine-off-enabled"].forEach((id) => {
      const checkbox = byId(id);
      if (!checkbox) return;
      checkbox.onchange = () => {
        updateRoutineActionFields();
        updatePreview();
      };
    });

    const allBtn = byId("routine-days-all");
    if (allBtn) {
      allBtn.onclick = () => {
        document
          .querySelectorAll(".routine-day")
          .forEach((button) => button.classList.add("is-selected"));
        updatePreview();
      };
    }

    const allDevicesBtn = byId("routine-devices-all");
    if (allDevicesBtn) {
      allDevicesBtn.onclick = () => {
        document.querySelectorAll(".routine-device").forEach((button) => {
          setDeviceButtonSelected(button, true);
        });
        updatePreview();
      };
    }

    const clearDevicesBtn = byId("routine-devices-clear");
    if (clearDevicesBtn) {
      clearDevicesBtn.onclick = () => {
        document.querySelectorAll(".routine-device").forEach((button) => {
          setDeviceButtonSelected(button, false);
        });
        updatePreview();
      };
    }

    document.querySelectorAll(".routine-day").forEach((button) => {
      button.onclick = () => {
        button.classList.toggle("is-selected");
        updatePreview();
      };
    });

    const nameInput = byId("routine-name-input");
    if (nameInput) {
      nameInput.oninput = updatePreview;
      nameInput.onchange = updatePreview;
    }
    ["routine-on-time", "routine-off-time"].forEach(bindTimeInput);

    updateRoutineActionFields();
    updatePreview();
  }

  global.initRoutinesPage = function initRoutinesPage() {
    if (byId("routines-list")) {
      bindListPage();
      renderListPage();
      return;
    }

    if (document.querySelector(".routines-builder-page")) {
      bindBuilderPage();
    }
  };
})(window);
