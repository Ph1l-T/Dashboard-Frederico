/**
 *   MolSmart GW8 Driver - Versão Usando IR MolSmart Database. Versão para controles de AC. 
 *   You must create your remote control template, at http://ir.molsmart.com.br. Then you can import your remote control over by using just the sharing URL. 
 *   
 *   
 *	If you want to add any specific AC Methods, that can be done in the SetThermostatModes, or SetThermostatFanModes. This specific driver has as default 
 *  the Heat/Cool/Off for Thermostats, and NO option for Fan Speed (set to AUTO). 
 *   
 *   
 *  Copyright 2024 VH 
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 *  in compliance with the License. You may obtain a copy of the License at:
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License
 *  for the specific language governing permissions and limitations under the License.
 *
 *
 *            --- Driver para GW8 - IR - para AC --- usando os controles do ir.molsmart.com.br
 *
 *            V.1.0   11/11/2024 - V1 para trazer os controles remotos prontos. 
 *            1.1 - 26/1/2026 - Fixed Online Status for GW8. Added Version number to driver. Added Memory used in GW8 to status. 
 *            1.2 - 24/3/2026 - Fixed Postback. Fixed temperatures 24 and 25 Cool. Added on/off commands for Maker API. . 
 * 			  1.3 - 31/3/2026 - Added commands for Vetra integration feedback
 *            1.4 - 01/4/2026 - Dropdown para selecionar controle remoto direto do ir.molsmart.com.br (sem precisar pegar URL manualmente)
*/

metadata {
  definition (name: "MolSmart - GW8 - AC (irweb)", namespace: "TRATO", author: "VH", vid: "generic-contact") {
		capability "Actuator"
  		capability "PushableButton"
      	capability "Sensor"
		capability "Temperature Measurement"
		capability "Thermostat"
		capability "Thermostat Cooling Setpoint"
		capability "Thermostat Setpoint"

		attribute "supportedThermostatFanModes", "JSON_OBJECT"
		attribute "supportedThermostatModes", "JSON_OBJECT"	  
		attribute "hysteresis", "NUMBER"
        attribute "remoteListStatus", "STRING"
        attribute "Controle", "STRING"
        attribute "TipoControle", "STRING"
        attribute "Formato", "STRING"
        attribute "driverVersion", "STRING"

      
command "GetRemoteDATA"
command "AtualizaDadosGW8"
command "cleanvars"
command "clearTemps"
command "createTemps"
command "FetchRemoteList"
command "setSupportedThermostatFanModes", ["JSON_OBJECT"]
command "setSupportedThermostatModes", ["JSON_OBJECT"]
command "setTemperature", ["NUMBER"]   
      
      
command "poweroff"
command "poweron"
command "auto"
command "heat"
command "cool"
command "fan"
command "heattemp25"
command "heattemp26"
command "heattemp27"
command "heattemp28"
command "heattemp29"
command "heattemp30" 
command "fanAuto"
command "fanHigh"    
command "comandoextra7"  
command "comandoextra8"   
command "sweep"
command "turbo"
command "fan"
command "temp16"
command "temp17"
command "temp18"
command "temp19"
command "temp20"
command "temp21"
command "temp22"
command "temp23"
command "temp24"
command "temp25"      
command "onoff"
command "swing"
command "mode"
command "timer"
command "tempup"
command "tempdown"
command "fanspeed"	 
command "setdefaults"    
command "on" 
command "off"
command "start" 
command "stop"      
command "healthCheckNow"

    // NOVOS atributos de saúde/conectividade
    attribute "lastHealthAt", "STRING"
    attribute "healthLatencyMs", "NUMBER"

    // NOVO: versão do GW8 (6 caracteres após "Version: ")
    attribute "gw8Version", "STRING"      

    // NOVO: versão do GW8 (6 caracteres após "Version: ")
    attribute "gw8Online", "STRING"
    attribute "gw8StoragePct", "NUMBER"
    attribute "gw8StoragePctText", "STRING"      
            
    // === NOVO: Health Check ===
    input name: "enableHealthCheck", type: "bool",   title: "Ativar verificação de online (HTTP /info)", defaultValue: true
    input name: "healthCheckMins",   type: "number", title: "Intervalo do health check (min)", defaultValue: 30, range: "1..1440"
      
    
      
  }      
}

    import groovy.transform.Field
    import groovy.json.JsonOutput
    @Field static final String DRIVER = "by TRATO"
    @Field static final String USER_GUIDE = "https://github.com/hhorigian/hubitat_MolSmart_GW8/tree/main/IR/AC(irweb)"
	@Field static final String DRIVER_VERSION = "1.4"
    @Field static final String REMOTE_LIST_URL = "http://ir.molsmart.com.br/controles.php?apikey=mol-ir-2f9a8c4e1b7d3k6j&type=ar"


    String fmtHelpInfo(String str) {
    String prefLink = "<a href='${USER_GUIDE}' target='_blank'>${str}<br><div style='font-size: 70%;'>${DRIVER}</div></a>"
    return "<div style='font-size: 160%; font-style: bold; padding: 2px 0px; text-align: center;'>${prefLink}</div>"
    }


    @Field static final String DRIVER1 = "IR MolSmart"
    @Field static final String USER_GUIDE1 = "https://ir.molsmart.com.br/"

    String fmtHelpInfo1(String str) {
    String prefLink1 = "<a href='${USER_GUIDE1}' target='_blank'>${str}<br><div style='font-size: 70%;'>${DRIVER1}</div></a>"
    return "<div style='font-size: 160%; font-style: bold; padding: 2px 0px; text-align: center;'>${prefLink1}</div>"
    }



  preferences {
        input name: "molIPAddress", type: "text", title: "MolSmart GW8 IP Address", submitOnChange: true, required: true, defaultValue: "192.168.1.100" 
        input name: "user", title:"Usuário", type: "string", required: true, defaultValue: "admin" 
        input name: "password", title:"Senha", type: "string", required: true, defaultValue: "12345678" 
	    input name: "channel", title:"Canal Infravermelho (1-8). O Blaster é o 1", type: "string", required: true , defaultValue: "1"        

        // === Seleção de Controle Remoto ===
        input name: "irEmail", type: "string", title: "📧 Email do ir.molsmart.com.br (opcional — traz seus controles privados)", submitOnChange: false
        input name: "remoteFilter", type: "string", title: "🔍 Filtro de controle (ex: Samsung) — salve para atualizar a lista abaixo", submitOnChange: false
        
        if (state.remoteOptions) {
            input name: "selectedRemote", type: "enum", title: "📡 Selecione o Controle Remoto de AR", 
                  options: state.remoteOptions, required: false, submitOnChange: false
        } else {
            input name: "selectedRemote", type: "enum", title: "📡 Selecione o Controle Remoto de AR (salve para carregar a lista)", 
                  options: ["---":"Salve as configurações para carregar..."], required: false
        }

        // === URL manual (opcional, sobrepõe o dropdown se preenchida) ===
        input name: "webserviceurl", title:"URL Manual do Controle (opcional — sobrepõe a seleção acima)", type: "string"

        //help guide
        input name: "UserGuide", type: "hidden", title: fmtHelpInfo("Manual do Driver") 
        input name: "SiteIR", type: "hidden", title: fmtHelpInfo1("Site IR MolSmart") 
        input name: "logEnable", type: "bool", title: "Enable debug logging", defaultValue: false

  }   
  


