/**
 * Dashboard Eletrize (Cloudflare) - Configuração do cliente
 *
 * Objetivo: permitir adicionar/remover ambientes, dispositivos, links e metadados
 * editando este arquivo, mantendo o funcionamento Cloudflare (Pages/Functions).
 */

const CLIENT_CONFIG = {
  // Modo de teste local: mantém estados no dashboard sem depender do Hubitat.
  // Use false para voltar ao comportamento normal.
  development: {
    stateOnlyMode: true,
    mqtt: {
      enabled: false,
      brokerUrl: "",
      username: "",
      password: "",
      clientIdPrefix: "dashboard-eletrize",
      stateTopicPrefix: "eletrize/devices",
      qos: 0,
      retain: true,
      libraryUrl: "https://unpkg.com/mqtt/dist/mqtt.min.js",
    },
  },

  // Segredos e regras de allowlist ficam no backend (Cloudflare Functions),
  auth: {
    enabled: false,
    supabaseUrl: "",
    supabaseAnonKey: "",
    allowEmailSignUp: false,
    allowGoogleLogin: false,
    requireEmailConfirmation: true,
    redirectTo: "",
  },

  clientInfo: {
    name: "Frederico",
    projectName: "Dashboard Frederico",
    location: "",
    version: "1.0",
  },

  appInfo: {
    logo: {
      src: "images/icons/eletrize.svg",
      alt: "Eletrize Automação",
    },
    links: {
      instagram: {
        enabled: true,
        url: "https://www.instagram.com/eletrizeautomacao",
        label: "Instagram Eletrize",
      },
      support: {
        enabled: false,
        url: "",
        label: "Contato via WhatsApp",
      },
    },
  },

  // Configuração da Maker API (Hubitat) centralizada no backend.
  // Preencha somente para testes locais conscientes; em produção use secrets do Cloudflare.
  makerApi: {
    cloud: {
      enabled: false,
      appBaseUrl: "",
      accessToken: "",
      deviceIds: [],
      endpoints: {},
    },
  },

  // Overrides globais de ícones (vale para TODOS os botões)
  // Chave: caminho atual (ex.: "images/icons/icon-mute.svg")
  // Valor: novo caminho (ex.: "images/icons/whatsapp.svg")
  // Dica: isso também cobre botões estáticos (música, cortinas, AC, etc.).
  ui: {
    // Itens de UI reutilizáveis (nome + ícone) para abas/botões principais
    // Use as chaves abaixo no app: lights, curtains, comfort, music, tv, htv, home, scenes
    items: {
      lights: { label: "Luzes", icon: "images/icons/icon-small-light-off.svg" },
      curtains: { label: "Cortinas", icon: "images/icons/icon-curtain.svg" },
      comfort: {
        label: "Ar Condicionado",
        icon: "images/icons/ar-condicionado.svg",
      },
      music: { label: "Música", icon: "images/icons/icon-musica.svg" },
      tv: { label: "Televisão", icon: "images/icons/icon-tv.svg" },
      htv: { label: "HTV", icon: "images/icons/icon-htv.svg" },
      home: { label: "Home", icon: "images/icons/icon-home.svg" },
      scenes: { label: "Cenários", icon: "images/icons/icon-scenes.svg" },
      routines: { label: "Rotinas", icon: "images/icons/icon-scenes.svg" },
      bluray: { label: "Blu-ray", icon: "images/icons/icon-bluray.svg" },
      appletv: { label: "Apple TV", icon: "images/icons/icon-apple-tv.svg" },
      clarotv: { label: "Claro TV", icon: "images/icons/icon-clarotv.svg" },
      roku: { label: "Roku", icon: "images/icons/icon-roku.svg" },
      games: { label: "Games", icon: "images/icons/icon-games.svg" },
      hidromassagem: {
        label: "Hidromassagem",
        icon: "images/icons/icon-hidromassagem.svg",
      },
    },

    // Ícones on/off padronizados por tipo (reutilizáveis em qualquer botão toggle)
    toggles: {
      light: {
        on: "images/icons/icon-small-light-on.svg",
        off: "images/icons/icon-small-light-off.svg",
      },
      dimmer: {
        on: "images/icons/icon-dimmer.svg",
        off: "images/icons/icon-dimmer.svg",
      },
      tv: {
        on: "images/icons/icon-small-tv-on.svg",
        off: "images/icons/icon-small-tv-off.svg",
      },
      shader: {
        on: "images/icons/icon-small-shader-on.svg",
        off: "images/icons/icon-small-shader-off.svg",
      },
      smartglass: {
        on: "images/icons/icon-small-smartglass-on.svg",
        off: "images/icons/icon-small-smartglass-off.svg",
      },
      telamovel: {
        on: "images/icons/icon-small-telamovel-on.svg",
        off: "images/icons/icon-small-telamovel-off.svg",
      },
    },

    // Ícones de ações (setas, voltar, stop etc.)
    actions: {
      back: "images/icons/back-button.svg",
      curtainOpen: "images/icons/open-curtain.svg",
      curtainStop: "images/icons/icon-stop.svg",
      curtainClose: "images/icons/close-curtain.svg",
    },

    // Ícones por tipo de movimento de cortina (configurável por ambiente/cortina)
    curtainTypes: {
      lateral: {
        open: "images/icons/open-curtain.svg",
        stop: "images/icons/icon-stop.svg",
        close: "images/icons/close-curtain.svg",
      },
      vertical: {
        open: "images/icons/arrow-up.svg",
        stop: "images/icons/icon-stop.svg",
        close: "images/icons/arrow-down.svg",
      },
    },

    iconOverrides: {
      // Exemplos (descomente e ajuste conforme necessidade):
      // "images/icons/icon-mute.svg": "images/icons/icon-volume.svg",
      // "images/icons/arrow-up.svg": "images/icons/icon-ac-aleta-alta.svg",
    },

    // Tabelas de comandos por controle (referência / logging)
    controlCommands: {
      // Apple TV: comandos reconhecidos pelo hub (mesmo que nem todos tenham botão)
      appletv: [
        "configure",
        "cursorCenter",
        "cursorDown",
        "cursorLeft",
        "cursorRight",
        "cursorUp",
        "initialize",
        "keepalive",
        "menu",
        "off",
        "on",
        "play",
        "push",
        "reconnect",
        "refresh",
      ],

      // Claro TV: comandos suportados (inclui os sem botão dedicado)
      clarotv: [
        "agora",
        "blue",
        "channelDown",
        "channelUp",
        "configure",
        "cursorCenter",
        "cursorDown",
        "cursorLeft",
        "cursorRight",
        "cursorUp",
        "favoritos",
        "forward",
        "green",
        "info",
        "initialize",
        "keepalive",
        "menu",
        "mosaico",
        "music",
        "num1",
        "num2",
        "num3",
        "num4",
        "num5",
        "num0",
        "num6",
        "num7",
        "num8",
        "num9",
        "off",
        "on",
        "play",
        "portal",
        "power",
        "ppv",
        "push",
        "rec",
        "reconnect",
        "red",
        "refresh",
        "replay",
        "rewind",
        "sair",
        "stop",
        "voltar",
        "yellow",
      ],

      // Roku: comandos suportados no controle da Varanda
      roku: [
        "appletv",
        "asteriscom",
        "back",
        "configure",
        "cursorDown",
        "cursorLeft",
        "cursorOK",
        "cursorRight",
        "cursorUp",
        "disney",
        "home",
        "initialize",
        "netflix",
        "next",
        "off",
        "on",
        "play",
        "previous",
        "primevideo",
        "push",
      ],

      // TV LG: comandos do driver TVLG_DriverIR_GW8.groovy
      lg: [
        "powerOn",
        "powerOff",
        "channelUp",
        "channelDown",
        "returnButton",
        "menu",
        "mute",
        "home",
        "cursorUp",
        "cursorDown",
        "cursorLeft",
        "cursorRight",
        "cursorCenter",
        "num0",
        "num1",
        "num2",
        "num3",
        "num4",
        "num5",
        "num6",
        "num7",
        "num8",
        "num9",
        "hdmi2",
      ],
    },
  },

  // IDs PENDING-FRED-* sao placeholders para montar a base antes da integracao real.
  environments: {
    ambiente1: {
      visible: true,
      order: 3,
      name: "Home",
      photo: "photo-placeholder.webp",
      quickActions: [],
      lights: [
        { id: "6", name: "Spots" },
        { id: "7", name: "Barra LED" },
        { id: "8", name: "Sanca" },
      ],
      curtains: [],
      airConditioner: {
        brand: "lg",
        deviceId: "64",
        temperature: { min: 18, max: 25, default: 22 },
        controls: { aletas: true, windfree: false, zoneSelector: false },
      },
      tv: [
        {
          id: "PENDING-FRED-A01-TV01",
          name: "Televisão Home",
          brand: "lg",
        },
      ],
      htv: [],
      bluray: [],
      appletv: [],
      clarotv: [],
      roku: [],
      games: [],
      hidromassagem: [],
      music: [],
      music: [{ id: "PENDING-FRED-A01-M01", name: "Sistema de Som" }],
    },
    ambiente2: {
      visible: true,
      order: 1,
      name: "Living/Jantar",
      photo: "photo-placeholder.webp",
      quickActions: [],
      lights: [
        { id: "10", name: "Sanca NC" },
        { id: "11", name: "Spots Parede" },
        { id: "9", name: "Spots Hall" },
        { id: "12", name: "Spots Living" },
        { id: "13", name: "Spots Centrais" },
        { id: "14", name: "Spots Pilar" },
        { id: "15", name: "Spots Móvel" },
        { id: "16", name: "Spots Mesa" },
        { id: "17", name: "Spots Jantar" },
        {
          id: "47",
          name: "Lustre Dimmer",
          type: "dimmer",
          defaultLevel: 80,
        },
        {
          id: "46",
          name: "Spots Centro Dimmer",
          type: "dimmer",
          defaultLevel: 80,
        },
        {
          id: "45",
          name: "Spots Dimmer",
          type: "dimmer",
          defaultLevel: 80,
        },
      ],
      curtains: [],
      airConditioner: null,
      tv: [],
      htv: [],
      bluray: [],
      appletv: [],
      clarotv: [],
      roku: [],
      games: [],
      hidromassagem: [],
      music: [],
    },
    ambiente3: {
      visible: true,
      order: 2,
      name: "Varanda",
      photo: "photo-placeholder.webp",
      quickActions: [],
      lights: [
        { id: "18", name: "Sanca NC" },
        { id: "19", name: "Spots Varanda" },
        { id: "20", name: "Spots Centro" },
        { id: "21", name: "Spots Gourmet" },
        { id: "23", name: "Spots Balcão NC" },
        {
          id: "42",
          name: "Spots Balcão Dimmer",
          type: "dimmer",
          defaultLevel: 80,
        },
        {
          id: "44",
          name: "Spots Centro Dimmer",
          type: "dimmer",
          defaultLevel: 80,
        },
        {
          id: "43",
          name: "Spots Dimmer",
          type: "dimmer",
          defaultLevel: 80,
        },
      ],
      curtains: [],
      airConditioner: null,
      tv: [],
      htv: [],
      bluray: [],
      appletv: [],
      clarotv: [],
      roku: [],
      games: [],
      hidromassagem: [],
      music: [],
    },
    ambiente4: {
      visible: true,
      order: 6,
      name: "Suíte I",
      photo: "photo-placeholder.webp",
      quickActions: [],
      lights: [{ id: "PENDING-FRED-A04-L01", name: "Luzes" }],
      curtains: [],
      airConditioner: {
        brand: "lg",
        deviceId: "59",
        temperature: { min: 18, max: 25, default: 22 },
        controls: { aletas: true, windfree: false, zoneSelector: false },
      },
      tv: [
        {
          id: "PENDING-FRED-A04-TV01",
          name: "Televisão Suíte I",
          brand: "lg",
        },
      ],
      htv: [],
      bluray: [],
      appletv: [],
      clarotv: [],
      roku: [],
      games: [],
      hidromassagem: [],
      music: [],
    },
    ambiente5: {
      visible: true,
      order: 7,
      name: "Suíte II",
      photo: "photo-placeholder.webp",
      quickActions: [],
      lights: [{ id: "PENDING-FRED-A05-L01", name: "Luzes" }],
      curtains: [],
      airConditioner: {
        brand: "lg",
        deviceId: "60",
        temperature: { min: 18, max: 25, default: 22 },
        controls: { aletas: true, windfree: false, zoneSelector: false },
      },
      tv: [
        {
          id: "PENDING-FRED-A05-TV01",
          name: "Televisão Suíte II",
          brand: "lg",
        },
      ],
      htv: [],
      bluray: [],
      appletv: [],
      clarotv: [],
      roku: [],
      games: [],
      hidromassagem: [],
      music: [],
    },
    ambiente7: {
      visible: true,
      order: 8,
      name: "Suíte Master",
      photo: "photo-placeholder.webp",
      quickActions: [],
      lights: [{ id: "PENDING-FRED-A07-L01", name: "Luzes" }],
      curtains: [],
      airConditioner: {
        brand: "lg",
        zones: [
          { deviceId: "61", name: "AC: Suíte Master" },
          { deviceId: "62", name: "AC: Closet" },
        ],
        temperature: { min: 18, max: 25, default: 22 },
        controls: { aletas: true, windfree: false, zoneSelector: true },
      },
      tv: [
        {
          id: "PENDING-FRED-A07-TV01",
          name: "Televisão Suíte Master",
          brand: "lg",
        },
      ],
      htv: [],
      bluray: [],
      appletv: [],
      clarotv: [],
      roku: [],
      games: [],
      hidromassagem: [],
      music: [],
    },
    ambiente8: {
      visible: true,
      order: 5,
      name: "Escritório",
      photo: "photo-placeholder.webp",
      quickActions: [],
      lights: [{ id: "PENDING-FRED-A08-L01", name: "Luzes" }],
      curtains: [],
      airConditioner: {
        brand: "lg",
        deviceId: "63",
        temperature: { min: 18, max: 25, default: 22 },
        controls: { aletas: true, windfree: false, zoneSelector: false },
      },
      tv: [
        {
          id: "PENDING-FRED-A08-TV01",
          name: "Televisão Escritório",
          brand: "lg",
        },
      ],
      htv: [],
      bluray: [],
      appletv: [],
      clarotv: [],
      roku: [],
      games: [],
      hidromassagem: [],
      music: [],
    },
    ambiente9: {
      visible: true,
      order: 4,
      name: "Cozinha",
      photo: "photo-placeholder.webp",
      quickActions: [],
      lights: [],
      curtains: [],
      airConditioner: {
        brand: "lg",
        deviceId: "65",
        temperature: { min: 18, max: 25, default: 22 },
        controls: { aletas: true, windfree: false, zoneSelector: false },
      },
      tv: [],
      htv: [],
      bluray: [],
      appletv: [],
      clarotv: [],
      roku: [],
      games: [],
      hidromassagem: [],
      music: [],
    },
  },

  devices: {
    audioDefaults: {
      commandDeviceId: "",
      metadataDeviceId: "",
    },
    legacyControls: {},
    televisionBrands: {
      lg: {
        label: "LG",
        driver: "TV LG IR GW8",
        commands: {
          powerOn: "powerOn",
          powerOff: "powerOff",
          channelUp: "channelUp",
          channelDown: "channelDown",
          return: "returnButton",
          menu: "menu",
          mute: "mute",
          home: "home",
          inputHdmi2: "hdmi2",
          cursorUp: "cursorUp",
          cursorDown: "cursorDown",
          cursorLeft: "cursorLeft",
          cursorRight: "cursorRight",
          cursorCenter: "cursorCenter",
          num0: "num0",
          num1: "num1",
          num2: "num2",
          num3: "num3",
          num4: "num4",
          num5: "num5",
          num6: "num6",
          num7: "num7",
          num8: "num8",
          num9: "num9",
        },
        commandButtons: [
          {
            commandKey: "return",
            label: "Voltar",
            icon: "images/icons/back-button.svg",
          },
          {
            commandKey: "menu",
            label: "Menu",
            icon: "images/icons/icon-menu.svg",
          },
          {
            commandKey: "mute",
            label: "Mudo",
            icon: "images/icons/icon-mute.svg",
          },
          {
            commandKey: "home",
            label: "Home",
            icon: "images/icons/icon-home.svg",
          },
          {
            commandKey: "inputHdmi2",
            label: "HDMI 2",
            icon: "images/icons/icon-hdmi.svg",
          },
        ],
        capabilities: {
          directMute: true,
          volumeSlider: false,
          channelButtons: true,
          media: false,
          numbers: true,
        },
      },
    },
    airConditionerBrands: {
      default: {
        label: "Padrao",
        commands: {
          powerOn: "on",
          powerOff: "off",
          tempPrefix: "temp",
          swingOn: "swingOn",
          swingOff: "swingOff",
          windfree: "windfree",
        },
        attributes: {
          swing: {
            key: "swing",
            on: ["on", "moving", "swing", "true"],
            off: ["off", "parada", "stop", "stopped", "false"],
          },
          temperature: [
            "temperature",
            "coolingsetpoint",
            "thermostatsetpoint",
            "setpoint",
          ],
        },
      },
      lg: {
        label: "LG",
        driver: "LG AC IR GW8",
        commands: {
          powerOn: "AC_lg_ON",
          powerOff: "AC_lg_OFF",
          tempTemplate: "AC_lg_{temp}",
          swingOn: "AC_lg_swing_on",
          swingOff: "AC_lg_swing_off",
        },
        attributes: {
          swing: {
            key: "acMode",
            on: ["SWING_ON", "moving", "swing", "true"],
            off: ["SWING_OFF", "parada", "stop", "stopped", "false"],
          },
          temperature: [
            "temperature",
            "coolingsetpoint",
            "thermostatsetpoint",
            "setpoint",
            "acMode",
          ],
        },
      },
    },
    initializeDevicesByEnv: {},
    extraPollingDevices: [],
  },
};
/**
 * Bottom Navigation (pill + glass) configuration.
 * Ajuste este bloco para mudar layout, estilo e comportamento da bottom nav.
 */
