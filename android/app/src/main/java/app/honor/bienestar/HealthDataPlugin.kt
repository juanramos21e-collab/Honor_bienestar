package app.honor.bienestar

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.activity.result.ActivityResult
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.aggregate.AggregateMetric
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import androidx.health.connect.client.records.metadata.DataOrigin
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import kotlinx.coroutines.*
import java.time.Instant
import java.time.LocalDate
import java.time.Period
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import kotlin.reflect.KClass

@CapacitorPlugin(name = "HealthData")
class HealthDataPlugin : Plugin() {
    private val jobs = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val types = listOf(StepsRecord::class, DistanceRecord::class, ActiveCaloriesBurnedRecord::class,
        ExerciseSessionRecord::class, HeartRateRecord::class, RestingHeartRateRecord::class,
        OxygenSaturationRecord::class, SleepSessionRecord::class, WeightRecord::class)
    private val healthApps = linkedMapOf("com.hihonor.health" to "Salud de HONOR", "com.xiaomi.wearable" to "Mi Fitness",
        "com.xiaomi.hm.health" to "Zepp Life", "com.sec.android.app.shealth" to "Samsung Health", "com.huawei.health" to "Salud de Huawei")
    private val readPermissions get() = types.map { HealthPermission.getReadPermission(it) }.toSet()
    private fun client() = HealthConnectClient.getOrCreate(context)
    private fun launch(call: PluginCall, body: suspend () -> Unit) {
        jobs.launch {
            try { body() }
            catch (_: CancellationException) { call.reject("La consulta se canceló.", "CANCELLED") }
            catch (_: SecurityException) { call.reject("Health Connect denegó el acceso. Revisa los permisos de lectura y vuelve a conectar.", "PERMISSION_DENIED") }
            catch (e: IllegalArgumentException) { call.reject(e.message ?: "La consulta no es válida.", "INVALID_QUERY") }
            catch (_: Exception) { call.reject("No se pudo consultar Health Connect. Comprueba su disponibilidad y vuelve a intentarlo.", "HEALTH_UNAVAILABLE") }
        }
    }
    private fun installed(id: String): Boolean = try { context.packageManager.getApplicationInfo(id, 0); true } catch (_: PackageManager.NameNotFoundException) { false }
    private fun label(id: String): String = healthApps[id] ?: try { context.packageManager.getApplicationLabel(context.packageManager.getApplicationInfo(id, 0)).toString() } catch (_: Exception) { id }
    private suspend fun statusValue(): JSObject {
        val sdk = HealthConnectClient.getSdkStatus(context)
        val state = when (sdk) {
            HealthConnectClient.SDK_AVAILABLE -> "available"
            HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "install_required"
            else -> "unsupported"
        }
        val apps = JSArray()
        healthApps.forEach { (id, name) -> apps.put(JSObject().put("id", id).put("label", name).put("installed", installed(id))) }
        val granted = if (sdk == HealthConnectClient.SDK_AVAILABLE) client().permissionController.getGrantedPermissions().intersect(readPermissions) else emptySet()
        return JSObject().put("availability", state).put("apps", apps).put("granted", JSArray(granted.toList()))
            .put("device", JSObject().put("manufacturer", Build.MANUFACTURER).put("model", Build.MODEL).put("androidVersion", Build.VERSION.RELEASE))
    }
    @PluginMethod fun status(call: PluginCall) = launch(call) { call.resolve(statusValue()) }
    @PluginMethod fun requestAccess(call: PluginCall) {
        if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) { call.reject("Instala o actualiza Health Connect primero.", "PROVIDER_REQUIRED"); return }
        val intent = PermissionController.createRequestPermissionResultContract().createIntent(context, readPermissions)
        startActivityForResult(call, intent, "accessResult")
    }
    @ActivityCallback private fun accessResult(call: PluginCall?, result: ActivityResult) { if (call != null) launch(call) { call.resolve(statusValue()) } }
    @PluginMethod fun openSetup(call: PluginCall) {
        val target = call.getString("target") ?: "permissions"
        activity.runOnUiThread {
            try {
                val intent = when (target) {
                    "honor" -> context.packageManager.getLaunchIntentForPackage("com.hihonor.health") ?: Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=com.hihonor.health"))
                    "provider" -> Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=com.google.android.apps.healthdata"))
                    else -> Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS)
                }
                activity.startActivity(intent); call.resolve()
            } catch (_: Exception) {
                if (target == "permissions") call.reject("No se pudieron abrir los permisos. Busca Health Connect en Ajustes de Android.")
                else try { activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=" + if (target == "honor") "com.hihonor.health" else "com.google.android.apps.healthdata"))); call.resolve() }
                catch (_: Exception) { call.reject("No se pudo abrir la tienda de aplicaciones.") }
            }
        }
    }
    private data class Range(val from: LocalDate, val to: LocalDate) {
        val zone: ZoneId = ZoneId.systemDefault()
        val raw: TimeRangeFilter get() = TimeRangeFilter.between(from.atStartOfDay(zone).toInstant(), to.plusDays(1).atStartOfDay(zone).toInstant())
        val local: TimeRangeFilter get() = TimeRangeFilter.between(from.atStartOfDay(), to.plusDays(1).atStartOfDay())
    }
    private fun range(call: PluginCall): Range {
        val from = LocalDate.parse(call.getString("from"))
        val to = LocalDate.parse(call.getString("to"))
        require(!from.isAfter(to) && ChronoUnit.DAYS.between(from, to) < 30) { "Consulta un rango de hasta 30 días." }
        return Range(from, to)
    }
    private suspend fun <T : Record> records(type: KClass<T>, range: Range, origins: Set<DataOrigin> = emptySet()): List<T> {
        if (HealthPermission.getReadPermission(type) !in client().permissionController.getGrantedPermissions()) return emptyList()
        val values = mutableListOf<T>(); var token: String? = null
        do {
            val response = client().readRecords(ReadRecordsRequest(recordType = type, timeRangeFilter = range.raw, dataOriginFilter = origins, pageSize = 1000, pageToken = token))
            values.addAll(response.records); token = response.pageToken
            require(values.size <= 100000) { "Hay demasiadas mediciones. Consulta menos días por actualización." }
        } while (token != null)
        return values
    }
    @PluginMethod fun sources(call: PluginCall) = launch(call) {
        val range = range(call); val ids = mutableSetOf<String>()
        for (type in types) records(type, range).forEach { ids.add(it.metadata.dataOrigin.packageName) }
        val values = JSArray(); ids.sorted().forEach { values.put(JSObject().put("id", it).put("label", label(it))) }
        call.resolve(JSObject().put("sources", values))
    }
    @PluginMethod fun read(call: PluginCall) = launch(call) {
        val range = range(call)
        val origin = call.getString("origin") ?: ""
        require(origin.matches(Regex("[A-Za-z0-9_]+(\\.[A-Za-z0-9_]+)+"))) { "Elige una aplicación de origen válida." }
        val origins = setOf(DataOrigin(origin))
        val granted = client().permissionController.getGrantedPermissions()
        fun can(type: KClass<out Record>) = HealthPermission.getReadPermission(type) in granted
        val metrics = mutableSetOf<AggregateMetric<*>>()
        if (can(StepsRecord::class)) metrics.add(StepsRecord.COUNT_TOTAL)
        if (can(DistanceRecord::class)) metrics.add(DistanceRecord.DISTANCE_TOTAL)
        if (can(ActiveCaloriesBurnedRecord::class)) metrics.add(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL)
        if (can(ExerciseSessionRecord::class)) metrics.add(ExerciseSessionRecord.EXERCISE_DURATION_TOTAL)
        if (can(HeartRateRecord::class)) metrics.add(HeartRateRecord.BPM_AVG)
        if (can(RestingHeartRateRecord::class)) metrics.add(RestingHeartRateRecord.BPM_AVG)
        val days = sortedMapOf<String, JSObject>()
        fun day(date: String): JSObject = days.getOrPut(date) { JSObject().put("date", date).put("health", JSObject()) }
        fun health(date: String): JSObject = day(date).get("health") as JSObject
        if (metrics.isNotEmpty()) {
            val groups = client().aggregateGroupByPeriod(AggregateGroupByPeriodRequest(metrics, range.local, Period.ofDays(1), origins))
            for (group in groups) {
                val date = group.startTime.toLocalDate().toString(); val result = group.result
                result[StepsRecord.COUNT_TOTAL]?.let { health(date).put("steps", it) }
                result[DistanceRecord.DISTANCE_TOTAL]?.let { health(date).put("distanceKm", it.inKilometers) }
                result[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.let { health(date).put("activeCalories", it.inKilocalories) }
                result[ExerciseSessionRecord.EXERCISE_DURATION_TOTAL]?.let { health(date).put("exerciseMinutes", it.seconds / 60.0) }
                result[HeartRateRecord.BPM_AVG]?.let { health(date).put("heartRate", it) }
                result[RestingHeartRateRecord.BPM_AVG]?.let { health(date).put("restingHeartRate", it) }
            }
        }
        fun date(time: Instant) = time.atZone(range.zone).toLocalDate().toString()
        records(OxygenSaturationRecord::class, range, origins).groupBy { date(it.time) }.forEach { (date, list) -> health(date).put("spo2", list.map { it.percentage.value }.average()) }
        records(WeightRecord::class, range, origins).groupBy { date(it.time) }.forEach { (date, list) -> day(date).put("weight", list.maxBy { it.time }.weight.inKilograms) }
        val warnings = mutableSetOf<String>()
        val sessions = records(SleepSessionRecord::class, range, origins).filter { !it.endTime.atZone(range.zone).toLocalDate().isBefore(range.from) && !it.endTime.atZone(range.zone).toLocalDate().isAfter(range.to) }
        sessions.groupBy { date(it.endTime) }.forEach { (date, list) ->
            val stages = list.flatMap { it.stages }
            val asleep = stages.filter { it.stage in setOf(SleepSessionRecord.STAGE_TYPE_SLEEPING, SleepSessionRecord.STAGE_TYPE_LIGHT, SleepSessionRecord.STAGE_TYPE_DEEP, SleepSessionRecord.STAGE_TYPE_REM) }.map { SleepMath.Interval(it.startTime, it.endTime) }
            val intervals = if (asleep.isNotEmpty()) asleep else list.map { SleepMath.Interval(it.startTime, it.endTime) }
            val total = SleepMath.hours(intervals)
            if (asleep.isEmpty()) warnings.add("El sueño sin fases usa la duración de la sesión registrada. El día corresponde a la fecha de despertar.")
            health(date).put("sleepHours", total)
            val phaseKeys = mapOf(SleepSessionRecord.STAGE_TYPE_DEEP to "deepSleepHours", SleepSessionRecord.STAGE_TYPE_LIGHT to "lightSleepHours", SleepSessionRecord.STAGE_TYPE_REM to "remSleepHours")
            val phases = phaseKeys.mapValues { (type, _) -> SleepMath.hours(stages.filter { it.stage == type }.map { SleepMath.Interval(it.startTime, it.endTime) }) }
            if (phases.values.sum() <= total + .05) phaseKeys.forEach { (type, key) -> if (stages.any { it.stage == type }) health(date).put(key, phases[type]) }
            else warnings.add("Se omitieron fases de sueño superpuestas para conservar una duración coherente.")
        }
        val values = JSArray(); days.values.filter { it.getJSObject("health")!!.length() > 0 || it.has("weight") }.forEach { values.put(it) }
        warnings.add("Solo se incluyen los datos que comparte el origen elegido. El estrés numérico del reloj no se importa mediante esta integración.")
        call.resolve(JSObject().put("entries", values).put("readAt", Instant.now().toString()).put("from", range.from.toString()).put("to", range.to.toString()).put("origin", origin).put("warnings", JSArray(warnings.toList())))
    }
    @PluginMethod fun googleSignIn(call: PluginCall) = launch(call) {
        val clientId = call.getString("clientId") ?: ""
        require(clientId.endsWith(".apps.googleusercontent.com")) { "Falta configurar el acceso Google de la versión Android." }
        try {
            val option = GetGoogleIdOption.Builder().setFilterByAuthorizedAccounts(false).setServerClientId(clientId).setAutoSelectEnabled(false).build()
            val response = CredentialManager.create(context).getCredential(activity, GetCredentialRequest.Builder().addCredentialOption(option).build())
            val credential = response.credential
            require(credential is CustomCredential && credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) { "Google no devolvió una cuenta válida." }
            call.resolve(JSObject().put("idToken", GoogleIdTokenCredential.createFrom(credential.data).idToken))
        } catch (_: GetCredentialCancellationException) { call.reject("Acceso Google cancelado.", "CANCELLED") }
        catch (_: Exception) { call.reject("No se pudo conectar Google. Comprueba el registro Android y su certificado en Firebase, o continúa en este dispositivo.", "GOOGLE_SIGN_IN_FAILED") }
    }
    override fun handleOnDestroy() { jobs.cancel(); super.handleOnDestroy() }
}
