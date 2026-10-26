import { parseLabel, isUsable } from '../src/labelParse.ts'

const cases: { name: string; text: string; expect: Record<string, unknown>; usable: boolean }[] = [
  {
    name: 'US Nutrition Facts, clean',
    text: `Nutrition Facts
8 servings per container
Serving size 2/3 cup (55g)
Amount per serving
Calories 230
Total Fat 8g
Saturated Fat 1g
Trans Fat 0g
Total Carbohydrate 37g
Dietary Fiber 4g
Total Sugars 12g
Protein 3g`,
    expect: { calories: 230, fat_g: 8, satfat_g: 1, carbs_g: 37, fiber_g: 4, sugar_g: 12, protein_g: 3 },
    usable: true,
  },
  {
    name: 'US panel with OCR slips (O for 0, l for 1, S for 5)',
    text: `Nutritlon Facts
Serving size 1 bar (4Og)
Calories 2OO
Total Fat l2g
Saturated Fat 3g
Total Carbohydrate 2Og
Dietary Fiber Sg
Total Sugars l8g
Protien 6g`,
    expect: { calories: 200, fat_g: 12, satfat_g: 3, carbs_g: 20, fiber_g: 5, sugar_g: 18, protein_g: 6 },
    usable: true,
  },
  {
    name: 'EU per 100 g with kJ and kcal',
    text: `Nutrition information
Typical values per 100g
Energy 1046kJ / 250kcal
Fat 12.0g
of which saturates 7.1g
Carbohydrate 31.0g
of which sugars 18.5g
Fibre 2.1g
Protein 4.5g
Salt 0.25g`,
    expect: { calories: 250, fat_g: 12, satfat_g: 7, carbs_g: 31, sugar_g: 19, fiber_g: 2, protein_g: 5, per100: true },
    usable: true,
  },
  {
    name: 'badly garbled, must be rejected',
    text: `N#tr!t on Fa?ts
~~~~ ###
Caiwqz ---
Tot?l F@t`,
    expect: { calories: 0 },
    usable: false,
  },
  {
    name: 'energy only, no macros, must be rejected',
    text: `Nutrition Facts
Calories 180`,
    expect: { calories: 180 },
    usable: false,
  },
]

let failures = 0
for (const c of cases) {
  const got = parseLabel(c.text) as unknown as Record<string, unknown>
  const bad: string[] = []
  for (const [k, v] of Object.entries(c.expect)) {
    if (got[k] !== v) bad.push(`${k}: expected ${v}, got ${got[k]}`)
  }
  const u = isUsable(parseLabel(c.text))
  if (u !== c.usable) bad.push(`usable: expected ${c.usable}, got ${u}`)
  if (bad.length) {
    failures++
    console.log(`FAIL  ${c.name}`)
    for (const b of bad) console.log(`        ${b}`)
  } else {
    console.log(`ok    ${c.name}  (confidence ${(parseLabel(c.text).confidence).toFixed(2)})`)
  }
}
console.log(failures ? `\n${failures} failing` : '\nall passing')
process.exit(failures ? 1 : 0)