const bottomNavConfig = {
  enabled: true,
  breakpoint: 768,
  // Mantem a navbar visivel em qualquer largura de tela.
  showOnDesktop: true,
  showOnLandscapeMobile: true,
  landscapeMaxHeight: 560,
  landscapeMaxWidth: 1024,

  // Layout geral da barra
  containerStyle: {
    width: "fit-content",
    maxWidth: "420px",
    height: "80px",
    padding: "8px 4px",
    bottomOffset: "18px",
    itemGap: "0px",
    itemMinTouch: "44px",
    // Largura horizontal de cada item (aproxima/afasta os elementos)
    itemSlotWidth: "68px",
    iconSize: "22px",
    labelSize: "11px",
    // Tamanho da barrinha (notch) quando a nav recolhe no scroll
    notchWidth: "62px",
    notchHeight: "9px",
    // Ajuste aqui o pequeno respiro no fim do conteudo (degrau)
    contentPaddingBottom: "12px",
    // Ajuste aqui o espaco de ancoragem inferior de layouts absolutos/fixos
    dockSpaceBottom: "12px",
  },

  // Glassmorphism
  glassStyle: {
    background: "rgba(8, 8, 8, 0.86)",
    fallbackBackground: "rgba(8, 8, 8, 0.94)",
    borderColor: "rgba(255, 255, 255, 0.06)",
    blur: "16px",
    shadow: "0 6px 14px rgba(0, 0, 0, 0.36), 0 14px 24px rgba(0, 0, 0, 0.28)",
    innerGlow:
      "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 36%, rgba(255,255,255,0.00) 100%)",
  },

  // Estado ativo e transicoes
  activeStyle: {
    highlightColor: "#FFFFFF",
    highlightSize: "62px",
    textColor: "rgba(255, 255, 255, 0.84)",
    textColorActive: "#ffffff",
    iconTint: "rgba(255, 255, 255, 0.96)",
    iconTintActive: "#101010",
    labelWeight: 500,
    labelWeightActive: 700,
    transitionDuration: "240ms",
    transitionEasing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    iconPopScale: 1.1,
  },

  // Comportamento da barra durante o scroll
  behavior: {
    autoHideOnScroll: true,
    autoHideRoutes: ["scenes-criar"],
    scrollDelta: 8,
    revealAtTop: 10,
    // Atalho nas páginas de controle: recolhe a nav para um único botão Home.
    controlHomeShortcut: {
      enabled: true,
      // Aplicar atalho somente em páginas de controle (não em qualquer rota).
      onlyControlRoutes: true,
      includeRoutes: ["scenes-criar"],
      // Rotas de controle seguem o padrão: ambiente{n}-{controle}
      controlRoutePattern: "^ambiente\\d+-",
      // Rotas principais que mantêm a barra completa no centro.
      // Todas as demais rotas entram no modo compacto de retorno.
      primaryRoutes: ["home", "ambientes", "curtains", "scenes"],
      // Como localizar o item de Home dentro de items[].
      homePath: "ambientes",
      homeId: "ambientes",
      // No modo compacto, mantém sempre visível (sem notch de scroll).
      disableAutoHide: true,
      // Ajustes visuais do botão recolhido no canto inferior esquerdo.
      leftOffset: "16px",
      bottomOffset: "18px",
      size: "68px",
      padding: "7px",
      highlightSize: "54px",
      iconSize: "24px",
      background: "rgba(8, 8, 8, 0.88)",
      fallbackBackground: "rgba(8, 8, 8, 0.95)",
      borderColor: "rgba(255, 255, 255, 0.08)",
      blur: "16px",
      shadow: "0 8px 16px rgba(0, 0, 0, 0.34), 0 16px 26px rgba(0, 0, 0, 0.24)",
    },
  },

  items: [
    {
      id: "home",
      label: "Home",
      path: "home",
      icon: "images/icons/icon-home.svg",
      visible: true,
      disabled: false,
      external: false,
      order: 1,
      styleOverrides: {},
      ariaLabel: "Ir para Home",
      tooltip: "Home",
    },
    {
      id: "ambientes",
      label: "Ambientes",
      path: "ambientes",
      icon: "images/icons/icon-ambientes.svg",
      visible: true,
      disabled: false,
      external: false,
      order: 2,
      styleOverrides: {},
      ariaLabel: "Ir para Ambientes",
      tooltip: "Ambientes",
    },
    {
      id: "curtains",
      label: "Cortinas",
      path: "curtains",
      icon: "images/icons/icon-curtain.svg",
      visible: true,
      disabled: false,
      external: false,
      order: 3,
      styleOverrides: {},
      ariaLabel: "Ir para Cortinas",
      tooltip: "Cortinas",
    },
    {
      id: "scenes",
      label: "Cenarios",
      path: "scenes",
      icon: "images/icons/icon-scenes.svg",
      visible: true,
      disabled: false,
      external: false,
      order: 4,
      styleOverrides: {},
      ariaLabel: "Ir para Cenarios",
      tooltip: "Cenarios",
    },
  ],
};

