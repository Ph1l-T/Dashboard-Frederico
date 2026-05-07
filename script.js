// ========================================
// DEBUG UTILITIES
// ========================================

console.log("📜 SCRIPT.JS CARREGANDO...");

function isDebugEnabled() {
  if (typeof window === "undefined") return false;
  return Boolean(window.__DASHBOARD_DEBUG__);
}

function debugLog(messageOrFactory, ...args) {
  if (!isDebugEnabled()) return;

  if (typeof messageOrFactory === "function") {
    try {
      const result = messageOrFactory();

      if (Array.isArray(result)) {
        console.log(...result);
      } else {
        console.log(result);
      }
    } catch (error) {
      console.error("Debug log failure:", error);
    }

    return;
  }

  console.log(messageOrFactory, ...args);
}

// ========================================
// ICON OVERRIDES (via config.js)
// ========================================

// ========================================
// UI TOKENS (icons/labels via config.js)
// ========================================

function getUiItemFromConfig(key) {
  if (!key) return null;

  try {
    if (
      typeof window !== "undefined" &&
      typeof window.getUiItem === "function"
    ) {
      return window.getUiItem(key) || null;
    }
  } catch (e) {
    // ignore
  }

  try {
    if (typeof window !== "undefined" && window.CLIENT_CONFIG?.ui?.items) {
      return window.CLIENT_CONFIG.ui.items[key] || null;
    }
  } catch (e) {
    // ignore
  }

  return null;
}

function applyUiTokens(root = document) {
  try {
    const nodes = root.querySelectorAll?.("[data-ui-item]") || [];
    nodes.forEach((el) => {
      const key = el.getAttribute("data-ui-item");
      const item = getUiItemFromConfig(key);
      if (!item) return;

      const label = typeof item.label === "string" ? item.label : null;
      const icon = typeof item.icon === "string" ? item.icon : null;

      // Atualizar ícone
      if (icon) {
        const img =
          el.querySelector?.("img.control-icon") ||
          el.querySelector?.("img.nav-icon") ||
          el.querySelector?.("img");

        if (img) {
          img.setAttribute("src", resolveIconPath(icon));
          if (label) img.setAttribute("alt", label);
        }
      }

      // Atualizar label visível (quando existir)
      if (label) {
        const labelNode = el.querySelector?.(".control-label");
        if (labelNode) {
          labelNode.textContent = label;
        }

        // Melhorar acessibilidade
        if (!el.getAttribute("aria-label")) {
          el.setAttribute("aria-label", label);
        }
      }
    });
  } catch (e) {
    // não travar a aplicação por causa de UI tokens
  }
}

function extractRelativeAssetPath(value) {
  if (!value || typeof value !== "string") return null;

  // Preferir o atributo (relativo) quando existir; mas se vier URL absoluta,
  // tentar reduzir para algo como "images/...".
  const marker = "images/";
  const idx = value.indexOf(marker);
  if (idx >= 0) {
    return value.slice(idx);
  }

  // Se vier com prefixo "/.../images/..."
  const slashMarker = "/images/";
  const idx2 = value.indexOf(slashMarker);
  if (idx2 >= 0) {
    return value.slice(idx2 + 1);
  }

  return value;
}

function getIconOverrideMap() {
  try {
    if (
      typeof window !== "undefined" &&
      typeof window.getIconOverrides === "function"
    ) {
      return window.getIconOverrides() || {};
    }
  } catch (e) {
    // ignore
  }

  try {
    if (
      typeof window !== "undefined" &&
      window.CLIENT_CONFIG?.ui?.iconOverrides
    ) {
      return window.CLIENT_CONFIG.ui.iconOverrides;
    }
  } catch (e) {
    // ignore
  }

  return {};
}

function resolveIconPath(path) {
  if (!path) return path;
  const overrides = getIconOverrideMap();
  if (!overrides || typeof overrides !== "object") return path;

  const normalized = extractRelativeAssetPath(path);
  if (normalized && overrides[normalized]) return overrides[normalized];
  if (overrides[path]) return overrides[path];
  return path;
}

function applyIconOverrides(root = document) {
  const overrides = getIconOverrideMap();
  if (
    !overrides ||
    typeof overrides !== "object" ||
    Object.keys(overrides).length === 0
  ) {
    return;
  }

  try {
    // Atualizar atributos data-icon-on/off para controles que alternam ícones
    const toggles =
      root.querySelectorAll?.("[data-icon-on], [data-icon-off]") || [];
    toggles.forEach((el) => {
      const rawOn = el.getAttribute("data-icon-on");
      const rawOff = el.getAttribute("data-icon-off");
      if (rawOn) {
        const nextOn = resolveIconPath(rawOn);
        if (nextOn !== rawOn) el.setAttribute("data-icon-on", nextOn);
      }
      if (rawOff) {
        const nextOff = resolveIconPath(rawOff);
        if (nextOff !== rawOff) el.setAttribute("data-icon-off", nextOff);
      }
    });

    // Atualizar qualquer <img src="..."> no DOM (música, cortinas, AC, etc.)
    const imgs = root.querySelectorAll?.("img[src]") || [];
    imgs.forEach((img) => {
      const raw = img.getAttribute("src") || img.src;
      const next = resolveIconPath(raw);
      if (next && next !== raw) {
        img.setAttribute("src", next);
      }
    });
  } catch (e) {
    // não travar a aplicação por causa de ícones
  }
}

if (typeof window !== "undefined") {
  window.debugLog = debugLog;
  window.isDebugEnabled = isDebugEnabled;
}

const CONTROL_SELECTOR =
  ".room-control[data-device-id], .control-card[data-device-id]";
const deviceControlCache = new Map();
const deviceStateMemory = new Map();
const DEVICE_STATE_STORAGE_PREFIX = "deviceState:";
const DEVICE_STATE_MAX_QUOTA_ERRORS = 1;
let deviceStateStorageDisabled = false;
let deviceStateCleanupInProgress = false;
let deviceStateQuotaErrors = 0;
let deviceStateQuotaWarningShown = false;
let controlCachePrimed = false;
let domObserverInstance = null;
let fallbackSyncTimer = null;
let pendingControlSyncHandle = null;
let pendingControlSyncForce = false; // ========================================

function buildRoomImageBases() {
  if (typeof getEnvironmentPhotoMap === "function") {
    try {
      const map = getEnvironmentPhotoMap();
      const values = map ? Object.values(map).filter(Boolean) : [];
      if (values.length) {
        return Array.from(new Set(values));
      }
    } catch (error) {
      console.warn("Falha ao ler fotos do config.js", error);
    }
  }

  return [];
}

const ROOM_IMAGE_BASES = buildRoomImageBases();

const CRITICAL_IMAGE_BASES = ROOM_IMAGE_BASES.slice(0, 3);

function resolveRoomImageUrl(base) {
  if (!base) return "";
  const raw = String(base).trim();
  const hasExtension = /\.[a-z0-9]+$/i.test(raw);
  return hasExtension ? `images/Images/${raw}` : `images/Images/${raw}.jpg`;
}

const ICON_ASSET_PATHS = [
  "images/icons/icon-tv.svg",
  "images/icons/icon-htv.svg",
  "images/icons/icon-bluray.svg",
  "images/icons/icon-apple-tv.svg",
  "images/icons/icon-clarotv.svg",
  "images/icons/icon-numbers.svg",
  "images/icons/icon-globo.svg",
  "images/icons/icon-globonews.svg",
  "images/icons/icon-gnt.svg",
  "images/icons/icon-canaloff.svg",
  "images/icons/icon-discovery.svg",
  "images/icons/icon-espn.svg",
  "images/icons/icon-sportv.svg",
  "images/icons/icon-tcaction.svg",
  "images/icons/icon-hbo.svg",
  "images/icons/icon-config.svg",
  "images/icons/icon-setup.svg",
  "images/icons/icon-stup.svg",
  "images/icons/icon-sound-high.svg",
  "images/icons/icon-sound-low.svg",
  "images/icons/icon-sound-mute.svg",
  "images/icons/icon-roku.svg",
  "images/icons/icon-musica.svg",
  "images/icons/icon-curtain.svg",
  "images/icons/icon-firetv.svg",
  "images/icons/icon-conforto.svg",
  "images/icons/ar-condicionado.svg",
  "images/icons/icon-piscina.svg",
  "images/icons/icon-telao-led.svg",
  "images/icons/icon-small-light-off.svg",
  "images/icons/icon-small-light-on.svg",
  "images/icons/icon-small-smartglass-off.svg",
  "images/icons/icon-small-smartglass-on.svg",
  "images/icons/icon-small-shader-off.svg",
  "images/icons/icon-small-shader-on.svg",
  "images/icons/icon-small-tv-off.svg",
  "images/icons/icon-small-tv-on.svg",
  "images/icons/icon-small-telamovel-off.svg",
  "images/icons/icon-small-telamovel-on.svg",
  "images/icons/icon-ac-power.svg",
  "images/icons/icon-ac-fan.svg",
  "images/icons/icon-ac-cool.svg",
  "images/icons/icon-ac-heat.svg",
  "images/icons/icon-ac-auto.svg",
  "images/icons/icon-ac-aleta-moving.svg",
  "images/icons/icon-ac-aleta-parada.svg",
  "images/icons/icon-ac-aleta-alta.svg",
  "images/icons/icon-ac-aleta-baixa.svg",
  "images/icons/icon-rotatephone.svg",
  "images/icons/icon-settings.svg",
  "images/icons/icon-home.svg",
  "images/icons/back-button.svg",
  "images/icons/eletrize.svg",
  "images/icons/Fullscreen.svg",
  "images/icons/icon-limpar.svg",
  "images/icons/icon-mouse.svg",
  "images/icons/Instagram.svg",
  "images/icons/whatsapp.svg",
  "images/icons/icon-volume.svg",
  "images/icons/icon-mute.svg",
  "images/icons/icon-next-track.svg",
  "images/icons/icon-previous-track.svg",
  "images/icons/icon-play.svg",
  "images/icons/icon-pause.svg",
  "images/icons/icon-stop.svg",
  "images/icons/Encerrar-expediente.svg",
  "images/icons/iniciar-expediente.svg",
  "images/icons/icon-scenes.svg",
  "images/icons/pageselector.svg",
];

function buildRoomAssetList() {
  const assets = [];
  ROOM_IMAGE_BASES.forEach((base) => {
    assets.push(resolveRoomImageUrl(base));
  });
  return assets;
}

const AssetPreloader = (() => {
  const queues = {
    critical: new Set(),
    background: new Set(),
  };

  function add(url, { priority = "background" } = {}) {
    if (!url) return;
    const key = priority === "critical" ? "critical" : "background";
    queues[key].add(url);
  }

  function startQueue(priority, { weight = 0, offset = 0 } = {}) {
    if (typeof window === "undefined") {
      return Promise.resolve();
    }
    const list = Array.from(queues[priority] || []);
    if (!list.length) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let completed = 0;
      const total = list.length;

      const update = (url) => {
        completed += 1;
        if (weight > 0) {
          const percent =
            offset + Math.min(weight, Math.round((completed / total) * weight));
          updateProgress(
            percent,
            `Pré-carregando mídia (${completed}/${total})`,
          );
        }

        if (completed === total) {
          resolve();
        }
      };

      list.forEach((url) => {
        const img = new Image();
        img.decoding = "async";
        img.loading = "eager";
        img.onload = img.onerror = () => update(url);
        img.src = url;
      });
    });
  }

  return {
    add,
    startQueue,
  };
})();

ROOM_IMAGE_BASES.forEach((base) => {
  AssetPreloader.add(resolveRoomImageUrl(base), { priority: "background" });
});

AssetPreloader.add("images/pwa/app-icon-420.webp", { priority: "critical" });
AssetPreloader.add("images/pwa/app-icon-192.png", { priority: "background" });
AssetPreloader.add("images/pwa/app-icon-512-transparent.png", {
  priority: "background",
});
ICON_ASSET_PATHS.forEach((asset) =>
  AssetPreloader.add(asset, { priority: "background" }),
);

let assetPreloadComplete = false;
let assetPreloadPromise = null;

if (typeof window !== "undefined") {
  assetPreloadPromise = AssetPreloader.startQueue("critical", {
    weight: 30,
    offset: 0,
  })
    .catch((error) => {
      console.warn("Falha ao pré-carregar mídia crítica", error);
    })
    .finally(() => {
      assetPreloadComplete = true;
      AssetPreloader.startQueue("background", {
        weight: 15,
        offset: 30,
      }).catch((error) =>
        console.warn("Falha ao pré-carregar mídia adicional", error),
      );
    });

  window.__assetPreloadPromise = assetPreloadPromise;
  window.queueAssetForPreload = (url, priority) =>
    AssetPreloader.add(url, { priority });
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  const mql =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(display-mode: standalone)")
      : null;
  return Boolean((mql && mql.matches) || window.navigator?.standalone === true);
}

async function requestPersistentStorage() {
  if (
    typeof navigator === "undefined" ||
    !navigator.storage ||
    typeof navigator.storage.persist !== "function"
  ) {
    return;
  }
  try {
    const alreadyPersisted = await navigator.storage.persisted();
    if (alreadyPersisted) {
      return;
    }
    await navigator.storage.persist();
  } catch (error) {
    console.warn("Não foi possível garantir armazenamento persistente:", error);
  }
}

const fullscreenManager = (() => {
  let attempted = false;

  function canRequestFullscreen() {
    return (
      typeof document !== "undefined" &&
      typeof document.documentElement.requestFullscreen === "function"
    );
  }

  function enterFullscreen() {
    if (attempted || !canRequestFullscreen()) return;
    attempted = true;
    document.documentElement
      .requestFullscreen({ navigationUI: "hide" })
      .catch((error) => {
        console.warn(
          "Não foi possível entrar em tela cheia automaticamente",
          error,
        );
      });

    if (screen?.orientation?.lock) {
      screen.orientation.lock("landscape").catch(() => {});
    }
  }

  function setupAutoFullscreen() {
    if (!isStandaloneMode() || !canRequestFullscreen()) return;

    const handler = () => {
      document.removeEventListener("click", handler);
      document.removeEventListener("touchend", handler);
      enterFullscreen();
    };

    document.addEventListener("click", handler, { once: true });
    document.addEventListener("touchend", handler, { once: true });
  }

  if (typeof window !== "undefined") {
    window.addEventListener("DOMContentLoaded", setupAutoFullscreen);
  }

  return { enterFullscreen };
})();

if (typeof window !== "undefined") {
  window.requestPersistentStorage = requestPersistentStorage;
  window.fullscreenManager = fullscreenManager;

  window.addEventListener("DOMContentLoaded", () => {
    if (isStandaloneMode()) {
      requestPersistentStorage();
    }
  });
}

// DETECÇÃO DE DISPOSITIVOS
// ========================================

function isMusicPageActive(hash = window.location.hash) {
  const isActive = /ambiente\d+-musica/.test(hash || "");
  console.log("🎵 isMusicPageActive check:", { hash, isActive });
  return isActive;
}

function queryActiveMusic(selector) {
  const activePage = document.querySelector(".page.active");
  if (!activePage) return null;
  return activePage.querySelector(selector);
}

// Detectar iPad Mini 6 especificamente
function detectIPadMini6() {
  const userAgent = navigator.userAgent.toLowerCase();
  const isIPad = /ipad/.test(userAgent);

  // Verificar tamanho: iPad Mini 6 tem 2048x1536 (portrait)
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;

  // iPad Mini 6: ~1024x768 em modo reportado pelo navegador (scaled)
  const isIPadMini6 =
    isIPad &&
    ((screenWidth === 1024 && screenHeight === 768) ||
      (screenWidth === 768 && screenHeight === 1024));

  if (isIPadMini6) {
    document.documentElement.dataset.device = "ipad-mini-6";
    console.log(
      "🍎 iPad Mini 6 detectado - aplicando fixes específicos",
      `Screen: ${screenWidth}x${screenHeight}`,
      `Inner: ${window.innerWidth}x${window.innerHeight}`,
      `DPR: ${window.devicePixelRatio}`,
    );
    return true;
  }

  return false;
}

// Detectar se é um celular (não tablet)
function isMobilePhone() {
  const userAgent = navigator.userAgent.toLowerCase();

  // Considerar celular se:
  // 1. iPhone ou Android com tela pequena
  // 2. Largura máxima < 768px (breakpoint de tablet)
  const isIPhone = /iphone/.test(userAgent);
  const isAndroid = /android/.test(userAgent);
  const isSmallScreen = window.innerWidth < 768;

  // iPad e tablets maiores não são celulares
  const isTablet = /ipad|galaxy tab|sm-t/.test(userAgent);

  return (isIPhone || (isAndroid && isSmallScreen)) && !isTablet;
}

// Detectar dispositivo geral (Apple, Android ou Desktop)
function detectDevice() {
  const userAgent = navigator.userAgent.toLowerCase();

  const isApple =
    /ipad|iphone|mac os x/.test(userAgent) && navigator.maxTouchPoints > 1;
  const isAndroid = /android/.test(userAgent);

  if (isApple || isAndroid) {
    document.documentElement.dataset.device = "mobile";
    console.log(
      `📱 Dispositivo mobile detectado (${isApple ? "Apple" : "Android"})`,
    );
  }
}

// Função para detectar se está na página de controle remoto da TV
function isOnTVControlPage() {
  const target = `${window.location.pathname}${window.location.hash}`;
  return /(ambiente\d+-(tv|htv|bluray|appletv|clarotv|roku|games|hidromassagem))/.test(
    target,
  );
}

// Função para criar/mostrar overlay de orientação
function showOrientationOverlay() {
  let overlay = document.getElementById("orientation-overlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "orientation-overlay";
    overlay.innerHTML = `
      <div class="orientation-overlay-content">
        <img src="images/icons/icon-rotatephone.svg" alt="Rotacione o dispositivo" class="orientation-icon">
        <p class="orientation-message">Rotacione o dispositivo</p>
      </div>
    `;
    document.body.appendChild(overlay);

    // Adicionar estilos dinamicamente se não existirem
    if (!document.getElementById("orientation-overlay-styles")) {
      const style = document.createElement("style");
      style.id = "orientation-overlay-styles";
      style.innerHTML = `
        #orientation-overlay {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.95);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          z-index: 10000;
          align-items: center;
          justify-content: center;
        }

        #orientation-overlay.active {
          display: flex;
        }

        .orientation-overlay-content {
          text-align: center;
          color: #fff;
        }

        .orientation-icon {
          width: 120px;
          height: 120px;
          margin-bottom: 20px;
          animation: rotate 2s infinite;
          filter: brightness(0) invert(1);
        }

        .orientation-message {
          font-size: 24px;
          font-weight: 600;
          letter-spacing: 0.5px;
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        }

        @keyframes rotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 480px) {
          .orientation-icon {
            width: 80px;
            height: 80px;
          }

          .orientation-message {
            font-size: 18px;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  return overlay;
}

// Função para aplicar estilos baseado em orientação e localização
function updateDeviceStyles() {
  const isMobile = isMobilePhone();
  const isLandscape = window.innerWidth > window.innerHeight;
  const onTVPage = isOnTVControlPage();

  // Regra prioritária: Celulares em landscape no controle remoto são bloqueados
  if (isMobile && isLandscape && onTVPage) {
    const overlay = showOrientationOverlay();
    overlay.classList.add("active");
    document.documentElement.dataset.layoutState = "mobile-blocked";
    console.log("📵 Celular em landscape no controle remoto - bloqueado");
  } else {
    const overlay = showOrientationOverlay();
    overlay.classList.remove("active");
    document.documentElement.dataset.layoutState = "default";
  }
}

// Executar detecção ao carregar
detectIPadMini6();
detectDevice();
updateDeviceStyles();

// Monitorar mudanças de orientação
window.addEventListener("orientationchange", updateDeviceStyles);
window.addEventListener("resize", updateDeviceStyles);

// ========================================
// CONFIGURAÇÕES GERAIS
// ========================================

// IDs de todos os dispositivos de iluminação (obtidos do config.js)
let ALL_LIGHT_IDS =
  typeof getAllLightIds === "function" ? getAllLightIds() : [];

const AUDIO_DEFAULTS =
  typeof getAudioDefaults === "function"
    ? getAudioDefaults()
    : { commandDeviceId: "", metadataDeviceId: "" };
const DEFAULT_DENON_COMMAND_DEVICE_ID =
  String(AUDIO_DEFAULTS?.commandDeviceId || "").trim();
const DEFAULT_DENON_METADATA_DEVICE_ID =
  String(AUDIO_DEFAULTS?.metadataDeviceId || "").trim();
const ENV_REMOTE_DEVICE_FIELDS = [
  "music",
  "tv",
  "htv",
  "bluray",
  "appletv",
  "clarotv",
  "roku",
  "games",
  "hidromassagem",
];
const ROUTE_SUFFIX_TO_ENV_FIELD = {
  luzes: "lights",
  cortinas: "curtains",
  conforto: "airConditioner",
  musica: "music",
  tv: "tv",
  htv: "htv",
  bluray: "bluray",
  appletv: "appletv",
  clarotv: "clarotv",
  roku: "roku",
  games: "games",
  hidromassagem: "hidromassagem",
};

function getEnvironmentKeyFromRouteHash(hash = window.location.hash) {
  const route = (hash || "").replace("#", "");
  const match = route.match(/^(ambiente\d+)/);
  return match ? match[1] : null;
}

function getConfiguredEnvironmentDevice(envKey, field) {
  if (typeof getEnvironmentPrimaryDevice === "function") {
    return getEnvironmentPrimaryDevice(envKey, field);
  }
  return null;
}

function getConfiguredEnvironmentBinding(
  envKey,
  field,
  bindingKey,
  fallback = "",
) {
  if (typeof getEnvironmentDeviceBinding === "function") {
    const value = getEnvironmentDeviceBinding(envKey, field, bindingKey);
    if (value) return String(value);
  }

  const device = getConfiguredEnvironmentDevice(envKey, field);
  if (!device) return String(fallback || "");

  const directValue =
    device[bindingKey] ||
    device[`${bindingKey}Id`] ||
    (bindingKey === "id" ? device.id : "");
  return String(directValue || fallback || "");
}

function getConfiguredEnvironmentControlId(envKey, controlKey, fallback = "") {
  if (typeof getEnvironmentControlId === "function") {
    const value = getEnvironmentControlId(envKey, controlKey);
    if (value) return String(value);
  }
  return String(fallback || "");
}

function getLegacyConfiguredId(groupKey, controlKey, fallback = "") {
  if (typeof getLegacyControlId === "function") {
    const value = getLegacyControlId(groupKey, controlKey);
    if (value) return String(value);
  }
  return String(fallback || "");
}

function getDenonMetadataDeviceIdForEnv(envKey) {
  const configuredId = getConfiguredEnvironmentBinding(
    envKey,
    "music",
    "metadata",
  );
  return configuredId || DEFAULT_DENON_METADATA_DEVICE_ID;
}

function getDenonCommandDeviceIdForEnv(envKey) {
  const configuredId =
    getConfiguredEnvironmentBinding(envKey, "music", "volume") ||
    getConfiguredEnvironmentBinding(envKey, "music", "power");

  return configuredId || DEFAULT_DENON_COMMAND_DEVICE_ID;
}

function getDenonCommandDeviceIdForCurrentRoute(hash = window.location.hash) {
  const envKey = getEnvironmentKeyFromRouteHash(hash);
  return getDenonCommandDeviceIdForEnv(envKey);
}

function normalizeRouteForPolling(hash = window.location.hash) {
  return String(hash || "")
    .replace(/^#/, "")
    .split("?")[0]
    .trim()
    .toLowerCase();
}

function addPollingDeviceId(ids, value) {
  if (value === null || value === undefined || value === "") return;
  ids.add(String(value));
}

function addPollingDeviceList(ids, list) {
  if (!Array.isArray(list)) return;

  list.forEach((entry) => {
    if (entry === null || entry === undefined) return;

    if (
      typeof entry === "string" ||
      typeof entry === "number" ||
      typeof entry === "bigint"
    ) {
      addPollingDeviceId(ids, entry);
      return;
    }

    if (Array.isArray(entry.targets)) {
      entry.targets.forEach((target) => {
        if (target === null || target === undefined) return;
        if (
          typeof target === "string" ||
          typeof target === "number" ||
          typeof target === "bigint"
        ) {
          addPollingDeviceId(ids, target);
          return;
        }

        if (typeof target === "object") {
          addPollingDeviceId(ids, target.deviceId ?? target.id);
        }
      });
    }

    if (typeof entry === "object") {
      addPollingDeviceId(ids, entry.deviceId ?? entry.id);
    }
  });
}

function addAirConditionerPollingIds(ids, acConfig) {
  if (!acConfig || typeof acConfig !== "object") return;

  addPollingDeviceId(ids, acConfig.deviceId);

  const zones = Array.isArray(acConfig.zones) ? acConfig.zones : [];
  zones.forEach((zone) => {
    if (!zone || typeof zone !== "object") return;
    addPollingDeviceId(ids, zone.deviceId);
  });
}

function addEnvironmentDefaultPollingIds(ids, env) {
  if (!env || typeof env !== "object") return;

  addPollingDeviceList(ids, env.lights);
  addPollingDeviceList(ids, env.curtains);
  addAirConditionerPollingIds(ids, env.airConditioner);

  ENV_REMOTE_DEVICE_FIELDS.forEach((field) => {
    addPollingDeviceList(ids, env[field]);
  });
}

function addEnvironmentPollingIds(ids, envKey, routeSuffix) {
  if (!envKey || typeof getEnvironment !== "function") return;

  const env = getEnvironment(envKey);
  if (!env) return;

  const normalizedSuffix = String(routeSuffix || "").toLowerCase();

  if (!normalizedSuffix) {
    addEnvironmentDefaultPollingIds(ids, env);
    return;
  }

  const suffixParts = normalizedSuffix.split("-").filter(Boolean);
  const sectionKey = suffixParts[suffixParts.length - 1] || normalizedSuffix;
  const field = ROUTE_SUFFIX_TO_ENV_FIELD[sectionKey];

  if (!field) {
    addEnvironmentDefaultPollingIds(ids, env);
    return;
  }

  if (field === "airConditioner") {
    addAirConditionerPollingIds(ids, env.airConditioner);
    return;
  }

  addPollingDeviceList(ids, env[field]);
}

function getPollingDeviceIds(hash = window.location.hash) {
  const ids = new Set();
  const route = normalizeRouteForPolling(hash);
  const envMatch = route.match(/^(ambiente\d+)(?:-(.+))?$/);

  // Prioriza o que está visível na página atual.
  deviceControlCache.forEach(function (_registry, cachedDeviceId) {
    addPollingDeviceId(ids, cachedDeviceId);
  });

  if (envMatch) {
    const envKey = envMatch[1];
    const routeSuffix = envMatch[2] || "";
    addEnvironmentPollingIds(ids, envKey, routeSuffix);
  } else if (!route || route === "home") {
    addPollingDeviceList(ids, ALL_LIGHT_IDS);
  } else if (route === "ambientes") {
    addPollingDeviceList(ids, ALL_LIGHT_IDS);
  } else if (route === "curtains" || route === "cortinas") {
    if (typeof getAllCurtainIds === "function") {
      addPollingDeviceList(ids, getAllCurtainIds());
    }
  } else if (route === "scenes" || route === "cenarios") {
    // Página de cenários não precisa polling completo por padrão.
  }

  const denonId = String(getDenonCommandDeviceIdForCurrentRoute(hash) || "");
  if (denonId) {
    if (
      denonId !== DEFAULT_DENON_COMMAND_DEVICE_ID &&
      ids.has(DEFAULT_DENON_COMMAND_DEVICE_ID)
    ) {
      ids.delete(DEFAULT_DENON_COMMAND_DEVICE_ID);
    }
    addPollingDeviceId(ids, denonId);
  }

  if (ids.size === 0) {
    addPollingDeviceList(ids, ALL_LIGHT_IDS);
    addPollingDeviceId(ids, denonId);
  }

  return filterAccessibleDeviceIds(Array.from(ids), "view");
}

// ID do dispositivo de Ar Condicionado atual (será atualizado dinamicamente)
let AC_DEVICE_ID = getACDeviceIdForCurrentRoute(); // Atualizado dinamicamente

function getDashboardAccessApi() {
  return window.dashboardAccess || null;
}

function canViewDeviceId(deviceId) {
  const accessApi = getDashboardAccessApi();
  if (!accessApi || typeof accessApi.isDeviceAllowed !== "function") {
    return true;
  }
  return accessApi.isDeviceAllowed(deviceId, "view");
}

function canControlDeviceId(deviceId) {
  const accessApi = getDashboardAccessApi();
  if (!accessApi || typeof accessApi.isDeviceAllowed !== "function") {
    return true;
  }
  return accessApi.isDeviceAllowed(deviceId, "control");
}

function filterAccessibleDeviceIds(deviceIds, purpose) {
  const checker = purpose === "control" ? canControlDeviceId : canViewDeviceId;
  return (Array.isArray(deviceIds) ? deviceIds : [])
    .map((deviceId) => String(deviceId || "").trim())
    .filter((deviceId) => deviceId && checker(deviceId));
}

function refreshConfiguredDeviceCaches() {
  try {
    ALL_LIGHT_IDS =
      typeof getAllLightIds === "function" ? getAllLightIds() : ALL_LIGHT_IDS;
  } catch (error) {
    console.warn("Falha ao atualizar ALL_LIGHT_IDS:", error);
  }

  try {
    AC_DEVICE_ID = getACDeviceIdForCurrentRoute();
  } catch (error) {
    console.warn("Falha ao atualizar AC_DEVICE_ID:", error);
  }
}

// Função para obter o ID do AC baseado na rota atual
function getACDeviceIdForCurrentRoute() {
  const ambiente = getEnvironmentKeyFromRouteHash(window.location.hash);
  if (ambiente) {
    if (typeof getEnvironment === "function") {
      const env = getEnvironment(ambiente);
      const acConfig = env?.airConditioner || null;
      if (acConfig?.deviceId) {
        return String(acConfig.deviceId);
      }
      const zones = Array.isArray(acConfig?.zones) ? acConfig.zones : [];
      const zoneId = zones.find((zone) => zone?.deviceId)?.deviceId;
      if (zoneId) {
        return String(zoneId);
      }
    }
  }
  return "";
}

// ========================================
// INICIALIZAÇÃO DE DISPOSITIVOS POR AMBIENTE
// ========================================

// Mapa de dispositivos por ambiente com comando "initialize"
const ENV_INITIALIZE_DEVICE_MAP =
  (typeof CLIENT_CONFIG !== "undefined" &&
    CLIENT_CONFIG?.devices?.initializeDevicesByEnv) ||
  {};

const INIT_COOLDOWN_MS = 30000; // 30 segundos entre inicializações por ambiente
const lastInitByEnv = new Map();

async function initializeEnvironmentDevices(envKey) {
  if (!envKey) return;
  const ids = ENV_INITIALIZE_DEVICE_MAP?.[envKey];
  if (!Array.isArray(ids) || ids.length === 0) return;

  const now = Date.now();
  const last = lastInitByEnv.get(envKey) || 0;
  if (now - last < INIT_COOLDOWN_MS) {
    console.log(
      `⏳ [initializeEnvironmentDevices] Cooldown ativo (${envKey}), ignorando.`,
    );
    return;
  }

  console.log(
    `🚀 [initializeEnvironmentDevices] Iniciando dispositivos de ${envKey}...`,
  );
  lastInitByEnv.set(envKey, now);

  const results = await Promise.allSettled(
    ids.map(async (deviceId) => {
      try {
        console.log(
          `🔧 [initializeEnvironmentDevices] Enviando initialize para ${deviceId}`,
        );
        await sendHubitatCommand(deviceId, "initialize");
        console.log(
          `✅ [initializeEnvironmentDevices] ${deviceId} inicializado`,
        );
        return { deviceId, success: true };
      } catch (error) {
        console.error(
          `❌ [initializeEnvironmentDevices] Erro em ${deviceId}:`,
          error,
        );
        return { deviceId, success: false, error };
      }
    }),
  );

  const successful = results.filter(
    (r) => r.status === "fulfilled" && r.value.success,
  ).length;
  const failed = results.length - successful;
  console.log(
    `🏁 [initializeEnvironmentDevices] ${envKey}: ${successful} sucesso, ${failed} falhas`,
  );
}

function getEnvironmentRouteFromHash(hash) {
  const route = (hash || "").replace("#", "");
  return /^ambiente\\d+$/.test(route) ? route : null;
}

function getRemoteDeviceIdForEnv(envKey, controlType) {
  if (!envKey || !controlType || typeof getEnvironment !== "function") {
    return null;
  }
  const env = getEnvironment(envKey);
  if (!env) return null;
  const list = Array.isArray(env[controlType]) ? env[controlType] : [];
  const first = list[0];
  if (!first || !first.id) return null;
  return String(first.id);
}

function syncRemoteControlDeviceIds() {
  const route = (window.location.hash || "").replace("#", "");
  const envKey = route.split("-")[0];
  if (!/^ambiente\\d+$/.test(envKey)) return;

  const wrapper = document.querySelector(
    ".page.active .tv-control-wrapper[data-control-type]",
  );
  if (!wrapper) return;
  const controlType = String(
    wrapper.dataset.deviceType || wrapper.dataset.controlType || "",
  ).toLowerCase();
  if (!controlType || controlType === "music") return;

  const targetId = getRemoteDeviceIdForEnv(envKey, controlType);
  if (!targetId) return;

  wrapper.querySelectorAll("[data-device-id]").forEach((el) => {
    if (el.tagName === "INPUT" && el.type === "range") return;
    if (el.closest(".tv-control-section--volume")) return;
    el.dataset.deviceId = targetId;
  });
}

// Configurações de timeout e retry
const NETWORK_CONFIG = {
  HEALTH_CHECK_TIMEOUT: 5000, // 5s para health check
  FETCH_TIMEOUT_PER_ATTEMPT: 15000, // 15s por tentativa
  MAX_RETRY_ATTEMPTS: 3, // 3 tentativas máximo
  RETRY_DELAY_BASE: 1000, // 1s base para backoff
  RETRY_DELAY_MAX: 5000, // 5s máximo entre tentativas
  COMMAND_TIMEOUT_PER_ATTEMPT: 3500, // comandos: resposta rápida
  COMMAND_MAX_RETRY_ATTEMPTS: 1, // comandos: sem retry em cadeia
};

// --- Confiabilidade de comandos (fila + timeout + retry) ---
// Serializa comandos por deviceId para evitar colisões quando o usuário toca rápido.
const DEVICE_COMMAND_QUEUE = new Map();

function enqueueDeviceCommand(deviceId, task) {
  const key = String(deviceId);
  const previous = DEVICE_COMMAND_QUEUE.get(key) || Promise.resolve();

  // Nunca deixa um erro quebrar a fila: engole o erro do anterior antes de continuar.
  const next = previous.catch(() => {}).then(() => task());

  // Limpa a fila quando este item terminar (se ainda for o último).
  DEVICE_COMMAND_QUEUE.set(
    key,
    next.finally(() => {
      if (DEVICE_COMMAND_QUEUE.get(key) === next) {
        DEVICE_COMMAND_QUEUE.delete(key);
      }
    }),
  );

  return next;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, timeoutMs) {
  if (typeof AbortController === "undefined" || !timeoutMs) {
    return fetch(url, options);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function computeBackoffDelay(attempt) {
  return Math.min(
    NETWORK_CONFIG.RETRY_DELAY_BASE * Math.pow(2, attempt - 1),
    NETWORK_CONFIG.RETRY_DELAY_MAX,
  );
}

function isHtmlResponseText(text) {
  const trimmed = String(text || "")
    .trim()
    .toLowerCase();
  return trimmed.startsWith("<!doctype") || trimmed.startsWith("<html");
}

async function fetchTextWithRetry(url, options = {}, config = {}) {
  const maxRetries =
    typeof config.maxRetries === "number"
      ? config.maxRetries
      : NETWORK_CONFIG.MAX_RETRY_ATTEMPTS;
  const timeoutMs =
    typeof config.timeoutMs === "number"
      ? config.timeoutMs
      : NETWORK_CONFIG.FETCH_TIMEOUT_PER_ATTEMPT;

  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        url,
        { cache: "no-cache", ...options },
        timeoutMs,
      );
      const text = await response.text();

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${response.statusText || "Erro"}`,
        );
      }

      // Proxy/Functions às vezes devolvem HTML quando estão fora.
      if (isHtmlResponseText(text)) {
        throw new Error("Resposta HTML inesperada (proxy indisponível)");
      }

      return { response, text };
    } catch (error) {
      lastError = error;

      if (attempt >= maxRetries) {
        break;
      }

      const delay = computeBackoffDelay(attempt);
      await sleep(delay);
    }
  }

  throw lastError || new Error("Falha desconhecida ao fazer fetch");
}

// Funções de toggle para ícones nos cards da home
function toggleTelamovelIcon(el) {
  const img = el.querySelector("img");
  if (el.dataset.state === "off") {
    img.src = resolveIconPath("images/icons/icon-small-telamovel-on.svg");
    el.dataset.state = "on";
  } else {
    img.src = resolveIconPath("images/icons/icon-small-telamovel-off.svg");
    el.dataset.state = "off";
  }
}

