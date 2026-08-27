"""Focused phone QA for the authenticated admin console."""

import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright


def metrics(page):
    return page.evaluate(
        """() => ({
          width: innerWidth,
          bodyWidth: document.body.scrollWidth,
          horizontalOverflow: document.body.scrollWidth > innerWidth + 1,
          canvasWidth: document.querySelector('#wheel').width,
          undersizedTouchTargets: [...document.querySelectorAll('button, a, input')]
            .filter((node) => {
              const rect = node.getBoundingClientRect();
              const style = getComputedStyle(node);
              return style.display !== 'none' && rect.width > 0 && rect.height > 0 &&
                (rect.width < 44 || rect.height < 44);
            })
            .map((node) => `${node.tagName.toLowerCase()}#${node.id || ''}.${node.className || ''}`),
          navLabels: [...document.querySelectorAll('.mobile-console-nav a')]
            .map((node) => node.textContent.trim())
        })"""
    )


def main():
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3001"
    password = sys.argv[2] if len(sys.argv) > 2 else "preview-admin-password"
    output = Path(sys.argv[3] if len(sys.argv) > 3 else "/private/tmp/lottery-admin-mobile")
    output.mkdir(parents=True, exist_ok=True)
    result = {"errors": []}

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="chrome", headless=True)
        context = browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True)
        page = context.new_page()
        page.on(
            "console",
            lambda message: result["errors"].append(message.text)
            if message.type == "error"
            else None,
        )
        page.on("pageerror", lambda error: result["errors"].append(str(error)))
        page.goto(f"{base_url}/admin", wait_until="networkidle")
        page.fill("#password-input", password)
        page.click("#login-button")
        page.locator("#admin-console:not(.hidden)").wait_for(timeout=5_000)
        page.screenshot(path=str(output / "draw.png"))
        result.update(metrics(page))

        page.click('a[href="#schedule-title"]')
        page.wait_for_timeout(300)
        page.screenshot(path=str(output / "schedule.png"))
        page.click('a[href="#roster-title"]')
        page.wait_for_timeout(300)
        page.screenshot(path=str(output / "entrants.png"))
        context.close()
        browser.close()

    print(json.dumps(result, indent=2))
    if result["errors"] or result["horizontalOverflow"] or result["undersizedTouchTargets"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
