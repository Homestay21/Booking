SETUP HOMESTAY21 BOOKING SYSTEM

A. Fail web
1. Upload index.html, style.css, script.js ke GitHub / Netlify / hosting biasa.
2. Dalam script.js, tukar WEB_APP_URL kepada URL Google Apps Script Web App.

B. Google Sheet
1. Buat Google Sheet baru.
2. Copy Spreadsheet ID dari URL.
3. Paste dalam Code.gs pada SPREADSHEET_ID.

C. Google Drive
1. Buat folder baru untuk simpan IC dan signature.
2. Copy Folder ID dari URL.
3. Paste dalam Code.gs pada DRIVE_FOLDER_ID.

D. Google Calendar
1. Buat calendar baru: Homestay21 Booking.
2. Settings calendar > Integrate calendar > copy Calendar ID.
3. Paste dalam Code.gs pada CALENDAR_ID.

E. Google Apps Script
1. Pergi script.google.com > New project.
2. Paste semua kod dari Code.gs.
3. Klik Deploy > New deployment > Web app.
4. Execute as: Me.
5. Who has access: Anyone.
6. Deploy dan copy Web App URL.
7. Paste URL itu dalam script.js.

F. Test
1. Buka web booking.
2. Isi tarikh, detail, upload IC depan belakang, sign, tick consent, submit.
3. Semak Google Sheet, Drive folder, dan Google Calendar.

NOTA
- Sistem akan block calendar dari jam 3.00 petang check-in hingga 12.00 tengah hari check-out.
- Jika tarikh clash dengan event BOOKED, booking baru akan ditolak.
- Status default di Sheet ialah PENDING PAYMENT. Admin boleh tukar manual kepada PAID / CANCELLED.
