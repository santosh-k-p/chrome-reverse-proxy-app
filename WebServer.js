define('WebServer', ['BaseHandler','HTTPConnection','IOStream'], function(BaseHandler,HTTPConnection,IOStream) {
    var scokets = chrome.sockets;   

    function WebServer(opts) {
        // need to support creating multiple WebApplication...
        if (WSC.DEBUG) {
            console.log('initialize webapp with opts', opts)
        }

        opts = opts || {}
        this.id = Math.random().toString()
        this.opts = opts
        this.handlers = opts.handlers || []       
        this.sockInfo = null
        this.lasterr = null
        this.stopped = false
        this.starting = false
        this.start_callback = null
        this._stop_callback = null
        this.started = false
        this.fs = null
        this.streams = {}
        this.upnp = null;
        if (opts.entry) {
            this.on_entry(opts.entry)
        }
        this.host = this.get_host()
        this.port = parseInt(opts.port || 8887)

        this._idle_timeout_id = null

        this.on_status_change = null
        this.interfaces = []
        this.interface_retry_count = 0
        this.urls = []
        this.extra_urls = []
        if (this.port > 65535 || this.port < 1024) {
            var err = 'bad port: ' + this.port
            this.error(err)
        }
        this.acceptQueue = []
    }    
    WebServer.prototype = {
        processAcceptQueue: function() {
            console.log('process accept queue len', this.acceptQueue.length)
            while (this.acceptQueue.length > 0) {
                var sockInfo = this.acceptQueue.shift()
                this.onAccept(sockInfo)
            }
        },
        updateOption: function(k, v) {
            this.opts[k] = v
            switch (k) {
                case 'optDoPortMapping':
                    if (!v) {
                        if (this.upnp) {
                            this.upnp.removeMapping(this.port, 'TCP', function(result) {
                                console.log('result of removing port mapping', result)
                                this.extra_urls = []
                                this.upnp = null
                                //this.init_urls() // misleading because active connections are not terminated
                                //this.change()
                            }.bind(this))
                        }
                    }
                    break
            }
        },
        get_info: function() {
            return {
                interfaces: this.interfaces,
                urls: this.urls,
                opts: this.opts,
                started: this.started,
                starting: this.starting,
                stopped: this.stopped,
                lasterr: this.lasterr
            }
        },
        updatedSleepSetting: function() {
            if (!this.started) {
                chrome.power.releaseKeepAwake()
                return
            }
            if (this.opts.optPreventSleep) {
                console.log('requesting keep awake system')
                chrome.power.requestKeepAwake(chrome.power.Level.SYSTEM)
            } else {
                console.log('releasing keep awake system')
                chrome.power.releaseKeepAwake()
            }
        },
        on_entry: function(entry) {

            //if (this.opts.optBackground) { this.start() }
        },
        get_host: function() {
            var host
            if (WSC.getchromeversion() >= 44 && this.opts.optAllInterfaces) {
                if (this.opts.optIPV6) {
                    host = this.opts.host || '::'
                } else {
                    host = this.opts.host || '0.0.0.0'
                }
            } else {
                host = this.opts.host || '127.0.0.1'
            }
            return host
        },        
       
        change: function() {
            if (this.on_status_change) {
                this.on_status_change()
            }
        },
        start_success: function(data) {
            if (this.opts.optPreventSleep) {
                console.log('requesting keep awake system')
                chrome.power.requestKeepAwake(chrome.power.Level.SYSTEM)
            }
            var callback = this.start_callback
            this.start_callback = null
            this.registerIdle()
            if (callback) {
                callback(this.get_info())
            }
            this.change()
        },
        error: function(data) {
            if (this.opts.optPreventSleep) {
                chrome.power.releaseKeepAwake()
            }
            this.interface_retry_count = 0
            var callback = this.start_callback
            this.starting = false
            this.stopped = true
            this.start_callback = null
            console.error('webapp error:', data)
            this.lasterr = data
            this.change()
            if (callback) {
                callback({
                    error: data
                })
            }
        },
        stop: function(reason, callback) {
            this.lasterr = ''
            this.urls = []
            this.change()
            if (callback) {
                this._stop_callback = callback
            }
            console.log('webserver stop:', reason)
            if (this.starting) {
                console.error('cant stop, currently starting')
                return
            }
            this.clearIdle()

            if (true || this.opts.optPreventSleep) {
                if (WSC.VERBOSE)
                    console.log('trying release keep awake')
                if (chrome.power)
                    chrome.power.releaseKeepAwake()
            }
            // TODO: remove hidden.html ensureFirewallOpen
            // also - support multiple instances.

            if (!this.started) {
                // already stopped, trying to double stop
                console.warn('webserver already stopped...')
                this.change()
                return
            }

            this.started = false
            this.stopped = true
            chrome.sockets.tcpServer.disconnect(this.sockInfo.socketId, this.onDisconnect.bind(this, reason))
            for (var key in this.streams) {
                this.streams[key].close()
            }
            this.change()
            // also disconnect any open connections...
        },
        onClose: function(reason, info) {
            var err = chrome.runtime.lastError
            if (err) {
                console.warn(err)
            }
            this.stopped = true
            this.started = false
            if (this._stop_callback) {
                this._stop_callback(reason)
            }
            if (WSC.VERBOSE)
                console.log('tcpserver onclose', info)
        },
        onDisconnect: function(reason, info) {
            var err = chrome.runtime.lastError
            if (err) {
                console.warn(err)
            }
            this.stopped = true
            this.started = false
            if (WSC.VERBOSE)
                console.log('tcpserver ondisconnect', info)
            if (this.sockInfo) {
                chrome.sockets.tcpServer.close(this.sockInfo.socketId, this.onClose.bind(this, reason))
            }
        },
        onStreamClose: function(stream) {
            console.assert(stream.sockId)
            if (this.opts.optStopIdleServer) {
                for (var key in this.streams) {
                    this.registerIdle()
                    break;
                }
            }
            delete this.streams[stream.sockId]
        },
        clearIdle: function() {
            if (WSC.VERBOSE)
                console.log('clearIdle')
            if (this._idle_timeout_id) {
                clearTimeout(this._idle_timeout_id)
                this._idle_timeout_id = null
            }
        },
        registerIdle: function() {
            if (this.opts.optStopIdleServer) {
                console.log('registerIdle')
                this._idle_timeout_id = setTimeout(this.checkIdle.bind(this), this.opts.optStopIdleServer)
            }
        },
        checkIdle: function() {
            if (this.opts.optStopIdleServer) {
                if (WSC.VERBOSE)
                    console.log('checkIdle')
                for (var key in this.streams) {
                    console.log('hit checkIdle, but had streams. returning')
                    return
                }
                this.stop('idle')
            }
        },
        start: function(callback) {
            this.lasterr = null
            /*
            if (clear_urls === undefined) { clear_urls = true }
            if (clear_urls) {
                this.urls = []
            }*/
            if (this.starting || this.started) {
                console.error("already starting or started")
                return
            }
            this.start_callback = callback
            this.stopped = false
            this.starting = true
            this.change()

            // need to setup some things
            if (this.interfaces.length == 0 && this.opts.optAllInterfaces) {
                this.getInterfaces({
                    interface_retry_count: 0
                }, this.startOnInterfaces.bind(this))
            } else {
                this.startOnInterfaces()
            }
        },
        startOnInterfaces: function() {
            // this.interfaces should be populated now (or could be empty, but we tried!)
            this.tryListenOnPort({
                port_attempts: 0
            }, this.onListenPortReady.bind(this))
        },
        onListenPortReady: function(info) {
            if (info.error) {
                this.error(info)
            } else {
                if (WSC.VERBOSE)
                    console.log('listen port ready', info)
                this.port = info.port
                if (this.opts.optAllInterfaces && this.opts.optDoPortMapping) {
                    console.clog("WSC", "doing port mapping")
                    this.upnp = new WSC.UPNP({
                        port: this.port,
                        udp: false,
                        searchtime: 2000
                    })
                    this.upnp.reset(this.onPortmapResult.bind(this))
                } else {
                    this.onReady()
                }
            }
        },
        onPortmapResult: function(result) {
            var gateway = this.upnp.validGateway
            console.log('portmap result', result, gateway)
            if (result && !result.error) {
                if (gateway.device && gateway.device.externalIP) {
                    var extIP = gateway.device.externalIP
                    this.extra_urls = [{
                        url: 'http://' + extIP + ':' + this.port
                    }]
                }
            }
            this.onReady()
        },
        onReady: function() {
            this.ensureFirewallOpen()
            //console.log('onListen',result)
            this.starting = false
            this.started = true
            console.log('Listening on', 'http://' + this.get_host() + ':' + this.port + '/')
            this.bindAcceptCallbacks()
            this.init_urls()
            this.start_success({
                urls: this.urls
            }) // initialize URLs ?
        },
        init_urls: function() {
            this.urls = [].concat(this.extra_urls)
            this.urls.push({
                url: 'http://127.0.0.1:' + this.port
            })
            for (var i = 0; i < this.interfaces.length; i++) {
                var iface = this.interfaces[i]
                if (iface.prefixLength > 24) {
                    this.urls.push({
                        url: 'http://[' + iface.address + ']:' + this.port
                    })
                } else {
                    this.urls.push({
                        url: 'http://' + iface.address + ':' + this.port
                    })
                }
            }
            return this.urls
        },
        computePortRetry: function(i) {
            return this.port + i * 3 + Math.pow(i, 2) * 2
        },
        tryListenOnPort: function(state, callback) {
            chrome.sockets.tcpServer.getSockets(function(sockets) {
                if (sockets.length == 0) {
                    this.doTryListenOnPort(state, callback)
                } else {
                    var match = sockets.filter(function(s) {
                        return s.name == 'WSCListenSocket'
                    })
                    if (match && match.length == 1) {
                        var m = match[0]
                        console.log('adopting existing persistent socket', m)
                        this.sockInfo = m
                        this.port = m.localPort
                        callback({
                            port: m.localPort
                        })
                        return
                    }
                    this.doTryListenOnPort(state, callback)
                }
            }.bind(this))
        },
        doTryListenOnPort: function(state, callback) {
            var opts = this.opts.optBackground ? {
                name: "WSCListenSocket",
                persistent: true
            } : {}
            chrome.sockets.tcpServer.create(opts, this.onServerSocket.bind(this, state, callback))
        },
        onServerSocket: function(state, callback, sockInfo) {
            var host = this.get_host()
            this.sockInfo = sockInfo
            var tryPort = this.computePortRetry(state.port_attempts)
            state.port_attempts++
                //console.log('attempting to listen on port',host,tryPort)
                chrome.sockets.tcpServer.listen(this.sockInfo.socketId,
                    host,
                    tryPort,
                    function(result) {
                        var lasterr = chrome.runtime.lastError
                        if (lasterr || result < 0) {
                            console.log('lasterr listen on port', tryPort, lasterr, result)
                            if (this.opts.optTryOtherPorts && state.port_attempts < 5) {
                                this.tryListenOnPort(state, callback)
                            } else {
                                var errInfo = {
                                    error: "Could not listen",
                                    attempts: state.port_attempts,
                                    code: result,
                                    lasterr: lasterr
                                }
                                //this.error(errInfo)
                                callback(errInfo)
                            }
                        } else {
                            callback({
                                port: tryPort
                            })
                        }
                    }.bind(this)
                )
        },
        getInterfaces: function(state, callback) {
            console.clog('WSC', 'no interfaces yet', state)
            chrome.system.network.getNetworkInterfaces(function(result) {
                console.log('network interfaces', result)
                if (result) {
                    for (var i = 0; i < result.length; i++) {
                        if (this.opts.optIPV6 || result[i].prefixLength <= 24) {
                            if (result[i].address.startsWith('fe80::')) {
                                continue
                            }
                            this.interfaces.push(result[i])
                            console.log('found interface address: ' + result[i].address)
                        }
                    }
                }

                // maybe wifi not connected yet?
                if (this.interfaces.length == 0 && this.optRetryInterfaces) {
                    state.interface_retry_count++
                        if (state.interface_retry_count > 5) {
                            callback()
                        } else {
                            setTimeout(function() {
                                this.getInterfaces(state, callback)
                            }.bind(this), 1000)
                        }
                } else {
                    callback()
                }
            }.bind(this))
        },
        refreshNetworkInterfaces: function(callback) {
            this.stop('refreshNetworkInterfaces', function() {
                this.start(callback)
            }.bind(this))
        },
        
        ensureFirewallOpen: function() {
            // on chromeOS, if there are no foreground windows,
            if (this.opts.optAllInterfaces && chrome.app.window.getAll().length == 0) {
                if (chrome.app.window.getAll().length == 0) {
                    if (window.create_hidden) {
                        create_hidden() // only on chrome OS
                    }
                }
            }
        },
        bindAcceptCallbacks: function() {
            chrome.sockets.tcpServer.onAcceptError.addListener(this.onAcceptError.bind(this))
            chrome.sockets.tcpServer.onAccept.addListener(this.onAccept.bind(this))
        },
        onAcceptError: function(acceptInfo) {
            if (acceptInfo.socketId != this.sockInfo.socketId) {
                return
            }
            // need to check against this.socketInfo.socketId
            console.error('accept error', this.sockInfo.socketId, acceptInfo)
            // set unpaused, etc
        },
        onAccept: function(acceptInfo) {
            //console.log('onAccept',acceptInfo,this.sockInfo)
            if (acceptInfo.socketId != this.sockInfo.socketId) {
                return
            }
            if (acceptInfo.socketId) {
                var stream = new WSC.IOStream(acceptInfo.clientSocketId)
                this.adopt_stream(acceptInfo, stream)
            }
        },
        adopt_stream: function(acceptInfo, stream) {
            this.clearIdle()
            //var stream = new IOStream(acceptInfo.socketId)
            this.streams[acceptInfo.clientSocketId] = stream
            stream.addCloseCallback(this.onStreamClose.bind(this))
            var connection = new WSC.HTTPConnection(stream)
            connection.addRequestCallback(this.onRequest.bind(this, stream, connection))
            connection.tryRead()
        },
        onRequest: function(stream, connection, request) {
            console.log('Request', request.method, request.uri)

            if (this.opts.auth) {
                var validAuth = false
                var auth = request.headers['authorization']
                if (auth) {
                    if (auth.slice(0, 6).toLowerCase() == 'basic ') {
                        var userpass = atob(auth.slice(6, auth.length)).split(':')
                        if (userpass[0] == this.opts.auth.username &&
                            userpass[1] == this.opts.auth.password) {
                            validAuth = true
                        }
                    }
                }

                if (!validAuth) {
                    var handler = new WSC.BaseHandler(request);
                    handler.app = this
                    handler.request = request
                    handler.setHeader("WWW-Authenticate", "Basic");
                    handler.write("", 401)
                    handler.finish()
                    return
                }
            }
            request.redirectUrl = this.opts.redirectUrl;
            sendMessageToInterceptor(request)
            // create a default handler...
           

        }
    }
    WSC.HTTPConnection = HTTPConnection;
    WSC.IOStream = IOStream;
    WSC.BaseHandler = BaseHandler;
    WSC.WebServer = WebServer;

    return WebServer;
});