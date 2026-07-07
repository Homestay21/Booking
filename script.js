const RATE_PER_NIGHT = 150;
const DEPOSIT = 100;
const WEB_APP_URL = ''; // Paste Google Apps Script Web App URL here if you want auto-save to Google Sheets

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
function overlaps(aStart, aEnd, bStart, bEnd){
  return aStart < bEnd && bStart < aEnd;
}
function hasOverlap(unit, start, end){
  return getBookings().some(b => b.unit === unit && overlaps(start, end, b.checkin, b.checkout));
}
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
function render(){
  tbody.innerHTML = '';
  getBookings().forEach(b => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${b.nama}</td><td>${b.telefon}</td><td>${b.unit}</td><td>${b.checkin}</td><td>${b.checkout}</td><td>${b.malam}</td><td>${money(b.total)}</td><td>${money(b.baki)}</td><td>${b.status}</td><td>${b.pdpaTime}</td>`;
    tbody.appendChild(tr);
  });
}
async function sendToSheets(payload){
  if(!WEB_APP_URL) return;
  await fetch(WEB_APP_URL, {method:'POST', mode:'no-cors', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
}
form.addEventListener('submit', async e => {
  e.preventDefault(); message.className = ''; message.textContent = '';
  const nights = calcNights();
  if(nights < 1){ message.className='error'; message.textContent='Tarikh check-out mesti selepas check-in.'; return; }
  if(signatureBlank()){ message.className='error'; message.textContent='Sila tandatangan dahulu.'; return; }
  const payload = {
    nama: document.getElementById('nama').value.trim(),
    telefon: document.getElementById('telefon').value.trim(),
    ic: document.getElementById('ic').value.trim(),
    unit: document.getElementById('unit').value,
    checkin: checkin.value,
    checkout: checkout.value,
    icLink: document.getElementById('icLink').value.trim(),
    malam: nights,
    total: nights * RATE_PER_NIGHT,
    deposit: DEPOSIT,
    baki: Math.max((nights * RATE_PER_NIGHT) - DEPOSIT, 0),
    status: 'Confirmed',
    pdpaConsent: 'YES',
    pdpaTime: new Date().toLocaleString('ms-MY'),
    signature: canvas.toDataURL('image/png')
  };
  if(hasOverlap(payload.unit, payload.checkin, payload.checkout)){
    message.className='error'; message.textContent='Booking overlap untuk unit dan tarikh ini. Sila pilih tarikh lain.'; return;
  }
  const bookings = getBookings(); bookings.push(payload); saveBookings(bookings);
  try{ await sendToSheets(payload); }catch(err){ console.warn(err); }
  render(); form.reset(); ctx.clearRect(0,0,canvas.width,canvas.height); updateSummary();
  message.className='success'; message.textContent='Booking berjaya direkod bersama consent PDPA dan tandatangan.';
});
checkin.addEventListener('change', updateSummary); checkout.addEventListener('change', updateSummary); window.addEventListener('resize', resizeCanvasForDisplay);
resizeCanvasForDisplay(); updateSummary(); render();
