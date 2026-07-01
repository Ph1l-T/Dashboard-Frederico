/**
 * TV LG IR - MolSmart GW8 Driver
 *
 * Uses the embedded LG IR codes and command style from TVLG_DriverIR.groovy,
 * with the authenticated HTTP transport used by the MolSmart GW8.
 *
 * Commands are sent directly through the native GW8 endpoint.
 */

metadata {
  definition(
    name: "TV LG IR GW8",
    namespace: "Eletrize",
    author: "PH",
    vid: "generic-contact"
  ) {
    capability "Switch"
    capability "Sensor"
    capability "Actuator"
    capability "Configuration"
    capability "Refresh"
    capability "PushableButton"

    attribute "tvCommand", "STRING"

    command "commandON"
    command "commandOFF"
    command "chUp"
    command "chDown"
    command "tvReturn"
    command "menu"
    command "mute"
    command "home"
    command "cursorUp"
    command "cursorDown"
    command "cursorLeft"
    command "cursorRight"
    command "cursorOK"
    command "num0"
    command "num1"
    command "num2"
    command "num3"
    command "num4"
    command "num5"
    command "num6"
    command "num7"
    command "num8"
    command "num9"
    command "hdmi2"

    // Dashboard-compatible aliases for the same embedded IR commands.
    command "powerOn"
    command "powerOff"
    command "channelUp"
    command "channelDown"
    command "returnButton"
    command "cursorCenter"
  }
}

import groovy.transform.Field

@Field static final String DRIVER =
  "TV LG IR GW8 - by PH - Embedded IR codes"

