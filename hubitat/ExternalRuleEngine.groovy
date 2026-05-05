import groovy.json.JsonOutput
import groovy.json.JsonSlurper

definition(
  name: "External Rule Engine",
  namespace: "eletrize",
  author: "Eletrize",
  description: "Recebe regras externas em JSON, escuta eventos e executa automacoes locais.",
  category: "Convenience",
  iconUrl: "",
  iconX2Url: "",
  oauth: true
)

preferences {
  page(name: "mainPage")
  page(name: "rulesListPage")
  page(name: "ruleDetailPage")
  page(name: "ruleEditPage")
  page(name: "ruleSavePage")
  page(name: "ruleTogglePage")
  page(name: "ruleRunPage")
  page(name: "ruleDeletePage")
  page(name: "schedulerRefreshPage")
}

def mainPage() {
  return dynamicPage(name: "mainPage", title: "External Rule Engine", install: true, uninstall: true) {
    section("Dispositivos autorizados") {
      input "switchDevices", "capability.switch", title: "Switches e luzes", multiple: true, required: false
      input "dimmerDevices", "capability.switchLevel", title: "Dimmers", multiple: true, required: false
      input "motionDevices", "capability.motionSensor", title: "Sensores de movimento", multiple: true, required: false
      input "contactDevices", "capability.contactSensor", title: "Sensores de contato", multiple: true, required: false
      input "thermostatDevices", "capability.thermostat", title: "Termostatos", multiple: true, required: false
    }

    section("API") {
      paragraph "Depois de salvar, use a URL local: http://HUB_IP/apps/api/${app?.id ?: 'APP_ID'}/ping?access_token=${state.accessToken ?: 'ACCESS_TOKEN'}"
      paragraph "App ID: ${app?.id ?: 'salve o app para gerar'}"
      paragraph "Access token: ${state.accessToken ?: 'sera criado ao salvar'}"
    }

    section("Resumo") {
      def status = schedulerStatus()
      paragraph "Regras totais: ${status.ruleCount}"
      paragraph "Regras com horario: ${status.timeRuleCount}"
      paragraph "Agendador ativo: ${status.schedulerActive ? 'sim' : 'nao'}"
      paragraph "Metodo do agendador: ${status.schedulerMethod ?: 'nenhum'}"
      paragraph "Ultimo tick: ${status.lastTick ?: 'nunca'}"
      paragraph "Ultimo disparo por horario: ${status.lastTimeTriggerMatch ?: 'nunca'}"
      if (status.lastSchedulerError) paragraph "Erro do agendador: ${status.lastSchedulerError}"
    }

    section("Gerenciar regras") {
      href(
        name: "openRulesManager",
        title: "Abrir gerenciador de regras",
        description: "Ver, editar, executar, pausar ou remover regras",
        page: "rulesListPage"
      )

      href(
        name: "refreshScheduler",
        title: "Rearmar agendador",
        description: "Recria o agendamento interno das regras por horario",
        page: "schedulerRefreshPage"
      )

      def lines = rulesUiLines(5)
      if (!lines || lines.isEmpty()) {
        paragraph "Nenhuma regra cadastrada."
      } else {
        lines.each { line ->
          paragraph line
        }
        if ((rulesUiLines()?.size() ?: 0) > 5) {
          paragraph "Mostrando as 5 primeiras regras."
        }
      }
    }

    section("Limites e logs") {
      input "enableInfoLogging", "bool", title: "Ativar logs informativos", defaultValue: true, required: false
      input "enableDebugLogging", "bool", title: "Ativar logs detalhados", defaultValue: false, required: false
    }
  }
}

mappings {
  path("/ping") {
    action: [GET: "apiPing"]
  }
  path("/devices") {
    action: [GET: "apiDevices"]
  }
  path("/rules") {
    action: [GET: "apiListRules", POST: "apiCreateRule"]
  }
  path("/rules/:ruleId") {
    action: [GET: "apiGetRule", PUT: "apiUpdateRule", DELETE: "apiDeleteRule"]
  }
  path("/rules/:ruleId/run") {
    action: [POST: "apiRunRule"]
  }
  path("/rules/:ruleId/enable") {
    action: [POST: "apiEnableRule"]
  }
  path("/rules/:ruleId/disable") {
    action: [POST: "apiDisableRule"]
  }
}

def installed() {
  logInfo("installed")
  initialize()
}

def updated() {
  logInfo("updated")
  unsubscribe()
  initialize()
}

def initialize() {
  if (!(state.rules instanceof Map)) state.rules = [:]
  if (!(state.executions instanceof Map)) state.executions = [:]
  if (!(state.executionRate instanceof Map)) state.executionRate = [:]
  if (!(state.timeTriggerFired instanceof Map)) state.timeTriggerFired = [:]

  if (!state.accessToken) {
    try {
      createAccessToken()
      logInfo("access token created")
    } catch (Exception e) {
      log.warn "Could not create access token. Enable OAuth for this app code. ${e.message}"
    }
  }

  rebuildSubscriptions()
}

def apiPing() {
  endpoint {
    def enabledRules = getRulesMap().values().findAll { ruleEnabled(it) }
    def status = schedulerStatus()
    renderJson([
      ok: true,
      appId: "${app.id}",
      now: now(),
      ruleCount: getRulesMap().size(),
      enabledRuleCount: enabledRules.size(),
      scheduler: status,
      timeTriggerCount: enabledRules.sum { rule ->
        (rule.triggers ?: []).count { trigger -> trigger?.type == "time" }
      } ?: 0
    ])
  }
}

def apiDevices() {
  endpoint {
    def devices = allowedDevices().collect { d ->
      [
        id: "${d.id}",
        label: d.displayName,
        name: d.name,
        capabilities: safeCapabilities(d),
        attributes: safeAttributes(d),
        commands: allowedCommandsForDevice(d)
      ]
    }
    renderJson([devices: devices])
  }
}

def apiListRules() {
  endpoint {
    renderJson([rules: getRulesMap().values() as List])
  }
}

def apiGetRule() {
  endpoint {
    def rule = getRulesMap()[ruleIdParam()]
    if (!rule) return renderError(404, "Rule not found")
    renderJson(rule)
  }
}

