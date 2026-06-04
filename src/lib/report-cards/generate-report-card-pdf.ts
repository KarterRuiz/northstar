import "server-only";

import type { ReportCardPreviewPayload } from "@/features/report-cards/types";

import { loadSchoolLogoDataUrl } from "./load-school-logo-data-url";
import { renderReportCardHtml } from "./render-report-card-html";

function isServerlessRuntime(): boolean {
  return (
    process.env.VERCEL === "1" ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    Boolean(process.env.VERCEL_ENV)
  );
}

async function launchBrowser() {
  const puppeteer = await import("puppeteer-core");

  if (isServerlessRuntime()) {
    const chromium = await import("@sparticuz/chromium");
    return puppeteer.default.launch({
      args: chromium.default.args,
      defaultViewport: chromium.default.defaultViewport,
      executablePath: await chromium.default.executablePath(),
      headless: chromium.default.headless,
    });
  }

  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ??
    (await import("puppeteer")).default.executablePath();

  return puppeteer.default.launch({
    executablePath,
    headless: true,
  });
}

export async function generateReportCardPdfBuffer(
  payload: ReportCardPreviewPayload,
): Promise<Buffer> {
  const logoDataUrl = await loadSchoolLogoDataUrl(payload.branding.logoStoragePath);
  const html = renderReportCardHtml({ payload, logoDataUrl });

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "letter",
      printBackground: true,
      margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
