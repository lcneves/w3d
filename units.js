/*
 * units.js
 * Copyright 2017 Lucas Neves <lcneves@gmail.com>
 *
 * Utility functions for parsing and converting style units.
 * Part of the Livre project.
 */

'use strict';

const windowUtils = require('./window-utils.js');

const REM_SIZE = 16;

function parseSize (size) {
  const supportedFormats = ['px', 'rem', 'em', 'vw', 'vh', '%'];

  if (typeof size === 'number') {
    return {
      quantum: size,
      unit: 'px'
    };
  }

  else if (typeof size === 'string') {

    if (!isNaN(size)) {
      return {
        quantum: +size,
        unit: 'px'
      };
    }

    var quantum;
    var unit;

    for (let format of supportedFormats) {
      if (size.endsWith(format)) {
        quantum = size.substring(0, size.length - format.length);
        quantum = +quantum;
        unit = format;
        break;
      }
    }

    if (!isNaN(quantum)) {
      return {
        quantum: quantum,
        unit: unit
      };
    }
    else {
      throw new Error('Unsupported size! Received: ' + size);
    }
  }

  else {
    throw new Error('Unsupported format! Expected string or number, received: '
        + typeof size);
  }
}

function convert (object, parameter, unit) {

  var parsed = parseSize(object.getStyle(parameter));
  var quantum;

  switch (parsed.unit) {

    case 'px':
      quantum = parsed.quantum;
      break;

    case 'rem':
      quantum = parsed.quantum * REM_SIZE;
      break;

    case 'em':
      quantum = parsed.quantum * object.fontSize;
      break;

    case 'vw':
      quantum = parsed.quantum * windowUtils.worldToPixels;
      break;

    case 'vh':
      quantum = parsed.quantum *
        windowUtils.worldToPixels / windowUtils.aspectRatio;
      break;

    case '%':
      var multiplier = quantum / 100;
      var currentObject = object;
      var parentObject;
      while (currentObject._parent) {
        parentObject = currentObject._parent;
        var parentSize = parseSize(parentObject, parameter);
        if (parentSize.unit === '%') {
          multiplier *= parentSize.quantum / 100;
        }
        else {
          quantum = convert(parentObject, parameter, unit) * multiplier;
          break;
        }
        currentObject = parentObject;
      }
      break;
  }

  if (unit === 'world') {
    quantum = quantum / windowUtils.worldToPixels;
  }

  return quantum;
}

module.exports.parse = parseSize;
module.exports.convert = convert;
