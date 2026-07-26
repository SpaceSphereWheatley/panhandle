// Panhandle hand-drawn monoline icon system.
// Architecture: a small library of base container shapes + label glyphs that
// compose into packaged-goods icons, plus bespoke drawings for produce, meat,
// fish and bread. Each catalogue item name (normalized) maps to one icon key.
// iconForItem(name) returns an <svg> string (white monoline) or null.
// ES module port of public/itemIcons.js — same drawing data, exported instead
// of attached to `window` so Vite can bundle it.

  // ---- shared drawing helpers ----------------------------------------------
  var STROKE = 'fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';
  function G(inner) { return '<g ' + STROKE + ' filter="url(#sketchy)">' + inner + '</g>'; }
  function thin(s) { return '<g stroke-width="2.4">' + s + '</g>'; }
  function place(g, x, y, s) { return '<g transform="translate(' + x + ',' + y + ') scale(' + (s || 1) + ')">' + thin(g) + '</g>'; }

  // ---- base container shapes -----------------------------------------------
  var base = {
    bottle: '<path d="M43,30 L43,15 L57,15 L57,30 C66,33 70,42 70,52 L70,84 C70,88 67,89 63,89 L37,89 C33,89 30,88 30,84 L30,52 C30,42 34,33 43,30 Z"/><path d="M43,15 L43,10 L57,10 L57,15"/>',
    jug: '<path d="M30,34 L30,86 C30,89 32,90 35,90 L65,90 C68,90 70,89 70,86 L70,34 Z"/><path d="M44,34 L44,22 L60,22 L60,34"/><path d="M44,22 L44,18 L60,18"/><path d="M70,44 C83,44 83,64 70,64"/>',
    carton: '<path d="M33,44 L67,44 L67,88 L33,88 Z"/><path d="M33,44 L50,30 L67,44"/><path d="M45,34 L45,30 L53,30 L53,37"/>',
    carton2: '<rect x="34" y="24" width="32" height="64" rx="4"/><path d="M44,24 L44,18 L56,18 L56,24"/>',
    tub: '<path d="M33,44 L67,44 L63,86 L37,86 Z"/><path d="M30,44 L70,44 L70,37 L30,37 Z"/>',
    box: '<path d="M30,28 L70,28 L70,88 L30,88 Z"/><path d="M30,28 L35,21 L65,21 L70,28"/><path d="M42,21 L40,28 M60,21 L62,28"/>',
    bag: '<path d="M30,32 C30,26 70,26 70,32 L70,84 C70,90 30,90 30,84 Z"/><path d="M30,32 L36,23 L44,29 L50,23 L56,29 L64,23 L70,32"/>',
    can: '<rect x="34" y="26" width="32" height="58" rx="3"/><ellipse cx="50" cy="26" rx="16" ry="5"/><path d="M34,84 C42,88 58,88 66,84"/>',
    jar: '<path d="M34,40 L66,40 L66,84 C66,88 34,88 34,84 Z"/><path d="M37,40 L37,26 C37,22 63,22 63,26 L63,40"/>',
    tube: '<path d="M37,32 L63,32 L59,82 C59,87 41,87 41,82 Z"/><path d="M45,32 L45,20 L55,20 L55,32"/><path d="M41,82 L45,86 L49,82 L52,86 L56,82 L59,85"/>',
    spray: '<path d="M36,42 L36,86 C36,89 38,90 41,90 L61,90 C64,90 66,89 66,86 L66,42 Z"/><path d="M46,42 L46,32 L60,32 L60,42"/><path d="M46,32 L34,28 L34,34 L46,35"/><path d="M46,35 L42,42"/>',
    pillbottle: '<rect x="36" y="36" width="28" height="50" rx="5"/><rect x="40" y="24" width="20" height="13" rx="2"/>',
    pouch: '<path d="M32,34 L68,34 L68,84 L32,84 Z"/><path d="M32,34 L38,26 L62,26 L68,34"/>'
  };

  // ---- label glyphs (drawn around origin, placed via place()) ---------------
  var glyph = {
    tomato: '<circle cx="0" cy="2" r="7"/><path d="M0,-5 L0,-8 M-3,-7 L0,-5 L3,-7"/>',
    olive: '<ellipse cx="-1" cy="3" rx="5" ry="7"/><path d="M3,-4 C8,-8 11,-6 9,-2 C6,-1 4,-2 3,-4 Z"/>',
    leaf: '<path d="M-7,7 C-9,-4 1,-9 8,-7 C6,4 -4,9 -7,7 Z"/><path d="M-6,6 L6,-6"/>',
    bubble: '<circle cx="-4" cy="3" r="4"/><circle cx="4" cy="5" r="3"/><circle cx="3" cy="-3" r="2.5"/>',
    grain: '<path d="M0,9 L0,-8"/><path d="M0,-3 L-5,-7 M0,-3 L5,-7 M0,2 L-5,-2 M0,2 L5,-2 M0,7 L-5,3 M0,7 L5,3"/>',
    drop: '<path d="M0,-7 C-5,0 -6,3 -6,5 C-6,9 -3,11 0,11 C3,11 6,9 6,5 C6,3 5,0 0,-7 Z"/>',
    orange: '<circle cx="0" cy="0" r="7"/><path d="M-5,-4 L4,5 M4,-4 L-5,5 M0,-7 L0,7 M-7,0 L7,0"/>',
    apple: '<path d="M0,-2 C-6,-5 -10,2 -7,7 C-5,11 -2,12 0,11 C2,12 5,11 7,7 C10,2 6,-5 0,-2 Z"/><path d="M0,-2 L1,-8"/>',
    cow: '<path d="M-7,-3 C-9,-7 -5,-7 -4,-4 M7,-3 C9,-7 5,-7 4,-4"/><path d="M-7,-4 C-9,2 -7,8 0,8 C7,8 9,2 7,-4 C5,-7 -5,-7 -7,-4 Z"/><circle cx="-3" cy="0" r="1.3"/><circle cx="3" cy="0" r="1.3"/><path d="M-3,4 C0,6 3,6 3,4"/>',
    wheatear: '<path d="M0,10 L0,-9"/><path d="M0,-4 C-5,-7 -6,-3 0,-2 C6,-3 5,-7 0,-4 M0,1 C-5,-2 -6,2 0,3 C6,2 5,-2 0,1"/>',
    chili: '<path d="M-6,-5 C-2,-9 4,-6 5,0 C6,6 1,10 -3,8 C0,6 2,2 1,-1 C0,-4 -3,-4 -6,-5 Z"/>',
    fish: '<path d="M-9,0 C-9,-5 0,-7 6,-4 C9,-2 9,2 6,4 C0,7 -9,5 -9,0 Z"/><path d="M-9,0 L-13,-4 L-13,4 Z"/><circle cx="4" cy="-2" r="1"/>',
    honeycomb: '<path d="M-3,-7 L3,-7 L6,0 L3,7 L-3,7 L-6,0 Z"/>',
    star: '<path d="M0,-8 L2,-2 L8,-2 L3,2 L5,8 L0,4 L-5,8 L-3,2 L-8,-2 L-2,-2 Z"/>',
    fizz: '<path d="M-5,8 L-5,-6 M0,8 L0,-8 M5,8 L5,-5"/><circle cx="-5" cy="-9" r="1.5"/><circle cx="0" cy="-11" r="1.5"/><circle cx="5" cy="-8" r="1.5"/>',
    bean: '<path d="M-5,-5 C-9,0 -6,7 0,6 C-3,3 -2,-1 -5,-5 Z"/><path d="M5,-2 C9,3 5,9 0,7 C3,5 3,1 5,-2 Z"/>',
    cross: '<path d="M0,-8 L0,8 M-8,0 L8,0"/>',
    snow: '<path d="M0,-9 L0,9 M-8,-4 L8,4 M-8,4 L8,-4 M0,-9 L-3,-6 M0,-9 L3,-6 M0,9 L-3,6 M0,9 L3,6"/>',
    peanut: '<path d="M-3,-8 C-8,-8 -8,-2 -4,-1 C-9,1 -8,8 -2,8 C3,8 3,3 1,1 C6,0 6,-7 0,-7 C-1,-7 -2,-8 -3,-8 Z"/>',
    coffee: '<path d="M-5,-7 C2,-9 7,-3 5,4 C3,9 -3,9 -5,4 C-7,-1 -7,-5 -5,-7 Z"/><path d="M0,-7 C-2,-3 2,-1 0,4"/>',
    berry: '<circle cx="-3" cy="2" r="4"/><circle cx="4" cy="3" r="4"/><circle cx="0" cy="-3" r="3.5"/>',
    choco: '<rect x="-7" y="-6" width="14" height="12" rx="1.5"/><path d="M0,-6 L0,6 M-7,0 L7,0"/>',
    paw: '<circle cx="0" cy="4" r="5"/><circle cx="-6" cy="-3" r="2.4"/><circle cx="0" cy="-6" r="2.4"/><circle cx="6" cy="-3" r="2.4"/>',
    tooth: '<path d="M-6,-5 C-2,-8 2,-8 6,-5 C8,0 6,9 3,9 C1,9 1,3 0,3 C-1,3 -1,9 -3,9 C-6,9 -8,0 -6,-5 Z"/>',
    sun: '<circle cx="0" cy="0" r="5"/><path d="M0,-9 L0,-7 M0,7 L0,9 M-9,0 L-7,0 M7,0 L9,0 M-6,-6 L-5,-5 M6,-6 L5,-5 M-6,6 L-5,5 M6,6 L5,5"/>',
    heart: '<path d="M0,8 C-9,1 -9,-7 -3,-7 C-1,-7 0,-5 0,-4 C0,-5 1,-7 3,-7 C9,-7 9,1 0,8 Z"/>',
    pepperpot: '<path d="M-6,8 L-6,-2 C-6,-7 6,-7 6,-2 L6,8 Z"/><circle cx="-2" cy="-4" r="0.9"/><circle cx="2" cy="-4" r="0.9"/>'
  };

  // ---- bespoke full icons (inner svg, get G()-wrapped) ----------------------
  var bespoke = {
    apple: '<path d="M50,32 C50,26 46,24 48,30 C38,24 26,34 27,48 C28,66 36,82 47,84 C49,85 51,85 53,84 C64,82 72,66 73,48 C74,34 62,24 52,30 C54,24 50,26 50,32 Z"/><path d="M50,26 C52,20 49,16 53,12"/><path d="M53,13 C59,10 64,14 59,19 C55,21 53,17 53,13 Z"/>',
    pear: '<path d="M50,28 C46,28 44,32 45,37 C39,42 36,52 38,62 C40,76 45,87 50,87 C55,87 60,76 62,62 C64,52 61,42 55,37 C56,32 54,28 50,28 Z"/><path d="M50,28 L52,19"/><path d="M52,20 C58,17 62,21 57,25 C53,26 52,23 52,20 Z"/>',
    banana: '<path d="M22,66 C13,46 21,22 45,15 C55,12 64,14 69,22 C58,20 45,27 36,40 C28,52 25,61 29,68 C32,74 35,76 31,80 C26,81 24,72 22,66 Z"/><path d="M29,68 C36,71 44,70 50,65" stroke-width="2.8"/>',
    orange: '<circle cx="50" cy="54" r="26"/><path d="M50,28 L48,18"/><path d="M48,19 C53,15 58,18 55,23 C51,26 48,23 48,19 Z"/><path d="M38,44 L42,48 M62,44 L58,48 M50,68 L50,74" stroke-width="3"/>',
    lemon: '<path d="M28,56 C24,42 40,34 56,38 C72,42 78,56 72,67 C66,78 46,76 37,67 C32,63 29,60 28,56 Z"/><path d="M72,47 L80,41 M28,61 L20,67" stroke-width="3"/>',
    grapes: '<circle cx="40" cy="42" r="7"/><circle cx="56" cy="40" r="7"/><circle cx="46" cy="54" r="7"/><circle cx="62" cy="53" r="7"/><circle cx="38" cy="65" r="7"/><circle cx="53" cy="67" r="7"/><path d="M50,28 L46,21"/><path d="M46,22 C52,18 57,21 53,26 C49,29 46,25 46,22 Z"/>',
    berries: '<circle cx="38" cy="50" r="11"/><circle cx="62" cy="50" r="11"/><circle cx="50" cy="66" r="11"/><path d="M38,39 L35,30 M62,39 L65,30 M50,55 L50,48" stroke-width="2.2"/>',
    strawberry: '<path d="M50,40 C37,40 27,52 31,65 C35,79 43,87 50,87 C57,87 65,79 69,65 C73,52 63,40 50,40 Z"/><path d="M35,40 L41,30 L47,40 L53,29 L59,40 L65,30" stroke-width="3"/><path d="M41,52 L41,56 M50,58 L50,62 M58,52 L58,56 M45,68 L45,72 M55,68 L55,72" stroke-width="3"/>',
    kiwi: '<circle cx="50" cy="52" r="28"/><circle cx="50" cy="52" r="9"/><path d="M50,24 L50,33 M50,71 L50,80 M22,52 L31,52 M69,52 L78,52 M30,32 L37,39 M70,32 L63,39 M30,72 L37,65 M70,72 L63,65" stroke-width="2"/>',
    mango: '<path d="M42,28 C60,22 80,34 77,55 C74,76 55,86 41,79 C27,72 23,50 32,38 C35,33 38,30 42,28 Z"/><path d="M52,33 C50,40 50,47 54,52" stroke-width="2.2"/>',
    pineapple: '<path d="M36,48 C36,42 64,42 64,48 L60,82 C60,86 40,86 40,82 Z"/><path d="M38,54 L62,60 M38,64 L62,70 M38,74 L62,80 M44,48 L52,82 M56,48 L48,82" stroke-width="1.8"/><path d="M50,42 L42,24 M50,42 L50,20 M50,42 L58,24 M50,42 L36,32 M50,42 L64,32" stroke-width="3"/>',
    melon: '<circle cx="50" cy="52" r="28"/><path d="M34,34 C44,44 56,44 66,34 M30,52 C44,58 56,58 70,52 M34,70 C44,62 56,62 66,70" stroke-width="2"/>',
    watermelon: '<path d="M18,42 C40,86 60,86 82,42 Z"/><path d="M24,46 C42,78 58,78 76,46" stroke-width="2.8"/><circle cx="42" cy="58" r="1.8" fill="#FFFFFF"/><circle cx="58" cy="58" r="1.8" fill="#FFFFFF"/><circle cx="50" cy="68" r="1.8" fill="#FFFFFF"/>',
    avocado: '<path d="M50,22 C36,24 28,38 30,54 C32,72 40,84 50,84 C60,84 68,72 70,54 C72,38 64,24 50,22 Z"/><circle cx="50" cy="58" r="12"/>',
    coconut: '<circle cx="50" cy="54" r="28"/><circle cx="43" cy="50" r="2.4"/><circle cx="53" cy="48" r="2.4"/><circle cx="48" cy="58" r="2.4"/><path d="M28,46 C40,40 60,40 72,46" stroke-width="2"/>',
    pomegranate: '<path d="M50,30 C36,32 28,46 30,60 C32,76 40,84 50,84 C60,84 68,76 70,60 C72,46 64,32 50,30 Z"/><path d="M50,30 C52,24 48,20 52,15 M45,18 L50,24 L55,18" stroke-width="2.5"/><circle cx="44" cy="56" r="2" fill="#FFFFFF"/><circle cx="56" cy="56" r="2" fill="#FFFFFF"/><circle cx="50" cy="66" r="2" fill="#FFFFFF"/>',
    stonefruit: '<path d="M50,30 C35,30 26,44 26,60 C26,76 37,86 50,86 C63,86 74,76 74,60 C74,44 65,30 50,30 Z"/><path d="M50,30 C50,24 54,22 52,18 M50,86 C48,80 50,68 50,58" stroke-width="2.5"/>',
    tomato: '<path d="M50,35 C36,35 26,46 26,60 C26,74 37,84 50,84 C63,84 74,74 74,60 C74,46 64,35 50,35 Z"/><path d="M50,35 L50,24 M42,28 L46,35 M58,28 L54,35 M36,32 L42,38 M64,32 L58,38"/>',
    cucumber: '<path d="M22,42 C22,30 30,24 50,24 C70,24 78,30 78,42 L78,58 C78,70 70,76 50,76 C30,76 22,70 22,58 Z"/><path d="M32,34 L38,40 M48,30 L54,36 M64,34 L70,40 M32,62 L38,68 M64,62 L70,68" stroke-width="2.5"/>',
    pepperveg: '<path d="M50,30 C40,28 32,38 33,50 C30,62 36,78 48,82 C50,83 52,83 54,82 C64,80 70,66 68,52 C70,40 60,28 50,30 Z"/><path d="M48,30 C48,24 52,22 50,18"/><path d="M50,18 C54,15 58,18 54,21"/>',
    chiliveg: '<path d="M30,34 C36,28 44,30 48,38 C58,42 70,56 72,74 C72,80 66,82 62,78 C58,64 48,52 40,48 C34,46 30,42 30,34 Z"/><path d="M30,34 C26,30 26,24 30,22" stroke-width="2.5"/>',
    eggplant: '<path d="M64,24 C58,30 56,30 52,32 C40,34 30,46 32,60 C34,76 44,84 56,80 C70,76 76,60 72,46 C70,40 68,38 66,34 C70,32 70,26 64,24 Z"/><path d="M58,30 C62,26 66,26 68,28" stroke-width="2.5"/>',
    corn: '<path d="M50,16 C62,16 68,28 68,50 C68,72 62,86 50,86 C38,86 32,72 32,50 C32,28 38,16 50,16 Z"/><path d="M50,18 L50,84" stroke-width="2.5"/><path d="M36,28 L64,28 M34,40 L66,40 M33,52 L67,52 M34,64 L66,64 M37,74 L63,74" stroke-width="2.2"/><path d="M40,82 C32,88 28,94 32,99" /><path d="M60,82 C68,88 72,94 68,99"/>',
    mushroom: '<path d="M28,46 C28,30 70,30 72,46 C73,51 27,51 28,46 Z"/><path d="M40,50 L40,82 C40,86 60,86 60,82 L60,50"/><circle cx="40" cy="40" r="2.2" fill="#FFFFFF"/><circle cx="52" cy="36" r="2.2" fill="#FFFFFF"/><circle cx="62" cy="42" r="2.2" fill="#FFFFFF"/>',
    leafygreen: '<path d="M50,86 C30,82 20,60 28,42 C33,52 40,56 50,56 C60,56 67,52 72,42 C80,60 70,82 50,86 Z"/><path d="M50,86 L50,56" stroke-width="2.4"/><path d="M40,82 C36,72 36,62 40,55 M60,82 C64,72 64,62 60,55 M34,46 C28,40 27,32 30,26 C36,30 41,37 43,46 M66,46 C72,40 73,32 70,26 C64,30 59,37 57,46" stroke-width="2.2"/>',
    broccoli: '<circle cx="36" cy="38" r="11"/><circle cx="50" cy="32" r="12"/><circle cx="64" cy="38" r="11"/><circle cx="44" cy="45" r="10"/><circle cx="58" cy="45" r="10"/><path d="M48,52 L44,86 L58,86 L54,52"/>',
    carrot: '<path d="M50,40 C45,40 41,43 42,48 L46,80 C47,86 53,86 54,80 L58,48 C59,43 55,40 50,40 Z"/><path d="M49,40 C47,28 41,24 33,19" stroke-width="3.5"/><path d="M50,40 C50,26 50,18 50,11" stroke-width="3.5"/><path d="M51,40 C53,28 59,24 67,19" stroke-width="3.5"/>',
    potato: '<path d="M30,55 C25,42 36,30 50,31 C64,28 76,40 73,54 C78,66 70,80 56,80 C44,84 28,76 27,64 C25,60 28,57 30,55 Z"/><circle cx="42" cy="50" r="1.6" fill="#FFFFFF"/><circle cx="56" cy="58" r="1.6" fill="#FFFFFF"/><circle cx="48" cy="68" r="1.6" fill="#FFFFFF"/>',
    radish: '<path d="M50,44 C39,44 31,53 31,64 C31,77 40,86 50,86 C60,86 69,77 69,64 C69,53 61,44 50,44 Z"/><path d="M50,44 C46,34 48,28 53,24 M50,44 C56,37 62,34 67,33 M50,44 C44,37 38,34 33,33" stroke-width="2.4"/>',
    beet: '<path d="M50,40 C40,40 32,48 32,58 C32,70 40,78 50,78 C60,78 68,70 68,58 C68,48 60,40 50,40 Z"/><path d="M50,78 C50,86 52,92 56,96" stroke-width="2.6"/><path d="M50,40 C46,30 48,24 53,20 M50,40 C56,33 62,30 67,29 M50,40 C44,33 38,30 33,29" stroke-width="2.4"/>',
    ginger: '<path d="M28,52 C25,42 35,37 44,42 C48,33 60,33 64,42 C75,40 82,50 75,59 C79,68 70,78 60,73 C54,82 41,80 39,69 C28,68 24,58 28,52 Z"/>',
    onion: '<path d="M50,26 C35,30 29,44 31,57 C33,73 40,84 50,84 C60,84 67,73 69,57 C71,44 65,30 50,26 Z"/><path d="M40,36 C37,50 37,66 43,79" stroke-width="3"/><path d="M60,36 C63,50 63,66 57,79" stroke-width="3"/><path d="M49,26 C51,20 47,16 51,10" stroke-width="3.5"/><path d="M44,84 C42,90 40,93 36,96" stroke-width="3.5"/><path d="M50,84 L50,97" stroke-width="3.5"/><path d="M56,84 C58,90 60,93 64,96" stroke-width="3.5"/>',
    garlic: '<path d="M50,24 C44,30 36,42 36,58 C36,74 42,82 50,82 C58,82 64,74 64,58 C64,42 56,30 50,24 Z"/><path d="M50,26 L50,82 M43,40 C41,56 42,70 46,80 M57,40 C59,56 58,70 54,80" stroke-width="2.2"/>',
    leek: '<path d="M44,86 L44,46 C44,30 46,20 50,14 C54,20 56,30 56,46 L56,86 Z"/><path d="M44,50 C40,44 38,40 33,38 M56,50 C60,44 62,40 67,38" stroke-width="2.5"/><path d="M44,68 L56,68 M44,78 L56,78" stroke-width="2"/>',
    peapod: '<path d="M26,30 C50,28 74,52 72,76 C58,76 47,70 39,61 C31,52 28,42 26,30 Z"/><circle cx="42" cy="52" r="4"/><circle cx="51" cy="60" r="4"/><circle cx="60" cy="68" r="4"/>',
    asparagus: '<path d="M40,86 L42,42 M50,86 L50,36 M60,86 L58,42" stroke-width="4"/><path d="M42,42 L38,30 L46,34 Z M50,36 L46,24 L54,24 L50,36 M58,42 L54,34 L62,30 Z" stroke-width="2.2"/><path d="M38,70 L62,70" stroke-width="2.4"/>',
    ginger2: '',
    rhubarb: '<path d="M42,86 L42,46 M50,86 L50,44 M58,86 L58,46" stroke-width="4"/><path d="M30,40 C30,28 44,22 50,30 C56,22 70,28 70,40 C70,48 60,50 50,46 C40,50 30,48 30,40 Z" stroke-width="2.4"/>',
    celery: '<path d="M40,86 C38,60 40,40 44,24 M50,86 C50,58 50,38 50,22 M60,86 C62,60 60,40 56,24" stroke-width="3"/><path d="M44,24 C40,18 36,16 32,16 M50,22 C50,16 50,12 50,10 M56,24 C60,18 64,16 68,16" stroke-width="2.4"/><path d="M38,60 L62,60" stroke-width="2.4"/>',
    bread: '<path d="M22,58 C22,32 32,24 50,24 C68,24 78,32 78,58 L78,80 C78,85 74,86 70,86 L30,86 C26,86 22,85 22,80 Z"/><path d="M37,30 L31,46 M50,27 L46,46 M63,30 L67,46" stroke-width="3"/>',
    baguette: '<path d="M24,76 C20,70 24,62 32,54 L54,32 C62,24 70,20 76,24 C80,28 76,36 68,44 L46,66 C38,74 30,80 24,76 Z"/><path d="M40,52 L46,46 M48,44 L54,38 M34,58 L40,52" stroke-width="2.4"/>',
    roll: '<path d="M26,60 C26,42 38,34 50,34 C62,34 74,42 74,60 C74,66 70,68 64,68 L36,68 C30,68 26,66 26,60 Z"/><path d="M50,34 L50,68 M38,38 L34,66 M62,38 L66,66" stroke-width="2.4"/>',
    croissant: '<path d="M22,64 C30,58 34,58 40,60 C44,50 44,46 42,40 C52,44 58,52 60,60 C68,58 72,58 78,64 C70,72 58,76 50,76 C42,76 30,72 22,64 Z"/><path d="M40,60 C46,58 54,58 60,60" stroke-width="2.2"/>',
    pretzel: '<path d="M30,70 C20,58 30,40 46,40 C40,30 48,22 56,26 C64,30 60,40 54,42 C70,44 80,60 68,70" stroke-width="3.5"/>',
    cake: '<path d="M26,54 L74,54 L72,84 L28,84 Z"/><path d="M26,54 C26,44 74,44 74,54" stroke-width="2.8"/><path d="M50,44 L50,32" stroke-width="2.4"/><circle cx="50" cy="29" r="3" fill="#FFFFFF"/><path d="M28,70 L72,70" stroke-width="2.2"/>',
    cakeslice: '<path d="M24,82 L31,44 Q50,32 69,44 L76,82 Z"/><path d="M31,44 C38,36 44,42 50,34 C56,42 62,36 69,44" stroke-width="3.2"/><path d="M27,62 L73,62" stroke-width="2.8"/><circle cx="50" cy="30" r="3.5" fill="#FFFFFF"/>',
    waffle: '<rect x="24" y="24" width="52" height="52" rx="10"/><path d="M37,24 L37,76 M50,24 L50,76 M63,24 L63,76 M24,37 L76,37 M24,50 L76,50 M24,63 L76,63" stroke-width="2.5"/>',
    donut: '<circle cx="50" cy="50" r="32"/><circle cx="50" cy="50" r="13"/><path d="M38,26 L34,20 M50,20 L50,14 M62,26 L66,20" stroke-width="2.8"/>',
    pancakes: '<ellipse cx="50" cy="40" rx="28" ry="9"/><path d="M22,40 C22,48 78,48 78,40 M22,52 C22,60 78,60 78,52 M22,64 C22,72 78,72 78,64" stroke-width="2.6"/><path d="M50,30 C48,24 52,22 50,18" stroke-width="2.4"/><circle cx="50" cy="34" r="4"/>',
    cheese: '<path d="M18,76 L72,76 L45,24 Z"/><circle cx="40" cy="62" r="3"/><circle cx="54" cy="66" r="3"/><circle cx="46" cy="50" r="2.5"/>',
    cheeseround: '<circle cx="50" cy="52" r="28"/><path d="M50,24 L50,52 L74,62" stroke-width="2.4"/><circle cx="40" cy="60" r="2.5"/><circle cx="58" cy="64" r="2.5"/>',
    butter: '<path d="M20,58 L58,40 L80,50 L42,68 Z"/><path d="M20,58 L20,66 L42,76 L42,68 M42,68 L42,76 L80,58 L80,50" stroke-width="2.8"/>',
    egg: '<path d="M50,18 C63,21 71,42 71,59 C71,76 61,87 50,87 C39,87 29,76 29,59 C29,42 37,21 50,18 Z"/>',
    eggs: '<path d="M38,30 C46,32 51,46 51,57 C51,68 45,75 38,75 C31,75 25,68 25,57 C25,46 30,32 38,30 Z"/><path d="M64,40 C70,42 74,53 74,62 C74,71 70,77 64,77 C58,77 54,71 54,62 C54,53 58,42 64,40 Z"/>',
    yoghurtcup: '<path d="M34,42 L66,42 L62,84 L38,84 Z"/><path d="M32,42 L68,42 L68,36 L32,36 Z"/><path d="M44,36 C44,28 56,28 56,36" stroke-width="2.4"/>',
    meat: '<path d="M22,46 C20,34 30,26 42,28 C46,22 56,22 60,28 C72,27 82,36 79,48 C84,56 80,68 68,70 C64,77 52,80 44,76 C32,79 21,72 22,62 C17,57 19,50 22,46 Z"/><path d="M34,42 C42,48 50,50 60,46" stroke-width="2.5"/><path d="M30,56 C40,60 50,60 58,56" stroke-width="2.5"/>',
    steak: '<path d="M26,40 C24,30 34,24 46,26 C60,22 76,30 78,44 C80,58 70,72 56,72 C42,76 26,68 24,54 C22,48 24,44 26,40 Z"/><path d="M58,40 C62,46 62,54 58,60" stroke-width="2.4"/>',
    drumstick: '<path d="M33,16 C29,14 30,9 35,10 C39,11 40,15 37,18 C46,24 48,32 42,38 C56,40 68,52 66,66 C64,80 48,88 36,82 C24,76 22,62 31,52 C25,46 26,36 35,32 C30,28 30,21 33,16 Z"/><circle cx="35" cy="13" r="2.6" fill="#FFFFFF"/>',
    sausage: '<path d="M24,70 C16,62 20,46 34,42 C44,39 50,44 58,48 C64,51 70,50 76,44 C82,50 80,62 70,66 C58,70 46,68 38,66 C32,72 28,72 24,70 Z"/><path d="M34,52 L38,48 M46,56 L50,52 M58,56 L62,52" stroke-width="2"/>',
    bacon: '<path d="M22,42 C38,34 60,50 78,40 L78,52 C60,62 38,46 22,54 Z"/><path d="M22,48 C38,40 60,56 78,46" stroke-width="2.2"/>',
    shrimp: '<path d="M72,30 C44,26 26,46 32,68 C36,80 52,82 60,72 C50,72 42,64 42,54 C42,44 52,38 62,42 C58,34 66,28 72,30 Z"/><circle cx="66" cy="34" r="1.6" fill="#FFFFFF"/><path d="M32,66 C28,72 26,74 22,76 M40,74 C38,80 36,82 33,85" stroke-width="2.2"/>',
    fish: '<path d="M18,50 C18,36 34,28 50,28 C66,28 80,38 84,50 C80,62 66,72 50,72 C34,72 18,64 18,50 Z"/><path d="M16,50 L4,36 L4,64 Z"/><circle cx="60" cy="44" r="2.5" fill="#FFFFFF"/><path d="M42,50 C46,53 50,53 54,50" stroke-width="2.5"/>',
    fishfillet: '<path d="M22,58 C30,40 52,28 76,30 C74,52 60,68 40,72 C30,74 24,68 22,58 Z"/><path d="M40,40 C44,48 48,56 44,66 M52,36 C56,46 58,56 54,64" stroke-width="2.2"/>',
    pizza: '<path d="M50,22 L78,80 L22,80 Z"/><path d="M22,80 C40,72 60,72 78,80" stroke-width="3"/><circle cx="46" cy="48" r="3"/><circle cx="58" cy="58" r="3"/><circle cx="42" cy="64" r="3"/>',
    pasta: '<path d="M20,40 C30,32 40,48 50,40 C60,32 70,48 80,40" stroke-width="3.5"/><path d="M20,54 C30,46 40,62 50,54 C60,46 70,62 80,54" stroke-width="3.5"/><path d="M20,68 C30,60 40,76 50,68 C60,60 70,76 80,68" stroke-width="3.5"/>',
    spaghetti: '<path d="M30,24 C28,40 26,60 24,84 M40,22 C40,42 40,62 40,84 M50,22 C50,42 50,62 50,84 M60,22 C60,42 60,62 60,84 M70,24 C72,40 74,60 76,84" stroke-width="3"/><path d="M24,30 C40,24 60,24 76,30" stroke-width="2.4"/>',
    riceboml: '<path d="M22,52 C22,68 35,78 50,78 C65,78 78,68 78,52 Z"/><path d="M20,52 L80,52" stroke-width="2.8"/><circle cx="40" cy="44" r="1.6" fill="#FFFFFF"/><circle cx="50" cy="42" r="1.6" fill="#FFFFFF"/><circle cx="60" cy="44" r="1.6" fill="#FFFFFF"/><path d="M62,40 L74,30 M68,42 L80,34" stroke-width="2.2"/>',
    cerealbowl: '<path d="M20,50 C20,66 34,78 50,78 C66,78 80,66 80,50 Z"/><path d="M18,50 L82,50" stroke-width="2.8"/><circle cx="38" cy="42" r="2.4"/><circle cx="50" cy="44" r="2.4"/><circle cx="60" cy="40" r="2.4"/>',
    nuts: '<circle cx="40" cy="46" r="12"/><circle cx="60" cy="56" r="12"/><path d="M40,34 L40,58 M28,46 L52,46 M60,44 L60,68 M48,56 L72,56" stroke-width="2"/>',
    mug: '<path d="M28,32 L28,68 C28,78 36,84 46,84 L56,84 C66,84 70,78 70,68 L70,32 Z"/><path d="M70,40 C82,40 82,62 70,62"/><path d="M40,20 C38,24 42,26 40,30" stroke-width="3"/><path d="M52,20 C50,24 54,26 52,30" stroke-width="3"/>',
    teacup: '<path d="M30,40 L30,62 C30,74 40,80 50,80 C60,80 70,74 70,62 L70,40 Z"/><path d="M70,46 C80,46 80,62 70,62"/><path d="M50,40 L50,30 M50,30 C44,26 56,22 50,16" stroke-width="2.4"/>',
    beer: '<path d="M32,34 L62,34 L62,82 C62,86 58,86 54,86 L40,86 C36,86 32,86 32,82 Z"/><path d="M62,42 C74,42 74,62 62,62"/><path d="M30,40 C36,34 44,42 50,36 C56,42 64,34 64,40" stroke-width="2.6"/><path d="M40,48 L40,78 M50,48 L50,78" stroke-width="2"/>',
    wineglass: '<path d="M34,22 C34,46 38,56 50,58 C62,56 66,46 66,22 Z"/><path d="M50,58 L50,80"/><path d="M36,86 L64,86" stroke-width="3"/>',
    sodacan: '<rect x="36" y="22" width="28" height="60" rx="5"/><path d="M36,30 C44,33 56,33 64,30 M36,74 C44,77 56,77 64,74" stroke-width="2.2"/><path d="M44,22 L46,17 L54,17 L56,22" stroke-width="2.4"/>',
    waterbottle: '<path d="M42,28 L58,28 L58,34 C62,38 62,44 60,48 C62,52 62,58 60,62 C62,66 62,82 58,86 C54,90 46,90 42,86 C38,82 38,66 40,62 C38,58 38,52 40,48 C38,44 38,38 42,34 Z"/><path d="M44,18 L56,18 L56,28 L44,28 Z" stroke-width="2.6"/>',
    juicebox: '<rect x="36" y="26" width="28" height="58" rx="3"/><path d="M52,26 L52,18 L58,18 L58,22" stroke-width="2.4"/><circle cx="50" cy="54" r="7"/><path d="M45,49 L54,58 M54,49 L45,58 M50,47 L50,61 M43,54 L57,54" stroke-width="1.6"/>',
    smoothie: '<path d="M36,38 L64,38 L60,86 L40,86 Z"/><path d="M40,38 L60,38 L62,30 L38,30 Z" stroke-width="2.4"/><path d="M54,30 L60,16" stroke-width="2.6"/><circle cx="48" cy="56" r="2" fill="#FFFFFF"/><circle cx="54" cy="64" r="2" fill="#FFFFFF"/>',
    energydrink: '<rect x="38" y="20" width="24" height="64" rx="4"/><path d="M50,34 L44,54 L54,54 L48,74" stroke-width="2.6"/>',
    toiletpaper: '<path d="M28,32 C28,24 72,24 72,32 L72,78 C72,86 28,86 28,78 Z"/><path d="M28,32 C28,40 72,40 72,32" stroke-width="2.5"/><ellipse cx="50" cy="32" rx="10" ry="5"/>',
    paperroll: '<path d="M34,26 L66,26 L66,80 L34,80 Z"/><ellipse cx="50" cy="26" rx="16" ry="5"/><path d="M50,80 L50,92" stroke-width="2.4"/><path d="M42,40 L42,66 M58,40 L58,66" stroke-width="2"/>',
    napkin: '<path d="M28,28 L72,28 L72,72 L28,72 Z"/><path d="M28,40 L72,40 M40,28 L40,72 M50,50 L64,50 L64,64 L50,64 Z" stroke-width="2"/>',
    sponge: '<rect x="24" y="36" width="52" height="32" rx="9"/><path d="M24,52 L76,52" stroke-width="2.4"/><circle cx="34" cy="44" r="1.4" fill="#FFFFFF"/><circle cx="46" cy="46" r="1.4" fill="#FFFFFF"/><circle cx="58" cy="44" r="1.4" fill="#FFFFFF"/>',
    dishbrush: '<path d="M50,16 L50,56" stroke-width="4"/><path d="M38,56 L62,56 L60,66 L40,66 Z"/><path d="M40,66 L38,80 M46,66 L45,82 M54,66 L55,82 M60,66 L62,80" stroke-width="2.4"/>',
    mop: '<path d="M50,14 L50,54" stroke-width="4"/><path d="M34,54 L66,54 L62,68 L38,68 Z"/><path d="M40,68 L36,90 M47,68 L45,92 M53,68 L55,92 M60,68 L64,90" stroke-width="2.4"/>',
    trashbag: '<path d="M30,34 C30,28 70,28 70,34 L66,84 C66,88 34,88 34,84 Z"/><path d="M30,34 C36,26 44,32 50,26 C56,32 64,26 70,34" stroke-width="2.4"/><path d="M42,48 L42,76 M58,48 L58,76" stroke-width="2"/>',
    foil: '<circle cx="26" cy="50" r="14"/><path d="M26,36 L74,40 L70,44 L74,48 L70,52 L74,56 L70,60 L26,64" stroke-width="2.8"/>',
    candle: '<rect x="42" y="50" width="16" height="36" rx="3"/><path d="M50,50 L50,42" stroke-width="2.4"/><path d="M50,18 C46,26 42,32 46,38 C48,40 52,40 54,38 C58,32 54,26 50,18 Z"/>',
    matches: '<rect x="30" y="40" width="40" height="40" rx="4"/><path d="M30,54 L70,54" stroke-width="2.4"/><path d="M52,40 L58,22" stroke-width="3"/><path d="M58,22 C54,18 62,14 58,10" stroke-width="2.4"/>',
    battery: '<rect x="32" y="26" width="36" height="58" rx="6"/><rect x="44" y="18" width="12" height="8" rx="2"/><path d="M50,38 L50,46 M46,42 L54,42" stroke-width="2.8"/><path d="M44,70 L56,70" stroke-width="2.8"/>',
    lightbulb: '<path d="M50,18 C36,18 28,30 32,42 C34,49 39,52 41,58 L59,58 C61,52 66,49 68,42 C72,30 64,18 50,18 Z"/><path d="M41,58 L41,68 L59,68 L59,58"/><path d="M44,72 L56,72 M45,78 L55,78" stroke-width="3"/><path d="M44,32 C44,40 50,40 48,48" stroke-width="2.5"/>',
    tape: '<circle cx="50" cy="50" r="30"/><circle cx="50" cy="50" r="14"/><path d="M74,32 L84,24" stroke-width="2.6"/>',
    clothespin: '<path d="M40,20 L46,20 L52,80 L46,80 Z"/><path d="M54,20 L60,20 L54,80 L48,80 Z"/><circle cx="50" cy="44" r="4"/>',
    toothbrush: '<path d="M22,82 L62,42" stroke-width="6"/><path d="M58,38 L78,18 M62,42 L82,22 M58,46 L74,30" stroke-width="3"/>',
    toothpaste: '<path d="M37,32 L63,32 L59,82 C59,87 41,87 41,82 Z"/><path d="M45,32 L45,20 L55,20 L55,32"/><path d="M41,82 L45,86 L49,82 L52,86 L56,82 L59,85"/><path d="M46,48 C50,42 54,48 50,52 C47,55 45,51 46,48 Z" stroke-width="2.2"/>',
    soap: '<path d="M26,46 C26,36 36,32 50,32 C64,32 74,36 74,46 L74,68 C74,78 64,82 50,82 C36,82 26,78 26,68 Z"/><circle cx="80" cy="34" r="2.5"/><circle cx="86" cy="28" r="1.8"/>',
    soapdispenser: '<rect x="36" y="40" width="28" height="48" rx="4"/><path d="M44,40 L44,30 L56,30 L56,34" stroke-width="2.4"/><path d="M56,34 L66,34 L66,40" stroke-width="2.4"/>',
    pill: '<rect x="22" y="40" width="56" height="20" rx="10"/><path d="M50,40 L50,60" stroke-width="2.8"/><circle cx="50" cy="74" r="8"/><path d="M44,74 L56,74" stroke-width="2.5"/>',
    pillbottlecross: '<rect x="36" y="36" width="28" height="50" rx="5"/><rect x="40" y="24" width="20" height="13" rx="2"/><path d="M50,52 L50,70 M41,61 L59,61" stroke-width="3"/>',
    bandage: '<rect x="18" y="38" width="64" height="24" rx="10" transform="rotate(-12 50 50)"/><path d="M38,44 L36,40 M44,46 L42,42 M56,58 L54,54 M62,60 L60,56" stroke-width="2.2" transform="rotate(-12 50 50)"/>',
    diaper: '<path d="M26,40 C26,30 74,30 74,40 L70,70 C68,80 32,80 30,70 Z"/><path d="M30,42 C40,48 60,48 70,42" stroke-width="2.5"/><rect x="20" y="48" width="7" height="10" rx="2"/><rect x="73" y="48" width="7" height="10" rx="2"/>',
    cottonswab: '<path d="M42,22 L42,78" stroke-width="3"/><circle cx="42" cy="18" r="9"/><circle cx="42" cy="82" r="9"/><path d="M62,30 L62,70" stroke-width="2.6"/><circle cx="62" cy="26" r="7"/><circle cx="62" cy="74" r="7"/>',
    deodorant: '<rect x="40" y="32" width="20" height="52" rx="5"/><path d="M44,32 C44,24 56,24 56,32" stroke-width="2.4"/><ellipse cx="50" cy="22" rx="8" ry="5"/>',
    razor: '<rect x="47" y="20" width="6" height="42" rx="2"/><path d="M38,62 L62,62 L59,74 L41,74 Z"/><path d="M41,74 L41,78 L59,78 L59,74" stroke-width="2.2"/>',
    pad: '<rect x="34" y="28" width="32" height="46" rx="15"/><path d="M42,40 L58,40 M42,51 L58,51 M42,62 L58,62" stroke-width="2"/>',
    thermometer: '<path d="M46,20 L54,20 L54,66 C58,70 58,80 50,82 C42,80 42,70 46,66 Z"/><circle cx="50" cy="74" r="5" fill="#FFFFFF"/><path d="M48,30 L52,30 M48,38 L52,38 M48,46 L52,46" stroke-width="2"/>',
    spray: '<path d="M36,42 L36,86 C36,89 38,90 41,90 L61,90 C64,90 66,89 66,86 L66,42 Z"/><path d="M46,42 L46,32 L60,32 L60,42"/><path d="M46,32 L34,28 L34,34 L46,35"/><path d="M46,35 L42,42"/>',
    babybottle: '<path d="M38,44 L62,44 L60,82 C60,86 40,86 40,82 Z"/><path d="M38,44 L62,44 L62,38 L38,38 Z" stroke-width="2.4"/><path d="M44,38 C44,30 50,30 50,24 C50,30 56,30 56,38" stroke-width="2.4"/><path d="M44,56 L44,74" stroke-width="2"/>',
    petbowl: '<path d="M22,52 C22,68 34,80 50,80 C66,80 78,68 78,52" stroke-width="5"/><path d="M22,52 L78,52" stroke-width="4"/><circle cx="40" cy="42" r="4"/><circle cx="50" cy="38" r="4"/><circle cx="60" cy="42" r="4"/>',
    bone: '<path d="M30,70 L70,30" stroke-width="10"/><circle cx="24" cy="76" r="7"/><circle cx="36" cy="64" r="7"/><circle cx="76" cy="24" r="7"/><circle cx="64" cy="36" r="7"/>',
    catface: '<path d="M28,40 L34,22 L46,34 M72,40 L66,22 L54,34"/><path d="M28,40 C24,56 32,76 50,76 C68,76 76,56 72,40 C66,30 34,30 28,40 Z"/><circle cx="40" cy="50" r="2" fill="#FFFFFF"/><circle cx="60" cy="50" r="2" fill="#FFFFFF"/><path d="M46,60 L50,62 L54,60 M50,62 L50,66" stroke-width="2"/><path d="M30,58 L16,54 M30,64 L16,66 M70,58 L84,54 M70,64 L84,66" stroke-width="1.8"/>',
    dogface: '<path d="M30,32 L26,54 C26,72 38,82 50,82 C62,82 74,72 74,54 L70,32 C64,40 36,40 30,32 Z"/><path d="M30,32 C22,34 20,50 28,58 M70,32 C78,34 80,50 72,58"/><circle cx="42" cy="54" r="2" fill="#FFFFFF"/><circle cx="58" cy="54" r="2" fill="#FFFFFF"/><path d="M50,62 L50,68 M44,66 C47,70 53,70 56,66" stroke-width="2"/><ellipse cx="50" cy="60" rx="4" ry="3"/>',
    pettoy: '<circle cx="50" cy="50" r="28"/><path d="M24,38 C40,30 60,30 76,38" stroke-width="2.8"/><path d="M24,62 C40,70 60,70 76,62" stroke-width="2.8"/>',
    birdseed: '<path d="M34,40 L30,30 L70,30 L66,40 L66,80 L34,80 Z"/><circle cx="42" cy="86" r="2" fill="#FFFFFF"/><circle cx="50" cy="89" r="2" fill="#FFFFFF"/><circle cx="58" cy="86" r="2" fill="#FFFFFF"/>',
    giftbox: '<rect x="26" y="42" width="48" height="40" rx="4"/><path d="M50,42 L50,82 M26,58 L74,58" stroke-width="3"/><path d="M50,42 C42,34 34,36 38,44 C42,48 48,46 50,42 Z"/><path d="M50,42 C58,34 66,36 62,44 C58,48 52,46 50,42 Z"/>',
    giftwrap: '<rect x="22" y="36" width="56" height="28" rx="3"/><path d="M34,36 L34,64 M30,40 L30,60" stroke-width="2.2"/><path d="M66,30 L70,24 M72,34 L80,32" stroke-width="2.4"/>',
    balloon: '<path d="M50,18 C36,18 28,30 30,44 C32,58 42,66 50,66 C58,66 68,58 70,44 C72,30 64,18 50,18 Z"/><path d="M46,66 L50,72 L54,66"/><path d="M50,72 C46,78 54,82 50,88" stroke-width="3"/>',
    partycup: '<path d="M38,32 L62,32 L58,72 L42,72 Z"/><path d="M44,32 L40,16" stroke-width="2.6"/><ellipse cx="50" cy="78" rx="24" ry="5"/>',
    cutlery: '<path d="M38,20 L38,84 M30,20 L30,40 C30,44 46,44 46,40 L46,20" stroke-width="3"/><path d="M64,20 C56,24 56,44 64,48 L64,84" stroke-width="3"/>',
    plate: '<circle cx="50" cy="50" r="30"/><circle cx="50" cy="50" r="20"/>',
    straw: '<path d="M40,18 L58,86" stroke-width="4"/><path d="M34,18 L46,18" stroke-width="3"/>',
    flower: '<circle cx="50" cy="40" r="6"/><circle cx="38" cy="40" r="8"/><circle cx="62" cy="40" r="8"/><circle cx="50" cy="28" r="8"/><circle cx="50" cy="52" r="8"/><path d="M50,60 L50,88" stroke-width="3"/><path d="M50,74 C44,74 40,78 38,84" stroke-width="2.5"/>',
    plant: '<path d="M32,62 L68,62 L64,86 L36,86 Z"/><path d="M50,62 C46,46 36,40 26,34" stroke-width="3"/><path d="M50,62 C50,42 50,30 50,16" stroke-width="3"/><path d="M50,62 C54,46 64,40 74,34" stroke-width="3"/>',
    soil: '<path d="M28,46 L72,46 L66,84 L34,84 Z"/><path d="M28,46 L34,36 L66,36 L72,46" stroke-width="2.4"/><circle cx="42" cy="60" r="2" fill="#FFFFFF"/><circle cx="56" cy="64" r="2" fill="#FFFFFF"/><circle cx="48" cy="72" r="2" fill="#FFFFFF"/>',
    seeds: '<path d="M34,40 L66,40 L62,80 C62,84 38,84 38,80 Z"/><path d="M40,40 C40,30 60,30 60,40" stroke-width="2.4"/><path d="M50,52 C44,58 44,68 50,74 C56,68 56,58 50,52 Z" stroke-width="2.2"/>',
    charcoal: '<path d="M24,60 C24,52 32,48 40,50 C44,42 56,42 60,50 C70,48 78,56 74,64 C78,72 70,80 60,76 C54,82 42,80 40,72 C30,74 22,68 24,60 Z"/>',
    fire: '<path d="M50,20 C40,34 30,42 32,58 C33,70 41,80 50,80 C59,80 67,70 68,58 C69,48 62,46 60,52 C58,44 50,40 52,30 C46,34 42,40 44,48 C40,42 42,32 50,20 Z"/>',
    jam: '<path d="M34,40 L66,40 L66,84 C66,88 34,88 34,84 Z"/><path d="M37,40 L37,26 C37,22 63,22 63,26 L63,40"/><path d="M42,52 L58,52 L58,72 L42,72 Z" stroke-width="2.2"/>',
    spreadtub: '<path d="M33,44 L67,44 L63,80 L37,80 Z"/><path d="M30,44 L70,44 L70,37 L30,37 Z"/><path d="M40,54 C46,50 54,50 60,54" stroke-width="2.2"/>',
    bouillon: '<rect x="34" y="34" width="32" height="32" rx="3"/><path d="M34,50 L66,50 M50,34 L50,66" stroke-width="2.4"/>',
    nutbag: '<path d="M30,32 C30,26 70,26 70,32 L70,84 C70,90 30,90 30,84 Z"/><path d="M30,32 L36,23 L44,29 L50,23 L56,29 L64,23 L70,32"/><circle cx="44" cy="58" r="5"/><circle cx="58" cy="64" r="5"/>',
    oats: '<path d="M33,44 L67,44 L63,86 L37,86 Z"/><path d="M30,44 L70,44 L70,37 L30,37 Z"/><path d="M50,52 L50,72 M50,58 L44,54 M50,58 L56,54 M50,66 L44,62 M50,66 L56,62" stroke-width="2"/>',
    herbbunch: '<path d="M50,80 C46,60 42,40 38,20" stroke-width="3"/><path d="M50,80 C48,58 46,36 44,16" stroke-width="3"/><path d="M50,80 C50,56 50,34 50,14" stroke-width="3"/><path d="M50,80 C52,58 54,36 56,16" stroke-width="3"/><path d="M50,80 C54,60 58,40 62,20" stroke-width="3"/><path d="M39,76 L61,76" stroke-width="4"/>',
    icecreamtub: '<path d="M30,40 L70,40 L66,82 L34,82 Z"/><path d="M28,40 L72,40" stroke-width="3"/><path d="M40,38 C40,30 50,30 50,24 C50,18 60,18 60,26" stroke-width="2.8"/>',
    sachet: '<path d="M28,32 L72,32 L72,80 L28,80 Z"/><path d="M28,46 L72,46" stroke-width="3"/><path d="M28,32 L36,24 L64,24 L72,32" stroke-width="2.5"/>',
    dipbowl: '<path d="M20,46 C20,64 33,76 50,76 C67,76 80,64 80,46" stroke-width="5"/><path d="M20,46 L80,46" stroke-width="4"/><path d="M42,56 C46,52 54,52 50,58 C47,62 44,60 42,56 Z" stroke-width="2.5"/>',
    chocolatebar: '<rect x="24" y="30" width="52" height="40" rx="4"/><path d="M37,30 L37,70 M50,30 L50,70 M63,30 L63,70 M24,50 L76,50" stroke-width="2.5"/>',
    candy: '<ellipse cx="50" cy="50" rx="16" ry="12"/><path d="M34,50 L20,40 L20,60 Z"/><path d="M66,50 L80,40 L80,60 Z"/>',
    artichoke: '<path d="M50,30 C36,32 28,44 30,58 C32,74 40,84 50,84 C60,84 68,74 70,58 C72,44 64,32 50,30 Z"/><path d="M38,40 C42,50 42,60 38,70 M50,32 C50,48 50,64 50,80 M62,40 C58,50 58,60 62,70" stroke-width="2"/><path d="M46,30 L44,20 M50,30 L50,18 M54,30 L56,20" stroke-width="2.5"/>',
    pregnancytest: '<path d="M40,20 L60,20 L60,50 L54,50 L54,86 C54,90 46,90 46,86 L46,50 L40,50 Z"/><rect x="44" y="28" width="12" height="14" rx="2" stroke-width="2.4"/><path d="M47,35 L47,31 M50,35 L50,31 M53,35 L53,31" stroke-width="2"/>',
    gloves: '<path d="M38,50 L38,26 C38,22 44,22 44,26 L44,46 M44,46 L44,20 C44,16 50,16 50,20 L50,46 M50,46 L50,18 C50,14 56,14 56,18 L56,46 M56,46 L56,24 C56,20 62,20 62,24 L62,50 C66,56 68,64 66,74 C64,84 54,88 44,86 C34,84 28,76 28,66 L28,54 C28,48 34,44 38,50 Z" stroke-width="2.6"/>',
    broom: '<path d="M56,14 L40,74" stroke-width="4"/><path d="M40,74 C30,72 22,78 18,88 M40,74 C36,80 34,86 36,92 M40,74 C42,82 44,88 48,92 M40,74 C46,76 52,80 54,88" stroke-width="2.4"/><path d="M34,68 L48,80" stroke-width="2.6"/>',
    scissors: '<circle cx="30" cy="26" r="9"/><circle cx="30" cy="74" r="9"/><path d="M38,32 L78,68 M38,68 L78,32"/>'
  };

  // Compose packaged-goods icons from base + glyph.
  function comp(b, g, x, y, s) { return base[b] + place(glyph[g], x, y, s); }

  // ---- icon library: key -> inner svg --------------------------------------
  var I = {};
  // bespoke
  for (var k in bespoke) { if (bespoke[k]) I[k] = bespoke[k]; }
  // composed packaged goods
  I.bottle_tomato = comp('bottle', 'tomato', 50, 62);
  I.bottle_olive = comp('bottle', 'olive', 50, 62);
  I.bottle_leaf = comp('bottle', 'leaf', 50, 62);
  I.bottle_drop = comp('bottle', 'drop', 50, 62, 0.9);
  I.bottle_bubble = comp('bottle', 'bubble', 50, 62);
  I.bottle_honey = comp('bottle', 'honeycomb', 50, 62);
  I.bottle_star = comp('bottle', 'star', 50, 62);
  I.bottle_grain = comp('bottle', 'grain', 50, 62);
  I.bottle_fizz = comp('bottle', 'fizz', 50, 62, 0.9);
  I.bottle_coffee = comp('bottle', 'coffee', 50, 62);
  I.jug_star = comp('jug', 'star', 50, 64);
  I.jug_bubble = comp('jug', 'bubble', 50, 64);
  I.jug_leaf = comp('jug', 'leaf', 50, 64);
  I.spray_star = comp('spray', 'star', 51, 66);
  I.spray_snow = comp('spray', 'snow', 51, 66);
  I.spray_leaf = comp('spray', 'leaf', 51, 66);
  I.spray_drop = comp('spray', 'drop', 51, 66, 0.9);
  I.spray_sun = comp('spray', 'sun', 51, 66);
  I.carton_cow = comp('carton', 'cow', 50, 66);
  I.carton_orange = comp('carton', 'orange', 50, 66);
  I.carton_apple = comp('carton', 'apple', 50, 66);
  I.carton_drop = comp('carton', 'drop', 50, 66, 0.9);
  I.carton_berry = comp('carton', 'berry', 50, 66);
  I.carton2_orange = comp('carton2', 'orange', 50, 58);
  I.carton2_leaf = comp('carton2', 'leaf', 50, 58);
  I.carton2_berry = comp('carton2', 'berry', 50, 58);
  I.tub_drop = comp('tub', 'drop', 50, 66, 0.85);
  I.tub_bubble = comp('tub', 'bubble', 50, 66);
  I.tub_berry = comp('tub', 'berry', 50, 65);
  I.tub_cow = comp('tub', 'cow', 50, 65);
  I.box_grain = comp('box', 'grain', 50, 60);
  I.box_snow = comp('box', 'snow', 50, 60);
  I.box_bubble = comp('box', 'bubble', 50, 60);
  I.box_wheat = comp('box', 'wheatear', 50, 60);
  I.box_choco = comp('box', 'choco', 50, 58);
  I.box_star = comp('box', 'star', 50, 60);
  I.bag_star = comp('bag', 'star', 50, 60);
  I.bag_wheat = comp('bag', 'wheatear', 50, 60);
  I.bag_fizz = comp('bag', 'fizz', 50, 60, 0.8);
  I.bag_snow = comp('bag', 'snow', 50, 60);
  I.bag_grain = comp('bag', 'grain', 50, 60);
  I.bag_bean = comp('bag', 'bean', 50, 60);
  I.bag_choco = comp('bag', 'choco', 50, 58);
  I.bag_leaf = comp('bag', 'leaf', 50, 60);
  I.bag_paw = comp('bag', 'paw', 50, 60);
  I.can_tomato = comp('can', 'tomato', 50, 55);
  I.can_fish = comp('can', 'fish', 50, 55);
  I.can_bean = comp('can', 'bean', 50, 55);
  I.can_drop = comp('can', 'drop', 50, 55, 0.85);
  I.can_paw = comp('can', 'paw', 50, 55);
  I.can_corn = comp('can', 'grain', 50, 55);
  I.jar_honey = comp('jar', 'honeycomb', 50, 62);
  I.jar_tomato = comp('jar', 'tomato', 50, 62);
  I.jar_leaf = comp('jar', 'leaf', 50, 62);
  I.jar_pepper = comp('jar', 'pepperpot', 50, 60);
  I.jar_chili = comp('jar', 'chili', 50, 60);
  I.tube_star = comp('tube', 'star', 50, 58, 0.85);
  I.tube_drop = comp('tube', 'drop', 50, 58, 0.8);
  I.tube_tomato = comp('tube', 'tomato', 50, 58, 0.85);
  I.tube_cross = comp('tube', 'cross', 50, 58, 0.8);
  I.tube_sun = comp('tube', 'sun', 50, 58, 0.8);
  I.pillbottle_cross = comp('pillbottle', 'cross', 50, 60, 0.9);
  I.pillbottle_heart = comp('pillbottle', 'heart', 50, 60, 0.9);
  I.pouch_leaf = comp('pouch', 'leaf', 50, 58);
  I.pouch_heart = comp('pouch', 'heart', 50, 58);
  I.pouch_snow = comp('pouch', 'snow', 50, 58);
  I.pouch_sun = comp('pouch', 'sun', 50, 58);
  I.shaker_salt = base.bottle ? ('<rect x="38" y="34" width="24" height="50" rx="8"/><rect x="40" y="22" width="20" height="14" rx="3"/><circle cx="46" cy="27" r="1.6" fill="#FFFFFF"/><circle cx="54" cy="27" r="1.6" fill="#FFFFFF"/><circle cx="46" cy="31" r="1.6" fill="#FFFFFF"/><circle cx="54" cy="31" r="1.6" fill="#FFFFFF"/>') : '';

  // ---- name -> icon key map (covers every COMMON_ITEMS catalogue entry) ----
  var MAP = {
    // Fruit and vegetables
    "banana": "banana", "apple": "apple", "pear": "pear", "orange": "orange", "clementine": "orange",
    "mandarin": "orange", "lemon": "lemon", "lime": "lemon", "grapefruit": "orange", "grapes": "grapes",
    "strawberries": "strawberry", "blueberries": "berries", "raspberries": "berries", "blackberries": "berries",
    "kiwi": "kiwi", "mango": "mango", "pineapple": "pineapple", "melon": "melon", "watermelon": "watermelon",
    "peach": "stonefruit", "nectarine": "stonefruit", "plum": "stonefruit", "apricot": "stonefruit",
    "pomegranate": "pomegranate", "avocado": "avocado", "tomato": "tomato", "cherry tomatoes": "tomato",
    "cucumber": "cucumber", "lettuce": "leafygreen", "iceberg lettuce": "leafygreen", "arugula": "leafygreen",
    "spinach": "leafygreen", "kale": "leafygreen", "broccoli": "broccoli", "cauliflower": "broccoli",
    "carrot": "carrot", "potato": "potato", "sweet potato": "potato", "onion": "onion", "red onion": "onion",
    "garlic": "garlic", "leek": "leek", "spring onion": "leek", "bell pepper": "pepperveg", "chili": "chiliveg",
    "zucchini": "cucumber", "eggplant": "eggplant", "corn": "corn", "sugar snap peas": "peapod", "mushrooms": "mushroom",
    "button mushrooms": "mushroom", "radish": "radish", "beetroot": "beet", "rutabaga": "beet", "celery": "celery",
    "asparagus": "asparagus", "brussels sprouts": "leafygreen", "cabbage": "leafygreen", "red cabbage": "leafygreen",
    "chinese cabbage": "leafygreen", "ginger": "ginger", "parsley": "herbbunch", "basil": "herbbunch",
    "cilantro": "herbbunch", "dill": "herbbunch", "chives": "herbbunch", "mint": "herbbunch",
    "rhubarb": "rhubarb", "passion fruit": "stonefruit", "coconut": "coconut", "peas": "peapod",
    "fruit": "apple", "vegetables": "carrot", "cherries": "berries", "sweet cherries": "berries",
    "gooseberries": "berries", "cranberries": "berries", "figs": "pomegranate", "dates": "stonefruit",
    "lychee": "pomegranate", "papaya": "mango", "ground cherries": "berries", "mirabelle plum": "stonefruit",
    "persimmon": "orange", "fennel": "celery", "artichoke": "artichoke", "bok choy": "leafygreen",
    "chard": "leafygreen", "frisée lettuce": "leafygreen", "romaine lettuce": "leafygreen",
    "spring mix salad": "leafygreen", "celeriac": "beet", "turnip": "radish", "tarragon": "herbbunch",
    "sage": "herbbunch", "cress": "herbbunch", "shallot": "onion",
    // Bread and bakery
    "wholemeal bread": "bread", "white bread": "bread", "bread rolls": "roll", "baguette": "baguette", "polarbrød": "bread",
    "crispbread": "box_wheat", "pita bread": "roll", "tortilla": "roll", "lefse": "roll", "waffles": "waffle",
    "pancakes": "pancakes", "croissant": "croissant", "buns": "roll", "custard bun": "roll",
    "cinnamon buns": "roll", "muffins": "donut", "cake": "cake", "chocolate cake": "cakeslice", "brioche": "roll",
    "sandwich bread": "bread", "whole grain bread": "bread", "spelt bread": "bread", "sourdough bread": "bread",
    "ciabatta": "baguette", "focaccia": "bread", "naan bread": "roll", "hamburger buns": "roll",
    "hot dog buns": "roll", "rusk": "roll", "donut": "donut",
    "bread": "bread", "rye bread": "bread", "flatbread": "box_wheat", "potato lompe flatbread": "roll",
    "grissini": "baguette", "bagel": "donut", "muesli bread": "bread", "sunflower bread": "bread",
    "stone-baked bread": "bread", "low-carb bread": "bread", "gluten-free bread": "bread",
    "danish pastry": "croissant",
    // Dairy
    "milk": "carton_cow", "low-fat milk": "carton_cow", "whole milk": "carton_cow", "skimmed milk": "carton_cow",
    "extra low-fat milk": "carton_cow", "lactose-free milk": "carton_cow", "cream": "carton_drop",
    "whipping cream": "carton_drop", "cooking cream": "carton_drop", "crème fraîche": "tub_cow", "sour cream": "tub_cow",
    "low-fat sour cream": "tub_cow", "butter": "butter", "margarine": "butter", "spreadable butter": "butter", "brown cheese": "cheese",
    "white cheese": "cheese", "norvegia": "cheese", "jarlsberg": "cheese", "yellow cheese": "cheese",
    "cottage cheese": "tub_cow", "cream cheese": "tub_cow", "philadelphia": "tub_cow", "mozzarella": "cheeseround",
    "parmesan": "cheese", "feta cheese": "cheese", "cheddar": "cheese", "yogurt": "yoghurtcup",
    "plain yogurt": "yoghurtcup", "greek yogurt": "yoghurtcup", "drinking yogurt": "carton_drop",
    "skyr": "yoghurtcup", "kefir": "carton_drop", "quark": "yoghurtcup", "vanilla custard": "carton_drop",
    "ice cream": "icecreamtub", "eggs": "eggs",
    "cheese": "cheese", "mascarpone": "tub_cow", "ricotta": "tub_cow", "halloumi": "cheese",
    "goat cheese": "cheese", "pultost": "tub_cow", "oat milk": "carton2_leaf", "almond milk": "carton2_leaf",
    "soy milk": "carton2_leaf", "vegan cheese": "cheese", "vegan yogurt": "yoghurtcup",
    "vegan sour cream": "tub_cow",
    // Meat and fish
    "ground meat": "meat", "ground beef": "meat", "pork": "steak", "beef": "steak",
    "chicken": "drumstick", "chicken fillet": "drumstick", "chicken thighs": "drumstick", "chicken wings": "drumstick",
    "turkey": "drumstick", "steak": "steak", "entrecôte": "steak", "tenderloin": "steak", "sirloin": "steak",
    "pork chops": "steak", "pork fillet": "steak", "bacon": "bacon", "sausages": "sausage",
    "grilling sausages": "sausage", "hot dogs": "sausage", "meatballs": "meat", "medister patties": "meat",
    "lamb": "steak", "leg of lamb": "drumstick", "cured lamb ribs": "steak", "pork ribs": "steak",
    "cured ham": "steak", "salami": "sausage", "servelat sausage": "sausage", "liver pâté": "spreadtub",
    "cooked ham": "steak", "salmon": "fishfillet", "smoked salmon": "fishfillet", "trout": "fish", "cod": "fish",
    "pollock": "fish", "haddock": "fish", "mackerel": "fish", "herring": "fish", "tuna": "can_fish", "shrimp": "shrimp",
    "fish cakes": "fish", "fish balls": "can_fish", "fish sticks": "fishfillet", "fish gratin": "fishfillet",
    "crab": "shrimp", "mussels": "shrimp", "scampi": "shrimp",
    "meat": "meat", "fish": "fish", "sandwich toppings": "spreadtub", "veal": "steak", "moose meat": "steak",
    "reindeer meat": "steak", "duck breast": "steak", "rabbit": "drumstick", "goat meat": "steak",
    "lamb chops": "steak", "chorizo": "sausage", "pepperoni": "sausage", "prosciutto": "steak",
    "parma ham": "steak", "chicken cold cuts": "spreadtub", "turkey cold cuts": "spreadtub",
    "mackerel in tomato sauce": "can_tomato", "anchovies": "can_fish", "caviar": "can_fish",
    "crab claws": "shrimp", "lobster": "shrimp", "oysters": "shrimp", "pangasius": "fishfillet",
    "wolffish": "fish", "monkfish": "fish", "tofu": "butter", "tempeh": "butter",
    "vegan ground meat": "meat", "falafel": "nuts",
    // Ingredients and spices
    "salt": "shaker_salt", "pepper": "jar_pepper", "sugar": "bag_fizz", "brown sugar": "bag_fizz",
    "powdered sugar": "bag_fizz", "vanilla sugar": "sachet", "wheat flour": "bag_wheat", "whole wheat flour": "bag_wheat",
    "cornstarch": "box_star", "baking powder": "sachet", "baking soda": "sachet", "yeast": "sachet", "dry yeast": "sachet",
    "olive oil": "bottle_olive", "rapeseed oil": "bottle_leaf", "sunflower oil": "bottle_leaf", "vinegar": "bottle_leaf",
    "balsamic vinegar": "bottle_drop", "soy sauce": "bottle_drop", "ketchup": "bottle_tomato", "mustard": "tube_drop",
    "mayonnaise": "tube_drop", "remoulade": "tube_drop", "stock": "bouillon", "stock cube": "bouillon",
    "vegetable stock": "bouillon", "tomato paste": "tube_tomato", "canned tomatoes": "can_tomato",
    "coconut milk": "can_drop", "honey": "jar_honey", "syrup": "bottle_honey", "peanut butter": "jar_leaf",
    "chocolate hazelnut spread": "jar_leaf", "strawberry jam": "jar_tomato", "raspberry jam": "jar_tomato",
    "marmalade": "jar_tomato", "curry powder": "jar_chili", "paprika": "jar_chili", "chili powder": "jar_chili",
    "cinnamon": "jar_leaf", "cardamom": "jar_leaf", "nutmeg": "jar_leaf", "turmeric": "jar_chili",
    "cumin": "jar_leaf", "oregano": "jar_leaf", "thyme": "jar_leaf", "rosemary": "jar_leaf",
    "bay leaf": "jar_leaf", "garlic powder": "jar_leaf", "taco seasoning": "jar_chili", "bbq seasoning": "jar_chili",
    "baking cocoa": "box_choco", "chocolate chips": "bag_choco", "gelatin": "sachet", "vanilla extract": "bottle_drop",
    "almonds": "nutbag", "walnuts": "nutbag", "hazelnuts": "nutbag", "cashews": "nutbag",
    "pine nuts": "nutbag", "raisins": "bag_leaf", "sesame seeds": "sachet", "sunflower seeds": "bag_leaf",
    "pumpkin seeds": "bag_leaf", "stock concentrate": "bouillon",
    "flour": "bag_wheat", "oil": "bottle_leaf", "cayenne pepper": "jar_chili", "chili flakes": "jar_chili",
    "sambal oelek": "jar_chili", "sweet chili sauce": "bottle_drop", "bbq sauce": "bottle_drop",
    "pesto": "jar_leaf", "worcestershire sauce": "bottle_drop", "fish sauce": "bottle_drop",
    "oyster sauce": "bottle_drop", "hoisin sauce": "bottle_drop", "sriracha": "bottle_drop",
    "tabasco": "bottle_drop", "vanilla pod": "sachet", "saffron": "sachet", "anise": "jar_leaf",
    "fennel seeds": "jar_leaf", "coriander seeds": "jar_leaf", "mustard seeds": "jar_leaf",
    "caraway seeds": "jar_leaf", "star anise": "jar_leaf", "cloves": "jar_leaf",
    "white pepper": "jar_pepper", "red wine vinegar": "bottle_drop", "white wine vinegar": "bottle_drop",
    "coconut oil": "bottle_leaf", "sesame oil": "bottle_leaf", "agave syrup": "bottle_honey",
    "maple syrup": "bottle_honey", "stevia": "sachet", "almond flour": "bag_wheat", "coconut flour": "bag_wheat",
    "hemp seeds": "sachet", "chia seeds": "sachet", "flaxseed": "bag_leaf", "peanuts": "nutbag",
    "pistachios": "nutbag", "macadamia nuts": "nutbag", "dried apricots": "bag_leaf",
    "dried figs": "bag_leaf", "dried dates": "bag_leaf", "dried cranberries": "bag_leaf",
    // Frozen and ready meals
    "grandiosa": "pizza", "frozen pizza": "pizza", "lasagna": "box_snow", "frozen vegetables": "bag_snow",
    "frozen berries": "bag_snow", "frozen peas": "bag_snow", "french fries": "bag_snow", "potato wedges": "bag_snow",
    "onion rings": "bag_snow", "frozen fish": "fishfillet", "spring rolls": "box_snow", "stir-fry vegetables": "bag_snow",
    "frozen meatballs": "bag_snow", "ready meal": "box_snow", "pie": "cakeslice", "popsicle": "icecreamtub",
    "frozen chicken": "bag_snow", "pizza rolls": "box_snow", "frozen pancakes": "pancakes",
    "frozen salmon": "fishfillet", "frozen shrimp": "bag_snow", "potato lompe": "roll",
    "frozen berry smoothie": "bag_snow", "ice cream tub": "icecreamtub", "frozen fish sticks": "fishfillet",
    "mini frozen pizza": "pizza", "sausage dough": "box_snow",
    "ice cream bar": "icecreamtub", "soft serve ice cream": "icecreamtub", "frozen beans": "bag_snow",
    "frozen cauliflower": "bag_snow", "frozen broccoli": "bag_snow", "ice cream cake": "cakeslice",
    "frozen croissants": "box_snow", "frozen mango": "bag_snow",
    // Grains and pasta
    "oats": "oats", "quick oats": "oats", "muesli": "oats", "cornflakes": "box_grain",
    "frosties": "box_grain", "cheerios": "box_grain", "oat flakes cereal": "box_grain", "weetabix": "box_grain",
    "puffed rice": "box_grain", "rice": "bag_grain", "jasmine rice": "bag_grain", "basmati rice": "bag_grain",
    "rice porridge": "oats", "porridge rice": "bag_grain", "pasta": "pasta", "spaghetti": "spaghetti", "macaroni": "pasta",
    "penne": "pasta", "fusilli": "pasta", "lasagna sheets": "pasta", "tagliatelle": "pasta", "couscous": "bag_grain",
    "bulgur": "bag_grain", "quinoa": "bag_grain", "pearl barley": "bag_grain", "red lentils": "bag_bean",
    "chickpeas": "can_bean", "black beans": "can_bean", "kidney beans": "can_bean", "polenta": "bag_grain",
    "pancake mix": "box_grain", "waffle mix": "box_grain", "lentils": "bag_bean",
    "cereal": "cerealbowl", "oat flour": "bag_grain", "barley": "bag_grain",
    "spelt": "bag_grain", "rye": "bag_grain", "muesli bars": "chocolatebar", "soybeans": "bag_bean",
    "edamame": "peapod", "millet": "bag_grain", "rice noodles": "pasta", "egg noodles": "pasta",
    "glass noodles": "pasta", "udon noodles": "pasta", "ramen": "riceboml",
    // Snacks and sweets
    "potato chips": "bag_star", "cheese puffs": "bag_star", "pretzel sticks": "bag_star", "popcorn": "bag_star",
    "nachos": "bag_star", "dip": "dipbowl", "salsa": "dipbowl", "guacamole": "dipbowl",
    "milk chocolate": "chocolatebar", "dark chocolate": "chocolatebar", "kvikk lunsj": "chocolatebar",
    "smash": "bag_choco", "non stop": "candy", "twist": "bag_choco", "gummy candy": "candy", "wine gums": "candy",
    "licorice": "candy", "pastilles": "candy", "chewing gum": "candy", "digestive biscuits": "box_wheat",
    "marie biscuits": "box_wheat", "oat biscuits": "box_wheat", "chocolate biscuits": "box_choco", "snickers": "chocolatebar",
    "kit kat": "chocolatebar", "daim": "chocolatebar", "toblerone": "chocolatebar", "salty licorice": "candy",
    "biscuits": "box_wheat", "chips": "bag_star", "chocolate": "chocolatebar",
    "twix": "chocolatebar", "mars": "chocolatebar", "bounty": "chocolatebar",
    "maltesers": "candy", "marshmallow candy": "candy", "marshmallows": "candy",
    "licorice roll": "candy", "pick and mix candy": "candy", "protein bar": "chocolatebar",
    // Drinks
    "water": "waterbottle", "sparkling water": "waterbottle", "mineral water": "waterbottle", "cola": "sodacan",
    "coke zero": "sodacan", "sprite": "sodacan", "fanta": "sodacan", "solo": "sodacan", "urge": "sodacan",
    "pepsi": "sodacan", "apple juice": "carton_apple", "orange juice": "carton_orange", "multivitamin juice": "carton_orange",
    "juice": "carton_orange", "squash": "bottle_drop", "blackcurrant squash": "bottle_drop", "apple must": "bottle_drop",
    "iced tea": "carton2_leaf", "coffee": "bag_star", "filter coffee": "bag_star", "coffee capsules": "box_choco",
    "espresso": "mug", "tea": "box_star", "green tea": "box_star", "black tea": "box_star", "herbal tea": "box_star",
    "cocoa powder": "box_choco", "energy drink": "energydrink", "red bull": "energydrink", "smoothie": "smoothie",
    "beer": "beer", "wine": "wineglass", "soda": "sodacan",
    "sports drink": "waterbottle", "kombucha": "sodacan", "iced coffee": "bottle_coffee",
    "fruit must": "carton_apple", "grape juice": "carton_orange", "cranberry juice": "carton_orange",
    "pineapple juice": "carton_orange", "mango juice": "carton_orange", "cider": "beer",
    "non-alcoholic beer": "beer",
    // Household
    "toilet paper": "toiletpaper", "paper towels": "paperroll", "kitchen roll": "paperroll", "napkins": "napkin",
    "dish soap": "bottle_bubble", "dishwasher tablets": "box_bubble", "dishwasher salt": "box_star",
    "laundry detergent": "jug_bubble", "fabric softener": "jug_leaf", "stain remover": "spray_star", "bleach": "jug_star",
    "all-purpose cleaner": "spray_star", "glass cleaner": "spray_snow", "toilet cleaner": "spray_drop",
    "bathroom cleaner": "spray_bubble", "scouring powder": "box_bubble", "dish brush": "dishbrush",
    "dish sponge": "sponge", "cloths": "sponge", "microfiber cloth": "sponge", "garbage bags": "trashbag",
    "trash bags": "trashbag", "freezer bags": "foil", "wax paper": "foil", "aluminum foil": "foil",
    "plastic wrap": "foil", "baking paper": "foil", "light bulb": "lightbulb", "batteries": "battery",
    "candles": "candle", "tea lights": "candle", "matches": "matches", "floor mop": "mop",
    "air freshener": "spray_leaf", "laundry powder": "box_bubble", "fabric conditioner": "jug_leaf", "soft soap": "bottle_bubble",
    "toothpicks": "matches", "tape": "tape", "clothespins": "clothespin", "zip bags": "foil",
    "kitchen hand soap": "soapdispenser", "dusting cloths": "sponge", "washcloth": "sponge",
    "lunch box": "giftbox", "thermos": "waterbottle", "water bottle": "waterbottle",
    "descaler": "bottle_bubble", "delicate wash detergent": "jug_bubble", "silicone mold": "waffle",
    "baking pan": "cake", "disposable gloves": "gloves", "rubber gloves": "gloves", "broom": "broom",
    "dustpan": "mop", "window squeegee": "mop", "toilet brush": "dishbrush",
    "moth repellent": "sachet", "insect spray": "spray_leaf", "fuses": "battery",
    "extension cord": "battery",
    // Health and personal care
    "diapers": "diaper", "diapers size 4": "diaper", "diapers size 5": "diaper", "wet wipes": "napkin",
    "baby food": "babyfood", "baby porridge": "babyfood", "baby formula porridge": "babybottle", "infant formula": "babybottle",
    "pacifier": "babybottle", "baby bottle": "babybottle", "diaper bags": "trashbag", "baby oil": "tube_sun",
    "baby cream": "tube_cross", "vaseline": "tube_cross", "sunscreen": "tube_sun", "sunscreen for kids": "tube_sun",
    "mosquito spray": "spray_leaf", "band-aids": "bandage", "bandages": "bandage", "wound ointment": "tube_cross",
    "hand sanitizer": "bottle_bubble", "face mask": "pad", "paracetamol": "pill", "ibuprofen": "pill", "paracetamol for kids": "pill",
    "nasal spray": "spray_drop", "throat lozenges": "pill", "cough syrup": "bottle_drop", "thermometer": "thermometer",
    "cotton swabs": "cottonswab", "toothbrush": "toothbrush", "toothbrush for kids": "toothbrush",
    "toothpaste": "toothpaste", "toothpaste for kids": "toothpaste", "dental floss": "cottonswab", "mouthwash": "bottle_drop",
    "shampoo": "bottle_bubble", "shampoo for kids": "bottle_bubble", "conditioner": "bottle_drop", "shower gel": "bottle_bubble",
    "hand soap": "soapdispenser", "deodorant": "deodorant", "shaving foam": "spray_star", "razor blades": "razor",
    "sanitary pads": "pad", "tampons": "pad", "panty liners": "pad", "moisturizer": "soap", "q-tips": "cottonswab",
    "vitamins": "pillbottle_cross", "cod liver oil": "bottle_drop", "multivitamin for kids": "pillbottle_heart",
    "vitamin d": "pillbottle_cross", "magnesium": "pillbottle_cross", "probiotics": "pillbottle_cross",
    "iron supplement": "pillbottle_cross", "allergy tablets": "pill", "eye drops": "spray_drop",
    "nose drops": "spray_drop", "compresses": "bandage", "sports tape": "tape",
    "cold pack": "pouch_snow", "heating pad": "pouch_sun", "pregnancy test": "pregnancytest",
    "condoms": "pad", "menstrual cup": "teacup", "intimate wash": "bottle_bubble",
    "shaving cream": "spray_star", "hair removal cream": "tube_cross", "hairspray": "spray_star",
    "hair gel": "tube_drop", "lip balm": "tube_cross", "nail clippers": "razor", "tweezers": "razor",
    // Pet supplies
    "cat food": "catface", "wet cat food": "can_paw", "dry cat food": "bag_paw", "cat litter": "bag_paw",
    "cat treats": "pettoy", "dog food": "dogface", "wet dog food": "can_paw", "dry dog food": "bag_paw",
    "dog treats": "bone", "chew bone": "bone", "bird seed": "birdseed", "fish food": "can_paw",
    "rabbit food": "bag_paw", "pet toys": "pettoy", "dog poop bags": "trashbag",
    "hamster food": "bag_paw", "guinea pig food": "bag_paw",
    // Other
    "gift wrap": "giftwrap", "gift ribbon": "giftwrap", "birthday candles": "candle", "balloons": "balloon",
    "party napkins": "napkin", "disposable cutlery": "cutlery", "disposable plates": "plate", "plastic cups": "partycup",
    "straws": "straw", "charcoal": "charcoal", "lighter fluid": "bottle_star", "flowers": "flower",
    "potted plant": "plant", "soil": "soil", "seeds": "seeds",
    "glue": "tube_drop", "scissors": "scissors", "pen": "toothbrush", "notebook": "napkin",
    "envelopes": "giftwrap", "fertilizer": "soil"
  };

  // babyfood fallback (reuse jar with heart)
  I.babyfood = comp('jar', 'heart', 50, 62);
  I.spray_bubble = comp('spray', 'bubble', 51, 66);
  I.bottle_star = comp('bottle', 'star', 50, 62);

  // ---- ICON_OFFSETS: generated by scripts/compute-icon-offsets.mjs, do not hand-edit ----
