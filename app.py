import os
import time
import random
import requests
from flask import Flask, render_template, request, jsonify
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from cachetools import cached, TTLCache

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "google-clone-secret-2024")

# ─── User-Agent Pool ───────────────────────────────────────────
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/118.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0",
]

def get_headers():
    return {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }


from duckduckgo_search import DDGS

# ─── duckduckgo-search wrappers ────────────────────────────────
@cached(cache=TTLCache(maxsize=500, ttl=600))
def search_ddgs_text(query: str, page: int = 1):
    start = time.time()
    try:
        results = DDGS().text(query, max_results=30)
        formatted = [{"title": r.get("title", ""), "url": r.get("href", ""), "snippet": r.get("body", ""), "date": ""} for r in results]
        return formatted, None, round(time.time() - start, 2)
    except Exception as e:
        return [], str(e), round(time.time() - start, 2)

@cached(cache=TTLCache(maxsize=500, ttl=600))
def search_ddgs_images(query: str):
    start = time.time()
    try:
        results = DDGS().images(query, max_results=30)
        formatted = [{"title": r.get("title", ""), "url": r.get("url", ""), "image": r.get("image", ""), "thumbnail": r.get("thumbnail", ""), "source": r.get("source", "")} for r in results]
        return formatted, None, round(time.time() - start, 2)
    except Exception as e:
        return [], str(e), round(time.time() - start, 2)

@cached(cache=TTLCache(maxsize=500, ttl=600))
def search_ddgs_news(query: str):
    start = time.time()
    try:
        results = DDGS().news(query, max_results=30)
        formatted = [{"title": r.get("title", ""), "url": r.get("url", ""), "snippet": r.get("body", ""), "date": r.get("date", ""), "source": r.get("source", "")} for r in results]
        return formatted, None, round(time.time() - start, 2)
    except Exception as e:
        return [], str(e), round(time.time() - start, 2)

@cached(cache=TTLCache(maxsize=500, ttl=600))
def search_ddgs_videos(query: str):
    start = time.time()
    try:
        results = DDGS().videos(query, max_results=30)
        formatted = [{"title": r.get("title", ""), "url": r.get("content", ""), "description": r.get("description", ""), "duration": r.get("duration", ""), "published": r.get("published", ""), "publisher": r.get("publisher", ""), "thumbnail": r.get("images", {}).get("large", "") if isinstance(r.get("images"), dict) else ""} for r in results]
        return formatted, None, round(time.time() - start, 2)
    except Exception as e:
        return [], str(e), round(time.time() - start, 2)

# ─── Routes ───────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/search")
def search():
    query = request.args.get("q", "").strip()
    page = int(request.args.get("page", 1))

    if not query:
        return jsonify({"error": "Please enter a search query", "results": [], "total": 0})

    results, error, elapsed = search_ddgs_text(query, page)

    if error and not results:
        return jsonify({"error": f"Search failed: {error}", "results": [], "total": 0})

    return jsonify({
        "results": results,
        "total": max(len(results) * 10, len(results)),
        "time": str(elapsed),
        "query": query,
        "page": page,
    })

@app.route("/search/images")
def images():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"error": "No query", "results": []})
    results, error, elapsed = search_ddgs_images(query)
    return jsonify({"results": results, "time": str(elapsed)})

@app.route("/search/news")
def news():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"error": "No query", "results": []})
    results, error, elapsed = search_ddgs_news(query)
    return jsonify({"results": results, "time": str(elapsed)})

@app.route("/search/videos")
def videos():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"error": "No query", "results": []})
    results, error, elapsed = search_ddgs_videos(query)
    return jsonify({"results": results, "time": str(elapsed)})

@app.route("/suggest")
def suggest():
    """DuckDuckGo autocomplete suggestions."""
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify({"suggestions": []})

    try:
        resp = requests.get(
            "https://duckduckgo.com/ac/",
            params={"q": q, "type": "list"},
            headers=get_headers(),
            timeout=5
        )
        data = resp.json()
        # Response: ["query", [suggestions...]]
        if isinstance(data, list) and len(data) > 1:
            return jsonify({"suggestions": data[1][:8]})
    except Exception:
        pass

    return jsonify({"suggestions": []})


if __name__ == "__main__":
    debug_mode = os.getenv("FLASK_DEBUG", "True").lower() == "true"
    port = int(os.getenv("PORT", 5000))
    print(f"Google Clone running at http://localhost:{port}")
    app.run(debug=debug_mode, port=port, host="0.0.0.0")
