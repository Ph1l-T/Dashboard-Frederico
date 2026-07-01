metadata {
  definition (name: "LG AC IR GW8", namespace: "Eletrize", author: "PH", vid: "generic-contact") {
    capability "Switch"
    capability "Sensor"
    capability "Actuator"
    capability "Configuration"
    capability "Refresh"
    capability "Initialize"

    attribute "acMode", "STRING"
    attribute "lastCommand", "STRING"
    attribute "lastHttpStatus", "STRING"

    command "AC_lg_ON"
    command "AC_lg_OFF"
    command "AC_lg_18"
    command "AC_lg_19"
    command "AC_lg_20"
    command "AC_lg_21"
    command "AC_lg_22"
    command "AC_lg_23"
    command "AC_lg_24"
    command "AC_lg_25"
    command "AC_lg_swing_on"
    command "AC_lg_swing_off"
  }
}

preferences {
  input name: "molIPAddress", type: "text", title: "MolSmart GW8 IP Address", required: true, defaultValue: "192.168.1.100"
  input name: "user", title: "Usuario do GW8", type: "string", required: true, defaultValue: "admin"
  input name: "password", title: "Senha do GW8", type: "password", required: true, defaultValue: "12345678"
  input name: "channel", title: "Canal Infravermelho do GW8 (1-8; blaster = 1)", type: "string", required: true, defaultValue: "1"

  input name: "httpMethod", type: "enum", title: "Metodo HTTP para envio", required: true,
        options: ["POST", "GET"], defaultValue: "POST"

  input name: "gw8CommandFormat", type: "enum", title: "Formato do comando IR no parametro gc", required: true,
        options: ["NUMERIC_GC", "FULL_SENDIR", "FULL_SENDIR_CHANNEL"], defaultValue: "NUMERIC_GC"

  input name: "logEnable", type: "bool", title: "Ativar logs de depuracao", defaultValue: false
}

// ==========================
// Codigos IR LG
// ==========================

