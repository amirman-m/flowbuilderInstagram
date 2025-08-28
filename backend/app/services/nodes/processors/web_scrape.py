from typing import Dict, Any, List
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse
import urllib.robotparser as robotparser
from html.parser import HTMLParser

from app.models.nodes import (
    NodeType,
    NodeCategory,
    NodeDataType,
    NodePort,
    NodePorts,
    NodeExecutionResult,
)

import httpx
import trafilatura


class _LinkExtractor(HTMLParser):
    """Lightweight link extractor to avoid extra dependencies."""
    def __init__(self, base_url: str):
        super().__init__()
        self.base_url = base_url
        self.links: List[Dict[str, str]] = []
        self._in_a = False
        self._current_href = None
        self._current_text = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() == 'a':
            self._in_a = True
            href = dict(attrs).get('href')
            if href:
                self._current_href = urljoin(self.base_url, href)
            else:
                self._current_href = None
            self._current_text = []

    def handle_endtag(self, tag):
        if tag.lower() == 'a' and self._in_a:
            text = ''.join(self._current_text).strip()
            if self._current_href:
                self.links.append({
                    'href': self._current_href,
                    'text': text
                })
            self._in_a = False
            self._current_href = None
            self._current_text = []

    def handle_data(self, data):
        if self._in_a and data:
            self._current_text.append(data)


def get_web_scrape_node_type() -> NodeType:
    return NodeType(
        id="web_scrape",
        name="Web Scraper",
        description="Fetches a web page and extracts readable text, metadata, and links.",
        category=NodeCategory.PROCESSOR,
        version="1.0.0",
        icon="public",
        color="#4CAF50",
        tags=["web", "scrape", "crawler", "html", "content", "metadata", "links"],
        ports=NodePorts(
            inputs=[
                NodePort(
                    id="url",
                    name="url",
                    label="URL",
                    description="URL of the page to scrape",
                    dataType=NodeDataType.STRING,
                    required=True,
                )
            ],
            outputs=[
                NodePort(
                    id="raw_html",
                    name="raw_html",
                    label="Raw HTML",
                    description="Raw HTML content of the page",
                    dataType=NodeDataType.STRING,
                    required=False,
                ),
                NodePort(
                    id="main_text",
                    name="main_text",
                    label="Main Text",
                    description="Readable main text extracted from the page",
                    dataType=NodeDataType.STRING,
                    required=False,
                ),
                NodePort(
                    id="metadata",
                    name="metadata",
                    label="Metadata",
                    description="Structured metadata including title, description, language, canonical URL, and fetch stats",
                    dataType=NodeDataType.OBJECT,
                    required=False,
                ),
                NodePort(
                    id="links",
                    name="links",
                    label="Links",
                    description="List of links found on the page",
                    dataType=NodeDataType.ARRAY,
                    required=False,
                ),
            ],
        ),
        settingsSchema={
            "type": "object",
            "properties": {
                "render_js": {
                    "type": "string",
                    "description": "JS rendering mode: auto | never | always (headless rendering not enabled in this minimal version)",
                    "enum": ["auto", "never", "always"],
                    "default": "auto",
                },
                "timeout_seconds": {
                    "type": "number",
                    "description": "HTTP timeout in seconds",
                    "default": 15,
                    "minimum": 3,
                    "maximum": 60,
                },
                "user_agent": {
                    "type": "string",
                    "description": "Custom User-Agent to use for requests",
                    "default": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
                },
                "obey_robots": {
                    "type": "boolean",
                    "description": "Respect robots.txt for the given URL",
                    "default": True,
                },
                "follow_redirects": {
                    "type": "boolean",
                    "description": "Follow HTTP redirects",
                    "default": True,
                },
                "max_size_bytes": {
                    "type": "number",
                    "description": "Maximum response size to download (bytes)",
                    "default": 2_000_000,
                    "minimum": 50_000,
                    "maximum": 20_000_000,
                },
                "accept_language": {
                    "type": "string",
                    "description": "Accept-Language header",
                    "default": "en-US,en;q=0.9",
                },
            },
            "required": ["timeout_seconds", "user_agent"],
        },
    )


