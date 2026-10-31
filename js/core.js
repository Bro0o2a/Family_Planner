// ---------- Basic settings ----------
const DAYS  = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LAST_DAY = DAYS.length - 1;                 // 6 = Sunday (days are numbered 0 = Monday … 6 = Sunday)
// 📅 The calendar and the plan go by DATE ("2026-10-23"): the calendar shows the 5 days before today, today and the 6 days after;
// the plan covers today + the next 6 days (planned again each new day) and keeps the last 14 days as history.
// (Scores, "last week" and reports still go by Monday–Sunday weeks, worked out from the dates.)
const CAL_BACK = 5, CAL_AHEAD = 6, CAL_LEN = CAL_BACK + 1 + CAL_AHEAD;
const PLAN_AHEAD = 6, PLAN_KEEP = 14;
// 🕌 Prayer times: the family's place (Al Barsha, Dubai unless Bro2a picks another one in Settings).
// Whether a person SEES them is their own choice: showPrayer / prayerRemind on each person (see cleanData).
// (show / remind here are from an earlier version and aren't used any more; they're kept so old data stays the same.)
const PRAYER_DEFAULT = { show: true, remind: true, city: "Al Barsha, Dubai, UAE", lat: 25.1135, lng: 55.2000 };
const PRAYER_AMMAN = { city: "Amman, Jordan", lat: 31.9539, lng: 35.9106 };   // the earlier version's default
const PRAYERS_LIST = [["fajr", "Fajr"], ["dhuhr", "Dhuhr"], ["asr", "Asr"], ["maghrib", "Maghrib"], ["isha", "Isha"]];
const PRAYER_MIN = 15;                            // the reminder shows during the first 15 minutes
const SAVE_KEY = "weeklyPlanner.v1";             // the name we save our data under in the browser
const APP_NAME = "Hani's Family Plan";
const CONTACT = "";                              // 🔒 Privacy: who to ask (an email, …). Empty = the "Questions?" line is hidden.
const PRIVACY_UPDATED = "21 October 2026";       // 🔒 Privacy: change this when the text changes
const DAD = "dad";                               // Dad's id. Dad can't be removed. (Only the shown name can change.)
// 👨‍👩‍👧 A parent: the family's first parent (DAD), or another parent (a person with role: "parent", e.g. one who joined with a
// parent code). Every parent has the same rights; DAD is still the one the week planner means by "needs Dad".
function isParentId(id) {
  if (id === DAD) return true;
  try { return !!id && !!data && Array.isArray(data.users) && data.users.some(u => u.id === id && u.role === "parent"); }
  catch (e) { return false; }   // (before the family's data is loaded)
}
const DAD_NAME = "Bro2a";                        // the name Dad is shown with
const PLAN_FRESH = "fresh-after-update";         // marks a plan that was up to date before an app update
// 👨‍👩‍👧 Families: each family's data is families/{familyId}/…; who is who: members/{uid}; kids' and parents' codes: codes/{CODE}
const OLD_FAMILY_UID = "Hk3ZPk0xkTYLpLVBXrR8BUn3hfJ3";   // our first shared family account (its familyId = its uid)
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // codes: 6 of these (no 0 / O / 1 / I, they look alike)
const isCode = x => typeof x === "string" && x.length === 6 && [...x].every(c => CODE_CHARS.includes(c));
// 📚 Curricula: [saved name, short name for messages]. "Other" = typed by the parent (saved as typed)
const CURRICULA = [["British (UK National Curriculum / IGCSE)", "British"], ["British IGCSE (Cambridge / Edexcel)", "British IGCSE"],
                   ["American (Common Core)", "American"], ["IB (PYP/MYP)", "IB"],
                   ["Indian (CBSE)", "CBSE"], ["Indian (ICSE)", "ICSE"], ["UAE (MOE)", "UAE MOE"], ["French", "French"], ["German", "German"],
                   // (these use Grade 1–12)
                   ...["Iranian", "Australian", "Chinese", "Japanese", "Russian", "SABIS", "Pakistani", "Philippine"].map(c => [c, c])];
// (older saved data: the old names → the new ones)
const OLD_CURRICULA = { British: CURRICULA[0][0], "British (UK National Curriculum)": CURRICULA[0][0], American: CURRICULA[2][0], IB: CURRICULA[3][0] };
const IGCSE = CURRICULA[1][0];
// 🏫 Dubai private schools (KHDA ratings list) → their curriculum. Keep it A–Z; add more schools here: [name, curriculum]
const [UK, US, IB, CBSE, FR, DE] = [CURRICULA[0][0], CURRICULA[2][0], CURRICULA[3][0], CURRICULA[4][0], "French", "German"];
const [IR, AU, CN, JP, RU, SABIS, PK, PH] = ["Iranian", "Australian", "Chinese", "Japanese", "Russian", "SABIS", "Pakistani", "Philippine"];
// (214 schools)
const DUBAI_SCHOOLS = [
  ["AFLEC Lycee Francais International", FR], ["Al Adab Iranian Private School for Boys", IR], ["Al Adab Iranian Private School for Girls", IR],
  ["Al Diyafah High School", UK], ["Al Ittihad Private School Al Safa", US], ["Al Ittihad Private School Mamzar", US],
  ["Al Maaref Private School", US], ["Al Mawakeb School Al Barsha", US], ["Al Mawakeb School Al Garhoud", US],
  ["Al Mawakeb School Al Khawaneej", US], ["Al Nibras International Private School", US], ["Al Sadiq Islamic English School", UK],
  ["Al Salam Community School", UK], ["Al Salam Private School", UK], ["Ambassador International Academy", IB], ["Ambassador School Dubai", CBSE],
  ["American Academy for Girls", US], ["American International School", US], ["American School of Creative Science", US],
  ["American School of Dubai", US], ["Amity School Dubai", CBSE], ["Apple International Community School", UK], ["Apple International School", UK],
  ["Arab Unity School", UK], ["Arcadia British School", UK], ["Arcadia Global School", UK], ["Australian International School", AU],
  ["BC Academy International School", UK], ["Bi-lingual French International School", FR], ["Bloom World Academy", IB],
  ["Bright Learners Private School", US], ["Bright Riders School", CBSE], ["Brighton College Dubai", UK], ["Buds Public School", CBSE],
  ["Cambridge International School", UK], ["Capital School", UK], ["Cedar School Dubai", UK], ["Chinese School Dubai", CN], ["Citizens School", UK],
  ["Clarion School", US], ["Collegiate International School", US], ["Credence High School", CBSE], ["Crescent English School", CBSE],
  ["Dar Al Marefa Private School", IB], ["Deira International School", UK], ["Deira Private School", UK], ["Delhi Private School", CBSE],
  ["DESS College", UK], ["DESS Primary Academic City", UK], ["DESS Primary Oud Metha", UK], ["Dewvale School Dubai", CBSE],
  ["Dhruv Global School", CBSE], ["Dove Green Private School", UK], ["Dubai Arabian American Private School", US],
  ["Dubai British School Emirates Hills", UK], ["Dubai British School Jumeira", UK], ["Dubai British School Jumeirah Park", UK],
  ["Dubai British School Mira", UK], ["Dubai Carmel School", UK], ["Dubai College", UK], ["Dubai Gem Private School", UK],
  ["Dubai Heights Academy", UK], ["Dubai International Academy Al Barsha", IB], ["Dubai International Academy Emirates Hills", IB],
  ["Dubai International Private School Al Qouz", US], ["Dubai International Private School Garhoud", US], ["Dubai Modern Education School", US],
  ["Dubai National School Al Barsha", US], ["Dubai National School Al Twar", US], ["Dubai Scholars Private School", UK],
  ["Dubai Schools Al Barsha", US], ["Dubai Schools Al Khawaneej", US], ["Dubai Schools Nad Al Sheba", US], ["Dunecrest American School", US],
  ["Durham School Dubai", UK], ["Dwight School Dubai", IB], ["Elite English School", CBSE], ["Emirates International School Jumeirah", IB],
  ["Emirates International School Meadows", IB], ["Emirates National Schools Dubai", IB], ["English Language Private School", UK],
  ["Fairgreen International School", IB], ["Fifth Dimension Private School", US], ["GEMS Al Barsha National School", UK],
  ["GEMS Al Khaleej International School", US], ["GEMS Dubai American Academy", US], ["GEMS First Point School", UK],
  ["GEMS Founders School Dubai", UK], ["GEMS Founders School Dubai South", UK], ["GEMS Founders School Mizhar", UK],
  ["GEMS International School Al Khail", IB], ["GEMS Jumeira Primary School", UK], ["GEMS Legacy School Dubai", CBSE],
  ["GEMS Metropole School Al Waha", UK], ["GEMS Metropole School Motor City", UK], ["GEMS Modern Academy", CBSE],
  ["GEMS New Millennium School", CBSE], ["GEMS Our Own English High School", CBSE], ["GEMS Our Own Indian School", CBSE],
  ["GEMS Royal Dubai School", UK], ["GEMS School of Research and Innovation", UK], ["GEMS Wellington Academy Al Khail", UK],
  ["GEMS Wellington Academy DSO", UK], ["GEMS Wellington International School", UK], ["GEMS Winchester School", UK], ["GEMS World Academy", IB],
  ["German International School", DE], ["Ghaf Private School", UK], ["Glendale International School", UK],
  ["Global Indian International School", CBSE], ["Grammar School Dubai", UK], ["Greenfield International School", IB],
  ["Greenwood International School", US], ["Gulf Indian High School", CBSE], ["Gulf Model School", CBSE],
  ["Hampton Heights International School", UK], ["Hartland International School", UK], ["Horizon English School", UK],
  ["Horizon International School", UK], ["International Academic School", US], ["International School of Creative Science Nad Al Sheba", UK],
  ["Iranian Khadije Kobra School", IR], ["Iranian Salman Farsi Boys School", IR], ["Iranian Towheed Boys School", IR],
  ["Iranian Towheed Girls School", IR], ["Japanese School Dubai", JP], ["Jebel Ali School", UK], ["JSS International School", CBSE],
  ["JSS Private School", CBSE], ["Jumeira Baccalaureate School", IB], ["Jumeirah College", UK], ["Jumeirah English Speaking School", UK],
  ["Jumeirah English Speaking School Arabian Ranches", UK], ["Kent College Dubai", UK], ["Kings School Al Barsha", UK], ["Kings School Dubai", UK],
  ["Kings School Nad Al Sheba", UK], ["Little Flower English School", CBSE], ["Lycee Francais International AFLEC Mudon", FR],
  ["Lycee Francais International Georges Pompidou School", FR], ["Lycee Francais International Georges Pompidou School Oud Metha", FR],
  ["Lycee Francais Jean Mermoz North", FR], ["Lycee Francais Jean Mermoz South", FR], ["Lycee Libanais Francophone Prive", FR],
  ["Mirdif American School", US], ["Modern Skills School", US], ["MSB Private School", UK], ["New Academy School", US],
  ["New Dawn Private School", UK], ["New Indian Model School", CBSE], ["Newlands School", UK], ["Next Generation School", US],
  ["Nord Anglia International School", UK], ["North American International School", US], ["North London Collegiate School", IB],
  ["Oak Tree Primary School", UK], ["Our Own High School Dubai", CBSE], ["Oxford School", UK], ["Pace Modern British School", UK],
  ["Pace Springfield International School", UK], ["Pakistan Educational Academy", PK], ["Pearl Wisdom School", CBSE],
  ["Philadelphia Private School", US], ["Primus Private School", CBSE], ["Pristine Private School", UK], ["Queen International School", UK],
  ["Raffles International School", UK], ["Raffles World Academy", UK], ["Ranches Primary School", UK], ["Regent International School", UK],
  ["Renaissance School", US], ["Repton School Al Barsha", UK], ["Repton School Dubai", UK], ["Royal Grammar School Guildford Dubai", UK],
  ["Russian International School", RU], ["Sabari Indian School", CBSE], ["Safa British School", UK], ["Safa Community School", UK],
  ["Shaikh Rashid Al Maktoum Pakistani School", PK], ["Sharjah American International Private School", US], ["Smart Vision School", UK],
  ["SMM High School Muhaisnah", UK], ["South View School", UK], ["Springdales School", CBSE], ["St. Mary Catholic High School", UK],
  ["Star International School Al Qusais", UK], ["Star International School Mirdif", UK], ["Sunmarke School", UK],
  ["Swiss International Scientific School", IB], ["The Aquila School", UK], ["The Arbor School", UK], ["The Central School", CBSE],
  ["The City School International", UK], ["The English College", UK], ["The Indian Academy", CBSE], ["The Indian High School", CBSE],
  ["The Indian High School Garhoud", CBSE], ["The Indian International School", CBSE], ["The International School of Choueifat DIP", US],
  ["The International School of Choueifat Umm Suqeim", SABIS], ["The Millennium School", CBSE], ["The Philippine School", PH],
  ["The School of Research Science", UK], ["The School of Research Science US", US], ["The Sheffield Private School", UK],
  ["The Westminster School", UK], ["The Winchester School", UK], ["United International Private School", PH], ["Universal American School", US],
  ["Uptown International School", IB], ["Vernus International School", US], ["Victory Heights Primary School", UK],
  ["Victory Heights Primary School City of Arabia", UK], ["Woodlem Park School", CBSE]
];
const OTHER_SCHOOL = "Other school (type the name)";
// 🎓 The years of a curriculum
const range = (from, to, f) => Array.from({ length: to - from + 1 }, (_, i) => f(from + i));
function yearsOf(curriculum) {
  if (curriculum === UK || curriculum === IGCSE) return range(1, 13, n => "Year " + n);
  if (curriculum === US) return ["KG", ...range(1, 12, n => "Grade " + n)];
  if (curriculum === IB) return [...range(1, 5, n => "PYP " + n), ...range(1, 5, n => "MYP " + n)];
  return range(1, 12, n => "Grade " + n);
}
const curriculumShort = c => (CURRICULA.find(x => x[0] === c) || [c, c])[1];
// 🏫 School · 📚 Curriculum · 🎓 Year / Grade (in "About {kid}" and 👨‍👩‍👧 Family; p = the ids' start, so both can be on the page)
function schoolFieldsHtml(p, u) {
  const known = CURRICULA.some(x => x[0] === u.curriculum), other = !!u.curriculum && !known;
  return `<div class="sc-schoolpick">
    ${scField(p + "School", "🏫 School", `<input type="text" id="${p}School" maxlength="60" value="${safe(u.school || "")}" role="combobox"
      aria-autocomplete="list" aria-controls="${p}Sug" aria-expanded="false" placeholder="Type to search…" autocomplete="off" data-schoolpick="${p}">
      <div class="sch-sug" id="${p}Sug" role="listbox" hidden></div>`)}
    <div class="row"><div><label class="small" for="${p}Curr">📚 Curriculum</label><select id="${p}Curr" data-currpick="${p}"><option value="">—</option>
        ${CURRICULA.map(([c]) => `<option ${u.curriculum === c ? "selected" : ""}>${c}</option>`).join("")}<option value="Other" ${other ? "selected" : ""}>Other (type it)</option></select>
        <input type="text" id="${p}CurrOther" maxlength="40" value="${other ? safe(u.curriculum) : ""}" placeholder="Type the curriculum" data-yearpick="${p}" ${other ? "" : "hidden"}></div>
      <div><label class="small" for="${p}Year">🎓 Year / Grade</label><select id="${p}Year" data-yearpick="${p}">${yearOptionsHtml(known ? u.curriculum : "", u.year)}</select></div></div></div>`;
}
function yearOptionsHtml(curriculum, year) {
  const list = yearsOf(curriculum);
  if (year && !list.includes(year)) list.unshift(year);   // (an older year typed by hand)
  return `<option value="">—</option>` + list.map(y => `<option ${y === year ? "selected" : ""}>${safe(y)}</option>`).join("");
}
function schoolFieldsValue(p) {
  const school = $(p + "School").value.trim(), c = $(p + "Curr").value;
  return { school: school === OTHER_SCHOOL ? "" : school.slice(0, 60), curriculum: c === "Other" ? $(p + "CurrOther").value.trim().slice(0, 40) : c, year: $(p + "Year").value };
}
// "No syllabus? No problem. 🤖 already knows the British Year 5 plan."
function sylNoteText(curriculum, year) {
  return `No syllabus? No problem. 🤖 already knows the ${[curriculum && curriculumShort(curriculum), year].filter(Boolean).join(" ") || "school year's"} plan.`;
}
// A school picked from the list → its curriculum; "Other school" → type the name
// Typing: matches any part of the name, ignoring capitals and the words "GEMS" / "School" ("founders" finds every GEMS Founders school)
const schoolKey = s => String(s).toLowerCase().replace(/\bgems\b|\bschools?\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
const SCHOOL_KEYS = DUBAI_SCHOOLS.map(([n]) => schoolKey(n));
function onSchoolPick(el) {
  const p = el.dataset.schoolpick, q = schoolKey(el.value);
  const hit = DUBAI_SCHOOLS.find(([n]) => n.toLowerCase() === el.value.trim().toLowerCase());
  if (hit && $(p + "Curr").value !== hit[1]) { $(p + "Curr").value = hit[1]; onCurrPick(p); }
  // The suggestions under the box (up to 8), and "Other school (type the name)" last
  const words = q.split(" ").filter(Boolean);   // (every word typed must be somewhere in the name, in any order)
  const list = words.length ? DUBAI_SCHOOLS.map((s, i) => [s, i]).filter(([, i]) => words.every(w => SCHOOL_KEYS[i].includes(w))).slice(0, 8) : [];
  const sug = $(p + "Sug");
  sug.innerHTML = list.map(([[name, c], i]) => `<button type="button" role="option" data-schsug="${p}|${i}">${safe(name)}<small>${safe(curriculumShort(c))}</small></button>`).join("")
    + (el.value.trim() && !hit ? `<button type="button" role="option" class="other" data-schsug="${p}|other">${OTHER_SCHOOL}</button>` : "");
  sug.hidden = !sug.innerHTML || !!hit;
  el.setAttribute("aria-expanded", String(!sug.hidden));
}
// A suggestion tapped: the school's name (and its curriculum), or "Other school": keep what's typed
document.addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("[data-schsug]");
  document.querySelectorAll(".sch-sug").forEach(s => { if (!b || !s.contains(b)) s.hidden = true; });
  if (!b) return;
  const [p, i] = b.dataset.schsug.split("|"), box = $(p + "School");
  b.parentElement.hidden = true;
  box.setAttribute("aria-expanded", "false");
  if (i === "other") { box.placeholder = "Type the school's name"; return box.focus(); }
  const [name, c] = DUBAI_SCHOOLS[Number(i)];
  box.value = name;
  if ($(p + "Curr").value !== c) { $(p + "Curr").value = c; onCurrPick(p); }
});
// A curriculum → its years (the year is kept when it's in the new list) and the syllabus note
function onCurrPick(p) {
  const c = $(p + "Curr").value, other = c === "Other", year = $(p + "Year");
  $(p + "CurrOther").hidden = !other;
  const list = yearsOf(other ? "" : c);
  year.innerHTML = yearOptionsHtml(other ? "" : c, list.includes(year.value) ? year.value : "");
  onYearPick(p);
}
function onYearPick(p) {
  const note = $(p + "SylNote"), v = schoolFieldsValue(p);
  if (note) note.textContent = sylNoteText(v.curriculum, v.year);
}
document.addEventListener("input", e => { const d = e.target.dataset || {}; if (d.schoolpick) onSchoolPick(e.target); else if (d.yearpick) onYearPick(d.yearpick); });
document.addEventListener("change", e => { const d = e.target.dataset || {}; if (d.currpick) onCurrPick(d.currpick); else if (d.yearpick) onYearPick(d.yearpick); });
const GET_READY = [0, 5, 10, 15, 20, 30];        // "Get ready before" / "Break after" choices (minutes)

