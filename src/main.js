import './main.css';

const $ = id => document.getElementById(id);

const FIELDS = ['tonnage', 'bagWeight', 'tPack', 'tCarry', 'tStack',
                'workers', 'shift', 'tariff'];
const STORE_KEY = 'bryket-packing-v12';

const num = id => { const v = parseFloat($(id).value); return isFinite(v) ? v : 0; };
const nf  = (v, d) => v.toLocaleString('uk-UA', {minimumFractionDigits:d, maximumFractionDigits:d});
const int = v => Math.round(v).toLocaleString('uk-UA');

function fmtTime(sec){
  const s = Math.round(sec);
  if (s < 60) return s + ' с';
  const m = Math.floor(s / 60), r = s % 60;
  return r ? m + ' хв ' + r + ' с' : m + ' хв';
}

function calc(){
  const tonnage   = num('tonnage');
  const bagWeight = num('bagWeight');
  const bags      = bagWeight > 0 ? Math.round(tonnage * 1000 / bagWeight) : 0;
  const workers   = Math.max(1, Math.round(num('workers')) || 1);
  const shift     = Math.max(1, num('shift') || 8);   // годин у зміні
  const tariff    = num('tariff');

  const ops = [
    {name:'Фасування',  note:'набрати з купи, зав’язати', t:num('tPack')},
    {name:'Переноска',  note:'на 10 м, тільки туди',          t:num('tCarry')},
    {name:'Укладання',  note:'на піддони, до 1,5 м',          t:num('tStack')}
  ];

  ops.forEach(o => {
    o.rate  = o.t / 3600 * tariff;
    o.cost  = bags * o.rate;
    o.hours = bags * o.t / 3600;
  });

  const rate    = ops.reduce((s,o) => s + o.rate, 0);
  const cost    = bags * rate;
  const hours   = ops.reduce((s,o) => s + o.hours, 0);   // людино-години
  const elapsed = hours / workers;                        // календарний термін, год
  const days    = elapsed / shift;                        // термін у змінах
  const perTon  = bagWeight > 0 ? rate / (bagWeight / 1000) : 0;

  return {tonnage, bagWeight, bags, workers, shift, tariff, ops,
          rate, cost, hours, elapsed, days, perTon};
}

function render(){
  const r = calc();

  $('bagsOut').textContent = int(r.bags);

  // норми часу: мішків і годин на кожну операцію
  const HOURS = v => nf(v, 1) + ' год';
  [['bagsPack','totPack',r.ops[0]],
   ['bagsCarry','totCarry',r.ops[1]],
   ['bagsStack','totStack',r.ops[2]]].forEach(([bagsId, totId, o]) => {
    $(bagsId).textContent = int(r.bags);
    $(totId).textContent  = HOURS(o.hours);
  });

  $('totPerBag').textContent = fmtTime(r.ops.reduce((s,o) => s + o.t, 0));
  $('bagsAll').textContent   = int(r.bags);
  $('totAll').textContent    = HOURS(r.hours);

  // розцінки
  const rowHtml = o =>
    '<tr>' +
      '<td class="td pr-2 text-left">' +
        '<div class="leading-tight">' + o.name + '</div>' +
        '<div class="text-[11px] text-slate-400">' + o.note + '</div>' +
      '</td>' +
      '<td class="td text-right text-slate-400">' + fmtTime(o.t) + '</td>' +
      '<td class="td text-right font-semibold">' + nf(o.rate, 2) + '</td>' +
      '<td class="td text-right text-slate-400">' + nf(o.cost, 0) + '</td>' +
    '</tr>';

  $('opsBody').innerHTML = r.ops.map(rowHtml).join('') +
    '<tr class="row-total">' +
      '<td class="text-left">Разом</td>' +
      '<td class="text-right text-slate-400">' + fmtTime(r.ops.reduce((s,o) => s + o.t, 0)) + '</td>' +
      '<td class="text-right">' + nf(r.rate, 2) + '</td>' +
      '<td class="text-right">' + nf(r.cost, 0) + '</td>' +
    '</tr>';

  const u  = t => ' <small class="text-xs font-normal text-slate-400">' + t + '</small>';

  // тривалість роботи: загальні години поділені на (зміна × робітники)
  const dec = v => nf(v, v % 1 ? 1 : 0);
  $('durHours').innerHTML   = nf(r.hours, 1) + u('год');
  $('durDivisor').innerHTML = dec(r.shift) + ' × ' + r.workers + ' = ' +
                              nf(r.shift * r.workers, 1) + u('год');
  $('durDays').innerHTML    = nf(r.days, 1) + u('днів');

  $('sumCost').innerHTML  = nf(r.cost, 0) + u('грн');
  $('sumTermH').innerHTML = nf(r.elapsed, 1) + u('год');
  $('sumTon').innerHTML      = nf(r.perTon, 0) + u('грн');
  $('sumBag').innerHTML      = nf(r.rate, 2) + u('грн');

  const flags = [];
  if (r.tariff > 0 && r.tariff < 300){
    flags.push('<div class="mb-3 rounded-lg bg-amber-50 px-3 py-2.5 text-[13px] leading-snug text-amber-800">' +
      '<b class="font-semibold">Тариф нижчий за ринковий.</b> У Києві 2026 сервіси беруть ' +
      '350–450 грн/год, тож за ' + nf(r.tariff, 0) + ' грн/год бригаду знайти важко.</div>');
  }
  if (r.bagWeight > 35){
    flags.push('<div class="mb-3 rounded-lg bg-amber-50 px-3 py-2.5 text-[13px] leading-snug text-amber-800">' +
      '<b class="font-semibold">Мішок понад 35 кг.</b> Постійно піднімати таку вагу одній людині ' +
      'небезпечно — потрібен другий робітник або механізація.</div>');
  }
  $('flagBox').innerHTML = flags.join('');
}

function save(){
  const o = {};
  FIELDS.forEach(id => o[id] = $(id).value);
  try { localStorage.setItem(STORE_KEY, JSON.stringify(o)); } catch(e){}
}

function load(){
  let o = null;
  try { o = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch(e){}
  if (!o) return;
  FIELDS.forEach(id => { if (o[id] !== undefined) $(id).value = o[id]; });
}

FIELDS.forEach(id => {
  $(id).addEventListener('input', () => { render(); save(); });
  $(id).addEventListener('change', () => { render(); save(); });
});

$('btnPrint').addEventListener('click', () => window.print());

$('btnReset').addEventListener('click', () => {
  try { localStorage.removeItem(STORE_KEY); } catch(e){}
  location.reload();
});

load();
render();
