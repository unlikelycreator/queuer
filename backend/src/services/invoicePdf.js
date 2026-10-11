const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { uploadDir } = require('../config/multer');

// Real, vector PDF invoices in three themes. Everything is drawn with PDFKit's built-in
// fonts so there are no font files to ship.

const PAGE = { width: 595.28, height: 841.89, margin: 48 };

function money(amount, currency) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount || 0);
  } catch {
    return `${currency || ''} ${(amount || 0).toFixed(2)}`;
  }
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
}

function qty(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function hexToRgb(hex) {
  const m = String(hex || '').replace('#', '').match(/^([0-9a-f]{6})$/i);
  if (!m) return [4, 120, 87];
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

// Tint used for subtle backgrounds (mix accent with white).
function tint(hex, amount = 0.9) {
  const [r, g, b] = hexToRgb(hex);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

// Only local uploads are embedded (never fetched from arbitrary URLs).
function localLogo(logoUrl) {
  if (!logoUrl) return null;
  const name = path.basename(String(logoUrl).split('?')[0]);
  if (!/\.(png|jpe?g)$/i.test(name)) return null;
  const file = path.join(uploadDir, name);
  return fs.existsSync(file) ? file : null;
}

function statusLabel(invoice) {
  const s = invoice.displayStatus || invoice.status;
  return { draft: 'DRAFT', sent: 'DUE', partial: 'PARTIALLY PAID', overdue: 'OVERDUE', paid: 'PAID', void: 'VOID' }[s] || s.toUpperCase();
}

function renderInvoicePdf(invoice, company, stream) {
  const b = company.billing || {};
  const theme = invoice.template || b.template || 'modern';
  const accent = invoice.accentColor || b.accentColor || '#047857';
  const currency = invoice.currency || b.currency || 'USD';
  const fonts =
    theme === 'classic'
      ? { regular: 'Times-Roman', bold: 'Times-Bold', italic: 'Times-Italic' }
      : { regular: 'Helvetica', bold: 'Helvetica-Bold', italic: 'Helvetica-Oblique' };

  const doc = new PDFDocument({ size: 'A4', margin: PAGE.margin, bufferPages: true, info: { Title: `Invoice ${invoice.number}`, Author: b.businessName || company.name } });
  doc.pipe(stream);

  const L = PAGE.margin;
  const R = PAGE.width - PAGE.margin;
  const W = R - L;
  const ink = '#16211c';
  const muted = '#6b7a72';
  const line = '#dde5e0';
  const businessName = b.businessName || company.name;
  const logo = localLogo(b.logoUrl);
  let y = L;

  // ── Header ──
  if (theme === 'modern') {
    doc.rect(0, 0, PAGE.width, 150).fill(accent);
    let textX = L;
    if (logo) {
      try {
        doc.image(logo, L, 40, { fit: [64, 64] });
        textX = L + 78;
      } catch {
        /* unreadable image — skip */
      }
    }
    doc.fill('#ffffff').font(fonts.bold).fontSize(20).text(businessName, textX, 48, { width: 260 });
    doc.font(fonts.regular).fontSize(9).fillOpacity(0.85).text([b.businessAddress, b.businessEmail, b.businessPhone].filter(Boolean).join('\n'), textX, doc.y + 4, { width: 260 });
    doc.fillOpacity(1).font(fonts.bold).fontSize(30).text('INVOICE', L, 44, { width: W, align: 'right' });
    doc.font(fonts.regular).fontSize(11).text(invoice.number, L, 82, { width: W, align: 'right' });
    doc.fontSize(8).font(fonts.bold).text(statusLabel(invoice), L, 102, { width: W, align: 'right', characterSpacing: 1.5 });
    y = 180;
  } else if (theme === 'classic') {
    if (logo) {
      try {
        doc.image(logo, PAGE.width / 2 - 28, y, { fit: [56, 56] });
        y += 64;
      } catch {
        /* skip */
      }
    }
    doc.fill(ink).font(fonts.bold).fontSize(22).text(businessName, L, y, { width: W, align: 'center' });
    doc.font(fonts.regular).fontSize(9).fill(muted).text([b.businessAddress, [b.businessEmail, b.businessPhone].filter(Boolean).join('  ·  ')].filter(Boolean).join('\n'), L, doc.y + 4, { width: W, align: 'center' });
    y = doc.y + 14;
    doc.moveTo(L, y).lineTo(R, y).lineWidth(1.5).stroke(accent);
    doc.moveTo(L, y + 3).lineTo(R, y + 3).lineWidth(0.5).stroke(accent);
    y += 18;
    doc.fill(accent).font(fonts.bold).fontSize(16).text(`INVOICE  ${invoice.number}`, L, y, { width: W, align: 'center', characterSpacing: 2 });
    y = doc.y + 18;
  } else {
    // minimal
    if (logo) {
      try {
        doc.image(logo, L, y, { fit: [44, 44] });
      } catch {
        /* skip */
      }
    }
    doc.fill(ink).font(fonts.bold).fontSize(13).text(businessName, logo ? L + 56 : L, y + 4, { width: 260 });
    doc.font(fonts.regular).fontSize(8.5).fill(muted).text([b.businessAddress, b.businessEmail].filter(Boolean).join('\n'), logo ? L + 56 : L, doc.y + 2, { width: 260 });
    doc.fill(accent).font(fonts.bold).fontSize(28).text('Invoice', L, y, { width: W, align: 'right' });
    doc.fill(muted).font(fonts.regular).fontSize(10).text(invoice.number, L, doc.y + 2, { width: W, align: 'right' });
    y = Math.max(doc.y, y + 60) + 26;
  }

  // ── Bill to / meta ──
  const client = invoice.client || {};
  const colW = W / 2 - 10;
  const metaTop = y;
  doc.fill(muted).font(fonts.bold).fontSize(8).text('BILL TO', L, y, { characterSpacing: 1.2 });
  doc.fill(ink).font(fonts.bold).fontSize(12).text(client.name || '—', L, doc.y + 4, { width: colW });
  doc.font(fonts.regular).fontSize(9).fill(muted).text([client.contactPerson, client.email, client.address].filter(Boolean).join('\n'), L, doc.y + 2, { width: colW });
  if (invoice.project?.name) doc.text(`Project: ${invoice.project.name}`, { width: colW });
  const leftBottom = doc.y;

  const meta = [
    ['Invoice number', invoice.number],
    ['Issue date', fmtDate(invoice.issueDate)],
    ['Due date', fmtDate(invoice.dueDate)],
    ...(b.taxId ? [['Tax ID', b.taxId]] : []),
  ];
  let my = metaTop;
  meta.forEach(([k, v]) => {
    doc.fill(muted).font(fonts.regular).fontSize(9).text(k, R - colW, my, { width: colW / 2 });
    doc.fill(ink).font(fonts.bold).text(v, R - colW / 2, my, { width: colW / 2, align: 'right' });
    my += 16;
  });
  // Balance due highlight
  my += 4;
  doc.roundedRect(R - colW, my, colW, 40, theme === 'classic' ? 0 : 6).fill(tint(accent, 0.88));
  doc.fill(accent).font(fonts.bold).fontSize(8).text(invoice.status === 'paid' ? 'PAID IN FULL' : 'BALANCE DUE', R - colW + 12, my + 8, { characterSpacing: 1 });
  doc.fontSize(15).text(money(invoice.balanceDue ?? invoice.total - invoice.amountPaid, currency), R - colW + 12, my + 19, { width: colW - 24, align: 'right' });
  y = Math.max(leftBottom, my + 40) + 28;

  // ── Items table ──
  const cols = [
    { key: 'description', label: 'Description', x: L, w: W - 250, align: 'left' },
    { key: 'quantity', label: 'Qty', x: L + W - 250, w: 60, align: 'right' },
    { key: 'unitPrice', label: 'Rate', x: L + W - 180, w: 80, align: 'right' },
    { key: 'amount', label: 'Amount', x: L + W - 90, w: 90, align: 'right' },
  ];
  const drawHead = () => {
    if (theme === 'modern') doc.rect(L, y, W, 24).fill(accent);
    else if (theme === 'classic') doc.rect(L, y, W, 24).lineWidth(0.8).fillAndStroke(tint(accent, 0.92), accent);
    doc.font(fonts.bold).fontSize(8.5).fill(theme === 'modern' ? '#ffffff' : theme === 'classic' ? accent : muted);
    cols.forEach((c) => doc.text(c.label.toUpperCase(), c.x + (c.align === 'left' ? 10 : 0), y + 8, { width: c.w - 10, align: c.align, characterSpacing: 0.8 }));
    if (theme === 'minimal') doc.moveTo(L, y + 24).lineTo(R, y + 24).lineWidth(1).stroke(ink);
    y += 30;
  };
  drawHead();

  invoice.items.forEach((item, i) => {
    const amount = Math.round(item.quantity * item.unitPrice * 100) / 100;
    doc.font(fonts.regular).fontSize(9.5);
    const h = Math.max(doc.heightOfString(item.description, { width: cols[0].w - 14 }), 12) + 12;
    if (y + h > PAGE.height - 160) {
      doc.addPage();
      y = L;
      drawHead();
    }
    if (theme === 'modern' && i % 2 === 1) doc.rect(L, y - 4, W, h).fill(tint(accent, 0.95));
    doc.fill(ink).text(item.description, L + 10, y + 2, { width: cols[0].w - 14 });
    doc.text(`${qty(item.quantity)}${item.unit ? ` ${item.unit}` : ''}`, cols[1].x, y + 2, { width: cols[1].w - 10, align: 'right' });
    doc.text(money(item.unitPrice, currency), cols[2].x, y + 2, { width: cols[2].w - 10, align: 'right' });
    doc.font(fonts.bold).text(money(amount, currency), cols[3].x, y + 2, { width: cols[3].w - 10, align: 'right' });
    y += h;
    if (theme !== 'modern') doc.moveTo(L, y - 4).lineTo(R, y - 4).lineWidth(0.5).stroke(line);
  });

  // ── Totals ──
  y += 10;
  if (y > PAGE.height - 200) {
    doc.addPage();
    y = L;
  }
  const tx = R - 230;
  const row = (label, value, { bold = false, color = ink, size = 10 } = {}) => {
    doc.font(bold ? fonts.bold : fonts.regular).fontSize(size).fill(bold ? color : muted).text(label, tx, y, { width: 120 });
    doc.fill(color).text(value, tx + 110, y, { width: 120, align: 'right' });
    y += size + 9;
  };
  row('Subtotal', money(invoice.subtotal, currency));
  if (invoice.discountAmount > 0) row(`Discount (${invoice.discountPercent}%)`, `-${money(invoice.discountAmount, currency)}`);
  if (invoice.taxRate > 0) row(`${invoice.taxLabel || 'Tax'} (${invoice.taxRate}%)`, money(invoice.taxAmount, currency));
  doc.moveTo(tx, y).lineTo(R, y).lineWidth(theme === 'classic' ? 1.2 : 0.8).stroke(theme === 'minimal' ? ink : accent);
  y += 8;
  row('Total', money(invoice.total, currency), { bold: true, color: accent, size: 13 });
  if (invoice.amountPaid > 0) {
    row('Paid', `-${money(invoice.amountPaid, currency)}`);
    row('Balance due', money(invoice.total - invoice.amountPaid, currency), { bold: true });
  }

  // ── Notes, terms, payment instructions ──
  y += 14;
  const block = (title, text) => {
    if (!text) return;
    if (y > PAGE.height - 120) {
      doc.addPage();
      y = L;
    }
    doc.fill(accent).font(fonts.bold).fontSize(8).text(title.toUpperCase(), L, y, { characterSpacing: 1.2 });
    doc.fill(ink).font(fonts.regular).fontSize(9).text(text, L, doc.y + 4, { width: W * 0.7 });
    y = doc.y + 14;
  };
  block('Payment instructions', b.paymentInstructions);
  block('Notes', invoice.notes);
  block('Terms', invoice.terms);

  // ── Stamp for paid / void ──
  if (['paid', 'void'].includes(invoice.status)) {
    doc.save();
    doc.rotate(-18, { origin: [PAGE.width / 2, 420] });
    doc.fillOpacity(0.12).fill(invoice.status === 'paid' ? accent : '#b91c1c').font('Helvetica-Bold').fontSize(90)
      .text(invoice.status.toUpperCase(), 0, 380, { width: PAGE.width, align: 'center' });
    doc.restore();
    doc.fillOpacity(1);
  }

  // ── Footer on every page ──
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // let us write in the footer area without spawning a page
    const fy = PAGE.height - 40;
    if (theme !== 'minimal') doc.moveTo(L, fy - 8).lineTo(R, fy - 8).lineWidth(0.5).stroke(line);
    doc.fill(muted).font(fonts.italic).fontSize(8).text(b.footerNote || '', L, fy, { width: W * 0.7, lineBreak: false });
    doc.font(fonts.regular).text(`${invoice.number}  ·  Page ${i + 1} of ${range.count}`, L, fy, { width: W, align: 'right', lineBreak: false });
  }

  doc.end();
}

module.exports = { renderInvoicePdf, money };