// The colors a person can have. color = strong color, soft = light background, ink = text on the light background.
// Soft, calm colors that look good together. Each person has ONE of them, used everywhere
// (calendar blocks, name buttons, ticks, legend, print). ink = dark, easy-to-read text for that color.
const PALETTE = {
  blue:   { color: "#4a7fd4", soft: "#e4edfb", ink: "#1f4a8f" },
  green:  { color: "#3e9f68", soft: "#e2f3e8", ink: "#1d6340" },
  pink:   { color: "#d45a8e", soft: "#fbe7ef", ink: "#94295a" },
  orange: { color: "#df8238", soft: "#fdeedd", ink: "#924a10" },
  teal:   { color: "#2f9a92", soft: "#dcf2ef", ink: "#14615b" },
  purple: { color: "#8167d2", soft: "#ece8fa", ink: "#4f3796" },
  red:    { color: "#d25f5f", soft: "#fae6e6", ink: "#922f2f" },
  yellow: { color: "#c79a22", soft: "#faf1d5", ink: "#755607" }
};
// The grey for fixed and shared activities
const GREY = { color: "#a9aebb", soft: "#f2f3f6", ink: "#4b5263" };
// Routines: the quick-add buttons (emoji, name, minutes, and the time the form starts with)
const ROUTINE_PRESETS = [
  { name: "Breakfast",       emoji: "🍳", duration: 20, start: "07:00" },
  { name: "Lunch",           emoji: "🍽️", duration: 30, start: "13:00" },
  { name: "Dinner",          emoji: "🍲", duration: 30, start: "19:00" },
  { name: "Shower",          emoji: "🚿", duration: 20, start: "20:00" },
  { name: "Get ready",       emoji: "🎒", duration: 20, start: "07:00" },
  { name: "Bedtime routine", emoji: "🌙", duration: 20, start: "20:30" }
];
// Good habits: the 5 prayers (5 small ticks) and the water drops (6 small ticks)
const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
const WATER_DROPS = 6;
// The habits you start with. kind: "single" (one tick), "prayers" (5 ticks), "water" (6 drops).
// off = the kids who have this habit turned off.
function defaultHabits() {
  const h = (id, emoji, name, kind) => ({ id, emoji, name, kind: kind || "single", off: [] });
  return [
    h("h-prayers", "🕌", "Prayers", "prayers"),
    h("h-teeth-am", "🪥", "Brush teeth (morning)"),
    h("h-teeth-pm", "🪥", "Brush teeth (night)"),
    h("h-clothes", "👕", "Wear clean clothes"),
    h("h-hug", "🤗", "Hug Mom and Dad"),
    h("h-water", "💧", "Drink water", "water"),
    h("h-quran", "📖", "Read Quran"),
    h("h-bed", "🛏️", "Make your bed"),
    h("h-tidy", "🧸", "Tidy your toys / room"),
    h("h-help", "🤝", "Help at home"),
    h("h-book", "📚", "Read a book for 15 minutes"),
    h("h-fruit", "🍎", "Eat a fruit or vegetable"),
    h("h-sleep", "😴", "Go to bed on time"),
    ...NEW_KID_HABITS.map(([id, emoji, name]) => h(id, emoji, name))
  ];
}
// Added later (older saved lists get them once, see habitsV2 in cleanData). ⏰ = the one 👨‍👩‍👧 parents check in the evening.
const NEW_KID_HABITS = [["h-listen", "👂", "I listened to Mum and Dad"], ["h-duties", "⏰", "I did my duties on time"]];
// ⚙️ Features the family can turn on / off (Settings, parents). Off = all its buttons, cards and points are hidden.
// A new family: all on except 🧹 Home duties.
const FEATURES = [["coach", "🎒", "School coach"], ["newsletter", "📰", "Newsletter"], ["riddles", "🧩", "Riddles"], ["diary", "📔", "My day"],
                  ["buddy", "✨", "Spark levels"], ["parentPoints", "👨‍👩‍👧", "Parent points"], ["wishes", "💌", "Kids' wishes"], ["prayer", "🕌", "Prayer times"],
                  ["chores", "🧹", "Home duties"], ["meeting", "🏡", "Our Community"]];   // (🏡 keeps the old key "meeting")   // (📗 Quran & Arabic, 📱 Screen time: removed)
const FEATURES_OFF = ["chores"];
const defaultFeatures = () => Object.fromEntries(FEATURES.map(([k]) => [k, !FEATURES_OFF.includes(k)]));
const feat = k => !!(data && data.features && data.features[k]);
// 📗 The surahs on the tracker: Al-Fatiha and Juz 'Amma (shown from An-Nas up)
const SURAHS = ["Al-Fatiha", "An-Naba", "An-Nazi'at", "Abasa", "At-Takwir", "Al-Infitar", "Al-Mutaffifin", "Al-Inshiqaq", "Al-Buruj", "At-Tariq", "Al-A'la",
                "Al-Ghashiyah", "Al-Fajr", "Al-Balad", "Ash-Shams", "Al-Layl", "Ad-Duha", "Ash-Sharh", "At-Tin", "Al-Alaq", "Al-Qadr", "Al-Bayyinah",
                "Az-Zalzalah", "Al-Adiyat", "Al-Qari'ah", "At-Takathur", "Al-Asr", "Al-Humazah", "Al-Fil", "Quraysh", "Al-Ma'un", "Al-Kawthar",
                "Al-Kafirun", "An-Nasr", "Al-Masad", "Al-Ikhlas", "Al-Falaq", "An-Nas"];
// 📔 My day: the 6 moods ([key, face, word]); 😢 😠 😨 → a gentle 🔔 to the parents
const MOODS = [["happy", "😄", "Happy"], ["ok", "🙂", "OK"], ["sad", "😢", "Sad"], ["angry", "😠", "Angry"], ["scared", "😨", "Scared"], ["tired", "😴", "Tired"]];
const HARD_MOODS = ["sad", "angry", "scared"];
// ✨ Sparks (stored as "buddy") that grow with all your points: a new look every 3 levels (4 stages).
// first / last = the names on the pick card ("🐛 Caterpillar … grows into 🌈🦋 Rainbow butterfly").
// (egg, seed, bug, dragon are the first 4: everyone who had one keeps it, with the same level.)
const BUDDIES = {
  egg:     { first: "Egg", last: "Eagle", noun: "eagle", stages: ["🥚", "🐣", "🐥", "🦅"] },
  seed:    { first: "Seed", last: "Blossom tree", noun: "tree", stages: ["🌱", "🌿", "🌳", "🌸"] },
  bug:     { first: "Caterpillar", last: "Rainbow butterfly", noun: "butterfly", stages: ["🐛", "🫘", "🦋", "🌈🦋"] },
  dragon:  { first: "Little dragon", last: "King dragon", noun: "dragon", stages: ["🐉", "🐲", "🔥🐉", "👑🐉"] },
  kitten:  { first: "Kitten", last: "Lion king", noun: "lion", stages: ["🐱", "🐈", "🦁", "👑🦁"] },
  puppy:   { first: "Puppy", last: "Moon wolf", noun: "wolf", stages: ["🐶", "🐕", "🐺", "🌕🐺"] },
  fish:    { first: "Fish", last: "Whale", noun: "whale", stages: ["🐟", "🐠", "🐬", "🐋"] },
  turtle:  { first: "Baby turtle", last: "Dino", noun: "dino", stages: ["🐢", "🐢", "🐊", "🦕"] },
  bunny:   { first: "Bunny", last: "Rainbow unicorn", noun: "unicorn", stages: ["🐰", "🐇", "🦄", "🌈🦄"] },
  star:    { first: "Star", last: "Shooting star", noun: "star", stages: ["⭐", "🌟", "💫", "🌠"] },
  rocket:  { first: "Rocket", last: "Galaxy", noun: "galaxy", stages: ["🚀", "🛸", "🪐", "🌌"] },
  robot:   { first: "Mini robot", last: "Super robot", noun: "robot", stages: ["🤖", "🦾", "🤖✨", "🛡️🤖"] },
  penguin: { first: "Penguin chick", last: "Polar bear", noun: "bear", stages: ["🐧", "🐧", "🦭", "🐻‍❄️"] },
  donut:   { first: "Sprinkle donut", last: "Candy castle", noun: "castle", stages: ["🍩", "🧁", "🎂", "🏰"] }
};
Object.values(BUDDIES).forEach(b => { b.label = `${b.stages[0]} ${b.first} → ${b.stages[b.stages.length - 1]} ${b.last}`; });
// 👨‍👩‍👧 The parents' good habits: their own list, in groups. One tick a day = points (+5, or what's written).
// id always starts with "ph-" (so a tick's points are known even after the habit is removed). off = the parents who hid it.
// (⚠️ The parents' habits FEATURE was removed. These stay ONLY so the family's old saved parent-habit data is read and kept
//  unchanged in the cloud (cleanData). Nothing shows or counts them.)
const PARENT_HABIT_POINTS = 5;
const PARENT_HABIT_GROUPS = [["kids", "👨‍👧", "With the kids"], ["faith", "🕌", "Faith"], ["health", "💪", "Health"],
                             ["calm", "🧘", "Calm & organised"], ["family", "❤️", "Family"], ["work", "💼", "Work"], ["other", "⭐", "My own"]];
function defaultParentHabits() {
  const h = (id, group, emoji, name, points = PARENT_HABIT_POINTS) => ({ id: "ph-" + id, group, emoji, name, points, off: [] });
  return [
    h("read", "kids", "📖", "Read with a kid"), h("homework", "kids", "🤝", "Helped with homework"), h("game", "kids", "🎲", "Played a game together"),
    h("car", "kids", "🚗", "Talked in the car (no phone)"), h("proud", "kids", "🤗", "Said \"I'm proud of you\""), h("bedtime", "kids", "🛏️", "Bedtime story / chat"),
    h("pray", "faith", "🕌", "Prayed on time"), h("adhkar", "faith", "📿", "Morning / evening adhkar"), h("quran", "faith", "📗", "Read Quran"),
    h("charity", "faith", "🤲", "Charity / helped someone"),
    h("exercise", "health", "🏃", "Exercise 20 min"), h("water", "health", "💧", "Drank 8 glasses of water"), h("meal", "health", "🥗", "Healthy meal"),
    h("sleep", "health", "😴", "Slept before 11"), h("steps", "health", "🚶", "10,000 steps"),
    h("dinner", "calm", "📵", "No phone at dinner"), h("nophone", "calm", "📵", "No phone 1 hour before sleep"), h("shout", "calm", "😌", "Didn't shout today"),
    h("tidy", "calm", "🧹", "Tidied one thing"), h("plan", "calm", "📅", "Planned tomorrow"),
    h("talk", "family", "💬", "Family talk time"), h("call", "family", "📞", "Called parents / family"), h("partner", "family", "💑", "Time with my partner"),
    h("cook", "family", "🍳", "Cooked for the family"),
    h("work", "work", "💼", "Did my work today"), h("ontime", "work", "⏰", "Finished work on time", 10), h("metime", "work", "☕", "Took free time for myself")
  ];
}
// Emoji ideas for new people
const EMOJIS = ["🦸‍♂️", "👩", "🚀", "🦄", "🦊", "🐼", "🐯", "🐸", "🐙", "🦋", "🐬", "🦖", "⚽", "🎨", "🌟", "🍓"];
// 👤 My profile: ❤️ things I love (each a short box the person fills themselves)
const LOVES = [["food", "🍕", "Favourite food"], ["color", "🎨", "Favourite colour"], ["game", "🎮", "Favourite game"], ["job", "🚀", "Dream job"]];

// The people you start with
function defaultUsers() {
  return [
    { id: DAD,     name: DAD_NAME, emoji: "🦸‍♂️", color: "blue" },
    { id: "mody",  name: "Mody",  emoji: "🚀", color: "green" },
    { id: "bana",  name: "Bana",  emoji: "🦄", color: "pink" },
    { id: "jawad", name: "Jawad", emoji: "🦊", color: "orange" }
  ];
}