function toggleSmartglassIcon(el) {
  const img = el.querySelector("img");
  if (el.dataset.state === "off") {
    img.src = resolveIconPath("images/icons/icon-small-smartglass-on.svg");
    el.dataset.state = "on";
  } else {
    img.src = resolveIconPath("images/icons/icon-small-smartglass-off.svg");
    el.dataset.state = "off";
  }
}

function toggleShaderIcon(el) {
  const img = el.querySelector("img");
  if (el.dataset.state === "off") {
    img.src = resolveIconPath("images/icons/icon-small-shader-on.svg");
    el.dataset.state = "on";
  } else {
    img.src = resolveIconPath("images/icons/icon-small-shader-off.svg");
    el.dataset.state = "off";
  }
}

function toggleLightIcon(el) {
  const img = el.querySelector("img");
  const deviceIdsAttr = el.dataset.deviceIds;
  const deviceIds = deviceIdsAttr ? deviceIdsAttr.split(",") : [];

  if (el.dataset.state === "off") {
    img.src = resolveIconPath("images/icons/icon-small-light-on.svg");
    el.dataset.state = "on";
    deviceIds.forEach((id) => sendHubitatCommand(id, "on"));
  } else {
    img.src = resolveIconPath("images/icons/icon-small-light-off.svg");
    el.dataset.state = "off";
    deviceIds.forEach((id) => sendHubitatCommand(id, "off"));
  }
}

function toggleTvIcon(el) {
  const img = el.querySelector("img");
  if (el.dataset.state === "off") {
    img.src = resolveIconPath("images/icons/icon-small-tv-on.svg");
    el.dataset.state = "on";
  } else {
    img.src = resolveIconPath("images/icons/icon-small-tv-off.svg");
    el.dataset.state = "off";
  }
}

// Botões dos cômodos nas páginas internas
function getMainControlIcon(el) {
  if (!el) return null;
  return (
    el.querySelector(".control-icon-main") ||
    el.querySelector(".room-control-icon, .control-icon")
  );
}

function isLinkedLedOnForModeButton(linkedLedId) {
  const normalizedLedId = String(linkedLedId || "").trim();
  if (!normalizedLedId) return false;

  const selectorId =
    typeof escapeDeviceIdForSelector === "function"
      ? escapeDeviceIdForSelector(normalizedLedId)
      : normalizedLedId;
  const linkedControls = Array.from(
    document.querySelectorAll(`[data-device-id="${selectorId}"]`),
  ).filter((el) => !el.classList.contains("control-card--led-mode"));

  if (linkedControls.length > 0) {
    return linkedControls.some(
      (el) => normalizeSwitchState(el?.dataset?.state) === "on",
    );
  }

  return normalizeSwitchState(getStoredState(normalizedLedId)) === "on";
}

function syncLedModeControls() {
  const ledModeButtons = document.querySelectorAll(".control-card--led-mode");
  if (!ledModeButtons.length) return;

  ledModeButtons.forEach((button) => {
    const linkedLedId = button?.dataset?.ledDeviceId;
    const isEnabled = isLinkedLedOnForModeButton(linkedLedId);
    button.dataset.enabled = isEnabled ? "true" : "false";
    button.setAttribute("aria-disabled", isEnabled ? "false" : "true");
    button.classList.toggle("control-card--led-mode-disabled", !isEnabled);
  });
}

function toggleLedModeControl(el) {
  if (!el || !el.dataset) return;
  const linkedLedId = String(el.dataset.ledDeviceId || "").trim();
  const isLinkedLedOn = isLinkedLedOnForModeButton(linkedLedId);
  const isEnabled =
    isLinkedLedOn &&
    el.dataset.enabled === "true" &&
    el.getAttribute("aria-disabled") !== "true";
  if (!isEnabled) return;

  const deviceId = String(el.dataset.deviceId || "").trim();
  if (!deviceId) return;

  recentCommands.set(deviceId, Date.now());

  const computedTransform = window.getComputedStyle(el).transform;
  const baseTransform = computedTransform !== "none" ? computedTransform : "";
  el.style.transform = baseTransform
    ? `${baseTransform} scale(0.99)`
    : "scale(0.99)";
  el.style.background = "rgba(255, 255, 255, 0.15)";
  el.style.borderColor = "rgba(255, 255, 255, 0.3)";
  setTimeout(() => {
    el.style.transform = "";
    el.style.background = "";
    el.style.borderColor = "";
  }, 180);

  console.log(`Enviando comando on (LED Mode) para dispositivo ${deviceId}`);
  sendHubitatCommand(deviceId, "on")
    .then(() => {
      console.log(
        `✅ Comando on (LED Mode) enviado com sucesso para dispositivo ${deviceId}`,
      );
    })
    .catch((error) => {
      console.error(
        `⚠️Erro ao enviar comando LED Mode para dispositivo ${deviceId}:`,
        error,
      );
    });
}

function toggleRoomControl(el) {
  const resolvedDeviceId = resolveLightDeviceIdFromConfig(el);
  const isOff = (el.dataset.state || "off") === "off";
  const newState = isOff ? "on" : "off";
  const deviceId = resolvedDeviceId || el.dataset.deviceId;

  if (!deviceId) return;

  // Marcar comando recente para proteger contra polling
  recentCommands.set(deviceId, Date.now());

  // Atualizar UI imediatamente
  setRoomControlUI(el, newState);

  // Persist locally
  setStoredState(deviceId, newState);

  console.log(`Enviando comando ${newState} para dispositivo ${deviceId}`);

  // Send to Hubitat
  sendHubitatCommand(deviceId, newState === "on" ? "on" : "off")
    .then(() => {
      console.log(
        `✅ Comando ${newState} enviado com sucesso para dispositivo ${deviceId}`,
      );
    })
    .catch((error) => {
      console.error(
        `⚠️Erro ao enviar comando para dispositivo ${deviceId}:`,
        error,
      );
      // Em caso de erro, reverter o estado visual
      const revertState = newState === "on" ? "off" : "on";
      setRoomControlUI(el, revertState);
      setStoredState(deviceId, revertState);
    });
}

function resolveLightDeviceIdFromConfig(el) {
  if (!el || !el.dataset) return null;

  const currentRoute = (window.location.hash || "").replace("#", "");
  const envKey = currentRoute.split("-")[0] || null;
  const explicit = el.dataset.deviceId ? String(el.dataset.deviceId) : null;

  if (!envKey || typeof getEnvironment !== "function") {
    return explicit;
  }

  const env = getEnvironment(envKey);
  const lights = Array.isArray(env?.lights) ? env.lights : [];

  if (explicit && lights.some((light) => String(light.id) === explicit)) {
    return explicit;
  }

  const normalizeLabel = (value) =>
    String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

  const label =
    el.dataset.lightName ||
    el.querySelector(".control-label")?.textContent ||
    "";
  const normalizedLabel = normalizeLabel(label);

  if (normalizedLabel) {
    const match = lights.find(
      (light) => normalizeLabel(light?.name) === normalizedLabel,
    );
    if (match) {
      const id = String(match.id);
      el.dataset.deviceId = id;
      return id;
    }
  }

  const indexAttr = el.dataset.lightIndex;
  if (indexAttr !== undefined && indexAttr !== null) {
    const idx = Number.parseInt(indexAttr, 10);
    if (!Number.isNaN(idx) && lights[idx]) {
      const id = String(lights[idx].id);
      el.dataset.deviceId = id;
      return id;
    }
  }

  return explicit;
}

function clampDimmerValue(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isNaN(parsed)) {
    return Math.max(0, Math.min(100, parsed));
  }
  const fb = Number.parseInt(fallback, 10);
  if (!Number.isNaN(fb)) {
    return Math.max(0, Math.min(100, fb));
  }
  return 80;
}

function updateDimmerSliderUI(slider, level) {
  if (!slider) return;
  const safeLevel = clampDimmerValue(level, slider?.value || 0);
  slider.value = safeLevel;
  slider.style.setProperty("--dimmer-progress", `${(safeLevel / 100) * 100}%`);

  const display = slider.parentElement?.querySelector?.("[data-dimmer-value]");
  if (display) {
    display.textContent = `${safeLevel}%`;
  }
}

function updateDimmerIconIntensity(controlEl, level) {
  if (!controlEl) return;
  const icon = getMainControlIcon(controlEl);
  if (!icon) return;

  // Mantém ícone estável por padrão (evita aspecto "apagado"/travado em ON).
  // Só aplica variação por nível quando explicitamente habilitado no elemento.
  const shouldApplyIntensity =
    String(controlEl.dataset?.iconIntensity || "").toLowerCase() === "true";
  if (!shouldApplyIntensity) {
    icon.style.opacity = "";
    return;
  }

  const normalized = clampDimmerValue(level, level);
  const minOpacity = 0.55;
  const maxOpacity = 1;
  const fraction = normalized / 100;
  const op = minOpacity + (maxOpacity - minOpacity) * fraction;
  icon.style.opacity = op.toFixed(2);
}

function applyDimmerLevelToControl(controlEl, level) {
  if (!controlEl || !controlEl.dataset) return;
  if (controlEl.dataset.controlType !== "dimmer") return;

  controlEl.dataset.level = clampDimmerValue(level, level);

  const slider = controlEl.querySelector(".dimmer-slider");
  if (slider) {
    updateDimmerSliderUI(slider, level);
  }

  const deviceId = controlEl.dataset.deviceId;
  const nextState = clampDimmerValue(level, level) > 0 ? "on" : "off";

  setRoomControlUI(controlEl, nextState);
  updateDimmerIconIntensity(controlEl, level);
  if (deviceId) {
    setStoredState(deviceId, nextState);
  }
}

function toggleDimmerControl(eventOrEl, maybeEl) {
  const el = maybeEl || eventOrEl;
  const evt = eventOrEl instanceof Event ? eventOrEl : null;

  if (!el || !el.dataset) return;

  if (el.dataset.longPressHandled === "true") {
    delete el.dataset.longPressHandled;
    return;
  }

  if (evt && evt.target && evt.target.closest(".dimmer-slider-row")) {
    return;
  }

  const deviceId = resolveLightDeviceIdFromConfig(el) || el.dataset.deviceId;
  const slider = el.querySelector(".dimmer-slider");
  const defaultLevel = clampDimmerValue(el.dataset.defaultLevel, 80);
  const currentState = (el.dataset.state || "off") === "on" ? "on" : "off";
  const nextState = currentState === "on" ? "off" : "on";

  if (!deviceId) return;

  recentCommands.set(deviceId, Date.now());
  setRoomControlUI(el, nextState);
  setStoredState(deviceId, nextState);

  if (nextState === "on") {
    const levelToSet = clampDimmerValue(defaultLevel, 80);
    if (slider) {
      updateDimmerSliderUI(slider, levelToSet);
    }

    el.dataset.level = levelToSet;
    updateDimmerIconIntensity(el, levelToSet);

    sendHubitatCommand(deviceId, "setLevel", String(levelToSet)).catch(
      (error) => {
        console.error(
          `⚠️Erro ao definir nível do dimmer ${deviceId} para ${levelToSet}:`,
          error,
        );
      },
    );
  } else {
    if (slider) {
      updateDimmerSliderUI(slider, 0);
    }

    el.dataset.level = 0;
    updateDimmerIconIntensity(el, 0);

    sendHubitatCommand(deviceId, "off").catch((error) => {
      console.error(`⚠️Erro ao desligar dimmer ${deviceId}:`, error);
    });
  }
}

function handleDimmerInput(event, sliderEl) {
  if (event && typeof event.stopPropagation === "function") {
    event.stopPropagation();
  }
  if (!sliderEl) return;

  const level = clampDimmerValue(sliderEl.value, sliderEl.dataset.defaultLevel);
  updateDimmerSliderUI(sliderEl, level);
}

function handleDimmerChange(event, sliderEl) {
  if (event && typeof event.stopPropagation === "function") {
    event.stopPropagation();
  }
  if (!sliderEl) return;

  const card = sliderEl.closest(".control-card");
  const deviceId =
    resolveLightDeviceIdFromConfig(card || sliderEl) ||
    sliderEl.dataset.deviceId;
  const level = clampDimmerValue(sliderEl.value, card?.dataset?.defaultLevel);
  const nextState = level > 0 ? "on" : "off";

  if (card) {
    setRoomControlUI(card, nextState);
  }
  updateDimmerIconIntensity(card, level);
  if (!deviceId) return;

  setStoredState(deviceId, nextState);
  recentCommands.set(deviceId, Date.now());

  updateDimmerSliderUI(sliderEl, level);

  sendHubitatCommand(deviceId, "setLevel", String(level))
    .then(() => {
      if (level === 0) {
        return sendHubitatCommand(deviceId, "off");
      }
      return null;
    })
    .catch((error) => {
      console.error(
        `⚠️Erro ao enviar nível ${level} para dimmer ${deviceId}:`,
        error,
      );
    });
}

const dimmerLongPressTimers = new WeakMap();

function startDimmerLongPress(event, el) {
  if (!el) return;
  cancelDimmerLongPress(el);

  const timer = setTimeout(() => {
    el.dataset.longPressHandled = "true";
    showDimmerPopup(el);
    dimmerLongPressTimers.delete(el);
  }, 500);

  dimmerLongPressTimers.set(el, timer);
}

function cancelDimmerLongPress(el) {
  const timer = dimmerLongPressTimers.get(el);
  if (timer) {
    clearTimeout(timer);
    dimmerLongPressTimers.delete(el);
  }
}

function showDimmerPopup(controlEl) {
  if (!controlEl || !controlEl.dataset) return;
  const deviceId = controlEl.dataset.deviceId;
  if (!deviceId) return;

  const currentLevel = clampDimmerValue(
    controlEl.dataset.level ?? controlEl.dataset.defaultLevel ?? 80,
    80,
  );

  const overlay = document.createElement("div");
  overlay.className = "dimmer-popup-overlay";

  overlay.innerHTML = `
    <div class="dimmer-popup" role="dialog" aria-label="Ajustar intensidade">
      <div class="dimmer-popup__header">Intensidade</div>
      <div class="dimmer-popup__body">
        <input class="dimmer-slider" type="range" min="0" max="100" step="1" value="${currentLevel}" data-device-id="${deviceId}" aria-label="Nível do dimmer">
        <div class="dimmer-popup__value" data-dimmer-popup-value>${currentLevel}%</div>
      </div>
    </div>
  `;

  const slider = overlay.querySelector(".dimmer-slider");
  const valueLabel = overlay.querySelector("[data-dimmer-popup-value]");

  const closePopup = () => {
    overlay.remove();
  };

  overlay.addEventListener("click", (evt) => {
    if (evt.target === overlay) closePopup();
  });

  if (slider) {
    updateDimmerSliderUI(slider, currentLevel);

    slider.addEventListener("input", (evt) => {
      const lvl = clampDimmerValue(evt.target.value, currentLevel);
      updateDimmerSliderUI(slider, lvl);
      if (valueLabel) valueLabel.textContent = `${lvl}%`;
    });

    slider.addEventListener("change", (evt) => {
      const lvl = clampDimmerValue(evt.target.value, currentLevel);
      if (valueLabel) valueLabel.textContent = `${lvl}%`;

      const nextState = lvl > 0 ? "on" : "off";
      setRoomControlUI(controlEl, nextState);
      controlEl.dataset.level = lvl;
      updateDimmerIconIntensity(controlEl, lvl);
      setStoredState(deviceId, nextState);
      recentCommands.set(deviceId, Date.now());

      sendHubitatCommand(deviceId, "setLevel", String(lvl))
        .then(() => {
          if (lvl === 0) return sendHubitatCommand(deviceId, "off");
          return null;
        })
        .catch((error) => {
          console.error(
            `⚠️Erro ao enviar nível ${lvl} para dimmer ${deviceId}:`,
            error,
          );
        });
    });
  }

  document.body.appendChild(overlay);
}

function togglePoolControl(el, action) {
  const deviceId = el.dataset.deviceId;
  if (!action || !deviceId) {
    console.error(" togglePoolControl: action ou deviceId ausente");
    return;
  }

  console.log(
    ` Enviando comando "${action}" para dispositivo piscina ${deviceId}`,
  );

  // Enviar comando para Hubitat
  sendHubitatCommand(deviceId, action)
    .then(() => {
      console.log(
        ` Comando "${action}" enviado com sucesso para dispositivo ${deviceId}`,
      );
    })
    .catch((error) => {
      console.error(
        ` Erro ao enviar comando para dispositivo ${deviceId}:`,
        error,
      );
    });
}
// ========================================
// CONTROLE DE PODER DA TV
// ========================================

let tvPowerState = "off"; // Estado inicial: desligado

function getActiveTvControlWrapper() {
  const activePage = document.querySelector(".page.active");
  if (activePage) {
    const scoped = activePage.querySelector(".tv-control-wrapper");
    if (scoped) {
      return scoped;
    }
  }
  return document.querySelector(".tv-control-wrapper");
}

function getActiveTvPowerDeviceId(wrapper = getActiveTvControlWrapper()) {
  if (!wrapper) return null;

  const powerButton = wrapper.querySelector(
    ".tv-btn--power-on[data-device-id], .tv-btn--power-off[data-device-id]",
  );
  if (powerButton?.dataset?.deviceId) {
    return String(powerButton.dataset.deviceId);
  }

  const fallbackWithId = wrapper.querySelector("[data-device-id]");
  return fallbackWithId?.dataset?.deviceId
    ? String(fallbackWithId.dataset.deviceId)
    : null;
}

function syncTVPowerStateFromStorage() {
  if (!isOnTVControlPage()) return;

  const wrapper = getActiveTvControlWrapper();
  if (!wrapper) return;

  const powerDeviceId = getActiveTvPowerDeviceId(wrapper);
  const nextState = powerDeviceId
    ? normalizeSwitchState(getStoredState(powerDeviceId), "off")
    : "off";

  updateTVPowerState(nextState, { wrapper });
  debugLog(() => ["syncTVPowerStateFromStorage", { powerDeviceId, nextState }]);
}

function updateTVPowerState(newState, options = {}) {
  const normalizedState = normalizeSwitchState(newState, "off");
  tvPowerState = normalizedState;
  document.body.classList.toggle("tv-controls-on", normalizedState === "on");
  document.body.classList.toggle("tv-controls-off", normalizedState !== "on");
  const wrapper = options?.wrapper || getActiveTvControlWrapper();
  if (wrapper) {
    wrapper.setAttribute("data-power-state", normalizedState);
  }

  if (!wrapper) return;

  // Selecionar botões ON e OFF
  const btnOn = wrapper.querySelector(".tv-btn--power-on");
  const btnOff = wrapper.querySelector(".tv-btn--power-off");

  // Selecionar todos os outros controles (incluindo música e volume)
  const otherControls = wrapper.querySelectorAll(
    ".tv-control-section:not(.tv-control-section--power), .tv-volume-canais-wrapper, .tv-commands-grid, .tv-directional-pad, .tv-numpad, .tv-favorites-list, .tv-logo-section, .tv-control-mode-toggle, .tv-control-section--music, .tv-control-section--dpad, .tv-control-section--volume, .tv-control-section--media, .music-now-content, .music-album-container, .music-info, .tv-volume-slider-container, .tv-volume-slider, .tv-volume-value, .tv-portrait-tabs, .tv-portrait-tab",
  );
  const gestureIcons = wrapper.querySelectorAll(".tv-gesture-icons");
  const gestureSurface = wrapper.querySelectorAll(".tv-gesture-surface");

  // Selecionar títulos das seções de controle
  const titles = wrapper.querySelectorAll(
    ".tv-section-title, .tv-section-line",
  );

  // Selecionar seção de volume separadamente (coluna 2)
  const volumeSection = wrapper.querySelectorAll(
    ".tv-col-2 > .tv-control-section",
  );

  if (normalizedState === "on") {
    // TV ligada
    btnOn?.classList.add("active");
    btnOff?.classList.remove("active");

    // Mostrar outros controles
    otherControls.forEach((control) => {
      control.style.opacity = "1";
      control.style.pointerEvents = "auto";
    });
    gestureIcons.forEach((control) => {
      control.style.opacity = "";
      control.style.pointerEvents = "none";
    });
    gestureSurface.forEach((control) => {
      control.style.opacity = "";
      control.style.pointerEvents = "";
    });
    volumeSection.forEach((control) => {
      control.style.opacity = "1";
      control.style.pointerEvents = "auto";
    });

    // Mostrar títulos
    titles.forEach((title) => {
      title.style.opacity = "1";
    });

    console.log("📺 TV LIGADA - Controles visíveis");
  } else {
    // TV desligada - opacidade 30% (0.3)
    btnOff?.classList.add("active");
    btnOn?.classList.remove("active");

    // Escurecer e desabilitar outros controles
    otherControls.forEach((control) => {
      control.style.opacity = "0.3";
      control.style.pointerEvents = "none";
    });
    gestureIcons.forEach((control) => {
      control.style.opacity = "0.3";
      control.style.pointerEvents = "none";
    });
    gestureSurface.forEach((control) => {
      control.style.opacity = "0.3";
      control.style.pointerEvents = "none";
    });
    volumeSection.forEach((control) => {
      control.style.opacity = "0.3";
      control.style.pointerEvents = "none";
    });

    // Apagar títulos
    titles.forEach((title) => {
      title.style.opacity = "0.3";
    });

    console.log("📺 TV DESLIGADA - Controles desabilitados");
  }
}

// Controle de TV
function tvCommand(el, command) {
  const deviceId = el.dataset.deviceId;
  if (!command || !deviceId) return;
  const wrapper = el.closest?.(".tv-control-wrapper");

  if (command === "mute") {
    const slider = document.getElementById("tv-volume-slider");
    if (slider) {
      slider.value = "0";
      slider.dispatchEvent(new Event("input", { bubbles: true }));
      slider.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return;
  }

  // Alguns controles precisam disparar comando duplo (ex.: Claro TV: returnButton + voltar)
  const commandsToSend = [command];
  const controlType = String(
    wrapper?.dataset?.deviceType || wrapper?.dataset?.controlType || "",
  ).toLowerCase();
  const isClaroTv = controlType === "clarotv";
  if (isClaroTv && command === "returnButton") {
    commandsToSend.push("voltar");
  }

  // Controlar estado de poder
  let optimisticPowerState = null;
  if (command === "on" || command === "powerOn") {
    optimisticPowerState = "on";
    updateTVPowerState("on", { wrapper });
  } else if (command === "off" || command === "powerOff") {
    optimisticPowerState = "off";
    updateTVPowerState("off", { wrapper });
  }

  if (optimisticPowerState) {
    setStoredState(deviceId, optimisticPowerState);
  }

  // Home Theater: ao ligar, chavear receiver e HDMI conforme controle
  if (command === "on" || command === "powerOn") {
    const route = (window.location.hash || "").replace("#", "");
    const envKey = route.split("-")[0] || "";
    const mediaControlTypes = ["tv", "appletv", "clarotv", "bluray"];
    if (envKey === "ambiente1" && mediaControlTypes.includes(controlType)) {
      const receiverId =
        getConfiguredEnvironmentBinding(envKey, controlType, "receiver") ||
        getConfiguredEnvironmentControlId(envKey, "receiver", "");
      const tvId =
        getConfiguredEnvironmentBinding(envKey, controlType, "display") ||
        getConfiguredEnvironmentBinding(envKey, "tv", "display", "");
      const inputByType = {
        clarotv: "DVD",
        appletv: "GAME",
        bluray: "BD",
        tv: "TV",
      };
      const input = inputByType[controlType];

      // Macro Home Theater: ligar Denon junto com qualquer mídia.
      if (receiverId) {
        sendHubitatCommand(receiverId, "on").catch(() => {});
      }

      if (input && receiverId) {
        window.setTimeout(() => {
          sendHubitatCommand(receiverId, "setInputSource", input).catch(
            () => {},
          );
        }, 350);
        if (controlType !== "tv") {
          sendHubitatCommand(tvId, "hdmi3").catch(() => {});
        }
      }
    }

    // Varanda: macros específicas ao ligar TV/Roku.
    if (
      envKey === "ambiente3" &&
      (controlType === "tv" || controlType === "roku")
    ) {
      const varandaTvId =
        getConfiguredEnvironmentBinding(envKey, "tv", "power", "") ||
        getConfiguredEnvironmentBinding(envKey, "tv", "id", "");
      const varandaDenonId =
        getConfiguredEnvironmentBinding(envKey, "music", "power", "") ||
        getConfiguredEnvironmentControlId(envKey, "screenReceiver", "");

      if (varandaTvId) {
        sendHubitatCommand(varandaTvId, "on").catch(() => {});
      }

      if (controlType === "roku") {
        if (varandaDenonId) {
          sendHubitatCommand(varandaDenonId, "mediaplayer").catch(() => {});
        }
        if (varandaTvId) {
          sendHubitatCommand(varandaTvId, "hdmi3").catch(() => {});
        }
      }

      if (controlType === "tv" && varandaDenonId) {
        sendHubitatCommand(varandaDenonId, "tvAudio").catch(() => {});
      }
    }
  }

  // Feedback visual (preserva transform base quando existir)
  const computedTransform = window.getComputedStyle(el).transform;
  const baseTransform = computedTransform !== "none" ? computedTransform : "";
  el.style.transform = baseTransform
    ? `${baseTransform} scale(0.99)`
    : "scale(0.99)";
  el.style.background = "rgba(255, 255, 255, 0.15)";
  el.style.borderColor = "rgba(255, 255, 255, 0.3)";
  setTimeout(() => {
    el.style.transform = "";
    el.style.background = "";
    el.style.borderColor = "";
  }, 200);

  // Marcar comando recente
  recentCommands.set(deviceId, Date.now());

  commandsToSend.forEach((cmd) => {
    console.log(`📺 Enviando comando ${cmd} para dispositivo ${deviceId}`);

    // Enviar para Hubitat
    sendHubitatCommand(deviceId, cmd)
      .then(() => {
        console.log(
          `✅ Comando TV ${cmd} enviado com sucesso para dispositivo ${deviceId}`,
        );
      })
      .catch((error) => {
        console.error(
          `❌ Erro ao enviar comando TV para dispositivo ${deviceId}:`,
          error,
        );
      });
  });
}

function toggleClaroTvPanel(trigger, targetView) {
  const view = targetView === "favorites" ? "favorites" : "numbers";
  const wrapper = trigger?.closest?.(".tv-control-wrapper");
  if (!wrapper) return;
  const controlType = String(
    wrapper.dataset.deviceType || wrapper.dataset.controlType || "",
  ).toLowerCase();
  const panelLabels =
    controlType === "roku"
      ? { favorites: "Apps", numbers: "Comandos" }
      : { favorites: "Favoritos", numbers: "Números" };

  const panel = wrapper.querySelector(".tv-control-section[data-claro-panel]");
  if (!panel) return;

  const currentView = panel.dataset.claroPanel || "numbers";
  if (currentView === view) return;

  const fade = panel.querySelector("[data-claro-fade]");
  const title = panel.querySelector("[data-claro-panel-title]");
  const buttons = wrapper.querySelectorAll("[data-claro-panel-btn]");

  const applyView = () => {
    panel.dataset.claroPanel = view;
    if (title) {
      title.textContent =
        view === "favorites" ? panelLabels.favorites : panelLabels.numbers;
    }

    buttons.forEach((btn) => {
      const isActive = btn.dataset.claroPanelBtn === view;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  };

  if (!fade) {
    applyView();
    return;
  }

  if (fade.dataset.fadeBusy === "true") return;
  fade.dataset.fadeBusy = "true";
  fade.classList.add("is-fading");

  window.setTimeout(() => {
    applyView();
    fade.classList.remove("is-fading");
  }, 200);

  window.setTimeout(() => {
    fade.dataset.fadeBusy = "";
  }, 400);
}

function setTvPortraitPanel(trigger, panel) {
  const wrapper = trigger?.closest?.(".tv-control-wrapper");
  if (!wrapper) return;

  const nextPanel = String(panel || "control");
  wrapper.dataset.portraitPanel = nextPanel;

  const tabs = wrapper.querySelectorAll(".tv-portrait-tab");
  tabs.forEach((tab) => {
    const isActive = tab.dataset.target === nextPanel;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  const favoriteBtn = wrapper.querySelector(".tv-portrait-favorite");
  if (favoriteBtn) {
    favoriteBtn.classList.toggle("is-active", nextPanel === "favorites");
  }
}

function setClaroTvPortraitPanel(trigger, panel) {
  setTvPortraitPanel(trigger, panel);
}

function positionAppleTvModeIndicator(section) {
  if (!section) return;
  const toggle = section.querySelector(".tv-control-mode-toggle");
  if (!toggle) return;
  const indicator = toggle.querySelector(".tv-control-mode-indicator");
  if (!indicator) return;
  const activeBtn =
    toggle.querySelector(".tv-control-mode-btn.is-active") ||
    toggle.querySelector(".tv-control-mode-btn");
  if (!activeBtn) return;

  const toggleRect = toggle.getBoundingClientRect();
  const btnRect = activeBtn.getBoundingClientRect();
  if (!toggleRect.width || !btnRect.width) return;

  const left = btnRect.left - toggleRect.left;
  const top = btnRect.top - toggleRect.top;
  indicator.style.left = `${left}px`;
  indicator.style.top = `${top}px`;
  indicator.style.width = `${btnRect.width}px`;
  indicator.style.height = `${btnRect.height}px`;
  indicator.style.bottom = "auto";
}

function syncAppleTvControlMode(section) {
  if (!section) return;
  const mode = section.dataset.controlMode || "cursor";
  section.dataset.controlMode = mode;

  const toggle = section.querySelector(".tv-control-mode-toggle");
  if (toggle) {
    toggle.dataset.mode = mode;
  }

  const buttons = section.querySelectorAll(".tv-control-mode-btn");
  buttons.forEach((btn) => {
    const isActive = btn.dataset.mode === mode;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  window.requestAnimationFrame(() => {
    positionAppleTvModeIndicator(section);
  });
}

function initAppleTvGestureControls(root = document) {
  const sections = root.querySelectorAll(
    ".tv-control-wrapper .tv-control-section--dpad",
  );

  sections.forEach((section) => {
    if (section.dataset.gestureInit === "true") {
      syncAppleTvControlMode(section);
      return;
    }

    const surface = section.querySelector(".tv-gesture-surface");
    if (!surface) return;

    const buttons = {
      up: section.querySelector(".tv-directional-btn--up"),
      down: section.querySelector(".tv-directional-btn--down"),
      left: section.querySelector(".tv-directional-btn--left"),
      right: section.querySelector(".tv-directional-btn--right"),
      center: section.querySelector(".tv-directional-btn--ok"),
    };
    const wrapper = section.closest(".tv-control-wrapper");
    const controlType = String(
      wrapper?.dataset?.deviceType || wrapper?.dataset?.controlType || "",
    ).toLowerCase();
    const centerCommand = controlType === "roku" ? "cursorOK" : "cursorCenter";

    const sendCommand = (command, btn) => {
      if (btn) {
        tvCommand(btn, command);
        return;
      }

      const deviceId = section.dataset.deviceId;
      if (!deviceId) return;
      sendHubitatCommand(deviceId, command).catch(() => {});
    };

    const threshold = 24;
    let startX = 0;
    let startY = 0;
    let moved = false;
    let pointerId = null;

    const resetGesture = () => {
      startX = 0;
      startY = 0;
      moved = false;
      pointerId = null;
    };

    const isGesturesMode = () => section.dataset.controlMode === "gestures";

    surface.addEventListener("pointerdown", (e) => {
      if (!isGesturesMode()) return;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      moved = false;
      surface.setPointerCapture(pointerId);
    });

    surface.addEventListener("pointermove", (e) => {
      if (!isGesturesMode() || pointerId !== e.pointerId || moved) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.hypot(dx, dy) < threshold) return;
      moved = true;

      if (Math.abs(dx) > Math.abs(dy)) {
        sendCommand(
          dx > 0 ? "cursorRight" : "cursorLeft",
          dx > 0 ? buttons.right : buttons.left,
        );
      } else {
        sendCommand(
          dy > 0 ? "cursorDown" : "cursorUp",
          dy > 0 ? buttons.down : buttons.up,
        );
      }
    });

    surface.addEventListener("pointerup", (e) => {
      if (pointerId !== e.pointerId) return;
      if (isGesturesMode() && !moved) {
        sendCommand(centerCommand, buttons.center);
      }
      resetGesture();
    });

    surface.addEventListener("pointercancel", resetGesture);

    section.dataset.gestureInit = "true";
    syncAppleTvControlMode(section);
  });

  if (!window.__APPLE_TV_TOGGLE_RESIZE__) {
    window.__APPLE_TV_TOGGLE_RESIZE__ = true;
    window.addEventListener("resize", () => {
      document
        .querySelectorAll(".tv-control-wrapper .tv-control-section--dpad")
        .forEach((section) => syncAppleTvControlMode(section));
    });
  }
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".tv-control-mode-btn");
  if (!btn) return;
  const section = btn.closest(".tv-control-section--dpad");
  if (!section) return;
  const mode = btn.dataset.mode;
  if (!mode) return;
  if (section.dataset.controlMode === mode) return;
  section.dataset.controlMode = mode;
  syncAppleTvControlMode(section);
});

// Macro para ligar HTV + TV + Receiver de uma vez

function getHomeTheaterControlIds() {
  return {
    tvControlId:
      getConfiguredEnvironmentControlId("ambiente1", "tvControl") ||
      getConfiguredEnvironmentBinding("ambiente1", "tv", "power", ""),
    tvDisplayId: getConfiguredEnvironmentBinding(
      "ambiente1",
      "tv",
      "display",
      "",
    ),
    receiverId:
      getConfiguredEnvironmentControlId("ambiente1", "receiver", "") ||
      getConfiguredEnvironmentBinding("ambiente1", "tv", "receiver", ""),
  };
}

function getPoolScreenControlIds() {
  return {
    screenId:
      getConfiguredEnvironmentControlId("ambiente3", "screen") ||
      getLegacyConfiguredId("piscinaTelao", "screen", ""),
    receiverId:
      getConfiguredEnvironmentControlId("ambiente3", "screenReceiver") ||
      getLegacyConfiguredId("piscinaTelao", "receiver", ""),
  };
}

function getLegacySuiteTvId(groupKey, fallback) {
  return getLegacyConfiguredId(groupKey, "tv", fallback);
}

// Macro para ligar TV e Receiver e setar input SAT/CBL
function htvMacroOn() {
  const { tvControlId: TV_ID, receiverId: RECEIVER_ID } =
    getHomeTheaterControlIds();

  console.log(
    "🎬 Macro HTV: Inicializando, ligando TV, setando HDMI 2 e input SAT/CBL...",
  );

  // Inicializa TV primeiro
  sendHubitatCommand(TV_ID, "initialize")
    .then(() => {
      console.log("✅ TV inicializada");
      // Liga TV (ou confirma que está ligada)
      return sendHubitatCommand(TV_ID, "on");
    })
    .then(() => {
      console.log("✅ TV ligada");
      // Seta HDMI 2 na TV
      return sendHubitatCommand(TV_ID, "hdmi2");
    })
    .then(() => {
      console.log("✅ HDMI 2 selecionado na TV");
      console.log("⏳ Aguardando 4 segundos antes de setar input SAT/CBL...");
      // Aguardar 4 segundos antes de setar input SAT/CBL
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(sendHubitatCommand(RECEIVER_ID, "setInputSource", "SAT/CBL"));
        }, 4000);
      });
    })
    .then(() => {
      console.log("✅ Input SAT/CBL selecionado no Receiver");
    })
    .catch((error) => {
      console.error("❌ Erro na macro HTV:", error);
      // Mesmo com erro, tentar setar o input (caso TV já esteja ligada)
      console.log("🔄 Tentando setar input SAT/CBL mesmo com erro anterior...");
      sendHubitatCommand(RECEIVER_ID, "setInputSource", "SAT/CBL")
        .then(() =>
          console.log("✅ Input SAT/CBL selecionado no Receiver (recuperação)"),
        )
        .catch((err) => console.error("❌ Erro ao setar input:", err));
    });
}

// Versão anterior da função (mantida para referência)
function htvMacroOn_old() {
  const { tvControlId: TV_ID, receiverId: RECEIVER_ID } =
    getHomeTheaterControlIds();

  console.log("🎬 Macro HTV: Ligando TV, setando HDMI 2 e input SAT/CBL...");

  // Liga TV (ou confirma que está ligada)
  sendHubitatCommand(TV_ID, "on")
    .then(() => {
      console.log("✅ TV ligada");
      // Seta HDMI 2 na TV
      return sendHubitatCommand(TV_ID, "hdmi2");
    })
    .then(() => {
      console.log("✅ HDMI 2 selecionado na TV");
      console.log("⏳ Aguardando 4 segundos antes de setar input SAT/CBL...");
      // Aguardar 4 segundos antes de setar input SAT/CBL
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(sendHubitatCommand(RECEIVER_ID, "setInputSource", "SAT/CBL"));
        }, 4000);
      });
    })
    .then(() => {
      console.log("✅ Input SAT/CBL selecionado no Receiver");
    })
    .catch((error) => {
      console.error("❌ Erro na macro HTV:", error);
      // Mesmo com erro, tentar setar o input (caso TV já esteja ligada)
      console.log("🔄 Tentando setar input SAT/CBL mesmo com erro anterior...");
      sendHubitatCommand(RECEIVER_ID, "setInputSource", "SAT/CBL")
        .then(() =>
          console.log("✅ Input SAT/CBL selecionado no Receiver (recuperação)"),
        )
        .catch((err) => console.error("❌ Erro ao setar input:", err));
    });
}

