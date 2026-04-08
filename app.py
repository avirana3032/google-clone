import os
import time
import random
import requests
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from cachetools import cached, TTLCache

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "google-clone-secret-2024")

# ─── SearXNG Public Instances (fallback chain) ────────────────
SEARXNG_INSTANCES = [
    "https://search.bus-hit.me",
    "https://searx.tiekoetter.com",
    "https://search.ononoki.org",
    "https://searx.be",
    "https://search.sapti.me",
    "https://searx.work",
]

def get_headers():
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/html",
    }


def searxng_query(query, categories="general", page=1):
    """Query SearXNG instances with automatic fallback."""
    for instance in SEARXNG_INSTANCES:
        try:
            resp = requests.get(
                f"{instance}/search",
                params={
                    "q": query,
                    "format": "json",
                    "categories": categories,
                    "pageno": page,
                    "language": "en",
                    "safesearch": 0,
                },
                headers=get_headers(),
                timeout=8,
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("results"):
                    return data
        except Exception:
            continue
    return None


# ─── Cached search wrappers ───────────────────────────────────
@cached(cache=TTLCache(maxsize=500, ttl=600))
def search_text(query: str, page: int = 1):
    start = time.time()
    data = searxng_query(query, "general", page)
    elapsed = round(time.time() - start, 2)
    if not data or not data.get("results"):
        return [], "All search instances timed out", elapsed
    results = []
    for r in data["results"][:30]:
        results.append({
            "title": r.get("title", ""),
            "url": r.get("url", ""),
            "snippet": r.get("content", ""),
            "date": "",
        })
    return results, None, elapsed


@cached(cache=TTLCache(maxsize=500, ttl=600))
def search_images(query: str):
    start = time.time()
    data = searxng_query(query, "images")
    elapsed = round(time.time() - start, 2)
    if not data or not data.get("results"):
        return [], "No image results found", elapsed
    results = []
    for r in data["results"][:30]:
        results.append({
            "title": r.get("title", ""),
            "url": r.get("url", ""),
            "image": r.get("img_src", r.get("url", "")),
            "thumbnail": r.get("thumbnail_src", r.get("img_src", "")),
            "source": r.get("source", r.get("engine", "")),
        })
    return results, None, elapsed


@cached(cache=TTLCache(maxsize=500, ttl=600))
def search_news(query: str):
    start = time.time()
    data = searxng_query(query, "news")
    elapsed = round(time.time() - start, 2)
    if not data or not data.get("results"):
        return [], "No news results found", elapsed
    results = []
    for r in data["results"][:30]:
        results.append({
            "title": r.get("title", ""),
            "url": r.get("url", ""),
            "snippet": r.get("content", ""),
            "date": r.get("publishedDate", ""),
            "source": r.get("source", r.get("engine", "")),
        })
    return results, None, elapsed


@cached(cache=TTLCache(maxsize=500, ttl=600))
def search_videos(query: str):
    start = time.time()
    data = searxng_query(query, "videos")
    elapsed = round(time.time() - start, 2)
    if not data or not data.get("results"):
        return [], "No video results found", elapsed
    results = []
    for r in data["results"][:30]:
        results.append({
            "title": r.get("title", ""),
            "url": r.get("url", ""),
            "description": r.get("content", ""),
            "duration": r.get("length", r.get("duration", "")),
            "published": r.get("publishedDate", ""),
            "publisher": r.get("source", r.get("engine", "")),
            "thumbnail": r.get("thumbnail", r.get("img_src", "")),
        })
    return results, None, elapsed


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

    results, error, elapsed = search_text(query, page)

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
def images_route():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"error": "No query", "results": []})
    results, error, elapsed = search_images(query)
    return jsonify({"results": results, "time": str(elapsed)})

@app.route("/search/news")
def news_route():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"error": "No query", "results": []})
    results, error, elapsed = search_news(query)
    return jsonify({"results": results, "time": str(elapsed)})

@app.route("/search/videos")
def videos_route():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"error": "No query", "results": []})
    results, error, elapsed = search_videos(query)
    return jsonify({"results": results, "time": str(elapsed)})

@app.route("/suggest")
def suggest():
    """Google-style autocomplete suggestions."""
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify({"suggestions": []})

    try:
        resp = requests.get(
            "https://suggestqueries.google.com/complete/search",
            params={"client": "firefox", "q": q},
            headers=get_headers(),
            timeout=3,
        )
        data = resp.json()
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