def apiCreateRule() {
  endpoint {
    def payload = readJsonBody()
    rejectOversizedPayload(payload)

    def rules = getRulesMap()
    if (rules.size() >= 100) {
      throw new IllegalArgumentException("Rule limit reached")
    }

    def rule = normalizeRule(payload)
    validateRuleOrThrow(rule)

    rules[rule.id] = rule
    state.rules = rules

    rebuildSubscriptions()
    logInfo("rule created: ${rule.name} (${rule.id})")
    renderJson(rule, 201)
  }
}

def apiUpdateRule() {
  endpoint {
    def rules = getRulesMap()
    def ruleId = ruleIdParam()
    def existing = rules[ruleId]
    if (!existing) return renderError(404, "Rule not found")

    def payload = readJsonBody()
    rejectOversizedPayload(payload)

    def rule = normalizeRule(payload, ruleId, existing.createdAt)
    validateRuleOrThrow(rule)

    rules[rule.id] = rule
    state.rules = rules
    cancelExecutionsForRule(rule.id)

    rebuildSubscriptions()
    logInfo("rule updated: ${rule.name} (${rule.id})")
    renderJson(rule)
  }
}

def apiDeleteRule() {
  endpoint {
    def ruleId = ruleIdParam()
    def rules = getRulesMap()
    if (!rules[ruleId]) return renderError(404, "Rule not found")

    rules.remove(ruleId)
    state.rules = rules
    cancelExecutionsForRule(ruleId)
    rebuildSubscriptions()

    logInfo("rule deleted: ${ruleId}")
    renderJson([ok: true])
  }
}

def apiEnableRule() {
  endpoint {
    setRuleEnabled(ruleIdParam(), true)
  }
}

def apiDisableRule() {
  endpoint {
    setRuleEnabled(ruleIdParam(), false)
  }
}

def apiRunRule() {
  endpoint {
    def rule = getRulesMap()[ruleIdParam()]
    if (!rule) return renderError(404, "Rule not found")

    runRule(rule, [manual: true])
    renderJson([ok: true, message: "Rule execution started"])
  }
}

private def setRuleEnabled(String ruleId, Boolean enabled) {
  def rules = getRulesMap()
  def rule = rules[ruleId]
  if (!rule) return renderError(404, "Rule not found")

  rule.enabled = enabled
  rule.updatedAt = isoNow()
  rules[ruleId] = rule
  state.rules = rules

  if (!enabled) cancelExecutionsForRule(ruleId)
  rebuildSubscriptions()
  renderJson(rule)
}

def rebuildSubscriptions() {
  unsubscribe()
  unschedule("scheduledTimeTick")

  def subscribed = [] as Set
  Boolean hasTimeTriggers = false
  Integer timeTriggerCount = 0

  getRulesMap().values().findAll { ruleEnabled(it) }.each { rule ->
    (rule.triggers ?: []).each { trigger ->
      if (trigger.type == "device") {
        def device = findAllowedDevice(trigger.deviceId)
        def attribute = "${trigger.attribute ?: ""}".trim()

        if (device && attribute) {
          def key = "${device.id}:${attribute}"
          if (!subscribed.contains(key)) {
            subscribed.add(key)
            subscribe(device, attribute, deviceEventHandler)
            logDebug("subscribed ${device.displayName}.${attribute}")
          }
        }
      } else if (trigger.type == "time") {
        hasTimeTriggers = true
        timeTriggerCount += 1
      }
    }
  }

  if (hasTimeTriggers) {
    schedule("0 * * ? * *", "scheduledTimeTick")
    state.schedulerActive = true
    state.schedulerMethod = "cron-second-zero"
    state.schedulerStartedAt = isoNow()
    state.lastSchedulerError = null
    logInfo("time trigger scheduler active (${timeTriggerCount} gatilhos)")
  } else {
    state.schedulerActive = false
    state.schedulerMethod = null
    state.schedulerStartedAt = null
    logInfo("no time triggers; scheduler inactive")
  }
}

def deviceEventHandler(evt) {
  def eventDeviceId = eventDeviceId(evt)
  def eventName = "${evt?.name ?: ""}"
  def eventValue = evt?.value

  logInfo("event received: ${eventDeviceId}.${eventName}=${eventValue}")

  def matchingRules = getRulesMap().values().findAll { rule ->
    ruleEnabled(rule) && ruleMatchesEvent(rule, eventDeviceId, eventName, eventValue)
  }

  matchingRules.each { rule ->
    runRule(rule, [event: [deviceId: eventDeviceId, name: eventName, value: eventValue]])
  }
}

def continueRuleExecution(data) {
  def executionId = data?.executionId
  if (!executionId) return

  logInfo("delay resumed: ${executionId}")
  executeNextAction("${executionId}")
}

private Boolean ruleMatchesEvent(Map rule, String eventDeviceId, String eventName, eventValue) {
  return (rule.triggers ?: []).any { trigger ->
    trigger.type == "device" &&
      "${trigger.deviceId}" == "${eventDeviceId}" &&
      "${trigger.attribute}" == "${eventName}" &&
      compareValues(eventValue, trigger.operator ?: "eq", trigger.value)
  }
}

