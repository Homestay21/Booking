const RATE_PER_NIGHT = 150;
const DEPOSIT = 100;
const WEB_APP_URL = 'PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE'; // Wajib tukar selepas Deploy Web App

const form = document.getElementById('bookingForm');
const checkin = document.getElementById('checkin');
const checkout = document.getElementById('checkout');
const malamEl = document.getElementById('malam');
const totalEl = document.getElementById('total');
const bakiEl = document.getElementById('baki');
const message = document.getElementById('message');
const tbody = document.querySelector('#bookingTable tbody');
const canvas = document.getElementById('signature');
const ctx = canvas.getContext('2d');
let drawing = false;
let activeStreams = {};

function money(n){ return 'RM' + Number(n || 0).toFixed(0); }
function getBookings(){ return JSON.parse(localStorage.getItem('homestayBookings') || '[]'); }
function saveBookings(bookings){ localStorage.setItem('homestayBookings', JSON.stringify(bookings)); }
function dateValue(id){ return new Date(document.getElementById(id).value + 'T00:00:00'); }
function calcNights(){
  if(!checkin.value || !checkout.value) return 0;
  const diff = (dateValue('checkout') - dateValue('checkin')) / (1000*60*60*24);
  return diff > 0 ? diff : 0;
}
function updateSummary(){
  const nights = calcNights();
  const total = nights * RATE_PER_NIGHT;
  const baki = Math.max(total - DEPOSIT, 0);
  malamEl.textContent = nights;
  totalEl.textContent = money(total);
  bakiEl.textContent = money(baki);
}
function overlaps(aStart, aEnd, bStart, bEnd){ return aStart < bEnd && bStart < aEnd; }
function hasOverlap(start, end){ return getBookings().some(b => overlaps(start, end, b.checkin, b.checkout)); }

function resizeCanvasForDisplay(){
  const data = canvas.toDataURL();
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  ctx.scale(ratio, ratio);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const img = new Image();
  img.onload = () => ctx.drawImage(img,0,0,rect.width,rect.height);
  img.src = data;
}
function pos(e){
  const rect = canvas.getBoundingClientRect();
  const t = e.touches ? e.touches[0] : e;
  return {x:t.clientX-rect.left, y:t.clientY-rect.top};
}
function startDraw(e){ drawing=true; ctx.beginPath(); const p=pos(e); ctx.moveTo(p.x,p.y); e.preventDefault(); }
function draw(e){ if(!drawing) return; const p=pos(e); ctx.lineTo(p.x,p.y); ctx.stroke(); e.preventDefault(); }
function stopDraw(){ drawing=false; }
canvas.addEventListener('mousedown', startDraw); canvas.addEventListener('mousemove', draw); canvas.addEventListener('mouseup', stopDraw); canvas.addEventListener('mouseleave', stopDraw);
canvas.addEventListener('touchstart', startDraw); canvas.addEventListener('touchmove', draw); canvas.addEventListener('touchend', stopDraw);
document.getElementById('clearSig').onclick = () => ctx.clearRect(0,0,canvas.width,canvas.height);
function signatureBlank(){
  const blank = document.createElement('canvas'); blank.width = canvas.width; blank.height = canvas.height;
  return canvas.toDataURL() === blank.toDataURL();
}

