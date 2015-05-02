$(document).ready(function() {
    var canvas = document.getElementById('waves-canvas');
    var context = canvas.getContext('2d');
    var width = canvas.width;
    var height = canvas.height;
    var t_0 = new Date().getTime() / 1000;
    var t = 0;
    var dt = 0.01; // simulation step size in seconds
    var n = 100; // number of samples

    var waveColors = [
        'rgba(255, 0, 0, 0.5)',
        'rgba(0, 255, 0, 0.5)',
        'rgba(0, 200, 255, 0.5)'
    ];
    var waves = [
        wave({
            numSamples: n,
            children: [
                {amplitude: 0.5, period: 0.5},
                {amplitude: 0.1, period: 0.25}
            ]
        }),
        wave({
            numSamples: n,
            children: [
                {amplitude: 0.5, period: 0.8},
                {amplitude: 0.1, period: 0.2},
                {amplitude: 0.15, period: 0.3}
            ]
        }),
        wave({
            numSamples: n,
            children: [
                {amplitude: 0.3, period: 0.6},
                {amplitude: 0.6, period: 0.3},
                {amplitude: 0.1, period: 0.5}
            ]
        })
    ];
    $(canvas).click(function(evt) {
        var coords = canvasToWaveCoordinates(evt.offsetX, evt.offsetY);
        waves.forEach(function(w) {
            w.churn(coords.x, coords.y, 0.3);
            w.splash(coords.x, coords.y, 0.3);
        });
    });

    function canvasToWaveCoordinates(x, y) {
        return {
            x: x / width,
            y: -2 * (y / height - 0.5)
        };
    }

    function waveToCanvasCoordinates(x, y) {
        return {
            x: x * width,
            y: (y / -2 + 0.5) * height
        }
    }

    var flotsams = [
        flotsam(
            canvas,
            'assets/duck.png',
            waves[0],
            {
                // position in pixels
                px: 350,
                py: 260,

                // velocity in pixels / second
                vx: 0,
                vy: 0,

                theta: 0
            },
            function(x) {
                return Math.floor((x / width) * n);
            },
            function(idx) {
                return Math.floor((idx / n) * width);
            },
            function(idx) {
                var coords = waveToCanvasCoordinates(0, waves[0].height(idx));
                return coords.y;
            }
        )/*,
        flotsam(
            canvas,
            'assets/duck-violet.png',
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
        ),*/
    ];

    requestAnimationFrame(frame);

    function frame() {
        physics();
        render();
        requestAnimationFrame(frame);
    }

    function physics() {
        for (var i = 0; i < 10; i++) {
            waves.forEach(function(waveInstance) {
                waveInstance.tick();
            });
            flotsams.forEach(function(flotsamInstance) {
                flotsamInstance.physics(dt);
            });
        }
        /*
        var t_now = new Date().getTime() / 1000 - t_0; // time in seconds
        while(t < t_now) {
            waves.forEach(function(waveInstance) {
                waveInstance.tick(dt);
            });
            flotsams.forEach(function(flotsamInstance) {
                flotsamInstance.physics(dt);
            });
            t += dt;
        }
        */
    }

    function render() {
        context.globalCompositeOperation = 'xor';
        context.clearRect(0, 0, width, height);
        for (var i = 0; i < waves.length; i++) {
            renderWave(i);
        }

        context.globalCompositeOperation = 'source-over';
        flotsams.forEach(function(fs) {
            fs.render();
        });
    };

    function renderWave(i) {
        var w = waves[i];
        var color = waveColors[i];

        // pre-computed dimensions for rendering
        var base = 0.5 * height;
        var unitWidth = width / (n - 1); // dx per sample in pixels

        // radius of bowl and radius squared
        var r = 0.5 * width;
        var r2 = r * r;

        // Compute the points that make up the wave surface and the bowl angles
        var startAngle = null, endAngle = null;
        var points = []
        for(var i = 0; i < n; i++) {
            var x = i * unitWidth;

            var coords =  waveToCanvasCoordinates(i / n, w.height(i));
            points.push([coords.x, coords.y])
        }

        // Draw the path
        context.fillStyle = color;
        context.beginPath();
        context.moveTo(points[0][0], points[0][1]);
        points.forEach(function(point) {
            context.lineTo(point[0], point[1]);
        })
        context.arc(
            r, r, r,
            -startAngle || 0, 
            -endAngle || Math.PI
        );
        context.closePath();
        context.fill();
    };
});


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
function flotsam(canvas, path, waveInstance, state, getIndex, getX, getY) {
    var _canvas = canvas,
        _context = canvas.getContext('2d'),
        _wave = waveInstance,
        _state = state,
        _image = new Image();

    var _getIndex = getIndex,
        _getX = getX,
        _getY = getY;
        
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
        var idx = _getIndex(_state.px);
        var theta = _computeTheta(idx);
        var dy = _getY(idx) - _state.py;

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
        dy = _getY(idx + 5) - _getY(idx - 5);
        dx = _getX(idx + 5) - _getX(idx - 5);
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