def GetRemoteDATA() { GetRemoteDATA(null) }

def GetRemoteDATA(String urlOverride)
{
    String targetUrl = urlOverride ?: settings.webserviceurl ?: state.lastRemoteUrl
    if (!targetUrl) {
        log.warn "GetRemoteDATA: nenhuma URL disponível"
        return
    }
    state.lastRemoteUrl = targetUrl

    def params = [
        uri: targetUrl,
        contentType: "application/json"
    ]
    try {
        httpGet(params) { resp ->
            if (resp.success) {                
                sendEvent(name: "GetRemoteData", value: "Sucess")
                //log.debug "RESULT = " + resp.data
      
sendEvent(name: "Controle", value: resp.data.name)   
sendEvent(name: "TipoControle", value: resp.data.type)   
sendEvent(name: "Formato", value: resp.data.conversor)  
log.info "Controle: " + resp.data.name
log.info "TipoControle: " + resp.data.type
// Persiste para reemitir no updated()
state.savedControle     = resp.data.name
state.savedTipoControle = resp.data.type
state.savedFormato      = resp.data.conversor
                
state.encoding = resp.data.conversor			 		
state.poweroff = resp.data.functions.function[0]
state.poweron = resp.data.functions.function[1]
state.auto = resp.data.functions.function[2]
state.heat = resp.data.functions.function[3]
state.cool = resp.data.functions.function[4]
state.fan = resp.data.functions.function[5]
state.dry = resp.data.functions.function[6]
state.setautocool = resp.data.functions.function[7]
state.fanauto = resp.data.functions.function[8]
state.fanLow = resp.data.functions.function[9]
state.fanmed = resp.data.functions.function[10]
state.fanhigh = resp.data.functions.function[11]
state.comandoextra1 = resp.data.functions.function[12]
state.comandoextra2 = resp.data.functions.function[13]
state.comandoextra3 = resp.data.functions.function[14]
state.comandoextra4 = resp.data.functions.function[15]
state.comandoextra5 = resp.data.functions.function[16]
state.comandoextra6 = resp.data.functions.function[17]
state.fastcold = resp.data.functions.function[20]
state.temp18 = resp.data.functions.function[21]
state.temp20 = resp.data.functions.function[22]
state.temp22 = resp.data.functions.function[23]
state.clock = resp.data.functions.function[24]
state.sweep = resp.data.functions.function[25]
state.turbo = resp.data.functions.function[26]
state.fan = resp.data.functions.function[27]
state.temp17 = resp.data.functions.function[28]
state.temp23 = resp.data.functions.function[29]
state.temp26 = resp.data.functions.function[30]
state.onoff = resp.data.functions.function[31]
state.temp19 = resp.data.functions.function[32]
state.temp21 = resp.data.functions.function[33]
state.swing = resp.data.functions.function[34]
state.manual = resp.data.functions.function[35]
state.mode = resp.data.functions.function[36]
state.up = resp.data.functions.function[37]
state.timer = resp.data.functions.function[38]
state.cancel = resp.data.functions.function[39]
state.down = resp.data.functions.function[40]
state.display = resp.data.functions.function[41]
state.io = resp.data.functions.function[42]
state.tempup = resp.data.functions.function[43]
state.tempdown = resp.data.functions.function[44]
state.fanspeed = resp.data.functions.function[45]
state.temp24 = resp.data.functions.function[18]
state.temp25 = resp.data.functions.function[19]  
state.temp16 = resp.data.functions.function[42]
//heattemps                
state.heattemp25 = resp.data.functions.function[12] // commandextra1
state.heattemp26 = resp.data.functions.function[13] // commandextra2
state.heattemp27 = resp.data.functions.function[14] // commandextra3
state.heattemp28 = resp.data.functions.function[15] // commandextra4
state.heattemp29 = resp.data.functions.function[16] // commandextra5
state.heattemp30 = resp.data.functions.function[17] // commandextra6
state.temp16 = resp.data.functions.function[19]                 
                
    
    }
            
	}
    } catch (Exception e) {
        log.warn "Get Remote Control Info failed: ${e.message}"
    }    

}




// =====================================================================
// DROPDOWN: Busca lista de controles públicos do ir.molsmart.com.br
// =====================================================================

def fetchRemoteList() {
    // Limpa lista anterior antes de buscar
    state.remoteOptions  = ["---":"Carregando..."]
    state.remoteTokenMap = [:]
    device.updateSetting("selectedRemote", [type: "enum", value: ""])
    device.updateSetting("selectedRemote", [type: "enum", value: "", options: ["---":"Carregando..."]])
    String listUrl = REMOTE_LIST_URL
    if (settings.remoteFilter) {
        listUrl += "&search=" + java.net.URLEncoder.encode(settings.remoteFilter.trim(), "UTF-8")
    }
    if (settings.irEmail) {
        listUrl += "&email=" + java.net.URLEncoder.encode(settings.irEmail.trim(), "UTF-8")
    }
    log.info "Buscando lista de controles: ${listUrl}"

    def params = [ uri: listUrl, contentType: "application/json", timeout: 10 ]
    try {
        httpGet(params) { resp ->
            if (resp.success && resp.data?.controls) {
                def controls = resp.data.controls

                def tokenMap = [:]
                def options  = [:]

                // Públicos primeiro, depois privados — usando LinkedHashMap explícito
                def publicControles  = controls.findAll { it.source?.toString() == "public" }
                def privateControles = controls.findAll { it.source?.toString() == "user" }
                def ordered = [] 
                publicControles.each  { ordered << [name: it.name.toString(), token: it.token.toString(), prefix: "PUBLICO"] }
                privateControles.each { ordered << [name: it.name.toString(), token: it.token.toString(), prefix: "PRIVADO"] }
                ordered.each { item ->
                    String lbl = "${item.prefix} - ${item.name}"
                    tokenMap[lbl] = item.token
                    options[lbl]  = lbl
                }

                state.remoteTokenMap = tokenMap
                state.remoteOptions  = options

                int userCount   = resp.data.user_count   ?: 0
                int publicCount = resp.data.public_count ?: controls.size()
                log.info "Lista carregada: ${userCount} meus + ${publicCount} públicos"
                sendEvent(name: "remoteListStatus", value: "${userCount} meus + ${publicCount} públicos")

                device.updateSetting("selectedRemote", [type: "enum", value: settings.selectedRemote ?: ""])

                // Aplica o controle selecionado (ignora divisores)
                if (settings.selectedRemote && 
                    settings.selectedRemote != "---" &&
                    !settings.selectedRemote.startsWith("---")) {
                    applySelectedRemote()
                }

            } else {
                log.warn "fetchRemoteList: resposta vazia ou sem controls"
            }
        }
    } catch (Exception e) {
        log.warn "fetchRemoteList falhou: ${e.message}"
    }
}