const DEFAULT_WEATHER_CONFIG = {
  city: "",
  latitude: null,
  longitude: null,
  timezone: "auto",
  refreshMinutes: 15,
  messages: {
    includeWeekday: false,
    weekdayFormat: "{message}",
    weekdayNames: [
      "domingo",
      "segunda",
      "terca",
      "quarta",
      "quinta",
      "sexta",
      "sabado",
    ],
    weekdayShortNames: ["dom", "seg", "ter", "qua", "qui", "sex", "sab"],
    festiveDates: {
      "01-01": ["Feliz Ano Novo!", "Um otimo comeco de ano!"],
      "04-21": ["Bom feriado de Tiradentes!"],
      "05-01": ["Feliz Dia do Trabalho!"],
      "09-07": ["Feliz Independencia do Brasil!"],
      "10-12": ["Feliz Dia das Criancas!"],
      "11-02": ["Bom feriado de Finados."],
      "11-15": ["Feliz Proclamacao da Republica!"],
      "12-24": ["Feliz vespera de Natal!"],
      "12-25": ["Feliz Natal!", "Um Natal muito especial!"],
      "12-31": ["Boa virada de ano!", "Ultimo dia do ano!"],
    },
  },
};

const DEFAULT_MAIN_DASHBOARD_CONFIG = {
  nowPlayingDeviceId: "",
  controls: {
    transportDeviceId: "",
    audioDeviceId: "",
    commands: {
      play: "play",
      pause: "pause",
      next: "nextTrack",
      previous: "previousTrack",
      mute: "mute",
      unmute: "unmute",
    },
  },
  previewNowPlaying: {
    enabled: false,
    status: "playing",
    track: "Blinding Lights",
    artist: "The Weeknd",
    album: "After Hours",
    artwork: "assets/images/music-placeholder.png",
    muted: false,
  },
};

