/*
 * object3d.js
 * Copyright 2017 Lucas Neves <lcneves@gmail.com>
 *
 * Exports an object that extends THREE.Object3D with extra functionality.
 * Part of the Livre project.
 */

'use strict';

module.exports = function (theme, options) {

  const THREE = require('three');

  const ht3d = require('./ht3d.js');
  const style = require('./style.js')(options);
  theme.resources = style.loadResources(theme.stylesheets);
  const text = require('./text.js')(theme.resources.fonts);
  const windowUtils = require('./window-utils.js');
  const messages = require('./messages.js');

  class Background extends THREE.PlaneGeometry {
    constructor(object) {
      if (object && object._isLivreObject) 
      {
        const style = object.style;
        if (!style) {
          throw new Error ('Object does not have a style property!');
        }
        var bgColor = object.style['background-color'];
        var dimensions = object.dimensions;
        var material = new THREE.MeshPhongMaterial({
          color: object.style['background-color']
        });
        var geometry = new THREE.PlaneGeometry(dimensions.x, dimensions.y);
        super(geometry, material);

        this._isBackground = true;
        this._ignoreSize = true;
      }
      else {
        throw new Error('Invalid object!');
      }
    }
  }

  function getDirectionAxis(direction) {
    var directionAxis;
      switch (direction) {
        case 'row':
          directionAxis = 'x';
          break;
        case 'stack':
          directionAxis = 'z';
          break;
        default:
          directionAxis = 'y';
          break;
      }
    return directionAxis;
  }

  function getDimensionsFromBbox(bbox) {
    return {
      x: bbox.max.x - bbox.min.x,
      y: bbox.max.y - bbox.min.y,
      z: bbox.max.z - bbox.min.z
    };
  }

  function makeBboxFromImage(image) {
    const worldToPixels = windowUtils.worldToPixels
    return {
      min: {
        x: - image.width / (2 * worldToPixels),
        y: - image.height / (2 * worldToPixels),
        z: 0
      },
      max: {
        x: image.width / (2 * worldToPixels),
        y: image.height / (2 * worldToPixels),
        z: 0
      }
    };
  }

  function isSpriteFromCanvas (object) {
    return (
      object.material &&
      object.material.map &&
      object.material.map.image &&
      object.material.map.image.width &&
      object.material.map.image.height
    );
  };


  function getBboxFromObject(object) {
    if (object.geometry) {
      if (object.geometry.boundingBox === null) {
        object.geometry.computeBoundingBox();
      }
      return object.geometry.boundingBox;
    }

    else if (isSpriteFromCanvas(object)) {
      return makeBboxFromImage(object.material.map.image);
    }

    // Last resort
    else {
      return new THREE.Box3().setFromObject(object);
    }
  }

  /*
   * Gives the object's world dimensions in a boundary box.
   * By default, does not include margins; only paddings.
   */
  function getDimensions(object, options) {
    if (object._isLivreObject) {
      options = typeof options === 'object' && options !== null ? options : {};
      var virtualBox = {
        x: 0,
        y: 0,
        z: 0
      };
      for (let child of object.children) {
        if(!child._ignoreSize) {
          let dimensions = getDimensions(child, { includeMargin: true });
          for (let axis of ['x', 'y', 'z']) {
            let directionAxis = getDirectionAxis(options.direction);
            if (axis === directionAxis) {
              virtualBox[axis] += dimensions[axis];
            }
            else {
              virtualBox[axis] = Math.max(virtualBox[axis], dimensions[axis]);
            }
          }
        }
      }
      var style = object._style;
      virtualBox.x += style['padding-left'] + style['padding-right'];
      virtualBox.y += style['padding-top'] + style['padding-bottom'];
      virtualBox.z += style['padding-far'] + style['padding-near'];

      if (options && options.includeMargin) {
        virtualBox.x += style['margin-left'] + style['margin-right'];
        virtualBox.y += style['margin-top'] + style['margin-bottom'];
        virtualBox.z += style['margin-far'] + style['margin-near'];
      }

      return virtualBox;
    }

    else { // Not _isLivreObject
      return getDimensionsFromBbox(getBboxFromObject(object));
    }
  }

  function getSpacer(object, direction) {
    if (object._isLivreObject) {
      return object._style['margin-' + direction] +
        object._style['padding-' + direction];
    }
    else {
      return 0;
    }
  }

  /*
   * Gives the object's world boundaries relative to its position point.
   * Three.js uses the right-hand coordinate system, so:
   * - the x axis grows to the right;
   * - the y axis grows to the top;
   * - the z axis grows to the near.
   */
  function getBoundaries(object) {
    if (object._isLivreObject) {
      var dimensions = object.dimensions;
      return {
        left: 0,
        right: dimensions.x,
        top: dimensions.y,
        bottom: 0,
        far: 0,
        near: dimensions.z
      };
    }
    else {
      var position = new THREE.Vector3();
      position.setFromMatrixPosition(object.matrixWorld);
      const bbox = getBboxFromObject(object);
      return {
        left: position.x - bbox.min.x,
        right: bbox.max.x - position.x,
        top: bbox.max.y - position.y,
        bottom: position.y - bbox.min.y,
        far: position.z - bbox.min.z,
        near: bbox.max.z - position.z
      };
    }
  }

  function makeInitialPosition() {
    return {
      x: { reference: 'left', distance: 0 },
      y: { reference: 'top', distance: 0 },
      z: { reference: 'far', distance: 0 }
    };
  }

  /*
   * Returns the world position that the child should have
   * given its relative position to the parent.
   */
  function makeWorldPosition(childObject, parentObject, offset) {
    const parentBoundaries = parentObject.boundaries;
    const parentDimensions = parentObject.dimensions;
    const childBoundaries = childObject._isLivreObject ?
      null : getBoundaries(childObject);

    var position = {};

    for (let axis of ['x', 'y', 'z']) {
      position[axis] = offset[axis].distance;
      if (!childObject._isLivreObject) {
        position[axis] += childBoundaries[offset[axis].reference];
      }
      switch (offset[axis].reference) {
        case 'right':
        case 'top':
        case 'near':
          position[axis] = - position[axis];
          break;
        default:
          break;
      }
    }
    return position;
  }

  function scaleSprite (sprite) {
    var width = sprite.material.map.image.width;
    var aspect = width / sprite.material.map.image.height;
    var scaleFactor = windowUtils.getFontScaleFactor(width);

    sprite.scale.set(scaleFactor, scaleFactor / aspect, 1);
  }

  function isText3D (object) {
    return(
      object.geometry &&
      object.geometry.type === 'TextGeometry'
    );
  }

  function positionChildren(parentObject) {
    var offset = makeInitialPosition();
    offset.x.distance += getSpacer(parentObject, 'left');
    offset.y.distance += getSpacer(parentObject, 'top');
    offset.z.distance += getSpacer(parentObject, 'far');

    for (let i = 0; i < parentObject.children.length; i++) {
      let child = parentObject.children[i];
      let position;

      if (child._isBackground) {
        child = new Background(parentObject);
        position = makeWorldPosition(
          child,
          parentObject,
          makeInitialPosition()
        );
      }
      else {

        if (isText3D(child)) {
          child._resize(windowUtils.worldToPixels);
        }

        position = makeWorldPosition(child, parentObject, offset);
        let directionAxis = getDirectionAxis(parentObject._style['direction']);
        offset[directionAxis].distance +=
          getDimensions(child, { includeMargin: true })[directionAxis];
      }
      for (let axis of ['x', 'y', 'z']) {
        child.position[axis] = position[axis];
      }
      if (child._isLivreObject) {
        positionChildren(child);
      }
      else if (isSpriteFromCanvas(child)) {
        scaleSprite(child);
      }
    }
  }


  class Object3D extends THREE.Object3D {
    constructor(options) {
      super();

      options = (options && typeof options === 'object') ? options : {};

      // This passes a parameter to the HT3D parser that will be incorporated
      // in the resulting Object3D as the `_parent` property. It is necessary
      // for inheritance of style properties without messing with THREE's 
      // `parent` property.
      var parentObject = options.setParent ? options.setParent : null;

      if (options.hypertext) {
        return ht3d.parse(options.hypertext, parentObject, Object3D);
      }

      if (options.template) {
        const hypertext = theme.templates[options.template]();
        return ht3d.parse(hypertext, parentObject, Object3D);
      }

      if (options.mesh) {
        super.add(options.mesh);
      }

      this._isLivreObject = true;

    }

    get dimensions() {
      return getDimensions(this);
    }

    get boundaries() {
      return getBoundaries(this);
    }

    getStyle(property) {
      var currentObject = this;
      do {
        if (currentObject._style[property] !== undefined) {
          return currentObject._style[property];
        }
        currentObject = currentObject.parent || currentObject._parent;
      }
      while (currentObject.parent || currentObject._parent);

      return undefined;
    }

    arrangeChildren() {
      positionChildren(this);
    }

    setWorldPosition(parentObject, offset) {
      parentObject = parentObject || this.parent;
      offset = offset || makeInitialPosition();

      var position = makeWorldPosition(this, parentObject, offset);
      for (let prop in position) {
        if (position.hasOwnProperty(prop)) {
          this.position[prop] = position[prop];
        }
      }
    }

    setProperty(property, value) {
      if (property && typeof property === 'string' && value) {
        this._ht3d = this._ht3d ? this._ht3d : {};
        this._ht3d[property] = value;
      }
      else {
        throw new Error('Invalid inputs!');
      }
    }

    makeStyle() {
      this._style = style.make(theme.stylesheets, this);
    }

    makeText() {
      if (this._ht3d && this._ht3d.text) {

        // Headers get rendered in real 3D characters;
        // other tags get rendered as sprites based on 2D HTML5 canvases
        var options = {};
        switch (this._ht3d.tag) {
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6':
            options.text3D = true;
        }

        text.make(this._ht3d.text, {
          'font-family': this.getStyle('font-family'),
          'font-size': this.getStyle('font-size'),
          'font-height': this.getStyle('font-height'),
          'font-weight': this.getStyle('font-weight'),
          'color': this.getStyle('color')
        }, options).then(newText => {
          this.add(newText, { rearrange: true });
        });
      }
    }

    // Overrides THREE.Object3D's add function
    add(object, options) {
      THREE.Object3D.prototype.add.call(this, object);

      if (options && options.rearrange) {
        var topObject = this;
        while (topObject.parent && topObject.parent._isLivreObject) {
          topObject = topObject.parent;
        }
        messages.setMessage('needsArrange', topObject);
      }
    }
  }

  return Object3D;
};