def applySelectedRemote() {
    String selected = settings.selectedRemote
    if (!selected || selected == "---") return

    def tokenMap = state.remoteTokenMap
    if (!tokenMap || !tokenMap.containsKey(selected)) {
        log.warn "applySelectedRemote: '${selected}' não está na lista atual (filtro mudou?). Limpando seleção."
        device.updateSetting("selectedRemote", [type: "enum", value: ""])
        return
    }

    String token = tokenMap[selected]
    String url   = "https://molsmart-integration.web.app/controle-integration?token=${token}"

    log.info "Aplicando controle '${selected}' → token=${token}"

    // Limpa URL manual para não conflitar com o dropdown
    device.updateSetting("webserviceurl", [type: "string", value: ""])

    // Passa a URL direto — não depende de updateSetting ser síncrono
    GetRemoteDATA(url)
}

// =====================================================================

def cleanvars()  //Usada para limpar todos os states e controles aprendidos. 
{
//state.remove()
  state.clear() 
  AtualizaDadosGW8()  
}

def clearTemps() {
    state.tempup = ""
    state.tempdown = ""    
    state.temp19 = ""
        
        }

def createTemps() {
    state.tempup = "TEMPUPVSTRING"
    state.tempdown = "TEMPDOWNSTRING"
    state.temp19 = "TEMP19"
    
}

def installed()
{
	log.warn "installed..."
	off()
    initialize()
    sendEvent(name: "driverVersion", value: DRIVER_VERSION)
    sendEvent(name:"gw8Online", value:"unknown")

    
}


def updated()
{  
    log.debug "updated()"
	initialize()
    AtualizaDadosGW8()
	if (logEnable) runIn(1800,logsOff)
    sendEvent(name: "driverVersion", value: DRIVER_VERSION)
	if (!device.currentValue("gw8Online")) sendEvent(name:"gw8Online", value:"unknown")    

    // Reemite atributos persistidos do controle remoto
    if (state.savedControle)     sendEvent(name: "Controle",     value: state.savedControle)
    if (state.savedTipoControle) sendEvent(name: "TipoControle", value: state.savedTipoControle)
    if (state.savedFormato)      sendEvent(name: "Formato",      value: state.savedFormato)

    // === Carrega lista de controles e aplica o selecionado (dentro do callback) ===
    fetchRemoteList()
}


def initialize() {
	log.debug "initialized()"  
	if (enableHealthCheck) scheduleHealth()        
    sendEvent(name:"numberOfButtons", value:30)  		
	if (state?.lastRunningMode == null) {
		state.lastRunningMode = "auto"
		updateDataValue("lastRunningMode", "auto")
		setThermostatOperatingState("idle")
		
		fanAuto()
	}
    state.currentip = ""  
	setdefaults()
	if (!device.currentValue("gw8Online")) sendEvent(name:"gw8Online", value:"unknown")     
    sendEvent(name: "driverVersion", value: DRIVER_VERSION)
    
}

def setdefaults() {

    sendEvent(name: "temperature", value: convertTemperatureIfNeeded(68.0,"F",1))
    sendEvent(name: "thermostatSetpoint", value: "20", descriptionText: "Thermostat thermostatSetpoint set to 20")
    sendEvent(name: "heatingSetpoint", value: "25", descriptionText: "Thermostat heatingSetpoint set to 20")     
    sendEvent(name: "coolingSetpoint", value: "19", descriptionText: "Thermostat coolingSetpoint set to 20") 
	sendEvent(name: "hysteresis", value: (hysteresis ?: 0.5).toBigDecimal())
    sendEvent(name: "thermostatOperatingState", value: "idle", descriptionText: "Set thermostatOperatingState to Idle")     
    sendEvent(name: "thermostatFanMode", value: "auto", descriptionText: "Set thermostatFanMode auto")     
	sendEvent(name: "speed", value: "auto", descriptionText: "speed set ")
    //sendEvent(name: "setHeatingSetpoint", value: "25", descriptionText: "Set setHeatingSetpoint to 25")     

    
    //Thermostat Modes Enabled 
	//setSupportedThermostatModes(JsonOutput.toJson(["auto", "cool", "heat", "off"]))
    //setSupportedThermostatModes(JsonOutput.toJson(["auto","cool","heat","off"]))
    setSupportedThermostatModes(JsonOutput.toJson(["cool","heat","off"]))

    //FAN MODES enabled
    setSupportedThermostatFanModes(JsonOutput.toJson(["auto"]))
    sendEvent(name: "thermostatFanMode", value: "auto", descriptionText: "Fan mode pinned to auto")
    //setSupportedThermostatFanModes(JsonOutput.toJson(["auto","high","mid","low"]))
    
    
    //def fanModes = ["auto", "cool", "emergency heat", "heat", "off"]
    //def modes = ["auto","circulate","on"]
    //def fanspeeds = ["low","medium-low","medium","medium-high","high","on","off","auto"]
    //sendEvent(name: "supportedThermostatFanModes", value: fanModes, descriptionText: "supportedThermostatFanModes set")    
	//sendEvent(name: "supportedThermostatModes", value: modes, descriptionText: "supportedThermostatModes set ")
	//sendEvent(name: "supportedFanSpeeds", value: fanspeeds , descriptionText: "supportedThermostatModes set ")

    
}


//Get Device info and set as state to use during driver.
def AtualizaDadosGW8() {
    state.currentip = settings.molIPAddress
    state.currentip = settings.molIPAddress
    state.serialNum = settings.serialNum
    state.channel = settings.channel
    log.info "Dados do GW8 atualizados: " + state.currentip + " -- " + state.serialNum + " -- " +  state.verifyCode + " -- " + state.channel 

}

def setSupportedThermostatFanModes(fanModes) {
	logDebug "setSupportedThermostatFanModes(${fanModes}) foi chamado"
	// (auto, circulate, on)
	sendEvent(name: "supportedThermostatFanModes", value: fanModes, descriptionText: getDescriptionText("supportedThermostatFanModes set to ${fanModes}"))
}

def setSupportedThermostatModes(modes) {
	logDebug "setSupportedThermostatModes(${modes}) foi chamado"
	// (auto, cool, emergency heat, heat, off)
	sendEvent(name: "supportedThermostatModes", value: modes, descriptionText: getDescriptionText("supportedThermostatModes set to ${modes}"))
}



def setThermostatOperatingState (operatingState) {
	logDebug "setThermostatOperatingState (${operatingState}) was called"
	updateSetpoints(null,null,null,operatingState)
	sendEvent(name: "thermostatOperatingState", value: operatingState, descriptionText: getDescriptionText("thermostatOperatingState set to ${operatingState}"))

}



