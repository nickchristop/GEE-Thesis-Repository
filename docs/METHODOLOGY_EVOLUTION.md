# Methodology Evolution: From a Single Threshold to v7

A recurring question about any threshold-based detector is *"why these thresholds, and not others?"* This document answers that directly, by walking through how the detection logic actually evolved across successive iterations — each one a response to a specific, observed failure mode, not an arbitrary parameter search.

---

## The progression

| Iteration | Approach | What was tested | What happened | Decision |
|---|---|---|---|---|
| v1–v2 | Single-criterion ΔNDBI threshold | Simple year-over-year NDBI differencing | Easy to interpret, but produced a high false-positive rate over dry, bare Mediterranean soil — exactly the terrain that dominates large parts of Attica in summer imagery | Rejected as insufficient on its own |
| v3 | + ΔNDVI, + ΔBSI (optical-only, multi-index) | Adding vegetation-loss and bare-soil indices alongside ΔNDBI | Better separation between vegetation loss and bare/construction ground, but confusion between rocky/dry-soil terrain and true built-up surfaces persisted — optical data alone wasn't enough | A non-optical, structurally independent signal was needed |
| v4 | + Sentinel-1 ΔVV (SAR) | Radar backscatter change as an additional criterion | False positives over dry/rocky terrain dropped substantially — SAR responds to physical structure (double-bounce backscatter from vertical walls), not spectral reflectance, so it doesn't share the same confusion sources as the optical indices | SAR retained as a criterion |
| v5 | + SRTM slope filter | Excluding steep terrain from eligibility | Removed a further class of false positives on rocky mountainous slopes that had passed the optical + SAR gates | Retained |
| v6 | SAR required as a **hard, mandatory** AND-gate | Every candidate pixel required a large ΔVV/ΔVH regardless of optical evidence strength | Recall collapsed to a small fraction of its earlier value region-wide — multi-year Sentinel-1 compositing introduces enough phase/speckle noise that many genuine optical detections simply never cleared a strict SAR bar | Hard SAR gating abandoned as unusable |
| **v7 (final, submitted)** | SAR + strong-optical-support as an *either/or* gate; CORE/Expanded output split; Dynamic World reference rebuilt on **probability gain** rather than raw after-year state, to remove circularity risk; GHSL restricted to **observed epochs only** (no 2025/2030 forecast layers) | Full pipeline re-run and validated against both reference products | Balanced profile: 88.1% precision / 17.3% recall vs Dynamic World at the primary AOI, with a clean, monotonic precision/recall trade-off across the three sensitivity profiles | Adopted as the final architecture — this is the script in [`gee-script/GEE_Script_v7.js`](../gee-script/GEE_Script_v7.js) |

---

## Why this order, specifically

Each addition targeted a *named, observed* failure of the previous version rather than being bolted on speculatively:

1. **NDBI alone confuses built-up with bare/dry soil** — the single most common failure mode in Mediterranean remote sensing, and the reason a multi-index approach was necessary at all.
2. **NDVI and BSI together separate vegetation loss from bare-ground exposure**, but neither can tell dry natural ground apart from a genuine construction site — both are "bare" spectrally.
3. **SAR breaks that tie** because it measures physical geometry, not colour — a genuinely different piece of evidence, not just another optical index in disguise.
4. **Slope removes a class of terrain (rocky slopes) that can pass spectral *and* occasionally SAR-adjacent noise, but is topographically implausible for new construction.**
5. **Hard SAR gating looked like the "more rigorous" choice on paper, but empirically destroyed recall** — a useful negative result that shaped the final v7 architecture, where SAR is supporting evidence rather than a veto.
6. **The final probability-gain reference construction and CORE/Expanded split exist specifically to prevent two things:** validating the detector against a reference built in a way that quietly encodes the same assumptions as the detector (circularity), and reporting an inflated accuracy number by mixing high-confidence and speculative detections into a single layer.

---

## What this means for the threshold table

The three sensitivity profiles (Sensitive / Balanced / Strict) documented in [`gee-script/README.md`](../gee-script/README.md#threshold-reference) are not three arbitrary points on a slider — they're the same v7 architecture evaluated at three coordinated threshold sets, letting precision/recall trade-offs be compared on a like-for-like basis rather than by changing the underlying logic each time. The full sweep and its measured results are in [`results/VALIDATION_RESULTS.md`](../results/VALIDATION_RESULTS.md).
