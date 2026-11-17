import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { PDFFont, PDFImage, PDFPage } from 'pdf-lib';
import { formatFileSize } from './fileUtils';
import type { PassengerDocumentFull, PassengerFullRecord } from '../types';

function dataUrlToBytes(dataUrl: string): { mime: string; bytes: Uint8Array } {
  const parts = dataUrl.split(',');
  const header = parts[0] || '';
  const base64 = parts[1] || '';
  const mimeMatch = header.match(/data:([^;]+);/);
  const mime = mimeMatch ? mimeMatch[1].toLowerCase() : 'application/octet-stream';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return { mime, bytes };
}

async function normalizeImageToJpegBytes(dataUrl: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 400;
      canvas.height = img.naturalHeight || 400;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const jpegUrl = canvas.toDataURL('image/jpeg', 0.9);
      resolve(dataUrlToBytes(jpegUrl).bytes);
    };
    img.onerror = () => reject(new Error('Unable to decode image'));
    img.src = dataUrl;
  });
}

async function embedAnyImage(
  pdfDoc: PDFDocument,
  dataUrl: string
): Promise<PDFImage | null> {
  try {
    const { mime, bytes } = dataUrlToBytes(dataUrl);
    if (mime === 'image/png') {
      return await pdfDoc.embedPng(bytes);
    }
    if (mime === 'image/jpeg' || mime === 'image/jpg') {
      return await pdfDoc.embedJpg(bytes);
    }
    const jpegBytes = await normalizeImageToJpegBytes(dataUrl);
    return await pdfDoc.embedJpg(jpegBytes);
  } catch {
    try {
      const jpegBytes = await normalizeImageToJpegBytes(dataUrl);
      return await pdfDoc.embedJpg(jpegBytes);
    } catch {
      return null;
    }
  }
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string[] {
  const safeText = (text || '').replace(/\r?\n/g, ' ').trim();
  if (!safeText) return ['—'];
  const words = safeText.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function triggerBlobDownload(bytes: Uint8Array, fileName: string) {
  const copy = new Uint8Array(bytes);
  const blob = new Blob([copy.buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function generatePassengerDossierPdf(
  record: PassengerFullRecord
): Promise<Uint8Array> {
  const {
    passenger,
    familyMembers,
    emergencyContact,
    documents,
    services,
    financialSummary,
  } = record;

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;

  const slate900 = rgb(0.06, 0.09, 0.16);
  const slate600 = rgb(0.28, 0.33, 0.41);
  const slate400 = rgb(0.58, 0.64, 0.72);
  const borderGray = rgb(0.85, 0.88, 0.92);
  const blueAccent = rgb(0.11, 0.31, 0.85);
  const emerald = rgb(0.09, 0.5, 0.24);
  const crimson = rgb(0.75, 0.14, 0.14);

  let page: PDFPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const addNewPage = () => {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
    page.drawText(
      `TOYA AIR TRAVELS · ${passenger.fullName} (${passenger.passengerIdNumber})`,
      { x: margin, y, size: 8, font: fontRegular, color: slate400 }
    );
    y -= 20;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < margin + 20) {
      addNewPage();
    }
  };

  const drawSectionHeader = (title: string) => {
    ensureSpace(36);
    y -= 8;
    page.drawText(title, {
      x: margin,
      y,
      size: 11,
      font: fontBold,
      color: blueAccent,
    });
    y -= 6;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.75,
      color: borderGray,
    });
    y -= 14;
  };

  const drawField = (
    label: string,
    value: string,
    x: number,
    colWidth: number,
    atY: number
  ): number => {
    page.drawText(label, {
      x,
      y: atY,
      size: 8,
      font: fontRegular,
      color: slate600,
    });
    const lines = wrapText(value || '—', fontBold, 9.5, colWidth - 6);
    let lineY = atY - 12;
    for (const line of lines) {
      page.drawText(line, {
        x,
        y: lineY,
        size: 9.5,
        font: fontBold,
        color: slate900,
      });
      lineY -= 12;
    }
    return lineY - 4;
  };

  // Top Header Banner
  page.drawRectangle({
    x: margin,
    y: y - 52,
    width: contentWidth,
    height: 54,
    color: slate900,
  });
  page.drawText('TOYA AIR TRAVELS', {
    x: margin + 14,
    y: y - 22,
    size: 15,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText('PERMANENT PASSENGER DOSSIER', {
    x: margin + 14,
    y: y - 38,
    size: 8.5,
    font: fontRegular,
    color: rgb(0.78, 0.84, 0.92),
  });
  const idText = `ID: ${passenger.passengerIdNumber}`;
  const idWidth = fontBold.widthOfTextAtSize(idText, 10);
  page.drawText(idText, {
    x: pageWidth - margin - idWidth - 14,
    y: y - 22,
    size: 10,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  const dateStr = `Exported: ${new Date().toISOString().slice(0, 10)}`;
  const dateWidth = fontRegular.widthOfTextAtSize(dateStr, 8);
  page.drawText(dateStr, {
    x: pageWidth - margin - dateWidth - 14,
    y: y - 38,
    size: 8,
    font: fontRegular,
    color: rgb(0.78, 0.84, 0.92),
  });

  y -= 68;

  // Section 1: Passenger Information + Passport Photo
  drawSectionHeader('01. PASSENGER INFORMATION');

  const photoW = 84;
  const photoH = 102;
  const photoX = pageWidth - margin - photoW;
  const photoTopY = y;

  page.drawRectangle({
    x: photoX,
    y: photoTopY - photoH,
    width: photoW,
    height: photoH,
    borderWidth: 0.75,
    borderColor: borderGray,
    color: rgb(0.97, 0.98, 0.99),
  });

  if (passenger.passportPhotoData) {
    const embedded = await embedAnyImage(pdfDoc, passenger.passportPhotoData);
    if (embedded) {
      page.drawImage(embedded, {
        x: photoX + 2,
        y: photoTopY - photoH + 2,
        width: photoW - 4,
        height: photoH - 4,
      });
    }
  } else {
    page.drawText('No Photo', {
      x: photoX + 20,
      y: photoTopY - 54,
      size: 8,
      font: fontRegular,
      color: slate400,
    });
  }

  const infoWidth = contentWidth - photoW - 18;
  const col2 = infoWidth / 2;
  let nextY = drawField('Full Name', passenger.fullName, margin, col2, y);
  const yRight1 = drawField(
    'Passport Number',
    passenger.passportNumber || '—',
    margin + col2,
    col2,
    y
  );
  y = Math.min(nextY, yRight1);

  nextY = drawField('Date of Birth', passenger.dateOfBirth, margin, col2, y);
  const yRight2 = drawField('Sex / Nationality', `${passenger.sex} · ${passenger.nationality}`, margin + col2, col2, y);
  y = Math.min(nextY, yRight2);

  nextY = drawField('NID Number', passenger.nidNumber || '—', margin, col2, y);
  const yRight3 = drawField(
    'Birth Registration No.',
    passenger.birthRegistrationNumber || '—',
    margin + col2,
    col2,
    y
  );
  y = Math.min(nextY, yRight3);

  y = Math.min(y, photoTopY - photoH - 12);

  const fullCol2 = contentWidth / 2;
  nextY = drawField(
    'Mobile Number',
    passenger.mobileNumber || '—',
    margin,
    fullCol2,
    y
  );
  const yWa = drawField(
    'WhatsApp Number',
    passenger.whatsappNumber || '—',
    margin + fullCol2,
    fullCol2,
    y
  );
  y = Math.min(nextY, yWa);

  y = drawField(
    'Present Address',
    passenger.presentAddress || '—',
    margin,
    contentWidth,
    y
  );

  // Section 2: Family Contact Information
  drawSectionHeader('02. FAMILY CONTACT INFORMATION');
  if (familyMembers.length === 0) {
    page.drawText('No family contacts recorded.', {
      x: margin,
      y,
      size: 9,
      font: fontRegular,
      color: slate600,
    });
    y -= 18;
  } else {
    for (const member of familyMembers) {
      ensureSpace(20);
      page.drawText(`${member.relation}:`, {
        x: margin,
        y,
        size: 9,
        font: fontBold,
        color: slate600,
      });
      page.drawText(member.fullName, {
        x: margin + 78,
        y,
        size: 9.5,
        font: fontBold,
        color: slate900,
      });
      if (member.mobileNumber) {
        page.drawText(member.mobileNumber, {
          x: margin + 290,
          y,
          size: 9,
          font: fontRegular,
          color: slate900,
        });
      }
      if (member.notes) {
        page.drawText(member.notes, {
          x: margin + 400,
          y,
          size: 8.5,
          font: fontRegular,
          color: slate600,
        });
      }
      y -= 15;
    }
    y -= 4;
  }

  // Section 3: Emergency Contact Details
  drawSectionHeader('03. EMERGENCY CONTACT DETAILS');
  if (!emergencyContact) {
    page.drawText('No emergency contact recorded.', {
      x: margin,
      y,
      size: 9,
      font: fontRegular,
      color: slate600,
    });
    y -= 18;
  } else {
    ensureSpace(85);
    const emPhotoSize = 68;
    const emPhotoX = pageWidth - margin - emPhotoSize;
    const emTopY = y;

    if (emergencyContact.photoData) {
      page.drawRectangle({
        x: emPhotoX,
        y: emTopY - emPhotoSize,
        width: emPhotoSize,
        height: emPhotoSize,
        borderWidth: 0.75,
        borderColor: borderGray,
      });
      const emImg = await embedAnyImage(pdfDoc, emergencyContact.photoData);
      if (emImg) {
        page.drawImage(emImg, {
          x: emPhotoX + 2,
          y: emTopY - emPhotoSize + 2,
          width: emPhotoSize - 4,
          height: emPhotoSize - 4,
        });
      }
    }

    const emWidth = emergencyContact.photoData
      ? contentWidth - emPhotoSize - 16
      : contentWidth;
    const emCol = emWidth / 2;
    const ey1 = drawField(
      'Contact Name',
      emergencyContact.contactName,
      margin,
      emCol,
      y
    );
    const ey2 = drawField(
      'Relationship & Mobile',
      `${emergencyContact.relationship || 'Emergency'} · ${emergencyContact.mobileNumber || '—'}`,
      margin + emCol,
      emCol,
      y
    );
    y = Math.min(ey1, ey2);
    y = drawField(
      'Address',
      emergencyContact.address || '—',
      margin,
      emWidth,
      y
    );
    if (emergencyContact.photoData) {
      y = Math.min(y, emTopY - emPhotoSize - 10);
    }
  }

  // Section 4: Documents & Remarks
  drawSectionHeader('04. DOCUMENTS & REMARKS');
  const checkedCats =
    passenger.selectedDocumentCategories &&
    passenger.selectedDocumentCategories.length > 0
      ? passenger.selectedDocumentCategories.join(', ')
      : 'None selected';
  y = drawField(
    `Selected Document Categories (${passenger.selectedDocumentCategories?.length || 0})`,
    checkedCats,
    margin,
    contentWidth,
    y
  );

  if (documents.length > 0) {
    ensureSpace(24);
    page.drawText(`Archived Cloud Documents (${documents.length}):`, {
      x: margin,
      y,
      size: 8.5,
      font: fontBold,
      color: slate600,
    });
    y -= 13;
    for (const d of documents) {
      ensureSpace(16);
      page.drawText(`• ${d.category}: ${d.fileName} (${formatFileSize(d.fileSize)})`, {
        x: margin + 8,
        y,
        size: 8.5,
        font: fontRegular,
        color: slate900,
      });
      y -= 13;
    }
    y -= 4;
  }

  if (passenger.additionalDocumentsNote) {
    y = drawField(
      'Additional Documents',
      passenger.additionalDocumentsNote,
      margin,
      contentWidth,
      y
    );
  }
  if (passenger.remarks) {
    y = drawField('Remarks / Notes', passenger.remarks, margin, contentWidth, y);
  }

  // Section 5: Services & Financial Summary
  drawSectionHeader('05. PASSENGER SERVICES & FINANCIAL LEDGER');
  ensureSpace(40);

  page.drawRectangle({
    x: margin,
    y: y - 34,
    width: contentWidth,
    height: 36,
    color: rgb(0.97, 0.98, 0.99),
    borderWidth: 0.75,
    borderColor: borderGray,
  });
  page.drawText(
    `Total Charge: ${financialSummary.totalCharge.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    { x: margin + 12, y: y - 21, size: 9.5, font: fontBold, color: slate900 }
  );
  page.drawText(
    `Total Paid: ${financialSummary.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    { x: margin + 190, y: y - 21, size: 9.5, font: fontBold, color: emerald }
  );
  page.drawText(
    `Due Balance: ${financialSummary.dueAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    {
      x: margin + 360,
      y: y - 21,
      size: 9.5,
      font: fontBold,
      color: financialSummary.dueAmount > 0 ? crimson : slate900,
    }
  );
  y -= 50;

  if (services.length === 0) {
    page.drawText('No agency services assigned yet.', {
      x: margin,
      y,
      size: 9,
      font: fontRegular,
      color: slate600,
    });
  } else {
    for (const s of services) {
      ensureSpace(36);
      page.drawText(
        `${s.serviceType}${s.destinationCountry ? ` (${s.destinationCountry})` : ''} — Status: ${s.processingStatus}`,
        { x: margin, y, size: 9.5, font: fontBold, color: slate900 }
      );
      y -= 13;
      page.drawText(
        `Ref: ${s.referenceNumber || '—'} · Charge: ${s.currency} ${s.totalCharge.toLocaleString()} · Paid: ${s.currency} ${s.totalPaid.toLocaleString()} · Due: ${s.currency} ${s.dueAmount.toLocaleString()}`,
        { x: margin + 8, y, size: 8.5, font: fontRegular, color: slate600 }
      );
      y -= 16;
    }
  }

  return await pdfDoc.save();
}

export async function generateCombinedDocumentsPacketPdf(
  passengerName: string,
  passengerIdNumber: string,
  docs: PassengerDocumentFull[]
): Promise<Uint8Array> {
  const packetPdf = await PDFDocument.create();
  const fontBold = await packetPdf.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await packetPdf.embedFont(StandardFonts.Helvetica);

  const a4W = 595.28;
  const a4H = 841.89;
  const margin = 36;

  for (const doc of docs) {
    const isPdf =
      doc.mimeType === 'application/pdf' ||
      doc.fileName.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      try {
        const { bytes } = dataUrlToBytes(doc.fileData);
        const srcPdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const copiedPages = await packetPdf.copyPages(
          srcPdf,
          srcPdf.getPageIndices()
        );
        for (const p of copiedPages) {
          packetPdf.addPage(p);
        }
        continue;
      } catch {
        // Fallback summary page if PDF couldn't be parsed
        const page = packetPdf.addPage([a4W, a4H]);
        page.drawText(`Document: ${doc.fileName} (${doc.category})`, {
          x: margin,
          y: a4H - 60,
          size: 12,
          font: fontBold,
        });
        page.drawText('Unable to merge encrypted or malformed PDF stream.', {
          x: margin,
          y: a4H - 84,
          size: 10,
          font: fontRegular,
        });
        continue;
      }
    }

    // Image document -> render onto A4 page with header
    const page = packetPdf.addPage([a4W, a4H]);
    page.drawText(
      `TOYA AIR TRAVELS · ${passengerName} (${passengerIdNumber})`,
      {
        x: margin,
        y: a4H - margin,
        size: 9,
        font: fontBold,
        color: rgb(0.11, 0.31, 0.85),
      }
    );
    page.drawText(`${doc.category} — ${doc.fileName}`, {
      x: margin,
      y: a4H - margin - 14,
      size: 10,
      font: fontRegular,
      color: rgb(0.2, 0.25, 0.33),
    });

    const embedded = await embedAnyImage(packetPdf, doc.fileData);
    if (embedded) {
      const availW = a4W - margin * 2;
      const availH = a4H - margin * 2 - 36;
      const scale = Math.min(
        availW / embedded.width,
        availH / embedded.height,
        1
      );
      const drawW = embedded.width * scale;
      const drawH = embedded.height * scale;
      const drawX = margin + (availW - drawW) / 2;
      const drawY = margin + (availH - drawH) / 2;
      page.drawImage(embedded, {
        x: drawX,
        y: drawY,
        width: drawW,
        height: drawH,
      });
    }
  }

  return await packetPdf.save();
}
