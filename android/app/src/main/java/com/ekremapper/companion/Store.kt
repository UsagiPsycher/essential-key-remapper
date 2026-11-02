package com.ekremapper.companion

import android.content.Context
import android.view.KeyEvent
import org.json.JSONObject

/** Mapping and learned key, persisted in SharedPreferences. */
class Store(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("ekr", Context.MODE_PRIVATE)

    var single: String
        get() = prefs.getString("single", Actions.NONE)!!
        set(v) = prefs.edit().putString("single", v).apply()
    var double: String
        get() = prefs.getString("double", Actions.NONE)!!
        set(v) = prefs.edit().putString("double", v).apply()
    var hold: String
        get() = prefs.getString("hold", Actions.NONE)!!
        set(v) = prefs.edit().putString("hold", v).apply()
    var haptics: Boolean
        get() = prefs.getBoolean("haptics", true)
        set(v) = prefs.edit().putBoolean("haptics", v).apply()

    /** -1 until the key has been learned. */
    var scanCode: Int
        get() = prefs.getInt("scanCode", -1)
        set(v) = prefs.edit().putInt("scanCode", v).apply()
    var keyCode: Int
        get() = prefs.getInt("keyCode", KeyEvent.KEYCODE_UNKNOWN)
        set(v) = prefs.edit().putInt("keyCode", v).apply()

    fun configJson(): JSONObject = JSONObject()
        .put("single", single)
        .put("double", double)
        .put("hold", hold)
        .put("haptics", haptics)

    fun applyConfig(json: JSONObject) {
        if (json.has("single")) single = json.getString("single")
        if (json.has("double")) double = json.getString("double")
        if (json.has("hold")) hold = json.getString("hold")
        if (json.has("haptics")) haptics = json.getBoolean("haptics")
    }

    fun forgetKey() {
        prefs.edit().remove("scanCode").remove("keyCode").apply()
    }
}
