// Shred by QK · native fingertip pulse camera for Android (Capacitor plugin "PulseCamera").
// Why native: the flash stays on, the highest steady frame rate the phone offers is used (often 60 fps),
// and auto-exposure / white balance are locked once the fingertip settles.
// It streams average colours to js/vitals.js, which runs the same tested maths as the web app (js/hr.js).
// Install: native/README.md. Not compiled in CI: build and test it on a real phone.
package com.shredbyqk.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.graphics.ImageFormat
import android.hardware.camera2.*
import android.media.Image
import android.media.ImageReader
import android.os.Handler
import android.os.HandlerThread
import android.os.SystemClock
import android.util.Range
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

@CapacitorPlugin(name = "PulseCamera", permissions = [Permission(strings = [Manifest.permission.CAMERA], alias = "camera")])
class PulseCameraPlugin : Plugin() {
    private var thread: HandlerThread? = null
    private var handler: Handler? = null
    private var camera: CameraDevice? = null
    private var session: CameraCaptureSession? = null
    private var reader: ImageReader? = null
    // Batched and sent to JavaScript every ~100 ms.
    private val bt = ArrayList<Double>(); private val br = ArrayList<Double>()
    private val bg = ArrayList<Double>(); private val bb = ArrayList<Double>()
    private var lastEmit = 0L

    @PluginMethod
    fun start(call: PluginCall) {
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            requestPermissionForAlias("camera", call, "cameraPermsCallback"); return
        }
        open(call)
    }

    @PermissionCallback
    private fun cameraPermsCallback(call: PluginCall) {
        if (getPermissionState("camera") == PermissionState.GRANTED) open(call) else call.reject("Camera permission denied")
    }

    @PluginMethod
    fun stop(call: PluginCall) { close(); call.resolve() }

    @SuppressLint("MissingPermission") // checked in start()
    private fun open(call: PluginCall) {
        close()
        try {
            val wanted = call.getInt("fps", 60) ?: 60
            val mgr = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val id = mgr.cameraIdList.firstOrNull { mgr.getCameraCharacteristics(it).get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_BACK }
                ?: return call.reject("No back camera")
            val chars = mgr.getCameraCharacteristics(id)
            // The fastest steady frame-rate range up to `wanted` (a fixed range like 60-60 keeps timing even).
            val ranges = chars.get(CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES) ?: arrayOf()
            val range: Range<Int> = ranges.filter { it.upper <= wanted }.maxWithOrNull(compareBy<Range<Int>>({ it.upper }, { it.lower })) ?: Range(30, 30)

            thread = HandlerThread("pulse-camera").also { it.start() }
            handler = Handler(thread!!.looper)
            reader = ImageReader.newInstance(320, 240, ImageFormat.YUV_420_888, 4).apply {
                setOnImageAvailableListener({ r -> r.acquireLatestImage()?.let { img -> onImage(img); img.close() } }, handler)
            }
            mgr.openCamera(id, object : CameraDevice.StateCallback() {
                override fun onOpened(cam: CameraDevice) {
                    camera = cam
                    @Suppress("DEPRECATION")
                    cam.createCaptureSession(listOf(reader!!.surface), object : CameraCaptureSession.StateCallback() {
                        override fun onConfigured(s: CameraCaptureSession) {
                            session = s
                            val req = cam.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
                                addTarget(reader!!.surface)
                                set(CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE, range)
                                set(CaptureRequest.FLASH_MODE, CaptureRequest.FLASH_MODE_TORCH)
                            }
                            s.setRepeatingRequest(req.build(), null, handler)
                            // Let exposure settle on the lit fingertip, then lock it: re-adjustments look like pulse waves.
                            handler?.postDelayed({
                                try {
                                    req.set(CaptureRequest.CONTROL_AE_LOCK, true)
                                    req.set(CaptureRequest.CONTROL_AWB_LOCK, true)
                                    session?.setRepeatingRequest(req.build(), null, handler)
                                } catch (_: Exception) {}
                            }, 1500)
                            call.resolve(JSObject().put("fps", range.upper))
                        }
                        override fun onConfigureFailed(s: CameraCaptureSession) { call.reject("Camera setup failed") }
                    }, handler)
                }
                override fun onDisconnected(cam: CameraDevice) { cam.close() }
                override fun onError(cam: CameraDevice, error: Int) { cam.close(); call.reject("Camera error $error") }
            }, handler)
        } catch (e: Exception) {
            call.reject("Camera setup failed: ${e.message}")
        }
    }

    private fun close() {
        try { session?.close() } catch (_: Exception) {}
        try { camera?.close() } catch (_: Exception) {}
        try { reader?.close() } catch (_: Exception) {}
        thread?.quitSafely()
        session = null; camera = null; reader = null; thread = null; handler = null
        bt.clear(); br.clear(); bg.clear(); bb.clear()
    }

    // Mean of a plane over the centre half of the frame, respecting row and pixel strides.
    private fun planeMean(img: Image, i: Int, sub: Int): Double {
        val p = img.planes[i]; val buf = p.buffer
        val w = img.width / sub; val h = img.height / sub
        var sum = 0.0; var n = 0
        val step = maxOf(1, minOf(w, h) / 48)
        var y = h / 4
        while (y < h * 3 / 4) {
            var x = w / 4
            while (x < w * 3 / 4) {
                val idx = y * p.rowStride + x * p.pixelStride
                if (idx < buf.limit()) { sum += (buf.get(idx).toInt() and 0xFF); n++ }
                x += step
            }
            y += step
        }
        return if (n > 0) sum / n else 0.0
    }

    // Average colour of each frame (from YUV), timed by the sensor timestamp.
    private fun onImage(img: Image) {
        val y = planeMean(img, 0, 1); val u = planeMean(img, 1, 2) - 128; val v = planeMean(img, 2, 2) - 128
        bt.add(img.timestamp / 1e9)
        br.add(y + 1.402 * v); bg.add(y - 0.344 * u - 0.714 * v); bb.add(y + 1.772 * u)
        val now = SystemClock.elapsedRealtime()
        if (now - lastEmit > 100) {
            val data = JSObject()
            data.put("t", JSArray(bt)); data.put("r", JSArray(br)); data.put("g", JSArray(bg)); data.put("b", JSArray(bb))
            notifyListeners("samples", data)
            bt.clear(); br.clear(); bg.clear(); bb.clear()
            lastEmit = now
        }
    }
}
