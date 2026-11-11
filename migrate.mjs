import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://omezrsyjsxdeaautmsad.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY; // مش الـ anon
if (!SERVICE_KEY) { console.error('SUPABASE_SERVICE_KEY missing'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const FILE = './ورقة شغل.xlsx';
const BATCH = 500;

// ============ HELPERS ============
function safeInt(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return Math.floor(v) || 0;
  const s = String(v).trim();
  if (s.startsWith('=')) return 0;
  const n = parseInt(s.replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}
function safeDateOnly(v) {
  if (!v) return null;
  let d;
  if (typeof v === 'number') d = new Date((v - 25569) * 86400 * 1000);
  else if (v instanceof Date) d = v;
  else {
    const s = String(v).trim();
    if (!s || s === '0') return null;
    d = new Date(s);
  }
  if (isNaN(d) || d.getFullYear() < 2020 || d.getFullYear() > 2030) return null;
  const yy = d.getFullYear(), mm = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0');
  return `${yy}-${mm}-${dd}`;
}
function safeTimestamp(v) {
  if (!v) return null;
  let d;
  if (typeof v === 'number') d = new Date((v - 25569) * 86400 * 1000);
  else if (v instanceof Date) d = v;
  else {
    const s = String(v).trim();
    if (!s || s === '0') return null;
    d = new Date(s);
  }
  if (isNaN(d) || d.getFullYear() < 2020 || d.getFullYear() > 2030) return null;
  return d.toISOString();
}
function cleanStr(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' || s === '0' || s === '0.0' ? null : s;
}

// ============ LOAD EXCEL ============
const wb = XLSX.readFile(FILE);
console.log('Sheets:', wb.SheetNames);

// ============ 1) work_staff ============
console.log('\n=== work_staff ===');
const empSheet = XLSX.utils.sheet_to_json(wb.Sheets['الموظفين'], { header: 1, defval: null });
const empRows = empSheet.slice(1); // skip header

const staffInserts = [];
for (const r of empRows) {
  const name = cleanStr(r[0]);
  if (!name) continue;
  const empType = cleanStr(r[2]) || 'Other';
  const target = safeInt(r[3]);
  staffInserts.push({
    name,
    emp_type: empType,
    daily_target: target,
    is_active: true,
  });
}

// dedupe by name
const seenStaff = new Set();
const uniqueStaff = staffInserts.filter(s => {
  if (seenStaff.has(s.name)) return false;
  seenStaff.add(s.name);
  return true;
});
console.log(`parsed=${staffInserts.length} unique=${uniqueStaff.length}`);

const { error: e1 } = await supabase.from('work_staff').upsert(uniqueStaff, { onConflict: 'name' });
if (e1) { console.error('staff err:', e1); } else { console.log('staff OK'); }

// ============ 2) work_records ============
console.log('\n=== work_records ===');
const coreSheet = XLSX.utils.sheet_to_json(wb.Sheets['قاعدة البيانات المركزية'], { header: 1, defval: null });
const coreRows = coreSheet.slice(1);

const seenRec = new Set();
const recDrafts = [];
let skipped = 0;

for (const r of coreRows) {
  const createdRaw = r[0];
  const workDateRaw = r[1];
  const dailyExitRaw = r[2];
  const movement = cleanStr(r[3]);
  const empName = cleanStr(r[4]);
  const path = cleanStr(r[5]);
  const method = cleanStr(r[6]);
  const target = safeInt(r[7]);
  const count = safeInt(r[8]);
  const models = safeInt(r[9]);
  const notes = cleanStr(r[11]);

  if (!movement) { skipped++; continue; }
  if (!empName) { skipped++; continue; } // skip legacy empty-name rows

  // Dedupe key: (created_at|daily_exit|emp|movement|path|method|count|models)
  const key = [
    createdRaw || '', dailyExitRaw || '', empName, movement, path || '', method || '',
    count, models
  ].join('|');
  if (seenRec.has(key)) { skipped++; continue; }
  seenRec.add(key);

  const createdAt = safeTimestamp(createdRaw)
    || (dailyExitRaw ? safeTimestamp(dailyExitRaw) + '' : null)
    || new Date().toISOString();
  const workDate = safeDateOnly(workDateRaw) || safeDateOnly(dailyExitRaw) || safeDateOnly(createdRaw) || new Date().toISOString().split('T')[0];
  const dailyExit = safeDateOnly(dailyExitRaw);

  recDrafts.push({
    _createdAt: createdAt,
    _empName: empName,
    row: {
      created_at: createdAt,
      work_date: workDate,
      daily_exit_date: dailyExit,
      movement_type: movement,
      employee_name: empName,
      work_path: path,
      work_method: method,
      target_quota: target,
      actual_count: count,
      models_count: models,
      notes: notes,
    }
  });
}

// Generate batch_id per (createdAt + empName)
const batchMap = new Map();
for (const d of recDrafts) {
  const k = d._createdAt + '||' + d._empName;
  if (!batchMap.has(k)) batchMap.set(k, crypto.randomUUID());
  d.row.batch_id = batchMap.get(k);
}

console.log(`parsed=${recDrafts.length} skipped=${skipped} batches=${batchMap.size}`);

// Insert in chunks
let insertedRecs = 0;
for (let i = 0; i < recDrafts.length; i += BATCH) {
  const chunk = recDrafts.slice(i, i + BATCH).map(d => d.row);
  const { error } = await supabase.from('work_records').insert(chunk);
  if (error) { console.error('rec chunk err:', error); break; }
  insertedRecs += chunk.length;
  console.log(`  rec ${insertedRecs}/${recDrafts.length}`);
}
console.log('records OK:', insertedRecs);

// ============ 3) work_file_tracking ============
console.log('\n=== work_file_tracking ===');
const trackSheet = XLSX.utils.sheet_to_json(wb.Sheets['سجل تتبع الملفات'], { header: 1, defval: null });
const trackRows = trackSheet.slice(1);

const seenTrack = new Set();
const trackInserts = [];
let skippedT = 0;

for (const r of trackRows) {
  const createdRaw = r[0];
  const workDateRaw = r[1];
  const mrnRaw = r[2];
  const pname = cleanStr(r[3]);
  const models = safeInt(r[4]);
  const path = cleanStr(r[5]);
  const method = cleanStr(r[6]);
  const empName = cleanStr(r[7]);
  const dailyExitRaw = r[8];

  // Skip placeholders (mrn=0 or empty) and rows without employee
  const mrnStr = cleanStr(mrnRaw);
  if (!empName) { skippedT++; continue; }
  if (!mrnStr || mrnStr === '0' || mrnStr === '0.0') { skippedT++; continue; }

  const workDate = safeDateOnly(workDateRaw) || safeDateOnly(dailyExitRaw) || safeDateOnly(createdRaw);
  if (!workDate) { skippedT++; continue; }

  const key = [empName, workDate, mrnStr, method, path].join('|');
  if (seenTrack.has(key)) { skippedT++; continue; }
  seenTrack.add(key);

  trackInserts.push({
    created_at: safeTimestamp(createdRaw) || new Date().toISOString(),
    work_date: workDate,
    daily_exit_date: safeDateOnly(dailyExitRaw),
    mrn: mrnStr,
    patient_name: pname,
    models_count: models,
    work_path: path,
    work_method: method,
    employee_name: empName,
  });
}
console.log(`parsed=${trackInserts.length} skipped=${skippedT}`);

let insertedTrack = 0;
for (let i = 0; i < trackInserts.length; i += BATCH) {
  const chunk = trackInserts.slice(i, i + BATCH);
  const { error } = await supabase.from('work_file_tracking').insert(chunk);
  if (error) { console.error('track chunk err:', error); break; }
  insertedTrack += chunk.length;
  console.log(`  track ${insertedTrack}/${trackInserts.length}`);
}
console.log('tracking OK:', insertedTrack);

// ============ 4) work_evaluations ============
console.log('\n=== work_evaluations ===');
const evalSheet = XLSX.utils.sheet_to_json(wb.Sheets['التقييم الإداري'], { header: 1, defval: null });
const evalRows = evalSheet.slice(1);
console.log(`eval rows=${evalRows.length} (empty sheet → skip)`);
// (currently empty in the file, so nothing to insert)

console.log('\n✅ Migration complete');
console.log(`staff=${uniqueStaff.length}, records=${insertedRecs}, tracking=${insertedTrack}`);