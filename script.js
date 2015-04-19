$(document).ready(function() {
    var canvas = document.getElementById('waves-canvas');
    var context = canvas.getContext('2d');
    var t_0 = new Date().getTime() / 1000;
    var t = 0;
    var dt = 0.01; // simulation step size in seconds
    var n = 100; // number of samples

    var dragState = {
        isDragging: false,
        x0: 0,
        y0: 0,
        dy: 0
    }
    $(canvas)
        .mousedown(function(evt) {
            dragState.isDragging = true;
            dragState.x0 = evt.offsetX;
            dragState.y0 = evt.offsetY;
        })
        .mousemove(function(evt) {
            if (dragState.isDragging) {
                dragState.dy = evt.offsetY - dragState.y0;
                dragState.y0 = evt.offsetY;
            }
        })
        .on('mouseup mouseout mouseleave', function(evt) {
            dragState.isDragging = false;
        });

    // Individual waves that will be rendered on canvas
    var waves = [
        wave(
            canvas,
            'rgba(255, 0, 0, 0.5)',
            n,
            [
                {
                    amplitude: 0.5,
                    period: 0.5,
                    dampener: 0.97,
                    lengthener: 1.001,
                    crestOffset: 0
                },
                {
                    amplitude: 0.1,
                    period: 0.25,
                    dampener: 0.99,
                    lengthener: 1.0,
                    crestOffset: 0.2
                }
            ]
        ),
        wave(
            canvas,
            'rgba(0, 255, 0, 0.5)',
            n,
            [
                {
                    amplitude: 0.5,
                    period: 0.8,
                    dampener: 0.96,
                    lengthener: 1.002,
                    crestOffset: 0
                },
                {
                    amplitude: 0.1,
                    period: 0.2,
                    dampener: 0.9,
                    lengthener: 1.0,
                    crestOffset: -0.2
                },
                {
                    amplitude: 0.15,
                    period: 0.3,
                    dampener: 0.8,
                    lengthener: 1.1,
                    crestOffset: 0.25
                }
            ]
        ),
        wave(
            canvas,
            'rgba(0, 200, 255, 0.5)',
            n,
            [
                {
                    amplitude: 0.3,
                    period: 0.6,
                    dampener: 0.92,
                    lengthener: 1.0,
                    crestOffset: 0
                },
                {
                    amplitude: 0.04,
                    period: 0.1,
                    dampener: 0.90,
                    lengthener: 1.0,
                    crestOffset: -0.1
                },
                {
                    amplitude: 0.05,
                    period: 0.5,
                    dampener: 0.8,
                    lengthener: 1.1,
                    crestOffset: 0.4
                }
            ]
        )
    ];

    var flotsams = [
        flotsam(
            canvas,
            'duck.png',
            waves[0],
            {
                // position in pixels
                px: 350,
                py: 260,

                // velocity in pixels / second
                vx: 0,
                vy: 0,

                theta: 0
            }
        ),
        flotsam(
            canvas,
            'duck-violet.png',
            waves[1],
            {
                // position in pixels
                px: 100,
                py: 260,

                // velocity in pixels / second
                vx: 0.1,
                vy: 0,

                theta: 0
            }
        ),
    ];

    requestAnimationFrame(frame);

    function frame() {
        physics();
        render();
        requestAnimationFrame(frame);
    }

    function physics() {
        var t_now = new Date().getTime() / 1000 - t_0; // time in seconds
        while(t < t_now) {
            waves.forEach(function(waveInstance) {
                waveInstance.physics(dt, dragState);
            });
            flotsams.forEach(function(flotsamInstance) {
                flotsamInstance.physics(dt);
            });
            t += dt;
        }
    }

    function render() {
        context.globalCompositeOperation = 'xor';
        context.clearRect(0, 0, canvas.width, canvas.height);
        waves.forEach(function(w) {
            w.render();
        });

        context.globalCompositeOperation = 'source-over';
        flotsams.forEach(function(fs) {
            fs.render();
        });
    };
});

