package com.rep.plus.storage

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONArray
import org.json.JSONObject

/**
 * SQLite database for storing captured and replayed requests
 */
class RequestDatabase(context: Context) :
    SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("""
            CREATE TABLE IF NOT EXISTS requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                method TEXT NOT NULL,
                url TEXT NOT NULL,
                headers TEXT,
                body TEXT,
                response_status INTEGER,
                response_headers TEXT,
                response_body TEXT,
                timestamp INTEGER NOT NULL,
                starred INTEGER DEFAULT 0,
                tags TEXT
            )
        """)

        // Index for faster queries
        db.execSQL("CREATE INDEX idx_timestamp ON requests(timestamp DESC)")
        db.execSQL("CREATE INDEX idx_starred ON requests(starred)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS requests")
        onCreate(db)
    }

    fun insertRequest(requestJson: String): Long {
        val json = JSONObject(requestJson)
        val db = writableDatabase

        val values = ContentValues().apply {
            put("method", json.optString("method", "GET"))
            put("url", json.optString("url", ""))
            put("headers", json.optJSONObject("headers")?.toString())
            put("body", json.optString("body", ""))
            put("response_status", json.optInt("responseStatus", 0))
            put("response_headers", json.optJSONObject("responseHeaders")?.toString())
            put("response_body", json.optString("responseBody", ""))
            put("timestamp", json.optLong("timestamp", System.currentTimeMillis()))
            put("starred", json.optInt("starred", 0))
            put("tags", json.optString("tags", ""))
        }

        return db.insert("requests", null, values)
    }

    fun getAllRequests(): String {
        val db = readableDatabase
        val cursor = db.query(
            "requests",
            null,
            null,
            null,
            null,
            null,
            "timestamp DESC"
        )

        val requests = JSONArray()

        cursor.use {
            while (it.moveToNext()) {
                val request = JSONObject().apply {
                    put("id", it.getLong(it.getColumnIndexOrThrow("id")))
                    put("method", it.getString(it.getColumnIndexOrThrow("method")))
                    put("url", it.getString(it.getColumnIndexOrThrow("url")))

                    val headers = it.getString(it.getColumnIndexOrThrow("headers"))
                    if (headers != null) {
                        put("headers", JSONObject(headers))
                    }

                    put("body", it.getString(it.getColumnIndexOrThrow("body")))
                    put("responseStatus", it.getInt(it.getColumnIndexOrThrow("response_status")))

                    val responseHeaders = it.getString(it.getColumnIndexOrThrow("response_headers"))
                    if (responseHeaders != null) {
                        put("responseHeaders", JSONObject(responseHeaders))
                    }

                    put("responseBody", it.getString(it.getColumnIndexOrThrow("response_body")))
                    put("timestamp", it.getLong(it.getColumnIndexOrThrow("timestamp")))
                    put("starred", it.getInt(it.getColumnIndexOrThrow("starred")))
                    put("tags", it.getString(it.getColumnIndexOrThrow("tags")))
                }
                requests.put(request)
            }
        }

        return requests.toString()
    }

    fun getRequestById(id: Long): String? {
        val db = readableDatabase
        val cursor = db.query(
            "requests",
            null,
            "id = ?",
            arrayOf(id.toString()),
            null,
            null,
            null
        )

        cursor.use {
            if (it.moveToFirst()) {
                return JSONObject().apply {
                    put("id", it.getLong(it.getColumnIndexOrThrow("id")))
                    put("method", it.getString(it.getColumnIndexOrThrow("method")))
                    put("url", it.getString(it.getColumnIndexOrThrow("url")))
                    // ... (same as above)
                }.toString()
            }
        }

        return null
    }

    fun updateRequest(id: Long, requestJson: String): Int {
        val json = JSONObject(requestJson)
        val db = writableDatabase

        val values = ContentValues().apply {
            json.optString("method")?.let { put("method", it) }
            json.optString("url")?.let { put("url", it) }
            json.optJSONObject("headers")?.let { put("headers", it.toString()) }
            json.optString("body")?.let { put("body", it) }
            json.optInt("starred")?.let { put("starred", it) }
        }

        return db.update("requests", values, "id = ?", arrayOf(id.toString()))
    }

    fun deleteRequest(id: Long): Int {
        val db = writableDatabase
        return db.delete("requests", "id = ?", arrayOf(id.toString()))
    }

    fun clearAll() {
        val db = writableDatabase
        db.execSQL("DELETE FROM requests")
    }

    fun searchRequests(query: String): String {
        val db = readableDatabase
        val cursor = db.query(
            "requests",
            null,
            "url LIKE ? OR method LIKE ? OR body LIKE ?",
            arrayOf("%$query%", "%$query%", "%$query%"),
            null,
            null,
            "timestamp DESC"
        )

        val requests = JSONArray()
        cursor.use {
            while (it.moveToNext()) {
                // Same as getAllRequests
                requests.put(JSONObject()) // simplified
            }
        }

        return requests.toString()
    }

    companion object {
        private const val DATABASE_NAME = "rep_plus.db"
        private const val DATABASE_VERSION = 1
    }
}