function cloneJson(value, fallback = {}) {
  try {
    return JSON.parse(JSON.stringify(value ?? fallback));
  } catch (_) {
    return JSON.parse(JSON.stringify(fallback));
  }
}

function getWeatherConfig() {
  const override = CLIENT_CONFIG?.weather || {};
  return {
    ...DEFAULT_WEATHER_CONFIG,
    ...override,
    messages: {
      ...(DEFAULT_WEATHER_CONFIG.messages || {}),
      ...(override.messages || {}),
      festiveDates: {
        ...((DEFAULT_WEATHER_CONFIG.messages || {}).festiveDates || {}),
        ...((override.messages || {}).festiveDates || {}),
      },
    },
  };
}

function getMainDashboardConfig() {
  const override = CLIENT_CONFIG?.mainDashboard || {};
  const merged = {
    ...DEFAULT_MAIN_DASHBOARD_CONFIG,
    ...override,
    controls: {
      ...(DEFAULT_MAIN_DASHBOARD_CONFIG.controls || {}),
      ...(override.controls || {}),
      commands: {
        ...((DEFAULT_MAIN_DASHBOARD_CONFIG.controls || {}).commands || {}),
        ...((override.controls || {}).commands || {}),
      },
    },
    previewNowPlaying: {
      ...(DEFAULT_MAIN_DASHBOARD_CONFIG.previewNowPlaying || {}),
      ...(override.previewNowPlaying || {}),
    },
  };

  return cloneJson(merged, DEFAULT_MAIN_DASHBOARD_CONFIG);
}

