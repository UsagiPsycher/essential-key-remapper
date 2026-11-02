package com.ekremapper.companion

import android.content.ContentProvider
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.database.Cursor
import android.graphics.Bitmap
import android.graphics.Canvas
import android.net.Uri
import android.os.Binder
import android.os.Bundle
import android.os.ParcelFileDescriptor
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import kotlin.concurrent.thread

/**
 * Bridge with the desktop app, reachable only from `adb shell`:
 *  - `content read --uri content://com.ekremapper.companion.control/state` -> JSON state
 *  - `content read --uri content://com.ekremapper.companion.control/apps`  -> JSON launchable apps
 *  - `content call --uri content://com.ekremapper.companion.control --method set --arg <base64 json>`
 *  - `content call ... --method learn` / `forget`
 */
class ControlProvider : ContentProvider() {
    override fun onCreate() = true

    private fun checkCaller() {
        val uid = Binder.getCallingUid()
        // shell, root, system
        if (uid != 2000 && uid != 0 && uid != 1000) {
            throw SecurityException("adb shell only")
        }
    }

    private val store get() = Store(context!!)

    override fun call(method: String, arg: String?, extras: Bundle?): Bundle {
        checkCaller()
        when (method) {
            "set" -> {
                val json = String(Base64.decode(arg ?: "", Base64.DEFAULT))
                store.applyConfig(JSONObject(json))
            }
            "learn" -> KeyService.learning = true
            "forget" -> {
                KeyService.learning = false
                store.forgetKey()
            }
            "ping" -> Unit
            else -> throw IllegalArgumentException("unknown method $method")
        }
        return Bundle().apply { putString("state", state().toString()) }
    }

    override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor {
        checkCaller()
        val body = when (uri.lastPathSegment) {
            "state" -> state().toString()
            "apps" -> apps().toString()
            else -> throw IllegalArgumentException("unknown path $uri")
        }
        val (read, write) = ParcelFileDescriptor.createPipe()
        thread {
            ParcelFileDescriptor.AutoCloseOutputStream(write).use { it.write(body.toByteArray()) }
        }
        return read
    }

    private fun state(): JSONObject {
        val ctx = context!!
        val s = store
        val info = ctx.packageManager.getPackageInfo(ctx.packageName, 0)
        val nm = ctx.getSystemService(android.app.NotificationManager::class.java)
        return JSONObject()
            .put("versionCode", info.longVersionCode)
            .put("service", KeyService.instance != null)
            .put("learning", KeyService.learning)
            .put("learned", s.scanCode >= 0)
            .put("scanCode", s.scanCode)
            .put("dndAccess", nm.isNotificationPolicyAccessGranted)
            .put("config", s.configJson())
    }

    private fun apps(): JSONArray {
        val pm = context!!.packageManager
        val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val seen = HashSet<String>()
        val out = JSONArray()
        pm.queryIntentActivities(launcher, PackageManager.ResolveInfoFlags.of(0))
            .sortedBy { it.loadLabel(pm).toString().lowercase() }
            .forEach { ri ->
                val pkg = ri.activityInfo.packageName
                if (pkg == context!!.packageName || !seen.add(pkg)) return@forEach
                out.put(
                    JSONObject()
                        .put("pkg", pkg)
                        .put("label", ri.loadLabel(pm).toString())
                        .put("icon", icon(ri.loadIcon(pm)))
                )
            }
        return out
    }

    private fun icon(d: android.graphics.drawable.Drawable): String {
        val size = 72
        val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        d.setBounds(0, 0, size, size)
        d.draw(Canvas(bmp))
        val bytes = ByteArrayOutputStream()
        bmp.compress(Bitmap.CompressFormat.WEBP_LOSSY, 85, bytes)
        return Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP)
    }

    override fun query(u: Uri, p: Array<String>?, s: String?, a: Array<String>?, o: String?): Cursor? = null
    override fun getType(uri: Uri): String = "application/json"
    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun delete(uri: Uri, s: String?, a: Array<String>?) = 0
    override fun update(uri: Uri, v: ContentValues?, s: String?, a: Array<String>?) = 0
}
