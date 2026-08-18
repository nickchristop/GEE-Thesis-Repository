/**** ATTICA URBAN DEVELOPMENT CHANGE DETECTION THESIS/DISSERTATION              ****/
/**** Goal: detect urban-development change with dual reference dataset validation.   ****/
/**** Main fixes vs primitive versions:                                 ****/
/**** 1. Dynamic World is NOT used inside the detector when it is used as a validation benchmark. This avoids circular validation.           ****/
/**** 2. Dynamic World reference is based on probability gain, not only after-year built/bare state. ****/
/**** 3. Sentinel-1 SAR is supporting evidence, not a hard mandatory gate.  ****/
/**** 4. Separates the validated core built-up layer from the expanded urban-development candidate layer needing manual validation. ****/
/**** 5. Optional weak training from Dynamic World pseudo-labels.    ****/


// ============================================================
// 1. UI STYLES
// ============================================================

var styleH1 = {
  fontWeight: 'bold',
  fontSize: '18px',
  margin: '6px 6px 4px 6px',
  color: '#1b7f3a'
};

var styleH2 = {
  fontWeight: 'bold',
  fontSize: '13px',
  margin: '8px 6px 4px 6px',
  color: 'black'
};

var styleP = {
  fontSize: '12px',
  margin: '4px 6px'
};

var buttonStyle = {
  stretch: 'horizontal',
  margin: '4px 6px'
};


// ============================================================
// 1A. OPTIONAL DYNAMIC WORLD PSEUDO-TRAINING CONFIG
// ============================================================

var USE_DW_PSEUDO_TRAINING_DEFAULT = false;
var DW_PSEUDO_POINTS_PER_CLASS = 1200;
var DW_PSEUDO_PROBABILITY_THRESHOLD_DEFAULT = 0.80;


// ============================================================
// 2. DEFAULT AOI - ELLINIKON / GLYFADA / ARGYROUPOLI
// ============================================================

var DEFAULT_AOI = ee.Geometry.Polygon([[
  [23.680, 37.835],
  [23.805, 37.835],
  [23.805, 37.935],
  [23.680, 37.935]
]]);


// ============================================================
// 3. DRAWING TOOLS SETUP
// ============================================================

var userHasDrawn = false;

var drawingTools = Map.drawingTools();
drawingTools.setShown(false);

while (drawingTools.layers().length() > 0) {
  drawingTools.layers().remove(drawingTools.layers().get(0));
}

var geometryLayer = ui.Map.GeometryLayer({
  geometries: null,
  name: 'AOI',
  color: '#eeeeee'
});

drawingTools.layers().add(geometryLayer);


// ============================================================
// 4. UI INPUTS
// ============================================================

var yearBefore = ui.Select({
  items: ['2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'],
  value: '2018',
  style: {stretch: 'horizontal', margin: '4px 6px'}
});

var yearAfter = ui.Select({
  items: ['2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'],
  value: '2024',
  style: {stretch: 'horizontal', margin: '4px 6px'}
});

var sensitivitySelect = ui.Select({
  items: ['Sensitive', 'Balanced', 'Strict'],
  value: 'Balanced',
  style: {stretch: 'horizontal', margin: '4px 6px'}
});

var referenceSelect = ui.Select({
  items: [
    'Dynamic World development reference',
    'GHSL built-up reference',
    'Both'
  ],
  value: 'Dynamic World development reference',
  style: {stretch: 'horizontal', margin: '4px 6px'}
});

var useSARCheckbox = ui.Checkbox({
  label: 'Use Sentinel-1 SAR as support',
  value: true,
  style: {margin: '6px'}
});

var useSlopeCheckbox = ui.Checkbox({
  label: 'Use slope filter',
  value: true,
  style: {margin: '6px'}
});

var useDWPseudoTrainingCheckbox = ui.Checkbox({
  label: 'Train RF from Dynamic World pseudo-labels',
  value: USE_DW_PSEUDO_TRAINING_DEFAULT,
  style: {margin: '6px'}
});

var dwPseudoThresholdSlider = ui.Slider({
  min: 0.50,
  max: 0.95,
  value: DW_PSEUDO_PROBABILITY_THRESHOLD_DEFAULT,
  step: 0.05,
  style: {stretch: 'horizontal', margin: '4px 6px'}
});

var validateCheckbox = ui.Checkbox({
  label: 'Run validation',
  value: true,
  style: {margin: '6px'}
});

var showDebugCheckbox = ui.Checkbox({
  label: 'Show TP / FP / FN debug layers',
  value: true,
  style: {margin: '6px'}
});

var resultPanel = ui.Panel({
  style: {
    margin: '8px 6px',
    padding: '6px',
    border: '1px solid #cccccc'
  }
});

var infoLabel = ui.Label({
  value: 'Draw an AOI or use the default Ellinikon/Glyfada area. Recommended AOI: Polygon or Rectangle of at least 500 m x 500 m.',
  style: {fontSize: '11px', margin: '6px', color: '#555'}
});

// ============================================================
// LEGEND PANEL (replaces legendLabel)
// ============================================================

function makeLegendRow(hexColor, description) {
  var colorBox = ui.Label({
    style: {
      backgroundColor: hexColor,
      padding: '8px',
      margin: '0 6px 2px 0',
      border: '1px solid #aaaaaa'
    }
  });

  var desc = ui.Label({
    value: description,
    style: {
      fontSize: '11px',
      margin: '0',
      color: '#333'
    }
  });

  return ui.Panel({
    widgets: [colorBox, desc],
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {margin: '2px 0'}
  });
}

var legendPanel = ui.Panel({
  widgets: [
    ui.Label({
      value: 'Legend',
      style: {fontWeight: 'bold', fontSize: '11px', margin: '6px 6px 4px 6px', color: '#333'}
    }),
    makeLegendRow('#ff00ff', 'Validated core built-up development'),
    makeLegendRow('#ff0000', 'New built-up'),
    makeLegendRow('#ff9800', 'Construction candidate'),
    makeLegendRow('#ffd180', 'Broad diagnostic construction'),
    makeLegendRow('#0000ff', 'Missed reference (FN)')
  ],
  style: {margin: '4px 6px', border: '1px solid #dddddd', padding: '4px'}
});


var aoiDisplayLayerName = 'AOI outline';


// ============================================================
// 5. AOI FUNCTIONS
// ============================================================

function getAOI() {
  if (!userHasDrawn) return DEFAULT_AOI;

  try {
    var dtLayers = drawingTools.layers();
    if (dtLayers.length() === 0) return DEFAULT_AOI;

    var layer = dtLayers.get(0);
    if (!layer) return DEFAULT_AOI;

    var obj = layer.getEeObject();
    if (!obj) return DEFAULT_AOI;

    return ee.Geometry(obj).dissolve({maxError: 1});

  } catch (e) {
    return DEFAULT_AOI;
  }
}

function removeAOIDisplayLayer() {
  var layers = Map.layers();
  for (var i = layers.length() - 1; i >= 0; i--) {
    var layer = layers.get(i);
    if (layer.getName() === aoiDisplayLayerName) {
      layers.remove(layer);
    }
  }
}

function addAOIOutline(aoi) {
  removeAOIDisplayLayer();

  var outline = ee.Image().byte().paint({
    featureCollection: ee.FeatureCollection([ee.Feature(aoi)]),
    color: 1,
    width: 2
  });

  Map.addLayer(outline, {
    palette: ['00ffff'],
    opacity: 0.85
  }, aoiDisplayLayerName, true);
}

function showSelectedAOI() {
  var aoi = getAOI();
  addAOIOutline(aoi);
  drawingTools.setShape(null);

  resultPanel.clear();
  resultPanel.add(ui.Label({
    value: 'AOI selected. Choose years and run analysis.',
    style: {color: '#1b7f3a', fontSize: '11px', fontWeight: 'bold'}
  }));
}

function onGeometryDrawn() {
  userHasDrawn = true;
  showSelectedAOI();
}