// =========================
// Helpers (API pública)
// =========================

function getDashboardAccessApi() {
  return window.dashboardAccess || null;
}

function hasAnyEnvironmentAccess(envKey) {
  const accessApi = getDashboardAccessApi();
  if (!accessApi || typeof accessApi.hasAnyEnvironmentAccess !== "function") {
    return true;
  }
  return accessApi.hasAnyEnvironmentAccess(envKey);
}

function canViewEnvironment(envKey) {
  const accessApi = getDashboardAccessApi();
  if (!accessApi || typeof accessApi.canViewEnvironment !== "function") {
    return true;
  }
  return accessApi.canViewEnvironment(envKey);
}

function canUseDeviceIdForView(deviceId) {
  const accessApi = getDashboardAccessApi();
  if (!accessApi || typeof accessApi.isDeviceAllowed !== "function") {
    return true;
  }
  return accessApi.isDeviceAllowed(deviceId, "view");
}

function getVisibleEnvironments() {
  if (!CLIENT_CONFIG?.environments) return [];
  return Object.entries(CLIENT_CONFIG.environments)
    .filter(
      ([key, env]) => env && env.visible === true && canViewEnvironment(key),
    )
    .sort((a, b) => (a[1].order || 0) - (b[1].order || 0))
    .map(([key, env]) => ({ key, ...env }));
}

function getEnvironment(envKey) {
  if (!hasAnyEnvironmentAccess(envKey)) {
    return null;
  }
  return (
    (CLIENT_CONFIG?.environments && CLIENT_CONFIG.environments[envKey]) || null
  );
}

function normalizeConfigId(value, fallback = "") {
  if (value === undefined || value === null || value === "") {
    return fallback ? String(fallback) : "";
  }
  return String(value).trim();
}

function normalizeEnvironmentDevice(device) {
  if (!device || typeof device !== "object") return null;

  const baseId = normalizeConfigId(device.id || device.deviceId);
  if (!baseId) return null;

  return {
    ...device,
    id: baseId,
    deviceId: baseId,
    metadataId: normalizeConfigId(
      device.metadataDeviceId || device.metadataId,
      baseId,
    ),
    transportId: normalizeConfigId(
      device.transportDeviceId || device.transportId,
      baseId,
    ),
    volumeId: normalizeConfigId(
      device.volumeDeviceId || device.volumeId,
      baseId,
    ),
    powerId: normalizeConfigId(device.powerDeviceId || device.powerId, baseId),
    controlId: normalizeConfigId(
      device.controlDeviceId || device.controlId,
      baseId,
    ),
    receiverId: normalizeConfigId(device.receiverDeviceId || device.receiverId),
    displayId: normalizeConfigId(device.displayDeviceId || device.displayId),
    inputId: normalizeConfigId(device.inputDeviceId || device.inputId),
  };
}

function getEnvironmentDeviceList(envKey, field) {
  const env = getEnvironment(envKey);
  if (!env) return [];

  const list = Array.isArray(env?.[field]) ? env[field] : [];
  return list
    .map((device) => normalizeEnvironmentDevice(device))
    .filter(Boolean);
}

function getEnvironmentPrimaryDevice(envKey, field, index = 0) {
  const list = getEnvironmentDeviceList(envKey, field);
  if (!list.length) return null;

  const parsedIndex = Number.parseInt(index, 10);
  const safeIndex =
    Number.isFinite(parsedIndex) && parsedIndex >= 0 ? parsedIndex : 0;

  return list[safeIndex] || null;
}

function getEnvironmentDeviceBinding(envKey, field, bindingKey, index = 0) {
  const device = getEnvironmentPrimaryDevice(envKey, field, index);
  if (!device) return "";

  const key = String(bindingKey || "")
    .trim()
    .toLowerCase();

  if (!key || key === "id" || key === "device" || key === "deviceid") {
    return device.id;
  }

  if (key === "metadata" || key === "metadataid") return device.metadataId;
  if (key === "transport" || key === "transportid") return device.transportId;
  if (key === "volume" || key === "volumeid") return device.volumeId;
  if (key === "power" || key === "powerid") return device.powerId;
  if (key === "control" || key === "controlid") return device.controlId;
  if (key === "receiver" || key === "receiverid") return device.receiverId;
  if (key === "display" || key === "displayid") return device.displayId;
  if (key === "input" || key === "inputid") return device.inputId;

  const bindingName = String(bindingKey || "").trim();
  return normalizeConfigId(device[bindingName] || device[`${bindingName}Id`]);
}

function getEnvironmentControlId(envKey, controlKey) {
  const env = getEnvironment(envKey);
  if (!env?.controlIds || typeof env.controlIds !== "object") return "";
  return normalizeConfigId(env.controlIds[controlKey]);
}

function getLegacyControlId(groupKey, controlKey) {
  return normalizeConfigId(
    CLIENT_CONFIG?.devices?.legacyControls?.[groupKey]?.[controlKey],
  );
}

function getAudioDefaults() {
  const defaults = CLIENT_CONFIG?.devices?.audioDefaults || {};
  return {
    commandDeviceId: normalizeConfigId(defaults.commandDeviceId),
    metadataDeviceId: normalizeConfigId(defaults.metadataDeviceId),
  };
}

function getEnvironmentLightIds(envKey) {
  const env = getEnvironment(envKey);
  if (!env?.lights) return [];
  return env.lights.map((light) => String(light.id));
}

function normalizeCurtainTargets(curtain) {
  if (!curtain) return [];

  const rawTargets =
    Array.isArray(curtain.targets) && curtain.targets.length > 0
      ? curtain.targets
      : curtain?.id || curtain?.deviceId
        ? [curtain.id || curtain.deviceId]
        : [];

  return rawTargets
    .map((target) => {
      if (target && typeof target === "object") {
        const id = target.id || target.deviceId;
        if (!id) return null;
        return { id: String(id), config: target };
      }

      if (target === undefined || target === null || target === "") {
        return null;
      }

      return { id: String(target), config: {} };
    })
    .filter(Boolean);
}

