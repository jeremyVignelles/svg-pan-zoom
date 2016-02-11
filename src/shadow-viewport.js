var SvgUtils = require('./svg-utilities')
  , Utils = require('./utilities')
  ;

var ShadowViewport = function(viewport, options){
  this.init(viewport, options)
}

/**
 * Initialization
 *
 * @param  {SVGElement} viewport
 * @param  {Object} options
 */
ShadowViewport.prototype.init = function(viewport, options) {
  // DOM Elements
  this.viewport = viewport
  this.options = options

  // State cache
  this.originalState = {zoomX: 1, zoomY: 1, x: 0, y: 0}
  this.activeState = {zoomX: 1, zoomY: 1, x: 0, y: 0}

  this.updateCTMCached = Utils.proxy(this.updateCTM, this)

  // Create a custom requestAnimationFrame taking in account refreshRate
  this.requestAnimationFrame = Utils.createRequestAnimationFrame(this.options.refreshRate)

  // ViewBox
  this.viewBox = {x: 0, y: 0, width: 0, height: 0}
  this.cacheViewBox()

  // Process CTM
  this.processCTM()

  // Update CTM in this frame
  this.updateCTM()
}

/**
 * Cache initial viewBox value
 * If no viewBox is defined, then use viewport size/position instead for viewBox values
 */
ShadowViewport.prototype.cacheViewBox = function() {
  var svgViewBox = this.options.svg.getAttribute('viewBox')

  if (svgViewBox) {
    var viewBoxValues = svgViewBox.split(/[\s\,]/).filter(function(v){return v}).map(parseFloat)

    // Cache viewbox x and y offset
    this.viewBox.x = viewBoxValues[0]
    this.viewBox.y = viewBoxValues[1]
    this.viewBox.width = viewBoxValues[2]
    this.viewBox.height = viewBoxValues[3]

    var zoomX;
    var zoomY;
    if(this.options.separateZoomsEnabled) {
      zoomX = this.options.width / this.viewBox.width;
      zoomY = this.options.height / this.viewBox.height;
    } else {
      zoomX = zoomY = Math.min(this.options.width / this.viewBox.width, this.options.height / this.viewBox.height);
    }


    // Update active state
    this.activeState.zoomX = zoomX;
    this.activeState.zoomY = zoomY;
    this.activeState.x = (this.options.width - this.viewBox.width * zoomX) / 2
    this.activeState.y = (this.options.height - this.viewBox.height * zoomY) / 2

    // Force updating CTM
    this.updateCTMOnNextFrame()

    this.options.svg.removeAttribute('viewBox')
  } else {
    var bBox = this.viewport.getBBox();

    // Cache viewbox sizes
    this.viewBox.x = bBox.x;
    this.viewBox.y = bBox.y;
    this.viewBox.width = bBox.width
    this.viewBox.height = bBox.height
  }
}

/**
 * Recalculate viewport sizes and update viewBox cache
 */
ShadowViewport.prototype.recacheViewBox = function() {
  var boundingClientRect = this.viewport.getBoundingClientRect()
    , viewBoxWidth = boundingClientRect.width / this.getZooms().x
    , viewBoxHeight = boundingClientRect.height / this.getZooms().y

  // Cache viewbox
  this.viewBox.x = 0
  this.viewBox.y = 0
  this.viewBox.width = viewBoxWidth
  this.viewBox.height = viewBoxHeight
}

/**
 * Returns a viewbox object. Safe to alter
 *
 * @return {Object} viewbox object
 */
ShadowViewport.prototype.getViewBox = function() {
  return Utils.extend({}, this.viewBox)
}

/**
 * Get initial zoom and pan values. Save them into originalState
 * Parses viewBox attribute to alter initial sizes
 */