function clearGeometry() {
  userHasDrawn = false;
  var dtLayers = drawingTools.layers();

  // Remove all existing drawing layers
  while (dtLayers.length() > 0) {
    dtLayers.remove(dtLayers.get(0));
  }

  // Re-add a fresh empty layer
  dtLayers.add(ui.Map.GeometryLayer({
    geometries: null,
    name: 'AOI',
    color: '#eeeeee'
  }));

  drawingTools.setShape(null);
  removeAOIDisplayLayer();

  resultPanel.clear();
  resultPanel.add(ui.Label({
    value: 'AOI cleared. The default Ellinikon/Glyfada AOI will be used unless you draw a new one.',
    style: {color: '#555', fontSize: '11px'}
  }));
}


function drawRectangle() {
  drawingTools.setShape('rectangle');
  drawingTools.draw();
}

function drawPolygon() {
  drawingTools.setShape('polygon');
  drawingTools.draw();
}


// ============================================================
// 6. SENTINEL-2 PROCESSING
// ============================================================

function maskS2clouds(image) {
  var scl = image.select('SCL');

  var mask = scl.neq(3)    // cloud shadow
    .and(scl.neq(8))       // cloud medium probability
    .and(scl.neq(9))       // cloud high probability
    .and(scl.neq(10))      // cirrus
    .and(scl.neq(11));     // snow/ice

  return image.updateMask(mask)
    .copyProperties(image, ['system:time_start', 'CLOUDY_PIXEL_PERCENTAGE']);
}

function addIndices(image) {
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  var ndbi = image.normalizedDifference(['B11', 'B8']).rename('NDBI');
  var nbr = image.normalizedDifference(['B8', 'B12']).rename('NBR');
  var mndwi = image.normalizedDifference(['B3', 'B11']).rename('MNDWI');

  var bsi = image.expression(
    '((SWIR1 + RED) - (NIR + BLUE)) / ((SWIR1 + RED) + (NIR + BLUE))',
    {
      SWIR1: image.select('B11'),
      RED: image.select('B4'),
      NIR: image.select('B8'),
      BLUE: image.select('B2')
    }
  ).rename('BSI');

  return image.addBands([ndvi, ndbi, nbr, mndwi, bsi]);
}

function getS2Collection(year, aoi, cloudLimit) {
  var y = ee.Number.parse(year);
  var start = ee.Date.fromYMD(y, 4, 1);
  var end = ee.Date.fromYMD(y, 11, 1);

  return ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(aoi)
    .filterDate(start, end)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', cloudLimit))
    .select(['B2', 'B3', 'B4', 'B8', 'B11', 'B12', 'SCL'])
    .sort('CLOUDY_PIXEL_PERCENTAGE')
    .limit(25)
    .map(function(image) {
      return image.clip(aoi);
    })
    .map(maskS2clouds)
    .map(addIndices);
}

function getS2Composite(year, aoi) {
  var primary = getS2Collection(year, aoi, 60);
  var fallback = getS2Collection(year, aoi, 90);

  print('Sentinel-2 primary images for ' + year + ':', primary.size());
  print('Sentinel-2 fallback images for ' + year + ':', fallback.size());

  var empty = ee.Image.constant([
    600, 700, 700, 1800, 1200, 1000,
    0.3, -0.1, 0.4, -0.2, -0.1
  ]).rename([
    'B2', 'B3', 'B4', 'B8', 'B11', 'B12',
    'NDVI', 'NDBI', 'NBR', 'MNDWI', 'BSI'
  ]).clip(aoi);

  var composite = ee.Image(ee.Algorithms.If(
    primary.size().gt(0),
    primary.median().clip(aoi),
    ee.Image(ee.Algorithms.If(
      fallback.size().gt(0),
      fallback.median().clip(aoi),
      empty
    ))
  ));

  return composite
    .select([
      'B2', 'B3', 'B4', 'B8', 'B11', 'B12',
      'NDVI', 'NDBI', 'NBR', 'MNDWI', 'BSI'
    ])
    .clip(aoi);
}


// ============================================================
// 7. SENTINEL-1 SAR PROCESSING
// ============================================================

function getS1Collection(year, aoi) {
  var y = ee.Number.parse(year);
  var start = ee.Date.fromYMD(y, 4, 1);
  var end = ee.Date.fromYMD(y, 11, 1);

  return ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterBounds(aoi)
    .filterDate(start, end)
    .filter(ee.Filter.eq('instrumentMode', 'IW'))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
    .select(['VV', 'VH']);
}

function getS1Composite(year, aoi) {
  var s1 = getS1Collection(year, aoi);

  print('Sentinel-1 images for ' + year + ':', s1.size());

  var fallback = ee.Image.constant([-15, -22])
    .rename(['VV', 'VH'])
    .clip(aoi);

  var median = ee.Image(ee.Algorithms.If(
    s1.size().gt(0),
    s1.median().clip(aoi),
    fallback
  ));

  return median
    .select(['VV', 'VH'])
    .unmask(fallback)
    .clip(aoi);
}


// ============================================================
// 8. SLOPE
// ============================================================

function getSlope(aoi) {
  return ee.Terrain.slope(ee.Image('USGS/SRTMGL1_003')).clip(aoi);
}


// ============================================================
// 9. THRESHOLDS
// ============================================================

function getThresholds(mode) {
  if (mode === 'Strict') {
    return {
      newBuiltDNDBI: 0.080,
      newBuiltDBSI: 0.065,
      maxBuiltNDVI: 0.40,
      minBuiltNDBI: -0.04,
      newBuiltDVV: 2.50,
      newBuiltDVH: 1.20,
      maxBuiltSlope: 20,

      constructionDBSI: 0.075,
      constructionNDVILoss: 0.100,

      vegLossDNDVI: 0.18,
      beforeVegNDVI: 0.35,

      minPatchPixels: 5
    };
  }

  if (mode === 'Balanced') {
    return {
      newBuiltDNDBI: 0.050,
      newBuiltDBSI: 0.040,
      maxBuiltNDVI: 0.46,
      minBuiltNDBI: -0.08,
      newBuiltDVV: 1.50,
      newBuiltDVH: 0.80,
      maxBuiltSlope: 20,

      constructionDBSI: 0.070,
      constructionNDVILoss: 0.090,

      vegLossDNDVI: 0.10,
      beforeVegNDVI: 0.28,

      minPatchPixels: 4
    };
  }

  return {
    newBuiltDNDBI: 0.032,
    newBuiltDBSI: 0.026,
    maxBuiltNDVI: 0.52,
    minBuiltNDBI: -0.12,
    newBuiltDVV: 0.80,
    newBuiltDVH: 0.40,
    maxBuiltSlope: 30,

    constructionDBSI: 0.050,
    constructionNDVILoss: 0.070,

    vegLossDNDVI: 0.06,
    beforeVegNDVI: 0.18,

    minPatchPixels: 2
  };
}


// ============================================================
// 10. MASK CLEANING
// ============================================================

function cleanMask(mask, minPatchPixels) {
  var binary = mask.unmask(0).gt(0);
  var connected = binary.selfMask().connectedPixelCount(50, true);
  return binary.updateMask(connected.gte(minPatchPixels)).selfMask();
}


// ============================================================
// 11. DYNAMIC WORLD REFERENCE
// ============================================================

function getDynamicWorldCollection(year, aoi) {
  var y = ee.Number.parse(year);
  var start = ee.Date.fromYMD(y, 1, 1);
  var end = ee.Date.fromYMD(y.add(1), 1, 1);

  return ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
    .filterBounds(aoi)
    .filterDate(start, end);
}

function getDWBands(year, aoi) {
  var dw = getDynamicWorldCollection(year, aoi);

  print('Dynamic World images for ' + year + ':', dw.size());

  var builtFallback = ee.Image.constant(0).rename('built').clip(aoi);
  var bareFallback = ee.Image.constant(0).rename('bare').clip(aoi);
  var labelFallback = ee.Image.constant(0).rename('label').clip(aoi);

  var built = ee.Image(ee.Algorithms.If(
    dw.size().gt(0),
    dw.select('built').median().rename('built').clip(aoi),
    builtFallback
  ));

  var bare = ee.Image(ee.Algorithms.If(
    dw.size().gt(0),
    dw.select('bare').median().rename('bare').clip(aoi),
    bareFallback
  ));

  var label = ee.Image(ee.Algorithms.If(
    dw.size().gt(0),
    dw.select('label').mode().rename('label').clip(aoi),
    labelFallback
  ));

  return {
    built: built.unmask(0).clip(aoi),
    bare: bare.unmask(0).clip(aoi),
    label: label.unmask(0).clip(aoi),
    count: dw.size()
  };
}