function getCurtainActionConfig(source, action) {
  if (!source || typeof source !== "object") {
    return { command: null, value: undefined };
  }

  const commandByAction =
    source.commands && typeof source.commands === "object"
      ? source.commands[action]
      : undefined;
  const commandByAlias =
    source[`${action}Command`] ??
    source[`command${action.charAt(0).toUpperCase() + action.slice(1)}`] ??
    (typeof source[action] === "string" ? source[action] : undefined);

  const valueByAction =
    source.values && typeof source.values === "object"
      ? source.values[action]
      : undefined;
  const valueByAlias =
    source[`${action}Value`] ??
    source[`value${action.charAt(0).toUpperCase() + action.slice(1)}`];

  return {
    command:
      commandByAction !== undefined && commandByAction !== null
        ? String(commandByAction)
        : commandByAlias !== undefined && commandByAlias !== null
          ? String(commandByAlias)
          : null,
    value:
      valueByAction !== undefined
        ? valueByAction
        : valueByAlias !== undefined
          ? valueByAlias
          : undefined,
  };
}

function getCurtainCustomActionPlan(curtain, action) {
  if (!curtain || typeof curtain !== "object") return null;

  const actionName = String(action || "").trim();
  if (!actionName) return null;

  const actionSuffix =
    actionName.charAt(0).toUpperCase() + actionName.slice(1).toLowerCase();
  const rawPlan =
    curtain?.actionPlans?.[actionName] ??
    curtain?.[`actionPlan${actionSuffix}`];

  if (!Array.isArray(rawPlan)) return null;

  return rawPlan
    .map((item) => {
      const id = item?.id || item?.deviceId;
      const command = item?.command || item?.cmd;
      if (!id || !command) return null;

      const payload = {
        id: String(id),
        command: String(command),
      };

      if (
        item?.value !== undefined &&
        item.value !== null &&
        item.value !== ""
      ) {
        payload.value = item.value;
      }

      return payload;
    })
    .filter(Boolean);
}

function buildCurtainActionPlan(curtain, action) {
  const customPlan = getCurtainCustomActionPlan(curtain, action);
  if (customPlan) {
    return customPlan;
  }

  const targets = normalizeCurtainTargets(curtain);
  if (!targets.length) return [];

  const curtainConfig = getCurtainActionConfig(curtain, action);

  return targets.map((target) => {
    const targetConfig = getCurtainActionConfig(target.config, action);
    const command = targetConfig.command || curtainConfig.command || action;
    const value =
      targetConfig.value !== undefined
        ? targetConfig.value
        : curtainConfig.value !== undefined
          ? curtainConfig.value
          : undefined;

    const payload = { id: String(target.id), command: String(command) };
    if (value !== undefined && value !== null && value !== "") {
      payload.value = value;
    }
    return payload;
  });
}

function encodeCurtainActionPlan(plan) {
  return encodeURIComponent(JSON.stringify(Array.isArray(plan) ? plan : []));
}

function buildCurtainControlModel(curtain, env = null) {
  const targets = normalizeCurtainTargets(curtain);
  if (!targets.length) return null;

  const openPlan = buildCurtainActionPlan(curtain, "open");
  const stopPlan = buildCurtainActionPlan(curtain, "stop");
  const closePlan = buildCurtainActionPlan(curtain, "close");
  const deviceIds = targets.map((target) => String(target.id));
  const firstId = deviceIds[0] || "";
  const icons = resolveCurtainIconsByType(curtain, env);

  return {
    title: curtain?.name || curtain?.title || `Cortina ${firstId}`,
    description: curtain?.description || "",
    deviceId: firstId,
    deviceIds: deviceIds.join(","),
    actionOpen: encodeCurtainActionPlan(openPlan),
    actionStop: encodeCurtainActionPlan(stopPlan),
    actionClose: encodeCurtainActionPlan(closePlan),
    curtainMotionType: icons.motionType,
    iconOpen: icons.open,
    iconStop: icons.stop,
    iconClose: icons.close,
    isGroup: deviceIds.length > 1,
  };
}

function getEnvironmentCurtainIds(envKey) {
  const env = getEnvironment(envKey);
  if (!env?.curtains) return [];
  const ids = [];
  env.curtains.forEach((curtain) => {
    normalizeCurtainTargets(curtain).forEach((target) => ids.push(target.id));
  });
  return Array.from(new Set(ids));
}

function getAllCurtainIds() {
  const ids = [];
  getVisibleEnvironments().forEach((env) => {
    (env.curtains || []).forEach((curtain) => {
      normalizeCurtainTargets(curtain).forEach((target) => ids.push(target.id));
    });
  });
  return Array.from(new Set(ids));
}

function getAllLightIds() {
  const ids = [];
  getVisibleEnvironments().forEach((env) => {
    (env.lights || []).forEach((light) => ids.push(String(light.id)));
  });
  (CLIENT_CONFIG?.devices?.extraPollingDevices || []).forEach((id) => {
    if (canUseDeviceIdForView(id)) {
      ids.push(String(id));
    }
  });
  return Array.from(new Set(ids));
}

function getAcDeviceIds() {
  const ids = {};
  getVisibleEnvironments().forEach((env) => {
    const acConfig = env?.airConditioner || null;
    const explicitAcId = acConfig?.deviceId ? String(acConfig.deviceId) : "";
    const firstZoneId = Array.isArray(acConfig?.zones)
      ? String(acConfig.zones.find((zone) => zone?.deviceId)?.deviceId || "")
      : "";
    const resolvedAcId = explicitAcId || firstZoneId;
    if (resolvedAcId) {
      // Configuração por ambiente (deviceId/zones) tem precedência sobre mapa legado.
      ids[env.key] = resolvedAcId;
    }
  });
  return ids;
}

function getHomeRoomsData() {
  return getVisibleEnvironments().map((env) => ({
    name: env.name,
    route: env.key,
    deviceIds: (env.lights || []).map((l) => String(l.id)),
  }));
}

function getEnvironmentPhotoMap() {
  return getVisibleEnvironments().reduce((acc, env) => {
    if (env?.photo) {
      acc[env.key] = env.photo;
    }
    return acc;
  }, {});
}

function getIconOverrides() {
  return (
    (CLIENT_CONFIG?.ui?.iconOverrides && {
      ...CLIENT_CONFIG.ui.iconOverrides,
    }) ||
    {}
  );
}

function getUiItem(key) {
  return (CLIENT_CONFIG?.ui?.items && CLIENT_CONFIG.ui.items[key]) || null;
}

function getUiToggle(key) {
  return (CLIENT_CONFIG?.ui?.toggles && CLIENT_CONFIG.ui.toggles[key]) || null;
}

function getUiToggleIcon(key, state) {
  const toggle = getUiToggle(key);
  if (!toggle) return null;
  return state === "on" ? toggle.on : toggle.off;
}

function getUiActionIcon(key) {
  return (CLIENT_CONFIG?.ui?.actions && CLIENT_CONFIG.ui.actions[key]) || null;
}