private updateSetpoints(sp = null, hsp = null, csp = null, operatingState = null){
	if (operatingState in ["off"]) return
	if (hsp == null) hsp = device.currentValue("heatingSetpoint",true)
	if (csp == null) csp = device.currentValue("coolingSetpoint",true)
	if (sp == null) sp = device.currentValue("thermostatSetpoint",true)

	if (operatingState == null) operatingState = state.lastRunningMode

	def hspChange = isStateChange(device,"heatingSetpoint",hsp.toString())
	def cspChange = isStateChange(device,"coolingSetpoint",csp.toString())
	def spChange = isStateChange(device,"thermostatSetpoint",sp.toString())
	def osChange = operatingState != state.lastRunningMode

	def newOS
	def descriptionText
	def name
	def value
	def unit = "°${location.temperatureScale}"
	switch (operatingState) {
		case ["pending heat","heating","heat"]:
			newOS = "heat"
			if (spChange) {
				hspChange = true
				hsp = sp
			} else if (hspChange || osChange) {
				spChange = true
				sp = hsp
			}
			if (csp - 2 < hsp) {
				csp = hsp + 2
				cspChange = true
			}
			break
		case ["pending cool","cooling","cool"]:
			newOS = "cool"
			if (spChange) {
				cspChange = true
				csp = sp
			} else if (cspChange || osChange) {
				spChange = true
				sp = csp
			}
			if (hsp + 2 > csp) {
				hsp = csp - 2
				hspChange = true
			}
			break
		default :
			return
	}

	if (hspChange) {
		value = hsp
		name = "heatingSetpoint"
		descriptionText = "${device.displayName} ${name} was set to ${value}${unit}"
		if (txtEnable) log.info descriptionText
		sendEvent(name: name, value: value, descriptionText: descriptionText, unit: unit, stateChange: true)
	}
	if (cspChange) {
		value = csp
		name = "coolingSetpoint"
		descriptionText = "${device.displayName} ${name} was set to ${value}${unit}"
		if (txtEnable) log.info descriptionText
		sendEvent(name: name, value: value, descriptionText: descriptionText, unit: unit, stateChange: true)
	}
	if (spChange) {
		value = sp
		name = "thermostatSetpoint"
		descriptionText = "${device.displayName} ${name} was set to ${value}${unit}"
		if (txtEnable) log.info descriptionText
		sendEvent(name: name, value: value, descriptionText: descriptionText, unit: unit, stateChange: true)
	}

	state.lastRunningMode = newOS
	updateDataValue("lastRunningMode", newOS)
}


def on() {
	poweron()
}

def start() {
	poweron()
}

def stop() {
	poweroff()
}

def off() {
    poweroff()         
}



//Case para os botões se usar no Dashboard 
def push(pushed) {
	logDebug("push: button = ${pushed}")
	if (pushed == null) {
		logWarn("push: pushed is null.  Input ignored")
		return
	}
	pushed = pushed.toInteger()
	switch(pushed) {

     	case 1 :  poweron(); break
		case 2 :  off(); break     
  		case 3 :  temp18(); break
		case 4 :  temp19(); break        
		case 5 :  temp20(); break
		case 6 :  temp21(); break        
		case 7 :  temp22(); break
		case 8 :  temp23(); break
		case 9 :  temp24(); break
		case 10 : temp25(); break        
        case 11 : tempheat25(); break    
        case 12 : tempheat26(); break            
        case 13 : tempheat27(); break            
        case 14 : tempheat28(); break    
        case 15 : tempheat29(); break    
        case 16 : tempheat30(); break  
		case 17 : tempup(); break
		case 18 : tempdown(); break
		case 19 : fastcold(); break
        case 20 : clock(); break
        case 21 : sweep(); break
        case 22 : turbo(); break
        case 23 : fan(); break
        case 24 : onoff(); break
        case 25 : swing(); break
        case 25 : manual(); break
        case 26 : mode(); break
        case 27 : up(); break
        case 28 : timer(); break
        case 29 : cancel(); break
        case 30 : down(); break
        case 31 : display(); break
        case 32 : io(); break
        case 33 : fanspeed(); break
        case 34 : comandoextra7(); break
        case 35 : comandoextra8(); break        

		
		default:
			logDebug("push: Botão inválido.")
			break
	}
}

private void updateDisplayTempForLastMode(String prevMode = null) {
    try {
        String modeNow = prevMode ?: (device.currentValue("thermostatMode") as String)
        def hsp = device.currentValue("heatingSetpoint")
        def csp = device.currentValue("coolingSetpoint")
        def sp  = device.currentValue("thermostatSetpoint")
        def value = null
        if (modeNow == "cool") {
            value = csp ?: sp ?: hsp
        } else if (modeNow == "heat") {
            value = hsp ?: sp ?: csp
        } else {
            // auto/other → prefer thermostatSetpoint, else whichever exists
            value = sp ?: csp ?: hsp
        }
        if (value != null) {
            sendEvent(name: "temperature", value: value, descriptionText: "Display last setpoint while off")
        }
    } catch (e) {
        log.warn "updateDisplayTempForLastMode error: ${e}"
    }
}



//Botão #0 para dashboard
def poweroff(){
    log.debug "Thermostat turned off"
    sendEvent(name: "switch",                 value: "off")
    sendEvent(name: "airConOperationMode",    value: "Off")
    sendEvent(name: "thermostatMode",         value: "off")
    sendEvent(name: "currentJobMode",         value: "OFF")
    sendEvent(name: "thermostatOperatingState", value: "idle")

    def last = device.currentValue("heatingSetpoint") ?: device.currentValue("coolingSetpoint")
    if(last) {
        sendEvent(name: "temperature", value: last, unit: "°C", descriptionText: "Display last setpoint while off")
    } else {
        sendEvent(name: "temperature", value: null)
    }

	def ircode = state.poweroff
    if (!ircode) {
        ircode = state.onoff   // fallback: toggle on/off
        if (ircode) log.info "poweroff: usando onoff (toggle) como fallback"
    }
    if (ircode) {
        EnviaComando(ircode)
    } else {
        log.debug "poweroff: nenhum código IR disponível, suprimido"
    }
}

//Botão #1 para dashboard
def poweron(){
    // Nunca usar "auto" — Vetra só entende cool/heat
    // Se lastRunningMode for auto ou null, assume cool
    String lastMode = state.lastRunningMode ?: "cool"
    if (lastMode == "auto" || lastMode == "off") lastMode = "cool"

    String jobMode = lastMode.toUpperCase()   // COOL ou HEAT para Vetra

    sendEvent(name: "switch",                 value: "on")
    sendEvent(name: "airConOperationMode",    value: "On")
    sendEvent(name: "thermostatMode",         value: lastMode,  isStateChange: true)
    sendEvent(name: "currentJobMode",         value: jobMode)
    sendEvent(name: "thermostatOperatingState", value: (lastMode == "heat") ? "heating" : "cooling")

    def ircode = state.poweron
    if (!ircode) {
        ircode = state.onoff
        if (ircode) log.info "poweron: usando onoff (toggle) como fallback"
        else { log.warn "poweron: nenhum código IR disponível"; return }
    }
    EnviaComando(ircode)
}