function buildDWDevelopmentReference(beforeYear, afterYear, aoi) {
  var beforeDW = getDWBands(beforeYear, aoi);
  var afterDW = getDWBands(afterYear, aoi);

  var dBuilt = afterDW.built.subtract(beforeDW.built).rename('dDW_built');
  var dBare = afterDW.bare.subtract(beforeDW.bare).rename('dDW_bare');

  var beforeBuilt = beforeDW.built.gt(0.35)
    .or(beforeDW.label.eq(6));

  var afterBuilt = afterDW.built.gt(0.35)
    .or(afterDW.label.eq(6));

  // Thesis-safe reference:
  // use actual probability gain so stable bare/open land is not counted as change.
  var builtGain = afterBuilt
    .and(dBuilt.gt(0.12))
    .and(beforeDW.built.lt(0.30));

  var constructionGain = afterDW.bare.gt(0.35)
    .and(dBare.gt(0.20))
    .and(beforeDW.bare.lt(0.25))
    .and(afterDW.built.gt(0.05).or(afterDW.label.eq(7)))
    .and(beforeBuilt.not());

  var truthRaw = builtGain
    .or(constructionGain)
    .and(beforeBuilt.not())
    .rename('truth');

  var connected = truthRaw.selfMask().connectedPixelCount(50, true);
  var truth = truthRaw
    .updateMask(connected.gte(3))
    .unmask(0)
    .toInt()
    .clip(aoi);

  return {
    truth: truth,
    beforeBuilt: beforeBuilt,
    afterBuilt: afterBuilt,
    builtGain: builtGain,
    constructionGain: constructionGain,
    dBuilt: dBuilt,
    dBare: dBare,
    label: 'Dynamic World probability-gain development reference',
    nativeScale: 10
  };
}


// ============================================================
// 12. GHSL REFERENCE
// ============================================================

// Use observed GHSL epochs only. The 2025 and 2030 layers are not suitable
// as independent observed validation for a 2018-2024 thesis result.
var GHSL_OBSERVED_EPOCHS = [
  1975, 1980, 1985, 1990, 1995, 2000,
  2005, 2010, 2015, 2020
];

var GHSL_BUILT_THRESH_M2 = 300;

function previousOrEqualGHSLEpoch(yearStr) {
  var y = parseInt(yearStr, 10);
  var chosen = GHSL_OBSERVED_EPOCHS[0];

  for (var i = 0; i < GHSL_OBSERVED_EPOCHS.length; i++) {
    if (GHSL_OBSERVED_EPOCHS[i] <= y) {
      chosen = GHSL_OBSERVED_EPOCHS[i];
    }
  }

  return chosen;
}

function getGHSLBuilt(epoch, aoi) {
  var col = ee.ImageCollection('JRC/GHSL/P2023A/GHS_BUILT_S')
    .filter(ee.Filter.eq('year', epoch));

  var img = ee.Image(ee.Algorithms.If(
    col.size().gt(0),
    col.first().select('built_surface'),
    ee.Image.constant(0).rename('built_surface')
  ));

  return img.clip(aoi).unmask(0);
}

function buildGHSLReference(beforeYear, afterYear, aoi) {
  var ePre = previousOrEqualGHSLEpoch(beforeYear);
  var ePost = previousOrEqualGHSLEpoch(afterYear);

  var preBS = getGHSLBuilt(ePre, aoi);
  var postBS = getGHSLBuilt(ePost, aoi);

  var wasBuilt = preBS.gte(GHSL_BUILT_THRESH_M2);
  var isBuilt = postBS.gte(GHSL_BUILT_THRESH_M2);

  var truth = isBuilt
    .and(wasBuilt.not())
    .rename('truth')
    .toInt()
    .clip(aoi);

  return {
    truth: truth,
    preEpoch: ePre,
    postEpoch: ePost,
    label: 'GHSL observed built-up reference ' + ePre + ' to ' + ePost,
    nativeScale: 100,
    epochsIdentical: ePre === ePost
  };
}


// ============================================================
// 13. SAFE FORMATTERS
// ============================================================

function isFiniteNum(x) {
  return typeof x === 'number' && !isNaN(x) && isFinite(x);
}

function fmtPct(x) {
  return isFiniteNum(x) ? (x * 100).toFixed(1) + '%' : 'N/A';
}

function fmtFloat(x, digits) {
  return isFiniteNum(x) ? x.toFixed(digits) : 'N/A';
}


// ============================================================
// 14. VALIDATION DISPLAY
// ============================================================

function appendAccuracyBlock(headerText, headerColor, result) {
  var oa = result.oa;
  var kappa = result.kappa;
  var producers = result.producers || [];
  var users = result.users || [];

  var recallPositive = producers.length > 1 ? producers[1] : null;
  var precisionPositive = users.length > 1 ? users[1] : null;

  var f1 = null;
  if (
    isFiniteNum(recallPositive) &&
    isFiniteNum(precisionPositive) &&
    (recallPositive + precisionPositive) > 0
  ) {
    f1 = (2 * recallPositive * precisionPositive) /
      (recallPositive + precisionPositive);
  }

  resultPanel.add(ui.Label({
    value: headerText,
    style: {
      fontWeight: 'bold',
      fontSize: '12px',
      margin: '6px 0 4px 0',
      color: headerColor
    }
  }));

  resultPanel.add(ui.Label({
    value: 'Balanced-sample accuracy: ' + fmtPct(oa),
    style: {
      fontWeight: 'bold',
      color: isFiniteNum(oa) && oa >= 0.75 ? '#1b7f3a' : '#cc6600'
    }
  }));

  resultPanel.add(ui.Label({
    value: 'Kappa: ' + fmtFloat(kappa, 3),
    style: {fontWeight: 'bold'}
  }));

  resultPanel.add(ui.Label({
    value: 'Recall for urban development: ' + fmtPct(recallPositive),
    style: {fontSize: '12px'}
  }));

  resultPanel.add(ui.Label({
    value: 'Precision for urban development: ' + fmtPct(precisionPositive),
    style: {fontSize: '12px'}
  }));

  resultPanel.add(ui.Label({
    value: 'F1 for urban development: ' + fmtFloat(f1, 3),
    style: {
      fontSize: '12px',
      fontWeight: 'bold',
      color: isFiniteNum(f1) && f1 >= 0.60 ? '#1b7f3a' : '#cc6600'
    }
  }));

  resultPanel.add(ui.Label({
    value: 'Validation sample: ' +
      (result.sampleSize != null ? result.sampleSize : '?') +
      ' points | positive=' +
      (result.actualPos != null ? result.actualPos : '?') +
      ' | negative=' +
      (result.actualNeg != null ? result.actualNeg : '?'),
    style: {fontSize: '11px', color: '#555'}
  }));

  resultPanel.add(ui.Label({
    value: 'Matrix order: rows = reference truth, columns = prediction. Report F1, recall and precision for the positive class.',
    style: {fontSize: '10px', color: '#777'}
  }));
}


// ============================================================
// 15. VALIDATION CORE
// ============================================================

var VAL_MAX_PER_CLASS = 300;

