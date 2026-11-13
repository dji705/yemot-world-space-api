function sendYemot(res, text, options = {}) {
  const { inputName = 'wm_nav', min = 1, max = 1, timeout = '5' } = options;
  res.status(200);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const safe = String(text).replace(/[\r\n]+/g, ' ').replace(/=/g, ' ');
  res.end(`read=t-${safe}=${inputName},no,${max},${min},${timeout},Digits,no,no,,,1,Ok`);
}
function val(url, names) {
  for (const n of names) {
    const v = url.searchParams.get(n);
    if (v !== null && v !== '') return v.trim();
  }
  return '';
}
function esc(v) { return String(v ?? '').replace(/[<>]/g, ' '); }
function number(v) { return Number(v).toLocaleString('he-IL'); }
function menu() {
  return 'ברוכים הבאים למרכז מידע עולם וחלל. לשיגורי חלל קרובים הקישו 1. לחיפוש לוויין הקישו 2. למידע על מדינה הקישו 3. לעובדה מעניינת על מספר הקישו 4. למידע על מעברי לוויינים הקישו 5.';
}
async function json(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'YemotWorldSpaceAPI/1.0' } });
  if (!r.ok) throw new Error('שירות הנתונים אינו זמין');
  return r.json();
}
async function launches() {
  const d = await json('https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=5');
  const rows = (d.results || []).slice(0, 5);
  if (!rows.length) return 'לא נמצאו שיגורים קרובים במאגר.';
  return 'השיגורים הקרובים. ' + rows.map((x, i) => {
    const date = x.net ? new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jerusalem' }).format(new Date(x.net)) : 'מועד לא ידוע';
    return `שיגור מספר ${i + 1}. ${esc(x.name)}. מועד ${date}. אתר השיגור: ${esc(x.pad?.location?.name || 'לא צוין')}.`;
  }).join(' ');
}
async function satellite(q) {
  const d = await json('https://celestrak.org/NORAD/elements/gp.php?NAME=' + encodeURIComponent(q) + '&FORMAT=JSON');
  const rows = Array.isArray(d) ? d.slice(0, 5) : [];
  if (!rows.length) return 'לא נמצאו לוויינים מתאימים. אפשר לנסות שם באנגלית, למשל איי אס אס באנגלית.';
  return 'נמצאו ' + rows.length + ' תוצאות. ' + rows.map((x, i) =>
    `תוצאה ${i + 1}. ${esc(x.OBJECT_NAME)}. מספר קטלוגי ${esc(x.NORAD_CAT_ID)}.`
  ).join(' ');
}
async function country(code) {
  const d = await json('https://api.worldbank.org/v2/country/' + encodeURIComponent(code) + '/indicator/SP.POP.TOTL?format=json&per_page=1');
  const row = d?.[1]?.[0];
  if (!row) return 'לא נמצאה מדינה בקוד שהקשתם.';
  const info = await json('https://api.worldbank.org/v2/country/' + encodeURIComponent(code) + '?format=json');
  const region = info?.[1]?.[0]?.region?.value || 'לא ידוע';
  return `${esc(row.country?.value || code)}. אוכלוסייה לפי הנתון האחרון במאגר: ${row.value ? number(row.value) : 'אין נתון זמין'}. שנת הנתון: ${row.date || 'לא ידועה'}. אזור בעולם: ${esc(region)}.`;
}
async function numberFact(n) {
  const d = await json('https://numbersapi.com/' + encodeURIComponent(n) + '/trivia?json');
  return d.text ? esc(d.text) : 'לא נמצאה עובדה על המספר הזה.';
}
export default async function handler(req, res) {
  const url = new URL(req.url, 'https://' + (req.headers?.host || 'localhost'));
  const sat = val(url, ['SatelliteName']);
  const countryCode = val(url, ['CountryCode']);
  const num = val(url, ['NumberInput']);
  try {
    if (sat) return sendYemot(res, await satellite(sat) + ' לחיפוש לוויין נוסף, הקישו את שמו באנגלית.', { inputName: 'SatelliteName', min: 2, max: 30, timeout: '7' });
    if (countryCode) {
      if (!/^[a-z]{2}$/i.test(countryCode)) return sendYemot(res, 'קוד המדינה אינו תקין. הקישו שתי אותיות באנגלית, לדוגמה איי אל לישראל.', { inputName: 'CountryCode', min: 2, max: 2, timeout: '7' });
      return sendYemot(res, await country(countryCode) + ' לחיפוש מדינה נוספת, הקישו קוד בן שתי אותיות באנגלית.', { inputName: 'CountryCode', min: 2, max: 2, timeout: '7' });
    }
    if (num) {
      if (!/^-?\\d{1,9}$/.test(num)) return sendYemot(res, 'המספר אינו תקין. הקישו מספר שלם עד תשע ספרות.', { inputName: 'NumberInput', min: 1, max: 9, timeout: '7' });
      return sendYemot(res, await numberFact(num) + ' לעובדה על מספר נוסף, הקישו מספר שלם.', { inputName: 'NumberInput', min: 1, max: 9, timeout: '7' });
    }
    const choice = val(url, ['wm_nav', 'Choice', 'ApiPhoneInput', 'Digits', 'val']).replace(/[^0-9]/g, '');
    if (!choice) return sendYemot(res, menu(), { inputName: 'wm_nav', min: 1, max: 1, timeout: '3' });
    if (choice === '1') return sendYemot(res, await launches() + ' להאזנה חוזרת, הקישו 1.', { inputName: 'wm_nav', min: 1, max: 1, timeout: '7' });
    if (choice === '2') return sendYemot(res, 'הקלידו את שם הלוויין באנגלית, או את מספרו הקטלוגי אם ידוע.', { inputName: 'SatelliteName', min: 2, max: 30, timeout: '7' });
    if (choice === '3') return sendYemot(res, 'הקלידו קוד מדינה בן שתי אותיות באנגלית. לדוגמה איי אל לישראל, או יו אס לארצות הברית.', { inputName: 'CountryCode', min: 2, max: 2, timeout: '7' });
    if (choice === '4') return sendYemot(res, 'הקישו מספר שלם, עד תשע ספרות, לקבלת עובדה מעניינת.', { inputName: 'NumberInput', min: 1, max: 9, timeout: '7' });
    if (choice === '5') return sendYemot(res, 'אפשרות מעברי הלוויינים עדיין אינה מחוברת למנוע חישוב מסלולים, ולכן לא ניתן למסור זמני מעבר מדויקים.', { inputName: 'wm_nav', min: 1, max: 1, timeout: '7' });
    return sendYemot(res, 'הבחירה לא זוהתה. ' + menu(), { inputName: 'wm_nav', min: 1, max: 1, timeout: '3' });
  } catch (e) {
    return sendYemot(res, 'לא ניתן לקבל כרגע את הנתונים מהשירות החיצוני. אפשר לנסות שוב מאוחר יותר. ' + menu(), { inputName: 'wm_nav', min: 1, max: 1, timeout: '5' });
  }
}