//Botão #2 para dashboard
def auto(){
    sendEvent(name: "thermostatMode", value: "auto")
    sendEvent(name: "airConOperationMode", value: "auto")
    sendEvent(name: "thermostatOperatingState", value: "cooling")    
    def ircode =  state.auto
	if (ircode.length() < 30) {
		ircode = state.mode
	}	
    EnviaComando(ircode)    
    log.info "Sent command thermostatMode =  auto " 
	
}


//Botão #3 para dashboard
def heat(){
    sendEvent(name: "thermostatMode", value: "heat")
    sendEvent(name: "airConOperationMode", value: "On")
    sendEvent(name: "currentJobMode", value: "HEAT")
    sendEvent(name: "switch", value: "on")
    //setThermostatMode("heat")    
    sendEvent(name: "thermostatOperatingState", value: "heating")    
    setHeatingSetpoint(25)    

    def ircode =  state.heattemp25
	if (ircode.length() < 30) {
		ircode = state.heattemp26
		log.info "No variable for heat heattemp25, so setup heattemp26"
		log.info ircode 		
	}	
    EnviaComando(ircode)    
    log.info "Sent command thermostatMode =  heat "+ ", with temperature set to = " + "25" 	 	
}

//Botão #4 para dashboard
def cool(){
    sendEvent(name: "thermostatMode", value: "cool")
    sendEvent(name: "airConOperationMode", value: "On")
    sendEvent(name: "currentJobMode", value: "COOL")
    sendEvent(name: "switch", value: "on")
    //setThermostatMode("cool")
    sendEvent(name: "thermostatOperatingState", value: "cooling")    
    setCoolingSetpoint(19)
    def ircode =  state.temp19    
	if (ircode.length() < 30) {
		ircode = state.temp20
		log.info "No variable for temp19, so setup temp20"
		log.info ircode
	}	
    EnviaComando(ircode)    
    log.info "Sent command thermostatMode =  cool " + ", with temperature set to = " + "19" 	
}

//Botão #5 para dashboard
def fan(){
    sendEvent(name: "thermostatMode", value: "fan")
    sendEvent(name: "airConOperationMode", value: "fan")
    sendEvent(name: "thermostatOperatingState", value: "fan only")    
    
    def ircode =  state.fan
	if (ircode.length() < 30) {
		ircode = state.mode
	}	
    EnviaComando(ircode)    
    log.info "Sent command thermostatMode =  fan " 	
}


//Botão #6 para dashboard
def dry(){
    sendEvent(name: "thermostatMode", value: "dry")
    sendEvent(name: "airConOperationMode", value: "dry")
    def ircode =   state.dry
	if (ircode.length() < 30) {
		ircode = state.mode
	}	
    EnviaComando(ircode)
}

//Botão #7 para dashboard
def setautocool(){
    sendEvent(name: "thermostatMode", value: "setautocool")
    sendEvent(name: "airConOperationMode", value: "setautocool")
    def ircode =  state.setautocool
    EnviaComando(ircode)
}



//Botão #8 para dashboard
def comandoextra1(){
    sendEvent(name: "action", value: "comandoextra1")
    def ircode =   state.comandoextra1
    EnviaComando(ircode)
}

//Botão #9 para dashboard
def comandoextra2(){
    sendEvent(name: "action", value: "comandoextra2")
     def ircode =  state.comandoextra2
    EnviaComando(ircode)
}



//Botão #10 para dashboard
def comandoextra3(){
    sendEvent(name: "action", value: "comandoextra3")
    def ircode =  state.comandoextra3
    EnviaComando(ircode)
}

//Botão #11 para dashboard
def comandoextra4(){
    sendEvent(name: "action", value: "comandoextra4")
    def ircode =  state.comandoextra4
    EnviaComando(ircode)
}

//Botão #12 para dashboard
def comandoextra5(){
    sendEvent(name: "action", value: "comandoextra5")
    def ircode =  state.comandoextra5
    EnviaComando(ircode)
}


//Botão #13 para dashboard
def fanAuto(){
    setThermostatFanMode(fanAuto)
    sendEvent(name: "FanMode", value: "fanAuto")
    EnviaComando(ircode)    
    log.info "Sent command thermostatMode =  auto " 	
}



//Botão #14 para dashboard
def fanLow(){
    setThermostatFanMode(fanLow)
    def ircode =  state.fanLow
    EnviaComando(ircode)
    log.info "Sent command setThermostatFanMode =  fanLow " 	
	
}



//Botão #18 para dashboard
def fanMed(){
    setThermostatFanMode(fanMed)
   def ircode =   state.fanMed
    EnviaComando(ircode)    
    log.info "Sent command setThermostatFanMode =  fanMed " 	
	
}

//Botão #19 para dashboard
def fanHigh(){
    setThermostatFanMode(fanHigh)
    def ircode =  state.fanHigh
    EnviaComando(ircode)    
    log.info "Sent command setThermostatFanMode =  fanMed " 	
	
}

//Botão #21 para dashboard
def comandoextra6(){
    sendEvent(name: "action", value: "comandoextra6")
    def ircode = state.comandoextra6
    EnviaComando(ircode)    
}

//Botão #22 para dashboard
def comandoextra7(){
    sendEvent(name: "action", value: "comandoextra7")
    def ircode = state.comandoextra7
    EnviaComando(ircode)    
}


//Botão #23 para dashboard
def comandoextra8(){
    sendEvent(name: "action", value: "comandoextra8")
    def ircode =  state.comandoextra8
    EnviaComando(ircode)
}

//Botão #24 para dashboard
def fastcold(){
    sendEvent(name: "action", value: "fastcold")
   def ircode =  state.fastcold
    EnviaComando(ircode)
}

//Botão #25 para dashboard
def temp18(){
    sendEvent(name: "coolingSetpoint", value: 18 )
    def ircode =  state.temp18
    EnviaComando(ircode)
    log.info "Sent command Temp =  18 " 	
	
}


//Botão #25 para dashboard
def temp16(){
    sendEvent(name: "coolingSetpoint", value: 16 )
    def ircode =  state.temp18
    EnviaComando(ircode)
    log.info "Sent command Temp =  16 " 	
	
}


//Botão #26 para dashboard
def temp20(){
    sendEvent(name: "coolingSetpoint", value: 20 )
    def ircode =  state.temp20
    EnviaComando(ircode)
    log.info "Sent command Temp =  18 " 	
    
}

//Botão #27 para dashboard
def temp22(){
    sendEvent(name: "coolingSetpoint", value: 22 )
    def ircode =  state.temp22
    EnviaComando(ircode)
    log.info "Sent command Temp =  22" 	
    
}

//Botão #28 para dashboard
def clock(){
    sendEvent(name: "action", value: "clock")
    def ircode =   state.clock
    EnviaComando(ircode)
}

//Botão #29 para dashboard
def sweep(){
    sendEvent(name: "action", value: "sweep")
    def ircode =  state.sweep
    EnviaComando(ircode)
}


//Botão #30 para dashboard
def turbo(){
    sendEvent(name: "action", value: "turbo")
    def ircode =  state.turbo
    EnviaComando(ircode)
}