function validateAgainstReference(detection, refObj, aoi, headerText, headerColor) {
  if (refObj.epochsIdentical) {
    resultPanel.add(ui.Label({
      value: 'Validation skipped: GHSL observed epochs are identical for these years.',
      style: {color: '#cc6600', fontSize: '11px', margin: '6px 0'}
    }));
    return;
  }

  var truth = refObj.truth.rename('truth').toInt().unmask(0);
  var prediction = detection.unmask(0).toInt().rename('prediction');

  var stack = truth.addBands(prediction);
  var scale = refObj.nativeScale;

  Map.addLayer(
    truth.selfMask(),
    {palette: ['00ffff'], opacity: 0.70},
    refObj.label + ' truth',
    false
  );

  if (showDebugCheckbox.getValue()) {
    var tpLayer = prediction.eq(1).and(truth.eq(1)).selfMask();
    var fpLayer = prediction.eq(1).and(truth.eq(0)).selfMask();
    var fnLayer = prediction.eq(0).and(truth.eq(1)).selfMask();

    Map.addLayer(tpLayer, {palette: ['00ff00'], opacity: 0.95}, headerText + ' - TP', false);
    Map.addLayer(fpLayer, {palette: ['ff00ff'], opacity: 0.95}, headerText + ' - FP', false);
    Map.addLayer(fnLayer, {palette: ['0000ff'], opacity: 0.95}, headerText + ' - FN', false);
  }

  var truthHist = truth.reduceRegion({
    reducer: ee.Reducer.frequencyHistogram(),
    geometry: aoi,
    scale: scale,
    maxPixels: 1e9,
    bestEffort: true,
    tileScale: 4
  }).get('truth');

  var predictionHist = prediction.reduceRegion({
    reducer: ee.Reducer.frequencyHistogram(),
    geometry: aoi,
    scale: scale,
    maxPixels: 1e9,
    bestEffort: true,
    tileScale: 4
  }).get('prediction');

  var validationPixelArea = ee.Image.pixelArea().rename('area');

  var refAreaM2 = validationPixelArea.updateMask(truth.eq(1)).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: aoi,
    scale: scale,
    maxPixels: 1e9,
    bestEffort: true,
    tileScale: 4
  }).get('area');

  var predAreaM2 = validationPixelArea.updateMask(prediction.eq(1)).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: aoi,
    scale: scale,
    maxPixels: 1e9,
    bestEffort: true,
    tileScale: 4
  }).get('area');

  var countBundle = ee.Dictionary({
    truthHist: truthHist,
    predictionHist: predictionHist,
    refAreaM2: ee.Number(ee.Algorithms.If(refAreaM2, refAreaM2, 0)),
    predAreaM2: ee.Number(ee.Algorithms.If(predAreaM2, predAreaM2, 0))
  });

  countBundle.evaluate(function(countResult, histErr) {
    resultPanel.add(ui.Label({
      value: headerText,
      style: {
        fontWeight: 'bold',
        fontSize: '13px',
        margin: '10px 0 4px 0',
        color: headerColor
      }
    }));

    if (histErr) {
      resultPanel.add(ui.Label({
        value: 'Reference class-count failed: ' + histErr,
        style: {color: 'red', fontSize: '11px'}
      }));
      print('Histogram error:', histErr);
      return;
    }

    var histResult = countResult ? countResult.truthHist : null;
    var predictionHistResult = countResult ? countResult.predictionHist : null;
    var nNeg = Math.floor((histResult && histResult['0']) || 0);
    var nPos = Math.floor((histResult && histResult['1']) || 0);
    var nPredPos = Math.floor((predictionHistResult && predictionHistResult['1']) || 0);
    var refAreaKm2 = ((countResult && countResult.refAreaM2) || 0) / 1000000;
    var predAreaKm2 = ((countResult && countResult.predAreaM2) || 0) / 1000000;
    var areaRatio = refAreaKm2 > 0 ? predAreaKm2 / refAreaKm2 : null;

    resultPanel.add(ui.Label({
      value: refObj.label + ' | scale=' + scale + ' m | positive pixels=' +
        nPos + ' | unchanged pixels=' + nNeg +
        ' | reference area=' + refAreaKm2.toFixed(4) + ' km2',
      style: {fontSize: '11px', color: '#555'}
    }));

    resultPanel.add(ui.Label({
      value: 'Prediction positive pixels=' + nPredPos +
        ' | prediction area=' + predAreaKm2.toFixed(4) +
        ' km2 | prediction/reference area ratio: ' +
        (areaRatio !== null ? areaRatio.toFixed(2) : 'N/A'),
      style: {
        fontSize: '11px',
        color: areaRatio !== null && (areaRatio < 0.50 || areaRatio > 2.00) ? '#cc6600' : '#555'
      }
    }));

    if (nPos === 0) {
      resultPanel.add(ui.Label({
        value: 'Cannot compute positive-class accuracy: reference shows no urban-development change inside AOI. Try a known-change AOI or a wider area.',
        style: {color: '#cc6600', fontSize: '11px', margin: '4px 0'}
      }));
      return;
    }

    if (nNeg === 0) {
      resultPanel.add(ui.Label({
        value: 'Cannot compute balanced validation: AOI has no unchanged pixels in reference. Use a wider AOI.',
        style: {color: '#cc6600', fontSize: '11px', margin: '4px 0'}
      }));
      return;
    }

    var posTarget = Math.min(VAL_MAX_PER_CLASS, nPos);
    var negTarget = Math.min(VAL_MAX_PER_CLASS, nNeg);

    var samples = stack.stratifiedSample({
      numPoints: posTarget,
      classBand: 'truth',
      region: aoi,
      scale: scale,
      seed: 42,
      classValues: [0, 1],
      classPoints: [negTarget, posTarget],
      tileScale: 4,
      geometries: false
    });

    var matrix = samples.errorMatrix('truth', 'prediction');

    print('---');
    print(headerText);
    print('Confusion matrix [rows=truth, cols=prediction]:', matrix);

    var bundle = ee.Dictionary({
      oa: matrix.accuracy(),
      kappa: matrix.kappa(),
      producers: matrix.producersAccuracy().toList().flatten(),
      users: matrix.consumersAccuracy().toList().flatten(),
      sampleSize: samples.size(),
      actualPos: samples.filter(ee.Filter.eq('truth', 1)).size(),
      actualNeg: samples.filter(ee.Filter.eq('truth', 0)).size()
    });

    bundle.evaluate(function(result, err) {
      if (err || !result) {
        resultPanel.add(ui.Label({
          value: 'Stats failed: ' + (err || 'no result returned'),
          style: {color: 'red', fontSize: '11px'}
        }));
        return;
      }

      appendAccuracyBlock('Accuracy metrics', headerColor, result);
    });
  });
}


// ============================================================
// 16. OPTIONAL DYNAMIC WORLD PSEUDO-TRAINED CLASSIFICATION
// ============================================================

function buildPredictorStack(before, after, dNDVILoss, dNDBI, dNBR, dBSI,
                             dMNDWI, dVV, dVH, slope, aoi) {
  var beforePredictors = before.select(
    ['B2', 'B3', 'B4', 'B8', 'B11', 'B12', 'NDVI', 'NDBI', 'NBR', 'MNDWI', 'BSI'],
    [
      'before_B2', 'before_B3', 'before_B4', 'before_B8', 'before_B11', 'before_B12',
      'before_NDVI', 'before_NDBI', 'before_NBR', 'before_MNDWI', 'before_BSI'
    ]
  );

  var afterPredictors = after.select(
    ['B2', 'B3', 'B4', 'B8', 'B11', 'B12', 'NDVI', 'NDBI', 'NBR', 'MNDWI', 'BSI'],
    [
      'after_B2', 'after_B3', 'after_B4', 'after_B8', 'after_B11', 'after_B12',
      'after_NDVI', 'after_NDBI', 'after_NBR', 'after_MNDWI', 'after_BSI'
    ]
  );

  return ee.Image.cat([
    beforePredictors,
    afterPredictors,
    dNDVILoss,
    dNDBI,
    dNBR,
    dBSI,
    dMNDWI,
    dVV,
    dVH,
    slope.rename('slope')
  ]).toFloat().clip(aoi);
}

