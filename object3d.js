/*
 * object3d.js
 * Copyright 2017 Lucas Neves <lcneves@gmail.com>
 *
 * Exports an object that extends THREE.Object3D with extra functionality.
 * Part of the Livre project.
 */

'use strict';

const THREE = require('three');

/*
 * Gives the object's world boundaries relative to its position point.
 * Three.js uses the right-hand coordinate system, so:
 * - the x axis grows to the right;
 * - the y axis grows to the top;
 * - the z axis grows to the near.
 */
function getBoundaries(object) {
  const bbox = new THREE.Box3().setFromObject(object);
  return {
    left: object.position.x - bbox.min.x,
    right: bbox.max.x - object.position.x,
    top: bbox.max.y - object.position.y,
    bottom: object.position.y - bbox.min.y,
    far: object.position.z - bbox.min.z,
    near: bbox.max.z - object.position.z
  };
}

/*
 * Gives the object's world dimensions in a boundary box.
 */
function getDimensions(object) {
  const bbox = new THREE.Box3().setFromObject(object);
  return {
    x: bbox.max.x - bbox.min.x,
    y: bbox.max.y - bbox.min.y,
    z: bbox.max.z - bbox.min.z
  };
}


function makeInitialPosition(axis) {
  var position = {
    reference: undefined,
    distance: 0
  };
  switch (axis) {
    case 'x':
      position.reference = 'left';
      break;
    case 'y':
      position.reference = 'top';
      break;
    case 'z':
      position.reference = 'far';
      break;
  }

  return position;
}

/*
 * Returns the world position that the child should have
 * given its relative position to the parent.
 */
function makeWorldPosition(childObject, parentObject) {
  const parentBoundaries = parentObject.boundaries;
  const childBoundaries = childObject.boundaries;

  var position = {};

  for (let axis of ['x', 'y', 'z']) {
    let reference = childObject.relativePosition[axis].reference;
    let factor;
    switch (reference) {
      case 'right':
      case 'top':
      case 'near':
        factor = -1;
        break;
      default:
        factor = 1;
        break;
    }

    position[axis] =
      parentObject.position[axis] + factor * (
        childObject.relativePosition[axis].distance +
        childBoundaries[reference] -
        parentBoundaries[reference]
      );
  }

  console.dir({
    parentBoundaries: parentBoundaries,
    childBoundaries: childBoundaries,
    parentPosition: parentObject.position,
    childPosition: position,
    childRelativePosition: childObject.relativePosition
  });

  return position;
}

function parseRelativePosition(position) {
  var parsedPosition;

  for (let prop in position) {
    if (position.hasOwnProperty(prop)) {
      let relative;
      let distance;
      let axis = position[prop];
      let indexSemicolon = axis.indexOf(':');
      if (indexSemicolon !== -1) {
        relative = // TODO: continue when sober.
}

class Object3D extends THREE.Object3D {
  constructor(mesh) {
    super();

    if (mesh) {
      this.add(mesh);
    }

    this.relativePosition = {
      x: makeInitialPosition('x'),
      y: makeInitialPosition('y'),
      z: makeInitialPosition('z')
    };
  }

  get dimensions() {
    return getDimensions(this);
  }

  get boundaries() {
    return getBoundaries(this);
  }

  setWorldPosition(parentObject) {
    parentObject = parentObject || this.parent;

    var position = makeWorldPosition(this, parentObject);
    for (let prop in position) {
      if (position.hasOwnProperty(prop)) {
        this.position[prop] = position[prop];
      }
    }
  }

  addRelative(object) {
    object.setWorldPosition(this);
    this.add(object);
  }
}

module.exports = Object3D;