// Macro para ligar Telão da Piscina
function telaoMacroOn() {
  const { screenId: TELAO_ID, receiverId: RECEIVER_ID } =
    getPoolScreenControlIds();

  console.log("🎬 Macro Telão: Ligando Telão e setando input SAT/CBL...");

  // Liga Telão e seta input SAT/CBL no receiver
  Promise.all([
    sendHubitatCommand(TELAO_ID, "on"),
    sendHubitatCommand(RECEIVER_ID, "setInputSource", "SAT/CBL"),
  ])
    .then(() => {
      console.log("✅ Telão ligado e input SAT/CBL selecionado");
    })
    .catch((error) => {
      console.error("❌ Erro na macro Telão:", error);
    });
}

function telaoMacroOff() {
  const { screenId: TELAO_ID, receiverId: RECEIVER_ID } =
    getPoolScreenControlIds();

  console.log("🎬 Macro Telão: Desligando telão e receiver...");

  Promise.all([
    sendHubitatCommand(TELAO_ID, "off"),
    sendHubitatCommand(RECEIVER_ID, "off"),
  ])
    .then(() => {
      console.log("✅ Telão e receiver desligados");
    })
    .catch((error) => {
      console.error("❌ Erro ao desligar Telão:", error);
    });
}

// Macro para desligar TV e Receiver
function htvMacroOff() {
  const { tvControlId: TV_ID, receiverId: RECEIVER_ID } =
    getHomeTheaterControlIds();

  console.log("🎬 Macro HTV: Desligando TV e Receiver...");

  Promise.all([
    sendHubitatCommand(TV_ID, "off"),
    sendHubitatCommand(RECEIVER_ID, "off"),
  ])
    .then(() => {
      console.log("✅ TV e Receiver desligados");
    })
    .catch((error) => {
      console.error("❌ Erro ao desligar TV/Receiver:", error);
    });
}

// ============================================
// MACROS SUÍTE MASTER (sem Receiver)
// ============================================

// Macro para ligar HTV Suíte Master: Liga TV, aguarda 3s, seleciona HDMI2
function suiteMasterHtvOn() {
  const TV_ID = getLegacySuiteTvId("suiteMaster", "");

  console.log("🎬 Macro Suíte Master HTV: Ligando TV e selecionando HDMI2...");

  sendHubitatCommand(TV_ID, "on")
    .then(() => {
      console.log("✅ TV Suíte Master ligada");
      console.log("⏳ Aguardando 3 segundos antes de selecionar HDMI2...");
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(sendHubitatCommand(TV_ID, "hdmi2"));
        }, 3000);
      });
    })
    .then(() => {
      console.log("✅ HDMI2 selecionado na TV Suíte Master");
    })
    .catch((error) => {
      console.error("❌ Erro na macro Suíte Master HTV:", error);
    });
}

// Macro para desligar HTV Suíte Master: Apenas desliga TV
function suiteMasterHtvOff() {
  const TV_ID = getLegacySuiteTvId("suiteMaster", "");

  console.log("🎬 Macro Suíte Master HTV: Desligando TV...");

  sendHubitatCommand(TV_ID, "off")
    .then(() => {
      console.log("✅ TV Suíte Master desligada");
    })
    .catch((error) => {
      console.error("❌ Erro ao desligar TV Suíte Master:", error);
    });
}

// Macro para ligar TV Suíte Master: Apenas liga TV (apps internos)
function suiteMasterTvOn() {
  const TV_ID = getLegacySuiteTvId("suiteMaster", "");

  console.log("🎬 Macro Suíte Master TV: Ligando TV...");

  sendHubitatCommand(TV_ID, "on")
    .then(() => {
      console.log("✅ TV Suíte Master ligada");
    })
    .catch((error) => {
      console.error("❌ Erro ao ligar TV Suíte Master:", error);
    });
}

// Macro para desligar TV Suíte Master: Apenas desliga TV
function suiteMasterTvOff() {
  const TV_ID = getLegacySuiteTvId("suiteMaster", "");

  console.log("🎬 Macro Suíte Master TV: Desligando TV...");

  sendHubitatCommand(TV_ID, "off")
    .then(() => {
      console.log("✅ TV Suíte Master desligada");
    })
    .catch((error) => {
      console.error("❌ Erro ao desligar TV Suíte Master:", error);
    });
}

// ============================================
// MACROS SUÍTE I (sem Receiver)
// ============================================

// Macro para ligar HTV Suíte I: Liga TV, aguarda 3s, seleciona HDMI2
function suite1HtvOn() {
  const TV_ID = getLegacySuiteTvId("suite1", "");

  console.log("🎬 Macro Suíte I HTV: Ligando TV e selecionando HDMI2...");

  sendHubitatCommand(TV_ID, "on")
    .then(() => {
      console.log("✅ TV Suíte I ligada");
      console.log("⏳ Aguardando 3 segundos antes de selecionar HDMI2...");
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(sendHubitatCommand(TV_ID, "hdmi2"));
        }, 3000);
      });
    })
    .then(() => {
      console.log("✅ HDMI2 selecionado na TV Suíte I");
    })
    .catch((error) => {
      console.error("❌ Erro na macro Suíte I HTV:", error);
    });
}

// Macro para desligar HTV Suíte I: Apenas desliga TV
function suite1HtvOff() {
  const TV_ID = getLegacySuiteTvId("suite1", "");

  console.log("🎬 Macro Suíte I HTV: Desligando TV...");

  sendHubitatCommand(TV_ID, "off")
    .then(() => {
      console.log("✅ TV Suíte I desligada");
    })
    .catch((error) => {
      console.error("❌ Erro ao desligar TV Suíte I:", error);
    });
}

// Macro para ligar TV Suíte I: Apenas liga TV (apps internos)
function suite1TvOn() {
  const TV_ID = getLegacySuiteTvId("suite1", "");

  console.log("🎬 Macro Suíte I TV: Ligando TV...");

  sendHubitatCommand(TV_ID, "on")
    .then(() => {
      console.log("✅ TV Suíte I ligada");
    })
    .catch((error) => {
      console.error("❌ Erro ao ligar TV Suíte I:", error);
    });
}

// Macro para desligar TV Suíte I: Apenas desliga TV
function suite1TvOff() {
  const TV_ID = getLegacySuiteTvId("suite1", "");

  console.log("🎬 Macro Suíte I TV: Desligando TV...");

  sendHubitatCommand(TV_ID, "off")
    .then(() => {
      console.log("✅ TV Suíte I desligada");
    })
    .catch((error) => {
      console.error("❌ Erro ao desligar TV Suíte I:", error);
    });
}

// ============================================
// MACROS SUÍTE II (sem Receiver)
// ============================================

// Macro para ligar HTV Suíte II: Liga TV, aguarda 3s, seleciona HDMI2
function suite2HtvOn() {
  const TV_ID = getLegacySuiteTvId("suite2", "");

  console.log("🎬 Macro Suíte II HTV: Ligando TV e selecionando HDMI2...");

  sendHubitatCommand(TV_ID, "on")
    .then(() => {
      console.log("✅ TV Suíte II ligada");
      console.log("⏳ Aguardando 3 segundos antes de selecionar HDMI2...");
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(sendHubitatCommand(TV_ID, "hdmi2"));
        }, 3000);
      });
    })
    .then(() => {
      console.log("✅ HDMI2 selecionado na TV Suíte II");
    })
    .catch((error) => {
      console.error("❌ Erro na macro Suíte II HTV:", error);
    });
}

// Macro para desligar HTV Suíte II: Apenas desliga TV
function suite2HtvOff() {
  const TV_ID = getLegacySuiteTvId("suite2", "");

  console.log("🎬 Macro Suíte II HTV: Desligando TV...");

  sendHubitatCommand(TV_ID, "off")
    .then(() => {
      console.log("✅ TV Suíte II desligada");
    })
    .catch((error) => {
      console.error("❌ Erro ao desligar TV Suíte II:", error);
    });
}

// Macro para ligar TV Suíte II: Apenas liga TV (apps internos)
function suite2TvOn() {
  const TV_ID = getLegacySuiteTvId("suite2", "");

  console.log("🎬 Macro Suíte II TV: Ligando TV...");

  sendHubitatCommand(TV_ID, "on")
    .then(() => {
      console.log("✅ TV Suíte II ligada");
    })
    .catch((error) => {
      console.error("❌ Erro ao ligar TV Suíte II:", error);
    });
}

// Macro para desligar TV Suíte II: Apenas desliga TV
function suite2TvOff() {
  const TV_ID = getLegacySuiteTvId("suite2", "");

  console.log("🎬 Macro Suíte II TV: Desligando TV...");

  sendHubitatCommand(TV_ID, "off")
    .then(() => {
      console.log("✅ TV Suíte II desligada");
    })
    .catch((error) => {
      console.error("❌ Erro ao desligar TV Suíte II:", error);
    });
}

// ============================================

// Macro para ligar TV + Receiver de uma vez

// Macro para ligar TV e Receiver e setar input TV
function tvMacroOn() {
  const { tvControlId: TV_ID, receiverId: RECEIVER_ID } =
    getHomeTheaterControlIds();

  console.log("🎬 Macro TV: Ligando TV, depois setando input TV...");

  // Liga TV
  sendHubitatCommand(TV_ID, "on")
    .then(() => {
      console.log("✅ TV ligada");
      console.log("⏳ Aguardando 4 segundos antes de setar input TV...");
      // Aguardar 4 segundos antes de setar input TV
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(sendHubitatCommand(RECEIVER_ID, "setInputSource", "TV"));
        }, 4000);
      });
    })
    .then(() => {
      console.log("✅ Input TV selecionado no Receiver");
    })
    .catch((error) => {
      console.error("❌ Erro na macro TV:", error);
    });
}

// Macro para desligar TV e Receiver
function tvMacroOff() {
  const { tvControlId: TV_ID, receiverId: RECEIVER_ID } =
    getHomeTheaterControlIds();

  console.log("🎬 Macro TV: Desligando TV e Receiver...");

  Promise.all([
    sendHubitatCommand(TV_ID, "off"),
    sendHubitatCommand(RECEIVER_ID, "off"),
  ])
    .then(() => {
      console.log("✅ TV e Receiver desligados");
    })
    .catch((error) => {
      console.error("❌ Erro ao desligar TV/Receiver:", error);
    });
}

// Macro para ativar Fire TV (HDMI 2 + BD no Receiver)
function fireTVMacro() {
  const { tvControlId: TV_ID, receiverId: RECEIVER_ID } =
    getHomeTheaterControlIds();

  console.log(
    "🎬 Macro Fire TV: Selecionando HDMI 2 e setando Receiver para BD...",
  );

  // Enviar comando HDMI 2 para TV
  sendHubitatCommand(TV_ID, "hdmi2")
    .then(() => {
      console.log("✅ HDMI 2 selecionado na TV");
      // Setar input BD no Receiver
      return sendHubitatCommand(RECEIVER_ID, "setInputSource", "BD");
    })
    .then(() => {
      console.log("✅ Input BD selecionado no Receiver");
    })
    .catch((error) => {
      console.error("❌ Erro na macro Fire TV:", error);
    });
}

// Controle do Slider de Volume
function initVolumeSlider() {
  const slider = document.getElementById("tv-volume-slider");
  const display = document.getElementById("tv-volume-display");
  const DENON_DEVICE_ID = getDenonCommandDeviceIdForCurrentRoute();

  if (!slider || !display) {
    console.log("⚠️ Slider ou display não encontrado");
    return;
  }

  console.log("🎚️ Inicializando slider de volume do Denon AVR");

  // Definir o device ID no slider
  slider.dataset.deviceId = DENON_DEVICE_ID;

  // Remover event listeners antigos para evitar duplicação
  const newSlider = slider.cloneNode(true);
  slider.parentNode.replaceChild(newSlider, slider);

  // Pegar referência ao novo slider
  const updatedSlider = document.getElementById("tv-volume-slider");

  // Buscar volume atual do Denon e atualizar o slider
  updateDenonVolumeFromServer();

  // Atualizar display quando slider mudar
  updatedSlider.addEventListener("input", (e) => {
    const value = e.target.value;
    const max = e.target.max || 100;
    const percentage = (value / max) * 100;

    display.textContent = value;
    updatedSlider.style.setProperty("--volume-progress", percentage + "%");

    console.log(
      `🎚️ Volume display atualizado: ${value} (${percentage.toFixed(1)}%)`,
    );
  });

  // Enviar comando ao soltar o slider
  updatedSlider.addEventListener("change", (e) => {
    const value = e.target.value;

    console.log(`🔊 Volume alterado para: ${value} - enviando para Denon AVR`);

    // Enviar comando setVolume para o Denon AVR
    recentCommands.set(String(DENON_DEVICE_ID), Date.now());
    sendHubitatCommand(DENON_DEVICE_ID, "setVolume", value)
      .then(() => {
        console.log(`✅ Volume do Denon definido para ${value}`);
      })
      .catch((error) => {
        console.error(`⚠️Erro ao definir volume do Denon:`, error);
      });
  });

  console.log("✅ Slider de volume do Denon AVR inicializado com sucesso");
}

// Função para atualizar o volume do Denon a partir do servidor
async function updateDenonVolumeFromServer() {
  const DENON_DEVICE_ID = getDenonCommandDeviceIdForCurrentRoute();
  const tvSlider = document.getElementById("tv-volume-slider");
  const tvDisplay = document.getElementById("tv-volume-display");
  const musicSlider =
    typeof queryActiveMusic === "function"
      ? queryActiveMusic("#music-volume-slider")
      : document.querySelector("#music-volume-slider");
  const musicDisplay =
    typeof queryActiveMusic === "function"
      ? queryActiveMusic("#music-volume-display")
      : document.querySelector("#music-volume-display");
  const musicIconHigh =
    typeof queryActiveMusic === "function"
      ? queryActiveMusic(".volume-icon-high")
      : document.querySelector(".volume-icon-high");
  const musicIconLow =
    typeof queryActiveMusic === "function"
      ? queryActiveMusic(".volume-icon-low")
      : document.querySelector(".volume-icon-low");
  const musicIconMuted =
    typeof queryActiveMusic === "function"
      ? queryActiveMusic(".volume-icon-muted")
      : document.querySelector(".volume-icon-muted");

  try {
    if (isHubitatBypassMode()) {
      debugLog(() => ["updateDenonVolumeFromServer skipped (Hubitat bypass)"]);
      return;
    }

    const pollingUrl = isProduction
      ? `${POLLING_URL}?devices=${DENON_DEVICE_ID}`
      : null;

    if (!pollingUrl) {
      console.log("⚠️não é possível buscar volume em desenvolvimento");
      return;
    }

    const response = await fetch(pollingUrl);
    if (!response.ok) throw new Error(`Polling failed: ${response.status}`);

    const data = await response.json();

    // Processar resposta para pegar o volume e o estado de energia
    let volume = null;
    let powerState = null;

    if (data.devices && data.devices[DENON_DEVICE_ID]) {
      const devicePayload = data.devices[DENON_DEVICE_ID];
      volume =
        devicePayload.volume ??
        devicePayload.level ??
        (devicePayload.attributes && devicePayload.attributes.volume);
      powerState = getDenonPowerStateFromDevice(devicePayload);
    } else if (Array.isArray(data.data)) {
      const denonData = data.data.find((d) => String(d.id) === DENON_DEVICE_ID);
      if (denonData) {
        if (denonData.attributes) {
          if (Array.isArray(denonData.attributes)) {
            const volumeAttr = denonData.attributes.find(
              (attr) => attr?.name === "volume",
            );
            volume =
              volumeAttr?.currentValue ??
              volumeAttr?.value ??
              denonData.volume ??
              volume;
          } else if (typeof denonData.attributes === "object") {
            volume = denonData.attributes.volume ?? denonData.volume ?? volume;
          }
        } else if (denonData.volume !== undefined) {
          volume = denonData.volume;
        }
        powerState = getDenonPowerStateFromDevice(denonData);
      }
    }

    if (volume !== null && volume !== undefined) {
      const volumeValue = parseInt(volume, 10);

      if (tvSlider) {
        const maxTv = parseInt(tvSlider.max || "100", 10);
        const percentageTv = (volumeValue / maxTv) * 100;
        tvSlider.value = volumeValue;
        tvSlider.style.setProperty("--volume-progress", percentageTv + "%");
      }

      if (tvDisplay) {
        tvDisplay.textContent = volumeValue;
      }

      if (musicSlider) {
        const maxMusic = parseInt(musicSlider.max || "100", 10);
        const percentageMusic = (volumeValue / maxMusic) * 100;
        musicSlider.value = volumeValue;
        musicSlider.style.setProperty(
          "--volume-percent",
          percentageMusic + "%",
        );
      }

      if (musicDisplay) {
        musicDisplay.textContent = volumeValue;
      }

      if (musicIconHigh && musicIconLow && musicIconMuted) {
        musicIconHigh.style.display = "none";
        musicIconLow.style.display = "none";
        musicIconMuted.style.display = "none";
        if (volumeValue === 0) {
          musicIconMuted.style.display = "block";
        } else if (volumeValue >= 50) {
          musicIconHigh.style.display = "block";
        } else {
          musicIconLow.style.display = "block";
        }
      }

      console.log("[Denon] Volume atualizado:", volumeValue);
    }

    if (powerState) {
      applyDenonPowerState(powerState, DENON_DEVICE_ID);
    }
  } catch (error) {
    console.error("⚠️Erro ao buscar volume do Denon:", error);
  }
}

// Função para atualizar a UI do volume do Denon (chamada pelo polling)
function updateDenonVolumeUI(
  volume,
  denonDeviceId = getDenonCommandDeviceIdForCurrentRoute(),
) {
  const resolvedDenonId = String(
    denonDeviceId || getDenonCommandDeviceIdForCurrentRoute(),
  );
  const tvSlider = document.getElementById("tv-volume-slider");
  const tvDisplay = document.getElementById("tv-volume-display");
  const musicSlider =
    typeof queryActiveMusic === "function"
      ? queryActiveMusic("#music-volume-slider")
      : document.querySelector("#music-volume-slider");
  const musicDisplay =
    typeof queryActiveMusic === "function"
      ? queryActiveMusic("#music-volume-display")
      : document.querySelector("#music-volume-display");
  const musicIconHigh =
    typeof queryActiveMusic === "function"
      ? queryActiveMusic(".volume-icon-high")
      : document.querySelector(".volume-icon-high");
  const musicIconLow =
    typeof queryActiveMusic === "function"
      ? queryActiveMusic(".volume-icon-low")
      : document.querySelector(".volume-icon-low");
  const musicIconMuted =
    typeof queryActiveMusic === "function"
      ? queryActiveMusic(".volume-icon-muted")
      : document.querySelector(".volume-icon-muted");

  debugLog(() => ["updateDenonVolumeUI chamada", { volume }]);

  if (!tvSlider && !musicSlider) {
    debugLog(() => "updateDenonVolumeUI: nenhum controle encontrado na página");
    return;
  }

  const volumeValue = parseInt(volume, 10);
  debugLog(() => [
    "updateDenonVolumeUI: estado atual",
    {
      recebido: volume,
      convertido: volumeValue,
      tvSlider: tvSlider ? tvSlider.value : "n/a",
      musicSlider: musicSlider ? musicSlider.value : "n/a",
    },
  ]);

  const lastCmd = recentCommands.get(resolvedDenonId);
  if (lastCmd && Date.now() - lastCmd < COMMAND_PROTECTION_MS) {
    debugLog(
      () => "updateDenonVolumeUI: comando manual recente, ignorando polling",
    );
    return;
  }

  let updated = false;

  if (tvSlider) {
    const currentTv = parseInt(tvSlider.value, 10);
    const maxTv = tvSlider.max || 100;
    const percentageTv = (volumeValue / maxTv) * 100;
    if (currentTv !== volumeValue) {
      tvSlider.value = volumeValue;
      tvSlider.style.setProperty("--volume-progress", percentageTv + "%");
      updated = true;
    }
    if (tvDisplay) {
      tvDisplay.textContent = volumeValue;
    }
  }

  if (musicSlider) {
    const currentMusic = parseInt(musicSlider.value, 10);
    const maxMusic = musicSlider.max || 100;
    const percentageMusic = (volumeValue / maxMusic) * 100;
    if (currentMusic !== volumeValue) {
      musicSlider.value = volumeValue;
      musicSlider.style.setProperty("--volume-percent", percentageMusic + "%");
      if (typeof updateVolumeBar === "function") updateVolumeBar();
      updated = true;
    }
  }

  if (musicDisplay) {
    musicDisplay.textContent = volumeValue;
  }

  if (musicIconHigh && musicIconLow && musicIconMuted) {
    musicIconHigh.style.display = "none";
    musicIconLow.style.display = "none";
    musicIconMuted.style.display = "none";
    if (volumeValue === 0) {
      musicIconMuted.style.display = "block";
    } else if (volumeValue >= 50) {
      musicIconHigh.style.display = "block";
    } else {
      musicIconLow.style.display = "block";
    }
  }

  if (updated) {
    debugLog(() => [
      "updateDenonVolumeUI: volume sincronizado",
      { volumeValue },
    ]);
  }
}

function normalizeDenonPowerState(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (["on", "1", "true", "online"].includes(normalized)) return "on";
  if (["off", "0", "false", "offline", "standby"].includes(normalized))
    return "off";
  return null;
}

function getDenonPowerStateFromDevice(device) {
  if (!device || typeof device !== "object") return null;

  const directCandidates = [
    device.switch,
    device.state,
    device.power,
    device.status,
  ];

  for (const candidate of directCandidates) {
    const normalized = normalizeDenonPowerState(candidate);
    if (normalized) return normalized;
  }

  const attrs = device.attributes;

  if (Array.isArray(attrs)) {
    for (const attr of attrs) {
      if (!attr) continue;
      const attrName = String(attr.name || attr.attribute || "").toLowerCase();
      if (!attrName) continue;
      if (["switch", "power", "status", "state"].includes(attrName)) {
        const normalized = normalizeDenonPowerState(
          attr.currentValue ?? attr.value,
        );
        if (normalized) return normalized;
      }
    }
  } else if (attrs && typeof attrs === "object") {
    const keys = ["switch", "power", "status", "state"];
    for (const key of keys) {
      if (key in attrs) {
        const normalized = normalizeDenonPowerState(attrs[key]);
        if (normalized) return normalized;
      }
    }
  }

  return null;
}

function applyDenonPowerState(
  rawState,
  denonDeviceId = getDenonCommandDeviceIdForCurrentRoute(),
) {
  const resolvedDenonId = String(
    denonDeviceId || getDenonCommandDeviceIdForCurrentRoute(),
  );
  const normalized = normalizeDenonPowerState(rawState);
  if (!normalized) return;

  if (typeof recentCommands !== "undefined") {
    const lastCmd = recentCommands.get(resolvedDenonId);
    if (lastCmd && Date.now() - lastCmd < COMMAND_PROTECTION_MS) {
      console.log(
        "[Denon] Ignorando sincronizacao de power por comando recente",
      );
      return;
    }
  }

  const desiredOn = normalized === "on";

  window.musicPlayerUI = window.musicPlayerUI || {};
  window.musicPlayerUI.currentPowerState = normalized;

  if (
    window.musicPlayerUI &&
    typeof window.musicPlayerUI.isPowerOn === "function" &&
    window.musicPlayerUI.isPowerOn() === desiredOn
  ) {
    return;
  }

  if (
    window.musicPlayerUI &&
    typeof window.musicPlayerUI.setPower === "function"
  ) {
    window.musicPlayerUI.setPower(desiredOn);
  }
}
// Inicializar estado ao carregar
document.addEventListener("DOMContentLoaded", () => {
  syncRemoteControlDeviceIds();
  syncTVPowerStateFromStorage();
  initVolumeSlider();
  initAppleTvGestureControls();
  ensureTopBarVisible();
  syncLedModeControls();

  // Re-inicializar quando a página mudar (para SPAs)
  window.addEventListener("hashchange", () => {
    setTimeout(() => {
      syncRemoteControlDeviceIds();
      syncTVPowerStateFromStorage();
      initVolumeSlider();
      initAppleTvGestureControls();
      ensureTopBarVisible();
      syncLedModeControls();
    }, 100);
  });

  window.addEventListener("resize", () => {
    ensureTopBarVisible();
  });

  window.addEventListener("orientationchange", () => {
    setTimeout(() => {
      ensureTopBarVisible();
    }, 100);
  });

  // Listener para inicialização de dispositivos por ambiente
  window.addEventListener("hashchange", () => {
    const newHash = window.location.hash;
    const envKey = getEnvironmentRouteFromHash(newHash);
    if (!envKey) return;
    console.log("🏠 [hashchange] Entrando no ambiente:", envKey);
    // Pequeno delay para garantir que a página carregou
    setTimeout(() => {
      initializeEnvironmentDevices(envKey);
    }, 500);
  });

  // Listener específico para página de música
  window.addEventListener("hashchange", () => {
    console.log("🎵 [hashchange] Hash mudou para:", window.location.hash);
    const isMusicActive = isMusicPageActive();
    console.log("🎵 [hashchange] isMusicPageActive:", isMusicActive);

    if (isMusicActive) {
      console.log("🎵 [hashchange] Iniciando player de música em 300ms...");
      setTimeout(() => {
        console.log("🎵 [hashchange] Executando initMusicPlayerUI...");
        initMusicPlayerUI();
        updateDenonMetadata();
        startMusicMetadataPolling();
      }, 300);
    } else {
      stopMusicMetadataPolling();
    }
  });
});

function setRoomControlUI(el, state) {
  if (!el || !el.dataset) return;

  const ICON_ON = resolveIconPath(
    (el && el.dataset && (el.dataset.iconOn || el.dataset.iconon)) ||
      "images/icons/icon-small-light-on.svg",
  );
  const ICON_OFF = resolveIconPath(
    (el && el.dataset && (el.dataset.iconOff || el.dataset.iconoff)) ||
      "images/icons/icon-small-light-off.svg",
  );
  const normalized = normalizeSwitchState(state);

  const ICON_BG = resolveIconPath(
    el.dataset.iconBg || el.dataset.iconbg || ICON_ON,
  );

  el.dataset.state = normalized;

  // Camada de contorno sempre em OFF para manter leitura consistente do desenho.
  const outlineIcon = el.querySelector(".control-icon-outline");
  if (outlineIcon && outlineIcon.getAttribute("src") !== ICON_OFF) {
    outlineIcon.setAttribute("src", ICON_OFF);
  }

  // Camada principal alterna entre ON/OFF (compatível com cards novos e legados).
  const mainIcon = getMainControlIcon(el);
  if (mainIcon) {
    const nextIcon = normalized === "on" ? ICON_ON : ICON_OFF;
    if (mainIcon.getAttribute("src") !== nextIcon) {
      mainIcon.setAttribute("src", nextIcon);
    }
    if (mainIcon.style.opacity) {
      mainIcon.style.opacity = "";
    }
  } else {
    debugLog(() => [
      "setRoomControlUI: icon not found",
      { classes: el.className },
    ]);
  }

  // Glow de fundo opcional para cards com layout em camadas.
  const bgIcon = el.querySelector(".control-icon-bg");
  if (bgIcon) {
    if (bgIcon.getAttribute("src") !== ICON_BG) {
      bgIcon.setAttribute("src", ICON_BG);
    }
    bgIcon.style.opacity = normalized === "on" ? "0.3" : "0";
  }

  syncLedModeControls();
}

function normalizeSwitchState(value, fallback = "off") {
  const fb = String(fallback || "off")
    .trim()
    .toLowerCase();
  const safeFallback = fb === "on" ? "on" : "off";

  if (value === undefined || value === null) {
    return safeFallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (normalized === "on" || normalized === "off") {
    return normalized;
  }
  if (normalized === "true" || normalized === "1") {
    return "on";
  }
  if (normalized === "false" || normalized === "0") {
    return "off";
  }

  return safeFallback;
}

function needsControlVisualSync(el, state) {
  if (!el || !el.dataset) return false;

  const normalizedState = normalizeSwitchState(state);
  const ICON_ON = resolveIconPath(
    el.dataset.iconOn ||
      el.dataset.iconon ||
      "images/icons/icon-small-light-on.svg",
  );
  const ICON_OFF = resolveIconPath(
    el.dataset.iconOff ||
      el.dataset.iconoff ||
      "images/icons/icon-small-light-off.svg",
  );

  const mainIcon = getMainControlIcon(el);
  if (mainIcon) {
    const expectedIcon = normalizedState === "on" ? ICON_ON : ICON_OFF;
    const currentIcon = mainIcon.getAttribute("src");
    if (currentIcon && currentIcon !== expectedIcon) {
      return true;
    }
  }

  const bgIcon = el.querySelector(".control-icon-bg");
  if (bgIcon) {
    const inlineOpacity = String(bgIcon.style.opacity || "").trim();
    if (
      normalizedState === "off" &&
      inlineOpacity !== "" &&
      inlineOpacity !== "0"
    ) {
      return true;
    }
    if (normalizedState === "on" && inlineOpacity === "0") {
      return true;
    }
  }

  return false;
}

function deviceStateKey(deviceId) {
  return `${DEVICE_STATE_STORAGE_PREFIX}${deviceId}`;
}

function getStoredState(deviceId) {
  if (deviceStateMemory.has(deviceId)) {
    return deviceStateMemory.get(deviceId);
  }

  if (deviceStateStorageDisabled) {
    return null;
  }

  try {
    const key = deviceStateKey(deviceId);
    const value = localStorage.getItem(key);

    if (value !== null && value !== undefined) {
      deviceStateMemory.set(deviceId, value);
    }

    return value;
  } catch (error) {
    debugLog(() => ["getStoredState fallback", deviceId, error]);
    return null;
  }
}

function setStoredState(deviceId, state, options = {}) {
  const normalizedDeviceId = String(deviceId);
  const source = String(options?.source || "local");

  deviceStateMemory.set(normalizedDeviceId, state);

  if (!deviceStateStorageDisabled) {
    const key = deviceStateKey(normalizedDeviceId);

    try {
      localStorage.setItem(key, state);
      deviceStateQuotaErrors = 0;
    } catch (error) {
      if (isQuotaExceededError(error)) {
        handleDeviceStateQuotaError(normalizedDeviceId, key, state, error);
      } else {
        console.warn(`Erro ao salvar estado ${normalizedDeviceId}:`, error);
      }
    }
  }

  publishStoredStateToMqtt(normalizedDeviceId, state, { source });
}

function isQuotaExceededError(error) {
  if (!error) return false;
  return (
    error.name === "QuotaExceededError" ||
    error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    error.code === 22 ||
    error.code === 1014
  );
}

function handleDeviceStateQuotaError(deviceId, key, state, error) {
  if (deviceStateStorageDisabled) {
    return;
  }

  if (!deviceStateQuotaWarningShown) {
    console.warn(
      `Persistencia de estados sem espaco para ${deviceId}. Tentando limpeza...`,
      error,
    );
    deviceStateQuotaWarningShown = true;
  } else {
    debugLog(() => [
      "QuotaExceeded repetido",
      { deviceId, message: error?.message },
    ]);
  }

  let removedEntries = 0;
  if (!deviceStateCleanupInProgress) {
    deviceStateCleanupInProgress = true;
    try {
      const excluded = new Set([key]);
      removedEntries = purgeDeviceStateEntries(excluded);
      if (removedEntries > 0) {
        console.info(
          `Estados antigos removidos do localStorage: ${removedEntries}`,
        );
      }
    } finally {
      deviceStateCleanupInProgress = false;
    }
  }

  if (removedEntries === 0) {
    disableDeviceStatePersistence(
      "Sem espaco restante no localStorage e nenhum estado para remover",
      error,
    );
    return;
  }

  try {
    localStorage.setItem(key, state);
    deviceStateQuotaErrors = 0;
  } catch (retryError) {
    deviceStateQuotaErrors += 1;
    const attempt = Math.min(
      deviceStateQuotaErrors,
      DEVICE_STATE_MAX_QUOTA_ERRORS,
    );

    if (attempt >= DEVICE_STATE_MAX_QUOTA_ERRORS) {
      disableDeviceStatePersistence(
        "localStorage sem espaco suficiente para estados",
        retryError,
      );
    } else {
      console.warn(
        `Persistencia de estados ainda sem espaco (tentativa ${attempt}/${DEVICE_STATE_MAX_QUOTA_ERRORS})`,
        retryError,
      );
    }
  }
}

function purgeDeviceStateEntries(excludeKeys = new Set()) {
  if (typeof localStorage === "undefined") return 0;

  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const currentKey = localStorage.key(i);
    if (
      currentKey &&
      currentKey.startsWith(DEVICE_STATE_STORAGE_PREFIX) &&
      !excludeKeys.has(currentKey)
    ) {
      keysToRemove.push(currentKey);
    }
  }

  keysToRemove.forEach((keyName) => {
    try {
      localStorage.removeItem(keyName);
    } catch (removeError) {
      console.warn("Erro ao remover estado persistido:", keyName, removeError);
    }

    const deviceId = keyName.substring(DEVICE_STATE_STORAGE_PREFIX.length);
    if (deviceId) {
      deviceStateMemory.delete(deviceId);
    }
  });

  return keysToRemove.length;
}

function disableDeviceStatePersistence(reason, error) {
  if (deviceStateStorageDisabled) {
    return;
  }

  deviceStateStorageDisabled = true;
  console.warn(`Persistencia de estados desativada: ${reason}`, error);
}

function registerControlElement(el) {
  if (!el || !el.dataset) return false;
  const deviceId = el.dataset.deviceId;
  if (!deviceId) return false;

  let registry = deviceControlCache.get(deviceId);
  if (!registry) {
    registry = new Set();
    deviceControlCache.set(deviceId, registry);
  }

  if (registry.has(el)) return false;
  registry.add(el);
  return true;
}

function unregisterControlElement(el) {
  if (!el || !el.dataset) return false;
  const deviceId = el.dataset.deviceId;
  if (!deviceId) return false;

  const registry = deviceControlCache.get(deviceId);
  if (!registry) return false;
  const removed = registry.delete(el);
  if (registry.size === 0) {
    deviceControlCache.delete(deviceId);
  }
  return removed;
}

function collectControlsFromNode(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
  let changed = false;

  if (node.matches && node.matches(CONTROL_SELECTOR)) {
    changed = registerControlElement(node) || changed;
  }

  if (typeof node.querySelectorAll === "function") {
    node.querySelectorAll(CONTROL_SELECTOR).forEach(function (el) {
      changed = registerControlElement(el) || changed;
    });
  }

  return changed;
}

function removeControlsFromNode(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
  let changed = false;

  if (node.matches && node.matches(CONTROL_SELECTOR)) {
    changed = unregisterControlElement(node) || changed;
  }

  if (typeof node.querySelectorAll === "function") {
    node.querySelectorAll(CONTROL_SELECTOR).forEach(function (el) {
      changed = unregisterControlElement(el) || changed;
    });
  }

  return changed;
}

function primeControlCaches(options) {
  const config = options || {};
  const root =
    config.root && typeof config.root.querySelectorAll === "function"
      ? config.root
      : document;
  const force = Boolean(config.force);

  if (controlCachePrimed && !force) {
    return;
  }

  root.querySelectorAll(CONTROL_SELECTOR).forEach(function (el) {
    registerControlElement(el);
  });

  controlCachePrimed = true;
}

function pruneStaleEntries() {
  deviceControlCache.forEach(function (registry, deviceId) {
    registry.forEach(function (el) {
      if (!el.isConnected) {
        registry.delete(el);
      }
    });

    if (registry.size === 0) {
      deviceControlCache.delete(deviceId);
    }
  });
}

function scheduleControlSync(forceMasterUpdate) {
  if (forceMasterUpdate) {
    pendingControlSyncForce = true;
  }

  if (pendingControlSyncHandle !== null) {
    return;
  }

  var runSync = function () {
    pendingControlSyncHandle = null;
    var force = pendingControlSyncForce;
    pendingControlSyncForce = false;
    syncAllVisibleControls(force);
  };

  if (typeof window !== "undefined") {
    if (typeof window.requestIdleCallback === "function") {
      pendingControlSyncHandle = window.requestIdleCallback(runSync, {
        timeout: 120,
      });
      return;
    }

    if (typeof window.requestAnimationFrame === "function") {
      pendingControlSyncHandle = window.requestAnimationFrame(function () {
        runSync();
      });
      return;
    }
  }

  pendingControlSyncHandle = setTimeout(runSync, 32);
}

