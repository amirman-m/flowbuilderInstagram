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
        description="Scrapes content from a web page. Perfect for extracting articles, blog posts, or any web content for social media automation.",
        category=NodeCategory.PROCESSOR,
        version="2.0.0",
        icon="public",
        color="#4CAF50",
        tags=["web", "scrape", "content", "automation"],
        ports=NodePorts(
            inputs=[
                NodePort(
                    id="input_text",
                    name="input_text",
                    label="Input",
                    description="Input from previous nodes (URL detection or trigger data)",
                    data_type=[NodeDataType.STRING, NodeDataType.OBJECT],
                    required=False,
                )
            ],
            outputs=[
                NodePort(
                    id="input_text",
                    name="input_text", 
                    label="Scraped Content",
                    description="Extracted content from the web page",
                    data_type=[NodeDataType.STRING],
                    required=True,
                )
            ],
        ),
        settings_schema={
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "title": "Website URL",
                    "description": "The URL of the website to scrape content from",
                    "format": "uri",
                    "default": ""
                },
                "output_format": {
                    "type": "string",
                    "title": "Output Format",
                    "description": "Format of the extracted content",
                    "enum": ["html", "markdown", "plain_text"],
                    "default": "html"
                }
            },
            "required": ["url"],
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


def _is_url(text: str) -> bool:
    """Check if text is a valid URL"""
    return isinstance(text, str) and text.strip().startswith(("http://", "https://"))


def _extract_url_from_input(inputs: Dict[str, Any]) -> str:
    """Extract URL from various input formats"""
    # Check direct input_text
    input_text = inputs.get("input_text", "")
    if _is_url(input_text):
        return input_text.strip()
    
    # Check ai_response 
    ai_response = inputs.get("ai_response", "")
    if _is_url(ai_response):
        return ai_response.strip()
    
    # Check message_data from scheduled_message
    message_data = inputs.get("message_data", {})
    if isinstance(message_data, dict):
        # Check input_text within message_data
        nested_input = message_data.get("input_text", "")
        if _is_url(nested_input):
            return nested_input.strip()
    
    return ""


def _format_content(content: str, output_format: str) -> str:
    """Format extracted content based on user preference"""
    if output_format == "plain_text":
        # Remove HTML tags and extra whitespace
        import re
        clean_text = re.sub(r'<[^>]+>', '', content)
        clean_text = re.sub(r'\s+', ' ', clean_text).strip()
        return clean_text
    elif output_format == "markdown":
        # Convert HTML to markdown using simple rules
        import re
        # Basic HTML to markdown conversion
        content = re.sub(r'<h([1-6])>(.*?)</h[1-6]>', r'\n# \2\n', content)
        content = re.sub(r'<p>(.*?)</p>', r'\1\n\n', content)
        content = re.sub(r'<strong>(.*?)</strong>', r'**\1**', content)
        content = re.sub(r'<em>(.*?)</em>', r'*\1*', content)
        content = re.sub(r'<a[^>]*href="([^"]*)"[^>]*>(.*?)</a>', r'[\2](\1)', content)
        content = re.sub(r'<[^>]+>', '', content)  # Remove remaining tags
        content = re.sub(r'\n\s*\n', '\n\n', content)  # Clean up spacing
        return content.strip()
    else:
        # Return as HTML (default)
        return content


async def execute_web_scrape(context: Dict[str, Any]) -> NodeExecutionResult:
    """
    Execute web scraping with simplified user-friendly logic:
    1. Check if input is from scheduled trigger (scheduled=true)
    2. If input contains URL, use it; otherwise use URL from settings
    3. Scrape and format content according to user preference
    4. Return as input_text for next nodes
    """
    start_time = datetime.now(timezone.utc)
    inputs = context.get("inputs", {})
    settings = context.get("settings", {})
    
    # Get URL from settings (required)
    settings_url = settings.get("url", "").strip()
    output_format = settings.get("output_format", "html")
    
    # Determine final URL to scrape
    final_url = settings_url
    
    # Check for scheduled trigger or URL in inputs
    message_data = inputs.get("message_data", {})
    is_scheduled = False
    
    if isinstance(message_data, dict):
        is_scheduled = message_data.get("scheduled", False)
    
    if is_scheduled:
        # For scheduled triggers, start scraping with settings URL
        logs = [f"Scheduled trigger detected - using URL from settings: {settings_url}"]
    else:
        # Check if input contains a URL that should replace settings URL
        input_url = _extract_url_from_input(inputs)
        if input_url:
            final_url = input_url
            logs = [f"URL detected in input - using: {input_url}"]
        else:
            logs = [f"No URL in input - using settings URL: {settings_url}"]
    
    if not final_url:
        return NodeExecutionResult(
            outputs={},
            status="error",
            error="No URL provided. Please set a URL in the node settings.",
            started_at=start_time,
            completed_at=datetime.now(timezone.utc)
        )
    
    if not _is_url(final_url):
        return NodeExecutionResult(
            outputs={},
            status="error", 
            error=f"Invalid URL format: {final_url}",
            started_at=start_time,
            completed_at=datetime.now(timezone.utc)
        )

    # Scrape the web page
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
        
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True, headers=headers) as client:
            response = await client.get(final_url)
            
            if response.status_code >= 400:
                return NodeExecutionResult(
                    outputs={},
                    status="error",
                    error=f"Failed to fetch URL: HTTP {response.status_code}",
                    logs=logs + [f"HTTP {response.status_code} error"],
                    started_at=start_time,
                    completed_at=datetime.now(timezone.utc)
                )
            
            html_content = response.text
            logs.append(f"Successfully fetched {len(html_content)} characters from {final_url}")
        
        # Extract main content using trafilatura
        extracted_content = trafilatura.extract(
            html_content,
            include_comments=False,
            include_tables=True,
            no_fallback=False
        ) or ""
        
        if not extracted_content:
            return NodeExecutionResult(
                outputs={},
                status="error",
                error="No content could be extracted from the webpage",
                logs=logs + ["Content extraction failed"],
                started_at=start_time,
                completed_at=datetime.now(timezone.utc)
            )
        
        # Format content according to user preference
        formatted_content = _format_content(extracted_content, output_format)
        logs.append(f"Content extracted and formatted as {output_format} ({len(formatted_content)} characters)")
        
        return NodeExecutionResult(
            outputs={"input_text": formatted_content},
            status="success",
            logs=logs,
            started_at=start_time,
            completed_at=datetime.now(timezone.utc)
        )
        
    except Exception as e:
        return NodeExecutionResult(
            outputs={},
            status="error",
            error=f"Web scraping failed: {str(e)}",
            logs=logs + [f"Error: {str(e)}"],
            started_at=start_time,
            completed_at=datetime.now(timezone.utc)
        )