def scheduledTimeTick() {
  try {
    def currentMinute = currentMinuteSnapshot()
    pruneTimeTriggerFired()
    state.lastTimeTick = [
      time: currentMinute.time,
      date: currentMinute.date,
      day: currentMinute.day,
      at: isoNow()
    ]
    state.lastSchedulerError = null
    logDebug("time tick ${currentMinute.time} (${currentMinute.day})")

    getRulesMap().values().findAll { ruleEnabled(it) }.each { rule ->
      (rule.triggers ?: []).eachWithIndex { trigger, index ->
        if (trigger?.type == "time") {
          def triggerTime = normalizeTimeOfDay(trigger?.time)
          def triggerDays = normalizeTriggerDays(trigger?.days)
          Boolean matches = timeTriggerMatches(trigger, currentMinute)
          logDebug("time trigger check: ${rule.name} trigger=${triggerTime ?: trigger?.time} days=${triggerDays ?: 'todos'} current=${currentMinute.time}/${currentMinute.day} previous=${currentMinute.previousTime}/${currentMinute.previousDay} match=${matches}")

          if (matches) {
            Boolean previousMinuteMatch = triggerTime == normalizeTimeOfDay(currentMinute.previousTime)
            def matchedKey = previousMinuteMatch ? currentMinute.previousKey : currentMinute.key
            def matchedTime = previousMinuteMatch ? currentMinute.previousTime : currentMinute.time
            def matchedDay = previousMinuteMatch ? currentMinute.previousDay : currentMinute.day
            def matchedDate = previousMinuteMatch ? currentMinute.previousDate : currentMinute.date
            def firedKey = "${rule.id}:${index}:${matchedKey}"
            def fired = state.timeTriggerFired instanceof Map ? state.timeTriggerFired : [:]
            if (fired[firedKey]) {
              logDebug("time trigger already fired: ${firedKey}")
            } else {
              fired[firedKey] = now()
              state.timeTriggerFired = fired
              state.lastTimeTriggerMatch = [
                ruleId: rule.id,
                ruleName: rule.name,
                time: matchedTime,
                day: matchedDay,
                at: isoNow()
              ]

              logInfo("time trigger fired: ${rule.name} (${matchedTime})")
              runRule(rule, [
                time: [
                  triggerIndex: index,
                  time: matchedTime,
                  day: matchedDay,
                  date: matchedDate
                ]
              ])
            }
          }
        }
      }
    }
  } catch (Exception e) {
    state.lastSchedulerError = "${isoNow()} - ${e.message}"
    log.warn "scheduledTimeTick failed: ${e.message}"
  }
}

private void runRule(Map rule, Map context = [:]) {
  if (!allowExecutionNow(rule.id)) {
    log.warn "Rate limit reached for ${rule.id}"
    return
  }

  if (!conditionsPass(rule.conditions ?: [])) {
    logInfo("conditions failed: ${rule.name}")
    return
  }

  def executionId = "exec_${now()}_${Math.abs(new Random().nextInt())}"
  def executions = getExecutionsMap()
  executions[executionId] = [
    ruleId: rule.id,
    actions: rule.actions ?: [],
    index: 0,
    context: context,
    startedAt: isoNow()
  ]
  state.executions = executions

  logInfo("rule started: ${rule.name} (${executionId})")
  executeNextAction(executionId)
}

private Boolean conditionsPass(List conditions) {
  return conditions.every { condition ->
    def device = findAllowedDevice(condition.deviceId)
    if (!device) return false

    def attribute = "${condition.attribute ?: ""}".trim()
    def current = device.currentValue(attribute)
    def ok = compareValues(current, condition.operator ?: "eq", condition.value)
    logDebug("condition ${device.displayName}.${attribute}: ${current} ${condition.operator} ${condition.value} => ${ok}")
    return ok
  }
}

private void executeNextAction(String executionId) {
  try {
    def executions = getExecutionsMap()
    def execution = executions[executionId]
    if (!execution) return

    Integer index = safeInt(execution.index, 0)
    List actions = execution.actions instanceof List ? execution.actions : []

    if (index >= actions.size()) {
      logInfo("execution completed: ${executionId}")
      executions.remove(executionId)
      state.executions = executions
      return
    }

    def action = actions[index]
    execution.index = index + 1
    executions[executionId] = execution
    state.executions = executions

    if (action.type == "delay") {
      Integer seconds = safeInt(action.seconds, 1)
      logInfo("delay started: ${seconds}s (${executionId})")
      runIn(seconds, "continueRuleExecution", [data: [executionId: executionId], overwrite: false])
      return
    }

    executeDeviceCommand(action)
    executeNextAction(executionId)
  } catch (Exception e) {
    log.warn "Execution failed ${executionId}: ${e.message}"
    def executions = getExecutionsMap()
    executions.remove(executionId)
    state.executions = executions
  }
}

private void executeDeviceCommand(action) {
  def device = findAllowedDevice(action.deviceId)
  if (!device) throw new IllegalArgumentException("Unauthorized device ${action.deviceId}")

  String command = "${action.command ?: ""}".trim()
  String mappedCommand = mapCommandForDevice(device, command)
  if (!isCommandAllowed(device, mappedCommand)) {
    throw new IllegalArgumentException("Command not allowed: ${command}")
  }

  List args = normalizeCommandArgs(mappedCommand, action.args instanceof List ? action.args : [])
  if (mappedCommand != command) {
    logInfo("executing ${device.displayName}.${command} -> ${mappedCommand}(${args.join(', ')})")
  } else {
    logInfo("executing ${device.displayName}.${command}(${args.join(', ')})")
  }

  if (args.isEmpty()) {
    device."${mappedCommand}"()
  } else {
    device."${mappedCommand}"(*args)
  }
}

private Map normalizeRule(payload, String forcedId = null, String existingCreatedAt = null) {
  if (!(payload instanceof Map)) {
    throw new IllegalArgumentException("JSON object expected")
  }

  def nowIso = isoNow()
  return [
    id: forcedId ?: sanitizeId(payload.id ?: "rule_${now()}_${Math.abs(new Random().nextInt())}"),
    routineId: sanitizeOptionalId(payload.routineId ?: payload.groupId ?: payload?.routine?.id),
    source: "${payload.source ?: ""}".trim().take(40),
    name: "${payload.name ?: "Nova regra"}".trim().take(120),
    enabled: payload.enabled != false,
    triggers: payload.triggers instanceof List ? payload.triggers : [],
    conditions: payload.conditions instanceof List ? payload.conditions : [],
    actions: payload.actions instanceof List ? payload.actions : [],
    createdAt: existingCreatedAt ?: "${payload.createdAt ?: nowIso}",
    updatedAt: nowIso
  ]
}

private void validateRuleOrThrow(Map rule) {
  if (!rule.name?.trim()) throw new IllegalArgumentException("Rule name is required")
  if (rule.triggers.size() > 5) throw new IllegalArgumentException("Too many triggers")
  if (rule.conditions.size() > 10) throw new IllegalArgumentException("Too many conditions")
  if (rule.triggers.isEmpty()) throw new IllegalArgumentException("At least one trigger is required")
  if (rule.actions.isEmpty()) throw new IllegalArgumentException("At least one action is required")

  rule.triggers.each { trigger ->
    validateTriggerBlock(trigger)
  }

  rule.conditions.each { condition ->
    validateDeviceAttributeBlock(condition, "condition")
  }

  rule.actions.each { action ->
    validateActionBlock(action)
  }
}

