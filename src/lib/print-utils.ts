/** تشغيل الطباعة بعدد نسخ محدد (بعد كل طباعة ينتظر إغلاق مربع الطباعة) */
export function runAutoPrint(
  copies: number,
  targetWindow: Window = window,
  delayMs = 500
): void {
  const total = Math.max(0, Math.min(10, Math.round(copies)));
  if (total <= 0) return;

  let printed = 0;

  const trigger = () => {
    targetWindow.focus();
    targetWindow.print();
    printed += 1;
    if (printed < total) {
      targetWindow.addEventListener("afterprint", trigger, { once: true });
    }
  };

  window.setTimeout(trigger, delayMs);
}

function collectDocumentStyles(): string {
  const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(
    (node) => (node as HTMLLinkElement).outerHTML
  );
  const inline = Array.from(document.querySelectorAll("style")).map((node) => node.outerHTML);
  return [...links, ...inline].join("\n");
}

/** طباعة الفاتورة من iframe منفصل لتقليل ظهور رابط الموقع على الورقة */
export function printInvoiceElement(element: HTMLElement, copies = 1): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument;
  if (!win || !doc) {
    iframe.remove();
    return;
  }

  const paper = element.getAttribute("data-paper") || "a4";
  const clone = element.cloneNode(true) as HTMLElement;

  doc.open();
  doc.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  ${collectDocumentStyles()}
  <style>
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page {
      margin: 10mm;
    }
  </style>
</head>
<body data-print-paper="${paper}">${clone.outerHTML}</body>
</html>`);
  doc.close();

  const cleanup = () => {
    window.setTimeout(() => iframe.remove(), 500);
  };

  const startPrint = () => {
    runAutoPrint(copies, win, 350);
    win.addEventListener("afterprint", cleanup, { once: true });
  };

  if (doc.readyState === "complete") {
    startPrint();
  } else {
    iframe.onload = startPrint;
  }
}

export function printInvoiceFromContainer(container: HTMLElement | null, copies = 1): void {
  const invoice = container?.querySelector(".invoice-print-page") as HTMLElement | null;
  if (!invoice) return;
  printInvoiceElement(invoice, copies);
}

/** طباعة ملصقات الباركود — كل ملصق في صفحة بحجم الملصق */
export function printBarcodeFromContainer(container: HTMLElement | null): void {
  const root = container?.querySelector(".barcode-print-root") as HTMLElement | null;
  if (!root) return;

  const widthMm = root.getAttribute("data-label-width-mm") || "38";
  const heightMm = root.getAttribute("data-label-height-mm") || "25";

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument;
  if (!win || !doc) {
    iframe.remove();
    return;
  }

  const clone = root.cloneNode(true) as HTMLElement;

  doc.open();
  doc.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  ${collectDocumentStyles()}
  <style>
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page {
      size: ${widthMm}mm ${heightMm}mm;
      margin: 0;
    }
  </style>
</head>
<body>${clone.outerHTML}</body>
</html>`);
  doc.close();

  const cleanup = () => {
    window.setTimeout(() => iframe.remove(), 500);
  };

  const startPrint = () => {
    win.focus();
    win.print();
    win.addEventListener("afterprint", cleanup, { once: true });
  };

  window.setTimeout(startPrint, 450);
}

function invoicePdfFileName(invoiceNumber: string): string {
  const safe = invoiceNumber.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "invoice";
  return `${safe}.pdf`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function invoiceElementToPdfBlob(element: HTMLElement): Promise<Blob> {
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");
  const paper = (element.getAttribute("data-paper") || "a4").toLowerCase();
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    imageTimeout: 8000,
  });
  const image = canvas.toDataURL("image/jpeg", 0.92);
  const thermalWidth = Number(paper);

  if (Number.isFinite(thermalWidth) && thermalWidth > 0) {
    const heightMm = Math.max(40, (canvas.height * thermalWidth) / canvas.width);
    const pdf = new jsPDF({
      unit: "mm",
      format: [thermalWidth, heightMm],
      orientation: "portrait",
    });
    pdf.addImage(image, "JPEG", 0, 0, thermalWidth, heightMm);
    return pdf.output("blob");
  }

  const format = paper === "b5" ? "b5" : "a4";
  const pdf = new jsPDF({ unit: "mm", format, orientation: "portrait" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let remaining = imgHeight;
  let offsetY = 0;
  let firstPage = true;

  while (remaining > 0) {
    if (!firstPage) pdf.addPage();
    firstPage = false;
    pdf.addImage(image, "JPEG", 0, offsetY, imgWidth, imgHeight);
    remaining -= pageHeight;
    offsetY -= pageHeight;
  }

  return pdf.output("blob");
}

export type InvoicePdfShareResult = "shared" | "downloaded" | "cancelled";

/** تجهيز نفس معاينة الفاتورة كملف — بدون حفظ أو تعديل على الفاتورة */
export async function prepareInvoicePdfFromContainer(
  container: HTMLElement | null,
  invoiceNumber: string
): Promise<File> {
  const invoice = container?.querySelector(".invoice-print-page") as HTMLElement | null;
  if (!invoice) {
    throw new Error("NO_INVOICE");
  }

  const blob = await invoiceElementToPdfBlob(invoice);
  return new File([blob], invoicePdfFileName(invoiceNumber), { type: "application/pdf" });
}

/** فتح مربع مشاركة الجهاز للملف الجاهز — لازم تُستدعى من ضغطة المستخدم */
export async function sharePreparedInvoiceFile(
  file: File,
  invoiceNumber: string
): Promise<InvoicePdfShareResult> {
  const payload = {
    title: invoiceNumber,
    text: invoiceNumber,
    files: [file],
  };

  try {
    if (typeof navigator.share === "function") {
      await navigator.share(payload);
      return "shared";
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return "cancelled";
    }
  }

  downloadBlob(file, file.name);
  return "downloaded";
}