// Common school subjects and their emoji. The subject is found from the activity's name.
// (Islamic comes before Reading, so "Quran reading" counts as Islamic.)
const SUBJECTS = [
  { name: "Islamic", emoji: "🕌", find: /islam|qur'?an|deen|قرآن|دين|إسلام|اسلام/i },
  { name: "Math",    emoji: "🔢", find: /math|رياضيات|حساب/i },
  { name: "Arabic",  emoji: "✍️", find: /arabic|عربي/i },
  { name: "English", emoji: "🔤", find: /english|إنجليزي|انجليزي/i },
  { name: "Science", emoji: "🔬", find: /science|علوم/i },
  { name: "Reading", emoji: "📚", find: /read|قراءة/i }
];
function findSubject(name) { return SUBJECTS.find(s => s.find.test(name)) || null; }
// Things the kids do without Dad: "Needs Dad" stays unticked for these (even "Science club").
const NOT_LESSON = /school|gym|sport|club|football|soccer|swim|training|practice|dinner|lunch|breakfast|work|play|park/i;
// ---------- Get ready / break: chosen automatically from the activity's name ----------
// (You can still change them in the activity form.)
//   sport (gym, football, swimming, training …) → 15 min before, 10 min break after
//   School, going out, trips, visits, appointments → 15 min before
//   meals, shower, bed, routines                   → nothing
//   lessons / studying and anything else           → 5 min before
const SPORT_WORDS = /\b(gym|sport|sports|football|soccer|swim|swimming|training|practice|karate|taekwondo|judo|basketball|tennis|run|running|cycling|dance|dancing)\b/i;
const OUTING_WORDS = /\b(going out|go out|outing|trip|trips|visit|visits|visiting|appointment|appointments|doctor|dentist|party|park|shopping)\b/i;
const NO_PREP_WORDS = /\b(breakfast|lunch|dinner|supper|meal|meals|snack|eat|eating|shower|bath|bed|bedtime|sleep|nap|routine)\b/i;
function autoPads(name) {
  const n = String(name || "");
  if (SPORT_WORDS.test(n)) return { getReady: 15, breakAfter: 10 };
  if (isSchoolName(n) || OUTING_WORDS.test(n)) return { getReady: 15, breakAfter: 0 };
  if (NO_PREP_WORDS.test(n)) return { getReady: 0, breakAfter: 0 };
  return { getReady: 5, breakAfter: 0 };   // lessons, studying, and anything else
}

// Is it School? (Bro2a's "School run" is not School: that's his own driving.)
function isSchoolName(name) { return /\bschool\b/i.test(name) && !/school run/i.test(name); }
// Is it a lesson? Then "Needs Dad" is ticked at first.
function isLesson(name) { return !NOT_LESSON.test(name) && (!!findSubject(name) || /teach|lesson|homework|study|tutor/i.test(name)); }

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
// Other ways the kids' names are written (so "Teach Mohammad math" is Mody's)
const ALIASES = {
  mody:  /moh?am+[ae]d|muham+[ae]d|\bmod(y|i|ie)\b|\bmoody\b|محمد|مودي/i,
  bana:  /بانا/,
  jawad: /\bjaw+ad\b|جواد/i
};
// Guess whose activity it is from its name. Nobody's name in it → Dad's.
function guessUser(name, users) {
  for (const u of users) {
    if (u.id === DAD) continue;
    const word = u.name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // whole word only: "Bana" matches "Bana reading" but not "Banana"
    const byName = word && new RegExp("(^|[^\\p{L}])" + word + "($|[^\\p{L}])", "iu").test(name);
    if (byName || (hasOwn(ALIASES, u.id) && ALIASES[u.id].test(name))) return u.id;
  }
  return DAD;
}

// ---------- Saving and loading ----------
// All your data lives in one object called "data".
// We store it in the browser's localStorage so it survives closing the browser.
function emptyData() {
  return {
    users: defaultUsers(),
    // Every activity belongs to one or more people ("users"). helper = a parent's id keeps THAT parent busy too
    // (only when they aren't one of its people already; "" = nobody). type = "study" | "activity" | "habit" | "other" (⭐ the score);
    // a Study one also has subjectId (a 🎒 School subject) and studyMode "sole" | "assisted" (assisted → helper helps).
    fixed: [],     // e.g. { id, name:"School", days:[0,1,2,3,4], start:"07:30", end:"14:00", overlapWith:[ids], users:["mody","bana","jawad"], helper:"", type:"other" }
    //   (fixed ones can also have getReady: 20 → a "🎒 Get ready" strip in the 20 minutes before)
    flexible: [],  // e.g. { id, name:"Math", duration:45, times:3, overlapWith:[ids], users:["mody"], helper:"dad", type:"study", subjectId:"s1", studyMode:"assisted" }
    // Routines: daily things like eating and shower. Nothing is planned on top of them. No points.
    routines: [],  // e.g. { id, name:"Lunch", emoji:"🍽️", start:"13:00", duration:30, days:[0..6], users:[ids], custom:false }
    // 📅 A parent's own activities (💼 Work, ✈️ Travel, 📌 Other): only on the calendar. The planner never moves them. No points.
    skips: {},      // ❌ sessions that didn't happen: "date|actId" → { by, at, why: "skip" | "moved" } (never planned on that date again)
    oneDay: [],     // 📌 one-day events, e.g. { id, title:"Dentist", who:["mody"], date:"2026-10-30", from:"16:00", to:"17:00", by:"dad", skip:[ids] }
    parentActs: [], // e.g. { id, title:"Dad away", type:"travel", by:"dad", start:"2026-10-19", end:"2026-10-22", from:"", to:"", weekly:false }
    //   (from / to = "09:00" / "17:00", or "" = all day; end = start except for travel)
    // When the day starts and ends. Free time = this minus fixed activities.
    // weekendOwn = true → Saturday and Sunday use weekendStart / weekendEnd instead.
    myDay: { start: "08:00", end: "21:00", weekendOwn: false, weekendStart: "08:00", weekendEnd: "21:00" },
    starAt: { day: 4, time: "18:00" },
    extraLimit: 3,   // 🤖 extra worksheets (not in a planned study session) a kid may make each day: 3–5 (⚙️ Settings, parents)   // ⭐ the Shining Star is announced on this weekday (0 = Monday) at this time (Dubai); the new week starts the next day
    maxTogether: 2, // most activities one person can be in at the same time (only ones you allowed together)
    plan: null,     // the week Dad planned with "Plan my week" (null = not planned yet)
    // Points: which activities are done this week. Starts again every Monday.
    //   week    = the Monday of this week, e.g. "2026-10-05"
    //   marks   = "day|activity id|person" → { user: that person (gets the points), by: who ticked it, at: when }
    //             (an activity for several people has one tick per person)
    //   history = past weeks' Shining Stars, newest first: { week, points, winners:[{ id, name, emoji }] }
    //   log     = ticks from past weeks with their date, kept for 5 weeks: { date:"2026-10-05", user }
    //             (the home page uses it to show the last 7 days)
    //   since   = the first day ticks were kept, e.g. "2026-10-05" (days before it aren't counted)
    //   auto    = 👨‍👩‍👧 a parent's points without a tick: "date|parent|kind|ref" → points (kind: check | practice | brief; at most 30 a day)
    //   prizes  = 🎁 a parent's weekly prize: "monday|parent" → { text, date } (+20 in the week it was given). Kept like history.
    //   riddles / riddleAns = 🧩 the riddles of the day and the answers (see RIDDLE OF THE DAY). Kept 5 weeks.
    //   diary    = 📔 "date|person" → { mood, best, bad, hard, scared, private, pts, at } (+5 the first save of the day). Kept 180 days.
    //   lifetime = 🌱 "monday|person" → that week's points (banked on the new week; all of them = the buddy's level). Never cleared.
    //   levels   = 🌱 person → [{ level, date }] (each level reached, for the level history)
    points: { week: pointsWeekOf(new Date()), since: ymd(new Date()), marks: {}, history: [], log: [], auto: {}, prizes: {}, riddles: {}, riddleAns: {},
              diary: {}, lifetime: {}, levels: {}, duties: {}, wishes: {},   // (✅ duties, 💌 wishes: see DUTIES ON TIME and WISHES)
              meeting: {}, screen: {}, quran: {}, quranHeard: {}, chores: {},   // (☰ MORE PAGES)
              want: {}, notes: {},   // (🎁 the prize I want, 💬 notes: see LEADERBOARD ROWS)
              study: {},   // (🎒 school points: 🤖 explanation read, 📤 answers uploaded: see SCHOOL POINTS)
              sessions: {},     // (📚 study session results: "date|actId|person" → { pct, by, at, ws?, note? }: see STUDY SCORE. Kept 180 days)
              free: {},         // (⭐ free study: "date|wsId|kid" → { make, up, bonus, at, sub }: see FREE STUDY. Kept 180 days)
              picks: {},        // (📚 "Which subject today?": "date|actId|kid" → { sid, name, by, at }: see STUDY SUBJECTS. Kept 180 days)
              studyWeeks: {},   // (📚 each past week's study per subject: "monday|kid" → { all, subjects }: see STUDY SCORE. Kept 8 weeks)
              prizeMsg: {},   // (⭐ the star, decided Friday 6 PM, and 🎁 the Saturday reminder: see maybeDecideStar)
              community: {}, cmReact: {}, cmDone: {},   // (🏡 Our Community: posts, reactions, ✅ done: see OUR COMMUNITY. Kept 180 days)
              hall: {},   // (🏆 Hall of Stars: "monday" → { id, name, emoji, gift, by }: see HALL OF STARS. Never cleared)
              when: {},   // (👀 "date|kind|ref|person" → when it happened: a habit / prayer tick, a riddle solved, homework done. Kept 5 weeks)
              reach: {} },   // (⚖️ "monday|person" → { s: fair score, at }: when they reached it, for a tie: see FAIR SCORE)
    // ☰ More pages' settings (see MORE PAGES): 📱 rate, 🧹 duties
    screenRate: { points: 10, minutes: 5, max: 60 }, chores: [],
    // Good habits: a daily checklist for the kids (not on the calendar). 1 point each (each prayer = 15 points, see habitValuePoints).
    habits: defaultHabits(),
    // 👨‍👩‍👧 The parents' good habits (their ticks are in habitMarks too, with these "ph-" ids)
    parentHabits: defaultParentHabits(),
    // ⚙️ Features on / off for the family (see FEATURES); featuresChosen = a parent went through "✨ Make the app yours" once
    features: defaultFeatures(),
    featuresChosen: false,
    // Habit ticks: "date|habit id|person" → true (one tick), [0/1 × 5] (prayers) or 1–6 (water drops). Kept 5 weeks.
    habitMarks: {},
    // 🎒 School, per kid (see cleanSchool): kid id → { info, grades, tasks, reviews, seesaw }
    //   (Seesaw photos are NOT in here: each one is its own cloud document, see "SEESAW PHOTOS")
    school: {},
    // 🕌 Prayer times: the family's place (worked out on the device with the adhan library, see PRAYER TIMES).
    //   Each person chooses to see them or not (showPrayer on the person). They never block anything.
    prayer: { ...PRAYER_DEFAULT },
    dadRenamed: true,  // Dad is already shown as "Bro2a" (see cleanData)
    schoolFixed: true, // the School rule was already applied (see cleanData)
    autoPads: true,    // the automatic get ready / break times were already given to all activities (see cleanData)
    colorsV2: true,    // the calm colors were already set (see cleanData)
    habitsV2: true     // 👂 ⏰ (kids) and 🍳 (parents) were already added to the habit lists (see cleanData)
  };
}

// Cleans up data that comes from storage or from a backup file:
// keeps every valid activity, fixes small problems, and fills in anything missing.
// It never throws away good data.
function cleanData(d) {
  const clean = emptyData();
  if (!d || typeof d !== "object") return clean;
  const isTime = t => typeof t === "string" && /^\d{2}:\d{2}$/.test(t);

  // People. (Older saved data had no people yet: then we start with Dad, Mody, Bana and Jawad.)
  if (Array.isArray(d.users)) {
    const seen = new Set();
    const users = d.users
      .filter(u => u && typeof u.id === "string" && u.id && typeof u.name === "string" && u.name.trim() && !seen.has(u.id) && seen.add(u.id))
      .map(u => ({ id: u.id, name: u.name.trim().slice(0, 30),
                   emoji: typeof u.emoji === "string" && u.emoji.trim() ? u.emoji.trim().slice(0, 8) : "🙂",
                   color: hasOwn(PALETTE, u.color) ? u.color : "purple",
                   // 👨‍👩‍👧 another parent (the family's first parent is always DAD): same rights as DAD, not a kid
                   ...(u.role === "parent" && u.id !== DAD ? { role: "parent" } : {}),
                   // 🕌 their own choice (older saved data: not set yet → they're asked once)
                   ...(typeof u.showPrayer === "boolean" ? { showPrayer: u.showPrayer } : {}),
                   ...(typeof u.prayerRemind === "boolean" ? { prayerRemind: u.prayerRemind } : {}),
                   // 🎒 a kid's school, school system and year (the School's kid profile), and their 🔑 code (older data: none)
                   ...(typeof u.school === "string" && u.school.trim() ? { school: u.school.trim().slice(0, 60) } : {}),
                   // (one of CURRICULA, or what the parent typed for "Other"; older "British" / "American" / "IB" → the new names)
                   ...(typeof u.curriculum === "string" && u.curriculum.trim() && u.curriculum !== "Other"
                       ? { curriculum: OLD_CURRICULA[u.curriculum] || u.curriculum.trim().slice(0, 40) } : {}),
                   ...(typeof u.year === "string" && u.year.trim() ? { year: u.year.trim().slice(0, 20) } : {}),
                   ...(isCode(u.code) ? { code: u.code } : {}),
                   // 🌱 their buddy (older data: none yet → they pick one)
                   //  (buddyAt = when it was picked: the newer pick wins when two phones meet, see mergeBuddies)
                   ...(hasOwn(BUDDIES, u.buddy) ? { buddy: u.buddy, ...(typeof u.buddyAt === "string" ? { buddyAt: u.buddyAt } : {}) } : {}),
                   // 👤 My profile: 🎂 birthday ("2016-03-14") and ❤️ things I love (short boxes they fill themselves)
                   ...(typeof u.birthday === "string" && /^\d{4}-\d{2}-\d{2}$/.test(u.birthday) ? { birthday: u.birthday } : {}),
                   ...(u.loves && typeof u.loves === "object" ? { loves: Object.fromEntries(LOVES.map(([k]) => [k, typeof u.loves[k] === "string" ? u.loves[k].trim().slice(0, 30) : ""]).filter(([, v]) => v)) } : {}),
                   // ✨ the Spark's own name (shown as "Spark"; the stored field stays "buddy")
                   ...(typeof u.sparkName === "string" && u.sparkName.trim() ? { sparkName: u.sparkName.trim().slice(0, 12) } : {}),
                   // 🖼️ a parent's picture: a small square JPEG photo (about 160×160) instead of their emoji (newer: older data has none)
                   ...(typeof u.photo === "string" && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(u.photo) && u.photo.length <= 60000 ? { photo: u.photo } : {}),
                   // ⭐ a parent's chosen habits ("ph-" ids, as many as they like) + focusAt (when chosen: the newer choice wins, see mergeBuddies)
                   ...(Array.isArray(u.focus) ? { focus: [...new Set(u.focus.filter(x => typeof x === "string" && x.startsWith("ph-")))].slice(0, 60),
                                                  ...(typeof u.focusAt === "string" ? { focusAt: u.focusAt } : {}) } : {}),
                   // 👋 they saw the first-time tour (saved on the person in the family data: never again, on any phone)
                   ...(u.toured === true ? { toured: true } : {}),
                   // 🧒 a parent went through (or skipped) the first-time kid setup for this kid: asked once only
                   ...(u.setupAsked === true ? { setupAsked: true } : {}) }));
    if (!users.some(u => u.id === DAD)) users.unshift(defaultUsers()[0]); // Dad is always there
    clean.users = users;
  }
  // 👋 One time only (the fix for the tour showing again): a family that already used the app → everyone there has seen the tour.
  // (People added later still get it once.)
  if (d.tourFix !== true) {
    const used = Object.keys((d.points && d.points.marks) || {}).length || Object.keys(d.habitMarks || {}).length || ((d.points && d.points.history) || []).length;
    if (used) clean.users.forEach(u => { u.toured = true; });
  }
  clean.tourFix = true;
  // One time only: Dad's shown name changes from "Dad" to "Bro2a" (same id, still the admin).
  // After that, "dadRenamed" is saved, so a name he picks himself later in Settings is kept.
  // One time only: the calm color set — Bro2a blue, Mody green, Bana pink, Jawad orange.
  // Anyone else who had one of those colors gets a free one, so every person keeps their OWN color.
  if (d.colorsV2 !== true) {
    const fixedColors = { [DAD]: "blue", mody: "green", bana: "pink", jawad: "orange" };
    clean.users.forEach(u => { if (hasOwn(fixedColors, u.id)) u.color = fixedColors[u.id]; });
    clean.users.forEach(u => {
      if (hasOwn(fixedColors, u.id)) return;
      if (clean.users.some(o => o !== u && o.color === u.color))
        u.color = Object.keys(PALETTE).find(k => !clean.users.some(o => o.color === k)) || u.color;
    });
  }
  const renameDad = d.dadRenamed !== true;
  if (renameDad) clean.users.forEach(u => { if (u.id === DAD && u.name === "Dad") u.name = DAD_NAME; });
  const userIds = clean.users.map(u => u.id);
  // Older saved data: every activity had ONE person ("user") instead of a list ("users").
  const oldFormat = [...(Array.isArray(d.fixed) ? d.fixed : []), ...(Array.isArray(d.flexible) ? d.flexible : [])]
    .some(f => f && !Array.isArray(f.users));
  // Who is the activity for? Keep everyone on its list who still exists.
  // Older activities had one "user"; even older flexible ones had a "kid" field; otherwise guess from the name, or give it to Dad.
  const ownerOf = f => userIds.includes(f.user) ? f.user
    : typeof f.kid === "string" ? (userIds.includes(f.kid) ? f.kid : f.kid === "" ? DAD : guessUser(String(f.name), clean.users))
    : guessUser(String(f.name), clean.users);
  const usersOf = f => {
    const ids = Array.isArray(f.users) ? [...new Set(f.users.map(String))].filter(id => userIds.includes(id)) : [];
    return ids.length ? ids : [ownerOf(f)];
  };
  // "Needs Dad": keep it if it's saved (only when Dad isn't one of its people). For older activities:
  // kids' flexible ones always used Dad's time before, so they need Dad; fixed ones need Dad only if they look like a lesson.
  // "Get ready before" and "Break after" (minutes; 0 = none). Older saved data has none.
  const padsOf = f => ({ getReady: GET_READY.includes(Number(f.getReady)) ? Number(f.getReady) : 0,
                         breakAfter: GET_READY.includes(Number(f.breakAfter)) ? Number(f.breakAfter) : 0 });
  // "Only between 4:00 and 8:00 pm" (flexible only; older saved data has none = any free time)
  const betweenOf = f => f.between && isTime(f.between.from) && isTime(f.between.to) && toMin(f.between.to) > toMin(f.between.from)
    ? { between: { from: f.between.from, to: f.between.to } } : {};
  const needsDadOf = (f, users, wasFlexible) => !users.includes(DAD) &&
    (typeof f.needsDad === "boolean" ? f.needsDad : wasFlexible || isLesson(String(f.name)));
  // 🤝 The parent who helps: activity.helper = ANY parent's id ("" = nobody). It's only planned when THAT parent is free too.
  // (Older data had "Needs Dad" (needsDad): kept as helper = Bro2a.) Never one of the activity's own people.
  // ⭐ Its type (see ACT_TYPES), and a 📚 Study one: subjectId (a 🎒 School subject) and studyMode "sole" | "assisted" (assisted = helper helps)
  const parentIds = clean.users.filter(u => u.id === DAD || u.role === "parent").map(u => u.id);
  const helpOf = (f, users, wasFlexible) => {
    const type = defaultActType(f);
    let helper = typeof f.helper === "string" ? (parentIds.includes(f.helper) && !users.includes(f.helper) ? f.helper : "")
      : needsDadOf(f, users, wasFlexible) ? DAD : "";
    if (type !== "study") return { type, helper };
    const studyMode = f.studyMode === "assisted" && helper ? "assisted" : "sole";
    if (studyMode === "sole") helper = "";
    // 📚 Its subjects: subjectIds = one or more subject ids, or ["all"] (All my subjects). An older single subjectId = a list of one.
    // (subjectId stays: the first one, for older phones)
    const ids = (Array.isArray(f.subjectIds) ? f.subjectIds : typeof f.subjectId === "string" && f.subjectId ? [f.subjectId] : [])
      .filter(x => typeof x === "string" && x).map(x => x.slice(0, 60)).slice(0, 30);
    const subjectIds = ids.includes(ALL_SUBJECTS) ? [ALL_SUBJECTS] : [...new Set(ids)];
    return { type, helper, subjectId: subjectIds.find(x => x !== ALL_SUBJECTS) || "", subjectIds, studyMode };
  };

  if (Array.isArray(d.fixed)) clean.fixed = d.fixed
    .filter(f => f && f.name && Array.isArray(f.days) && isTime(f.start) && isTime(f.end))
    .map(f => {
      const users = usersOf(f);
      return { id: String(f.id || newId()), name: String(f.name),
               days: f.days.map(Number).filter(x => x >= 0 && x <= LAST_DAY), start: f.start, end: f.end,
               overlapWith: Array.isArray(f.overlapWith) ? f.overlapWith.map(String) : [], // older data had no list: start empty
               users, ...helpOf(f, users, false), ...padsOf(f) };   // (🤝 helper · ⭐ type · 📚 study details)
    });

  // Routines (older saved data has none)
  if (Array.isArray(d.routines)) clean.routines = d.routines
    .filter(r => r && typeof r.name === "string" && r.name.trim() && Array.isArray(r.days) && isTime(r.start)
                 && Number(r.duration) >= 5 && toMin(r.start) + Number(r.duration) <= 24 * 60)
    .map(r => {
      const users = Array.isArray(r.users) ? [...new Set(r.users.map(String))].filter(id => userIds.includes(id)) : [];
      return { id: String(r.id || newId()), name: r.name.trim().slice(0, 30),
               emoji: typeof r.emoji === "string" && r.emoji.trim() ? r.emoji.trim().slice(0, 8) : "⏰",
               start: r.start, duration: Math.round(Number(r.duration)),
               days: [...new Set(r.days.map(Number))].filter(x => x >= 0 && x <= LAST_DAY).sort(),
               users: users.length ? users : [...userIds], custom: r.custom === true };
    })
    .filter(r => r.days.length);

  // 📅 Parents' own activities (older saved data has none)
  const isYmdText = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (Array.isArray(d.parentActs)) clean.parentActs = d.parentActs
    .filter(a => a && typeof a.title === "string" && a.title.trim() && userIds.includes(a.by) && isYmdText(a.start))
    .map(a => {
      const type = ["work", "travel", "other"].includes(a.type) ? a.type : "other";
      const end = type === "travel" && isYmdText(a.end) && a.end >= a.start ? a.end : a.start;
      const timed = type !== "travel" && isTime(a.from) && isTime(a.to) && toMin(a.to) > toMin(a.from);
      return { id: String(a.id || newId()), title: a.title.trim().slice(0, 40), type, by: a.by, start: a.start, end,
               from: timed ? a.from : "", to: timed ? a.to : "", weekly: a.weekly === true };
    });
  // ❌ Sessions that didn't happen (newer: older data has none): the last 60 days
  if (d.skips && typeof d.skips === "object" && !Array.isArray(d.skips)) Object.entries(d.skips).forEach(([k, v]) => {
    if (/^\d{4}-\d{2}-\d{2}\|[^|]{1,60}$/.test(k) && k.slice(0, 10) >= addDaysYmd(todayYmd(), -60) && v && typeof v === "object")
      clean.skips[k] = { by: String(v.by || "").slice(0, 40), at: String(v.at || "").slice(0, 40), why: v.why === "moved" ? "moved" : "skip" };
  });
  // 📌 One-day events (newer: older data has none): only on their date, for one or more people, never scored.
  // skip = the activities a parent removed for that day because of it (the planner doesn't put them back on that date)
  if (Array.isArray(d.oneDay)) clean.oneDay = d.oneDay
    .filter(e => e && typeof e.title === "string" && e.title.trim() && isYmdText(e.date) && isTime(e.from) && isTime(e.to) && toMin(e.to) > toMin(e.from)
                 && Array.isArray(e.who) && e.who.some(id => userIds.includes(id)))
    .map(e => ({ id: String(e.id || newId()).slice(0, 40), title: e.title.trim().slice(0, 40), who: e.who.filter(id => userIds.includes(id)),
                 date: e.date, from: e.from, to: e.to, ...(typeof e.by === "string" ? { by: e.by.slice(0, 40) } : {}),
                 ...(Array.isArray(e.skip) ? { skip: e.skip.map(String).slice(0, 40) } : {}) }));

  // Good habits (older saved data has none: start with the default list) and their ticks
  // ("Say please and thank you" was removed from the list: it's dropped from saved data too, with its ticks.)
  const REMOVED_HABITS = ["h-please"];
  if (Array.isArray(d.habits)) clean.habits = d.habits
    .filter(h => h && typeof h.id === "string" && h.id && !h.id.includes("|") && !REMOVED_HABITS.includes(h.id)
                 && typeof h.name === "string" && h.name.trim())
    .map(h => ({ id: h.id, name: h.name.trim().slice(0, 40),
                 emoji: typeof h.emoji === "string" && h.emoji.trim() ? h.emoji.trim().slice(0, 8) : "⭐",
                 kind: h.kind === "prayers" || h.kind === "water" ? h.kind : "single",
                 off: Array.isArray(h.off) ? [...new Set(h.off.map(String))].filter(id => userIds.includes(id)) : [],
                 // points a tick (1 unless a parent chose more) · gone = 🗑️ removed, kept only so its points stay counted
                 ...(Number(h.points) > 1 ? { points: Math.min(50, Math.round(Number(h.points))) } : {}), ...(h.gone === true ? { gone: true } : {}),
                 // ⭐ must = the date it became a Must-do (from then on, a day not fully done locks that week's ⭐ Score, see mustMissed)
                 ...(typeof h.must === "string" && /^\d{4}-\d{2}-\d{2}$/.test(h.must) ? { must: h.must } : {}) }));
  // 👨‍👩‍👧 The parents' habits (older saved data has none: the starter list)
  if (Array.isArray(d.parentHabits)) clean.parentHabits = d.parentHabits
    .filter(h => h && typeof h.id === "string" && /^ph-[^|.]+$/.test(h.id) && typeof h.name === "string" && h.name.trim())
    .map(h => ({ id: h.id, name: h.name.trim().slice(0, 40),
                 emoji: typeof h.emoji === "string" && h.emoji.trim() ? h.emoji.trim().slice(0, 8) : "⭐",
                 group: PARENT_HABIT_GROUPS.some(g => g[0] === h.group) ? h.group : "other",
                 points: h.points === 10 ? 10 : PARENT_HABIT_POINTS,
                 off: Array.isArray(h.off) ? [...new Set(h.off.map(String))].filter(id => userIds.includes(id)) : [] }));
  // ☰ More pages' settings (older saved data has none: the defaults)
  if (d.screenRate && Number(d.screenRate.points) > 0 && Number(d.screenRate.minutes) > 0)
    clean.screenRate = { points: Math.round(Number(d.screenRate.points)), minutes: Math.round(Number(d.screenRate.minutes)), max: Math.max(0, Math.round(Number(d.screenRate.max) || 0)) };
  if (Array.isArray(d.chores)) clean.chores = d.chores.filter(ch => ch && typeof ch.title === "string" && ch.title.trim() && Array.isArray(ch.kids) && Array.isArray(ch.days))
    .map(ch => ({ id: String(ch.id || newId()), title: ch.title.trim().slice(0, 40), emoji: typeof ch.emoji === "string" && ch.emoji.trim() ? ch.emoji.trim().slice(0, 8) : "🧹",
                  kids: ch.kids.filter(id => userIds.includes(id)), days: [...new Set(ch.days.map(Number).filter(i => i >= 0 && i <= 6))].sort(),
                  turns: ch.turns === true, every: ch.every === "week" ? "week" : "day" }));
  // ⚙️ Features (older saved data has none: the defaults, so 🧹 Home duties is off)
  // (📱 "screen": a removed feature's switch is kept as it was, never shown)
  if (d.features && typeof d.features === "object") [...FEATURES.map(([k]) => k), "screen"].forEach(k => { if (typeof d.features[k] === "boolean") clean.features[k] = d.features[k]; });
  clean.featuresChosen = d.featuresChosen === true;
  // 👂 ⏰ (kids) and 🍳 (parents) were added later: older saved lists get them once (removing them later is kept)
  if (d.habitsV2 !== true) {
    NEW_KID_HABITS.forEach(([id, emoji, name]) => { if (!clean.habits.some(h => h.id === id)) clean.habits.push({ id, emoji, name, kind: "single", off: [] }); });
    if (!clean.parentHabits.some(h => h.id === "ph-cook")) clean.parentHabits.push(defaultParentHabits().find(h => h.id === "ph-cook"));
  }
  if (d.habitMarks && typeof d.habitMarks === "object") Object.entries(d.habitMarks).forEach(([key, v]) => {
    if (!/^\d{4}-\d{2}-\d{2}\|[^|]+\|[^|]+$/.test(key) || REMOVED_HABITS.includes(key.split("|")[1])) return;
    if (v === true) clean.habitMarks[key] = true;
    else if (Array.isArray(v) && v.length === PRAYERS.length) clean.habitMarks[key] = v.map(x => x ? 1 : 0);
    else if (typeof v === "number" && key.split("|")[1].startsWith("ph-") && [5, 10].includes(v)) clean.habitMarks[key] = v;   // (👨‍👩‍👧 a removed habit's tick: its points)
    else if (typeof v === "number" && v >= 1 && v <= WATER_DROPS) clean.habitMarks[key] = Math.round(v);
  });

  if (Array.isArray(d.flexible)) clean.flexible = d.flexible
    .filter(f => f && f.name && Number(f.duration) > 0 && Number(f.times) > 0)
    .map(f => {
      const users = usersOf(f);
      return { id: String(f.id || newId()), name: String(f.name),
               duration: Number(f.duration), times: Math.min(DAYS.length, Number(f.times)),
               overlapWith: Array.isArray(f.overlapWith) ? f.overlapWith.map(String) : [],
               users, ...helpOf(f, users, true), ...padsOf(f), ...betweenOf(f),   // (🤝 helper · ⭐ type · 📚 study details)
               ...(f.twice === false ? { twice: false } : {}),   // (⏱️ "make one day's session longer" switched off)
               oldCanOverlap: f.canOverlap === true };
    });

  // ---- Fixing older data (from before an activity could be for several people) ----
  // 1) School that belongs to Dad goes to the kids (the ones without their own School), and School never "Needs Dad".
  // 2) The same fixed activity saved once per person (same name, days and times) becomes ONE activity with all of them.
  const mergedInto = {};   // id of an activity that was merged → id of the one it was merged into
  let fixedOld = false;    // did we change anything? Then the week is planned again with the fixed data.
  if (oldFormat) {
    const kids = userIds.filter(id => id !== DAD);
    const isSchool = f => /\bschool\b/i.test(f.name);
    clean.fixed.filter(isSchool).forEach(f => {
      if (f.users.includes(DAD) && kids.length) {
        const without = kids.filter(k => !clean.fixed.some(o => o !== f && isSchool(o) && o.users.includes(k)));
        f.users = [...new Set([...f.users.filter(id => id !== DAD), ...(without.length ? without : kids)])];
        fixedOld = true;
      }
      if (f.helper) { f.helper = ""; fixedOld = true; }
    });
    const sameDays = (a, b) => [...a.days].sort().join() === [...b.days].sort().join();
    const kept = [];
    clean.fixed.forEach(f => {
      const twin = kept.find(k => k.name.trim().toLowerCase() === f.name.trim().toLowerCase() && k.start === f.start
                                  && k.end === f.end && k.helper === f.helper && sameDays(k, f));
      if (!twin) return kept.push(f);
      twin.users = [...new Set([...twin.users, ...f.users])];
      twin.overlapWith = [...new Set([...twin.overlapWith, ...f.overlapWith])];
      mergedInto[f.id] = twin.id;
      fixedOld = true;
    });
    clean.fixed = kept;
    clean.fixed.forEach(f => { if (f.users.includes(f.helper)) f.helper = ""; });
  }
  const newIdOf = id => hasOwn(mergedInto, id) ? mergedInto[id] : id;

  // Older saved data had one "Can overlap" checkbox instead of a list.
  // Convert it: every activity that had it ticked can overlap with every other one that had it ticked.
  const oldGroup = clean.flexible.filter(f => f.oldCanOverlap).map(f => f.id);
  clean.flexible.forEach(f => {
    if (f.oldCanOverlap && !f.overlapWith.length) f.overlapWith = oldGroup.filter(id => id !== f.id);
    delete f.oldCanOverlap;
  });
  // Fixed and flexible activities can both be on each other's lists.
  const all = [...clean.fixed, ...clean.flexible];
  const allIds = all.map(f => f.id);
  all.forEach(f => f.users.sort((a, b) => userIds.indexOf(a) - userIds.indexOf(b)));  // people in the usual order
  all.forEach(f => f.overlapWith = [...new Set(f.overlapWith.map(newIdOf))]
    .filter(id => id !== f.id && allIds.includes(id))); // merged ones get their new id; drop deleted ones
  // Make the lists two-way: if A can overlap with B, then B can overlap with A.
  all.forEach(f => f.overlapWith.forEach(id => {
    const other = all.find(o => o.id === id);
    if (!other.overlapWith.includes(f.id)) other.overlapWith.push(f.id);
  }));

  // ---- School is for the kids: kids can't do lessons while they're at school ----
  // 1) School saved under Bro2a (older data) goes to the kids, without "Needs Dad".
  //    The first time, Bro2a keeps his school run as his own activities (20 min drop-off before, 20 min pick-up after),
  //    unless he's already busy then.
  const kidIds = userIds.filter(id => id !== DAD);
  const hhmm = m => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  const dadBusy = (days, s, e) => clean.fixed.some(o => peopleOf(o).includes(DAD) && o.days.some(x => days.includes(x))
                                                   && toMin(o.start) < e && s < toMin(o.end));
  let schoolMoved = false;
  clean.fixed.filter(f => isSchoolName(f.name) && f.users.includes(DAD) && kidIds.length).forEach(f => {
    const rest = f.users.filter(id => id !== DAD);
    f.users = rest.length ? rest : [...kidIds];
    f.helper = "";
    f.overlapWith = [];
    schoolMoved = true;
    if (d.schoolFixed === true) return;
    const s = toMin(f.start), e = toMin(f.end);
    [["School run (drop-off)", s - 20, s], ["School run (pick-up)", e, e + 20]].forEach(([name, a, b]) => {
      if (a >= 0 && b <= 24 * 60 && !dadBusy(f.days, a, b))
        clean.fixed.push({ id: newId(), name, days: [...f.days], start: hhmm(a), end: hhmm(b), overlapWith: [], users: [DAD], helper: "", type: "activity", getReady: 0, breakAfter: 0 });
    });
  });
  // 2) Lessons can never be "together" with School: take School off their lists (both ways).
  const schoolIds = clean.fixed.filter(f => isSchoolName(f.name)).map(f => f.id);
  const flexIds = clean.flexible.map(f => f.id);
  let schoolUnlinked = false;
  clean.flexible.forEach(f => { const n = f.overlapWith.length; f.overlapWith = f.overlapWith.filter(id => !schoolIds.includes(id)); schoolUnlinked ||= f.overlapWith.length < n; });
  clean.fixed.filter(f => schoolIds.includes(f.id)).forEach(f => f.overlapWith = f.overlapWith.filter(id => !flexIds.includes(id)));

  // "My day" hours. (Older saved data had a "free hours" list per day instead — that's no longer used.)
  const m = d.myDay;
  if (m && typeof m === "object") {
    const okPair = (s, e) => isTime(s) && isTime(e) && toMin(e) > toMin(s);
    if (okPair(m.start, m.end)) Object.assign(clean.myDay, { start: m.start, end: m.end });
    if (okPair(m.weekendStart, m.weekendEnd)) Object.assign(clean.myDay, { weekendStart: m.weekendStart, weekendEnd: m.weekendEnd });
    clean.myDay.weekendOwn = m.weekendOwn === true;
    // 🕗 Each day's own start and end, Monday … Sunday (newer: older data has none, then the hours above are used)
    if (Array.isArray(m.days) && m.days.length === DAYS.length && m.days.every(x => x && okPair(x.start, x.end)))
      clean.myDay.days = m.days.map(x => ({ start: x.start, end: x.end }));
  }

  const max = Math.round(Number(d.maxTogether));
  if (max >= 1 && max <= 5) clean.maxTogether = max;  // otherwise keep the default (2)
  if ([3, 4, 5].includes(Number(d.extraLimit))) clean.extraLimit = Number(d.extraLimit);   // 🤖 (otherwise the default 3)
  // ⭐ When the Shining Star is announced (a parent picks it in ⚙️ Settings): weekday 0–6 (Monday = 0) + "HH:MM"
  if (d.starAt && Number.isInteger(d.starAt.day) && d.starAt.day >= 0 && d.starAt.day <= 6 && /^\d{2}:\d{2}$/.test(d.starAt.time || ""))
    clean.starAt = { day: d.starAt.day, time: d.starAt.time };

  // The saved plan. Older versions didn't save the plan, they only remembered "planned":
  // then we plan once with the new rules when the app opens ("redo").
  // 📅 By date: plan.dates = { "2026-10-23": { items } }, upTo = the last date planned.
  // (Older plans were one week: plan.days[0–6] for the points week's Monday … Sunday. They're turned into dates here,
  // keeping every item, time and pin; this is the same every time it runs. The cloud copy is only changed by a parent's
  // device that's online and signed in: see cloudUpload / cloudUpdateFields.)
  const p = d.plan;
  const ptsWeek = d.points && isYmdText(d.points.week) ? d.points.week : clean.points.week;
  const txt = (x, n) => typeof x === "string" ? x.slice(0, n) : "";
  const cleanItems = day => (day && Array.isArray(day.items) ? day.items : [])
    .filter(it => it && typeof it.actId === "string" && Number.isFinite(it.start) && Number.isFinite(it.end))
    .map(it => ({ actId: it.actId, fixed: !!it.fixed, start: it.start, end: it.end, ...(it.pinned === true ? { pinned: true } : {}),
                  // (🗂️ a deleted activity kept as history: what it was)
                  ...(it.gone && typeof it.gone === "object" && txt(it.gone.name, 60) ? { gone: { name: txt(it.gone.name, 60),
                      users: (Array.isArray(it.gone.users) ? it.gone.users : []).map(String), people: (Array.isArray(it.gone.people) ? it.gone.people : []).map(String),
                      type: txt(it.gone.type, 20) || "activity" } } : {}) }));
  let dates = null, upTo = "";
  if (p && p.dates && typeof p.dates === "object" && !Array.isArray(p.dates)) {
    dates = {};
    Object.entries(p.dates).forEach(([ds, day]) => { if (isYmdText(ds)) dates[ds] = { items: cleanItems(day) }; });
    upTo = isYmdText(p.upTo) ? p.upTo : Object.keys(dates).sort().pop() || "";
  } else if (p && Array.isArray(p.days) && p.days.length === DAYS.length) {
    dates = {};
    p.days.forEach((day, i) => dates[addDaysYmd(ptsWeek, i)] = { items: cleanItems(day) });
    upTo = addDaysYmd(ptsWeek, LAST_DAY);
  }
  if (dates) {
    const keepFrom = addDaysYmd(todayYmd(), -PLAN_KEEP);   // (only the last 14 days are kept as history)
    Object.keys(dates).forEach(ds => { if (ds < keepFrom) delete dates[ds]; });
    clean.plan = { dates, warnings: Array.isArray(p.warnings) ? p.warnings.map(String) : [], key: typeof p.key === "string" ? p.key : "", upTo };
  } else if (d.planned) clean.plan = "redo";
  // Older data: if we fixed School or merged activities, plan the week again with the new rules.
  // If nothing changed and the plan was up to date, it stays up to date.
  if (oldFormat && clean.plan && clean.plan !== "redo") {
    if (fixedOld) clean.plan = "redo";
    else if (clean.plan.key === oldPlanKey(d)) clean.plan.key = PLAN_FRESH;
  }
  // The new School rule: plan the week again once (and again whenever School had to be fixed),
  // so no lesson stays on top of School.
  if (clean.plan && (d.schoolFixed !== true || schoolMoved || schoolUnlinked)) clean.plan = "redo";
  // Get ready / break time: once, EVERY existing activity (fixed and flexible) gets the automatic times
  // from its name (Gym 15 + 10, School 15, lessons 5 …), and the week is planned again.
  // After that, changes made in the activity form are kept.
  if (d.autoPads !== true) {
    [...clean.fixed, ...clean.flexible].forEach(f => Object.assign(f, autoPads(f.name)));
    if (clean.plan) clean.plan = "redo";
  }

  // Points (older saved data has none yet: start at zero this week)
  const pts = d.points;
  if (pts && typeof pts === "object") {
    const isDate = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
    if (isDate(pts.week)) clean.points.week = pts.week;
    // Older saved data has no "since": ticks were kept from the start of the saved week.
    clean.points.since = isDate(pts.since) ? pts.since : clean.points.week;
    if (Array.isArray(pts.log)) clean.points.log = pts.log
      .filter(t => t && isDate(t.date) && typeof t.user === "string").map(t => ({ date: t.date, user: t.user }));
    // Ticks are "date|activity|person" (📅 by date). Older ticks were "day|activity|person" with the day 0–6 of the points week
    // (turned into its date here, the same every time), and older still "day|activity" (the person was only inside).
    if (pts.marks && typeof pts.marks === "object") Object.entries(pts.marks).forEach(([key, v]) => {
      if (!/^([0-6]|\d{4}-\d{2}-\d{2})\|./.test(key) || !v || typeof v.user !== "string") return;
      const [day, actId, user = v.user] = key.split("|");
      clean.points.marks[`${markDateOf(day, clean.points.week)}|${newIdOf(actId)}|${user}`] =
        { user, by: typeof v.by === "string" ? v.by : user, at: typeof v.at === "string" ? v.at : "" };
    });
    if (Array.isArray(pts.history)) clean.points.history = pts.history
      .filter(h => h && isDate(h.week) && Array.isArray(h.winners))
      .map(h => ({ week: h.week, points: Number(h.points) || 0, ...(Number(h.fair) >= 0 && h.fair !== undefined && h.fair !== null ? { fair: Math.min(100, Math.round(Number(h.fair))) } : {}),   // (⚖️ newer)
                   ...(Number(h.max) >= 0 && h.max != null ? { max: Math.min(100, Math.round(Number(h.max))) } : {}),   // (⭐ the score's max, newer still)
                   winners: h.winners.filter(w => w && typeof w.name === "string")
                     .map(w => ({ id: String(w.id || ""), name: renameDad && w.id === DAD && w.name === "Dad" ? DAD_NAME : w.name, emoji: typeof w.emoji === "string" ? w.emoji : "🙂",
                                  ...(w.kinds && typeof w.kinds === "object" ? { kinds: { tasks: Number(w.kinds.tasks) || 0, habits: Number(w.kinds.habits) || 0, fun: Number(w.kinds.fun) || 0 } } : {}) })) }))
      .slice(0, 104);
    // 👨‍👩‍👧 Parents' auto points and 🎁 prizes (older saved data has none)
    if (pts.auto && typeof pts.auto === "object") Object.entries(pts.auto).forEach(([key, n]) => {
      if (/^\d{4}-\d{2}-\d{2}\|[^|]+\|(check|practice|brief)\|[^|]+$/.test(key) && Number.isFinite(Number(n))) clean.points.auto[key] = Math.max(0, Math.min(30, Number(n)));
    });
    if (pts.prizes && typeof pts.prizes === "object") Object.entries(pts.prizes).forEach(([key, p]) => {
      if (/^\d{4}-\d{2}-\d{2}\|[^|]+$/.test(key) && p && isDate(p.date))
        clean.points.prizes[key] = { text: typeof p.text === "string" ? p.text.trim().slice(0, 60) : "", date: p.date };
    });
    // 🧩 Riddles of the day and the answers (older saved data has none)
    const s = (x, n) => typeof x === "string" ? x.slice(0, n) : "";
    if (pts.riddles && typeof pts.riddles === "object") Object.entries(pts.riddles).forEach(([date, r]) => {
      if (!isDate(date) || !r || typeof r !== "object") return;
      if (!Array.isArray(r.list)) { if (typeof r.at === "string") clean.points.riddles[date] = { making: s(r.making, 40), at: r.at }; return; }
      const list = r.list.filter(x => x && typeof x.for === "string" && typeof x.question === "string" && Array.isArray(x.options)
                                        && x.options.length === 4 && x.options.includes(x.answer))
        .map(x => ({ for: x.for, kind: s(x.kind, 20), question: s(x.question, 400), options: x.options.map(o => s(o, 120)), answer: s(x.answer, 120),
                     hint: s(x.hint, 300), fun_fact: s(x.fun_fact, 300) }));
      clean.points.riddles[date] = { by: s(r.by, 40), at: s(r.at, 40), list };
    });
    if (pts.riddleAns && typeof pts.riddleAns === "object") Object.entries(pts.riddleAns).forEach(([key, v]) => {
      if (!v || typeof v !== "object") return;
      if (/^\d{4}-\d{2}-\d{2}\|[^|]+$/.test(key))
        clean.points.riddleAns[key] = { tries: Math.max(0, Math.min(2, Math.round(Number(v.tries) || 0))),
          wrong: Array.isArray(v.wrong) ? v.wrong.map(Number).filter(n => n >= 0 && n < 4) : [], hint: v.hint === true, solved: v.solved === true,
          pts: [5, 10].includes(v.pts) ? v.pts : 0, ask: s(v.ask, 40) };
      else if (/^\d{4}-\d{2}-\d{2}\|[^|]+\|help$/.test(key) && typeof v.helper === "string")
        clean.points.riddleAns[key] = { helper: v.helper, right: v.right === true, pick: Number(v.pick) || 0, at: s(v.at, 40) };
    });
    // 📔 My day, 🌱 lifetime points and levels (older saved data has none)
    if (pts.diary && typeof pts.diary === "object") Object.entries(pts.diary).forEach(([key, v]) => {
      if (!/^\d{4}-\d{2}-\d{2}\|[^|]+$/.test(key) || !v || !MOODS.some(m => m[0] === v.mood)) return;
      clean.points.diary[key] = { mood: v.mood, best: s(v.best, 120), bad: s(v.bad, 120), hard: s(v.hard, 120), scared: s(v.scared, 120),
                                  private: v.private === true, pts: v.pts === 5 ? 5 : 0, at: s(v.at, 40) };
    });
    if (pts.lifetime && typeof pts.lifetime === "object") Object.entries(pts.lifetime).forEach(([key, n]) => {
      if (/^\d{4}-\d{2}-\d{2}\|[^|]+$/.test(key) && Number.isFinite(Number(n))) clean.points.lifetime[key] = Math.max(0, Math.round(Number(n)));
    });
    // ☰ More pages (older saved data has none)
    const obj = x => x && typeof x === "object" && !Array.isArray(x), each = (m, f) => { if (obj(m)) Object.entries(m).forEach(([k, v]) => { if (obj(v) || Array.isArray(v)) f(k, v); }); };
    const dayKey = (k, parts) => new RegExp(`^\\d{4}-\\d{2}-\\d{2}(\\|[^|]+){${parts}}$`).test(k);
    each(pts.meeting, (k, v) => { if (dayKey(k, 1)) clean.points.meeting[k] = { great: s(v.great, 140), better: s(v.better, 140), goal: s(v.goal, 140), at: s(v.at, 40) }; });
    each(pts.screen, (k, v) => { if (dayKey(k, 1)) { const bought = Math.max(0, Math.round(Number(v.bought) || 0));
      clean.points.screen[k] = { bought, used: Math.min(bought, Math.max(0, Math.round(Number(v.used) || 0))), run: s(v.run, 40) }; } });
    each(pts.quran, (k, v) => { clean.points.quran[k] = {
      surahs: Object.fromEntries(Object.entries(obj(v.surahs) ? v.surahs : {}).filter(([i, st]) => Number(i) >= 0 && Number(i) < SURAHS.length && (st === "done" || st === "revising"))),
      words: (Array.isArray(v.words) ? v.words : []).filter(w => w && typeof w.text === "string").map(w => ({ id: s(w.id, 40) || newId(), text: s(w.text, 40), date: isDate(w.date) ? w.date : "" })).slice(-200) }; });
    each(pts.quranHeard, (k, v) => { if (dayKey(k, 2)) clean.points.quranHeard[k] = { by: s(v.by, 40), at: s(v.at, 40) }; });
    each(pts.chores, (k, v) => { if (dayKey(k, 2)) clean.points.chores[k] = { at: s(v.at, 40) }; });
    // 🏡 Our Community (newer: older data has none)
    const okPost = k => /^[A-Za-z0-9_-]{1,40}$/.test(k);
    each(pts.community, (k, v) => { if (okPost(k) && hasOwn(CM_TYPES, v.type) && s(v.text, 300)) clean.points.community[k] = { type: v.type, text: s(v.text, 300), by: s(v.by, 40), at: s(v.at, 40),
      ...(v.type === "review" && [1, 2, 3, 4, 5].includes(v.stars) ? { stars: v.stars } : {}), ...(Array.isArray(v.to) ? { to: v.to.filter(x => typeof x === "string").slice(0, 20) } : {}) }; });
    if (obj(pts.cmReact)) Object.entries(pts.cmReact).forEach(([k, v]) => { const [p, who] = k.split("|"); if (okPost(p) && who && CM_REACTS.includes(v)) clean.points.cmReact[k] = v; });
    each(pts.cmDone, (k, v) => { if (okPost(k)) clean.points.cmDone[k] = { by: s(v.by, 40), at: s(v.at, 40) }; });
    each(pts.hall, (k, v) => { if (dayKey(k, 0) && (s(v.id, 40) || s(v.name, 30))) clean.points.hall[k] = { id: s(v.id, 40), name: s(v.name, 30), emoji: s(v.emoji, 8), gift: s(v.gift, 40), by: s(v.by, 10) }; });   // 🏆
    if (obj(pts.when)) Object.entries(pts.when).forEach(([k, v]) => { if (dayKey(k, 3) && typeof v === "string") clean.points.when[k] = v.slice(0, 40); });   // 👀
    each(pts.reach, (k, v) => { const n = Math.round(Number(v.s)); if (dayKey(k, 1) && n >= 0 && n <= 100) clean.points.reach[k] = { s: n, at: s(v.at, 40) }; });   // ⚖️
    each(pts.prizeMsg, (k, v) => { if (dayKey(k, 0)) clean.points.prizeMsg[k] = { star: s(v.star, 200), text: s(v.text, 80), at: s(v.at, 40), ...(v.reminded === true ? { reminded: true } : {}),
      ...(Array.isArray(v.board) ? { board: v.board.filter(x => x && typeof x.id === "string").slice(0, 12).map(x => ({ id: s(x.id, 40), s: Math.max(0, Math.min(200, Math.round(Number(x.s) || 0))) })) } : {}) }; });   // ⭐ 🎁 (board = the results when announced)
    each(pts.study, (k, v) => { if (dayKey(k, 3) && hasOwn(STUDY_POINTS, k.split("|")[2])) clean.points.study[k] = { at: s(v.at, 40) }; });   // 🎒
    // 📚 Study sessions: the result (0–100 %) of one session, and each past week's study per subject (newer: older data has none)
    each(pts.sessions, (k, v) => { const p = Math.round(Number(v.pct)); if (dayKey(k, 2) && p >= 0 && p <= 100)
      clean.points.sessions[k] = { pct: p, by: s(v.by, 40), at: s(v.at, 40), ...(s(v.ws, 40) ? { ws: s(v.ws, 40) } : {}), ...(s(v.note, 80) ? { note: s(v.note, 80) } : {}),
                                   ...(s(v.swap, 30) ? { swap: s(v.swap, 30) } : {}) }; });   // (🔁 another subject done in the session)
    // ⭐ Free study: a worksheet outside a planned session (newer: older data has none)
    const fp = (x, max) => Math.max(0, Math.min(max, Math.round(Number(x) || 0)));
    each(pts.free, (k, v) => { if (dayKey(k, 2)) clean.points.free[k] = { make: fp(v.make, FREE_POINTS.make), up: fp(v.up, FREE_POINTS.up), bonus: fp(v.bonus, FREE_POINTS.top),
      at: s(v.at, 40), sub: s(v.sub, 30), ...(v.capped === true ? { capped: true } : {}), ...(v.checked === true ? { checked: true } : {}) }; });
    // 📚 The subject a kid picked for a study session with more than one subject (newer: older data has none)
    each(pts.picks, (k, v) => { if (dayKey(k, 2) && s(v.sid, 60) && s(v.name, 30)) clean.points.picks[k] = { sid: s(v.sid, 60), name: s(v.name, 30), by: s(v.by, 40), at: s(v.at, 40) }; });
    const part = x => { const n = k => Math.max(0, Math.round(Number(x && x[k]) || 0));
      return { planned: n("planned"), done: n("done"), hours: Math.min(50, n("hours")), eff: Math.min(50, n("eff")), study: Math.min(100, n("study")) }; };
    each(pts.studyWeeks, (k, v) => { if (dayKey(k, 1)) clean.points.studyWeeks[k] = { all: part(v.all),
      subjects: (Array.isArray(v.subjects) ? v.subjects : []).filter(x => x && s(x.name, 30)).slice(0, 20).map(x => ({ name: s(x.name, 30), ...part(x) })) }; });
    // 🎁 The prize I want and 💬 notes (older saved data has none)
    each(pts.want, (k, v) => { if (dayKey(k, 1) && typeof v.text === "string" && v.text.trim()) clean.points.want[k] = { text: s(v.text, 40), ok: v.ok === true, by: s(v.by, 40) }; });
    each(pts.notes, (k, v) => { if (dayKey(k, 1) && typeof v.text === "string" && v.text.trim()) clean.points.notes[k] = { text: s(v.text, 80), by: s(v.by, 40), at: s(v.at, 40) }; });
    // ✅ Duties and 💌 wishes (older saved data has none)
    if (pts.duties && typeof pts.duties === "object") Object.entries(pts.duties).forEach(([key, x]) => {
      if (/^\d{4}-\d{2}-\d{2}\|[^|]+$/.test(key) && x && ["yes", "partly", "no"].includes(x.v)) clean.points.duties[key] = { v: x.v, by: s(x.by, 40), at: s(x.at, 40) };
    });
    if (pts.wishes && typeof pts.wishes === "object") Object.entries(pts.wishes).forEach(([key, w]) => {
      if (!/^\d{4}-\d{2}-\d{2}\|[^|]+$/.test(key) || !w || typeof w !== "object") return;
      const done = w.done && typeof w.done === "object" ? w.done : {};
      clean.points.wishes[key] = { me: s(w.me, 120), sib: s(w.sib, 120), at: s(w.at, 40),
                                   done: { ...(done.me === true ? { me: true } : {}), ...(done.sib === true ? { sib: true } : {}) } };
    });
    if (pts.levels && typeof pts.levels === "object") Object.entries(pts.levels).forEach(([who, list]) => {
      if (Array.isArray(list)) clean.points.levels[who] = list.filter(x => x && Number(x.level) >= 1 && isDate(x.date))
        .map(x => ({ level: Math.round(Number(x.level)), date: x.date })).slice(-100);
    });
  }
  // 🎒 School pages (older saved data has none)
  clean.school = cleanSchool(d.school);
  // 🕌 Prayer times' place (older saved data has none: Al Barsha, Dubai).
  // The earlier version's untouched default (Amman) also becomes Al Barsha; a place Bro2a picked himself is kept.
  const pr = d.prayer;
  if (pr && typeof pr === "object") {
    const lat = Number(pr.lat), lng = Number(pr.lng);
    const wasAmman = lat === PRAYER_AMMAN.lat && lng === PRAYER_AMMAN.lng && (pr.city === PRAYER_AMMAN.city || !pr.city);
    if (!wasAmman && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      Object.assign(clean.prayer, { lat, lng });
      clean.prayer.city = typeof pr.city === "string" ? pr.city.trim().slice(0, 40) : "";
    }
    clean.prayer.show = pr.show !== false;
    clean.prayer.remind = pr.remind !== false;
  }
  return clean;
}

// 🎒 School data for each kid. Lists are objects (id → item), so the cloud can change ONE item at a time.
//   info    = { name: "Al Noor School", grade: "Grade 3B", teachers: "Ms. Sara (Math) …", timetable: { "0": ["Math", "English"], … } }
//             (timetable: day 0 = Monday … 6 = Sunday → that day's subjects in order)
//             (info.grade = the class, info.teachers = the teacher)
//   grades  = id → { subject, date: "2026-10-12", type: "quiz" | "exam" | "homework" | "worksheet", score: 8, max: 10, task?, worksheet? }
//             (task = the homework it came from, when Bro2a ✅ checked its answers)
//             (worksheet = the 🤖 worksheet it came from, once it was checked: id "w" + its id, +10 points that week)
//   tasks   = id → { kind: "homework" | "exam", subject, title, due: "2026-10-20", done: false,
//                    by?, doneAt?: "2026-10-19" (+10 points that week), answer?: file id, checked?: { score, max, note, at } }
//   reviews = Monday of the week ("2026-10-12") → { note, effort, behaviour, focus }   (1–5 stars)
//   seesaw  = id → { date, type: "homework" | "comment" | "grade", text, photo: true/false }
//   subjects = id → { name, emoji, color, order }   (📚 the folders; older data: Math, Science, English, Arabic)
//   files   = id → { subject, name, kind: "image" | "pdf" | "link", url? (links), size, date, by, task?, work?, worksheet? }
//             (the file itself is NOT here: each one is its own cloud document families/{family}/files/{id}, see SCHOOL FILES)
//             (work = the 📥 school work card it belongs to, worksheet = the 🤖 worksheet it's the answers of)
//   notes   = id → { subject, text, date, by }
//   work    = id → { subject, title, date, what_to_do, topics: ["Fractions", …], files: [file ids], by }
//             (📥 school work that 🤖 read; older data has none. Worksheets / explanations: see AI HELP)
//   profile = { asked: true once 👤 was asked, subjects: { folder id → { level: 1–3 (⭐), good: "Good at…", hard: "Finds hard…",
//               unsure?: true ("Not sure" → a 🧪 placement test), test?: that test's worksheet id } }, other }
//             (an unsure subject has level 0 until its test is checked: then the level comes from the score)
//   syllabus = { name, text (≤ 20000 characters), date, by } | null   (📄 the year's syllabus: sent with every 🤖 worksheet)
//   brief    = { at, date, summary, subjects: [{ subject, level, strong_points, weak_points, next_steps }], home_tips } | null
//              (📋 the latest Brief for parents)
//   events  = id → { date: "2026-10-22", time: "08:30" | "" (all day), title, note, by }   (📌 school dates from the 📰 newsletter)
//   week    = { label, n, start, end, subjects: [{ subject, topics }], reminders: [text] } | null   (📰 "This week", until end)
//             (profile / events / week are newer: older data has none)
//   requests = id → { kind: "work" | "practice", subject, files?: [file ids], topic?, part?, topics?, count?, mode?, date, by }
//   topics   = subject (lower case) → { at, list: [{ title, term, now }] }   (✏️ Make a worksheet: the subject's topics from 🤖)
//             (⏳ a kid's device asked: a parent's device does the 🤖 part — ✅ Read now / ✅ Make now)
const GRADE_TYPES = ["quiz", "exam", "homework", "worksheet"];
const TASK_KINDS = ["homework", "exam"];
const SEESAW_TYPES = ["homework", "comment", "grade"];
const FILE_KINDS = ["image", "pdf", "pptx", "docx", "link"];
const REVIEW_PARTS = [["effort", "💪 Effort"], ["behaviour", "😊 Behaviour"], ["focus", "🎯 Focus"]];
const DEFAULT_SUBJECTS = {
  "s-math":    { name: "Math",    emoji: "➗", color: "blue",   order: 0 },
  "s-science": { name: "Science", emoji: "🔬", color: "green",  order: 1 },
  "s-english": { name: "English", emoji: "📖", color: "purple", order: 2 },
  "s-arabic":  { name: "Arabic",  emoji: "✍️", color: "orange", order: 3 }
};
// 🏫 📚 🎓 The school basics saved on the kid (in 👤 the profile), in the order a missing one is asked
const BASIC_KEYS = ["school", "curriculum", "year"];
// ⭐ An activity's TYPE for the score (see SCORE): [key, emoji, word]. "other" is never scored.
const ACT_TYPES = [["study", "📚", "Study"], ["activity", "⚽", "Activity"], ["other", "🗂️", "Other"]];
const ACT_TYPE_KEYS = ACT_TYPES.map(t => t[0]);
// An activity saved before types existed gets one, once (then it's kept): a name with "school" → "other" (on the calendar, no score),
// everything else → "activity". An unknown type → "activity". (Hoisted: cleanData uses it while loading.)
function defaultActType(a) {
  if (a && ACT_TYPE_KEYS.includes(a.type)) return a.type;
  if (a && a.type != null) return "activity";
  return /school/i.test(String((a && a.name) || "")) ? "other" : "activity";
}
// 🎒 School points (✅ Tasks, see SCHOOL POINTS): 🤖 an explanation read · 📤 answers uploaded
const STUDY_POINTS = { ex: 5, up: 5 };
// ⭐ Free study (a worksheet outside a planned study session): +2 made (given with the answers) · +15 answers · +10 (≥ 80 %) / +5 (50–79 %) after the check
// Only the first 3 a day for each subject earn points (Dubai date, counted when the answers go up). See FREE STUDY.
const FREE_POINTS = { make: 2, up: 15, top: 10, mid: 5 }, FREE_CAP = 3;
const ALL_SUBJECTS = "all";   // 📚 a study activity's subjectIds: ["all"] = All my subjects (see actSubjectsFor)
// 🏡 Our Community: the kinds of post [emoji, name, what it's for, an example] and the reactions (see OUR COMMUNITY)
const CM_TYPES = { note: ["📝", "Note", "Something about our family", "We had fun at the park!"],
                   need: ["🙏", "I need", "Ask Mum and Dad", "I need new school shoes"],
                   please: ["📣", "Please", "Ask the kids", "Please tidy your rooms today"],
                   review: ["⭐", "Review", "Rate the week or the app", "Fun week!"] };
const CM_REACTS = ["❤️", "👍", "😂", "🙏"];
function emptySchool() {
  return { info: { name: "", grade: "", teachers: "", timetable: {} }, grades: {}, tasks: {}, reviews: {}, seesaw: {},
           subjects: JSON.parse(JSON.stringify(DEFAULT_SUBJECTS)), files: {}, notes: {}, work: {},
           profile: { asked: false, subjects: {}, other: "", skip: [] }, events: {}, week: null, requests: {}, syllabus: null, brief: null, topics: {},
           learn: {},   // (🧠 the learning profile per subject: see LEARNING PROFILE)
           curr: {}, map: {}, bench: {},   // (📚 the school topics, 🌍 the official curriculum, 📏 the benchmark: see STUDY TOPICS)
           wsScores: {} };   // (📝 a small copy of every worksheet's check, so the score stays: see ALL MY WORKSHEETS)
}
const isHm = x => typeof x === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(x);   // "08:30"
function cleanSchool(s) {
  const out = {};
  if (!s || typeof s !== "object" || Array.isArray(s)) return out;
  const isDate = x => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x);
  const txt = (x, n) => typeof x === "string" ? x.trim().slice(0, n) : "";
  const okKey = k => /^[A-Za-z0-9_-]{1,40}$/.test(k);
  // Keeps every good item of a list (id → item); fn cleans one item (null = drop it)
  const list = (m, fn) => {
    const r = {};
    if (m && typeof m === "object" && !Array.isArray(m)) Object.entries(m).forEach(([k, v]) => {
      const c = okKey(k) && v && typeof v === "object" ? fn(v, k) : null;
      if (c) r[k] = c;
    });
    return r;
  };
  const stars = x => { const n = Math.round(Number(x)); return n >= 1 && n <= 5 ? n : 0; };
  Object.entries(s).forEach(([kid, k]) => {
    if (!okKey(kid) || kid === DAD || !k || typeof k !== "object") return;
    const c = emptySchool(), info = k.info && typeof k.info === "object" ? k.info : {};
    c.info.name = txt(info.name, 60);
    c.info.grade = txt(info.grade, 30);
    c.info.teachers = txt(info.teachers, 300);
    if (info.timetable && typeof info.timetable === "object") for (let d = 0; d <= LAST_DAY; d++) {
      const subs = Array.isArray(info.timetable[d]) ? info.timetable[d].map(x => txt(x, 30)).filter(Boolean).slice(0, 12) : [];
      if (subs.length) c.info.timetable[d] = subs;
    }
    c.grades = list(k.grades, g => {
      const score = Number(g.score), max = Number(g.max);
      if (!txt(g.subject, 30) || !isDate(g.date) || !Number.isFinite(score) || score < 0 || !(max > 0)) return null;
      return { subject: txt(g.subject, 30), date: g.date, type: GRADE_TYPES.includes(g.type) ? g.type : "quiz", score, max,
               ...(okKey(String(g.task || "")) ? { task: g.task } : {}), ...(okKey(String(g.worksheet || "")) ? { worksheet: g.worksheet } : {}) };
    });
    // (by / doneAt / answer / checked are newer: older homework has none, and keeps no homework points)
    c.tasks = list(k.tasks, t => {
      if (!txt(t.subject, 30) || !isDate(t.due)) return null;
      const ck = t.checked && typeof t.checked === "object" ? t.checked : null, score = ck && Number(ck.score), max = ck && Number(ck.max);
      return { kind: TASK_KINDS.includes(t.kind) ? t.kind : "homework", subject: txt(t.subject, 30), title: txt(t.title, 80), due: t.due, done: t.done === true,
               ...(okKey(String(t.by || "")) ? { by: t.by } : {}),
               ...(t.done === true && isDate(t.doneAt) ? { doneAt: t.doneAt } : {}),
               ...(okKey(String(t.answer || "")) ? { answer: t.answer } : {}),
               ...(ck && Number.isFinite(score) && score >= 0 && max > 0 ? { checked: { score, max, note: txt(ck.note, 200), at: isDate(ck.at) ? ck.at : "" } } : {}) };
    });
    // 📚 Subject folders (older data has none: the 4 default folders)
    c.subjects = k.subjects && typeof k.subjects === "object" && !Array.isArray(k.subjects)
      ? list(k.subjects, x => txt(x.name, 30) ? { name: txt(x.name, 30), emoji: txt(x.emoji, 8) || "📘",
                                                   color: hasOwn(PALETTE, x.color) ? x.color : "blue", order: Number(x.order) || 0,
                                                   ...(x.hidden === true ? { hidden: true } : {}),   // (🙈 hidden by a parent: kept, not shown)
                                                   // (🎯 "Worksheets per week" a parent set: 1–7; 0 / none = no goal)
                                                   ...(Number(x.goal) >= 1 && Number(x.goal) <= 7 ? { goal: Math.round(Number(x.goal)) } : {}) } : null)
      : JSON.parse(JSON.stringify(DEFAULT_SUBJECTS));
    c.files = list(k.files, f => {
      const kind = FILE_KINDS.includes(f.kind) ? f.kind : null, url = kind === "link" && /^https?:\/\/\S+$/i.test(String(f.url || "")) ? String(f.url).slice(0, 500) : null;
      if (!kind || !isDate(f.date) || (kind === "link" && !url)) return null;
      return { subject: txt(f.subject, 30), name: txt(f.name, 60) || "File", kind, ...(url ? { url } : {}), size: Math.max(0, Number(f.size) || 0), date: f.date,
               ...(okKey(String(f.by || "")) ? { by: f.by } : {}), ...(okKey(String(f.task || "")) ? { task: f.task } : {}),
               ...(okKey(String(f.work || "")) ? { work: f.work } : {}), ...(okKey(String(f.worksheet || "")) ? { worksheet: f.worksheet } : {}) };
    });
    // 📥 School work cards (newer: older data has none)
    c.work = list(k.work, w => !txt(w.title, 80) || !isDate(w.date) ? null
      : { subject: txt(w.subject, 30), title: txt(w.title, 80), date: w.date, what_to_do: txt(w.what_to_do, 600),
          topics: Array.isArray(w.topics) ? w.topics.map(x => txt(x, 40)).filter(Boolean).slice(0, 8) : [],
          files: Array.isArray(w.files) ? w.files.filter(x => okKey(String(x || ""))).slice(0, 20) : [],
          ...(okKey(String(w.by || "")) ? { by: w.by } : {}) });
    // 👤 Kid profile, 📌 school dates, 📰 this week
    const p = k.profile && typeof k.profile === "object" ? k.profile : {};
    // (skip: the 🏫 📚 🎓 basics a parent answered "Not now" to: never asked again)
    c.profile = { asked: p.asked === true, other: txt(p.other, 400), skip: Array.isArray(p.skip) ? BASIC_KEYS.filter(b => p.skip.includes(b)) : [], subjects: list(p.subjects, x => {
      const level = [1, 2, 3].includes(Number(x.level)) ? Number(x.level) : 0, good = txt(x.good, 150), hard = txt(x.hard, 150);
      const unsure = x.unsure === true, test = unsure && okKey(String(x.test || "")) ? { test: x.test } : {};
      return level || good || hard || unsure ? { level, good, hard, ...(unsure ? { unsure } : {}), ...test } : null;
    }) };
    // 🧠 Learning profile per subject (newer: older data has none): subject id → { level 1–10, skills: { name: { mastery 0–100, tries, right, last } },
    //    history: [{ date, ws, pct, level, hand? }] (the last 30; hand = a parent set the level) }
    const lnum = (y, hi) => Math.max(0, Math.min(hi, Math.round(Number(y)) || 0));
    const skillsIn = m => {
      const skills = {};
      if (m && typeof m === "object" && !Array.isArray(m)) Object.entries(m).slice(0, 60).forEach(([n, v]) => {
        const name = txt(n, 60);
        if (name && v && typeof v === "object") skills[name] = { mastery: lnum(v.mastery, 100), tries: lnum(v.tries, 99999),
                                                                   right: Math.min(lnum(v.right, 99999), lnum(v.tries, 99999)), last: isDate(v.last) ? v.last : "" };
      });
      return skills;
    };
    c.learn = list(k.learn, x => {
      const lv = Math.round(Number(x.level)), skills = skillsIn(x.skills);
      const history = (Array.isArray(x.history) ? x.history : []).filter(h => h && isDate(h.date)).slice(-30)
        .map(h => ({ date: h.date, ws: okKey(String(h.ws || "")) ? h.ws : "", pct: lnum(h.pct, 100), level: Math.max(1, lnum(h.level, 10)), ...(h.hand === true ? { hand: true } : {}) }));
      // 🔗 per topic (newer): topic key → { title, src: "school" | "instant" | "igcse", results: [{ date, ws, pct }] (last 12), skills }
      const topics = {};
      if (x.topics && typeof x.topics === "object" && !Array.isArray(x.topics)) Object.entries(x.topics).slice(0, 100).forEach(([key, t]) => {
        if (!okKey(key) || !t || typeof t !== "object" || !txt(t.title, 80)) return;
        topics[key] = { title: txt(t.title, 80), src: ["instant", "igcse"].includes(t.src) ? t.src : "school",
                        results: (Array.isArray(t.results) ? t.results : []).filter(r => r && isDate(r.date)).slice(-12)
                          .map(r => ({ date: r.date, ws: okKey(String(r.ws || "")) ? r.ws : "", pct: lnum(r.pct, 100) })),
                        skills: skillsIn(t.skills) };
      });
      return { level: lv >= 1 && lv <= 10 ? lv : 5, skills, history, topics };
    });
    // 📄 Syllabus and 📋 Brief for parents (newer: older data has none)
    const sy = k.syllabus;
    c.syllabus = sy && typeof sy === "object" && txt(sy.text, 20000)
      ? { name: txt(sy.name, 60) || "Syllabus", text: txt(sy.text, 20000), date: isDate(sy.date) ? sy.date : "", ...(okKey(String(sy.by || "")) ? { by: sy.by } : {}) } : null;
    const bf = k.brief, strs = (x, n, len) => (Array.isArray(x) ? x : []).map(t => txt(t, len)).filter(Boolean).slice(0, n);
    c.brief = bf && typeof bf === "object" && txt(bf.summary, 1500)
      ? { at: txt(bf.at, 40), date: isDate(bf.date) ? bf.date : "", summary: txt(bf.summary, 1500),
          subjects: (Array.isArray(bf.subjects) ? bf.subjects : []).filter(x => x && txt(x.subject, 30)).slice(0, 12)
            .map(x => ({ subject: txt(x.subject, 30), level: txt(x.level, 80), strong_points: strs(x.strong_points, 5, 150),
                         weak_points: strs(x.weak_points, 5, 150), next_steps: strs(x.next_steps, 5, 300) })),
          home_tips: strs(bf.home_tips, 6, 400) } : null;
    c.events = list(k.events, e => !txt(e.title, 80) || !isDate(e.date) ? null
      : { date: e.date, time: isHm(e.time) ? e.time : "", title: txt(e.title, 80), note: txt(e.note, 300), ...(okKey(String(e.by || "")) ? { by: e.by } : {}) });
    c.requests = list(k.requests, q => !["work", "practice"].includes(q.kind) || !txt(q.subject, 30) || !isDate(q.date) ? null
      : { kind: q.kind, subject: txt(q.subject, 30), date: q.date, ...(okKey(String(q.by || "")) ? { by: q.by } : {}),
          ...(q.kind === "work" ? { files: (Array.isArray(q.files) ? q.files : []).filter(x => okKey(String(x || ""))).slice(0, 20) }
                                : { topic: txt(q.topic, 80), part: txt(q.part, 80),
                                    // (✏️ Make a worksheet on a kid's phone: several topics, how many questions, which kind)
                                    ...(Array.isArray(q.topics) ? { topics: q.topics.map(t => txt(t, 80)).filter(Boolean).slice(0, 8) } : {}),
                                    ...([5, 10, 15].includes(q.count) ? { count: q.count } : {}),
                                    ...(["practice", "challenge", "level_check"].includes(q.mode) ? { mode: q.mode } : {}) }) });
    // ✏️ The topics of each subject from 🤖 (/topics): subject (lower case) → { at, list: [{ title, term, now }] }
    c.topics = {};
    if (k.topics && typeof k.topics === "object") Object.entries(k.topics).forEach(([sub, x]) => {
      if (!x || !Array.isArray(x.list) || sub.length > 40) return;
      c.topics[sub] = { at: txt(x.at, 40), list: x.list.filter(t => t && txt(t.title, 80)).slice(0, 20).map(t => ({ title: txt(t.title, 80), term: txt(t.term, 20), now: t.now === true })) };
    });
    const wk = k.week;
    c.week = wk && typeof wk === "object" && isDate(wk.start) && isDate(wk.end)
      ? { label: txt(wk.label, 60), n: Math.max(0, Math.round(Number(wk.n)) || 0), start: wk.start, end: wk.end,
          subjects: (Array.isArray(wk.subjects) ? wk.subjects : []).filter(x => x && txt(x.subject, 30)).slice(0, 12)
            .map(x => ({ subject: txt(x.subject, 30), topics: (Array.isArray(x.topics) ? x.topics : []).map(t => txt(t, 60)).filter(Boolean).slice(0, 8) })),
          reminders: (Array.isArray(wk.reminders) ? wk.reminders : []).map(t => txt(t, 200)).filter(Boolean).slice(0, 10) }
      : null;
    c.notes = list(k.notes, n => txt(n.text, 1000) && isDate(n.date)
      ? { subject: txt(n.subject, 30), text: txt(n.text, 1000), date: n.date, ...(okKey(String(n.by || "")) ? { by: n.by } : {}) } : null);
    // 📚 School topics (see STUDY TOPICS): topic id → { sub: subject id, title, note, added: date, files: [file ids], by? }.
    //    Older data has none: made once from the 📥 school work cards and 📰 this week's topics (fixed ids: every phone makes the same).
    c.curr = k.curr && typeof k.curr === "object" && !Array.isArray(k.curr)
      ? list(k.curr, t => !txt(t.title, 80) || !okKey(String(t.sub || "")) ? null
          : { sub: t.sub, title: txt(t.title, 80), note: txt(t.note, 200), added: isDate(t.added) ? t.added : "",
              files: (Array.isArray(t.files) ? t.files : []).filter(x => okKey(String(x || ""))).slice(0, 30), ...(okKey(String(t.by || "")) ? { by: t.by } : {}),
              // (⚡ added from a worksheet; 🔗 the worksheets that practise it: worksheet id → the topic as that worksheet words it)
              ...(t.src === "ws" ? { src: "ws" } : {}),
              ...(t.links && typeof t.links === "object" && !Array.isArray(t.links) ? { links: Object.fromEntries(Object.entries(t.links)
                .filter(([id, w]) => okKey(id) && txt(w, 80)).slice(-200).map(([id, w]) => [id, txt(w, 80)])) } : {}) })
      : currFromOld(c);
    // 🌍 The official curriculum per subject (parents only, never mixed with the school topics): subject id → { at, list: [{ title, term, now }] }
    //    (older data: the 🤖 /topics lists kept by subject name)
    c.map = {};
    if (k.map && typeof k.map === "object" && !Array.isArray(k.map)) Object.entries(k.map).forEach(([sid, x]) => {
      if (okKey(sid) && x && Array.isArray(x.list)) c.map[sid] = { at: txt(x.at, 40), list: x.list.filter(t => t && txt(t.title, 80)).slice(0, 30).map(t => ({ title: txt(t.title, 80), term: txt(t.term, 20), now: t.now === true })) };
    });
    else Object.entries(c.topics).forEach(([name, x]) => { const sid = subjectIdIn(c, name); if (sid && !c.map[sid]) c.map[sid] = { at: x.at, list: x.list }; });
    // 📏 The benchmark per subject (parents): subject id → { at, covered, not_yet, ahead, note }
    const titles = x => (Array.isArray(x) ? x : []).map(t => txt(t, 80)).filter(Boolean).slice(0, 40);
    c.bench = list(k.bench, x => ({ at: txt(x.at, 40), covered: titles(x.covered), not_yet: titles(x.not_yet), ahead: titles(x.ahead), note: txt(x.note, 400) }));
    // 📝 Each checked worksheet's score (newer: older data has none): worksheet id → { pct, score, total, at, title, subject, date, kind }
    c.wsScores = list(k.wsScores, x => {
      const score = Number(x.score), total = Number(x.total);
      if (!Number.isFinite(score) || !(total > 0)) return null;
      return { pct: Math.max(0, Math.min(100, Math.round(Number(x.pct)) || 0)), score, total, at: txt(x.at, 40),
               title: txt(x.title, 120), subject: txt(x.subject, 30), date: isDate(x.date) ? x.date : "", kind: txt(x.kind, 30) };
    });
    c.reviews = list(k.reviews, (r, week) => !isDate(week) ? null
      : { note: txt(r.note, 600), effort: stars(r.effort), behaviour: stars(r.behaviour), focus: stars(r.focus) });
    c.seesaw = list(k.seesaw, x => {
      const text = txt(x.text, 3000), photo = x.photo === true;
      return isDate(x.date) && (text || photo) ? { date: x.date, type: SEESAW_TYPES.includes(x.type) ? x.type : "comment", text, photo } : null;
    });
    out[kid] = c;
  });
  return out;
}