private void validateDeviceAttributeBlock(block, String label) {
  if (!(block instanceof Map)) throw new IllegalArgumentException("Invalid ${label}")
  if (block.type != "device") throw new IllegalArgumentException("Only device ${label}s are supported")

  def device = findAllowedDevice(block.deviceId)
  if (!device) throw new IllegalArgumentException("Unauthorized ${label} device ${block.deviceId}")

  def attribute = "${block.attribute ?: ""}".trim()
  if (!attribute) throw new IllegalArgumentException("${label} attribute is required")

  if (!attributeAllowed(device, attribute)) {
    throw new IllegalArgumentException("Attribute not available on ${device.displayName}: ${attribute}")
  }

  def operator = "${block.operator ?: "eq"}".toLowerCase()
  if (!["eq", "neq", "gt", "gte", "lt", "lte", "contains"].contains(operator)) {
    throw new IllegalArgumentException("Unsupported operator: ${operator}")
  }
}

private void validateTriggerBlock(trigger) {
  if (!(trigger instanceof Map)) throw new IllegalArgumentException("Invalid trigger")

  if (trigger.type == "device") {
    validateDeviceAttributeBlock(trigger, "trigger")
    return
  }

  if (trigger.type == "time") {
    validateTimeTriggerBlock(trigger)
    return
  }

  throw new IllegalArgumentException("Unsupported trigger type: ${trigger.type}")
}

private void validateTimeTriggerBlock(trigger) {
  String time = "${trigger.time ?: ""}".trim()
  if (!isValidTimeOfDay(time)) {
    throw new IllegalArgumentException("Invalid time trigger. Use HH:mm")
  }

  def days = normalizeTriggerDays(trigger.days)
  if (trigger.days != null && days.isEmpty()) {
    throw new IllegalArgumentException("Invalid time trigger days")
  }
}

private void validateActionBlock(action) {
  if (!(action instanceof Map)) throw new IllegalArgumentException("Invalid action")

  if (action.type == "delay") {
    Integer seconds = safeInt(action.seconds, 0)
    if (seconds < 1 || seconds > 86400) throw new IllegalArgumentException("Invalid delay seconds")
    return
  }

  if (action.type != "deviceCommand") {
    throw new IllegalArgumentException("Unsupported action type: ${action.type}")
  }

  def device = findAllowedDevice(action.deviceId)
  if (!device) throw new IllegalArgumentException("Unauthorized action device ${action.deviceId}")

  String command = "${action.command ?: ""}".trim()
  if (!isCommandAllowed(device, command)) {
    throw new IllegalArgumentException("Command not allowed on ${device.displayName}: ${command}")
  }

  normalizeCommandArgs(command, action.args instanceof List ? action.args : [])
}

private Boolean attributeAllowed(device, String attribute) {
  def wanted = attribute.toLowerCase()
  return safeAttributes(device).collect { "${it}".toLowerCase() }.contains(wanted)
}

private List normalizeCommandArgs(String command, List rawArgs) {
  def args = rawArgs ?: []
  if (args.size() > 3) throw new IllegalArgumentException("Too many command args")

  if (command in ["on", "off"]) {
    if (!args.isEmpty()) throw new IllegalArgumentException("${command} does not accept args")
    return []
  }

  if (command == "setLevel") {
    Integer level = safeInt(args ? args[0] : null, -1)
    if (level < 0 || level > 100) throw new IllegalArgumentException("setLevel requires 0-100")
    return [level]
  }

  if (command == "setColorTemperature") {
    Integer kelvin = safeInt(args ? args[0] : null, -1)
    if (kelvin < 1500 || kelvin > 10000) throw new IllegalArgumentException("setColorTemperature requires 1500-10000")
    return [kelvin]
  }

  if (command in ["setHeatingSetpoint", "setCoolingSetpoint", "setThermostatSetpoint"]) {
    BigDecimal value = safeDecimal(args ? args[0] : null)
    if (value == null || value < 5 || value > 35) throw new IllegalArgumentException("${command} requires 5-35")
    return [value]
  }

  if (!args.isEmpty()) throw new IllegalArgumentException("${command} does not accept args in MVP")
  return []
}

private Boolean compareValues(current, String operator, expected) {
  def op = "${operator ?: "eq"}".toLowerCase()

  if (op in ["gt", "gte", "lt", "lte"]) {
    BigDecimal left = safeDecimal(current)
    BigDecimal right = safeDecimal(expected)
    if (left == null || right == null) return false
    if (op == "gt") return left > right
    if (op == "gte") return left >= right
    if (op == "lt") return left < right
    if (op == "lte") return left <= right
  }

  if (op == "neq") return "${current}" != "${expected}"
  if (op == "contains") return "${current}".contains("${expected}")
  return "${current}" == "${expected}"
}

private Boolean allowExecutionNow(String ruleId) {
  Long minute = Math.floor(now() / 60000L) as Long
  def bucket = state.executionRate instanceof Map ? state.executionRate : [:]
  def key = "${ruleId}:${minute}"
  Integer count = safeInt(bucket[key], 0)
  if (count >= 30) return false

  bucket[key] = count + 1
  state.executionRate = bucket.findAll { k, v -> "${k}".endsWith(":${minute}") }
  return true
}

private Map currentMinuteSnapshot() {
  def tz = location?.timeZone ?: TimeZone.getDefault()
  def date = new Date()
  def previousDate = new Date(date.time - 60000L)
  def calendar = Calendar.getInstance(tz)
  calendar.setTime(date)
  def previousCalendar = Calendar.getInstance(tz)
  previousCalendar.setTime(previousDate)

  return [
    time: date.format("HH:mm", tz),
    key: date.format("yyyyMMddHHmm", tz),
    date: date.format("yyyy-MM-dd", tz),
    day: dayKeyFromCalendar(calendar.get(Calendar.DAY_OF_WEEK)),
    previousTime: previousDate.format("HH:mm", tz),
    previousKey: previousDate.format("yyyyMMddHHmm", tz),
    previousDate: previousDate.format("yyyy-MM-dd", tz),
    previousDay: dayKeyFromCalendar(previousCalendar.get(Calendar.DAY_OF_WEEK))
  ]
}

