// Say or type a meal in English, Roman Urdu or Urdu. Run: node tests/foodtext.test.mjs
import { parseMeal, looksLikeMeal, splitMeal } from '../js/foodtext.js';
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`); if (!ok) fails++; };
const said = t => parseMeal(t).items.map(i => `${i.opts.servings}×${i.ref.id}`).join(' ');
const is = (t, want) => check(`"${t}"`, said(t) === want, said(t) + (parseMeal(t).unknown.length ? ' ?? ' + parseMeal(t).unknown : ''));

is('do roti aur chicken karahi', '2×roti 1×chicken_karahi');
is('aadhi plate biryani, ek glass lassi', '0.5×chicken_biryani 1×sweet_lassi');
is('2 anday aur paratha', '2×boiled_egg 1×paratha');
is('دو روٹی اور دال', '2×roti 1×daal_masoor');
is('teen chapati te daal mash', '3×roti 1×daal_mash');
is('ek plate chawal aur qeema', '2×plain_rice 1×qeema');
is('chai aur 2 samosa', '1×chai 2×samosa');
is('roghni naan with nihari', '1×roghni_naan 1×nihari');
is('dedh roti', '1.5×roti');
is('mutton biryani', '1×mutton_biryani');
is('aloo paratha aur dahi', '1×aloo_paratha 1×dahi');
is('1 naan, half katori raita', '1×naan 0.5×raita');
is('I had pizza and coke', '1×pizza_slice 1×cola');
is('ek plate karahi', '1.5×chicken_karahi'); // a plate (≈300 g) of salan is 1½ katori
is('ek medium fries aur large lassi', '1×fries 1×sweet_lassi');
// Western café food
is('fish and chips', '1×fish_and_chips');
is('mac and cheese aur coke', '1×mac_and_cheese 1×cola');
is('3 pancakes and an americano', '1.5×pancakes 1×americano');
is('cereal with milk', '1×cereal_milk');
is('spaghetti bolognese', '1×spaghetti_bolognese');
is('caesar salad', '1×caesar_salad');
is('ek steak aur mashed potatoes', '1×steak 1×mashed_potatoes');
is('brownie with hot chocolate', '1×brownie 1×hot_chocolate');
is('chicken wrap', '1×chicken_wrap');
is('pasta', '1×creamy_pasta');
is('soup', '1×corn_soup');
is('black coffee', '1×americano');
is('6 momos', '1×dumplings');
is('greek yogurt', '1×greek_yogurt');
is('french toast', '1×french_toast');
is('toast', '1×bread_slice');
is('malai boti', '1×chicken_boti');
is('malai boti platter', '1×malai_boti');
is('doner kebab aur mint margarita', '1×doner_kebab 1×mint_lemonade');
is('nutella crepe with bubble tea', '1×crepe 1×bubble_tea');
check('"kfc zinger and fries" → the KFC menu item', parseMeal('kfc zinger and fries').items[0]?.name === 'KFC · Zinger Burger');
check('Urdu digits work ("۲ روٹی")', said('۲ روٹی') === '2×roti', said('۲ روٹی'));
check('unknown words are reported, not guessed', parseMeal('do roti aur xyzabc').unknown.includes('xyzabc'));
check('splits on aur / and / , / + / te / ke saath', splitMeal('roti aur daal, chai + samosa te lassi ke saath kheer').length === 6);
check('a meal sentence is recognised', looksLikeMeal('do roti aur daal') && looksLikeMeal('2 samosa') && !looksLikeMeal('karahi'));

console.log(fails ? `\n${fails} FAILED` : '\nall meal-text checks passed');
process.exit(fails ? 1 : 0);
