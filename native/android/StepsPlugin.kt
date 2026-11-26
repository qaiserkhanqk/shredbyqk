// Daily step counts from Health Connect, for the food targets and QK's weekly report.
// NOT YET COMPILED: build with Android Studio (see native/README.md, "Steps").
// Needs androidx.health.connect:connect-client and the READ_STEPS permission in AndroidManifest.xml.
package com.shredbyqk.app

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.ZoneId

@CapacitorPlugin(name = "Steps")
class StepsPlugin : Plugin() {
    /** { days: 7 } → { days: [{ date: "2026-11-20", steps: 8421 }, …] }, oldest first. */
    @PluginMethod
    fun dailySteps(call: PluginCall) {
        val days = (call.getInt("days") ?: 7).coerceIn(1, 60)
        if (HealthConnectClient.getSdkStatus(context) != HealthConnectClient.SDK_AVAILABLE) { call.reject("Health Connect unavailable"); return }
        val client = HealthConnectClient.getOrCreate(context)
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val needed = setOf(HealthPermission.getReadPermission(StepsRecord::class))
                // The permission prompt is shown once from MainActivity (see native/README.md); here we only read.
                if (!client.permissionController.getGrantedPermissions().containsAll(needed)) { call.reject("permission"); return@launch }
                val zone = ZoneId.systemDefault(); val today = LocalDate.now(); val out = JSArray()
                for (i in days - 1 downTo 0) {
                    val d = today.minusDays(i.toLong())
                    val r = client.aggregate(AggregateRequest(setOf(StepsRecord.COUNT_TOTAL),
                        TimeRangeFilter.between(d.atStartOfDay(zone).toInstant(), d.plusDays(1).atStartOfDay(zone).toInstant())))
                    out.put(JSObject().put("date", d.toString()).put("steps", r[StepsRecord.COUNT_TOTAL] ?: 0L))
                }
                call.resolve(JSObject().put("days", out))
            } catch (e: Exception) { call.reject(e.message) }
        }
    }
}
