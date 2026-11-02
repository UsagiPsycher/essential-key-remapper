package com.ekremapper.companion

import android.accessibilityservice.AccessibilityService
import android.app.KeyguardManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.VibratorManager
import android.provider.MediaStore
import android.util.Log
import android.view.KeyEvent

/** Runs the action ids sent by the desktop app. "app:<package>" opens an app. */
class Actions(private val service: AccessibilityService) {
    companion object {
        const val NONE = "none"
        const val APP_PREFIX = "app:"
    }

    private val camera = service.getSystemService(CameraManager::class.java)
    private val audio = service.getSystemService(AudioManager::class.java)
    private val notifications = service.getSystemService(NotificationManager::class.java)
    private val keyguard = service.getSystemService(KeyguardManager::class.java)

    private val torchId: String? = camera.cameraIdList.firstOrNull {
        camera.getCameraCharacteristics(it).get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
    }
    private var torchOn = false
    private val torchCallback = object : CameraManager.TorchCallback() {
        override fun onTorchModeChanged(cameraId: String, enabled: Boolean) {
            if (cameraId == torchId) torchOn = enabled
        }
    }

    init {
        camera.registerTorchCallback(torchCallback, Handler(Looper.getMainLooper()))
    }

    fun release() = camera.unregisterTorchCallback(torchCallback)

    /** Returns false when the action could not run. */
    fun run(id: String): Boolean = try {
        when {
            id == NONE -> true
            id.startsWith(APP_PREFIX) -> openApp(id.removePrefix(APP_PREFIX))
            else -> when (id) {
                "torch" -> torchId?.let { camera.setTorchMode(it, !torchOn); true } ?: false
                "camera" -> openCamera()
                "screenshot" -> global(AccessibilityService.GLOBAL_ACTION_TAKE_SCREENSHOT)
                "lock" -> global(AccessibilityService.GLOBAL_ACTION_LOCK_SCREEN)
                "notifications" -> global(AccessibilityService.GLOBAL_ACTION_NOTIFICATIONS)
                "quick_settings" -> global(AccessibilityService.GLOBAL_ACTION_QUICK_SETTINGS)
                "recents" -> global(AccessibilityService.GLOBAL_ACTION_RECENTS)
                "power_menu" -> global(AccessibilityService.GLOBAL_ACTION_POWER_DIALOG)
                "assistant" -> openAssistant()
                "play_pause" -> media(KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE)
                "next_track" -> media(KeyEvent.KEYCODE_MEDIA_NEXT)
                "vibrate_mode" -> toggleVibrate()
                "dnd" -> toggleDnd()
                else -> false
            }
        }
    } catch (e: Exception) {
        Log.w(KeyService.TAG, "action $id failed", e)
        false
    }

    fun tick(context: Context) {
        val vm = context.getSystemService(VibratorManager::class.java) ?: return
        vm.defaultVibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK))
    }

    private fun global(action: Int) = service.performGlobalAction(action)

    private fun start(intent: Intent): Boolean {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (intent.resolveActivity(service.packageManager) == null) return false
        service.startActivity(intent)
        return true
    }

    private fun openApp(pkg: String): Boolean {
        val intent = service.packageManager.getLaunchIntentForPackage(pkg) ?: return false
        return start(intent)
    }

    private fun openCamera(): Boolean {
        val action = if (keyguard.isKeyguardLocked) MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA_SECURE
        else MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA
        return start(Intent(action))
    }

    private fun openAssistant(): Boolean =
        start(Intent(Intent.ACTION_VOICE_COMMAND)) || start(Intent(Intent.ACTION_ASSIST))

    private fun media(code: Int): Boolean {
        val now = SystemClock.uptimeMillis()
        audio.dispatchMediaKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_DOWN, code, 0))
        audio.dispatchMediaKeyEvent(KeyEvent(now, now, KeyEvent.ACTION_UP, code, 0))
        return true
    }

    private fun toggleVibrate(): Boolean {
        audio.ringerMode = if (audio.ringerMode == AudioManager.RINGER_MODE_VIBRATE)
            AudioManager.RINGER_MODE_NORMAL else AudioManager.RINGER_MODE_VIBRATE
        return true
    }

    private fun toggleDnd(): Boolean {
        if (!notifications.isNotificationPolicyAccessGranted) return false
        val on = notifications.currentInterruptionFilter != NotificationManager.INTERRUPTION_FILTER_ALL
        notifications.setInterruptionFilter(
            if (on) NotificationManager.INTERRUPTION_FILTER_ALL else NotificationManager.INTERRUPTION_FILTER_PRIORITY
        )
        return true
    }
}
