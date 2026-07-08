/*******************************************************
 * HOMESTAY PDPA BOOKING SYSTEM V5 - GOOGLE APPS SCRIPT
 * Spreadsheet ID dan Drive Folder ID sudah dimasukkan.
 *******************************************************/

const SPREADSHEET_ID = '1rmR69nA-QOWIbw9Ai5NgTaIZTJvrV2QpIgN2F7-lF4k';
const DRIVE_FOLDER_ID = '1q-5Iqr1JeAzWcjwKym-RFWFTmm9rv749';
const SHEET_NAME = 'Bookings';
const RATE_PER_NIGHT = 150;
const DEPOSIT_AMOUNT = 100;

function doGet() {
  return json_({ ok: true, success: true, message: 'Homestay Booking API aktif.' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    lock.waitLock(30000);

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = setupSheet_(ss);

    const name = data.customerName || data.nama || '';
    const phone = data.phone || data.telefon || '';
    const icNumber = data.icNumber || data.ic || '';
    const checkInRaw = data.checkIn || data.checkin || '';
    const checkOutRaw = data.checkOut || data.checkout || '';

    if (!name || !phone || !icNumber || !checkInRaw || !checkOutRaw) {
      return json_({ ok: false, success: false, message: 'Maklumat wajib belum lengkap.' });
    }
    if (!data.icFrontBase64 && !data.icFrontImage) {
      return json_({ ok: false, success: false, message: 'Gambar IC depan belum ada.' });
    }
    if (!data.icBackBase64 && !data.icBackImage) {
      return json_({ ok: false, success: false, message: 'Gambar IC belakang belum ada.' });
    }
    if (!data.signatureBase64 && !data.signature) {
      return json_({ ok: false, success: false, message: 'Tandatangan belum ada.' });
    }
    if (!(data.pdpaConsent === true || data.pdpaConsent === 'true' || data.pdpaConsent === 'YES')) {
      return json_({ ok: false, success: false, message: 'Persetujuan PDPA/peraturan belum ditick.' });
    }

    const checkIn = parseDateOnly_(checkInRaw);
    const checkOut = parseDateOnly_(checkOutRaw);
    if (checkOut <= checkIn) {
      return json_({ ok: false, success: false, message: 'Tarikh check-out mesti selepas check-in.' });
    }

    if (hasOverlap_(sheet, checkIn, checkOut)) {
      return json_({ ok: false, success: false, code: 'OVERLAP', message: 'Tarikh ini sudah ditempah. Sila pilih tarikh lain.' });
    }

    const nights = Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    const total = nights * RATE_PER_NIGHT;
    const balance = Math.max(total - DEPOSIT_AMOUNT, 0);

    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const bookingRef = 'HST-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');

    const icFrontUrl = saveBase64File_(folder, data.icFrontBase64 || data.icFrontImage, bookingRef + '_IC_DEPAN.jpg');
    const icBackUrl = saveBase64File_(folder, data.icBackBase64 || data.icBackImage, bookingRef + '_IC_BELAKANG.jpg');
    const signatureUrl = saveBase64File_(folder, data.signatureBase64 || data.signature, bookingRef + '_SIGNATURE.png');

    sheet.appendRow([
      new Date(),
      bookingRef,
      name,
      phone,
      icNumber,
      checkIn,
      checkOut,
      nights,
      RATE_PER_NIGHT,
      DEPOSIT_AMOUNT,
      total,
      balance,
      'YES',
      data.consentText || 'Pelanggan bersetuju dengan PDPA dan peraturan homestay.',
      icFrontUrl,
      icBackUrl,
      signatureUrl,
      'CONFIRMED',
      data.notes || ''
    ]);

    return json_({
      ok: true,
      success: true,
      message: 'Booking berjaya dihantar.',
      bookingRef: bookingRef,
      nights: nights,
      total: total,
      deposit: DEPOSIT_AMOUNT,
      balance: balance
    });
  } catch (err) {
    return json_({ ok: false, success: false, message: err.message });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function setupSheet_(ss) {
  const sheet = ss.insertSheet(SHEET_NAME);
  sheet.appendRow([
    'Timestamp',
    'Booking Ref',
    'Nama Pelanggan',
    'No Telefon',
    'No IC / Passport',
    'Check-In',
    'Check-Out',
    'Jumlah Malam',
    'Kadar Per Malam',
    'Deposit',
    'Jumlah Bayaran',
    'Baki',
    'PDPA & Rules Consent',
    'Consent Text',
    'Gambar IC Depan',
    'Gambar IC Belakang',
    'Tandatangan',
    'Status',
    'Catatan'
  ]);
  sheet.setFrozenRows(1);
  return sheet;
}

function hasOverlap_(sheet, newCheckIn, newCheckOut) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  const rows = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  for (let i = 0; i < rows.length; i++) {
    const existingCheckIn = new Date(rows[i][5]);
    const existingCheckOut = new Date(rows[i][6]);
    const status = String(rows[i][17] || '').toUpperCase();
    if (status === 'CANCELLED' || status === 'CANCELED') continue;
    // Booking 10-12 dan booking baru 12-14 tidak overlap.
    if (newCheckIn < existingCheckOut && newCheckOut > existingCheckIn) return true;
  }
  return false;
}

function parseDateOnly_(value) {
  const parts = String(value).split('-');
  if (parts.length === 3) return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return new Date(value);
}

function saveBase64File_(folder, base64Data, fileName) {
  if (!base64Data) return '';
  const mimeMatch = String(base64Data).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
  const cleanBase64 = String(base64Data).replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
  const blob = Utilities.newBlob(Utilities.base64Decode(cleanBase64), mimeType, fileName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function setupBookingsSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = setupSheet_(ss);
  return 'Sheet ready: ' + SHEET_NAME;
}