function appendDWPseudoThresholdSweep(positiveProbability, refObj, aoi) {
  var truth = refObj.truth.rename('truth').unmask(0).toInt().clip(aoi);
  var probability = positiveProbability.rename('probability').clip(aoi);
  var pixelArea = ee.Image.pixelArea().rename('area');

  var refAreaM2 = pixelArea.updateMask(truth.eq(1)).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: aoi,
    scale: 10,
    maxPixels: 1e9,
    bestEffort: true,
    tileScale: 4
  }).get('area');

  var evalSamples = truth.addBands(probability).stratifiedSample({
    numPoints: 300,
    classBand: 'truth',
    region: aoi,
    scale: 10,
    classValues: [0, 1],
    classPoints: [300, 300],
    seed: 128,
    tileScale: 4,
    geometries: false
  });

  var thresholds = ee.List([0.70, 0.75, 0.80, 0.85, 0.90, 0.95]);

  var rows = ee.FeatureCollection(thresholds.map(function(threshold) {
    threshold = ee.Number(threshold);

    var thresholdSamples = evalSamples.map(function(feature) {
      var prob = ee.Number(feature.get('probability'));
      var pred = ee.Number(ee.Algorithms.If(prob.gte(threshold), 1, 0));
      return feature.set('prediction', pred);
    });

    var matrix = thresholdSamples.errorMatrix('truth', 'prediction', [0, 1]);
    var producers = matrix.producersAccuracy().toList().flatten();
    var users = matrix.consumersAccuracy().toList().flatten();
    var recall = ee.Number(producers.get(1));
    var precision = ee.Number(users.get(1));
    var f1 = ee.Number(ee.Algorithms.If(
      recall.add(precision).gt(0),
      recall.multiply(precision).multiply(2).divide(recall.add(precision)),
      0
    ));

    var predMask = probability.gte(threshold);
    var predAreaM2 = pixelArea.updateMask(predMask).reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: aoi,
      scale: 10,
      maxPixels: 1e9,
      bestEffort: true,
      tileScale: 4
    }).get('area');

    var safeRefAreaM2 = ee.Number(ee.Algorithms.If(refAreaM2, refAreaM2, 0));
    var safePredAreaM2 = ee.Number(ee.Algorithms.If(predAreaM2, predAreaM2, 0));
    var areaRatio = ee.Number(ee.Algorithms.If(
      safeRefAreaM2.gt(0),
      safePredAreaM2.divide(safeRefAreaM2),
      0
    ));

    return ee.Feature(null, {
      threshold: threshold,
      balancedAccuracy: matrix.accuracy(),
      kappa: matrix.kappa(),
      recall: recall,
      precision: precision,
      f1: f1,
      refAreaKm2: safeRefAreaM2.divide(1000000),
      predAreaKm2: safePredAreaM2.divide(1000000),
      areaRatio: areaRatio
    });
  }));

  rows.evaluate(function(result, err) {
    if (err || !result || !result.features) {
      resultPanel.add(ui.Label({
        value: 'DW pseudo-RF threshold sweep failed: ' + (err || 'no result returned'),
        style: {fontSize: '11px', color: 'red', margin: '8px 0 0 0'}
      }));
      return;
    }

    resultPanel.add(ui.Label({
      value: 'DW pseudo-RF probability threshold sweep',
      style: {
        fontWeight: 'bold',
        fontSize: '13px',
        margin: '10px 0 4px 0',
        color: '#00838f'
      }
    }));

    result.features.forEach(function(feature) {
      var p = feature.properties || {};
      resultPanel.add(ui.Label({
        value: 'p>=' + fmtFloat(p.threshold, 2) +
          ' | F1=' + fmtFloat(p.f1, 3) +
          ' | recall=' + fmtPct(p.recall) +
          ' | precision=' + fmtPct(p.precision) +
          ' | area ratio=' + fmtFloat(p.areaRatio, 2) +
          ' | pred=' + fmtFloat(p.predAreaKm2, 3) + ' km2',
        style: {
          fontSize: '10px',
          color: p.areaRatio >= 0.75 && p.areaRatio <= 2.00 ? '#00695c' : '#cc6600'
        }
      }));
    });

    resultPanel.add(ui.Label({
      value: 'Choose the threshold with acceptable area ratio and F1. This is still agreement with Dynamic World pseudo-labels, not independent ground truth.',
      style: {fontSize: '10px', color: '#777'}
    }));
  });
}

function runDynamicWorldPseudoTraining(predictorStack, refObj, aoi, probabilityThreshold) {
  var classBand = 'dw_pseudo_class';
  var inputBands = predictorStack.bandNames();
  var pseudoLabels = refObj.truth
    .rename(classBand)
    .unmask(0)
    .toInt()
    .clip(aoi);

  var trainingImage = predictorStack.addBands(pseudoLabels);

  var samples = trainingImage.stratifiedSample({
    numPoints: DW_PSEUDO_POINTS_PER_CLASS,
    classBand: classBand,
    region: aoi,
    scale: 10,
    classValues: [0, 1],
    classPoints: [DW_PSEUDO_POINTS_PER_CLASS, DW_PSEUDO_POINTS_PER_CLASS],
    seed: 84,
    tileScale: 4,
    geometries: false
  }).randomColumn('split', 42);

  var trainSet = samples.filter(ee.Filter.lt('split', 0.70));
  var testSet = samples.filter(ee.Filter.gte('split', 0.70));

  var rfParams = {
    numberOfTrees: 250,
    minLeafPopulation: 2,
    bagFraction: 0.70,
    seed: 84
  };

  var classifier = ee.Classifier.smileRandomForest(rfParams).train({
    features: trainSet,
    classProperty: classBand,
    inputProperties: inputBands
  });

  var classified = predictorStack.classify(classifier).rename('dw_pseudo_rf_class');

  var probabilityClassifier = ee.Classifier
    .smileRandomForest(rfParams)
    .setOutputMode('MULTIPROBABILITY')
    .train({
      features: trainSet,
      classProperty: classBand,
      inputProperties: inputBands
    });

  var probabilityArray = predictorStack.classify(probabilityClassifier);
  var positiveProbability = probabilityArray
    .arrayGet([1])
    .rename('dw_pseudo_rf_development_probability');

  var pseudoRfDevelopment = positiveProbability.gte(probabilityThreshold)
    .selfMask()
    .rename('dw_pseudo_rf_development_p' + Math.round(probabilityThreshold * 100));

  Map.addLayer(positiveProbability, {
    min: 0,
    max: 1,
    palette: ['263238', 'fdd835', 'ff6d00', 'd50000']
  }, 'DW pseudo-trained RF development probability', false);

  Map.addLayer(pseudoRfDevelopment, {
    palette: ['00e5ff'],
    opacity: 0.90
  }, 'DW pseudo-trained RF development mask p>=' + probabilityThreshold.toFixed(2), true);

  appendDWPseudoThresholdSweep(positiveProbability, refObj, aoi);

  var testClassified = testSet.classify(classifier);
  var matrix = testClassified.errorMatrix(classBand, 'classification');

  print('---');
  print('Dynamic World pseudo-trained Random Forest holdout');
  print('Important: this is agreement with Dynamic World pseudo-labels, not independent ground truth.');
  print('Confusion matrix [rows=DW pseudo-label, cols=RF prediction]:', matrix);
  print('Variable importance:', classifier.explain().get('importance'));

  var rfStats = ee.Dictionary({
    totalSamples: samples.size(),
    trainingSamples: trainSet.size(),
    testSamples: testSet.size(),
    holdoutAccuracy: matrix.accuracy(),
    holdoutKappa: matrix.kappa(),
    producers: matrix.producersAccuracy().toList().flatten(),
    users: matrix.consumersAccuracy().toList().flatten()
  });

  rfStats.evaluate(function(result, err) {
    if (err || !result) {
      resultPanel.add(ui.Label({
        value: 'DW pseudo-trained RF stats failed: ' + (err || 'no result returned'),
        style: {fontSize: '11px', color: 'red', margin: '8px 0 0 0'}
      }));
      return;
    }

    var producers = result.producers || [];
    var users = result.users || [];
    var recallPositive = producers.length > 1 ? producers[1] : null;
    var precisionPositive = users.length > 1 ? users[1] : null;
    var f1 = null;

    if (
      isFiniteNum(recallPositive) &&
      isFiniteNum(precisionPositive) &&
      (recallPositive + precisionPositive) > 0
    ) {
      f1 = (2 * recallPositive * precisionPositive) /
        (recallPositive + precisionPositive);
    }

    resultPanel.add(ui.Label({
      value: 'Dynamic World pseudo-trained Random Forest',
      style: {
        fontWeight: 'bold',
        fontSize: '13px',
        margin: '10px 0 4px 0',
        color: '#00838f'
      }
    }));

    resultPanel.add(ui.Label({
      value: 'Pseudo-samples: total=' + result.totalSamples +
        ' | train=' + result.trainingSamples +
        ' | holdout=' + result.testSamples,
      style: {fontSize: '11px', color: '#555'}
    }));

    resultPanel.add(ui.Label({
      value: 'Holdout agreement with Dynamic World pseudo-labels: ' +
        fmtPct(result.holdoutAccuracy) +
        ' | Kappa: ' + fmtFloat(result.holdoutKappa, 3),
      style: {fontSize: '12px', fontWeight: 'bold', color: '#00838f'}
    }));

    resultPanel.add(ui.Label({
      value: 'Pseudo-label positive class: recall=' + fmtPct(recallPositive) +
        ' | precision=' + fmtPct(precisionPositive) +
        ' | F1=' + fmtFloat(f1, 3),
      style: {fontSize: '12px', color: '#00838f'}
    }));

    resultPanel.add(ui.Label({
      value: 'Applied map probability threshold: p >= ' +
        probabilityThreshold.toFixed(2) +
        '. Increase this if the pseudo-RF map overpredicts area; decrease it if it misses too much.',
      style: {fontSize: '11px', color: '#00838f'}
    }));

    resultPanel.add(ui.Label({
      value: 'Thesis warning: because this model is trained from Dynamic World, do not report this as independent accuracy against Dynamic World. Report it as weakly supervised calibration or benchmark agreement.',
      style: {fontSize: '10px', color: '#777'}
    }));
  });

  return pseudoRfDevelopment;
}