var ICON_OFFSETS = {
  "apple": [0, 1.6],
  "artichoke": [0, -1],
  "asparagus": [0, -5],
  "avocado": [0, -3],
  "babybottle": [0, -4.5],
  "babyfood": [0, -5],
  "bacon": [0, 2.5],
  "bag_bean": [0, -5.7],
  "bag_choco": [0, -5.7],
  "bag_fizz": [0, -5.7],
  "bag_grain": [0, -5.7],
  "bag_leaf": [0, -5.7],
  "bag_paw": [0, -5.7],
  "bag_snow": [0, -5.7],
  "bag_star": [0, -5.7],
  "bag_wheat": [0, -5.7],
  "baguette": [0, 0.1],
  "balloon": [0, -3],
  "banana": [6.3, 3.1],
  "battery": [0, -1],
  "beer": [-0.5, -10],
  "beet": [0, -8],
  "berries": [0, -3.5],
  "birdseed": [0, -10.5],
  "bottle_bubble": [0, 0.5],
  "bottle_coffee": [0, 0.5],
  "bottle_drop": [0, 0.5],
  "bottle_fizz": [0, 0.5],
  "bottle_grain": [0, 0.5],
  "bottle_honey": [0, 0.5],
  "bottle_leaf": [0, 0.5],
  "bottle_olive": [0, 0.5],
  "bottle_star": [0, 0.5],
  "bottle_tomato": [0, 0.5],
  "box_bubble": [0, -4.5],
  "box_choco": [0, -4.5],
  "box_grain": [0, -4.5],
  "box_snow": [0, -4.5],
  "box_star": [0, -4.5],
  "box_wheat": [0, -4.5],
  "bread": [0, -5],
  "broccoli": [0, -3],
  "broom": [13, -3],
  "butter": [0, -8],
  "cake": [0, -5],
  "cakeslice": [0, -4.2],
  "can_bean": [0, -4],
  "can_corn": [0, -4],
  "can_drop": [0, -4],
  "can_fish": [0, -4],
  "can_paw": [0, -4],
  "can_tomato": [0, -4],
  "candle": [0, -2],
  "carrot": [0, 2.3],
  "carton2_berry": [0, -3],
  "carton2_leaf": [0, -3],
  "carton2_orange": [0, -3],
  "carton_apple": [0, -9],
  "carton_berry": [0, -9],
  "carton_cow": [0, -9],
  "carton_drop": [0, -9],
  "carton_orange": [0, -9],
  "catface": [0, 1],
  "celery": [0, 2],
  "cerealbowl": [0, -7.8],
  "charcoal": [0.6, -11.7],
  "cheese": [5, 0],
  "cheeseround": [0, -2],
  "chiliveg": [0.5, -1],
  "coconut": [0, -4],
  "corn": [0, -7.5],
  "cottonswab": [-1, 0],
  "croissant": [0, -8],
  "cutlery": [3, -2],
  "deodorant": [0, -0.5],
  "diaper": [0, -5],
  "dipbowl": [0, -11],
  "dishbrush": [0, 1],
  "dogface": [0, -7],
  "donut": [0, 2],
  "drumstick": [4.2, 3.1],
  "egg": [0, -2.5],
  "eggplant": [-2.5, -2.5],
  "eggs": [0.5, -3.5],
  "energydrink": [0, -2],
  "fire": [0.1, 0],
  "fish": [6, 0],
  "fishfillet": [1, -1.1],
  "flower": [0, -4],
  "foil": [7, 0],
  "garlic": [0, -3],
  "giftbox": [0, -9.5],
  "giftwrap": [-1, 6],
  "ginger": [-2.1, -7],
  "gloves": [2.6, -0.7],
  "grapes": [0, 2.9],
  "herbbunch": [0, 3],
  "icecreamtub": [0, -0.9],
  "jam": [0, -5],
  "jar_chili": [0, -5],
  "jar_honey": [0, -5],
  "jar_leaf": [0, -5],
  "jar_pepper": [0, -5],
  "jar_tomato": [0, -5],
  "jug_bubble": [-4.9, -4],
  "jug_leaf": [-4.9, -4],
  "jug_star": [-4.9, -4],
  "juicebox": [0, -1],
  "kiwi": [0, -2],
  "leafygreen": [0, -6],
  "lemon": [0, -5.7],
  "lightbulb": [0, 2],
  "mango": [-2.2, -3.8],
  "matches": [0, 5],
  "meat": [0, -0.6],
  "melon": [0, -2],
  "mop": [0, -3],
  "mug": [-3.5, -2],
  "mushroom": [0, -9.4],
  "nutbag": [0, -5.7],
  "nuts": [0, -1],
  "oats": [0, -11.5],
  "onion": [0, -3.5],
  "orange": [0, 1.4],
  "pad": [0, -1],
  "pancakes": [0, 6],
  "paperroll": [0, -6.5],
  "partycup": [0, 0.5],
  "pasta": [0, -4],
  "peapod": [0.9, -2.9],
  "pear": [0, -3],
  "pepperveg": [-0.3, 0.2],
  "petbowl": [0, -7],
  "pill": [0, -11],
  "pillbottle_cross": [0, -5],
  "pillbottle_heart": [0, -5],
  "pillbottlecross": [0, -5],
  "pineapple": [0, -2.5],
  "pizza": [0, -1],
  "plant": [0, -1],
  "pomegranate": [0, 0.5],
  "potato": [-0.4, -5.8],
  "pouch_heart": [0, -5],
  "pouch_leaf": [0, -5],
  "pouch_snow": [0, -5],
  "pouch_sun": [0, -5],
  "pregnancytest": [0, -4.5],
  "pretzel": [0.4, 2.5],
  "radish": [0, -5],
  "razor": [0, 1],
  "rhubarb": [0, -6.2],
  "riceboml": [0, -4],
  "roll": [0, -1],
  "sachet": [0, -2],
  "sausage": [0.4, -6.1],
  "scissors": [0.5, 0],
  "seeds": [0, -7.7],
  "shaker_salt": [0, -3],
  "shrimp": [3, -7.2],
  "smoothie": [0, -1],
  "soap": [-6.9, -4.1],
  "soapdispenser": [-1, -9],
  "sodacan": [0, 0.5],
  "soil": [0, -10],
  "spaghetti": [0, -3],
  "sponge": [0, -2],
  "spray": [0, -9],
  "spray_bubble": [0, -9],
  "spray_drop": [0, -9],
  "spray_leaf": [0, -9],
  "spray_snow": [0, -9],
  "spray_star": [0, -9],
  "spray_sun": [0, -9],
  "spreadtub": [0, -8.5],
  "steak": [-0.7, 1],
  "stonefruit": [0, -2],
  "straw": [4, -2],
  "strawberry": [0, -8],
  "tape": [-2, 0],
  "teacup": [-3.7, 2],
  "thermometer": [0, -1],
  "toiletpaper": [0, -5],
  "tomato": [0, -4],
  "toothbrush": [-2, 0],
  "toothpaste": [0, -3],
  "trashbag": [0, -6.5],
  "tub_berry": [0, -11.5],
  "tub_bubble": [0, -11.5],
  "tub_cow": [0, -11.5],
  "tub_drop": [0, -11.5],
  "tube_cross": [0, -3],
  "tube_drop": [0, -3],
  "tube_star": [0, -3],
  "tube_sun": [0, -3],
  "tube_tomato": [0, -3],
  "waterbottle": [0, -3.5],
  "watermelon": [0, -8.5],
  "wineglass": [0, -4],
  "yoghurtcup": [0, -7]
};
// ---- end ICON_OFFSETS ----

  function normalize(name) { return String(name).trim().toLowerCase(); }
  function iconKey(name) { return MAP[normalize(name)] || null; }
  function iconSvg(name) {
    var key = iconKey(name);
    if (!key || !I[key]) return null;
    var off = ICON_OFFSETS[key];
    var inner = off ? '<g transform="translate(' + off[0] + ',' + off[1] + ')">' + I[key] + '</g>' : I[key];
    return '<svg viewBox="0 0 100 100" class="item-icon" aria-hidden="true">' + G(inner) + '</svg>';
  }

export const ITEM_ICON_LIB = I;
export const ITEM_ICON_MAP = MAP;
export const iconKeyForItem = iconKey;
export const iconSvgForItem = iconSvg;
export const iconForItem = iconSvg;