def getIrCodes() {
  return [
    'AC_lg_18': 'sendir,1:2,1,39000,1,1,129,385,19,60,19,21,18,21,18,21,18,61,18,21,18,21,18,21,19,21,18,21,18,21,18,21,19,61,18,21,18,21,19,21,18,21,18,21,18,62,18,61,19,21,18,61,19,21,18,61,19,21,19,21,18,21,19,21,18,2000',
    'AC_lg_19': 'sendir,1:2,1,39000,1,1,129,385,19,60,19,21,18,20,19,21,18,61,19,21,18,21,18,21,18,21,18,21,19,21,18,21,18,61,18,21,19,21,18,21,18,21,18,62,18,21,18,21,18,21,18,61,19,21,18,62,18,21,18,21,18,21,18,61,19,2000',
    'AC_lg_20': 'sendir,1:2,1,39000,1,1,131,383,20,61,19,21,18,22,18,21,18,61,18,22,18,21,18,21,18,21,18,21,18,21,18,21,18,61,18,21,19,21,18,21,18,21,18,62,18,21,18,62,18,21,18,62,18,21,19,61,18,21,19,21,18,61,18,21,18,2000',
    'AC_lg_21': 'sendir,1:2,1,39000,1,1,131,383,20,60,19,21,18,21,18,21,18,62,18,21,19,21,19,21,18,21,18,21,18,21,18,21,18,61,18,21,18,21,18,21,18,21,18,62,18,61,19,21,18,21,18,61,18,21,18,62,18,22,18,21,18,62,18,61,19,2000',
    'AC_lg_22': 'sendir,1:2,1,39000,1,1,130,380,20,60,19,21,18,21,18,21,18,61,18,21,19,21,19,21,18,21,18,21,18,21,18,21,18,61,18,21,18,21,18,21,18,21,18,61,18,60,19,61,18,21,18,61,18,21,18,61,18,20,19,61,18,21,18,21,18,2000',
    'AC_lg_23': 'sendir,1:2,1,39000,1,1,130,383,20,60,19,21,18,21,18,21,18,61,19,21,18,21,18,21,18,21,18,21,18,21,18,21,18,61,18,21,18,21,19,21,19,61,19,21,18,21,18,21,18,21,18,61,19,21,19,61,18,21,18,61,18,21,18,61,18,2000',
    'AC_lg_24': 'sendir,1:2,1,39000,1,1,131,385,19,62,18,21,19,21,18,21,18,61,19,21,18,21,18,21,19,21,19,21,19,21,19,21,18,61,18,21,19,21,19,21,18,61,18,21,18,21,18,61,18,21,19,61,18,21,19,62,18,21,18,61,18,62,18,21,18,2000',
    'AC_lg_25': 'sendir,1:2,1,39000,1,1,131,383,20,60,19,21,19,21,18,21,18,61,18,21,18,21,18,21,18,21,18,21,18,21,18,21,18,61,18,21,18,21,19,21,18,61,18,21,18,61,18,21,18,21,18,61,19,21,19,62,18,21,18,61,18,62,18,62,18,2000',
    'AC_lg_OFF': 'sendir,1:2,1,39000,1,1,122,383,20,61,18,21,18,21,19,21,19,62,18,21,18,21,18,21,18,62,18,61,19,21,19,21,18,21,18,21,18,21,19,21,18,21,18,21,18,21,18,21,18,21,18,62,18,21,18,61,18,21,18,21,18,21,18,61,18,2000',
    'AC_lg_ON': 'sendir,1:2,1,39000,1,1,130,384,20,61,19,21,18,21,18,21,18,62,18,21,18,21,18,21,19,21,18,21,18,21,18,21,18,21,18,21,18,21,18,21,19,21,19,61,18,61,18,61,19,21,18,61,18,21,18,61,18,62,18,62,18,21,19,21,19,2000',
    'AC_lg_swing_on': 'sendir,1:2,1,39000,1,1,132,384,19,60,19,21,19,22,18,21,18,62,18,21,19,21,18,21,18,21,18,21,18,21,18,21,19,21,19,21,18,21,18,22,18,21,18,61,18,61,18,61,18,21,19,61,18,21,19,62,18,62,18,61,18,21,18,21,18,2000',
    'AC_lg_swing_off': 'sendir,1:2,1,39000,1,1,131,385,19,62,18,21,19,21,18,21,18,61,19,21,18,21,18,21,19,21,19,21,19,21,19,21,18,61,18,21,19,21,19,21,18,21,18,61,18,61,18,61,18,21,18,61,18,21,18,61,18,21,19,61,18,21,18,21,18,2000'
  ]
}

// ==========================
// Ciclo de vida do driver
// ==========================

def installed() {
  log.info "installed() - LG AC IR GW8"
  initialize()
  setdefaults()
}

def updated() {
  log.info "updated() - LG AC IR GW8"
  initialize()
}

def configure() {
  log.info "configure() - LG AC IR GW8"
  initialize()
}

// Comando pedido: aparece no Hubitat quando a capability Initialize esta presente.
def initialize() {
  log.info "Inicializando driver LG AC IR GW8..."

  try {
    unschedule()
  } catch (Exception e) {
    logDebug "Nao foi possivel limpar agendamentos: ${e.message}"
  }

  AtualizaDadosGW8()

  state.driverName = "LG AC IR GW8"
  state.lastInitialize = new Date().toString()
  state.lastMethod = (settings.httpMethod ?: "POST").toString()
  state.lastCommandFormat = (settings.gw8CommandFormat ?: "NUMERIC_GC").toString()

  if (device.currentValue("switch") == null) {
    sendEvent(name: "switch", value: "off")
  }

  if (device.currentValue("acMode") == null) {
    sendEvent(name: "acMode", value: "UNKNOWN")
  }

  sendEvent(name: "lastHttpStatus", value: "INITIALIZED")
  refresh()

  log.info "Initialize concluido - IP: ${state.currentip}, canal IR: ${state.channel}, metodo: ${state.lastMethod}, formato: ${state.lastCommandFormat}"
}