private Boolean timeTriggerMatches(trigger, Map currentMinute) {
  String triggerTime = normalizeTimeOfDay(trigger?.time)
  String currentTime = normalizeTimeOfDay(currentMinute?.time)
  String previousTime = normalizeTimeOfDay(currentMinute?.previousTime)
  if (triggerTime != currentTime && triggerTime != previousTime) return false

  def days = normalizeTriggerDays(trigger?.days)
  if (days.isEmpty()) return true
  String dayForMatch = triggerTime == previousTime ? currentMinute?.previousDay : currentMinute?.day
  String currentDay = normalizeDayKey(dayForMatch)
  return days.any { day -> normalizeDayKey(day) == currentDay }
}

private String normalizeTimeOfDay(value) {
  def raw = "${value ?: ""}".trim()
  def match = (raw =~ /^(\d{1,2}):([0-5]\d)$/)
  if (!match.matches()) return raw

  Integer hour = safeInt(match[0][1], -1)
  if (hour < 0 || hour > 23) return raw
  return "${hour.toString().padLeft(2, '0')}:${match[0][2]}"
}

private Boolean ruleEnabled(rule) {
  return rule?.enabled != false
}

private Boolean isValidTimeOfDay(String value) {
  def normalized = normalizeTimeOfDay(value)
  return (normalized =~ /^([01]\d|2[0-3]):([0-5]\d)$/).matches()
}

private String normalizeDayKey(value) {
  def raw = "${value ?: ""}".trim().toLowerCase()
  if (!raw) return ""

  def aliases = [
    "0": "sun", "1": "mon", "2": "tue", "3": "wed", "4": "thu", "5": "fri", "6": "sat",
    "7": "sun",
    "sun": "sun", "sunday": "sun", "domingo": "sun", "dom": "sun",
    "mon": "mon", "monday": "mon", "segunda": "mon", "seg": "mon",
    "tue": "tue", "tuesday": "tue", "terca": "tue", "terca-feira": "tue", "terça": "tue", "ter": "tue",
    "wed": "wed", "wednesday": "wed", "quarta": "wed", "qua": "wed",
    "thu": "thu", "thursday": "thu", "quinta": "thu", "qui": "thu",
    "fri": "fri", "friday": "fri", "sexta": "fri", "sex": "fri",
    "sat": "sat", "saturday": "sat", "sabado": "sat", "sábado": "sat", "sab": "sat"
  ]

  return aliases[raw] ?: ""
}

private List normalizeTriggerDays(rawDays) {
  if (rawDays == null) return []

  def source = rawDays instanceof List ? rawDays : ["${rawDays}"]
  return source
    .collect { normalizeDayKey(it) }
    .findAll { it }
    .unique()
}
private String dayKeyFromCalendar(Integer dayOfWeek) {
  if (dayOfWeek == Calendar.SUNDAY) return "sun"
  if (dayOfWeek == Calendar.MONDAY) return "mon"
  if (dayOfWeek == Calendar.TUESDAY) return "tue"
  if (dayOfWeek == Calendar.WEDNESDAY) return "wed"
  if (dayOfWeek == Calendar.THURSDAY) return "thu"
  if (dayOfWeek == Calendar.FRIDAY) return "fri"
  return "sat"
}

private void pruneTimeTriggerFired() {
  def fired = state.timeTriggerFired instanceof Map ? state.timeTriggerFired : [:]
  Long cutoff = now() - 3600000L
  state.timeTriggerFired = fired.findAll { key, timestamp ->
    safeLong(timestamp, 0L) >= cutoff
  }
}

private def findAllowedDevice(deviceId) {
  def id = "${deviceId ?: ""}".trim()
  if (!id) return null
  return allowedDevices().find { "${it.id}" == id }
}

private List allowedDevices() {
  return []
    .plus(selectedDevices("switchDevices"))
    .plus(selectedDevices("dimmerDevices"))
    .plus(selectedDevices("motionDevices"))
    .plus(selectedDevices("contactDevices"))
    .plus(selectedDevices("thermostatDevices"))
    .findAll { it != null }
    .unique { it.id }
}

private List selectedDevices(String key) {
  def value = settings?.get(key)
  if (!value) return []
  if (value instanceof List) return value.findAll { it != null }
  return [value]
}

private Boolean selectedDeviceContains(String key, device) {
  def id = "${device?.id ?: ""}"
  return selectedDevices(key).any { "${it.id}" == id }
}

private List safeCapabilities(device) {
  try {
    return device.capabilities*.name?.findAll { it }?.unique() ?: []
  } catch (ignored) {
    return []
  }
}

private List safeAttributes(device) {
  try {
    return device.supportedAttributes*.name?.findAll { it }?.unique() ?: []
  } catch (ignored) {
    return []
  }
}

private List allowedCommandsForDevice(device) {
  def out = [] as Set

  if (selectedDeviceContains("switchDevices", device)) out.addAll(["on", "off"])
  if (selectedDeviceContains("dimmerDevices", device)) out.addAll(["on", "off", "setLevel"])
  if (selectedDeviceContains("thermostatDevices", device)) {
    out.addAll(["setHeatingSetpoint", "setCoolingSetpoint", "setThermostatSetpoint"])
  }

  def normalizedCaps = safeCapabilities(device).collect { "${it}".toLowerCase().replaceAll(/\s+/, "") }
  if (normalizedCaps.contains("colortemperature")) out.add("setColorTemperature")
  if (
    normalizedCaps.contains("windowshade") ||
    normalizedCaps.contains("windowshadepreset") ||
    normalizedCaps.contains("doorcontrol") ||
    normalizedCaps.contains("garagedoorcontrol")
  ) {
    out.addAll(["open", "close", "stop", "on", "off"])
  }

  return out as List
}