ShadowViewport.prototype.processCTM = function() {
  var newCTM = this.getCTM()

  if (this.options.fit || this.options.contain) {
    var newScaleX;
    var newScaleY;

    var scaleX = this.options.width/this.viewBox.width;
    var scaleY = this.options.height/this.viewBox.height;

    if (this.options.fit) {
      newScaleX = newScaleY = Math.min(scaleX, scaleY);
    } else {
      newScaleX = newScaleY = Math.max(scaleX, scaleY);
    }

    newCTM.a = newScaleX; //x-scale
    newCTM.d = newScaleY; //y-scale
    newCTM.e = -this.viewBox.x * newScaleX; //x-transform
    newCTM.f = -this.viewBox.y * newScaleY; //y-transform
  }

  if (this.options.center) {
    var offsetX = (this.options.width - (this.viewBox.width + this.viewBox.x * 2) * newCTM.a) * 0.5
      , offsetY = (this.options.height - (this.viewBox.height + this.viewBox.y * 2) * newCTM.d) * 0.5

    newCTM.e = offsetX
    newCTM.f = offsetY
  }

  // Cache initial values. Based on activeState and fix+center opitons
  this.originalState.zoomX = newCTM.a;
  this.originalState.zoomY = newCTM.d;
  this.originalState.x = newCTM.e;
  this.originalState.y = newCTM.f;

  // Update viewport CTM and cache zoom and pan
  this.setCTM(newCTM);
}

/**
 * Return originalState object. Safe to alter
 *
 * @return {Object}
 */
ShadowViewport.prototype.getOriginalState = function() {
  return Utils.extend({}, this.originalState)
}

/**
 * Return actualState object. Safe to alter
 *
 * @return {Object}
 */
ShadowViewport.prototype.getState = function() {
  return Utils.extend({}, this.activeState)
}

/**
 * Get zoom scale.
 * Use getZooms() instead to get separate x/y scales
 * @return {Float} zoom scale
 */
ShadowViewport.prototype.getZoom = function() {
  if(this.options.separateZoomsEnabled) {
    console.warn('You should use getZooms() instead of getZoom() if the option separateZoomsEnabled is set.');
  }

  return this.activeState.zoomX;
}

/**
 * Get zoom scales.
 * @return {Object}
 */
ShadowViewport.prototype.getZooms = function() {
  return {x: this.activeState.zoomX, y: this.activeState.zoomY};
}

/**
 * Get zoom scale for public usage
 * Use getRelativeZooms() instead to get separate x/y scales
 * @return {Float} zoom scale
 */
ShadowViewport.prototype.getRelativeZoom = function() {
  if(this.options.separateZoomsEnabled) {
    console.warn('You should use getRelativeZooms() instead of getRelativeZoom() if the option separateZoomsEnabled is set.');
  }

  return this.activeState.zoomX / this.originalState.zoomX
}

/**
 * Get zoom scales for public usage
 * @return {Object} zoom scales for x and y
 */
ShadowViewport.prototype.getRelativeZooms = function() {
  return {x:this.activeState.zoomX / this.originalState.zoomX, y:this.activeState.zoomY / this.originalState.zoomY}
}

/**
 * Compute zoom scale for public usage
 *
 * @return {Float} zoom scale
 */
ShadowViewport.prototype.computeRelativeZoom = function(scale) {
  if(this.options.separateZoomsEnabled) {
    console.warn('You should use computeRelativeZooms() instead of computeRelativeZoom() if the option separateZoomsEnabled is set.');
  }

  return scale / this.originalState.zoomX
}

/**
 * Compute zoom scales for public usage
 * @return {Object} zoom scales for x and y
 */
ShadowViewport.prototype.computeRelativeZooms = function(scaleX, scaleY) {
  return {x:scaleX / this.originalState.zoomX, y:scaleY / this.originalState.zoomY};
}

/**
 * Get pan
 *
 * @return {Object}
 */
ShadowViewport.prototype.getPan = function() {
  return {x: this.activeState.x, y: this.activeState.y}
}

/**
 * Return cached viewport CTM value that can be safely modified
 *
 * @return {SVGMatrix}
 */
ShadowViewport.prototype.getCTM = function() {
  var safeCTM = this.options.svg.createSVGMatrix()

  // Copy values manually as in FF they are not iterable
  safeCTM.a = this.activeState.zoomX
  safeCTM.b = 0
  safeCTM.c = 0
  safeCTM.d = this.activeState.zoomY
  safeCTM.e = this.activeState.x
  safeCTM.f = this.activeState.y

  return safeCTM
}

/**
 * Set a new CTM
 *
 * @param {SVGMatrix} newCTM
 */
