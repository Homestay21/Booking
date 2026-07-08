const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbznGeEvjAkIujyTWWVYjZsVMTKD40i5S5qpOp9vTRI-lfwyzW602bcx8tPso_6tkuvLuQ/exec';
const NIGHTLY_RATE = 150;
const DEPOSIT = 100;

const form = document.getElementById('bookingForm');
const checkIn = document.getElementById('checkIn');
const checkOut = document.getElementById('checkOut');
const priceSummary = document.getElementById('priceSummary');
const statusEl = document.getElementById('status');
const submitBtn = document.getElementById('submitBtn');
const canvas = document.getElementById('signaturePad');
const ctx = canvas.getContext('2d');
let drawing = false;
let hasSignature = false;

function setMinDates() {
  const today = new Date().toISOString().split('T')[0];
  checkIn.min = today;
  checkOut.min = today;
}
setMinDates();

function nightsBetween(a, b) {
  if (!a || !b) return 0;
  const start = new Date(a + 'T00:00:00');
  const end = new Date(b + 'T00:00:00');
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

function updatePrice() {
  if (checkIn.value) checkOut.min = checkIn.value;
  const nights = nightsBetween(checkIn.value, checkOut.value);
  if (nights <= 0) {
    priceSummary.textContent = 'Pilih tarikh check-out selepas check-in.';
    return;
  }
  const stayTotal = nights * NIGHTLY_RATE;
  const total = stayTotal + DEPOSIT;
  priceSummary.innerHTML = `${nights} malam × RM${NIGHTLY_RATE} = RM${stayTotal}<br>Deposit keselamatan: RM${DEPOSIT}<br><strong>Jumlah perlu dibayar: RM${total}</strong>`;
}
checkIn.addEventListener('change', updatePrice);
checkOut.addEventListener('change', updatePrice);

function pos(e) {
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches && e.touches[0];
  return {
    x: ((touch ? touch.clientX : e.clientX) - rect.left) * (canvas.width / rect.width),
    y: ((touch ? touch.clientY : e.clientY) - rect.top) * (canvas.height / rect.height)
  };
}
function startDraw(e) { drawing = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); e.preventDefault(); }
function draw(e) { if (!drawing) return; const p = pos(e); ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.strokeStyle = '#111827'; ctx.lineTo(p.x, p.y); ctx.stroke(); hasSignature = true; e.preventDefault(); }
function stopDraw() { drawing = false; }
canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDraw);
canvas.addEventListener('mouseleave', stopDraw);
canvas.addEventListener('touchstart', startDraw, { passive:false });
canvas.addEventListener('touchmove', draw, { passive:false });
canvas.addEventListener('touchend', stopDraw);
document.getElementById('clearSignature').addEventListener('click', () => { ctx.clearRect(0, 0, canvas.width, canvas.height); hasSignature = false; });

const MAX_IMAGE_WIDTH = 1280;
const MAX_IMAGE_HEIGHT = 1280;
const JPG_QUALITY = 0.72;

function updateFileInfo(inputId, infoId) {
  const input = document.getElementById(inputId);
  const info = document.getElementById(infoId);
  if (!input || !info) return;
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if (!file) {
      info.textContent = 'Format automatik: JPG kecil';
      return;
    }
    const mb = (file.size / 1024 / 1024).toFixed(2);
    info.textContent = `Gambar dipilih: ${mb}MB. Akan dikompres automatik sebelum dihantar.`;
  });
}
updateFileInfo('icFront', 'icFrontInfo');
updateFileInfo('icBack', 'icBackInfo');

function compressImageToBase64(file, outputName) {
  return new Promise((resolve, reject) => {
    if (!file || !(file instanceof File)) return reject(new Error('Sila ambil gambar IC yang lengkap.'));

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal baca gambar IC.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format gambar tidak disokong. Sila ambil gambar semula.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        const scale = Math.min(MAX_IMAGE_WIDTH / width, MAX_IMAGE_HEIGHT / height, 1);
        width = Math.round(width * scale);
        height = Math.round(height * scale);

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(img, 0, 0, width, height);

        const dataUrl = tempCanvas.toDataURL('image/jpeg', JPG_QUALITY);
        resolve({
          name: outputName + '.jpg',
          type: 'image/jpeg',
          data: dataUrl.split(',')[1]
        });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  statusEl.className = '';
  statusEl.textContent = '';

  const nights = nightsBetween(checkIn.value, checkOut.value);
  if (nights <= 0) return showError('Tarikh check-out mesti selepas check-in.');
  if (!hasSignature) return showError('Sila tandatangan consent pelanggan dahulu.');
  if (WEB_APP_URL.includes('PASTE_')) return showError('Admin belum masukkan Google Apps Script Web App URL dalam script.js.');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Menghantar...';

  try {
    const fd = new FormData(form);
    const payload = {
      homestayName: 'homestay21',
      fullName: fd.get('fullName'),
      phone: fd.get('phone'),
      icNo: fd.get('icNo'),
      vehicleNo: fd.get('vehicleNo') || '',
      checkIn: fd.get('checkIn'),
      checkOut: fd.get('checkOut'),
      nights,
      nightlyRate: NIGHTLY_RATE,
      deposit: DEPOSIT,
      total: nights * NIGHTLY_RATE + DEPOSIT,
      pdpaConsent: fd.get('pdpaConsent') === 'on',
      signature: canvas.toDataURL('image/png').split(',')[1],
      icFront: await compressImageToBase64(fd.get('icFront'), 'ic-depan'),
      icBack: await compressImageToBase64(fd.get('icBack'), 'ic-belakang')
    };

    const res = await fetch(WEB_APP_URL, { method:'POST', body: JSON.stringify(payload) });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Booking gagal dihantar.');

    statusEl.className = 'success';
    statusEl.innerHTML = `Booking berjaya dihantar. Status: <strong>${data.status}</strong>. ${data.message || ''}`;
    form.reset();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasSignature = false;
    updatePrice();
  } catch (err) {
    showError(err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Hantar Booking';
  }
});

function showError(msg) {
  statusEl.className = 'error';
  statusEl.textContent = msg;
}
