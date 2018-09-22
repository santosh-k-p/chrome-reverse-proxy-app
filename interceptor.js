function getPostmanInterceptorId() { 
    return "aicmkgpgakddgnaphhhpliifpcfhicfo"; 
}

function getSelfId() {
    return chrome.runtime.id;
}
var methodNeedsBody = ["POST", "PUT"]
var requestQueue = {};
var getPostmanMessage = function getPostmanMessage(incommingRequest) {
    var postmanInterceptorReq = {
        "postmanMessage": {
            guid: incommingRequest.connection.stream.sockId,
            postmanAppId: getSelfId(),
            autoRedirect: true,
            type: 'xhrRequest',
            request: {
                url: incommingRequest.redirectUrl + incommingRequest.uri,
                headers: [],
                method: incommingRequest.method,
                responseType: "text",
                xhrTimeout: 0
            }
        }
    };
    var restrictedChromeHeaders = [
        "ACCEPT-CHARSET", "ACCEPT-ENCODING", "ACCESS-CONTROL-REQUEST-HEADERS",
        "ACCESS-CONTROL-REQUEST-METHOD", "DATE", "HOST", "CONNECTION",
        "USER-AGENT", "COOKIES", "ORIGIN", "REFERER", "CONTENT-LENGTH"
    ];
    var headers = Object.keys(incommingRequest.headers);
    for (var i = 0; i < headers.length; i++) {
        if (restrictedChromeHeaders.indexOf(headers[i].toUpperCase()) === -1) {
            postmanInterceptorReq.postmanMessage.request.headers.push({
                "key": headers[i],
                "value": incommingRequest.headers[headers[i]],
                "enabled": true
            });
        }
    }
    if (methodNeedsBody.indexOf(incommingRequest.method.toUpperCase()) != -1) {
        postmanInterceptorReq.postmanMessage.request.body = WSC.arrayBufferToString(incommingRequest.body);
        postmanInterceptorReq.postmanMessage.request.dataMode = "raw";
    }
    return postmanInterceptorReq;
}


var restrictedResponseHeader = [
    /*"DATE",*/
    "CONTENT-ENCODING",
    /*"X-CONTENT-TYPE-OPTIONS",
    "SERVER",
    "X-ASPNET-VERSION",
    "X-POWERED-BY",
    "VARY",*/
    /*"ACCESS-CONTROL-ALLOW-METHODS",
    "ACCESS-CONTROL-ALLOW-ORIGIN",
    "ACCESS-CONTROL-EXPOSE-HEADERS",*/
    /*"CACHE-CONTROL",
    "DATASERVICEVERSION",*/
    /*"ACCESS-CONTROL-ALLOW-HEADERS",*/
    "CONTENT-LENGTH"
];

function interceptorCallback(message) {
    var data = message.postmanMessage;
    var response = data.response;
    if (requestQueue[data.guid]) {
        var request = requestQueue[data.guid];
        var handler = new WSC.BaseHandler(request)
        handler.app = this;
        var headers = Object.keys(response.headers);
        for (var i = 0; i < headers.length; i++) {
            if (restrictedResponseHeader.indexOf(headers[i].toUpperCase()) === -1) {
                handler.setHeader(headers[i], response.headers[headers[i]]);
            }
        }
        handler.request = request
        handler.write(data.response.responseText)
        handler.finish()
        console.log(message);
        delete requestQueue[message.postmanMessage.guid];
    }


}
chrome.runtime.onMessageExternal.addListener(interceptorCallback);

function sendMessageToInterceptor(request) {
    var interceptorRequest = getPostmanMessage(request);
    requestQueue[interceptorRequest.postmanMessage.guid] = request;
    chrome.runtime.sendMessage(
        getPostmanInterceptorId(),
         getPostmanMessage(request),
        function(message) { 
            console.log(message);
        }
    );
}