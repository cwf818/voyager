!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.vr=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var vr = module.exports = {
  cluster: require('./cluster/cluster'),
  gen: require('./gen/gen'),
  rank: require('./rank/rank'),
  util: require('./util')
};



},{"./cluster/cluster":2,"./gen/gen":9,"./rank/rank":13,"./util":15}],2:[function(require,module,exports){
(function (global){
"use strict";

module.exports = cluster;

var vl = (typeof window !== "undefined" ? window.vl : typeof global !== "undefined" ? global.vl : null),
  clusterfck = (typeof window !== "undefined" ? window.clusterfck : typeof global !== "undefined" ? global.clusterfck : null),
  consts = require('./clusterconsts'),
  util = require('../util');

cluster.distance = require('./distance');

function cluster(encodings, opt) {
  var dist = cluster.distance.table(encodings);

  var clusterTrees = clusterfck.hcluster(encodings, function(e1, e2) {
    var s1 = vl.Encoding.shorthand(e1),
      s2 = vl.Encoding.shorthand(e2);
    return dist[s1][s2];
  }, 'average', consts.CLUSTER_THRESHOLD);

  var clusters = clusterTrees.map(function(tree) {
      return util.traverse(tree, []);
    })
   .map(function(cluster) {
    return cluster.sort(function(encoding1, encoding2) {
      // sort each cluster -- have the highest score as 1st item
      return encoding2.score - encoding1.score;
    });
  }).filter(function(cluster) {  // filter empty cluster
    return cluster.length >0;
  }).sort(function(cluster1, cluster2) {
    //sort by highest scoring item in each cluster
    return cluster2[0].score - cluster1[0].score;
  });

  clusters.dist = dist; //append dist in the array for debugging

  return clusters;
}
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../util":15,"./clusterconsts":3,"./distance":4}],3:[function(require,module,exports){
var c = module.exports = {};

c.SWAPPABLE = 0.05;
c.DIST_MISSING = 1;
c.CLUSTER_THRESHOLD = 1;

function reduceTupleToTable(r, x) {
  var a = x[0], b = x[1], d = x[2];
  r[a] = r[a] || {};
  r[b] = r[b] || {};
  r[a][b] = r[b][a] = d;
  return r;
}

c.DIST_BY_ENCTYPE = [
  // positional
  ['x', 'y', c.SWAPPABLE],
  ['row', 'col', c.SWAPPABLE],

  // ordinal mark properties
  ['color', 'shape', c.SWAPPABLE],
  ['color', 'detail', c.SWAPPABLE],
  ['detail', 'shape', c.SWAPPABLE],

  // quantitative mark properties
  ['color', 'alpha', c.SWAPPABLE],
  ['size', 'alpha', c.SWAPPABLE],
  ['size', 'color', c.SWAPPABLE]
].reduce(reduceTupleToTable, {});

},{}],4:[function(require,module,exports){
(function (global){
var vl = (typeof window !== "undefined" ? window.vl : typeof global !== "undefined" ? global.vl : null),
  consts = require('./clusterconsts'),
  util = require('../util');

module.exports = distance = {};

distance.table = function (encodings) {
  var len = encodings.length,
    colencs = encodings.map(function(e) { return distance.getEncTypeByColumnName(e); }),
    shorthands = encodings.map(vl.Encoding.shorthand),
    diff = {}, i, j;

  for (i = 0; i < len; i++) diff[shorthands[i]] = {};

  for (i = 0; i < len; i++) {
    for (j = i + 1; j < len; j++) {
      var sj = shorthands[j], si = shorthands[i];

      diff[sj][si] = diff[si][sj] = distance.get(colencs[i], colencs[j]);
    }
  }
  return diff;
};

distance.get = function (colenc1, colenc2) {
  var cols = util.union(vl.keys(colenc1.col), vl.keys(colenc2.col)),
    dist = 0;

  cols.forEach(function(col) {
    var e1 = colenc1.col[col], e2 = colenc2.col[col];

    if (e1 && e2) {
      if (e1.encType != e2.encType) {
        dist += (consts.DIST_BY_ENCTYPE[e1.encType] || {})[e2.encType] || 1;
      }
    } else {
      dist += consts.DIST_MISSING;
    }
  });

  // do not group stacked chart with similar non-stacked chart!
  var isStack1 = vl.Encoding.isStack(colenc1),
    isStack2 = vl.Encoding.isStack(colenc2);

  if(isStack1 || isStack2) {
    if(isStack1 && isStack2) {
      if(colenc1.enc.color.name !== colenc2.enc.color.name) {
        dist+=1;
      }
    } else {
      dist+=1; // surely different
    }
  }
  return dist;
};

// get encoding type by fieldname
distance.getEncTypeByColumnName = function(encoding) {
  var _colenc = {},
    enc = encoding.enc;

  vl.keys(enc).forEach(function(encType) {
    var e = vl.duplicate(enc[encType]);
    e.encType = encType;
    _colenc[e.name || ''] = e;
    delete e.name;
  });

  return {
    marktype: encoding.marktype,
    col: _colenc,
    enc: encoding.enc
  };
};
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../util":15,"./clusterconsts":3}],5:[function(require,module,exports){
var consts = module.exports = {
  gen: {},
  cluster: {},
  rank: {}
};

consts.gen.projections = {
  type: 'object',
  properties: {
    omitDotPlot: { //FIXME remove this!
      type: 'boolean',
      default: false,
      description: 'remove all dot plots'
    },
    maxCardinalityForAutoAddOrdinal: {
      type: 'integer',
      default: 50,
      description: 'max cardinality for ordinal field to be considered for auto adding'
    },
    alwaysAddHistogram: {
      type: 'boolean',
      default: true
    }
  }
};

consts.gen.aggregates = {
  type: 'object',
  properties: {
    tableTypes: {
      type: 'boolean',
      default: 'both',
      enum: ['both', 'aggregated', 'disaggregated']
    },
    genDimQ: {
      type: 'string',
      default: 'auto',
      enum: ['auto', 'bin', 'cast', 'none'],
      description: 'Use Q as Dimension either by binning or casting'
    },
    minCardinalityForBin: {
      type: 'integer',
      default: 20,
      description: 'minimum cardinality of a field if we were to bin'
    },
    omitDotPlot: {
      type: 'boolean',
      default: false,
      description: 'remove all dot plots'
    },
    omitMeasureOnly: {
      type: 'boolean',
      default: true,
      description: 'Omit aggregation with measure(s) only'
    },
    omitDimensionOnly: {
      type: 'boolean',
      default: true,
      description: 'Omit aggregation with dimension(s) only'
    },
    addCountForDimensionOnly: {
      type: 'boolean',
      default: true,
      description: 'Add count when there are dimension(s) only'
    },
    aggrList: {
      type: 'array',
      items: {
        type: ['string']
      },
      default: [undefined, 'avg']
    },
    timeFnList: {
      type: 'array',
      items: {
        type: ['string']
      },
      default: ['year']
    },
    consistentAutoQ: {
      type: 'boolean',
      default: true,
      description: "generate similar auto transform for quant"
    }
  }
};

consts.gen.encodings = {
  type: 'object',
  properties: {
    marktypeList: {
      type: 'array',
      items: {type: 'string'},
      default: ['point', 'bar', 'line', 'area', 'text', 'tick'], //filled_map
      description: 'allowed marktypes'
    },
    encodingTypeList: {
      type: 'array',
      items: {type: 'string'},
      default: ['x', 'y', 'row', 'col', 'size', 'color', 'text', 'detail'],
      description: 'allowed encoding types'
    },
    maxGoodCardinalityForFacets: {
      type: 'integer',
      default: 5,
      description: 'maximum cardinality of a field to be put on facet (row/col) effectively'
    },
    maxCardinalityForFacets: {
      type: 'integer',
      default: 20,
      description: 'maximum cardinality of a field to be put on facet (row/col)'
    },
    maxGoodCardinalityForColor: {
      type: 'integer',
      default: 7,
      description: 'maximum cardinality of an ordinal field to be put on color effectively'
    },
    maxCardinalityForColor: {
      type: 'integer',
      default: 20,
      description: 'maximum cardinality of an ordinal field to be put on color'
    },
    maxCardinalityForShape: {
      type: 'integer',
      default: 6,
      description: 'maximum cardinality of an ordinal field to be put on shape'
    },
    omitTranpose:  {
      type: 'boolean',
      default: true,
      description: 'Eliminate all transpose by (1) keeping horizontal dot plot only (2) for OxQ charts, always put O on Y (3) show only one DxD, MxM (currently sorted by name)'
    },
    omitDotPlot: {
      type: 'boolean',
      default: false,
      description: 'remove all dot plots'
    },
    omitDotPlotWithExtraEncoding: {
      type: 'boolean',
      default: true,
      description: 'remove all dot plots with >1 encoding'
    },
    omitMultipleRetinalEncodings: {
      type: 'boolean',
      default: true,
      description: 'omit using multiple retinal variables (size, color, alpha, shape)'
    },
    omitNonTextAggrWithAllDimsOnFacets: {
      type: 'boolean',
      default: true,
      description: 'remove all aggregated charts (except text tables) with all dims on facets (row, col)'
    },
    omitSizeOnBar: {
      type: 'boolean',
      default: false,
      description: 'do not use bar\'s size'
    },
    omitStackedAverage: {
      type: 'boolean',
      default: true,
      description: 'do not stack bar chart with average'
    },
    alwaysGenerateTableAsHeatmap: {
      type: 'boolean',
      default: true
    }
  }
};




},{}],6:[function(require,module,exports){
(function (global){
'use strict';

var vl = (typeof window !== "undefined" ? window.vl : typeof global !== "undefined" ? global.vl : null);

var util = require('../util'),
  consts = require('../consts');

module.exports = genAggregates;

function genAggregates(output, fields, stats, opt) {
  opt = vl.schema.util.extend(opt||{}, consts.gen.aggregates);
  var tf = new Array(fields.length);
  var hasO = vl.any(fields, function(f) {
    return f.type === 'O';
  });

  function emit(fieldSet) {
    fieldSet = vl.duplicate(fieldSet);
    fieldSet.key = vl.field.shorthands(fieldSet);
    output.push(fieldSet);
  }

  function checkAndPush() {
    if (opt.omitMeasureOnly || opt.omitDimensionOnly) {
      var hasMeasure = false, hasDimension = false, hasRaw = false;
      tf.forEach(function(f) {
        if (vl.field.isDimension(f)) {
          hasDimension = true;
        } else {
          hasMeasure = true;
          if (!f.aggr) hasRaw = true;
        }
      });
      if (!hasDimension && !hasRaw && opt.omitMeasureOnly) return;
      if (!hasMeasure) {
        if (opt.addCountForDimensionOnly) {
          tf.push(vl.field.count());
          emit(tf);
          tf.pop();
        }
        if (opt.omitDimensionOnly) return;
      }
    }
    if (opt.omitDotPlot && tf.length === 1) return;
    emit(tf);
  }

  function assignAggrQ(i, hasAggr, autoMode, a) {
    var canHaveAggr = hasAggr === true || hasAggr === null,
      cantHaveAggr = hasAggr === false || hasAggr === null;
    if (a !== undefined) {
      if (canHaveAggr) {
        tf[i].aggr = a;
        assignField(i + 1, true, autoMode);
        delete tf[i].aggr;
      }
    } else { // if(a === undefined)
      if (cantHaveAggr) {
        assignField(i + 1, false, autoMode);
      }
    }
  }

  function assignBinQ(i, hasAggr, autoMode) {
    tf[i].bin = true;
    assignField(i + 1, hasAggr, autoMode);
    delete tf[i].bin;
  }

  function assignQ(i, hasAggr, autoMode) {
    var f = fields[i],
      canHaveAggr = hasAggr === true || hasAggr === null;

    tf[i] = {name: f.name, type: f.type};

    if (f.aggr === 'count') { // if count is included in the selected fields
      if (canHaveAggr) {
        tf[i].aggr = f.aggr;
        assignField(i + 1, true, autoMode);
      }
    } else if (f._aggr) {
      assignAggrQ(i, hasAggr, autoMode, f._aggr);
    } else if (f._raw) {
      assignAggrQ(i, hasAggr, autoMode, undefined);
    } else if (f._bin) {
      assignBinQ(i, hasAggr, autoMode);
    } else {
      opt.aggrList.forEach(function(a) {
        if (!opt.consistentAutoQ || autoMode === null || autoMode === a) {
          assignAggrQ(i, hasAggr, a, a);
        }
      });

      if ((!opt.consistentAutoQ || vl.isin(autoMode, [null, 'bin', 'cast', 'autocast'])) && !hasO) {
        var highCardinality = vl.field.cardinality(f, stats) > opt.minCardinalityForBin;

        var isAuto = opt.genDimQ === 'auto',
          genBin = opt.genDimQ  === 'bin' || (isAuto && highCardinality),
          genCast = opt.genDimQ === 'cast' || (isAuto && !highCardinality);

        if (genBin && vl.isin(autoMode, [null, 'bin', 'autocast'])) {
          assignBinQ(i, hasAggr, isAuto ? 'autocast' : 'bin');
        }
        if (genCast && vl.isin(autoMode, [null, 'cast', 'autocast'])) {
          tf[i].type = 'O';
          assignField(i + 1, hasAggr, isAuto ? 'autocast' : 'cast');
          tf[i].type = 'Q';
        }
      }
    }
  }

  function assignT(i, hasAggr, autoMode) {
    var f = fields[i];
    tf[i] = {name: f.name, type: f.type};

    var fns = (!f._fn || f._fn === '*') ? opt.timeFnList : f._fn;
    for (var j in fns) {
      var fn = fns[j];
      if (fn === undefined) {
        if (!hasAggr) { // can't aggregate over raw time
          assignField(i+1, false, autoMode);
        }
      } else {
        tf[i].fn = fn;
        assignField(i+1, hasAggr, autoMode);
      }
    }

    // FIXME what if you aggregate time?
  }

  function assignField(i, hasAggr, autoMode) {
    if (i === fields.length) { // If all fields are assigned
      checkAndPush();
      return;
    }

    var f = fields[i];
    // Otherwise, assign i-th field
    switch (f.type) {
      //TODO "D", "G"
      case 'Q':
        assignQ(i, hasAggr, autoMode);
        break;

      case 'T':
        assignT(i, hasAggr, autoMode);
        break;

      case 'O':
      default:
        tf[i] = f;
        assignField(i + 1, hasAggr, autoMode);
        break;
    }
  }

  var hasAggr = opt.tableTypes === 'aggregated' ? true : opt.tableTypes === 'disaggregated' ? false : null;
  assignField(0, hasAggr, null);

  return output;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../consts":5,"../util":15}],7:[function(require,module,exports){
(function (global){
'use strict';

var vl = (typeof window !== "undefined" ? window.vl : typeof global !== "undefined" ? global.vl : null),
  genEncs = require('./encs'),
  getMarktypes = require('./marktypes'),
  rank = require('../rank/rank'),
  consts = require('../consts');

module.exports = genEncodingsFromFields;

function genEncodingsFromFields(output, fields, stats, opt, cfg, nested) {
  opt = vl.schema.util.extend(opt||{}, consts.gen.encodings);
  var encs = genEncs([], fields, stats, opt);

  if (nested) {
    return encs.reduce(function(dict, enc) {
      dict[enc] = genEncodingsFromEncs([], enc, stats, opt, cfg);
      return dict;
    }, {});
  } else {
    return encs.reduce(function(list, enc) {
      return genEncodingsFromEncs(list, enc, stats, opt, cfg);
    }, []);
  }
}

function genEncodingsFromEncs(output, enc, stats, opt, cfg) {
  getMarktypes(enc, stats, opt)
    .forEach(function(markType) {
      var encoding = finalTouch({marktype: markType, enc: enc, cfg: cfg}, stats, opt),
        score = rank.encoding(encoding, stats, opt);

      encoding.score = score.score;
      encoding.scoreFeatures = score.features;
      output.push(encoding);
    });
  return output;
}

//FIXME this should be refactors
function finalTouch(encoding, stats, opt) {
  if (encoding.marktype === 'text' && opt.alwaysGenerateTableAsHeatmap) {
    encoding.enc.color = encoding.enc.text;
  }

  // don't include zero if stdev/avg < 0.01
  // https://github.com/uwdata/visrec/issues/69
  var enc = encoding.enc;
  ['x', 'y'].forEach(function(et) {
    var field = enc[et];
    if (field && vl.field.isMeasure(field) && !vl.field.isCount(field)) {
      var stat = stats[field.name];
      if (stat.stdev / stat.avg < 0.01) {
        field.scale = {zero: false};
      }
    }
  });
  return encoding;
}
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../consts":5,"../rank/rank":13,"./encs":8,"./marktypes":10}],8:[function(require,module,exports){
(function (global){
"use strict";

var vl = (typeof window !== "undefined" ? window.vl : typeof global !== "undefined" ? global.vl : null),
  globals = require('../globals'),
  util = require('../util'),
  consts = require('../consts'),
  genMarkTypes = require('./marktypes'),
  isDimension = vl.field.isDimension,
  isMeasure = vl.field.isMeasure;

module.exports = genEncs;

// FIXME remove dimension, measure and use information in vegalite instead!
var rules = {
  x: {
    dimension: true,
    measure: true,
    multiple: true //FIXME should allow multiple only for Q, T
  },
  y: {
    dimension: true,
    measure: true,
    multiple: true //FIXME should allow multiple only for Q, T
  },
  row: {
    dimension: true,
    multiple: true
  },
  col: {
    dimension: true,
    multiple: true
  },
  shape: {
    dimension: true,
    rules: shapeRules
  },
  size: {
    measure: true,
    rules: retinalEncRules
  },
  color: {
    dimension: true,
    measure: true,
    rules: colorRules
  },
  alpha: {
    measure: true,
    rules: retinalEncRules
  },
  text: {
    measure: true
  },
  detail: {
    dimension: true
  }
  //geo: {
  //  geo: true
  //},
  //arc: { // pie
  //
  //}
};

function retinalEncRules(enc, field, stats, opt) {
  if (opt.omitMultipleRetinalEncodings) {
    if (enc.color || enc.size || enc.shape || enc.alpha) return false;
  }
  return true;
}

function colorRules(enc, field, stats, opt) {
  if(!retinalEncRules(enc, field, stats, opt)) return false;

  return vl.field.isMeasure(field) ||
    vl.field.cardinality(field, stats) <= opt.maxCardinalityForColor;
}

function shapeRules(enc, field, stats, opt) {
  if(!retinalEncRules(enc, field, stats, opt)) return false;

  if (field.bin && field.type === 'Q') return false;
  if (field.fn && field.type === 'T') return false;
  return vl.field.cardinality(field, stats) <= opt.maxCardinalityForColor;
}

function dimMeaTransposeRule(enc) {
  // create horizontal histogram for ordinal
  if (enc.y.type === 'O' && isMeasure(enc.x)) return true;

  // vertical histogram for Q and T
  if (isMeasure(enc.y) && (enc.x.type !== 'O' && isDimension(enc.x))) return true;

  return false;
}

function generalRules(enc, stats, opt) {
  // enc.text is only used for TEXT TABLE
  if (enc.text) {
    return genMarkTypes.satisfyRules(enc, 'text', stats, opt);
  }

  // CARTESIAN PLOT OR MAP
  if (enc.x || enc.y || enc.geo || enc.arc) {

    if (enc.row || enc.col) { //have facet(s)

      // don't use facets before filling up x,y
      if (!enc.x || !enc.y) return false;

      if (opt.omitNonTextAggrWithAllDimsOnFacets) {
        // remove all aggregated charts with all dims on facets (row, col)
        if (genEncs.isAggrWithAllDimOnFacets(enc)) return false;
      }
    }

    if (enc.x && enc.y) {
      if (opt.omitTranpose) {
        if ((!!isDimension(enc.x)) ^ (!!isDimension(enc.y))) { // dim x mea
          if (!dimMeaTransposeRule(enc)) return false;
        } else if (enc.y.type==='T' || enc.x.type === 'T') {
          if (enc.y.type==='T' && enc.x.type !== 'T') return false;
        } else { // show only one OxO, QxQ
          if (enc.x.name > enc.y.name) return false;
        }
      }
      return true;
    }

    // DOT PLOTS
    // // plot with one axis = dot plot
    if (opt.omitDotPlot) return false;

    // Dot plot should always be horizontal
    if (opt.omitTranpose && enc.y) return false;

    // dot plot shouldn't have other encoding
    if (opt.omitDotPlotWithExtraEncoding && vl.keys(enc).length > 1) return false;

    // one dimension "count" is useless
    if (enc.x && enc.x.aggr == 'count' && !enc.y) return false;
    if (enc.y && enc.y.aggr == 'count' && !enc.x) return false;

    return true;
  }
  return false;
}

genEncs.isAggrWithAllDimOnFacets = function (enc) {
  var hasAggr = false, hasOtherO = false;
  for (var encType in enc) {
    var field = enc[encType];
    if (field.aggr) {
      hasAggr = true;
    }
    if (vl.field.isDimension(field) && (encType !== 'row' && encType !== 'col')) {
      hasOtherO = true;
    }
    if (hasAggr && hasOtherO) break;
  }

  return hasAggr && !hasOtherO;
};


function genEncs(encs, fields, stats, opt) {
  opt = vl.schema.util.extend(opt||{}, consts.gen.encodings);
  // generate a collection vegalite's enc
  var tmpEnc = {};

  function assignField(i) {
    // If all fields are assigned, save
    if (i === fields.length) {
      // at the minimal all chart should have x, y, geo, text or arc
      if (generalRules(tmpEnc, stats, opt)) {
        encs.push(vl.duplicate(tmpEnc));
      }
      return;
    }

    // Otherwise, assign i-th field
    var field = fields[i];
    for (var j in opt.encodingTypeList) {
      var et = opt.encodingTypeList[j],
        isDim = isDimension(field);

      //TODO: support "multiple" assignment
      if (!(et in tmpEnc) && // encoding not used
        ((isDim && rules[et].dimension) || (!isDim && rules[et].measure)) &&
        (!rules[et].rules || rules[et].rules(tmpEnc, field, stats, opt))
      ) {
        tmpEnc[et] = field;
        assignField(i + 1);
        delete tmpEnc[et];
      }
    }
  }

  assignField(0);

  return encs;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../consts":5,"../globals":12,"../util":15,"./marktypes":10}],9:[function(require,module,exports){
(function (global){
var vl = (typeof window !== "undefined" ? window.vl : typeof global !== "undefined" ? global.vl : null),
  util = require('../util');

var gen = module.exports = {
  // data variations
  aggregates: require('./aggregates'),
  projections: require('./projections'),
  // encodings / visual variatons
  encodings: require('./encodings'),
  encs: require('./encs'),
  marktypes: require('./marktypes')
};

//FIXME move these to vl
var AGGREGATION_FN = { //all possible aggregate function listed by each data type
  Q: vl.schema.aggr.supportedEnums.Q
};

var TRANSFORM_FN = { //all possible transform function listed by each data type
  // Q: ['log', 'sqrt', 'abs'], // "logit?"
  T: vl.schema.timefns
};

gen.charts = function(fields, opt, cfg, flat) {
  opt = util.gen.getOpt(opt);
  flat = flat === undefined ? {encodings: 1} : flat;

  // TODO generate

  // generate permutation of encoding mappings
  var fieldSets = opt.genAggr ? gen.aggregates([], fields, opt) : [fields],
    encs, charts, level = 0;

  if (flat === true || (flat && flat.aggr)) {
    encs = fieldSets.reduce(function(output, fields) {
      return gen.encs(output, fields, opt);
    }, []);
  } else {
    encs = fieldSets.map(function(fields) {
      return gen.encs([], fields, opt);
    }, true);
    level += 1;
  }

  if (flat === true || (flat && flat.encodings)) {
    charts = util.nestedReduce(encs, function(output, enc) {
      return gen.marktypes(output, enc, opt, cfg);
    }, level, true);
  } else {
    charts = util.nestedMap(encs, function(enc) {
      return gen.marktypes([], enc, opt, cfg);
    }, level, true);
    level += 1;
  }
  return charts;
};
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../util":15,"./aggregates":6,"./encodings":7,"./encs":8,"./marktypes":10,"./projections":11}],10:[function(require,module,exports){
(function (global){
"use strict";

var vl = (typeof window !== "undefined" ? window.vl : typeof global !== "undefined" ? global.vl : null),
  util = require('../util'),
  consts = require('../consts'),
  isDimension = vl.field.isDimension;

var vlmarktypes = module.exports = getMarktypes;

var marksRule = vlmarktypes.rule = {
  point:  pointRule,
  bar:    barRule,
  line:   lineRule,
  area:   areaRule, // area is similar to line
  text:   textRule,
  tick:   tickRule
};

function getMarktypes(enc, stats, opt) {
  opt = vl.schema.util.extend(opt||{}, consts.gen.encodings);

  var markTypes = opt.marktypeList.filter(function(markType){
    return vlmarktypes.satisfyRules(enc, markType, stats, opt);
  });

  return markTypes;
}

vlmarktypes.satisfyRules = function (enc, markType, stats, opt) {
  var mark = vl.compile.marks[markType],
    reqs = mark.requiredEncoding,
    support = mark.supportedEncoding;

  for (var i in reqs) { // all required encodings in enc
    if (!(reqs[i] in enc)) return false;
  }

  for (var encType in enc) { // all encodings in enc are supported
    if (!support[encType]) return false;
  }

  return !marksRule[markType] || marksRule[markType](enc, stats, opt);
};

function facetRule(field, stats, opt) {
  return vl.field.cardinality(field, stats) <= opt.maxCardinalityForFacets;
}

function facetsRule(enc, stats, opt) {
  if(enc.row && !facetRule(enc.row, stats, opt)) return false;
  if(enc.col && !facetRule(enc.col, stats, opt)) return false;
  return true;
}

function pointRule(enc, stats, opt) {
  if(!facetsRule(enc, stats, opt)) return false;
  if (enc.x && enc.y) {
    // have both x & y ==> scatter plot / bubble plot

    var xIsDim = isDimension(enc.x),
      yIsDim = isDimension(enc.y);

    // For OxO
    if (xIsDim && yIsDim) {
      // shape doesn't work with both x, y as ordinal
      if (enc.shape) {
        return false;
      }

      // TODO(kanitw): check that there is quant at least ...
      if (enc.color && isDimension(enc.color)) {
        return false;
      }
    }

  } else { // plot with one axis = dot plot
    if (opt.omitDotPlot) return false;

    // Dot plot should always be horizontal
    if (opt.omitTranpose && enc.y) return false;

    // dot plot shouldn't have other encoding
    if (opt.omitDotPlotWithExtraEncoding && vl.keys(enc).length > 1) return false;

    // dot plot with shape is non-sense
    if (enc.shape) return false;
  }
  return true;
}

function tickRule(enc, stats, opt) {
  if (enc.x || enc.y) {
    if(vl.enc.isAggregate(enc)) return false;

    var xIsDim = isDimension(enc.x),
      yIsDim = isDimension(enc.y);

    return (!xIsDim && (!enc.y || yIsDim)) ||
      (!yIsDim && (!enc.x || xIsDim));
  }
  return false;
}

function barRule(enc, stats, opt) {
  if(!facetsRule(enc, stats, opt)) return false;

  // need to aggregate on either x or y
  if (opt.omitSizeOnBar && enc.size !== undefined) return false;

  if (((enc.x.aggr !== undefined) ^ (enc.y.aggr !== undefined)) &&
      (isDimension(enc.x) ^ isDimension(enc.y))) {

    var aggr = enc.x.aggr || enc.y.aggr;
    return !(opt.omitStackedAverage && aggr ==='avg' && enc.color);
  }

  return false;
}

function lineRule(enc, stats, opt) {
  if(!facetsRule(enc, stats, opt)) return false;

  // TODO(kanitw): add omitVerticalLine as config

  // FIXME truly ordinal data is fine here too.
  // Line chart should be only horizontal
  // and use only temporal data
  return enc.x.type == 'T' && enc.x.fn && enc.y.type == 'Q' && enc.y.aggr;
}

function areaRule(enc, stats, opt) {
  if(!facetsRule(enc, stats, opt)) return false;

  if(!lineRule(enc, stats, opt)) return false;

  return !(opt.omitStackedAverage && enc.y.aggr ==='avg' && enc.color);
}

function textRule(enc, stats, opt) {
  // at least must have row or col and aggregated text values
  return (enc.row || enc.col) && enc.text && enc.text.aggr && !enc.x && !enc.y && !enc.size &&
    (!opt.alwaysGenerateTableAsHeatmap || !enc.color);
}
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../consts":5,"../util":15}],11:[function(require,module,exports){
(function (global){
var util = require('../util'),
  consts = require('../consts'),
  vl = (typeof window !== "undefined" ? window.vl : typeof global !== "undefined" ? global.vl : null),
  isDimension = vl.field.isDimension;

module.exports = projections;

// TODO support other mode of projections generation
// powerset, chooseK, chooseKorLess are already included in the util

/**
 * fields
 * @param  {[type]} fields array of fields and query information
 * @return {[type]}        [description]
 */
function projections(fields, stats, opt) {
  opt = vl.schema.util.extend(opt||{}, consts.gen.projections);

  // First categorize field, selected, fieldsToAdd, and save indices
  var selected = [], fieldsToAdd = [], fieldSets = [],
    hasSelectedDimension = false,
    hasSelectedMeasure = false,
    indices = {};

  fields.forEach(function(field, index){
    //save indices for stable sort later
    indices[field.name] = index;

    if (field.selected) {
      selected.push(field);
      if (isDimension(field)) {
        hasSelectedDimension = true;
      } else {
        hasSelectedMeasure = true;
      }
    } else if (!field.excluded && !vl.field.isCount(field)) {
      if (vl.field.isDimension(field) &&
          vl.field.cardinality(field, stats, 15) > opt.maxCardinalityForAutoAddOrdinal) {
        return;
      }
      fieldsToAdd.push(field);
    }
  });

  fieldsToAdd.sort(compareFieldsToAdd(hasSelectedDimension, hasSelectedMeasure, indices));

  var setsToAdd = util.chooseKorLess(fieldsToAdd, 1);

  setsToAdd.forEach(function(setToAdd) {
    var fieldSet = selected.concat(setToAdd);
    if (fieldSet.length > 0) {
      if (opt.omitDotPlot && fieldSet.length === 1) return;
      fieldSets.push(fieldSet);
    }
  });

  fieldSets.forEach(function(fieldSet) {
      // always append projection's key to each projection returned, d3 style.
    fieldSet.key = projections.key(fieldSet);
  });

  return fieldSets;
}

var typeIsMeasureScore = {
  O: 0,
  T: 1,
  Q: 2
};

function compareFieldsToAdd(hasSelectedDimension, hasSelectedMeasure, indices) {
  return function(a, b){
    var aIsDim = isDimension(a), bIsDim = isDimension(b);
    // sort by type of the data
    if (a.type !== b.type) {
      if (!hasSelectedDimension) {
        return typeIsMeasureScore[a.type] - typeIsMeasureScore[b.type];
      } else if (!hasSelectedMeasure) {
        return typeIsMeasureScore[b.type] - typeIsMeasureScore[a.type];
      }
    }
    //make the sort stable
    return indices[a.name] - indices[b.name];
  };
}

projections.key = function(projection) {
  return projection.map(function(field) {
    return vl.field.isCount(field) ? 'count' : field.name;
  }).join(',');
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../consts":5,"../util":15}],12:[function(require,module,exports){
(function (global){
var g = global || window;

g.CHART_TYPES = {
  TABLE: 'TABLE',
  BAR: 'BAR',
  PLOT: 'PLOT',
  LINE: 'LINE',
  AREA: 'AREA',
  MAP: 'MAP',
  HISTOGRAM: 'HISTOGRAM'
};

g.ANY_DATA_TYPES = (1 << 4) - 1;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],13:[function(require,module,exports){
var rank = module.exports = {
  encoding: require('./rankEncodings')
};



},{"./rankEncodings":14}],14:[function(require,module,exports){
(function (global){
var vl = (typeof window !== "undefined" ? window.vl : typeof global !== "undefined" ? global.vl : null);

module.exports = rankEncodings;

// bad score not specified in the table above
var UNUSED_POSITION = 0.5;

var MARK_SCORE = {
  line: 0.99,
  area: 0.98,
  bar: 0.97,
  tick: 0.96,
  point: 0.95,
  circle: 0.94,
  square: 0.94,
  text: 0.8
};

function rankEncodings(encoding, stats, opt, selected) {
  var features = [],
    encTypes = vl.keys(encoding.enc);

  var encodingMappingByField = vl.enc.reduce(encoding.enc, function(o, encType, field) {
    var key = vl.field.shorthand(field);
    var mappings = o[key] = o[key] || [];
    mappings.push({encType: encType, field: field});
    return o;
  }, {});

  vl.keys(encodingMappingByField).forEach(function(key) {
    var mappings = encodingMappingByField[key],
      reasons = mappings.map(function(m) {
        return m.encType + vl.shorthand.assign + vl.field.shorthand(m.field) +
          ' ' + (selected && selected[m.field.name] ? '[x]' : '[ ]');
      }),
      scores = mappings.map(function(m) {
        var role = vl.field.role(m.field);
        var score = rankEncodings.score[role](m.field, m.encType, encoding.marktype, stats, opt);

        return !selected || selected[m.field.name] ? score : Math.pow(score, 0.125);
      });

    features.push({
      reason: reasons.join(" | "),
      score: Math.max.apply(null, scores)
    });
  });

  // penalize not using positional only penalize for non-text
  if (encTypes.length > 1 && encoding.marktype !== 'text') {
    if ((!encoding.enc.x || !encoding.enc.y) && !encoding.enc.geo && !encoding.enc.text) {
      features.push({
        reason: 'unused position',
        score: UNUSED_POSITION
      });
    }
  }

  features.push({
    reason: 'marktype='+encoding.marktype,
    score: MARK_SCORE[encoding.marktype]
  });

  return {
    score: features.reduce(function(p, f) {
      return p * f.score;
    }, 1),
    features: features
  };
}


var D = {}, M = {}, BAD = 0.1, TERRIBLE = 0.01;

D.minor = 0.01;
D.pos = 1;
D.Y_T = 0.8;
D.facet_text = 1;
D.facet_good = 0.7;
D.facet_ok = 0.55;
D.facet_bad = 0.4;
D.color_good = 0.7;
D.color_ok = 0.65; // > M.Size
D.color_bad = 0.3;
D.color_stack = 0.6;
D.shape = 0.6;
D.detail = 0.5;
D.bad = BAD;
D.terrible = TERRIBLE;

M.pos = 1;
M.size = 0.6;
M.color = 0.5;
M.alpha = 0.45;
M.text = 0.4;
M.bad = BAD;
M.terrible = TERRIBLE;

rankEncodings.dimensionScore = function (field, encType, marktype, stats, opt){
  var cardinality = vl.field.cardinality(field, stats);
  switch (encType) {
    case 'x':
      if(field.type === 'O') return D.pos - D.minor;
      return D.pos;

    case 'y':
      if(field.type === 'O') return D.pos - D.minor; //prefer ordinal on y
      if(field.type === 'T') return D.Y_T; // time should not be on Y
      return D.pos - D.minor;

    case 'col':
      if (marktype === 'text') return D.facet_text;
      //prefer column over row due to scrolling issues
      return cardinality <= opt.maxGoodCardinalityForFacets ? D.facet_good :
        cardinality <= opt.maxCardinalityForFacets ? D.facet_ok : D.facet_bad;

    case 'row':
      if (marktype === 'text') return D.facet_text;
      return (cardinality <= opt.maxGoodCardinalityForFacets ? D.facet_good :
        cardinality <= opt.maxCardinalityForFacets ? D.facet_ok : D.facet_bad) - D.minor;

    case 'color':
      var hasOrder = (field.bin && field.type==='Q') || (field.fn && field.type==='T');

      //FIXME add stacking option once we have control ..
      var isStacked = marktype ==='bar' || marktype ==='area';

      // true ordinal on color is currently BAD (until we have good ordinal color scale support)
      if (hasOrder) return D.color_bad;

      //stacking gets lower score
      if (isStacked) return D.color_stack;

      return cardinality <= opt.maxGoodCardinalityForColor ? D.color_good: cardinality <= opt.maxCardinalityForColor ? D.color_ok : D.color_bad;
    case 'shape':
      return cardinality <= opt.maxCardinalityForShape ? D.shape : TERRIBLE;
    case 'detail':
      return D.detail;
  }
  return TERRIBLE;
};

rankEncodings.dimensionScore.consts = D;

rankEncodings.measureScore = function (field, encType, marktype, stats, opt) {
  switch (encType){
    case 'x': return M.pos;
    case 'y': return M.pos;
    case 'size':
      if (marktype === 'bar') return BAD; //size of bar is very bad
      if (marktype === 'text') return BAD;
      if (marktype === 'line') return BAD;
      return M.size;
    case 'color': return M.color;
    case 'alpha': return M.alpha;
    case 'text': return M.text;
  }
  return BAD;
};

rankEncodings.measureScore.consts = M;


rankEncodings.score = {
  dimension: rankEncodings.dimensionScore,
  measure: rankEncodings.measureScore,
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],15:[function(require,module,exports){
"use strict";

var consts = require('./consts');

var util = module.exports = {
  gen: {}
};

util.isArray = Array.isArray || function (obj) {
  return {}.toString.call(obj) == '[object Array]';
};

util.json = function(s, sp) {
  return JSON.stringify(s, null, sp);
};

util.keys = function(obj) {
  var k = [], x;
  for (x in obj) k.push(x);
  return k;
};

util.nestedMap = function (col, f, level, filter) {
  return level === 0 ?
    col.map(f) :
    col.map(function(v) {
      var r = util.nestedMap(v, f, level - 1);
      return filter ? r.filter(util.nonEmpty) : r;
    });
};

util.nestedReduce = function (col, f, level, filter) {
  return level === 0 ?
    col.reduce(f, []) :
    col.map(function(v) {
      var r = util.nestedReduce(v, f, level - 1);
      return filter ? r.filter(util.nonEmpty) : r;
    });
};

util.nonEmpty = function(grp) {
  return !util.isArray(grp) || grp.length > 0;
};


util.traverse = function (node, arr) {
  if (node.value !== undefined) {
    arr.push(node.value);
  } else {
    if (node.left) util.traverse(node.left, arr);
    if (node.right) util.traverse(node.right, arr);
  }
  return arr;
};

util.union = function (a, b) {
  var o = {};
  a.forEach(function(x) { o[x] = true;});
  b.forEach(function(x) { o[x] = true;});
  return util.keys(o);
};


util.gen.getOpt = function (opt) {
  //merge with default
  return (opt ? util.keys(opt) : []).reduce(function(c, k) {
    c[k] = opt[k];
    return c;
  }, Object.create(consts.gen.DEFAULT_OPT));
};

/**
 * powerset code from http://rosettacode.org/wiki/Power_Set#JavaScript
 *
 *   var res = powerset([1,2,3,4]);
 *
 * returns
 *
 * [[],[1],[2],[1,2],[3],[1,3],[2,3],[1,2,3],[4],[1,4],
 * [2,4],[1,2,4],[3,4],[1,3,4],[2,3,4],[1,2,3,4]]
[edit]
*/

util.powerset = function(list) {
  var ps = [
    []
  ];
  for (var i = 0; i < list.length; i++) {
    for (var j = 0, len = ps.length; j < len; j++) {
      ps.push(ps[j].concat(list[i]));
    }
  }
  return ps;
};

util.chooseKorLess = function(list, k) {
  var subset = [[]];
  for (var i = 0; i < list.length; i++) {
    for (var j = 0, len = subset.length; j < len; j++) {
      var sub = subset[j].concat(list[i]);
      if(sub.length <= k){
        subset.push(sub);
      }
    }
  }
  return subset;
};

util.chooseK = function(list, k) {
  var subset = [[]];
  var kArray =[];
  for (var i = 0; i < list.length; i++) {
    for (var j = 0, len = subset.length; j < len; j++) {
      var sub = subset[j].concat(list[i]);
      if(sub.length < k){
        subset.push(sub);
      }else if (sub.length === k){
        kArray.push(sub);
      }
    }
  }
  return kArray;
};

util.cross = function(a,b){
  var x = [];
  for(var i=0; i< a.length; i++){
    for(var j=0;j< b.length; j++){
      x.push(a[i].concat(b[j]));
    }
  }
  return x;
};


},{"./consts":5}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvdnIiLCJzcmMvY2x1c3Rlci9jbHVzdGVyLmpzIiwic3JjL2NsdXN0ZXIvY2x1c3RlcmNvbnN0cy5qcyIsInNyYy9jbHVzdGVyL2Rpc3RhbmNlLmpzIiwic3JjL2NvbnN0cy5qcyIsInNyYy9nZW4vYWdncmVnYXRlcy5qcyIsInNyYy9nZW4vZW5jb2RpbmdzLmpzIiwic3JjL2dlbi9lbmNzLmpzIiwic3JjL2dlbi9nZW4uanMiLCJzcmMvZ2VuL21hcmt0eXBlcy5qcyIsInNyYy9nZW4vcHJvamVjdGlvbnMuanMiLCJzcmMvZ2xvYmFscy5qcyIsInNyYy9yYW5rL3JhbmsuanMiLCJzcmMvcmFuay9yYW5rRW5jb2RpbmdzLmpzIiwic3JjL3V0aWwuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3RDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDekVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMzS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNuS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUMxREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDek1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDdkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDOUlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDM0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN2S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciB2ciA9IG1vZHVsZS5leHBvcnRzID0ge1xuICBjbHVzdGVyOiByZXF1aXJlKCcuL2NsdXN0ZXIvY2x1c3RlcicpLFxuICBnZW46IHJlcXVpcmUoJy4vZ2VuL2dlbicpLFxuICByYW5rOiByZXF1aXJlKCcuL3JhbmsvcmFuaycpLFxuICB1dGlsOiByZXF1aXJlKCcuL3V0aWwnKVxufTtcblxuXG4iLCJcInVzZSBzdHJpY3RcIjtcblxubW9kdWxlLmV4cG9ydHMgPSBjbHVzdGVyO1xuXG52YXIgdmwgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdy52bCA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwudmwgOiBudWxsKSxcbiAgY2x1c3RlcmZjayA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93LmNsdXN0ZXJmY2sgOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsLmNsdXN0ZXJmY2sgOiBudWxsKSxcbiAgY29uc3RzID0gcmVxdWlyZSgnLi9jbHVzdGVyY29uc3RzJyksXG4gIHV0aWwgPSByZXF1aXJlKCcuLi91dGlsJyk7XG5cbmNsdXN0ZXIuZGlzdGFuY2UgPSByZXF1aXJlKCcuL2Rpc3RhbmNlJyk7XG5cbmZ1bmN0aW9uIGNsdXN0ZXIoZW5jb2RpbmdzLCBvcHQpIHtcbiAgdmFyIGRpc3QgPSBjbHVzdGVyLmRpc3RhbmNlLnRhYmxlKGVuY29kaW5ncyk7XG5cbiAgdmFyIGNsdXN0ZXJUcmVlcyA9IGNsdXN0ZXJmY2suaGNsdXN0ZXIoZW5jb2RpbmdzLCBmdW5jdGlvbihlMSwgZTIpIHtcbiAgICB2YXIgczEgPSB2bC5FbmNvZGluZy5zaG9ydGhhbmQoZTEpLFxuICAgICAgczIgPSB2bC5FbmNvZGluZy5zaG9ydGhhbmQoZTIpO1xuICAgIHJldHVybiBkaXN0W3MxXVtzMl07XG4gIH0sICdhdmVyYWdlJywgY29uc3RzLkNMVVNURVJfVEhSRVNIT0xEKTtcblxuICB2YXIgY2x1c3RlcnMgPSBjbHVzdGVyVHJlZXMubWFwKGZ1bmN0aW9uKHRyZWUpIHtcbiAgICAgIHJldHVybiB1dGlsLnRyYXZlcnNlKHRyZWUsIFtdKTtcbiAgICB9KVxuICAgLm1hcChmdW5jdGlvbihjbHVzdGVyKSB7XG4gICAgcmV0dXJuIGNsdXN0ZXIuc29ydChmdW5jdGlvbihlbmNvZGluZzEsIGVuY29kaW5nMikge1xuICAgICAgLy8gc29ydCBlYWNoIGNsdXN0ZXIgLS0gaGF2ZSB0aGUgaGlnaGVzdCBzY29yZSBhcyAxc3QgaXRlbVxuICAgICAgcmV0dXJuIGVuY29kaW5nMi5zY29yZSAtIGVuY29kaW5nMS5zY29yZTtcbiAgICB9KTtcbiAgfSkuZmlsdGVyKGZ1bmN0aW9uKGNsdXN0ZXIpIHsgIC8vIGZpbHRlciBlbXB0eSBjbHVzdGVyXG4gICAgcmV0dXJuIGNsdXN0ZXIubGVuZ3RoID4wO1xuICB9KS5zb3J0KGZ1bmN0aW9uKGNsdXN0ZXIxLCBjbHVzdGVyMikge1xuICAgIC8vc29ydCBieSBoaWdoZXN0IHNjb3JpbmcgaXRlbSBpbiBlYWNoIGNsdXN0ZXJcbiAgICByZXR1cm4gY2x1c3RlcjJbMF0uc2NvcmUgLSBjbHVzdGVyMVswXS5zY29yZTtcbiAgfSk7XG5cbiAgY2x1c3RlcnMuZGlzdCA9IGRpc3Q7IC8vYXBwZW5kIGRpc3QgaW4gdGhlIGFycmF5IGZvciBkZWJ1Z2dpbmdcblxuICByZXR1cm4gY2x1c3RlcnM7XG59IiwidmFyIGMgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG5jLlNXQVBQQUJMRSA9IDAuMDU7XG5jLkRJU1RfTUlTU0lORyA9IDE7XG5jLkNMVVNURVJfVEhSRVNIT0xEID0gMTtcblxuZnVuY3Rpb24gcmVkdWNlVHVwbGVUb1RhYmxlKHIsIHgpIHtcbiAgdmFyIGEgPSB4WzBdLCBiID0geFsxXSwgZCA9IHhbMl07XG4gIHJbYV0gPSByW2FdIHx8IHt9O1xuICByW2JdID0gcltiXSB8fCB7fTtcbiAgclthXVtiXSA9IHJbYl1bYV0gPSBkO1xuICByZXR1cm4gcjtcbn1cblxuYy5ESVNUX0JZX0VOQ1RZUEUgPSBbXG4gIC8vIHBvc2l0aW9uYWxcbiAgWyd4JywgJ3knLCBjLlNXQVBQQUJMRV0sXG4gIFsncm93JywgJ2NvbCcsIGMuU1dBUFBBQkxFXSxcblxuICAvLyBvcmRpbmFsIG1hcmsgcHJvcGVydGllc1xuICBbJ2NvbG9yJywgJ3NoYXBlJywgYy5TV0FQUEFCTEVdLFxuICBbJ2NvbG9yJywgJ2RldGFpbCcsIGMuU1dBUFBBQkxFXSxcbiAgWydkZXRhaWwnLCAnc2hhcGUnLCBjLlNXQVBQQUJMRV0sXG5cbiAgLy8gcXVhbnRpdGF0aXZlIG1hcmsgcHJvcGVydGllc1xuICBbJ2NvbG9yJywgJ2FscGhhJywgYy5TV0FQUEFCTEVdLFxuICBbJ3NpemUnLCAnYWxwaGEnLCBjLlNXQVBQQUJMRV0sXG4gIFsnc2l6ZScsICdjb2xvcicsIGMuU1dBUFBBQkxFXVxuXS5yZWR1Y2UocmVkdWNlVHVwbGVUb1RhYmxlLCB7fSk7XG4iLCJ2YXIgdmwgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdy52bCA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwudmwgOiBudWxsKSxcbiAgY29uc3RzID0gcmVxdWlyZSgnLi9jbHVzdGVyY29uc3RzJyksXG4gIHV0aWwgPSByZXF1aXJlKCcuLi91dGlsJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZGlzdGFuY2UgPSB7fTtcblxuZGlzdGFuY2UudGFibGUgPSBmdW5jdGlvbiAoZW5jb2RpbmdzKSB7XG4gIHZhciBsZW4gPSBlbmNvZGluZ3MubGVuZ3RoLFxuICAgIGNvbGVuY3MgPSBlbmNvZGluZ3MubWFwKGZ1bmN0aW9uKGUpIHsgcmV0dXJuIGRpc3RhbmNlLmdldEVuY1R5cGVCeUNvbHVtbk5hbWUoZSk7IH0pLFxuICAgIHNob3J0aGFuZHMgPSBlbmNvZGluZ3MubWFwKHZsLkVuY29kaW5nLnNob3J0aGFuZCksXG4gICAgZGlmZiA9IHt9LCBpLCBqO1xuXG4gIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykgZGlmZltzaG9ydGhhbmRzW2ldXSA9IHt9O1xuXG4gIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgIGZvciAoaiA9IGkgKyAxOyBqIDwgbGVuOyBqKyspIHtcbiAgICAgIHZhciBzaiA9IHNob3J0aGFuZHNbal0sIHNpID0gc2hvcnRoYW5kc1tpXTtcblxuICAgICAgZGlmZltzal1bc2ldID0gZGlmZltzaV1bc2pdID0gZGlzdGFuY2UuZ2V0KGNvbGVuY3NbaV0sIGNvbGVuY3Nbal0pO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZGlmZjtcbn07XG5cbmRpc3RhbmNlLmdldCA9IGZ1bmN0aW9uIChjb2xlbmMxLCBjb2xlbmMyKSB7XG4gIHZhciBjb2xzID0gdXRpbC51bmlvbih2bC5rZXlzKGNvbGVuYzEuY29sKSwgdmwua2V5cyhjb2xlbmMyLmNvbCkpLFxuICAgIGRpc3QgPSAwO1xuXG4gIGNvbHMuZm9yRWFjaChmdW5jdGlvbihjb2wpIHtcbiAgICB2YXIgZTEgPSBjb2xlbmMxLmNvbFtjb2xdLCBlMiA9IGNvbGVuYzIuY29sW2NvbF07XG5cbiAgICBpZiAoZTEgJiYgZTIpIHtcbiAgICAgIGlmIChlMS5lbmNUeXBlICE9IGUyLmVuY1R5cGUpIHtcbiAgICAgICAgZGlzdCArPSAoY29uc3RzLkRJU1RfQllfRU5DVFlQRVtlMS5lbmNUeXBlXSB8fCB7fSlbZTIuZW5jVHlwZV0gfHwgMTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZGlzdCArPSBjb25zdHMuRElTVF9NSVNTSU5HO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gZG8gbm90IGdyb3VwIHN0YWNrZWQgY2hhcnQgd2l0aCBzaW1pbGFyIG5vbi1zdGFja2VkIGNoYXJ0IVxuICB2YXIgaXNTdGFjazEgPSB2bC5FbmNvZGluZy5pc1N0YWNrKGNvbGVuYzEpLFxuICAgIGlzU3RhY2syID0gdmwuRW5jb2RpbmcuaXNTdGFjayhjb2xlbmMyKTtcblxuICBpZihpc1N0YWNrMSB8fCBpc1N0YWNrMikge1xuICAgIGlmKGlzU3RhY2sxICYmIGlzU3RhY2syKSB7XG4gICAgICBpZihjb2xlbmMxLmVuYy5jb2xvci5uYW1lICE9PSBjb2xlbmMyLmVuYy5jb2xvci5uYW1lKSB7XG4gICAgICAgIGRpc3QrPTE7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGRpc3QrPTE7IC8vIHN1cmVseSBkaWZmZXJlbnRcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGRpc3Q7XG59O1xuXG4vLyBnZXQgZW5jb2RpbmcgdHlwZSBieSBmaWVsZG5hbWVcbmRpc3RhbmNlLmdldEVuY1R5cGVCeUNvbHVtbk5hbWUgPSBmdW5jdGlvbihlbmNvZGluZykge1xuICB2YXIgX2NvbGVuYyA9IHt9LFxuICAgIGVuYyA9IGVuY29kaW5nLmVuYztcblxuICB2bC5rZXlzKGVuYykuZm9yRWFjaChmdW5jdGlvbihlbmNUeXBlKSB7XG4gICAgdmFyIGUgPSB2bC5kdXBsaWNhdGUoZW5jW2VuY1R5cGVdKTtcbiAgICBlLmVuY1R5cGUgPSBlbmNUeXBlO1xuICAgIF9jb2xlbmNbZS5uYW1lIHx8ICcnXSA9IGU7XG4gICAgZGVsZXRlIGUubmFtZTtcbiAgfSk7XG5cbiAgcmV0dXJuIHtcbiAgICBtYXJrdHlwZTogZW5jb2RpbmcubWFya3R5cGUsXG4gICAgY29sOiBfY29sZW5jLFxuICAgIGVuYzogZW5jb2RpbmcuZW5jXG4gIH07XG59OyIsInZhciBjb25zdHMgPSBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgZ2VuOiB7fSxcbiAgY2x1c3Rlcjoge30sXG4gIHJhbms6IHt9XG59O1xuXG5jb25zdHMuZ2VuLnByb2plY3Rpb25zID0ge1xuICB0eXBlOiAnb2JqZWN0JyxcbiAgcHJvcGVydGllczoge1xuICAgIG9taXREb3RQbG90OiB7IC8vRklYTUUgcmVtb3ZlIHRoaXMhXG4gICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICBkZWZhdWx0OiBmYWxzZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAncmVtb3ZlIGFsbCBkb3QgcGxvdHMnXG4gICAgfSxcbiAgICBtYXhDYXJkaW5hbGl0eUZvckF1dG9BZGRPcmRpbmFsOiB7XG4gICAgICB0eXBlOiAnaW50ZWdlcicsXG4gICAgICBkZWZhdWx0OiA1MCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnbWF4IGNhcmRpbmFsaXR5IGZvciBvcmRpbmFsIGZpZWxkIHRvIGJlIGNvbnNpZGVyZWQgZm9yIGF1dG8gYWRkaW5nJ1xuICAgIH0sXG4gICAgYWx3YXlzQWRkSGlzdG9ncmFtOiB7XG4gICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICBkZWZhdWx0OiB0cnVlXG4gICAgfVxuICB9XG59O1xuXG5jb25zdHMuZ2VuLmFnZ3JlZ2F0ZXMgPSB7XG4gIHR5cGU6ICdvYmplY3QnLFxuICBwcm9wZXJ0aWVzOiB7XG4gICAgdGFibGVUeXBlczoge1xuICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgZGVmYXVsdDogJ2JvdGgnLFxuICAgICAgZW51bTogWydib3RoJywgJ2FnZ3JlZ2F0ZWQnLCAnZGlzYWdncmVnYXRlZCddXG4gICAgfSxcbiAgICBnZW5EaW1ROiB7XG4gICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgIGRlZmF1bHQ6ICdhdXRvJyxcbiAgICAgIGVudW06IFsnYXV0bycsICdiaW4nLCAnY2FzdCcsICdub25lJ10sXG4gICAgICBkZXNjcmlwdGlvbjogJ1VzZSBRIGFzIERpbWVuc2lvbiBlaXRoZXIgYnkgYmlubmluZyBvciBjYXN0aW5nJ1xuICAgIH0sXG4gICAgbWluQ2FyZGluYWxpdHlGb3JCaW46IHtcbiAgICAgIHR5cGU6ICdpbnRlZ2VyJyxcbiAgICAgIGRlZmF1bHQ6IDIwLFxuICAgICAgZGVzY3JpcHRpb246ICdtaW5pbXVtIGNhcmRpbmFsaXR5IG9mIGEgZmllbGQgaWYgd2Ugd2VyZSB0byBiaW4nXG4gICAgfSxcbiAgICBvbWl0RG90UGxvdDoge1xuICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgZGVmYXVsdDogZmFsc2UsXG4gICAgICBkZXNjcmlwdGlvbjogJ3JlbW92ZSBhbGwgZG90IHBsb3RzJ1xuICAgIH0sXG4gICAgb21pdE1lYXN1cmVPbmx5OiB7XG4gICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICBkZWZhdWx0OiB0cnVlLFxuICAgICAgZGVzY3JpcHRpb246ICdPbWl0IGFnZ3JlZ2F0aW9uIHdpdGggbWVhc3VyZShzKSBvbmx5J1xuICAgIH0sXG4gICAgb21pdERpbWVuc2lvbk9ubHk6IHtcbiAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgIGRlZmF1bHQ6IHRydWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ09taXQgYWdncmVnYXRpb24gd2l0aCBkaW1lbnNpb24ocykgb25seSdcbiAgICB9LFxuICAgIGFkZENvdW50Rm9yRGltZW5zaW9uT25seToge1xuICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgZGVmYXVsdDogdHJ1ZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWRkIGNvdW50IHdoZW4gdGhlcmUgYXJlIGRpbWVuc2lvbihzKSBvbmx5J1xuICAgIH0sXG4gICAgYWdnckxpc3Q6IHtcbiAgICAgIHR5cGU6ICdhcnJheScsXG4gICAgICBpdGVtczoge1xuICAgICAgICB0eXBlOiBbJ3N0cmluZyddXG4gICAgICB9LFxuICAgICAgZGVmYXVsdDogW3VuZGVmaW5lZCwgJ2F2ZyddXG4gICAgfSxcbiAgICB0aW1lRm5MaXN0OiB7XG4gICAgICB0eXBlOiAnYXJyYXknLFxuICAgICAgaXRlbXM6IHtcbiAgICAgICAgdHlwZTogWydzdHJpbmcnXVxuICAgICAgfSxcbiAgICAgIGRlZmF1bHQ6IFsneWVhciddXG4gICAgfSxcbiAgICBjb25zaXN0ZW50QXV0b1E6IHtcbiAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgIGRlZmF1bHQ6IHRydWUsXG4gICAgICBkZXNjcmlwdGlvbjogXCJnZW5lcmF0ZSBzaW1pbGFyIGF1dG8gdHJhbnNmb3JtIGZvciBxdWFudFwiXG4gICAgfVxuICB9XG59O1xuXG5jb25zdHMuZ2VuLmVuY29kaW5ncyA9IHtcbiAgdHlwZTogJ29iamVjdCcsXG4gIHByb3BlcnRpZXM6IHtcbiAgICBtYXJrdHlwZUxpc3Q6IHtcbiAgICAgIHR5cGU6ICdhcnJheScsXG4gICAgICBpdGVtczoge3R5cGU6ICdzdHJpbmcnfSxcbiAgICAgIGRlZmF1bHQ6IFsncG9pbnQnLCAnYmFyJywgJ2xpbmUnLCAnYXJlYScsICd0ZXh0JywgJ3RpY2snXSwgLy9maWxsZWRfbWFwXG4gICAgICBkZXNjcmlwdGlvbjogJ2FsbG93ZWQgbWFya3R5cGVzJ1xuICAgIH0sXG4gICAgZW5jb2RpbmdUeXBlTGlzdDoge1xuICAgICAgdHlwZTogJ2FycmF5JyxcbiAgICAgIGl0ZW1zOiB7dHlwZTogJ3N0cmluZyd9LFxuICAgICAgZGVmYXVsdDogWyd4JywgJ3knLCAncm93JywgJ2NvbCcsICdzaXplJywgJ2NvbG9yJywgJ3RleHQnLCAnZGV0YWlsJ10sXG4gICAgICBkZXNjcmlwdGlvbjogJ2FsbG93ZWQgZW5jb2RpbmcgdHlwZXMnXG4gICAgfSxcbiAgICBtYXhHb29kQ2FyZGluYWxpdHlGb3JGYWNldHM6IHtcbiAgICAgIHR5cGU6ICdpbnRlZ2VyJyxcbiAgICAgIGRlZmF1bHQ6IDUsXG4gICAgICBkZXNjcmlwdGlvbjogJ21heGltdW0gY2FyZGluYWxpdHkgb2YgYSBmaWVsZCB0byBiZSBwdXQgb24gZmFjZXQgKHJvdy9jb2wpIGVmZmVjdGl2ZWx5J1xuICAgIH0sXG4gICAgbWF4Q2FyZGluYWxpdHlGb3JGYWNldHM6IHtcbiAgICAgIHR5cGU6ICdpbnRlZ2VyJyxcbiAgICAgIGRlZmF1bHQ6IDIwLFxuICAgICAgZGVzY3JpcHRpb246ICdtYXhpbXVtIGNhcmRpbmFsaXR5IG9mIGEgZmllbGQgdG8gYmUgcHV0IG9uIGZhY2V0IChyb3cvY29sKSdcbiAgICB9LFxuICAgIG1heEdvb2RDYXJkaW5hbGl0eUZvckNvbG9yOiB7XG4gICAgICB0eXBlOiAnaW50ZWdlcicsXG4gICAgICBkZWZhdWx0OiA3LFxuICAgICAgZGVzY3JpcHRpb246ICdtYXhpbXVtIGNhcmRpbmFsaXR5IG9mIGFuIG9yZGluYWwgZmllbGQgdG8gYmUgcHV0IG9uIGNvbG9yIGVmZmVjdGl2ZWx5J1xuICAgIH0sXG4gICAgbWF4Q2FyZGluYWxpdHlGb3JDb2xvcjoge1xuICAgICAgdHlwZTogJ2ludGVnZXInLFxuICAgICAgZGVmYXVsdDogMjAsXG4gICAgICBkZXNjcmlwdGlvbjogJ21heGltdW0gY2FyZGluYWxpdHkgb2YgYW4gb3JkaW5hbCBmaWVsZCB0byBiZSBwdXQgb24gY29sb3InXG4gICAgfSxcbiAgICBtYXhDYXJkaW5hbGl0eUZvclNoYXBlOiB7XG4gICAgICB0eXBlOiAnaW50ZWdlcicsXG4gICAgICBkZWZhdWx0OiA2LFxuICAgICAgZGVzY3JpcHRpb246ICdtYXhpbXVtIGNhcmRpbmFsaXR5IG9mIGFuIG9yZGluYWwgZmllbGQgdG8gYmUgcHV0IG9uIHNoYXBlJ1xuICAgIH0sXG4gICAgb21pdFRyYW5wb3NlOiAge1xuICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgZGVmYXVsdDogdHJ1ZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRWxpbWluYXRlIGFsbCB0cmFuc3Bvc2UgYnkgKDEpIGtlZXBpbmcgaG9yaXpvbnRhbCBkb3QgcGxvdCBvbmx5ICgyKSBmb3IgT3hRIGNoYXJ0cywgYWx3YXlzIHB1dCBPIG9uIFkgKDMpIHNob3cgb25seSBvbmUgRHhELCBNeE0gKGN1cnJlbnRseSBzb3J0ZWQgYnkgbmFtZSknXG4gICAgfSxcbiAgICBvbWl0RG90UGxvdDoge1xuICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgZGVmYXVsdDogZmFsc2UsXG4gICAgICBkZXNjcmlwdGlvbjogJ3JlbW92ZSBhbGwgZG90IHBsb3RzJ1xuICAgIH0sXG4gICAgb21pdERvdFBsb3RXaXRoRXh0cmFFbmNvZGluZzoge1xuICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgZGVmYXVsdDogdHJ1ZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAncmVtb3ZlIGFsbCBkb3QgcGxvdHMgd2l0aCA+MSBlbmNvZGluZydcbiAgICB9LFxuICAgIG9taXRNdWx0aXBsZVJldGluYWxFbmNvZGluZ3M6IHtcbiAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgIGRlZmF1bHQ6IHRydWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ29taXQgdXNpbmcgbXVsdGlwbGUgcmV0aW5hbCB2YXJpYWJsZXMgKHNpemUsIGNvbG9yLCBhbHBoYSwgc2hhcGUpJ1xuICAgIH0sXG4gICAgb21pdE5vblRleHRBZ2dyV2l0aEFsbERpbXNPbkZhY2V0czoge1xuICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgZGVmYXVsdDogdHJ1ZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAncmVtb3ZlIGFsbCBhZ2dyZWdhdGVkIGNoYXJ0cyAoZXhjZXB0IHRleHQgdGFibGVzKSB3aXRoIGFsbCBkaW1zIG9uIGZhY2V0cyAocm93LCBjb2wpJ1xuICAgIH0sXG4gICAgb21pdFNpemVPbkJhcjoge1xuICAgICAgdHlwZTogJ2Jvb2xlYW4nLFxuICAgICAgZGVmYXVsdDogZmFsc2UsXG4gICAgICBkZXNjcmlwdGlvbjogJ2RvIG5vdCB1c2UgYmFyXFwncyBzaXplJ1xuICAgIH0sXG4gICAgb21pdFN0YWNrZWRBdmVyYWdlOiB7XG4gICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICBkZWZhdWx0OiB0cnVlLFxuICAgICAgZGVzY3JpcHRpb246ICdkbyBub3Qgc3RhY2sgYmFyIGNoYXJ0IHdpdGggYXZlcmFnZSdcbiAgICB9LFxuICAgIGFsd2F5c0dlbmVyYXRlVGFibGVBc0hlYXRtYXA6IHtcbiAgICAgIHR5cGU6ICdib29sZWFuJyxcbiAgICAgIGRlZmF1bHQ6IHRydWVcbiAgICB9XG4gIH1cbn07XG5cblxuXG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB2bCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93LnZsIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbC52bCA6IG51bGwpO1xuXG52YXIgdXRpbCA9IHJlcXVpcmUoJy4uL3V0aWwnKSxcbiAgY29uc3RzID0gcmVxdWlyZSgnLi4vY29uc3RzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZ2VuQWdncmVnYXRlcztcblxuZnVuY3Rpb24gZ2VuQWdncmVnYXRlcyhvdXRwdXQsIGZpZWxkcywgc3RhdHMsIG9wdCkge1xuICBvcHQgPSB2bC5zY2hlbWEudXRpbC5leHRlbmQob3B0fHx7fSwgY29uc3RzLmdlbi5hZ2dyZWdhdGVzKTtcbiAgdmFyIHRmID0gbmV3IEFycmF5KGZpZWxkcy5sZW5ndGgpO1xuICB2YXIgaGFzTyA9IHZsLmFueShmaWVsZHMsIGZ1bmN0aW9uKGYpIHtcbiAgICByZXR1cm4gZi50eXBlID09PSAnTyc7XG4gIH0pO1xuXG4gIGZ1bmN0aW9uIGVtaXQoZmllbGRTZXQpIHtcbiAgICBmaWVsZFNldCA9IHZsLmR1cGxpY2F0ZShmaWVsZFNldCk7XG4gICAgZmllbGRTZXQua2V5ID0gdmwuZmllbGQuc2hvcnRoYW5kcyhmaWVsZFNldCk7XG4gICAgb3V0cHV0LnB1c2goZmllbGRTZXQpO1xuICB9XG5cbiAgZnVuY3Rpb24gY2hlY2tBbmRQdXNoKCkge1xuICAgIGlmIChvcHQub21pdE1lYXN1cmVPbmx5IHx8IG9wdC5vbWl0RGltZW5zaW9uT25seSkge1xuICAgICAgdmFyIGhhc01lYXN1cmUgPSBmYWxzZSwgaGFzRGltZW5zaW9uID0gZmFsc2UsIGhhc1JhdyA9IGZhbHNlO1xuICAgICAgdGYuZm9yRWFjaChmdW5jdGlvbihmKSB7XG4gICAgICAgIGlmICh2bC5maWVsZC5pc0RpbWVuc2lvbihmKSkge1xuICAgICAgICAgIGhhc0RpbWVuc2lvbiA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaGFzTWVhc3VyZSA9IHRydWU7XG4gICAgICAgICAgaWYgKCFmLmFnZ3IpIGhhc1JhdyA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgaWYgKCFoYXNEaW1lbnNpb24gJiYgIWhhc1JhdyAmJiBvcHQub21pdE1lYXN1cmVPbmx5KSByZXR1cm47XG4gICAgICBpZiAoIWhhc01lYXN1cmUpIHtcbiAgICAgICAgaWYgKG9wdC5hZGRDb3VudEZvckRpbWVuc2lvbk9ubHkpIHtcbiAgICAgICAgICB0Zi5wdXNoKHZsLmZpZWxkLmNvdW50KCkpO1xuICAgICAgICAgIGVtaXQodGYpO1xuICAgICAgICAgIHRmLnBvcCgpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcHQub21pdERpbWVuc2lvbk9ubHkpIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKG9wdC5vbWl0RG90UGxvdCAmJiB0Zi5sZW5ndGggPT09IDEpIHJldHVybjtcbiAgICBlbWl0KHRmKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFzc2lnbkFnZ3JRKGksIGhhc0FnZ3IsIGF1dG9Nb2RlLCBhKSB7XG4gICAgdmFyIGNhbkhhdmVBZ2dyID0gaGFzQWdnciA9PT0gdHJ1ZSB8fCBoYXNBZ2dyID09PSBudWxsLFxuICAgICAgY2FudEhhdmVBZ2dyID0gaGFzQWdnciA9PT0gZmFsc2UgfHwgaGFzQWdnciA9PT0gbnVsbDtcbiAgICBpZiAoYSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAoY2FuSGF2ZUFnZ3IpIHtcbiAgICAgICAgdGZbaV0uYWdnciA9IGE7XG4gICAgICAgIGFzc2lnbkZpZWxkKGkgKyAxLCB0cnVlLCBhdXRvTW9kZSk7XG4gICAgICAgIGRlbGV0ZSB0ZltpXS5hZ2dyO1xuICAgICAgfVxuICAgIH0gZWxzZSB7IC8vIGlmKGEgPT09IHVuZGVmaW5lZClcbiAgICAgIGlmIChjYW50SGF2ZUFnZ3IpIHtcbiAgICAgICAgYXNzaWduRmllbGQoaSArIDEsIGZhbHNlLCBhdXRvTW9kZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gYXNzaWduQmluUShpLCBoYXNBZ2dyLCBhdXRvTW9kZSkge1xuICAgIHRmW2ldLmJpbiA9IHRydWU7XG4gICAgYXNzaWduRmllbGQoaSArIDEsIGhhc0FnZ3IsIGF1dG9Nb2RlKTtcbiAgICBkZWxldGUgdGZbaV0uYmluO1xuICB9XG5cbiAgZnVuY3Rpb24gYXNzaWduUShpLCBoYXNBZ2dyLCBhdXRvTW9kZSkge1xuICAgIHZhciBmID0gZmllbGRzW2ldLFxuICAgICAgY2FuSGF2ZUFnZ3IgPSBoYXNBZ2dyID09PSB0cnVlIHx8IGhhc0FnZ3IgPT09IG51bGw7XG5cbiAgICB0ZltpXSA9IHtuYW1lOiBmLm5hbWUsIHR5cGU6IGYudHlwZX07XG5cbiAgICBpZiAoZi5hZ2dyID09PSAnY291bnQnKSB7IC8vIGlmIGNvdW50IGlzIGluY2x1ZGVkIGluIHRoZSBzZWxlY3RlZCBmaWVsZHNcbiAgICAgIGlmIChjYW5IYXZlQWdncikge1xuICAgICAgICB0ZltpXS5hZ2dyID0gZi5hZ2dyO1xuICAgICAgICBhc3NpZ25GaWVsZChpICsgMSwgdHJ1ZSwgYXV0b01vZGUpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZi5fYWdncikge1xuICAgICAgYXNzaWduQWdnclEoaSwgaGFzQWdnciwgYXV0b01vZGUsIGYuX2FnZ3IpO1xuICAgIH0gZWxzZSBpZiAoZi5fcmF3KSB7XG4gICAgICBhc3NpZ25BZ2dyUShpLCBoYXNBZ2dyLCBhdXRvTW9kZSwgdW5kZWZpbmVkKTtcbiAgICB9IGVsc2UgaWYgKGYuX2Jpbikge1xuICAgICAgYXNzaWduQmluUShpLCBoYXNBZ2dyLCBhdXRvTW9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9wdC5hZ2dyTGlzdC5mb3JFYWNoKGZ1bmN0aW9uKGEpIHtcbiAgICAgICAgaWYgKCFvcHQuY29uc2lzdGVudEF1dG9RIHx8IGF1dG9Nb2RlID09PSBudWxsIHx8IGF1dG9Nb2RlID09PSBhKSB7XG4gICAgICAgICAgYXNzaWduQWdnclEoaSwgaGFzQWdnciwgYSwgYSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBpZiAoKCFvcHQuY29uc2lzdGVudEF1dG9RIHx8IHZsLmlzaW4oYXV0b01vZGUsIFtudWxsLCAnYmluJywgJ2Nhc3QnLCAnYXV0b2Nhc3QnXSkpICYmICFoYXNPKSB7XG4gICAgICAgIHZhciBoaWdoQ2FyZGluYWxpdHkgPSB2bC5maWVsZC5jYXJkaW5hbGl0eShmLCBzdGF0cykgPiBvcHQubWluQ2FyZGluYWxpdHlGb3JCaW47XG5cbiAgICAgICAgdmFyIGlzQXV0byA9IG9wdC5nZW5EaW1RID09PSAnYXV0bycsXG4gICAgICAgICAgZ2VuQmluID0gb3B0LmdlbkRpbVEgID09PSAnYmluJyB8fCAoaXNBdXRvICYmIGhpZ2hDYXJkaW5hbGl0eSksXG4gICAgICAgICAgZ2VuQ2FzdCA9IG9wdC5nZW5EaW1RID09PSAnY2FzdCcgfHwgKGlzQXV0byAmJiAhaGlnaENhcmRpbmFsaXR5KTtcblxuICAgICAgICBpZiAoZ2VuQmluICYmIHZsLmlzaW4oYXV0b01vZGUsIFtudWxsLCAnYmluJywgJ2F1dG9jYXN0J10pKSB7XG4gICAgICAgICAgYXNzaWduQmluUShpLCBoYXNBZ2dyLCBpc0F1dG8gPyAnYXV0b2Nhc3QnIDogJ2JpbicpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChnZW5DYXN0ICYmIHZsLmlzaW4oYXV0b01vZGUsIFtudWxsLCAnY2FzdCcsICdhdXRvY2FzdCddKSkge1xuICAgICAgICAgIHRmW2ldLnR5cGUgPSAnTyc7XG4gICAgICAgICAgYXNzaWduRmllbGQoaSArIDEsIGhhc0FnZ3IsIGlzQXV0byA/ICdhdXRvY2FzdCcgOiAnY2FzdCcpO1xuICAgICAgICAgIHRmW2ldLnR5cGUgPSAnUSc7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBhc3NpZ25UKGksIGhhc0FnZ3IsIGF1dG9Nb2RlKSB7XG4gICAgdmFyIGYgPSBmaWVsZHNbaV07XG4gICAgdGZbaV0gPSB7bmFtZTogZi5uYW1lLCB0eXBlOiBmLnR5cGV9O1xuXG4gICAgdmFyIGZucyA9ICghZi5fZm4gfHwgZi5fZm4gPT09ICcqJykgPyBvcHQudGltZUZuTGlzdCA6IGYuX2ZuO1xuICAgIGZvciAodmFyIGogaW4gZm5zKSB7XG4gICAgICB2YXIgZm4gPSBmbnNbal07XG4gICAgICBpZiAoZm4gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBpZiAoIWhhc0FnZ3IpIHsgLy8gY2FuJ3QgYWdncmVnYXRlIG92ZXIgcmF3IHRpbWVcbiAgICAgICAgICBhc3NpZ25GaWVsZChpKzEsIGZhbHNlLCBhdXRvTW9kZSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRmW2ldLmZuID0gZm47XG4gICAgICAgIGFzc2lnbkZpZWxkKGkrMSwgaGFzQWdnciwgYXV0b01vZGUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEZJWE1FIHdoYXQgaWYgeW91IGFnZ3JlZ2F0ZSB0aW1lP1xuICB9XG5cbiAgZnVuY3Rpb24gYXNzaWduRmllbGQoaSwgaGFzQWdnciwgYXV0b01vZGUpIHtcbiAgICBpZiAoaSA9PT0gZmllbGRzLmxlbmd0aCkgeyAvLyBJZiBhbGwgZmllbGRzIGFyZSBhc3NpZ25lZFxuICAgICAgY2hlY2tBbmRQdXNoKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGYgPSBmaWVsZHNbaV07XG4gICAgLy8gT3RoZXJ3aXNlLCBhc3NpZ24gaS10aCBmaWVsZFxuICAgIHN3aXRjaCAoZi50eXBlKSB7XG4gICAgICAvL1RPRE8gXCJEXCIsIFwiR1wiXG4gICAgICBjYXNlICdRJzpcbiAgICAgICAgYXNzaWduUShpLCBoYXNBZ2dyLCBhdXRvTW9kZSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICdUJzpcbiAgICAgICAgYXNzaWduVChpLCBoYXNBZ2dyLCBhdXRvTW9kZSk7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICdPJzpcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRmW2ldID0gZjtcbiAgICAgICAgYXNzaWduRmllbGQoaSArIDEsIGhhc0FnZ3IsIGF1dG9Nb2RlKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgdmFyIGhhc0FnZ3IgPSBvcHQudGFibGVUeXBlcyA9PT0gJ2FnZ3JlZ2F0ZWQnID8gdHJ1ZSA6IG9wdC50YWJsZVR5cGVzID09PSAnZGlzYWdncmVnYXRlZCcgPyBmYWxzZSA6IG51bGw7XG4gIGFzc2lnbkZpZWxkKDAsIGhhc0FnZ3IsIG51bGwpO1xuXG4gIHJldHVybiBvdXRwdXQ7XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB2bCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93LnZsIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbC52bCA6IG51bGwpLFxuICBnZW5FbmNzID0gcmVxdWlyZSgnLi9lbmNzJyksXG4gIGdldE1hcmt0eXBlcyA9IHJlcXVpcmUoJy4vbWFya3R5cGVzJyksXG4gIHJhbmsgPSByZXF1aXJlKCcuLi9yYW5rL3JhbmsnKSxcbiAgY29uc3RzID0gcmVxdWlyZSgnLi4vY29uc3RzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZ2VuRW5jb2RpbmdzRnJvbUZpZWxkcztcblxuZnVuY3Rpb24gZ2VuRW5jb2RpbmdzRnJvbUZpZWxkcyhvdXRwdXQsIGZpZWxkcywgc3RhdHMsIG9wdCwgY2ZnLCBuZXN0ZWQpIHtcbiAgb3B0ID0gdmwuc2NoZW1hLnV0aWwuZXh0ZW5kKG9wdHx8e30sIGNvbnN0cy5nZW4uZW5jb2RpbmdzKTtcbiAgdmFyIGVuY3MgPSBnZW5FbmNzKFtdLCBmaWVsZHMsIHN0YXRzLCBvcHQpO1xuXG4gIGlmIChuZXN0ZWQpIHtcbiAgICByZXR1cm4gZW5jcy5yZWR1Y2UoZnVuY3Rpb24oZGljdCwgZW5jKSB7XG4gICAgICBkaWN0W2VuY10gPSBnZW5FbmNvZGluZ3NGcm9tRW5jcyhbXSwgZW5jLCBzdGF0cywgb3B0LCBjZmcpO1xuICAgICAgcmV0dXJuIGRpY3Q7XG4gICAgfSwge30pO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBlbmNzLnJlZHVjZShmdW5jdGlvbihsaXN0LCBlbmMpIHtcbiAgICAgIHJldHVybiBnZW5FbmNvZGluZ3NGcm9tRW5jcyhsaXN0LCBlbmMsIHN0YXRzLCBvcHQsIGNmZyk7XG4gICAgfSwgW10pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdlbkVuY29kaW5nc0Zyb21FbmNzKG91dHB1dCwgZW5jLCBzdGF0cywgb3B0LCBjZmcpIHtcbiAgZ2V0TWFya3R5cGVzKGVuYywgc3RhdHMsIG9wdClcbiAgICAuZm9yRWFjaChmdW5jdGlvbihtYXJrVHlwZSkge1xuICAgICAgdmFyIGVuY29kaW5nID0gZmluYWxUb3VjaCh7bWFya3R5cGU6IG1hcmtUeXBlLCBlbmM6IGVuYywgY2ZnOiBjZmd9LCBzdGF0cywgb3B0KSxcbiAgICAgICAgc2NvcmUgPSByYW5rLmVuY29kaW5nKGVuY29kaW5nLCBzdGF0cywgb3B0KTtcblxuICAgICAgZW5jb2Rpbmcuc2NvcmUgPSBzY29yZS5zY29yZTtcbiAgICAgIGVuY29kaW5nLnNjb3JlRmVhdHVyZXMgPSBzY29yZS5mZWF0dXJlcztcbiAgICAgIG91dHB1dC5wdXNoKGVuY29kaW5nKTtcbiAgICB9KTtcbiAgcmV0dXJuIG91dHB1dDtcbn1cblxuLy9GSVhNRSB0aGlzIHNob3VsZCBiZSByZWZhY3RvcnNcbmZ1bmN0aW9uIGZpbmFsVG91Y2goZW5jb2RpbmcsIHN0YXRzLCBvcHQpIHtcbiAgaWYgKGVuY29kaW5nLm1hcmt0eXBlID09PSAndGV4dCcgJiYgb3B0LmFsd2F5c0dlbmVyYXRlVGFibGVBc0hlYXRtYXApIHtcbiAgICBlbmNvZGluZy5lbmMuY29sb3IgPSBlbmNvZGluZy5lbmMudGV4dDtcbiAgfVxuXG4gIC8vIGRvbid0IGluY2x1ZGUgemVybyBpZiBzdGRldi9hdmcgPCAwLjAxXG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS91d2RhdGEvdmlzcmVjL2lzc3Vlcy82OVxuICB2YXIgZW5jID0gZW5jb2RpbmcuZW5jO1xuICBbJ3gnLCAneSddLmZvckVhY2goZnVuY3Rpb24oZXQpIHtcbiAgICB2YXIgZmllbGQgPSBlbmNbZXRdO1xuICAgIGlmIChmaWVsZCAmJiB2bC5maWVsZC5pc01lYXN1cmUoZmllbGQpICYmICF2bC5maWVsZC5pc0NvdW50KGZpZWxkKSkge1xuICAgICAgdmFyIHN0YXQgPSBzdGF0c1tmaWVsZC5uYW1lXTtcbiAgICAgIGlmIChzdGF0LnN0ZGV2IC8gc3RhdC5hdmcgPCAwLjAxKSB7XG4gICAgICAgIGZpZWxkLnNjYWxlID0ge3plcm86IGZhbHNlfTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuICByZXR1cm4gZW5jb2Rpbmc7XG59IiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciB2bCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93LnZsIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbC52bCA6IG51bGwpLFxuICBnbG9iYWxzID0gcmVxdWlyZSgnLi4vZ2xvYmFscycpLFxuICB1dGlsID0gcmVxdWlyZSgnLi4vdXRpbCcpLFxuICBjb25zdHMgPSByZXF1aXJlKCcuLi9jb25zdHMnKSxcbiAgZ2VuTWFya1R5cGVzID0gcmVxdWlyZSgnLi9tYXJrdHlwZXMnKSxcbiAgaXNEaW1lbnNpb24gPSB2bC5maWVsZC5pc0RpbWVuc2lvbixcbiAgaXNNZWFzdXJlID0gdmwuZmllbGQuaXNNZWFzdXJlO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGdlbkVuY3M7XG5cbi8vIEZJWE1FIHJlbW92ZSBkaW1lbnNpb24sIG1lYXN1cmUgYW5kIHVzZSBpbmZvcm1hdGlvbiBpbiB2ZWdhbGl0ZSBpbnN0ZWFkIVxudmFyIHJ1bGVzID0ge1xuICB4OiB7XG4gICAgZGltZW5zaW9uOiB0cnVlLFxuICAgIG1lYXN1cmU6IHRydWUsXG4gICAgbXVsdGlwbGU6IHRydWUgLy9GSVhNRSBzaG91bGQgYWxsb3cgbXVsdGlwbGUgb25seSBmb3IgUSwgVFxuICB9LFxuICB5OiB7XG4gICAgZGltZW5zaW9uOiB0cnVlLFxuICAgIG1lYXN1cmU6IHRydWUsXG4gICAgbXVsdGlwbGU6IHRydWUgLy9GSVhNRSBzaG91bGQgYWxsb3cgbXVsdGlwbGUgb25seSBmb3IgUSwgVFxuICB9LFxuICByb3c6IHtcbiAgICBkaW1lbnNpb246IHRydWUsXG4gICAgbXVsdGlwbGU6IHRydWVcbiAgfSxcbiAgY29sOiB7XG4gICAgZGltZW5zaW9uOiB0cnVlLFxuICAgIG11bHRpcGxlOiB0cnVlXG4gIH0sXG4gIHNoYXBlOiB7XG4gICAgZGltZW5zaW9uOiB0cnVlLFxuICAgIHJ1bGVzOiBzaGFwZVJ1bGVzXG4gIH0sXG4gIHNpemU6IHtcbiAgICBtZWFzdXJlOiB0cnVlLFxuICAgIHJ1bGVzOiByZXRpbmFsRW5jUnVsZXNcbiAgfSxcbiAgY29sb3I6IHtcbiAgICBkaW1lbnNpb246IHRydWUsXG4gICAgbWVhc3VyZTogdHJ1ZSxcbiAgICBydWxlczogY29sb3JSdWxlc1xuICB9LFxuICBhbHBoYToge1xuICAgIG1lYXN1cmU6IHRydWUsXG4gICAgcnVsZXM6IHJldGluYWxFbmNSdWxlc1xuICB9LFxuICB0ZXh0OiB7XG4gICAgbWVhc3VyZTogdHJ1ZVxuICB9LFxuICBkZXRhaWw6IHtcbiAgICBkaW1lbnNpb246IHRydWVcbiAgfVxuICAvL2dlbzoge1xuICAvLyAgZ2VvOiB0cnVlXG4gIC8vfSxcbiAgLy9hcmM6IHsgLy8gcGllXG4gIC8vXG4gIC8vfVxufTtcblxuZnVuY3Rpb24gcmV0aW5hbEVuY1J1bGVzKGVuYywgZmllbGQsIHN0YXRzLCBvcHQpIHtcbiAgaWYgKG9wdC5vbWl0TXVsdGlwbGVSZXRpbmFsRW5jb2RpbmdzKSB7XG4gICAgaWYgKGVuYy5jb2xvciB8fCBlbmMuc2l6ZSB8fCBlbmMuc2hhcGUgfHwgZW5jLmFscGhhKSByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGNvbG9yUnVsZXMoZW5jLCBmaWVsZCwgc3RhdHMsIG9wdCkge1xuICBpZighcmV0aW5hbEVuY1J1bGVzKGVuYywgZmllbGQsIHN0YXRzLCBvcHQpKSByZXR1cm4gZmFsc2U7XG5cbiAgcmV0dXJuIHZsLmZpZWxkLmlzTWVhc3VyZShmaWVsZCkgfHxcbiAgICB2bC5maWVsZC5jYXJkaW5hbGl0eShmaWVsZCwgc3RhdHMpIDw9IG9wdC5tYXhDYXJkaW5hbGl0eUZvckNvbG9yO1xufVxuXG5mdW5jdGlvbiBzaGFwZVJ1bGVzKGVuYywgZmllbGQsIHN0YXRzLCBvcHQpIHtcbiAgaWYoIXJldGluYWxFbmNSdWxlcyhlbmMsIGZpZWxkLCBzdGF0cywgb3B0KSkgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChmaWVsZC5iaW4gJiYgZmllbGQudHlwZSA9PT0gJ1EnKSByZXR1cm4gZmFsc2U7XG4gIGlmIChmaWVsZC5mbiAmJiBmaWVsZC50eXBlID09PSAnVCcpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuIHZsLmZpZWxkLmNhcmRpbmFsaXR5KGZpZWxkLCBzdGF0cykgPD0gb3B0Lm1heENhcmRpbmFsaXR5Rm9yQ29sb3I7XG59XG5cbmZ1bmN0aW9uIGRpbU1lYVRyYW5zcG9zZVJ1bGUoZW5jKSB7XG4gIC8vIGNyZWF0ZSBob3Jpem9udGFsIGhpc3RvZ3JhbSBmb3Igb3JkaW5hbFxuICBpZiAoZW5jLnkudHlwZSA9PT0gJ08nICYmIGlzTWVhc3VyZShlbmMueCkpIHJldHVybiB0cnVlO1xuXG4gIC8vIHZlcnRpY2FsIGhpc3RvZ3JhbSBmb3IgUSBhbmQgVFxuICBpZiAoaXNNZWFzdXJlKGVuYy55KSAmJiAoZW5jLngudHlwZSAhPT0gJ08nICYmIGlzRGltZW5zaW9uKGVuYy54KSkpIHJldHVybiB0cnVlO1xuXG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gZ2VuZXJhbFJ1bGVzKGVuYywgc3RhdHMsIG9wdCkge1xuICAvLyBlbmMudGV4dCBpcyBvbmx5IHVzZWQgZm9yIFRFWFQgVEFCTEVcbiAgaWYgKGVuYy50ZXh0KSB7XG4gICAgcmV0dXJuIGdlbk1hcmtUeXBlcy5zYXRpc2Z5UnVsZXMoZW5jLCAndGV4dCcsIHN0YXRzLCBvcHQpO1xuICB9XG5cbiAgLy8gQ0FSVEVTSUFOIFBMT1QgT1IgTUFQXG4gIGlmIChlbmMueCB8fCBlbmMueSB8fCBlbmMuZ2VvIHx8IGVuYy5hcmMpIHtcblxuICAgIGlmIChlbmMucm93IHx8IGVuYy5jb2wpIHsgLy9oYXZlIGZhY2V0KHMpXG5cbiAgICAgIC8vIGRvbid0IHVzZSBmYWNldHMgYmVmb3JlIGZpbGxpbmcgdXAgeCx5XG4gICAgICBpZiAoIWVuYy54IHx8ICFlbmMueSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgICBpZiAob3B0Lm9taXROb25UZXh0QWdncldpdGhBbGxEaW1zT25GYWNldHMpIHtcbiAgICAgICAgLy8gcmVtb3ZlIGFsbCBhZ2dyZWdhdGVkIGNoYXJ0cyB3aXRoIGFsbCBkaW1zIG9uIGZhY2V0cyAocm93LCBjb2wpXG4gICAgICAgIGlmIChnZW5FbmNzLmlzQWdncldpdGhBbGxEaW1PbkZhY2V0cyhlbmMpKSByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGVuYy54ICYmIGVuYy55KSB7XG4gICAgICBpZiAob3B0Lm9taXRUcmFucG9zZSkge1xuICAgICAgICBpZiAoKCEhaXNEaW1lbnNpb24oZW5jLngpKSBeICghIWlzRGltZW5zaW9uKGVuYy55KSkpIHsgLy8gZGltIHggbWVhXG4gICAgICAgICAgaWYgKCFkaW1NZWFUcmFuc3Bvc2VSdWxlKGVuYykpIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSBlbHNlIGlmIChlbmMueS50eXBlPT09J1QnIHx8IGVuYy54LnR5cGUgPT09ICdUJykge1xuICAgICAgICAgIGlmIChlbmMueS50eXBlPT09J1QnICYmIGVuYy54LnR5cGUgIT09ICdUJykgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9IGVsc2UgeyAvLyBzaG93IG9ubHkgb25lIE94TywgUXhRXG4gICAgICAgICAgaWYgKGVuYy54Lm5hbWUgPiBlbmMueS5uYW1lKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8vIERPVCBQTE9UU1xuICAgIC8vIC8vIHBsb3Qgd2l0aCBvbmUgYXhpcyA9IGRvdCBwbG90XG4gICAgaWYgKG9wdC5vbWl0RG90UGxvdCkgcmV0dXJuIGZhbHNlO1xuXG4gICAgLy8gRG90IHBsb3Qgc2hvdWxkIGFsd2F5cyBiZSBob3Jpem9udGFsXG4gICAgaWYgKG9wdC5vbWl0VHJhbnBvc2UgJiYgZW5jLnkpIHJldHVybiBmYWxzZTtcblxuICAgIC8vIGRvdCBwbG90IHNob3VsZG4ndCBoYXZlIG90aGVyIGVuY29kaW5nXG4gICAgaWYgKG9wdC5vbWl0RG90UGxvdFdpdGhFeHRyYUVuY29kaW5nICYmIHZsLmtleXMoZW5jKS5sZW5ndGggPiAxKSByZXR1cm4gZmFsc2U7XG5cbiAgICAvLyBvbmUgZGltZW5zaW9uIFwiY291bnRcIiBpcyB1c2VsZXNzXG4gICAgaWYgKGVuYy54ICYmIGVuYy54LmFnZ3IgPT0gJ2NvdW50JyAmJiAhZW5jLnkpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoZW5jLnkgJiYgZW5jLnkuYWdnciA9PSAnY291bnQnICYmICFlbmMueCkgcmV0dXJuIGZhbHNlO1xuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5nZW5FbmNzLmlzQWdncldpdGhBbGxEaW1PbkZhY2V0cyA9IGZ1bmN0aW9uIChlbmMpIHtcbiAgdmFyIGhhc0FnZ3IgPSBmYWxzZSwgaGFzT3RoZXJPID0gZmFsc2U7XG4gIGZvciAodmFyIGVuY1R5cGUgaW4gZW5jKSB7XG4gICAgdmFyIGZpZWxkID0gZW5jW2VuY1R5cGVdO1xuICAgIGlmIChmaWVsZC5hZ2dyKSB7XG4gICAgICBoYXNBZ2dyID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHZsLmZpZWxkLmlzRGltZW5zaW9uKGZpZWxkKSAmJiAoZW5jVHlwZSAhPT0gJ3JvdycgJiYgZW5jVHlwZSAhPT0gJ2NvbCcpKSB7XG4gICAgICBoYXNPdGhlck8gPSB0cnVlO1xuICAgIH1cbiAgICBpZiAoaGFzQWdnciAmJiBoYXNPdGhlck8pIGJyZWFrO1xuICB9XG5cbiAgcmV0dXJuIGhhc0FnZ3IgJiYgIWhhc090aGVyTztcbn07XG5cblxuZnVuY3Rpb24gZ2VuRW5jcyhlbmNzLCBmaWVsZHMsIHN0YXRzLCBvcHQpIHtcbiAgb3B0ID0gdmwuc2NoZW1hLnV0aWwuZXh0ZW5kKG9wdHx8e30sIGNvbnN0cy5nZW4uZW5jb2RpbmdzKTtcbiAgLy8gZ2VuZXJhdGUgYSBjb2xsZWN0aW9uIHZlZ2FsaXRlJ3MgZW5jXG4gIHZhciB0bXBFbmMgPSB7fTtcblxuICBmdW5jdGlvbiBhc3NpZ25GaWVsZChpKSB7XG4gICAgLy8gSWYgYWxsIGZpZWxkcyBhcmUgYXNzaWduZWQsIHNhdmVcbiAgICBpZiAoaSA9PT0gZmllbGRzLmxlbmd0aCkge1xuICAgICAgLy8gYXQgdGhlIG1pbmltYWwgYWxsIGNoYXJ0IHNob3VsZCBoYXZlIHgsIHksIGdlbywgdGV4dCBvciBhcmNcbiAgICAgIGlmIChnZW5lcmFsUnVsZXModG1wRW5jLCBzdGF0cywgb3B0KSkge1xuICAgICAgICBlbmNzLnB1c2godmwuZHVwbGljYXRlKHRtcEVuYykpO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIE90aGVyd2lzZSwgYXNzaWduIGktdGggZmllbGRcbiAgICB2YXIgZmllbGQgPSBmaWVsZHNbaV07XG4gICAgZm9yICh2YXIgaiBpbiBvcHQuZW5jb2RpbmdUeXBlTGlzdCkge1xuICAgICAgdmFyIGV0ID0gb3B0LmVuY29kaW5nVHlwZUxpc3Rbal0sXG4gICAgICAgIGlzRGltID0gaXNEaW1lbnNpb24oZmllbGQpO1xuXG4gICAgICAvL1RPRE86IHN1cHBvcnQgXCJtdWx0aXBsZVwiIGFzc2lnbm1lbnRcbiAgICAgIGlmICghKGV0IGluIHRtcEVuYykgJiYgLy8gZW5jb2Rpbmcgbm90IHVzZWRcbiAgICAgICAgKChpc0RpbSAmJiBydWxlc1tldF0uZGltZW5zaW9uKSB8fCAoIWlzRGltICYmIHJ1bGVzW2V0XS5tZWFzdXJlKSkgJiZcbiAgICAgICAgKCFydWxlc1tldF0ucnVsZXMgfHwgcnVsZXNbZXRdLnJ1bGVzKHRtcEVuYywgZmllbGQsIHN0YXRzLCBvcHQpKVxuICAgICAgKSB7XG4gICAgICAgIHRtcEVuY1tldF0gPSBmaWVsZDtcbiAgICAgICAgYXNzaWduRmllbGQoaSArIDEpO1xuICAgICAgICBkZWxldGUgdG1wRW5jW2V0XTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBhc3NpZ25GaWVsZCgwKTtcblxuICByZXR1cm4gZW5jcztcbn1cbiIsInZhciB2bCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93LnZsIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbC52bCA6IG51bGwpLFxuICB1dGlsID0gcmVxdWlyZSgnLi4vdXRpbCcpO1xuXG52YXIgZ2VuID0gbW9kdWxlLmV4cG9ydHMgPSB7XG4gIC8vIGRhdGEgdmFyaWF0aW9uc1xuICBhZ2dyZWdhdGVzOiByZXF1aXJlKCcuL2FnZ3JlZ2F0ZXMnKSxcbiAgcHJvamVjdGlvbnM6IHJlcXVpcmUoJy4vcHJvamVjdGlvbnMnKSxcbiAgLy8gZW5jb2RpbmdzIC8gdmlzdWFsIHZhcmlhdG9uc1xuICBlbmNvZGluZ3M6IHJlcXVpcmUoJy4vZW5jb2RpbmdzJyksXG4gIGVuY3M6IHJlcXVpcmUoJy4vZW5jcycpLFxuICBtYXJrdHlwZXM6IHJlcXVpcmUoJy4vbWFya3R5cGVzJylcbn07XG5cbi8vRklYTUUgbW92ZSB0aGVzZSB0byB2bFxudmFyIEFHR1JFR0FUSU9OX0ZOID0geyAvL2FsbCBwb3NzaWJsZSBhZ2dyZWdhdGUgZnVuY3Rpb24gbGlzdGVkIGJ5IGVhY2ggZGF0YSB0eXBlXG4gIFE6IHZsLnNjaGVtYS5hZ2dyLnN1cHBvcnRlZEVudW1zLlFcbn07XG5cbnZhciBUUkFOU0ZPUk1fRk4gPSB7IC8vYWxsIHBvc3NpYmxlIHRyYW5zZm9ybSBmdW5jdGlvbiBsaXN0ZWQgYnkgZWFjaCBkYXRhIHR5cGVcbiAgLy8gUTogWydsb2cnLCAnc3FydCcsICdhYnMnXSwgLy8gXCJsb2dpdD9cIlxuICBUOiB2bC5zY2hlbWEudGltZWZuc1xufTtcblxuZ2VuLmNoYXJ0cyA9IGZ1bmN0aW9uKGZpZWxkcywgb3B0LCBjZmcsIGZsYXQpIHtcbiAgb3B0ID0gdXRpbC5nZW4uZ2V0T3B0KG9wdCk7XG4gIGZsYXQgPSBmbGF0ID09PSB1bmRlZmluZWQgPyB7ZW5jb2RpbmdzOiAxfSA6IGZsYXQ7XG5cbiAgLy8gVE9ETyBnZW5lcmF0ZVxuXG4gIC8vIGdlbmVyYXRlIHBlcm11dGF0aW9uIG9mIGVuY29kaW5nIG1hcHBpbmdzXG4gIHZhciBmaWVsZFNldHMgPSBvcHQuZ2VuQWdnciA/IGdlbi5hZ2dyZWdhdGVzKFtdLCBmaWVsZHMsIG9wdCkgOiBbZmllbGRzXSxcbiAgICBlbmNzLCBjaGFydHMsIGxldmVsID0gMDtcblxuICBpZiAoZmxhdCA9PT0gdHJ1ZSB8fCAoZmxhdCAmJiBmbGF0LmFnZ3IpKSB7XG4gICAgZW5jcyA9IGZpZWxkU2V0cy5yZWR1Y2UoZnVuY3Rpb24ob3V0cHV0LCBmaWVsZHMpIHtcbiAgICAgIHJldHVybiBnZW4uZW5jcyhvdXRwdXQsIGZpZWxkcywgb3B0KTtcbiAgICB9LCBbXSk7XG4gIH0gZWxzZSB7XG4gICAgZW5jcyA9IGZpZWxkU2V0cy5tYXAoZnVuY3Rpb24oZmllbGRzKSB7XG4gICAgICByZXR1cm4gZ2VuLmVuY3MoW10sIGZpZWxkcywgb3B0KTtcbiAgICB9LCB0cnVlKTtcbiAgICBsZXZlbCArPSAxO1xuICB9XG5cbiAgaWYgKGZsYXQgPT09IHRydWUgfHwgKGZsYXQgJiYgZmxhdC5lbmNvZGluZ3MpKSB7XG4gICAgY2hhcnRzID0gdXRpbC5uZXN0ZWRSZWR1Y2UoZW5jcywgZnVuY3Rpb24ob3V0cHV0LCBlbmMpIHtcbiAgICAgIHJldHVybiBnZW4ubWFya3R5cGVzKG91dHB1dCwgZW5jLCBvcHQsIGNmZyk7XG4gICAgfSwgbGV2ZWwsIHRydWUpO1xuICB9IGVsc2Uge1xuICAgIGNoYXJ0cyA9IHV0aWwubmVzdGVkTWFwKGVuY3MsIGZ1bmN0aW9uKGVuYykge1xuICAgICAgcmV0dXJuIGdlbi5tYXJrdHlwZXMoW10sIGVuYywgb3B0LCBjZmcpO1xuICAgIH0sIGxldmVsLCB0cnVlKTtcbiAgICBsZXZlbCArPSAxO1xuICB9XG4gIHJldHVybiBjaGFydHM7XG59OyIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgdmwgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdy52bCA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwudmwgOiBudWxsKSxcbiAgdXRpbCA9IHJlcXVpcmUoJy4uL3V0aWwnKSxcbiAgY29uc3RzID0gcmVxdWlyZSgnLi4vY29uc3RzJyksXG4gIGlzRGltZW5zaW9uID0gdmwuZmllbGQuaXNEaW1lbnNpb247XG5cbnZhciB2bG1hcmt0eXBlcyA9IG1vZHVsZS5leHBvcnRzID0gZ2V0TWFya3R5cGVzO1xuXG52YXIgbWFya3NSdWxlID0gdmxtYXJrdHlwZXMucnVsZSA9IHtcbiAgcG9pbnQ6ICBwb2ludFJ1bGUsXG4gIGJhcjogICAgYmFyUnVsZSxcbiAgbGluZTogICBsaW5lUnVsZSxcbiAgYXJlYTogICBhcmVhUnVsZSwgLy8gYXJlYSBpcyBzaW1pbGFyIHRvIGxpbmVcbiAgdGV4dDogICB0ZXh0UnVsZSxcbiAgdGljazogICB0aWNrUnVsZVxufTtcblxuZnVuY3Rpb24gZ2V0TWFya3R5cGVzKGVuYywgc3RhdHMsIG9wdCkge1xuICBvcHQgPSB2bC5zY2hlbWEudXRpbC5leHRlbmQob3B0fHx7fSwgY29uc3RzLmdlbi5lbmNvZGluZ3MpO1xuXG4gIHZhciBtYXJrVHlwZXMgPSBvcHQubWFya3R5cGVMaXN0LmZpbHRlcihmdW5jdGlvbihtYXJrVHlwZSl7XG4gICAgcmV0dXJuIHZsbWFya3R5cGVzLnNhdGlzZnlSdWxlcyhlbmMsIG1hcmtUeXBlLCBzdGF0cywgb3B0KTtcbiAgfSk7XG5cbiAgcmV0dXJuIG1hcmtUeXBlcztcbn1cblxudmxtYXJrdHlwZXMuc2F0aXNmeVJ1bGVzID0gZnVuY3Rpb24gKGVuYywgbWFya1R5cGUsIHN0YXRzLCBvcHQpIHtcbiAgdmFyIG1hcmsgPSB2bC5jb21waWxlLm1hcmtzW21hcmtUeXBlXSxcbiAgICByZXFzID0gbWFyay5yZXF1aXJlZEVuY29kaW5nLFxuICAgIHN1cHBvcnQgPSBtYXJrLnN1cHBvcnRlZEVuY29kaW5nO1xuXG4gIGZvciAodmFyIGkgaW4gcmVxcykgeyAvLyBhbGwgcmVxdWlyZWQgZW5jb2RpbmdzIGluIGVuY1xuICAgIGlmICghKHJlcXNbaV0gaW4gZW5jKSkgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgZm9yICh2YXIgZW5jVHlwZSBpbiBlbmMpIHsgLy8gYWxsIGVuY29kaW5ncyBpbiBlbmMgYXJlIHN1cHBvcnRlZFxuICAgIGlmICghc3VwcG9ydFtlbmNUeXBlXSkgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuICFtYXJrc1J1bGVbbWFya1R5cGVdIHx8IG1hcmtzUnVsZVttYXJrVHlwZV0oZW5jLCBzdGF0cywgb3B0KTtcbn07XG5cbmZ1bmN0aW9uIGZhY2V0UnVsZShmaWVsZCwgc3RhdHMsIG9wdCkge1xuICByZXR1cm4gdmwuZmllbGQuY2FyZGluYWxpdHkoZmllbGQsIHN0YXRzKSA8PSBvcHQubWF4Q2FyZGluYWxpdHlGb3JGYWNldHM7XG59XG5cbmZ1bmN0aW9uIGZhY2V0c1J1bGUoZW5jLCBzdGF0cywgb3B0KSB7XG4gIGlmKGVuYy5yb3cgJiYgIWZhY2V0UnVsZShlbmMucm93LCBzdGF0cywgb3B0KSkgcmV0dXJuIGZhbHNlO1xuICBpZihlbmMuY29sICYmICFmYWNldFJ1bGUoZW5jLmNvbCwgc3RhdHMsIG9wdCkpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIHBvaW50UnVsZShlbmMsIHN0YXRzLCBvcHQpIHtcbiAgaWYoIWZhY2V0c1J1bGUoZW5jLCBzdGF0cywgb3B0KSkgcmV0dXJuIGZhbHNlO1xuICBpZiAoZW5jLnggJiYgZW5jLnkpIHtcbiAgICAvLyBoYXZlIGJvdGggeCAmIHkgPT0+IHNjYXR0ZXIgcGxvdCAvIGJ1YmJsZSBwbG90XG5cbiAgICB2YXIgeElzRGltID0gaXNEaW1lbnNpb24oZW5jLngpLFxuICAgICAgeUlzRGltID0gaXNEaW1lbnNpb24oZW5jLnkpO1xuXG4gICAgLy8gRm9yIE94T1xuICAgIGlmICh4SXNEaW0gJiYgeUlzRGltKSB7XG4gICAgICAvLyBzaGFwZSBkb2Vzbid0IHdvcmsgd2l0aCBib3RoIHgsIHkgYXMgb3JkaW5hbFxuICAgICAgaWYgKGVuYy5zaGFwZSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIC8vIFRPRE8oa2FuaXR3KTogY2hlY2sgdGhhdCB0aGVyZSBpcyBxdWFudCBhdCBsZWFzdCAuLi5cbiAgICAgIGlmIChlbmMuY29sb3IgJiYgaXNEaW1lbnNpb24oZW5jLmNvbG9yKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gIH0gZWxzZSB7IC8vIHBsb3Qgd2l0aCBvbmUgYXhpcyA9IGRvdCBwbG90XG4gICAgaWYgKG9wdC5vbWl0RG90UGxvdCkgcmV0dXJuIGZhbHNlO1xuXG4gICAgLy8gRG90IHBsb3Qgc2hvdWxkIGFsd2F5cyBiZSBob3Jpem9udGFsXG4gICAgaWYgKG9wdC5vbWl0VHJhbnBvc2UgJiYgZW5jLnkpIHJldHVybiBmYWxzZTtcblxuICAgIC8vIGRvdCBwbG90IHNob3VsZG4ndCBoYXZlIG90aGVyIGVuY29kaW5nXG4gICAgaWYgKG9wdC5vbWl0RG90UGxvdFdpdGhFeHRyYUVuY29kaW5nICYmIHZsLmtleXMoZW5jKS5sZW5ndGggPiAxKSByZXR1cm4gZmFsc2U7XG5cbiAgICAvLyBkb3QgcGxvdCB3aXRoIHNoYXBlIGlzIG5vbi1zZW5zZVxuICAgIGlmIChlbmMuc2hhcGUpIHJldHVybiBmYWxzZTtcbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gdGlja1J1bGUoZW5jLCBzdGF0cywgb3B0KSB7XG4gIGlmIChlbmMueCB8fCBlbmMueSkge1xuICAgIGlmKHZsLmVuYy5pc0FnZ3JlZ2F0ZShlbmMpKSByZXR1cm4gZmFsc2U7XG5cbiAgICB2YXIgeElzRGltID0gaXNEaW1lbnNpb24oZW5jLngpLFxuICAgICAgeUlzRGltID0gaXNEaW1lbnNpb24oZW5jLnkpO1xuXG4gICAgcmV0dXJuICgheElzRGltICYmICghZW5jLnkgfHwgeUlzRGltKSkgfHxcbiAgICAgICgheUlzRGltICYmICghZW5jLnggfHwgeElzRGltKSk7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBiYXJSdWxlKGVuYywgc3RhdHMsIG9wdCkge1xuICBpZighZmFjZXRzUnVsZShlbmMsIHN0YXRzLCBvcHQpKSByZXR1cm4gZmFsc2U7XG5cbiAgLy8gbmVlZCB0byBhZ2dyZWdhdGUgb24gZWl0aGVyIHggb3IgeVxuICBpZiAob3B0Lm9taXRTaXplT25CYXIgJiYgZW5jLnNpemUgIT09IHVuZGVmaW5lZCkgcmV0dXJuIGZhbHNlO1xuXG4gIGlmICgoKGVuYy54LmFnZ3IgIT09IHVuZGVmaW5lZCkgXiAoZW5jLnkuYWdnciAhPT0gdW5kZWZpbmVkKSkgJiZcbiAgICAgIChpc0RpbWVuc2lvbihlbmMueCkgXiBpc0RpbWVuc2lvbihlbmMueSkpKSB7XG5cbiAgICB2YXIgYWdnciA9IGVuYy54LmFnZ3IgfHwgZW5jLnkuYWdncjtcbiAgICByZXR1cm4gIShvcHQub21pdFN0YWNrZWRBdmVyYWdlICYmIGFnZ3IgPT09J2F2ZycgJiYgZW5jLmNvbG9yKTtcbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gbGluZVJ1bGUoZW5jLCBzdGF0cywgb3B0KSB7XG4gIGlmKCFmYWNldHNSdWxlKGVuYywgc3RhdHMsIG9wdCkpIHJldHVybiBmYWxzZTtcblxuICAvLyBUT0RPKGthbml0dyk6IGFkZCBvbWl0VmVydGljYWxMaW5lIGFzIGNvbmZpZ1xuXG4gIC8vIEZJWE1FIHRydWx5IG9yZGluYWwgZGF0YSBpcyBmaW5lIGhlcmUgdG9vLlxuICAvLyBMaW5lIGNoYXJ0IHNob3VsZCBiZSBvbmx5IGhvcml6b250YWxcbiAgLy8gYW5kIHVzZSBvbmx5IHRlbXBvcmFsIGRhdGFcbiAgcmV0dXJuIGVuYy54LnR5cGUgPT0gJ1QnICYmIGVuYy54LmZuICYmIGVuYy55LnR5cGUgPT0gJ1EnICYmIGVuYy55LmFnZ3I7XG59XG5cbmZ1bmN0aW9uIGFyZWFSdWxlKGVuYywgc3RhdHMsIG9wdCkge1xuICBpZighZmFjZXRzUnVsZShlbmMsIHN0YXRzLCBvcHQpKSByZXR1cm4gZmFsc2U7XG5cbiAgaWYoIWxpbmVSdWxlKGVuYywgc3RhdHMsIG9wdCkpIHJldHVybiBmYWxzZTtcblxuICByZXR1cm4gIShvcHQub21pdFN0YWNrZWRBdmVyYWdlICYmIGVuYy55LmFnZ3IgPT09J2F2ZycgJiYgZW5jLmNvbG9yKTtcbn1cblxuZnVuY3Rpb24gdGV4dFJ1bGUoZW5jLCBzdGF0cywgb3B0KSB7XG4gIC8vIGF0IGxlYXN0IG11c3QgaGF2ZSByb3cgb3IgY29sIGFuZCBhZ2dyZWdhdGVkIHRleHQgdmFsdWVzXG4gIHJldHVybiAoZW5jLnJvdyB8fCBlbmMuY29sKSAmJiBlbmMudGV4dCAmJiBlbmMudGV4dC5hZ2dyICYmICFlbmMueCAmJiAhZW5jLnkgJiYgIWVuYy5zaXplICYmXG4gICAgKCFvcHQuYWx3YXlzR2VuZXJhdGVUYWJsZUFzSGVhdG1hcCB8fCAhZW5jLmNvbG9yKTtcbn0iLCJ2YXIgdXRpbCA9IHJlcXVpcmUoJy4uL3V0aWwnKSxcbiAgY29uc3RzID0gcmVxdWlyZSgnLi4vY29uc3RzJyksXG4gIHZsID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cudmwgOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsLnZsIDogbnVsbCksXG4gIGlzRGltZW5zaW9uID0gdmwuZmllbGQuaXNEaW1lbnNpb247XG5cbm1vZHVsZS5leHBvcnRzID0gcHJvamVjdGlvbnM7XG5cbi8vIFRPRE8gc3VwcG9ydCBvdGhlciBtb2RlIG9mIHByb2plY3Rpb25zIGdlbmVyYXRpb25cbi8vIHBvd2Vyc2V0LCBjaG9vc2VLLCBjaG9vc2VLb3JMZXNzIGFyZSBhbHJlYWR5IGluY2x1ZGVkIGluIHRoZSB1dGlsXG5cbi8qKlxuICogZmllbGRzXG4gKiBAcGFyYW0gIHtbdHlwZV19IGZpZWxkcyBhcnJheSBvZiBmaWVsZHMgYW5kIHF1ZXJ5IGluZm9ybWF0aW9uXG4gKiBAcmV0dXJuIHtbdHlwZV19ICAgICAgICBbZGVzY3JpcHRpb25dXG4gKi9cbmZ1bmN0aW9uIHByb2plY3Rpb25zKGZpZWxkcywgc3RhdHMsIG9wdCkge1xuICBvcHQgPSB2bC5zY2hlbWEudXRpbC5leHRlbmQob3B0fHx7fSwgY29uc3RzLmdlbi5wcm9qZWN0aW9ucyk7XG5cbiAgLy8gRmlyc3QgY2F0ZWdvcml6ZSBmaWVsZCwgc2VsZWN0ZWQsIGZpZWxkc1RvQWRkLCBhbmQgc2F2ZSBpbmRpY2VzXG4gIHZhciBzZWxlY3RlZCA9IFtdLCBmaWVsZHNUb0FkZCA9IFtdLCBmaWVsZFNldHMgPSBbXSxcbiAgICBoYXNTZWxlY3RlZERpbWVuc2lvbiA9IGZhbHNlLFxuICAgIGhhc1NlbGVjdGVkTWVhc3VyZSA9IGZhbHNlLFxuICAgIGluZGljZXMgPSB7fTtcblxuICBmaWVsZHMuZm9yRWFjaChmdW5jdGlvbihmaWVsZCwgaW5kZXgpe1xuICAgIC8vc2F2ZSBpbmRpY2VzIGZvciBzdGFibGUgc29ydCBsYXRlclxuICAgIGluZGljZXNbZmllbGQubmFtZV0gPSBpbmRleDtcblxuICAgIGlmIChmaWVsZC5zZWxlY3RlZCkge1xuICAgICAgc2VsZWN0ZWQucHVzaChmaWVsZCk7XG4gICAgICBpZiAoaXNEaW1lbnNpb24oZmllbGQpKSB7XG4gICAgICAgIGhhc1NlbGVjdGVkRGltZW5zaW9uID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGhhc1NlbGVjdGVkTWVhc3VyZSA9IHRydWU7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICghZmllbGQuZXhjbHVkZWQgJiYgIXZsLmZpZWxkLmlzQ291bnQoZmllbGQpKSB7XG4gICAgICBpZiAodmwuZmllbGQuaXNEaW1lbnNpb24oZmllbGQpICYmXG4gICAgICAgICAgdmwuZmllbGQuY2FyZGluYWxpdHkoZmllbGQsIHN0YXRzLCAxNSkgPiBvcHQubWF4Q2FyZGluYWxpdHlGb3JBdXRvQWRkT3JkaW5hbCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBmaWVsZHNUb0FkZC5wdXNoKGZpZWxkKTtcbiAgICB9XG4gIH0pO1xuXG4gIGZpZWxkc1RvQWRkLnNvcnQoY29tcGFyZUZpZWxkc1RvQWRkKGhhc1NlbGVjdGVkRGltZW5zaW9uLCBoYXNTZWxlY3RlZE1lYXN1cmUsIGluZGljZXMpKTtcblxuICB2YXIgc2V0c1RvQWRkID0gdXRpbC5jaG9vc2VLb3JMZXNzKGZpZWxkc1RvQWRkLCAxKTtcblxuICBzZXRzVG9BZGQuZm9yRWFjaChmdW5jdGlvbihzZXRUb0FkZCkge1xuICAgIHZhciBmaWVsZFNldCA9IHNlbGVjdGVkLmNvbmNhdChzZXRUb0FkZCk7XG4gICAgaWYgKGZpZWxkU2V0Lmxlbmd0aCA+IDApIHtcbiAgICAgIGlmIChvcHQub21pdERvdFBsb3QgJiYgZmllbGRTZXQubGVuZ3RoID09PSAxKSByZXR1cm47XG4gICAgICBmaWVsZFNldHMucHVzaChmaWVsZFNldCk7XG4gICAgfVxuICB9KTtcblxuICBmaWVsZFNldHMuZm9yRWFjaChmdW5jdGlvbihmaWVsZFNldCkge1xuICAgICAgLy8gYWx3YXlzIGFwcGVuZCBwcm9qZWN0aW9uJ3Mga2V5IHRvIGVhY2ggcHJvamVjdGlvbiByZXR1cm5lZCwgZDMgc3R5bGUuXG4gICAgZmllbGRTZXQua2V5ID0gcHJvamVjdGlvbnMua2V5KGZpZWxkU2V0KTtcbiAgfSk7XG5cbiAgcmV0dXJuIGZpZWxkU2V0cztcbn1cblxudmFyIHR5cGVJc01lYXN1cmVTY29yZSA9IHtcbiAgTzogMCxcbiAgVDogMSxcbiAgUTogMlxufTtcblxuZnVuY3Rpb24gY29tcGFyZUZpZWxkc1RvQWRkKGhhc1NlbGVjdGVkRGltZW5zaW9uLCBoYXNTZWxlY3RlZE1lYXN1cmUsIGluZGljZXMpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKGEsIGIpe1xuICAgIHZhciBhSXNEaW0gPSBpc0RpbWVuc2lvbihhKSwgYklzRGltID0gaXNEaW1lbnNpb24oYik7XG4gICAgLy8gc29ydCBieSB0eXBlIG9mIHRoZSBkYXRhXG4gICAgaWYgKGEudHlwZSAhPT0gYi50eXBlKSB7XG4gICAgICBpZiAoIWhhc1NlbGVjdGVkRGltZW5zaW9uKSB7XG4gICAgICAgIHJldHVybiB0eXBlSXNNZWFzdXJlU2NvcmVbYS50eXBlXSAtIHR5cGVJc01lYXN1cmVTY29yZVtiLnR5cGVdO1xuICAgICAgfSBlbHNlIGlmICghaGFzU2VsZWN0ZWRNZWFzdXJlKSB7XG4gICAgICAgIHJldHVybiB0eXBlSXNNZWFzdXJlU2NvcmVbYi50eXBlXSAtIHR5cGVJc01lYXN1cmVTY29yZVthLnR5cGVdO1xuICAgICAgfVxuICAgIH1cbiAgICAvL21ha2UgdGhlIHNvcnQgc3RhYmxlXG4gICAgcmV0dXJuIGluZGljZXNbYS5uYW1lXSAtIGluZGljZXNbYi5uYW1lXTtcbiAgfTtcbn1cblxucHJvamVjdGlvbnMua2V5ID0gZnVuY3Rpb24ocHJvamVjdGlvbikge1xuICByZXR1cm4gcHJvamVjdGlvbi5tYXAoZnVuY3Rpb24oZmllbGQpIHtcbiAgICByZXR1cm4gdmwuZmllbGQuaXNDb3VudChmaWVsZCkgPyAnY291bnQnIDogZmllbGQubmFtZTtcbiAgfSkuam9pbignLCcpO1xufTtcbiIsInZhciBnID0gZ2xvYmFsIHx8IHdpbmRvdztcblxuZy5DSEFSVF9UWVBFUyA9IHtcbiAgVEFCTEU6ICdUQUJMRScsXG4gIEJBUjogJ0JBUicsXG4gIFBMT1Q6ICdQTE9UJyxcbiAgTElORTogJ0xJTkUnLFxuICBBUkVBOiAnQVJFQScsXG4gIE1BUDogJ01BUCcsXG4gIEhJU1RPR1JBTTogJ0hJU1RPR1JBTSdcbn07XG5cbmcuQU5ZX0RBVEFfVFlQRVMgPSAoMSA8PCA0KSAtIDE7IiwidmFyIHJhbmsgPSBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgZW5jb2Rpbmc6IHJlcXVpcmUoJy4vcmFua0VuY29kaW5ncycpXG59O1xuXG5cbiIsInZhciB2bCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93LnZsIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbC52bCA6IG51bGwpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHJhbmtFbmNvZGluZ3M7XG5cbi8vIGJhZCBzY29yZSBub3Qgc3BlY2lmaWVkIGluIHRoZSB0YWJsZSBhYm92ZVxudmFyIFVOVVNFRF9QT1NJVElPTiA9IDAuNTtcblxudmFyIE1BUktfU0NPUkUgPSB7XG4gIGxpbmU6IDAuOTksXG4gIGFyZWE6IDAuOTgsXG4gIGJhcjogMC45NyxcbiAgdGljazogMC45NixcbiAgcG9pbnQ6IDAuOTUsXG4gIGNpcmNsZTogMC45NCxcbiAgc3F1YXJlOiAwLjk0LFxuICB0ZXh0OiAwLjhcbn07XG5cbmZ1bmN0aW9uIHJhbmtFbmNvZGluZ3MoZW5jb2RpbmcsIHN0YXRzLCBvcHQsIHNlbGVjdGVkKSB7XG4gIHZhciBmZWF0dXJlcyA9IFtdLFxuICAgIGVuY1R5cGVzID0gdmwua2V5cyhlbmNvZGluZy5lbmMpO1xuXG4gIHZhciBlbmNvZGluZ01hcHBpbmdCeUZpZWxkID0gdmwuZW5jLnJlZHVjZShlbmNvZGluZy5lbmMsIGZ1bmN0aW9uKG8sIGVuY1R5cGUsIGZpZWxkKSB7XG4gICAgdmFyIGtleSA9IHZsLmZpZWxkLnNob3J0aGFuZChmaWVsZCk7XG4gICAgdmFyIG1hcHBpbmdzID0gb1trZXldID0gb1trZXldIHx8IFtdO1xuICAgIG1hcHBpbmdzLnB1c2goe2VuY1R5cGU6IGVuY1R5cGUsIGZpZWxkOiBmaWVsZH0pO1xuICAgIHJldHVybiBvO1xuICB9LCB7fSk7XG5cbiAgdmwua2V5cyhlbmNvZGluZ01hcHBpbmdCeUZpZWxkKS5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuICAgIHZhciBtYXBwaW5ncyA9IGVuY29kaW5nTWFwcGluZ0J5RmllbGRba2V5XSxcbiAgICAgIHJlYXNvbnMgPSBtYXBwaW5ncy5tYXAoZnVuY3Rpb24obSkge1xuICAgICAgICByZXR1cm4gbS5lbmNUeXBlICsgdmwuc2hvcnRoYW5kLmFzc2lnbiArIHZsLmZpZWxkLnNob3J0aGFuZChtLmZpZWxkKSArXG4gICAgICAgICAgJyAnICsgKHNlbGVjdGVkICYmIHNlbGVjdGVkW20uZmllbGQubmFtZV0gPyAnW3hdJyA6ICdbIF0nKTtcbiAgICAgIH0pLFxuICAgICAgc2NvcmVzID0gbWFwcGluZ3MubWFwKGZ1bmN0aW9uKG0pIHtcbiAgICAgICAgdmFyIHJvbGUgPSB2bC5maWVsZC5yb2xlKG0uZmllbGQpO1xuICAgICAgICB2YXIgc2NvcmUgPSByYW5rRW5jb2RpbmdzLnNjb3JlW3JvbGVdKG0uZmllbGQsIG0uZW5jVHlwZSwgZW5jb2RpbmcubWFya3R5cGUsIHN0YXRzLCBvcHQpO1xuXG4gICAgICAgIHJldHVybiAhc2VsZWN0ZWQgfHwgc2VsZWN0ZWRbbS5maWVsZC5uYW1lXSA/IHNjb3JlIDogTWF0aC5wb3coc2NvcmUsIDAuMTI1KTtcbiAgICAgIH0pO1xuXG4gICAgZmVhdHVyZXMucHVzaCh7XG4gICAgICByZWFzb246IHJlYXNvbnMuam9pbihcIiB8IFwiKSxcbiAgICAgIHNjb3JlOiBNYXRoLm1heC5hcHBseShudWxsLCBzY29yZXMpXG4gICAgfSk7XG4gIH0pO1xuXG4gIC8vIHBlbmFsaXplIG5vdCB1c2luZyBwb3NpdGlvbmFsIG9ubHkgcGVuYWxpemUgZm9yIG5vbi10ZXh0XG4gIGlmIChlbmNUeXBlcy5sZW5ndGggPiAxICYmIGVuY29kaW5nLm1hcmt0eXBlICE9PSAndGV4dCcpIHtcbiAgICBpZiAoKCFlbmNvZGluZy5lbmMueCB8fCAhZW5jb2RpbmcuZW5jLnkpICYmICFlbmNvZGluZy5lbmMuZ2VvICYmICFlbmNvZGluZy5lbmMudGV4dCkge1xuICAgICAgZmVhdHVyZXMucHVzaCh7XG4gICAgICAgIHJlYXNvbjogJ3VudXNlZCBwb3NpdGlvbicsXG4gICAgICAgIHNjb3JlOiBVTlVTRURfUE9TSVRJT05cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIGZlYXR1cmVzLnB1c2goe1xuICAgIHJlYXNvbjogJ21hcmt0eXBlPScrZW5jb2RpbmcubWFya3R5cGUsXG4gICAgc2NvcmU6IE1BUktfU0NPUkVbZW5jb2RpbmcubWFya3R5cGVdXG4gIH0pO1xuXG4gIHJldHVybiB7XG4gICAgc2NvcmU6IGZlYXR1cmVzLnJlZHVjZShmdW5jdGlvbihwLCBmKSB7XG4gICAgICByZXR1cm4gcCAqIGYuc2NvcmU7XG4gICAgfSwgMSksXG4gICAgZmVhdHVyZXM6IGZlYXR1cmVzXG4gIH07XG59XG5cblxudmFyIEQgPSB7fSwgTSA9IHt9LCBCQUQgPSAwLjEsIFRFUlJJQkxFID0gMC4wMTtcblxuRC5taW5vciA9IDAuMDE7XG5ELnBvcyA9IDE7XG5ELllfVCA9IDAuODtcbkQuZmFjZXRfdGV4dCA9IDE7XG5ELmZhY2V0X2dvb2QgPSAwLjc7XG5ELmZhY2V0X29rID0gMC41NTtcbkQuZmFjZXRfYmFkID0gMC40O1xuRC5jb2xvcl9nb29kID0gMC43O1xuRC5jb2xvcl9vayA9IDAuNjU7IC8vID4gTS5TaXplXG5ELmNvbG9yX2JhZCA9IDAuMztcbkQuY29sb3Jfc3RhY2sgPSAwLjY7XG5ELnNoYXBlID0gMC42O1xuRC5kZXRhaWwgPSAwLjU7XG5ELmJhZCA9IEJBRDtcbkQudGVycmlibGUgPSBURVJSSUJMRTtcblxuTS5wb3MgPSAxO1xuTS5zaXplID0gMC42O1xuTS5jb2xvciA9IDAuNTtcbk0uYWxwaGEgPSAwLjQ1O1xuTS50ZXh0ID0gMC40O1xuTS5iYWQgPSBCQUQ7XG5NLnRlcnJpYmxlID0gVEVSUklCTEU7XG5cbnJhbmtFbmNvZGluZ3MuZGltZW5zaW9uU2NvcmUgPSBmdW5jdGlvbiAoZmllbGQsIGVuY1R5cGUsIG1hcmt0eXBlLCBzdGF0cywgb3B0KXtcbiAgdmFyIGNhcmRpbmFsaXR5ID0gdmwuZmllbGQuY2FyZGluYWxpdHkoZmllbGQsIHN0YXRzKTtcbiAgc3dpdGNoIChlbmNUeXBlKSB7XG4gICAgY2FzZSAneCc6XG4gICAgICBpZihmaWVsZC50eXBlID09PSAnTycpIHJldHVybiBELnBvcyAtIEQubWlub3I7XG4gICAgICByZXR1cm4gRC5wb3M7XG5cbiAgICBjYXNlICd5JzpcbiAgICAgIGlmKGZpZWxkLnR5cGUgPT09ICdPJykgcmV0dXJuIEQucG9zIC0gRC5taW5vcjsgLy9wcmVmZXIgb3JkaW5hbCBvbiB5XG4gICAgICBpZihmaWVsZC50eXBlID09PSAnVCcpIHJldHVybiBELllfVDsgLy8gdGltZSBzaG91bGQgbm90IGJlIG9uIFlcbiAgICAgIHJldHVybiBELnBvcyAtIEQubWlub3I7XG5cbiAgICBjYXNlICdjb2wnOlxuICAgICAgaWYgKG1hcmt0eXBlID09PSAndGV4dCcpIHJldHVybiBELmZhY2V0X3RleHQ7XG4gICAgICAvL3ByZWZlciBjb2x1bW4gb3ZlciByb3cgZHVlIHRvIHNjcm9sbGluZyBpc3N1ZXNcbiAgICAgIHJldHVybiBjYXJkaW5hbGl0eSA8PSBvcHQubWF4R29vZENhcmRpbmFsaXR5Rm9yRmFjZXRzID8gRC5mYWNldF9nb29kIDpcbiAgICAgICAgY2FyZGluYWxpdHkgPD0gb3B0Lm1heENhcmRpbmFsaXR5Rm9yRmFjZXRzID8gRC5mYWNldF9vayA6IEQuZmFjZXRfYmFkO1xuXG4gICAgY2FzZSAncm93JzpcbiAgICAgIGlmIChtYXJrdHlwZSA9PT0gJ3RleHQnKSByZXR1cm4gRC5mYWNldF90ZXh0O1xuICAgICAgcmV0dXJuIChjYXJkaW5hbGl0eSA8PSBvcHQubWF4R29vZENhcmRpbmFsaXR5Rm9yRmFjZXRzID8gRC5mYWNldF9nb29kIDpcbiAgICAgICAgY2FyZGluYWxpdHkgPD0gb3B0Lm1heENhcmRpbmFsaXR5Rm9yRmFjZXRzID8gRC5mYWNldF9vayA6IEQuZmFjZXRfYmFkKSAtIEQubWlub3I7XG5cbiAgICBjYXNlICdjb2xvcic6XG4gICAgICB2YXIgaGFzT3JkZXIgPSAoZmllbGQuYmluICYmIGZpZWxkLnR5cGU9PT0nUScpIHx8IChmaWVsZC5mbiAmJiBmaWVsZC50eXBlPT09J1QnKTtcblxuICAgICAgLy9GSVhNRSBhZGQgc3RhY2tpbmcgb3B0aW9uIG9uY2Ugd2UgaGF2ZSBjb250cm9sIC4uXG4gICAgICB2YXIgaXNTdGFja2VkID0gbWFya3R5cGUgPT09J2JhcicgfHwgbWFya3R5cGUgPT09J2FyZWEnO1xuXG4gICAgICAvLyB0cnVlIG9yZGluYWwgb24gY29sb3IgaXMgY3VycmVudGx5IEJBRCAodW50aWwgd2UgaGF2ZSBnb29kIG9yZGluYWwgY29sb3Igc2NhbGUgc3VwcG9ydClcbiAgICAgIGlmIChoYXNPcmRlcikgcmV0dXJuIEQuY29sb3JfYmFkO1xuXG4gICAgICAvL3N0YWNraW5nIGdldHMgbG93ZXIgc2NvcmVcbiAgICAgIGlmIChpc1N0YWNrZWQpIHJldHVybiBELmNvbG9yX3N0YWNrO1xuXG4gICAgICByZXR1cm4gY2FyZGluYWxpdHkgPD0gb3B0Lm1heEdvb2RDYXJkaW5hbGl0eUZvckNvbG9yID8gRC5jb2xvcl9nb29kOiBjYXJkaW5hbGl0eSA8PSBvcHQubWF4Q2FyZGluYWxpdHlGb3JDb2xvciA/IEQuY29sb3Jfb2sgOiBELmNvbG9yX2JhZDtcbiAgICBjYXNlICdzaGFwZSc6XG4gICAgICByZXR1cm4gY2FyZGluYWxpdHkgPD0gb3B0Lm1heENhcmRpbmFsaXR5Rm9yU2hhcGUgPyBELnNoYXBlIDogVEVSUklCTEU7XG4gICAgY2FzZSAnZGV0YWlsJzpcbiAgICAgIHJldHVybiBELmRldGFpbDtcbiAgfVxuICByZXR1cm4gVEVSUklCTEU7XG59O1xuXG5yYW5rRW5jb2RpbmdzLmRpbWVuc2lvblNjb3JlLmNvbnN0cyA9IEQ7XG5cbnJhbmtFbmNvZGluZ3MubWVhc3VyZVNjb3JlID0gZnVuY3Rpb24gKGZpZWxkLCBlbmNUeXBlLCBtYXJrdHlwZSwgc3RhdHMsIG9wdCkge1xuICBzd2l0Y2ggKGVuY1R5cGUpe1xuICAgIGNhc2UgJ3gnOiByZXR1cm4gTS5wb3M7XG4gICAgY2FzZSAneSc6IHJldHVybiBNLnBvcztcbiAgICBjYXNlICdzaXplJzpcbiAgICAgIGlmIChtYXJrdHlwZSA9PT0gJ2JhcicpIHJldHVybiBCQUQ7IC8vc2l6ZSBvZiBiYXIgaXMgdmVyeSBiYWRcbiAgICAgIGlmIChtYXJrdHlwZSA9PT0gJ3RleHQnKSByZXR1cm4gQkFEO1xuICAgICAgaWYgKG1hcmt0eXBlID09PSAnbGluZScpIHJldHVybiBCQUQ7XG4gICAgICByZXR1cm4gTS5zaXplO1xuICAgIGNhc2UgJ2NvbG9yJzogcmV0dXJuIE0uY29sb3I7XG4gICAgY2FzZSAnYWxwaGEnOiByZXR1cm4gTS5hbHBoYTtcbiAgICBjYXNlICd0ZXh0JzogcmV0dXJuIE0udGV4dDtcbiAgfVxuICByZXR1cm4gQkFEO1xufTtcblxucmFua0VuY29kaW5ncy5tZWFzdXJlU2NvcmUuY29uc3RzID0gTTtcblxuXG5yYW5rRW5jb2RpbmdzLnNjb3JlID0ge1xuICBkaW1lbnNpb246IHJhbmtFbmNvZGluZ3MuZGltZW5zaW9uU2NvcmUsXG4gIG1lYXN1cmU6IHJhbmtFbmNvZGluZ3MubWVhc3VyZVNjb3JlLFxufTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgY29uc3RzID0gcmVxdWlyZSgnLi9jb25zdHMnKTtcblxudmFyIHV0aWwgPSBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgZ2VuOiB7fVxufTtcblxudXRpbC5pc0FycmF5ID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAob2JqKSB7XG4gIHJldHVybiB7fS50b1N0cmluZy5jYWxsKG9iaikgPT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG5cbnV0aWwuanNvbiA9IGZ1bmN0aW9uKHMsIHNwKSB7XG4gIHJldHVybiBKU09OLnN0cmluZ2lmeShzLCBudWxsLCBzcCk7XG59O1xuXG51dGlsLmtleXMgPSBmdW5jdGlvbihvYmopIHtcbiAgdmFyIGsgPSBbXSwgeDtcbiAgZm9yICh4IGluIG9iaikgay5wdXNoKHgpO1xuICByZXR1cm4gaztcbn07XG5cbnV0aWwubmVzdGVkTWFwID0gZnVuY3Rpb24gKGNvbCwgZiwgbGV2ZWwsIGZpbHRlcikge1xuICByZXR1cm4gbGV2ZWwgPT09IDAgP1xuICAgIGNvbC5tYXAoZikgOlxuICAgIGNvbC5tYXAoZnVuY3Rpb24odikge1xuICAgICAgdmFyIHIgPSB1dGlsLm5lc3RlZE1hcCh2LCBmLCBsZXZlbCAtIDEpO1xuICAgICAgcmV0dXJuIGZpbHRlciA/IHIuZmlsdGVyKHV0aWwubm9uRW1wdHkpIDogcjtcbiAgICB9KTtcbn07XG5cbnV0aWwubmVzdGVkUmVkdWNlID0gZnVuY3Rpb24gKGNvbCwgZiwgbGV2ZWwsIGZpbHRlcikge1xuICByZXR1cm4gbGV2ZWwgPT09IDAgP1xuICAgIGNvbC5yZWR1Y2UoZiwgW10pIDpcbiAgICBjb2wubWFwKGZ1bmN0aW9uKHYpIHtcbiAgICAgIHZhciByID0gdXRpbC5uZXN0ZWRSZWR1Y2UodiwgZiwgbGV2ZWwgLSAxKTtcbiAgICAgIHJldHVybiBmaWx0ZXIgPyByLmZpbHRlcih1dGlsLm5vbkVtcHR5KSA6IHI7XG4gICAgfSk7XG59O1xuXG51dGlsLm5vbkVtcHR5ID0gZnVuY3Rpb24oZ3JwKSB7XG4gIHJldHVybiAhdXRpbC5pc0FycmF5KGdycCkgfHwgZ3JwLmxlbmd0aCA+IDA7XG59O1xuXG5cbnV0aWwudHJhdmVyc2UgPSBmdW5jdGlvbiAobm9kZSwgYXJyKSB7XG4gIGlmIChub2RlLnZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICBhcnIucHVzaChub2RlLnZhbHVlKTtcbiAgfSBlbHNlIHtcbiAgICBpZiAobm9kZS5sZWZ0KSB1dGlsLnRyYXZlcnNlKG5vZGUubGVmdCwgYXJyKTtcbiAgICBpZiAobm9kZS5yaWdodCkgdXRpbC50cmF2ZXJzZShub2RlLnJpZ2h0LCBhcnIpO1xuICB9XG4gIHJldHVybiBhcnI7XG59O1xuXG51dGlsLnVuaW9uID0gZnVuY3Rpb24gKGEsIGIpIHtcbiAgdmFyIG8gPSB7fTtcbiAgYS5mb3JFYWNoKGZ1bmN0aW9uKHgpIHsgb1t4XSA9IHRydWU7fSk7XG4gIGIuZm9yRWFjaChmdW5jdGlvbih4KSB7IG9beF0gPSB0cnVlO30pO1xuICByZXR1cm4gdXRpbC5rZXlzKG8pO1xufTtcblxuXG51dGlsLmdlbi5nZXRPcHQgPSBmdW5jdGlvbiAob3B0KSB7XG4gIC8vbWVyZ2Ugd2l0aCBkZWZhdWx0XG4gIHJldHVybiAob3B0ID8gdXRpbC5rZXlzKG9wdCkgOiBbXSkucmVkdWNlKGZ1bmN0aW9uKGMsIGspIHtcbiAgICBjW2tdID0gb3B0W2tdO1xuICAgIHJldHVybiBjO1xuICB9LCBPYmplY3QuY3JlYXRlKGNvbnN0cy5nZW4uREVGQVVMVF9PUFQpKTtcbn07XG5cbi8qKlxuICogcG93ZXJzZXQgY29kZSBmcm9tIGh0dHA6Ly9yb3NldHRhY29kZS5vcmcvd2lraS9Qb3dlcl9TZXQjSmF2YVNjcmlwdFxuICpcbiAqICAgdmFyIHJlcyA9IHBvd2Vyc2V0KFsxLDIsMyw0XSk7XG4gKlxuICogcmV0dXJuc1xuICpcbiAqIFtbXSxbMV0sWzJdLFsxLDJdLFszXSxbMSwzXSxbMiwzXSxbMSwyLDNdLFs0XSxbMSw0XSxcbiAqIFsyLDRdLFsxLDIsNF0sWzMsNF0sWzEsMyw0XSxbMiwzLDRdLFsxLDIsMyw0XV1cbltlZGl0XVxuKi9cblxudXRpbC5wb3dlcnNldCA9IGZ1bmN0aW9uKGxpc3QpIHtcbiAgdmFyIHBzID0gW1xuICAgIFtdXG4gIF07XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgIGZvciAodmFyIGogPSAwLCBsZW4gPSBwcy5sZW5ndGg7IGogPCBsZW47IGorKykge1xuICAgICAgcHMucHVzaChwc1tqXS5jb25jYXQobGlzdFtpXSkpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcHM7XG59O1xuXG51dGlsLmNob29zZUtvckxlc3MgPSBmdW5jdGlvbihsaXN0LCBrKSB7XG4gIHZhciBzdWJzZXQgPSBbW11dO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICBmb3IgKHZhciBqID0gMCwgbGVuID0gc3Vic2V0Lmxlbmd0aDsgaiA8IGxlbjsgaisrKSB7XG4gICAgICB2YXIgc3ViID0gc3Vic2V0W2pdLmNvbmNhdChsaXN0W2ldKTtcbiAgICAgIGlmKHN1Yi5sZW5ndGggPD0gayl7XG4gICAgICAgIHN1YnNldC5wdXNoKHN1Yik7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBzdWJzZXQ7XG59O1xuXG51dGlsLmNob29zZUsgPSBmdW5jdGlvbihsaXN0LCBrKSB7XG4gIHZhciBzdWJzZXQgPSBbW11dO1xuICB2YXIga0FycmF5ID1bXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgZm9yICh2YXIgaiA9IDAsIGxlbiA9IHN1YnNldC5sZW5ndGg7IGogPCBsZW47IGorKykge1xuICAgICAgdmFyIHN1YiA9IHN1YnNldFtqXS5jb25jYXQobGlzdFtpXSk7XG4gICAgICBpZihzdWIubGVuZ3RoIDwgayl7XG4gICAgICAgIHN1YnNldC5wdXNoKHN1Yik7XG4gICAgICB9ZWxzZSBpZiAoc3ViLmxlbmd0aCA9PT0gayl7XG4gICAgICAgIGtBcnJheS5wdXNoKHN1Yik7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBrQXJyYXk7XG59O1xuXG51dGlsLmNyb3NzID0gZnVuY3Rpb24oYSxiKXtcbiAgdmFyIHggPSBbXTtcbiAgZm9yKHZhciBpPTA7IGk8IGEubGVuZ3RoOyBpKyspe1xuICAgIGZvcih2YXIgaj0wO2o8IGIubGVuZ3RoOyBqKyspe1xuICAgICAgeC5wdXNoKGFbaV0uY29uY2F0KGJbal0pKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHg7XG59O1xuXG4iXX0=