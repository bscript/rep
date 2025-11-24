package com.rep.plus.network

import android.util.Log
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import javax.net.ssl.HttpsURLConnection

/**
 * HTTP client for replaying requests
 */
object HttpClient {

    fun send(request: JSONObject): JSONObject {
        return try {
            val method = request.getString("method")
            val urlString = request.getString("url")
            val headers = request.optJSONObject("headers")
            val body = request.optString("body", "")

            val url = URL(urlString)
            val connection = url.openConnection() as HttpURLConnection

            // Configure connection
            connection.requestMethod = method
            connection.doInput = true
            connection.doOutput = method != "GET" && method != "HEAD"
            connection.connectTimeout = 30000
            connection.readTimeout = 30000

            // Set headers
            headers?.let {
                val keys = it.keys()
                while (keys.hasNext()) {
                    val key = keys.next()
                    val value = it.getString(key)
                    connection.setRequestProperty(key, value)
                }
            }

            // Send body if present
            if (body.isNotEmpty() && connection.doOutput) {
                OutputStreamWriter(connection.outputStream).use { writer ->
                    writer.write(body)
                    writer.flush()
                }
            }

            // Read response
            val responseCode = connection.responseCode
            val responseMessage = connection.responseMessage

            val responseBody = try {
                BufferedReader(InputStreamReader(connection.inputStream)).use { reader ->
                    reader.readText()
                }
            } catch (e: Exception) {
                // Try reading error stream
                try {
                    BufferedReader(InputStreamReader(connection.errorStream)).use { reader ->
                        reader.readText()
                    }
                } catch (e2: Exception) {
                    ""
                }
            }

            // Get response headers
            val responseHeaders = JSONObject()
            connection.headerFields.forEach { (key, values) ->
                if (key != null) {
                    responseHeaders.put(key, values.joinToString(", "))
                }
            }

            JSONObject().apply {
                put("status", responseCode)
                put("statusText", responseMessage)
                put("headers", responseHeaders)
                put("body", responseBody)
                put("url", urlString)
                put("timestamp", System.currentTimeMillis())
            }

        } catch (e: Exception) {
            Log.e(TAG, "HTTP request error: ${e.message}", e)
            JSONObject().apply {
                put("error", e.message ?: "Unknown error")
                put("errorType", e.javaClass.simpleName)
            }
        }
    }

    /**
     * Send raw HTTP request (from captured traffic)
     */
    fun sendRaw(host: String, port: Int, rawRequest: String, useSSL: Boolean = false): JSONObject {
        return try {
            val url = URL("${if (useSSL) "https" else "http"}://$host:$port/")
            val connection = url.openConnection() as HttpURLConnection

            // Parse method from raw request
            val firstLine = rawRequest.lines().firstOrNull() ?: throw Exception("Invalid request")
            val method = firstLine.split(" ")[0]

            connection.requestMethod = method
            connection.doInput = true
            connection.doOutput = true

            // Send raw request
            OutputStreamWriter(connection.outputStream).use { writer ->
                writer.write(rawRequest)
                writer.flush()
            }

            // Read response
            val responseCode = connection.responseCode
            val responseBody = BufferedReader(InputStreamReader(connection.inputStream)).use {
                it.readText()
            }

            JSONObject().apply {
                put("status", responseCode)
                put("body", responseBody)
            }

        } catch (e: Exception) {
            Log.e(TAG, "Raw HTTP request error: ${e.message}", e)
            JSONObject().apply {
                put("error", e.message ?: "Unknown error")
            }
        }
    }

    private const val TAG = "HttpClient"
}
