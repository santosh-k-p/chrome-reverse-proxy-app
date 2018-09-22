define('BaseHandler', ['ResponseCode', 'MimeTypes'], function(ResponseCode, MimeTypes) {
    var BaseHandler = function BaseHandler() {
        this.headersWritten = false
        this.responseCode = null
        this.responseHeaders = {}
        this.responseData = []
        this.responseLength = null
    }
    _.extend(BaseHandler.prototype, {
        options: function() {
            if (this.app.opts.optCORS) {
                this.set_status(200)
                this.finish()
            } else {
                this.set_status(403)
                this.finish()
            }
        },
        setCORS: function() {
            this.setHeader('access-control-allow-origin', '*')
            this.setHeader('access-control-allow-methods', 'GET, POST, PUT')
            this.setHeader('access-control-max-age', '120')
        },
        get_argument: function(key, def) {
            if (this.request.arguments[key] !== undefined) {
                return this.request.arguments[key]
            } else {
                return def
            }
        },
        getHeader: function(k, defaultvalue) {
            return this.request.headers[k] || defaultvalue
        },
        setHeader: function(k, v) {
            this.responseHeaders[k] = v
        },
        set_status: function(code) {
            console.assert(!this.headersWritten)
            this.responseCode = code
        },
        writeHeaders: function(code, callback) {
            if (code === undefined || isNaN(code)) {
                code = this.responseCode || 200
            }
            this.headersWritten = true
            var lines = []
            if (code == 200) {
                lines.push('HTTP/1.1 200 OK')
            } else {
                //console.log(this.request.connection.stream.sockId,'response code',code, this.responseLength)
                lines.push('HTTP/1.1 ' + code + ' ' + WSC.HTTPRESPONSES[code])
            }
            if (this.responseHeaders['transfer-encoding'] === 'chunked') {
                // chunked encoding
            } else {
                if (WSC.VERBOSE) {
                    console.log(this.request.connection.stream.sockId, 'response code', code, 'clen', this.responseLength)
                }
                console.assert(typeof this.responseLength == 'number')
                lines.push('content-length: ' + this.responseLength)
            }

            var p = this.request.path.split('.')
            if (p.length > 1 && !this.isDirectoryListing) {
                var ext = p[p.length - 1].toLowerCase()
                var type = WSC.MIMETYPES[ext]
                if (type) {

                    var default_types = ['text/html',
                        'text/xml',
                        'text/plain',
                        "text/vnd.wap.wml",
                        "application/javascript",
                        "application/rss+xml"
                    ]

                    if (_.contains(default_types, type)) {
                        type += '; charset=utf-8'
                    }
                    this.setHeader('content-type', type)
                }
            }

            /*if (this.app.opts.optCORS) {
                this.setCORS()
            }*/

            for (key in this.responseHeaders) {
                lines.push(key + ': ' + this.responseHeaders[key])
            }
            lines.push('\r\n')
            var headerstr = lines.join('\r\n')
            //console.log('write headers',headerstr)
            this.request.connection.write(headerstr, callback)
        },
        writeChunk: function(data) {
            console.assert(data.byteLength !== undefined)
            var chunkheader = data.byteLength.toString(16) + '\r\n'
            //console.log('write chunk',[chunkheader])
            this.request.connection.write(WSC.str2ab(chunkheader))
            this.request.connection.write(data)
            this.request.connection.write(WSC.str2ab('\r\n'))
        },
        write: function(data, code, opt_finish) {
            if (typeof data == "string") {
                // using .write directly can be dumb/dangerous. Better to pass explicit array buffers
                //console.warn('putting strings into write is not well tested with multi byte characters')
                data = new TextEncoder('utf-8').encode(data).buffer
            }

            console.assert(data.byteLength !== undefined)
            if (code === undefined) {
                code = 200
            }
            this.responseData.push(data)
            this.responseLength += data.byteLength
            // todo - support chunked response?
            if (!this.headersWritten) {
                this.writeHeaders(code)
            }
            for (var i = 0; i < this.responseData.length; i++) {
                this.request.connection.write(this.responseData[i])
            }
            this.responseData = []
            if (opt_finish !== false) {
                this.finish()
            }
        },
        finish: function() {
            if (!this.headersWritten) {
                this.responseLength = 0
                this.writeHeaders()
            }
            if (this.beforefinish) {
                this.beforefinish()
            }
            this.request.connection.curRequest = null
            if (this.request.isKeepAlive() && !this.request.connection.stream.remoteclosed) {
                this.request.connection.tryRead()
                if (WSC.DEBUG) {
                    //console.log('webapp.finish(keepalive)')
                }
            } else {
                console.assert(!this.request.connection.stream.onWriteBufferEmpty)
                this.request.connection.stream.onWriteBufferEmpty = () => {
                    this.request.connection.close()
                    if (WSC.DEBUG) {
                        //console.log('webapp.finish(close)')
                    }
                }
            }
        }
    });
    //WSC.BaseHandler = BaseHandler;
    WSC.ResponseCode = ResponseCode;
    WSC.MIMETYPES = MimeTypes;
    console.log(BaseHandler)
    return BaseHandler;
});