@Field static final Map IR_CODES = [
  "ON": "38000,1,69,343,172,21,21,21,21,21,64,21,21,21,21,21,21,21,21,21,21,21,64,21,64,21,21,21,64,21,64,21,64,21,64,21,64,21,21,21,21,21,64,21,21,21,21,21,21,21,64,21,64,21,64,21,64,21,21,21,64,21,64,21,64,21,21,21,21,21,1673,343,86,21,3732",
  "OFF": "38000,1,69,343,172,21,22,21,22,21,65,21,22,21,22,21,22,21,22,21,22,21,65,21,65,21,22,21,65,21,65,21,65,21,65,21,65,21,65,21,22,21,65,21,22,21,22,21,22,21,65,21,65,21,22,21,65,21,22,21,65,21,65,21,65,21,22,21,22,21,1673,343,86,21,3732",
  "CH_UP": "38000,1,69,340,171,21,21,21,21,21,65,21,21,21,21,21,21,21,21,21,21,21,65,21,65,21,21,21,65,21,65,21,65,21,65,21,65,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,65,21,65,21,65,21,65,21,65,21,65,21,65,21,65,21,1555,340,86,21,3678",
  "CH_DOWN": "38000,1,69,340,171,21,21,21,21,21,65,21,21,21,21,21,21,21,21,21,21,21,65,21,65,21,21,21,65,21,65,21,65,21,65,21,65,21,65,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,65,21,65,21,65,21,65,21,65,21,65,21,65,21,1555,340,86,21,3678",
  "RETURN": "38000,1,1,344,171,21,21,21,21,21,64,21,21,21,21,21,21,21,21,21,21,21,64,21,64,21,21,21,64,21,64,21,64,21,64,21,64,21,21,21,21,21,21,21,64,21,21,21,64,21,21,21,21,21,64,21,64,21,64,21,21,21,64,21,21,21,64,21,64,21,1525,344,86,21,3682,344,86,21,2000",
  "MENU": "38000,1,69,347,173,22,22,22,22,22,65,22,22,22,22,22,22,22,22,22,22,22,65,22,65,22,22,22,65,22,65,22,65,22,65,22,65,22,65,22,65,22,22,22,22,22,22,22,22,22,65,22,22,22,22,22,22,22,65,22,65,22,65,22,65,22,22,22,65,22,1527,347,87,22,3692",
  "MUTE": "38000,1,69,340,169,20,20,20,20,20,64,20,20,20,20,20,20,20,20,20,20,20,64,20,64,20,20,20,64,20,64,20,64,20,64,20,64,20,64,20,20,20,20,20,64,20,20,20,20,20,20,20,20,20,20,20,64,20,64,20,20,20,64,20,64,20,64,20,64,20,1544,340,85,20,3663",
  "HOME": "38000,1,1,344,172,21,21,21,21,21,64,21,21,21,21,21,21,21,21,21,21,21,64,21,64,21,21,21,64,21,64,21,64,21,64,21,64,21,22,21,21,21,64,21,64,21,64,21,64,21,64,21,21,21,64,21,64,21,21,21,21,21,21,21,21,21,21,21,64,21,1526,344,86,21,2000",
  "CUR_UP": "38000,1,1,344,171,21,21,21,21,21,64,21,21,21,21,21,21,21,21,21,21,21,64,21,64,21,21,21,64,21,64,21,64,21,64,21,64,21,21,21,21,21,21,21,21,21,21,21,21,21,64,21,21,21,64,21,64,21,64,21,64,21,64,21,64,21,21,21,64,21,1527,344,86,21,2000",
  "CUR_LEFT": "38000,1,1,344,171,21,21,21,21,21,64,21,21,21,21,21,21,21,21,21,21,21,64,21,64,21,21,21,64,21,64,21,64,21,64,21,64,21,64,21,64,21,64,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21,64,21,64,21,64,21,64,21,64,21,1527,344,86,21,2000",
  "CUR_RIGHT": "38000,1,1,344,171,21,21,21,21,21,64,21,21,21,21,21,21,21,21,21,21,21,64,21,64,21,21,21,64,21,64,21,64,21,64,21,64,21,21,21,64,21,64,21,21,21,21,21,21,21,21,21,21,21,64,21,21,21,21,21,64,21,64,21,64,21,64,21,64,21,1526,344,86,21,2000",
  "CUR_OK": "38000,1,1,344,171,21,21,21,21,21,64,21,21,21,21,21,21,21,21,21,21,21,64,21,64,21,21,21,64,21,64,21,64,21,64,21,64,21,21,21,21,21,64,21,21,21,21,21,21,21,64,21,21,21,64,21,64,21,21,21,64,21,64,21,64,21,21,21,64,21,1525,344,86,21,2000",
  "CUR_DOWN": "38000,1,1,344,171,21,21,21,21,21,64,21,21,21,21,21,21,21,21,21,21,21,64,21,64,21,21,21,64,21,64,21,64,21,64,21,64,21,64,21,21,21,21,21,21,21,21,21,21,21,64,21,21,21,21,21,64,21,64,21,64,21,64,21,64,21,21,21,64,21,1525,344,86,21,3682,344,86,21,2000",
  "NUM_0": "38000,1,69,340,171,21,21,21,21,21,65,21,21,21,21,21,21,21,21,21,21,21,65,21,65,21,21,21,65,21,65,21,65,21,65,21,65,21,21,21,21,21,21,21,21,21,65,21,21,21,21,21,21,21,65,21,65,21,65,21,65,21,21,21,65,21,65,21,65,21,1555,340,86,21,3678",
  "NUM_1": "38000,1,69,340,171,21,21,21,21,21,65,21,21,21,21,21,21,21,21,21,21,21,65,21,65,21,21,21,65,21,65,21,65,21,65,21,65,21,65,21,21,21,21,21,21,21,65,21,21,21,21,21,21,21,21,21,65,21,65,21,65,21,21,21,65,21,65,21,65,21,1555,340,86,21,3678",
  "NUM_2": "38000,1,69,340,171,21,21,21,21,21,65,21,21,21,21,21,21,21,21,21,21,21,65,21,65,21,21,21,65,21,65,21,65,21,65,21,65,21,21,21,65,21,21,21,21,21,65,21,21,21,21,21,21,21,65,21,21,21,65,21,65,21,21,21,65,21,65,21,65,21,1555,340,86,21,3678",
  "NUM_3": "38000,1,69,340,171,21,21,21,21,21,65,21,21,21,21,21,21,21,21,21,21,21,65,21,65,21,21,21,65,21,65,21,65,21,65,21,65,21,65,21,65,21,21,21,21,21,65,21,21,21,21,21,21,21,21,21,21,21,65,21,65,21,21,21,65,21,65,21,65,21,1555,340,86,21,3678",
  "NUM_4": "38000,1,69,341,171,21,21,21,21,21,65,21,21,21,21,21,21,21,21,21,21,21,65,21,65,21,21,21,65,21,65,21,65,21,65,21,65,21,21,21,21,21,65,21,21,21,65,21,21,21,21,21,21,21,65,21,65,21,21,21,65,21,21,21,65,21,65,21,65,21,1555,341,86,21,3678",
  "NUM_5": "38000,1,69,340,171,21,21,21,21,21,65,21,21,21,21,21,21,21,21,21,21,21,65,21,65,21,21,21,65,21,65,21,65,21,65,21,65,21,65,21,21,21,65,21,21,21,65,21,21,21,21,21,21,21,21,21,65,21,21,21,65,21,21,21,65,21,65,21,65,21,1555,340,86,21,3678",
  "NUM_6": "38000,1,69,340,171,21,21,21,21,21,65,21,21,21,21,21,21,21,21,21,21,21,65,21,65,21,21,21,65,21,65,21,65,21,65,21,65,21,21,21,65,21,65,21,21,21,65,21,21,21,21,21,21,21,65,21,21,21,21,21,65,21,21,21,65,21,65,21,65,21,1555,340,86,21,3678",
  "NUM_7": "38000,1,69,340,171,21,21,21,21,21,65,21,21,21,21,21,21,21,21,21,21,21,65,21,65,21,21,21,65,21,65,21,65,21,65,21,65,21,65,21,65,21,65,21,21,21,65,21,21,21,21,21,21,21,21,21,21,21,21,21,65,21,21,21,65,21,65,21,65,21,1555,340,86,21,3678",
  "NUM_8": "38000,1,69,340,171,21,21,21,21,21,65,21,21,21,21,21,21,21,21,21,21,21,65,21,65,21,21,21,65,21,65,21,65,21,65,21,65,21,21,21,21,21,21,21,65,21,65,21,21,21,21,21,21,21,65,21,65,21,65,21,21,21,21,21,65,21,65,21,65,21,1555,340,86,21,3678",
  "NUM_9": "38000,1,69,340,171,21,21,21,21,21,65,21,21,21,21,21,21,21,21,21,21,21,65,21,65,21,21,21,65,21,65,21,65,21,65,21,65,21,65,21,21,21,21,21,65,21,65,21,21,21,21,21,21,21,21,21,65,21,65,21,21,21,21,21,65,21,65,21,65,21,1555,340,86,21,3678",
  "HDMI2": "38000,1,69,343,172,21,22,21,22,21,65,21,22,21,22,21,22,21,22,21,22,21,65,21,65,21,22,21,65,21,65,21,65,21,65,21,65,21,22,21,22,21,65,21,65,21,22,21,22,21,65,21,65,21,65,21,65,21,22,21,22,21,65,21,65,21,22,21,22,21,1673,343,86,21,3732"
]

