(function() {
    var stopServer = function stopServer(){
        var port =$(this).attr('port');
        var app= window.apps[port];
        console.log('close app'+port)
        app.stop();
        delete apps[port];
    }
    var startServer = function startServer(port) {
        require(['WebServer'], function(WebServer) {
            console.log(WebServer)
            var app = new WebServer({ "port": port, "redirectUrl": $("#redirectPort").val() });
            if ($("#chkSaveFav").prop("checked")) {
                chrome.storage.local.set({ "proxyPreference":{"savePreference":true,"proxy": { "port": port, "redirectUrl": $("#redirectPort").val() } }}, function() {
                    console.log('Value is set to ' + arguments);
                });
            }
            app.start(function(status) {
                if (status.started) {
                    window.apps[port] = app;
                    $("#divServerStatus").html("<div port='"+port+"'>Server started on : " + status.urls[0].url+" <button>Stop</button></div>");
                    $("div[port='"+port+"']").click(stopServer);
                    //document.getElementById('divServerStatus').innerHTML = 'Server started on' + status.urls[0].url;
                } else {
                    document.getElementById('divServerStatus').innerHTML = "Failed to Start Server";
                }

            });
        })  
    };
    $(document).ready(function() {
        window.apps ={};
        var proxyPreference;
        chrome.storage.local.get(['proxyPreference'], function(result) {
            console.log(result);
            proxyPreference = result.proxyPreference;
            if (proxyPreference && proxyPreference.proxy) {
                $("#port").val(proxyPreference.proxy.port);
                $("#redirectPort").val(proxyPreference.proxy.redirectUrl);
            }
        });

        var startButton = document.getElementById('Start');
        startButton.addEventListener('click', function() {
            startServer($("#port").val());
        });
    });

})();