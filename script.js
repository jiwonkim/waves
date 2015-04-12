
var settings = {
    c: 0.2, // wave equation constant
    color: '#9af'
}

$(document).ready(function() {
    var canvas = document.getElementById('waves-canvas');
    var context = canvas.getContext('2d');
    var t_0 = new Date().getTime() / 1000;
    var t = 0;
    var dt = 0.005; // simulation step size in seconds

    var n = 100; // number of samples
    var u = new Float32Array(n); // value of wave at each x
    var u_t = new Float32Array(n); // velocity at each x
    var u_x = new Float32Array(n - 1);
    var u_tt = new Float32Array(n - 2);

    requestAnimationFrame(frame);

    function frame() {
        physics();
        render();
        requestAnimationFrame(frame);
    }

    function physics() {
        var t_now = new Date().getTime() / 1000 - t_0; // time in seconds
        while(t < t_now) {
            physicsStep();
            t += dt;
        }
    }

    function physicsStep() {
        var dx = 1.0 / n; // change in x per value in u

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
        u[0] = 
            0.2 * Math.sin(t * 2.0) + 
            0.3 * Math.sin(t * 2.289) + 
            1 - Math.exp(-t);
    }

    function render() {
        context.fillStyle = settings.color;
        context.clearRect(0, 0, canvas.width, canvas.height);
        var base = 0.5 * canvas.height - 25;
        var unitWidth = canvas.width / n; // dx per sample in pixels
        for(var i = 0; i < n; i++) {
            var x = i * unitWidth;
            var h = 50 * u[i];
            context.fillRect(
                x, base - h,
                unitWidth, h
            );
        }
    };
});