// ============================================================
// 17. MAIN ANALYSIS
// ============================================================

function runAnalysis() {
  Map.layers().reset();

  resultPanel.clear();
  resultPanel.add(ui.Label({
    value: 'Running analysis...',
    style: {color: '#1b7f3a', fontWeight: 'bold'}
  }));

  var aoi = getAOI();

  var beforeYear = yearBefore.getValue();
  var afterYear = yearAfter.getValue();

  if (parseInt(beforeYear, 10) >= parseInt(afterYear, 10)) {
    resultPanel.clear();
    resultPanel.add(ui.Label({
      value: 'ERROR: Before year must be earlier than after year.',
      style: {color: 'red', fontWeight: 'bold'}
    }));
    return;
  }

  var sensitivity = sensitivitySelect.getValue();
  var refChoice = referenceSelect.getValue();
  var useSAR = useSARCheckbox.getValue();
  var useSlope = useSlopeCheckbox.getValue();
  var useDWPseudoTraining = useDWPseudoTrainingCheckbox.getValue();
  var dwPseudoProbabilityThreshold = dwPseudoThresholdSlider.getValue();
  var t = getThresholds(sensitivity);

  print('========================================');
  print('ATHENS URBAN DEVELOPMENT CHANGE DETECTION - THESIS V7');
  print('AOI:', aoi);
  print('Before / After:', beforeYear, '/', afterYear);
  print('Sensitivity:', sensitivity);
  print('Reference:', refChoice);
  print('Use SAR support:', useSAR);
  print('Use slope filter:', useSlope);
  print('Use Dynamic World pseudo-training:', useDWPseudoTraining);
  print('DW pseudo-RF probability threshold:', dwPseudoProbabilityThreshold);
  print('Thresholds:', t);
  print('Important: Dynamic World is not used inside detection. It is only a validation benchmark.');
  print('========================================');

  // ----------------------------
  // Data preparation
  // ----------------------------
  var before = getS2Composite(beforeYear, aoi);
  var after = getS2Composite(afterYear, aoi);

  var beforeS1 = getS1Composite(beforeYear, aoi);
  var afterS1 = getS1Composite(afterYear, aoi);

  var slope = getSlope(aoi);
  var slopeMask = slope.lt(t.maxBuiltSlope);

  // ----------------------------
  // Difference layers
  // ----------------------------
  var dNDVILoss = before.select('NDVI')
    .subtract(after.select('NDVI'))
    .rename('dNDVI_loss');

  var dNDBI = after.select('NDBI')
    .subtract(before.select('NDBI'))
    .rename('dNDBI');

  var dNBR = before.select('NBR')
    .subtract(after.select('NBR'))
    .rename('dNBR');

  var dBSI = after.select('BSI')
    .subtract(before.select('BSI'))
    .rename('dBSI');

  var dMNDWI = after.select('MNDWI')
    .subtract(before.select('MNDWI'))
    .rename('dMNDWI');

  var dVV = afterS1.select('VV')
    .subtract(beforeS1.select('VV'))
    .rename('dVV');

  var dVH = afterS1.select('VH')
    .subtract(beforeS1.select('VH'))
    .rename('dVH');

  var predictorStack = buildPredictorStack(
    before,
    after,
    dNDVILoss,
    dNDBI,
    dNBR,
    dBSI,
    dMNDWI,
    dVV,
    dVH,
    slope,
    aoi
  );

  // ----------------------------
  // Basic masks
  // ----------------------------
  var waterMask = before.select('MNDWI').lt(0.12)
    .and(after.select('MNDWI').lt(0.12));

  var beforeBuiltLike = before.select('NDBI').gt(t.minBuiltNDBI)
    .and(before.select('NDBI').gt(before.select('NDVI').subtract(0.05)))
    .and(before.select('MNDWI').lt(0.12))
    .and(before.select('NDVI').lt(t.maxBuiltNDVI));

  var afterBuiltLike = after.select('NDBI').gt(t.minBuiltNDBI)
    .and(after.select('NDBI').gt(after.select('NDVI').subtract(0.05)))
    .and(after.select('MNDWI').lt(0.12))
    .and(after.select('NDVI').lt(t.maxBuiltNDVI));

  var afterUrbanSpectral = after.select('NDBI').gt(-0.08)
    .or(after.select('BSI').gt(0.02))
    .and(after.select('MNDWI').lt(0.08))
    .and(after.select('NDVI').lt(0.58));

  var sarSupport = dVV.gt(t.newBuiltDVV)
    .or(dVH.gt(t.newBuiltDVH));

  var strongOpticalSupport = dNDBI.gt(t.newBuiltDNDBI * 1.6)
    .or(dBSI.gt(t.newBuiltDBSI * 1.8))
    .or(dNDVILoss.gt(t.constructionNDVILoss * 1.7));

  // ----------------------------
  // New built-up candidate
  // ----------------------------
  var builtOpticalGain = dNDBI.gt(t.newBuiltDNDBI)
    .and(dBSI.gt(t.newBuiltDBSI))
    .or(dNDBI.gt(t.newBuiltDNDBI * 1.7).and(dNDVILoss.gt(0.04)))
    .or(afterBuiltLike.and(dNDVILoss.gt(0.08)).and(dBSI.gt(t.newBuiltDBSI)));

  var newBuiltRaw = afterBuiltLike
    .and(builtOpticalGain)
    .and(waterMask)
    .and(after.select('NDVI').lt(t.maxBuiltNDVI))
    .and(beforeBuiltLike.not()
      .or(dNDBI.gt(t.newBuiltDNDBI * 1.8))
      .or(dBSI.gt(t.newBuiltDBSI * 2.0)));

  // SAR is not mandatory. It supports weak optical detections, while strong
  // optical change can still pass without a large VV/VH increase.
  if (useSAR) {
    newBuiltRaw = newBuiltRaw.and(sarSupport.or(strongOpticalSupport));
  }

  if (useSlope) {
    newBuiltRaw = newBuiltRaw.and(slopeMask);
  }

  // ----------------------------
  // Construction-stage urban development
  // ----------------------------
  var constructionOptical = dBSI.gt(t.constructionDBSI)
    .and(dNDVILoss.gt(t.constructionNDVILoss))
    .and(dNDBI.gt(0.015))
    .and(after.select('BSI').gt(0.025))
    .and(after.select('NDVI').lt(0.52))
    .and(after.select('MNDWI').lt(0.04))
    .and(afterUrbanSpectral)
    .and(waterMask)
    .and(beforeBuiltLike.not().or(dNDBI.gt(0.030)));

  var constructionAlt = dNDVILoss.gt(t.constructionNDVILoss * 1.5)
    .and(dNDBI.gt(0.025))
    .and(dBSI.gt(t.constructionDBSI * 0.90))
    .and(after.select('BSI').gt(0.020))
    .and(after.select('NDVI').lt(0.48))
    .and(after.select('MNDWI').lt(0.03))
    .and(afterUrbanSpectral)
    .and(waterMask)
    .and(beforeBuiltLike.not().or(dBSI.gt(t.constructionDBSI * 1.5)));

  var constructionRaw = constructionOptical.or(constructionAlt);

  if (useSAR) {
    constructionRaw = constructionRaw.and(sarSupport.or(strongOpticalSupport));
  }

  if (useSlope) {
    constructionRaw = constructionRaw.and(slopeMask);
  }

  var constructionConfidenceSupport = strongOpticalSupport
    .and(dBSI.gt(t.constructionDBSI * 1.35))
    .or(dNDBI.gt(t.newBuiltDNDBI * 1.25).and(dBSI.gt(t.constructionDBSI)));

  if (useSAR) {
    constructionConfidenceSupport = constructionConfidenceSupport
      .or(sarSupport.and(dBSI.gt(t.constructionDBSI * 1.10)));
  }

  var constructionFinalRaw = constructionRaw
    .and(dBSI.gt(t.constructionDBSI * 1.10))
    .and(dNDVILoss.gt(t.constructionNDVILoss * 1.05))
    .and(dNDBI.gt(t.newBuiltDNDBI * 0.60))
    .and(after.select('BSI').gt(0.035))
    .and(after.select('NDVI').lt(0.48))
    .and(after.select('MNDWI').lt(0.02))
    .and(constructionConfidenceSupport);

  // ----------------------------
  // Vegetation loss
  // ----------------------------
  var vegetationLossRaw = before.select('NDVI').gt(t.beforeVegNDVI)
    .and(dNDVILoss.gt(t.vegLossDNDVI))
    .and(waterMask);

  // ----------------------------
  // Burn-like disturbance, excluded from urban development
  // ----------------------------
  var burnLike = dNBR.gt(0.20)
    .and(dNDVILoss.gt(0.12))
    .and(after.select('NDBI').lt(0.00))
    .and(after.select('BSI').lt(0.06))
    .and(waterMask);

  // ----------------------------
  // Cleaned masks
  // ----------------------------
  var newBuilt = cleanMask(
    newBuiltRaw.and(burnLike.not()),
    t.minPatchPixels
  ).rename('new_built_up');

  var constructionDiagnostic = cleanMask(
    constructionRaw
      .and(newBuilt.unmask(0).not())
      .and(burnLike.not()),
    t.minPatchPixels
  ).rename('construction_stage_diagnostic');

  var construction = cleanMask(
    constructionFinalRaw
      .and(newBuilt.unmask(0).not())
      .and(burnLike.not()),
    t.minPatchPixels + 2
  ).rename('construction_stage_final');

  var vegetationLoss = cleanMask(
    vegetationLossRaw
      .and(newBuilt.unmask(0).not())
      .and(constructionDiagnostic.unmask(0).not()),
    t.minPatchPixels
  ).rename('vegetation_loss');

  // Result Guidelines / Thesis structure
  // - coreUrbanDevelopment is the layer validated against Dynamic World/GHSL.
  // - expandedUrbanDevelopment includes construction candidates, but should be
  //   validated manually before being reported as an accuracy result.
  var coreUrbanDevelopment = newBuilt.unmask(0)
    .selfMask()
    .rename('core_urban_development');

  var expandedUrbanDevelopment = newBuilt.unmask(0)
    .or(construction.unmask(0))
    .selfMask()
    .rename('expanded_urban_development_candidate');

  var allChanges = ee.Image(0)
    .where(vegetationLoss, 1)
    .where(newBuilt, 2)
    .where(construction, 3)
    .where(expandedUrbanDevelopment, 4)
    .selfMask()
    .rename('detected_changes');

  // ----------------------------
  // Visualization
  // ----------------------------
  var rgbVis = {
    bands: ['B4', 'B3', 'B2'],
    min: 0,
    max: 3000,
    gamma: 1.2
  };

  var falseColorVis = {
    bands: ['B8', 'B4', 'B3'],
    min: 0,
    max: 3000,
    gamma: 1.2
  };

  var dNDBIVis = {
    min: -0.25,
    max: 0.25,
    palette: ['0000ff', 'ffffff', 'ff0000']
  };

  var dNDVIVis = {
    min: -0.2,
    max: 0.5,
    palette: ['ffffff', 'fff176', 'f57f17', '8b4513']
  };

  var dBSIVis = {
    min: -0.2,
    max: 0.3,
    palette: ['006400', 'ffffff', 'ff9800']
  };

  var dVVVis = {
    min: -5,
    max: 10,
    palette: ['0000ff', 'ffffff', 'ff0000']
  };

  Map.setOptions('SATELLITE');

  Map.addLayer(before, rgbVis, 'RGB BEFORE ' + beforeYear, false);
  Map.addLayer(after, rgbVis, 'RGB AFTER ' + afterYear, true);

  Map.addLayer(before, falseColorVis, 'False color BEFORE ' + beforeYear, false);
  Map.addLayer(after, falseColorVis, 'False color AFTER ' + afterYear, false);

  Map.addLayer(dNDBI, dNDBIVis, 'dNDBI built-up increase', false);
  Map.addLayer(dNDVILoss, dNDVIVis, 'dNDVI vegetation loss', false);
  Map.addLayer(dBSI, dBSIVis, 'dBSI bare/construction increase', false);
  Map.addLayer(dVV, dVVVis, 'dVV SAR increase', false);
  Map.addLayer(dVH, dVVVis, 'dVH SAR increase', false);
  Map.addLayer(slope, {
    min: 0,
    max: 45,
    palette: ['ffffff', 'fdd835', 'e65100', '000000']
  }, 'Slope', false);

  Map.addLayer(coreUrbanDevelopment, {
    palette: ['ff00ff'],
    opacity: 0.95
  }, 'CORE validated built-up development layer', true);

  Map.addLayer(expandedUrbanDevelopment, {
    palette: ['d946ef'],
    opacity: 0.55
  }, 'Expanded urban-development candidate - needs manual validation', false);

  Map.addLayer(newBuilt, {
    palette: ['ff0000'],
    opacity: 0.95
  }, 'New built-up only', true);

  Map.addLayer(construction, {
    palette: ['ff9800'],
    opacity: 0.90
  }, 'High-confidence construction candidate', true);

  Map.addLayer(constructionDiagnostic, {
    palette: ['ffd180'],
    opacity: 0.70
  }, 'Broad construction candidate diagnostic', false);

  Map.addLayer(vegetationLoss, {
    palette: ['ffff00'],
    opacity: 0.85
  }, 'Vegetation loss', false);

  Map.addLayer(allChanges, {
    min: 1,
    max: 4,
    palette: ['ffff00', 'ff0000', 'ff9800', 'ff00ff'],
    opacity: 0.75
  }, 'All detected changes', false);

  addAOIOutline(aoi);
  Map.centerObject(aoi, 15);

  // ----------------------------
  // Area calculations
  // ----------------------------
  var pixelArea = ee.Image.pixelArea().rename('area');

  function areaKm2(maskImage) {
    var areaValue = pixelArea.updateMask(maskImage).reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: aoi,
      scale: 10,
      maxPixels: 1e9,
      bestEffort: true,
      tileScale: 4
    }).get('area');

    return ee.Number(ee.Algorithms.If(areaValue, areaValue, 0)).divide(1e6);
  }

  var stats = ee.Dictionary({
    newBuiltKm2: areaKm2(newBuilt),
    constructionKm2: areaKm2(construction),
    constructionDiagnosticKm2: areaKm2(constructionDiagnostic),
    coreUrbanDevelopmentKm2: areaKm2(coreUrbanDevelopment),
    expandedUrbanDevelopmentKm2: areaKm2(expandedUrbanDevelopment),
    vegetationLossKm2: areaKm2(vegetationLoss)
  });

  stats.evaluate(function(result, error) {
    resultPanel.clear();

    if (error || !result) {
      resultPanel.add(ui.Label({
        value: 'Area stats failed: ' + (error || 'no result'),
        style: {color: 'red', fontWeight: 'bold'}
      }));
      return;
    }

    var newBuiltArea = result.newBuiltKm2 || 0;
    var constructionArea = result.constructionKm2 || 0;
    var constructionDiagnosticArea = result.constructionDiagnosticKm2 || 0;
    var coreUrbanDevArea = result.coreUrbanDevelopmentKm2 || 0;
    var expandedUrbanDevArea = result.expandedUrbanDevelopmentKm2 || 0;
    var vegArea = result.vegetationLossKm2 || 0;

    resultPanel.add(ui.Label({
      value: 'Change summary',
      style: {fontWeight: 'bold', fontSize: '14px', margin: '4px 0'}
    }));

    resultPanel.add(ui.Label('Before: ' + beforeYear + ' to After: ' + afterYear));
    resultPanel.add(ui.Label('Sensitivity: ' + sensitivity +
      ' | SAR support: ' + (useSAR ? 'on' : 'off') +
      ' | Slope: ' + (useSlope ? 'on' : 'off')));

    resultPanel.add(ui.Label({
      value: 'New built-up only: ' + newBuiltArea.toFixed(4) + ' km2',
      style: {color: 'red', fontWeight: 'bold'}
    }));

    resultPanel.add(ui.Label({
      value: 'Construction candidate needing manual validation: ' + constructionArea.toFixed(4) + ' km2',
      style: {color: '#e65100', fontWeight: 'bold'}
    }));

    resultPanel.add(ui.Label({
      value: 'Broad construction candidate diagnostic: ' + constructionDiagnosticArea.toFixed(4) + ' km2',
      style: {color: '#a15c00', fontWeight: 'bold'}
    }));

    resultPanel.add(ui.Label({
      value: 'CORE validated built-up development layer: ' + coreUrbanDevArea.toFixed(4) + ' km2',
      style: {color: '#be123c', fontWeight: 'bold'}
    }));

    resultPanel.add(ui.Label({
      value: 'Expanded urban-development candidate: ' + expandedUrbanDevArea.toFixed(4) + ' km2',
      style: {color: '#8e24aa', fontWeight: 'bold'}
    }));

    resultPanel.add(ui.Label({
      value: 'Vegetation loss: ' + vegArea.toFixed(4) + ' km2',
      style: {color: '#9a8500', fontWeight: 'bold'}
    }));

    resultPanel.add(ui.Label({
      value: 'Method note: report benchmark accuracy for the CORE layer. Treat construction and expanded development as candidate layers unless manually validated.',
      style: {fontSize: '10px', color: '#555', margin: '8px 0 0 0'}
    }));

    // ----------------------------
    // Validation
    // ----------------------------
    if (validateCheckbox.getValue()) {
      var useDW = refChoice === 'Dynamic World development reference' || refChoice === 'Both';
      var useGHSL = refChoice === 'GHSL built-up reference' || refChoice === 'Both';

      if (useDW) {
        var dwRef = buildDWDevelopmentReference(beforeYear, afterYear, aoi);

        if (useDWPseudoTraining) {
          var dwPseudoRfDevelopment = runDynamicWorldPseudoTraining(
            predictorStack,
            dwRef,
            aoi,
            dwPseudoProbabilityThreshold
          );

          validateAgainstReference(
            dwPseudoRfDevelopment,
            dwRef,
            aoi,
            'Circular diagnostic: DW pseudo-trained RF vs same DW reference',
            '#00838f'
          );
        }

        validateAgainstReference(
          coreUrbanDevelopment,
          dwRef,
          aoi,
          'CORE validated built-up development layer - validated vs Dynamic World',
          '#1b7f3a'
        );

        validateAgainstReference(
          expandedUrbanDevelopment,
          dwRef,
          aoi,
          'Diagnostic: Expanded urban-development candidate vs Dynamic World',
          '#8e24aa'
        );
      }

      if (useGHSL) {
        var ghslRef = buildGHSLReference(beforeYear, afterYear, aoi);

        validateAgainstReference(
          coreUrbanDevelopment,
          ghslRef,
          aoi,
          'CORE validated built-up development layer - validated vs GHSL',
          '#0066cc'
        );

        resultPanel.add(ui.Label({
          value: 'GHSL caveat: observed GHSL epochs may lag the selected after-year. For 2018-2024, GHSL mainly compares 2015 to 2020, not full 2024 conditions.',
          style: {fontSize: '10px', color: '#777', margin: '8px 0 0 0'}
        }));
      }

      resultPanel.add(ui.Label({
        value: 'Dynamic World and GHSL are benchmark references, not absolute ground truth. Add manual validation polygons or stratified points digitised from high-resolution imagery for final dissertation accuracy.',
        style: {fontSize: '10px', color: '#777', margin: '8px 0 0 0'}
      }));
    }
  });
}


