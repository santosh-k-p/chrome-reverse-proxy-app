(function() {
    _DEBUG = false


    function ProxyHandler(validator, request) {
        WSC.BaseHandler.prototype.constructor.call(this)
        this.validator = validator
    }
    _.extend(ProxyHandler.prototype, {
        get: function() {
            if (!this.validator(this.request)) {
                this.responseLength = 0
                this.writeHeaders(403)
                this.finish()
                return
            }
            console.log('proxyhandler get', this.request)
            var url = this.request.arguments.url
            var xhr = new WSC.ChromeSocketXMLHttpRequest
            var chromeheaders = {
                //                'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                //                'Accept-Encoding':'gzip, deflate, sdch',
                'Accept-Language': 'en-US,en;q=0.8',
                'Cache-Control': 'no-cache',
                //                'Connection':'keep-alive',
                'Pragma': 'no-cache',
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.110 Safari/537.36'
            }
            for (var k in chromeheaders) {
                xhr.setRequestHeader(k, chromeheaders[k])
            }
            xhr.open("GET", url)
            xhr.onload = this.onfetched.bind(this)
            xhr.send()
        },
        onfetched: function(evt) {
            for (var header in evt.target.headers) {
                this.setHeader(header, evt.target.headers[header])
            }
            this.responseLength = evt.target.response.byteLength
            this.writeHeaders(evt.target.code)
            this.write(evt.target.response)
            this.finish()
        }
    }, WSC.BaseHandler.prototype)
    WSC.ProxyHandler = ProxyHandler
})();