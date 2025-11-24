package com.rep.plus.network

import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log
import org.json.JSONObject
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.nio.ByteBuffer
import kotlin.concurrent.thread

/**
 * Service that receives captured packets from PCAPdroid via UDP
 */
class CaptureService : Service() {

    private var isRunning = false
    private var udpSocket: DatagramSocket? = null
    private var receiverThread: Thread? = null
    private val packetQueue = mutableListOf<CapturedPacket>()

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val port = intent?.getIntExtra("port", 5123) ?: 5123

        if (!isRunning) {
            startUDPReceiver(port)
        }

        return START_STICKY
    }

    private fun startUDPReceiver(port: Int) {
        isRunning = true

        receiverThread = thread {
            try {
                udpSocket = DatagramSocket(port)
                val buffer = ByteArray(65535)

                Log.d(TAG, "UDP receiver started on port $port")

                while (isRunning) {
                    val packet = DatagramPacket(buffer, buffer.size)
                    udpSocket?.receive(packet)

                    // Parse packet
                    val capturedPacket = parsePacket(packet.data, packet.length)
                    capturedPacket?.let {
                        handleCapturedPacket(it)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "UDP receiver error: ${e.message}")
            } finally {
                udpSocket?.close()
            }
        }
    }

    private fun parsePacket(data: ByteArray, length: Int): CapturedPacket? {
        return try {
            // Basic PCAP packet parsing
            // PCAPdroid sends raw packets in PCAP format
            // For HTTP traffic, we need to parse TCP/IP headers and extract payload

            val buffer = ByteBuffer.wrap(data, 0, length)

            // Simple parsing - in production, use a proper PCAP library
            // For now, we'll extract basic info

            CapturedPacket(
                timestamp = System.currentTimeMillis(),
                rawData = data.copyOf(length),
                size = length
            )
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing packet: ${e.message}")
            null
        }
    }

    private fun handleCapturedPacket(packet: CapturedPacket) {
        synchronized(packetQueue) {
            packetQueue.add(packet)

            // Try to reconstruct HTTP requests from TCP streams
            val httpRequest = tryExtractHttpRequest(packetQueue)
            httpRequest?.let {
                // Send to WebView
                sendToWebView(it)
                // Clear processed packets
                packetQueue.clear()
            }
        }
    }

    private fun tryExtractHttpRequest(packets: List<CapturedPacket>): HttpRequest? {
        // Reconstruct TCP stream and extract HTTP request
        // This is simplified - production needs proper TCP reassembly

        val combinedData = packets.flatMap { it.rawData.toList() }.toByteArray()
        val dataString = String(combinedData, Charsets.ISO_8859_1)

        // Look for HTTP request patterns
        if (dataString.startsWith("GET ") ||
            dataString.startsWith("POST ") ||
            dataString.startsWith("PUT ") ||
            dataString.startsWith("DELETE ") ||
            dataString.startsWith("PATCH ") ||
            dataString.startsWith("HEAD ") ||
            dataString.startsWith("OPTIONS ")) {

            return parseHttpRequest(dataString)
        }

        return null
    }

    private fun parseHttpRequest(data: String): HttpRequest? {
        return try {
            val lines = data.split("\r\n")
            if (lines.isEmpty()) return null

            // Parse request line
            val requestLine = lines[0].split(" ")
            if (requestLine.size < 3) return null

            val method = requestLine[0]
            val path = requestLine[1]
            val version = requestLine[2]

            // Parse headers
            val headers = mutableMapOf<String, String>()
            var bodyStartIndex = -1

            for (i in 1 until lines.size) {
                if (lines[i].isEmpty()) {
                    bodyStartIndex = i + 1
                    break
                }
                val parts = lines[i].split(": ", limit = 2)
                if (parts.size == 2) {
                    headers[parts[0]] = parts[1]
                }
            }

            // Extract body
            val body = if (bodyStartIndex > 0 && bodyStartIndex < lines.size) {
                lines.subList(bodyStartIndex, lines.size).joinToString("\r\n")
            } else ""

            HttpRequest(
                method = method,
                path = path,
                version = version,
                headers = headers,
                body = body,
                host = headers["Host"] ?: ""
            )

        } catch (e: Exception) {
            Log.e(TAG, "Error parsing HTTP request: ${e.message}")
            null
        }
    }

    private fun sendToWebView(request: HttpRequest) {
        // Convert to JSON and send to WebView via broadcast
        val json = JSONObject().apply {
            put("method", request.method)
            put("path", request.path)
            put("version", request.version)
            put("host", request.host)
            put("headers", JSONObject(request.headers))
            put("body", request.body)
            put("timestamp", System.currentTimeMillis())
        }

        // Broadcast to MainActivity
        val intent = Intent(ACTION_HTTP_CAPTURED).apply {
            putExtra("request", json.toString())
        }
        sendBroadcast(intent)
    }

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        udpSocket?.close()
        receiverThread?.interrupt()
    }

    companion object {
        private const val TAG = "CaptureService"
        const val ACTION_HTTP_CAPTURED = "com.rep.plus.HTTP_CAPTURED"
    }
}

data class CapturedPacket(
    val timestamp: Long,
    val rawData: ByteArray,
    val size: Int
)

data class HttpRequest(
    val method: String,
    val path: String,
    val version: String,
    val headers: Map<String, String>,
    val body: String,
    val host: String
)