private List rulesUiLines(Integer maxItems = null) {
  def rules = getRulesMap().values() as List
  if (!rules || rules.isEmpty()) return []

  def lines = rules
    .sort { a, b -> "${a?.name}" <=> "${b?.name}" }
    .collect { rule ->
      def name = "${rule?.name ?: rule?.id}"
      def enabledLabel = rule?.enabled == false ? "Pausada" : "Ativa"
      def triggerText = (rule.triggers ?: [])
        .collect { formatTrigger(it) }
        .findAll { it }
        .join(" | ")
      def actionText = (rule.actions ?: [])
        .collect { formatAction(it) }
        .findAll { it }
        .join(" | ")

      def parts = [name, enabledLabel]
      if (triggerText) parts.add("Gatilhos: ${triggerText}")
      if (actionText) parts.add("Acoes: ${actionText}")
      return parts.join(" | ")
    }

  if (maxItems && maxItems > 0 && lines.size() > maxItems) {
    return lines.take(maxItems)
  }

  return lines
}

private Map schedulerStatus() {
  def rules = getRulesMap().values() as List
  def enabledRules = rules.findAll { ruleEnabled(it) }
  Integer timeRuleCount = enabledRules.sum { rule ->
    (rule.triggers ?: []).count { it?.type == "time" }
  } ?: 0

  def lastTick = state?.lastTimeTick instanceof Map ? state.lastTimeTick : null
  def lastTickText = lastTick ? "${lastTick.date} ${lastTick.time} (${lastTick.day})" : ""
  def lastMatch = state?.lastTimeTriggerMatch instanceof Map ? state.lastTimeTriggerMatch : null
  def lastMatchText = lastMatch ? "${lastMatch.ruleName ?: lastMatch.ruleId} em ${lastMatch.time} (${lastMatch.day})" : ""

  return [
    ruleCount: rules?.size() ?: 0,
    timeRuleCount: timeRuleCount,
    schedulerActive: state?.schedulerActive == true,
    schedulerMethod: state?.schedulerMethod ?: "",
    schedulerStartedAt: state?.schedulerStartedAt ?: "",
    lastTick: lastTickText,
    lastTimeTriggerMatch: lastMatchText,
    lastSchedulerError: state?.lastSchedulerError ?: ""
  ]
}

private String formatTrigger(trigger) {
  if (!(trigger instanceof Map)) return ""

  if (trigger.type == "time") {
    def time = "${trigger.time ?: ""}".trim()
    def days = normalizeTriggerDays(trigger.days)
    def dayLabel = days ? days.join(",") : "todos"
    return "Horario ${time} (${dayLabel})"
  }

  if (trigger.type == "device") {
    def device = findAllowedDevice(trigger.deviceId)
    def deviceLabel = device?.displayName ?: "${trigger.deviceId}"
    def attribute = "${trigger.attribute ?: ""}".trim()
    def operator = "${trigger.operator ?: "eq"}"
    def value = "${trigger.value ?: ""}"
    return "Evento ${deviceLabel}.${attribute} ${operator} ${value}".trim()
  }

  return ""
}

private String formatAction(action) {
  if (!(action instanceof Map)) return ""

  if (action.type == "delay") {
    def seconds = safeInt(action.seconds, 0)
    return "Delay ${seconds}s"
  }

  if (action.type == "deviceCommand") {
    def device = findAllowedDevice(action.deviceId)
    def deviceLabel = device?.displayName ?: "${action.deviceId}"
    def command = "${action.command ?: ""}".trim()
    def args = action.args instanceof List ? action.args : []
    def argsText = args ? "(${args.join(", ")})" : ""
    return "${deviceLabel}.${command}${argsText}"
  }

  return ""
}

private Boolean deviceSupportsCommand(device, String command) {
  try {
    def names = device.supportedCommands*.name?.collect { "${it}".toLowerCase() } ?: []
    return names.contains("${command}".toLowerCase())
  } catch (ignored) {
    return false
  }
}

private String mapCommandForDevice(device, String command) {
  if (!device || !command) return command

  def normalized = "${command}".toLowerCase()
  if (!(normalized in ["on", "off"])) return command

  if (!deviceSupportsCommand(device, normalized)) {
    def target = normalized == "on" ? "open" : "close"
    if (deviceSupportsCommand(device, target)) {
      return target
    }
  }

  return command
}

def rulesListPage() {
  return dynamicPage(name: "rulesListPage", title: "Gerenciador de regras", install: false, uninstall: false) {
    section("Resumo") {
      def status = schedulerStatus()
      paragraph "Regras totais: ${status.ruleCount}"
      paragraph "Regras com horario: ${status.timeRuleCount}"
      paragraph "Agendador ativo: ${status.schedulerActive ? 'sim' : 'nao'}"
      paragraph "Metodo do agendador: ${status.schedulerMethod ?: 'nenhum'}"
      paragraph "Ultimo tick: ${status.lastTick ?: 'nunca'}"
      paragraph "Ultimo disparo por horario: ${status.lastTimeTriggerMatch ?: 'nunca'}"
      if (status.lastSchedulerError) paragraph "Erro do agendador: ${status.lastSchedulerError}"
    }

    section("Agendador") {
      href(
        name: "refreshSchedulerFromList",
        title: "Rearmar agendador",
        description: "Recria o agendamento interno das regras por horario",
        page: "schedulerRefreshPage"
      )
    }

    section("Regras") {
      def rules = getRulesMap().values() as List
      if (!rules || rules.isEmpty()) {
        paragraph "Nenhuma regra cadastrada."
      } else {
        rules.sort { a, b -> "${a?.name}" <=> "${b?.name}" }.each { rule ->
          def enabledLabel = rule?.enabled == false ? "Pausada" : "Ativa"
          def summary = buildRuleSummary(rule)
          href(
            name: "rule_${rule.id}",
            title: "${rule.name} (${enabledLabel})",
            description: summary,
            page: "ruleDetailPage",
            params: [ruleId: rule.id]
          )
        }
      }
    }
  }
}