def refresh() {
  logDebug "refresh()"
  sendEvent(name: "acMode", value: device.currentValue("acMode") ?: "UNKNOWN")
}

def AtualizaDadosGW8() {
  state.currentip = (settings.molIPAddress ?: "").toString().trim()
  state.channel = (settings.channel ?: "1").toString().trim()
  log.info "GW8 dados atualizados - IP: ${state.currentip}, canal IR: ${state.channel}"
}

def setdefaults() {
  sendEvent(name: "acMode", value: "OFF", descriptionText: "AC Mode set to OFF")
  sendEvent(name: "switch", value: "off")
  sendEvent(name: "lastCommand", value: "NONE")
  logDebug "Defaults set"
}

// ==========================
// Comandos padrao da capability Switch
// ==========================

def on() {
  AC_lg_ON()
}

def off() {
  AC_lg_OFF()
}

// ==========================
// Comandos LG expostos no Hubitat
// ==========================

def AC_lg_ON() {
  log.info "Ligando ar LG..."
  sendEvent(name: "switch", value: "on")
  sendEvent(name: "acMode", value: "ON")
  sendLgCode("AC_lg_ON")
}

def AC_lg_OFF() {
  log.info "Desligando ar LG..."
  sendEvent(name: "switch", value: "off")
  sendEvent(name: "acMode", value: "OFF")
  sendLgCode("AC_lg_OFF")
}

def AC_lg_18() { setLgTemperature(18) }
def AC_lg_19() { setLgTemperature(19) }
def AC_lg_20() { setLgTemperature(20) }
def AC_lg_21() { setLgTemperature(21) }
def AC_lg_22() { setLgTemperature(22) }
def AC_lg_23() { setLgTemperature(23) }
def AC_lg_24() { setLgTemperature(24) }
def AC_lg_25() { setLgTemperature(25) }

def AC_lg_swing_on() {
  log.info "Ativando swing LG..."
  sendEvent(name: "switch", value: "on")
  sendEvent(name: "acMode", value: "SWING_ON")
  sendLgCode("AC_lg_swing_on")
}

def AC_lg_swing_off() {
  log.info "Desativando swing LG..."
  sendEvent(name: "switch", value: "on")
  sendEvent(name: "acMode", value: "SWING_OFF")
  sendLgCode("AC_lg_swing_off")
}

def setLgTemperature(Integer temp) {
  if (temp < 18 || temp > 25) {
    log.error "Temperatura invalida: ${temp}. Use 18-25C"
    return
  }

  String key = "AC_lg_${temp}"
  log.info "Setando ar LG para ${temp}C"
  sendEvent(name: "switch", value: "on")
  sendEvent(name: "acMode", value: "${temp}C")
  sendLgCode(key)
}

def sendLgCode(String key) {
  Map codes = getIrCodes()
  String irCode = codes[key]

  if (!irCode) {
    log.error "Codigo IR nao encontrado para ${key}"
    return
  }

  sendEvent(name: "lastCommand", value: key)
  state.lastCommandKey = key
  EnviaComando(irCode, key)
}

// ==========================
// Envio ao MolSmart GW8
// ==========================

def urlEncodeValue(value) {
  return java.net.URLEncoder.encode((value ?: "").toString(), "UTF-8")
}

