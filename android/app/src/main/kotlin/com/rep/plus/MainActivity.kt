package com.rep.plus

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebChromeClient
import android.webkit.WebViewClient
import android.webkit.JavascriptInterface
import android.widget.Toast
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import com.rep.plus.network.CaptureService
import com.rep.plus.storage.RequestDatabase
import com.rep.plus.utils.PCAPdroidHelper
import org.json.JSONObject

class MainActivity : Activity() {

    private lateinit var webView: WebView
    private lateinit var pcapdroidLauncher: ActivityResultLauncher<Intent>
    private lateinit var requestDb: RequestDatabase
    private var captureServiceIntent: Intent? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Initialize database
        requestDb = RequestDatabase(this)

        // Setup PCAPdroid launcher
        pcapdroidLauncher = registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->
            handlePCAPdroidResult(result.resultCode, result.data)
        }

        // Setup WebView
        webView = WebView(this)
        setupWebView()
        setContentView(webView)

        // Load the UI
        webView.loadUrl("file:///android_asset/web/panel.html")

        // Check if PCAPdroid is installed
        checkPCAPdroidInstalled()
    }

    private fun setupWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
        }

        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = WebViewClient()

        // Add JavaScript interface
        webView.addJavascriptInterface(RepJSBridge(this), "Android")
    }

    private fun checkPCAPdroidInstalled() {
        if (!PCAPdroidHelper.isInstalled(this)) {
            Toast.makeText(
                this,
                "PCAPdroid not installed. Please install PCAPdroid to capture traffic.",
                Toast.LENGTH_LONG
            ).show()
            // Optionally open Play Store
            // PCAPdroidHelper.openPlayStore(this)
        }
    }

    private fun startCapture() {
        val intent = PCAPdroidHelper.createStartIntent(
            pcapMode = "udp_exporter",
            collectorIp = "127.0.0.1",
            collectorPort = 5123,
            appFilter = null, // Capture all apps
            broadcastReceiver = "com.rep.plus.network.PCAPdroidReceiver"
        )
        pcapdroidLauncher.launch(intent)
    }

    private fun stopCapture() {
        val intent = PCAPdroidHelper.createStopIntent()
        pcapdroidLauncher.launch(intent)

        // Stop UDP service
        captureServiceIntent?.let {
            stopService(it)
            captureServiceIntent = null
        }
    }

    private fun handlePCAPdroidResult(resultCode: Int, data: Intent?) {
        if (resultCode == RESULT_OK) {
            // PCAPdroid started successfully
            // Start our UDP receiver service
            captureServiceIntent = Intent(this, CaptureService::class.java).apply {
                putExtra("port", 5123)
            }
            startService(captureServiceIntent)

            // Notify WebView
            webView.evaluateJavascript("window.onCaptureStarted?.()", null)
        } else {
            Toast.makeText(this, "Failed to start capture", Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * JavaScript Bridge - Called from WebView
     */
    inner class RepJSBridge(private val activity: MainActivity) {

        @JavascriptInterface
        fun startCapture() {
            activity.runOnUiThread {
                activity.startCapture()
            }
        }

        @JavascriptInterface
        fun stopCapture() {
            activity.runOnUiThread {
                activity.stopCapture()
            }
        }

        @JavascriptInterface
        fun sendRequest(requestJson: String): String {
            // Parse request and send it
            return try {
                val request = JSONObject(requestJson)
                val response = activity.sendHttpRequest(request)
                response.toString()
            } catch (e: Exception) {
                JSONObject().apply {
                    put("error", e.message)
                }.toString()
            }
        }

        @JavascriptInterface
        fun saveRequest(requestJson: String) {
            activity.requestDb.insertRequest(requestJson)
        }

        @JavascriptInterface
        fun getRequests(): String {
            return activity.requestDb.getAllRequests()
        }

        @JavascriptInterface
        fun clearRequests() {
            activity.requestDb.clearAll()
        }

        @JavascriptInterface
        fun showToast(message: String) {
            activity.runOnUiThread {
                Toast.makeText(activity, message, Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun sendHttpRequest(request: JSONObject): JSONObject {
        // Implemented in network module
        return com.rep.plus.network.HttpClient.send(request)
    }

    override fun onDestroy() {
        super.onDestroy()
        captureServiceIntent?.let { stopService(it) }
    }
}