function resolveCurtainMotionType(curtain, env) {
  const rawType =
    curtain?.curtainMotionType || env?.curtainMotionType || "lateral";
  return String(rawType || "lateral")
    .trim()
    .toLowerCase();
}

function resolveCurtainIconsByType(curtain, env) {
  const motionType = resolveCurtainMotionType(curtain, env);
  const typeIcons = CLIENT_CONFIG?.ui?.curtainTypes?.[motionType] || {};
  const defaultTypeIcons = CLIENT_CONFIG?.ui?.curtainTypes?.lateral || {};
  const actionIcons = CLIENT_CONFIG?.ui?.actions || {};

  return {
    motionType,
    open:
      curtain?.iconOpen ||
      curtain?.icons?.open ||
      typeIcons.open ||
      defaultTypeIcons.open ||
      actionIcons.curtainOpen ||
      "images/icons/open-curtain.svg",
    stop:
      curtain?.iconStop ||
      curtain?.icons?.stop ||
      typeIcons.stop ||
      defaultTypeIcons.stop ||
      actionIcons.curtainStop ||
      "images/icons/icon-stop.svg",
    close:
      curtain?.iconClose ||
      curtain?.icons?.close ||
      typeIcons.close ||
      defaultTypeIcons.close ||
      actionIcons.curtainClose ||
      "images/icons/close-curtain.svg",
  };
}

function buildCurtainSectionsFromConfig() {
  return getVisibleEnvironments()
    .filter((env) => Array.isArray(env.curtains) && env.curtains.length > 0)
    .map((env) => ({
      key: env.key,
      name: env.name,
      curtains: env.curtains
        .map((curtain) => buildCurtainControlModel(curtain, env))
        .filter(Boolean),
    }));
}

function normalizeDimmerLevel(value, fallback = 80) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isNaN(parsed)) {
    return Math.max(0, Math.min(100, parsed));
  }
  const fb = Number.parseInt(fallback, 10);
  return Math.max(0, Math.min(100, Number.isNaN(fb) ? 80 : fb));
}

function isDimmerLight(light) {
  const type = (light?.type || light?.class || "").toString().toLowerCase();
  return type === "dimmer";
}

function generateLightsControls(envKey) {
  const env = getEnvironment(envKey);
  if (!env?.lights?.length) return "";

  const LED_MODE_DEVICE_ID = "";

  const DEFAULT_ICON_ON =
    CLIENT_CONFIG?.ui?.toggles?.light?.on ||
    "images/icons/icon-small-light-on.svg";
  const DEFAULT_ICON_OFF =
    CLIENT_CONFIG?.ui?.toggles?.light?.off ||
    "images/icons/icon-small-light-off.svg";

  const DIMMER_ICON_ON =
    CLIENT_CONFIG?.ui?.toggles?.dimmer?.on || "images/icons/icon-dimmer-on.svg";
  const DIMMER_ICON_OFF =
    CLIENT_CONFIG?.ui?.toggles?.dimmer?.off ||
    "images/icons/icon-dimmer-off.svg";

  const buildLedModeCard = (linkedLedId) => `
        <div class="control-card control-card--led-mode control-card--led-mode-disabled" data-state="off" data-device-id="${LED_MODE_DEVICE_ID}" data-led-device-id="${linkedLedId}" data-icon-on="images/icons/ledmode.svg" data-icon-off="images/icons/ledmode.svg" data-light-name="LED Mode" aria-disabled="true" onclick="toggleLedModeControl(this)">
          <div class="control-icon-wrap">
            <img class="control-icon control-icon-outline" src="images/icons/ledmode.svg" alt="LED Mode">
            <img class="control-icon control-icon-main" src="images/icons/ledmode.svg" alt="LED Mode">
          </div>
          <div class="control-label">LED Mode</div>
        </div>
      `;

  return env.lights
    .map((light, index) => {
      const dimmerEnabled = isDimmerLight(light);

      // Dimmers usam icon-dimmer; a luz acesa aparece no background quando on.
      const defaultIconOn = dimmerEnabled ? DIMMER_ICON_ON : DEFAULT_ICON_ON;
      const defaultIconOff = dimmerEnabled ? DIMMER_ICON_OFF : DEFAULT_ICON_OFF;

      const iconOn = dimmerEnabled
        ? light?.iconOn || light?.icon?.on || light?.icons?.on || defaultIconOn
        : DEFAULT_ICON_ON;
      const iconOff = dimmerEnabled
        ? light?.iconOff ||
          light?.icon?.off ||
          light?.icons?.off ||
          defaultIconOff
        : DEFAULT_ICON_OFF;
      const defaultLevel = normalizeDimmerLevel(light?.defaultLevel, 80);
      const deviceId = String(light.id);
      const isPoolLedControl = false;

      // Todas as luzes agora têm ícone de background (light-on com 60% opacity quando ligado)
      const backgroundIcon = DEFAULT_ICON_ON;

      if (!dimmerEnabled) {
        const lightCard = `
        <div class="control-card" data-state="off" data-device-id="${deviceId}" data-light-name="${light.name}" data-light-index="${index}" data-icon-on="${iconOn}" data-icon-off="${iconOff}" data-icon-bg="${backgroundIcon}" onclick="toggleRoomControl(this)">
          <div class="control-icon-wrap">
            <img class="control-icon control-icon-bg" src="${backgroundIcon}" alt="" style="opacity: 0;">
            <img class="control-icon control-icon-outline" src="${iconOff}" alt="${light.name}">
            <img class="control-icon control-icon-main" src="${iconOff}" alt="${light.name}">
          </div>
          <div class="control-label">${light.name}</div>
        </div>
      `;

        return isPoolLedControl
          ? `${lightCard}${buildLedModeCard(deviceId)}`
          : lightCard;
      }

      const sliderId = `${envKey}-${deviceId}-dimmer`;

      return `
        <div class="control-card control-card--dimmer" data-state="off" data-device-id="${deviceId}" data-light-name="${light.name}" data-light-index="${index}" data-icon-on="${iconOn}" data-icon-off="${iconOff}" data-icon-bg="${backgroundIcon || ""}" data-control-type="dimmer" data-default-level="${defaultLevel}" onclick="toggleDimmerControl(event, this)" onmousedown="startDimmerLongPress(event, this)" onmouseup="cancelDimmerLongPress(this)" onmouseleave="cancelDimmerLongPress(this)" ontouchstart="startDimmerLongPress(event, this)" ontouchend="cancelDimmerLongPress(this)" ontouchcancel="cancelDimmerLongPress(this)">
          <div class="control-icon-wrap">
            ${backgroundIcon ? `<img class="control-icon control-icon-bg" src="${backgroundIcon}" alt="" style="opacity: 0;">` : ""}
            <img class="control-icon control-icon-outline" src="${iconOff}" alt="${light.name}">
            <img class="control-icon control-icon-main" src="${iconOff}" alt="${light.name}">
          </div>
          <div class="control-label control-label--full">${light.name}</div>
        </div>
      `;
    })
    .join("");
}