function cameraEls(side){
  const prefix = side === 'front' ? 'icFront' : 'icBack';
  return {
    video: document.getElementById(prefix + 'Video'),
    canvas: document.getElementById(prefix + 'Canvas'),
    preview: document.getElementById(prefix + 'Preview'),
    data: document.getElementById(prefix + 'Data'),
    file: document.getElementById(prefix + 'File')
  };
}
function stopCamera(side){
  if(activeStreams[side]){
    activeStreams[side].getTracks().forEach(track => track.stop());
    activeStreams[side] = null;
  }
  cameraEls(side).video.style.display = 'none';
}
async function openCamera(side){
  const els = cameraEls(side);
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    showCameraMessage('Browser ini tidak support kamera terus. Sila guna pilihan upload gambar.');
    return;
  }
  try{
    stopCamera(side);
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    activeStreams[side] = stream;
    els.video.srcObject = stream;
    els.video.style.display = 'block';
    els.preview.style.display = 'none';
    els.data.value = '';
  }catch(err){
    console.warn(err);
    showCameraMessage('Kamera tidak dapat dibuka. Pastikan website dibuka melalui HTTPS/localhost dan permission kamera dibenarkan. Anda masih boleh guna pilihan upload gambar.');
  }
}
function capturePhoto(side){
  const els = cameraEls(side);
  if(!activeStreams[side] || !els.video.videoWidth){
    showCameraMessage('Sila tekan Buka Kamera dahulu.');
    return;
  }
  els.canvas.width = els.video.videoWidth;
  els.canvas.height = els.video.videoHeight;
  els.canvas.getContext('2d').drawImage(els.video, 0, 0, els.canvas.width, els.canvas.height);
  const dataUrl = els.canvas.toDataURL('image/jpeg', 0.85);
  els.data.value = dataUrl;
  els.preview.src = dataUrl;
  els.preview.style.display = 'block';
  stopCamera(side);
}
function retakePhoto(side){
  const els = cameraEls(side);
  els.data.value = '';
  els.file.value = '';
  els.preview.removeAttribute('src');
  els.preview.style.display = 'none';
  openCamera(side);
}
function showCameraMessage(text){
  message.className = 'error';
  message.textContent = text;
}
function fileToBase64(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function setupFileFallback(side){
  const els = cameraEls(side);
  els.file.addEventListener('change', async () => {
    const file = els.file.files[0];
    if(!file){ els.preview.removeAttribute('src'); els.preview.style.display = 'none'; els.data.value = ''; return; }
    stopCamera(side);
    const dataUrl = await fileToBase64(file);
    els.data.value = dataUrl;
    els.preview.src = dataUrl;
    els.preview.style.display = 'block';
  });
}
setupFileFallback('front');
setupFileFallback('back');
document.querySelectorAll('[data-camera]').forEach(btn => btn.addEventListener('click', () => openCamera(btn.dataset.camera)));
document.querySelectorAll('[data-capture]').forEach(btn => btn.addEventListener('click', () => capturePhoto(btn.dataset.capture)));
document.querySelectorAll('[data-retake]').forEach(btn => btn.addEventListener('click', () => retakePhoto(btn.dataset.retake)));

function render(){
  tbody.innerHTML = '';
  getBookings().forEach(b => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${b.nama}</td><td>${b.telefon}</td><td>${b.checkin}</td><td>${b.checkout}</td><td>${b.malam}</td><td>${money(b.total)}</td><td>${money(b.baki)}</td><td>${b.status}</td><td>${b.pdpaTime}</td>`;
    tbody.appendChild(tr);
  });
}
async function sendToSheets(payload){
  if(!WEB_APP_URL || WEB_APP_URL.includes('PASTE_YOUR')) throw new Error('WEB_APP_URL belum diset dalam script.js');
  const res = await fetch(WEB_APP_URL, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify(payload)});
  const out = await res.json();
  if(!out.ok) { const err = new Error(out.message || 'Gagal simpan'); err.code = out.code; throw err; }
  return out;
}
form.addEventListener('submit', async e => {
  e.preventDefault(); message.className = ''; message.textContent = '';
  const nights = calcNights();
  if(nights < 1){ message.className='error'; message.textContent='Tarikh check-out mesti selepas check-in.'; return; }
  if(signatureBlank()){ message.className='error'; message.textContent='Sila tandatangan dahulu.'; return; }
  const icFrontImage = document.getElementById('icFrontData').value;
  const icBackImage = document.getElementById('icBackData').value;
  if(!icFrontImage || !icBackImage){ message.className='error'; message.textContent='Sila ambil gambar IC depan dan belakang dahulu.'; return; }
  if(hasOverlap(checkin.value, checkout.value)){
    message.className='error'; message.textContent='Booking overlap untuk tarikh ini. Sila pilih tarikh lain.'; return;
  }
  message.className=''; message.textContent='Sedang simpan booking...';
  const payload = {
    nama: document.getElementById('nama').value.trim(),
    telefon: document.getElementById('telefon').value.trim(),
    ic: document.getElementById('ic').value.trim(),
    checkin: checkin.value,
    checkout: checkout.value,
    icFrontImage,
    icBackImage,
    malam: nights,
    total: nights * RATE_PER_NIGHT,
    deposit: DEPOSIT,
    baki: Math.max((nights * RATE_PER_NIGHT) - DEPOSIT, 0),
    status: 'Confirmed',
    pdpaConsent: 'YES',
    pdpaTime: new Date().toLocaleString('ms-MY'),
    signature: canvas.toDataURL('image/png')
  };
  try{
    const result = await sendToSheets(payload);
    payload.bookingId = result.bookingId || '';
    const bookings = getBookings(); bookings.push(payload); saveBookings(bookings);
  }catch(err){
    console.warn(err);
    message.className='error';
    message.textContent = err.code === 'OVERLAP' ? 'Booking overlap. Tarikh ini baru sahaja ditempah pelanggan lain.' : 'Gagal simpan ke Google Sheets: ' + err.message;
    return;
  }
  render(); form.reset();
  ['front','back'].forEach(side => {
    stopCamera(side);
    const els = cameraEls(side);
    els.data.value = '';
    els.preview.style.display = 'none';
  });
  ctx.clearRect(0,0,canvas.width,canvas.height); updateSummary();
  message.className='success'; message.textContent='Booking berjaya direkod bersama gambar IC depan/belakang, consent PDPA dan tandatangan.';
});
checkin.addEventListener('change', updateSummary); checkout.addEventListener('change', updateSummary); window.addEventListener('resize', resizeCanvasForDisplay);
window.addEventListener('beforeunload', () => { stopCamera('front'); stopCamera('back'); });
resizeCanvasForDisplay(); updateSummary(); render();