preferences {
  input name: "molIPAddress",
    type: "text",
    title: "MolSmart GW8 IP Address",
    required: true,
    defaultValue: "192.168.1.100"
  input name: "user",
    type: "string",
    title: "GW8 user",
    required: true,
    defaultValue: "admin"
  input name: "password",
    type: "password",
    title: "GW8 password",
    required: true,
    defaultValue: "12345678"
  input name: "channel",
    type: "string",
    title: "GW8 infrared channel (1-8; blaster = 1)",
    required: true,
    defaultValue: "1"
  input name: "logEnable",
    type: "bool",
    title: "Enable debug logging",
    defaultValue: false
}

def configure() {
  updateGW8Settings()
  logDebug "configure()"
}

def installed() {
  log.debug "installed()"
  sendEvent(name: "numberOfButtons", value: 24)
  updateGW8Settings()
  setDefaults()
}

def updated() {
  log.debug "updated()"
  updateGW8Settings()
  setDefaults()
}

def updateGW8Settings() {
  state.currentip = settings.molIPAddress
  state.channel = settings.channel ?: "1"
  log.info "GW8 settings updated - IP: ${state.currentip}, IR channel: ${state.channel}"
}

def setDefaults() {
  sendEvent(
    name: "tvCommand",
    value: "OFF",
    descriptionText: "TV command set to OFF"
  )
  sendEvent(name: "switch", value: "off")
  logDebug "Defaults set"
}

def refresh() {
  updateGW8Settings()
}

def on() {
  log.info "Turning TV on..."
  sendEvent(name: "switch", value: "on")
  sendEvent(name: "tvCommand", value: "ON")
  sendIrCode("ON")
}