async function fetchDeviceState(deviceId) {
  try {
    const url = urlDeviceInfo(deviceId);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Hubitat state fetch failed: ${resp.status}`);
    const data = await resp.json();
    // Maker API returns attributes array; prefer currentValue, fallback to value
    const attr = Array.isArray(data.attributes)
      ? data.attributes.find((a) => a.name === "switch")
      : null;
    const state = attr?.currentValue || attr?.value || "off";
    return state;
  } catch (error) {
    console.error(`Error fetching state for device ${deviceId}:`, error);
    return "off"; // fallback
  }
}

async function refreshRoomControlFromHubitat(el) {
  return;
}

function initRoomPage() {
  debugLog(() => ["initRoomPage: start"]);

  const root = document.getElementById("spa-root") || document;
  primeControlCaches({ root: root, force: true });
  pruneStaleEntries();
  syncAllVisibleControls(true);

  // Rename label on Sinuca page: Iluminacao -> Bar (UI-only)
  try {
    const route = (window.location.hash || "").replace("#", "");
    if (route === "ambiente5") {
      document
        .querySelectorAll(".room-control-label")
        .forEach(function (label) {
          const text = (label.textContent || "").trim().toLowerCase();
          if (text.startsWith("ilumin")) {
            label.textContent = "Bar";
          }
        });
    }
  } catch (error) {
    debugLog(() => ["initRoomPage rename fallback", error]);
  }
}

// === CONTROLADOR DE AR CONDICIONADO ===

// Função para inicializar o controle de AR quando a página de conforto for carregada
function initAirConditionerControl() {
  const root = document.querySelector('[data-component="ac-control"]');

  if (!root) {
    console.warn("Componente de controle de ar-condicionado n?o encontrado.");
    return;
  }

  const route = (window.location.hash || "").replace("#", "");
  const match = route.match(/^(ambiente\d+)/);
  const envKey = match ? match[1] : "";
  const acConfig =
    envKey && typeof getEnvironment === "function"
      ? getEnvironment(envKey)?.airConditioner || null
      : null;
  const baseDeviceId = acConfig?.deviceId ? String(acConfig.deviceId) : "";
  const acBrandProfiles =
    (typeof CLIENT_CONFIG !== "undefined" &&
      CLIENT_CONFIG?.devices?.airConditionerBrands) ||
    {};
  const acBrandKey = String(acConfig?.brand || "").toLowerCase();
  const acBrandProfile =
    (acBrandKey && acBrandProfiles[acBrandKey]) ||
    acBrandProfiles.default ||
    {};
  const acCommands = {
    ...(acBrandProfile.commands || {}),
    ...(acConfig?.commands || {}),
  };
  const swingConfig = acBrandProfile?.attributes?.swing || {
    key: "swing",
    on: ["on", "moving", "swing", "true"],
    off: ["off", "parada", "stop", "stopped", "false"],
  };
  const tempKeys = Array.isArray(acBrandProfile?.attributes?.temperature)
    ? acBrandProfile.attributes.temperature
    : ["temperature", "coolingsetpoint", "thermostatsetpoint", "setpoint"];

  const tempSlider = root.querySelector('[data-role="temp-slider"]');
  const tempCurrent = root.querySelector('[data-role="temp-current"]');
  const tempDecreaseButtons = Array.from(
    root.querySelectorAll('[data-role="temp-decrease"]'),
  );
  const tempIncreaseButtons = Array.from(
    root.querySelectorAll('[data-role="temp-increase"]'),
  );
  const powerOnBtn = root.querySelector('[data-role="power-on"]');
  const powerOffBtn = root.querySelector('[data-role="power-off"]');
  const liveRegion = root.querySelector('[data-role="temperature-live"]');
  const aletaButtons = Array.from(root.querySelectorAll("[data-aleta-button]"));
  const zoneButtons = Array.from(root.querySelectorAll("[data-zone-button]"));

  if (!tempSlider || !tempCurrent || !powerOnBtn || !powerOffBtn) {
    console.warn("Elementos essenciais do AC n?o encontrados.");
    return;
  }

  const minTemp = Number.parseInt(root.dataset.tempMin || "18", 10);
  const maxTemp = Number.parseInt(root.dataset.tempMax || "25", 10);
  const defaultTemp = Number.parseInt(root.dataset.tempDefault || "22", 10);

  function clampTemperature(value) {
    const num = Number.isFinite(value) ? value : minTemp;
    return Math.min(Math.max(num, minTemp), maxTemp);
  }

  const state = {
    minTemp,
    maxTemp,
    temperature: clampTemperature(defaultTemp),
    powerOn: false,
    activeZoneIds: baseDeviceId ? [baseDeviceId] : [],
    swing: null,
  };

  function getFallbackDeviceId() {
    return (
      baseDeviceId || root.dataset.deviceId || getACDeviceIdForCurrentRoute()
    );
  }

  function parseZoneIds(button) {
    if (!button) return [];
    const raw = button.dataset.zoneIds || "";
    if (!raw) return [];
    return raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  }

  function getActiveZoneIds() {
    if (baseDeviceId) return [baseDeviceId];
    if (state.activeZoneIds.length) return state.activeZoneIds;
    const fallback = getFallbackDeviceId();
    return fallback ? [String(fallback)] : [];
  }

  function getPrimaryDeviceId() {
    return getActiveZoneIds()[0] || "";
  }

  function resolveStoredPowerState(deviceIds) {
    const ids = Array.isArray(deviceIds) ? deviceIds : [];
    let hasKnownState = false;

    for (const id of ids) {
      const raw = getStoredState(String(id));
      if (raw === null || raw === undefined || String(raw).trim() === "") {
        continue;
      }

      hasKnownState = true;
      const normalized = normalizeSwitchState(raw, "off");
      if (normalized === "on") {
        return "on";
      }
    }

    return hasKnownState ? "off" : null;
  }

  function applyStoredPowerStateToUI() {
    const storedPowerState = resolveStoredPowerState(getActiveZoneIds());
    if (storedPowerState !== "on" && storedPowerState !== "off") {
      return false;
    }

    setPowerState(storedPowerState === "on", {
      silent: true,
      persist: false,
    });
    return true;
  }

  function buildTempCommand(temp) {
    if (typeof acCommands.tempTemplate === "string") {
      return acCommands.tempTemplate.replace("{temp}", String(temp));
    }
    if (typeof acCommands.tempPrefix === "string" && acCommands.tempPrefix) {
      return `${acCommands.tempPrefix}${temp}`;
    }
    return `temp${temp}`;
  }

  function normalizeSwingValue(value) {
    if (value === null || value === undefined) return null;
    const normalized = String(value).trim().toLowerCase();
    if (!normalized) return null;
    const onValues = Array.isArray(swingConfig.on)
      ? swingConfig.on
      : [swingConfig.on];
    const offValues = Array.isArray(swingConfig.off)
      ? swingConfig.off
      : [swingConfig.off];
    if (onValues.map((v) => String(v).toLowerCase()).includes(normalized)) {
      return "moving";
    }
    if (offValues.map((v) => String(v).toLowerCase()).includes(normalized)) {
      return "parada";
    }
    if (normalized === "on") return "moving";
    if (normalized === "off") return "parada";
    return null;
  }

  function setAletaButtonsActive(aleta) {
    if (!aleta) return;
    aletaButtons.forEach((btn) => {
      const isActive = btn.dataset.aleta === aleta;
      btn.setAttribute("aria-pressed", isActive.toString());
    });
  }

  function setZoneSelection(button) {
    const ids = parseZoneIds(button);
    state.activeZoneIds = baseDeviceId
      ? [baseDeviceId]
      : ids.length
        ? ids
        : getActiveZoneIds();
    zoneButtons.forEach((btn) => {
      btn.setAttribute("aria-pressed", (btn === button).toString());
    });
    AC_DEVICE_ID = getPrimaryDeviceId();
  }

  function updateSliderVisual(temp) {
    const range = state.maxTemp - state.minTemp;
    const percent = range > 0 ? ((temp - state.minTemp) / range) * 100 : 0;
    tempSlider.style.setProperty("--ac-temp-progress", `${percent}%`);
  }

  function updateTemperatureDisplay(temp) {
    tempCurrent.textContent = String(temp);
    tempSlider.value = String(temp);
    updateSliderVisual(temp);

    if (liveRegion) {
      liveRegion.textContent = `Temperatura ajustada para ${temp}.`;
    }
  }

  function setControlsEnabled(enabled) {
    tempSlider.toggleAttribute("disabled", !enabled);
    tempDecreaseButtons.forEach((btn) =>
      btn.toggleAttribute("disabled", !enabled),
    );
    tempIncreaseButtons.forEach((btn) =>
      btn.toggleAttribute("disabled", !enabled),
    );
    aletaButtons.forEach((btn) => btn.toggleAttribute("disabled", !enabled));
  }

  let temperatureDebounceTimer = null;

  function sendTemperatureCommand(temp) {
    const ids = getActiveZoneIds();
    if (!ids.length) return;
    const command = buildTempCommand(temp);
    if (!command) return;
    ids.forEach((id) => sendHubitatCommand(id, command));
  }

  function updateTemperature(value, options = {}) {
    const temp = clampTemperature(value);
    state.temperature = temp;
    updateTemperatureDisplay(temp);

    if (!state.powerOn || options.silent) {
      return;
    }

    if (temperatureDebounceTimer) {
      clearTimeout(temperatureDebounceTimer);
    }

    temperatureDebounceTimer = setTimeout(() => {
      sendTemperatureCommand(temp);
      temperatureDebounceTimer = null;
    }, 900);
  }

  function setPowerState(isOn, options = {}) {
    state.powerOn = isOn;
    root.toggleAttribute("data-power-off", !isOn);
    powerOnBtn.setAttribute("aria-pressed", isOn.toString());
    powerOffBtn.setAttribute("aria-pressed", (!isOn).toString());
    setControlsEnabled(isOn);

    if (temperatureDebounceTimer) {
      clearTimeout(temperatureDebounceTimer);
      temperatureDebounceTimer = null;
    }

    const shouldPersistState =
      options.persist === true ||
      (options.persist !== false && options.silent !== true);
    if (shouldPersistState) {
      const persistedState = isOn ? "on" : "off";
      getActiveZoneIds().forEach((id) => {
        setStoredState(String(id), persistedState);
      });
    }

    if (!options.silent) {
      const ids = getActiveZoneIds();
      const command = isOn
        ? acCommands.powerOn || "on"
        : acCommands.powerOff || "off";
      if (command) {
        ids.forEach((id) => sendHubitatCommand(id, command));
      }
    }
  }

  function setAletaState(aleta) {
    if (!state.powerOn) return;
    if (aleta === "windfree") {
      const command = acCommands.windfree;
      if (!command) return;
      setAletaButtonsActive(aleta);
      getActiveZoneIds().forEach((id) => sendHubitatCommand(id, command));
      return;
    }

    const desired =
      aleta === "moving" ? "moving" : aleta === "parada" ? "parada" : null;
    if (!desired) return;

    if (acCommands.swingToggle) {
      if (state.swing && state.swing === desired) return;
      setAletaButtonsActive(desired);
      state.swing = desired;
      getActiveZoneIds().forEach((id) =>
        sendHubitatCommand(id, acCommands.swingToggle),
      );
      return;
    }

    const command =
      desired === "moving"
        ? acCommands.swingOn || "swingOn"
        : acCommands.swingOff || "swingOff";
    if (!command) return;
    setAletaButtonsActive(desired);
    state.swing = desired;
    getActiveZoneIds().forEach((id) => sendHubitatCommand(id, command));
  }

  zoneButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      setZoneSelection(btn);
      applyStoredPowerStateToUI();
      applyACFromPolling({ needPower: true, needTemp: true, needSwing: true });
    });
  });

  powerOnBtn.addEventListener("click", () => setPowerState(true));
  powerOffBtn.addEventListener("click", () => setPowerState(false));

  tempSlider.addEventListener("input", () => {
    updateTemperature(Number.parseInt(tempSlider.value, 10));
  });

  tempDecreaseButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      updateTemperature(state.temperature - 1);
    });
  });

  tempIncreaseButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      updateTemperature(state.temperature + 1);
    });
  });

  aletaButtons.forEach((btn) => {
    btn.addEventListener("click", () => setAletaState(btn.dataset.aleta));
  });

  if (zoneButtons.length) {
    const defaultButton =
      zoneButtons.find((btn) => btn.dataset.zoneDefault === "true") ||
      zoneButtons[0];
    if (defaultButton) {
      setZoneSelection(defaultButton);
    }
  } else {
    const fallback = getFallbackDeviceId();
    state.activeZoneIds = fallback ? [String(fallback)] : [];
    AC_DEVICE_ID = getPrimaryDeviceId();
  }

  updateTemperature(state.temperature, { silent: true });
  if (!applyStoredPowerStateToUI()) {
    setPowerState(false, { silent: true, persist: false });
  }
  applyACFromPolling({ needPower: true, needTemp: true, needSwing: true });

  async function applyACFromPolling({
    needPower = true,
    needTemp = true,
    needSwing = true,
  } = {}) {
    try {
      if (isHubitatBypassMode()) {
        debugLog(() => ["AC polling skipped (Hubitat bypass mode)"]);
        return;
      }

      const deviceId = getPrimaryDeviceId();
      if (!deviceId) return;
      const url = `/polling?devices=${encodeURIComponent(deviceId)}`;
      const resp = await fetch(url, { cache: "no-store" });
      if (!resp.ok) return;
      const payload = await resp.json();
      const list = Array.isArray(payload?.data) ? payload.data : [];
      const device = list.find((d) => String(d?.id) === String(deviceId));
      if (!device) return;

      let attrsMap = {};
      if (Array.isArray(device.attributes)) {
        device.attributes.forEach((attr) => {
          if (!attr || !attr.name) return;
          attrsMap[String(attr.name).toLowerCase()] =
            attr.currentValue ?? attr.value;
        });
      } else if (device.attributes && typeof device.attributes === "object") {
        Object.keys(device.attributes).forEach((key) => {
          attrsMap[String(key).toLowerCase()] = device.attributes[key];
        });
      }

      if (needPower) {
        const sw = String(attrsMap["switch"] ?? "").toLowerCase();
        if (sw) {
          setPowerState(sw === "on", { silent: true, persist: true });
        }
      }

      if (needTemp) {
        let temp;
        for (const key of tempKeys) {
          if (key && attrsMap[key.toLowerCase()] !== undefined) {
            temp = attrsMap[key.toLowerCase()];
            break;
          }
        }
        if (typeof temp === "string") {
          const match = temp.match(/(-?\d{1,2})/);
          if (match) temp = Number.parseInt(match[1], 10);
        }
        if (typeof temp === "number" && !Number.isNaN(temp)) {
          updateTemperature(Math.round(temp), { silent: true });
        }
      }

      if (needSwing) {
        const swingKey = String(swingConfig.key || "swing").toLowerCase();
        const swingValue = attrsMap[swingKey];
        const swingMode = normalizeSwingValue(swingValue);
        if (swingMode) {
          state.swing = swingMode;
          setAletaButtonsActive(swingMode);
        }
      }
    } catch (error) {
      console.warn("Falha no polling do AC:", error);
    }
  }

  setTimeout(() => {
    applyACFromPolling({ needPower: true, needTemp: true, needSwing: true });
  }, 1200);
}

// === FIM DO CONTROLADOR DE AR CONDICIONADO ===

// Normalize mis-encoded Portuguese accents across the UI
window.normalizeAccents = function normalizeAccents(root) {
  try {
    const map = new Map([
      ["Escrit\u00ef\u00bf\u00bd\u00ef\u00bf\u00bdrio", "Escritório"],
      [
        "Programa\u00ef\u00bf\u00bd\u00ef\u00bf\u00bd\u00c7\u0153o",
        "Programação",
      ],
      ["Recep\u00ef\u00bf\u00bd\u00ef\u00bf\u00bd\u00c7\u0153o", "Recepção"],
      ["Refeit\u00ef\u00bf\u00bd\u00ef\u00bf\u00bdrio", "Refeitório"],
      ["Funcion\u00c7\u00adrios", "Funcionários"],
      ["Ilumina\u00ef\u00bf\u00bd\u00ef\u00bf\u00bdo", "Iluminação"],
      [
        "Ilumina\u00ef\u00bf\u00bd\u00ef\u00bf\u00bd\u00c7\u0153o",
        "Iluminação",
      ],
      ["Pain\u00c7\u00b8is", "Painéis"],
      ["Arm\u00c7\u00adrio", "Armário"],
      ["Ambient\u00c7\u0153o", "Ambiente"],
    ]);
    const selector = ".page-title, .room-control-label, .room-card span";
    const scope = root || document;
    scope.querySelectorAll(selector).forEach((el) => {
      const before = el.textContent || "";
      let after = before;
      map.forEach((val, key) => {
        if (after.includes(key)) after = after.replaceAll(key, val);
      });
      if (after !== before) el.textContent = after;
    });
  } catch (_) {}
};

// --- Funções para a página do Escritório ---

function toggleDevice(el, deviceType) {
  const img = el.querySelector(".control-icon");
  const stateEl = el.querySelector(".control-state");
  const currentState = el.dataset.state;
  let newState;
  let newLabel;

  const icons = {
    light: {
      on: "images/icons/icon-small-light-on.svg",
      off: "images/icons/icon-small-light-off.svg",
    },
    tv: {
      on: "images/icons/icon-small-tv-on.svg",
      off: "images/icons/icon-small-tv-off.svg",
    },
    shader: {
      on: "images/icons/icon-small-shader-on.svg",
      off: "images/icons/icon-small-shader-off.svg",
    },
  };

  if (!icons[deviceType]) return;

  let deviceId = el.dataset.deviceId || null;
  // Fallback por label para compatibilidade
  if (!deviceId) {
    const controlLabel = el
      .querySelector(".control-label")
      ?.textContent?.trim();
    if (controlLabel === "Pendente") {
      deviceId = "102";
    } else if (controlLabel === "Trilho") {
      deviceId = "101";
    }
  }

  if (currentState === "off" || currentState === "closed") {
    newState = "on";
    newLabel = deviceType === "shader" ? "Abertas" : "ON";
    img.src = icons[deviceType].on;
    if (deviceId) sendHubitatCommand(deviceId, "on");
  } else {
    newState = deviceType === "shader" ? "closed" : "off";
    newLabel = deviceType === "shader" ? "Fechadas" : "OFF";
    img.src = icons[deviceType].off;
    if (deviceId) sendHubitatCommand(deviceId, "off");
  }

  el.dataset.state = newState;
  if (stateEl) stateEl.textContent = newLabel;
}

// (removido) setupThermostat: não utilizado após retirada da página "escritorio"

// --- Controle do Hubitat ---

async function brutalCacheClear() {
  const confirmationMessage =
    "Deseja realmente limpar todo o cache do aplicativo? Isso ira recarregar a pagina.";

  if (!window.confirm(confirmationMessage)) {
    console.log("Limpeza manual de cache cancelada pelo usuario.");
    return;
  }

  console.log("Iniciando limpeza manual de cache.");

  if (typeof showMobileDebug === "function") {
    showMobileDebug("Limpando cache...", "info");
  }

  const criticalKeys = ["hubitat_host", "hubitat_token"];
  const backup = {};

  try {
    criticalKeys.forEach((key) => {
      const value = localStorage.getItem(key);
      if (value !== null) {
        backup[key] = value;
      }
    });

    localStorage.clear();

    Object.keys(backup).forEach((key) => {
      localStorage.setItem(key, backup[key]);
    });
  } catch (error) {
    console.warn("Erro ao limpar localStorage:", error);
  }

  try {
    sessionStorage.clear();
  } catch (error) {
    console.warn("Erro ao limpar sessionStorage:", error);
  }

  if ("caches" in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    } catch (error) {
      console.warn("Erro ao limpar caches do navegador:", error);
    }
  }

  if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map((registration) => registration.unregister()),
      );
    } catch (error) {
      console.warn("Erro ao remover service workers:", error);
    }
  }

  try {
    const timestamp = Date.now();
    const cacheBuster =
      timestamp.toString() + "_" + Math.random().toString(36).substring(2, 10);

    localStorage.setItem("last_cache_clear", timestamp.toString());
    localStorage.setItem("app_cache_version", cacheBuster);
  } catch (error) {
    console.warn("Erro ao atualizar metadados de cache:", error);
  }

  if (typeof showMobileDebug === "function") {
    showMobileDebug("Cache limpo. Recarregando...", "success");
  }

  setTimeout(() => {
    window.location.reload();
  }, 400);
}

window.brutalCacheClear = brutalCacheClear;
const isProductionOriginal = !["localhost", "127.0.0.1", "::1"].includes(
  location.hostname,
);
// Produção detectada pelo hostname
const isProduction = isProductionOriginal;
console.log("🔍 DEBUG PRODUÇÃO:", {
  hostname: location.hostname,
  isProductionOriginal: isProductionOriginal,
  isProduction: isProduction,
  isMobile:
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    ),
});

// Detectar dispositivos móveis
const isMobile =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

// SOLUÇÃO: Desabilitar console.log em mobile para evitar travamentos
const ENABLE_DEBUG_LOGS = true; // Logs habilitados em desktop e mobile

// Sistema de detecção de cache desatualizado para mobile (TEMPORARIAMENTE DESABILITADO)
const APP_VERSION = "1.0.0"; // 🎉 MARCO v1.0 - SISTEMA TOTALMENTE FUNCIONAL
(function () {
  if (false && isMobile) {
    // DESABILITADO para debug
    try {
      var lastVersion = localStorage.getItem("app_version");
      var lastLoad = localStorage.getItem("last_mobile_load");
      var now = new Date().getTime();

      // Só recarregar se versão realmente mudou (não por tempo)
      if (lastVersion && lastVersion !== APP_VERSION) {
        console.log("📱 Nova versão detectada - forçando reload cache");
        console.log("📱 Versão anterior:", lastVersion, "Nova:", APP_VERSION);

        // Marcar que já foi recarregado para esta versão
        localStorage.setItem("app_version", APP_VERSION);
        localStorage.setItem("last_mobile_load", now.toString());
        localStorage.setItem("reload_done_" + APP_VERSION, "true");

        // Limpar caches exceto os marcadores de versão
        var itemsToKeep = [
          "app_version",
          "last_mobile_load",
          "reload_done_" + APP_VERSION,
        ];
        var keysToRemove = [];
        for (var i = 0; i < localStorage.length; i++) {
          var key = localStorage.key(i);
          if (
            key &&
            !itemsToKeep.includes(key) &&
            !key.startsWith("reload_done_")
          ) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));

        // Forçar reload apenas se não foi feito ainda para esta versão
        if (!localStorage.getItem("reload_done_" + APP_VERSION)) {
          setTimeout(function () {
            console.log("📱 Recarregando página para nova versão...");
            window.location.reload(true);
          }, 2000);
          return; // não continuar inicialização
        }
      } else {
        // Primeira vez ou mesma versão - continuar normalmente
        localStorage.setItem("app_version", APP_VERSION);
        localStorage.setItem("last_mobile_load", now.toString());
        console.log("📱 Mobile cache OK - versão", APP_VERSION);
      }
    } catch (e) {
      console.warn("📱 Erro na verificação de versão mobile:", e);
    }
  }
})();

// Função de log segura para mobile
function safeLog() {
  if (ENABLE_DEBUG_LOGS && typeof console !== "undefined" && console.log) {
    try {
      console.log.apply(console, arguments);
    } catch (e) {
      // Silenciar se console falhar
    }
  }
}

// Sistema de debug visual para mobile (DESABILITADO - compatibilidade resolvida)
function showMobileDebug(message, type) {
  // Debug desabilitado - funcionalidade mobile estável
  return;
}

// Substituir console.log globalmente para mobile
if (!ENABLE_DEBUG_LOGS) {
  // Criar console mock silencioso para mobile
  window.console = window.console || {};
  window.console.log = function () {};
  window.console.error = function () {};
  window.console.warn = function () {};
}

// Debug mínimo apenas se necessário
if (ENABLE_DEBUG_LOGS) {
  safeLog("=== DASHBOARD ELETRIZE DEBUG ===");
  safeLog("🔍 isProduction:", isProduction, "isMobile:", isMobile);
}

safeLog("=== AMBIENTE DETECTADO ===", {
  isProduction,
  isMobile,
  isIOS,
  userAgent: navigator.userAgent.substring(0, 60) + "...",
});
const HUBITAT_PROXY_URL = "/hubitat-proxy";
const POLLING_URL = "/polling";
window.musicPlayerUI = window.musicPlayerUI || {};

function normalizeMakerApiDeviceIds(ids, fallback = "*") {
  const source = ids !== undefined ? ids : fallback;
  if (source === "*" || source === "all" || source === true) return null; // null = todos
  if (Array.isArray(source)) {
    const normalized = source.filter(Boolean).map((v) => String(v));
    return normalized.length > 0 ? new Set(normalized) : null;
  }
  if (source === undefined || source === null) return null;
  return new Set([String(source)]);
}

// Hubitat Cloud (Maker API) configuration via config.js (com fallback seguro)
const CLIENT_MAKER_API_CLOUD =
  (typeof window !== "undefined" && window.CLIENT_CONFIG?.makerApi?.cloud) ||
  {};
const DEFAULT_MAKER_API_CLOUD = {
  enabled: false,
  appBaseUrl: "",
  accessToken: "",
  deviceIds: [],
};

const HUBITAT_CLOUD_ENABLED =
  CLIENT_MAKER_API_CLOUD.enabled ?? DEFAULT_MAKER_API_CLOUD.enabled;
const HUBITAT_CLOUD_APP_BASE_URL =
  CLIENT_MAKER_API_CLOUD.appBaseUrl || DEFAULT_MAKER_API_CLOUD.appBaseUrl;
const HUBITAT_CLOUD_ACCESS_TOKEN =
  CLIENT_MAKER_API_CLOUD.accessToken || DEFAULT_MAKER_API_CLOUD.accessToken;
const HUBITAT_CLOUD_DEVICES_BASE_URL = HUBITAT_CLOUD_APP_BASE_URL
  ? `${HUBITAT_CLOUD_APP_BASE_URL}/devices`
  : "";
const HUBITAT_CLOUD_DEVICE_IDS = normalizeMakerApiDeviceIds(
  CLIENT_MAKER_API_CLOUD.deviceIds,
  DEFAULT_MAKER_API_CLOUD.deviceIds,
);

function useHubitatCloud(deviceId) {
  if (!HUBITAT_CLOUD_ENABLED) return false;
  if (!HUBITAT_CLOUD_APP_BASE_URL || !HUBITAT_CLOUD_ACCESS_TOKEN) return false;
  if (deviceId === undefined || deviceId === null) return false;
  if (HUBITAT_CLOUD_DEVICE_IDS === null) return true; // null = todos os dispositivos
  return HUBITAT_CLOUD_DEVICE_IDS.has(String(deviceId));
}

function deriveSwitchStateFromCommand(command, value) {
  const cmd = String(command || "")
    .trim()
    .toLowerCase();
  if (!cmd) return null;

  if (cmd === "on" || cmd === "poweron") return "on";
  if (cmd === "off" || cmd === "poweroff") return "off";

  if (cmd === "setlevel") {
    const level = Number(value);
    if (Number.isFinite(level)) {
      return level > 0 ? "on" : "off";
    }
  }

  return null;
}

const DEV_STATE_ONLY_MODE_STORAGE_KEY = "dashboard_dev_state_only_mode";
const DEV_STATE_ONLY_MODE_DEFAULT = Boolean(
  typeof window !== "undefined" &&
  window.CLIENT_CONFIG?.development?.stateOnlyMode === true,
);
const DEV_STATE_ONLY_ALLOW_PRODUCTION = Boolean(
  typeof window !== "undefined" &&
  window.CLIENT_CONFIG?.development?.allowStateOnlyInProduction === true,
);

function canUseStateOnlyDevMode() {
  if (typeof window === "undefined") return false;
  const host = String(window.location?.hostname || "").toLowerCase();
  const isLocalHost =
    host === "localhost" || host === "127.0.0.1" || host === "::1";
  return isLocalHost || DEV_STATE_ONLY_ALLOW_PRODUCTION;
}

function isStateOnlyDevMode() {
  if (!canUseStateOnlyDevMode()) return false;

  try {
    const raw = localStorage.getItem(DEV_STATE_ONLY_MODE_STORAGE_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch (_) {}
  return DEV_STATE_ONLY_MODE_DEFAULT;
}

function setStateOnlyDevMode(enabled, persist = true) {
  const requested = Boolean(enabled);
  const next = requested && canUseStateOnlyDevMode();

  if (requested && !next) {
    console.warn("[DEV] stateOnlyMode bloqueado fora de localhost");
  }

  if (persist) {
    try {
      localStorage.setItem(DEV_STATE_ONLY_MODE_STORAGE_KEY, next ? "1" : "0");
    } catch (_) {}
  }
  console.warn(`[DEV] stateOnlyMode ${next ? "ativado" : "desativado"}`);
  return next;
}

if (typeof window !== "undefined") {
  if (!canUseStateOnlyDevMode()) {
    try {
      localStorage.setItem(DEV_STATE_ONLY_MODE_STORAGE_KEY, "0");
    } catch (_) {}
  }
  window.isStateOnlyDevMode = isStateOnlyDevMode;
  window.setStateOnlyDevMode = setStateOnlyDevMode;
}

const CINEMATIC_MODE_STORAGE_KEY = "dashboard_cinematic_mode";
const CINEMATIC_MODE_DEFAULT = Boolean(
  typeof window !== "undefined" &&
    window.CLIENT_CONFIG?.development?.cinematicMode === true,
);
const CINEMATIC_MODE_TOAST_ID = "cinematic-mode-toast";
const CINEMATIC_HOME_HOLD_MS = 4000;

function isCinematicModeEnabled() {
  try {
    const raw = localStorage.getItem(CINEMATIC_MODE_STORAGE_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch (_) {}
  return CINEMATIC_MODE_DEFAULT;
}

function isHubitatBypassMode() {
  return isStateOnlyDevMode() || isCinematicModeEnabled();
}

function syncCinematicModeDomState() {
  if (typeof document === "undefined") return;
  const enabled = isCinematicModeEnabled();
  document.body?.classList.toggle("cinematic-mode", enabled);
  document.documentElement?.setAttribute(
    "data-cinematic-mode",
    enabled ? "true" : "false",
  );
}

function showCinematicModeFeedback(enabled) {
  if (typeof document === "undefined") return;

  let toast = document.getElementById(CINEMATIC_MODE_TOAST_ID);
  if (!toast) {
    toast = document.createElement("div");
    toast.id = CINEMATIC_MODE_TOAST_ID;
    toast.style.cssText = [
      "position: fixed",
      "left: 50%",
      "bottom: calc(env(safe-area-inset-bottom, 0px) + 92px)",
      "transform: translate(-50%, 12px)",
      "z-index: 12000",
      "padding: 10px 14px",
      "border-radius: 12px",
      "font-size: 0.86rem",
      "font-weight: 700",
      "line-height: 1.25",
      "text-align: center",
      "color: #ffffff",
      "background: rgba(8, 14, 32, 0.92)",
      "border: 1px solid rgba(255, 255, 255, 0.22)",
      "box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35)",
      "backdrop-filter: blur(8px)",
      "opacity: 0",
      "transition: opacity 220ms ease, transform 220ms ease",
      "pointer-events: none",
      "max-width: min(88vw, 520px)",
    ].join(";");
    document.body.appendChild(toast);
  }

  toast.textContent = enabled
    ? "Modo cinematografico ativado (sem comandos Hubitat)."
    : "Modo cinematografico desativado.";

  if (toast._cinematicHideTimeout) {
    clearTimeout(toast._cinematicHideTimeout);
  }

  toast.style.opacity = "1";
  toast.style.transform = "translate(-50%, 0)";

  toast._cinematicHideTimeout = setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translate(-50%, 12px)";
  }, 2600);
}

function setCinematicModeEnabled(enabled, options = {}) {
  const next = Boolean(enabled);
  const persist = options?.persist !== false;
  const silent = options?.silent === true;

  if (persist) {
    try {
      localStorage.setItem(CINEMATIC_MODE_STORAGE_KEY, next ? "1" : "0");
    } catch (_) {}
  }

  syncCinematicModeDomState();

  if (next) {
    if (pollingAbortController) {
      pollingAbortController.abort();
    }
    stopPolling();
  } else if (
    isProduction &&
    typeof document !== "undefined" &&
    document.visibilityState === "visible"
  ) {
    startPolling();
  }

  if (typeof syncAllVisibleControls === "function") {
    setTimeout(() => syncAllVisibleControls(true), 0);
  }

  if (!silent) {
    showCinematicModeFeedback(next);
  }

  try {
    document.dispatchEvent(
      new CustomEvent("dashboard:cinematic-mode-changed", {
        detail: { enabled: next },
      }),
    );
  } catch (_) {}

  console.warn(
    `[CINEMA] modo cinematografico ${next ? "ativado" : "desativado"}`,
  );
  return next;
}

function toggleCinematicMode() {
  return setCinematicModeEnabled(!isCinematicModeEnabled());
}

if (typeof window !== "undefined") {
  window.isCinematicModeEnabled = isCinematicModeEnabled;
  window.isHubitatBypassMode = isHubitatBypassMode;
  window.setCinematicModeEnabled = setCinematicModeEnabled;
  window.toggleCinematicMode = toggleCinematicMode;
}

const DEFAULT_MQTT_STATE_CONFIG = {
  enabled: false,
  brokerUrl: "",
  username: "",
  password: "",
  clientIdPrefix: "dashboard-eletrize",
  stateTopicPrefix: "eletrize/devices",
  qos: 0,
  retain: true,
  libraryUrl: "https://unpkg.com/mqtt/dist/mqtt.min.js",
};

const CLIENT_MQTT_STATE_CONFIG =
  (typeof window !== "undefined" && window.CLIENT_CONFIG?.development?.mqtt) ||
  {};
const MQTT_STATE_TOPIC_SUFFIX = "state";
const MQTT_PAYLOAD_DECODER =
  typeof TextDecoder !== "undefined"
    ? new TextDecoder("utf-8", { fatal: false })
    : null;

let mqttStateLibraryLoadPromise = null;
let mqttStateBridgeInitPromise = null;
let mqttStateClient = null;
let mqttStateConnected = false;
let mqttStateConfigCache = null;

function normalizeTopicPath(path) {
  return String(path || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function normalizeMqttStateConfig() {
  const merged = {
    ...DEFAULT_MQTT_STATE_CONFIG,
    ...CLIENT_MQTT_STATE_CONFIG,
  };

  const qosRaw = Number.parseInt(merged.qos, 10);

  return {
    enabled: Boolean(merged.enabled),
    brokerUrl: String(merged.brokerUrl || "").trim(),
    username: String(merged.username || "").trim(),
    password: String(merged.password || ""),
    clientIdPrefix:
      String(
        merged.clientIdPrefix || DEFAULT_MQTT_STATE_CONFIG.clientIdPrefix,
      ).trim() || DEFAULT_MQTT_STATE_CONFIG.clientIdPrefix,
    stateTopicPrefix: normalizeTopicPath(
      merged.stateTopicPrefix || DEFAULT_MQTT_STATE_CONFIG.stateTopicPrefix,
    ),
    qos: qosRaw === 1 || qosRaw === 2 ? qosRaw : 0,
    retain: merged.retain !== false,
    libraryUrl:
      String(
        merged.libraryUrl || DEFAULT_MQTT_STATE_CONFIG.libraryUrl,
      ).trim() || DEFAULT_MQTT_STATE_CONFIG.libraryUrl,
  };
}

function normalizeBooleanSwitchState(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;

  if (normalized === "on" || normalized === "off") return normalized;
  if (normalized === "1" || normalized === "true" || normalized === "ligado") {
    return "on";
  }
  if (
    normalized === "0" ||
    normalized === "false" ||
    normalized === "desligado"
  ) {
    return "off";
  }

  return null;
}

function parseMqttSwitchState(payloadText) {
  const raw = String(payloadText || "").trim();
  if (!raw) return null;

  const direct = normalizeBooleanSwitchState(raw);
  if (direct) return direct;

  try {
    const parsed = JSON.parse(raw);

    if (
      typeof parsed === "string" ||
      typeof parsed === "number" ||
      typeof parsed === "boolean"
    ) {
      return normalizeBooleanSwitchState(parsed);
    }

    if (parsed && typeof parsed === "object") {
      return (
        normalizeBooleanSwitchState(parsed.state) ||
        normalizeBooleanSwitchState(parsed.switch) ||
        normalizeBooleanSwitchState(parsed.value) ||
        normalizeBooleanSwitchState(parsed.status)
      );
    }
  } catch (_) {
    return null;
  }

  return null;
}

function decodeMqttPayload(payload) {
  if (payload === undefined || payload === null) return "";
  if (typeof payload === "string") return payload;
  if (typeof payload === "number" || typeof payload === "boolean") {
    return String(payload);
  }

  if (MQTT_PAYLOAD_DECODER && typeof Uint8Array !== "undefined") {
    if (payload instanceof Uint8Array) {
      try {
        return MQTT_PAYLOAD_DECODER.decode(payload);
      } catch (_) {}
    }
    if (typeof ArrayBuffer !== "undefined" && payload instanceof ArrayBuffer) {
      try {
        return MQTT_PAYLOAD_DECODER.decode(new Uint8Array(payload));
      } catch (_) {}
    }
  }

  try {
    return String(payload);
  } catch (_) {
    return "";
  }
}

function buildMqttStateTopic(
  deviceId,
  config = mqttStateConfigCache || normalizeMqttStateConfig(),
) {
  const id = String(deviceId || "").trim();
  if (!id) return "";

  const encodedId = encodeURIComponent(id);
  const prefix = normalizeTopicPath(config?.stateTopicPrefix);
  if (!prefix) {
    return `${encodedId}/${MQTT_STATE_TOPIC_SUFFIX}`;
  }
  return `${prefix}/${encodedId}/${MQTT_STATE_TOPIC_SUFFIX}`;
}

function buildMqttStateSubscriptionTopic(
  config = mqttStateConfigCache || normalizeMqttStateConfig(),
) {
  const prefix = normalizeTopicPath(config?.stateTopicPrefix);
  if (!prefix) {
    return `+/${MQTT_STATE_TOPIC_SUFFIX}`;
  }
  return `${prefix}/+/${MQTT_STATE_TOPIC_SUFFIX}`;
}

function extractDeviceIdFromMqttStateTopic(
  topic,
  config = mqttStateConfigCache || normalizeMqttStateConfig(),
) {
  const rawTopic = String(topic || "").trim();
  if (!rawTopic) return null;

  const topicParts = rawTopic.split("/").filter((part) => part.length > 0);
  if (topicParts.length < 2) return null;
  if (topicParts[topicParts.length - 1] !== MQTT_STATE_TOPIC_SUFFIX)
    return null;

  const prefixParts = normalizeTopicPath(config?.stateTopicPrefix)
    .split("/")
    .filter((part) => part.length > 0);

  let encodedId = "";
  if (prefixParts.length > 0) {
    if (topicParts.length < prefixParts.length + 2) return null;

    for (let i = 0; i < prefixParts.length; i += 1) {
      if (topicParts[i] !== prefixParts[i]) {
        return null;
      }
    }

    encodedId = topicParts.slice(prefixParts.length, -1).join("/");
  } else {
    encodedId = topicParts.slice(0, -1).join("/");
  }

  if (!encodedId) return null;

  try {
    return decodeURIComponent(encodedId);
  } catch (_) {
    return encodedId;
  }
}

async function ensureMqttLibraryLoaded(libraryUrl) {
  if (typeof window === "undefined") {
    throw new Error("MQTT indisponivel fora do browser");
  }

  if (window.mqtt?.connect) {
    return window.mqtt;
  }

  if (mqttStateLibraryLoadPromise) {
    return mqttStateLibraryLoadPromise;
  }

  mqttStateLibraryLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = libraryUrl;
    script.onload = () => {
      if (window.mqtt?.connect) {
        resolve(window.mqtt);
      } else {
        reject(new Error("Biblioteca MQTT carregada sem window.mqtt.connect"));
      }
    };
    script.onerror = () => {
      reject(new Error(`Falha ao carregar biblioteca MQTT: ${libraryUrl}`));
    };

    const parent = document.head || document.body || document.documentElement;
    if (!parent) {
      reject(new Error("Nao foi possivel anexar script MQTT ao DOM"));
      return;
    }
    parent.appendChild(script);
  });

  return mqttStateLibraryLoadPromise.catch((error) => {
    mqttStateLibraryLoadPromise = null;
    throw error;
  });
}

function handleMqttStateMessage(topic, payload) {
  const config = mqttStateConfigCache || normalizeMqttStateConfig();
  const deviceId = extractDeviceIdFromMqttStateTopic(topic, config);
  if (!deviceId) return;

  const payloadText = decodeMqttPayload(payload);
  const nextState = parseMqttSwitchState(payloadText);
  if (!nextState) {
    debugLog(() => ["MQTT payload ignorado", { topic, payloadText }]);
    return;
  }

  setStoredState(deviceId, nextState, { source: "mqtt" });
  updateDeviceUI(deviceId, nextState, true);
  debugLog(() => ["MQTT state recebido", { topic, deviceId, nextState }]);
}

function publishStoredStateToMqtt(deviceId, state, options = {}) {
  if (!mqttStateClient || !mqttStateConnected) return;
  if (String(options?.source || "") === "mqtt") return;

  const config = mqttStateConfigCache || normalizeMqttStateConfig();
  if (!config.enabled) return;

  const normalizedState = normalizeBooleanSwitchState(state);
  if (!normalizedState) return;

  const topic = buildMqttStateTopic(deviceId, config);
  if (!topic) return;

  try {
    mqttStateClient.publish(
      topic,
      normalizedState,
      { qos: config.qos, retain: config.retain },
      (error) => {
        if (error) {
          console.warn(`MQTT publish falhou para ${topic}:`, error);
        }
      },
    );
  } catch (error) {
    console.warn("Erro ao publicar estado no MQTT:", error);
  }
}

async function initializeMqttStateBridge() {
  if (mqttStateBridgeInitPromise) {
    return mqttStateBridgeInitPromise;
  }

  mqttStateBridgeInitPromise = (async () => {
    const config = normalizeMqttStateConfig();
    mqttStateConfigCache = config;

    if (!config.enabled) {
      return { enabled: false, reason: "disabled" };
    }

    if (!config.brokerUrl) {
      console.warn(
        "MQTT habilitado, mas development.mqtt.brokerUrl está vazio",
      );
      return { enabled: false, reason: "missing-broker-url" };
    }

    if (mqttStateClient) {
      return { enabled: true, connected: mqttStateConnected };
    }

    const mqttLib = await ensureMqttLibraryLoaded(config.libraryUrl);
    const clientId = `${config.clientIdPrefix}-${Math.random()
      .toString(16)
      .slice(2, 10)}`;

    const connectOptions = {
      clientId,
      clean: true,
      reconnectPeriod: 3000,
      connectTimeout: 10000,
    };

    if (config.username) {
      connectOptions.username = config.username;
    }
    if (config.password) {
      connectOptions.password = config.password;
    }

    mqttStateClient = mqttLib.connect(config.brokerUrl, connectOptions);

    mqttStateClient.on("connect", () => {
      mqttStateConnected = true;
      const subscriptionTopic = buildMqttStateSubscriptionTopic(config);
      mqttStateClient.subscribe(
        subscriptionTopic,
        { qos: config.qos },
        (error) => {
          if (error) {
            console.error(
              `MQTT subscribe falhou (${subscriptionTopic}):`,
              error,
            );
            return;
          }
          console.log(`MQTT conectado e inscrito em ${subscriptionTopic}`);
        },
      );
    });

    mqttStateClient.on("message", (topic, payload) => {
      handleMqttStateMessage(topic, payload);
    });

    mqttStateClient.on("reconnect", () => {
      debugLog(() => ["MQTT reconectando..."]);
    });

    mqttStateClient.on("offline", () => {
      mqttStateConnected = false;
      debugLog(() => ["MQTT offline"]);
    });

    mqttStateClient.on("close", () => {
      mqttStateConnected = false;
      debugLog(() => ["MQTT fechado"]);
    });

    mqttStateClient.on("error", (error) => {
      mqttStateConnected = false;
      console.error("MQTT erro:", error);
    });

    return { enabled: true, connected: mqttStateConnected };
  })();

  try {
    return await mqttStateBridgeInitPromise;
  } catch (error) {
    mqttStateBridgeInitPromise = null;
    console.error("Falha ao inicializar bridge MQTT de estados:", error);
    throw error;
  }
}

if (typeof window !== "undefined") {
  window.initializeMqttStateBridge = initializeMqttStateBridge;
}

const TEXT_MOJIBAKE_REGEX = /[\u00C3\u00C2\u00E2\uFFFD]/;
const TEXT_MOJIBAKE_REPLACEMENTS = [
  ["\u00e2\u0080\u0099", "’"],
  ["\u00e2\u0080\u0098", "‘"],
  ["\u00e2\u0080\u009c", "“"],
  ["\u00e2\u0080\u009d", "”"],
  ["\u00e2\u0080\u0093", "–"],
  ["\u00e2\u0080\u0094", "—"],
  ["\u00e2\u0080\u00a6", "…"],
  ["\u00e2\u0080\u00a2", "•"],
  ["\u00c2\u00ba", "º"],
  ["\u00c2\u00aa", "ª"],
  ["\u00c2\u00b0", "°"],
  ["\u00c2\u00a9", "©"],
  ["\u00c2\u00ae", "®"],
];
const UTF8_DECODER =
  typeof TextDecoder !== "undefined"
    ? new TextDecoder("utf-8", { fatal: false })
    : null;

function hasMojibake(str) {
  return TEXT_MOJIBAKE_REGEX.test(str);
}

function decodeLatin1ToUtf8(str) {
  if (!UTF8_DECODER) return null;

  const bytes = new Uint8Array(str.length);

  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    if (code > 255) {
      return null;
    }
    bytes[i] = code;
  }

  try {
    return UTF8_DECODER.decode(bytes);
  } catch (_error) {
    return null;
  }
}

function normalizePortugueseText(value) {
  if (value === null || value === undefined) return value;

  let text = String(value);
  if (!text.trim()) return text.trim();

  const original = text;
  text = text.trim();

  if (hasMojibake(text)) {
    const decoded = decodeLatin1ToUtf8(text);
    if (decoded && decoded.trim()) {
      text = decoded.trim();
    }
  }

  text = text
    .replace(/\u00C2\u00A0/g, " ")
    .replace(/\u00C2(?=[^\w\s])/g, "")
    .replace(/\u00C2\s/g, " ")
    .replace(/\uFFFD/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([!?.,;:])/g, "$1")
    .replace(/([(\[{])\s+/g, "$1")
    .replace(/\s+([\)\]}])/g, "$1");

  TEXT_MOJIBAKE_REPLACEMENTS.forEach(([wrong, right]) => {
    if (text.includes(wrong)) {
      text = text.split(wrong).join(right);
    }
  });

  return text || original.trim();
}

function interpretPlaybackStatus(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).toLowerCase();

  if (
    normalized === "playing" ||
    normalized === "play" ||
    normalized === "buffering" ||
    normalized === "resume" ||
    normalized === "run" ||
    normalized === "start" ||
    normalized === "on"
  ) {
    return true;
  }

  if (
    normalized === "paused" ||
    normalized === "pause" ||
    normalized === "stopped" ||
    normalized === "stop" ||
    normalized === "idle" ||
    normalized === "standby" ||
    normalized === "off"
  ) {
    return false;
  }

  return null;
}

if (typeof window.musicPlayerUI.currentPlaying !== "boolean") {
  window.musicPlayerUI.currentPlaying = false;
}
// (Removido: HUBITAT_DIRECT_URL / HUBITAT_ACCESS_TOKEN do frontend por segurança)

// Função para mostrar erro ao usuário
function showErrorMessage(message) {
  // Criar modal de erro
  const errorModal = document.createElement("div");
  errorModal.className = "error-modal";
  errorModal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        padding: 24px;
        max-width: 90vw;
        min-width: 320px;
        z-index: 10000;
        text-align: center;
    `;

  errorModal.innerHTML = `
        <h3 style="margin-bottom: 12px; font-size: 1.4rem;">⚠️Erro de Conexão</h3>
        <p style="margin-bottom: 20px; line-height: 1.5;">${message}</p>
        <button onclick="this.parentElement.remove()" style="
            background: linear-gradient(135deg, #e74c3c, #c0392b);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 12px;
            cursor: pointer;
            font-weight: 600;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        " onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 6px 20px rgba(231, 76, 60, 0.4)'" 
           onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='none'">Fechar</button>
    `;

  document.body.appendChild(errorModal);

  // Remover automaticamente após 10 segundos
  setTimeout(() => {
    if (errorModal.parentElement) {
      errorModal.remove();
    }
  }, 10000);
}

// Fallback direto via Maker API (cloud). Usa appBaseUrl/accessToken do config.js
async function loadAllDeviceStatesDirect(deviceIds) {
  // Agora usa o proxy /polling em vez de chamar o Hubitat diretamente
  let idsArray = deviceIds;
  if (!Array.isArray(idsArray)) {
    idsArray =
      typeof idsArray === "string"
        ? idsArray.split(",").map((id) => id.trim())
        : [];
  }

  // Monta a URL do proxy com a lista de IDs
  const idsParam = idsArray.length > 0 ? idsArray.join(",") : "";
  const url = `${POLLING_URL}?devices=${encodeURIComponent(idsParam)}`;
  console.log("📡 [fallback-proxy] Fetching via proxy:", url);

  const response = await fetch(url, { method: "GET", mode: "cors" });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Polling proxy falhou: HTTP ${response.status} ${response.statusText}`,
    );
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    console.error(
      "⚠️ [fallback-proxy] Resposta não é JSON:",
      text.slice(0, 300),
    );
    throw err;
  }

  // O proxy já retorna no formato { success, devices }
  return data;
}

// Função para testar Configurações do Hubitat
async function testHubitatConnection() {
  console.log("🔧 Testando Conexão com Hubitat...");

  try {
    // Testar conectividade publica da Function
    const response = await fetch(`${POLLING_URL}?health=1`);
    console.log("🔧 Status da resposta:", response.status);
    console.log(
      "🔧 Headers da resposta:",
      Object.fromEntries(response.headers.entries()),
    );

    const responseText = await response.text();
    console.log("🔧 Conteúdo da resposta:", responseText.substring(0, 300));

    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        console.log("✅ Conexão OK - Dados:", data);
        return true;
      } catch (e) {
        console.error("⚠️Resposta não é JSON válido:", e);
        return false;
      }
    } else {
      console.error("⚠️Erro HTTP:", response.status, response.statusText);
      return false;
    }
  } catch (error) {
    console.error("⚠️Erro na Conexão:", error);
    return false;
  }
}

// Helpers de URL para endpoints comuns da API
function urlDeviceInfo(deviceId) {
  return `${HUBITAT_PROXY_URL}?device=${deviceId}`;
}

function urlSendCommand(deviceId, command, value) {
  // SEMPRE usar o proxy para evitar CORS e 404
  return `${HUBITAT_PROXY_URL}?device=${deviceId}&command=${encodeURIComponent(
    command,
  )}${value !== undefined ? `&value=${encodeURIComponent(value)}` : ""}`;
}

async function sendHubitatCommand(deviceId, command, value) {
  return enqueueDeviceCommand(deviceId, async () => {
    console.log(
      `📡 [sendHubitatCommand] Enviando comando: ${command} para dispositivo ${deviceId}${
        value !== undefined ? ` com valor ${value}` : ""
      }`,
    );
    const commandState = deriveSwitchStateFromCommand(command, value);
    const normalizedDeviceId = String(deviceId);
    const bypassHubitat = isHubitatBypassMode();

    try {
      if (!bypassHubitat && !canControlDeviceId(normalizedDeviceId)) {
        throw new Error("Acesso negado para este dispositivo");
      }

      if (bypassHubitat) {
        if (commandState !== null) {
          setStoredState(normalizedDeviceId, commandState);
        }
        const modeTag = isCinematicModeEnabled()
          ? "CINEMA local"
          : "DEV state-only";
        console.warn(
          `🧪 [${modeTag}] Comando simulado: ${command} -> dispositivo ${deviceId}${
            value !== undefined ? ` (valor ${value})` : ""
          }`,
        );
        return {
          ok: true,
          simulated: true,
          mode: isCinematicModeEnabled() ? "cinematic" : "state-only-dev",
          deviceId: String(deviceId),
          command: String(command),
          value: value !== undefined ? value : null,
        };
      }

      // Segurança: comandos diretos no frontend continuam desativados.
      if (!isProduction && !useHubitatCloud(deviceId)) {
        throw new Error("Envio direto desativado no modo desenvolvimento");
      }

      const requestUrl = urlSendCommand(deviceId, command, value);
      console.log(`📡 [sendHubitatCommand] URL: ${requestUrl}`);

      const { response, text } = await fetchTextWithRetry(
        requestUrl,
        { method: "GET", mode: "cors" },
        {
          maxRetries: NETWORK_CONFIG.COMMAND_MAX_RETRY_ATTEMPTS,
          timeoutMs: NETWORK_CONFIG.COMMAND_TIMEOUT_PER_ATTEMPT,
        },
      );

      console.log(
        `📡 [sendHubitatCommand] Resposta (status ${response.status}):`,
        String(text).substring(0, 200),
      );

      if (commandState !== null) {
        setStoredState(normalizedDeviceId, commandState);
      }

      // Tenta parse JSON, mas aceita resposta vazia
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    } catch (error) {
      console.error("📡 [sendHubitatCommand] Erro ao enviar comando:", error);
      throw error;
    }
  });
}

// --- Cortinas (abrir/parar/fechar) ---
function getCurtainActionPlanFromElement(el, action) {
  if (!el || !action) return [];

  const resolveCurtainIds = () => {
    const rawIds =
      el?.dataset?.deviceIds ||
      el?.closest?.("[data-device-ids]")?.dataset?.deviceIds ||
      "";

    const parsedIds = String(rawIds)
      .split(",")
      .map((id) => String(id || "").trim())
      .filter(Boolean);

    if (parsedIds.length > 0) {
      return parsedIds;
    }

    const singleId =
      el?.dataset?.deviceId ||
      el?.closest?.("[data-device-id]")?.dataset?.deviceId;

    return singleId ? [String(singleId)] : [];
  };

  const buildFallbackPlan = () => {
    const ids = resolveCurtainIds();
    if (!ids.length) return [];

    const directCommand =
      el?.dataset?.cmd || el?.closest?.("[data-cmd]")?.dataset?.cmd || action;

    const directValue =
      el?.dataset?.value ?? el?.closest?.("[data-value]")?.dataset?.value;

    return ids.map((id) => {
      const payload = {
        id: String(id),
        command: String(directCommand || action),
      };
      if (
        directValue !== undefined &&
        directValue !== null &&
        directValue !== ""
      ) {
        payload.value = directValue;
      }
      return payload;
    });
  };

  const actionKey = `action${action.charAt(0).toUpperCase()}${action.slice(1)}`;
  const rawPlan =
    el?.dataset?.[actionKey] ||
    el?.closest?.("[data-device-id],[data-device-ids]")?.dataset?.[actionKey];

  if (!rawPlan) return buildFallbackPlan();

  try {
    let parsed = [];

    try {
      parsed = JSON.parse(rawPlan);
    } catch (_) {
      parsed = JSON.parse(decodeURIComponent(rawPlan));
    }

    if (!Array.isArray(parsed)) return buildFallbackPlan();

    const normalized = parsed
      .map((item) => {
        const id = item?.id || item?.deviceId;
        const command = item?.command || item?.cmd || action;
        if (!id || !command) return null;
        const payload = {
          id: String(id),
          command: String(command),
        };
        if (item?.value !== undefined) {
          payload.value = item.value;
        }
        return payload;
      })
      .filter(Boolean);

    return normalized.length > 0 ? normalized : buildFallbackPlan();
  } catch (error) {
    console.warn("Falha ao ler plano de ação da cortina:", error);
    return buildFallbackPlan();
  }
}

function sendCurtainCommandBatch(actionPlan, action) {
  if (!Array.isArray(actionPlan) || actionPlan.length === 0) {
    return Promise.resolve([]);
  }

  const normalizedAction = String(action || "").toLowerCase();
  const persistState =
    normalizedAction === "open" || normalizedAction === "close";
  const nextState = normalizedAction === "open" ? "open" : "closed";

  const commands = actionPlan.map((item) => {
    recentCommands.set(item.id, Date.now());
    if (persistState) {
      setCurtainState(item.id, nextState);
    }
    return sendHubitatCommand(item.id, item.command, item.value);
  });

  return Promise.allSettled(commands);
}

function sendCurtainCommand(deviceId, action, commandName, value) {
  const commandMap = {
    open: "open",
    stop: "stop",
    close: "close",
  };
  const commandToSend = commandName || commandMap[action];
  if (!commandToSend) throw new Error("Ação de cortina inválida");
  return sendHubitatCommand(deviceId, commandToSend, value);
}

function curtainAction(el, action) {
  try {
    const actionPlan = getCurtainActionPlanFromElement(el, action);
    if (actionPlan.length > 0) {
      console.log(
        `🪟 curtainAction em lote: action=${action}, dispositivos=${actionPlan
          .map((item) => item.id)
          .join(",")}`,
      );
      return sendCurtainCommandBatch(actionPlan, action);
    }

    const id =
      el?.dataset?.deviceId ||
      el.closest("[data-device-id]")?.dataset?.deviceId;

    console.log(
      `🪟 curtainAction chamada: action=${action}, id=${id}, el=`,
      el,
    );

    if (!id) {
      console.error("🪟 ERRO: ID do dispositivo não encontrado!");
      return;
    }

    // Suporte a comandos diretos push1, push2, push3, push4
    if (action.startsWith("push")) {
      console.log(`🪟 Cortina (ID ${id}): enviando comando direto ${action}`);
      return sendHubitatCommand(id, action)
        .then((result) => {
          console.log(
            `🪟 Comando ${action} enviado com sucesso para ID ${id}:`,
            result,
          );
        })
        .catch((err) => {
          console.error(
            `🪟 ERRO ao enviar comando ${action} para ID ${id}:`,
            err,
          );
        });
    }

    const cmd = el?.dataset?.cmd;
    const value = el?.dataset?.value;
    return sendCurtainCommand(id, action, cmd, value);
  } catch (e) {
    console.error("Falha ao acionar cortina:", e);
    return;
  }
}

// Master on/off (Home quick toggle) removido completamente

// --- Override legado para contornar CORS ---
// Mantido desativado por padrão: /hubitat-proxy já resolve CORS e
// o sender principal tem fila + retry mais confiáveis.
const ENABLE_HUBITAT_CORS_BYPASS = false;
try {
  if (ENABLE_HUBITAT_CORS_BYPASS && typeof sendHubitatCommand === "function") {
    const _corsBypassSend = function (deviceId, command, value) {
      const baseUrl = urlSendCommand(deviceId, command, value);
      // Adiciona cache-buster para evitar SW/cache do navegador
      const url =
        baseUrl + (baseUrl.includes("?") ? "&" : "?") + `_ts=${Date.now()}`;
      console.log(`Enviando comando para o Hubitat (no-cors): ${url}`);
      try {
        return fetch(url, {
          mode: "no-cors",
          cache: "no-store",
          credentials: "omit",
          redirect: "follow",
          referrerPolicy: "no-referrer",
          keepalive: true,
        })
          .then(() => null)
          .catch((err) => {
            try {
              const beacon = new Image();
              beacon.referrerPolicy = "no-referrer";
              beacon.src = url;
            } catch (_) {
              /* ignore */
            }
            console.error("Erro ao enviar comando (CORS?):", err);
            return null;
          });
      } catch (e) {
        try {
          const beacon = new Image();
          beacon.referrerPolicy = "no-referrer";
          beacon.src = url;
        } catch (_) {
          /* ignore */
        }
        return Promise.resolve(null);
      }
    };
    // Sobrescreve Função original
    // eslint-disable-next-line no-global-assign
    sendHubitatCommand = _corsBypassSend;
  }
} catch (_) {
  /* ignore */
}

// --- Polling automático de estados ---

const POLLING_INTERVAL_BASE_MS = 5000;
const POLLING_INTERVAL_STEP_MS = 2000;
const POLLING_INTERVAL_MAX_MS = 20000;
let currentPollingInterval = POLLING_INTERVAL_BASE_MS;
let pollingTimerHandle = null;
let pollingActive = false;
let pollingFailureCount = 0;
let pollingPausedForVisibility = false;
let pollingAbortController = null;

// Sistema para evitar conflitos entre comandos manuais e polling
const recentCommands = new Map(); // deviceId -> timestamp do último comando
const COMMAND_PROTECTION_MS = 3000; // Proteção curta para evitar "travar" feedback visual

function cleanupExpiredCommands() {
  const now = Date.now();
  for (const [deviceId, timestamp] of recentCommands.entries()) {
    if (now - timestamp > COMMAND_PROTECTION_MS) {
      recentCommands.delete(deviceId);
    }
  }
}

function scheduleNextPollingRun(delay) {
  if (!pollingActive) return;

  const safeDelay = Math.max(delay, 500);

  if (pollingTimerHandle !== null) {
    clearTimeout(pollingTimerHandle);
  }

  pollingTimerHandle = setTimeout(function () {
    pollingTimerHandle = null;
    updateDeviceStatesFromServer();
  }, safeDelay);

  debugLog(() => ["scheduleNextPollingRun", safeDelay]);
}

function startPolling() {
  if (pollingActive) return;

  if (isHubitatBypassMode()) {
    debugLog(() => ["Polling desativado em modo local (cinematic/state-only)"]);
    return;
  }

  if (!isProduction) {
    debugLog(() => ["Polling desativado em ambiente de desenvolvimento"]);
    return;
  }

  pollingActive = true;
  pollingFailureCount = 0;
  currentPollingInterval = POLLING_INTERVAL_BASE_MS;

  updateDeviceStatesFromServer();

  console.log(
    "Polling iniciado - intervalo base",
    POLLING_INTERVAL_BASE_MS / 1000,
    "segundos",
  );
}

function stopPolling() {
  if (!pollingActive) return;

  pollingActive = false;
  pollingFailureCount = 0;
  currentPollingInterval = POLLING_INTERVAL_BASE_MS;

  if (pollingTimerHandle !== null) {
    clearTimeout(pollingTimerHandle);
    pollingTimerHandle = null;
  }

  console.log("Polling parado");
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      if (pollingActive) {
        pollingPausedForVisibility = true;
        stopPolling();
      }
    } else if (pollingPausedForVisibility) {
      pollingPausedForVisibility = false;
      startPolling();
    }
  });
}

async function updateDeviceStatesFromServer(options = {}) {
  const skipSchedule = Boolean(options && options.skipSchedule);
  const forceUpdate = Boolean(options && options.forceUpdate);
  let hasStateChanges = false;
  let encounteredError = false;

  try {
    cleanupExpiredCommands();

    if (isHubitatBypassMode()) {
      debugLog(() => ["Polling skipped (Hubitat bypass mode)"]);
      return;
    }

    if (!isProduction) {
      debugLog(() => ["Polling skipped (dev mode)"]);
      return;
    }

    const pollingDeviceIds = getPollingDeviceIds();
    const deviceIds = pollingDeviceIds.join(",");
    const pollingUrl = `${POLLING_URL}?devices=${deviceIds}`;

    debugLog(() => [
      "pollingRequest",
      { interval: currentPollingInterval, url: pollingUrl },
    ]);

    if (pollingAbortController) {
      pollingAbortController.abort();
    }
    pollingAbortController = new AbortController();

    const response = await fetch(pollingUrl, {
      cache: "no-store",
      signal: pollingAbortController.signal,
    });
    const rawText = await response.text();

    if (!response.ok) {
      throw new Error(`Polling failed: ${response.status}`);
    }

    let data;
    let devicesMap;

    const trimmed = (rawText || "").trim();
    const looksLikeHtml =
      trimmed.startsWith("<!DOCTYPE html") || trimmed.startsWith("<html");

    if (looksLikeHtml) {
      console.warn(
        "⚠️ Polling retornou HTML (Cloudflare Functions falhando). Tentando fallback Maker API...",
      );
      const direct = await loadAllDeviceStatesDirect(pollingDeviceIds);
      devicesMap = direct.devices;
    } else {
      try {
        data = JSON.parse(rawText);
      } catch (err) {
        console.warn(
          "⚠️ Polling JSON parse falhou, tentando fallback Maker API...",
          err,
        );
        const direct = await loadAllDeviceStatesDirect(pollingDeviceIds);
        devicesMap = direct.devices;
      }

      if (!devicesMap && data) {
        devicesMap = data.devices;
      }
    }

    if (!devicesMap && data && Array.isArray(data.data)) {
      devicesMap = {};
      data.data.forEach((device) => {
        if (!device || !device.id) {
          return;
        }

        let state = "off";
        let level = null;

        if (Array.isArray(device.attributes)) {
          const switchAttr = device.attributes.find(
            (attribute) => attribute.name === "switch",
          );
          state = switchAttr?.currentValue || switchAttr?.value || "off";

          const levelAttr = device.attributes.find(
            (attribute) => attribute.name === "level",
          );
          if (levelAttr) {
            level = levelAttr?.currentValue ?? levelAttr?.value ?? level;
          }
        } else if (device.attributes && typeof device.attributes === "object") {
          if (device.attributes.switch !== undefined) {
            state = device.attributes.switch;
          } else {
            debugLog(() => ["Polling skip device (no switch)", device.id]);
            return;
          }

          if (device.attributes.level !== undefined) {
            level = device.attributes.level;
          }
        }

        devicesMap[device.id] = { state, success: true };

        if (level !== null && level !== undefined) {
          devicesMap[device.id].level = level;
        }

        if (device.attributes && device.attributes.volume !== undefined) {
          devicesMap[device.id].volume = device.attributes.volume;
        }
      });
    }

    if (!devicesMap) {
      debugLog(() => ["Polling response sem devices", data]);
      return;
    }
    const activeDenonDeviceId = String(
      getDenonCommandDeviceIdForCurrentRoute(),
    );

    Object.entries(devicesMap).forEach(([deviceId, deviceData]) => {
      if (!deviceData) {
        return;
      }

      if (deviceData.success) {
        const previousState = normalizeSwitchState(getStoredState(deviceId));
        const nextLevel = deviceData.level;
        const nextState = normalizeSwitchState(
          deviceData.state,
          nextLevel !== null &&
            nextLevel !== undefined &&
            clampDimmerValue(nextLevel, 0) > 0
            ? "on"
            : "off",
        );

        if (previousState !== nextState) {
          hasStateChanges = true;
        }

        setStoredState(deviceId, nextState);
        updateDeviceUI(
          deviceId,
          {
            state: nextState,
            level: nextLevel,
          },
          forceUpdate,
        );

        if (
          String(deviceId) === activeDenonDeviceId &&
          deviceData.volume !== undefined
        ) {
          updateDenonVolumeUI(deviceData.volume, activeDenonDeviceId);
        }
      } else {
        console.warn(`Falha no device ${deviceId}:`, deviceData.error);
      }
    });

    if (typeof updateMasterLightToggleState === "function") {
      updateMasterLightToggleState();
    }
  } catch (error) {
    if (
      error?.name === "AbortError" ||
      pollingAbortController?.signal?.aborted ||
      /aborted|NetworkError/i.test(String(error?.message || ""))
    ) {
      return;
    }
    encounteredError = true;
    console.error("Erro no polling:", error);

    if (
      error.message.includes("JSON.parse") ||
      error.message.includes("unexpected character")
    ) {
      console.error("PARANDO POLLING - Cloudflare Functions não funcionam");
      stopPolling();
      return;
    }
  } finally {
    if (!skipSchedule && pollingActive) {
      if (encounteredError) {
        pollingFailureCount += 1;
        currentPollingInterval = Math.min(
          Math.round(currentPollingInterval * 1.5) || POLLING_INTERVAL_BASE_MS,
          POLLING_INTERVAL_MAX_MS,
        );
      } else if (hasStateChanges) {
        pollingFailureCount = 0;
        currentPollingInterval = POLLING_INTERVAL_BASE_MS;
      } else {
        pollingFailureCount = 0;
        currentPollingInterval = Math.min(
          currentPollingInterval + POLLING_INTERVAL_STEP_MS,
          POLLING_INTERVAL_MAX_MS,
        );
      }

      debugLog(() => [
        "pollingNextInterval",
        {
          encounteredError,
          hasStateChanges,
          nextInterval: currentPollingInterval,
          failureCount: pollingFailureCount,
        },
      ]);

      scheduleNextPollingRun(currentPollingInterval);
    }
  }
}

function escapeDeviceIdForSelector(deviceId) {
  return String(deviceId).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function getControlElementsForDevice(deviceId) {
  const deviceKey = String(deviceId || "");
  if (!deviceKey) return [];

  const cachedRegistry = deviceControlCache.get(deviceKey);
  let controls = [];

  if (cachedRegistry && cachedRegistry.size > 0) {
    cachedRegistry.forEach((el) => {
      if (el?.isConnected) {
        controls.push(el);
      } else {
        cachedRegistry.delete(el);
      }
    });

    if (cachedRegistry.size === 0) {
      deviceControlCache.delete(deviceKey);
    }
  }

  if (controls.length > 0) {
    return controls;
  }

  const selectorId = escapeDeviceIdForSelector(deviceKey);
  const discovered = Array.from(
    document.querySelectorAll(`[data-device-id="${selectorId}"]`),
  );

  if (discovered.length > 0) {
    discovered.forEach((el) => registerControlElement(el));
  }

  return discovered;
}

function updateDeviceUI(deviceId, stateOrData, forceUpdate = false) {
  // Verificar se o DOM está pronto
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () =>
      updateDeviceUI(deviceId, stateOrData, forceUpdate),
    );
    return;
  }

  let level = null;
  let state = stateOrData;

  if (stateOrData && typeof stateOrData === "object") {
    state =
      stateOrData.state !== undefined
        ? stateOrData.state
        : stateOrData.switch !== undefined
          ? stateOrData.switch
          : stateOrData.value !== undefined
            ? stateOrData.value
            : stateOrData;

    if (stateOrData.level !== undefined) {
      level = clampDimmerValue(stateOrData.level, stateOrData.level);
    }
  }

  const normalizedState = normalizeSwitchState(
    state,
    level !== null && level !== undefined && clampDimmerValue(level, 0) > 0
      ? "on"
      : "off",
  );
  const normalizedDeviceId = String(deviceId);

  // Verificar se há comando recente que deve ser respeitado
  if (!forceUpdate) {
    const lastCommand =
      recentCommands.get(normalizedDeviceId) || recentCommands.get(deviceId);
    if (lastCommand && Date.now() - lastCommand < COMMAND_PROTECTION_MS) {
      return;
    }
  }

  const previousStoredState = normalizeSwitchState(
    getStoredState(normalizedDeviceId),
  );
  if (previousStoredState !== normalizedState) {
    setStoredState(normalizedDeviceId, normalizedState);
  }

  // Atualizar controles de cômodo (room-control E control-card)
  const roomControls = getControlElementsForDevice(normalizedDeviceId);
  debugLog(() => [
    "updateDeviceUI",
    {
      deviceId: normalizedDeviceId,
      state,
      controls: roomControls.length,
      forceUpdate,
    },
  ]);

  roomControls.forEach((el, index) => {
    debugLog(() => [
      "updateDeviceUI:control",
      {
        deviceId: normalizedDeviceId,
        index: index + 1,
        classes: el.className,
        currentState: el.dataset.state,
      },
    ]);

    // Suporta tanto .room-control quanto .control-card
    if (
      el.classList.contains("room-control") ||
      el.classList.contains("control-card")
    ) {
      const currentState = el.dataset.state;
      const needsVisualSync = needsControlVisualSync(el, normalizedState);
      if (currentState !== normalizedState || forceUpdate || needsVisualSync) {
        debugLog(() => [
          "updateDeviceUI:apply",
          {
            deviceId: normalizedDeviceId,
            from: currentState,
            to: normalizedState,
            forceUpdate,
            needsVisualSync,
          },
        ]);
        setRoomControlUI(el, normalizedState);
        if (level !== null) {
          applyDimmerLevelToControl(el, level);
        }
      }
    } else {
      debugLog(() => [
        "updateDeviceUI:skip-unsupported",
        { deviceId: normalizedDeviceId, classes: el.className },
      ]);
    }
  });

  // Atualizar botões master da home após qualquer mudança de dispositivo
  const activeDenonDeviceId = String(getDenonCommandDeviceIdForCurrentRoute());
  if (normalizedDeviceId === activeDenonDeviceId) {
    applyDenonPowerState(state, activeDenonDeviceId);
  }

  if (typeof syncHomeLightButtons === "function") {
    syncHomeLightButtons();
  }
}

// === botão de luz (home card) ===
function getHomeQuickAction(route, type) {
  if (!route || typeof getEnvironment !== "function") return null;
  const env = getEnvironment(route);
  const actions = Array.isArray(env?.quickActions) ? env.quickActions : [];
  if (!actions.length) return null;
  if (!type) return actions[0] || null;
  return (
    actions.find(
      (action) =>
        String(action?.type || "").toLowerCase() === String(type).toLowerCase(),
    ) || null
  );
}

function normalizeQuickActionDevices(action) {
  const devices = Array.isArray(action?.devices) ? action.devices : [];
  return devices.map((device) => ({
    id: String(device.id),
    commandOn: device.commandOn || device.on || "on",
    commandOff: device.commandOff || device.off || "off",
    valueOn:
      device.valueOn !== undefined
        ? device.valueOn
        : device.level !== undefined
          ? device.level
          : device.defaultLevel !== undefined
            ? device.defaultLevel
            : null,
  }));
}

function anyQuickActionOn(devices) {
  return (devices || []).some(
    (device) => (getStoredState(device.id) || "off") === "on",
  );
}

function setHomeLightButtonIcon(button, state) {
  const iconOn =
    button.dataset.iconOn ||
    (typeof getUiToggleIcon === "function" && getUiToggleIcon("light", "on")) ||
    "images/icons/icon-small-light-on.svg";
  const iconOff =
    button.dataset.iconOff ||
    (typeof getUiToggleIcon === "function" &&
      getUiToggleIcon("light", "off")) ||
    "images/icons/icon-small-light-off.svg";

  const img = button.querySelector(".room-master-icon");
  if (!img) return;

  const nextIcon = state === "on" ? iconOn : iconOff;
  button.dataset.state = state;

  if (img.getAttribute("src") !== nextIcon) {
    img.classList.add("is-fading");
    setTimeout(() => {
      img.setAttribute("src", nextIcon);
      img.classList.remove("is-fading");
    }, 120);
  }
}

function setHomeMasterButtonLoading(button, loading) {
  if (!button) return;
  const isLoading = Boolean(loading);
  button.dataset.loading = isLoading ? "true" : "false";
  button.classList.toggle("loading", isLoading);
  button.disabled = isLoading;
}

function syncHomeLightButtons() {
  document.querySelectorAll(".room-master-btn").forEach((btn) => {
    const route = btn.dataset.route || "";
    const actionType = btn.dataset.action || "lights";
    const action = getHomeQuickAction(route, actionType);
    if (!action) return;
    const devices = normalizeQuickActionDevices(action);
    if (!devices.length) return;
    const state = anyQuickActionOn(devices) ? "on" : "off";
    setHomeLightButtonIcon(btn, state);
  });
}

async function onHomeMasterClick(event, button) {
  event.preventDefault();
  event.stopPropagation();
  if (!button || button.dataset.loading === "true") return;

  const route = button?.dataset?.route || "";
  const actionType = button?.dataset?.action || "lights";
  const action = getHomeQuickAction(route, actionType);
  if (!action) return;

  const devices = normalizeQuickActionDevices(action);
  if (!devices.length) return;

  const currentState = anyQuickActionOn(devices) ? "on" : "off";
  const nextState = currentState === "on" ? "off" : "on";
  const HOME_MASTER_MAX_PARALLEL = 3;
  const HOME_MASTER_RETRY_ATTEMPTS = 2;
  const HOME_MASTER_RETRY_DELAY_MS = 200;

  setHomeMasterButtonLoading(button, true);
  setHomeLightButtonIcon(button, nextState);

  const runCommandsForDevice = async (device) => {
    const deviceId = device.id;
    recentCommands.set(deviceId, Date.now());

    const desiredState = nextState === "on" ? "on" : "off";
    const rollbackState = currentState === "on" ? "on" : "off";
    setStoredState(deviceId, desiredState);

    const commands = [];
    if (nextState === "off") {
      commands.push({ command: device.commandOff });
    } else if (device.commandOn === "setLevel") {
      const levelToSet = clampDimmerValue(device.valueOn, 80);
      // Dimmer em nuvem é mais confiável com "on" + "setLevel" em sequência.
      commands.push({ command: "on" });
      commands.push({ command: "setLevel", value: String(levelToSet) });
    } else {
      commands.push({ command: device.commandOn });
    }

    let lastError = null;
    for (let attempt = 1; attempt <= HOME_MASTER_RETRY_ATTEMPTS; attempt += 1) {
      try {
        for (const item of commands) {
          await sendHubitatCommand(deviceId, item.command, item.value);
        }
        return { ok: true, deviceId };
      } catch (error) {
        lastError = error;
        if (attempt < HOME_MASTER_RETRY_ATTEMPTS) {
          await sleep(HOME_MASTER_RETRY_DELAY_MS);
        }
      }
    }

    setStoredState(deviceId, rollbackState);
    updateDeviceUI(deviceId, rollbackState, true);
    console.warn(
      `⚠️Master lights: falha ao enviar comandos para ${deviceId} após retries`,
      lastError,
    );
    return { ok: false, deviceId };
  };

  const failures = [];

  try {
    for (let i = 0; i < devices.length; i += HOME_MASTER_MAX_PARALLEL) {
      const chunk = devices.slice(i, i + HOME_MASTER_MAX_PARALLEL);
      const results = await Promise.all(chunk.map(runCommandsForDevice));

      results.forEach((result) => {
        if (!result?.ok) {
          failures.push(result.deviceId);
        }
      });
    }

    if (failures.length === devices.length) {
      setHomeLightButtonIcon(button, currentState);
    }
  } finally {
    setHomeMasterButtonLoading(button, false);
  }

  if (typeof updateDeviceStatesFromServer === "function") {
    setTimeout(() => {
      updateDeviceStatesFromServer({
        skipSchedule: true,
        forceUpdate: true,
      }).catch(() => {});
    }, 250);
  }
}

// Função auxiliar para verificar se alguma cortina está aberta
function anyCurtainOpen(curtainIds) {
  // Verifica se alguma cortina do grupo está aberta
  return (curtainIds || []).some((id) => {
    const state = getCurtainState(id);
    console.log(`🔍 Cortina ${id}: estado = ${state}`);
    return state === "open";
  });
}

// Função para obter o estado atual da cortina
function getCurtainState(curtainId) {
  // Buscar no localStorage ou usar um estado padrão
  const state = localStorage.getItem(`curtain_${curtainId}_state`) || "closed";
  return state; // retorna 'open' ou 'closed'
}

// Função para obter o último comando de cortina
function getLastCurtainCommand(curtainId) {
  const state = getCurtainState(curtainId);
  return state === "closed" ? "close" : "open"; // normalizar para comando
}

// Função para armazenar o estado da cortina
function setCurtainState(curtainId, state) {
  localStorage.setItem(`curtain_${curtainId}_state`, state);
}

// Função para obter estado da cortina
function getCurtainState(curtainId) {
  try {
    return localStorage.getItem(`curtain_${curtainId}_state`) || "closed";
  } catch (error) {
    console.error("⚠️Erro ao obter estado da cortina:", error);
    return "closed";
  }
}

function setCurtainMasterIcon(btn, state, forceUpdate = false) {
  if (!forceUpdate && btn.dataset.pending === "true") {
    debugLog(() => ["curtainMasterPending", btn.dataset.curtainIds]);
    return;
  }

  const img = btn.querySelector("img");
  if (!img) return;

  const nextIcon =
    state === "open"
      ? "images/icons/curtain-open.svg"
      : "images/icons/curtain-closed.svg";
  const currentSrc = img.src || "";

  if (!currentSrc.includes(nextIcon.split("/").pop())) {
    img.src = nextIcon;
    btn.dataset.state = state;
    debugLog(() => ["curtainMasterIconUpdated", state, btn.dataset.curtainIds]);
  }
}

// Função para definir o estado de loading do botão master de cortinas
function setCurtainMasterButtonLoading(btn, loading) {
  btn.dataset.loading = loading ? "true" : "false";
  if (loading) {
    btn.classList.add("loading");
    btn.dataset.pending = "true";
  } else {
    btn.classList.remove("loading");
    btn.dataset.pending = "false";
  }
}

// Função para atualizar ícones das cortinas individuais
function updateIndividualCurtainButtons(curtainIds, command) {
  curtainIds.forEach((curtainId) => {
    const button = document.querySelector(`[data-device-id="${curtainId}"]`);
    if (button && button.querySelector(".device-icon")) {
      const icon = button.querySelector(".device-icon");
      icon.src =
        command === "open"
          ? "images/icons/curtain-open.svg"
          : "images/icons/curtain-closed.svg";
      icon.alt = command === "open" ? "Cortina Aberta" : "Cortina Fechada";
    }
  });
}

// Função chamada pelo onclick dos botões master de cortinas na home
function onHomeCurtainMasterClick(event, button) {
  console.log("🖱️ onHomeCurtainMasterClick chamada!", button);
  event.preventDefault();
  event.stopPropagation();

  // Verificar se já está carregando
  if (button.dataset.loading === "true") {
    console.log("⏸️ Botão de cortina já está carregando, ignorando clique");
    return;
  }

  const envKey = button?.dataset?.route || null;
  const curtainIds =
    envKey && typeof getEnvironmentCurtainIds === "function"
      ? getEnvironmentCurtainIds(envKey)
      : (button.dataset.curtainIds || "").split(",").filter(Boolean);
  console.log("🔍 Curtain IDs encontrados:", curtainIds);

  if (curtainIds.length === 0) {
    console.log("⚠️Nenhum curtain ID encontrado");
    return;
  }

  // Determinar comando baseado no estado atual das cortinas
  console.log(
    "🔍 Verificando estados individuais das cortinas:",
    curtainIds.map((id) => ({ id, state: getCurtainState(id) })),
  );
  const currentState = anyCurtainOpen(curtainIds) ? "open" : "closed";
  const newCommand = currentState === "open" ? "close" : "open";
  console.log(
    "🎯 Comando de cortina determinado:",
    currentState,
    "→",
    newCommand,
  );

  // Atualizar UI imediatamente (antes do loading)
  setCurtainMasterIcon(button, newCommand, true); // forçar atualização

  // Ativar loading visual
  console.log("🔄 Ativando loading visual no botão de cortina...");
  setCurtainMasterButtonLoading(button, true);

  // Atualizar ícones dos botões individuais imediatamente
  updateIndividualCurtainButtons(curtainIds, newCommand);

  // Enviar comandos para todas as cortinas
  const promises = curtainIds.map((curtainId) => {
    // Marcar comando recente
    recentCommands.set(curtainId, Date.now());
    // Armazenar o estado da cortina
    setCurtainState(curtainId, newCommand);
    return sendHubitatCommand(curtainId, newCommand);
  });

  // Aguardar conclusão de todos os comandos
  Promise.allSettled(promises).finally(() => {
    // Remover loading após comandos
    setTimeout(() => {
      setCurtainMasterButtonLoading(button, false);
    }, 1000); // 1 segundo de delay para feedback visual
  });
}

// === SISTEMA DE CARREGAMENTO GLOBAL ===

// Controle da tela de loading
let loaderFallbackTimeout = null;

function showLoader() {
  try {
    const loader = document.getElementById("global-loader");
    if (loader) {
      loader.classList.remove("hidden");
      loader.style.display = "flex"; // Forçar display
      loader.style.opacity = "1"; // Garantir opacidade visível
      loader.style.visibility = "visible"; // Garantir visibilidade
      updateProgress(0, "Iniciando carregamento...");
      console.log("📱 Loader exibido");

      const loaderSpinner = loader.querySelector(".loader-spinner");
      const loaderText = loader.querySelector(".loader-text");
      const loaderProgress = loader.querySelector(".loader-progress");
      const loaderContent = loader.querySelector(".loader-content");
      const resetTargets = [loaderSpinner, loaderText, loaderProgress];

      // Reativar animações resetando o elemento
      if (loaderContent) {
        loaderContent.style.animation = "none";
        // Forçar reflow para ativar animação novamente
        void loaderContent.offsetWidth;
        loaderContent.style.animation = "0.6s ease-out fadeInUp";
      }

      resetTargets.forEach((el) => {
        if (!el) return;
        el.style.transition = "";
        el.style.opacity = "";
        el.style.display = "";
      });

      if (loaderFallbackTimeout) {
        clearTimeout(loaderFallbackTimeout);
      }

      loaderFallbackTimeout = setTimeout(() => {
        const activeLoader = document.getElementById("global-loader");
        if (
          activeLoader &&
          activeLoader.style.display !== "none" &&
          !activeLoader.classList.contains("animating")
        ) {
          console.warn("Loader travado: iniciando animacao de fallback.");
          startHomeAnimation();
        }
      }, 9000);
    } else {
      console.warn("⚠️ Elemento loader não encontrado");
    }
  } catch (error) {
    console.error("⚠️Erro ao mostrar loader:", error);
  }
}

function hideLoader() {
  console.log("🟢 hideLoader FOI CHAMADA!");
  try {
    if (loaderFallbackTimeout) {
      clearTimeout(loaderFallbackTimeout);
      loaderFallbackTimeout = null;
    }

    const finalizeHide = () => {
      console.log("🟡 finalizeHide executando...");
      const loader = document.getElementById("global-loader");
      console.log("🟡 Loader encontrado em finalizeHide:", !!loader);
      if (loader) {
        // Start the orchestrated animation sequence
        startHomeAnimation();
      }
    };

    if (!assetPreloadComplete && assetPreloadPromise) {
      const pending = assetPreloadPromise;
      assetPreloadPromise = null;

      // Fail-safe: não prender a UI em caso de preload travado
      const failSafeMs = 6000;
      const failSafeTimeout = setTimeout(() => {
        console.warn(
          `⚠️Preload demorou mais que ${failSafeMs}ms; escondendo loader mesmo assim.`,
        );
        finalizeHide();
      }, failSafeMs);

      pending
        .catch((error) =>
          console.warn("Falha ao pré-carregar todos os assets", error),
        )
        .finally(() => {
          clearTimeout(failSafeTimeout);
          finalizeHide();
        });
      return;
    }

    finalizeHide();
  } catch (error) {
    console.error("Erro ao esconder loader:", error);
  }
}

// Orchestrated animation sequence from loading to home
function startHomeAnimation() {
  console.log("🔵 startHomeAnimation FOI CHAMADA!");
  const loader = document.getElementById("global-loader");
  console.log("🔵 Loader encontrado:", !!loader);

  if (!loader) {
    console.warn("⚠️ Loader not found, showing spa-root directly");
    document.body.classList.add("app-ready");
    return;
  }

  if (
    loader.dataset.fading === "true" ||
    loader.classList.contains("hidden") ||
    loader.style.display === "none"
  ) {
    document.body.classList.add("app-ready");
    return;
  }

  loader.dataset.fading = "true";
  console.log("🎬 Iniciando animação orquestrada...");

  // Verificar se os elementos da home existem
  const checkElements = () => {
    const roomCards = document.querySelectorAll(".room-card");
    const pageTitle =
      document.getElementById("spa-static-header") ||
      document.querySelector(".page-title.fixed-header");
    return roomCards.length > 0 && pageTitle;
  };

  // Executar a animação com pequeno delay para garantir que DOM está pronto
  if (checkElements()) {
    requestAnimationFrame(() => {
      executeOrchestratedAnimation(loader);
    });
  } else {
    // Aguardar até 500ms para elementos aparecerem
    console.log("🎬 Aguardando elementos da home...");
    let attempts = 0;
    const waitForElements = setInterval(() => {
      attempts++;
      if (checkElements() || attempts > 10) {
        clearInterval(waitForElements);
        if (checkElements()) {
          console.log("🎬 Elementos encontrados após " + attempts * 50 + "ms");
          executeOrchestratedAnimation(loader);
        } else {
          console.warn("⚠️ Elementos da home não encontrados, usando fallback");
          // Fallback: apenas esconder loader
          document.body.classList.add("app-ready");
          loader.style.display = "none";
          loader.classList.add("hidden");
        }
      }
    }, 50);
  }
}

function executeOrchestratedAnimation(loader) {
  console.log("🎬 executeOrchestratedAnimation INICIOU");

  // Elementos do loader
  const loaderLogo = loader.querySelector(".loader-logo");
  const loaderLogoBtnImg = loader.querySelector(".loader-logo-btn .logo-round");
  const loaderLine = document.getElementById("loader-line");

  // Elementos da home (buscar de novo para garantir que existem)
  const pageTitle =
    document.getElementById("spa-static-header") ||
    document.querySelector(".page-title.fixed-header");
  const headerLogo =
    (pageTitle && pageTitle.querySelector(".app-logo-trigger")) ||
    document.querySelector(".page-title.fixed-header .app-logo-trigger");
  const topBar =
    document.getElementById("spa-static-topbar") ||
    document.querySelector(".top-bar-custom");
  const roomCards = document.querySelectorAll(".room-card");
  const navbar = document.getElementById("spa-navbar");

  console.log("🎬 Elementos encontrados:", {
    loaderLogo: !!loaderLogo,
    loaderLogoBtnImg: !!loaderLogoBtnImg,
    loaderLine: !!loaderLine,
    headerLogo: !!headerLogo,
    topBar: !!topBar,
    roomCards: roomCards.length,
    navbar: !!navbar,
    pageTitle: !!pageTitle,
  });

  // ===== FASE 0: Preparação (0ms) =====
  // Ativar modo de animação orquestrada (desativa transições automáticas via CSS)
  document.body.classList.add("orchestrated-animation");
  document.body.classList.remove("reveal-home");

  // Preparar elementos da home (somente via CSS: opacity 0 durante orchestrated-animation)
  // Não aplicar transforms/staggers: queremos apenas um fade rápido.

  if (topBar) {
    topBar.style.opacity = "0";
    topBar.style.transform = "scaleX(0)";
  }
  if (pageTitle) {
    pageTitle.style.opacity = "0";
  }

  // Esconder logo do header (será substituído pelo logo do loader)
  if (headerLogo) headerLogo.style.opacity = "0";

  // Adicionar classe de transição ao loader (spinner/text/progress somem)
  loader.classList.add("transitioning");

  // Agora mostrar spa-root (CSS orchestrated-animation já força opacity:1)
  document.body.classList.add("app-ready");

  // ===== FASE 1: Logo começa a se mover (50ms - 1000ms) =====
  setTimeout(() => {
    if (loaderLogo && loaderLogoBtnImg) {
      loaderLogo.classList.add("transitioning");

      // Calcular posição do header onde o logo deve ir
      const loaderRect = loaderLogoBtnImg.getBoundingClientRect();

      // Posição inicial (centro da tela)
      const startX = loaderRect.left;
      const startY = loaderRect.top;

      // Posição final - calcular baseado na posição real do header
      // O .page-title.fixed-header tem: top: 87px; transform: translate(-50%, -100%)
      // Isso significa que o BOTTOM do header fica em 87px
      // Container do logo: 72x72px, logo: 64x64px centrado
      // Posição do topo do logo: 87px - 72px + (72-64)/2 = 87 - 72 + 4 = 19px
      const endX = (window.innerWidth - loaderRect.width) / 2;
      const endY = 19; // Topo do logo fica em ~19px

      console.log("🎬 Logo movimento:", { startX, startY, endX, endY });

      // Definir posição inicial fixa
      loaderLogo.style.left = startX + "px";
      loaderLogo.style.top = startY + "px";
      loaderLogo.style.position = "fixed";
      loaderLogo.style.margin = "0";
      loaderLogo.style.zIndex = "10001";
      loaderLogo.style.transition =
        "left 1s cubic-bezier(0.4, 0, 0.2, 1), top 1s cubic-bezier(0.4, 0, 0.2, 1)";

      // Forçar reflow
      void loaderLogo.offsetWidth;

      // Iniciar movimento (sem scale - logo já tem tamanho correto 64px)
      loaderLogo.style.left = endX + "px";
      loaderLogo.style.top = endY + "px";
    }
  }, 50);

  // ===== FASE 2: Linha branca expande (500ms - 1300ms) =====
  setTimeout(() => {
    if (loaderLine) {
      console.log("🎬 Linha expandindo...");
      loaderLine.classList.add("expanding");
    }
  }, 500);

  // ===== FASE 3: Logo chega ao header, elementos começam a aparecer (1000ms) =====
  setTimeout(() => {
    console.log("🎬 Logo chegou ao header, iniciando fade dos elementos");

    // Manter logo do loader visível (ele é o logo final!)
    // Esconder o logo do header (será substituído pelo do loader)
    if (headerLogo) headerLogo.style.visibility = "hidden";

    // Mostrar pageTitle mas sem o logo interno (o logo do loader está no lugar)
    if (pageTitle) {
      pageTitle.style.transition = "opacity 0.3s ease";
      pageTitle.style.opacity = "1";
    }

    // Mostrar cards mais cedo (sem esperar o fim da expansão da linha)
    document.body.classList.add("reveal-home");
  }, 1000);

  // ===== FASE 5: Top bar aparece (1300ms) =====
  setTimeout(() => {
    console.log("🎬 Top bar aparecendo");
    if (topBar) {
      topBar.style.transition = "opacity 0.3s ease, transform 0.3s ease";
      topBar.style.opacity = "1";
      topBar.style.transform = "scaleX(1)";
    }
    // Esconder linha do loader (top-bar assume)
    if (loaderLine) loaderLine.style.opacity = "0";
  }, 1300);

  // ===== FASE 7: Background do loader faz fade out (3000ms - 3500ms) =====
  setTimeout(() => {
    console.log("🎬 Background do loader sumindo");
    loader.style.background = "transparent";
    loader.style.transition = "background 0.5s ease";
  }, 3000);

  // ===== FASE 8: Cleanup final (3500ms) =====
  setTimeout(() => {
    // Antes de esconder o loader, mostrar o logo do header
    if (headerLogo) {
      headerLogo.style.visibility = "visible";
      headerLogo.style.opacity = "1";
    }

    // Agora esconder o loader (incluindo o logo do loader)
    loader.style.display = "none";
    loader.classList.add("hidden");

    // NÃO limpar opacity/transform dos elementos - eles devem permanecer visíveis!
    // Apenas limpar as transições inline
    roomCards.forEach((card) => {
      card.style.transition = "";
      // Manter opacity e transform para elementos ficarem visíveis
    });
    if (navbar) {
      navbar.style.transition = "";
    }
    if (topBar) {
      topBar.style.transition = "";
    }
    if (pageTitle) {
      pageTitle.style.transition = "";
    }

    // Limpar estilos do loader
    loader.style.background = "";
    loader.style.transition = "";
    loader.dataset.fading = "";
    loader.classList.remove("transitioning");
    if (loaderLogo) {
      loaderLogo.style.cssText = "";
      loaderLogo.classList.remove("transitioning");
    }
    if (loaderLine) {
      loaderLine.classList.remove("expanding");
      loaderLine.style.opacity = "";
    }

    // Remover modo de animação orquestrada MAS manter elementos visíveis
    // Os estilos inline de opacity:1 e transform:translateY(0) permanecem
    document.body.classList.remove("orchestrated-animation");

    console.log("✅ Animação orquestrada concluída!");
  }, 3500);
}

function ensureTopBarVisible() {
  const topBar =
    document.getElementById("spa-static-topbar") ||
    document.querySelector(".top-bar-custom.spa-static-chrome");
  if (!topBar) return;
  topBar.style.display = "block";
  topBar.style.visibility = "visible";
  topBar.style.opacity = "1";
  topBar.style.transform = "scaleX(1)";
}

function updateProgress(percentage, text) {
  try {
    const progressFill = document.getElementById("progress-fill");
    const progressText = document.getElementById("progress-text");
    const loaderText = document.querySelector(".loader-text");

    if (progressFill) {
      progressFill.style.width = percentage + "%";
    }

    if (progressText) {
      progressText.textContent = Math.round(percentage) + "%";
    }

    if (loaderText && text) {
      loaderText.textContent = text;
    }

    // Log para debug mobile
    console.log(`📊 Progresso: ${percentage}% - ${text || "Carregando..."}`);
  } catch (error) {
    console.warn("⚠️ Erro ao atualizar progresso:", error);
  }
}

// Carregamento global de todos os estados dos dispositivos
async function loadAllDeviceStatesGlobally() {
  console.log("🌍 Iniciando carregamento global de estados...");
  console.log(
    "🌍 ALL_LIGHT_IDS disponível:",
    !!ALL_LIGHT_IDS,
    "Length:",
    ALL_LIGHT_IDS ? ALL_LIGHT_IDS.length : "undefined",
  );
  console.log("🌍 DEBUG CARREGAMENTO:", {
    isProduction: isProduction,
    hostname: location.hostname,
    isMobile: isMobile,
    userAgent: navigator.userAgent.substring(0, 100),
  });

  // Mobile e desktop usam EXATAMENTE o mesmo carregamento
  console.log("🌍 Carregamento universal (desktop e mobile idênticos)");

  if (isHubitatBypassMode()) {
    const bypassModeLabel = isCinematicModeEnabled()
      ? "🎬 [CINEMA]"
      : "🧪 [DEV state-only]";
    console.warn(
      `${bypassModeLabel} Carregando estados apenas do storage local`,
    );
    updateProgress(
      20,
      isCinematicModeEnabled()
        ? "Modo cinematografico ativo..."
        : "Modo DEV local ativo...",
    );

    let loadedCount = 0;
    ALL_LIGHT_IDS.forEach((deviceId, index) => {
      const storedState = getStoredState(deviceId) || "off";
      updateDeviceUI(deviceId, storedState, true);
      loadedCount += 1;

      const progress = 20 + ((index + 1) / ALL_LIGHT_IDS.length) * 80;
      updateProgress(
        progress,
        `Dispositivo ${index + 1}/${ALL_LIGHT_IDS.length}...`,
      );
    });

    console.log(
      `${bypassModeLabel} Estados carregados localmente: ${loadedCount}/${ALL_LIGHT_IDS.length}`,
    );
    updateProgress(
      100,
      isCinematicModeEnabled()
        ? "Modo cinematografico pronto!"
        : "Modo DEV local pronto!",
    );
    return true;
  }

  if (!isProduction) {
    console.log("💻 MODO DESENVOLVIMENTO ATIVO - carregando do localStorage");
    console.log("💻 ISSO PODE SER O PROBLEMA NO MOBILE!");
    console.log("📋 Dispositivos a carregar:", ALL_LIGHT_IDS.length);
    updateProgress(20, "Modo DEV - Estados salvos...");

    // Simular carregamento para melhor UX (mobile-friendly)
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (e) {
      // Fallback se Promise.resolve falhar
      console.warn("Promise fallback ativo");
    }

    let loadedCount = 0;
    ALL_LIGHT_IDS.forEach((deviceId, index) => {
      let storedState = "off";
      try {
        storedState = getStoredState(deviceId) || "off";
        updateDeviceUI(deviceId, storedState, true); // forceUpdate = true
        loadedCount++;
      } catch (e) {
        console.warn(`⚠️Erro ao processar ${deviceId}:`, e);
      }

      const progress = 20 + ((index + 1) / ALL_LIGHT_IDS.length) * 80;
      updateProgress(
        progress,
        `Dispositivo ${index + 1}/${ALL_LIGHT_IDS.length}...`,
      );
    });

    console.log(
      `✅ Carregamento completo: ${loadedCount}/${ALL_LIGHT_IDS.length} dispositivos`,
    );
    updateProgress(100, "Carregamento Concluído!");
    return true;
  }

  try {
    console.log("🌍 MODO PRODUÇÃO’O ATIVO - buscando do servidor");
    updateProgress(10, "Testando conectividade...");

    // Teste rápido de conectividade
    try {
      const healthController = new AbortController();
      const healthTimeout = setTimeout(
        () => healthController.abort(),
        NETWORK_CONFIG.HEALTH_CHECK_TIMEOUT,
      );

      const healthCheck = await fetch(POLLING_URL + "?health=1", {
        method: "GET",
        signal: healthController.signal,
        mode: "cors",
      });

      clearTimeout(healthTimeout);
      console.log("🏥 Health check:", healthCheck.ok ? "OK" : "FAIL");
    } catch (healthError) {
      console.warn(
        "⚠️ Health check falhou, continuando mesmo assim:",
        healthError.message,
      );
    }

    updateProgress(20, "Conectando com servidor...");

    const deviceIds = ALL_LIGHT_IDS.join(",");
    console.log(
      `📡 Buscando estados de ${ALL_LIGHT_IDS.length} dispositivos no servidor...`,
    );
    console.log("📡 URL será:", `${POLLING_URL}?devices=${deviceIds}`);

    updateProgress(30, "Enviando solicitação...");

    // Função de retry com backoff exponencial
    const fetchWithRetry = async (
      url,
      options,
      maxRetries = NETWORK_CONFIG.MAX_RETRY_ATTEMPTS,
    ) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`📡 Tentativa ${attempt}/${maxRetries} para ${url}`);
          updateProgress(
            30 + (attempt - 1) * 5,
            `Tentativa ${attempt}/${maxRetries}...`,
          );

          // Configurar timeout por tentativa
          let controller, timeoutId;
          const timeout = NETWORK_CONFIG.FETCH_TIMEOUT_PER_ATTEMPT;

          if (typeof AbortController !== "undefined") {
            controller = new AbortController();
            timeoutId = setTimeout(() => {
              console.warn(
                `⏰ Timeout de ${
                  timeout / 1000
                }s atingido na tentativa ${attempt}`,
              );
              controller.abort();
            }, timeout);
            options.signal = controller.signal;
          }

          const response = await fetch(url, options);
          if (timeoutId) clearTimeout(timeoutId);

          console.log(`📡 Tentativa ${attempt} - Status: ${response.status}`);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          return response;
        } catch (error) {
          console.warn(`⚠️Tentativa ${attempt} falhou:`, error.message);

          if (attempt === maxRetries) {
            throw new Error(
              `Falha após ${maxRetries} tentativas: ${error.message}`,
            );
          }

          // Aguardar antes do retry (backoff exponencial)
          const delay = Math.min(
            NETWORK_CONFIG.RETRY_DELAY_BASE * Math.pow(2, attempt - 1),
            NETWORK_CONFIG.RETRY_DELAY_MAX,
          );
          console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
          updateProgress(
            30 + attempt * 5,
            `Reagendando em ${delay / 1000}s...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    };

    // Configurações otimizadas para mobile
    const fetchOptions = {
      method: "GET",
      cache: "no-cache", // Forçar busca fresca
      mode: "cors",
    };

    const requestUrl = `${POLLING_URL}?devices=${deviceIds}`;
    console.log("📡 Fazendo fetch com retry para:", requestUrl);

    const response = await fetchWithRetry(requestUrl, fetchOptions);

    console.log("📡 Resposta recebida, status:", response.status);
    updateProgress(50, "Recebendo dados...");

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    let data;
    let responseText = "";
    try {
      console.log("📡 Parseando resposta JSON...");

      // Debug: Capturar o texto da resposta primeiro
      responseText = await response.text();
      console.log(
        "📡 Resposta recebida (texto):",
        responseText.substring(0, 500),
      ); // Primeiros 500 chars

      if (!responseText) {
        throw new Error("Resposta vazia do servidor");
      }

      // Verificar se é HTML (Functions não estão funcionando)
      if (
        responseText.trim().startsWith("<!DOCTYPE html") ||
        responseText.trim().startsWith("<html")
      ) {
        console.error(
          "⚠️ CRÍTICO: Cloudflare Functions não estão funcionando!",
        );
        console.error(
          "⚠️O servidor está retornando HTML em vez de executar as Functions.",
        );
        console.error(
          "⚠️Implementando fallback automático para API direta do Hubitat...",
        );

        // FALLBACK AUTOMÁTICO: Usar API direta do Hubitat
        console.log("🔄 Tentando API direta do Hubitat como fallback...");
        updateProgress(60, "Usando API direta como fallback...");

        try {
          const fallbackData = await loadAllDeviceStatesDirect(ALL_LIGHT_IDS);
          console.log("✅ Fallback bem-sucedido:", fallbackData);

          // Processar dados do fallback
          const deviceEntries = Object.entries(fallbackData.devices);
          let processedCount = 0;

          deviceEntries.forEach(([deviceId, deviceData]) => {
            if (deviceData.success) {
              const normalized = normalizeSwitchState(
                deviceData.state,
                deviceData.level !== null &&
                  deviceData.level !== undefined &&
                  clampDimmerValue(deviceData.level, 0) > 0
                  ? "on"
                  : "off",
              );
              setStoredState(deviceId, normalized);
              updateDeviceUI(deviceId, normalized, true);
              console.log(`✅ Device ${deviceId}: ${normalized} (direto)`);
            } else {
              const storedState = getStoredState(deviceId) || "off";
              updateDeviceUI(deviceId, storedState, true);
              console.log(
                `⚠️ Device ${deviceId}: usando estado salvo "${storedState}"`,
              );
            }

            processedCount++;
            const progress = 60 + (processedCount / deviceEntries.length) * 35;
            updateProgress(
              progress,
              `Processando ${processedCount}/${deviceEntries.length}...`,
            );
          });

          updateProgress(100, "Carregamento via API direta Concluído!");

          console.log("✅ Fallback automático Concluído com sucesso");
          return true;
        } catch (fallbackError) {
          console.error("⚠️Fallback também falhou:", fallbackError);

          // Último recurso: usar estados salvos
          console.log("📦 Usando estados salvos como último recurso...");
          ALL_LIGHT_IDS.forEach((deviceId) => {
            const storedState = getStoredState(deviceId) || "off";
            updateDeviceUI(deviceId, storedState, true);
          });

          throw new Error(
            "Functions não funcionam e API direta também falhou - usando estados salvos",
          );
        }
      }

      // Tentar parsear o JSON
      data = JSON.parse(responseText);
      console.log("📡 JSON parseado com sucesso");
    } catch (jsonError) {
      console.error("⚠️Erro ao parsear JSON:", jsonError);
      console.error(
        "⚠️ Conteúdo da resposta que falhou:",
        responseText?.substring(0, 200),
      );
      throw new Error(`Resposta inválida do servidor: ${jsonError.message}`);
    }
    console.log("📡 Estados recebidos:", data);

    // Normalização do formato de resposta:
    // Formato antigo esperado: { devices: { id: { state, success } } }
    // Novo formato (Cloudflare Function refatorada): { success:true, data:[ { id, attributes:[{name:'switch', currentValue:'on'}] } ] }
    if (!data.devices) {
      try {
        if (Array.isArray(data.data)) {
          console.log(
            "🔄 Normalizando",
            data.data.length,
            "dispositivos do formato novo...",
          );
          const mapped = {};
          data.data.forEach((d, index) => {
            if (!d || !d.id) {
              console.warn(`⚠️ Dispositivo ${index} inválido:`, d);
              return;
            }

            let state = "off";
            let level = null;

            if (Array.isArray(d.attributes)) {
              // Formato antigo: attributes é array de objetos
              const sw = d.attributes.find((a) => a.name === "switch");
              if (sw) {
                state = sw?.currentValue || sw?.value || "off";
              }

              const levelAttr = d.attributes.find((a) => a.name === "level");
              if (levelAttr) {
                level = levelAttr?.currentValue ?? levelAttr?.value ?? level;
              }
            } else if (d.attributes && typeof d.attributes === "object") {
              // Formato atual: attributes é objeto direto com propriedades
              if (d.attributes.switch !== undefined) {
                state = d.attributes.switch;
                console.log(`📋 Device ${d.id}: switch=${state}`);
              } else {
                console.log(
                  `🔘 Device ${d.id}: não é lâmpada (sem atributo 'switch'), pulando...`,
                );
                return; // Pular dispositivos sem switch (botões, sensores, etc.)
              }

              if (d.attributes.level !== undefined) {
                level = d.attributes.level;
              }
            } else {
              console.warn(
                `⚠️ Device ${d.id}: attributes inválido:`,
                d.attributes,
              );
            }

            mapped[d.id] = { state, level, success: true };
          });
          data.devices = mapped;
          console.log(
            "🔄 Resposta normalizada para formato devices (",
            Object.keys(mapped).length,
            "dispositivos )",
          );
          console.log("🔍 Estados finais mapeados:", mapped);
        } else {
          throw new Error(
            "Formato de resposta inesperado: falta campo devices e data[]",
          );
        }
      } catch (normError) {
        console.error("⚠️Falha ao normalizar resposta:", normError);
        throw normError;
      }
    }

    updateProgress(70, "Processando estados...");

    // Processar dispositivos com progresso
    const deviceEntries = Object.entries(data.devices || {});
    console.log(`Processando ${deviceEntries.length} dispositivos...`);
    let processedCount = 0;

    await processDeviceEntries(deviceEntries);

    function handleDeviceEntry(deviceId, deviceData) {
      if (deviceData.success) {
        const normalized = normalizeSwitchState(
          deviceData.state,
          deviceData.level !== null &&
            deviceData.level !== undefined &&
            clampDimmerValue(deviceData.level, 0) > 0
            ? "on"
            : "off",
        );
        setStoredState(deviceId, normalized);
        updateDeviceUI(
          deviceId,
          { state: normalized, level: deviceData.level },
          true,
        ); // forceUpdate = true
      } else {
        console.warn(`Falha no device ${deviceId}:`, deviceData.error);
        const storedState = getStoredState(deviceId) || "off";
        updateDeviceUI(deviceId, storedState, true); // forceUpdate = true
      }

      processedCount++;
      const progress = 70 + (processedCount / deviceEntries.length) * 25;
      updateProgress(
        progress,
        `Aplicando estado ${processedCount}/${deviceEntries.length}...`,
      );
    }

    function scheduleChunk(callback) {
      if (
        typeof window !== "undefined" &&
        typeof window.requestIdleCallback === "function"
      ) {
        window.requestIdleCallback(callback, { timeout: 120 });
      } else {
        setTimeout(callback, 16);
      }
    }

    function processDeviceEntries(entries) {
      return new Promise((resolve) => {
        let index = 0;
        const CHUNK_SIZE = 20;

        const runChunk = (deadline) => {
          const hasDeadline =
            deadline && typeof deadline.timeRemaining === "function";
          let processedInChunk = 0;

          while (index < entries.length) {
            const current = entries[index++];
            handleDeviceEntry(current[0], current[1]);
            processedInChunk += 1;

            if (processedInChunk >= CHUNK_SIZE) {
              break;
            }

            if (hasDeadline && deadline.timeRemaining() <= 4) {
              break;
            }
          }

          if (index < entries.length) {
            scheduleChunk(runChunk);
          } else {
            resolve();
          }
        };

        runChunk();
      });
    }

    updateProgress(95, "Finalizando sincronização...");

    updateProgress(100, "Estados carregados com sucesso!");
    console.log("✅ Carregamento global Concluído com sucesso");
    return true;
  } catch (error) {
    console.error("⚠️Erro no carregamento global:", error);

    // Tentar diagnóstico automático da Conexão
    try {
      console.log("🔧 Executando diagnóstico da Conexão...");
      const connectionTest = await testHubitatConnection();
      if (!connectionTest) {
        showErrorMessage(
          "Falha na Conexão com Hubitat. Verifique se as Configurações foram alteradas no painel do Cloudflare.",
        );
      }
    } catch (diagError) {
      console.error("Erro no diagnóstico:", diagError);
    }

    // Tratamento inteligente de erro com retry automático
    if (error.name === "AbortError") {
      console.warn("⏱️ Timeout após múltiplas tentativas");
      updateProgress(60, "Timeout - usando backup...");
      showErrorMessage(
        "Timeout na Conexão. Verifique sua internet e tente novamente.",
      );
    } else if (error.message.includes("Falha após")) {
      console.warn("🔄 Múltiplas tentativas falharam");
      updateProgress(60, "Falhas múltiplas - modo backup...");
      showErrorMessage(
        "Servidor temporariamente indisponível. Usando dados salvos.",
      );
    } else if (error.name === "TypeError" && error.message.includes("fetch")) {
      console.warn("🌐 Problema de conectividade de rede");
      updateProgress(60, "Sem rede - modo offline...");
      showErrorMessage("Sem Conexão com a internet. Modo offline ativado.");
    } else if (error.message.includes("HTTP 5")) {
      console.warn("🔥 Erro no servidor (5xx)");
      updateProgress(60, "Erro servidor - backup...");
      showErrorMessage(
        "Problema no servidor. Usando últimos dados conhecidos.",
      );
    } else {
      console.warn("⚠️Erro desconhecido no carregamento:", error.message);
      updateProgress(60, "Erro geral - usando backup...");
      showErrorMessage("Erro no carregamento. Usando dados salvos localmente.");
    }

    // Fallback para localStorage
    ALL_LIGHT_IDS.forEach((deviceId, index) => {
      const storedState = getStoredState(deviceId) || "off";
      updateDeviceUI(deviceId, storedState, true); // forceUpdate = true

      const progress = 60 + ((index + 1) / ALL_LIGHT_IDS.length) * 35;
      updateProgress(
        progress,
        `Carregando backup ${index + 1}/${ALL_LIGHT_IDS.length}...`,
      );
    });

    const offlineMsg = "Carregamento Concluído (modo offline)";
    updateProgress(100, offlineMsg);
    return false;
  }
}

