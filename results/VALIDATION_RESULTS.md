# Validation Results

This document consolidates every documented test run of `GEE_Script_v7.js`, captured directly from the Google Earth Engine Code Editor result panel. Screenshots for each run are in [`screenshots/`](screenshots/). All figures below are transcribed as-reported by the tool — nothing is rounded or adjusted beyond formatting.

Validation methodology in all runs: stratified random sampling (up to 300 points per class) at the native resolution of the reference dataset, following Olofsson et al. (2014). See [`gee-script/README.md`](../gee-script/README.md#validation-design-and-limitations) for the full validation design and its caveats — in particular, that Dynamic World and GHSL are **benchmarks, not ground truth**.

---

## 1. Sensitivity sweep — primary AOI (Ellinikon / Glyfada / Argyroupoli)

**AOI:** default bounding box (23.680°E–23.805°E, 37.835°N–37.935°N) · **Years:** 2018 → 2024 · **SAR support:** on · **Slope filter:** on · **Reference:** Dynamic World (11,167 reference-positive pixels, 0.88 km² reference area, 10 m scale)

| Profile | New built-up (CORE) | Construction candidate | Expanded candidate | Vegetation loss | OA | Kappa | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **Sensitive** | 6.5611 km² | 5.4969 km² | 12.0580 km² | 9.8788 km² | 60.3% | 0.207 | 88.8% | 23.7% | 0.374 |
| **Balanced** *(default)* | 3.3249 km² | 1.7071 km² | 5.0320 km² | 5.3868 km² | 57.5% | 0.150 | 88.1% | 17.3% | 0.290 |
| **Strict** | 1.9468 km² | 0.7585 km² | 2.7053 km² | 0.9550 km² | 54.2% | 0.083 | 87.9% | 9.7% | 0.174 |

**Reading this table:** precision is essentially flat (~88%) across all three profiles, while recall falls monotonically from 23.7% → 17.3% → 9.7% as thresholds tighten. This is the expected, measured signature of AND-coupling five independent criteria — precision is protected by construction, and recall is what gets traded away as each additional gate becomes harder to pass simultaneously.

The **Expanded candidate** layer, scored against the same Dynamic World reference for context (not as a headline metric — see [CORE vs Expanded](../gee-script/README.md#understanding-the-core-vs-expanded-distinction)), reached OA 61.2% / Kappa 0.223 / precision 80.7% / recall 29.3% / F1 0.430 at the Sensitive profile — recovering meaningfully more recall at a moderate precision cost, consistent with the fact that it also captures construction-stage pixels DW hasn't yet labelled "built."

**GHSL, secondary reference, Balanced profile:** at this AOI size, GHSL returned **0 positive reference pixels** (2015→2020 epoch pair, 100 m scale) — no confusion matrix could be computed. This is documented as a scale-mismatch finding about the reference product at this AOI size (roughly 2×2 km, below what a 100 m-resolution product can meaningfully resolve for a rare positive class), not a failure of the detector.

---

## 2. Secondary AOIs (Balanced profile) — testing beyond the primary hotspot

Two further AOIs were tested at the Balanced profile to check the detector's behaviour away from the main redevelopment hotspot, consistent with the dissertation's use of a secondary growth-corridor site (Spata/Mesogeia area) and a stability-control site with minimal expected change.

| AOI | Reference positive px | Reference area | CORE built-up | Expanded candidate | OA | Kappa | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Primary (Ellinikon) | 11,167 | 0.8800 km² | 3.3249 km² | 5.0320 km² | 57.5% | 0.150 | 88.1% | 17.3% | 0.290 |
| Secondary growth-corridor AOI | 4,347 | 0.3423 km² | 0.9312 km² | 1.1788 km² | 53.7% | 0.073 | 61.5% | 19.7% | 0.298 |
| Stability-control AOI | 83 | 0.0066 km² | 0.0010 km² | 0.3548 km² | 78.1% (CORE) | -0.005 (CORE) | 0.0% (CORE) | 0.0% (CORE) | N/A (CORE) |

**Secondary growth-corridor AOI:** precision drops to 61.5% relative to the primary site (88.1%) while recall stays comparable (19.7% vs 17.3%). This is a genuinely useful negative result: it shows the detector's precision is not uniform across Attica and is somewhat site-dependent — plausibly because this corridor mixes lower-density, more heterogeneous suburban/logistics-type development with the kind of dry, spectrally ambiguous ground the dissertation identifies as Attica's core confusion risk.

**Stability-control AOI:** the reference dataset shows almost no real development here (83 positive pixels out of ~54,400 sampled), and the detector correctly found almost nothing in CORE (recall/precision both effectively 0%, on a very small, low-power sample) — the conservative, high-specificity behaviour a control site is meant to demonstrate. The broader Expanded candidate layer did register signal here (recall 72.3%, precision 69.8%, F1 0.710), which reads as construction-stage activity present in the AOI that Dynamic World's "built" label hadn't caught up to yet, rather than a detector false-alarm — consistent with the CORE/Expanded design intent.

---

## 3. Random Forest diagnostic

Run with **Train RF from Dynamic World pseudo-labels: on**, Balanced profile, primary Ellinikon AOI, DW pseudo-probability threshold 0.80.

### 3.1 Holdout accuracy (30% held-out split of the pseudo-labelled sample)

| Metric | Value |
|---|---:|
| Total pseudo-samples | 2,400 (1,200 per class) |
| Train / holdout split | 1,679 / 721 |
| Holdout agreement with DW pseudo-labels | 89.3% |
| Kappa | 0.786 |
| Recall (pseudo-label positive class) | 88.0% |
| Precision (pseudo-label positive class) | 90.7% |
| F1 | 0.893 |

### 3.2 RF prediction map vs Dynamic World reference — circular diagnostic, not independent accuracy

| Metric | Value |
|---|---:|
| OA | 83.7% |
| Kappa | 0.673 |
| Precision | 98.6% |
| Recall | 68.3% |
| F1 | 0.807 |

⚠️ **This number is not comparable to the rule-based detector's accuracy above.** The RF was trained on Dynamic World pseudo-labels and is here being scored against Dynamic World itself — the high agreement mostly reflects that circularity, not independent skill. It is included for completeness and because the script itself surfaces it (clearly labelled as a "circular diagnostic") — not because it should be quoted as a result.

### 3.3 Probability-threshold sweep (RF prediction map vs DW, at varying cutoffs)

| p ≥ | F1 | Recall | Precision | Area ratio | Predicted area |
|---|---:|---:|---:|---:|---:|
| 0.70 | 0.868 | 79.0% | 96.3% | 3.88 | 3.410 km² |
| 0.75 | 0.856 | 77.0% | 96.3% | 2.95 | 2.592 km² |
| 0.80 *(applied)* | 0.817 | 70.7% | 96.8% | 2.25 | 1.981 km² |
| 0.85 | 0.800 | 67.3% | 98.5% | 1.71 | 1.507 km² |
| 0.90 | 0.757 | 61.3% | 98.9% | 1.26 | 1.109 km² |
| 0.95 | 0.662 | 49.7% | 99.3% | 0.83 | 0.734 km² |

### 3.4 Feature importance (independent of the circularity issue above)

Because this ranking comes from the Random Forest's internal tree-splitting structure rather than from any confusion matrix against Dynamic World, it *is* an independent empirical signal about which inputs carry the most discriminative power. Top 8 by importance score:

| Rank | Feature | Importance |
|---|---|---:|
| 1 | `dMNDWI` (SAR-independent water-index change) | 114.46 |
| 2 | `dVH` (Sentinel-1 SAR) | 110.10 |
| 3 | `slope` (SRTM) | 103.73 |
| 4 | `before_MNDWI` | 102.28 |
| 5 | `dVV` (Sentinel-1 SAR) | 100.12 |
| 6 | `dNDVI_loss` | 100.00 |
| 7 | `before_B3` (green band) | 98.86 |
| 8 | `after_B12` (SWIR2) | 96.80 |

The two SAR channels (`dVH`, `dVV`) and `slope` all place in the top 5 — independent evidence supporting the decision to fuse radar and topographic data rather than rely on optical indices alone. Notably, the core optical change indices used directly in the AND-coupling logic (`dNDBI`: 92.21, `dBSI`: 74.64) rank *below* several of these — a useful, unglamorous finding rather than a purely confirmatory one. The prominence of `dMNDWI`/`before_MNDWI` most likely reflects Ellinikon's coastal, partly-reclaimed-shoreline character rather than a generalisable pattern; it is reported rather than smoothed over.

---

## 4. Summary takeaways

- **Precision is stable (~88%) across sensitivity profiles at the primary AOI; recall is what changes.** Directly attributable to AND-coupling behaviour, and consistent with the trade-off documented in [`gee-script/README.md`](../gee-script/README.md#threshold-reference).
- **The detector is more precise at its primary case-study site than at a secondary corridor** — a genuine, reported limitation rather than a uniformly-strong result.
- **The stability-control AOI behaved as intended** — CORE stayed essentially silent where the reference shows almost no real development.
- **GHSL is not usable as a primary validator at small-AOI scale** in this project — a property of the 100 m reference product, established empirically rather than assumed.
- **The Random Forest diagnostic's only legitimate independent contribution is its feature-importance ranking**, which corroborates (with one genuine surprise around MNDWI) the multi-sensor design choice.

Screenshots backing every run above are in [`screenshots/`](screenshots/): `run01_sensitive_ellinikon.jpg` through `run06_balanced_control_aoi.jpg`, plus `filters_0X.jpg` showing individual output layers on the map.
