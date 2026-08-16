# Etheria Restart — Build & GVG Database

A static website that turns `core_data.xlsx` into a browsable build and GVG team
database. There is no backend, no database, and no login. You edit the Excel
file, push it, and GitHub Pages rebuilds the site.

```
core_data.xlsx  →  build.py  →  data.json + assets/  →  index.html / style.css / app.js
```

**Nothing about the site is hardcoded.** Add rows to the `Build` or `GVG_team`
sheet and the new Animus, build options, and teams appear on their own. You
never need to touch the HTML, CSS, or JavaScript to add data.

---

## Sections

| Section | What it does |
| --- | --- |
| **Builds** | Search Animus by name or element, filter by element, open a profile, switch between build options |
| **GVG Teams** | Every recommended composition, searchable by team name *or* by an Animus inside the team. Tap any Animus to jump to its build |
| **Codex** | Reference lists from the `Information` sheet — Matrices with their node counts, Shells, Shell Passives, Elements — plus any warnings from the last build |

Every view has its own URL, so you can bookmark or share one:

```
#builds
#build/areal
#build/areal/2          ← straight to Option 2
#gvg
#gvg/holyship-1
#info
```

---

## Quick start (on your computer)

You need Python 3.9 or newer.

```bash
pip install -r requirements.txt
python build.py
python -m http.server 8000
```

Then open <http://localhost:8000>.

> Open it through `http.server`, not by double-clicking `index.html`. Browsers
> block `fetch("data.json")` on `file://` URLs, and the page will show a
> "data.json could not be loaded" message.

---

## Your day-to-day workflow

1. Open `core_data.xlsx` **in Excel** and add or edit rows.
2. Save.
3. Commit and push:

   ```bash
   git add core_data.xlsx
   git commit -m "Add Sylvia builds and HolyShip #3"
   git push
   ```

4. GitHub Actions runs `build.py` and republishes the site in about a minute.

That is the whole loop. You can also run `python build.py` locally first if you
want to preview before pushing.

---

## The sheets

### `Build`

One row per build option. One Animus can have as many options as you like — the
profile page shows a tab for each, in numeric order.

| Column | Notes |
| --- | --- |
| `Animus` | Must match a name in the `Information` sheet to get artwork |
| `Option` | `1`, `2`, `3`… Sorted numerically. Only one option means no tabs are shown |
| `Element` | `constant`, `disorder`, `hollow`, `odd`, `reason` — drives the accent colour |
| `Skill` | Comma-separated, e.g. `5,5,5` |
| `Matrix_1` … `Matrix_3` | Matrix names |
| `Matrix_Fill` | Comma-separated, e.g. `12,8,6` — paired with each Matrix in order |
| `Shell` | Shell name |
| `Shell_Passive_1` … `_3` | Passive names |
| `Major Stat` / `Minor Stat` | Comma-separated; each entry becomes its own row |
| `Remark` | Free text, Thai is fine |

`Matrix_Fill` is shown against each Matrix's total node count from the
`Information` sheet, so `12,8,6` on Bloodbath / Bulwark / Evolguard renders as
`12 / 12`, `8 / 8`, `6 / 6` with a fill meter under each name.

### `GVG_team`

One row per team. Columns are `Team`, then `A_animus`, `A_Matrix_1..3`,
`A_Shell`, and the same for `B_` and `C_`.

Team names are free text — `HolyShip #1`, `Rush comp`, anything. The site never
assumes a numbering scheme. If you ever add a `D_animus` column set, the build
script picks up the fourth slot automatically.

### `Information`

Lookup tables used for artwork, icons, and Matrix node counts. Add a row here
first whenever a new Animus, Matrix, Shell, or Passive enters the game.

---

## Artwork

**Your artwork already lives inside `core_data.xlsx`.** The `Information` sheet
uses Excel's "Place in Cell" pictures — 236 of them: a portrait and a full card
for every Animus, plus icons for every Matrix, Shell, Passive, and Element.

`build.py` reads those pictures straight out of the workbook, converts them to
WebP, and writes them into `assets/`. You do not have to export or upload images
by hand.

```
assets/
├── animus/          areal-card.webp, areal-portrait.webp, …
├── shells/          halloween.webp, …
└── icons/
    ├── matrix/      bloodbath.webp, …
    ├── passives/    surge.webp, …
    └── elements/    disorder.webp, …
```

To add art for a new Animus, paste the picture into the `Profile` and `Card`
cells next to its name in the `Information` sheet, exactly as the existing rows
do, then rebuild.

**Replacing art by hand** also works. Drop a file into the matching folder using
the naming above and it will be used whenever the workbook has no picture for
that row.

If a picture is missing entirely, the card shows a clean placeholder with the
Animus's initials — the layout never breaks and the data still displays.

> One caution: some tools strip in-cell pictures when they re-save an `.xlsx`.
> Edit `core_data.xlsx` in Excel to keep them. If it ever happens, `build.py`
> prints a warning and falls back to the artwork already committed in `assets/`,
> so the live site keeps working.

---

## Deploying to GitHub Pages

One-time setup:

1. Push this folder to a GitHub repository, with `main` as the default branch.
2. Go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **GitHub Actions**.

That is it. `.github/workflows/deploy.yml` handles the rest: it checks out the
repo, installs the Python dependencies, runs `python build.py`, and publishes the
result.

The workflow runs on every push to `main`, and you can also start it by hand
from the **Actions** tab via **Run workflow** (`workflow_dispatch`).

Make sure `core_data.xlsx` is committed — the workflow builds from it.

---

## Project structure

```
├── index.html                  page shell and navigation
├── style.css                   all styling
├── app.js                      routing, rendering, search
├── build.py                    reads the workbook, writes data.json and assets/
├── core_data.xlsx              your data — the only file you normally edit
├── data.json                   generated; safe to delete and rebuild
├── requirements.txt
├── assets/                     generated artwork
└── .github/workflows/deploy.yml
```

`data.json` and `assets/` are generated. Committing them is fine and makes the
site work even if a build ever fails, but the workflow regenerates both on every
deploy.

---

## Build script options

```bash
python build.py                     # normal build
python build.py --no-images         # data.json only, leaves assets/ alone (fast)
python build.py --excel other.xlsx  # build from a different workbook
python build.py --out preview.json  # write the JSON somewhere else
```

The script prints a summary and any warnings, for example a Shell named in
`Build` that has no row in `Information`. Those warnings also appear at the
bottom of the **Codex** page, so you can spot typos without reading the logs.

---

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| "data.json could not be loaded" | You opened `index.html` directly. Serve the folder with `python -m http.server` |
| An Animus shows initials instead of art | Its name in `Build` doesn't match the `Information` sheet, or that row has no picture. Check the Codex page for the exact warning |
| A new row didn't appear | `build.py` wasn't re-run, or the push didn't reach `main`. Check the Actions tab |
| Matrix shows a number but no meter | That Matrix has no `Full` value in the `Information` sheet |
| Site deploys but is blank | Confirm **Settings → Pages → Source** is set to **GitHub Actions**, not "Deploy from a branch" |

---

## Design notes

Values from Excel are displayed exactly as typed — `Crit rate`, `%Hp`, and
`Crit resis` are never reformatted or renamed. Empty cells render as `—` rather
than `undefined`. Element accent colours are taken from the game's own element
badges. Artwork loads lazily, so a roster of every Animus stays fast on mobile
data.