def ruleDetailPage(param = null) {
  def ruleId = selectedRuleId(param)

  return dynamicPage(name: "ruleDetailPage", title: "Detalhes da regra", install: false, uninstall: false) {
    def rule = getRulesMap()[ruleId]
    if (!rule) {
      section("Aviso") {
        paragraph "Regra nao encontrada."
      }
      return
    }

    section("Resumo") {
      paragraph buildRuleSummary(rule)
    }

    section("Acoes") {
      href(
        name: "edit_${ruleId}",
        title: "Editar regra (JSON)",
        description: "Editar nome, horarios, acoes e condicoes",
        page: "ruleEditPage",
        params: [ruleId: ruleId]
      )

      href(
        name: "toggle_${ruleId}",
        title: rule.enabled == false ? "Ativar regra" : "Pausar regra",
        description: rule.enabled == false ? "Volta a executar" : "Interrompe execucao",
        page: "ruleTogglePage",
        params: [ruleId: ruleId, enabled: rule.enabled == false ? "true" : "false"]
      )

      href(
        name: "run_${ruleId}",
        title: "Executar agora",
        description: "Dispara a regra manualmente",
        page: "ruleRunPage",
        params: [ruleId: ruleId]
      )

      href(
        name: "delete_${ruleId}",
        title: "Remover regra",
        description: "Exclui definitivamente",
        page: "ruleDeletePage",
        params: [ruleId: ruleId]
      )
    }

    section("JSON") {
      def prettyJson = JsonOutput.prettyPrint(JsonOutput.toJson(rule))
      paragraph "<pre>${escapeHtml(prettyJson)}</pre>"
    }
  }
}

def ruleEditPage(param = null) {
  def ruleId = selectedRuleId(param)
  def rule = getRulesMap()[ruleId]

  return dynamicPage(name: "ruleEditPage", title: "Editar regra", install: false, uninstall: false) {
    if (!rule) {
      section("Aviso") {
        paragraph "Regra nao encontrada."
      }
      return
    }

    def draftKey = ruleDraftSettingKey(ruleId)
    def currentDraft = settings?.get(draftKey) ?: JsonOutput.prettyPrint(JsonOutput.toJson(rule))

    section("JSON da regra") {
      paragraph "Edite o JSON com cuidado. O id da regra e preservado."
      input name: draftKey,
        type: "textarea",
        title: "Conteudo",
        required: true,
        defaultValue: currentDraft,
        submitOnChange: false
    }

    section("Salvar") {
      href(
        name: "save_${ruleId}",
        title: "Salvar alteracoes",
        description: "Aplica o JSON editado",
        page: "ruleSavePage",
        params: [ruleId: ruleId]
      )
    }
  }
}

def ruleSavePage(param = null) {
  def ruleId = selectedRuleId(param)
  def draftKey = ruleDraftSettingKey(ruleId)
  def rawDraft = settings?.get(draftKey) ?: ""

  return dynamicPage(name: "ruleSavePage", title: "Salvar regra", install: false, uninstall: false) {
    if (!rawDraft?.trim()) {
      section("Erro") {
        paragraph "JSON vazio."
      }
      return
    }

    try {
      def payload = new JsonSlurper().parseText(rawDraft)
      def updated = updateRuleInternal(ruleId, payload)
      app.updateSetting(draftKey, [value: "", type: "textarea"])

      section("Sucesso") {
        paragraph "Regra atualizada: ${updated?.name ?: ruleId}."
      }
    } catch (Exception e) {
      section("Erro") {
        paragraph "Falha ao salvar: ${e.message}".toString()
      }
    }

    section("Voltar") {
      href(
        name: "back_${ruleId}",
        title: "Voltar aos detalhes",
        page: "ruleDetailPage",
        params: [ruleId: ruleId]
      )
    }
  }
}

def ruleTogglePage(param = null) {
  def ruleId = selectedRuleId(param)
  def enabled = "${pageParamValue(param, "enabled", "false")}".toLowerCase() == "true"

  return dynamicPage(name: "ruleTogglePage", title: "Alterar regra", install: false, uninstall: false) {
    try {
      def rule = setRuleEnabledInternal(ruleId, enabled)
      section("Sucesso") {
        paragraph "Regra ${rule?.name ?: ruleId} agora esta ${enabled ? 'ativa' : 'pausada'}."
      }
    } catch (Exception e) {
      section("Erro") {
        paragraph "Falha ao atualizar: ${e.message}".toString()
      }
    }

    section("Voltar") {
      href(
        name: "back_${ruleId}",
        title: "Voltar aos detalhes",
        page: "ruleDetailPage",
        params: [ruleId: ruleId]
      )
    }
  }
}

def ruleRunPage(param = null) {
  def ruleId = selectedRuleId(param)

  return dynamicPage(name: "ruleRunPage", title: "Executar regra", install: false, uninstall: false) {
    def rule = getRulesMap()[ruleId]
    if (!rule) {
      section("Erro") {
        paragraph "Regra nao encontrada."
      }
      return
    }

    try {
      runRule(rule, [manual: true])
      section("Sucesso") {
        paragraph "Regra ${rule?.name ?: ruleId} executada."
      }
    } catch (Exception e) {
      section("Erro") {
        paragraph "Falha ao executar: ${e.message}".toString()
      }
    }

    section("Voltar") {
      href(
        name: "back_${ruleId}",
        title: "Voltar aos detalhes",
        page: "ruleDetailPage",
        params: [ruleId: ruleId]
      )
    }
  }
}

def ruleDeletePage(param = null) {
  def ruleId = selectedRuleId(param)
  def confirm = "${pageParamValue(param, "confirm", "false")}".toLowerCase() == "true"

  return dynamicPage(name: "ruleDeletePage", title: "Remover regra", install: false, uninstall: false) {
    if (!confirm) {
      section("Confirmacao") {
        paragraph "Deseja remover a regra ${ruleId}?"
        href(
          name: "confirm_${ruleId}",
          title: "Confirmar remocao",
          description: "Esta acao nao pode ser desfeita",
          page: "ruleDeletePage",
          params: [ruleId: ruleId, confirm: "true"]
        )
      }

      section("Cancelar") {
        href(
          name: "cancel_${ruleId}",
          title: "Cancelar",
          page: "ruleDetailPage",
          params: [ruleId: ruleId]
        )
      }
      return
    }

    try {
      deleteRuleInternal(ruleId)
      section("Removida") {
        paragraph "Regra removida com sucesso."
      }
    } catch (Exception e) {
      section("Erro") {
        paragraph "Falha ao remover: ${e.message}".toString()
      }
    }

    section("Voltar") {
      href(name: "back_rules", title: "Voltar a lista", page: "rulesListPage")
    }
  }
}