// Verificar compatibilidade com mobile
function checkMobileCompatibility() {
  const issues = [];
  const warnings = [];

  // APIs críticas (falha total se não existirem)
  if (typeof fetch === "undefined") {
    issues.push("Fetch API não suportada");
  }

  if (typeof Promise === "undefined") {
    issues.push("Promises não suportadas");
  }

  // APIs opcionais (warnings apenas)
  if (typeof MutationObserver === "undefined") {
    warnings.push("MutationObserver não suportado (usar fallback)");
  }

  if (typeof AbortController === "undefined") {
    warnings.push("AbortController não suportado (sem timeout)");
  }

  if (typeof localStorage === "undefined") {
    warnings.push("LocalStorage não suportado (sem persistência)");
  }

  // Testar localStorage funcionamento
  try {
    const testKey = "__test_ls__";
    localStorage.setItem(testKey, "test");
    localStorage.removeItem(testKey);
  } catch (e) {
    warnings.push("LocalStorage bloqueado (modo privado?)");
  }

  if (warnings.length > 0) {
    console.warn("⚠️ Avisos de compatibilidade:", warnings);
  }

  if (issues.length > 0) {
    console.error("⚠️Problemas críticos detectados:", issues);
    return false;
  }

  console.log("✅ Compatibilidade mobile verificada");
  return true;
}