async def _check_robots(url: str, user_agent: str) -> bool:
    """Return True if fetching is allowed by robots.txt, or if robots can't be fetched."""
    try:
        parsed = urlparse(url)
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
        rp = robotparser.RobotFileParser()
        rp.set_url(robots_url)
        # Fetch with short timeout using httpx (sync fetch isn't supported by RobotFileParser directly)
        try:
            with httpx.Client(timeout=5.0, follow_redirects=True, headers={"User-Agent": user_agent}) as client:
                resp = client.get(robots_url)
                if resp.status_code >= 400:
                    return True  # be permissive if robots not available
                rp.parse(resp.text.splitlines())
        except Exception:
            return True  # be permissive on robots fetch failure
        return rp.can_fetch(user_agent, url)
    except Exception:
        return True


async def execute_web_scrape(context: Dict[str, Any]) -> NodeExecutionResult:
    inputs = context.get("inputs", {})
    settings = context.get("settings", {})

    # Resolve URL from inputs (accept raw string or object with url property)
    url = None
    for _, value in inputs.items():
        if isinstance(value, str) and value.strip().startswith("http"):
            url = value.strip()
            break
        if isinstance(value, dict) and isinstance(value.get("url"), str):
            candidate = value.get("url").strip()
            if candidate.startswith("http"):
                url = candidate
                break

    if not url:
        return NodeExecutionResult(outputs={}, status="error", error="No valid URL provided on input port.")

    user_agent = settings.get("user_agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36")
    timeout_seconds = float(settings.get("timeout_seconds", 15))
    obey_robots = bool(settings.get("obey_robots", True))
    follow_redirects = bool(settings.get("follow_redirects", True))
    max_size_bytes = int(settings.get("max_size_bytes", 2_000_000))
    accept_language = settings.get("accept_language", "en-US,en;q=0.9")

    # robots.txt
    if obey_robots:
        allowed = await _check_robots(url, user_agent)
        if not allowed:
            return NodeExecutionResult(outputs={}, status="error", error=f"Blocked by robots.txt: {url}")

    headers = {
        "User-Agent": user_agent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": accept_language,
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "DNT": "1",
        "Upgrade-Insecure-Requests": "1",
    }

    start = datetime.now(timezone.utc)
    logs: List[str] = []

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds, follow_redirects=follow_redirects, headers=headers) as client:
            resp = await client.get(url)
            status = resp.status_code
            content_type = resp.headers.get("content-type", "")
            logs.append(f"Fetched {url} status={status} content-type={content_type}")
            if status >= 400:
                return NodeExecutionResult(outputs={}, status="error", error=f"HTTP {status} fetching {url}", logs=logs)
            # Limit size
            content = resp.content[:max_size_bytes]
            html = content.decode(errors="ignore")

        # Extract main text using trafilatura
        extracted_text = trafilatura.extract(html, include_comments=False, include_tables=False, no_fallback=False) or ""

        # Basic metadata via trafilatura metadata extraction
        metadata = trafilatura.metadata.extract_metadata(html) if hasattr(trafilatura, 'metadata') else None
        meta_obj = {}
        if metadata:
            # Convert to serializable dict (trafilatura returns object with attributes)
            meta_obj = {k: getattr(metadata, k, None) for k in (
                'title', 'author', 'date', 'sitename', 'url', 'hostname', 'description', 'language')}

        # Links
        parser = _LinkExtractor(resp.url if hasattr(resp, 'url') else url)
        parser.feed(html)
        links = parser.links

        completed = datetime.now(timezone.utc)
        output_metadata = {
            "url": url,
            "canonical_url": meta_obj.get("url") or url,
            "fetched_at": completed.isoformat(),
            "status_code": status,
            "content_type": content_type,
            "title": meta_obj.get("title"),
            "description": meta_obj.get("description"),
            "language": meta_obj.get("language"),
            "site_name": meta_obj.get("sitename"),
            "timings_ms": int((completed - start).total_seconds() * 1000),
            "size_bytes": len(html.encode('utf-8')),
        }

        outputs = {
            "raw_html": html,
            "main_text": extracted_text,
            "metadata": output_metadata,
            "links": links,
        }

        return NodeExecutionResult(outputs=outputs, status="success", logs=logs, started_at=start, completed_at=completed)

    except Exception as e:
        logs.append(f"Error: {type(e).__name__}: {str(e)}")
        return NodeExecutionResult(outputs={}, status="error", error=str(e), logs=logs, started_at=start, completed_at=datetime.now(timezone.utc))
