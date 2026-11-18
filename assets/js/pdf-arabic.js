// pdf-arabic.js — Arabic PDF utility for VEXORIS
// Requires: jsPDF + jspdf-autotable + ArabicShaper + Tajawal fonts
// Usage:
//   import { createArabicPDF, arabicAutoTable, drawRTLText } from '../assets/js/pdf-arabic.js';
//   const doc = await createArabicPDF({ orientation: 'landscape' });
//   drawRTLText(doc, 'تقرير الجودة', 280, 15, { align: 'right', fontSize: 14 });
//   arabicAutoTable(doc, { head: [...], body: [...] });

let regularCache = null;
let boldCache = null;
let shaperLoaded = false;

function shapeArabic(text) {
  if (!text) return '';
  if (window.ArabicShaper && typeof window.ArabicShaper.reshape === 'function') {
    return window.ArabicShaper.reshape(String(text));
  }
  return String(text);
}

async function fetchAsBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function resolveAsset(relPath) {
  const p = window.location.pathname;
  const isNested = p.includes('/apps/') || p.includes('/admin/');
  return (isNested ? '../' : './') + relPath;
}

async function loadShaper() {
  if (shaperLoaded) return;
  if (window.ArabicShaper) { shaperLoaded = true; return; }
  try {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/arabic-persian-reshaper@1.0.1/dist/ArabicShaper.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    shaperLoaded = true;
  } catch (e) {
    console.warn('[pdf-arabic] ArabicShaper CDN failed, using raw text:', e);
  }
}

async function loadFonts() {
  if (regularCache) return;
  try {
    const [reg, bd] = await Promise.all([
      fetchAsBase64(resolveAsset('assets/fonts/Tajawal-Regular.ttf')),
      fetchAsBase64(resolveAsset('assets/fonts/Tajawal-Bold.ttf')).catch(() => null),
    ]);
    regularCache = reg;
    boldCache = bd;
  } catch (e) {
    console.warn('[pdf-arabic] Font load failed:', e);
  }
}

export async function createArabicPDF(options = {}) {
  if (!window.jspdf?.jsPDF) throw new Error('jsPDF not loaded');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF(options);

  await Promise.all([loadShaper(), loadFonts()]);

  if (regularCache) {
    doc.addFileToVFS('Tajawal-Regular.ttf', regularCache);
    doc.addFont('Tajawal-Regular.ttf', 'Tajawal', 'normal');
    doc.setFont('Tajawal', 'normal');
  }
  if (boldCache) {
    doc.addFileToVFS('Tajawal-Bold.ttf', boldCache);
    doc.addFont('Tajawal-Bold.ttf', 'Tajawal', 'bold');
  }
  return doc;
}

export function arabicAutoTable(doc, options = {}) {
  return doc.autoTable({
    ...options,
    styles: {
      font: 'Tajawal',
      fontSize: 9,
      halign: 'right',
      cellPadding: 3,
      ...options.styles,
    },
    headStyles: {
      font: 'Tajawal',
      fontStyle: 'bold',
      fillColor: [14, 165, 233],
      textColor: [255, 255, 255],
      halign: 'right',
      ...options.headStyles,
    },
    alternateRowStyles: {
      fillColor: [245, 248, 252],
      ...options.alternateRowStyles,
    },
  });
}

export function drawRTLText(doc, text, x, y, options = {}) {
  const { align = 'right', ...rest } = options;
  doc.text(shapeArabic(text), x, y, { align, ...rest });
}

export function shapeText(text) {
  return shapeArabic(text);
}

export function stripEmoji(text) {
  if (!text) return '';
  return String(text).replace(/\p{Extended_Pictographic}/gu, '').trim();
}