//Botão #32 para dashboard
def temp17(){
    sendEvent(name: "coolingSetpoint", value: 17 )
    def ircode = state.temp17
    EnviaComando(ircode)
    log.info "Sent command Temp =  17 " 	
    
}

//Botão #33 para dashboard
def temp23(){
    sendEvent(name: "coolingSetpoint", value: 23 )
    def ircode =  state.temp23
    EnviaComando(ircode)
    log.info "Sent command Temp =  23 " 	
    
}

//Botão #34 para dashboard
def temp26(){
    sendEvent(name: "coolingSetpoint", value: 26 )
    def ircode =  state.temp26
    EnviaComando(ircode)
    log.info "Sent command Temp =  26 " 	
    
}

//Botão #35 para dashboard
def onoff(){
    sendEvent(name: "action", value: "onoff")
    def ircode =  state.onoff
    EnviaComando(ircode)
    log.info "Sent command Toggle On/off " 	
	
}

//Botão #36 para dashboard
def temp19(){
    sendEvent(name: "coolingSetpoint", value: 19 )
    def ircode =  state.temp19
    EnviaComando(ircode)
    log.info "Sent command Temp =  19 " 	
	
}

//Botão #38 para dashboard
def temp21(){
    sendEvent(name: "coolingSetpoint", value: 21 )
    def ircode =   state.temp21
    EnviaComando(ircode)
    log.info "Sent command Temp =  21 " 	
	
}

def temp24(){
    sendEvent(name: "coolingSetpoint", value: 24 )
    def ircode =   state.temp24
    EnviaComando(ircode)
    log.info "Sent command Temp =  24" 	
	
}

def temp25(){
    sendEvent(name: "coolingSetpoint", value: 25 )
    def ircode =   state.temp25
    EnviaComando(ircode)
    log.info "Sent command Temp =  25" 	
	
}

//Botão #39 para dashboard
def swing(){
    sendEvent(name: "action", value: "swing")
   def ircode =  state.swing
    EnviaComando(ircode)
}


//Botão #40 para dashboard
def manual(){
    sendEvent(name: "action", value: "manual")
    def ircode =  state.manual
    EnviaComando(ircode)
}

//Botão #41 para dashboard
def mode(){
    sendEvent(name: "action", value: "mode")
    def ircode =  state.mode
    EnviaComando(ircode)
    log.info "Sent command action =  mode " 	
	
}

//Botão #40 para dashboard
def up(){
    sendEvent(name: "action", value: "up")
    def ircode =  state.up
    EnviaComando(ircode)
    log.info "Sent command action =  up " 	
	
}


//Botão #40 para dashboard
def timer(){
    sendEvent(name: "action", value: "timer")
    def ircode =  state.timer
    EnviaComando(ircode)
}

//Botão #44 para dashboard
def cancel(){
    sendEvent(name: "action", value: "cancel")
    def ircode =  state.cancel
    EnviaComando(ircode)
}

//Botão #45 para dashboard
def down(){
    sendEvent(name: "action", value: "down")
    def ircode =  state.down
    EnviaComando(ircode)
    log.info "Sent command action =  down " 	
	
}

//Botão #46 para dashboard
def display(){
    sendEvent(name: "action", value: "display")
    def ircode =  state.display
    EnviaComando(ircode)
}

//Botão #47 para dashboard
def io(){
    sendEvent(name: "action", value: "io")
    def ircode =  state.io
    EnviaComando(ircode)
}

//Botão #48 para dashboard
def tempup(){
    sendEvent(name: "action", value: "tempup")
    def ircode = state.tempup
    if (ircode) {
        EnviaComando(ircode)
        log.info "tempup: usando código tempup"
    } else {
        // Fallback: envia temperatura fixa = atual + 1
        int current = (device.currentValue("coolingSetpoint") ?: device.currentValue("thermostatSetpoint") ?: 22) as int
        int target  = Math.min(current + 1, 30)
        def fixedCode = state["temp${target}"]
        if (fixedCode) {
            EnviaComando(fixedCode)
            log.info "tempup: fallback para temp${target} (código fixo)"
        } else {
            log.warn "tempup: sem código tempup nem temp${target} disponível"
        }
    }
}

//Botão #49 para dashboard
def tempdown(){
    sendEvent(name: "action", value: "tempdown")
    def ircode = state.tempdown
    if (ircode) {
        EnviaComando(ircode)
        log.info "tempdown: usando código tempdown"
    } else {
        // Fallback: envia temperatura fixa = atual - 1
        int current = (device.currentValue("coolingSetpoint") ?: device.currentValue("thermostatSetpoint") ?: 22) as int
        int target  = Math.max(current - 1, 16)
        def fixedCode = state["temp${target}"]
        if (fixedCode) {
            EnviaComando(fixedCode)
            log.info "tempdown: fallback para temp${target} (código fixo)"
        } else {
            log.warn "tempdown: sem código tempdown nem temp${target} disponível"
        }
    }
}

//Botão #50 para dashboard
def fanspeed(){
    sendEvent(name: "action", value: "fanspeed")
    def ircode =  state.fanspeed
    EnviaComando(ircode)
}


//// HEAT TEMPS

//Botão # para dashboard
def heattemp25(){
    sendEvent(name: "heatingSetpoint", value: 25 )
    def ircode =   state.heattemp25
    EnviaComando(ircode)
    log.info "Sent command Temp Heat =  25 " 	
    
}


//Botão # para dashboard
def heattemp26(){
    sendEvent(name: "heatingSetpoint", value: 26 )
    def ircode =   state.heattemp26
    EnviaComando(ircode)
    log.info "Sent command Temp Heat =  26 " 	    
}


//Botão # para dashboard
def heattemp27(){
    sendEvent(name: "heatingSetpoint", value: 27 )
    def ircode =   state.heattemp27
    EnviaComando(ircode)
    log.info "Sent command Temp Heat =  27 " 	    
}


//Botão # para dashboard
def heattemp28(){
    sendEvent(name: "heatingSetpoint", value: 28 )
    def ircode =   state.heattemp28
    EnviaComando(ircode)
    log.info "Sent command Temp Heat =  28 " 	    
}

//Botão # para dashboard
def heattemp29(){
    sendEvent(name: "heatingSetpoint", value: 29 )
    def ircode =   state.heattemp29
    EnviaComando(ircode)
    log.info "Sent command Temp Heat =  29 " 	    
}


//Botão # para dashboard
def heattemp30(){
    sendEvent(name: "heatingSetpoint", value: 30 )
    def ircode =   state.heattemp30
    EnviaComando(ircode)
    
}



///SETTING COOLING POINTS. 


private boolean isBlank(Object s) {
    return !(s instanceof CharSequence) || s.toString().trim().isEmpty()
}


