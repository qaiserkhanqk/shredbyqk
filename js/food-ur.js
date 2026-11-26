// Urdu for the Food screen's everyday words: headings, buttons, the questions in the sheet, meal names.
// Dish names stay as people say them (karahi, roti, biryani are the same words in Urdu written in
// Roman letters, and that's what's printed on menus). QK's longer weekly-report sentences stay English
// until a native speaker writes them, rather than machine-sounding Urdu.
const UR = {
  'Food': 'کھانا', 'What did you eat?': 'آپ نے کیا کھایا؟', 'Snap your meal': 'کھانے کی تصویر لیں',
  'One photo and it’s logged. QK names each dish and counts the portions; tap to fix anything.': 'ایک تصویر اور کھانا درج۔ QK ہر ڈش پہچانتا اور مقدار گنتا ہے؛ غلطی ہو تو ٹیپ کر کے درست کریں۔',
  'Say what you ate': 'بول کر بتائیں', 'Scan barcode': 'بارکوڈ اسکین', 'Search, or type the whole meal': 'تلاش کریں، یا پورا کھانا لکھیں',
  'Today’s food': 'آج کا کھانا', 'Your targets': 'آپ کے ہدف', 'Eaten today': 'آج کھایا', 'Left': 'باقی', 'Over': 'زیادہ',
  'Calories': 'کیلوریز', 'Protein': 'پروٹین', 'Carbs': 'کاربز', 'Fat': 'چکنائی', 'Water': 'پانی', 'glasses': 'گلاس', 'Steps today': 'آج کے قدم',
  'Which one?': 'کون سی؟', 'Who cooked it?': 'کس نے پکایا؟', 'Home': 'گھر', 'Restaurant': 'ریسٹورنٹ', 'Shaadi / dhaba': 'شادی / ڈھابہ',
  'Meat or gravy?': 'بوٹیاں یا شوربہ؟', 'Meat or rice?': 'بوٹیاں یا چاول؟', 'Mostly gravy': 'زیادہ شوربہ', 'Even': 'برابر', 'Mostly meat': 'زیادہ بوٹیاں', 'Mostly rice': 'زیادہ چاول',
  'Oil you can see': 'نظر آنے والا تیل', 'Less oil': 'کم تیل', 'Normal': 'عام', 'Oil on top': 'اوپر تیل',
  'Size': 'سائز', 'Small': 'چھوٹی', 'Medium': 'درمیانی', 'Large': 'بڑی',
  'Breakfast': 'ناشتہ', 'Lunch': 'دوپہر کا کھانا', 'Snack': 'اسنیک', 'Dinner': 'رات کا کھانا',
  'Add to breakfast': 'ناشتے میں شامل کریں', 'Add to lunch': 'دوپہر کے کھانے میں شامل کریں', 'Add to snack': 'اسنیک میں شامل کریں', 'Add to dinner': 'رات کے کھانے میں شامل کریں',
  'Save': 'محفوظ کریں', 'Undo': 'واپس', 'Done': 'ٹھیک ہے', 'Log this meal': 'یہ کھانا درج کریں', 'Add all': 'سب شامل کریں',
  'Went well': 'اچھا رہا', 'For next week': 'اگلے ہفتے کے لیے', 'Worth knowing': 'جاننے کے قابل', "QK's food report": 'QK کی کھانے کی رپورٹ',
  'Send my week to QK': 'میرا ہفتہ QK کو بھیجیں', 'Weigh-in (kg)': 'وزن (کلو)', 'Who usually cooks your food?': 'آپ کا کھانا عموماً کون پکاتا ہے؟',
  'Mostly home': 'زیادہ تر گھر', 'Both': 'دونوں', 'Mostly out': 'زیادہ تر باہر', 'likely': 'اندازاً', 'Likely': 'اندازاً', 'training day': 'ٹریننگ کا دن', 'From your phone’s health app': 'فون کی ہیلتھ ایپ سے', 'From your phone’s health app or watch': 'فون کی ہیلتھ ایپ یا گھڑی سے',
};
let lang = 'en';
export const setLang = l => { lang = l === 'ur' ? 'ur' : 'en'; };
export const getLang = () => lang;
/** Urdu when chosen and known; English otherwise. */
export const t = s => (lang === 'ur' && UR[s]) || s;
/** Translate every [data-t] element inside root (their English text is the key). */
export function translate(root) {
  root.querySelectorAll('[data-t]').forEach(el => { el.dataset.en ||= el.textContent.trim(); el.textContent = t(el.dataset.en); });
}
export const hasUrdu = s => !!UR[s];
