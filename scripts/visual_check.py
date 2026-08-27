"""Bounded browser smoke/visual check for the local lottery preview.

Requires Python Playwright and a locally running server. This script does not run
during deployment; it is a maintainer convenience for checking both live flows.
"""

import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright


def page_metrics(page):
    return page.evaluate(
        """() => ({
          width: innerWidth,
          bodyWidth: document.body.scrollWidth,
          horizontalOverflow: document.body.scrollWidth > innerWidth + 1,
          title: document.title,
          canvasWidth: document.querySelector('#wheel')?.width || null,
          undersizedTouchTargets: [...document.querySelectorAll('button, a, summary, input')]
            .filter((node) => {
              const rect = node.getBoundingClientRect();
              const style = getComputedStyle(node);
              return style.display !== 'none' && rect.width > 0 && rect.height > 0 &&
                (rect.width < 44 || rect.height < 44);
            })
            .map((node) => `${node.tagName.toLowerCase()}#${node.id || ''}.${node.className || ''}`)
        })"""
    )


def main():
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3000"
    admin_password = sys.argv[2] if len(sys.argv) > 2 else "preview-admin-password"
    output = Path(sys.argv[3] if len(sys.argv) > 3 else "/private/tmp/lottery-qa")
    output.mkdir(parents=True, exist_ok=True)
    results = {"errors": [], "pages": {}}

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="chrome", headless=True)

        user_context = browser.new_context(viewport={"width": 390, "height": 844})
        user_page = user_context.new_page()
        user_page.on(
            "console",
            lambda message: results["errors"].append(f"user console: {message.text}")
            if message.type == "error"
            else None,
        )
        user_page.on(
            "pageerror", lambda error: results["errors"].append(f"user page: {error}")
        )
        user_page.goto(base_url, wait_until="networkidle")
        user_page.fill("#name-input", "Visual QA Entrant")
        user_page.fill("#email-input", "visual-qa@example.com")
        user_page.click("#join-button")
        user_page.locator("#join-success:not(.hidden)").wait_for(timeout=5_000)
        user_page.screenshot(path=str(output / "user-confirmed-mobile.png"), full_page=True)
        results["pages"]["user"] = page_metrics(user_page)
        results["pages"]["user"]["confirmation"] = user_page.locator(
            "#receipt-status"
        ).inner_text()
        user_context.close()

        narrow_context = browser.new_context(viewport={"width": 320, "height": 720})
        narrow_page = narrow_context.new_page()
        narrow_page.goto(base_url, wait_until="networkidle")
        narrow_page.evaluate("localStorage.removeItem('gdg-lottery-receipt')")
        narrow_page.reload(wait_until="networkidle")
        narrow_page.screenshot(path=str(output / "user-form-320.png"), full_page=True)
        results["pages"]["user320"] = page_metrics(narrow_page)
        narrow_context.close()

        admin_context = browser.new_context(viewport={"width": 1440, "height": 1000})
        admin_page = admin_context.new_page()
        admin_page.on(
            "console",
            lambda message: results["errors"].append(f"admin console: {message.text}")
            if message.type == "error"
            else None,
        )
        admin_page.on(
            "pageerror", lambda error: results["errors"].append(f"admin page: {error}")
        )
        admin_page.goto(f"{base_url}/admin", wait_until="networkidle")
        admin_page.fill("#password-input", admin_password)
        admin_page.click("#login-button")
        admin_page.locator("#admin-console:not(.hidden)").wait_for(timeout=5_000)
        admin_page.click('[data-minutes="5"]')
        admin_page.locator("#admin-countdown").filter(has_not_text="Not scheduled").wait_for(
            timeout=5_000
        )
        admin_page.click("#draw-button")
        admin_page.locator("#winner-result:not(.hidden)").wait_for(timeout=9_000)
        admin_page.screenshot(path=str(output / "admin-winner-desktop.png"), full_page=True)
        results["pages"]["admin"] = page_metrics(admin_page)
        results["pages"]["admin"]["winner"] = admin_page.locator(
            "#winner-name"
        ).inner_text()
        results["pages"]["admin"]["entryCount"] = admin_page.locator(
            "#admin-total"
        ).inner_text()
        admin_context.close()

        mobile_admin_context = browser.new_context(
            viewport={"width": 390, "height": 844}, has_touch=True
        )
        mobile_admin = mobile_admin_context.new_page()
        mobile_admin.on(
            "console",
            lambda message: results["errors"].append(
                f"mobile admin console: {message.text}"
            )
            if message.type == "error"
            else None,
        )
        mobile_admin.on(
            "pageerror",
            lambda error: results["errors"].append(f"mobile admin page: {error}"),
        )
        mobile_admin.goto(f"{base_url}/admin", wait_until="networkidle")
        mobile_admin.fill("#password-input", admin_password)
        mobile_admin.click("#login-button")
        mobile_admin.locator("#admin-console:not(.hidden)").wait_for(timeout=5_000)
        mobile_admin.screenshot(path=str(output / "admin-mobile-draw.png"))
        results["pages"]["adminMobile"] = page_metrics(mobile_admin)
        mobile_admin.click('a[href="#schedule-title"]')
        mobile_admin.wait_for_timeout(350)
        mobile_admin.screenshot(path=str(output / "admin-mobile-schedule.png"))
        mobile_admin_context.close()
        browser.close()

    print(json.dumps(results, indent=2))
    if results["errors"] or any(
        page["horizontalOverflow"] or page["undersizedTouchTargets"]
        for page in results["pages"].values()
    ):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
