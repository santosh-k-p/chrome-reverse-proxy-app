define('Buffer', [], function() {
    function Buffer(opts) {
        /*
          FIFO queue type that lets you check when able to consume the
          right amount of data.

         */
        this.opts = opts
        this.max_buffer_size = 104857600
        this._size = 0
        this.deque = []
    }

    Buffer.prototype = {
        clear: function() {
            this.deque = []
            this._size = 0
        },
        flatten: function() {
            if (this.deque.length == 1) { return this.deque[0] }
            // flattens the buffer deque to one element
            var totalSz = 0
            for (var i = 0; i < this.deque.length; i++) {
                totalSz += this.deque[i].byteLength
            }
            var arr = new Uint8Array(totalSz)
            var idx = 0
            for (var i = 0; i < this.deque.length; i++) {
                arr.set(new Uint8Array(this.deque[i]), idx)
                idx += this.deque[i].byteLength
            }
            this.deque = [arr.buffer]
            return arr.buffer
        },
        add: function(data) {
            console.assert(data instanceof ArrayBuffer)
            //console.assert(data.byteLength > 0)
            this._size = this._size + data.byteLength
            this.deque.push(data)
        },
        consume_any_max: function(maxsz) {
            if (this.size() <= maxsz) {
                return this.consume(this.size())
            } else {
                return this.consume(maxsz)
            }
        },
        consume: function(sz, putback) {
            // returns a single array buffer of size sz
            if (sz > this._size) {
                console.assert(false)
                return false
            }

            var consumed = 0

            var ret = new Uint8Array(sz)
            var curbuf
            // consume from the left

            while (consumed < sz) {
                curbuf = this.deque[0]
                console.assert(curbuf instanceof ArrayBuffer)

                if (consumed + curbuf.byteLength <= sz) {
                    // curbuf fits in completely to return buffer
                    ret.set(new Uint8Array(curbuf), consumed)
                    consumed = consumed + curbuf.byteLength
                    this.deque.shift()
                } else {
                    // curbuf too big! this will be the last buffer
                    var sliceleft = new Uint8Array(curbuf, 0, sz - consumed)
                    //console.log('left slice',sliceleft)

                    ret.set(sliceleft, consumed)
                    // we spliced off data, so set curbuf in deque

                    var remainsz = curbuf.byteLength - (sz - consumed)
                    var sliceright = new Uint8Array(curbuf, sz - consumed, remainsz)
                    //console.log('right slice',sliceright)
                    var remain = new Uint8Array(remainsz)
                    remain.set(sliceright, 0)
                    //console.log('right slice (newbuf)',remain)

                    this.deque[0] = remain.buffer
                    break
                }
            }
            if (putback) {
                this.deque = [ret.buffer].concat(this.deque)
            } else {
                this._size -= sz
            }
            return ret.buffer
        },
        size: function() {
            return this._size
        }
    }


    return Buffer;
});