def schedulerRefreshPage(param = null) {
  return dynamicPage(name: "schedulerRefreshPage", title: "Rearmar agendador", install: false, uninstall: false) {
    try {
      rebuildSubscriptions()
      def status = schedulerStatus()
      def currentMinute = currentMinuteSnapshot()

      section("Agendador") {
        paragraph "Agendador recriado."
        paragraph "Horario atual detectado: ${currentMinute.date} ${currentMinute.time} (${currentMinute.day})"
        paragraph "Regras por horario ativas: ${status.timeRuleCount}"
        paragraph "Metodo: ${status.schedulerMethod ?: 'nenhum'}"
      }
    } catch (Exception e) {
      section("Erro") {
        paragraph "Falha ao rearmar: ${e.message}".toString()
      }
    }

    section("Voltar") {
      href(name: "back_rules", title: "Voltar ao gerenciador", page: "rulesListPage")
    }
  }
}

private String ruleDraftSettingKey(String ruleId) {
  return "ruleJsonDraft_${ruleId}".replaceAll(/[^A-Za-z0-9_.:-]/, "_")
}

private String selectedRuleId(param = null) {
  def id = "${pageParamValue(param, "ruleId", state?.lastRuleId ?: "")}".trim()
  if (id) state.lastRuleId = id
  return id
}

private def pageParamValue(param, String key, fallback = null) {
  if (param instanceof Map && param.containsKey(key)) return param[key]

  try {
    if (params instanceof Map && params.containsKey(key)) return params[key]
  } catch (ignored) {}

  return fallback
}

private Map updateRuleInternal(String ruleId, Map payload) {
  def rules = getRulesMap()
  def existing = rules[ruleId]
  if (!existing) throw new IllegalArgumentException("Rule not found")

  def rule = normalizeRule(payload, ruleId, existing.createdAt)
  validateRuleOrThrow(rule)

  rules[rule.id] = rule
  state.rules = rules
  cancelExecutionsForRule(rule.id)
  rebuildSubscriptions()
  return rule
}

private Map setRuleEnabledInternal(String ruleId, Boolean enabled) {
  def rules = getRulesMap()
  def rule = rules[ruleId]
  if (!rule) throw new IllegalArgumentException("Rule not found")

  rule.enabled = enabled
  rule.updatedAt = isoNow()
  rules[rule.id] = rule
  state.rules = rules

  if (!enabled) cancelExecutionsForRule(ruleId)
  rebuildSubscriptions()
  return rule
}

private void deleteRuleInternal(String ruleId) {
  def rules = getRulesMap()
  if (!rules[ruleId]) throw new IllegalArgumentException("Rule not found")

  rules.remove(ruleId)
  state.rules = rules
  cancelExecutionsForRule(ruleId)
  rebuildSubscriptions()
}

private String buildRuleSummary(rule) {
  def enabledLabel = rule?.enabled == false ? "Pausada" : "Ativa"
  def triggerText = (rule.triggers ?: [])
    .collect { formatTrigger(it) }
    .findAll { it }
    .join(" | ")
  def actionText = (rule.actions ?: [])
    .collect { formatAction(it) }
    .findAll { it }
    .join(" | ")

  def parts = ["Status: ${enabledLabel}"]
  if (triggerText) parts.add("Gatilhos: ${triggerText}")
  if (actionText) parts.add("Acoes: ${actionText}")
  return parts.join("\n")
}

private String escapeHtml(String raw) {
  return (raw ?: "").toString()
    .replace("&", "&amp;")
    .replace("<", "&lt;")
    .replace(">", "&gt;")
}

private Boolean isCommandAllowed(device, String command) {
  return allowedCommandsForDevice(device).contains(command)
}

private void cancelExecutionsForRule(String ruleId) {
  state.executions = getExecutionsMap().findAll { executionId, execution ->
    "${execution.ruleId}" != "${ruleId}"
  }
}

private Map getRulesMap() {
  return state.rules instanceof Map ? state.rules : [:]
}

private Map getExecutionsMap() {
  return state.executions instanceof Map ? state.executions : [:]
}

private def endpoint(Closure work) {
  try {
    return work.call()
  } catch (IllegalArgumentException e) {
    log.warn "Bad request: ${e.message}"
    return renderError(400, e.message)
  } catch (Exception e) {
    log.warn "Endpoint failed: ${e.message}"
    return renderError(500, e.message ?: "Internal error")
  }
}

private def readJsonBody() {
  try {
    if (request.JSON) return request.JSON
  } catch (ignored) {}

  try {
    def body = request?.body ?: "{}"
    return new JsonSlurper().parseText("${body}")
  } catch (ignored) {
    throw new IllegalArgumentException("Invalid JSON")
  }
}

private void rejectOversizedPayload(payload) {
  def size = JsonOutput.toJson(payload ?: [:]).size()
  if (size > 20000) throw new IllegalArgumentException("Rule payload too large")
}

private String ruleIdParam() {
  return "${params.ruleId ?: ""}".trim()
}

private String eventDeviceId(evt) {
  return "${evt?.deviceId ?: evt?.device?.id ?: ""}".trim()
}

private String sanitizeId(value) {
  return "${value ?: ""}".trim().replaceAll(/[^A-Za-z0-9_.:-]/, "_").take(80)
}

private String sanitizeOptionalId(value) {
  def id = sanitizeId(value)
  return id ?: null
}

private Integer safeInt(value, Integer fallback = 0) {
  if (value == null) return fallback
  try {
    def parsed = value as Integer
    return parsed == null ? fallback : parsed
  } catch (ignored) {
    return fallback
  }
}

private Long safeLong(value, Long fallback = 0L) {
  if (value == null) return fallback
  try {
    def parsed = value as Long
    return parsed == null ? fallback : parsed
  } catch (ignored) {
    return fallback
  }
}

private BigDecimal safeDecimal(value) {
  try {
    return new BigDecimal("${value}")
  } catch (ignored) {
    return null
  }
}

private String isoNow() {
  return new Date().format("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", location.timeZone)
}

private def renderJson(payload, Integer statusCode = 200) {
  render status: statusCode, contentType: "application/json", data: JsonOutput.toJson(payload)
}

private def renderError(Integer statusCode, String message) {
  renderJson([ok: false, error: message], statusCode)
}

private void logInfo(String message) {
  if (settings?.enableInfoLogging != false) log.info message
}

private void logDebug(String message) {
  if (settings?.enableDebugLogging == true) log.debug message
}