/**
 * Defines a sin wave.
 * @typedef {Object} WaveSettings
 * @property {number} amplitude
 * @property {number} period
 * @property {number} dampener - the base in an exponential decay function
 *      that dampenes the amplitude of the wave further from the crest.
 *      Should be [0, 1] to have a dampening effect; otherwise will amplify.
 * @property {number} lengthener - the base in an exponential growth function
 *      that lengthens the period of the wave further from the crest.
 *      Should be > 1. to have a lengthening effect; otherwise will shorten.
 * @property {number} crestOffset - the offset of the peak from the given crest,
 *      used to create a staggered effect for the final wave
 */

/**
 * Stores the state of mouse drag.
 * @typedef {Object} DragState
 * @property {boolean} isDragging
 * @property {number} x0 - the initial mouse x, defines the crest
 * @property {number} y0 - the last mouse y
 * @property {number} dy - the y velocity
 */

/**
 * Defines a single wave with the given settings.
 * @param {HTMLElement} canvas
 * @param {number} n - The number of samples
 * @param {number} waveEquationConstant -  bigger the constant, the
 *      faster the wave propagates
 * @param {Array.<WaveSettings>} waveSettings - the final wave is a
 *      sum of partial waves, defined by these settings
 */
function wave(canvas, color, n, waveSettings) {
    var _canvas = canvas,
        _context = canvas.getContext('2d'),
        _color = color,
        _n = n,
        _waves = waveSettings,
        _points = [];

    var c = 0.35; // wave equation constant
    var damping = 0.995; // controls how fast wave dampens over time

    var u = new Float32Array(n); // value of wave at each sample idx
    var u_t = new Float32Array(n); // velocity at each sample idx
    var u_x = new Float32Array(n - 1);
    var u_tt = new Float32Array(n - 2);

    /**
     * Update the height map according to the wave equation.
     * @param {number} dt
     * @param {DragState} dragState
     */
    var _physics = function(dt, dragState) {
        var dx = 1. / n; // change in x per value in u

        // compute dx for each increment of x
        for (var i = 0; i < n - 1; i++) {
            u_x[i] = (u[i + 1] - u[i]) / dx;
        }

        var c2 = c * c; // Constant C^2
        for (var i = 0; i < n - 2; i++) {
            // compute second derivative wrt x
            var u_xx_i = (u_x[i + 1] - u_x[i]) / dx;

            // then use it to compute second derivative wrt t
            u_tt[i] = u_xx_i * c2;
        }

        // update u_t according to u_tt
        for (var i = 1; i < n - 1; i++) {
            u_t[i] += u_tt[i - 1] * dt;
            u_t[i] *= damping;
        }

        // update u
        for (var i = 0; i < n; i++) {
            u[i] += u_t[i] * dt;
        }

        // cheat to send the first and last sample
        u[n - 1] = u[n - 2];
        u[0] = u[1];

        // update u while being dragged
        if (dragState.isDragging) {
            var crestIdx = dragState.x0 * n / canvas.width;
            var sum = 0;
            for(var i = 0; i < n; i++) {
                var offset = 0; 
                _waves.forEach(function(settings) {
                    offset += _compute(i, crestIdx, settings);
                });

                // positive dy means wave being pushed down, so
                // subtract artificial wave multiplied by dy
                u[i] -= 0.002 * dragState.dy * offset;
                sum += u[i];
            }

            // Make sure the water level stays the same
            var avg = sum / n;
            for (var i = 0; i < n; i++) {
                u[i] -= avg;
            }
        }
    };

    /**
     * Computes the height of the wave at sample i.
     * @param {number} i - index of the sample to compute the wave height for
     * @param {nubmer} crestIdx - index of the crest of the wave
     * @param {WaveSettings} settings
     */
    var _compute = function(i, crestIdx, settings) {
        var amplitude, period, phaseShift, crestOffset;
        var dampener, lengthener;

        // dampened further from the crest
        dampener = Math.pow(settings.dampener, Math.abs(crestIdx - i))
        amplitude = settings.amplitude * n * dampener;

        // period for big wave spans half the length of the pool, but
        // lengthens further away from the crest
        lengthener = Math.pow(settings.lengthener, Math.abs(crestIdx - i));
        period = settings.period * n * lengthener;

        // crestIdx = phaseShift + .25 * period
        crestOffset = settings.crestOffset * n;
        phaseShift = crestIdx - .25 * period - crestOffset;

        // value of u at i (wave's height)
        return amplitude * Math.sin((2.0 * Math.PI / period) * (i - phaseShift));
    };

    // pre-computed dimensions for rendering
    var base = 0.5 * canvas.height;
    var unitWidth = canvas.width / (n - 1); // dx per sample in pixels

    // radius of bowl and radius squared
    var r = 0.5 * canvas.width;
    var r2 = r * r;

    var _render = function() {
        // Compute the points that make up the wave surface and the bowl angles
        var startAngle = null, endAngle = null;
        _points = []
        for(var i = 0; i < n; i++) {
            var x = i * unitWidth;
            var bowlDepth = Math.sqrt(Math.max(0, r2 - (r-x)*(r-x)));
            var h = u[i];

            if (h < -bowlDepth || h > bowlDepth) {
                if (x < r) {
                    endAngle = Math.atan2(h, x - r);
                    _points = []
                } else if (startAngle === null) {
                    startAngle = Math.atan2(h, x - r);
                } else {
                    break;
                }
            } else {
                _points.push([x, base - h])
            }
        }

        // Draw the path
        _context.fillStyle = _color;
        _context.beginPath();
        _context.moveTo(_points[0][0], _points[0][1]);
        _points.forEach(function(point) {
            _context.lineTo(point[0], point[1]);
        })
        _context.arc(
            r, r, r,
            -startAngle || 0, 
            -endAngle || Math.PI
        );
        _context.closePath();
        _context.fill();
    };

    /**
     * @param {number} idx - Index of sample to grab the y pos for
     * @return {number} Y coordinate for the wave at the sample idx
     */
    var _getY = function(idx) {
        return base - u[_clamp(idx, 0, n-1)];
    };

    /**
     * @param {number} idx - Index of sample to grab the x pos for
     * @return {number} X coordinate for the wave at the sample idx
     */
    var _getX = function(idx) {
        return _clamp(idx, 0, n-1) * unitWidth;
    };

    /**
     * @param {number} position - x coordinate in pixels
     * @return {number} Index of the sample at given position
     */
    var _getIndex = function(x) {
        return _clamp(Math.floor(x * n / canvas.width), 0, n-1)
    };

    var _clamp = function(x, min, max) {
        return Math.max(min, Math.min(max, x))
    }
 
    return {
        physics: _physics,
        render: _render,
        color: _color,
        getY: _getY,
        getX: _getX,
        getIndex: _getIndex
    }
}