def setCoolingSetpoint(temperature) {
 	def modeNow = device.currentValue("thermostatMode")
    def osNow   = device.currentValue("thermostatOperatingState")
    boolean allowTransition = (modeNow == "off" && osNow in ["cool","cooling"])

    if (!(modeNow == "cool" || allowTransition || osNow in ["cool","cooling"])) {
        log.warn "No change of TEMP to ${temperature}, because the current mode is ${modeNow} and operatingState is ${osNow}"
        return
    }
    
    

    int tReq = (temperature as Integer)
    int prev = (device.currentValue("coolingSetpoint") as Integer)

    // Going UP branch
    if (prev <= tReq) {
        if (!isBlank(state.tempup)) {
            try {
                tempup()
                sendEvent(name:"coolingSetpoint", value:tReq)
                sendEvent(name:"setCoolingSetpoint", value:tReq)
                logInfo "Aumentando a temp (tempup)"
            } catch (MissingMethodException e) {
                log.error "tempup() not found: ${e.message}"
            }
            return
        }
    } else {
        // Going DOWN branch
        if (!isBlank(state.tempdown)) {
            try {
                tempdown()
                sendEvent(name:"coolingSetpoint", value:tReq)
                sendEvent(name:"setCoolingSetpoint", value:tReq)
                logInfo "Diminuindo a temp (tempdown)"
            } catch (MissingMethodException e) {
                log.error "tempdown() not found: ${e.message}"
            }
            return
        }
    }

    // Exact/closest fallback: try calling tempNN() methods in order
    // Build candidate list 15..32 sorted by distance (exact first), tie → higher key
    List<Integer> candidates = (17..25).toList().sort { Integer a, Integer b ->
        int da = Math.abs(a - tReq); int db = Math.abs(b - tReq)
        int cmp = (da <=> db)
        (cmp != 0) ? cmp : (b <=> a)
    }

    boolean sent = false
    for (Integer k : candidates) {
        try {
            this."temp${k}"()
            sent = true
            log.debug "Cooling: selected ${k}° via temp${k}()"
            break
        } catch (MissingMethodException ignore) {
            // try next
        }
    }
    if (!sent) {
        log.error "Cooling: none of temp15..temp32() exist to call."
        return
    }

    sendEvent(name:"coolingSetpoint", value:tReq)
    sendEvent(name:"setCoolingSetpoint", value:tReq)
}

def setHeatingSetpoint(temperature) {
    def modeNow = device.currentValue("thermostatMode")
    def osNow   = device.currentValue("thermostatOperatingState")
    boolean allowTransition = (modeNow == "off" && osNow in ["heat","heating"])

    if (!(modeNow == "heat" || allowTransition || osNow in ["heat","heating"])) {
        log.warn "No change of TEMP to ${temperature}, because the current mode is ${modeNow} and operatingState is ${osNow}"
        return
    }

    int tReq = (temperature as Integer)
    int prev = (device.currentValue("heatingSetpoint") as Integer)

    // Going UP branch (increase heat)
    if (prev <= tReq) {
        if (!isBlank(state.tempup)) {
            try {
                tempup()
                sendEvent(name:"heatingSetpoint", value:tReq)
                sendEvent(name:"setHeatingSetpoint", value:tReq)
                logInfo "HEAT increasing (tempup)"
            } catch (MissingMethodException e) {
                log.error "tempup() not found: ${e.message}"
            }
            return
        }
    } else {
        // Going DOWN branch (decrease heat)
        if (!isBlank(state.tempdown)) {
            try {
                tempdown()
                sendEvent(name:"heatingSetpoint", value:tReq)
                sendEvent(name:"setHeatingSetpoint", value:tReq)
                logInfo "HEAT decreasing (tempdown)"
            } catch (MissingMethodException e) {
                log.error "tempdown() not found: ${e.message}"
            }
            return
        }
    }

    // Exact/closest fallback: try heattemp25..heattemp30() in order
    List<Integer> candidates = (25..30).toList().sort { Integer a, Integer b ->
        int da = Math.abs(a - tReq); int db = Math.abs(b - tReq)
        int cmp = (da <=> db)
        (cmp != 0) ? cmp : (b <=> a)
    }

    boolean sent = false
    for (Integer k : candidates) {
        try {
            this."heattemp${k}"()
            sent = true
            log.debug "Heating: selected ${k}° via heattemp${k}()"
            break
        } catch (MissingMethodException ignore) {
            // try next
        }
    }
    if (!sent) {
        log.error "Heating: none of heattemp25..heattemp30() exist to call."
        return
    }

    sendEvent(name:"heatingSetpoint", value:tReq)
    sendEvent(name:"setHeatingSetpoint", value:tReq)
}

//ORIGINAL ThermostatFanmode
/* def setThermostatFanMode(fanmode) {
    switch(fanmode) {
        case "on":
            fan()
            break
        case "circulate":
            //
            break
        case "auto":
            auto()
            break
        case "quiet":
            //
            break
        case "low":
            fanLow()
            break
        case "mid":
            fanMed()
            break
        case "high":
            fanHigh()
            break        
        case "4":
            //
            break
        default:
            log.warn "Unknown fan mode ${fanmode}"
            break
    }
}
*/

def setThermostatFanMode(fanmode) {
    // Pin fan mode to 'auto' to avoid confusing the user UI
    sendEvent(name: "thermostatFanMode", value: "auto", descriptionText: "Fan mode pinned to auto")
    // Optionally: send the IR for auto fan if your remote needs it:
    // def ircode = state.fanauto ?: state.fanAuto ?: null
    // if(ircode) EnviaComando(ircode)
}


def convertCelciusToLocalTemp(temp) {
    return (location.temperatureScale == "F") ? ((temp * 1.8) + 32) : temp
}

def convertLocalToCelsiusTemp(temp) {
    return (location.temperatureScale == "F") ? Math.round((temp - 32) / 1.8) : temp
}



def setThermostatMode(thermostatmode) {
    switch(thermostatmode) {
        case "auto":
            auto()
            break
        case "off":
            off()
            break
        case "heat":
            heat()
            break
        case "emergency heat":
            emergencyHeat()
            break
        case "cool":
            cool()
            break
        case "fan":
            fan()
            break
        case "dry":
            dry()
            break
        default:
            log.warn "Unknown mode ${thermostatmode}"
            break
    }
}


private String buildFullUrl(button) {
    def ip   = settings.molIPAddress
    def sn   = settings.user
    def vc   = settings.password
    def cid  = settings.cId
    def rcid = (settings.rcId ?: "61")
    def ch = state.channel
    def repeat = settings.repeatSendHEX 

    if (state.encoding == "sendir") {   //if the remote is SendIR(Global Cache) uses one URL, if it's HEX format, uses another URL. 
        
         return "http://${ip}/control?user=${sn}&pwd=${vc}&gc=${button}&c=${ch}"	    
        
    } else {

        return "http://${ip}/control?user=${sn}&pwd=${vc}&pronto=${button}&c=${ch}&r=${repeat}"	        

    }             
}

 
def EnviaComando(button) {
	
    settings.timeoutSec  = 7    
    String fullUrl = buildFullUrl(button)
    log.info "FullURL = " + fullUrl

    // params: give only a 'uri' so Hubitat won't rebuild/encode the query
    Map params = [ uri: fullUrl, timeout: (settings.timeoutSec ?: 7) as int ]
    log.info "Params = " + params
	
        try {
            asynchttpPost('gw8PostCallback', params, [cmd: button])
        } catch (e) {
            log.warn "${device.displayName} Async POST scheduling failed: ${e.message}"
    }
}

