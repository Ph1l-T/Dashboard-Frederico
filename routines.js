/* eslint-disable no-console */
(function (global) {
  "use strict";

  const API_URL = "/rule-engine-proxy";
  const ROUTINE_SOURCE = "dashboard-routine-v1";
  const DAY_LABELS = {
    mon: "Seg",
    tue: "Ter",
    wed: "Qua",
    thu: "Qui",
    fri: "Sex",
    sat: "Sab",
    sun: "Dom",
  };
  const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

  const state = {
    devices: [],
    rules: [],
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
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(raw) ? raw : "";
  }

  function setFeedback(message, type) {
    const el = byId("routines-feedback");
    if (!el) return;
    el.textContent = message || "";
    el.dataset.state = type || "neutral";
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

  function formatDays(days) {
    const normalized = Array.isArray(days) && days.length ? days : DAY_ORDER;
    if (DAY_ORDER.every((day) => normalized.includes(day))) return "Todos os dias";
    return DAY_ORDER.filter((day) => normalized.includes(day))
      .map((day) => DAY_LABELS[day])
      .join(", ");
  }

  function renderRoutineCard(routine) {
    const deviceLabel = formatDeviceLabels(routine.deviceIds || [routine.deviceId]);
    return `
      <article class="routine-card" data-routine-id="${escapeHtml(routine.id)}">
        <div class="routine-card__top">
          <div>
            <h3 class="routine-card__name">${escapeHtml(routine.name)}</h3>
            <p class="routine-card__meta">${escapeHtml(deviceLabel)}</p>
            <p class="routine-card__schedule">
              Liga ${escapeHtml(routine.onTime || "--:--")} · Desliga ${escapeHtml(routine.offTime || "--:--")}<br>
              ${escapeHtml(formatDays(routine.days))}
            </p>
          </div>
          <span class="routine-status" data-enabled="${routine.enabled ? "true" : "false"}">
            ${routine.enabled ? "Ativa" : "Pausada"}
          </span>
        </div>
        <div class="routine-card__actions">
          <button type="button" class="routines-btn routines-btn--secondary" data-routine-action="${routine.enabled ? "disable" : "enable"}">
            ${routine.enabled ? "Pausar" : "Ativar"}
          </button>
          <button type="button" class="routines-btn routines-btn--ghost" data-routine-action="delete">
            Excluir
          </button>
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
      const routines = groupRoutines(state.rules);
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

  function formatDeviceLabels(deviceIds) {
    const ids = (Array.isArray(deviceIds) ? deviceIds : [deviceIds])
      .map((id) => String(id || "").trim())
      .filter(Boolean);
    if (!ids.length) return "Dispositivo";
    const labels = ids.map(getDeviceLabel);
    if (labels.length <= 3) return labels.join(", ");
    return `${labels.slice(0, 3).join(", ")} +${labels.length - 3}`;
  }

  function updatePreview() {
    const preview = byId("routine-preview");
    if (!preview) return;

    const deviceIds = selectedDeviceIds();
    const deviceLabel = deviceIds.length
      ? formatDeviceLabels(deviceIds)
      : "dispositivos selecionados";
    const onTime = normalizeTime(byId("routine-on-time")?.value) || "--:--";
    const offTime = normalizeTime(byId("routine-off-time")?.value) || "--:--";
    const days = selectedDays();

    preview.innerHTML = `
      Quando for <strong>${escapeHtml(onTime)}</strong>, a Hubitat vai ligar <strong>${escapeHtml(deviceLabel)}</strong>.<br>
      Quando for <strong>${escapeHtml(offTime)}</strong>, a Hubitat vai desligar os mesmos dispositivos.<br>
      <span>${escapeHtml(formatDays(days))}</span>
    `;
  }

  function populateDeviceSelect() {
    const list = byId("routine-device-list");
    if (!list) return;

    if (!state.devices.length) {
      list.innerHTML =
        '<p class="routines-empty routines-empty--inline">Nenhum switch/dimmer com on/off encontrado</p>';
      return;
    }

    list.innerHTML = state.devices
      .map((device) => {
        const label = device.label || device.name || device.id;
        return `
          <button type="button" class="routine-device" data-device-id="${escapeHtml(device.id)}" aria-pressed="false">
            ${escapeHtml(label)}
          </button>
        `;
      })
      .join("");
  }

  function buildRoutineRules() {
    const name = String(byId("routine-name-input")?.value || "").trim();
    const deviceIds = selectedDeviceIds();
    const onTime = normalizeTime(byId("routine-on-time")?.value);
    const offTime = normalizeTime(byId("routine-off-time")?.value);
    const days = selectedDays();

    if (!name) throw new Error("Informe um nome para a rotina.");
    if (!deviceIds.length) throw new Error("Selecione ao menos um dispositivo.");
    if (!onTime || !offTime) throw new Error("Informe horarios validos.");
    if (onTime === offTime) throw new Error("Os horarios de ligar e desligar precisam ser diferentes.");
    if (!days.length) throw new Error("Selecione ao menos um dia.");

    const routineId = makeId("routine");
    const base = {
      routineId,
      source: ROUTINE_SOURCE,
      enabled: true,
      conditions: [],
    };

    return [
      {
        ...base,
        id: `${routineId}_on`,
        name: `${name} - ligar`,
        triggers: [{ type: "time", time: onTime, days }],
        actions: deviceIds.map((deviceId) => ({
          type: "deviceCommand",
          deviceId,
          command: "on",
          args: [],
        })),
      },
      {
        ...base,
        id: `${routineId}_off`,
        name: `${name} - desligar`,
        triggers: [{ type: "time", time: offTime, days }],
        actions: deviceIds.map((deviceId) => ({
          type: "deviceCommand",
          deviceId,
          command: "off",
          args: [],
        })),
      },
    ];
  }

  async function saveRoutine() {
    const saveBtn = byId("routine-save-btn");
    let created = [];

    try {
      const rules = buildRoutineRules();
      saveBtn.disabled = true;
      setFeedback("Salvando rotina na Hubitat...", "neutral");

      for (const rule of rules) {
        const saved = await api("/rules", { method: "POST", body: rule });
        created.push(saved);
      }

      setFeedback("Rotina salva na Hubitat.", "success");
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
    const routine = groupRoutines(state.rules).find((item) => item.id === routineId);
    if (!routine) return;

    setFeedback(enabled ? "Ativando rotina..." : "Pausando rotina...", "neutral");
    const suffix = enabled ? "enable" : "disable";
    await Promise.all(
      routine.rules.map((rule) => api(`/rules/${rule.id}/${suffix}`, { method: "POST" })),
    );
    await renderListPage();
  }

  async function deleteRoutine(routineId) {
    const routine = groupRoutines(state.rules).find((item) => item.id === routineId);
    if (!routine) return;

    if (!global.confirm(`Excluir a rotina "${routine.name}"?`)) return;

    setFeedback("Excluindo rotina...", "neutral");
    await Promise.all(
      routine.rules.map((rule) => api(`/rules/${rule.id}`, { method: "DELETE" })),
    );
    await renderListPage();
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
          if (action === "enable") await setRoutineEnabled(routineId, true);
          if (action === "disable") await setRoutineEnabled(routineId, false);
          if (action === "delete") await deleteRoutine(routineId);
        } catch (error) {
          setFeedback(error?.message || "Falha ao alterar rotina.", "error");
        }
      };
    }
  }

  async function bindBuilderPage() {
    setFeedback("Carregando dispositivos autorizados...", "neutral");
    try {
      await loadDevices();
      populateDeviceSelect();
      setFeedback("", "neutral");
    } catch (error) {
      populateDeviceSelect();
      setFeedback(error?.message || "Falha ao carregar dispositivos.", "error");
    }

    const backBtn = byId("routine-back-btn");
    if (backBtn) {
      backBtn.onclick = () => global.spaNavigate?.("scenes");
    }

    const saveBtn = byId("routine-save-btn");
    if (saveBtn) saveBtn.onclick = saveRoutine;

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
          button.classList.add("is-selected");
          button.setAttribute("aria-pressed", "true");
        });
        updatePreview();
      };
    }

    const clearDevicesBtn = byId("routine-devices-clear");
    if (clearDevicesBtn) {
      clearDevicesBtn.onclick = () => {
        document.querySelectorAll(".routine-device").forEach((button) => {
          button.classList.remove("is-selected");
          button.setAttribute("aria-pressed", "false");
        });
        updatePreview();
      };
    }

    document.querySelectorAll(".routine-device").forEach((button) => {
      button.onclick = () => {
        const selected = !button.classList.contains("is-selected");
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", selected ? "true" : "false");
        updatePreview();
      };
    });

    document.querySelectorAll(".routine-day").forEach((button) => {
      button.onclick = () => {
        button.classList.toggle("is-selected");
        updatePreview();
      };
    });

    [
      "routine-name-input",
      "routine-on-time",
      "routine-off-time",
    ].forEach((id) => {
      const el = byId(id);
      if (el) el.oninput = updatePreview;
      if (el) el.onchange = updatePreview;
    });

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
