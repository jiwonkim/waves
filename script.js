
var settings = {
    c: 0.2, // wave equation constant
    color: '#9af'
}

$(document).ready(function() {
    var canvas = document.getElementById('waves-canvas');
    var context = canvas.getContext('2d');
    var t_0 = new Date().getTime() / 1000;
    var t = 0;
    var dt = 0.01; // simulation step size in seconds

    var n = 100; // number of samples
    var u = new Float32Array(n); // value of wave at each x
    var u_t = new Float32Array(n); // velocity at each x
    var u_x = new Float32Array(n - 1);
    var u_tt = new Float32Array(n - 2);

    var isDragging = false;
    var x0, y0, dy;
    $(canvas)
        .mousedown(function(evt) {
            isDragging = true;
            x0 = evt.offsetX;
            y0 = evt.offsetY;
        })
        .mousemove(function(evt) {
            if (isDragging) {
                dy = evt.offsetY - y0;
                y0 = evt.offsetY;
            }
        })
        .on('mouseup mouseout mouseleave', function(evt) {
            isDragging = false;
        });

    function bigWave(i, crestIdx) {
        var amplitude, period, phaseShift;
        var dampener, lengthener;

        // dampened further from the crest, but only for upward curves 
        dampener = Math.pow(0.97, Math.abs(crestIdx - i))
        amplitude = 0.8 * n * dampener;

        // period for big wave spans half the length of the pool, but
        // lengthens further away from the crest
        lengthener = Math.pow(1.001, Math.abs(crestIdx - i));
        period = 0.5 * n * lengthener;

        // crestIdx = phaseShift + .25 * period
        phaseShift = crestIdx - .25 * period;

        // value of u at i (wave's height)
        return amplitude * Math.sin((2.0 * Math.PI / period) * (i - phaseShift));
    }

    function smallWave(i, crestIdx) {
        var amplitude, period, phaseShift, crestOffset;
        
        // small amplitude for small wave, dampened further from the crest
        amplitude = 0.1 * n * Math.pow(0.99, Math.abs(crestIdx - i));

        // period for big wave spans a fourth of the length of the pool
        period = 0.25 * n;

        // the crest isn't quite centered for the small wave
        crestOffset = 0.05 * n;
        phaseShift = crestIdx - .25 * period - crestOffset;

        return amplitude * Math.sin((2.0 * Math.PI / period) * (i - phaseShift));
    }

    requestAnimationFrame(frame);

    function frame() {
        physics();
        render();
        requestAnimationFrame(frame);

        // DEBUG
        if (isDragging) {
            context.fillStyle = 'black';
            context.beginPath();
            context.moveTo(x0, 0);
            context.lineTo(x0, canvas.height);
            context.closePath();
            context.stroke();
        }
    }

    function physics() {
        var t_now = new Date().getTime() / 1000 - t_0; // time in seconds
        while(t < t_now) {
            physicsStep();
            t += dt;
        }
    }

    function physicsStep() {
        var dx = 1. / n; // change in x per value in u

        // compute dx for each increment of x
        for (var i = 0; i < n - 1; i++) {
            u_x[i] = (u[i + 1] - u[i]) / dx;
        }

        var c2 = settings.c * settings.c; // Constant C^2
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
        if (isDragging && x0 && dy) {
            var crestIdx = x0 * n / canvas.width;
            for(var i = 0; i < n; i++) {
                // positive dy means wave being pushed down, so
                // subtract artificial wave multiplied by dy
                u[i] -= 0.002 * dy * (bigWave(i, crestIdx) + smallWave(i, crestIdx));
            }
        }
    }

    function render() {
        context.fillStyle = settings.color;
        context.clearRect(0, 0, canvas.width, canvas.height);
        var base = 0.5 * canvas.height;
        var unitWidth = canvas.width / n; // dx per sample in pixels
        context.beginPath();
        context.moveTo(0, canvas.height);
        for(var i = 0; i < n; i++) {
            var x = i * unitWidth;
            var h = u[i];
            context.lineTo(x, base - h);
        }
        context.lineTo(canvas.width, canvas.height);
        context.closePath();
        context.fill();
    };
});

