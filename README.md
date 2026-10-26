# AI Calorie

Photograph a meal, get its calories and macros.

AI Calorie is a local web app. It runs a small Node server on your machine, serves
the built front end from it, and keeps your log in a JSON file under
`~/.ai-calorie/`. Nothing about your eating leaves the machine except the meal
photo you choose to have analysed.

## What it does

- **Scan a meal** — take a photo (or pick one, or just describe it in words) and
  get calories, protein, carbs, fat, fibre, sugar, a 0–100 health score and an
  ingredient-by-ingredient breakdown.
- **Scan a package** — point the camera at a barcode and the product is looked up
  in Open Food Facts, so the figures are the label's own rather than a guess. For
  anything not in the database, photograph the nutrition panel: it is read **on
  your own machine**, so it costs nothing and the photo is never uploaded.
- **Correct it in words** — "it was a double portion", "no dressing" — and the
  estimate is recomputed.
- **Daily targets** — built from your height, weight, age, activity and goal with
  Mifflin–St Jeor plus an activity factor; editable afterwards.
- **Today** — a calories-remaining ring, macro bars, a logging streak, and your
  meals grouped by breakfast / lunch / dinner / snacks.
- **History** — every meal you have logged, searchable, grouped by day.
- **Progress** — average calories and protein, days logged, a daily calorie chart
  against your target, and a weight trend.

## Running it

```sh
npm install
npm start
```

Then open <http://localhost:4273>. The first `npm start` builds the interface,
which takes a second; later starts skip it. Node 20 or newer.

For development with hot reload:

```sh
npm run dev
```

## Where the numbers come from

- **Barcodes** — [Open Food Facts](https://world.openfoodfacts.org), open data, no
  key and no account. Figures are the manufacturer's, scaled to one serving. Free.
- **Nutrition panels** — read on your machine with a WebAssembly build of
  Tesseract, then cross-checked (sugars cannot exceed carbohydrate, the macros
  must account for the stated energy). Free, offline after first use, and the
  photo never leaves the machine. If too little comes out legibly, the app offers
  the AI read below instead.
- **Meal photos and written descriptions** — a vision model. This is the only
  path that costs anything.

Meal photos resolve a provider in this order:

1. **Your own key** — `ANTHROPIC_API_KEY`, if you set one. Get it from
   <https://console.anthropic.com/settings/keys>.
2. **publik API** — a released build carries `publik-app-token.txt` and
   provisions a per-install key on first launch, after showing you what that
   means and asking. No key to paste. See <https://publikhq.com/developers>.

Copy `.env.example` to `.env` only if you want to override that. With no provider
set up, barcode and panel scanning still work — they never needed one — and meal
photos ask you to choose a provider first.

## Self-test

A release build answers publik's startup self-test:

```sh
PUBLIK_SELF_TEST=1 npm start
```

It makes one real call through publik API and prints a single line
(`publik self-test: ok <slug> <version>`), then exits.

## Accuracy

These are estimates from a photo, not measurements. Portion size is the largest
source of error — check it on the result screen and correct it when it looks off.
AI Calorie is not medical advice.

## Licence

MIT — see [LICENSE](LICENSE). The numbers this app produces are estimates, and
the licence's "as is, without warranty" terms apply to them too.