// Fade de scroll no rodape (remover quando chega ao fim da lista)
const scrollFadeContainers = new Set();
let scrollFadeResizeTimer = null;
let scrollFadeResizeBound = false;

function updateScrollFade(container) {
  if (!container || !container.classList) return;
  const maxScroll = container.scrollHeight - container.clientHeight;
  if (!Number.isFinite(maxScroll) || maxScroll <= 1) {
    container.classList.remove(
      "scroll-fade-active",
      "scroll-fade-start",
      "scroll-fade-end",
    );
    return;
  }
  const atTop = container.scrollTop <= 1;
  const atBottom = container.scrollTop >= maxScroll - 1;
  container.classList.add("scroll-fade-active");
  container.classList.toggle("scroll-fade-start", atTop);
  container.classList.toggle("scroll-fade-end", atBottom);
}

function registerScrollFade(container) {
  if (
    !container ||
    !container.classList ||
    scrollFadeContainers.has(container)
  ) {
    return;
  }
  scrollFadeContainers.add(container);
  const handler = () => updateScrollFade(container);
  container.addEventListener("scroll", handler, { passive: true });
  updateScrollFade(container);
  setTimeout(() => updateScrollFade(container), 120);

  if (!scrollFadeResizeBound) {
    scrollFadeResizeBound = true;
    window.addEventListener("resize", () => {
      if (scrollFadeResizeTimer) clearTimeout(scrollFadeResizeTimer);
      scrollFadeResizeTimer = setTimeout(() => {
        scrollFadeContainers.forEach((el) => updateScrollFade(el));
      }, 150);
    });
  }
}

