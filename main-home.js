/* eslint-disable no-console */
(function (global) {
  "use strict";

  const WEATHER_ICONS = {
    clearDay: "assets/icons/weather/weather-clear-day.svg",
    clearNight: "assets/icons/weather/weather-clear-night.svg",
    partlyCloudyDay: "assets/icons/weather/weather-partly-cloudy-day.svg",
    partlyCloudyNight: "assets/icons/weather/weather-partly-cloudy-night.svg",
    cloudy: "assets/icons/weather/weather-cloudy.svg",
    fog: "assets/icons/weather/weather-fog.svg",
    drizzle: "assets/icons/weather/weather-drizzle.svg",
    thunderstorm: "assets/icons/weather/weather-thunderstorm.svg",
    unknown: "assets/icons/weather/weather-unknown.svg",
  };

  const NOW_PLAYING_ICONS = {
    play: "assets/icons/icon-play.svg",
    pause: "assets/icons/icon-pause.svg",
    mute: "assets/icons/icon-mute.svg",
    volume: "assets/icons/icon-volume.svg",
  };

  const DEVICE_TYPE_ICON_MAP = {
    lights: {
      on: "assets/icons/icon-small-light-on.svg",
      off: "assets/icons/icon-small-light-off.svg",
    },
    curtains: "assets/icons/icon-curtain.svg",
    comfort: "assets/icons/ar-condicionado.svg",
    tv: "assets/icons/icon-tv.svg",
    htv: "assets/icons/icon-htv.svg",
    bluray: "assets/icons/icon-bluray.svg",
    appletv: "assets/icons/icon-apple-tv.svg",
    clarotv: "assets/icons/icon-clarotv.svg",
    music: "assets/icons/icon-musica.svg",
    roku: "assets/icons/icon-roku.svg",
    games: "assets/icons/icon-games.svg",
    hidromassagem: "assets/icons/icon-hidromassagem.svg",
  };

  const ACTIVE_DEVICE_TYPES = [
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

  const WEATHER_GREETING_VARIATIONS = {
    clear: {
      madrugada: ["Madrugada de céu limpo!", "Céu aberto nesta madrugada!"],
      dia: ["Bom dia de sol!", "Dia ensolarado por aqui!"],
      tarde: ["Boa tarde ensolarada!", "Sol forte nesta tarde!"],
      noite: ["Boa noite de céu limpo!", "Noite limpa e agradável!"],
    },
    partlyCloudy: {
      madrugada: [
        "Madrugada com poucas nuvens!",
        "Nuvens leves nesta madrugada!",
      ],
      dia: ["Bom dia parcialmente nublado!", "Manhã com sol entre nuvens!"],
      tarde: ["Tarde com nuvens leves!", "Boa tarde com sol e nuvens!"],
      noite: ["Noite parcialmente nublada!", "Céu com nuvens leves a noite!"],
    },
    cloudy: {
      madrugada: ["Madrugada nublada!", "Nuvens carregando a madrugada!"],
      dia: ["Bom dia nublado!", "Manhã com bastante nuvem!"],
      tarde: ["Tarde nublada por aqui!", "Boa tarde com céu fechado!"],
      noite: ["Noite nublada!", "Céu fechado nesta noite!"],
    },
    fog: {
      madrugada: ["Madrugada com névoa!", "Nevoa presente nesta madrugada!"],
      dia: ["Bom dia com nevoeiro!", "Visibilidade reduzida nesta manhã!"],
      tarde: ["Tarde com neblina!", "Boa tarde com nevoeiro leve!"],
      noite: ["Noite com névoa!", "Nevoeiro tomando conta da noite!"],
    },
    rainy: {
      madrugada: ["Madrugada de chuva!", "Chuva marcando a madrugada!"],
      dia: ["Bom dia chuvoso!", "Manhã de chuva por aqui!"],
      tarde: ["Tarde de chuva!", "Boa tarde com chuva!"],
      noite: ["Noite chuvosa!", "Chuva acompanhando a noite!"],
    },
    thunderstorm: {
      madrugada: ["Madrugada com trovoadas!", "Trovoadas nesta madrugada!"],
      dia: ["Bom dia com tempestade!", "Tempo instavel nesta manhã!"],
      tarde: ["Tarde de tempestade!", "Trovoadas nesta tarde!"],
      noite: ["Noite com tempestade!", "Trovoadas ao longo da noite!"],
    },
    unknown: {
      madrugada: ["Boa madrugada!", "Madrugada tranquila!"],
      dia: ["Bom dia!", "Que seja um ótimo dia!"],
      tarde: ["Boa tarde!", "Que seja uma tarde excelente!"],
      noite: ["Boa noite!", "Que seja uma noite tranquila!"],
    },
  };

  function createMainHomeRuntime(options) {
    const cfg = options || {};
    const adapters = cfg.adapters || {};
    const config = cfg.config || {};

    const state = {
      weatherCache: null,
      weatherFetchPromise: null,
      weatherTimer: null,
      nowPlayingTimer: null,
      playing: "idle",
      muted: false,
      nowPlayingDeviceId: "",
      activeDevices: [],
      paused: false,
      destroyed: false,
    };

    const NOW_PLAYING_DEVICE_STORAGE_KEY =
      "mainHome:lastNowPlayingMusicDeviceId";
    const NOW_PLAYING_REFRESH_MS = 8000;
    const ENABLE_HOME_NOW_PLAYING = false;

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

    function parseBooleanLike(value) {
      if (typeof value === "boolean") return value;
      const v = String(value || "")
        .trim()
        .toLowerCase();
      return ["true", "1", "on", "yes", "sim", "muted"].includes(v);
    }

    function normalizeState(value) {
      return String(value || "")
        .trim()
        .toLowerCase();
    }

    function isActiveState(value) {
      const s = normalizeState(value);
      if (!s) return false;
      const inactive = new Set([
        "off",
        "closed",
        "closing",
        "close",
        "stopped",
        "stop",
        "idle",
        "paused",
        "pause",
        "false",
        "0",
        "unknown",
        "unavailable",
        "none",
        "null",
      ]);
      return !inactive.has(s);
    }

    function weatherGroupByCode(code) {
      const n = Number(code);
      if (n === 0) return "clear";
      if (n === 1 || n === 2) return "partlyCloudy";
      if (n === 3) return "cloudy";
      if (n === 45 || n === 48) return "fog";
      if ((n >= 51 && n <= 67) || (n >= 80 && n <= 82) || n === 85 || n === 86)
        return "rainy";
      if (n === 95 || n === 96 || n === 99) return "thunderstorm";
      if (n >= 71 && n <= 77) return "cloudy";
      return "unknown";
    }

    function getDayPeriod(date) {
      const h = date.getHours();
      if (h < 5) return "madrugada";
      if (h < 12) return "dia";
      if (h < 18) return "tarde";
      return "noite";
    }

    function padDatePart(value) {
      return String(value).padStart(2, "0");
    }

    function dateKey(date) {
      return `${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
    }

    function pickMessage(options, seed) {
      const list = Array.isArray(options)
        ? options
        : typeof options === "string"
          ? [options]
          : [];
      if (!list.length) return "";
      return list[Math.abs(seed) % list.length];
    }

    function formatWeatherMessage(template, variables) {
      return String(template || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) =>
        Object.prototype.hasOwnProperty.call(variables, key)
          ? String(variables[key])
          : "",
      );
    }

    function getWeatherMessagesConfig() {
      const messages = config.weather?.messages || {};
      const weekdayNames = Array.isArray(messages.weekdayNames) &&
        messages.weekdayNames.length >= 7
        ? messages.weekdayNames
        : [
            "domingo",
            "segunda",
            "terca",
            "quarta",
            "quinta",
            "sexta",
            "sabado",
          ];
      const weekdayShortNames = Array.isArray(messages.weekdayShortNames) &&
        messages.weekdayShortNames.length >= 7
        ? messages.weekdayShortNames
        : ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

      return {
        includeWeekday: messages.includeWeekday === true,
        weekdayFormat: messages.weekdayFormat || "{message}",
        weekdayNames,
        weekdayShortNames,
        festiveDates: messages.festiveDates || {},
      };
    }

    function festiveMessagesForDate(date, messagesConfig) {
      const key = dateKey(date);
      const entry = messagesConfig.festiveDates?.[key];
      if (!entry) return [];
      if (Array.isArray(entry)) return entry;
      if (typeof entry === "string") return [entry];
      if (Array.isArray(entry.messages)) return entry.messages;
      if (typeof entry.message === "string") return [entry.message];
      return [];
    }

    function greetingForNow(weatherCode) {
      const now = new Date();
      const group = weatherGroupByCode(weatherCode);
      const period = getDayPeriod(now);
      const messagesConfig = getWeatherMessagesConfig();
      const seed =
        Math.floor(now.getTime() / 86400000) +
        now.getHours() +
        Number(weatherCode || 0);
      const festiveOptions = festiveMessagesForDate(now, messagesConfig);
      const weatherOptions = WEATHER_GREETING_VARIATIONS[group]?.[period] ||
        WEATHER_GREETING_VARIATIONS.unknown[period] || ["Bom dia!"];
      const baseMessage =
        pickMessage(festiveOptions, seed) || pickMessage(weatherOptions, seed);
      const variables = {
        message: baseMessage,
        weekday: messagesConfig.weekdayNames[now.getDay()] || "",
        weekdayShort: messagesConfig.weekdayShortNames[now.getDay()] || "",
        date: `${padDatePart(now.getDate())}/${padDatePart(now.getMonth() + 1)}`,
        day: padDatePart(now.getDate()),
        month: padDatePart(now.getMonth() + 1),
        period,
        weatherGroup: group,
      };

      const formattedMessage = formatWeatherMessage(baseMessage, variables);
      if (!messagesConfig.includeWeekday) return formattedMessage;
      if (/\{weekday(?:Short)?\}/.test(baseMessage)) return formattedMessage;

      return formatWeatherMessage(messagesConfig.weekdayFormat, {
        ...variables,
        message: formattedMessage,
      });
    }

    function weatherIconByCode(code, isDay) {
      const n = Number(code);
      const day = Number(isDay) === 1;
      if (n === 0)
        return day ? WEATHER_ICONS.clearDay : WEATHER_ICONS.clearNight;
      if (n === 1 || n === 2)
        return day
          ? WEATHER_ICONS.partlyCloudyDay
          : WEATHER_ICONS.partlyCloudyNight;
      if (n === 3) return WEATHER_ICONS.cloudy;
      if (n === 45 || n === 48) return WEATHER_ICONS.fog;
      if ((n >= 51 && n <= 67) || (n >= 80 && n <= 82) || n === 85 || n === 86)
        return WEATHER_ICONS.drizzle;
      if (n === 95 || n === 96 || n === 99) return WEATHER_ICONS.thunderstorm;
      if (n >= 71 && n <= 77) return WEATHER_ICONS.cloudy;
      return WEATHER_ICONS.unknown;
    }

    function formatTemp(value) {
      const n = Number(value);
      if (!Number.isFinite(n)) return "--°C";
      return `${Math.round(n)}°C`;
    }

    function weatherRequestUrl() {
      const w = config.weather || {};
      const lat = Number(w.latitude);
      const lon = Number(w.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const query = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lon),
        current: "temperature_2m,weather_code,is_day",
        timezone: String(w.timezone || "auto"),
        forecast_days: "1",
      });
      return `https://api.open-meteo.com/v1/forecast?${query.toString()}`;
    }

    async function fetchWeather(force) {
      const ttl =
        Math.max(1, Number(config.weather?.refreshMinutes) || 15) * 60 * 1000;
      const now = Date.now();
      if (
        !force &&
        state.weatherCache &&
        now - state.weatherCache.fetchedAt < ttl
      ) {
        return state.weatherCache;
      }
      if (state.weatherFetchPromise) return state.weatherFetchPromise;

      const url = weatherRequestUrl();
      if (!url) {
        return { ok: false, error: "weather config missing" };
      }

      state.weatherFetchPromise = fetch(url, { method: "GET" })
        .then((r) => {
          if (!r.ok) throw new Error(`weather http ${r.status}`);
          return r.json();
        })
        .then((payload) => {
          const cur = payload?.current || {};
          const result = {
            ok: true,
            fetchedAt: Date.now(),
            temperature: Number(cur.temperature_2m),
            weatherCode: Number(cur.weather_code),
            isDay: Number(cur.is_day),
          };
          state.weatherCache = result;
          return result;
        })
        .catch((error) => ({
          ok: false,
          error: String(error?.message || error),
        }))
        .finally(() => {
          state.weatherFetchPromise = null;
        });
      return state.weatherFetchPromise;
    }

    function updateWeatherUi(snapshot, mode) {
      const chip = byId("spa-weather-chip");
      const greeting = byId("spa-weather-greeting");
      const icon = byId("spa-weather-icon");
      const value = byId("spa-weather-value");
      if (!chip || !greeting || !icon || !value) return;

      chip.dataset.state = mode || "ready";

      const code = snapshot?.ok ? snapshot.weatherCode : NaN;
      greeting.textContent = greetingForNow(code);

      if (!snapshot || snapshot.ok === false) {
        icon.src = WEATHER_ICONS.unknown;
        value.textContent = "--°C";
        return;
      }

      icon.src = weatherIconByCode(snapshot.weatherCode, snapshot.isDay);
      value.textContent = formatTemp(snapshot.temperature);
    }

    async function refreshWeather(force) {
      updateWeatherUi(null, "loading");
      const weather = await fetchWeather(force);
      updateWeatherUi(weather, weather?.ok ? "ready" : "error");
    }

    function getStoredState(deviceId) {
      if (typeof adapters.getStoredState === "function") {
        return adapters.getStoredState(String(deviceId));
      }
      try {
        return localStorage.getItem(`deviceState:${deviceId}`);
      } catch {
        return null;
      }
    }

    function setStoredState(deviceId, value) {
      if (typeof adapters.setStoredState === "function") {
        adapters.setStoredState(String(deviceId), String(value));
        return;
      }
      try {
        localStorage.setItem(`deviceState:${deviceId}`, String(value));
      } catch {}
    }

    function readRememberedNowPlayingDeviceId() {
      try {
        return String(
          localStorage.getItem(NOW_PLAYING_DEVICE_STORAGE_KEY) || "",
        ).trim();
      } catch {
        return "";
      }
    }

    function rememberNowPlayingDeviceId(deviceId) {
      const id = String(deviceId || "").trim();
      if (!id) return;
      state.nowPlayingDeviceId = id;
      try {
        localStorage.setItem(NOW_PLAYING_DEVICE_STORAGE_KEY, id);
      } catch {}
    }

    function rememberLastEnvironmentRoute(route) {
      const normalized = normalizeState(route);
      if (!/^ambiente\d+$/.test(normalized)) return;
      try {
        localStorage.setItem("lastEnvironmentRoute", normalized);
      } catch {}
    }

    function getLastEnvironmentRoute(validRoutes, fallback) {
      const normalizedFallback = normalizeState(fallback);
      const allowed = new Set((validRoutes || []).map(normalizeState));
      try {
        const saved = normalizeState(
          localStorage.getItem("lastEnvironmentRoute"),
        );
        if (saved && allowed.has(saved)) return saved;
      } catch {}
      return normalizedFallback;
    }

    function iconForDevice(type, currentState) {
      const t = normalizeState(type);
      if (t === "lights") {
        return isActiveState(currentState)
          ? DEVICE_TYPE_ICON_MAP.lights.on
          : DEVICE_TYPE_ICON_MAP.lights.off;
      }
      return DEVICE_TYPE_ICON_MAP[t] || "assets/icons/eletrize.svg";
    }

    function offCommandByType(type) {
      return normalizeState(type) === "curtains" ? "close" : "off";
    }

    function offStateByType(type) {
      return normalizeState(type) === "curtains" ? "closed" : "off";
    }

    function collectDevicesByEnvironment() {
      const envs =
        typeof adapters.getVisibleEnvironments === "function"
          ? adapters.getVisibleEnvironments()
          : [];

      const MEDIA_TYPES_THAT_IMPLY_TV = new Set([
        "clarotv",
        "appletv",
        "bluray",
      ]);

      return envs
        .map((env) => {
          const entries = [];
          const pushDevice = (type, item, fallbackName, options = {}) => {
            const id = String(item?.id || item?.deviceId || "").trim();
            if (!id) return;
            const name = String(item?.name || fallbackName || id).trim();
            const state = normalizeState(getStoredState(id));
            const forceActive = options?.forceActive === true;
            if (!forceActive && !isActiveState(state)) return;
            const effectiveState = forceActive ? "on" : state;
            entries.push({
              id,
              type,
              name,
              icon: iconForDevice(type, effectiveState),
              commandOff: offCommandByType(type),
              offState: offStateByType(type),
            });
          };

          (env?.lights || []).forEach((d) => pushDevice("lights", d, "Luz"));
          (env?.curtains || []).forEach((d) =>
            pushDevice("curtains", d, "Cortina"),
          );
          ACTIVE_DEVICE_TYPES.forEach((type) =>
            (env?.[type] || []).forEach((d) => pushDevice(type, d, type)),
          );

          // Se uma fonte de mídia estiver ligada, assumir a TV como ligada no card da Home.
          const hasActiveMediaThatImpliesTv = entries.some((entry) =>
            MEDIA_TYPES_THAT_IMPLY_TV.has(normalizeState(entry.type)),
          );

          if (hasActiveMediaThatImpliesTv) {
            (env?.tv || []).forEach((tvDevice) => {
              const tvId = String(
                tvDevice?.id || tvDevice?.deviceId || "",
              ).trim();
              if (!tvId) return;
              const alreadyListed = entries.some(
                (entry) =>
                  entry.id === tvId && normalizeState(entry.type) === "tv",
              );
              if (alreadyListed) return;
              pushDevice("tv", tvDevice, "TV", { forceActive: true });
            });
          }

          if (env?.airConditioner?.deviceId) {
            pushDevice(
              "comfort",
              { id: env.airConditioner.deviceId, name: "Ar Condicionado" },
              "Ar Condicionado",
            );
          }
          (env?.airConditioner?.zones || []).forEach((z) => {
            if (!z?.deviceId) return;
            pushDevice(
              "comfort",
              { id: z.deviceId, name: "Ar Condicionado" },
              "Ar Condicionado",
            );
          });

          if (!entries.length) return null;
          return {
            envKey: env.key,
            envName: env.name || env.key,
            devices: entries,
          };
        })
        .filter(Boolean);
    }

    function syncActiveDevicesCardSize() {
      const card = byId("main-active-devices-card");
      const nav = byId("spa-navbar");
      if (!card || !nav) return;
      const cardRect = card.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      const gap = 24;
      const minHeight = 176;
      const available = Math.floor(navRect.top - cardRect.top - gap);
      if (!Number.isFinite(available)) return;
      const h = Math.max(minHeight, available);
      card.style.height = `${h}px`;
      card.style.maxHeight = `${h}px`;
    }

    async function turnOffSingleDevice(device) {
      if (typeof adapters.sendCommand !== "function") return;
      await adapters.sendCommand(device.id, device.commandOff);
      setStoredState(device.id, device.offState);
    }

    async function animateActiveDeviceItemRemoval(itemEl) {
      if (!itemEl || itemEl.dataset.removing === "true") return;

      const height = Math.max(
        1,
        Math.ceil(itemEl.getBoundingClientRect().height),
      );
      itemEl.style.setProperty("--main-active-item-height", `${height}px`);
      itemEl.dataset.removing = "true";

      await new Promise((resolve) => {
        let done = false;

        const finish = () => {
          if (done) return;
          done = true;
          itemEl.removeEventListener("transitionend", onTransitionEnd);
          resolve();
        };

        const onTransitionEnd = (event) => {
          if (event.target !== itemEl) return;
          if (
            event.propertyName !== "max-height" &&
            event.propertyName !== "opacity"
          ) {
            return;
          }
          finish();
        };

        itemEl.addEventListener("transitionend", onTransitionEnd);

        requestAnimationFrame(() => {
          itemEl.classList.add("is-removing");
        });

        setTimeout(finish, 460);
      });
    }

    async function animateActiveDeviceItemsRemoval(
      itemElements,
      staggerMs = 36,
    ) {
      const items = Array.from(itemElements || []).filter(
        (item) => item && item.dataset?.removing !== "true",
      );
      if (!items.length) return;

      await Promise.all(
        items.map(
          (item, index) =>
            new Promise((resolve) => {
              const delay = Math.max(0, Number(staggerMs) || 0) * index;
              setTimeout(() => {
                animateActiveDeviceItemRemoval(item)
                  .catch(() => {})
                  .finally(resolve);
              }, delay);
            }),
        ),
      );
    }

    function renderActiveDevices() {
      const card = byId("main-active-devices-card");
      const list = byId("main-active-devices-list");
      const offAllBtn = byId("main-active-devices-off-btn");
      if (!card || !list || !offAllBtn) return;

      const grouped = collectDevicesByEnvironment();
      state.activeDevices = grouped.flatMap((g) => g.devices);

      if (!state.activeDevices.length) {
        card.dataset.state = "empty";
        offAllBtn.disabled = true;
        list.innerHTML =
          '<p class="main-active-empty">Nenhum dispositivo ligado no momento.</p>';
        syncActiveDevicesCardSize();
        return;
      }

      card.dataset.state = "ready";
      offAllBtn.disabled = false;

      list.innerHTML = grouped
        .map(
          (group) => `
            <section class="main-active-env-group">
              <div class="main-active-env-head">
                <h4 class="main-active-env-title">${escapeHtml(group.envName)}</h4>
                <span class="main-active-env-count">${group.devices.length}</span>
              </div>
              <ul class="main-active-env-list">
                ${group.devices
                  .map(
                    (d) => `
                    <li class="main-active-device-item">
                      <div class="main-active-device-main">
                        <img class="main-active-device-icon" src="${d.icon}" alt="${escapeHtml(d.name)}" />
                        <span class="main-active-device-name">${escapeHtml(d.name)}</span>
                      </div>
                      <button
                        type="button"
                        class="main-active-device-off-btn"
                        data-device-id="${escapeHtml(d.id)}"
                      >Desligar</button>
                    </li>`,
                  )
                  .join("")}
              </ul>
            </section>`,
        )
        .join("");

      list.querySelectorAll(".main-active-device-off-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = String(btn.dataset.deviceId || "");
          const device = state.activeDevices.find((d) => d.id === id);
          if (!device) return;
          const row = btn.closest(".main-active-device-item");
          btn.disabled = true;
          try {
            await turnOffSingleDevice(device);
            await animateActiveDeviceItemRemoval(row);
          } catch (error) {
            console.warn("Falha ao desligar dispositivo", device.id, error);
          } finally {
            renderActiveDevices();
          }
        });
      });

      syncActiveDevicesCardSize();
    }

    function renderLastEnvironmentCard() {
      const root = byId("main-last-room-card");
      if (!root) return;

      const envs =
        typeof adapters.getVisibleEnvironments === "function"
          ? adapters.getVisibleEnvironments()
          : [];
      if (!envs.length) {
        root.innerHTML = "";
        return;
      }
      const routes = envs.map((e) => e.key);
      const first = routes[0] || "";
      const route = getLastEnvironmentRoute(routes, first);
      const env = envs.find((e) => normalizeState(e.key) === route) || envs[0];

      const photoMap =
        typeof adapters.getEnvironmentPhotoMap === "function"
          ? adapters.getEnvironmentPhotoMap()
          : {};
      const rawPhoto = String(photoMap?.[env.key] || "").trim();
      const photo = rawPhoto
        ? rawPhoto.includes("/") || rawPhoto.includes("\\")
          ? rawPhoto
          : `assets/images/${rawPhoto}`
        : "";

      root.innerHTML = `
        ${photo ? `<figure class="main-last-room-photo"><img class="main-last-room-photo-img" src="${photo}" alt="${escapeHtml(env.name)}"></figure>` : ""}
        <div class="main-last-room-content">
          <span class="main-last-room-eyebrow">\u00DAltimo ambiente</span>
          <h3 class="main-last-room-name">${escapeHtml(env.name || env.key)}</h3>
        </div>
        <button type="button" class="main-last-room-link" aria-label="Abrir ${escapeHtml(env.name || env.key)}"></button>
      `;

      const link = root.querySelector(".main-last-room-link");
      if (link) {
        link.addEventListener("click", () => {
          if (typeof adapters.navigate === "function") {
            adapters.navigate(env.key);
          } else {
            window.location.hash = `#${env.key}`;
          }
        });
      }
    }

    function parseAttrs(device, names) {
      const attrs = device?.attributes;
      if (Array.isArray(attrs)) {
        const hit = attrs.find((a) =>
          names.includes(String(a?.name || "").toLowerCase()),
        );
        return hit?.currentValue ?? hit?.value ?? "";
      }
      if (attrs && typeof attrs === "object") {
        const key = Object.keys(attrs).find((k) =>
          names.includes(String(k).toLowerCase()),
        );
        return key ? attrs[key] : "";
      }
      if (device && typeof device === "object") {
        const key = Object.keys(device).find((k) =>
          names.includes(String(k).toLowerCase()),
        );
        if (key) return device[key];
      }
      return "";
    }

    function resolveDeviceId(device, fallback) {
      return String(device?.id ?? device?.deviceId ?? fallback ?? "").trim();
    }

    function normalizePollPayload(payload) {
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.data)) return payload.data;

      const devices = payload?.devices;
      if (Array.isArray(devices)) return devices;
      if (devices && typeof devices === "object") {
        return Object.entries(devices).map(([id, item]) => {
          if (item && typeof item === "object") {
            return {
              ...item,
              id: resolveDeviceId(item, id),
            };
          }
          return { id: String(id), value: item };
        });
      }

      if (payload && typeof payload === "object") {
        return [payload];
      }
      return [];
    }

    function findPolledDeviceById(list, deviceId) {
      const id = String(deviceId || "").trim();
      if (!id) return null;
      return list.find((item) => resolveDeviceId(item) === id) || null;
    }

    function buildNowPlayingSnapshot(device, fallbackId) {
      const id = resolveDeviceId(device, fallbackId);
      const track = String(
        parseAttrs(device, ["trackdescription", "track", "title"]) || "",
      ).trim();
      const artist = String(parseAttrs(device, ["artist"]) || "").trim();
      const album = String(parseAttrs(device, ["album"]) || "").trim();
      const status = normalizeState(
        parseAttrs(device, [
          "status",
          "playbackstatus",
          "playerstatus",
          "transportstate",
          "state",
          "switch",
        ]),
      );
      const muted = parseBooleanLike(
        parseAttrs(device, [
          "mute",
          "muted",
          "ismuted",
          "isaudio_muted",
          "volumemute",
        ]),
      );
      const albumArt = String(
        parseAttrs(device, ["albumart", "artwork", "image", "thumbnail"]) || "",
      ).trim();

      const playing =
        status.includes("play") || status === "tocando" || status === "on"
          ? "playing"
          : status.includes("pause") || status === "pausado"
            ? "paused"
            : "idle";

      return {
        id,
        track,
        artist,
        album,
        status,
        muted,
        albumArt,
        hasMetadata: Boolean(track || artist || album || albumArt),
        playing,
      };
    }

    function selectNowPlayingSnapshot(snapshots) {
      if (!Array.isArray(snapshots) || !snapshots.length) return null;

      const playing = snapshots.find((item) => item.playing === "playing");
      if (playing) return playing;

      const rememberedId =
        state.nowPlayingDeviceId || readRememberedNowPlayingDeviceId();
      if (rememberedId) {
        const remembered = snapshots.find((item) => item.id === rememberedId);
        if (
          remembered &&
          (remembered.playing === "paused" ||
            remembered.hasMetadata ||
            remembered.status)
        ) {
          return remembered;
        }
      }

      const paused = snapshots.find((item) => item.playing === "paused");
      if (paused) return paused;

      const withMetadata = snapshots.find((item) => item.hasMetadata);
      if (withMetadata) return withMetadata;

      return snapshots[0];
    }

    function getMusicDeviceCandidates() {
      const ids = [];
      const seen = new Set();
      const pushId = (value) => {
        const id = String(value || "").trim();
        if (!id || seen.has(id)) return;
        seen.add(id);
        ids.push(id);
      };

      const dashboard = config.mainDashboard || {};
      const controls = dashboard.controls || {};

      pushId(state.nowPlayingDeviceId);
      pushId(readRememberedNowPlayingDeviceId());
      pushId(dashboard.nowPlayingDeviceId);
      pushId(controls.transportDeviceId);
      pushId(controls.audioDeviceId);

      const explicitIds = Array.isArray(dashboard.nowPlayingDeviceIds)
        ? dashboard.nowPlayingDeviceIds
        : [];
      explicitIds.forEach(pushId);

      const envs =
        typeof adapters.getVisibleEnvironments === "function"
          ? adapters.getVisibleEnvironments()
          : [];

      envs.forEach((env) => {
        (env?.music || []).forEach((item) => {
          pushId(item?.id || item?.deviceId);
          pushId(item?.transportDeviceId);
          pushId(item?.audioDeviceId);
          pushId(item?.volumeDeviceId);
          pushId(item?.powerDeviceId);
        });
      });

      return ids;
    }

    function getNowPlayingCommandDeviceId() {
      const candidates = getMusicDeviceCandidates();
      if (!candidates.length) return "";

      const current = String(state.nowPlayingDeviceId || "").trim();
      if (current && candidates.includes(current)) {
        return current;
      }

      const remembered = readRememberedNowPlayingDeviceId();
      if (remembered && candidates.includes(remembered)) {
        state.nowPlayingDeviceId = remembered;
        return remembered;
      }

      state.nowPlayingDeviceId = candidates[0];
      return candidates[0];
    }

    async function refreshNowPlaying() {
      if (!ENABLE_HOME_NOW_PLAYING) return;
      const card = byId("main-now-playing-card");
      const stateLabel = byId("main-now-playing-state");
      const track = byId("main-now-playing-track");
      const artist = byId("main-now-playing-artist");
      const album = byId("main-now-playing-album");
      const art = byId("main-now-playing-art");
      const controls = byId("main-now-playing-controls");
      const playIcon = byId("main-now-playing-play-icon");
      const muteIcon = byId("main-now-playing-mute-icon");
      if (
        !card ||
        !stateLabel ||
        !track ||
        !artist ||
        !album ||
        !art ||
        !controls ||
        !playIcon ||
        !muteIcon
      )
        return;

      const dashboard = config.mainDashboard || {};
      const preview = dashboard.previewNowPlaying || {};

      if (preview.enabled === true) {
        if (!state.nowPlayingDeviceId) {
          state.nowPlayingDeviceId = getNowPlayingCommandDeviceId();
        }
        const p = normalizeState(preview.status);
        const isPlaying = p === "playing" || p === "tocando" || p === "on";
        const isPaused = p === "paused" || p === "pausado";
        state.playing = isPlaying ? "playing" : isPaused ? "paused" : "idle";
        state.muted = preview.muted === true;
        stateLabel.textContent = state.muted
          ? "Mutado"
          : isPlaying
            ? "Tocando"
            : isPaused
              ? "Pausado"
              : "Inativo";
        track.textContent = preview.track || "Sem reproducao";
        artist.textContent = preview.artist || "Nenhum conteudo ativo";
        album.textContent = preview.album || "Aguardando player";
        art.src = preview.artwork || "assets/images/music-placeholder.png";
      } else {
        const fallbackId = String(dashboard.nowPlayingDeviceId || "");
        const candidates = getMusicDeviceCandidates();
        if (!candidates.length) {
          candidates.push(fallbackId);
        }
        const queryIds = candidates.join(",");
        try {
          const payload =
            typeof adapters.pollDevice === "function"
              ? await adapters.pollDevice(queryIds)
              : await fetch(
                  `/polling?devices=${encodeURIComponent(queryIds)}`,
                  {
                    cache: "no-store",
                  },
                ).then((r) => r.json());

          const list = normalizePollPayload(payload);
          const snapshots = candidates.map((id) =>
            buildNowPlayingSnapshot(findPolledDeviceById(list, id), id),
          );
          const snapshot = selectNowPlayingSnapshot(snapshots);
          if (!snapshot) throw new Error("now playing not found");

          state.nowPlayingDeviceId = snapshot.id || state.nowPlayingDeviceId;
          if (snapshot.playing === "playing") {
            rememberNowPlayingDeviceId(snapshot.id);
          } else if (!readRememberedNowPlayingDeviceId() && snapshot.id) {
            rememberNowPlayingDeviceId(snapshot.id);
          }

          state.playing = snapshot.playing;
          state.muted = snapshot.muted;
          stateLabel.textContent = state.muted
            ? "Mutado"
            : state.playing === "playing"
              ? "Tocando"
              : state.playing === "paused"
                ? "Pausado"
                : "Inativo";
          track.textContent = snapshot.track || "Sem reproducao";
          artist.textContent = snapshot.artist || "Nenhum conteudo ativo";
          album.textContent = snapshot.album || "Aguardando player";
          art.src = snapshot.albumArt || "assets/images/music-placeholder.png";
        } catch (error) {
          state.playing = "idle";
          state.muted = false;
          stateLabel.textContent = "Offline";
          track.textContent = "Sem reproducao";
          artist.textContent = "Player indisponivel";
          album.textContent = "Tente novamente";
          art.src = "assets/images/music-placeholder.png";
        }
      }

      controls.hidden = !(
        state.playing === "playing" || state.playing === "paused"
      );
      playIcon.src =
        state.playing === "playing"
          ? NOW_PLAYING_ICONS.pause
          : NOW_PLAYING_ICONS.play;
      muteIcon.src = state.muted
        ? NOW_PLAYING_ICONS.mute
        : NOW_PLAYING_ICONS.volume;
      card.dataset.state = "ready";
    }

    async function handleNowPlayingAction(action) {
      const dashboard = config.mainDashboard || {};
      const controls = dashboard.controls || {};
      const commands = controls.commands || {};
      const commandDeviceId = getNowPlayingCommandDeviceId();
      const transportId = String(
        commandDeviceId ||
          controls.transportDeviceId ||
          dashboard.nowPlayingDeviceId ||
          "",
      );
      const audioId = String(
        commandDeviceId || controls.audioDeviceId || transportId,
      );

      const run = async (deviceId, command) => {
        if (!deviceId || !command) return;
        if (typeof adapters.sendCommand === "function") {
          await adapters.sendCommand(deviceId, command);
        }
      };

      if (commandDeviceId) {
        rememberNowPlayingDeviceId(commandDeviceId);
      }

      if (action === "playPause") {
        const play = state.playing !== "playing";
        await run(
          transportId,
          play ? commands.play || "play" : commands.pause || "pause",
        );
        state.playing = play ? "playing" : "paused";
      } else if (action === "next") {
        await run(transportId, commands.next || "nextTrack");
      } else if (action === "previous") {
        await run(transportId, commands.previous || "previousTrack");
      } else if (action === "muteToggle") {
        const mute = !state.muted;
        await run(
          audioId,
          mute ? commands.mute || "mute" : commands.unmute || "unmute",
        );
        state.muted = mute;
      }
      await refreshNowPlaying();
    }

    function bindNowPlayingControls() {
      const controls = byId("main-now-playing-controls");
      if (!controls) return;
      controls.querySelectorAll("[data-action]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const action = btn.getAttribute("data-action");
          handleNowPlayingAction(action).catch(console.warn);
        });
      });
    }

    async function refreshAll(forceWeather) {
      if (state.destroyed || state.paused) return;

      // Renderiza o essencial imediatamente para evitar sensação de travamento na Home.
      renderLastEnvironmentCard();
      renderActiveDevices();

      const tasks = [refreshWeather(Boolean(forceWeather))];
      if (ENABLE_HOME_NOW_PLAYING) {
        tasks.push(refreshNowPlaying());
      }

      await Promise.allSettled(tasks);

      if (state.destroyed) return;
      renderActiveDevices();
    }

    function startTimers() {
      if (state.destroyed || state.paused) return;
      const weatherMinutes = Math.max(
        1,
        Number(config.weather?.refreshMinutes) || 15,
      );
      state.weatherTimer = setInterval(
        () => {
          refreshWeather(false).catch(console.warn);
        },
        weatherMinutes * 60 * 1000,
      );

      if (ENABLE_HOME_NOW_PLAYING) {
        state.nowPlayingTimer = setInterval(() => {
          refreshNowPlaying().catch(console.warn);
          renderActiveDevices();
        }, NOW_PLAYING_REFRESH_MS);
      } else {
        state.nowPlayingTimer = null;
      }
    }

    function stopTimers() {
      if (state.weatherTimer) clearInterval(state.weatherTimer);
      if (state.nowPlayingTimer) clearInterval(state.nowPlayingTimer);
      state.weatherTimer = null;
      state.nowPlayingTimer = null;
    }

    function init() {
      if (state.destroyed) return;
      state.paused = false;
      state.nowPlayingDeviceId = readRememberedNowPlayingDeviceId();
      if (ENABLE_HOME_NOW_PLAYING) {
        bindNowPlayingControls();
      }
      const offAllBtn = byId("main-active-devices-off-btn");
      if (offAllBtn) {
        offAllBtn.addEventListener("click", async () => {
          offAllBtn.disabled = true;
          const list = byId("main-active-devices-list");
          const allRows = Array.from(
            list?.querySelectorAll(".main-active-device-item") || [],
          );
          const allButtons = Array.from(
            list?.querySelectorAll(".main-active-device-off-btn") || [],
          );
          allButtons.forEach((btn) => {
            btn.disabled = true;
          });

          try {
            const unique = new Map(state.activeDevices.map((d) => [d.id, d]));
            const devices = Array.from(unique.values());
            const results = await Promise.allSettled(
              devices.map((device) => turnOffSingleDevice(device)),
            );

            const successfulIds = new Set();
            results.forEach((result, index) => {
              if (result.status === "fulfilled") {
                successfulIds.add(String(devices[index]?.id || ""));
              }
            });

            const rowsToAnimate = allRows.filter((row) => {
              const id = String(
                row.querySelector(".main-active-device-off-btn")?.dataset
                  ?.deviceId || "",
              );
              return successfulIds.has(id);
            });

            if (rowsToAnimate.length) {
              await animateActiveDeviceItemsRemoval(rowsToAnimate, 40);
            }

            if (successfulIds.size !== devices.length) {
              const failed = devices.length - successfulIds.size;
              console.warn(
                `Falha ao desligar ${failed} dispositivo(s) no comando em lote.`,
              );
            }
          } catch (error) {
            console.warn("Falha ao desligar todos os dispositivos", error);
          } finally {
            offAllBtn.disabled = false;
            renderActiveDevices();
          }
        });
      }

      window.addEventListener("resize", syncActiveDevicesCardSize);
      refreshAll(true).catch(console.warn);
      startTimers();
    }

    function suspend() {
      if (state.destroyed || state.paused) return;
      state.paused = true;
      stopTimers();
      window.removeEventListener("resize", syncActiveDevicesCardSize);
    }

    function resume() {
      if (state.destroyed || !state.paused) return;
      state.paused = false;
      window.addEventListener("resize", syncActiveDevicesCardSize);
      refreshAll(false).catch(console.warn);
      startTimers();
    }

    function destroy() {
      state.destroyed = true;
      state.paused = true;
      stopTimers();
      window.removeEventListener("resize", syncActiveDevicesCardSize);
    }

    return {
      init,
      suspend,
      resume,
      destroy,
      refreshAll,
      rememberLastEnvironmentRoute,
    };
  }

  global.MainHomeKit = {
    createMainHomeRuntime,
  };
})(window);



