package com.ekremapper.companion

import android.accessibilityservice.AccessibilityService
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent

/**
 * Catches the Essential key and turns presses into gestures.
 * Every event is logged under [TAG] so the desktop app can follow it live through logcat.
 */
class KeyService : AccessibilityService() {
    companion object {
        const val TAG = "EKR"
        private const val HOLD_MS = 450L
        private const val DOUBLE_MS = 300L

        @Volatile var instance: KeyService? = null
            private set
        @Volatile var learning = false

        /** Keys that must never be learned by mistake. */
        private val RESERVED = setOf(
            KeyEvent.KEYCODE_VOLUME_UP, KeyEvent.KEYCODE_VOLUME_DOWN, KeyEvent.KEYCODE_POWER,
            KeyEvent.KEYCODE_BACK, KeyEvent.KEYCODE_HOME, KeyEvent.KEYCODE_APP_SWITCH,
        )
    }

    private val handler = Handler(Looper.getMainLooper())
    private lateinit var store: Store
    private lateinit var actions: Actions

    private var holdFired = false
    private var taps = 0

    private val holdRunnable = Runnable {
        holdFired = true
        taps = 0
        fire("hold", store.hold)
    }
    private val singleRunnable = Runnable {
        taps = 0
        fire("single", store.single)
    }

    override fun onServiceConnected() {
        store = Store(this)
        actions = Actions(this)
        instance = this
        Log.i(TAG, "service connected")
    }

    override fun onDestroy() {
        instance = null
        handler.removeCallbacksAndMessages(null)
        if (::actions.isInitialized) actions.release()
        super.onDestroy()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit
    override fun onInterrupt() = Unit

    override fun onKeyEvent(event: KeyEvent): Boolean {
        if (!isEssentialKey(event)) return false
        when (event.action) {
            KeyEvent.ACTION_DOWN -> if (event.repeatCount == 0) {
                Log.i(TAG, "key down")
                holdFired = false
                if (store.hold != Actions.NONE) handler.postDelayed(holdRunnable, HOLD_MS)
            }
            KeyEvent.ACTION_UP -> {
                Log.i(TAG, "key up")
                handler.removeCallbacks(holdRunnable)
                if (!holdFired) onTap()
            }
        }
        return true
    }

    private fun isEssentialKey(e: KeyEvent): Boolean {
        if (learning && e.action == KeyEvent.ACTION_DOWN && e.keyCode !in RESERVED) {
            store.scanCode = e.scanCode
            store.keyCode = e.keyCode
            learning = false
            Log.i(TAG, "key learned ${e.keyCode} ${e.scanCode}")
            return true
        }
        val scan = store.scanCode
        if (scan >= 0) return e.scanCode == scan && e.keyCode == store.keyCode
        // Not learned yet: the Essential key reports an unknown key code.
        if (e.keyCode == KeyEvent.KEYCODE_UNKNOWN && e.scanCode > 0) {
            store.scanCode = e.scanCode
            store.keyCode = e.keyCode
            Log.i(TAG, "key learned ${e.keyCode} ${e.scanCode}")
            return true
        }
        return false
    }

    private fun onTap() {
        if (store.double == Actions.NONE) {
            fire("single", store.single)
            return
        }
        taps++
        if (taps >= 2) {
            handler.removeCallbacks(singleRunnable)
            taps = 0
            fire("double", store.double)
        } else {
            handler.postDelayed(singleRunnable, DOUBLE_MS)
        }
    }

    private fun fire(gesture: String, action: String) {
        val ok = actions.run(action)
        if (ok && action != Actions.NONE && store.haptics) actions.tick(this)
        Log.i(TAG, "gesture $gesture $action ${if (ok) "ok" else "failed"}")
    }
}
