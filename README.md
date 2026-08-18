# Academic Materials

This branch holds the complete written dissertation and defense presentation. The engineering artifact — the Google Earth Engine script, its technical documentation, and the validation results — lives on the **[`master` branch](../../tree/master)**, which is also where the [project overview README](../../tree/master#readme) is.

> If you're browsing this on GitHub, note that **branches, not folders, separate the two sides of this project on purpose** — the academic write-up and the working tool are meant to be read independently of one another.

---

## Contents

| File | Description |
|---|---|
| 📄 [`Dissertation_Report.pdf`](Dissertation_Report.pdf) | Full dissertation report, 70 pages, Greek. Recommended for viewing — renders directly in the browser. |
| [`Dissertation_Report.docx`](Dissertation_Report.docx) | Original submitted Word source file. |
| 🖥️ [`Defense_Presentation.pdf`](Defense_Presentation.pdf) | 20-slide deck presented to the departmental board on 27 May 2026. |
| [`Defense_Presentation.pptx`](Defense_Presentation.pptx) | Original submitted PowerPoint source file. |
| [`and-coupling-interactive-demo.html`](and-coupling-interactive-demo.html) | Self-contained interactive HTML demo of the 5-criterion AND-coupling logic used in the live presentation (also on `master`, [`docs/and-coupling-demo.html`](../../blob/master/docs/and-coupling-demo.html)) — download and open locally to run it. |

---

## Title, author, and context

**Γεωγραφική Ανάλυση Δεδομένων με τη Χρήση Google Earth Engine για την Ανίχνευση Αστικής Ανάπτυξης στην Αττική**
*("Geospatial Data Analysis Using Google Earth Engine for the Detection of Urban Development in Attica")*

| | |
|---|---|
| **Author** | Nikolaos Christopoulos |
| **Supervisor** | Dimitrios Spentzas |
| **Institution** | University of East London — School of Architecture, Computing and Engineering |
| **Programme** | BSc (Hons) Computer Science |
| **Academic year** | 2025–2026 |
| **Submitted** | 31 May 2026 |
| **Defended** | 27 May 2026, before the departmental board |

While written and assessed as a BSc final-year dissertation, the project's scope — multi-sensor data fusion, an explicit anti-circularity validation design, and a systematic sensitivity/threshold sweep reported against two independent reference products — sits closer to what's typically expected at postgraduate level, which is part of why it's presented here in full rather than summarised away.

---

## Abstract (English)

This dissertation investigates whether Google Earth Engine can support a reproducible, multi-sensor remote-sensing workflow for detecting recent urban development in selected areas of Attica, Greece. The central methodological problem it addresses is a well-known one in Mediterranean remote sensing: distinguishing genuinely new built-up surfaces from spectrally similar land cover — dry bare soil, exposed/disturbed ground, and active construction sites — that a purely optical approach tends to confuse with development.

The analysis compares parameterisable Sentinel-2 time slices between 2017 and 2025, with 2018 and 2024 used as the primary comparison period. Sentinel-2 surface-reflectance imagery is cloud-masked, radiometrically scaled, and composited into seasonal (summer) median images; Sentinel-1 SAR backscatter and SRTM topographic data are fused in to strengthen interpretation beyond what optical bands alone can support. A set of spectral indices — NDVI, NDBI, BSI, and NBR — is computed to characterise vegetation, built-up signal, bare ground, and burned surfaces respectively. Change detection is performed via index differencing and combined with SAR and slope criteria inside a transparent, multi-criterion classification framework, producing thematic outputs for probable new development or construction-stage change, vegetation loss, and bare ground, alongside continuous change surfaces and area statistics.

Accuracy is assessed against independent reference products — primarily Dynamic World and the GHSL Built-up Surface layer — using a confusion matrix, overall accuracy, Cohen's Kappa, and producer's/user's accuracy. The results show that an interpretable Earth Engine workflow can identify plausible zones of recent urban or construction-stage activity in Attica, while also surfacing — rather than hiding — the limitations that come with spectral confusion, reference-product resolution mismatches, and disagreement between benchmark datasets.

*(This is an original English synthesis of the dissertation's own Greek-language abstract, not a mechanical translation. The full argument, literature review, and results are in the [PDF](Dissertation_Report.pdf).)*

---

## Report structure

| Chapter | Title | Covers |
|---|---|---|
| — | Περίληψη (Abstract) | See above |
| 1 | Εισαγωγή (Introduction) | Research context, problem statement, research question and sub-questions, aims and objectives |
| 2 | Βιβλιογραφική Ανασκόπηση (Literature Review) | Urbanisation as a remote-sensing subject, spectral signatures of urban landscapes, Sentinel-2 & Sentinel-1 in the literature, GEE as a research environment, NDVI/NDBI/BSI/NBR in prior work, change-detection approaches, Greek/Attica-specific studies, critical synthesis |
| 3 | Μεθοδολογία (Methodology) | Research design, study-area/AOI definition, satellite collection & temporal selection, preprocessing, seasonal compositing, index computation & band harmonisation, the multi-criterion classification logic, multi-sensor fusion (SAR + SRTM), validation design, the optional Random Forest classifier, UI/export design, alternative methods considered, **methodology calibration across iterations** (§3.13 — reproduced and expanded in [`docs/METHODOLOGY_EVOLUTION.md`](../../blob/master/docs/METHODOLOGY_EVOLUTION.md) on the `master` branch), validity/reproducibility/scalability |
| 4 | Ανάλυση Αποτελεσμάτων (Results Analysis) | Output structure, NDVI/NDBI map analysis, the three-part thematic classification and area statistics, continuous change surfaces, the multi-criterion built-up mask and its full accuracy evaluation, technical challenges encountered, results vs. objectives |
| 5 | Συμπεράσματα και Μελλοντικό Έργο (Conclusions & Future Work) | Conclusions on the research question and objectives, methodological evaluation, **limitations**, recommendations, future work, final appraisal |
| — | Παράρτημα (Appendix) | Supervisor meeting log |

Full tables and figures referenced throughout the report (thresholds per profile, per-AOI results, sensitivity analysis, validation metrics, methodology flowchart, study-area map, before/after composites, ΔNDVI/ΔNDBI maps, TP/FP/FN overlays) are in the PDF itself.

---

## A note on how this branch relates to `master`

Per the dissertation's own findings, results and limitations are also reproduced — in English, and reorganised for a technical audience — on the `master` branch:

- Full validation tables (all sensitivity profiles, all tested AOIs, the Random Forest diagnostic): [`results/VALIDATION_RESULTS.md`](../../blob/master/results/VALIDATION_RESULTS.md)
- The threshold-calibration narrative behind §3.13: [`docs/METHODOLOGY_EVOLUTION.md`](../../blob/master/docs/METHODOLOGY_EVOLUTION.md)
- The annotated script itself and its usage documentation: [`gee-script/`](../../tree/master/gee-script)

This branch is the primary source for anyone who wants the complete academic argument, literature review, and full-length discussion in its original submitted form.

---

## Usage note

This report and presentation are shared here for portfolio and reference purposes. Please don't submit this work, in whole or in part, as your own for academic credit — see [`NOTICE`](NOTICE).