ShadowViewport.prototype.setCTM = function(newCTM) {
  var willZoom = this.isZoomDifferent(newCTM)
    , willPan = this.isPanDifferent(newCTM)

  if (willZoom || willPan) {
    // Before zoom
    if (willZoom) {
      if(this.options.separateZoomsEnabled) {
        var canZoom = this.options.beforeZoom(this.getRelativeZooms(), this.computeRelativeZooms(newCTM.a, newCTM.d));
        var preventZoomX = false
            , preventZoomY = false;
        if(canZoom === false) {
          newCTM.a = this.getZooms().x;
          newCTM.d = this.getZooms().y;

          preventZoomX = preventZoomY = true;
        } else if (Utils.isObject(canZoom)) {
          if(canZoom.x === false) {
            // Prevent horizontal scaling
            newCTM.a = this.getZooms().x;
            preventZoomX = true;
          } else if(Utils.isNumber(canZoom.x)) {
            newCTM.a = canZoom.x * this.originalState.zoomX;
          }

          if(canZoom.y === false) {
            // Prevent vertical scaling
            newCTM.d = this.getZooms().y;
            preventZoomY = true;
          } else if(Utils.isNumber(canZoom.y)) {
            newCTM.d = canZoom.y * this.originalState.zoomY;
          }
        }

        if(preventZoomX && preventZoomY) {
          willZoom = false
        }
      } else {
        // If returns false then cancel zooming
        if (this.options.beforeZoom(this.getRelativeZoom(), this.computeRelativeZoom(newCTM.a)) === false) {
          newCTM.a = newCTM.d = this.activeState.zoom
          willZoom = false
        }
      }
    }

    // Before pan
    if (willPan) {
      var canPan = this.options.beforePan(this.getPan(), {x: newCTM.e, y: newCTM.f})
          // If prevent pan is an object
        , preventPanX = false
        , preventPanY = false

      // If prevent pan is Boolean false
      if (canPan === false) {
        // Set x and y same as before
        newCTM.e = this.getPan().x
        newCTM.f = this.getPan().y

        preventPanX = preventPanY = true
      } else if (Utils.isObject(canPan)) {
        // Check for X axes attribute
        if (canPan.x === false) {
          // Prevent panning on x axes
          newCTM.e = this.getPan().x
          preventPanX = true
        } else if (Utils.isNumber(canPan.x)) {
          // Set a custom pan value
          newCTM.e = canPan.x
        }

        // Check for Y axes attribute
        if (canPan.y === false) {
          // Prevent panning on x axes
          newCTM.f = this.getPan().y
          preventPanY = true
        } else if (Utils.isNumber(canPan.y)) {
          // Set a custom pan value
          newCTM.f = canPan.y
        }
      }

      // Update willPan flag
      if (preventPanX && preventPanY) {
        willPan = false
      }
    }

    // Check again if should zoom or pan
    if (willZoom || willPan) {
      this.updateCache(newCTM)

      this.updateCTMOnNextFrame()

      // After callbacks
      if (willZoom) {
        if(this.options.separateZoomsEnabled) {
          this.options.onZoom(this.getRelativeZooms())
        } else {
          this.options.onZoom(this.getRelativeZoom())
        }
      }
      if (willPan) {this.options.onPan(this.getPan())}
    }
  }
}

ShadowViewport.prototype.isZoomDifferent = function(newCTM) {
  return this.activeState.zoomX !== newCTM.a || this.activeState.zoomY !== newCTM.d
}

ShadowViewport.prototype.isPanDifferent = function(newCTM) {
  return this.activeState.x !== newCTM.e || this.activeState.y !== newCTM.f
}


/**
 * Update cached CTM and active state
 *
 * @param {SVGMatrix} newCTM
 */
ShadowViewport.prototype.updateCache = function(newCTM) {
  this.activeState.zoomX = newCTM.a
  this.activeState.zoomY = newCTM.d
  this.activeState.x = newCTM.e
  this.activeState.y = newCTM.f
}

ShadowViewport.prototype.pendingUpdate = false

/**
 * Place a request to update CTM on next Frame
 */
ShadowViewport.prototype.updateCTMOnNextFrame = function() {
  if (!this.pendingUpdate) {
    // Lock
    this.pendingUpdate = true

    // Throttle next update
    this.requestAnimationFrame.call(window, this.updateCTMCached)
  }
}

/**
 * Update viewport CTM with cached CTM
 */
ShadowViewport.prototype.updateCTM = function() {
  // Updates SVG element
  SvgUtils.setCTM(this.viewport, this.getCTM(), this.defs)

  // Free the lock
  this.pendingUpdate = false
}

module.exports = function(viewport, options){
  return new ShadowViewport(viewport, options)
}