def off() {
  log.info "Turning TV off..."
  sendEvent(name: "switch", value: "off")
  sendEvent(name: "tvCommand", value: "OFF")
  sendIrCode("OFF")
}

def commandON() { on() }
def commandOFF() { off() }
def powerOn() { on() }
def powerOff() { off() }

private void sendTvCommand(String label, String key) {
  log.info "TV command: ${label}"
  sendEvent(name: "tvCommand", value: label)
  sendIrCode(key)
}

def chUp() { sendTvCommand("CH_UP", "CH_UP") }
def chDown() { sendTvCommand("CH_DOWN", "CH_DOWN") }
def channelUp() { chUp() }
def channelDown() { chDown() }

def tvReturn() { sendTvCommand("RETURN", "RETURN") }
def returnButton() { tvReturn() }
def menu() { sendTvCommand("MENU", "MENU") }
def mute() { sendTvCommand("MUTE", "MUTE") }
def home() { sendTvCommand("HOME", "HOME") }

def cursorUp() { sendTvCommand("CUR_UP", "CUR_UP") }
def cursorDown() { sendTvCommand("CUR_DOWN", "CUR_DOWN") }
def cursorLeft() { sendTvCommand("CUR_LEFT", "CUR_LEFT") }
def cursorRight() { sendTvCommand("CUR_RIGHT", "CUR_RIGHT") }
def cursorOK() { sendTvCommand("CUR_OK", "CUR_OK") }
def cursorCenter() { cursorOK() }

def num0() { sendTvCommand("NUM_0", "NUM_0") }
def num1() { sendTvCommand("NUM_1", "NUM_1") }
def num2() { sendTvCommand("NUM_2", "NUM_2") }
def num3() { sendTvCommand("NUM_3", "NUM_3") }
def num4() { sendTvCommand("NUM_4", "NUM_4") }
def num5() { sendTvCommand("NUM_5", "NUM_5") }
def num6() { sendTvCommand("NUM_6", "NUM_6") }
def num7() { sendTvCommand("NUM_7", "NUM_7") }
def num8() { sendTvCommand("NUM_8", "NUM_8") }
def num9() { sendTvCommand("NUM_9", "NUM_9") }

def hdmi2() { sendTvCommand("HDMI2", "HDMI2") }

private void sendIrCode(String key) {
  String irCode = IR_CODES[key]
  if (!irCode) {
    log.warn "No embedded IR code configured for ${key}"
    return
  }

  EnviaComando(irCode)
}

private String urlEncodeValue(value) {
  return java.net.URLEncoder.encode((value ?: "").toString(), "UTF-8")
}

private String buildGW8Url(String command) {
  String ip = (settings.molIPAddress ?: state.currentip ?: "")
    .toString()
    .trim()
  String infraredChannel = (settings.channel ?: state.channel ?: "1")
    .toString()

  return "http://${ip}/control" +
    "?user=${urlEncodeValue(settings.user)}" +
    "&pwd=${urlEncodeValue(settings.password)}" +
    "&gc=${command}" +
    "&c=${urlEncodeValue(infraredChannel)}"
}

// Sends the embedded IR code through the native GW8 HTTP transport.
def EnviaComando(command) {
  if (!command) {
    log.warn "No IR code configured"
    return
  }

  if (!(settings.molIPAddress ?: state.currentip)) {
    log.warn "Configure the MolSmart GW8 IP before sending commands."
    return
  }

  String uri = buildGW8Url(command)
  Map params = [
    uri: uri.replaceAll(" ", "%20"),
    timeout: 7
  ]

  try {
    asynchttpPost(
      "gw8PostCallback",
      params,
      [command: device.currentValue("tvCommand") ?: "UNKNOWN"]
    )
  } catch (Exception error) {
    log.error "Unable to schedule GW8 IR command: ${error.message}"
  }
}

void gw8PostCallback(resp, data) {
  Integer status = resp?.status as Integer

  if (status != null && status >= 200 && status <= 299) {
    logDebug "GW8 IR command ${data?.command ?: 'UNKNOWN'} sent. HTTP ${status}"
  } else {
    log.warn "GW8 IR command failed. HTTP ${status ?: 'no status'}"
  }
}

def parse(String description) {
  logDebug description
}

private void logDebug(message) {
  if (settings?.logEnable) {
    log.debug "${message}"
  }
}
