/* eslint-disable no-console */
(function (global) {
  "use strict";

  const STORAGE_KEY = "eletrize:custom-scenes:v1";
  const EDITING_SCENE_STORAGE_KEY = "eletrize:custom-scenes:editing-scene-id";
  const FEEDBACK_STORAGE_KEY = "eletrize:custom-scenes:feedback";
  const SCENES_TABLE = "user_scenes";
  const CUSTOM_COMMAND_TOKEN = "__custom__";
  const INTERNAL_COMMANDS = new Set([
    "configure",
    "initialize",
    "keepalive",
    "reconnect",
    "refresh",
    "setvariable",
  ]);
  const MUSIC_TRANSPORT_COMMANDS = new Set([
    "play",
    "pause",
    "nexttrack",
    "previoustrack",
    "music",
    "movie",
  ]);
  const MUSIC_VOLUME_COMMANDS = new Set(["mute", "unmute", "setvolume"]);
  const MUSIC_POWER_COMMANDS = new Set(["on", "off", "poweron", "poweroff"]);
  const DEVICE_TYPE_FIELDS = [
    "tv",
    "htv",
    "bluray",
    "appletv",
    "clarotv",
    "music",
    "roku",
    "games",
    "hidromassagem",
  ];

  const DEVICE_TYPE_LABELS = {
    lights: "Luz",
    curtains: "Cortina",
    comfort: "Ar",
    tv: "TV",
    htv: "HTV",
    bluray: "Blu-ray",
    appletv: "Apple TV",
    clarotv: "Claro TV",
    music: "Música",
    roku: "Roku",
    games: "Games",
    hidromassagem: "Hidromassagem",
  };

  const SCENE_COMMAND_PRESETS_BY_TYPE = {
    comfort: ["on", "off"],
    bluray: ["on"],
    appletv: ["on"],
    clarotv: ["on"],
    roku: ["on"],
  };

  const HOME_THEATER_MEDIA_TYPES = new Set(["tv", "appletv", "clarotv", "bluray"]);

  const DEFAULT_COMMANDS_BY_TYPE = {
    lights: ["on", "off", "setLevel"],
    curtains: ["open", "stop", "close"],
    comfort: ["on", "off"],
    tv: ["powerOn", "powerOff", "mute", "home", "returnButton", "hdmi2", "hdmi3"],
    htv: ["on", "off", "home", "menu"],
    bluray: ["on"],
    appletv: ["on"],
    clarotv: ["on"],
    music: ["on", "off", "play", "pause", "nextTrack", "previousTrack", "mute", "unmute"],
    roku: ["on"],
    games: ["on", "off"],
    hidromassagem: ["on", "off"],
  };

  const DEVICE_TYPE_ICONS = {
    lights: "images/icons/icon-small-light-off.svg",
    curtains: "images/icons/icon-curtain.svg",
    comfort: "images/icons/ar-condicionado.svg",
    tv: "images/icons/icon-tv.svg",
    htv: "images/icons/icon-htv.svg",
    bluray: "images/icons/icon-bluray.svg",
    appletv: "images/icons/icon-apple-tv.svg",
    clarotv: "images/icons/icon-clarotv.svg",
    music: "images/icons/icon-musica.svg",
    roku: "images/icons/icon-roku.svg",
    games: "images/icons/icon-games.svg",
    hidromassagem: "images/icons/icon-hidromassagem.svg",
  };

  const COMMAND_LABELS = {
    on: "Ligar",
    off: "Desligar",
    poweron: "Ligar",
    poweroff: "Desligar",
    open: "Abrir",
    stop: "Parar",
    close: "Fechar",
    setlevel: "Definir intensidade",
    mute: "Mutar",
    unmute: "Desmutar",
    setvolume: "Definir volume",
    play: "Reproduzir",
    pause: "Pausar",
    nexttrack: "Próxima faixa",
    previoustrack: "Faixa anterior",
    channelup: "Canal acima",
    channeldown: "Canal abaixo",
    home: "Home",
    menu: "Menu",
    back: "Voltar",
    returnbutton: "Voltar",
    hdmi2: "HDMI 2",
    hdmi3: "HDMI 3",
    temp22: "22 graus",
    swingtoggle: "Alternar oscilação",
    swingon: "Oscilação ligar",
    swingoff: "Oscilação desligar",
  };

  const state = {
    devices: [],
    deviceMap: new Map(),
    scenes: [],
    draftSteps: [],
    editingSceneId: null,
    selectedEnvKey: "",
    selectedDeviceType: "",
    selectedDeviceRefId: "",
    selectedCommand: "",
    stepPickerTab: "environment",
    storageMode: "local",
  };
  let activeSceneConfirmationResolver = null;
  let activeSceneReviewResolver = null;

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function uniqueList(values) {
    const out = [];
    const seen = new Set();
    toArray(values).forEach((value) => {
      const normalized = String(value || "").trim();
      if (!normalized) return;
      const key = normalized.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(normalized);
    });
    return out;
  }

  function filterSceneCommands(values) {
    return uniqueList(values).filter(
      (value) => !INTERNAL_COMMANDS.has(normalizeText(value)),
    );
  }

  function makeId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function parseTimestampMs(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Date.now();
  }

  function sortScenesByRecent(values) {
    return toArray(values)
      .slice()
      .sort((a, b) => {
        const updatedDiff = Number(b?.updatedAt || 0) - Number(a?.updatedAt || 0);
        if (updatedDiff !== 0) return updatedDiff;
        return Number(b?.createdAt || 0) - Number(a?.createdAt || 0);
      });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function capitalizeWords(value) {
    return String(value || "")
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join(" ");
  }

  function formatCommandLabel(command) {
    const raw = String(command || "").trim();
    if (!raw) return "";
    if (raw === CUSTOM_COMMAND_TOKEN) return "Comando personalizado";
    const normalized = normalizeText(raw);
    if (COMMAND_LABELS[normalized]) {
      return COMMAND_LABELS[normalized];
    }
    const humanized = raw
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replaceAll("_", " ")
      .replaceAll("-", " ");
    return capitalizeWords(humanized);
  }

  function getControlCommandMap() {
    try {
      return CLIENT_CONFIG?.ui?.controlCommands || {};
    } catch (_error) {
      return {};
    }
  }

  function getAcBrandProfiles() {
    try {
      return CLIENT_CONFIG?.devices?.airConditionerBrands || {};
    } catch (_error) {
      return {};
    }
  }

  function resolveDeviceIcon(type) {
    const normalizedType = normalizeText(type);
    try {
      if (normalizedType === "lights") {
        const lightIcon = CLIENT_CONFIG?.ui?.toggles?.light?.off;
        if (lightIcon) return String(lightIcon);
      }
      const configuredIcon = CLIENT_CONFIG?.ui?.items?.[normalizedType]?.icon;
      if (configuredIcon) return String(configuredIcon);
    } catch (_error) {}
    return DEVICE_TYPE_ICONS[normalizedType] || DEVICE_TYPE_ICONS.lights;
  }

  function resolveCurtainTargetIds(curtain) {
    const ids = [];

    const targets = toArray(curtain?.targets);
    if (targets.length > 0) {
      targets.forEach((target) => {
        if (target && typeof target === "object") {
          const id = String(target.deviceId || target.id || "").trim();
          if (id) ids.push(id);
          return;
        }
        const id = String(target || "").trim();
        if (id) ids.push(id);
      });
    }

    if (ids.length === 0) {
      const fallbackId = String(curtain?.deviceId || curtain?.id || "").trim();
      if (fallbackId) {
        ids.push(fallbackId);
      }
    }

    return uniqueList(ids);
  }

  function resolveCurtainCommands(curtain) {
    const mapped = Object.values(curtain?.commands || {}).filter(Boolean);
    return filterSceneCommands([...mapped, ...DEFAULT_COMMANDS_BY_TYPE.curtains]);
  }

  function getSceneCommandPreset(type) {
    const normalizedType = normalizeText(type);
    return toArray(SCENE_COMMAND_PRESETS_BY_TYPE[normalizedType]);
  }

  function resolveLightCommands(light) {
    const commands = ["on", "off"];
    const type = normalizeText(light?.type || light?.class);
    if (type === "dimmer") {
      commands.push("setLevel");
    }
    return uniqueList(commands);
  }

  function resolveRemoteCommands(type, commandMap) {
    const preset = getSceneCommandPreset(type);
    if (preset.length > 0) {
      return uniqueList(preset);
    }

    const configured = toArray(commandMap?.[type]);
    const defaults = toArray(DEFAULT_COMMANDS_BY_TYPE[type]);
    return filterSceneCommands([...configured, ...defaults]);
  }

  function resolveAcCommands(env, acBrandProfiles) {
    const preset = getSceneCommandPreset("comfort");
    if (preset.length > 0) {
      return uniqueList(preset);
    }

    const acConfig = env?.airConditioner || {};
    const brandKey = normalizeText(acConfig?.brand || "default");
    const brand = acBrandProfiles?.[brandKey] || acBrandProfiles?.default || {};
    const available = toArray(brand?.availableCommands);
    const mapped = Object.values(brand?.commands || {}).filter(Boolean);
    const fallbackDefaults = available.length
      ? ["on", "off", "temp22"]
      : brand?.commands?.swingToggle
        ? ["on", "off", "temp22", "swingToggle"]
        : DEFAULT_COMMANDS_BY_TYPE.comfort;

    return filterSceneCommands([...available, ...mapped, ...fallbackDefaults]);
  }

  function buildDeviceCatalog() {
    const visibleEnvironments =
      typeof getVisibleEnvironments === "function"
        ? getVisibleEnvironments().filter((env) =>
            canCreateScenesForEnvironment(env?.key),
          )
        : [];

    const controlCommandMap = getControlCommandMap();
    const acBrandProfiles = getAcBrandProfiles();
    const catalog = [];
    const usedRefIds = new Set();

    function nextRefId(baseRef) {
      let ref = baseRef;
      let suffix = 2;
      while (usedRefIds.has(ref)) {
        ref = `${baseRef}:${suffix}`;
        suffix += 1;
      }
      usedRefIds.add(ref);
      return ref;
    }

    function registerDevice(env, type, deviceId, label, commands, extra = {}) {
      const id = String(deviceId || "").trim();
      if (!id) return;

      const envKey = String(env?.key || "").trim();
      const envName = String(env?.name || envKey || "Ambiente").trim();
      const typeLabel = DEVICE_TYPE_LABELS[type] || type;
      const cleanLabel = String(label || typeLabel || id).trim();
      const mergedCommands = filterSceneCommands([
        ...toArray(commands),
        ...toArray(DEFAULT_COMMANDS_BY_TYPE[type]),
      ]);

      const refBase = `${envKey || "global"}:${type}:${id}`;
      const refId = nextRefId(refBase);

      catalog.push({
        refId,
        envKey,
        envName,
        type,
        typeLabel,
        deviceId: id,
        label: cleanLabel,
        displayLabel: `${envName} - ${cleanLabel}`,
        icon: resolveDeviceIcon(type),
        commands: mergedCommands.length ? mergedCommands : ["on", "off"],
        metadataId: String(extra.metadataId || "").trim(),
        transportId: String(extra.transportId || "").trim(),
        volumeId: String(extra.volumeId || "").trim(),
        powerId: String(extra.powerId || "").trim(),
        receiverId: String(extra.receiverId || "").trim(),
        displayId: String(extra.displayId || "").trim(),
      });
    }

    visibleEnvironments.forEach((env) => {
      toArray(env?.lights).forEach((light, index) => {
        const label = light?.name || `Luz ${index + 1}`;
        registerDevice(env, "lights", light?.id || light?.deviceId, label, resolveLightCommands(light));
      });

      toArray(env?.curtains).forEach((curtain, index) => {
        const curtainName = String(curtain?.name || `Cortina ${index + 1}`).trim();
        const commands = resolveCurtainCommands(curtain);
        const targets = resolveCurtainTargetIds(curtain);
        targets.forEach((targetId, targetIndex) => {
          const name = targets.length > 1 ? `${curtainName} ${targetIndex + 1}` : curtainName;
          registerDevice(env, "curtains", targetId, name, commands);
        });
      });

      const acCommands = resolveAcCommands(env, acBrandProfiles);
      const acConfig = env?.airConditioner || null;
      if (acConfig?.deviceId) {
        registerDevice(env, "comfort", acConfig.deviceId, "Ar Condicionado", acCommands);
      }

      toArray(acConfig?.zones).forEach((zone, index) => {
        if (!zone?.deviceId) return;
        const zoneLabel = zone?.name
          ? `Ar ${zone.name}`
          : `Ar Zona ${index + 1}`;
        registerDevice(env, "comfort", zone.deviceId, zoneLabel, acCommands);
      });

      DEVICE_TYPE_FIELDS.forEach((type) => {
        toArray(env?.[type]).forEach((device, index) => {
          const label = device?.name || `${DEVICE_TYPE_LABELS[type] || type} ${index + 1}`;
          const commands = resolveRemoteCommands(type, controlCommandMap);
          const extraIds = {
            metadataId:
              type === "music"
                ? device?.metadataDeviceId ||
                  device?.metadataId ||
                  device?.id ||
                  device?.deviceId
                : "",
            transportId:
              type === "music"
                ? device?.transportDeviceId ||
                  device?.transportId ||
                  device?.id ||
                  device?.deviceId
                : "",
            volumeId: device?.volumeDeviceId || device?.volumeId || "",
            powerId: device?.powerDeviceId || device?.powerId || "",
            receiverId: device?.receiverDeviceId || device?.receiverId || "",
            displayId: device?.displayDeviceId || device?.displayId || "",
          };
          registerDevice(
            env,
            type,
            device?.id || device?.deviceId,
            label,
            commands,
            extraIds,
          );
        });
      });
    });

    catalog.sort((a, b) => {
      const envCmp = a.envName.localeCompare(b.envName, "pt-BR");
      if (envCmp !== 0) return envCmp;
      const typeCmp = a.typeLabel.localeCompare(b.typeLabel, "pt-BR");
      if (typeCmp !== 0) return typeCmp;
      return a.label.localeCompare(b.label, "pt-BR");
    });

    return catalog;
  }

  function readScenesFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return sortScenesByRecent(
        parsed
          .map(sanitizeScene)
          .filter(Boolean),
      );
    } catch (_error) {
      return [];
    }
  }

  function removeLegacyDemoScenes(scenes) {
    return toArray(scenes).filter((scene) => {
      const name = String(scene?.name || "").trim();
      const description = String(scene?.description || "").trim();
      return !(
        name === "Exemplo - Dormir" &&
        description === "Exemplo inicial. Você pode editar, duplicar ou excluir."
      );
    });
  }

  function purgeLegacyDemoScenes() {
    const filtered = removeLegacyDemoScenes(state.scenes);
    if (filtered.length === state.scenes.length) {
      return;
    }

    state.scenes = filtered;
    if (state.storageMode === "local") {
      writeScenesToStorage(state.scenes);
    }
  }

  function writeScenesToStorage(scenes) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scenes));
    } catch (error) {
      console.warn("Falha ao salvar cenários", error);
    }
  }

  function getDashboardAuthApi() {
    return global.dashboardAuth || null;
  }

  function getDashboardAccessApi() {
    return global.dashboardAccess || null;
  }

  async function waitForScenesAuthReady() {
    const authApi = getDashboardAuthApi();
    if (!authApi?.waitUntilReady) return;
    try {
      await authApi.waitUntilReady();
    } catch (_error) {
      // noop
    }
  }

  function getScenesStorageContext() {
    const authApi = getDashboardAuthApi();
    const client = authApi?.getClient ? authApi.getClient() : null;
    const user = authApi?.getUser ? authApi.getUser() : null;
    return {
      authApi,
      client,
      user,
      isRemoteReady: Boolean(client && user?.id),
    };
  }

  function canCreateScenesForEnvironment(envKey) {
    const accessApi = getDashboardAccessApi();
    if (!accessApi || typeof accessApi.canCreateScenesForEnvironment !== "function") {
      return true;
    }
    return accessApi.canCreateScenesForEnvironment(envKey);
  }

  function canUseSceneStep(step, purpose) {
    const accessApi = getDashboardAccessApi();
    if (!accessApi || typeof accessApi.isDeviceAllowed !== "function") {
      return true;
    }

    const deviceId = String(step?.deviceId || "").trim();
    if (!deviceId) return false;
    return accessApi.isDeviceAllowed(deviceId, purpose || "control");
  }

  function filterScenesByAccess(scenes) {
    return sortScenesByRecent(
      toArray(scenes).filter((scene) =>
        toArray(scene?.steps).every((step) => canUseSceneStep(step, "control")),
      ),
    );
  }

  function buildSceneStepsPayload(steps) {
    return toArray(steps)
      .map(sanitizeStep)
      .filter(Boolean)
      .map((step) => ({
        id: step.id,
        refId: step.refId,
        deviceId: step.deviceId,
        deviceType: step.deviceType,
        deviceName: step.deviceName,
        envName: step.envName,
        command: step.command,
        value: step.value,
        delayMs: 0,
      }));
  }

  function serializeSceneForRemote(scene, userId) {
    return {
      user_id: String(userId || "").trim(),
      name: String(scene?.name || "").trim(),
      description: String(scene?.description || "").trim(),
      steps: buildSceneStepsPayload(scene?.steps),
      created_at: new Date(parseTimestampMs(scene?.createdAt)).toISOString(),
      updated_at: new Date(parseTimestampMs(scene?.updatedAt)).toISOString(),
    };
  }

  function deserializeRemoteScene(row) {
    return sanitizeScene({
      id: row?.id,
      name: row?.name,
      description: row?.description,
      steps: row?.steps,
      createdAt: row?.created_at,
      updatedAt: row?.updated_at,
    });
  }

  async function fetchScenesFromRemote(client, userId) {
    const { data, error } = await client
      .from(SCENES_TABLE)
      .select("id, user_id, name, description, steps, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return sortScenesByRecent(
      toArray(data)
        .map(deserializeRemoteScene)
        .filter(Boolean),
    );
  }

  async function migrateLocalScenesToRemote(client, userId, localScenes) {
    const payload = sortScenesByRecent(localScenes).map((scene) =>
      serializeSceneForRemote(scene, userId),
    );

    if (!payload.length) {
      return [];
    }

    const { error } = await client
      .from(SCENES_TABLE)
      .insert(payload);

    if (error) {
      throw error;
    }

    writeScenesToStorage([]);
    return fetchScenesFromRemote(client, userId);
  }

  async function loadScenesCollection() {
    const localScenes = removeLegacyDemoScenes(readScenesFromStorage());

    await waitForScenesAuthReady();
    const { client, user, isRemoteReady } = getScenesStorageContext();

    if (!isRemoteReady) {
      state.storageMode = "local";
      return filterScenesByAccess(localScenes);
    }

    try {
      let remoteScenes = removeLegacyDemoScenes(
        await fetchScenesFromRemote(client, user.id),
      );

      if (!remoteScenes.length && localScenes.length) {
        remoteScenes = removeLegacyDemoScenes(
          await migrateLocalScenesToRemote(client, user.id, localScenes),
        );
      }

      state.storageMode = "remote";
      return filterScenesByAccess(remoteScenes);
    } catch (error) {
      console.warn("Falha ao carregar cenários no Supabase. Usando localStorage.", error);
      state.storageMode = "local";
      return filterScenesByAccess(localScenes);
    }
  }

  async function createSceneRecord(scene) {
    const sanitized = sanitizeScene(scene);
    if (!sanitized) {
      throw new Error("Cenário inválido.");
    }

    const { client, user, isRemoteReady } = getScenesStorageContext();
    if (state.storageMode !== "remote" || !isRemoteReady) {
      const localScene = {
        ...sanitized,
        id: makeId("scene"),
      };
      state.storageMode = "local";
      return localScene;
    }

    const payload = serializeSceneForRemote(sanitized, user.id);
    const { data, error } = await client
      .from(SCENES_TABLE)
      .insert(payload)
      .select("id, user_id, name, description, steps, created_at, updated_at")
      .single();

    if (error) {
      throw error;
    }

    state.storageMode = "remote";
    return deserializeRemoteScene(data);
  }

  async function updateSceneRecord(sceneId, scene) {
    const sanitized = sanitizeScene({
      ...scene,
      id: sceneId,
    });
    if (!sanitized) {
      throw new Error("Cenário inválido.");
    }

    const { client, user, isRemoteReady } = getScenesStorageContext();
    if (state.storageMode !== "remote" || !isRemoteReady) {
      state.storageMode = "local";
      return sanitized;
    }

    const payload = {
      user_id: String(user.id || "").trim(),
      name: sanitized.name,
      description: sanitized.description,
      steps: buildSceneStepsPayload(sanitized.steps),
      updated_at: new Date(parseTimestampMs(sanitized.updatedAt)).toISOString(),
    };
    const { data, error } = await client
      .from(SCENES_TABLE)
      .update(payload)
      .eq("id", sceneId)
      .eq("user_id", user.id)
      .select("id, user_id, name, description, steps, created_at, updated_at")
      .single();

    if (error) {
      throw error;
    }

    state.storageMode = "remote";
    return deserializeRemoteScene(data);
  }

  async function deleteSceneRecord(sceneId) {
    const { client, user, isRemoteReady } = getScenesStorageContext();
    if (state.storageMode !== "remote" || !isRemoteReady) {
      state.storageMode = "local";
      return;
    }

    const { error } = await client
      .from(SCENES_TABLE)
      .delete()
      .eq("id", sceneId)
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }

    state.storageMode = "remote";
  }

  function sanitizeStep(rawStep) {
    if (!rawStep || typeof rawStep !== "object") return null;

    const command = String(rawStep.command || "").trim();
    const deviceId = String(rawStep.deviceId || "").trim();
    const refId = String(rawStep.refId || "").trim();

    if (!command || !deviceId) return null;

    const numericDelay = Number.parseInt(rawStep.delayMs, 10);

    return {
      id: String(rawStep.id || makeId("step")).trim(),
      refId,
      deviceId,
      deviceType: String(rawStep.deviceType || "").trim(),
      deviceName: String(rawStep.deviceName || deviceId).trim(),
      envName: String(rawStep.envName || "").trim(),
      command,
      value:
        rawStep.value === null || rawStep.value === undefined
          ? ""
          : String(rawStep.value),
      delayMs: Number.isFinite(numericDelay) ? Math.max(0, numericDelay) : 0,
    };
  }

  function sanitizeScene(rawScene) {
    if (!rawScene || typeof rawScene !== "object") return null;

    const name = String(rawScene.name || "").trim();
    if (!name) return null;

    const steps = toArray(rawScene.steps)
      .map(sanitizeStep)
      .filter(Boolean);

    return {
      id: String(rawScene.id || makeId("scene")).trim(),
      name,
      description: String(rawScene.description || "").trim(),
      steps,
      createdAt: parseTimestampMs(rawScene.createdAt),
      updatedAt: parseTimestampMs(rawScene.updatedAt),
    };
  }

  function getEl(id) {
    return document.getElementById(id);
  }

  function navigateTo(route) {
    const target = String(route || "").trim();
    if (!target) return;
    if (typeof global.spaNavigate === "function") {
      global.spaNavigate(target);
      return;
    }
    global.location.hash = `#${target}`;
  }

  function setFeedback(message, isError) {
    const feedback = getEl("scenes-feedback");
    if (!feedback) return;
    feedback.textContent = String(message || "").trim();
    feedback.style.color = isError
      ? "rgba(255, 132, 132, 0.95)"
      : "rgba(255, 255, 255, 0.78)";
  }

  function clearFeedback() {
    setFeedback("", false);
  }

  function requestSceneConfirmation(message, options = {}) {
    const overlay = getEl("confirmation-popup");
    const titleEl = getEl("popup-title");
    const messageEl = getEl("popup-message");
    const confirmBtn = getEl("popup-confirm");
    const cancelBtn = getEl("popup-cancel");

    if (!overlay || !messageEl || !confirmBtn || !cancelBtn) {
      return Promise.resolve(global.confirm(String(message || "")));
    }

    if (activeSceneConfirmationResolver) {
      activeSceneConfirmationResolver(false);
      activeSceneConfirmationResolver = null;
    }

    const confirmLabel = String(options.confirmLabel || "Confirmar").trim() || "Confirmar";
    const title = String(options.title || "Confirmar ação").trim() || "Confirmar ação";
    const destructive = Boolean(options.destructive);

    return new Promise((resolve) => {
      const finish = (confirmed) => {
        overlay.style.display = "none";
        overlay.setAttribute("aria-hidden", "true");
        if (titleEl) titleEl.textContent = "Confirmar ação";
        messageEl.textContent = "";
        confirmBtn.textContent = "Confirmar";
        confirmBtn.classList.toggle("is-danger", false);
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
        overlay.onclick = null;
        document.removeEventListener("keydown", handleKeyDown);
        if (activeSceneConfirmationResolver === finish) {
          activeSceneConfirmationResolver = null;
        }
        resolve(Boolean(confirmed));
      };

      const handleKeyDown = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          finish(false);
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          finish(true);
        }
      };

      activeSceneConfirmationResolver = finish;
      if (titleEl) titleEl.textContent = title;
      messageEl.textContent = String(message || "").trim();
      confirmBtn.textContent = confirmLabel;
      confirmBtn.classList.toggle("is-danger", destructive);
      overlay.style.display = "flex";
      overlay.setAttribute("aria-hidden", "false");
      confirmBtn.onclick = () => finish(true);
      cancelBtn.onclick = () => finish(false);
      overlay.onclick = (event) => {
        if (event.target === overlay) {
          finish(false);
        }
      };
      document.addEventListener("keydown", handleKeyDown);
      confirmBtn.focus?.();
    });
  }

  function ensureSceneReviewOverlay() {
    let overlay = getEl("scene-save-review-overlay");
    if (overlay) return overlay;

    if (typeof document === "undefined" || !document.body) return null;

    overlay = document.createElement("div");
    overlay.id = "scene-save-review-overlay";
    overlay.className = "scene-save-review-overlay";
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div
        class="scene-save-review-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scene-save-review-title"
      >
        <div class="scene-save-review-head">
          <span class="scene-save-review-kicker">Revisão</span>
          <h2 class="scene-save-review-title" id="scene-save-review-title">Conferir cenário</h2>
        </div>

        <div class="scene-save-review-body">
          <section class="scene-save-review-summary" data-scene-review-summary></section>
          <section class="scene-save-review-warning" data-scene-review-warning hidden></section>
          <ol class="scene-save-review-steps" data-scene-review-steps></ol>
        </div>

        <div class="scene-save-review-actions">
          <button type="button" class="scenes-btn scenes-btn--secondary" data-scene-review-cancel>
            Voltar para editar
          </button>
          <button type="button" class="scenes-btn scenes-btn--primary" data-scene-review-confirm>
            Confirmar e salvar
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function stepUsesDemoDevice(step) {
    const values = [
      step?.deviceId,
      step?.metadataId,
      step?.transportId,
      step?.volumeId,
      step?.powerId,
      step?.receiverId,
      step?.displayId,
    ];

    const device = resolveSceneDevice(step);
    if (device) {
      values.push(
        device.deviceId,
        device.metadataId,
        device.transportId,
        device.volumeId,
        device.powerId,
        device.receiverId,
        device.displayId,
      );
    }

    return values.some((value) =>
      String(value || "").trim().toUpperCase().startsWith("DEMO-"),
    );
  }

  function getReviewStepTargetId(step) {
    const command = resolveSceneExecutionCommand(step);
    const targetId =
      resolveSceneExecutionTargetId(step, command) ||
      String(step?.deviceId || "").trim();
    return String(targetId || "").trim();
  }

  function getReviewStepCommandKey(step) {
    const command = resolveSceneExecutionCommand(step) || step?.command;
    return normalizeText(command);
  }

  function getReviewStepDuplicateKey(step) {
    const device = resolveSceneDevice(step);
    return [
      getReviewStepTargetId(step),
      normalizeText(step?.deviceType || device?.type),
      getReviewStepCommandKey(step),
      String(step?.value || "").trim(),
    ].join("|");
  }

  function classifyReviewCommand(command) {
    const normalized = normalizeText(command);
    if (normalized === "on" || normalized === "poweron") return "on";
    if (normalized === "off" || normalized === "poweroff") return "off";
    if (normalized === "open") return "open";
    if (normalized === "close") return "close";
    if (normalized === "mute") return "mute";
    if (normalized === "unmute") return "unmute";
    return normalized;
  }

  function buildSceneReviewIssues(steps) {
    const issues = [];
    const safeSteps = toArray(steps);
    const demoCount = safeSteps.filter(stepUsesDemoDevice).length;

    if (demoCount > 0) {
      issues.push({
        title: "Dispositivos demo",
        detail: `Há ${demoCount} ação${demoCount === 1 ? "" : "es"} usando ID DEMO. Troque os IDs antes de usar em cliente real.`,
      });
    }

    const unresolvedCount = safeSteps.filter((step) => !resolveSceneDevice(step)).length;
    if (unresolvedCount > 0) {
      issues.push({
        title: "Dispositivo não encontrado no catálogo",
        detail: `${unresolvedCount} ação${unresolvedCount === 1 ? "" : "es"} aponta para dispositivo que não foi localizado no config atual.`,
      });
    }

    const missingValueSteps = safeSteps.filter((step) => {
      const device = resolveSceneDevice(step) || { type: step?.deviceType };
      const valueConfig = getCommandValueConfig(device, step?.command);
      const requiresValue = valueConfig?.visible === true && valueConfig?.kind === "range";
      return requiresValue && !String(step?.value || "").trim();
    });
    if (missingValueSteps.length > 0) {
      issues.push({
        title: "Parâmetro ausente",
        detail: `${missingValueSteps.length} ação${missingValueSteps.length === 1 ? "" : "es"} parece exigir valor, como intensidade, volume ou temperatura.`,
      });
    }

    const duplicateGroups = new Map();
    safeSteps.forEach((step) => {
      const key = getReviewStepDuplicateKey(step);
      if (!key.replaceAll("|", "")) return;
      if (!duplicateGroups.has(key)) duplicateGroups.set(key, []);
      duplicateGroups.get(key).push(step);
    });
    const repeatedGroups = Array.from(duplicateGroups.values()).filter(
      (group) => group.length > 1,
    );
    if (repeatedGroups.length > 0) {
      const repeatedTotal = repeatedGroups.reduce(
        (total, group) => total + group.length,
        0,
      );
      issues.push({
        title: "Ações repetidas",
        detail: `${repeatedTotal} ações estão repetindo o mesmo dispositivo, comando e valor. Revise se isso não foi adicionado por engano.`,
      });
    }

    const targetCommandMap = new Map();
    safeSteps.forEach((step) => {
      const targetId = getReviewStepTargetId(step);
      if (!targetId) return;
      if (!targetCommandMap.has(targetId)) {
        targetCommandMap.set(targetId, {
          labels: new Set(),
          commands: new Set(),
        });
      }
      const entry = targetCommandMap.get(targetId);
      entry.labels.add(cleanStepDeviceName(step));
      entry.commands.add(classifyReviewCommand(getReviewStepCommandKey(step)));
    });

    const conflictLabels = [];
    targetCommandMap.forEach((entry) => {
      const commands = entry.commands;
      const hasPowerConflict = commands.has("on") && commands.has("off");
      const hasCurtainConflict = commands.has("open") && commands.has("close");
      const hasMuteConflict = commands.has("mute") && commands.has("unmute");
      if (hasPowerConflict || hasCurtainConflict || hasMuteConflict) {
        conflictLabels.push(Array.from(entry.labels)[0] || "Dispositivo");
      }
    });

    if (conflictLabels.length > 0) {
      const visibleLabels = conflictLabels.slice(0, 3).join(", ");
      const remaining = conflictLabels.length - Math.min(conflictLabels.length, 3);
      issues.push({
        title: "Comandos conflitantes",
        detail: `O cenário tem comandos opostos para ${visibleLabels}${remaining > 0 ? ` e mais ${remaining}` : ""}. Pode ser intencional, mas vale revisar a ordem.`,
      });
    }

    return issues;
  }

  function renderSceneReviewIssues(issues) {
    if (!issues.length) return "";
    return `
      <h3 class="scene-save-review-warning-title">Pontos para revisar</h3>
      <ul class="scene-save-review-warning-list">
        ${issues
          .map(
            (issue) => `
              <li>
                <strong>${escapeHtml(issue.title)}</strong>
                <span>${escapeHtml(issue.detail)}</span>
              </li>
            `,
          )
          .join("")}
      </ul>
    `;
  }

  function buildSceneReviewSummary(sceneDraft) {
    const steps = toArray(sceneDraft?.steps);
    const environments = getSceneEnvironmentLabels(steps);
    const issues = buildSceneReviewIssues(steps);
    const envText = environments.length
      ? environments.join(", ")
      : "Sem ambiente identificado";

    return {
      steps,
      environments,
      issues,
      html: `
        <div class="scene-save-review-name">${escapeHtml(sceneDraft?.name || "")}</div>
        ${
          sceneDraft?.description
            ? `<p class="scene-save-review-description">${escapeHtml(sceneDraft.description)}</p>`
            : ""
        }
        <div class="scene-save-review-metrics">
          <span>${steps.length} ação${steps.length === 1 ? "" : "es"}</span>
          <span>${environments.length || 0} ambiente${environments.length === 1 ? "" : "s"}</span>
        </div>
        <div class="scene-save-review-envs">${escapeHtml(envText)}</div>
      `,
      warningHtml: renderSceneReviewIssues(issues),
    };
  }

  function requestSceneSaveReview(sceneDraft) {
    const overlay = ensureSceneReviewOverlay();
    const steps = toArray(sceneDraft?.steps);

    if (!overlay) {
      return Promise.resolve(
        global.confirm(
          `Salvar o cenário "${sceneDraft?.name || ""}" com ${steps.length} ação${steps.length === 1 ? "" : "es"}?`,
        ),
      );
    }

    if (activeSceneReviewResolver) {
      activeSceneReviewResolver(false);
      activeSceneReviewResolver = null;
    }

    const dialog = overlay.querySelector(".scene-save-review-dialog");
    const summaryEl = overlay.querySelector("[data-scene-review-summary]");
    const warningEl = overlay.querySelector("[data-scene-review-warning]");
    const stepsEl = overlay.querySelector("[data-scene-review-steps]");
    const cancelBtn = overlay.querySelector("[data-scene-review-cancel]");
    const confirmBtn = overlay.querySelector("[data-scene-review-confirm]");

    if (!summaryEl || !warningEl || !stepsEl || !cancelBtn || !confirmBtn) {
      return Promise.resolve(
        global.confirm(
          `Salvar o cenário "${sceneDraft?.name || ""}" com ${steps.length} ação${steps.length === 1 ? "" : "es"}?`,
        ),
      );
    }

    const summary = buildSceneReviewSummary(sceneDraft);
    summaryEl.innerHTML = summary.html;
    warningEl.hidden = !summary.warningHtml;
    warningEl.innerHTML = summary.warningHtml;
    stepsEl.innerHTML = summary.steps
      .map((step, index) => {
        const meta = formatStepMetaText(step);
        return `
          <li class="scene-save-review-step">
            <span class="scene-save-review-step-index">${index + 1}</span>
            <span class="scene-save-review-step-copy">
              <span class="scene-save-review-step-title">${escapeHtml(formatStepActionTitle(step))}</span>
              ${meta ? `<span class="scene-save-review-step-meta">${escapeHtml(meta)}</span>` : ""}
            </span>
          </li>
        `;
      })
      .join("");

    return new Promise((resolve) => {
      const finish = (confirmed) => {
        overlay.hidden = true;
        overlay.classList.remove("is-visible");
        overlay.setAttribute("aria-hidden", "true");
        cancelBtn.onclick = null;
        confirmBtn.onclick = null;
        overlay.onclick = null;
        document.removeEventListener("keydown", handleKeyDown);
        if (activeSceneReviewResolver === finish) {
          activeSceneReviewResolver = null;
        }
        resolve(Boolean(confirmed));
      };

      const handleKeyDown = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          finish(false);
        }
      };

      activeSceneReviewResolver = finish;
      overlay.hidden = false;
      overlay.classList.add("is-visible");
      overlay.setAttribute("aria-hidden", "false");
      cancelBtn.onclick = () => finish(false);
      confirmBtn.onclick = () => finish(true);
      overlay.onclick = (event) => {
        if (event.target === overlay) {
          finish(false);
        }
      };
      document.addEventListener("keydown", handleKeyDown);
      dialog?.setAttribute("tabindex", "-1");
      confirmBtn.focus?.();
    });
  }

  function isBuilderPageActive() {
    return Boolean(document.querySelector(".scenes-builder-page"));
  }

  function setInvalidState(element, invalid) {
    if (!element) return;
    element.classList.toggle("is-invalid", Boolean(invalid));
    if (
      element.matches &&
      element.matches("input, textarea, select, button")
    ) {
      if (invalid) {
        element.setAttribute("aria-invalid", "true");
      } else {
        element.removeAttribute("aria-invalid");
      }
    }
  }

  function clearBuilderValidation() {
    if (!isBuilderPageActive()) return;

    const nameInput = getEl("scene-name-input");
    const nameField = nameInput?.closest(".scenes-field");
    const stepsCard = document.querySelector(".scenes-builder-page .scenes-steps-card");

    setInvalidState(nameInput, false);
    setInvalidState(nameField, false);
    setInvalidState(stepsCard, false);
  }

  function clearBuilderNameValidation() {
    const nameInput = getEl("scene-name-input");
    const nameField = nameInput?.closest(".scenes-field");
    setInvalidState(nameInput, false);
    setInvalidState(nameField, false);
  }

  function clearBuilderStepsValidation() {
    const stepsCard = document.querySelector(".scenes-builder-page .scenes-steps-card");
    setInvalidState(stepsCard, false);
  }

  function markBuilderNameInvalid() {
    const nameInput = getEl("scene-name-input");
    const nameField = nameInput?.closest(".scenes-field");
    setInvalidState(nameInput, true);
    setInvalidState(nameField, true);
    nameInput?.focus?.();
    nameInput?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }

  function markBuilderStepsInvalid() {
    const stepsCard = document.querySelector(".scenes-builder-page .scenes-steps-card");
    setInvalidState(stepsCard, true);
    stepsCard?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }

  function persistEditingSceneId(sceneId) {
    try {
      if (sceneId) {
        localStorage.setItem(EDITING_SCENE_STORAGE_KEY, String(sceneId));
      } else {
        localStorage.removeItem(EDITING_SCENE_STORAGE_KEY);
      }
    } catch (_error) {}
  }

  function consumeEditingSceneId() {
    try {
      const raw = localStorage.getItem(EDITING_SCENE_STORAGE_KEY);
      localStorage.removeItem(EDITING_SCENE_STORAGE_KEY);
      return String(raw || "").trim();
    } catch (_error) {
      return "";
    }
  }

  function persistFeedbackMessage(message, isError) {
    try {
      const payload = {
        message: String(message || ""),
        isError: Boolean(isError),
      };
      localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(payload));
    } catch (_error) {}
  }

  function consumeFeedbackMessage() {
    try {
      const raw = localStorage.getItem(FEEDBACK_STORAGE_KEY);
      localStorage.removeItem(FEEDBACK_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      const message = String(parsed.message || "").trim();
      if (!message) return null;
      return {
        message,
        isError: Boolean(parsed.isError),
      };
    } catch (_error) {
      return null;
    }
  }

  function getEnvironmentOptions() {
    const grouped = new Map();
    state.devices.forEach((device) => {
      const key = String(device?.envKey || device?.envName || "global").trim();
      if (!key) return;
      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          label: String(device?.envName || key || "Ambiente").trim(),
          count: 0,
        });
      }
      grouped.get(key).count += 1;
    });

    return Array.from(grouped.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "pt-BR"),
    );
  }

  function getSelectedEnvironmentOption() {
    const key = String(state.selectedEnvKey || "").trim();
    if (!key) return null;
    return getEnvironmentOptions().find((option) => option.key === key) || null;
  }

  function getDeviceTypeOptions() {
    const grouped = new Map();
    state.devices.forEach((device) => {
      if (state.selectedEnvKey && device.envKey !== state.selectedEnvKey) {
        return;
      }

      const type = normalizeText(device?.type);
      if (!type) return;
      if (!grouped.has(type)) {
        grouped.set(type, {
          type,
          label: device?.typeLabel || DEVICE_TYPE_LABELS[type] || type,
          icon: resolveDeviceIcon(type),
          count: 0,
        });
      }
      grouped.get(type).count += 1;
    });

    return Array.from(grouped.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "pt-BR"),
    );
  }

  function getSelectedDeviceTypeOption() {
    const type = normalizeText(state.selectedDeviceType);
    if (!type) return null;
    return getDeviceTypeOptions().find((option) => option.type === type) || null;
  }

  function getFilteredDevices() {
    return state.devices.filter((device) => {
      if (state.selectedEnvKey && device.envKey !== state.selectedEnvKey) {
        return false;
      }
      if (
        state.selectedDeviceType &&
        normalizeText(device.type) !== normalizeText(state.selectedDeviceType)
      ) {
        return false;
      }
      return true;
    });
  }

  function getSelectedDevice() {
    const refId = String(state.selectedDeviceRefId || "").trim();
    if (!refId) return null;
    return state.deviceMap.get(refId) || null;
  }

  function getAvailableCommands(device) {
    if (!device) return [];

    const baseCommands = filterSceneCommands(toArray(device.commands));
    const preset = getSceneCommandPreset(device.type);

    if (preset.length > 0) {
      return uniqueList(baseCommands.length ? baseCommands : preset);
    }

    return filterSceneCommands([...baseCommands, CUSTOM_COMMAND_TOKEN]);
  }

  function getResolvedSelectedCommand() {
    let command = String(state.selectedCommand || "").trim();
    if (command === CUSTOM_COMMAND_TOKEN) {
      command = String(getEl("scene-step-custom-command")?.value || "").trim();
    }
    return command;
  }

  function getCommandValueConfig(device, command) {
    const normalized = normalizeText(command);
    const deviceType = normalizeText(device?.type);

    if (!normalized) {
      return { visible: false };
    }

    if (command === CUSTOM_COMMAND_TOKEN) {
      return {
        visible: true,
        kind: "text",
        label: "Valor personalizado",
        placeholder: "Opcional",
        help: "Use apenas se o comando personalizado exigir parametro.",
      };
    }

    if (normalized === "setlevel") {
      return {
        visible: true,
        kind: "range",
        label: "Intensidade",
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 50,
        suffix: "%",
        help: "Defina a intensidade da luz.",
      };
    }

    if (normalized === "setvolume" || normalized === "volume") {
      return {
        visible: true,
        kind: "range",
        label: "Volume",
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 40,
        suffix: "%",
        help: "Defina o volume desejado.",
      };
    }

    if (
      deviceType === "comfort" &&
      (normalized.includes("temperature") ||
        normalized.includes("setpoint") ||
        normalized.includes("cooling"))
    ) {
      return {
        visible: true,
        kind: "range",
        label: "Temperatura",
        min: 16,
        max: 30,
        step: 1,
        defaultValue: 22,
        suffix: " graus",
        help: "Defina a temperatura do ar-condicionado.",
      };
    }

    return { visible: false };
  }

  function selectedValueConfig() {
    return getCommandValueConfig(getSelectedDevice(), state.selectedCommand);
  }

  function cleanStepDeviceName(step) {
    const raw = String(step?.deviceName || step?.deviceId || "").trim();
    if (!raw) return "Dispositivo";
    return raw.replace(/^[^-]+ - /, "").trim() || raw;
  }

  function stepLocationText(step) {
    return String(step?.envName || "").trim();
  }

  function formatStepValueText(step) {
    const value = String(step?.value || "").trim();
    if (!value) return "";

    const config = getCommandValueConfig(
      { type: step?.deviceType },
      step?.command,
    );
    return `${value}${config.suffix || ""}`;
  }

  function formatStepActionTitle(step) {
    const command = normalizeText(step?.command);
    const name = cleanStepDeviceName(step);
    const valueText = formatStepValueText(step);

    if (command === "on" || command === "poweron") return `Ligar ${name}`;
    if (command === "off" || command === "poweroff") return `Desligar ${name}`;
    if (command === "open") return `Abrir ${name}`;
    if (command === "close") return `Fechar ${name}`;
    if (command === "stop") return `Parar ${name}`;
    if (command === "setlevel") {
      return `Ajustar ${name}${valueText ? ` para ${valueText}` : ""}`;
    }
    if (command === "setvolume" || command === "volume") {
      return `Volume de ${name}${valueText ? ` em ${valueText}` : ""}`;
    }
    if (command === "mute") return `Mutar ${name}`;
    if (command === "unmute") return `Desmutar ${name}`;
    if (command === "play") return `Reproduzir ${name}`;
    if (command === "pause") return `Pausar ${name}`;
    if (command === "nexttrack") return `Proxima faixa em ${name}`;
    if (command === "previoustrack") return `Faixa anterior em ${name}`;
    if (command === "temp22") return `Ajustar ${name} para 22 graus`;

    return `${formatCommandLabel(step?.command)} em ${name}`;
  }

  function formatStepMetaText(step) {
    const parts = [];
    const location = stepLocationText(step);
    if (location) parts.push(location);
    if (step?.deviceType) {
      parts.push(DEVICE_TYPE_LABELS[normalizeText(step.deviceType)] || step.deviceType);
    }
    const valueText = formatStepValueText(step);
    if (
      valueText &&
      !["setlevel", "setvolume", "volume"].includes(normalizeText(step?.command))
    ) {
      parts.push(valueText);
    }
    return parts.join(" • ");
  }

  function renderStepTabState() {
    const environmentPanel = getEl("scene-step-environments-panel");
    const typesPanel = getEl("scene-step-types-panel");
    const devicesPanel = getEl("scene-step-devices-panel");
    const commandsPanel = getEl("scene-step-commands-panel");
    const tabButtons = document.querySelectorAll(".scenes-step-tab[data-scene-step-tab]");
    const hasEnvironment = Boolean(state.selectedEnvKey);
    const hasType = Boolean(state.selectedDeviceType);
    const hasDevice = Boolean(getSelectedDevice());
    const requestedTab = String(state.stepPickerTab || "").trim();

    const canOpenTab = (tab) => {
      if (tab === "environment") return true;
      if (tab === "type") return hasEnvironment;
      if (tab === "devices") return hasEnvironment && hasType;
      if (tab === "commands") return hasDevice;
      return false;
    };

    const nextRequiredTab = () => {
      if (!hasEnvironment) return "environment";
      if (!hasType) return "type";
      if (!hasDevice) return "devices";
      if (!state.selectedCommand) return "commands";
      return "";
    };

    const activeTab = canOpenTab(requestedTab)
      ? requestedTab
      : nextRequiredTab();
    state.stepPickerTab = activeTab;

    tabButtons.forEach((button) => {
      const tab = String(button.dataset.sceneStepTab || "").trim();
      button.classList.toggle("is-active", tab === activeTab);
      button.disabled = !canOpenTab(tab);
    });

    if (environmentPanel) environmentPanel.hidden = activeTab !== "environment";
    if (typesPanel) typesPanel.hidden = activeTab !== "type";
    if (devicesPanel) devicesPanel.hidden = activeTab !== "devices";
    if (commandsPanel) commandsPanel.hidden = activeTab !== "commands";
  }

  function renderSelectedStepSummary() {
    const summary = getEl("scene-step-selection");
    if (!summary) return;

    const environment = getSelectedEnvironmentOption();
    const type = getSelectedDeviceTypeOption();
    const device = getSelectedDevice();
    const command = String(state.selectedCommand || "").trim();

    if (!environment && !type && !device && !command) {
      summary.hidden = true;
      summary.innerHTML = "";
      return;
    }

    const chunks = [];

    if (environment) {
      chunks.push(`
        <button
          type="button"
          class="scenes-selection-card"
          data-scene-step-tab="environment"
        >
          <span class="scenes-selection-text">
            <span class="scenes-selection-meta">Ambiente</span>
            <span class="scenes-selection-title">${escapeHtml(environment.label)}</span>
          </span>
        </button>
      `);
    }

    if (type) {
      chunks.push(`
        <button
          type="button"
          class="scenes-selection-card"
          data-scene-step-tab="type"
        >
          <img class="scenes-selection-icon" src="${escapeHtml(type.icon)}" alt="${escapeHtml(type.label)}" />
          <span class="scenes-selection-text">
            <span class="scenes-selection-meta">Tipo</span>
            <span class="scenes-selection-title">${escapeHtml(type.label)}</span>
          </span>
        </button>
      `);
    }

    if (device) {
      chunks.push(`
        <button
          type="button"
          class="scenes-selection-card scenes-selection-card--device"
          data-scene-step-tab="devices"
        >
          <img class="scenes-selection-icon" src="${escapeHtml(device.icon)}" alt="${escapeHtml(device.label)}" />
          <span class="scenes-selection-text">
            <span class="scenes-selection-meta">Dispositivo</span>
            <span class="scenes-selection-title">${escapeHtml(device.label)}</span>
          </span>
        </button>
      `);
    }

    if (command) {
      chunks.push(`
        <button
          type="button"
          class="scenes-selection-card scenes-selection-card--command"
          data-scene-step-tab="commands"
        >
          <span class="scenes-selection-text">
            <span class="scenes-selection-meta">Ação</span>
            <span class="scenes-selection-title">${escapeHtml(formatCommandLabel(command))}</span>
          </span>
        </button>
      `);
    }

    summary.hidden = false;
    summary.innerHTML = chunks.join("");
  }

  function renderEnvironmentPicker() {
    const panel = getEl("scene-step-environments-panel");
    if (!panel) return;

    const environments = getEnvironmentOptions();
    if (!environments.length) {
      panel.innerHTML =
        '<div class="scenes-picker-empty">Nenhum ambiente com dispositivo disponível.</div>';
      return;
    }

    panel.innerHTML = `
      <div class="scenes-picker-stage-head">
        <span class="scenes-picker-stage-kicker">1 de 4</span>
        <h4 class="scenes-picker-stage-title">Escolha o ambiente</h4>
      </div>
      <ul class="scenes-picker-env-list scenes-picker-grid-list">
        ${environments
          .map((environment) => {
            const isSelected = environment.key === state.selectedEnvKey;
            return `
              <li>
                <button
                  type="button"
                  class="scenes-picker-device-item${isSelected ? " is-selected" : ""}"
                  data-scene-env-key="${escapeHtml(environment.key)}"
                >
                  <span class="scenes-picker-main">
                    <span class="scenes-picker-labels">
                      <span class="scenes-picker-name">${escapeHtml(environment.label)}</span>
                      <span class="scenes-picker-meta">${environment.count} dispositivo${environment.count === 1 ? "" : "s"}</span>
                    </span>
                  </span>
                  <span class="scenes-picker-check" aria-hidden="true">${isSelected ? "●" : ""}</span>
                </button>
              </li>
            `;
          })
          .join("")}
      </ul>
    `;
  }

  function renderDeviceTypePicker() {
    const panel = getEl("scene-step-types-panel");
    if (!panel) return;

    if (!state.selectedEnvKey) {
      panel.innerHTML =
        '<div class="scenes-picker-empty">Escolha um ambiente para ver os tipos de dispositivo.</div>';
      return;
    }

    const types = getDeviceTypeOptions();
    if (!types.length) {
      panel.innerHTML =
        '<div class="scenes-picker-empty">Nenhum tipo de dispositivo disponível neste ambiente.</div>';
      return;
    }

    panel.innerHTML = `
      <div class="scenes-picker-stage-head">
        <span class="scenes-picker-stage-kicker">2 de 4</span>
        <h4 class="scenes-picker-stage-title">Escolha o tipo de dispositivo</h4>
      </div>
      <ul class="scenes-picker-env-list scenes-picker-grid-list">
        ${types
          .map((type) => {
            const isSelected = type.type === normalizeText(state.selectedDeviceType);
            return `
              <li>
                <button
                  type="button"
                  class="scenes-picker-device-item${isSelected ? " is-selected" : ""}"
                  data-scene-device-type="${escapeHtml(type.type)}"
                >
                  <span class="scenes-picker-main">
                    <img class="scenes-picker-icon" src="${escapeHtml(type.icon)}" alt="${escapeHtml(type.label)}" />
                    <span class="scenes-picker-labels">
                      <span class="scenes-picker-name">${escapeHtml(type.label)}</span>
                      <span class="scenes-picker-meta">${type.count} item${type.count === 1 ? "" : "s"}</span>
                    </span>
                  </span>
                  <span class="scenes-picker-check" aria-hidden="true">${isSelected ? "●" : ""}</span>
                </button>
              </li>
            `;
          })
          .join("")}
      </ul>
    `;
  }

  function renderDevicePicker() {
    const panel = getEl("scene-step-devices-panel");
    if (!panel) return;

    if (!state.selectedEnvKey) {
      panel.innerHTML =
        '<div class="scenes-picker-empty">Escolha um ambiente antes do dispositivo.</div>';
      return;
    }

    if (!state.selectedDeviceType) {
      panel.innerHTML =
        '<div class="scenes-picker-empty">Escolha um tipo para ver os dispositivos.</div>';
      return;
    }

    const devices = getFilteredDevices();
    if (!devices.length) {
      panel.innerHTML =
        '<div class="scenes-picker-empty">Nenhum dispositivo encontrado para esta seleção.</div>';
      return;
    }

    const environment = getSelectedEnvironmentOption();
    const type = getSelectedDeviceTypeOption();

    panel.innerHTML = `
      <div class="scenes-picker-stage-head">
        <span class="scenes-picker-stage-kicker">3 de 4</span>
        <h4 class="scenes-picker-stage-title">Escolha o dispositivo</h4>
        <p class="scenes-picker-stage-meta">${escapeHtml(environment?.label || "")} • ${escapeHtml(type?.label || "")}</p>
      </div>
      <ul class="scenes-picker-env-list">
        ${devices
          .map((device) => {
            const isSelected = device.refId === state.selectedDeviceRefId;
            return `
              <li>
                <button
                  type="button"
                  class="scenes-picker-device-item${isSelected ? " is-selected" : ""}"
                  data-scene-device-ref="${escapeHtml(device.refId)}"
                >
                  <span class="scenes-picker-main">
                    <img class="scenes-picker-icon" src="${escapeHtml(device.icon)}" alt="${escapeHtml(device.label)}" />
                    <span class="scenes-picker-labels">
                      <span class="scenes-picker-name">${escapeHtml(device.label)}</span>
                    </span>
                  </span>
                  <span class="scenes-picker-check" aria-hidden="true">${isSelected ? "●" : ""}</span>
                </button>
              </li>
            `;
          })
          .join("")}
      </ul>
    `;
  }

  function renderCommandPicker() {
    const panel = getEl("scene-step-commands-panel");
    if (!panel) return;

    const device = getSelectedDevice();
    if (!device) {
      panel.innerHTML = '<div class="scenes-picker-empty">Selecione um dispositivo para ver os comandos.</div>';
      return;
    }

    const commands = getAvailableCommands(device);

    panel.innerHTML = `
      <div class="scenes-picker-stage-head">
        <span class="scenes-picker-stage-kicker">4 de 4</span>
        <h4 class="scenes-picker-stage-title">Escolha a ação</h4>
      </div>
      <div class="scenes-command-context">
        <img class="scenes-command-context-icon" src="${escapeHtml(device.icon)}" alt="${escapeHtml(device.label)}" />
        <div class="scenes-command-context-text">
          <span class="scenes-command-context-title">${escapeHtml(device.label)}</span>
          <span class="scenes-command-context-meta">${escapeHtml(device.envName || "")}</span>
        </div>
      </div>
      <div class="scenes-command-list">
        ${commands
          .map((command) => {
            const isSelected = normalizeText(state.selectedCommand) === normalizeText(command);
            const label = formatCommandLabel(command);
            return `
              <button
                type="button"
                class="scenes-picker-command-item${isSelected ? " is-selected" : ""}"
                data-scene-command="${escapeHtml(command)}"
              >
                <span class="scenes-picker-labels">
                  <span class="scenes-picker-name">${escapeHtml(label)}</span>
                </span>
                <span class="scenes-picker-check" aria-hidden="true">${isSelected ? "●" : ""}</span>
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderAddStepButtonState() {
    const addButton = getEl("scene-step-add-btn");
    if (!addButton) return;
    addButton.disabled = !getSelectedDevice() || !getResolvedSelectedCommand();
  }

  function syncValueControlVisibility() {
    const wrap = getEl("scene-step-value-wrap");
    const label = getEl("scene-step-value-label");
    const valueInput = getEl("scene-step-value");
    const rangeInput = getEl("scene-step-value-range");
    const help = getEl("scene-step-value-help");
    if (!wrap || !valueInput || !rangeInput) return;

    const config = selectedValueConfig();
    const visible = config.visible === true;
    wrap.hidden = !visible;

    if (!visible) {
      valueInput.value = "";
      rangeInput.value = "";
      rangeInput.hidden = true;
      if (help) help.textContent = "";
      return;
    }

    if (label) label.textContent = config.label || "Valor";
    valueInput.placeholder = config.placeholder || "";
    valueInput.type = config.kind === "range" ? "number" : "text";

    if (config.kind === "range") {
      const min = Number(config.min ?? 0);
      const max = Number(config.max ?? 100);
      const step = Number(config.step ?? 1);
      valueInput.min = String(min);
      valueInput.max = String(max);
      valueInput.step = String(step);
      rangeInput.min = String(min);
      rangeInput.max = String(max);
      rangeInput.step = String(step);
      rangeInput.hidden = false;

      if (!String(valueInput.value || "").trim()) {
        valueInput.value = String(config.defaultValue ?? min);
      }
      rangeInput.value = valueInput.value;
    } else {
      valueInput.removeAttribute("min");
      valueInput.removeAttribute("max");
      valueInput.removeAttribute("step");
      rangeInput.hidden = true;
    }

    if (help) {
      const suffix = config.suffix ? ` Atual: ${valueInput.value}${config.suffix}.` : "";
      help.textContent = `${config.help || ""}${suffix}`.trim();
    }
  }

  function syncCustomCommandVisibility() {
    const wrap = getEl("scene-step-custom-command-wrap");
    const customInput = getEl("scene-step-custom-command");
    if (!wrap || !customInput) return;

    const isCustom = state.selectedCommand === CUSTOM_COMMAND_TOKEN;
    wrap.hidden = !isCustom;
    if (!isCustom) {
      customInput.value = "";
    }
    renderAddStepButtonState();
  }

  function renderStepComposer() {
    renderEnvironmentPicker();
    renderDeviceTypePicker();
    renderDevicePicker();
    renderCommandPicker();
    renderStepTabState();
    renderSelectedStepSummary();
    syncCustomCommandVisibility();
    syncValueControlVisibility();
    renderAddStepButtonState();
  }

  function setStepPickerTab(tab) {
    const nextTab = String(tab || "").trim();
    if (nextTab === "type" && !state.selectedEnvKey) return;
    if (
      nextTab === "devices" &&
      (!state.selectedEnvKey || !state.selectedDeviceType)
    ) {
      return;
    }
    if (nextTab === "commands" && !getSelectedDevice()) return;
    state.stepPickerTab = ["environment", "type", "devices", "commands"].includes(nextTab)
      ? nextTab
      : "environment";
    renderStepComposer();
  }

  function selectStepEnvironment(envKey) {
    const nextEnvKey = String(envKey || "").trim();
    if (!nextEnvKey) return;
    state.selectedEnvKey = nextEnvKey;
    state.selectedDeviceType = "";
    state.selectedDeviceRefId = "";
    state.selectedCommand = "";
    clearStepBuilderFields();
    state.stepPickerTab = "type";
    renderStepComposer();
  }

  function selectStepDeviceType(type) {
    const nextType = normalizeText(type);
    if (!nextType) return;
    state.selectedDeviceType = nextType;
    state.selectedDeviceRefId = "";
    state.selectedCommand = "";
    clearStepBuilderFields();
    state.stepPickerTab = "devices";
    renderStepComposer();
  }

  function selectStepDevice(refId) {
    const nextRefId = String(refId || "").trim();
    if (!nextRefId || !state.deviceMap.has(nextRefId)) return;
    const device = state.deviceMap.get(nextRefId);
    state.selectedEnvKey = device?.envKey || state.selectedEnvKey;
    state.selectedDeviceType = normalizeText(device?.type || state.selectedDeviceType);
    state.selectedDeviceRefId = nextRefId;
    state.selectedCommand = "";
    const customInput = getEl("scene-step-custom-command");
    if (customInput) customInput.value = "";
    state.stepPickerTab = "commands";
    renderStepComposer();
    const commandsPanel = getEl("scene-step-commands-panel");
    if (commandsPanel && typeof commandsPanel.scrollIntoView === "function") {
      commandsPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function selectStepCommand(command) {
    const nextCommand = String(command || "").trim();
    if (!nextCommand) return;
    state.selectedCommand = nextCommand;
    state.stepPickerTab = "";
    renderStepComposer();
  }

  function resetStepComposerSelection() {
    state.selectedEnvKey = "";
    state.selectedDeviceType = "";
    state.selectedDeviceRefId = "";
    state.selectedCommand = "";
    state.stepPickerTab = "environment";
    clearStepBuilderFields();
    renderStepComposer();
  }

  function renderDraftSteps() {
    const list = getEl("scene-steps-preview");
    if (!list) return;

    if (!state.draftSteps.length) {
      list.innerHTML =
        '<li class="scene-step-empty">Adicione a primeira ação do cenário.</li>';
      return;
    }

    const groupedSteps = [];
    const groupMap = new Map();

    state.draftSteps.forEach((step, index) => {
      const envName = stepLocationText(step) || "Sem ambiente";
      if (!groupMap.has(envName)) {
        const group = { envName, entries: [] };
        groupMap.set(envName, group);
        groupedSteps.push(group);
      }
      groupMap.get(envName).entries.push({ step, index });
    });

    const renderStepItem = (step, index) => {
        const title = formatStepActionTitle(step);
        const meta = formatStepMetaText(step);
        const isFirst = index === 0;
        const isLast = index === state.draftSteps.length - 1;

        return `
          <li class="scene-step-item" data-step-id="${escapeHtml(step.id)}">
            <span class="scene-step-index" aria-hidden="true">${index + 1}</span>
            <div class="scene-step-main">
              <p class="scene-step-title">${escapeHtml(title)}</p>
              ${meta ? `<p class="scene-step-meta">${escapeHtml(meta)}</p>` : ""}
            </div>
            <div class="scene-step-actions">
              <button type="button" class="scene-step-action-btn" data-step-action="test" aria-label="Testar ação" title="Testar">▶</button>
              <button type="button" class="scene-step-action-btn" data-step-action="duplicate" aria-label="Duplicar ação" title="Duplicar">⧉</button>
              <button type="button" class="scene-step-action-btn" data-step-action="move-up" aria-label="Mover para cima" title="Mover para cima" ${isFirst ? "disabled" : ""}>↑</button>
              <button type="button" class="scene-step-action-btn" data-step-action="move-down" aria-label="Mover para baixo" title="Mover para baixo" ${isLast ? "disabled" : ""}>↓</button>
              <button type="button" class="scene-step-action-btn" data-step-action="remove" aria-label="Remover">×</button>
            </div>
          </li>`;
      };

    list.innerHTML = groupedSteps
      .map((group) => {
        const firstIndex = group.entries[0]?.index ?? 0;
        const lastIndex = group.entries[group.entries.length - 1]?.index ?? firstIndex;
        return `
          <li class="scene-step-env-group">
            <div class="scene-step-env-heading">
              <span class="scene-step-env-name">${escapeHtml(group.envName)}</span>
              <span class="scene-step-env-count">Etapas ${firstIndex + 1}-${lastIndex + 1}</span>
            </div>
            <ol class="scene-step-env-list">
              ${group.entries
                .map(({ step, index }) => renderStepItem(step, index))
                .join("")}
            </ol>
          </li>
        `;
      })
      .join("");
  }

  function clearStepBuilderFields() {
    const valueInput = getEl("scene-step-value");
    const rangeInput = getEl("scene-step-value-range");
    const customInput = getEl("scene-step-custom-command");

    if (valueInput) valueInput.value = "";
    if (rangeInput) rangeInput.value = "";
    if (customInput) customInput.value = "";
  }

  function addStepFromForm() {
    const device = getSelectedDevice();
    const valueInput = getEl("scene-step-value");

    if (!device) {
      return;
    }

    const command = getResolvedSelectedCommand();

    if (!command) {
      return;
    }

    const value = String(valueInput?.value || "").trim();

    state.draftSteps.push({
      id: makeId("step"),
      refId: device.refId,
      deviceId: device.deviceId,
      deviceType: device.type,
      deviceName: `${device.typeLabel} - ${device.label}`,
      envName: device.envName,
      command,
      value,
      delayMs: 0,
    });

    resetStepComposerSelection();
    renderDraftSteps();
    clearBuilderStepsValidation();
    clearFeedback();
  }

  function removeStep(stepId) {
    state.draftSteps = state.draftSteps.filter((step) => step.id !== stepId);
    renderDraftSteps();
    if (state.draftSteps.length > 0) {
      clearBuilderStepsValidation();
    }
  }

  function moveStep(stepId, direction) {
    const index = state.draftSteps.findIndex((step) => step.id === stepId);
    if (index < 0) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= state.draftSteps.length) return;
    const copy = state.draftSteps.slice();
    const [item] = copy.splice(index, 1);
    copy.splice(nextIndex, 0, item);
    state.draftSteps = copy;
    renderDraftSteps();
    clearBuilderStepsValidation();
  }

  function duplicateStep(stepId) {
    const index = state.draftSteps.findIndex((step) => step.id === stepId);
    if (index < 0) return;
    const clone = {
      ...state.draftSteps[index],
      id: makeId("step"),
    };
    state.draftSteps.splice(index + 1, 0, clone);
    renderDraftSteps();
    clearBuilderStepsValidation();
  }

  async function testDraftStep(stepId, triggerButton) {
    const step = state.draftSteps.find((item) => item.id === stepId);
    if (!step) return;

    if (typeof sendHubitatCommand !== "function") {
      setFeedback("sendHubitatCommand indisponível.", true);
      return;
    }

    if (!canUseSceneStep(step, "control")) {
      setFeedback("Sem permissão para testar esta ação.", true);
      return;
    }

    const originalLabel = triggerButton?.textContent || "";
    if (triggerButton) {
      triggerButton.disabled = true;
      triggerButton.textContent = "...";
    }

    const title = formatStepActionTitle(step);
    setFeedback(`Testando ação: ${title}`, false);

    try {
      await executeSceneStep(step);
      applyLocalState(step);
      if (typeof syncAllVisibleControls === "function") {
        syncAllVisibleControls(true);
      }
      setFeedback(`Ação testada: ${title}`, false);
    } catch (error) {
      setFeedback(`Falha ao testar ação: ${error?.message || error}`, true);
    } finally {
      if (triggerButton) {
        triggerButton.disabled = false;
        triggerButton.textContent = originalLabel || "▶";
      }
    }
  }

  function resetBuilder() {
    const nameInput = getEl("scene-name-input");
    const descriptionInput = getEl("scene-description-input");
    const cancelBtn = getEl("scene-cancel-edit-btn");

    if (nameInput) nameInput.value = "";
    if (descriptionInput) descriptionInput.value = "";
    if (cancelBtn) cancelBtn.hidden = true;

    state.editingSceneId = null;
    state.draftSteps = [];

    clearBuilderValidation();
    resetStepComposerSelection();
    renderDraftSteps();
    clearFeedback();
  }

  async function saveSceneFromForm() {
    const nameInput = getEl("scene-name-input");
    const descriptionInput = getEl("scene-description-input");
    const cancelBtn = getEl("scene-cancel-edit-btn");
    const saveButton = getEl("scene-save-btn");

    const name = String(nameInput?.value || "").trim();
    const description = String(descriptionInput?.value || "").trim();

    clearBuilderValidation();

    if (!name) {
      markBuilderNameInvalid();
      return;
    }

    if (!state.draftSteps.length) {
      markBuilderStepsInvalid();
      return;
    }

    const steps = state.draftSteps.map((step) => ({ ...step }));
    const confirmed = await requestSceneSaveReview({
      name,
      description,
      steps,
    });

    if (!confirmed) {
      return;
    }

    const now = Date.now();
    let successMessage = "";
    const originalLabel = saveButton?.textContent || "Salvar";

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = "Salvando...";
    }

    try {
      if (state.editingSceneId) {
        const index = state.scenes.findIndex((scene) => scene.id === state.editingSceneId);
        if (index < 0) {
          throw new Error("Cenário em edição não encontrado.");
        }

        const current = state.scenes[index];
        const savedScene = await updateSceneRecord(state.editingSceneId, {
          ...current,
          name,
          description,
          steps,
          createdAt: current.createdAt,
          updatedAt: now,
        });

        state.scenes[index] = savedScene;
        successMessage = "Cenário atualizado.";
      } else {
        const savedScene = await createSceneRecord({
          name,
          description,
          steps,
          createdAt: now,
          updatedAt: now,
        });
        state.scenes.unshift(savedScene);
        successMessage = "Cenário criado com sucesso.";
      }
    } catch (error) {
      console.error("Falha ao salvar cenário", error);
      setFeedback(
        `Falha ao salvar cenário: ${error?.message || error}`,
        true,
      );
      return;
    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = originalLabel;
      }
    }

    state.scenes = sortScenesByRecent(state.scenes);
    if (state.storageMode === "local") {
      writeScenesToStorage(state.scenes);
    }
    renderScenesList();

    const isBuilderPage = Boolean(document.querySelector(".scenes-builder-page"));
    if (isBuilderPage) {
      persistEditingSceneId("");
      persistFeedbackMessage(successMessage || "Cenário salvo.", false);
      navigateTo("scenes");
      return;
    }

    if (cancelBtn) cancelBtn.hidden = true;
    resetBuilder();
    if (successMessage) {
      setFeedback(successMessage, false);
    }
  }

  function fillBuilderFromScene(scene) {
    const nameInput = getEl("scene-name-input");
    const descriptionInput = getEl("scene-description-input");
    const cancelBtn = getEl("scene-cancel-edit-btn");

    if (nameInput) nameInput.value = scene.name || "";
    if (descriptionInput) descriptionInput.value = scene.description || "";

    state.editingSceneId = scene.id;
    state.draftSteps = toArray(scene.steps).map((step) => ({ ...step, id: step.id || makeId("step") }));

    if (cancelBtn) cancelBtn.hidden = false;
    resetStepComposerSelection();
    renderDraftSteps();
    clearFeedback();

    const card = document.querySelector(".scenes-builder-card");
    if (card && typeof card.scrollIntoView === "function") {
      card.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function resolveSceneDevice(step) {
    const refId = String(step?.refId || "").trim();
    if (refId && state.deviceMap.has(refId)) {
      return state.deviceMap.get(refId) || null;
    }

    const deviceId = String(step?.deviceId || "").trim();
    const deviceType = normalizeText(step?.deviceType);
    if (!deviceId) return null;

    return (
      state.devices.find((device) => {
        if (String(device.deviceId || "").trim() !== deviceId) return false;
        if (!deviceType) return true;
        return normalizeText(device.type) === deviceType;
      }) || null
    );
  }

  function resolveAcExecutionCommand(step, rawCommand) {
    const device = resolveSceneDevice(step);
    const envKey = String(device?.envKey || "").trim();
    if (!envKey || typeof getEnvironment !== "function") {
      return rawCommand;
    }

    const env = getEnvironment(envKey);
    const acConfig = env?.airConditioner || {};
    const brandProfiles = getAcBrandProfiles();
    const brandKey = normalizeText(acConfig?.brand || "default");
    const brand = brandProfiles?.[brandKey] || brandProfiles?.default || {};
    const brandCommands = brand?.commands || {};
    const normalized = normalizeText(rawCommand);

    if (normalized === "on" && brandCommands.powerOn) {
      return String(brandCommands.powerOn);
    }

    if (normalized === "off" && brandCommands.powerOff) {
      return String(brandCommands.powerOff);
    }

    return rawCommand;
  }

  function resolveSceneExecutionCommand(step) {
    const rawCommand = String(step?.command || "").trim();
    if (!rawCommand) return "";

    const device = resolveSceneDevice(step);
    const deviceType = normalizeText(step?.deviceType || device?.type);
    const normalized = normalizeText(rawCommand);

    if (deviceType === "tv") {
      if (normalized === "on") return "powerOn";
      if (normalized === "off") return "powerOff";
    }

    if (deviceType === "comfort") {
      return resolveAcExecutionCommand(step, rawCommand);
    }

    return rawCommand;
  }

  function resolveSceneExecutionTargetId(step, command) {
    const device = resolveSceneDevice(step);
    const deviceType = normalizeText(step?.deviceType || device?.type);
    const normalizedCommand = normalizeText(command || step?.command);
    const fallbackId = String(step?.deviceId || "").trim();

    if (deviceType === "music") {
      if (MUSIC_TRANSPORT_COMMANDS.has(normalizedCommand)) {
        return String(
          device?.transportId || device?.metadataId || fallbackId,
        ).trim();
      }

      if (MUSIC_VOLUME_COMMANDS.has(normalizedCommand)) {
        return String(
          device?.volumeId || device?.powerId || fallbackId,
        ).trim();
      }

      if (MUSIC_POWER_COMMANDS.has(normalizedCommand)) {
        return String(
          device?.powerId || device?.volumeId || fallbackId,
        ).trim();
      }
    }

    return fallbackId;
  }

  function isScenePowerOnCommand(normalizedCommand) {
    return normalizedCommand === "on" || normalizedCommand === "poweron";
  }

  async function runSceneHomeTheaterPowerMacro(device, deviceType, envKey, normalizedCommand) {
    if (envKey !== "ambiente1") return;
    if (!isScenePowerOnCommand(normalizedCommand)) return;
    if (!HOME_THEATER_MEDIA_TYPES.has(deviceType)) return;

    const receiverId = String(
      device?.receiverId ||
        (typeof getEnvironmentControlId === "function"
          ? getEnvironmentControlId(envKey, "receiver")
          : ""),
    ).trim();
    const displayId = String(
      device?.displayId ||
        (typeof getEnvironmentDeviceBinding === "function"
          ? getEnvironmentDeviceBinding(envKey, "tv", "display")
          : ""),
    ).trim();

    const inputByType = {
      clarotv: "DVD",
      appletv: "GAME",
      bluray: "BD",
      tv: "TV",
    };
    const input = inputByType[deviceType];

    if (receiverId) {
      await Promise.allSettled([sendHubitatCommand(receiverId, "on")]);
    }

    if (!input || !receiverId) return;

    await new Promise((resolve) => {
      setTimeout(resolve, 350);
    });

    const routeCommands = [sendHubitatCommand(receiverId, "setInputSource", input)];
    if (deviceType !== "tv" && displayId) {
      routeCommands.push(sendHubitatCommand(displayId, "hdmi3"));
    }

    await Promise.allSettled(routeCommands);
  }

  async function runSceneVarandaPowerMacro(deviceType, envKey, normalizedCommand) {
    if (envKey !== "ambiente3") return;
    if (!isScenePowerOnCommand(normalizedCommand)) return;
    if (deviceType !== "tv" && deviceType !== "roku") return;

    const varandaTvId = String(
      (typeof getEnvironmentDeviceBinding === "function"
        ? getEnvironmentDeviceBinding(envKey, "tv", "power")
        : "") ||
        (typeof getEnvironmentDeviceBinding === "function"
          ? getEnvironmentDeviceBinding(envKey, "tv", "id")
          : ""),
    ).trim();

    const varandaDenonId = String(
      (typeof getEnvironmentDeviceBinding === "function"
        ? getEnvironmentDeviceBinding(envKey, "music", "power")
        : "") ||
        (typeof getEnvironmentControlId === "function"
          ? getEnvironmentControlId(envKey, "screenReceiver")
          : ""),
    ).trim();

    const commands = [];

    if (varandaTvId) {
      commands.push(sendHubitatCommand(varandaTvId, "on"));
    }

    if (deviceType === "roku") {
      if (varandaDenonId) {
        commands.push(sendHubitatCommand(varandaDenonId, "mediaplayer"));
      }
      if (varandaTvId) {
        commands.push(sendHubitatCommand(varandaTvId, "hdmi3"));
      }
    }

    if (deviceType === "tv" && varandaDenonId) {
      commands.push(sendHubitatCommand(varandaDenonId, "tvAudio"));
    }

    if (commands.length > 0) {
      await Promise.allSettled(commands);
    }
  }

  async function runScenePowerOnMacros(device, deviceType, envKey, normalizedCommand) {
    await runSceneHomeTheaterPowerMacro(device, deviceType, envKey, normalizedCommand);
    await runSceneVarandaPowerMacro(deviceType, envKey, normalizedCommand);
  }

  async function executeSceneStep(step) {
    const device = resolveSceneDevice(step);
    const deviceType = normalizeText(step?.deviceType || device?.type);
    const envKey = String(device?.envKey || "").trim();
    const command = resolveSceneExecutionCommand(step);
    const normalizedCommand = normalizeText(command);
    const value = String(step?.value || "").trim();
    const targetId = resolveSceneExecutionTargetId(step, command);

    if (!command) {
      throw new Error("Comando do cenário não resolvido.");
    }

    if (!targetId) {
      throw new Error("ID de destino do cenário não resolvido.");
    }

    if (deviceType === "tv" && normalizedCommand === "mute") {
      return sendHubitatCommand(targetId, "setVolume", "0");
    }

    await runScenePowerOnMacros(device, deviceType, envKey, normalizedCommand);

    return sendHubitatCommand(
      targetId,
      command,
      value ? value : undefined,
    );
  }

  function stateFromCommand(step) {
    const command = normalizeText(resolveSceneExecutionCommand(step));
    if (!command) return null;

    if (command === "on" || command === "poweron") return "on";
    if (command === "off" || command === "poweroff") return "off";
    if (command === "open") return "open";
    if (command === "close") return "closed";

    if (command === "setlevel") {
      const valueNum = Number(step?.value);
      if (!Number.isFinite(valueNum)) return "on";
      return valueNum > 0 ? "on" : "off";
    }

    return null;
  }

  function applyLocalState(step) {
    if (typeof setStoredState !== "function") return;
    const derivedState = stateFromCommand(step);
    if (!derivedState) return;
    const command = resolveSceneExecutionCommand(step);
    const targetId = resolveSceneExecutionTargetId(step, command);
    if (targetId) {
      setStoredState(targetId, derivedState);
    }
    if (targetId !== step.deviceId) {
      setStoredState(step.deviceId, derivedState);
    }
  }

  async function executeScene(sceneId, triggerButton) {
    const scene = state.scenes.find((item) => item.id === sceneId);
    if (!scene) {
      setFeedback("Cenário não encontrado.", true);
      return;
    }

    if (typeof sendHubitatCommand !== "function") {
      setFeedback("sendHubitatCommand indisponível.", true);
      return;
    }

    if (!toArray(scene.steps).every((step) => canUseSceneStep(step, "control"))) {
      setFeedback("Este cenário possui dispositivos fora da sua permissão.", true);
      return;
    }

    const originalLabel = triggerButton ? triggerButton.textContent : "";

    if (triggerButton) {
      triggerButton.disabled = true;
      triggerButton.textContent = "Executando...";
    }

    setFeedback(`Executando cenário: ${scene.name}`, false);

    try {
      for (let index = 0; index < scene.steps.length; index += 1) {
        const step = scene.steps[index];
        await executeSceneStep(step);

        applyLocalState(step);
      }

      if (typeof syncAllVisibleControls === "function") {
        syncAllVisibleControls(true);
      }

      setFeedback(`Cenário executado com sucesso: ${scene.name}`, false);
    } catch (error) {
      console.error("Erro ao executar cenário", scene.name, error);
      setFeedback(`Falha ao executar ${scene.name}: ${error?.message || error}`, true);
    } finally {
      if (triggerButton) {
        triggerButton.disabled = false;
        triggerButton.textContent = originalLabel || "Executar";
      }
    }
  }

  function getSceneEnvironmentLabels(steps) {
    const labels = [];
    const seen = new Set();

    toArray(steps).forEach((step) => {
      const device = resolveSceneDevice(step);
      const label = stepLocationText(step) || String(device?.envName || "").trim();
      const key = normalizeText(label);
      if (!label || seen.has(key)) return;
      seen.add(key);
      labels.push(label);
    });

    return labels;
  }

  function getSceneDominantType(steps) {
    const counts = new Map();
    toArray(steps).forEach((step) => {
      const device = resolveSceneDevice(step);
      const type = normalizeText(step?.deviceType || device?.type);
      if (!type) return;
      counts.set(type, (counts.get(type) || 0) + 1);
    });

    let dominantType = "";
    let dominantCount = 0;
    counts.forEach((count, type) => {
      if (count > dominantCount) {
        dominantType = type;
        dominantCount = count;
      }
    });

    return dominantType;
  }

  function renderSceneEnvironmentChips(steps) {
    const labels = getSceneEnvironmentLabels(steps);
    if (!labels.length) return "";

    const visibleLabels = labels.slice(0, 3);
    const remaining = Math.max(0, labels.length - visibleLabels.length);

    return `
      <div class="scene-user-envs" aria-label="Ambientes usados">
        ${visibleLabels
          .map((label) => `<span class="scene-user-env-chip">${escapeHtml(label)}</span>`)
          .join("")}
        ${
          remaining
            ? `<span class="scene-user-env-chip scene-user-env-chip--more">+ ${remaining}</span>`
            : ""
        }
      </div>
    `;
  }

  function renderScenesList() {
    const list = getEl("scenes-user-list");
    if (!list) return;

    if (!state.scenes.length) {
      list.innerHTML =
        '<div class="scene-user-empty">Não há cenários cadastrados no momento.</div>';
      return;
    }

    list.innerHTML = state.scenes
      .map((scene) => {
        const steps = toArray(scene.steps);
        const preview = steps.slice(0, 3);
        const remaining = Math.max(0, steps.length - preview.length);
        const environments = getSceneEnvironmentLabels(steps);
        const dominantType = getSceneDominantType(steps);
        const icon = dominantType
          ? resolveDeviceIcon(dominantType)
          : "images/icons/icon-scenes.svg";
        const envCount = environments.length;
        const envSummary = envCount
          ? `${envCount} ambiente${envCount === 1 ? "" : "s"}`
          : "Sem ambiente";
        const previewHtml = preview.length
          ? `
            <ol class="scene-user-preview">
              ${preview
                .map((step) => `<li>${escapeHtml(formatStepActionTitle(step))}</li>`)
                .join("")}
              ${
                remaining
                  ? `<li class="scene-user-preview-more">+ ${remaining} ação${remaining > 1 ? "es" : ""}</li>`
                  : ""
              }
            </ol>
          `
          : "";

        return `
          <article class="scene-user-card" data-scene-id="${escapeHtml(scene.id)}">
            <div class="scene-user-head">
              <div class="scene-user-title-row">
                <span class="scene-user-icon-wrap" aria-hidden="true">
                  <img class="scene-user-icon" src="${escapeHtml(icon)}" alt="">
                </span>
                <div class="scene-user-title-main">
                  <h3 class="scene-user-name">${escapeHtml(scene.name)}</h3>
                  <div class="scene-user-metrics">
                    <span>${steps.length} ação${steps.length === 1 ? "" : "es"}</span>
                    <span>${escapeHtml(envSummary)}</span>
                  </div>
                </div>
              </div>
              <details class="scene-user-menu">
                <summary class="scene-user-menu-trigger" aria-label="Opções do cenário">...</summary>
                <div class="scene-user-menu-panel">
                  <button type="button" class="scene-user-menu-item" data-scene-action="edit" data-scene-id="${escapeHtml(scene.id)}">Editar</button>
                  <button type="button" class="scene-user-menu-item scene-user-menu-item--danger" data-scene-action="delete" data-scene-id="${escapeHtml(scene.id)}">Excluir</button>
                </div>
              </details>
            </div>
            ${
              scene.description
                ? `<p class="scene-user-desc">${escapeHtml(scene.description)}</p>`
                : ""
            }
            ${renderSceneEnvironmentChips(steps)}
            ${previewHtml}
            <div class="scene-user-actions">
              <button type="button" class="scenes-btn scenes-btn--primary scene-user-run-btn" data-scene-action="run" data-scene-id="${escapeHtml(scene.id)}">Executar</button>
            </div>
          </article>`;
      })
      .join("");
  }

  function handleStepListClick(event) {
    const button = event.target.closest("[data-step-action]");
    if (!button) return;

    const action = String(button.dataset.stepAction || "").trim();
    const item = button.closest("[data-step-id]");
    const stepId = String(item?.dataset?.stepId || "").trim();
    if (!stepId) return;

    if (action === "remove") {
      removeStep(stepId);
      return;
    }

    if (action === "move-up") {
      moveStep(stepId, -1);
      return;
    }

    if (action === "move-down") {
      moveStep(stepId, 1);
      return;
    }

    if (action === "duplicate") {
      duplicateStep(stepId);
      return;
    }

    if (action === "test") {
      testDraftStep(stepId, button).catch((error) => {
        setFeedback(`Falha ao testar ação: ${error?.message || error}`, true);
      });
    }
  }

  async function handleSceneListClick(event) {
    const button = event.target.closest("[data-scene-action]");
    if (!button) return;

    const action = String(button.dataset.sceneAction || "").trim();
    const sceneId = String(button.dataset.sceneId || "").trim();
    if (!sceneId) return;

    const scene = state.scenes.find((item) => item.id === sceneId);
    if (!scene) {
      setFeedback("Cenário não encontrado.", true);
      return;
    }

    if (action === "run") {
      const confirmed = await requestSceneConfirmation(
        `Executar o cenário "${scene.name}"?`,
        { confirmLabel: "Executar" },
      );
      if (!confirmed) return;
      executeScene(sceneId, button).catch((error) => {
        setFeedback(`Falha ao executar: ${error?.message || error}`, true);
      });
      return;
    }

    if (action === "edit") {
      persistEditingSceneId(scene.id);
      navigateTo("scenes-criar");
      return;
    }

    if (action === "delete") {
      const confirmed = await requestSceneConfirmation(
        `Esta ação remove o cenário "${scene.name}" e não pode ser desfeita.`,
        { title: "Excluir cenário", confirmLabel: "Excluir", destructive: true },
      );
      if (!confirmed) return;
      try {
        await deleteSceneRecord(scene.id);
      } catch (error) {
        console.error("Falha ao excluir cenário", error);
        setFeedback(
          `Falha ao excluir cenário: ${error?.message || error}`,
          true,
        );
        return;
      }

      state.scenes = state.scenes.filter((item) => item.id !== scene.id);
      if (state.storageMode === "local") {
        writeScenesToStorage(state.scenes);
      }
      renderScenesList();
      if (state.editingSceneId === scene.id) {
        resetBuilder();
      }
      setFeedback("Cenário excluído.", false);
    }
  }

  function bindBuilderEvents() {
    const addStepButton = getEl("scene-step-add-btn");
    const saveButton = getEl("scene-save-btn");
    const cancelButton = getEl("scene-cancel-edit-btn");
    const backButton = getEl("scene-back-btn");
    const stepsList = getEl("scene-steps-preview");
    const environmentPanel = getEl("scene-step-environments-panel");
    const typesPanel = getEl("scene-step-types-panel");
    const devicePanel = getEl("scene-step-devices-panel");
    const commandsPanel = getEl("scene-step-commands-panel");
    const selectionSummary = getEl("scene-step-selection");
    const customInput = getEl("scene-step-custom-command");
    const valueInput = getEl("scene-step-value");
    const rangeInput = getEl("scene-step-value-range");
    const nameInput = getEl("scene-name-input");

    document.querySelectorAll(".scenes-step-tab[data-scene-step-tab]").forEach((button) => {
      button.onclick = function () {
        setStepPickerTab(button.dataset.sceneStepTab);
      };
    });

    if (environmentPanel) {
      environmentPanel.onclick = function (event) {
        const button = event.target.closest("[data-scene-env-key]");
        if (!button) return;
        selectStepEnvironment(button.dataset.sceneEnvKey);
      };
    }

    if (typesPanel) {
      typesPanel.onclick = function (event) {
        const button = event.target.closest("[data-scene-device-type]");
        if (!button) return;
        selectStepDeviceType(button.dataset.sceneDeviceType);
      };
    }

    if (devicePanel) {
      devicePanel.onclick = function (event) {
        const button = event.target.closest("[data-scene-device-ref]");
        if (!button) return;
        selectStepDevice(button.dataset.sceneDeviceRef);
      };
    }

    if (commandsPanel) {
      commandsPanel.onclick = function (event) {
        const button = event.target.closest("[data-scene-command]");
        if (!button) return;
        selectStepCommand(button.dataset.sceneCommand);
      };
    }

    if (selectionSummary) {
      selectionSummary.onclick = function (event) {
        const button = event.target.closest("[data-scene-step-tab]");
        if (!button) return;
        setStepPickerTab(button.dataset.sceneStepTab);
      };
    }

    if (customInput) {
      customInput.oninput = function () {
        renderAddStepButtonState();
      };
    }

    if (valueInput) {
      valueInput.oninput = function () {
        if (rangeInput && !rangeInput.hidden) {
          rangeInput.value = valueInput.value || rangeInput.min || "0";
        }
        syncValueControlVisibility();
      };
    }

    if (rangeInput) {
      rangeInput.oninput = function () {
        if (valueInput) {
          valueInput.value = rangeInput.value;
        }
        syncValueControlVisibility();
      };
    }

    if (nameInput) {
      nameInput.oninput = function () {
        clearBuilderNameValidation();
      };
    }

    if (addStepButton) {
      addStepButton.onclick = function () {
        addStepFromForm();
      };
    }

    if (saveButton) {
      saveButton.onclick = function () {
        saveSceneFromForm().catch((error) => {
          console.error("Erro inesperado ao salvar cenário", error);
          setFeedback(
            `Falha ao salvar cenário: ${error?.message || error}`,
            true,
          );
        });
      };
    }

    if (cancelButton) {
      cancelButton.onclick = function () {
        resetBuilder();
      };
    }

    if (backButton) {
      backButton.onclick = function () {
        persistEditingSceneId("");
        navigateTo("scenes");
      };
    }

    if (stepsList) {
      stepsList.onclick = handleStepListClick;
    }
  }

  function bindListEvents() {
    const newButton = getEl("scene-new-btn");
    const scenesList = getEl("scenes-user-list");

    if (newButton) {
      newButton.onclick = function () {
        persistEditingSceneId("");
        navigateTo("scenes-criar");
      };
    }

    if (scenesList) {
      scenesList.onclick = handleSceneListClick;
    }
  }

  function buildDeviceMap() {
    state.deviceMap = new Map();
    state.devices.forEach((device) => {
      state.deviceMap.set(device.refId, device);
    });
  }

  async function initScenesPage() {
    const listPage = document.querySelector('.scenes-page[data-page="scenes"]');
    const builderPage = document.querySelector(".scenes-builder-page");
    if (!listPage && !builderPage) return;

    state.devices = buildDeviceCatalog();
    buildDeviceMap();

    setFeedback("Carregando cenários...", false);

    state.scenes = await loadScenesCollection();
    purgeLegacyDemoScenes();

    if (listPage) {
      bindListEvents();
      renderScenesList();
      const pendingFeedback = consumeFeedbackMessage();
      if (pendingFeedback) {
        setFeedback(pendingFeedback.message, pendingFeedback.isError);
      } else if (!state.devices.length) {
        setFeedback(
          "Nenhum dispositivo encontrado no config. Verifique os ambientes visíveis.",
          true
        );
      } else {
        clearFeedback();
      }
      return;
    }

    if (builderPage) {
      bindBuilderEvents();
      resetBuilder();

      const editingSceneId = consumeEditingSceneId();
      if (editingSceneId) {
        const sceneToEdit = state.scenes.find((scene) => scene.id === editingSceneId);
        if (sceneToEdit) {
          fillBuilderFromScene(sceneToEdit);
        }
      }

      if (!state.devices.length) {
        setFeedback(
          "Nenhum dispositivo encontrado no config. Verifique os ambientes visíveis.",
          true
        );
      }
    }
  }

  global.initScenesPage = function () {
    return initScenesPage().catch((error) => {
      console.error("Erro ao inicializar cenários", error);
      setFeedback(
        `Falha ao carregar cenários: ${error?.message || error}`,
        true,
      );
    });
  };

  // Compatibilidade com template legado.
  global.handleCenarioDormir = function () {
    const firstScene = state.scenes[0];
    if (!firstScene) {
      setFeedback("Crie um cenário antes de executar.", true);
      return;
    }
    executeScene(firstScene.id).catch((error) => {
      setFeedback(`Falha ao executar: ${error?.message || error}`, true);
    });
  };
})(window);
