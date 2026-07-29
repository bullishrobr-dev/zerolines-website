/* Refine the ten analyser questions.
 *
 * What was wrong with them:
 *  · They read like a form, not a consultation. "What is your age range?"
 *  · Two of the ten earned little. "Gender" barely changes a skin reading, and
 *    "how long have you had these concerns" duplicated what concerns + age
 *    already imply.
 *  · Sun exposure — the single largest driver of visible ageing — was buried as
 *    one option inside a multi-select at question ten.
 *  · Nothing asked what the client actually WANTS. Concerns are not priorities,
 *    and a report that leads with the thing they care about reads far better.
 *
 * Still ten questions. Same ids where the meaning is unchanged, so nothing
 * downstream breaks; two ids replaced and handled in the worker profile.
 */
const fs = require('fs');
const path = require('path');
const OUT = path.resolve(__dirname, 'quiz-questions.json');

const questions = [
  {
    id: 'age',
    question: 'Which decade are you in?',
    multi: false,
    options: [
      { value: 'under25', label: 'Under 25' },
      { value: '25-34', label: '25 to 34' },
      { value: '35-44', label: '35 to 44' },
      { value: '45-54', label: '45 to 54' },
      { value: '55+', label: '55 or older' },
    ],
  },
  {
    id: 'skinType',
    question: 'How does your skin usually behave?',
    multi: false,
    options: [
      { value: 'dry', label: 'Dry — tight, sometimes flaky, drinks up moisture' },
      { value: 'oily', label: 'Oily — shine returns by midday, pores show' },
      { value: 'combination', label: 'Combination — oily through the T-zone, drier on the cheeks' },
      { value: 'sensitive', label: 'Sensitive — flushes easily, stings with new products' },
      { value: 'normal', label: 'Balanced — rarely gives me trouble' },
    ],
  },
  {
    id: 'concerns',
    question: 'What would you change if you could?',
    multi: true,
    max: 3,
    options: [
      { value: 'lines', label: 'Fine lines and wrinkles' },
      { value: 'firmness', label: 'Loss of firmness' },
      { value: 'dullness', label: 'Dullness and uneven tone' },
      { value: 'dryness', label: 'Dryness and dehydration' },
      { value: 'redness', label: 'Redness and sensitivity' },
      { value: 'pigmentation', label: 'Dark spots and pigmentation' },
      { value: 'pores', label: 'Enlarged or congested pores' },
      { value: 'eyes', label: 'Under-eye circles and puffiness' },
    ],
  },
  {
    id: 'priority',
    question: 'And if you could only fix one of those?',
    multi: false,
    options: [
      { value: 'lines', label: 'Fine lines and wrinkles' },
      { value: 'firmness', label: 'Loss of firmness' },
      { value: 'dullness', label: 'Dullness and uneven tone' },
      { value: 'dryness', label: 'Dryness and dehydration' },
      { value: 'redness', label: 'Redness and sensitivity' },
      { value: 'pigmentation', label: 'Dark spots and pigmentation' },
      { value: 'pores', label: 'Enlarged or congested pores' },
      { value: 'eyes', label: 'Under-eye circles and puffiness' },
    ],
  },
  {
    id: 'sun',
    question: 'How much sun does your face see?',
    multi: false,
    options: [
      { value: 'daily-spf', label: 'Plenty — but I wear SPF every day' },
      { value: 'daily-no-spf', label: 'Plenty, and I rarely wear SPF' },
      { value: 'moderate', label: 'Some — mostly getting from A to B' },
      { value: 'little', label: 'Very little, I am indoors most days' },
      { value: 'history', label: 'A great deal in the past, less now' },
    ],
  },
  {
    id: 'climate',
    question: 'What is the weather like where you live?',
    multi: false,
    options: [
      { value: 'humid', label: 'Warm and humid' },
      { value: 'dry', label: 'Dry — low humidity most of the year' },
      { value: 'temperate', label: 'Temperate, four distinct seasons' },
      { value: 'urban', label: 'City air, noticeable pollution' },
      { value: 'coastal', label: 'Coastal — salt air and wind' },
    ],
  },
  {
    id: 'routine',
    question: 'What does your routine look like at the moment?',
    multi: false,
    options: [
      { value: 'none', label: 'Barely anything — soap and water' },
      { value: 'minimal', label: 'Cleanser and a moisturiser' },
      { value: 'moderate', label: 'A few steps, including a serum' },
      { value: 'advanced', label: 'A full routine, and I read the labels' },
    ],
  },
  {
    id: 'treatments',
    question: 'Anything you have tried before?',
    multi: true,
    optional: true,
    options: [
      { value: 'retinol', label: 'Retinol or retinoids' },
      { value: 'acids', label: 'AHAs or BHAs' },
      { value: 'vitaminc', label: 'Vitamin C' },
      { value: 'peptides', label: 'Peptides or collagen creams' },
      { value: 'laser', label: 'Laser or IPL' },
      { value: 'facials', label: 'Professional facials' },
      { value: 'injectables', label: 'Injectables' },
      { value: 'none', label: 'None of these' },
    ],
  },
  {
    id: 'sleep',
    question: 'How well do you sleep?',
    multi: false,
    options: [
      { value: 'excellent', label: 'Well — seven to nine hours, most nights' },
      { value: 'good', label: 'Reasonably — six or seven hours' },
      { value: 'poor', label: 'Badly — usually under six' },
      { value: 'very-poor', label: 'Very badly — broken or very little' },
    ],
  },
  {
    id: 'lifestyle',
    question: 'Anything else we should know?',
    multi: true,
    optional: true,
    options: [
      { value: 'stress', label: 'I am under a lot of stress' },
      { value: 'smoke', label: 'I smoke' },
      { value: 'alcohol', label: 'I drink regularly' },
      { value: 'water', label: 'I drink less than a litre of water a day' },
      { value: 'travel', label: 'I fly often' },
      { value: 'hormonal', label: 'Recent hormonal changes' },
      { value: 'none', label: 'None of these' },
    ],
  },
];

const RAIL = {
  age: 'Age', skinType: 'Skin type', concerns: 'Concerns', priority: 'Priority',
  sun: 'Sun', climate: 'Climate', routine: 'Routine', treatments: 'History',
  sleep: 'Sleep', lifestyle: 'Lifestyle',
};
questions.forEach((q) => { q.short = RAIL[q.id]; });

fs.writeFileSync(OUT, JSON.stringify(questions, null, 2));
console.log(`wrote ${questions.length} questions`);
questions.forEach((q, i) => {
  console.log(`  ${String(i + 1).padStart(2)}. [${q.id}]${q.multi ? ' multi' : ''}${q.optional ? ' optional' : ''} — ${q.question} (${q.options.length})`);
});