function setupScrollFadeContainers(root = document) {
  if (!root || !root.querySelectorAll) return;
  const selectors = [
    ".ambiente-grid",
    ".controls-grid",
    "[class*=-luzes-wrapper]",
    "[class*=-cortinas-wrapper]",
    "[class*=-piscina-wrapper]",
  ];
  const nodes = root.querySelectorAll(selectors.join(","));
  nodes.forEach((node) => registerScrollFade(node));
  if (root.matches && selectors.some((sel) => root.matches(sel))) {
    registerScrollFade(root);
  }
}

// Observador para sincronizar novos elementos no DOM
function setupDomObserver() {
  const root = document.getElementById("spa-root") || document.body;

  // Aplicar tokens e overrides de ícones imediatamente
  applyUiTokens(root);
  applyIconOverrides(root);
  setupScrollFadeContainers(root);

  primeControlCaches({ root: root, force: true });
  pruneStaleEntries();
  scheduleControlSync(true);

  if (typeof MutationObserver === "undefined") {
    console.warn(
      "MutationObserver indisponivel - usando fallback de sincronizacao periodica",
    );
    if (fallbackSyncTimer) {
      clearInterval(fallbackSyncTimer);
    }
    fallbackSyncTimer = setInterval(function () {
      syncAllVisibleControls();
    }, 8000);
    return;
  }

  try {
    if (fallbackSyncTimer) {
      clearInterval(fallbackSyncTimer);
      fallbackSyncTimer = null;
    }

    if (domObserverInstance) {
      domObserverInstance.disconnect();
    }

    domObserverInstance = new MutationObserver(function (mutations) {
      let changed = false;

      mutations.forEach(function (mutation) {
        mutation.removedNodes.forEach(function (node) {
          if (removeControlsFromNode(node)) {
            changed = true;
          }
        });

        mutation.addedNodes.forEach(function (node) {
          if (collectControlsFromNode(node)) {
            changed = true;
          }

          // Aplicar tokens/overrides somente no que entrou
          try {
            if (node && node.querySelectorAll) {
              applyUiTokens(node);
              applyIconOverrides(node);
              setupScrollFadeContainers(node);
            }
          } catch (e) {
            // ignore
          }
        });
      });

      if (changed) {
        scheduleControlSync(true);
      }
    });

    domObserverInstance.observe(root, {
      childList: true,
      subtree: true,
    });
  } catch (error) {
    console.error("Erro ao configurar MutationObserver:", error);
    console.warn("Usando fallback de sincronizacao periodica.");
    if (fallbackSyncTimer) {
      clearInterval(fallbackSyncTimer);
    }
    fallbackSyncTimer = setInterval(function () {
      syncAllVisibleControls();
    }, 8000);
  }
}

// Sincronizar todos os controles visíveis com estados salvos
function syncAllVisibleControls(forceMasterUpdate = false) {
  pruneStaleEntries();

  debugLog(() => [
    "syncAllVisibleControls",
    { devices: deviceControlCache.size, force: forceMasterUpdate },
  ]);

  let updatedControls = 0;

  deviceControlCache.forEach(function (registry, deviceId) {
    if (!registry || registry.size === 0) {
      deviceControlCache.delete(deviceId);
      return;
    }

    const savedState = getStoredState(deviceId);
    const hasState = savedState !== null && savedState !== undefined;

    if (!hasState) {
      return;
    }

    registry.forEach(function (el) {
      if (!el.isConnected) {
        registry.delete(el);
        return;
      }

      const currentState = el.dataset.state;
      if (currentState !== savedState || forceMasterUpdate) {
        setRoomControlUI(el, savedState);
        updatedControls += 1;
      }
    });

    if (registry.size === 0) {
      deviceControlCache.delete(deviceId);
    }
  });

  debugLog(() => ["syncAllVisibleControls:updated", updatedControls]);
}

// Comandos de debug globais
window.debugEletrize = {
  forcePolling: updateDeviceStatesFromServer,
  reloadStates: loadAllDeviceStatesGlobally,
  syncControls: syncAllVisibleControls,
  showLoader: showLoader,
  hideLoader: hideLoader,
  checkDevice: (deviceId) => {
    const stored = getStoredState(deviceId);
    console.log(`Device ${deviceId}: stored=${stored}`);
  },
  checkAllDevices: () => {
    console.log("📋 Estados de todos os dispositivos:");
    ALL_LIGHT_IDS.forEach((deviceId) => {
      const stored = getStoredState(deviceId);
      console.log(`  ${deviceId}: ${stored}`);
    });
  },
  testSetState: (deviceId, state) => {
    console.log(`🧪 Testando setState(${deviceId}, ${state})`);
    setStoredState(deviceId, state);
    updateDeviceUI(deviceId, state, true);
    console.log(`✅ Teste completo`);
  },
  mqttStatus: () => {
    console.log("MQTT status:", {
      enabled:
        mqttStateConfigCache?.enabled ?? normalizeMqttStateConfig().enabled,
      connected: mqttStateConnected,
      brokerUrl: mqttStateConfigCache?.brokerUrl || null,
      stateTopicPrefix: mqttStateConfigCache?.stateTopicPrefix || null,
    });
  },
  initMqtt: () =>
    initializeMqttStateBridge().catch((error) => {
      console.error("Falha ao iniciar MQTT manualmente:", error);
    }),
  clearAllStates: () => {
    console.log("Limpando todos os estados salvos...");
    ALL_LIGHT_IDS.forEach((deviceId) => {
      deviceStateMemory.delete(deviceId);
      try {
        localStorage.removeItem(deviceStateKey(deviceId));
      } catch (e) {
        debugLog(() => ["Falha ao limpar estado local", deviceId, e]);
      }
    });
    console.log("Estados limpos");
  },
  checkProtectedCommands: () => {
    console.log("🛡️ Comandos protegidos:");
    if (recentCommands.size === 0) {
      console.log("  ✅ Nenhum comando protegido");
      return;
    }
    const now = Date.now();
    recentCommands.forEach((timestamp, deviceId) => {
      const remaining = Math.max(0, COMMAND_PROTECTION_MS - (now - timestamp));
      const status = remaining > 0 ? "🔒 ATIVO" : "🔓 EXPIRADO";
      console.log(
        `  ${status} ${deviceId}: ${Math.ceil(remaining / 1000)}s restantes`,
      );
    });
  },
  mobileInfo: () => {
    console.log("📱 Informações do dispositivo móvel:");
    console.log("  isMobile:", isMobile);
    console.log("  isIOS:", isIOS);
    console.log("  isProduction:", isProduction);
    console.log("  User Agent:", navigator.userAgent);
    console.log("  App Version:", APP_VERSION);
    try {
      console.log(
        "  Última carga:",
        new Date(parseInt(localStorage.getItem("last_mobile_load") || "0")),
      );
      console.log("  Versão cache:", localStorage.getItem("app_version"));
    } catch (e) {
      console.log("  localStorage indisponível");
    }
  },
  clearMobileCache: () => {
    console.log("🧹 Limpando cache mobile...");
    try {
      localStorage.removeItem("app_version");
      localStorage.removeItem("last_mobile_load");
      localStorage.removeItem("app_cache_version");
      sessionStorage.clear();
      console.log("✅ Cache mobile limpo! Recarregue a página.");
    } catch (e) {
      console.error("⚠️Erro ao limpar cache:", e);
    }
  },
  forceMobileReload: () => {
    console.log("🔄 Forçando recarga mobile com limpeza de cache...");
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
    setTimeout(() => {
      window.location.reload(true);
    }, 1000);
  },
  checkMobileCache: () => {
    console.log("🔍 Status do cache mobile:");
    try {
      const version = localStorage.getItem("app_version");
      const lastLoad = localStorage.getItem("last_mobile_load");
      const now = new Date().getTime();

      console.log("  App Version atual:", APP_VERSION);
      console.log("  Versão em cache:", version);
      console.log("  Cache válido:", version === APP_VERSION);

      if (lastLoad) {
        const age = Math.floor((now - parseInt(lastLoad)) / 60000); // minutos
        console.log("  Idade do cache:", age, "minutos");
        console.log("  Cache expirado:", age > 60);
      } else {
        console.log("  Primeira carga detectada");
      }
    } catch (e) {
      console.error("  Erro na verificação:", e);
    }
    console.log("  Screen:", `${screen.width}x${screen.height}`);
    console.log("  Viewport:", `${window.innerWidth}x${window.innerHeight}`);
    console.log(
      "  Connection:",
      navigator.connection
        ? `${navigator.connection.effectiveType} (${navigator.connection.downlink}Mbps)`
        : "não disponível",
    );
    checkMobileCompatibility();
  },
  testMobileApi: async () => {
    console.log("🧪 Testando APIs para mobile...");
    try {
      const testUrl = isProduction ? `${POLLING_URL}?devices=10` : "#test";
      // Configurar timeout compatível
      const fetchConfig = {
        method: "GET",
        cache: "no-cache",
      };

      // Adicionar timeout se AbortController for suportado
      if (typeof AbortController !== "undefined") {
        const testController = new AbortController();
        setTimeout(() => testController.abort(), 5000);
        fetchConfig.signal = testController.signal;
      }

      const response = await fetch(testUrl, fetchConfig);
      console.log("✅ Fetch test:", response.status, response.statusText);
    } catch (error) {
      console.error("⚠️Fetch test failed:", error);
    }
  },
};

/* --- Music player metadata update functions --- */

// Função para atualizar metadados do Denon
function updateDenonMetadata() {
  console.log(
    "🎵 [updateDenonMetadata] INICIANDO - Hash atual:",
    window.location.hash,
  );

  if (isHubitatBypassMode()) {
    debugLog(() => ["updateDenonMetadata skipped (Hubitat bypass mode)"]);
    return;
  }

  // Pedir ao Cloudflare function para retornar o JSON completo do Hubitat
  // (a function usa a variável HUBITAT_FULL_URL do ambiente quando configurada)
  fetch(`${POLLING_URL}?full=1`)
    .then(async (response) => {
      if (!response.ok) {
        const text = await response.text().catch(() => "<no body>");
        throw new Error(`HTTP error! status: ${response.status} - ${text}`);
      }
      // Tentar analisar JSON, mas capturar e mostrar texto cru se falhar
      try {
        return await response.json();
      } catch (err) {
        const rawText = await response
          .text()
          .catch(() => "<non-readable body>");
        throw new Error(`Invalid JSON response from polling: ${rawText}`);
      }
    })
    .then((data) => {
      console.log("🎵 Resposta completa do Hubitat:", data);

      const currentEnvKey = getEnvironmentKeyFromRouteHash(
        window.location.hash,
      );
      const denonMetadataDeviceId =
        getDenonMetadataDeviceIdForEnv(currentEnvKey);

      // Procurar o device de metadados da música atual nos dados
      // O formato pode ser um array direto ou um objeto com propriedade devices
      const devices = Array.isArray(data) ? data : data.devices || [];
      let denonDevice = devices.find(
        (device) =>
          String(device.id) === denonMetadataDeviceId ||
          device.id === parseInt(denonMetadataDeviceId, 10),
      );
      // Fallback: procurar por dispositivos cujo nome/label contenha 'denon', 'receiver' ou 'av'
      if (!denonDevice) {
        denonDevice = devices.find((device) => {
          const name = String(device.name || device.label || "").toLowerCase();
          return (
            name.includes("denon") ||
            name.includes("receiver") ||
            name.includes("av")
          );
        });
        if (denonDevice)
          console.log(
            "🔎 Denon metadata device encontrado por name/label:",
            denonDevice,
          );
      }

      if (denonDevice) {
        console.log("Denon encontrado:", denonDevice);
        const metadataPowerState = getDenonPowerStateFromDevice(denonDevice);
        if (metadataPowerState) {
          applyDenonPowerState(metadataPowerState);
        }
        console.log("🎵 Atributos do Denon:", denonDevice.attributes);

        // Extrair metadados - o formato pode variar
        let artist = "Desconhecido";
        let track = "Sem título";
        let album = "Álbum desconhecido";
        let albumArt = null;
        let playbackStatus = null;
        let trackDataRaw = null;
        let trackDataObj = null;

        // Tentar extrair de diferentes formatos possíveis
        if (Array.isArray(denonDevice.attributes)) {
          // Formato array: [{name: "artist", currentValue: "..."}, ...]
          const artistAttr = denonDevice.attributes.find(
            (attr) => attr.name === "artist" || attr.name === "trackArtist",
          );
          const trackAttr = denonDevice.attributes.find(
            (attr) => attr.name === "trackDescription" || attr.name === "track",
          );
          const albumAttr = denonDevice.attributes.find(
            (attr) => attr.name === "albumName" || attr.name === "album",
          );
          const albumArtAttr = denonDevice.attributes.find((attr) => {
            const name = attr.name?.toLowerCase();
            return (
              name === "albumarturl" ||
              name === "albumarturi" ||
              name === "currentalbumarturl" ||
              name === "currentalbumarturi" ||
              name === "enqueuedmetadataalbumarturl" ||
              name === "enqueuedmetadataalbumarturi" ||
              name === "albumart" ||
              name === "artworkurl" ||
              name === "imageurl"
            );
          });
          const statusAttr = denonDevice.attributes.find((attr) => {
            const attrName = String(attr?.name || "").toLowerCase();
            return (
              attrName === "status" ||
              attrName === "playbackstatus" ||
              attrName === "playerstatus" ||
              attrName === "transportstate"
            );
          });
          const trackDataAttr = denonDevice.attributes.find(
            (attr) => attr.name === "trackData" || attr.name === "trackdata",
          );

          artist = artistAttr?.currentValue || artistAttr?.value || artist;
          track = trackAttr?.currentValue || trackAttr?.value || track;
          album = albumAttr?.currentValue || albumAttr?.value || album;

          // Extrair albumArt e processar (pode ser URL direta ou HTML)
          const rawAlbumArt = albumArtAttr?.currentValue || albumArtAttr?.value;
          if (rawAlbumArt && typeof rawAlbumArt === "string") {
            const albumArtValue = rawAlbumArt.trim();
            if (
              albumArtValue.startsWith("http://") ||
              albumArtValue.startsWith("https://")
            ) {
              albumArt = albumArtValue;
              console.log("🎵 [array] albumArt é URL direta:", albumArt);
            } else if (
              albumArtValue.includes("<img") ||
              albumArtValue.includes("src=")
            ) {
              const imgMatch = albumArtValue.match(/src=['"]([^'"]+)['"]/);
              albumArt = imgMatch ? imgMatch[1] : null;
              console.log("🎵 [array] albumArt extraído de HTML:", albumArt);
            } else {
              albumArt = albumArtValue;
              console.log("🎵 [array] albumArt valor direto:", albumArt);
            }
          }

          playbackStatus =
            statusAttr?.currentValue || statusAttr?.value || playbackStatus;
          trackDataRaw =
            trackDataAttr?.currentValue || trackDataAttr?.value || trackDataRaw;
        } else if (
          denonDevice.attributes &&
          typeof denonDevice.attributes === "object"
        ) {
          // Formato objeto: {artist: "...", trackDescription: "...", track: "...", album: "...", ...}
          artist = denonDevice.attributes.artist || artist;
          track = denonDevice.attributes.track || track;
          album = denonDevice.attributes.album || album;
          playbackStatus =
            denonDevice.attributes.status ||
            denonDevice.attributes.playbackStatus ||
            denonDevice.attributes.playerStatus ||
            denonDevice.attributes.transportState ||
            playbackStatus;
          trackDataRaw = denonDevice.attributes.trackData || trackDataRaw;

          // Para albumArt, verificar se já é uma URL ou se precisa extrair de tag HTML
          if (
            denonDevice.attributes.albumArt &&
            typeof denonDevice.attributes.albumArt === "string"
          ) {
            const albumArtValue = denonDevice.attributes.albumArt.trim();

            // Se já começa com http/https, é uma URL direta
            if (
              albumArtValue.startsWith("http://") ||
              albumArtValue.startsWith("https://")
            ) {
              albumArt = albumArtValue;
              console.log("🎵 albumArt é URL direta:", albumArt);
            }
            // Senão, tentar extrair de tag HTML <img src="...">
            else if (
              albumArtValue.includes("<img") ||
              albumArtValue.includes("src=")
            ) {
              const imgMatch = albumArtValue.match(/src=['"]([^'"]+)['"]/);
              albumArt = imgMatch ? imgMatch[1] : null;
              console.log("🎵 albumArt extraído de HTML:", albumArt);
            }
            // Pode ser um caminho relativo ou outro formato
            else {
              albumArt = albumArtValue;
              console.log("🎵 albumArt valor direto:", albumArt);
            }
          }

          // Se não encontrou albumArt, tentar extrair do trackData JSON
          if (!albumArt && denonDevice.attributes.trackData) {
            try {
              const trackData =
                typeof denonDevice.attributes.trackData === "string"
                  ? JSON.parse(denonDevice.attributes.trackData)
                  : denonDevice.attributes.trackData;
              trackDataObj = trackData;
              albumArt = trackData.image_url || albumArt;
            } catch (e) {
              console.warn("⚠️ Erro ao parsear trackData:", e);
            }
          }
        }

        if (!trackDataObj && trackDataRaw) {
          try {
            trackDataObj =
              typeof trackDataRaw === "string"
                ? JSON.parse(trackDataRaw)
                : trackDataRaw;
          } catch (e) {
            console.warn("⚠️ Erro ao parsear trackData (raw):", e);
          }
        }

        if (
          !albumArt &&
          trackDataObj &&
          typeof trackDataObj.image_url === "string"
        ) {
          albumArt = trackDataObj.image_url;
        }

        let derivedPlaybackStatus = interpretPlaybackStatus(playbackStatus);
        if (derivedPlaybackStatus === null && trackDataObj) {
          const trackDataStatus =
            trackDataObj.play_state ||
            trackDataObj.player_state ||
            trackDataObj.state ||
            trackDataObj.status ||
            trackDataObj.transport_state;
          derivedPlaybackStatus = interpretPlaybackStatus(trackDataStatus);
        }

        if (derivedPlaybackStatus !== null) {
          window.musicPlayerUI.currentPlaying = derivedPlaybackStatus;
          if (
            window.musicPlayerUI &&
            typeof window.musicPlayerUI.setPlaying === "function"
          ) {
            window.musicPlayerUI.setPlaying(derivedPlaybackStatus);
          }
        }

        console.log("🎵 Metadados extraídos:", {
          artist,
          track,
          album,
          albumArt,
        });

        // Debug: se albumArt não foi encontrado, listar todos os atributos disponíveis
        if (!albumArt) {
          console.log(
            `⚠️ Album art não encontrado. Atributos disponíveis no dispositivo ${denonMetadataDeviceId}:`,
          );
          if (Array.isArray(denonDevice.attributes)) {
            denonDevice.attributes.forEach((attr) => {
              const name = attr.name?.toLowerCase() || "";
              if (
                name.includes("art") ||
                name.includes("image") ||
                name.includes("url") ||
                name.includes("uri") ||
                name.includes("album")
              ) {
                console.log(
                  `   - ${attr.name}: ${attr.currentValue || attr.value}`,
                );
              }
            });
          } else if (denonDevice.attributes) {
            Object.keys(denonDevice.attributes).forEach((key) => {
              const keyLower = key.toLowerCase();
              if (
                keyLower.includes("art") ||
                keyLower.includes("image") ||
                keyLower.includes("url") ||
                keyLower.includes("uri") ||
                keyLower.includes("album")
              ) {
                console.log(`   - ${key}: ${denonDevice.attributes[key]}`);
              }
            });
          }
        }

        artist = normalizePortugueseText(artist);
        track = normalizePortugueseText(track);
        album = normalizePortugueseText(album);

        // Atualizar UI
        updateMusicPlayerUI(artist, track, album, albumArt);
      } else {
        console.log(
          `⚠️ Device de metadados ${denonMetadataDeviceId} não encontrado nos dados`,
        );
        console.log(
          "Dispositivos disponíveis:",
          devices.map((d) => ({ id: d.id, name: d.name || d.label })),
        );
      }
    })
    .catch((error) => {
      console.error("⚠️Erro ao buscar metadados do Denon:", error);
      // Tentar logar a resposta bruta para debug adicional via endpoint de polling
      fetch(`${POLLING_URL}?full=1`)
        .then((res) => res.text())
        .then((t) => console.log("Raw polling response (debug):", t))
        .catch((e) =>
          console.warn("não foi possível obter resposta bruta de /polling:", e),
        );
    });
}

// Função para atualizar a UI do player com os metadados
function updateMusicPlayerUI(artist, track, album, albumArt) {
  artist = normalizePortugueseText(artist);
  track = normalizePortugueseText(track);
  album = normalizePortugueseText(album);

  // Obter elementos do DOM
  const artistElement = queryActiveMusic("#music-artist");
  const trackElement = queryActiveMusic("#music-track");
  const albumImgElement = queryActiveMusic(".music-album-img");
  const activePage = document.querySelector(".page.active");

  // tentar descobrir o ambiente atual a partir da classe da página (ex: 'ambiente2-page')
  let currentEnvKey = null;
  if (activePage && activePage.classList) {
    for (const cls of activePage.classList) {
      const m = cls.match(/^(.+)-page$/);
      if (m) {
        currentEnvKey = m[1];
        break;
      }
    }
  }

  // placeholder de capa depende apenas do config.js; se não houver, fica vazio
  const albumPlaceholder = "images/images/music-placeholder.png";

  // Atualizar texto se os elementos existirem
  if (artistElement) artistElement.textContent = artist;
  if (activePage) {
    activePage
      .querySelectorAll(".music-artist-sync")
      .forEach((el) => (el.textContent = artist));
  }

  if (trackElement) trackElement.textContent = track;
  if (activePage) {
    activePage
      .querySelectorAll(".music-track-sync")
      .forEach((el) => (el.textContent = track));
  }

  syncMusicTrackMarquee();

  // Atualizar imagem do álbum
  if (albumImgElement) {
    if (albumArt && albumArt !== "null" && albumArt !== "") {
      albumImgElement.src = albumArt;
      albumImgElement.onerror = function () {
        // Se a imagem falhar, use placeholder, se existir
        this.src = albumPlaceholder;
      };
    } else {
      // Usar placeholder padrão
      albumImgElement.src = albumPlaceholder;
    }
  }

  console.log(`🎵 UI atualizada: "${track}" por ${artist} (${album})`);
}

// Variável global para o intervalo de polling de metadados
let musicMetadataInterval = null;

// Função para iniciar polling específico de metadados do player
function startMusicMetadataPolling() {
  // Parar polling anterior se existir
  stopMusicMetadataPolling();

  console.log("🎵 Iniciando polling de metadados a cada 3 segundos");

  // Iniciar novo polling a cada 3 segundos
  musicMetadataInterval = setInterval(() => {
    if (isMusicPageActive()) {
      updateDenonMetadata();
    } else {
      // Se saímos da página, parar o polling
      stopMusicMetadataPolling();
    }
  }, 3000);
}

// Função para parar o polling de metadados
function stopMusicMetadataPolling() {
  if (musicMetadataInterval) {
    clearInterval(musicMetadataInterval);
    musicMetadataInterval = null;
    console.log("🎵 Polling de metadados parado");
  }
}

/* --- Music player UI handlers (simple local behavior for now) --- */

let musicTrackMarqueeListenersAttached = false;

function syncMusicTrackMarquee() {
  ensureMusicTrackMarqueeListeners();

  const activePage = document.querySelector(".page.active");
  if (!activePage) {
    return;
  }

  const trackElements = activePage.querySelectorAll(
    ".music-track-marquee__text:not(.music-track-marquee__text--clone)",
  );

  trackElements.forEach((trackElement) => {
    const marqueeContainer = trackElement.closest(".music-track-marquee");
    if (!marqueeContainer) {
      return;
    }

    const marqueeInner = marqueeContainer.querySelector(
      ".music-track-marquee__inner",
    );
    if (!marqueeInner) {
      return;
    }

    const cloneElement = marqueeContainer.querySelector(
      ".music-track-marquee__text--clone",
    );
    if (cloneElement) {
      cloneElement.textContent = trackElement.textContent || "";
    }

    marqueeContainer.classList.remove("music-track-marquee--active");
    marqueeContainer.style.removeProperty("--music-track-marquee-duration");

    requestAnimationFrame(() => {
      const containerWidth = marqueeContainer.clientWidth;
      const contentWidth = marqueeInner.scrollWidth;
      const shouldMarquee = contentWidth > containerWidth + 2;

      marqueeContainer.classList.toggle(
        "music-track-marquee--active",
        shouldMarquee,
      );

      if (shouldMarquee) {
        const pixelsPerSecond = 80;
        const duration = Math.min(
          24,
          Math.max(10, contentWidth / pixelsPerSecond),
        );
        marqueeContainer.style.setProperty(
          "--music-track-marquee-duration",
          `${duration}s`,
        );
      }
    });
  });
}

function ensureMusicTrackMarqueeListeners() {
  if (musicTrackMarqueeListenersAttached) {
    return;
  }

  const handleResize = () => syncMusicTrackMarquee();
  window.addEventListener("resize", handleResize);
  window.addEventListener("orientationchange", handleResize);

  musicTrackMarqueeListenersAttached = true;
}