// The plan's "fingerprint" the way the older version made it (one person per activity),
// so we can tell if a plan saved by that version was up to date.
function oldPlanKey(d) {
  try {
    return JSON.stringify({
      fx: d.fixed.map(f => [f.id, f.days, f.start, f.end, [...f.overlapWith].sort(), f.user, f.needsDad]),
      fl: d.flexible.map(f => [f.id, f.duration, f.times, [...f.overlapWith].sort(), f.user, f.needsDad]),
      day: [d.myDay.start, d.myDay.end, d.myDay.weekendOwn, d.myDay.weekendStart, d.myDay.weekendEnd],
      max: d.maxTogether
    });
  } catch (e) { return null; }
}

function load() {
  let saved = null;
  try { saved = localStorage.getItem(SAVE_KEY); } catch (e) {}
  if (!saved) return emptyData();
  try {
    return cleanData(JSON.parse(saved));
  } catch (e) {
    // The saved data couldn't be read. Instead of losing it, keep a copy under another name.
    try { localStorage.setItem(SAVE_KEY + ".unreadable." + Date.now(), saved); } catch (e2) {}
    return emptyData();
  }
}

// ---------- Where the data is stored ----------
// writeData() is the ONLY place that stores the data:
//   1) this device's localStorage (a fast local copy, so the app opens quickly and works offline)
//   2) the family cloud (Firebase), so every phone shows the same thing — see "FAMILY CLOUD" below.
// how: (nothing) = a normal change · "auto" = the app tidied up by itself (e.g. a new week)
//      · "replace" = replace ALL the cloud data with this (Import backup, Clear everything, Load example)
// It also remembers what was stored, so we can tell when there are unsaved changes (a "draft").
let saveWarned = false;
let savedJson = null;     // the data as it was last stored
// The family cloud's state (filled in by the "FAMILY CLOUD" part below)
const cloud = {
  enabled: location.protocol.startsWith("http"),  // opened from a web address (file:// can't sign in)
  fb: null,          // the Firebase functions, once they're loaded from the internet
  auth: null, db: null, user: null,
  familyId: null,    // whose family data this device uses (families/{familyId}/…), from members/{uid}
  role: null,        // "parent" | "kid" (a kid's device opens straight as that kid, see KID DEVICE)
  kidId: null,       // a kid's device: which person they are
  pending: null,     // what the login screen is doing: { kind: "create" | "kid" | "parentcode", … } (see resolveMember)
  fresh: null,       // a brand-new family: start with only the parent, then "Add your kids"
  refs: null,        // the 3 cloud documents: plan, points, habits
  unsub: [],         // to stop listening (when signing out)
  snaps: {},         // the newest copy of each document
  ready: false,      // true once this device's data and the cloud's data are matched up
  asking: false,     // the "Which data should we use?" box is open
  sent: null,        // what the cloud has (as far as we know), so we only upload what changed
  stash: null        // a plan change from another phone that came while you had unsaved changes
};
// 🔔 This device's own id, so it can tell its own changes from the other devices' (see "WHAT'S NEW" below)
const DEVICE = (() => {
  const key = SAVE_KEY + ".device";
  try { let id = localStorage.getItem(key); if (!id) { id = newId(); localStorage.setItem(key, id); } return id; }
  catch (e) { return newId(); }
})();
// The family's news list (the cloud document "news"), and what this device already showed
const feed = {
  ref: null,         // the cloud document
  items: {},         // id → { id, kind: "tick" | "plan", by, who, what, short, list, n, at, start, dev }
  live: false,       // true once the cloud itself answered (news from before that doesn't pop up)
  seen: new Set(),   // news this device already knows about ("id:n")
  fresh: new Set(),  // news that was new when the list was opened (shown in color)
  bundle: null       // ticks that arrived within the same minute: one notification for all of them
};
function writeData(how) {
  savedJson = JSON.stringify(data);
  storeLocal();
  if (cloud.ready) { if (how === "replace") cloudUploadAll(true); else cloudUpload(how); }
  // Not signed in / Firebase not loaded (no internet): remember there are changes to upload later
  else if (how !== "auto" && cloud.enabled && !cloud.user) setCloudMeta({ dirty: true });
}
function storeLocal() {
  try {
    localStorage.setItem(SAVE_KEY, savedJson);
  } catch (e) {
    if (!saveWarned) toast("⚠ This browser isn't saving (maybe a private window). Use “Export backup” in Settings.", 6000);
    saveWarned = true;
  }
}
// Are there changes that aren't saved yet? (added, changed or deleted activities, routines, people, My day …)
function hasDraft() { return savedJson !== null && JSON.stringify(data) !== savedJson; }
let data = load();

