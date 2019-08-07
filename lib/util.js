const { EventEmitter } = require('events');
const Utils = require('util');
const debug = require('debug')('cicp:util');

const DEFAULT_CLONE_DEPTH = 20;

class Util extends EventEmitter {
  /**
   * @constructor
   */
  constructor() {
    super();
    debug('constructor');
  }

  /**
   * Extend an object, and any object it contains.
   *
   * This does not replace deep objects, but dives into them
   * replacing individual elements instead.
   *
   * @protected
   * @method extendDeep
   * @param mergeInto {object} The object to merge into
   * @param mergeFrom... {object...} - Any number of objects to merge from
   * @param depth {integer} An optional depth to prevent recursion.  Default: 20.
   * @return {object} The altered mergeInto object is returned
   *
   * This method is copied from http://lorenwest.github.com/node-config
   *
   * May be freely distributed under the MIT license.
   * Copyright (c) 2010-2018 Loren West and other contributors
   */
  extendDeep(mergeInto) {
    // Initialize
    const vargs = Array.prototype.slice.call(arguments, 1);
    let depth = vargs.pop();
    if (typeof (depth) !== 'number') {
      vargs.push(depth);
      depth = DEFAULT_CLONE_DEPTH;
    }

    // Recursion detection
    if (depth < 0) {
      return mergeInto;
    }

    // Cycle through each object to extend
    vargs.forEach((mergeFrom) => {
      // Cycle through each element of the object to merge from
      // eslint-disable-next-line no-restricted-syntax, guard-for-in
      for (const prop in mergeFrom) {
        // Extend recursively if both elements are objects and target is not really a deferred function
        if (mergeFrom[prop] instanceof Date) {
          mergeInto[prop] = mergeFrom[prop]; // eslint-disable-line no-param-reassign
        } if (mergeFrom[prop] instanceof RegExp) {
          mergeInto[prop] = mergeFrom[prop]; // eslint-disable-line no-param-reassign
        } else if (this.isObject(mergeInto[prop]) && this.isObject(mergeFrom[prop])) {
          this.extendDeep(mergeInto[prop], mergeFrom[prop], depth - 1);
        } else if (mergeFrom[prop] && typeof mergeFrom[prop] === 'object') { // Copy recursively if the mergeFrom element is an object (or array or fn)
          mergeInto[prop] = this.cloneDeep(mergeFrom[prop], depth - 1); // eslint-disable-line no-param-reassign
        } else if (Object.getOwnPropertyDescriptor(Object(mergeFrom), prop)) { // Copy property descriptor otherwise, preserving accessors
          Object.defineProperty(mergeInto, prop, Object.getOwnPropertyDescriptor(Object(mergeFrom), prop));
        } else {
          mergeInto[prop] = mergeFrom[prop]; // eslint-disable-line no-param-reassign
        }
      }
    });

    // Chain
    return mergeInto;
  }

  /**
   * Is the specified argument a regular javascript object?
   *
   * The argument is an object if it's a JS object, but not an array.
   *
   * @protected
   * @method isObject
   * @param arg {*} An argument of any type.
   * @return {boolean} TRUE if the arg is an object, FALSE if not
   *
   * This method is copied from http://lorenwest.github.com/node-config
   *
   * May be freely distributed under the MIT license.
   * Copyright (c) 2010-2018 Loren West and other contributors
   */
  isObject(obj) {
    return (obj !== null) && (typeof obj === 'object') && !(Array.isArray(obj));
  }

  /**
   * Returns a string of flags for regular expression `re`.
   *
   *
   * @param {RegExp} re Regular expression
   * @returns {string} Flags
   *
   * This method is copied from http://lorenwest.github.com/node-config
   *
   * May be freely distributed under the MIT license.
   * Copyright (c) 2010-2018 Loren West and other contributors
   */
  getRegExpFlags(re) {
    let flags = '';
    re.global && (flags += 'g'); // eslint-disable-line no-unused-expressions
    re.ignoreCase && (flags += 'i'); // eslint-disable-line no-unused-expressions
    re.multiline && (flags += 'm'); // eslint-disable-line no-unused-expressions
    return flags;
  }

  /**
   * Return a deep copy of the specified object.
   *
   * This returns a new object with all elements copied from the specified
   * object.  Deep copies are made of objects and arrays so you can do anything
   * with the returned object without affecting the input object.
   *
   * @protected
   * @method cloneDeep
   * @param parent {object} The original object to copy from
   * @param [depth=20] {Integer} Maximum depth (default 20)
   * @return {object} A new object with the elements copied from the copyFrom object
   *
   * This method is copied from http://lorenwest.github.com/node-config
   *
   * May be freely distributed under the MIT license.
   * Copyright (c) 2010-2018 Loren West and other contributors
   */
  cloneDeep(parent, depth, circular, prototype) {
    // maintain two arrays for circular references, where corresponding parents
    // and children have the same index
    const allParents = [];
    const allChildren = [];

    const useBuffer = typeof Buffer !== 'undefined';

    if (typeof circular === 'undefined') { circular = true; } // eslint-disable-line no-param-reassign

    if (typeof depth === 'undefined') { depth = 20; } // eslint-disable-line no-param-reassign

    // recurse this function so we don't reset allParents and allChildren
    function _clone(parentObj, depthClone) {
      // cloning null always returns null
      if (parentObj === null) { return null; }

      if (depthClone === 0) { return parentObj; }

      let child;
      if (typeof parentObj !== 'object') {
        return parentObj;
      }

      if (Utils.isArray(parentObj)) {
        child = [];
      } else if (Utils.isRegExp(parentObj)) {
        child = new RegExp(parentObj.source, this.getRegExpFlags(parentObj));
        if (parentObj.lastIndex) child.lastIndex = parentObj.lastIndex;
      } else if (Utils.isDate(parentObj)) {
        child = new Date(parentObj.getTime());
      } else if (useBuffer && Buffer.isBuffer(parentObj)) {
        child = new Buffer(parentObj.length); // eslint-disable-line no-buffer-constructor
        parentObj.copy(child);
        return child;
      } else if (typeof prototype === 'undefined') child = Object.create(Object.getPrototypeOf(parentObj));
      else child = Object.create(prototype);

      if (circular) {
        const index = allParents.indexOf(parentObj);

        if (index !== -1) {
          return allChildren[index];
        }
        allParents.push(parentObj);
        allChildren.push(child);
      }

      // eslint-disable-next-line no-restricted-syntax, guard-for-in
      for (const i in parentObj) {
        const propDescriptor = Object.getOwnPropertyDescriptor(parentObj, i);
        const hasGetter = ((propDescriptor !== undefined) && (propDescriptor.get !== undefined));

        if (hasGetter) {
          Object.defineProperty(child, i, propDescriptor);
        } else {
          child[i] = _clone(parentObj[i], depthClone - 1);
        }
      }

      return child;
    }

    return _clone(parent, depth);
  }

  /**
   * Compare two objects
   *
   * @param {object} obj1 The first object to compare
   * @param {object} obj2 The second object to compare
   *
   * @returns {bool} Tells if objects are the same or not
   */
  compareObject(obj1, obj2) {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
  }

  isEmptyObject(obj) {
    return obj === null || this.compareObject(obj, {});
  }
}

module.exports = {
  Util,
};