function initMusicPlayerUI() {
  // Guard clause: verificar se estamos em uma página de música
  if (!isMusicPageActive()) {
    console.log(" Não está em página de música, ignorando initMusicPlayerUI");
    return;
  }

  const playToggleBtn = queryActiveMusic("#music-play-toggle");
  const playTogglePlayIcon = playToggleBtn
    ? playToggleBtn.querySelector(".music-play-toggle__icon--play")
    : null;
  const playTogglePauseIcon = playToggleBtn
    ? playToggleBtn.querySelector(".music-play-toggle__icon--pause")
    : null;
  const nextBtn = queryActiveMusic("#music-next");
  const prevBtn = queryActiveMusic("#music-prev");
  const muteBtn = queryActiveMusic("#music-mute");
  const volumeSlider = queryActiveMusic("#music-volume-slider");
  const volumeSection = queryActiveMusic(".music-volume-section");
  const volumeIconHigh = queryActiveMusic(".volume-icon-high");
  const volumeIconLow = queryActiveMusic(".volume-icon-low");
  const volumeIconMuted = queryActiveMusic(".volume-icon-muted");
  const masterOnBtn = queryActiveMusic("#music-master-on");
  const masterOffBtn = queryActiveMusic("#music-master-off");
  const playerInner = queryActiveMusic(".music-player-inner");

  console.log("🎵 Inicializando player de música...", {
    playToggleBtn,
    masterOnBtn,
    masterOffBtn,
  });

  function bindVerticalVolumeSlider(slider) {
    if (
      !slider ||
      !slider.classList.contains("music-volume-slider--vertical")
    ) {
      return;
    }
    if (slider.dataset.verticalBound === "true") {
      return;
    }
    slider.dataset.verticalBound = "true";

    let pointerActive = false;

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    const updateFromPointer = (event) => {
      const rect = slider.getBoundingClientRect();
      if (!rect.height) return;
      const min = Number(slider.min || 0);
      const max = Number(slider.max || 100);
      const ratio = 1 - (event.clientY - rect.top) / rect.height;
      const value = Math.round(min + clamp(ratio, 0, 1) * (max - min));
      slider.value = String(value);
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    };

    slider.addEventListener("pointerdown", (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      pointerActive = true;
      if (slider.setPointerCapture) slider.setPointerCapture(event.pointerId);
      updateFromPointer(event);
    });

    slider.addEventListener("pointermove", (event) => {
      if (!pointerActive) return;
      if (
        slider.hasPointerCapture &&
        !slider.hasPointerCapture(event.pointerId)
      ) {
        return;
      }
      updateFromPointer(event);
    });

    const finishPointer = (event) => {
      if (!pointerActive) return;
      pointerActive = false;
      if (slider.releasePointerCapture) {
        slider.releasePointerCapture(event.pointerId);
      }
      slider.dispatchEvent(new Event("change", { bubbles: true }));
    };

    slider.addEventListener("pointerup", finishPointer);
    slider.addEventListener("pointercancel", finishPointer);
  }

  window.musicPlayerUI = window.musicPlayerUI || {};
  const initialPowerState =
    typeof window.musicPlayerUI.currentPowerState === "string"
      ? window.musicPlayerUI.currentPowerState
      : "on";

  if (!playToggleBtn || !nextBtn || !prevBtn) {
    console.warn("⚠️ Botões de controle não encontrados");
    return;
  }

  // Estado do volume
  let isMuted = false;
  let volumeBeforeMute = 50;
  // Guardar estado anterior de mute quando o master for desligado
  let previousMutedState = false;
  let isPlaying = false;

  // Estado master power
  let isPowerOn = initialPowerState === "on";

  function setPlaying(isPlayingValue) {
    isPlaying = !!isPlayingValue;
    playToggleBtn.setAttribute("aria-pressed", isPlaying ? "true" : "false");
    playToggleBtn.classList.toggle("is-playing", isPlaying);

    if (playTogglePlayIcon) {
      playTogglePlayIcon.style.display = isPlaying ? "none" : "block";
    }

    if (playTogglePauseIcon) {
      playTogglePauseIcon.style.display = isPlaying ? "block" : "none";
    }

    playToggleBtn.setAttribute("aria-label", isPlaying ? "Pausar" : "Tocar");
    window.musicPlayerUI.currentPlaying = isPlaying;
  }

  function updateVolumeIcons(volumeValue, muted) {
    if (volumeIconHigh) volumeIconHigh.style.display = "none";
    if (volumeIconLow) volumeIconLow.style.display = "none";
    if (volumeIconMuted) volumeIconMuted.style.display = "none";

    if (muted) {
      if (volumeIconMuted) volumeIconMuted.style.display = "block";
      return;
    }

    const numericVolume = Number.isFinite(volumeValue)
      ? volumeValue
      : parseInt(volumeSlider?.value || "0", 10);
    if (numericVolume >= 50) {
      if (volumeIconHigh) volumeIconHigh.style.display = "block";
    } else {
      if (volumeIconLow) volumeIconLow.style.display = "block";
    }
  }

  function setMuted(muted) {
    isMuted = muted;
    muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
    volumeSection.setAttribute("data-muted", muted ? "true" : "false");

    if (muted) {
      volumeBeforeMute = parseInt(volumeSlider.value);
      volumeSlider.value = 0;
      volumeSlider.setAttribute("disabled", "true");
      volumeSlider.style.pointerEvents = "none";
      console.log("🔇 Volume mutado. Volume anterior:", volumeBeforeMute);
      // Atualiza a barra visual para 0% quando mutado
      if (typeof updateVolumeBar === "function") updateVolumeBar();
      updateVolumeIcons(0, true);
    } else {
      volumeSlider.value = volumeBeforeMute;
      volumeSlider.removeAttribute("disabled");
      volumeSlider.style.pointerEvents = "auto";
      console.log("🔊 Volume desmutado. Volume restaurado:", volumeBeforeMute);
      // Atualiza a barra visual para o valor restaurado
      if (typeof updateVolumeBar === "function") updateVolumeBar();
      updateVolumeIcons(parseInt(volumeSlider.value), false);
    }
  }

  // Device IDs (default) — podem ser sobrescritos por data-* no HTML da página ativa
  let DENON_CMD_DEVICE_ID = getDenonCommandDeviceIdForCurrentRoute(); // Denon AVR - comandos (volume/mute/power)
  let DENON_MUSIC_DEVICE_ID = getDenonMetadataDeviceIdForEnv(
    getEnvironmentKeyFromRouteHash(window.location.hash),
  );

  // Tentar detectar overrides a partir dos atributos data-*
  try {
    const metadataContainer = queryActiveMusic(".music-player-card");
    const ctrlFromEl =
      queryActiveMusic("#music-mute") ||
      queryActiveMusic("#music-volume-slider") ||
      queryActiveMusic("#music-master-on") ||
      queryActiveMusic("#music-master-off");

    if (
      metadataContainer &&
      metadataContainer.dataset &&
      metadataContainer.dataset.metadataDeviceId
    ) {
      DENON_MUSIC_DEVICE_ID = String(
        metadataContainer.dataset.metadataDeviceId,
      );
    }

    if (ctrlFromEl && ctrlFromEl.dataset && ctrlFromEl.dataset.deviceId) {
      DENON_CMD_DEVICE_ID = String(ctrlFromEl.dataset.deviceId);
    }
  } catch (e) {
    console.warn(
      "não foi possível ler overrides de IDs de Denon via data-*:",
      e,
    );
  }

  // Regras por ambiente têm precedência para evitar IDs legados nos controles de volume.
  const currentEnvKey = getEnvironmentKeyFromRouteHash(window.location.hash);
  const forcedDenonCmdId = getDenonCommandDeviceIdForEnv(currentEnvKey);
  if (forcedDenonCmdId) {
    DENON_CMD_DEVICE_ID = String(forcedDenonCmdId);
  }

  [
    queryActiveMusic("#music-mute"),
    queryActiveMusic("#music-volume-slider"),
    queryActiveMusic("#music-master-on"),
    queryActiveMusic("#music-master-off"),
    queryActiveMusic(".music-volume-section"),
  ]
    .filter(Boolean)
    .forEach((el) => {
      el.dataset.deviceId = DENON_CMD_DEVICE_ID;
    });

  playToggleBtn.addEventListener("click", () => {
    const action = isPlaying ? "pause" : "play";
    console.log(
      "🎵 Toggle play/pause -> enviando comando",
      action,
      "para device",
      DENON_MUSIC_DEVICE_ID,
    );

    sendHubitatCommand(DENON_MUSIC_DEVICE_ID, action)
      .then(() => {
        console.log("✅ Comando " + action + " enviado com sucesso");
        setPlaying(!isPlaying);
      })
      .catch((err) =>
        console.error("⚠️Erro ao enviar comando " + action + ":", err),
      );
  });

  nextBtn.addEventListener("click", () => {
    console.log(
      "⏭️ Next clicked - enviando comando para device",
      DENON_MUSIC_DEVICE_ID,
    );
    sendHubitatCommand(DENON_MUSIC_DEVICE_ID, "nextTrack")
      .then(() => console.log("✅ Comando nextTrack enviado com sucesso"))
      .catch((err) =>
        console.error("⚠️Erro ao enviar comando nextTrack:", err),
      );
  });

  prevBtn.addEventListener("click", () => {
    console.log(
      "⏮️ Previous clicked - enviando comando para device",
      DENON_MUSIC_DEVICE_ID,
    );
    sendHubitatCommand(DENON_MUSIC_DEVICE_ID, "previousTrack")
      .then(() => console.log("✅ Comando previousTrack enviado com sucesso"))
      .catch((err) =>
        console.error("⚠️Erro ao enviar comando previousTrack:", err),
      );
  });

  window.musicPlayerUI.setPlaying = setPlaying;
  window.musicPlayerUI.isPlaying = () => isPlaying;

  // Controle de volume
  if (muteBtn && volumeSlider) {
    bindVerticalVolumeSlider(volumeSlider);

    muteBtn.addEventListener("click", () => {
      const newMutedState = !isMuted;
      const command = newMutedState ? "mute" : "unmute";
      console.log(
        `🔇 Mute button clicked - enviando comando "${command}" para device ${DENON_CMD_DEVICE_ID}`,
      );

      sendHubitatCommand(DENON_CMD_DEVICE_ID, command)
        .then(() => {
          console.log(`✅ Comando ${command} enviado com sucesso`);
          setMuted(newMutedState);
        })
        .catch((err) =>
          console.error(`⚠️Erro ao enviar comando ${command}:`, err),
        );
    });

    // Função para atualizar a barra de volume
    function updateVolumeBar() {
      const value = parseInt(volumeSlider.value);
      const percent = (value / 100) * 100;
      volumeSlider.style.setProperty("--volume-percent", percent + "%");
      const volumeDisplay = queryActiveMusic("#music-volume-display");
      if (volumeDisplay) volumeDisplay.textContent = value;
      updateVolumeIcons(value, isMuted);
      console.log("🔊 Volume ajustado para:", value, "% -", percent + "%");
    }

    // Event listener para input (arrastar o slider)
    volumeSlider.addEventListener("input", (e) => {
      updateVolumeBar();
    });

    // Event listener para change (quando solta o slider)
    volumeSlider.addEventListener("change", (e) => {
      updateVolumeBar();
      const value = e.target.value;
      console.log("🔊 Volume finalizado em:", value);
    });

    // If there's a separate music slider, wire it to send commands to Denon (device 15)
    const musicSlider = queryActiveMusic("#music-volume-slider");
    if (musicSlider) {
      musicSlider.addEventListener("input", (e) => {
        // update visual bar for music slider
        const v = parseInt(e.target.value);
        musicSlider.style.setProperty(
          "--volume-percent",
          (v / 100) * 100 + "%",
        );
        const volumeDisplay = queryActiveMusic("#music-volume-display");
        if (volumeDisplay) volumeDisplay.textContent = v;
        updateVolumeIcons(v, isMuted);
      });

      musicSlider.addEventListener("change", (e) => {
        const value = e.target.value;
        console.log(
          `🔊 Music slider changed -> sending setVolume ${value} to Denon (${DENON_CMD_DEVICE_ID})`,
        );
        updateVolumeIcons(parseInt(value, 10), isMuted);
        // Mark recent command to prevent polling overwrite
        recentCommands.set(DENON_CMD_DEVICE_ID, Date.now());
        // Send command
        sendHubitatCommand(DENON_CMD_DEVICE_ID, "setVolume", value)
          .then(() =>
            console.log("✅ setVolume sent to Denon via music slider"),
          )
          .catch((err) =>
            console.error("⚠️Error sending setVolume from music slider:", err),
          );
      });
    }

    // Garantir que o slider seja interativo
    volumeSlider.style.pointerEvents = "auto";

    // Inicializar a barra com o valor padrão
    updateVolumeBar();

    console.log("🎵 Slider de volume configurado:", volumeSlider);
  } else {
    console.warn("⚠️ Botão mute ou slider não encontrados");
  }

  // Controle master On/Off
  function setMasterPower(powerOn) {
    isPowerOn = powerOn;
    window.musicPlayerUI.currentPowerState = powerOn ? "on" : "off";

    if (powerOn) {
      masterOnBtn.classList.add("music-master-btn--active");
      masterOnBtn.setAttribute("aria-pressed", "true");
      masterOffBtn.classList.remove("music-master-btn--active");
      masterOffBtn.setAttribute("aria-pressed", "false");
      playerInner.classList.remove("power-off");
      console.log("⚡ Player ligado");
      // Restaurar estado de mute que havia antes do power-off
      setMuted(previousMutedState);
    } else {
      masterOffBtn.classList.add("music-master-btn--active");
      masterOffBtn.setAttribute("aria-pressed", "true");
      masterOnBtn.classList.remove("music-master-btn--active");
      masterOnBtn.setAttribute("aria-pressed", "false");
      playerInner.classList.add("power-off");
      console.log("⚫ Player desligado");
      // Salvar estado atual de mute e forçar mute enquanto estiver desligado
      previousMutedState = isMuted;
      setMuted(true);
    }
  }

  if (masterOnBtn && masterOffBtn && playerInner) {
    masterOnBtn.addEventListener("click", () => {
      if (!isPowerOn) {
        console.log(
          `Power ON clicked - enviando comando "on" para device ${DENON_CMD_DEVICE_ID}`,
        );
        recentCommands.set(DENON_CMD_DEVICE_ID, Date.now());
        sendHubitatCommand(DENON_CMD_DEVICE_ID, "on")
          .then(() => {
            console.log("✅ Comando on enviado com sucesso");
            setMasterPower(true);
          })
          .catch((err) => console.error("⚠️Erro ao enviar comando on:", err));
      }
    });

    masterOffBtn.addEventListener("click", () => {
      if (isPowerOn) {
        console.log(
          `Power OFF clicked - enviando comando "off" para device ${DENON_CMD_DEVICE_ID}`,
        );
        recentCommands.set(DENON_CMD_DEVICE_ID, Date.now());
        sendHubitatCommand(DENON_CMD_DEVICE_ID, "off")
          .then(() => {
            console.log("✅ Comando off enviado com sucesso");
            setMasterPower(false);
          })
          .catch((err) => console.error("⚠️Erro ao enviar comando off:", err));
      }
    });
  }

  window.musicPlayerUI.setPower = (powerOnValue) =>
    setMasterPower(normalizeDenonPowerState(powerOnValue) === "on");
  window.musicPlayerUI.isPowerOn = () => isPowerOn;

  // initialize
  setPlaying(Boolean(window.musicPlayerUI.currentPlaying));
  setMasterPower(initialPowerState === "on");

  // Buscar metadados iniciais do Denon
  updateDenonMetadata();
  updateDenonVolumeFromServer();

  // Iniciar polling de metadados
  startMusicMetadataPolling();

  syncMusicTrackMarquee();

  console.log("🎵 Player de música inicializado");
}

// Initialize when SPA navigation might insert the music page
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(initMusicPlayerUI, 100);
});

// Versão ultra-básica para browsers problemáticos
function initUltraBasicMode() {
  try {
    showMobileDebug("🚨 Inicializando modo ultra-básico...", "info");

    // Esconder loader de forma mais segura
    var loader = document.getElementById("global-loader");
    if (loader) {
      if (typeof startHomeAnimation === "function") {
        startHomeAnimation();
      } else {
        loader.classList.add("hidden");
        loader.style.display = "none";
      }
      showMobileDebug("✅ Loader escondido em modo básico", "success");
    }

    // Definir estados básicos sem usar localStorage (pode falhar no mobile)
    var processedDevices = 0;
    ALL_LIGHT_IDS.forEach(function (deviceId) {
      try {
        var controls = document.querySelectorAll(
          '[data-device-id="' + deviceId + '"]',
        );
        controls.forEach(function (control) {
          if (control.classList.contains("room-control")) {
            control.dataset.state = "off";
            var img = control.querySelector(".room-control-icon");
            if (img) {
              img.src = "images/icons/icon-small-light-off.svg";
            }
            processedDevices++;
          }
        });
      } catch (e) {
        showMobileDebug(
          "Erro no dispositivo " + deviceId + ": " + e.message,
          "error",
        );
      }
    });

    showMobileDebug(
      "✅ Modo ultra-básico ativo - " +
        processedDevices +
        " dispositivos processados",
      "success",
    );

    // Verificar elementos básicos
    var controls = document.querySelectorAll(".room-control");
    showMobileDebug("🔍 Encontrados " + controls.length + " controles", "info");

    return true; // Sucesso
  } catch (error) {
    showMobileDebug(
      "⚠️ERRO CRÍTICO no modo ultra-básico: " + error.message,
      "error",
    );
    return false; // Falha
  }
}

// Função de inicialização simplificada para mobile COM POLLING ATIVO
function initSimpleMode() {
  console.log("📱 Inicializando modo simples com polling...");

  try {
    console.log("📱 Tentando mostrar loader...");
    showLoader();

    console.log("📱 Atualizando progresso...");
    updateProgress(10, "Modo simples com polling ativo...");

    console.log("📱 Processando", ALL_LIGHT_IDS.length, "dispositivos...");

    // Carregar estados básicos
    for (var i = 0; i < ALL_LIGHT_IDS.length; i++) {
      var deviceId = ALL_LIGHT_IDS[i];
      var progress = 10 + ((i + 1) / ALL_LIGHT_IDS.length) * 70; // Deixar 20% para polling

      console.log(
        "📱 Processando device",
        deviceId,
        "- progresso:",
        progress + "%",
      );
      updateProgress(
        progress,
        "Carregando " + (i + 1) + "/" + ALL_LIGHT_IDS.length + "...",
      );

      try {
        updateDeviceUI(deviceId, "off", true);
      } catch (e) {
        console.error("⚠️Erro no device", deviceId + ":", e);
      }
    }

    console.log("📱 Configurando polling para modo simples...");
    updateProgress(85, "Ativando sincronização...");

    // Configurar observador DOM simplificado
    try {
      setupDomObserver();
      console.log("✅ Observador DOM configurado no modo simples");
    } catch (e) {
      console.warn("⚠️ Observador DOM falhou no modo simples:", e);
    }

    // Sincronizar controles visíveis
    updateProgress(90, "Sincronizando controles...");
    setTimeout(function () {
      try {
        scheduleControlSync(true);
        console.log("✅ Controles sincronizados no modo simples");
      } catch (e) {
        console.warn("⚠️ Sincronização falhou:", e);
      }
    }, 300);

    // IMPLEMENTAR POLLING NO MODO SIMPLES
    updateProgress(95, "Iniciando polling...");
    setTimeout(function () {
      if (isProduction) {
        console.log("🔄 Iniciando polling em modo simples...");
        try {
          startPolling(); // Ativar polling completo mesmo no modo simples
          console.log("✅ Polling ativo no modo simples");
        } catch (e) {
          console.error("⚠️Erro ao iniciar polling no modo simples:", e);
        }
      } else {
        console.log(
          "💻 Modo desenvolvimento - polling não iniciado no modo simples",
        );
      }

      updateProgress(100, "Modo simples com polling ativo!");

      setTimeout(function () {
        console.log("📱 Escondendo loader...");
        hideLoader();
        console.log("✅ Modo simples com polling completo ativo");
      }, 1000);
    }, 2000); // Aguardar 2s para estabilizar antes do polling
  } catch (error) {
    console.error("⚠️ERRO CRÍTICO no modo simples:", error);
    console.error("⚠️Erro stack:", error.stack);
    console.error("⚠️Erro linha:", error.lineNumber || "desconhecida");

    // Ativar modo ultra-básico como fallback
    console.log("🚨 Ativando modo ultra-básico...");
    initUltraBasicMode();
  }
}

// Tratamento de erros globais para debug mobile
window.onerror = function (message, source, lineno, colno, error) {
  console.error("🚨 ERRO GLOBAL DETECTADO:");
  console.error("📍 Mensagem:", message);
  console.error("📍 Arquivo:", source);
  console.error("📍 Linha:", lineno);
  console.error("📍 Coluna:", colno);
  console.error("📍 Erro:", error);

  // Tentar ativar modo ultra-básico
  setTimeout(function () {
    console.log("🚨 Tentando recuperação automática...");
    try {
      initUltraBasicMode();
    } catch (e) {
      console.error("💥 Falha na recuperação:", e);
    }
  }, 1000);

  return false; // não impedir outros handlers
};

// Capturar promises rejeitadas
window.addEventListener("unhandledrejection", function (event) {
  console.error("🚨 PROMISE REJEITADA:", event.reason);
  console.error("🚨 Promise:", event.promise);
});

console.log("Script carregado, configurando DOMContentLoaded...");

// Tentativa de manter a tela ativa (Wake Lock) - útil em dispositivos como Echo Show
let screenWakeLock = null;
let lastHiddenAt = 0;
let keepAliveVideoStarted = false;
let appResumeRefreshInFlight = null;

async function requestScreenWakeLock() {
  if (!("wakeLock" in navigator)) {
    return;
  }

  try {
    if (screenWakeLock) {
      return;
    }

    screenWakeLock = await navigator.wakeLock.request("screen");
    console.log("🔒 Wake Lock ativo");

    screenWakeLock.addEventListener("release", () => {
      console.log("🔓 Wake Lock liberado");
      screenWakeLock = null;
    });
  } catch (error) {
    console.warn("⚠️ Falha ao solicitar Wake Lock:", error);
    screenWakeLock = null;
  }
}

async function softRefreshAfterResume(trigger, hiddenDurationMs) {
  if (appResumeRefreshInFlight) {
    return appResumeRefreshInFlight;
  }

  if (!window.initializationStarted) {
    return null;
  }

  appResumeRefreshInFlight = (async () => {
    try {
      console.log("🔄 Retomando app sem reload...", {
        trigger,
        hiddenDurationMs,
      });

      refreshConfiguredDeviceCaches();

      if (typeof scheduleControlSync === "function") {
        scheduleControlSync(true);
      }

      if (typeof syncHomeLightButtons === "function") {
        syncHomeLightButtons();
      }

      if (typeof window.refreshMainHomeRuntime === "function") {
        await window.refreshMainHomeRuntime(false);
      }
    } catch (error) {
      console.warn("⚠️ Falha ao atualizar app apos retomar:", error);
    } finally {
      appResumeRefreshInFlight = null;
    }
  })();

  return appResumeRefreshInFlight;
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    lastHiddenAt = Date.now();
    return;
  }

  if (document.visibilityState === "visible") {
    requestScreenWakeLock();

    const hiddenDurationMs = lastHiddenAt ? Date.now() - lastHiddenAt : 0;
    lastHiddenAt = 0;

    if (hiddenDurationMs > 10000) {
      setTimeout(() => {
        softRefreshAfterResume("visibilitychange", hiddenDurationMs);
      }, 300);
    }
  }
});

// Vídeo leve em loop via canvas para manter atividade de mídia (fallback adicional)
function startKeepAliveVideo() {
  if (keepAliveVideoStarted) return;
  if (typeof HTMLCanvasElement === "undefined") return;
  if (typeof document.createElement !== "function") return;

  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 2;
  canvas.style.position = "fixed";
  canvas.style.left = "-9999px";
  canvas.style.top = "-9999px";

  const ctx = canvas.getContext("2d");
  if (!ctx || typeof canvas.captureStream !== "function") {
    return;
  }

  const stream = canvas.captureStream(1);
  const video = document.createElement("video");
  video.muted = true;
  video.autoplay = true;
  video.loop = true;
  video.playsInline = true;
  video.style.position = "fixed";
  video.style.width = "1px";
  video.style.height = "1px";
  video.style.opacity = "0.01";
  video.style.left = "-9999px";
  video.style.top = "-9999px";
  video.srcObject = stream;

  document.body.appendChild(canvas);
  document.body.appendChild(video);

  let t = 0;
  const draw = () => {
    t += 1;
    const v = t % 255;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    requestAnimationFrame(draw);
  };
  draw();

  video.play().catch(() => {
    // Requer gesto do usuário; será tentado novamente no primeiro clique
  });

  keepAliveVideoStarted = true;
  console.log("🎞️ Keep-alive de vídeo iniciado");
}

// Algumas plataformas exigem gesto do usuário para ativar Wake Lock
document.addEventListener(
  "click",
  () => {
    requestScreenWakeLock();
    startKeepAliveVideo();
  },
  { once: true },
);

document.addEventListener("DOMContentLoaded", () => {
  requestScreenWakeLock();
  startKeepAliveVideo();
});

function canInitializeDashboardWithAuth() {
  let authReady = true;
  try {
    if (
      window.dashboardAuth &&
      typeof window.dashboardAuth.canInitializeApp === "function"
    ) {
      authReady = window.dashboardAuth.canInitializeApp();
    }
  } catch (error) {
    console.warn("Falha ao verificar estado de autenticação:", error);
  }

  if (!authReady) {
    return false;
  }

  try {
    if (
      window.dashboardAccess &&
      typeof window.dashboardAccess.canInitializeApp === "function"
    ) {
      return window.dashboardAccess.canInitializeApp();
    }
  } catch (error) {
    console.warn("Falha ao verificar permissões de acesso:", error);
  }

  return true;
}

function waitForAuthThenInitialize() {
  if (window.__dashboardAccessInitListenerBound) return;
  window.__dashboardAccessInitListenerBound = true;

  window.addEventListener("dashboard-authenticated", () => {
    if (!window.initializationStarted) {
      initializeApp();
    }
  });

  window.addEventListener("dashboard-access-ready", () => {
    if (!window.initializationStarted) {
      initializeApp();
    }
  });
}

// Função de inicialização unificada (mobile e desktop idênticos)
// Função de inicialização unificada (mobile e desktop idênticos)
function initializeApp() {
  if (!canInitializeDashboardWithAuth()) {
    console.log("Aguardando autenticação para inicializar o dashboard...");
    waitForAuthThenInitialize();
    return;
  }

  console.log("DASHBOARD ELETRIZE INICIALIZANDO");
  console.log("Mobile detectado:", isMobile);

  refreshConfiguredDeviceCaches();

  // Marcar que a inicialização foi iniciada
  window.initializationStarted = true;

  // Debug visual para mobile
  showMobileDebug("DASHBOARD ELETRIZE INICIALIZANDO", "info");

  // Envolver tudo em try-catch para capturar qualquer erro
  try {
    console.log("Iniciando carregamento (comportamento unificado)...");
    showLoader();
    initializeMqttStateBridge().catch((error) => {
      console.warn("Bridge MQTT indisponível na inicialização:", error);
    });

    // Timeout padrão para desktop e mobile (comportamento idêntico)
    var initDelay = 500;
    console.log("Delay de inicialização: " + initDelay + "ms (universal)");

    // Aguardar um pouco para UI carregar e então iniciar carregamento
    setTimeout(function () {
      console.log("Iniciando carregamento principal...");

      try {
        // Carregamento global de todos os estados (usando Promise)
        loadAllDeviceStatesGlobally()
          .then(function (success) {
            console.log("Carregamento global Concluído, success:", success);

            // Delay final padrão para desktop e mobile
            var finalDelay = 800;
            setTimeout(function () {
              // Esconder loader
              hideLoader();

              // Configurar observador DOM
              setupDomObserver();

              // Inicializar página de cômodo e sincronizar controles já existentes
              var syncDelay = 100;
              setTimeout(() => {
                console.log(
                  "🔊 Inicializando controles de cômodos na inicialização...",
                );
                initRoomPage(); // Inicializar pagina de comodo
                scheduleControlSync(true); // Sincronizar todos os controles
              }, syncDelay);

              // Iniciar polling se estiver em produção
              if (isProduction) {
                var pollingDelay = 3000;
                console.log(
                  "✅ INICIANDO POLLING em " +
                    pollingDelay / 1000 +
                    " segundos (universal)",
                  {
                    isProduction: isProduction,
                    hostname: location.hostname,
                    isMobile: isMobile,
                  },
                );
                setTimeout(startPolling, pollingDelay);
              } else {
                console.log("⚠️POLLING NÃO INICIADO - não está em produção:", {
                  isProduction: isProduction,
                  hostname: location.hostname,
                  isMobile: isMobile,
                });
              }

              console.log("Aplicação totalmente inicializada!");
              showMobileDebug("App totalmente inicializada!", "success");

              // Marcar que a inicialização foi concluída
              window.appFullyInitialized = true;
            }, finalDelay);
          })
          .catch(function (error) {
            console.error("Erro no carregamento global:", error);
            showMobileDebug("Erro no carregamento: " + error.message, "error");
            hideLoader();

            // Fallback para modo básico
            setTimeout(function () {
              try {
                initUltraBasicMode();
              } catch (ultraError) {
                console.error("Falha total na recuperação:", ultraError);
                updateProgress(100, "Erro crítico - recarregue a página");
                setTimeout(function () {
                  hideLoader();
                }, 3000);
              }
            }, 1000);
          });
      } catch (loadError) {
        console.error("Erro crítico na inicialização:", loadError);
        showMobileDebug("ERRO CRÍTICO: " + loadError.message, "error");

        // Modo de emergência
        try {
          initUltraBasicMode();
        } catch (emergencyError) {
          console.error("Falha no modo de emergência:", emergencyError);
          updateProgress(100, "Erro crítico - recarregue a página");
          setTimeout(hideLoader, 3000);
        }
      }
    }, initDelay);
  } catch (mainError) {
    console.error("ERRO CRITICO NA INICIALIZACAO PRINCIPAL:", mainError);
    showMobileDebug("ERRO PRINCIPAL: " + mainError.message, "error");

    // Último recurso - modo ultra-básico
    try {
      initUltraBasicMode();
    } catch (finalError) {
      console.error("FALHA TOTAL:", finalError);
      showMobileDebug("FALHA TOTAL: " + finalError.message, "error");
    }
  }
}

// inicialização global da aplicação
window.addEventListener("DOMContentLoaded", function () {
  console.log("DOMContentLoaded executado, chamando initializeApp...");
  initializeApp();
});

// Fallback se DOMContentLoaded não funcionar
setTimeout(function () {
  if (!window.initializationStarted) {
    console.log(
      "Fallback: DOMContentLoaded não executou, forçando inicialização...",
    );
    initializeApp();
  }
}, 2000);

// Parar polling quando a página é fechada
window.addEventListener("beforeunload", stopPolling);

// Funções de debug disponíveis globalmente
window.testHubitatConnection = testHubitatConnection;
window.showErrorMessage = showErrorMessage;

// Funções master de cortinas (abrir/fechar todas)
function handleMasterCurtainsOpen() {
  console.log("🎬 Abrindo todas as cortinas...");
  const btn = document.getElementById("master-curtains-open-btn");
  if (btn) {
    btn.classList.add("loading");
  }

  // Encontrar todas as cortinas
  const curtainButtons = document.querySelectorAll(
    ".curtain-tile__btn[data-device-id]",
  );
  const curtainIds = new Set();

  curtainButtons.forEach((button) => {
    const id = button.dataset.deviceId;
    if (id && !curtainIds.has(id)) {
      curtainIds.add(id);
      curtainAction(button, "open");
    }
  });

  setTimeout(() => {
    if (btn) {
      btn.classList.remove("loading");
    }
  }, 2000);

  console.log(
    `✅ Comando de abertura enviado para ${curtainIds.size} cortinas`,
  );
}

function handleMasterCurtainsClose() {
  console.log("🎬 Fechando todas as cortinas...");
  const btn = document.getElementById("master-curtains-close-btn");
  if (btn) {
    btn.classList.add("loading");
  }

  // Encontrar todas as cortinas
  const curtainButtons = document.querySelectorAll(
    ".curtain-tile__btn[data-device-id]",
  );
  const curtainIds = new Set();

  curtainButtons.forEach((button) => {
    const id = button.dataset.deviceId;
    if (id && !curtainIds.has(id)) {
      curtainIds.add(id);
      curtainAction(button, "close");
    }
  });

  setTimeout(() => {
    if (btn) {
      btn.classList.remove("loading");
    }
  }, 2000);

  console.log(
    `✅ Comando de fechamento enviado para ${curtainIds.size} cortinas`,
  );
}

const CURTAIN_DRAWER_ANIMATION_MS = 460;

function getCurtainDrawerAnimationDuration() {
  if (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return 0;
  }

  return CURTAIN_DRAWER_ANIMATION_MS;
}

function updateCurtainDrawerAccessibility(drawer, expanded) {
  const summary = drawer?.querySelector(".curtain-drawer__summary");
  if (summary) {
    summary.setAttribute("aria-expanded", expanded ? "true" : "false");
  }
}

function closeSiblingCurtainDrawers(activeDrawer) {
  const drawerContainer = activeDrawer?.closest(".curtain-layout");
  if (!drawerContainer) {
    return;
  }

  drawerContainer.querySelectorAll(".curtain-drawer[open]").forEach((drawer) => {
    if (drawer !== activeDrawer) {
      setCurtainDrawerOpen(drawer, false);
    }
  });
}

function setCurtainDrawerOpen(drawer, shouldOpen) {
  if (!drawer || typeof drawer.open === "undefined") {
    return;
  }

  window.clearTimeout(drawer._curtainDrawerTimer);
  drawer._curtainDrawerAnimationToken =
    (drawer._curtainDrawerAnimationToken || 0) + 1;
  const animationToken = drawer._curtainDrawerAnimationToken;
  const duration = getCurtainDrawerAnimationDuration();

  if (shouldOpen) {
    drawer.open = true;
    drawer.classList.remove("is-closing");
    drawer.classList.add("is-animating");
    drawer.classList.remove("is-open");
    updateCurtainDrawerAccessibility(drawer, true);
    closeSiblingCurtainDrawers(drawer);

    drawer.getBoundingClientRect();

    const finishOpen = () => {
      if (drawer._curtainDrawerAnimationToken !== animationToken) {
        return;
      }

      drawer.classList.remove("is-animating");
      drawer._curtainDrawerTimer = null;
    };

    if (!duration) {
      drawer.classList.add("is-open");
      finishOpen();
      return;
    }

    window.requestAnimationFrame(() => {
      if (
        drawer._curtainDrawerAnimationToken !== animationToken ||
        !drawer.open ||
        drawer.classList.contains("is-closing")
      ) {
        return;
      }

      drawer.classList.add("is-open");
      drawer._curtainDrawerTimer = window.setTimeout(finishOpen, duration);
    });
    return;
  }

  updateCurtainDrawerAccessibility(drawer, false);

  if (!drawer.open) {
    drawer.classList.remove("is-open", "is-closing", "is-animating");
    return;
  }

  drawer.classList.add("is-closing", "is-animating");
  drawer.classList.remove("is-open");

  const finishClose = () => {
    if (drawer._curtainDrawerAnimationToken !== animationToken) {
      return;
    }

    drawer.open = false;
    drawer.classList.remove("is-closing", "is-animating");
    drawer._curtainDrawerTimer = null;
  };

  if (!duration) {
    finishClose();
    return;
  }

  drawer._curtainDrawerTimer = window.setTimeout(finishClose, duration);
}

function handleCurtainDrawerSummaryClick(event) {
  const target = event.target;
  if (!target || !target.closest) {
    return;
  }

  const summary = target.closest(".curtain-drawer__summary");
  if (!summary) {
    return;
  }

  const drawer = summary.closest(".curtain-drawer");
  if (!drawer) {
    return;
  }

  event.preventDefault();
  setCurtainDrawerOpen(
    drawer,
    !drawer.open || drawer.classList.contains("is-closing"),
  );
}

function syncCurtainDrawers(currentDrawer) {
  if (!currentDrawer) {
    return;
  }

  if (!currentDrawer.open) {
    currentDrawer.classList.remove("is-open", "is-closing", "is-animating");
    updateCurtainDrawerAccessibility(currentDrawer, false);
    return;
  }

  currentDrawer.classList.add("is-open");
  updateCurtainDrawerAccessibility(currentDrawer, true);
  closeSiblingCurtainDrawers(currentDrawer);
}

document.addEventListener("click", handleCurtainDrawerSummaryClick);

// Exportar funções usadas em onclick="" no HTML (necessário para IIFE)
window.toggleRoomControl = toggleRoomControl;
window.toggleLedModeControl = toggleLedModeControl;
window.toggleDimmerControl = toggleDimmerControl;
window.handleDimmerInput = handleDimmerInput;
window.handleDimmerChange = handleDimmerChange;
window.startDimmerLongPress = startDimmerLongPress;
window.cancelDimmerLongPress = cancelDimmerLongPress;
window.togglePoolControl = togglePoolControl;
window.fireTVMacro = fireTVMacro;
window.telaoMacroOn = telaoMacroOn;
window.telaoMacroOff = telaoMacroOff;
window.htvMacroOn = htvMacroOn;
window.htvMacroOff = htvMacroOff;
window.tvMacroOn = tvMacroOn;
window.tvMacroOff = tvMacroOff;
window.suiteMasterHtvOn = suiteMasterHtvOn;
window.suiteMasterHtvOff = suiteMasterHtvOff;
window.suiteMasterTvOn = suiteMasterTvOn;
window.suiteMasterTvOff = suiteMasterTvOff;
window.suite1HtvOn = suite1HtvOn;
window.suite1HtvOff = suite1HtvOff;
window.suite1TvOn = suite1TvOn;
window.suite1TvOff = suite1TvOff;
window.suite2HtvOn = suite2HtvOn;
window.suite2HtvOff = suite2HtvOff;
window.suite2TvOn = suite2TvOn;
window.suite2TvOff = suite2TvOff;
window.tvCommand = tvCommand;
window.curtainAction = curtainAction;
window.syncCurtainDrawers = syncCurtainDrawers;
window.spaNavigate = spaNavigate;
window.handleMasterCurtainsOpen = handleMasterCurtainsOpen;
window.handleMasterCurtainsClose = handleMasterCurtainsClose;

// Exportar funções de animação
window.hideLoader = hideLoader;
window.startHomeAnimation = startHomeAnimation;

// === Premium feedback: pressed (toque/click) ===
function setupPremiumPressFeedback() {
  try {
    let pressedEl = null;

    const clearPressed = () => {
      if (pressedEl && pressedEl.classList) {
        pressedEl.classList.remove("is-pressed");
      }
      pressedEl = null;
    };

    document.addEventListener(
      "pointerdown",
      (e) => {
        const target =
          e.target && e.target.closest ? e.target.closest("button") : null;
        if (!target) return;

        // Evitar conflito com botões que já têm animações próprias
        if (
          target.classList.contains("room-master-btn") ||
          target.classList.contains("room-curtain-master-btn") ||
          target.classList.contains("app-logo-trigger")
        ) {
          return;
        }

        // Não aplicar se estiver desabilitado ou em loading
        if (target.disabled) return;
        if (target.classList.contains("loading")) return;
        if (target.dataset && target.dataset.loading === "true") return;

        if (pressedEl && pressedEl !== target) {
          pressedEl.classList.remove("is-pressed");
        }
        pressedEl = target;
        pressedEl.classList.add("is-pressed");
      },
      true,
    );

    document.addEventListener("pointerup", clearPressed, true);
    document.addEventListener("pointercancel", clearPressed, true);
    window.addEventListener("blur", clearPressed, true);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") clearPressed();
    });
  } catch (e) {
    // ignore
  }
}

let cinematicHomeLongPressBound = false;

function setupCinematicHomeLongPress() {
  if (cinematicHomeLongPressBound) return;
  cinematicHomeLongPressBound = true;

  const pressState = {
    timer: null,
    target: null,
    pointerId: null,
    suppressClick: false,
    suppressResetTimer: null,
  };

  const clearPressTimer = () => {
    if (pressState.timer) {
      clearTimeout(pressState.timer);
      pressState.timer = null;
    }
  };

  const clearSuppressedClick = () => {
    pressState.suppressClick = false;
    if (pressState.suppressResetTimer) {
      clearTimeout(pressState.suppressResetTimer);
      pressState.suppressResetTimer = null;
    }
  };

  const resetPressState = () => {
    clearPressTimer();
    pressState.target = null;
    pressState.pointerId = null;
  };

  const armSuppressedClick = () => {
    clearSuppressedClick();
    pressState.suppressClick = true;
    pressState.suppressResetTimer = setTimeout(() => {
      clearSuppressedClick();
    }, 1400);
  };

  const isHomeButton = (button) => {
    if (!button || !button.classList?.contains("nav-item")) return false;

    const page = String(button.dataset?.page || "")
      .trim()
      .toLowerCase();
    const navId = String(button.dataset?.navId || "")
      .trim()
      .toLowerCase();

    if (page === "home" || navId === "home") return true;

    const ariaLabel = String(button.getAttribute("aria-label") || "")
      .trim()
      .toLowerCase();
    if (ariaLabel.includes("home")) return true;

    const nav = button.closest("#spa-navbar");
    return Boolean(nav?.classList?.contains("is-control-home-mode"));
  };

  const resolveHomeButtonFromEvent = (event) => {
    const candidate = event?.target?.closest?.("#spa-navbar .nav-item");
    if (!candidate) return null;
    return isHomeButton(candidate) ? candidate : null;
  };

  const onPointerDown = (event) => {
    const button = resolveHomeButtonFromEvent(event);
    if (!button) return;
    if (button.disabled || button.classList.contains("is-disabled")) return;

    clearPressTimer();
    pressState.target = button;
    pressState.pointerId =
      event && Number.isFinite(event.pointerId) ? event.pointerId : null;

    pressState.timer = setTimeout(() => {
      pressState.timer = null;

      if (!pressState.target || !pressState.target.isConnected) return;

      armSuppressedClick();
      toggleCinematicMode();
      debugLog(() => [
        "cinematicModeLongPress",
        { enabled: isCinematicModeEnabled() },
      ]);
    }, CINEMATIC_HOME_HOLD_MS);
  };

  const onPointerEnd = (event) => {
    if (
      pressState.pointerId !== null &&
      Number.isFinite(event?.pointerId) &&
      event.pointerId !== pressState.pointerId
    ) {
      return;
    }
    resetPressState();
  };

  const onClickCapture = (event) => {
    if (!pressState.suppressClick) return;

    const button = resolveHomeButtonFromEvent(event);
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }

    clearSuppressedClick();
  };

  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("pointerup", onPointerEnd, true);
  document.addEventListener("pointercancel", onPointerEnd, true);
  document.addEventListener("click", onClickCapture, true);

  window.addEventListener("blur", () => {
    resetPressState();
    clearSuppressedClick();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") {
      resetPressState();
      clearSuppressedClick();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  syncCinematicModeDomState();
  setupPremiumPressFeedback();
  setupCinematicHomeLongPress();
});

console.log("📜 SCRIPT.JS CARREGADO COMPLETAMENTE!");