void gw8PostCallback(resp, data) {

    String cmd = data?.cmd
    Integer code = resp?.status as Integer

    try {

        if (code in 200..299) {

            logDebug "POST OK cmd=${cmd} status=${code}"

            sendEvent(name: "lastResponseCode", value: code)
            sendEvent(name: "lastHttpResult", value: "${code} OK")

            state.ultimamensagem = "Resposta OK (${code})"

        } else {

            logWarn "POST ERROR cmd=${cmd} status=${code}"

            sendEvent(name: "lastResponseCode", value: code ?: 0)
            sendEvent(name: "lastHttpResult", value: "${code} ERROR")

            state.ultimamensagem = "Erro HTTP (${code})"
        }

    }
    catch (e) {

        logWarn "Async callback exception: ${e.message}"

        sendEvent(name: "lastResponseCode", value: -1)
        sendEvent(name: "lastHttpResult", value: "EXCEPTION")

        state.errormessage = e.message
    }
}




/* ======================= HEALTH CHECK HTTP (/info) ======================= */

private void scheduleHealth() {
  Integer mins = Math.max(1, (healthCheckMins ?: 5) as int)
  unschedule("healthPoll")
  // Primeiro dispara agora, depois agenda em minutos
  runIn(2, "healthPoll")
  runEveryXMinutes(mins, "healthPoll")
}

private void runEveryXMinutes(Integer mins, String handler) {
  // Helper para intervalos arbitrários (Hubitat tem runEvery5/10/30, aqui simulamos)
  // Reagenda com runIn a cada ciclo
  state.healthEveryMins = mins
  runIn( mins * 60, "healthReschedule" )
}

def healthReschedule() {
  Integer mins = (state.healthEveryMins ?: (healthCheckMins ?: 5)) as int
  runIn( mins * 60, "healthReschedule" )
  healthPoll()
}

def healthPoll() {
  if (!enableHealthCheck) return
  String ip = (settings.molIPAddress ?: "").trim()
  if (!ip) return
  String uri = "http://${ip}/info?type=1"
  Long started = now()
  Map params = [ uri: uri, timeout: 5 ]
  try {
    asynchttpGet('healthPollCB', params, [t0: started, uri: uri])
  } catch (e) {
    if (logEnable) log.warn "healthPoll schedule failed: ${e.message}"
  }
}

void healthPollCB(resp, data) {
  String body = ""
  Integer st = null
  try {
    st = resp?.status as Integer
    body = resp?.getData() ?: ""
  } catch (ignored) { }
  String stamp = new Date().format("yyyy-MM-dd HH:mm:ss")
  Long t0 = (data?.t0 ?: now())
  Long dt = (now() - t0)

  if (st && st >= 200 && st <= 299 && body?.toString()?.contains("MolSmart Device Info")) {
    // Online
    if (device.currentValue("gw8Online") != "online") sendEvent(name:"gw8Online", value:"online", isStateChange:true)
    sendEvent(name:"healthLatencyMs", value: dt as Long)
    sendEvent(name:"lastHealthAt", value: stamp)

    // === NOVO: extrair "Version: X" e publicar 6 chars em gw8Version ===
    try {
      String txt = body?.toString() ?: ""
      // procura linha iniciando com "Version:"
      def m = (txt =~ /(?im)^\s*Version:\s*([^\r\n]+)/)
      if (m.find()) {
        String verFull = (m.group(1) ?: "").trim()
        String ver6 = (verFull.length() >= 6) ? verFull.substring(0, 6) : verFull
        if (ver6) {
          sendEvent(name:"gw8Version", value: ver6, isStateChange:true)
          if (logEnable) log.debug "Versão detectada: '${verFull}' -> gw8Version='${ver6}'"
        }
      } else if (logEnable) {
        log.debug "Versão não encontrada no corpo do /info."
      }
    } catch (e) {
      if (logEnable) log.warn "Falha ao extrair versão: ${e.message}"
    }

    // === NOVO: extrair "Remote storage: used/total" e publicar % em gw8StoragePct ===
    try {
      String txt2 = body?.toString() ?: ""
      def ms = (txt2 =~ /(?im)^\s*Remote storage:\s*(\d+)\s*\/\s*(\d+)/)
      if (ms.find()) {
        BigDecimal used  = (ms.group(1) as BigDecimal)
        BigDecimal total = (ms.group(2) as BigDecimal)

        if (total > 0) {
          BigDecimal pct = (used * 100G) / total
          // arredonda para 1 casa (você pode trocar para 0 se preferir inteiro)
          BigDecimal pct1 = pct.setScale(1, BigDecimal.ROUND_HALF_UP)

          //sendEvent(name: "gw8StoragePct", value: pct1, unit: "%", isStateChange: true)
		  sendEvent(name: "gw8StoragePctText", value: "${pct1} %", isStateChange: true)
     

          if (logEnable) log.debug "Memoria Utilizada: ${used}/${total} -> ${pct1}%"
        } else {
         //sendEvent(name: "gw8StoragePct", value: null)
		 sendEvent(name: "gw8StoragePctText", value: "${pct1} %", isStateChange: true)            
        }
      } else if (logEnable) {
        log.debug "Remote storage não encontrado no corpo do /info."
      }
    } catch (e) {
      if (logEnable) log.warn "Falha ao extrair Remote storage: ${e.message}"
    }

      
      
      
    if (logEnable) log.debug "Health OK in ${dt} ms"
  } else {
    // Offline
    if (device.currentValue("gw8Online") != "offline") sendEvent(name:"gw8Online", value:"offline", isStateChange:true)
    sendEvent(name:"healthLatencyMs", value: null)
    sendEvent(name:"lastHealthAt", value: stamp)
    if (logEnable) log.warn "Health FAIL (status=${st})"
  }
}

def healthCheckNow() { healthPoll() }




///////// HELPERS

private getDescriptionText(msg) {
	def descriptionText = "${device.displayName} ${msg}"
	if (settings?.txtEnable) log.info "${descriptionText}"
	return descriptionText
}
        

private logInfo(msg)  { if (settings?.txtEnable   != false) log.info  "${device.displayName} ${msg}" }
private logDebug(msg) { if (settings?.debugOutput == true)  log.debug "${device.displayName} ${msg}" }
private logWarn(msg)  { log.warn "${device.displayName} ${msg}" }
        


def logsOff() {
    log.warn 'logging disabled...'
    device.updateSetting('logInfo', [value:'false', type:'bool'])
    device.updateSetting('logWarn', [value:'false', type:'bool'])
    device.updateSetting('logDebug', [value:'false', type:'bool'])
    device.updateSetting('logTrace', [value:'false', type:'bool'])
}
