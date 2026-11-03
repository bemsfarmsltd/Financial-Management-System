package com.bemsgroup.bems_gmd_ai

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.util.Locale
import java.util.UUID

class MainActivity : FlutterFragmentActivity(), TextToSpeech.OnInitListener {
    private val CHANNEL = "com.bemsgroup.bems_gmd_ai/tts"
    private var tts: TextToSpeech? = null
    private var isTtsReady = false
    private var pendingSpeech: PendingSpeech? = null
    private var methodChannel: MethodChannel? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    private data class PendingSpeech(
        val text: String,
        val rate: Float,
        val pitch: Float,
        val persona: String
    )

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        if (tts == null) {
            tts = TextToSpeech(applicationContext, this)
        }

        methodChannel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
        methodChannel?.setMethodCallHandler { call, result ->
            when (call.method) {
                "speak" -> {
                    val text = call.argument<String>("text") ?: ""
                    val rate = (call.argument<Double>("rate") ?: 0.94).toFloat()
                    val pitch = (call.argument<Double>("pitch") ?: 1.05).toFloat()
                    val persona = call.argument<String>("persona") ?: "Arya"

                    if (text.isBlank()) {
                        result.success(false)
                        return@setMethodCallHandler
                    }

                    if (!isTtsReady || tts == null) {
                        pendingSpeech = PendingSpeech(text, rate, pitch, persona)
                        if (tts == null) {
                            tts = TextToSpeech(applicationContext, this)
                        }
                        result.success(true)
                    } else {
                        speakInternal(text, rate, pitch, persona)
                        result.success(true)
                    }
                }
                "stop" -> {
                    pendingSpeech = null
                    tts?.stop()
                    notifySpeakingState(false)
                    result.success(true)
                }
                "isSpeaking" -> {
                    result.success(tts?.isSpeaking ?: false)
                }
                else -> result.notImplemented()
            }
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            isTtsReady = true
            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {
                    notifySpeakingState(true)
                }

                override fun onDone(utteranceId: String?) {
                    notifySpeakingState(false)
                }

                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String?) {
                    notifySpeakingState(false)
                }

                override fun onError(utteranceId: String?, errorCode: Int) {
                    notifySpeakingState(false)
                }
            })

            pendingSpeech?.let { pending ->
                pendingSpeech = null
                speakInternal(pending.text, pending.rate, pending.pitch, pending.persona)
            }
        } else {
            isTtsReady = false
        }
    }

    private fun selectExecutiveVoice(persona: String) {
        val engine = tts ?: return
        try {
            val voices: Set<Voice>? = engine.voices
            if (!voices.isNullOrEmpty()) {
                val wantMale = persona.lowercase().contains("atlas")
                val englishVoices = voices.filter { v ->
                    v.locale.language.equals("en", ignoreCase = true) && !v.isNetworkConnectionRequired
                }.ifEmpty {
                    voices.filter { v -> v.locale.language.equals("en", ignoreCase = true) }
                }

                val preferred = englishVoices.firstOrNull { v ->
                    val n = v.name.lowercase()
                    if (wantMale) {
                        n.contains("male") || n.contains("iom") || n.contains("rjs") || n.contains("gbd")
                    } else {
                        n.contains("female") || n.contains("sfg") || n.contains("gba") || n.contains("gbc") || n.contains("tpf") || n.contains("iob")
                    }
                } ?: englishVoices.firstOrNull { v ->
                    v.locale.country.equals("GB", ignoreCase = true) || v.locale.country.equals("NG", ignoreCase = true) || v.locale.country.equals("US", ignoreCase = true)
                }

                if (preferred != null) {
                    engine.voice = preferred
                    return
                }
            }
        } catch (_: Exception) {
        }

        val res = engine.setLanguage(Locale.UK)
        if (res == TextToSpeech.LANG_MISSING_DATA || res == TextToSpeech.LANG_NOT_SUPPORTED) {
            engine.setLanguage(Locale.US)
        }
    }

    private fun speakInternal(text: String, rate: Float, pitch: Float, persona: String) {
        val engine = tts ?: return
        engine.stop()
        selectExecutiveVoice(persona)
        engine.setSpeechRate(rate.coerceIn(0.5f, 1.6f))
        engine.setPitch(pitch.coerceIn(0.6f, 1.5f))

        val params = Bundle()
        params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f)
        val utteranceId = "bemi_${UUID.randomUUID()}"
        notifySpeakingState(true)
        engine.speak(text, TextToSpeech.QUEUE_FLUSH, params, utteranceId)
    }

    private fun notifySpeakingState(speaking: Boolean) {
        mainHandler.post {
            try {
                methodChannel?.invokeMethod("onSpeakingStateChanged", mapOf("isSpeaking" to speaking))
            } catch (_: Exception) {
            }
        }
    }

    override fun onDestroy() {
        tts?.stop()
        tts?.shutdown()
        tts = null
        super.onDestroy()
    }
}
