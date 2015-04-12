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
            n,
            0.2,
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
            n,
            0.15,
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
            n,
            0.25,
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
            t += dt;
        }
    }

    function render() {
        context.fillStyle = 'rgba(153, 170, 255, 0.5)';
        context.clearRect(0, 0, canvas.width, canvas.height);
        var base = 0.5 * canvas.height;
        var unitWidth = canvas.width / n; // dx per sample in pixels

        waves.forEach(function(w) {
            var heightMap = w.heightMap();

            context.beginPath();
            context.moveTo(0, canvas.height);
            for(var i = 0; i < n; i++) {
                var x = i * unitWidth;
                var h = heightMap[i];
                context.lineTo(x, base - h);
            }
            context.lineTo(canvas.width, canvas.height);
            context.closePath();
            context.fill();
        });
    };
});

var wave = function(canvas, n, waveEquationConstant, waveSettings) {
    var _canvas = canvas,
        _n = n, // number of samples
        _c = waveEquationConstant,
        _waves = waveSettings; // list of wave settings

    var u = new Float32Array(n); // value of wave at each sample idx
    var u_t = new Float32Array(n); // velocity at each sample idx
    var u_x = new Float32Array(n - 1);
    var u_tt = new Float32Array(n - 2);

    var _physics = function(dt, dragState) {
        var dx = 1. / n; // change in x per value in u

        // compute dx for each increment of x
        for (var i = 0; i < n - 1; i++) {
            u_x[i] = (u[i + 1] - u[i]) / dx;
        }

        var c2 = _c * _c; // Constant C^2
        for (var i = 0; i < n - 2; i++) {
            // compute second derivative wrt x
            var u_xx_i = (u_x[i + 1] - u_x[i]) / dx;

            // then use it to compute second derivative wrt t
            u_tt[i] = u_xx_i * c2;
        }

        // update u_t according to u_tt
        for (var i = 1; i < n - 1; i++) {
            u_t[i] += u_tt[i - 1] * dt;
            u_t[i] *= 0.999
        }

        // update u
        for (var i = 0; i < n; i++) {
            u[i] += u_t[i] * dt;
        }

        // boundary conditions: two-sided "wave pool"
        u[n - 1] = u[n - 2];
        u[0] = u[1];

        // update u while being dragged
        if (dragState.isDragging) {
            var crestIdx = dragState.x0 * n / canvas.width;
            for(var i = 0; i < n; i++) {
                // positive dy means wave being pushed down, so
                // subtract artificial wave multiplied by dy
                var offset = 0; 
                _waves.forEach(function(settings) {
                    offset += _compute(i, crestIdx, settings);
                });
                u[i] -= 0.002 * dragState.dy * offset;
            }
        }
    };

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

    var _heightMap = function() {
        return u;
    };

    return {
        physics: _physics,
        heightMap: _heightMap,
    }
};
