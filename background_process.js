(function() {
    var startServer = function startServer(port) {
        require(['WebServer'], function(WebServer) {
            console.log(WebServer)
            var app = new WebServer({ "port": port, "redirectUrl": $("#redirectPort").val() });
            app.start(function(status) {
                if (status.started) {
                    document.getElementById('divServerStatus').innerHTML = 'Server started on' + status.urls[0].url;
                } else {
                    document.getElementById('divServerStatus').innerHTML = "Failed to Start Server";
                }

            });
        })
    };
    $(document).ready(function() {
        var startButton = document.getElementById('Start');
        startButton.addEventListener('click', function() {
            startServer($("#port").val());
        });
    });

})();