/**
 * Stores the state of a flotsam
 * @typedef {Object} FlotsamState
 * @property {number} isDragging
 * @property {number} x0 - the initial mouse x, defines the crest
 * @property {number} y0 - the last mouse y
 * @property {number} dy - the y velocity
 */


/**
 * @param {HTMLElement} canvas
 * @param {string} path
 * @param {Object} waveInstance
 * @param {FlotsamState} state
 */
function flotsam(canvas, path, waveInstance, state) {
    var _canvas = canvas,
        _context = canvas.getContext('2d'),
        _wave = waveInstance,
        _state = state,
        _image = new Image();
        
    _image.loaded = false;
    _image.src = path;
    _image.onload = function() {
        _image.loaded = true;
    };

    /** Constants */
    var ACCEL_GRAVITY = 20; // gravity acceleration in px / (s^2)
    var ACCEL_FLOAT = 30; // floatiness in px / (s^2)
    var ACCEL_DROPOFF = 0.2; // how fast float/gravity drops off
    var ROTATIONAL_INERTIA = 20;
    var WATER_FRICTION = 10;

    var _physics = function(dt) {
        if (!_image.loaded) {
            return;
        }
        var idx = _wave.getIndex(_state.px);
        var theta = _computeTheta(idx);
        var dy = _wave.getY(idx) - _state.py;

        _accelerate(theta, dy, dt); // compute and apply acceleration
        _drag(dy, dt); // apply friction
        _bounce(); // bounce off the edges of the bowl

        // update position with computed velocity
        _state.px += _state.vx;
        _state.py += _state.vy;

        _rotate(theta, dy); // rotate flotsam
    };

    var _render = function() {
        if (!_image.loaded) {
            return;
        }

        _context.translate(_state.px, _state.py);

        // rotate the flotsam so that it sits on the wave's tangent
        _context.rotate(_state.theta);

        // draw the flotsam so that the bottom touches the wave
        _context.drawImage(_image, _image.width * -0.5, _image.height * -1.);

        // reset context
        _resetTransformationMatrix();
    };

    var _computeTheta = function(idx) {
        var dy, dx;
        dy = _wave.getY(idx + 5) - _wave.getY(idx - 5);
        dx = _wave.getX(idx + 5) - _wave.getX(idx - 5);
        return Math.atan2(dy, dx);
    };

    var _accelerate = function(theta, dy, dt) {
        // If the flotsam is above the water, then drop straight down - there is
        // no acceleration along the x axis
        if (dy >= 0) {
            var ay = ACCEL_GRAVITY * (1 - Math.exp(-1 * ACCEL_DROPOFF * dy));
            _state.vy += ay * dt;
            return;
        }

        // Flotsam is submerged
        // compute the current normal at sample
        var nx, ny; 
        nx = Math.cos(Math.PI * 0.5 - theta);
        ny = -Math.sin(Math.PI * 0.5 - theta);

        // The deeper the flotsam is submerged, the greater the acceleration
        // to pop above the surface
        var a = ACCEL_FLOAT * (1 - Math.exp(ACCEL_DROPOFF * dy));
        _state.vx += nx * a * dt;
        _state.vy += ny * a * dt;
    };

    /**
     * Apply friction to dampen velocity if below the water
     */
    var _drag = function(dy, dt) {
        if (dy < 0) { 
            _state.vx *= (1 - WATER_FRICTION * dt);
            _state.vy *= (1 - WATER_FRICTION * dt);
        }
    };

    /**
     * Bounce off the sides of the tubby tub tubb
     */
    var _bounce = function() {
        var bowlCenterX = _canvas.width / 2;
        var bowlCenterY = _canvas.width / 2;
        var bowlR = (_canvas.width / 2) - _image.width/2;
        var bowlY = bowlR - _state.py;
        var bowlHWidth = bowlY > 0 ? bowlR : Math.sqrt(bowlR*bowlR - bowlY*bowlY);
        if (_state.px < bowlCenterX - bowlHWidth) {
            _state.vx = Math.abs(_state.vx);
        } else if (_state.px > bowlCenterX + bowlHWidth) {
            _state.vx = -Math.abs(_state.vx);
        }

        // Bounce off the bottom of the tub
        var bowlX = _state.px - bowlCenterX;
        var bowlDepth = Math.sqrt(bowlR*bowlR - bowlX*bowlX);
        if (_state.py > bowlCenterY + bowlDepth) {
            _state.vy = -Math.abs(_state.vy);
        }
    };

    /**
     * Rotate the flotsam if below the water
     */
    var _rotate = function(theta, dy) {
        if (dy < 0) {
          _state.theta += (theta - _state.theta) * (1 / ROTATIONAL_INERTIA);
        }
    };

    /**
     * Reset the transformation matrix to identity
     */
    var _resetTransformationMatrix = function() {
        _context.translate(0, 0);
        _context.setTransform(1, 0, 0, 1, 0, 0);
    };

    return {
        physics: _physics,
        render: _render
    }
};