function generateCurtainsControls(envKey) {
  const env = getEnvironment(envKey);
  if (!env?.curtains?.length) return "";

  const buildCurtainDataAttributes = (curtain) =>
    [
      curtain?.deviceId ? `data-device-id="${curtain.deviceId}"` : "",
      curtain?.deviceIds ? `data-device-ids="${curtain.deviceIds}"` : "",
      curtain?.actionOpen ? `data-action-open="${curtain.actionOpen}"` : "",
      curtain?.actionStop ? `data-action-stop="${curtain.actionStop}"` : "",
      curtain?.actionClose ? `data-action-close="${curtain.actionClose}"` : "",
    ]
      .filter(Boolean)
      .join(" ");

  const curtains = env.curtains
    .map((curtainConfig) => buildCurtainControlModel(curtainConfig, env))
    .filter(Boolean);

  const isSingleCurtain = curtains.length === 1;

  return curtains
    .map((curtain) => {
      const openLabel =
        curtain?.curtainMotionType === "vertical" ? "Subir" : "Abrir";
      const closeLabel =
        curtain?.curtainMotionType === "vertical" ? "Descer" : "Fechar";

      return `
        <article class="curtain-tile curtain-tile--transparent${isSingleCurtain ? " curtain-tile--full-width" : ""}" data-device-id="${curtain.deviceId}" data-device-ids="${curtain.deviceIds}" data-environment="${env.name}">
          <header class="curtain-tile__header curtain-tile__header--minimal">
            <h3 class="curtain-tile__title">${curtain.title}</h3>
            <div class="curtain-tile__line"></div>
          </header>
          <div class="curtain-tile__actions">
            <button class="curtain-tile__btn" ${buildCurtainDataAttributes(curtain)} onclick="curtainAction(this, 'open')" aria-label="${openLabel} ${curtain.title}">
              <img src="${curtain.iconOpen}" alt="${openLabel}">
            </button>
            <button class="curtain-tile__btn curtain-tile__btn--stop" ${buildCurtainDataAttributes(curtain)} onclick="curtainAction(this, 'stop')" aria-label="Parar ${curtain.title}">
              <img src="${curtain.iconStop}" alt="Parar">
            </button>
            <button class="curtain-tile__btn" ${buildCurtainDataAttributes(curtain)} onclick="curtainAction(this, 'close')" aria-label="${closeLabel} ${curtain.title}">
              <img src="${curtain.iconClose}" alt="${closeLabel}">
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function getBottomNavConfig() {
  const accessApi = getDashboardAccessApi();
  if (!accessApi || typeof accessApi.filterNavItems !== "function") {
    return bottomNavConfig;
  }

  return {
    ...bottomNavConfig,
    items: accessApi.filterNavItems(bottomNavConfig.items || []),
  };
}

function getAppInfoConfig() {
  const appInfo = CLIENT_CONFIG?.appInfo || {};
  const logo = appInfo.logo || {};
  const links = appInfo.links || {};

  return {
    logo: {
      src: typeof logo.src === "string" ? logo.src.trim() : "",
      alt: typeof logo.alt === "string" ? logo.alt.trim() : "",
    },
    links: {
      instagram: {
        enabled: links.instagram?.enabled !== false,
        url:
          typeof links.instagram?.url === "string"
            ? links.instagram.url.trim()
            : "",
        label:
          typeof links.instagram?.label === "string"
            ? links.instagram.label.trim()
            : "Instagram",
      },
      support: {
        enabled: links.support?.enabled === true,
        url:
          typeof links.support?.url === "string"
            ? links.support.url.trim()
            : "",
        label:
          typeof links.support?.label === "string"
            ? links.support.label.trim()
            : "Contato",
      },
    },
  };
}

function getAuthConfig() {
  const auth = CLIENT_CONFIG?.auth || {};

  return {
    enabled: auth.enabled === true,
    supabaseUrl:
      typeof auth.supabaseUrl === "string" ? auth.supabaseUrl.trim() : "",
    supabaseAnonKey:
      typeof auth.supabaseAnonKey === "string"
        ? auth.supabaseAnonKey.trim()
        : "",
    allowEmailSignUp: auth.allowEmailSignUp === true,
    allowGoogleLogin: auth.allowGoogleLogin !== false,
    requireEmailConfirmation: auth.requireEmailConfirmation !== false,
    redirectTo:
      typeof auth.redirectTo === "string" ? auth.redirectTo.trim() : "",
  };
}

window.CLIENT_CONFIG = CLIENT_CONFIG;
window.bottomNavConfig = bottomNavConfig;
window.getBottomNavConfig = getBottomNavConfig;
window.getAppInfoConfig = getAppInfoConfig;
window.getWeatherConfig = getWeatherConfig;
window.getMainDashboardConfig = getMainDashboardConfig;
window.getVisibleEnvironments = getVisibleEnvironments;
window.getEnvironment = getEnvironment;
window.getEnvironmentDeviceList = getEnvironmentDeviceList;
window.getEnvironmentPrimaryDevice = getEnvironmentPrimaryDevice;
window.getEnvironmentDeviceBinding = getEnvironmentDeviceBinding;
window.getEnvironmentControlId = getEnvironmentControlId;
window.getLegacyControlId = getLegacyControlId;
window.getAudioDefaults = getAudioDefaults;
window.getEnvironmentLightIds = getEnvironmentLightIds;
window.getEnvironmentCurtainIds = getEnvironmentCurtainIds;
window.getAllCurtainIds = getAllCurtainIds;
window.getAllLightIds = getAllLightIds;
window.getAcDeviceIds = getAcDeviceIds;
window.getHomeRoomsData = getHomeRoomsData;
window.getEnvironmentPhotoMap = getEnvironmentPhotoMap;
window.getIconOverrides = getIconOverrides;
window.getUiItem = getUiItem;
window.getUiToggle = getUiToggle;
window.getUiToggleIcon = getUiToggleIcon;
window.getUiActionIcon = getUiActionIcon;
window.buildCurtainSectionsFromConfig = buildCurtainSectionsFromConfig;
window.generateLightsControls = generateLightsControls;
window.generateCurtainsControls = generateCurtainsControls;
window.getAuthConfig = getAuthConfig;

console.log("✅ CLIENT_CONFIG carregado:", CLIENT_CONFIG.clientInfo.name);