def formatCommandForGw8(String rawCommand) {
  String cmd = (rawCommand ?: "").toString().trim()
  String mode = (settings.gw8CommandFormat ?: "NUMERIC_GC").toString()
  String canal = (settings.channel ?: state.channel ?: "1").toString().trim()

  if (mode == "NUMERIC_GC") {
    // Envia no gc somente a parte numerica: 39000,1,1,...
    if (cmd.toLowerCase().startsWith("sendir,")) {
      cmd = cmd.replaceFirst(/(?i)^sendir\s*,\s*1:\d+\s*,\s*\d+\s*,/, "")
    }
  } else if (mode == "FULL_SENDIR_CHANNEL") {
    // Mantem sendir, mas troca o canal 1:2 pelo canal configurado no device.
    if (cmd.toLowerCase().startsWith("sendir,")) {
      cmd = cmd.replaceFirst(/(?i)^sendir\s*,\s*1:\d+\s*,\s*\d+\s*,/, "sendir,1:${canal},1,")
    }
  } else {
    // FULL_SENDIR: envia exatamente o sendir recebido, apenas removendo espacos.
    cmd = cmd
  }

  cmd = cmd.replaceAll(/\s+/, "")
  return cmd
}

def buildGW8Url(String command) {
  String ip = (settings.molIPAddress ?: state.currentip ?: "").toString().trim()
  String canal = (settings.channel ?: state.channel ?: "1").toString().trim()
  String usuario = (settings.user ?: "").toString()
  String senha = (settings.password ?: "").toString()
  String gcCommand = formatCommandForGw8(command)

  // Mantido o endpoint do driver base: /control com user, pwd, gc e c.
  // O gc nao e codificado com URLEncoder para preservar as virgulas do codigo IR.
  return "http://${ip}/control?user=${urlEncodeValue(usuario)}&pwd=${urlEncodeValue(senha)}&gc=${gcCommand}&c=${urlEncodeValue(canal)}"
}

def maskUrl(String uri) {
  return (uri ?: "").replaceAll(/pwd=[^&]*/, "pwd=***")
}

def EnviaComando(command, String key = "embedded") {
  if (!command) {
    log.warn "Nenhum codigo IR configurado"
    return
  }

  if (!(settings.molIPAddress ?: state.currentip)) {
    log.warn "Informe o IP do MolSmart GW8 antes de enviar comandos."
    return
  }

  String uri = buildGW8Url(command)
  String method = (settings.httpMethod ?: "POST").toString().toUpperCase()
  Map params = [uri: uri.replaceAll(" ", "%20"), timeout: 20]
  Map data = [irKey: key, method: method]

  logDebug "URL GW8 montada: ${maskUrl(uri)}"
  logDebug "Enviando via ${method}"

  try {
    if (method == "GET") {
      asynchttpGet("gw8Callback", params, data)
    } else {
      asynchttpPost("gw8Callback", params, data)
    }
  } catch (Exception e) {
    log.error "Erro ao agendar envio do comando ao GW8: ${e.message}"
    sendEvent(name: "lastHttpStatus", value: "ERRO: ${e.message}")
  }
}

void gw8Callback(resp, data) {
  Integer status = null

  try {
    status = resp?.status as Integer
  } catch (Exception ignored) {
    status = null
  }

  String key = data?.irKey ?: "embedded"
  String method = data?.method ?: "?"

  if (status != null && status >= 200 && status <= 299) {
    log.info "Comando ${key} enviado ao GW8. HTTP ${status} via ${method}"
    sendEvent(name: "lastHttpStatus", value: "HTTP ${status} ${method}")
  } else {
    log.warn "Falha no envio IR ao GW8 para ${key}. HTTP ${status ?: 'sem status'} via ${method}"
    sendEvent(name: "lastHttpStatus", value: "HTTP ${status ?: 'sem status'} ${method}")

    if (status == 408) {
      log.warn "HTTP 408 indica timeout/resposta demorada do GW8. Tente alternar as preferencias Metodo HTTP e Formato do comando IR."
    }
  }
}

def parse(String description) {
  logDebug "${description}"
}

def logDebug(msg) {
  if (settings?.logEnable) {
    log.debug "${msg}"
  }
}
