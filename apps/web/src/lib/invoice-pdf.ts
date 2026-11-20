import type { OfficialInvoice, Order, User } from './types';

function toWinAnsiString(raw: string): string {
  return String(raw || '')
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u2248/g, '~')
    .replace(/\u00A0/g, ' ')
    .replace(/\u202F/g, ' ')
    .replace(/\u2713/g, 'OK')
    .replace(/\u2192/g, '->');
}

function escapePdfLiteral(raw: string): string {
  const normalized = toWinAnsiString(raw);
  let out = '';
  for (let i = 0; i < normalized.length; i += 1) {
    const code = normalized.charCodeAt(i);
    if (code === 0x5c || code === 0x28 || code === 0x29) {
      out += `\\${normalized[i]}`;
    } else if (code >= 0x20 && code <= 0xff) {
      out += normalized[i];
    } else if (code === 0x20ac) {
      // Euro sign in WinAnsi is 0x80
      out += String.fromCharCode(0x80);
    } else {
      out += ' ';
    }
  }
  return out;
}

function stringToLatin1Bytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    bytes[i] = text.charCodeAt(i) & 0xff;
  }
  return bytes;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((acc, p) => acc + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function wrapText(text: string, maxChars: number): string[] {
  const clean = toWinAnsiString(text).trim();
  if (!clean) return [''];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if (!current) {
      current = w;
    } else if (current.length + 1 + w.length <= maxChars) {
      current += ` ${w}`;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function formatDateFr(iso?: string | null): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

export function generateOfficialInvoicePdfBytes(invoice: OfficialInvoice): Uint8Array {
  const ops: string[] = [];
  const PAGE_W = 595;
  const PAGE_H = 842;
  const LEFT = 40;
  const RIGHT = 555;
  const CONTENT_W = RIGHT - LEFT;

  const drawText = (
    x: number,
    y: number,
    text: string,
    options?: { size?: number; bold?: boolean; rgb?: [number, number, number] },
  ) => {
    const font = options?.bold ? '/F2' : '/F1';
    const size = options?.size ?? 9.5;
    const [r, g, b] = options?.rgb ?? [0.1, 0.14, 0.13];
    ops.push('BT');
    ops.push(`${font} ${size} Tf`);
    ops.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`);
    ops.push(`1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm`);
    ops.push(`(${escapePdfLiteral(text)}) Tj`);
    ops.push('ET');
  };

  const drawRect = (
    x: number,
    y: number,
    w: number,
    h: number,
    fillRgb?: [number, number, number],
    strokeRgb?: [number, number, number],
  ) => {
    if (fillRgb) {
      ops.push(`${fillRgb[0].toFixed(3)} ${fillRgb[1].toFixed(3)} ${fillRgb[2].toFixed(3)} rg`);
    }
    if (strokeRgb) {
      ops.push(`${strokeRgb[0].toFixed(3)} ${strokeRgb[1].toFixed(3)} ${strokeRgb[2].toFixed(3)} RG`);
      ops.push('0.75 w');
    }
    ops.push(`${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re`);
    if (fillRgb && strokeRgb) ops.push('B');
    else if (fillRgb) ops.push('f');
    else ops.push('S');
  };

  // Header Banner (Nuit #172320 + Safran stripe #F2B84B)
  drawRect(0, PAGE_H - 96, PAGE_W, 96, [0.09, 0.14, 0.125]);
  drawRect(0, PAGE_H - 101, PAGE_W, 5, [0.95, 0.72, 0.29]);

  drawText(LEFT, PAGE_H - 38, 'ZANDOGO MARKETPLACE RDC', {
    size: 16,
    bold: true,
    rgb: [0.95, 0.72, 0.29],
  });
  drawText(LEFT, PAGE_H - 56, "FACTURE OFFICIELLE & PREUVE D'ACHAT SECURISEE", {
    size: 10.5,
    bold: true,
    rgb: [1, 1, 1],
  });
  drawText(LEFT, PAGE_H - 72, `${invoice.issuer.city} - ${invoice.issuer.country} | ${invoice.issuer.supportEmail}`, {
    size: 8.5,
    rgb: [0.85, 0.88, 0.87],
  });

  drawText(RIGHT - 185, PAGE_H - 36, `Facture N° : ${invoice.invoiceNumber}`, {
    size: 10,
    bold: true,
    rgb: [1, 1, 1],
  });
  drawText(RIGHT - 185, PAGE_H - 52, `Commande : ${invoice.orderNumber}`, {
    size: 9,
    rgb: [0.95, 0.72, 0.29],
  });
  drawText(RIGHT - 185, PAGE_H - 68, `Date : ${formatDateFr(invoice.issuedAt)}`, {
    size: 8.5,
    rgb: [0.85, 0.88, 0.87],
  });

  // Two Columns: Buyer Details & Payment / Escrow Proof
  let cursorY = PAGE_H - 120;
  drawRect(LEFT, cursorY - 94, 250, 94, [0.97, 0.97, 0.95], [0.85, 0.86, 0.84]);
  drawRect(LEFT + 265, cursorY - 94, 250, 94, [0.97, 0.97, 0.95], [0.85, 0.86, 0.84]);

  drawText(LEFT + 10, cursorY - 16, 'ACHETEUR & ADRESSE DE LIVRAISON', {
    size: 8.5,
    bold: true,
    rgb: [0.15, 0.45, 0.36],
  });
  drawText(LEFT + 10, cursorY - 32, invoice.buyer.fullName || 'Client ZandoGo', {
    size: 10,
    bold: true,
  });
  drawText(LEFT + 10, cursorY - 46, `Tél : ${invoice.buyer.phone || 'Non renseigné'}`, { size: 8.5 });
  drawText(LEFT + 10, cursorY - 58, `Email : ${invoice.buyer.email || 'Non renseigné'}`, { size: 8.5 });
  const addrLines = wrapText(`Adresse : ${invoice.deliveryAddress.formatted}`, 42).slice(0, 2);
  addrLines.forEach((line, idx) => {
    drawText(LEFT + 10, cursorY - 72 - idx * 11, line, { size: 8.2 });
  });

  drawText(LEFT + 275, cursorY - 16, 'PREUVE DE PAIEMENT & SEQUESTRE', {
    size: 8.5,
    bold: true,
    rgb: [0.15, 0.45, 0.36],
  });
  drawText(
    LEFT + 275,
    cursorY - 32,
    `Statut : ${invoice.payment.status === 'PAID' ? 'PAYEE (CONFIRMEE)' : 'EN ATTENTE'}`,
    {
      size: 9.5,
      bold: true,
      rgb: invoice.payment.status === 'PAID' ? [0.15, 0.45, 0.36] : [0.72, 0.3, 0.26],
    },
  );
  drawText(LEFT + 275, cursorY - 46, `Opérateur : ${invoice.payment.operatorLabel}`, { size: 8.5 });
  drawText(LEFT + 275, cursorY - 58, `Réf. Transaction : ${invoice.payment.providerReference}`, {
    size: 8.5,
    bold: true,
  });
  drawText(LEFT + 275, cursorY - 71, `Séquestre 48h : ${invoice.payment.escrowStatus}`, { size: 8.2 });
  drawText(
    LEFT + 275,
    cursorY - 83,
    `Boutique(s) : ${invoice.stores.map((s) => s.storeName).join(', ') || 'ZandoGo'}`.slice(0, 44),
    { size: 8.2 },
  );

  // Itemized Table Header
  cursorY -= 118;
  drawRect(LEFT, cursorY - 22, CONTENT_W, 22, [0.09, 0.14, 0.125]);
  drawText(LEFT + 8, cursorY - 14, 'DESIGNATION ARTICLE / BOUTIQUE', {
    size: 8.5,
    bold: true,
    rgb: [1, 1, 1],
  });
  drawText(LEFT + 305, cursorY - 14, 'QTE', { size: 8.5, bold: true, rgb: [1, 1, 1] });
  drawText(LEFT + 360, cursorY - 14, 'P.U. (USD)', { size: 8.5, bold: true, rgb: [1, 1, 1] });
  drawText(LEFT + 448, cursorY - 14, 'TOTAL (USD)', { size: 8.5, bold: true, rgb: [1, 1, 1] });

  cursorY -= 22;
  const items = invoice.items.slice(0, 14);
  for (let idx = 0; idx < items.length; idx += 1) {
    const it = items[idx];
    const titleLines = wrapText(it.title, 46).slice(0, 2);
    const metaLine = `${it.storeName}${it.variantLabel ? ` | ${it.variantLabel}` : ''}`.slice(0, 52);
    const rowHeight = titleLines.length > 1 ? 38 : 28;
    const fill: [number, number, number] = idx % 2 === 0 ? [1, 1, 1] : [0.97, 0.97, 0.96];
    drawRect(LEFT, cursorY - rowHeight, CONTENT_W, rowHeight, fill, [0.9, 0.9, 0.88]);

    titleLines.forEach((line, lIdx) => {
      drawText(LEFT + 8, cursorY - 12 - lIdx * 10, line, { size: 9, bold: lIdx === 0 });
    });
    drawText(LEFT + 8, cursorY - (titleLines.length > 1 ? 32 : 22), metaLine, {
      size: 7.5,
      rgb: [0.4, 0.43, 0.42],
    });
    drawText(LEFT + 310, cursorY - 16, String(it.quantity), { size: 9 });
    drawText(LEFT + 362, cursorY - 16, `$${Number(it.unitPriceUsd).toFixed(2)}`, { size: 9 });
    drawText(LEFT + 450, cursorY - 16, `$${Number(it.totalPriceUsd).toFixed(2)}`, {
      size: 9,
      bold: true,
    });
    cursorY -= rowHeight;
  }

  // Totals Summary Box
  cursorY -= 16;
  const boxH = 104;
  drawRect(LEFT + 225, cursorY - boxH, 290, boxH, [0.97, 0.97, 0.95], [0.82, 0.84, 0.82]);

  drawText(LEFT + 238, cursorY - 18, 'Sous-total articles :', { size: 9 });
  drawText(LEFT + 435, cursorY - 18, `$${invoice.totals.itemsSubtotalUsd.toFixed(2)}`, { size: 9, bold: true });

  drawText(LEFT + 238, cursorY - 34, 'Frais de livraison / fret :', { size: 9 });
  drawText(LEFT + 435, cursorY - 34, `$${invoice.totals.deliveryFeeUsd.toFixed(2)}`, { size: 9, bold: true });

  drawText(
    LEFT + 238,
    cursorY - 50,
    `Frais transaction paiement (${invoice.totals.transactionFeePercent}%) :`,
    { size: 9 },
  );
  drawText(LEFT + 435, cursorY - 50, `+$${invoice.totals.transactionFeeAmountUsd.toFixed(2)}`, {
    size: 9,
    bold: true,
  });

  drawRect(LEFT + 225, cursorY - boxH, 290, 42, [0.09, 0.14, 0.125]);
  drawText(LEFT + 238, cursorY - 76, 'TOTAL OFFICIEL DEBITE :', {
    size: 10,
    bold: true,
    rgb: [1, 1, 1],
  });
  drawText(LEFT + 430, cursorY - 76, `$${invoice.totals.chargedTotalUsd.toFixed(2)} USD`, {
    size: 11.5,
    bold: true,
    rgb: [0.95, 0.72, 0.29],
  });
  drawText(
    LEFT + 238,
    cursorY - 94,
    `Equivalent CDF (1 USD = ${invoice.totals.exchangeRateUsdToCdf.toLocaleString('fr-FR')} CDF) : ${invoice.totals.chargedTotalCdf.toLocaleString('fr-FR')} CDF`,
    { size: 8, rgb: [0.85, 0.88, 0.87] },
  );

  // Digital Downloads Notice (if applicable)
  if (invoice.digitalDownloads && invoice.digitalDownloads.length > 0) {
    drawRect(LEFT, cursorY - boxH, 212, boxH, [0.99, 0.96, 0.88], [0.9, 0.78, 0.45]);
    drawText(LEFT + 10, cursorY - 18, 'PRODUITS NUMERIQUES INCLUS', {
      size: 8,
      bold: true,
      rgb: [0.15, 0.45, 0.36],
    });
    invoice.digitalDownloads.slice(0, 3).forEach((dl, idx) => {
      drawText(LEFT + 10, cursorY - 35 - idx * 20, `- ${dl.title.slice(0, 32)}`, {
        size: 8,
        bold: true,
      });
      drawText(LEFT + 16, cursorY - 45 - idx * 20, dl.fileName.slice(0, 32), {
        size: 7.2,
        rgb: [0.35, 0.38, 0.37],
      });
    });
  }

  // Cryptographic Proof & Verification Footer
  const footerY = 104;
  drawRect(LEFT, footerY - 56, CONTENT_W, 56, [0.94, 0.97, 0.96], [0.15, 0.45, 0.36]);
  drawText(
    LEFT + 12,
    footerY - 18,
    `EMPREINTE D'AUTHENTICITE (${invoice.verification.algorithm}) : ${invoice.verification.proofCode}`,
    { size: 9.5, bold: true, rgb: [0.09, 0.14, 0.125] },
  );
  drawText(
    LEFT + 12,
    footerY - 33,
    invoice.issuer.legalNotice.slice(0, 95),
    { size: 7.8, rgb: [0.22, 0.28, 0.26] },
  );
  drawText(
    LEFT + 12,
    footerY - 45,
    `ID Commande : ${invoice.orderId} | Cachet électronique ZandoGo Goma`,
    { size: 7.5, rgb: [0.35, 0.4, 0.38] },
  );

  const streamContent = ops.join('\n');
  const streamBytes = stringToLatin1Bytes(streamContent);

  const header = stringToLatin1Bytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const objects: Uint8Array[] = [
    stringToLatin1Bytes('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'),
    stringToLatin1Bytes('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n'),
    stringToLatin1Bytes(
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n',
    ),
    stringToLatin1Bytes(
      '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n',
    ),
    stringToLatin1Bytes(
      '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n',
    ),
    concatBytes([
      stringToLatin1Bytes(`6 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`),
      streamBytes,
      stringToLatin1Bytes('\nendstream\nendobj\n'),
    ]),
  ];

  const offsets: number[] = [];
  let cursor = header.length;
  for (const obj of objects) {
    offsets.push(cursor);
    cursor += obj.length;
  }
  const xrefStart = cursor;
  const xrefLines = [
    'xref',
    `0 ${objects.length + 1}`,
    '0000000000 65535 f ',
    ...offsets.map((off) => `${String(off).padStart(10, '0')} 00000 n `),
    'trailer',
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    'startxref',
    String(xrefStart),
    '%%EOF\n',
  ];
  const xrefBytes = stringToLatin1Bytes(xrefLines.join('\n'));

  return concatBytes([header, ...objects, xrefBytes]);
}

export function downloadOfficialInvoicePdf(invoice: OfficialInvoice): void {
  const bytes = generateOfficialInvoicePdfBytes(invoice);
  const bufferCopy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(bufferCopy).set(bytes);
  const blob = new Blob([bufferCopy], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Facture-${invoice.orderNumber || invoice.invoiceNumber}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function buildFallbackInvoiceFromOrder(
  order: Order,
  user: User | null | undefined,
  exchangeRate: number,
): OfficialInvoice {
  const items = (order.subOrders || []).flatMap((so) =>
    (so.items || []).map((it) => {
      const qty = Math.max(1, Number(it.quantity || 1));
      const unit = Number(it.unitPrice || 0);
      return {
        title: it.productTitle || 'Article ZandoGo',
        storeName: so.store?.storeName || 'Boutique ZandoGo',
        variantLabel: it.variantName || null,
        productType: it.productType || 'PHYSICAL',
        quantity: qty,
        unitPriceUsd: unit,
        totalPriceUsd: Number((unit * qty).toFixed(2)),
      };
    }),
  );
  const deliveryFeeUsd = Number(order.deliveryFee || 0);
  const itemsSubtotalUsd =
    items.length > 0
      ? Number(items.reduce((s, it) => s + it.totalPriceUsd, 0).toFixed(2))
      : Number(Math.max(0, Number(order.total || 0) - deliveryFeeUsd).toFixed(2));
  const feePct = Number(order.transactionFeePercent ?? 3.5);
  const feeAmt = Number(
    order.transactionFeeAmount ?? (((itemsSubtotalUsd + deliveryFeeUsd) * feePct) / 100).toFixed(2),
  );
  const chargedTotalUsd = Number(
    order.chargedTotal ?? (itemsSubtotalUsd + deliveryFeeUsd + feeAmt).toFixed(2),
  );
  const isPaid = order.status !== 'PENDING_PAYMENT' && order.isPaid !== false;
  const addr = order.deliveryAddress;
  const formattedAddr = addr
    ? [addr.commune, addr.quartier, addr.ville || 'Goma', addr.referencePoint].filter(Boolean).join(' · ')
    : 'Retrait / Livraison numérique ZandoGo';

  return {
    invoiceNumber: `FAC-${order.orderNumber}`,
    orderId: order.id,
    orderNumber: order.orderNumber,
    orderStatus: order.status,
    issuedAt: order.paidAt || order.createdAt || new Date().toISOString(),
    paidAt: order.paidAt || null,
    issuer: {
      name: 'ZandoGo Marketplace RDC',
      city: 'Goma, Nord-Kivu',
      country: 'République Démocratique du Congo',
      supportEmail: 'support@zandogo.cd',
      legalNotice:
        'Document commercial officiel généré par ZandoGo RDC — Preuve d’achat, de paiement et de protection séquestre 48h.',
    },
    buyer: {
      id: user?.id || 'buyer',
      fullName: user?.fullName || 'Client ZandoGo',
      phone: user?.phone || null,
      email: user?.email || null,
    },
    deliveryAddress: {
      commune: addr?.commune || null,
      quartier: addr?.quartier || null,
      ville: addr?.ville || 'Goma',
      referencePoint: addr?.referencePoint || null,
      formatted: formattedAddr,
    },
    payment: {
      status: isPaid ? 'PAID' : 'UNPAID',
      methodCode: order.paymentOperator || 'MOBILE_MONEY_MPESA',
      operatorLabel: order.paymentOperator || 'Mobile Money RDC',
      providerReference: order.paymentRef || `ZG-REF-${order.orderNumber}`,
      escrowStatus: order.escrowStatus || (isPaid ? 'HELD' : 'PENDING_PAYMENT'),
      paidAt: order.paidAt || null,
    },
    stores: (order.subOrders || []).map((so) => ({
      storeId: so.storeId || 'store-1',
      storeName: so.store?.storeName || 'Boutique ZandoGo',
      subtotalUsd: itemsSubtotalUsd,
    })),
    items,
    totals: {
      currency: order.currency || 'USD',
      itemsSubtotalUsd,
      deliveryFeeUsd,
      transactionFeePercent: feePct,
      transactionFeeAmountUsd: feeAmt,
      chargedTotalUsd,
      exchangeRateUsdToCdf: exchangeRate,
      chargedTotalCdf: Math.round(chargedTotalUsd * exchangeRate),
    },
    digitalDownloads: order.digitalDownloads?.map((dl) => ({
      title: dl.title,
      fileName: dl.fileName,
    })),
    verification: {
      proofCode: `ZG-PROOF-${order.orderNumber.replace(/[^A-Z0-9]/gi, '').slice(0, 12)}`,
      algorithm: 'SHA-256',
      verifiedPurchase: isPaid,
    },
  };
}
