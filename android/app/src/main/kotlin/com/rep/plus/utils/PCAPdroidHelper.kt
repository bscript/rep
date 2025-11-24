package com.rep.plus.utils

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri

object PCAPdroidHelper {

    private const val PCAPDROID_PACKAGE = "com.emanuelef.remote_capture"
    private const val PCAPDROID_ACTIVITY = "$PCAPDROID_PACKAGE.activities.CaptureCtrl"

    fun isInstalled(context: Context): Boolean {
        return try {
            context.packageManager.getPackageInfo(PCAPDROID_PACKAGE, 0)
            true
        } catch (e: PackageManager.NameNotFoundException) {
            false
        }
    }

    fun openPlayStore(context: Context) {
        val intent = Intent(Intent.ACTION_VIEW).apply {
            data = Uri.parse("market://details?id=$PCAPDROID_PACKAGE")
        }
        context.startActivity(intent)
    }

    fun createStartIntent(
        pcapMode: String = "udp_exporter",
        collectorIp: String = "127.0.0.1",
        collectorPort: Int = 5123,
        appFilter: String? = null,
        apiKey: String? = null,
        broadcastReceiver: String? = null
    ): Intent {
        return Intent(Intent.ACTION_VIEW).apply {
            setClassName(PCAPDROID_PACKAGE, PCAPDROID_ACTIVITY)
            putExtra("action", "start")
            putExtra("pcap_dump_mode", pcapMode)
            putExtra("collector_ip_address", collectorIp)
            putExtra("collector_port", collectorPort)

            appFilter?.let { putExtra("app_filter", it) }
            apiKey?.let { putExtra("api_key", it) }
            broadcastReceiver?.let { putExtra("broadcast_receiver", it) }
        }
    }

    fun createStopIntent(): Intent {
        return Intent(Intent.ACTION_VIEW).apply {
            setClassName(PCAPDROID_PACKAGE, PCAPDROID_ACTIVITY)
            putExtra("action", "stop")
        }
    }

    fun createStatusIntent(): Intent {
        return Intent(Intent.ACTION_VIEW).apply {
            setClassName(PCAPDROID_PACKAGE, PCAPDROID_ACTIVITY)
            putExtra("action", "get_status")
        }
    }
}
