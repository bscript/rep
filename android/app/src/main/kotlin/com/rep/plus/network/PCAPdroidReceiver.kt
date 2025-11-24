package com.rep.plus.network

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import android.widget.Toast

/**
 * Receives status updates from PCAPdroid
 */
class PCAPdroidReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == "com.emanuelef.remote_capture.CaptureStatus") {
            val running = intent.getBooleanExtra("running", false)
            val bytesSent = intent.getLongExtra("bytes_sent", 0L)
            val bytesReceived = intent.getLongExtra("bytes_rcvd", 0L)
            val packetsSent = intent.getIntExtra("pkts_sent", 0)
            val packetsReceived = intent.getIntExtra("pkts_rcvd", 0)
            val packetsDropped = intent.getIntExtra("pkts_dropped", 0)

            Log.d(TAG, "PCAPdroid status - Running: $running, " +
                    "Bytes: ${bytesReceived + bytesSent}, " +
                    "Packets: ${packetsReceived + packetsSent}, " +
                    "Dropped: $packetsDropped")

            // Broadcast to MainActivity
            val statusIntent = Intent(ACTION_CAPTURE_STATUS).apply {
                putExtra("running", running)
                putExtra("bytes_sent", bytesSent)
                putExtra("bytes_rcvd", bytesReceived)
                putExtra("pkts_sent", packetsSent)
                putExtra("pkts_rcvd", packetsReceived)
                putExtra("pkts_dropped", packetsDropped)
            }
            context.sendBroadcast(statusIntent)

            if (!running) {
                Toast.makeText(context, "Capture stopped", Toast.LENGTH_SHORT).show()
            }
        }
    }

    companion object {
        private const val TAG = "PCAPdroidReceiver"
        const val ACTION_CAPTURE_STATUS = "com.rep.plus.CAPTURE_STATUS"
    }
}
