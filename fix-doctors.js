const SUPABASE_URL = 'https://omezrsyjsxdeaautmsad.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_KEY) {
  console.error('❌ لازم تحدد SUPABASE_KEY');
  process.exit(1);
}

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

// دالة تنظيف الاسم للمقارنة
function normalizeName(name) {
  if (!name) return '';
  return name
    .replace(/^(د\.|د\/|ا\.د\.|ا\.د\/|دكتور|أ\.د\.|أ\.د\/)\s*/g, '') // إزالة الألقاب
    .replace(/\s+/g, ' ') // إزالة المسافات الزائدة
    .trim();
}

// دالة حساب نسبة التشابه (Levenshtein)
function similarity(s1, s2) {
  let longer = s1, shorter = s2;
  if (s1.length < s2.length) { longer = s2; shorter = s1; }
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;
  const editDistance = getEditDistance(longer, shorter);
  return (longerLength - editDistance) / parseFloat(longerLength);
}

function getEditDistance(s1, s2) {
  s1 = s1.toLowerCase(); s2 = s2.toLowerCase();
  const costs = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) costs[j] = j;
      else {
        if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

async function main() {
  console.log('⏳ جاري جلب الأطباء...');
  const docRes = await fetch(`${SUPABASE_URL}/rest/v1/doctors?select=id,name&is_active=eq.true`, { headers });
  const doctors = await docRes.json();
  console.log(`✅ تم جلب ${doctors.length} طبيب.`);

  console.log('⏳ جاري جلب المراجعات...');
  const revRes = await fetch(`${SUPABASE_URL}/rest/v1/medical_file_reviews?select=id,audit_questions,ward_questions`, { headers });
  let reviews = await revRes.json();
  console.log(`✅ تم جلب ${reviews.length} مراجعة.`);

  let updatedCount = 0;

  for (let review of reviews) {
    let modified = false;

    // دالة داخلية لمعالجة البيانات
    const processPerson = (person) => {
      if (!person || person === 'غير موجود' || person === 'خط غير واضح') return person;
      
      const normP = normalizeName(person);
      
      // 1. بحث عن تطابق مباشر
      let match = doctors.find(d => normalizeName(d.name) === normP);
      
      // 2. بحث عن احتواء (الاسم القديم جزء من الجديد أو العكس)
      if (!match) {
        match = doctors.find(d => {
          const normD = normalizeName(d.name);
          return normD.includes(normP) || normP.includes(normD);
        });
      }

      // 3. بحث عن تشابه عالي (أكثر من 80%)
      if (!match) {
        let bestScore = 0;
        for (const d of doctors) {
          const score = similarity(normP, normalizeName(d.name));
          if (score > 0.8 && score > bestScore) {
            bestScore = score;
            match = d;
          }
        }
      }

      if (match && match.name !== person) {
        modified = true;
        return match.name;
      }
      return person;
    };

    // معالجة ward_questions
    if (review.ward_questions && Array.isArray(review.ward_questions)) {
      review.ward_questions.forEach(w => {
        w.clerk = processPerson(w.clerk);
      });
    }

    // معالجة audit_questions
    if (review.audit_questions && Array.isArray(review.audit_questions)) {
      review.audit_questions.forEach(a => {
        if (a.data && Array.isArray(a.data)) {
          a.data.forEach(unit => {
            if (unit.person) {
              const newName = processPerson(unit.person);
              if (newName !== unit.person) {
                unit.person = newName;
                unit.otherName = newName;
                modified = true;
              }
            }
          });
        }
      });
    }

    if (modified) {
      // تحديث السجل في الداتابيز
      await fetch(`${SUPABASE_URL}/rest/v1/medical_file_reviews?id=eq.${review.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          audit_questions: review.audit_questions,
          ward_questions: review.ward_questions
        })
      });
      updatedCount++;
      if (updatedCount % 100 === 0) console.log(`   تم تحديث ${updatedCount} ملف...`);
    }
  }

  console.log(`\n🎉 انتهى! تم تعديل أسماء الأطباء في ${updatedCount} ملف.`);
}

main().catch(console.error);