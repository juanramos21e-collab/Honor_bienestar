package app.honor.bienestar

import android.Manifest
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.media.AudioManager
import android.media.ToneGenerator
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Base64
import androidx.activity.result.ActivityResult
import com.getcapacitor.*
import com.getcapacitor.annotation.*
import java.util.Locale
import java.util.UUID

@CapacitorPlugin(name = "DeviceTools", permissions = [Permission(alias = "microphone", strings = [Manifest.permission.RECORD_AUDIO])])
class DeviceToolsPlugin : Plugin() {
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var ttsFailed = false
    private var speechCall: PluginCall? = null
    private var speechId: String? = null
    private var recognizer: SpeechRecognizer? = null
    private var listenCall: PluginCall? = null
    private var permissionCall: PluginCall? = null
    private var cueCall: PluginCall? = null
    private var tone: ToneGenerator? = null
    private val cueHandler = Handler(Looper.getMainLooper())
    override fun load() {
        activity.runOnUiThread {
            tts = TextToSpeech(context) { result ->
                ttsReady = result == TextToSpeech.SUCCESS
                ttsFailed = !ttsReady
                val pending = speechCall
                if (pending != null) { if (ttsReady) startSpeech(pending) else { speechCall = null; pending.reject("No hay una voz disponible en este dispositivo.") } }
            }
            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(id: String?) {}
                override fun onDone(id: String?) { activity.runOnUiThread { if (id == speechId) { speechId = null; val call = speechCall; speechCall = null; call?.resolve() } } }
                @Deprecated("Android callback") override fun onError(id: String?) { activity.runOnUiThread { if (id == speechId) { speechId = null; val call = speechCall; speechCall = null; call?.reject("No se pudo leer la pregunta. Revisa las voces de Android.") } } }
            })
        }
    }
    @PluginMethod fun speak(call: PluginCall) { activity.runOnUiThread { stopSpeech(); if (ttsFailed) call.reject("No hay una voz disponible en este dispositivo.") else { speechCall = call; if (ttsReady) startSpeech(call) } } }
    private fun startSpeech(call: PluginCall) {
        val text = call.getString("text") ?: ""
        if (text.isBlank() || text.length > 4000) { speechCall = null; call.reject("Texto de lectura inválido."); return }
        val lang = tts?.setLanguage(Locale.forLanguageTag("es-PE"))
        if (lang == TextToSpeech.LANG_MISSING_DATA || lang == TextToSpeech.LANG_NOT_SUPPORTED) { speechCall = null; call.reject("Instala una voz en español en los ajustes de voz de Android."); return }
        speechId = UUID.randomUUID().toString()
        if (tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, speechId) == TextToSpeech.ERROR) { speechCall = null; call.reject("No se pudo iniciar la lectura.") }
    }
    @PluginMethod fun listen(call: PluginCall) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) { permissionCall = call; requestPermissionForAlias("microphone", call, "microphoneResult") }
        else activity.runOnUiThread { startListening(call) }
    }
    @PluginMethod fun requestMicrophone(call: PluginCall) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) call.resolve(JSObject().put("granted", true))
        else requestPermissionForAlias("microphone", call, "microphoneAccessResult")
    }
    @PermissionCallback private fun microphoneAccessResult(call: PluginCall?) { call?.resolve(JSObject().put("granted", getPermissionState("microphone") == PermissionState.GRANTED)) }
    @PluginMethod fun cue(call: PluginCall) { activity.runOnUiThread {
        stopCue(); cueCall = call
        try {
            tone = ToneGenerator(AudioManager.STREAM_MUSIC, 25); tone?.startTone(ToneGenerator.TONE_PROP_BEEP, 140)
            cueHandler.postDelayed({ if (cueCall === call) { cueCall = null; tone?.release(); tone = null; call.resolve() } }, 180)
        } catch (_: Exception) { cueCall = null; tone?.release(); tone = null; call.resolve() }
    } }
    private fun stopCue() { cueHandler.removeCallbacksAndMessages(null); tone?.release(); tone = null; val pending = cueCall; cueCall = null; pending?.reject("Señal cancelada.", "CANCELLED") }
    @PermissionCallback private fun microphoneResult(call: PluginCall?) {
        if (call == null || permissionCall !== call) return
        permissionCall = null
        if (getPermissionState("microphone") == PermissionState.GRANTED) activity.runOnUiThread { startListening(call) }
        else call.reject("Permite el micrófono en los ajustes de Android para responder por voz.", "MICROPHONE_DENIED")
    }
    private fun startListening(call: PluginCall) {
        stopListening()
        if (!SpeechRecognizer.isRecognitionAvailable(context)) { call.reject("No hay reconocimiento de voz disponible. Instala o habilita el servicio de voz de Android."); return }
        listenCall = call
        val speech = SpeechRecognizer.createSpeechRecognizer(context); recognizer = speech
        speech.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(value: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onEvent(type: Int, params: Bundle?) {}
            override fun onPartialResults(results: Bundle?) {}
            override fun onError(error: Int) {
                if (listenCall !== call) return
                listenCall = null; recognizer?.destroy(); recognizer = null
                call.reject(when (error) {
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Permite el micrófono para responder por voz."
                    SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No escuché una respuesta. Pulsa continuar para reintentar."
                    else -> "No se pudo reconocer la respuesta. Comprueba el servicio de voz y la conexión."
                })
            }
            override fun onResults(results: Bundle?) {
                if (listenCall !== call) return
                val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()
                listenCall = null; recognizer?.destroy(); recognizer = null
                if (text.isBlank()) call.reject("No escuché una respuesta. Puedes continuar o escribirla.")
                else call.resolve(JSObject().put("transcript", text))
            }
        })
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "es-PE").putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        try { speech.startListening(intent) } catch (_: Exception) { stopListening(); call.reject("No se pudo abrir el micrófono.") }
    }
    private fun stopSpeech() { speechId = null; val pending = speechCall; speechCall = null; tts?.stop(); pending?.reject("Lectura cancelada.", "CANCELLED") }
    private fun stopListening() { val permission = permissionCall; permissionCall = null; permission?.reject("Permiso de escucha cancelado.", "CANCELLED"); val pending = listenCall; listenCall = null; recognizer?.cancel(); recognizer?.destroy(); recognizer = null; pending?.reject("Escucha cancelada.", "CANCELLED") }
    @PluginMethod fun stop(call: PluginCall) { activity.runOnUiThread { stopSpeech(); stopCue(); stopListening(); call.resolve() } }
    @PluginMethod fun saveFile(call: PluginCall) {
        val filename = call.getString("filename") ?: "honor-respaldo.json"
        val mime = call.getString("mime") ?: "application/json"
        val content = call.getString("base64") ?: ""
        if (content.length > 20 * 1024 * 1024) { call.reject("El archivo supera el tamaño permitido."); return }
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime).putExtra(Intent.EXTRA_TITLE, filename)
        startActivityForResult(call, intent, "fileResult")
    }
    @ActivityCallback private fun fileResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val uri = result.data?.data
        if (result.resultCode != android.app.Activity.RESULT_OK || uri == null) { call.reject("Guardado cancelado.", "CANCELLED"); return }
        try {
            val bytes = Base64.decode(call.getString("base64") ?: "", Base64.DEFAULT)
            context.contentResolver.openOutputStream(uri)?.use { it.write(bytes) } ?: throw IllegalStateException()
            call.resolve()
        } catch (_: Exception) { call.reject("No se pudo guardar el archivo en la ubicación elegida.") }
    }
    override fun handleOnPause() { activity.runOnUiThread { stopSpeech(); stopCue(); stopListening() }; super.handleOnPause() }
    override fun handleOnDestroy() { stopSpeech(); stopCue(); stopListening(); tts?.shutdown(); super.handleOnDestroy() }
}