// ---------- Small helpers ----------
// "16:30" -> 990 (minutes since midnight). Working in minutes makes the math easy.
function toMin(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
// 990 -> "4:30pm"
function showTime(min) {
  let h = Math.floor(min / 60), m = min % 60;
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return h + (m ? ":" + String(m).padStart(2, "0") : "") + ampm;
}
// 990 → "4:30" (or "4:30 pm" when ampm is true) — for the colorful week
function clock(min, ampm) {
  const h = Math.floor(min / 60), m = min % 60;
  return (h % 12 || 12) + ":" + String(m).padStart(2, "0") + (ampm ? (h >= 12 ? " pm" : " am") : "");
}
// A flexible activity's "Only between" time in minutes: [960, 1200], or null (= any free time)
function onlyWindow(act) { return act.between ? [toMin(act.between.from), toMin(act.between.to)] : null; }
// { from: "16:00", to: "20:00" } → "4:00–8:00 PM" ("11:00 AM–2:00 PM" when it crosses noon)
function betweenText(b) {
  const s = toMin(b.from), e = toMin(b.to), half = m => (Math.floor(m / 60) % 24) >= 12 ? "PM" : "AM";
  return half(s) === half(e) ? `${clock(s)}–${clock(e)} ${half(e)}` : `${clock(s)} ${half(s)}–${clock(e)} ${half(e)}`;
}
// 90 -> "1h 30m"
function showDuration(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return (h ? h + "h" : "") + (h && m ? " " : "") + (m ? m + "m" : "") || "0m";
}
// Makes text safe to put on the page (so a name like "<b>" can't break things)
function safe(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
const $ = id => document.getElementById(id);
// Today as 0 = Monday … 6 = Sunday (JavaScript counts from Sunday, so we shift it)
function todayIndex() { return (new Date().getDay() + 6) % 7; }   // today's weekday (0 = Monday)
// Today's place in the points week (0 = its first day … 6; the week may start on any weekday, see pointsWeekOf)
function weekIndex() { return Math.max(0, Math.min(6, daysBetween(data.points.week, todayYmd()))); }
// Dates. "2026-10-05" style, in this device's own time zone.
function ymd(dt) { return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0"); }
// ⭐ The points week starts the day AFTER the Shining Star's announce day (⚙️ Settings, default Friday → Saturday–Friday weeks)
function pointsWeekOf(dt) {
  let ann = 4;   // (while the app starts, the data isn't there yet: Friday)
  try { if (data && data.starAt) ann = data.starAt.day; } catch (e) {}
  const first = (ann + 1) % 7;
  const m = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()); m.setDate(m.getDate() - ((m.getDay() + 6) % 7 - first + 7) % 7); return ymd(m);
}
function mondayOf(dt) { const m = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()); m.setDate(m.getDate() - (m.getDay() + 6) % 7); return ymd(m); }
function fromYmd(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
// (function declarations, so the saved data can be read with them while the app starts)
function todayYmd() { return ymd(new Date()); }
function addDaysYmd(s, n) { const dt = fromYmd(s); dt.setDate(dt.getDate() + n); return ymd(dt); }
function daysBetween(a, b) { return Math.round((fromYmd(b) - fromYmd(a)) / 86400000); }
function weekdayOf(s) { return (fromYmd(s).getDay() + 6) % 7; }   // 0 = Monday
// 📅 The calendar's 12 dates (5 back, today, 6 ahead) · the plan's window (today + 6) · the 7 days up to today · a Mon–Sun week
function calDates() { const t = todayYmd(); return Array.from({ length: CAL_LEN }, (_, i) => addDaysYmd(t, i - CAL_BACK)); }
function aheadDates() { const t = todayYmd(); return Array.from({ length: PLAN_AHEAD + 1 }, (_, i) => addDaysYmd(t, i)); }
function recentDates() { const t = todayYmd(); return Array.from({ length: 7 }, (_, i) => addDaysYmd(t, i - 6)); }
function weekDates(week = data.points.week) { return Array.from({ length: 7 }, (_, i) => addDaysYmd(week, i)); }
// "Thursday" · "Thursday, Oct 23"
function dayName(s) { return DAYS[weekdayOf(s)]; }
function dayLong(s) { return `${dayName(s)}, ${fromYmd(s).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`; }
// A tick's date: older ticks had the day 0–6 of their points week instead (see cleanData)
function markDateOf(day, week) { return /^[0-6]$/.test(day) ? addDaysYmd(week, Number(day)) : day; }
// The date of day d (0 = Monday) in this week, e.g. "Oct 7"
function dateOfDay(d) { const dt = fromYmd(data.points.week); dt.setDate(dt.getDate() + d); return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
function weekLabel(week) { return "Week of " + fromYmd(week).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }

// People helpers
function userById(id) { return data.users.find(u => u.id === id) || { id, name: "?", emoji: "🙂", color: "purple" }; }
function colorsOf(user) { return PALETTE[user.color] || PALETTE.purple; }
function dadName() { return userById(DAD).name; }
function whoText(id) { const u = userById(id); return `${u.emoji} ${u.name}`; }
function usersText(ids) { return ids.map(whoText).join(", "); }
function emojisOf(ids) { return ids.map(id => userById(id).emoji).join(""); }
// 👤 A person's face on the screen (HTML): a parent's photo (picked in 👤 My profile) or, without one, their emoji.
// (Text-only places — toasts, PDFs, screen-reader labels — keep the emoji.) Kids: their emoji (their ✨ Spark stays as it is).
const facePhoto = u => u && isParentId(u.id) && typeof u.photo === "string" && u.photo.startsWith("data:image/jpeg;base64,") ? u.photo : "";
const faceHtml = u => facePhoto(u) ? `<img class="face-img" src="${u.photo}" alt="${safe(u.name)}">` : safe((u && u.emoji) || "🙂");
const facesHtml = ids => ids.map(id => faceHtml(userById(id))).join("");
const whoHtml = id => { const u = userById(id); return `${faceHtml(u)} ${safe(u.name)}`; };   // ("👩 Mum" with her photo)
// ✨ Only kids have a Spark (no Spark card, badge, levels or "pick your Spark" for parents)
const hasSpark = id => feat("buddy") && exists(id) && !isParentId(id);
function namesOf(ids) { return ids.map(id => userById(id).name).join(" & "); }
// Who is busy during an activity: its people, plus Dad if it "Needs Dad".
// Two activities only clash if they share at least one of these people.
// (🤝 + the parent who helps: they're busy then too)
function peopleOf(act) { return act.helper && !act.users.includes(act.helper) ? [...act.users, act.helper] : [...act.users]; }
// 🤝 The helping parent of an activity (or a plan item), or null
const helperOf = act => act && act.helper && !act.users.includes(act.helper) ? userById(act.helper) || null : null;
// "🤝 with 🦸‍♂️ Bro2a"
const withText = act => { const h = helperOf(act); return h ? `🤝 with ${h.emoji} ${h.name}` : ""; };
const withHtml = act => { const h = helperOf(act); return h ? `🤝 with ${faceHtml(h)} ${safe(h.name)}` : ""; };   // (the same, with a parent's photo)
// How an activity looks from one person's side: "Gym", or "Math with Bana" when Dad only joins to help.
function actFor(act, person) { return act.users.includes(person) ? act.name : `${act.name} with ${namesOf(act.users)}`; }
// The clash message, e.g. "🦸‍♂️ Dad is busy twice on Monday: Gym (9am–10:30am) and Math with Bana (9:30am–10:15am)"
function busyTwice(person, a, b, when) {
  const range = x => `${showTime(x.start)}–${showTime(x.end)}`;
  return `${whoText(person)} is busy twice${when ? " " + when : ""}: ${actFor(a, person)} (${range(a)}) and ${actFor(b, person)} (${range(b)})`;
}
// Every activity, fixed and flexible together
function allActs() { return [...data.fixed, ...data.flexible]; }
function isFixed(activity) { return data.fixed.includes(activity); }

// After adding/changing/deleting on a draft page: remind that it isn't kept until 💾 Save
function draftToast(text) { toast(`${text} · tap 💾 Save to keep it`, 3200); }

// Short messages at the bottom of the screen
let toastTimer = null;
// cheerColor = make it a big, bouncy, colorful "well done" message
function toast(text, ms, cheerColor) {
  const el = $("toast");
  el.textContent = text;
  el.className = "toast" + (cheerColor ? " cheer" : "");
  el.style.cssText = cheerColor ? `--c:${cheerColor}` : "";
  el.hidden = true; void el.offsetWidth; // restart the bounce
  liftAboveSaveBar();
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.hidden = true, ms || 2800);
}
// How much of the screen bottom the Save bar covers right now → --bar-h, so the toast and "Saved! ✓" sit above it
function liftAboveSaveBar() {
  let h = 0;
  document.querySelectorAll(".savebar").forEach(bar => {
    if (!bar.offsetParent) return;                       // on a page that isn't showing
    const r = bar.getBoundingClientRect();
    if (r.top < innerHeight && r.bottom > 0) h = Math.max(h, innerHeight - r.top);
  });
  document.documentElement.style.setProperty("--bar-h", Math.round(h) + "px");
}
// The Save bar moves when you scroll or turn the phone: keep the message above it while it's showing
["scroll", "resize"].forEach(ev => addEventListener(ev, () => {
  if (!$("toast").hidden || !$("savedPop").hidden) liftAboveSaveBar();
}, { passive: true }));

// (function declarations: cleanSchool uses these while loading)
function hash36(text) { let n = 5381; for (const ch of String(text)) n = ((n * 33) ^ ch.codePointAt(0)) >>> 0; return n.toString(36); }
function subjectIdIn(s, name) {
  const n = String(name || "").trim().toLowerCase(), hit = n && Object.entries(s.subjects || {}).find(([, x]) => x.name.trim().toLowerCase() === n);
  return hit ? hit[0] : "";
}
function topicIdOf(sub, title) { return "t" + hash36(sub + "|" + String(title).trim().toLowerCase()); }
function topicKey(title) { return "k" + hash36(String(title).trim().toLowerCase()); }
// Older data: the topics of the 📥 school work cards and 📰 this week (the newest date kept, files joined)
function currFromOld(c) {
  const out = {};
  const add = (sub, title, added, files) => {
    const t = String(title || "").trim().slice(0, 80);
    if (!sub || !t) return;
    const id = topicIdOf(sub, t), x = out[id];
    if (x) { if ((added || "") > x.added) x.added = added; x.files = [...new Set([...x.files, ...files])].slice(0, 30); }
    else out[id] = { sub, title: t, note: "", added: added || "", files: files.slice(0, 30) };
  };
  Object.values(c.work || {}).forEach(w => (w.topics.length ? w.topics : [w.title]).forEach(t => add(subjectIdIn(c, w.subject), t, w.date, w.files)));
  if (c.week) c.week.subjects.forEach(x => x.topics.forEach(t => add(subjectIdIn(c, x.subject), t, c.week.start, [])));
  return out;
}
