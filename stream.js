(function() {

    var peerSockMap = {}
    WSC.peerSockMap = peerSockMap

    function onTCPReceive(info) {
        var sockId = info.socketId
        if (WSC.peerSockMap[sockId]) {
            WSC.peerSockMap[sockId].onReadTCP(info)
        }
    }

    chrome.sockets.tcp.onReceive.addListener( onTCPReceive )
    chrome.sockets.tcp.onReceiveError.addListener( onTCPReceive )
   
   
})();
