# Methodology Evolution: From a Single Threshold to v7

A recurring question about any threshold-based detector is *"why these thresholds, and not others?"* This document answers that directly, by walking through how the detection logic actually evolved across successive iterations — each one a response to a specific, observed failure mode, not an arbitrary parameter search. The stage labels below (Stage 1, Stage 2, ...) describe the order in which capabilities were added during development; only the final stage corresponds to a specific numbered script version (`v7`, the one in this repository) — the intermediate stages were working iterations rather than separately archived releases.

---

## The progression

| Stage | Approach | What was tested | What happened | Decision |
|---|---|---|---|---|
| 1 | Single-criterion ΔNDBI threshold | Simple year-over-year NDBI differencing | Easy to interpret, but produced a high false-positive rate over dry, bare Mediterranean soil — exactly the terrain that dominates large parts of Attica in summer imagery | Rejected as insufficient on its own |
| 2 | + ΔNDVI, + ΔBSI (optical-only, multi-index) | Adding vegetation-loss and bare-soil indices alongside ΔNDBI | Better separation between vegetation loss and bare/construction ground, but confusion between rocky/dry-soil terrain and true built-up surfaces persisted — optical data alone wasn't enough | A non-optical, structurally independent signal was needed |
| 3 | + Sentinel-1 ΔVV (SAR), + SRTM slope filter, Dynamic World promoted to primary reference | Radar backscatter change and terrain slope added as further criteria; validation moved from GHSL-only (which produced degenerate, near-empty confusion matrices at small AOI scale) to Dynamic World as primary reference | False positives over dry/rocky terrain dropped; but in this iteration SAR was wired in as a **hard, mandatory** AND-gate — every candidate pixel required a large ΔVV regardless of optical evidence strength. On a full validation run at the primary Ellinikon AOI, that hard gate measured **recall of 3.7%** (precision 96.3%) — the detector had become so strict it was flagging almost none of the real reference-confirmed development | Hard SAR gating identified as unusable; SAR needed to be supporting evidence, not a veto |
| **4 / v7 (final, submitted)** | SAR + strong-optical-support as an *either/or* gate; CORE/Expanded output split; Dynamic World reference rebuilt on **probability gain** rather than raw after-year state, to remove circularity risk; GHSL restricted to **observed epochs only** (no 2025/2030 forecast layers) | Full pipeline re-run and validated against both reference products, across three sensitivity profiles and three AOIs | Balanced profile: 88.1% precision / 17.3% recall vs Dynamic World at the primary AOI, with a clean, monotonic precision/recall trade-off across the three sensitivity profiles, and correctly near-silent output on an independent control site (see [results](../results/VALIDATION_RESULTS.md)) | Adopted as the final architecture — this is the script in [`gee-script/GEE_Script_v7.js`](../gee-script/GEE_Script_v7.js) |

**On AOI selection, not just thresholds:** the methodology calibration wasn't only about tuning criteria — it also included correcting a site-selection mistake. An early candidate site near Spata turned out to be dominated by solar-farm installations, which Dynamic World's classifier labels "built" (flat, dark, structured surfaces) but which the detector — tuned for vertical building geometry — correctly did not flag. That wasn't a threshold bug; it was the reference product and the detector legitimately disagreeing about what counts as "development." The AOI was moved to a genuine industrial/warehouse growth site nearer the airport instead. The final validated Spata result in [`results/VALIDATION_RESULTS.md`](../results/VALIDATION_RESULTS.md) reflects the corrected site.

---

## Why this order, specifically

Each addition targeted a *named, observed* failure of the previous version rather than being bolted on speculatively:

1. **NDBI alone confuses built-up with bare/dry soil** — the single most common failure mode in Mediterranean remote sensing, and the reason a multi-index approach was necessary at all.
2. **NDVI and BSI together separate vegetation loss from bare-ground exposure**, but neither can tell dry natural ground apart from a genuine construction site — both are "bare" spectrally.
3. **SAR breaks that tie** because it measures physical geometry, not colour — a genuinely different piece of evidence, not just another optical index in disguise.
4. **Slope removes a class of terrain (rocky slopes) that can pass spectral *and* occasionally SAR-adjacent noise, but is topographically implausible for new construction.**
5. **Hard SAR gating looked like the "more rigorous" choice on paper, but empirically measured 3.7% recall** — a useful negative result that shaped the final v7 architecture, where SAR is supporting evidence rather than a veto.
6. **The final probability-gain reference construction and CORE/Expanded split exist specifically to prevent two things:** validating the detector against a reference built in a way that quietly encodes the same assumptions as the detector (circularity), and reporting an inflated accuracy number by mixing high-confidence and speculative detections into a single layer.
7. **AOI selection itself was treated as part of the methodology, not a footnote** — the Spata relocation (above) and the deliberate choice of a legally protected forest as a control site are both evidence of testing the detector's boundaries on purpose, not just reporting its best result.

---

## What this means for the threshold table

The three sensitivity profiles (Sensitive / Balanced / Strict) documented in [`gee-script/README.md`](../gee-script/README.md#threshold-reference) are not three arbitrary points on a slider — they're the same v7 architecture evaluated at three coordinated threshold sets, letting precision/recall trade-offs be compared on a like-for-like basis rather than by changing the underlying logic each time. The full sweep and its measured results are in [`results/VALIDATION_RESULTS.md`](../results/VALIDATION_RESULTS.md).
