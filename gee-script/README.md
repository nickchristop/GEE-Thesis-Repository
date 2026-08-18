# Attica Urban Development Change Detector — GEE Script v7

**Technical documentation for `GEE_Script_v7.js`** — the final, officially submitted analytical tool behind the dissertation *Γεωγραφική Ανάλυση Δεδομένων με τη Χρήση Google Earth Engine για την Ανίχνευση Αστικής Ανάπτυξης στην Αττική* ("Geospatial Data Analysis Using Google Earth Engine for the Detection of Urban Development in Attica").

See the [repository root README](../README.md) for the project overview, results summary, and links to the academic write-up.

---

## Overview

This script implements a multi-sensor, multi-criterion urban change detection workflow inside [Google Earth Engine (GEE)](https://earthengine.google.com/). It fuses optical imagery from Sentinel-2, SAR backscatter from Sentinel-1, and topographic data from SRTM to identify pixels exhibiting spectral, structural, and geometric signals consistent with new urban construction or development in the Attica region of Greece (default comparison window: 2018–2024).

Results are validated against two independent benchmark reference datasets: Dynamic World (10 m, Google/WRI) and the Global Human Settlement Layer built-up surface (GHSL, 100 m, JRC).

---

## Requirements

- A Google Earth Engine account (free for academic/personal use: https://earthengine.google.com/signup)
- A modern browser (Chrome recommended)
- No local installation required — all processing runs on GEE's cloud infrastructure

---

## How to Run

1. Open the [Google Earth Engine Code Editor](https://code.earthengine.google.com/)
2. Create a new script file and paste the full contents of [`GEE_Script_v7.js`](GEE_Script_v7.js)
3. Click **Run** (top toolbar)
4. The control panel appears on the left side of the map
5. Follow the five steps in the panel in order (see [Panel Controls](#panel-controls--step-by-step) below)

> **Default AOI:** If no area is drawn, the script uses a default bounding box covering the Ellinikon–Glyfada–Argyroupoli area (23.680°E–23.805°E, 37.835°N–37.935°N), which is the primary case study area of the dissertation.

---

## Panel Controls — Step by Step

### Step 1 — Select Years

Choose the **Before** year and the **After** year from the dropdown menus.

- Supported range: 2017–2025
- Default: **2018 → 2024**
- The before year must be strictly earlier than the after year
- Each year generates a summer median composite (April–October) from Sentinel-2

### Step 2 — Detection Settings

**Sensitivity profile** — controls the detection threshold stringency:

| Profile | Behaviour |
|---------|-----------|
| **Sensitive** | Low thresholds. Detects smaller or subtler changes, but includes more false positives. Use for exploratory analysis or where completeness matters more than precision. |
| **Balanced** | Default. The best measured precision/recall/area-ratio compromise across the tested profiles. Recommended for reporting. |
| **Strict** | High thresholds. Only very clear, confident changes are flagged. Minimises false positives at the cost of missing smaller changes. |

**Use Sentinel-1 SAR as support** — when enabled, SAR backscatter change (ΔVV, ΔVH) is incorporated as supporting evidence. SAR detects geometric structure changes in addition to optical spectral changes. Recommended: **on**.

**Use slope filter** — excludes pixels on steep terrain (>20° for Balanced/Strict, >30° for Sensitive) where new built-up development is implausible. Recommended: **on**.

**Train RF from Dynamic World pseudo-labels** — enables an optional Random Forest classifier trained from Dynamic World-derived pseudo-labels. See [Optional Random Forest Classification](#optional-random-forest-classification) below for important caveats before using.

**DW pseudo-RF probability threshold** — only active when RF training is enabled. Controls the probability cutoff for the RF classification output (default: 0.80).

### Step 3 — Draw Study Area

Use **Draw Rectangle** or **Draw Polygon** to define a custom Area of Interest (AOI) on the map. The AOI outline appears in cyan after drawing.

- **Clear AOI** resets to the default Ellinikon bounding box
- Minimum recommended size: 500 m × 500 m (needed for statistically meaningful stratified sampling)
- Very large AOIs may time out during validation — use a focused polygon over the area of interest

### Step 4 — Validation

**Run validation** — when checked, accuracy metrics are computed against the selected reference dataset after the detection run.

**Show TP / FP / FN debug layers** — when checked, the map gains colour-coded validation overlay layers:
- Green: True Positives (correctly detected change)
- Magenta: False Positives (incorrectly flagged as change)
- Blue: False Negatives (real change missed by the detector)

These layers are added to the map's Layers panel and are off by default — toggle them on in the Layers dropdown after a run.

**Reference dataset:**

| Option | Description |
|--------|-------------|
| Dynamic World development reference | Google's Dynamic World (10 m, near-real-time) as the validation benchmark. Primary reference. |
| GHSL built-up reference | JRC Global Human Settlement Layer (100 m, 5-year observation epochs, 1975–2020). Secondary reference. GHSL epochs may not land on the exact years selected — the script rounds each selected year down to the most recent *observed* epoch at or before it, and deliberately excludes the 2025/2030 GHSL layers since those are model projections, not observations. |
| Both | Runs validation against both references sequentially. |

### Step 5 — Run

Click **Run Detection** to execute the full analysis. Results appear in the panel below the button, typically within 30–90 seconds depending on AOI size and server load.

---

## Outputs

### Map Layers

| Layer name | Colour | Description |
|---|---|---|
| CORE validated built-up development layer | Magenta | The primary detector output — pixels satisfying all 5 AND-coupled criteria. **This is the layer whose accuracy is reported.** |
| New built-up only | Red | Same content as CORE, shown in the working/raw colour scheme. |
| High-confidence construction candidate | Orange | Pixels with strong construction-stage spectral + SAR signatures, not yet classified as complete built-up. Requires manual confirmation before being reported as an accuracy result. |
| Broad construction candidate diagnostic | Pale orange | Wider diagnostic construction signal. Indicative only, not part of any reported metric. |
| Expanded urban-development candidate | Pink/purple | Union of new built-up and high-confidence construction — the extended development envelope. |
| Vegetation loss | Yellow | Areas where NDVI decreased beyond threshold relative to a pre-existing-vegetation baseline. |
| All detected changes | Composite | All change categories in one layer (1 = veg. loss, 2 = built-up, 3 = construction, 4 = expanded). |
| dNDBI / dNDVI / dBSI / dVV / dVH | Continuous | Raw change surfaces for each index/band, before thresholding — useful for diagnostic exploration. |
| Slope | Greyscale | SRTM-derived slope map used for terrain filtering. |
| RGB BEFORE / AFTER | Natural colour | Sentinel-2 RGB composites for the two comparison years. |
| False colour BEFORE / AFTER | NIR false colour | Sentinel-2 false colour (B8-B4-B3) for vegetation contrast. |
| Debug TP / FP / FN layers | Green / Magenta / Blue | Present only if validation ran with debug layers enabled. |
| AOI outline | Cyan | The current area-of-interest boundary. |

### Panel Results

The **Change summary** panel reports, per category, the area in km² (new built-up, construction candidate, broad diagnostic, CORE, Expanded, vegetation loss), followed — if validation is enabled — by, per reference dataset: Balanced-sample Overall Accuracy, Kappa, recall and precision for the positive class, F1, and sample-size metadata.

---

## Understanding the CORE vs Expanded distinction

**CORE validated built-up development layer** is the detector's own new-built-up output — the pixels that independently satisfy all 5 AND-coupled criteria (ΔNDBI, ΔBSI, after-year NDVI, ΔVV/strong-optical-support, slope). It is *validated against* Dynamic World / GHSL in the accuracy step, but it is not itself pixel-intersected with the reference before that comparison — CORE is entirely the rule-based detector's own decision. This is the layer whose Precision/Recall/F1 numbers should be quoted.

**Expanded urban-development candidate** is CORE plus the high-confidence construction-stage layer — a broader envelope that also captures mid-build states (active excavation, foundation-laying) that Dynamic World may not yet label as "built." It is diagnostically useful and is also scored against the references for context, but because it deliberately includes lower-confidence, earlier-stage pixels, it should be treated as **qualitative supporting evidence**, not a headline accuracy figure.

> **Reporting guidance used throughout this project:** report accuracy metrics against **CORE**. Treat Expanded as supporting evidence of ongoing development activity, not a quantitative result in its own right.

---

## Validation design and limitations

Validation uses **balanced stratified sampling**: up to 300 pixels from the positive class (reference-confirmed development) and up to 300 from the negative class, drawn from within the AOI at the native resolution of the reference dataset (10 m for Dynamic World, 100 m for GHSL), following the good-practice protocol of Olofsson et al. (2014).

**Important caveats, stated explicitly by the tool itself and reproduced here:**

1. **Dynamic World is a benchmark, not ground truth.** DW is a globally trained neural network operating on Sentinel-2 imagery. It carries its own classification errors — for instance, solar/PV installations are sometimes labelled "built," and small or unusually shaped structures can be missed. Agreement with DW reflects consistency with that specific benchmark, not absolute accuracy.

2. **GHSL's 100 m resolution is a real constraint, not a bug in this tool.** At 100 m, GHSL cannot resolve fine-grained urban transitions within small AOIs. For study areas around 2 km² or smaller, GHSL can report zero positive reference pixels and no confusion matrix can be produced — this happened at the primary Ellinikon AOI and is documented as a scale-mismatch finding in [`results/VALIDATION_RESULTS.md`](../results/VALIDATION_RESULTS.md).

3. **Impervious-to-impervious change is a known blind spot.** When a surface already impervious in the before year (a former runway, a car park) is redeveloped into buildings, the spectral change signal (ΔNDBI, ΔBSI) is weak, because the surface type did not transition from bare/vegetated to built. Such changes are not reliably detected — an inherent limitation of optical/SAR change detection, not something threshold-tuning can fix.

4. **Low recall at the default profile is expected and deliberate.** The five-criterion AND-coupling is designed to bias toward precision (a positive detection is very likely real) at the cost of recall (some real changes are missed). The default Balanced profile measured ~88% precision / ~17% recall against Dynamic World at the primary AOI. Switching to Sensitive recovers recall at the cost of precision — see [`results/VALIDATION_RESULTS.md`](../results/VALIDATION_RESULTS.md) for the full sweep.

---

## Optional Random Forest classification

When **Train RF from Dynamic World pseudo-labels** is enabled, an additional Random Forest classifier (`ee.Classifier.smileRandomForest`, 250 trees) is trained using Dynamic World class probabilities as weak pseudo-labels, then applied to the full predictor stack (before/after spectral bands and indices, SAR deltas, slope).

**Critical caveat — circular validation.** Because the RF is trained *from* Dynamic World labels, and the primary validation benchmark *is* Dynamic World, its reported accuracy against DW reflects agreement with its own training source, not independent accuracy. The script labels this explicitly as a "circular diagnostic" in its own output panel. It should be reported as **weakly supervised benchmark calibration**, never as an independent accuracy figure.

**What the RF does provide of independent value:** its **feature importance ranking**. Because that ranking comes from the tree-splitting structure — not from the confusion matrix against DW — it is an independent empirical signal for which input variables carry the most discriminative information. In the documented run (see [results](../results/VALIDATION_RESULTS.md#random-forest-diagnostic)), SAR-derived and topographic features rank surprisingly high alongside the core optical indices, corroborating the decision to fuse multiple sensor types rather than rely on optical bands alone.

---

## Data Sources

| Dataset | Source | Native resolution | Use in script |
|---------|--------|------------------|---------------|
| Sentinel-2 SR Harmonized | ESA / Google — `COPERNICUS/S2_SR_HARMONIZED` | 10 m (optical), 20 m (SWIR) | Primary optical imagery, spectral indices |
| Sentinel-1 GRD | ESA / Google — `COPERNICUS/S1_GRD` | ~10 m | SAR backscatter support (VV, VH) |
| SRTM Digital Elevation Model | USGS — `USGS/SRTMGL1_003` | 30 m | Slope-based terrain filtering |
| Dynamic World V1 | Google / WRI — `GOOGLE/DYNAMICWORLD/V1` | 10 m | Validation benchmark only (never used inside detection logic) |
| GHSL Built-up Surface P2023A | JRC — `JRC/GHSL/P2023A/GHS_BUILT_S` | 100 m | Secondary validation benchmark |

**Cloud masking:** Sentinel-2 imagery is filtered using the Scene Classification Layer (SCL), excluding cloud shadow (class 3), medium-probability cloud (8), high-probability cloud (9), cirrus (10), and snow/ice (11). A primary collection with <60% cloud cover is attempted; if insufficient scenes are available, a fallback collection with <90% cloud cover is used. Each year's composite is the median of up to 25 scenes from the April–October summer window.

---

## Threshold Reference

The following table documents the detection thresholds used by each sensitivity profile — the minimum change magnitude required in each criterion for a pixel to pass each filter. These are read directly from `getThresholds()` in the script; if the code changes, this table should be regenerated from it.

| Parameter | Sensitive | Balanced | Strict | Description |
|-----------|-----------|----------|--------|-------------|
| `newBuiltDNDBI` | 0.032 | 0.050 | 0.080 | Minimum NDBI increase for new built-up |
| `newBuiltDBSI` | 0.026 | 0.040 | 0.065 | Minimum BSI increase for new built-up |
| `maxBuiltNDVI` | 0.52 | 0.46 | 0.40 | Maximum NDVI in after year (vegetation exclusion) |
| `minBuiltNDBI` | -0.12 | -0.08 | -0.04 | Minimum absolute NDBI in after year |
| `newBuiltDVV` | 0.80 | 1.50 | 2.50 | Minimum VV SAR increase (dB) |
| `newBuiltDVH` | 0.40 | 0.80 | 1.20 | Minimum VH SAR increase (dB) |
| `maxBuiltSlope` | 30° | 20° | 20° | Maximum terrain slope |
| `constructionDBSI` | 0.050 | 0.070 | 0.075 | Minimum BSI increase for construction stage |
| `constructionNDVILoss` | 0.070 | 0.090 | 0.100 | Minimum NDVI loss for construction stage |
| `vegLossDNDVI` | 0.06 | 0.10 | 0.18 | Minimum NDVI loss for vegetation-loss category |
| `beforeVegNDVI` | 0.18 | 0.28 | 0.35 | Minimum before-year NDVI for vegetation-loss eligibility |
| `minPatchPixels` | 2 | 4 | 5 | Minimum connected-pixel patch size (noise removal) |

---

## Architecture notes

**SAR as support, not gate.** Sentinel-1 SAR is incorporated as supporting evidence rather than a mandatory gate. A pixel with strong optical evidence (large ΔNDBI or ΔBSI, significant NDVI loss) can pass without a correspondingly large SAR signal; conversely, SAR alone cannot trigger a detection. This design avoids the severe recall suppression that occurs when SAR is treated as a mandatory criterion — see [`docs/METHODOLOGY_EVOLUTION.md`](../docs/METHODOLOGY_EVOLUTION.md) for the earlier iteration that hit this problem.

**Anti-circularity.** Dynamic World class probabilities and labels are never used inside the detection logic. They are constructed independently, after the detector has already run, and used only in the validation step. This separation is enforced structurally in the script (the reference-building functions are only ever called from the validation branch) and documented in the header comments.

**Patch filtering.** After all criterion masks are combined, a connected-pixel-count filter (`connectedPixelCount`) removes isolated single-pixel detections likely to be noise. Minimum patch size is profile-dependent (see threshold table above).

**Burn exclusion.** A pixel is flagged as burn-like disturbance — and excluded from every urban-development category — when it simultaneously shows a large NBR decrease (ΔNBR > 0.20), meaningful NDVI loss (> 0.12), a below-zero after-year NDBI, and a low after-year BSI. That combination (vegetation and burn-ratio loss without a corresponding built-up or bare-construction spectral signature) is designed to catch wildfire scars specifically, without also excluding genuine construction sites, which do show elevated NDBI/BSI.

---

## Recommended workflow for reproducing the primary result

1. Use the **default Ellinikon AOI** (do not draw a custom polygon — let the script fall back to `DEFAULT_AOI`)
2. **Before year: 2018**, **After year: 2024**
3. **Sensitivity: Balanced**
4. **Use Sentinel-1 SAR as support** — ON
5. **Use slope filter** — ON
6. **Train RF from Dynamic World pseudo-labels** — OFF
7. **Run validation** — ON
8. **Reference dataset: Both**
9. Click **Run Detection**

Expected result (Ellinikon AOI, Balanced, 2018→2024) — full table with the Sensitive/Strict sweep and two secondary AOIs in [`results/VALIDATION_RESULTS.md`](../results/VALIDATION_RESULTS.md):

| Metric | Value |
|---|---|
| CORE validated built-up | 3.32 km² |
| Expanded urban-development candidate | 5.03 km² |
| Construction candidate | 1.71 km² |
| Vegetation loss | 5.39 km² |
| Precision vs Dynamic World | 88.1% |
| Recall vs Dynamic World | 17.3% |
| F1 vs Dynamic World | 0.290 |
| GHSL result | 0 positive reference pixels (scale limitation at this AOI size) |

---

## File contents

```
GEE_Script_v7.js      — Main Google Earth Engine script (paste into the Code Editor)
README.md             — This document
```

---

## Citation

If referencing or adapting this script, please cite the accompanying dissertation:

> Christopoulos, N. (2026). *Geospatial Data Analysis Using Google Earth Engine for the Detection of Urban Development in Attica.* BSc Dissertation, School of Architecture, Computing and Engineering, University of East London.

---

## Acknowledgements

Sentinel-2 and Sentinel-1 data: European Space Agency (ESA) / Copernicus Programme.
SRTM data: NASA / USGS.
Dynamic World: Brown et al. (2022), *Scientific Data*, 9, 251. https://doi.org/10.1038/s41597-022-01307-4
GHSL: Pesaresi & Politis (2023), European Commission Joint Research Centre. doi:10.2905/9F06F36F-4B11-47EC-ABB0-4F8B7B1D72EA
Google Earth Engine platform: Gorelick et al. (2017), *Remote Sensing of Environment*, 202, 18–27.
Accuracy assessment protocol: Olofsson, P. et al. (2014), *Remote Sensing of Environment*, 148, 42–57.
