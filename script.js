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
            t += dt;
        }
    }

    function render() {
        context.globalCompositeOperation = 'xor';
        context.clearRect(0, 0, canvas.width, canvas.height);
        waves.forEach(function(w) {
            w.render();
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
var wave = function(canvas, color, n, waveSettings) {
    var _canvas = canvas,
        _context = canvas.getContext('2d'),
        _color = color,
        _n = n,
        _waves = waveSettings;

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
        // TODO: mouse math can be simpler. Needs to keep total water level the same.
        if (dragState.isDragging) {
            var crestIdx = dragState.x0 * n / canvas.width;
            for(var i = 0; i < n; i++) {
                var offset = 0; 
                _waves.forEach(function(settings) {
                    offset += _compute(i, crestIdx, settings);
                });

                // positive dy means wave being pushed down, so
                // subtract artificial wave multiplied by dy
                u[i] -= 0.002 * dragState.dy * offset;
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

    var _render = function() {
        var base = 0.5 * canvas.height;
        var unitWidth = canvas.width / (n - 1); // dx per sample in pixels

        // radius of bowl and radius squared
        var r = 0.5 * canvas.width;
        var r2 = r * r;

        // Compute the points that make up the wave surface and the bowl angles
        var startAngle = null, endAngle = null;
        var points = []
        for(var i = 0; i < n; i++) {
            var x = i * unitWidth;
            var bowlDepth = Math.sqrt(Math.max(0, r2 - (r-x)*(r-x)));
            var h = u[i];

            if (h < -bowlDepth || h > bowlDepth) {
                if (x < r) {
                    endAngle = Math.atan2(h, x - r);
                    points = []
                } else if (startAngle === null) {
                    startAngle = Math.atan2(h, x - r);
                } else {
                    break;
                }
            } else {
                points.push([x, base - h])
            }
        }

        // Draw the path
        _context.fillStyle = _color;
        _context.beginPath();
        _context.moveTo(points[0][0], points[0][1]);
        points.forEach(function(point) {
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
 
    var _heightMap = function() {
        return u;
    };

    return {
        physics: _physics,
        render: _render,
        heightMap: _heightMap,
        color: _color,
    }
};
