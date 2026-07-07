/*******************************************************
 * HOMESTAY PDPA BOOKING SYSTEM - GOOGLE APPS SCRIPT
 * Spreadsheet ID sudah dimasukkan.
 * Anda hanya perlu masukkan DRIVE_FOLDER_ID.
 *******************************************************/

const SPREADSHEET_ID = '1rmR69nA-QOWIbw9Ai5NgTaIZTJvrV2QpIgN2F7-lF4k';
const DRIVE_FOLDER_ID = '1q-5Iqr1JeAzWcjwKym-RFWFTmm9rv749';
const SHEET_NAME = 'Bookings';
const RATE_PER_NIGHT = 150;
const DEPOSIT_AMOUNT = 100;

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      let sheet = ss.getSheetByName(SHEET_NAME);
      if (!sheet) sheet = setupSheet_(ss);

      const checkIn = new Date(data.checkIn);
      const checkOut = new Date(data.checkOut);

      if (!data.customerName || !data.phone || !data.checkIn || !data.checkOut) {
        return json_({ success: false, message: 'Maklumat wajib belum lengkap.' });
      }

      if (checkOut <= checkIn) {
        return json_({ success: false, message: 'Tarikh check-out mesti selepas check-in.' });
      }

      if (hasOverlap_(sheet, checkIn, checkOut)) {
        return json_({ success: false, message: 'Tarikh ini sudah ditempah. Sila pilih tarikh lain.' });
      }

      const nights = Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      const total = nights * RATE_PER_NIGHT;
      const balance = total - DEPOSIT_AMOUNT;

      const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
      const bookingRef = 'HST-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');

      const icFrontUrl = saveBase64File_(folder, data.icFrontBase64, bookingRef + '_IC_DEPAN.png');
      const icBackUrl = saveBase64File_(folder, data.icBackBase64, bookingRef + '_IC_BELAKANG.png');
      const signatureUrl = saveBase64File_(folder, data.signatureBase64, bookingRef + '_SIGNATURE.png');

      sheet.appendRow([
        new Date(),
        bookingRef,
        data.customerName || '',
        data.phone || '',
        data.icNumber || '',
        data.email || '',
        checkIn,
        checkOut,
        nights,
        RATE_PER_NIGHT,
        DEPOSIT_AMOUNT,
        total,
        balance,
        data.pdpaConsent === true || data.pdpaConsent === 'true' ? 'YES' : 'NO',
        icFrontUrl,
        icBackUrl,
        signatureUrl,
        'CONFIRMED',
        data.notes || ''
      ]);

      return json_({
        success: true,
        message: 'Booking berjaya dihantar.',
        bookingRef: bookingRef,
        nights: nights,
        total: total,
        deposit: DEPOSIT_AMOUNT,
        balance: balance
      });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json_({ success: false, message: err.message });
  }
}

function setupSheet_(ss) {
  const sheet = ss.insertSheet(SHEET_NAME);
  sheet.appendRow([
    'Timestamp',
    'Booking Ref',
    'Nama Pelanggan',
    'No Telefon',
    'No IC',
    'Email',
    'Check-In',
    'Check-Out',
    'Jumlah Malam',
    'Kadar Per Malam',
    'Deposit',
    'Jumlah Bayaran',
    'Baki',
    'PDPA Consent',
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
    const existingCheckIn = new Date(rows[i][6]);
    const existingCheckOut = new Date(rows[i][7]);
    const status = String(rows[i][17] || '').toUpperCase();

    if (status === 'CANCELLED' || status === 'CANCELED') continue;

    // Overlap berlaku jika check-in baru sebelum check-out lama
    // DAN check-out baru selepas check-in lama.
    // Contoh: booking 10-12 dan booking baru 12-14 = tidak overlap.
    if (newCheckIn < existingCheckOut && newCheckOut > existingCheckIn) {
      return true;
    }
  }
  return false;
}

function saveBase64File_(folder, base64Data, fileName) {
  if (!base64Data) return '';
  const cleanBase64 = String(base64Data).replace(/^data:image\/[a-zA-Z]+;base64,/, '');
  const blob = Utilities.newBlob(Utilities.base64Decode(cleanBase64), 'image/png', fileName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function setupBookingsSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = setupSheet_(ss);
  return 'Sheet ready: ' + SHEET_NAME;
}