// ============================================================
// 18. DRAW LISTENERS
// ============================================================

drawingTools.onDraw(ui.util.debounce(onGeometryDrawn, 300));
drawingTools.onEdit(ui.util.debounce(onGeometryDrawn, 300));


// ============================================================
// 19. UI PANEL
// ============================================================

var panel = ui.Panel({
  style: {
    width: '390px',
    padding: '8px',
    position: 'top-left'
  }
});

panel.add(ui.Label({
  value: 'Athens Urban Development Detection',
  style: styleH1
}));

panel.add(ui.Label({
  value: 'S2 + S1 SAR support + slope + DW/GHSL benchmark validation. Optional DW pseudo-training improves benchmark agreement but is not independent accuracy.',
  style: styleP
}));

panel.add(ui.Label({
  value: '1. Select years',
  style: styleH2
}));

panel.add(ui.Label('Before year:', styleP));
panel.add(yearBefore);

panel.add(ui.Label('After year:', styleP));
panel.add(yearAfter);

panel.add(ui.Label({
  value: '2. Detection settings',
  style: styleH2
}));

panel.add(ui.Label('Sensitivity:', styleP));
panel.add(sensitivitySelect);
panel.add(useSARCheckbox);
panel.add(useSlopeCheckbox);
panel.add(useDWPseudoTrainingCheckbox);
panel.add(ui.Label('DW pseudo-RF probability threshold:', styleP));
panel.add(dwPseudoThresholdSlider);

