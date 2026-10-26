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
npm run build
npm start
```

Then open http://localhost:4273.

For development with hot reload:

```sh
npm run dev
```

## Nutrition estimates

Estimates come from a vision model. The app looks for credentials in this order:

1. `PUBLIK_APP_TOKEN` — calls publik API (`ai.chat`). This is the path a released
   build uses.
2. `ANTHROPIC_API_KEY` — your own key, as a fallback.

Copy `.env.example` to `.env` and fill in whichever you have. With neither set the
app runs, but scanning returns a clear "no AI credential configured" error.

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