panel.add(ui.Label({
  value: '3. Draw study area',
  style: styleH2
}));

panel.add(ui.Button({
  label: 'Draw Rectangle',
  onClick: drawRectangle,
  style: buttonStyle
}));

panel.add(ui.Button({
  label: 'Draw Polygon',
  onClick: drawPolygon,
  style: buttonStyle
}));

panel.add(ui.Button({
  label: 'Clear AOI',
  onClick: clearGeometry,
  style: buttonStyle
}));

panel.add(ui.Label({
  value: '4. Validation',
  style: styleH2
}));

panel.add(validateCheckbox);
panel.add(showDebugCheckbox);

panel.add(ui.Label('Reference dataset:', styleP));
panel.add(referenceSelect);

panel.add(ui.Label({
  value: '5. Run',
  style: styleH2
}));

panel.add(ui.Button({
  label: 'Run Detection',
  onClick: runAnalysis,
  style: {
    stretch: 'horizontal',
    margin: '6px',
    backgroundColor: '#1b7f3a',
    color: 'cyan'
  }
}));

panel.add(infoLabel);
panel.add(legendPanel);
panel.add(resultPanel);

ui.root.insert(0, panel);


// ============================================================
// 20. INITIAL MAP
// ============================================================

Map.setOptions('SATELLITE');
Map.centerObject(DEFAULT_AOI, 13);

Map.addLayer(DEFAULT_AOI, {
  color: '00ffff'
}, 'Default thesis AOI', true);

print('Ready. Use the default AOI or draw your own, then click Run Detection.');
print('Recommended baseline test: 2018 to 2024, Balanced, SAR support on, slope on.');
print('For thesis interpretation, report benchmark accuracy for the CORE validated built-up layer.');
print('Use the Expanded construction/development candidate layer only with manual validation or as qualitative evidence.');
print('Validation note: Dynamic World is used as a benchmark reference. Optional DW pseudo-training is weak supervision, not independent ground truth.');