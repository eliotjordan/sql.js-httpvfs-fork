(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else {
		var a = factory();
		for(var i in a) (typeof exports === 'object' ? exports : root)[i] = a[i];
	}
})(this, function() {
return /******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 870:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "createEndpoint": () => (/* binding */ createEndpoint),
/* harmony export */   "expose": () => (/* binding */ expose),
/* harmony export */   "proxy": () => (/* binding */ proxy),
/* harmony export */   "proxyMarker": () => (/* binding */ proxyMarker),
/* harmony export */   "releaseProxy": () => (/* binding */ releaseProxy),
/* harmony export */   "transfer": () => (/* binding */ transfer),
/* harmony export */   "transferHandlers": () => (/* binding */ transferHandlers),
/* harmony export */   "windowEndpoint": () => (/* binding */ windowEndpoint),
/* harmony export */   "wrap": () => (/* binding */ wrap)
/* harmony export */ });
/**
 * Copyright 2019 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const proxyMarker = Symbol("Comlink.proxy");
const createEndpoint = Symbol("Comlink.endpoint");
const releaseProxy = Symbol("Comlink.releaseProxy");
const throwMarker = Symbol("Comlink.thrown");
const isObject = (val) => (typeof val === "object" && val !== null) || typeof val === "function";
/**
 * Internal transfer handle to handle objects marked to proxy.
 */
const proxyTransferHandler = {
    canHandle: (val) => isObject(val) && val[proxyMarker],
    serialize(obj) {
        const { port1, port2 } = new MessageChannel();
        expose(obj, port1);
        return [port2, [port2]];
    },
    deserialize(port) {
        port.start();
        return wrap(port);
    },
};
/**
 * Internal transfer handler to handle thrown exceptions.
 */
const throwTransferHandler = {
    canHandle: (value) => isObject(value) && throwMarker in value,
    serialize({ value }) {
        let serialized;
        if (value instanceof Error) {
            serialized = {
                isError: true,
                value: {
                    message: value.message,
                    name: value.name,
                    stack: value.stack,
                },
            };
        }
        else {
            serialized = { isError: false, value };
        }
        return [serialized, []];
    },
    deserialize(serialized) {
        if (serialized.isError) {
            throw Object.assign(new Error(serialized.value.message), serialized.value);
        }
        throw serialized.value;
    },
};
/**
 * Allows customizing the serialization of certain values.
 */
const transferHandlers = new Map([
    ["proxy", proxyTransferHandler],
    ["throw", throwTransferHandler],
]);
function expose(obj, ep = self) {
    ep.addEventListener("message", function callback(ev) {
        if (!ev || !ev.data) {
            return;
        }
        const { id, type, path } = Object.assign({ path: [] }, ev.data);
        const argumentList = (ev.data.argumentList || []).map(fromWireValue);
        let returnValue;
        try {
            const parent = path.slice(0, -1).reduce((obj, prop) => obj[prop], obj);
            const rawValue = path.reduce((obj, prop) => obj[prop], obj);
            switch (type) {
                case 0 /* GET */:
                    {
                        returnValue = rawValue;
                    }
                    break;
                case 1 /* SET */:
                    {
                        parent[path.slice(-1)[0]] = fromWireValue(ev.data.value);
                        returnValue = true;
                    }
                    break;
                case 2 /* APPLY */:
                    {
                        returnValue = rawValue.apply(parent, argumentList);
                    }
                    break;
                case 3 /* CONSTRUCT */:
                    {
                        const value = new rawValue(...argumentList);
                        returnValue = proxy(value);
                    }
                    break;
                case 4 /* ENDPOINT */:
                    {
                        const { port1, port2 } = new MessageChannel();
                        expose(obj, port2);
                        returnValue = transfer(port1, [port1]);
                    }
                    break;
                case 5 /* RELEASE */:
                    {
                        returnValue = undefined;
                    }
                    break;
            }
        }
        catch (value) {
            returnValue = { value, [throwMarker]: 0 };
        }
        Promise.resolve(returnValue)
            .catch((value) => {
            return { value, [throwMarker]: 0 };
        })
            .then((returnValue) => {
            const [wireValue, transferables] = toWireValue(returnValue);
            ep.postMessage(Object.assign(Object.assign({}, wireValue), { id }), transferables);
            if (type === 5 /* RELEASE */) {
                // detach and deactive after sending release response above.
                ep.removeEventListener("message", callback);
                closeEndPoint(ep);
            }
        });
    });
    if (ep.start) {
        ep.start();
    }
}
function isMessagePort(endpoint) {
    return endpoint.constructor.name === "MessagePort";
}
function closeEndPoint(endpoint) {
    if (isMessagePort(endpoint))
        endpoint.close();
}
function wrap(ep, target) {
    return createProxy(ep, [], target);
}
function throwIfProxyReleased(isReleased) {
    if (isReleased) {
        throw new Error("Proxy has been released and is not useable");
    }
}
function createProxy(ep, path = [], target = function () { }) {
    let isProxyReleased = false;
    const proxy = new Proxy(target, {
        get(_target, prop) {
            throwIfProxyReleased(isProxyReleased);
            if (prop === releaseProxy) {
                return () => {
                    return requestResponseMessage(ep, {
                        type: 5 /* RELEASE */,
                        path: path.map((p) => p.toString()),
                    }).then(() => {
                        closeEndPoint(ep);
                        isProxyReleased = true;
                    });
                };
            }
            if (prop === "then") {
                if (path.length === 0) {
                    return { then: () => proxy };
                }
                const r = requestResponseMessage(ep, {
                    type: 0 /* GET */,
                    path: path.map((p) => p.toString()),
                }).then(fromWireValue);
                return r.then.bind(r);
            }
            return createProxy(ep, [...path, prop]);
        },
        set(_target, prop, rawValue) {
            throwIfProxyReleased(isProxyReleased);
            // FIXME: ES6 Proxy Handler `set` methods are supposed to return a
            // boolean. To show good will, we return true asynchronously ¯\_(ツ)_/¯
            const [value, transferables] = toWireValue(rawValue);
            return requestResponseMessage(ep, {
                type: 1 /* SET */,
                path: [...path, prop].map((p) => p.toString()),
                value,
            }, transferables).then(fromWireValue);
        },
        apply(_target, _thisArg, rawArgumentList) {
            throwIfProxyReleased(isProxyReleased);
            const last = path[path.length - 1];
            if (last === createEndpoint) {
                return requestResponseMessage(ep, {
                    type: 4 /* ENDPOINT */,
                }).then(fromWireValue);
            }
            // We just pretend that `bind()` didn’t happen.
            if (last === "bind") {
                return createProxy(ep, path.slice(0, -1));
            }
            const [argumentList, transferables] = processArguments(rawArgumentList);
            return requestResponseMessage(ep, {
                type: 2 /* APPLY */,
                path: path.map((p) => p.toString()),
                argumentList,
            }, transferables).then(fromWireValue);
        },
        construct(_target, rawArgumentList) {
            throwIfProxyReleased(isProxyReleased);
            const [argumentList, transferables] = processArguments(rawArgumentList);
            return requestResponseMessage(ep, {
                type: 3 /* CONSTRUCT */,
                path: path.map((p) => p.toString()),
                argumentList,
            }, transferables).then(fromWireValue);
        },
    });
    return proxy;
}
function myFlat(arr) {
    return Array.prototype.concat.apply([], arr);
}
function processArguments(argumentList) {
    const processed = argumentList.map(toWireValue);
    return [processed.map((v) => v[0]), myFlat(processed.map((v) => v[1]))];
}
const transferCache = new WeakMap();
function transfer(obj, transfers) {
    transferCache.set(obj, transfers);
    return obj;
}
function proxy(obj) {
    return Object.assign(obj, { [proxyMarker]: true });
}
function windowEndpoint(w, context = self, targetOrigin = "*") {
    return {
        postMessage: (msg, transferables) => w.postMessage(msg, targetOrigin, transferables),
        addEventListener: context.addEventListener.bind(context),
        removeEventListener: context.removeEventListener.bind(context),
    };
}
function toWireValue(value) {
    for (const [name, handler] of transferHandlers) {
        if (handler.canHandle(value)) {
            const [serializedValue, transferables] = handler.serialize(value);
            return [
                {
                    type: 3 /* HANDLER */,
                    name,
                    value: serializedValue,
                },
                transferables,
            ];
        }
    }
    return [
        {
            type: 0 /* RAW */,
            value,
        },
        transferCache.get(value) || [],
    ];
}
function fromWireValue(value) {
    switch (value.type) {
        case 3 /* HANDLER */:
            return transferHandlers.get(value.name).deserialize(value.value);
        case 0 /* RAW */:
            return value.value;
    }
}
function requestResponseMessage(ep, msg, transfers) {
    return new Promise((resolve) => {
        const id = generateUUID();
        ep.addEventListener("message", function l(ev) {
            if (!ev.data || !ev.data.id || ev.data.id !== id) {
                return;
            }
            ep.removeEventListener("message", l);
            resolve(ev.data);
        });
        if (ep.start) {
            ep.start();
        }
        ep.postMessage(Object.assign({ id }, msg), transfers);
    });
}
function generateUUID() {
    return new Array(4)
        .fill(0)
        .map(() => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16))
        .join("-");
}


//# sourceMappingURL=comlink.mjs.map


/***/ }),

/***/ 794:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

// adapted from https://github.com/emscripten-core/emscripten/blob/cbc974264e0b0b3f0ce8020fb2f1861376c66545/src/library_fs.js
// flexible chunk size parameter
// Creates a file record for lazy-loading from a URL. XXX This requires a synchronous
// XHR, which is not possible in browsers except in a web worker!
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.createLazyFile = exports.LazyUint8Array = void 0;
class LazyUint8Array {
    constructor(config) {
        this.serverChecked = false;
        this.chunks = []; // Loaded chunks. Index is the chunk number
        this.totalFetchedBytes = 0;
        this.totalRequests = 0;
        this.readPages = [];
        // LRU list of read heds, max length = maxReadHeads. first is most recently used
        this.readHeads = [];
        this.lastGet = -1;
        this._chunkSize = config.requestChunkSize;
        this.maxSpeed = Math.round((config.maxReadSpeed || 5 * 1024 * 1024) / this._chunkSize); // max 5MiB at once
        this.maxReadHeads = config.maxReadHeads ?? 3;
        this.rangeMapper = config.rangeMapper;
        this.logPageReads = config.logPageReads ?? false;
        if (config.fileLength) {
            this._length = config.fileLength;
        }
        this.requestLimiter = config.requestLimiter == null ? ((ignored) => { }) : config.requestLimiter;
    }
    /**
     * efficiently copy the range [start, start + length) from the http file into the
     * output buffer at position [outOffset, outOffest + length)
     * reads from cache or synchronously fetches via HTTP if needed
     */
    copyInto(buffer, outOffset, length, start) {
        if (start >= this.length)
            return 0;
        length = Math.min(this.length - start, length);
        const end = start + length;
        let i = 0;
        while (i < length) {
            // {idx: 24, chunkOffset: 24, chunkNum: 0, wantedSize: 16}
            const idx = start + i;
            const chunkOffset = idx % this.chunkSize;
            const chunkNum = (idx / this.chunkSize) | 0;
            const wantedSize = Math.min(this.chunkSize, end - idx);
            let inChunk = this.getChunk(chunkNum);
            if (chunkOffset !== 0 || wantedSize !== this.chunkSize) {
                inChunk = inChunk.subarray(chunkOffset, chunkOffset + wantedSize);
            }
            buffer.set(inChunk, outOffset + i);
            i += inChunk.length;
        }
        return length;
    }
    /* find the best matching existing read head to get the given chunk or create a new one */
    moveReadHead(wantedChunkNum) {
        for (const [i, head] of this.readHeads.entries()) {
            const fetchStartChunkNum = head.startChunk + head.speed;
            const newSpeed = Math.min(this.maxSpeed, head.speed * 2);
            const wantedIsInNextFetchOfHead = wantedChunkNum >= fetchStartChunkNum &&
                wantedChunkNum < fetchStartChunkNum + newSpeed;
            if (wantedIsInNextFetchOfHead) {
                head.speed = newSpeed;
                head.startChunk = fetchStartChunkNum;
                if (i !== 0) {
                    // move head to front
                    this.readHeads.splice(i, 1);
                    this.readHeads.unshift(head);
                }
                return head;
            }
        }
        const newHead = {
            startChunk: wantedChunkNum,
            speed: 1,
        };
        this.readHeads.unshift(newHead);
        while (this.readHeads.length > this.maxReadHeads)
            this.readHeads.pop();
        return newHead;
    }
    /** get the given chunk from cache or fetch it from remote */
    getChunk(wantedChunkNum) {
        let wasCached = true;
        if (typeof this.chunks[wantedChunkNum] === "undefined") {
            wasCached = false;
            // double the fetching chunk size if the wanted chunk would be within the next fetch request
            const head = this.moveReadHead(wantedChunkNum);
            const chunksToFetch = head.speed;
            const startByte = head.startChunk * this.chunkSize;
            let endByte = (head.startChunk + chunksToFetch) * this.chunkSize - 1; // including this byte
            endByte = Math.min(endByte, this.length - 1); // if datalength-1 is selected, this is the last block
            const buf = this.doXHR(startByte, endByte);
            for (let i = 0; i < chunksToFetch; i++) {
                const curChunk = head.startChunk + i;
                if (i * this.chunkSize >= buf.byteLength)
                    break; // past end of file
                const curSize = (i + 1) * this.chunkSize > buf.byteLength
                    ? buf.byteLength - i * this.chunkSize
                    : this.chunkSize;
                // console.log("constructing chunk", buf.byteLength, i * this.chunkSize, curSize);
                this.chunks[curChunk] = new Uint8Array(buf, i * this.chunkSize, curSize);
            }
        }
        if (typeof this.chunks[wantedChunkNum] === "undefined")
            throw new Error("doXHR failed (bug)!");
        const boring = !this.logPageReads || this.lastGet == wantedChunkNum;
        if (!boring) {
            this.lastGet = wantedChunkNum;
            this.readPages.push({
                pageno: wantedChunkNum,
                wasCached,
                prefetch: wasCached ? 0 : this.readHeads[0].speed - 1,
            });
        }
        return this.chunks[wantedChunkNum];
    }
    /** verify the server supports range requests and find out file length */
    checkServer() {
        var xhr = new XMLHttpRequest();
        const url = this.rangeMapper(0, 0).url;
        // can't set Accept-Encoding header :( https://stackoverflow.com/questions/41701849/cannot-modify-accept-encoding-with-fetch
        xhr.open("HEAD", url, false);
        // // maybe this will help it not use compression?
        // xhr.setRequestHeader("Range", "bytes=" + 0 + "-" + 1e12);
        xhr.send(null);
        if (!((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304))
            throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
        var datalength = Number(xhr.getResponseHeader("Content-length"));
        var hasByteServing = xhr.getResponseHeader("Accept-Ranges") === "bytes";
        const encoding = xhr.getResponseHeader("Content-Encoding");
        var usesCompression = encoding && encoding !== "identity";
        if (!hasByteServing) {
            const msg = "Warning: The server did not respond with Accept-Ranges=bytes. It either does not support byte serving or does not advertise it (`Accept-Ranges: bytes` header missing), or your database is hosted on CORS and the server doesn't mark the accept-ranges header as exposed. This may lead to incorrect results.";
            console.warn(msg, "(seen response headers:", xhr.getAllResponseHeaders(), ")");
            // throw Error(msg);
        }
        if (usesCompression) {
            console.warn(`Warning: The server responded with ${encoding} encoding to a HEAD request. Ignoring since it may not do so for Range HTTP requests, but this will lead to incorrect results otherwise since the ranges will be based on the compressed data instead of the uncompressed data.`);
        }
        if (usesCompression) {
            // can't use the given data length if there's compression
            datalength = null;
        }
        if (!this._length) {
            if (!datalength) {
                console.error("response headers", xhr.getAllResponseHeaders());
                throw Error("Length of the file not known. It must either be supplied in the config or given by the HTTP server.");
            }
            this._length = datalength;
        }
        this.serverChecked = true;
    }
    get length() {
        if (!this.serverChecked) {
            this.checkServer();
        }
        return this._length;
    }
    get chunkSize() {
        if (!this.serverChecked) {
            this.checkServer();
        }
        return this._chunkSize;
    }
    doXHR(absoluteFrom, absoluteTo) {
        console.log(`[xhr of size ${(absoluteTo + 1 - absoluteFrom) / 1024} KiB @ ${absoluteFrom / 1024} KiB]`);
        this.requestLimiter(absoluteTo - absoluteFrom);
        this.totalFetchedBytes += absoluteTo - absoluteFrom;
        this.totalRequests++;
        if (absoluteFrom > absoluteTo)
            throw new Error("invalid range (" +
                absoluteFrom +
                ", " +
                absoluteTo +
                ") or no bytes requested!");
        if (absoluteTo > this.length - 1)
            throw new Error("only " + this.length + " bytes available! programmer error!");
        const { fromByte: from, toByte: to, url, } = this.rangeMapper(absoluteFrom, absoluteTo);
        // TODO: Use mozResponseArrayBuffer, responseStream, etc. if available.
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, false);
        if (this.length !== this.chunkSize)
            xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
        // Some hints to the browser that we want binary data.
        xhr.responseType = "arraybuffer";
        if (xhr.overrideMimeType) {
            xhr.overrideMimeType("text/plain; charset=x-user-defined");
        }
        xhr.send(null);
        if (!((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304))
            throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
        if (xhr.response !== undefined) {
            return xhr.response;
        }
        else {
            throw Error("xhr did not return uint8array");
        }
    }
}
exports.LazyUint8Array = LazyUint8Array;
/** create the actual file object for the emscripten file system */
function createLazyFile(FS, parent, name, canRead, canWrite, lazyFileConfig) {
    var lazyArray = new LazyUint8Array(lazyFileConfig);
    var properties = { isDevice: false, contents: lazyArray };
    var node = new FS(parent, name, properties, canRead, canWrite);
    node.contents = lazyArray;
    console.log("Log node");
    console.log(node);
    // Add a function that defers querying the file size until it is asked the first time.
    Object.defineProperties(node, {
        usedBytes: {
            get: /** @this {FSNode} */ function () {
                return this.contents.length;
            },
        },
    });
    // override each stream op with one that tries to force load the lazy file first
    var stream_ops = {};
    var keys = Object.keys(node.stream_ops);
    keys.forEach(function (key) {
        var fn = node.stream_ops[key];
        stream_ops[key] = function forceLoadLazyFile() {
            // FS.forceLoadFile(node);
            node.forceLoadFile();
            return fn.apply(null, arguments);
        };
    });
    // use a custom read function
    stream_ops.read = function stream_ops_read(stream, buffer, offset, length, position) {
        node.forceLoadFile();
        const contents = stream.node.contents;
        return contents.copyInto(buffer, offset, length, position);
    };
    node.stream_ops = stream_ops;
    return node;
}
exports.createLazyFile = createLazyFile;


/***/ }),

/***/ 630:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

/// <reference path="./types.d.ts" />
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.toObjects = void 0;
const Comlink = __importStar(__webpack_require__(870));
const sql_wasm_js_1 = __importDefault(__webpack_require__(365));
const sql_wasm_wasm_1 = __importDefault(__webpack_require__(720));
const lazyFile_1 = __webpack_require__(794);
const vtab_1 = __webpack_require__(457);
sql_wasm_wasm_1.default;
// https://gist.github.com/frankier/4bbc85f65ad3311ca5134fbc744db711
function initTransferHandlers(sql) {
    Comlink.transferHandlers.set("WORKERSQLPROXIES", {
        canHandle: (obj) => {
            let isDB = obj instanceof sql.Database;
            let hasDB = obj && obj.db && obj.db instanceof sql.Database; // prepared statements
            return isDB || hasDB;
        },
        serialize(obj) {
            const { port1, port2 } = new MessageChannel();
            Comlink.expose(obj, port1);
            return [port2, [port2]];
        },
        deserialize: (port) => { },
    });
}
async function init(wasmfile) {
    const sql = await sql_wasm_js_1.default({
        locateFile: (_file) => wasmfile,
    });
    initTransferHandlers(sql);
    return sql;
}
function toObjects(res) {
    return res.flatMap(r => r.values.map((v) => {
        const o = {};
        for (let i = 0; i < r.columns.length; i++) {
            o[r.columns[i]] = v[i];
        }
        return o;
    }));
}
exports.toObjects = toObjects;
async function fetchConfigs(configsOrUrls) {
    const configs = configsOrUrls.map(async (config) => {
        if (config.from === "jsonconfig") {
            const configUrl = new URL(config.configUrl, location.href);
            const req = await fetch(configUrl.toString());
            if (!req.ok) {
                console.error("httpvfs config error", await req.text());
                throw Error(`Could not load httpvfs config: ${req.status}: ${req.statusText}`);
            }
            const configOut = await req.json();
            return {
                from: "inline",
                // resolve url relative to config file
                config: configOut.serverMode === "chunked"
                    ? {
                        ...configOut,
                        urlPrefix: new URL(configOut.urlPrefix, configUrl).toString(),
                    }
                    : {
                        ...configOut,
                        url: new URL(configOut.url, configUrl).toString(),
                    },
                virtualFilename: config.virtualFilename,
            };
        }
        else {
            return config;
        }
    });
    return Promise.all(configs);
}
const mod = {
    db: null,
    inited: false,
    sqljs: null,
    bytesRead: 0,
    async SplitFileHttpDatabase(wasmUrl, configs, mainVirtualFilename, maxBytesToRead = Infinity) {
        if (this.inited)
            throw Error(`sorry, only one db is supported right now`);
        this.inited = true;
        if (!this.sqljs) {
            this.sqljs = init(wasmUrl);
        }
        const sql = await this.sqljs;
        this.bytesRead = 0;
        let requestLimiter = (bytes) => {
            if (this.bytesRead + bytes > maxBytesToRead) {
                this.bytesRead = 0;
                // I couldn't figure out how to get ERRNO_CODES included
                // so just hardcode the actual value
                // https://github.com/emscripten-core/emscripten/blob/565fb3651ed185078df1a13b8edbcb6b2192f29e/system/include/wasi/api.h#L146
                // https://github.com/emscripten-core/emscripten/blob/565fb3651ed185078df1a13b8edbcb6b2192f29e/system/lib/libc/musl/arch/emscripten/bits/errno.h#L13
                throw new sql.FS.ErrnoError(6 /* EAGAIN */);
            }
            this.bytesRead += bytes;
        };
        const lazyFiles = new Map();
        const hydratedConfigs = await fetchConfigs(configs);
        let mainFileConfig;
        for (const { config, virtualFilename } of hydratedConfigs) {
            const id = config.serverMode === "chunked" ? config.urlPrefix : config.url;
            console.log("constructing url database", id);
            let rangeMapper;
            let suffix = config.cacheBust ? "?cb=" + config.cacheBust : "";
            if (config.serverMode == "chunked") {
                rangeMapper = (from, to) => {
                    const serverChunkId = (from / config.serverChunkSize) | 0;
                    const serverFrom = from % config.serverChunkSize;
                    const serverTo = serverFrom + (to - from);
                    return {
                        url: config.urlPrefix + String(serverChunkId).padStart(config.suffixLength, "0") + suffix,
                        fromByte: serverFrom,
                        toByte: serverTo,
                    };
                };
            }
            else {
                rangeMapper = (fromByte, toByte) => ({
                    url: config.url + suffix,
                    fromByte,
                    toByte,
                });
            }
            const filename = virtualFilename || id.replace(/\//g, "_");
            if (!mainVirtualFilename) {
                mainVirtualFilename = filename;
                mainFileConfig = config;
            }
            console.log("filename", filename);
            console.log("constructing url database", id, "filename", filename);
            console.log("sql log");
            console.log(sql);
            const lazyFile = lazyFile_1.createLazyFile(sql.FSNode, "/", filename, true, true, {
                rangeMapper,
                requestChunkSize: config.requestChunkSize,
                fileLength: config.serverMode === "chunked"
                    ? config.databaseLengthBytes
                    : undefined,
                logPageReads: true,
                maxReadHeads: 3,
                requestLimiter
            });
            lazyFiles.set(filename, lazyFile);
        }
        this.db = new sql.CustomDatabase(mainVirtualFilename);
        if (mainFileConfig) {
            // verify page size and disable cache (since we hold everything in memory anyways)
            const pageSizeResp = await this.db.exec("pragma page_size; pragma cache_size=0");
            const pageSize = pageSizeResp[0].values[0][0];
            if (pageSize !== mainFileConfig.requestChunkSize)
                console.warn(`Chunk size does not match page size: pragma page_size = ${pageSize} but chunkSize = ${mainFileConfig.requestChunkSize}`);
        }
        this.db.lazyFiles = lazyFiles;
        this.db.create_vtab(vtab_1.SeriesVtab);
        this.db.query = (...args) => toObjects(this.db.exec(...args));
        return this.db;
    },
    getResetAccessedPages(virtualFilename) {
        if (!this.db)
            return [];
        const lazyFile = this.db.lazyFiles.get(virtualFilename || this.db.filename);
        if (!lazyFile)
            throw Error("unknown lazy file");
        const pages = [...lazyFile.contents.readPages];
        lazyFile.contents.readPages = [];
        return pages;
    },
    getStats(virtualFilename) {
        const db = this.db;
        if (!db)
            return null;
        const lazyFile = db.lazyFiles.get(virtualFilename || db.filename);
        if (!lazyFile)
            throw Error("unknown lazy file");
        const res = {
            filename: db.filename,
            totalBytes: lazyFile.contents.length,
            totalFetchedBytes: lazyFile.contents.totalFetchedBytes,
            totalRequests: lazyFile.contents.totalRequests,
        };
        return res;
    },
    async evalCode(code) {
        return await eval(`(async function (db) {
      ${code}
    })`)(this.db);
    },
};
Comlink.expose(mod);


/***/ }),

/***/ 457:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.SeriesVtab = void 0;
/*const seriesVfs: sqlite3_module = {
  iVersion: 0,
  xConnect()
}
*/
const SQLITE_OK = 0;
const SQLITE_MISUSE = 21;
var Columns;
(function (Columns) {
    Columns[Columns["idx"] = 0] = "idx";
    Columns[Columns["id"] = 1] = "id";
    Columns[Columns["tagName"] = 2] = "tagName";
    Columns[Columns["textContent"] = 3] = "textContent";
    Columns[Columns["innerHTML"] = 4] = "innerHTML";
    Columns[Columns["outerHTML"] = 5] = "outerHTML";
    Columns[Columns["className"] = 6] = "className";
    Columns[Columns["parent"] = 7] = "parent";
    Columns[Columns["selector"] = 8] = "selector";
    Columns[Columns["querySelector"] = 9] = "querySelector";
})(Columns || (Columns = {}));
const columnNames = Object.keys(Columns)
    .map((key) => Columns[key])
    .filter((value) => typeof value === "string");
function rowToObject(row) {
    const out = {};
    for (let i = 0; i < row.length; i++) {
        out[Columns[i]] = row[i];
    }
    return out;
}
// sends a request to the main thread via postMessage,
// then synchronously waits for the result via a SharedArrayBuffer
function doAsyncRequestToMainThread(request) {
    // todo: dynamically adjust this for response size
    const sab = new SharedArrayBuffer(1024 * 1024);
    // first element is for atomic synchronisation, second element is the length of the response
    const metaArray = new Int32Array(sab, 0, 2);
    metaArray[0] = 1;
    // send message to main thread
    self.postMessage({
        action: "eval",
        notify: sab,
        request,
    });
    Atomics.wait(metaArray, 0, 1); // wait until first element is not =1
    const dataLength = metaArray[1];
    // needs to be copied because textdecoder and encoder is not supported on sharedarraybuffers (for now)
    const dataArray = new Uint8Array(sab, 2 * 4, dataLength).slice();
    const resStr = new TextDecoder().decode(dataArray);
    const res = JSON.parse(resStr);
    if ("err" in res)
        throw new Error(res.err);
    return res.ok;
}
class SeriesVtab {
    constructor(module, db) {
        this.module = module;
        this.db = db;
        this.name = "dom";
        this.iVersion = 2;
        this.cursors = new Map();
        console.log("constructed vfs");
    }
    getCursor(cursor) {
        const cursorObj = this.cursors.get(cursor);
        if (!cursorObj)
            throw Error("impl error");
        return cursorObj;
    }
    xConnect(conn, pAux, argc, argv, ppVTab, pzErr) {
        console.log("xconnect!!");
        const rc = this.db.handleError(this.module.ccall("sqlite3_declare_vtab", "number", ["number", "string"], [
            conn,
            `create table x(
              ${columnNames.slice(0, -1).join(", ")} PRIMARY KEY
          ) WITHOUT ROWID`,
        ]));
        const out_ptr = this.module._malloc(12);
        this.module.setValue(ppVTab, out_ptr, "*");
        return SQLITE_OK;
    }
    xDisconnect(pVTab) {
        this.module._free(pVTab);
        return SQLITE_OK;
    }
    xOpen(pVTab, ppCursor) {
        const cursor = this.module._malloc(4);
        // this.module.setValue(series_cursor + 4, cursorId, "i32");
        this.cursors.set(cursor, { elements: [], index: 0, querySelector: "" });
        this.module.setValue(ppCursor, cursor, "*");
        return SQLITE_OK;
    }
    xClose(sqlite3_vtab_cursor) {
        this.module._free(sqlite3_vtab_cursor);
        return SQLITE_OK;
    }
    /*setErrorMessage(cursorPtr: Ptr<sqlite3_vtab_cursor>) {
      const vtabPointer: Ptr<sqlite3_vtab> = this.module.getValue(cursorPtr, "i32");
      const before = this.module.getValue(vtabPointer + 8, "i32");
      console.log("err before", before);
      this.module.setValue(vtabPointer + 8, intArrayFromString("FLONKITAL"), "i32");
    }*/
    xBestIndex(pVTab, info) {
        try {
            const nConstraint = this.module.getValue(info + 0, "i32");
            const aConstraint = this.module.getValue(info + 4, "i32");
            // const constraint = this.module.getValue(aConstraint, "i32");
            // don't care
            const SQLITE_INDEX_CONSTRAINT_MATCH = 64;
            let haveSelectorMatchConstraint = false;
            for (let i = 0; i < nConstraint; i++) {
                const sizeofconstraint = 12;
                const curConstraint = aConstraint + i * sizeofconstraint;
                const iColumn = this.module.getValue(curConstraint, "i32");
                const op = this.module.getValue(curConstraint + 4, "i8");
                const usable = this.module.getValue(curConstraint + 5, "i8");
                if (!usable)
                    continue;
                if (op === SQLITE_INDEX_CONSTRAINT_MATCH) {
                    if (iColumn === Columns.selector) {
                        // this is the one
                        haveSelectorMatchConstraint = true;
                        const aConstraintUsage = this.module.getValue(info + 4 * 4, "i32");
                        const sizeofconstraintusage = 8;
                        this.module.setValue(aConstraintUsage + i * sizeofconstraintusage, 1, "i32");
                    }
                    else {
                        throw Error(`The match operator can only be applied to the selector column!`);
                    }
                }
                console.log(`constraint ${i}: ${Columns[iColumn]} (op=${op})`);
            }
            if (!haveSelectorMatchConstraint) {
                throw Error("You must query the dom using `select ... from dom where selector MATCH <css-selector>`");
            }
            // const aConstraintUsage0 = this.module.getValue(aConstraintUsageArr, "i32");
            const usedColumnsFlag = this.module.getValue(info + 16 * 4, "i32");
            this.module.setValue(info + 5 * 4, usedColumnsFlag, "i32"); // just save the used columns instead of an index id
            return SQLITE_OK;
        }
        catch (e) {
            console.error("xbestindex", e);
            this.setVtabError(pVTab, String(e));
            return SQLITE_MISUSE;
        }
    }
    xFilter(cursorPtr, idxNum, idxStr, argc, argv) {
        console.log("xfilter", argc);
        if (argc !== 1) {
            console.error("did not get a single argument to xFilter");
            return SQLITE_MISUSE;
        }
        const querySelector = this.module.extract_value(argv + 0);
        const cursor = this.getCursor(cursorPtr);
        // await new Promise(e => setTimeout(e, 1000));
        cursor.querySelector = querySelector;
        const usedColumnsFlag = idxNum;
        const usedColumns = columnNames.filter((c) => usedColumnsFlag & (1 << Columns[c]));
        console.log("used columns", usedColumns);
        cursor.elements = doAsyncRequestToMainThread({
            type: "select",
            selector: querySelector,
            columns: usedColumns,
        }); // document.querySelectorAll(str);
        // don't filter anything
        return SQLITE_OK;
    }
    xNext(cursorPtr) {
        const cursor = this.getCursor(cursorPtr);
        cursor.index++;
        return SQLITE_OK;
    }
    xEof(cursorPtr) {
        const cursor = this.getCursor(cursorPtr);
        return +(cursor.index >= cursor.elements.length);
    }
    xColumn(cursorPtr, ctx, column) {
        const cursor = this.getCursor(cursorPtr);
        const ele = cursor.elements[cursor.index];
        if (Columns[column] in ele) {
            this.module.set_return_value(ctx, ele[Columns[column]]);
        }
        else {
            switch (column) {
                case Columns.idx: {
                    this.module.set_return_value(ctx, cursor.index);
                    break;
                }
                case Columns.querySelector: {
                    this.module.set_return_value(ctx, cursor.querySelector);
                    break;
                }
                default: {
                    throw Error(`unknown column ${Columns[column]}`);
                }
            }
        }
        return SQLITE_OK;
    }
    setVtabError(vtab, err) {
        const len = this.module.lengthBytesUTF8(err) + 1;
        const ptr = this.module.sqlite3_malloc(len);
        console.log("writing error", err, len);
        this.module.stringToUTF8(err, ptr, len);
        this.module.setValue(vtab + 8, ptr, "i32");
    }
    xUpdate(vtab, argc, argv, pRowid) {
        try {
            // https://www.sqlite.org/vtab.html#xupdate
            const [oldPrimaryKey, newPrimaryKey, ...args] = Array.from({ length: argc }, (_, i) => this.module.extract_value(argv + 4 * i));
            if (!oldPrimaryKey) {
                console.assert(newPrimaryKey === null);
                // INSERT
                doAsyncRequestToMainThread({
                    type: "insert",
                    value: rowToObject(args),
                });
            }
            else if (oldPrimaryKey && !newPrimaryKey) {
                console.log("DELETE", oldPrimaryKey);
                doAsyncRequestToMainThread({
                    type: "delete",
                    selector: oldPrimaryKey,
                });
                // DELETE
            }
            else {
                // UPDATE
                if (oldPrimaryKey !== newPrimaryKey) {
                    throw "The selector row can't be set";
                }
                doAsyncRequestToMainThread({
                    type: "update",
                    value: rowToObject(args),
                });
            }
            return SQLITE_OK;
        }
        catch (e) {
            this.setVtabError(vtab, String(e));
            return SQLITE_MISUSE;
        }
    }
    xRowid(sqlite3_vtab_cursor, pRowid) {
        throw Error("xRowid not implemented");
    }
    xFindFunction(pVtab, nArg, zName, pxFunc, ppArg) {
        const name = this.module.UTF8ToString(zName);
        if (name !== "match") {
            return SQLITE_OK;
        }
        const SQLITE_INDEX_CONSTRAINT_FUNCTION = 150;
        this.module.setValue(pxFunc, this.module.addFunction((ctx, argc, argv) => {
            // always return true since we apply this filter in the xFilter function
            this.module.set_return_value(ctx, true);
        }, "viii"), "i32");
        return SQLITE_INDEX_CONSTRAINT_FUNCTION;
    }
}
exports.SeriesVtab = SeriesVtab;


/***/ }),

/***/ 365:
/***/ (function(module, exports) {


// We are modularizing this manually because the current modularize setting in Emscripten has some issues:
// https://github.com/kripken/emscripten/issues/5820
// In addition, When you use emcc's modularization, it still expects to export a global object called `Module`,
// which is able to be used/called before the WASM is loaded.
// The modularization below exports a promise that loads and resolves to the actual sql.js module.
// That way, this module can't be used before the WASM is finished loading.

// We are going to define a function that a user will call to start loading initializing our Sql.js library
// However, that function might be called multiple times, and on subsequent calls, we don't actually want it to instantiate a new instance of the Module
// Instead, we want to return the previously loaded module

// TODO: Make this not declare a global if used in the browser
var initSqlJsPromise = undefined;

var initSqlJs = function (moduleConfig) {

    if (initSqlJsPromise){
      return initSqlJsPromise;
    }
    // If we're here, we've never called this function before
    initSqlJsPromise = new Promise(function (resolveModule, reject) {

        // We are modularizing this manually because the current modularize setting in Emscripten has some issues:
        // https://github.com/kripken/emscripten/issues/5820

        // The way to affect the loading of emcc compiled modules is to create a variable called `Module` and add
        // properties to it, like `preRun`, `postRun`, etc
        // We are using that to get notified when the WASM has finished loading.
        // Only then will we return our promise

        // If they passed in a moduleConfig object, use that
        // Otherwise, initialize Module to the empty object
        var Module = typeof moduleConfig !== 'undefined' ? moduleConfig : {};

        // EMCC only allows for a single onAbort function (not an array of functions)
        // So if the user defined their own onAbort function, we remember it and call it
        var originalOnAbortFunction = Module['onAbort'];
        Module['onAbort'] = function (errorThatCausedAbort) {
            reject(new Error(errorThatCausedAbort));
            if (originalOnAbortFunction){
              originalOnAbortFunction(errorThatCausedAbort);
            }
        };

        Module['postRun'] = Module['postRun'] || [];
        Module['postRun'].push(function () {
            // When Emscripted calls postRun, this promise resolves with the built Module
            resolveModule(Module);
        });

        // There is a section of code in the emcc-generated code below that looks like this:
        // (Note that this is lowercase `module`)
        // if (typeof module !== 'undefined') {
        //     module['exports'] = Module;
        // }
        // When that runs, it's going to overwrite our own modularization export efforts in shell-post.js!
        // The only way to tell emcc not to emit it is to pass the MODULARIZE=1 or MODULARIZE_INSTANCE=1 flags,
        // but that carries with it additional unnecessary baggage/bugs we don't want either.
        // So, we have three options:
        // 1) We undefine `module`
        // 2) We remember what `module['exports']` was at the beginning of this function and we restore it later
        // 3) We write a script to remove those lines of code as part of the Make process.
        //
        // Since those are the only lines of code that care about module, we will undefine it. It's the most straightforward
        // of the options, and has the side effect of reducing emcc's efforts to modify the module if its output were to change in the future.
        // That's a nice side effect since we're handling the modularization efforts ourselves
        module = undefined;

        // The emcc-generated code and shell-post.js code goes below,
        // meaning that all of it runs inside of this promise. If anything throws an exception, our promise will abort
var e;e||=typeof Module != 'undefined' ? Module : {};var aa="object"==typeof window,ba="function"==typeof importScripts,da="object"==typeof process&&"object"==typeof process.versions&&"string"==typeof process.versions.node;"use strict";
e.onRuntimeInitialized=function(){function a(h,n){switch(typeof n){case "boolean":Ub(h,n?1:0);break;case "number":Vb(h,n);break;case "string":Wb(h,n,-1,-1);break;case "object":if(null===n)pb(h);else if(null!=n.length){var v=ea(n,fa);Xb(h,v,n.length,-1);ja(v)}else Fa(h,"Wrong API use : tried to return a value of an unknown type ("+n+").",-1);break;default:pb(h)}}function b(h,n){for(var v=[],y=0;y<h;y+=1){var z=g(n+4*y,"i32"),D=Yb(z);if(1===D||2===D)z=Zb(z);else if(3===D)z=$b(z);else if(4===D){D=z;
z=ac(D);D=bc(D);for(var S=new Uint8Array(z),R=0;R<z;R+=1)S[R]=r[D+R];z=S}else z=null;v.push(z)}return v}function c(h,n){this.La=h;this.db=n;this.Ja=1;this.pb=[]}function d(h,n){this.db=n;n=ka(h)+1;this.fb=la(n);if(null===this.fb)throw Error("Unable to allocate memory for the SQL string");t(h,w,this.fb,n);this.lb=this.fb;this.bb=this.wb=null}function f(h){this.filename="dbfile_"+(4294967295*Math.random()>>>0);null!=h&&x.kb("/",this.filename,h,!0,!0);h=u(this.filename,l);this.db=g(l,"i32");this.handleError(h);
Ta(this.db);this.gb={};this.Oa={}}function k(h){this.filename=h;h=u(this.filename,l);this.db=g(l,"i32");this.handleError(h);Ta(this.db);this.gb={};this.Oa={}}var l=ma(4),m=e.cwrap,u=m("sqlite3_open","number",["string","number"]);m("sqlite3_open_v2","number",["string","number","number","string"]);var p=m("sqlite3_close_v2","number",["number"]),A=m("sqlite3_exec","number",["number","string","number","number","number"]),q=m("sqlite3_changes","number",["number"]),C=m("sqlite3_prepare_v2","number",["number",
"string","number","number","number"]),K=m("sqlite3_sql","string",["number"]),L=m("sqlite3_normalized_sql","string",["number"]),J=m("sqlite3_prepare_v2","number",["number","number","number","number","number"]),M=m("sqlite3_bind_text","number",["number","number","number","number","number"]),X=m("sqlite3_bind_blob","number",["number","number","number","number","number"]),ha=m("sqlite3_bind_double","number",["number","number","number"]),ca=m("sqlite3_bind_int","number",["number","number","number"]),Ua=
m("sqlite3_bind_parameter_index","number",["number","string"]),O=m("sqlite3_step","number",["number"]),cc=m("sqlite3_errmsg","string",["number"]),dc=m("sqlite3_column_count","number",["number"]),ec=m("sqlite3_data_count","number",["number"]),fc=m("sqlite3_column_double","number",["number","number"]),qb=m("sqlite3_column_text","string",["number","number"]),gc=m("sqlite3_column_blob","number",["number","number"]),hc=m("sqlite3_column_bytes","number",["number","number"]),ic=m("sqlite3_column_type","number",
["number","number"]),jc=m("sqlite3_column_name","string",["number","number"]),kc=m("sqlite3_reset","number",["number"]),lc=m("sqlite3_clear_bindings","number",["number"]),mc=m("sqlite3_finalize","number",["number"]),rb=m("sqlite3_create_function_v2","number","number string number number number number number number number".split(" ")),Yb=m("sqlite3_value_type","number",["number"]),ac=m("sqlite3_value_bytes","number",["number"]),$b=m("sqlite3_value_text","string",["number"]),bc=m("sqlite3_value_blob",
"number",["number"]),Zb=m("sqlite3_value_double","number",["number"]),Vb=m("sqlite3_result_double","",["number","number"]),pb=m("sqlite3_result_null","",["number"]),Wb=m("sqlite3_result_text","",["number","string","number","number"]),Xb=m("sqlite3_result_blob","",["number","number","number","number"]),Ub=m("sqlite3_result_int","",["number","number"]),Fa=m("sqlite3_result_error","",["number","string","number"]),sb=m("sqlite3_aggregate_context","number",["number","number"]),Ta=m("RegisterExtensionFunctions",
"number",["number"]);c.prototype.bind=function(h){if(!this.La)throw"Statement closed";this.reset();return Array.isArray(h)?this.Zb(h):null!=h&&"object"===typeof h?this.$b(h):!0};c.prototype.step=function(){if(!this.La)throw"Statement closed";this.Ja=1;var h=O(this.La);switch(h){case 100:return!0;case 101:return!1;default:throw this.db.handleError(h);}};c.prototype.Nb=function(h){null==h&&(h=this.Ja,this.Ja+=1);return fc(this.La,h)};c.prototype.ic=function(h){null==h&&(h=this.Ja,this.Ja+=1);h=qb(this.La,
h);if("function"!==typeof BigInt)throw Error("BigInt is not supported");return BigInt(h)};c.prototype.lc=function(h){null==h&&(h=this.Ja,this.Ja+=1);return qb(this.La,h)};c.prototype.getBlob=function(h){null==h&&(h=this.Ja,this.Ja+=1);var n=hc(this.La,h);h=gc(this.La,h);for(var v=new Uint8Array(n),y=0;y<n;y+=1)v[y]=r[h+y];return v};c.prototype.get=function(h,n){n=n||{};null!=h&&this.bind(h)&&this.step();h=[];for(var v=ec(this.La),y=0;y<v;y+=1)switch(ic(this.La,y)){case 1:var z=n.useBigInt?this.ic(y):
this.Nb(y);h.push(z);break;case 2:h.push(this.Nb(y));break;case 3:h.push(this.lc(y));break;case 4:h.push(this.getBlob(y));break;default:h.push(null)}return h};c.prototype.getColumnNames=function(){for(var h=[],n=dc(this.La),v=0;v<n;v+=1)h.push(jc(this.La,v));return h};c.prototype.getAsObject=function(h,n){h=this.get(h,n);n=this.getColumnNames();for(var v={},y=0;y<n.length;y+=1)v[n[y]]=h[y];return v};c.prototype.getSQL=function(){return K(this.La)};c.prototype.getNormalizedSQL=function(){return L(this.La)};
c.prototype.run=function(h){null!=h&&this.bind(h);this.step();return this.reset()};c.prototype.Gb=function(h,n){null==n&&(n=this.Ja,this.Ja+=1);h=na(h);var v=ea(h,fa);this.pb.push(v);this.db.handleError(M(this.La,n,v,h.length-1,0))};c.prototype.Yb=function(h,n){null==n&&(n=this.Ja,this.Ja+=1);var v=ea(h,fa);this.pb.push(v);this.db.handleError(X(this.La,n,v,h.length,0))};c.prototype.Fb=function(h,n){null==n&&(n=this.Ja,this.Ja+=1);this.db.handleError((h===(h|0)?ca:ha)(this.La,n,h))};c.prototype.ac=
function(h){null==h&&(h=this.Ja,this.Ja+=1);X(this.La,h,0,0,0)};c.prototype.Hb=function(h,n){null==n&&(n=this.Ja,this.Ja+=1);switch(typeof h){case "string":this.Gb(h,n);return;case "number":this.Fb(h,n);return;case "bigint":this.Gb(h.toString(),n);return;case "boolean":this.Fb(h+0,n);return;case "object":if(null===h){this.ac(n);return}if(null!=h.length){this.Yb(h,n);return}}throw"Wrong API use : tried to bind a value of an unknown type ("+h+").";};c.prototype.$b=function(h){var n=this;Object.keys(h).forEach(function(v){var y=
Ua(n.La,v);0!==y&&n.Hb(h[v],y)});return!0};c.prototype.Zb=function(h){for(var n=0;n<h.length;n+=1)this.Hb(h[n],n+1);return!0};c.prototype.reset=function(){this.freemem();return 0===lc(this.La)&&0===kc(this.La)};c.prototype.freemem=function(){for(var h;void 0!==(h=this.pb.pop());)ja(h)};c.prototype.free=function(){this.freemem();var h=0===mc(this.La);delete this.db.gb[this.La];this.La=0;return h};d.prototype.next=function(){if(null===this.fb)return{done:!0};null!==this.bb&&(this.bb.free(),this.bb=
null);if(!this.db.db)throw this.qb(),Error("Database closed");var h=oa(),n=ma(4);pa(l);pa(n);try{this.db.handleError(J(this.db.db,this.lb,-1,l,n));this.lb=g(n,"i32");var v=g(l,"i32");if(0===v)return this.qb(),{done:!0};this.bb=new c(v,this.db);this.db.gb[v]=this.bb;return{value:this.bb,done:!1}}catch(y){throw this.wb=qa(this.lb),this.qb(),y;}finally{ra(h)}};d.prototype.qb=function(){ja(this.fb);this.fb=null};d.prototype.getRemainingSQL=function(){return null!==this.wb?this.wb:qa(this.lb)};"function"===
typeof Symbol&&"symbol"===typeof Symbol.iterator&&(d.prototype[Symbol.iterator]=function(){return this});f.prototype.run=function(h,n){if(!this.db)throw"Database closed";if(n){h=this.prepare(h,n);try{h.step()}finally{h.free()}}else this.handleError(A(this.db,h,0,0,l));return this};f.prototype.exec=function(h,n,v){if(!this.db)throw"Database closed";var y=oa(),z=null;try{var D=sa(h),S=ma(4);for(h=[];0!==g(D,"i8");){pa(l);pa(S);this.handleError(J(this.db,D,-1,l,S));var R=g(l,"i32");D=g(S,"i32");if(0!==
R){var Q=null;z=new c(R,this);for(null!=n&&z.bind(n);z.step();)null===Q&&(Q={columns:z.getColumnNames(),values:[]},h.push(Q)),Q.values.push(z.get(null,v));z.free()}}return h}catch(T){throw z&&z.free(),T;}finally{ra(y)}};f.prototype.each=function(h,n,v,y,z){"function"===typeof n&&(y=v,v=n,n=void 0);h=this.prepare(h,n);try{for(;h.step();)v(h.getAsObject(null,z))}finally{h.free()}if("function"===typeof y)return y()};f.prototype.prepare=function(h,n){pa(l);this.handleError(C(this.db,h,-1,l,0));h=g(l,
"i32");if(0===h)throw"Nothing to prepare";var v=new c(h,this);null!=n&&v.bind(n);return this.gb[h]=v};f.prototype.iterateStatements=function(h){return new d(h,this)};f.prototype["export"]=function(){Object.values(this.gb).forEach(function(n){n.free()});Object.values(this.Oa).forEach(ta);this.Oa={};this.handleError(p(this.db));var h=x.readFile(this.filename,{encoding:"binary"});this.handleError(u(this.filename,l));this.db=g(l,"i32");Ta(this.db);return h};f.prototype.close=function(){null!==this.db&&
(Object.values(this.gb).forEach(function(h){h.free()}),Object.values(this.Oa).forEach(ta),this.Oa={},this.handleError(p(this.db)),x.unlink("/"+this.filename),this.db=null)};f.prototype.handleError=function(h){if(0===h)return null;h=cc(this.db);throw Error(h);};f.prototype.getRowsModified=function(){return q(this.db)};f.prototype.create_function=function(h,n){Object.prototype.hasOwnProperty.call(this.Oa,h)&&(ta(this.Oa[h]),delete this.Oa[h]);var v=ua(function(y,z,D){z=b(z,D);try{var S=n.apply(null,
z)}catch(R){Fa(y,R,-1);return}a(y,S)},"viii");this.Oa[h]=v;this.handleError(rb(this.db,h,n.length,1,0,v,0,0,0));return this};f.prototype.create_aggregate=function(h,n){var v=n.init||function(){return null},y=n.finalize||function(Q){return Q},z=n.step;if(!z)throw"An aggregate function must have a step function in "+h;var D={};Object.hasOwnProperty.call(this.Oa,h)&&(ta(this.Oa[h]),delete this.Oa[h]);n=h+"__finalize";Object.hasOwnProperty.call(this.Oa,n)&&(ta(this.Oa[n]),delete this.Oa[n]);var S=ua(function(Q,
T,Ya){var ia=sb(Q,1);Object.hasOwnProperty.call(D,ia)||(D[ia]=v());T=b(T,Ya);T=[D[ia]].concat(T);try{D[ia]=z.apply(null,T)}catch(nc){delete D[ia],Fa(Q,nc,-1)}},"viii"),R=ua(function(Q){var T=sb(Q,1);try{var Ya=y(D[T])}catch(ia){delete D[T];Fa(Q,ia,-1);return}a(Q,Ya);delete D[T]},"vi");this.Oa[h]=S;this.Oa[n]=R;this.handleError(rb(this.db,h,z.length-1,1,0,0,S,R,0));return this};e.Database=f;e.CustomDatabase=k;e.FS=x;e.FSNode=x.Ab;k.prototype=Object.create(f.prototype)};
var va=Object.assign({},e),wa="./this.program",B="",xa,ya;
if(da){var fs=require("fs"),za=require("path");B=__dirname+"/";ya=a=>{a=Aa(a)?new URL(a):za.normalize(a);return fs.readFileSync(a)};xa=a=>{a=Aa(a)?new URL(a):za.normalize(a);return new Promise((b,c)=>{fs.readFile(a,void 0,(d,f)=>{d?c(d):b(f.buffer)})})};!e.thisProgram&&1<process.argv.length&&(wa=process.argv[1].replace(/\\/g,"/"));process.argv.slice(2);"undefined"!=typeof module&&(module.exports=e)}else if(aa||ba)ba?B=self.location.href:"undefined"!=typeof document&&document.currentScript&&(B=document.currentScript.src),
B=B.startsWith("blob:")?"":B.substr(0,B.replace(/[?#].*/,"").lastIndexOf("/")+1),ba&&(ya=a=>{var b=new XMLHttpRequest;b.open("GET",a,!1);b.responseType="arraybuffer";b.send(null);return new Uint8Array(b.response)}),xa=a=>Aa(a)?new Promise((b,c)=>{var d=new XMLHttpRequest;d.open("GET",a,!0);d.responseType="arraybuffer";d.onload=()=>{(200==d.status||0==d.status&&d.response)&&c(d.response);b(d.status)};d.onerror=b;d.send(null)}):fetch(a,{credentials:"same-origin"}).then(b=>b.ok?b.arrayBuffer():Promise.reject(Error(b.status+
" : "+b.url)));var Ba=e.print||console.log.bind(console),Ca=e.printErr||console.error.bind(console);Object.assign(e,va);va=null;e.thisProgram&&(wa=e.thisProgram);var Da;e.wasmBinary&&(Da=e.wasmBinary);var Ea,Ga=!1,r,w,Ha,E,F,Ia,Ja;
function Ka(){var a=Ea.buffer;e.HEAP8=r=new Int8Array(a);e.HEAP16=Ha=new Int16Array(a);e.HEAPU8=w=new Uint8Array(a);e.HEAPU16=new Uint16Array(a);e.HEAP32=E=new Int32Array(a);e.HEAPU32=F=new Uint32Array(a);e.HEAPF32=Ia=new Float32Array(a);e.HEAPF64=Ja=new Float64Array(a)}var La=[],Ma=[],Na=[];function Oa(){var a=e.preRun.shift();La.unshift(a)}var Pa=0,Qa=null,Ra=null;function Sa(){Pa++;e.monitorRunDependencies?.(Pa)}
function Va(){Pa--;e.monitorRunDependencies?.(Pa);if(0==Pa&&(null!==Qa&&(clearInterval(Qa),Qa=null),Ra)){var a=Ra;Ra=null;a()}}function Wa(a){e.onAbort?.(a);a="Aborted("+a+")";Ca(a);Ga=!0;throw new WebAssembly.RuntimeError(a+". Build with -sASSERTIONS for more info.");}var Xa=a=>a.startsWith("data:application/octet-stream;base64,"),Aa=a=>a.startsWith("file://"),Za;function $a(a){if(a==Za&&Da)return new Uint8Array(Da);if(ya)return ya(a);throw"both async and sync fetching of the wasm failed";}
function ab(a){return Da?Promise.resolve().then(()=>$a(a)):xa(a).then(b=>new Uint8Array(b),()=>$a(a))}function bb(a,b,c){return ab(a).then(d=>WebAssembly.instantiate(d,b)).then(c,d=>{Ca(`failed to asynchronously prepare wasm: ${d}`);Wa(d)})}
function cb(a,b){var c=Za;Da||"function"!=typeof WebAssembly.instantiateStreaming||Xa(c)||Aa(c)||da||"function"!=typeof fetch?bb(c,a,b):fetch(c,{credentials:"same-origin"}).then(d=>WebAssembly.instantiateStreaming(d,a).then(b,function(f){Ca(`wasm streaming compile failed: ${f}`);Ca("falling back to ArrayBuffer instantiation");return bb(c,a,b)}))}var G,H,db=a=>{for(;0<a.length;)a.shift()(e)};
function g(a,b="i8"){b.endsWith("*")&&(b="*");switch(b){case "i1":return r[a];case "i8":return r[a];case "i16":return Ha[a>>1];case "i32":return E[a>>2];case "i64":Wa("to do getValue(i64) use WASM_BIGINT");case "float":return Ia[a>>2];case "double":return Ja[a>>3];case "*":return F[a>>2];default:Wa(`invalid type for getValue: ${b}`)}}
function pa(a){var b="i32";b.endsWith("*")&&(b="*");switch(b){case "i1":r[a]=0;break;case "i8":r[a]=0;break;case "i16":Ha[a>>1]=0;break;case "i32":E[a>>2]=0;break;case "i64":Wa("to do setValue(i64) use WASM_BIGINT");case "float":Ia[a>>2]=0;break;case "double":Ja[a>>3]=0;break;case "*":F[a>>2]=0;break;default:Wa(`invalid type for setValue: ${b}`)}}
var eb="undefined"!=typeof TextDecoder?new TextDecoder:void 0,I=(a,b,c)=>{var d=b+c;for(c=b;a[c]&&!(c>=d);)++c;if(16<c-b&&a.buffer&&eb)return eb.decode(a.subarray(b,c));for(d="";b<c;){var f=a[b++];if(f&128){var k=a[b++]&63;if(192==(f&224))d+=String.fromCharCode((f&31)<<6|k);else{var l=a[b++]&63;f=224==(f&240)?(f&15)<<12|k<<6|l:(f&7)<<18|k<<12|l<<6|a[b++]&63;65536>f?d+=String.fromCharCode(f):(f-=65536,d+=String.fromCharCode(55296|f>>10,56320|f&1023))}}else d+=String.fromCharCode(f)}return d},qa=(a,
b)=>a?I(w,a,b):"",fb=(a,b)=>{for(var c=0,d=a.length-1;0<=d;d--){var f=a[d];"."===f?a.splice(d,1):".."===f?(a.splice(d,1),c++):c&&(a.splice(d,1),c--)}if(b)for(;c;c--)a.unshift("..");return a},N=a=>{var b="/"===a.charAt(0),c="/"===a.substr(-1);(a=fb(a.split("/").filter(d=>!!d),!b).join("/"))||b||(a=".");a&&c&&(a+="/");return(b?"/":"")+a},gb=a=>{var b=/^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/.exec(a).slice(1);a=b[0];b=b[1];if(!a&&!b)return".";b&&=b.substr(0,b.length-1);return a+
b},hb=a=>{if("/"===a)return"/";a=N(a);a=a.replace(/\/$/,"");var b=a.lastIndexOf("/");return-1===b?a:a.substr(b+1)},ib=(a,b)=>N(a+"/"+b),jb=()=>{if("object"==typeof crypto&&"function"==typeof crypto.getRandomValues)return c=>crypto.getRandomValues(c);if(da)try{var a=require("crypto");if(a.randomFillSync)return c=>a.randomFillSync(c);var b=a.randomBytes;return c=>(c.set(b(c.byteLength)),c)}catch(c){}Wa("initRandomDevice")},kb=a=>(kb=jb())(a),lb=(...a)=>{for(var b="",c=!1,d=a.length-1;-1<=d&&!c;d--){c=
0<=d?a[d]:x.cwd();if("string"!=typeof c)throw new TypeError("Arguments to path.resolve must be strings");if(!c)return"";b=c+"/"+b;c="/"===c.charAt(0)}b=fb(b.split("/").filter(f=>!!f),!c).join("/");return(c?"/":"")+b||"."},mb=(a,b)=>{function c(l){for(var m=0;m<l.length&&""===l[m];m++);for(var u=l.length-1;0<=u&&""===l[u];u--);return m>u?[]:l.slice(m,u-m+1)}a=lb(a).substr(1);b=lb(b).substr(1);a=c(a.split("/"));b=c(b.split("/"));for(var d=Math.min(a.length,b.length),f=d,k=0;k<d;k++)if(a[k]!==b[k]){f=
k;break}d=[];for(k=f;k<a.length;k++)d.push("..");d=d.concat(b.slice(f));return d.join("/")},nb=[],ka=a=>{for(var b=0,c=0;c<a.length;++c){var d=a.charCodeAt(c);127>=d?b++:2047>=d?b+=2:55296<=d&&57343>=d?(b+=4,++c):b+=3}return b},t=(a,b,c,d)=>{if(!(0<d))return 0;var f=c;d=c+d-1;for(var k=0;k<a.length;++k){var l=a.charCodeAt(k);if(55296<=l&&57343>=l){var m=a.charCodeAt(++k);l=65536+((l&1023)<<10)|m&1023}if(127>=l){if(c>=d)break;b[c++]=l}else{if(2047>=l){if(c+1>=d)break;b[c++]=192|l>>6}else{if(65535>=
l){if(c+2>=d)break;b[c++]=224|l>>12}else{if(c+3>=d)break;b[c++]=240|l>>18;b[c++]=128|l>>12&63}b[c++]=128|l>>6&63}b[c++]=128|l&63}}b[c]=0;return c-f};function na(a,b){var c=Array(ka(a)+1);a=t(a,c,0,c.length);b&&(c.length=a);return c}var ob=[];function tb(a,b){ob[a]={input:[],output:[],eb:b};ub(a,vb)}
var vb={open(a){var b=ob[a.node.rdev];if(!b)throw new x.Fa(43);a.tty=b;a.seekable=!1},close(a){a.tty.eb.fsync(a.tty)},fsync(a){a.tty.eb.fsync(a.tty)},read(a,b,c,d){if(!a.tty||!a.tty.eb.Ob)throw new x.Fa(60);for(var f=0,k=0;k<d;k++){try{var l=a.tty.eb.Ob(a.tty)}catch(m){throw new x.Fa(29);}if(void 0===l&&0===f)throw new x.Fa(6);if(null===l||void 0===l)break;f++;b[c+k]=l}f&&(a.node.timestamp=Date.now());return f},write(a,b,c,d){if(!a.tty||!a.tty.eb.xb)throw new x.Fa(60);try{for(var f=0;f<d;f++)a.tty.eb.xb(a.tty,
b[c+f])}catch(k){throw new x.Fa(29);}d&&(a.node.timestamp=Date.now());return f}},wb={Ob(){a:{if(!nb.length){var a=null;if(da){var b=Buffer.alloc(256),c=0,d=process.stdin.fd;try{c=fs.readSync(d,b,0,256)}catch(f){if(f.toString().includes("EOF"))c=0;else throw f;}0<c&&(a=b.slice(0,c).toString("utf-8"))}else"undefined"!=typeof window&&"function"==typeof window.prompt&&(a=window.prompt("Input: "),null!==a&&(a+="\n"));if(!a){a=null;break a}nb=na(a,!0)}a=nb.shift()}return a},xb(a,b){null===b||10===b?(Ba(I(a.output,
0)),a.output=[]):0!=b&&a.output.push(b)},fsync(a){a.output&&0<a.output.length&&(Ba(I(a.output,0)),a.output=[])},yc(){return{sc:25856,uc:5,rc:191,tc:35387,qc:[3,28,127,21,4,0,1,0,17,19,26,0,18,15,23,22,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]}},zc(){return 0},Ac(){return[24,80]}},xb={xb(a,b){null===b||10===b?(Ca(I(a.output,0)),a.output=[]):0!=b&&a.output.push(b)},fsync(a){a.output&&0<a.output.length&&(Ca(I(a.output,0)),a.output=[])}},zb=a=>{a=65536*Math.ceil(a/65536);var b=yb(65536,a);b?(w.fill(0,b,b+a),a=
b):a=0;return a};function Ab(a,b){var c=a.Ia?a.Ia.length:0;c>=b||(b=Math.max(b,c*(1048576>c?2:1.125)>>>0),0!=c&&(b=Math.max(b,256)),c=a.Ia,a.Ia=new Uint8Array(b),0<a.Ma&&a.Ia.set(c.subarray(0,a.Ma),0))}
var P={Wa:null,Na(){return P.createNode(null,"/",16895,0)},createNode(a,b,c,d){if(24576===(c&61440)||x.isFIFO(c))throw new x.Fa(63);P.Wa||(P.Wa={dir:{node:{Ta:P.Ga.Ta,Pa:P.Ga.Pa,lookup:P.Ga.lookup,Ya:P.Ga.Ya,rename:P.Ga.rename,unlink:P.Ga.unlink,rmdir:P.Ga.rmdir,readdir:P.Ga.readdir,symlink:P.Ga.symlink},stream:{Ua:P.Ha.Ua}},file:{node:{Ta:P.Ga.Ta,Pa:P.Ga.Pa},stream:{Ua:P.Ha.Ua,read:P.Ha.read,write:P.Ha.write,hb:P.Ha.hb,$a:P.Ha.$a,cb:P.Ha.cb}},link:{node:{Ta:P.Ga.Ta,Pa:P.Ga.Pa,readlink:P.Ga.readlink},
stream:{}},Ib:{node:{Ta:P.Ga.Ta,Pa:P.Ga.Pa},stream:x.dc}});c=x.createNode(a,b,c,d);U(c.mode)?(c.Ga=P.Wa.dir.node,c.Ha=P.Wa.dir.stream,c.Ia={}):x.isFile(c.mode)?(c.Ga=P.Wa.file.node,c.Ha=P.Wa.file.stream,c.Ma=0,c.Ia=null):40960===(c.mode&61440)?(c.Ga=P.Wa.link.node,c.Ha=P.Wa.link.stream):8192===(c.mode&61440)&&(c.Ga=P.Wa.Ib.node,c.Ha=P.Wa.Ib.stream);c.timestamp=Date.now();a&&(a.Ia[b]=c,a.timestamp=c.timestamp);return c},xc(a){return a.Ia?a.Ia.subarray?a.Ia.subarray(0,a.Ma):new Uint8Array(a.Ia):new Uint8Array(0)},
Ga:{Ta(a){var b={};b.dev=8192===(a.mode&61440)?a.id:1;b.ino=a.id;b.mode=a.mode;b.nlink=1;b.uid=0;b.gid=0;b.rdev=a.rdev;U(a.mode)?b.size=4096:x.isFile(a.mode)?b.size=a.Ma:40960===(a.mode&61440)?b.size=a.link.length:b.size=0;b.atime=new Date(a.timestamp);b.mtime=new Date(a.timestamp);b.ctime=new Date(a.timestamp);b.bc=4096;b.blocks=Math.ceil(b.size/b.bc);return b},Pa(a,b){void 0!==b.mode&&(a.mode=b.mode);void 0!==b.timestamp&&(a.timestamp=b.timestamp);if(void 0!==b.size&&(b=b.size,a.Ma!=b))if(0==b)a.Ia=
null,a.Ma=0;else{var c=a.Ia;a.Ia=new Uint8Array(b);c&&a.Ia.set(c.subarray(0,Math.min(b,a.Ma)));a.Ma=b}},lookup(){throw x.sb[44];},Ya(a,b,c,d){return P.createNode(a,b,c,d)},rename(a,b,c){if(U(a.mode)){try{var d=V(b,c)}catch(k){}if(d)for(var f in d.Ia)throw new x.Fa(55);}delete a.parent.Ia[a.name];a.parent.timestamp=Date.now();a.name=c;b.Ia[c]=a;b.timestamp=a.parent.timestamp},unlink(a,b){delete a.Ia[b];a.timestamp=Date.now()},rmdir(a,b){var c=V(a,b),d;for(d in c.Ia)throw new x.Fa(55);delete a.Ia[b];
a.timestamp=Date.now()},readdir(a){var b=[".",".."],c;for(c of Object.keys(a.Ia))b.push(c);return b},symlink(a,b,c){a=P.createNode(a,b,41471,0);a.link=c;return a},readlink(a){if(40960!==(a.mode&61440))throw new x.Fa(28);return a.link}},Ha:{read(a,b,c,d,f){var k=a.node.Ia;if(f>=a.node.Ma)return 0;a=Math.min(a.node.Ma-f,d);if(8<a&&k.subarray)b.set(k.subarray(f,f+a),c);else for(d=0;d<a;d++)b[c+d]=k[f+d];return a},write(a,b,c,d,f,k){b.buffer===r.buffer&&(k=!1);if(!d)return 0;a=a.node;a.timestamp=Date.now();
if(b.subarray&&(!a.Ia||a.Ia.subarray)){if(k)return a.Ia=b.subarray(c,c+d),a.Ma=d;if(0===a.Ma&&0===f)return a.Ia=b.slice(c,c+d),a.Ma=d;if(f+d<=a.Ma)return a.Ia.set(b.subarray(c,c+d),f),d}Ab(a,f+d);if(a.Ia.subarray&&b.subarray)a.Ia.set(b.subarray(c,c+d),f);else for(k=0;k<d;k++)a.Ia[f+k]=b[c+k];a.Ma=Math.max(a.Ma,f+d);return d},Ua(a,b,c){1===c?b+=a.position:2===c&&x.isFile(a.node.mode)&&(b+=a.node.Ma);if(0>b)throw new x.Fa(28);return b},hb(a,b,c){Ab(a.node,b+c);a.node.Ma=Math.max(a.node.Ma,b+c)},$a(a,
b,c,d,f){if(!x.isFile(a.node.mode))throw new x.Fa(43);a=a.node.Ia;if(f&2||a.buffer!==r.buffer){if(0<c||c+b<a.length)a.subarray?a=a.subarray(c,c+b):a=Array.prototype.slice.call(a,c,c+b);c=!0;b=zb(b);if(!b)throw new x.Fa(48);r.set(a,b)}else c=!1,b=a.byteOffset;return{Tb:b,Eb:c}},cb(a,b,c,d){P.Ha.write(a,b,0,d,c,!1);return 0}}},Bb=(a,b,c)=>{var d=`al ${a}`;xa(a).then(f=>{b(new Uint8Array(f));d&&Va(d)},()=>{if(c)c();else throw`Loading data file "${a}" failed.`;});d&&Sa(d)},Cb=e.preloadPlugins||[],Db=
(a,b,c,d)=>{"undefined"!=typeof Browser&&Browser.ib();var f=!1;Cb.forEach(k=>{!f&&k.canHandle(b)&&(k.handle(a,b,c,d),f=!0)});return f},Eb=(a,b,c,d,f,k,l,m,u,p)=>{function A(K){function L(J){p?.();m||x.kb(a,b,J,d,f,u);k?.();Va(C)}Db(K,q,L,()=>{l?.();Va(C)})||L(K)}var q=b?lb(N(a+"/"+b)):a,C=`cp ${q}`;Sa(C);"string"==typeof c?Bb(c,A,l):A(c)},Fb=(a,b)=>{var c=0;a&&(c|=365);b&&(c|=146);return c};function ub(a,b){x.Mb[a]={Ha:b}}function U(a){return 16384===(a&61440)}
function V(a,b){var c=U(a.mode)?(c=Gb(a,"x"))?c:a.Ga.lookup?0:2:54;if(c)throw new x.Fa(c);for(c=x.Va[Hb(a.id,b)];c;c=c.ab){var d=c.name;if(c.parent.id===a.id&&d===b)return c}return x.lookup(a,b)}
function W(a,b={}){a=lb(a);if(!a)return{path:"",node:null};b=Object.assign({rb:!0,zb:0},b);if(8<b.zb)throw new x.Fa(32);a=a.split("/").filter(l=>!!l);for(var c=x.root,d="/",f=0;f<a.length;f++){var k=f===a.length-1;if(k&&b.parent)break;c=V(c,a[f]);d=N(d+"/"+a[f]);c.Ra&&(!k||k&&b.rb)&&(c=c.Ra.root);if(!k||b.Qa)for(k=0;40960===(c.mode&61440);)if(c=x.readlink(d),d=lb(gb(d),c),c=W(d,{zb:b.zb+1}).node,40<k++)throw new x.Fa(32);}return{path:d,node:c}}
function Ib(a){for(var b;;){if(x.Rb(a))return a=a.Na.Sb,b?"/"!==a[a.length-1]?`${a}/${b}`:a+b:a;b=b?`${a.name}/${b}`:a.name;a=a.parent}}function Hb(a,b){for(var c=0,d=0;d<b.length;d++)c=(c<<5)-c+b.charCodeAt(d)|0;return(a+c>>>0)%x.Va.length}function Jb(a){var b=Hb(a.parent.id,a.name);a.ab=x.Va[b];x.Va[b]=a}function Kb(a){var b=Hb(a.parent.id,a.name);if(x.Va[b]===a)x.Va[b]=a.ab;else for(b=x.Va[b];b;){if(b.ab===a){b.ab=a.ab;break}b=b.ab}}
function Lb(a){var b=["r","w","rw"][a&3];a&512&&(b+="w");return b}function Gb(a,b){if(x.Pb)return 0;if(!b.includes("r")||a.mode&292){if(b.includes("w")&&!(a.mode&146)||b.includes("x")&&!(a.mode&73))return 2}else return 2;return 0}function Mb(a,b){try{return V(a,b),20}catch(c){}return Gb(a,"wx")}function Nb(a,b,c){try{var d=V(a,b)}catch(f){return f.Ka}if(a=Gb(a,"wx"))return a;if(c){if(!U(d.mode))return 54;if(x.Rb(d)||Ib(d)===x.cwd())return 10}else if(U(d.mode))return 31;return 0}
function Y(a){a=x.kc(a);if(!a)throw new x.Fa(8);return a}function Ob(a,b=-1){a=Object.assign(new x.Vb,a);if(-1==b)a:{for(b=0;b<=x.Xb;b++)if(!x.streams[b])break a;throw new x.Fa(33);}a.fd=b;return x.streams[b]=a}function Pb(a,b=-1){a=Ob(a,b);a.Ha?.vc?.(a);return a}function Qb(a){var b=[];for(a=[a];a.length;){var c=a.pop();b.push(c);a.push(...c.jb)}return b}function Rb(a,b,c){"undefined"==typeof c&&(c=b,b=438);return x.Ya(a,b|8192,c)}
function Sb(a,b,c,d){a="string"==typeof a?a:Ib(a);b=N(a+"/"+b);return x.create(b,Fb(c,d))}function Tb(a){if(!(a.mc||a.nc||a.link||a.Ia)){if("undefined"!=typeof XMLHttpRequest)throw Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");try{a.Ia=ya(a.url),a.Ma=a.Ia.length}catch(b){throw new x.Fa(29);}}}
var x={root:null,jb:[],Mb:{},streams:[],oc:1,Va:null,Lb:"/",ub:!1,Pb:!0,Fa:class{constructor(a){this.name="ErrnoError";this.Ka=a}},sb:{},hc:null,mb:0,Vb:class{constructor(){this.Xa={};this.node=null}get object(){return this.node}set object(a){this.node=a}get flags(){return this.Xa.flags}set flags(a){this.Xa.flags=a}get position(){return this.Xa.position}set position(a){this.Xa.position=a}},Ab:class{constructor(a,b,c,d){a||=this;this.parent=a;this.Na=a.Na;this.Ra=null;this.id=x.oc++;this.name=b;this.mode=
c;this.Ga={};this.Ha={};this.rdev=d}get read(){return 365===(this.mode&365)}set read(a){a?this.mode|=365:this.mode&=-366}get write(){return 146===(this.mode&146)}set write(a){a?this.mode|=146:this.mode&=-147}get nc(){return U(this.mode)}get mc(){return 8192===(this.mode&61440)}},createNode(a,b,c,d){a=new x.Ab(a,b,c,d);Jb(a);return a},Rb(a){return a===a.parent},isFile(a){return 32768===(a&61440)},isFIFO(a){return 4096===(a&61440)},isSocket(a){return 49152===(a&49152)},Xb:4096,kc:a=>x.streams[a],dc:{open(a){a.Ha=
x.jc(a.node.rdev).Ha;a.Ha.open?.(a)},Ua(){throw new x.Fa(70);}},vb:a=>a>>8,Bc:a=>a&255,Za:(a,b)=>a<<8|b,jc:a=>x.Mb[a],Ub(a,b){function c(l){x.mb--;return b(l)}function d(l){if(l){if(!d.fc)return d.fc=!0,c(l)}else++k>=f.length&&c(null)}"function"==typeof a&&(b=a,a=!1);x.mb++;1<x.mb&&Ca(`warning: ${x.mb} FS.syncfs operations in flight at once, probably just doing extra work`);var f=Qb(x.root.Na),k=0;f.forEach(l=>{if(!l.type.Ub)return d(null);l.type.Ub(l,a,d)})},Na(a,b,c){var d="/"===c;if(d&&x.root)throw new x.Fa(10);
if(!d&&c){var f=W(c,{rb:!1});c=f.path;f=f.node;if(f.Ra)throw new x.Fa(10);if(!U(f.mode))throw new x.Fa(54);}b={type:a,Dc:b,Sb:c,jb:[]};a=a.Na(b);a.Na=b;b.root=a;d?x.root=a:f&&(f.Ra=b,f.Na&&f.Na.jb.push(b));return a},Fc(a){a=W(a,{rb:!1});if(!a.node.Ra)throw new x.Fa(28);a=a.node;var b=a.Ra,c=Qb(b);Object.keys(x.Va).forEach(d=>{for(d=x.Va[d];d;){var f=d.ab;c.includes(d.Na)&&Kb(d);d=f}});a.Ra=null;a.Na.jb.splice(a.Na.jb.indexOf(b),1)},lookup(a,b){return a.Ga.lookup(a,b)},Ya(a,b,c){var d=W(a,{parent:!0}).node;
a=hb(a);if(!a||"."===a||".."===a)throw new x.Fa(28);var f=Mb(d,a);if(f)throw new x.Fa(f);if(!d.Ga.Ya)throw new x.Fa(63);return d.Ga.Ya(d,a,b,c)},create(a,b){return x.Ya(a,(void 0!==b?b:438)&4095|32768,0)},mkdir(a,b){return x.Ya(a,(void 0!==b?b:511)&1023|16384,0)},Cc(a,b){a=a.split("/");for(var c="",d=0;d<a.length;++d)if(a[d]){c+="/"+a[d];try{x.mkdir(c,b)}catch(f){if(20!=f.Ka)throw f;}}},symlink(a,b){if(!lb(a))throw new x.Fa(44);var c=W(b,{parent:!0}).node;if(!c)throw new x.Fa(44);b=hb(b);var d=Mb(c,
b);if(d)throw new x.Fa(d);if(!c.Ga.symlink)throw new x.Fa(63);return c.Ga.symlink(c,b,a)},rename(a,b){var c=gb(a),d=gb(b),f=hb(a),k=hb(b);var l=W(a,{parent:!0});var m=l.node;l=W(b,{parent:!0});l=l.node;if(!m||!l)throw new x.Fa(44);if(m.Na!==l.Na)throw new x.Fa(75);var u=V(m,f);a=mb(a,d);if("."!==a.charAt(0))throw new x.Fa(28);a=mb(b,c);if("."!==a.charAt(0))throw new x.Fa(55);try{var p=V(l,k)}catch(A){}if(u!==p){b=U(u.mode);if(f=Nb(m,f,b))throw new x.Fa(f);if(f=p?Nb(l,k,b):Mb(l,k))throw new x.Fa(f);
if(!m.Ga.rename)throw new x.Fa(63);if(u.Ra||p&&p.Ra)throw new x.Fa(10);if(l!==m&&(f=Gb(m,"w")))throw new x.Fa(f);Kb(u);try{m.Ga.rename(u,l,k),u.parent=l}catch(A){throw A;}finally{Jb(u)}}},rmdir(a){var b=W(a,{parent:!0}).node;a=hb(a);var c=V(b,a),d=Nb(b,a,!0);if(d)throw new x.Fa(d);if(!b.Ga.rmdir)throw new x.Fa(63);if(c.Ra)throw new x.Fa(10);b.Ga.rmdir(b,a);Kb(c)},readdir(a){a=W(a,{Qa:!0}).node;if(!a.Ga.readdir)throw new x.Fa(54);return a.Ga.readdir(a)},unlink(a){var b=W(a,{parent:!0}).node;if(!b)throw new x.Fa(44);
a=hb(a);var c=V(b,a),d=Nb(b,a,!1);if(d)throw new x.Fa(d);if(!b.Ga.unlink)throw new x.Fa(63);if(c.Ra)throw new x.Fa(10);b.Ga.unlink(b,a);Kb(c)},readlink(a){a=W(a).node;if(!a)throw new x.Fa(44);if(!a.Ga.readlink)throw new x.Fa(28);return lb(Ib(a.parent),a.Ga.readlink(a))},stat(a,b){a=W(a,{Qa:!b}).node;if(!a)throw new x.Fa(44);if(!a.Ga.Ta)throw new x.Fa(63);return a.Ga.Ta(a)},lstat(a){return x.stat(a,!0)},chmod(a,b,c){a="string"==typeof a?W(a,{Qa:!c}).node:a;if(!a.Ga.Pa)throw new x.Fa(63);a.Ga.Pa(a,
{mode:b&4095|a.mode&-4096,timestamp:Date.now()})},lchmod(a,b){x.chmod(a,b,!0)},fchmod(a,b){a=Y(a);x.chmod(a.node,b)},chown(a,b,c,d){a="string"==typeof a?W(a,{Qa:!d}).node:a;if(!a.Ga.Pa)throw new x.Fa(63);a.Ga.Pa(a,{timestamp:Date.now()})},lchown(a,b,c){x.chown(a,b,c,!0)},fchown(a,b,c){a=Y(a);x.chown(a.node,b,c)},truncate(a,b){if(0>b)throw new x.Fa(28);a="string"==typeof a?W(a,{Qa:!0}).node:a;if(!a.Ga.Pa)throw new x.Fa(63);if(U(a.mode))throw new x.Fa(31);if(!x.isFile(a.mode))throw new x.Fa(28);var c=
Gb(a,"w");if(c)throw new x.Fa(c);a.Ga.Pa(a,{size:b,timestamp:Date.now()})},open(a,b,c){if(""===a)throw new x.Fa(44);if("string"==typeof b){var d={r:0,"r+":2,w:577,"w+":578,a:1089,"a+":1090}[b];if("undefined"==typeof d)throw Error(`Unknown file open mode: ${b}`);b=d}c=b&64?("undefined"==typeof c?438:c)&4095|32768:0;if("object"==typeof a)var f=a;else{a=N(a);try{f=W(a,{Qa:!(b&131072)}).node}catch(k){}}d=!1;if(b&64)if(f){if(b&128)throw new x.Fa(20);}else f=x.Ya(a,c,0),d=!0;if(!f)throw new x.Fa(44);8192===
(f.mode&61440)&&(b&=-513);if(b&65536&&!U(f.mode))throw new x.Fa(54);if(!d&&(c=f?40960===(f.mode&61440)?32:U(f.mode)&&("r"!==Lb(b)||b&512)?31:Gb(f,Lb(b)):44))throw new x.Fa(c);b&512&&!d&&x.truncate(f,0);b&=-131713;f=Ob({node:f,path:Ib(f),flags:b,seekable:!0,position:0,Ha:f.Ha,pc:[],error:!1});f.Ha.open&&f.Ha.open(f);!e.logReadFiles||b&1||(x.yb||(x.yb={}),a in x.yb||(x.yb[a]=1));return f},close(a){if(null===a.fd)throw new x.Fa(8);a.tb&&(a.tb=null);try{a.Ha.close&&a.Ha.close(a)}catch(b){throw b;}finally{x.streams[a.fd]=
null}a.fd=null},Ua(a,b,c){if(null===a.fd)throw new x.Fa(8);if(!a.seekable||!a.Ha.Ua)throw new x.Fa(70);if(0!=c&&1!=c&&2!=c)throw new x.Fa(28);a.position=a.Ha.Ua(a,b,c);a.pc=[];return a.position},read(a,b,c,d,f){if(0>d||0>f)throw new x.Fa(28);if(null===a.fd)throw new x.Fa(8);if(1===(a.flags&2097155))throw new x.Fa(8);if(U(a.node.mode))throw new x.Fa(31);if(!a.Ha.read)throw new x.Fa(28);var k="undefined"!=typeof f;if(!k)f=a.position;else if(!a.seekable)throw new x.Fa(70);b=a.Ha.read(a,b,c,d,f);k||(a.position+=
b);return b},write(a,b,c,d,f,k){if(0>d||0>f)throw new x.Fa(28);if(null===a.fd)throw new x.Fa(8);if(0===(a.flags&2097155))throw new x.Fa(8);if(U(a.node.mode))throw new x.Fa(31);if(!a.Ha.write)throw new x.Fa(28);a.seekable&&a.flags&1024&&x.Ua(a,0,2);var l="undefined"!=typeof f;if(!l)f=a.position;else if(!a.seekable)throw new x.Fa(70);b=a.Ha.write(a,b,c,d,f,k);l||(a.position+=b);return b},hb(a,b,c){if(null===a.fd)throw new x.Fa(8);if(0>b||0>=c)throw new x.Fa(28);if(0===(a.flags&2097155))throw new x.Fa(8);
if(!x.isFile(a.node.mode)&&!U(a.node.mode))throw new x.Fa(43);if(!a.Ha.hb)throw new x.Fa(138);a.Ha.hb(a,b,c)},$a(a,b,c,d,f){if(0!==(d&2)&&0===(f&2)&&2!==(a.flags&2097155))throw new x.Fa(2);if(1===(a.flags&2097155))throw new x.Fa(2);if(!a.Ha.$a)throw new x.Fa(43);return a.Ha.$a(a,b,c,d,f)},cb(a,b,c,d,f){return a.Ha.cb?a.Ha.cb(a,b,c,d,f):0},Qb(a,b,c){if(!a.Ha.Qb)throw new x.Fa(59);return a.Ha.Qb(a,b,c)},readFile(a,b={}){b.flags=b.flags||0;b.encoding=b.encoding||"binary";if("utf8"!==b.encoding&&"binary"!==
b.encoding)throw Error(`Invalid encoding type "${b.encoding}"`);var c,d=x.open(a,b.flags);a=x.stat(a).size;var f=new Uint8Array(a);x.read(d,f,0,a,0);"utf8"===b.encoding?c=I(f,0):"binary"===b.encoding&&(c=f);x.close(d);return c},writeFile(a,b,c={}){c.flags=c.flags||577;a=x.open(a,c.flags,c.mode);if("string"==typeof b){var d=new Uint8Array(ka(b)+1);b=t(b,d,0,d.length);x.write(a,d,0,b,void 0,c.cc)}else if(ArrayBuffer.isView(b))x.write(a,b,0,b.byteLength,void 0,c.cc);else throw Error("Unsupported data type");
x.close(a)},cwd:()=>x.Lb,chdir(a){a=W(a,{Qa:!0});if(null===a.node)throw new x.Fa(44);if(!U(a.node.mode))throw new x.Fa(54);var b=Gb(a.node,"x");if(b)throw new x.Fa(b);x.Lb=a.path},ib(a,b,c){x.ib.ub=!0;e.stdin=a||e.stdin;e.stdout=b||e.stdout;e.stderr=c||e.stderr;e.stdin?x.Sa("/dev","stdin",e.stdin):x.symlink("/dev/tty","/dev/stdin");e.stdout?x.Sa("/dev","stdout",null,e.stdout):x.symlink("/dev/tty","/dev/stdout");e.stderr?x.Sa("/dev","stderr",null,e.stderr):x.symlink("/dev/tty1","/dev/stderr");x.open("/dev/stdin",
0);x.open("/dev/stdout",1);x.open("/dev/stderr",1)},Ec(){x.ib.ub=!1;for(var a=0;a<x.streams.length;a++){var b=x.streams[a];b&&x.close(b)}},wc(a,b){try{var c=W(a,{Qa:!b});a=c.path}catch(k){}var d=!1,f=null;try{c=W(a,{parent:!0}),hb(a),c=W(a,{Qa:!b}),d=!0,f=c.node}catch(k){}return d?f:null},Kb(a,b){a="string"==typeof a?a:Ib(a);for(b=b.split("/").reverse();b.length;){var c=b.pop();if(c){var d=N(a+"/"+c);try{x.mkdir(d)}catch(f){}a=d}}return d},kb(a,b,c,d,f,k){var l=b;a&&(a="string"==typeof a?a:Ib(a),
l=b?N(a+"/"+b):a);a=Fb(d,f);l=x.create(l,a);if(c){if("string"==typeof c){b=Array(c.length);d=0;for(f=c.length;d<f;++d)b[d]=c.charCodeAt(d);c=b}x.chmod(l,a|146);b=x.open(l,577);x.write(b,c,0,c.length,0,k);x.close(b);x.chmod(l,a)}},Sa(a,b,c,d){a=ib("string"==typeof a?a:Ib(a),b);b=Fb(!!c,!!d);x.Sa.vb||(x.Sa.vb=64);var f=x.Za(x.Sa.vb++,0);ub(f,{open(k){k.seekable=!1},close(){d?.buffer?.length&&d(10)},read(k,l,m,u){for(var p=0,A=0;A<u;A++){try{var q=c()}catch(C){throw new x.Fa(29);}if(void 0===q&&0===
p)throw new x.Fa(6);if(null===q||void 0===q)break;p++;l[m+A]=q}p&&(k.node.timestamp=Date.now());return p},write(k,l,m,u){for(var p=0;p<u;p++)try{d(l[m+p])}catch(A){throw new x.Fa(29);}u&&(k.node.timestamp=Date.now());return p}});return Rb(a,b,f)},Jb(a,b,c,d,f){function k(q,C,K,L,J){q=q.node.Ia;if(J>=q.length)return 0;L=Math.min(q.length-J,L);if(q.slice)for(var M=0;M<L;M++)C[K+M]=q[J+M];else for(M=0;M<L;M++)C[K+M]=q.get(J+M);return L}class l{constructor(){this.ob=!1;this.Xa=[];this.nb=void 0;this.Bb=
this.Cb=0}get(q){if(!(q>this.length-1||0>q)){var C=q%this.chunkSize;return this.nb(q/this.chunkSize|0)[C]}}Wb(q){this.nb=q}Db(){var q=new XMLHttpRequest;q.open("HEAD",c,!1);q.send(null);if(!(200<=q.status&&300>q.status||304===q.status))throw Error("Couldn't load "+c+". Status: "+q.status);var C=Number(q.getResponseHeader("Content-length")),K,L=(K=q.getResponseHeader("Accept-Ranges"))&&"bytes"===K;q=(K=q.getResponseHeader("Content-Encoding"))&&"gzip"===K;var J=1048576;L||(J=C);var M=this;M.Wb(X=>{var ha=
X*J,ca=(X+1)*J-1;ca=Math.min(ca,C-1);if("undefined"==typeof M.Xa[X]){var Ua=M.Xa;if(ha>ca)throw Error("invalid range ("+ha+", "+ca+") or no bytes requested!");if(ca>C-1)throw Error("only "+C+" bytes available! programmer error!");var O=new XMLHttpRequest;O.open("GET",c,!1);C!==J&&O.setRequestHeader("Range","bytes="+ha+"-"+ca);O.responseType="arraybuffer";O.overrideMimeType&&O.overrideMimeType("text/plain; charset=x-user-defined");O.send(null);if(!(200<=O.status&&300>O.status||304===O.status))throw Error("Couldn't load "+
c+". Status: "+O.status);ha=void 0!==O.response?new Uint8Array(O.response||[]):na(O.responseText||"",!0);Ua[X]=ha}if("undefined"==typeof M.Xa[X])throw Error("doXHR failed!");return M.Xa[X]});if(q||!C)J=C=1,J=C=this.nb(0).length,Ba("LazyFiles on gzip forces download of the whole file when length is accessed");this.Cb=C;this.Bb=J;this.ob=!0}get length(){this.ob||this.Db();return this.Cb}get chunkSize(){this.ob||this.Db();return this.Bb}}if("undefined"!=typeof XMLHttpRequest){if(!ba)throw"Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
var m=new l;var u=void 0}else u=c,m=void 0;var p=Sb(a,b,d,f);m?p.Ia=m:u&&(p.Ia=null,p.url=u);Object.defineProperties(p,{Ma:{get:function(){return this.Ia.length}}});var A={};Object.keys(p.Ha).forEach(q=>{var C=p.Ha[q];A[q]=(...K)=>{Tb(p);return C(...K)}});A.read=(q,C,K,L,J)=>{Tb(p);return k(q,C,K,L,J)};A.$a=(q,C,K)=>{Tb(p);var L=zb(C);if(!L)throw new x.Fa(48);k(q,r,L,C,K);return{Tb:L,Eb:!0}};p.Ha=A;return p}};
function oc(a,b,c){if("/"===b.charAt(0))return b;a=-100===a?x.cwd():Y(a).path;if(0==b.length){if(!c)throw new x.Fa(44);return a}return N(a+"/"+b)}
function pc(a,b,c){a=a(b);E[c>>2]=a.dev;E[c+4>>2]=a.mode;F[c+8>>2]=a.nlink;E[c+12>>2]=a.uid;E[c+16>>2]=a.gid;E[c+20>>2]=a.rdev;H=[a.size>>>0,(G=a.size,1<=+Math.abs(G)?0<G?+Math.floor(G/4294967296)>>>0:~~+Math.ceil((G-+(~~G>>>0))/4294967296)>>>0:0)];E[c+24>>2]=H[0];E[c+28>>2]=H[1];E[c+32>>2]=4096;E[c+36>>2]=a.blocks;b=a.atime.getTime();var d=a.mtime.getTime(),f=a.ctime.getTime();H=[Math.floor(b/1E3)>>>0,(G=Math.floor(b/1E3),1<=+Math.abs(G)?0<G?+Math.floor(G/4294967296)>>>0:~~+Math.ceil((G-+(~~G>>>
0))/4294967296)>>>0:0)];E[c+40>>2]=H[0];E[c+44>>2]=H[1];F[c+48>>2]=b%1E3*1E3;H=[Math.floor(d/1E3)>>>0,(G=Math.floor(d/1E3),1<=+Math.abs(G)?0<G?+Math.floor(G/4294967296)>>>0:~~+Math.ceil((G-+(~~G>>>0))/4294967296)>>>0:0)];E[c+56>>2]=H[0];E[c+60>>2]=H[1];F[c+64>>2]=d%1E3*1E3;H=[Math.floor(f/1E3)>>>0,(G=Math.floor(f/1E3),1<=+Math.abs(G)?0<G?+Math.floor(G/4294967296)>>>0:~~+Math.ceil((G-+(~~G>>>0))/4294967296)>>>0:0)];E[c+72>>2]=H[0];E[c+76>>2]=H[1];F[c+80>>2]=f%1E3*1E3;H=[a.ino>>>0,(G=a.ino,1<=+Math.abs(G)?
0<G?+Math.floor(G/4294967296)>>>0:~~+Math.ceil((G-+(~~G>>>0))/4294967296)>>>0:0)];E[c+88>>2]=H[0];E[c+92>>2]=H[1];return 0}var qc=void 0;function rc(){var a=E[+qc>>2];qc+=4;return a}
var sc=(a,b)=>b+2097152>>>0<4194305-!!a?(a>>>0)+4294967296*b:NaN,tc=[0,31,60,91,121,152,182,213,244,274,305,335],uc=[0,31,59,90,120,151,181,212,243,273,304,334],vc={},xc=()=>{if(!wc){var a={USER:"web_user",LOGNAME:"web_user",PATH:"/",PWD:"/",HOME:"/home/web_user",LANG:("object"==typeof navigator&&navigator.languages&&navigator.languages[0]||"C").replace("-","_")+".UTF-8",_:wa||"./this.program"},b;for(b in vc)void 0===vc[b]?delete a[b]:a[b]=vc[b];var c=[];for(b in a)c.push(`${b}=${a[b]}`);wc=c}return wc},
wc,sa=a=>{var b=ka(a)+1,c=ma(b);t(a,w,c,b);return c},yc=(a,b,c,d)=>{var f={string:p=>{var A=0;null!==p&&void 0!==p&&0!==p&&(A=sa(p));return A},array:p=>{var A=ma(p.length);r.set(p,A);return A}};a=e["_"+a];var k=[],l=0;if(d)for(var m=0;m<d.length;m++){var u=f[c[m]];u?(0===l&&(l=oa()),k[m]=u(d[m])):k[m]=d[m]}c=a(...k);return c=function(p){0!==l&&ra(l);return"string"===b?p?I(w,p):"":"boolean"===b?!!p:p}(c)},fa=0,ea=(a,b)=>{b=1==b?ma(a.length):la(a.length);a.subarray||a.slice||(a=new Uint8Array(a));w.set(a,
b);return b},zc,Ac=[],Bc,ta=a=>{zc.delete(Bc.get(a));Bc.set(a,null);Ac.push(a)},ua=(a,b)=>{if(!zc){zc=new WeakMap;var c=Bc.length;if(zc)for(var d=0;d<0+c;d++){var f=Bc.get(d);f&&zc.set(f,d)}}if(c=zc.get(a)||0)return c;if(Ac.length)c=Ac.pop();else{try{Bc.grow(1)}catch(m){if(!(m instanceof RangeError))throw m;throw"Unable to grow wasm table. Set ALLOW_TABLE_GROWTH.";}c=Bc.length-1}try{Bc.set(c,a)}catch(m){if(!(m instanceof TypeError))throw m;if("function"==typeof WebAssembly.Function){d=WebAssembly.Function;
f={i:"i32",j:"i64",f:"f32",d:"f64",e:"externref",p:"i32"};for(var k={parameters:[],results:"v"==b[0]?[]:[f[b[0]]]},l=1;l<b.length;++l)k.parameters.push(f[b[l]]);b=new d(k,a)}else{d=[1];f=b.slice(0,1);b=b.slice(1);k={i:127,p:127,j:126,f:125,d:124,e:111};d.push(96);l=b.length;128>l?d.push(l):d.push(l%128|128,l>>7);for(l=0;l<b.length;++l)d.push(k[b[l]]);"v"==f?d.push(0):d.push(1,k[f]);b=[0,97,115,109,1,0,0,0,1];f=d.length;128>f?b.push(f):b.push(f%128|128,f>>7);b.push(...d);b.push(2,7,1,1,101,1,102,0,
0,7,5,1,1,102,0,0);b=new WebAssembly.Module(new Uint8Array(b));b=(new WebAssembly.Instance(b,{e:{f:a}})).exports.f}Bc.set(c,b)}zc.set(a,c);return c},Cc=x.Kb,Dc=x.Jb,Ec=x.Sa;x.ec=Eb;[44].forEach(a=>{x.sb[a]=new x.Fa(a);x.sb[a].stack="<generic error, no stack>"});x.Va=Array(4096);x.Na(P,{},"/");x.mkdir("/tmp");x.mkdir("/home");x.mkdir("/home/web_user");
(function(){x.mkdir("/dev");ub(x.Za(1,3),{read:()=>0,write:(d,f,k,l)=>l});Rb("/dev/null",x.Za(1,3));tb(x.Za(5,0),wb);tb(x.Za(6,0),xb);Rb("/dev/tty",x.Za(5,0));Rb("/dev/tty1",x.Za(6,0));var a=new Uint8Array(1024),b=0,c=()=>{0===b&&(b=kb(a).byteLength);return a[--b]};x.Sa("/dev","random",c);x.Sa("/dev","urandom",c);x.mkdir("/dev/shm");x.mkdir("/dev/shm/tmp")})();
(function(){x.mkdir("/proc");var a=x.mkdir("/proc/self");x.mkdir("/proc/self/fd");x.Na({Na(){var b=x.createNode(a,"fd",16895,73);b.Ga={lookup(c,d){var f=Y(+d);c={parent:null,Na:{Sb:"fake"},Ga:{readlink:()=>f.path}};return c.parent=c}};return b}},{},"/proc/self/fd")})();x.hc={MEMFS:P};e.FS_createPath=x.Kb;e.FS_createDataFile=x.kb;e.FS_createPreloadedFile=x.ec;e.FS_unlink=x.unlink;e.FS_createLazyFile=x.Jb;e.FS_createDevice=x.Sa;
var Fc={a:(a,b,c,d)=>{Wa(`Assertion failed: ${a?I(w,a):""}, at: `+[b?b?I(w,b):"":"unknown filename",c,d?d?I(w,d):"":"unknown function"])},h:function(a,b){try{return a=a?I(w,a):"",x.chmod(a,b),0}catch(c){if("undefined"==typeof x||"ErrnoError"!==c.name)throw c;return-c.Ka}},H:function(a,b,c){try{b=b?I(w,b):"";b=oc(a,b);if(c&-8)return-28;var d=W(b,{Qa:!0}).node;if(!d)return-44;a="";c&4&&(a+="r");c&2&&(a+="w");c&1&&(a+="x");return a&&Gb(d,a)?-2:0}catch(f){if("undefined"==typeof x||"ErrnoError"!==f.name)throw f;
return-f.Ka}},i:function(a,b){try{return x.fchmod(a,b),0}catch(c){if("undefined"==typeof x||"ErrnoError"!==c.name)throw c;return-c.Ka}},g:function(a,b,c){try{return x.fchown(a,b,c),0}catch(d){if("undefined"==typeof x||"ErrnoError"!==d.name)throw d;return-d.Ka}},b:function(a,b,c){qc=c;try{var d=Y(a);switch(b){case 0:var f=rc();if(0>f)break;for(;x.streams[f];)f++;return Pb(d,f).fd;case 1:case 2:return 0;case 3:return d.flags;case 4:return f=rc(),d.flags|=f,0;case 12:return f=rc(),Ha[f+0>>1]=2,0;case 13:case 14:return 0}return-28}catch(k){if("undefined"==
typeof x||"ErrnoError"!==k.name)throw k;return-k.Ka}},f:function(a,b){try{var c=Y(a);return pc(x.stat,c.path,b)}catch(d){if("undefined"==typeof x||"ErrnoError"!==d.name)throw d;return-d.Ka}},n:function(a,b,c){b=sc(b,c);try{if(isNaN(b))return 61;var d=Y(a);if(0===(d.flags&2097155))throw new x.Fa(28);x.truncate(d.node,b);return 0}catch(f){if("undefined"==typeof x||"ErrnoError"!==f.name)throw f;return-f.Ka}},C:function(a,b){try{if(0===b)return-28;var c=x.cwd(),d=ka(c)+1;if(b<d)return-68;t(c,w,a,b);return d}catch(f){if("undefined"==
typeof x||"ErrnoError"!==f.name)throw f;return-f.Ka}},F:function(a,b){try{return a=a?I(w,a):"",pc(x.lstat,a,b)}catch(c){if("undefined"==typeof x||"ErrnoError"!==c.name)throw c;return-c.Ka}},z:function(a,b,c){try{return b=b?I(w,b):"",b=oc(a,b),b=N(b),"/"===b[b.length-1]&&(b=b.substr(0,b.length-1)),x.mkdir(b,c,0),0}catch(d){if("undefined"==typeof x||"ErrnoError"!==d.name)throw d;return-d.Ka}},E:function(a,b,c,d){try{b=b?I(w,b):"";var f=d&256;b=oc(a,b,d&4096);return pc(f?x.lstat:x.stat,b,c)}catch(k){if("undefined"==
typeof x||"ErrnoError"!==k.name)throw k;return-k.Ka}},x:function(a,b,c,d){qc=d;try{b=b?I(w,b):"";b=oc(a,b);var f=d?rc():0;return x.open(b,c,f).fd}catch(k){if("undefined"==typeof x||"ErrnoError"!==k.name)throw k;return-k.Ka}},v:function(a,b,c,d){try{b=b?I(w,b):"";b=oc(a,b);if(0>=d)return-28;var f=x.readlink(b),k=Math.min(d,ka(f)),l=r[c+k];t(f,w,c,d+1);r[c+k]=l;return k}catch(m){if("undefined"==typeof x||"ErrnoError"!==m.name)throw m;return-m.Ka}},u:function(a){try{return a=a?I(w,a):"",x.rmdir(a),0}catch(b){if("undefined"==
typeof x||"ErrnoError"!==b.name)throw b;return-b.Ka}},G:function(a,b){try{return a=a?I(w,a):"",pc(x.stat,a,b)}catch(c){if("undefined"==typeof x||"ErrnoError"!==c.name)throw c;return-c.Ka}},r:function(a,b,c){try{return b=b?I(w,b):"",b=oc(a,b),0===c?x.unlink(b):512===c?x.rmdir(b):Wa("Invalid flags passed to unlinkat"),0}catch(d){if("undefined"==typeof x||"ErrnoError"!==d.name)throw d;return-d.Ka}},q:function(a,b,c){try{b=b?I(w,b):"";b=oc(a,b,!0);if(c){var d=F[c>>2]+4294967296*E[c+4>>2],f=E[c+8>>2];
k=1E3*d+f/1E6;c+=16;d=F[c>>2]+4294967296*E[c+4>>2];f=E[c+8>>2];l=1E3*d+f/1E6}else var k=Date.now(),l=k;a=k;var m=W(b,{Qa:!0}).node;m.Ga.Pa(m,{timestamp:Math.max(a,l)});return 0}catch(u){if("undefined"==typeof x||"ErrnoError"!==u.name)throw u;return-u.Ka}},l:function(a,b,c){a=new Date(1E3*sc(a,b));E[c>>2]=a.getSeconds();E[c+4>>2]=a.getMinutes();E[c+8>>2]=a.getHours();E[c+12>>2]=a.getDate();E[c+16>>2]=a.getMonth();E[c+20>>2]=a.getFullYear()-1900;E[c+24>>2]=a.getDay();b=a.getFullYear();E[c+28>>2]=(0!==
b%4||0===b%100&&0!==b%400?uc:tc)[a.getMonth()]+a.getDate()-1|0;E[c+36>>2]=-(60*a.getTimezoneOffset());b=(new Date(a.getFullYear(),6,1)).getTimezoneOffset();var d=(new Date(a.getFullYear(),0,1)).getTimezoneOffset();E[c+32>>2]=(b!=d&&a.getTimezoneOffset()==Math.min(d,b))|0},j:function(a,b,c,d,f,k,l,m){f=sc(f,k);try{if(isNaN(f))return 61;var u=Y(d),p=x.$a(u,a,f,b,c),A=p.Tb;E[l>>2]=p.Eb;F[m>>2]=A;return 0}catch(q){if("undefined"==typeof x||"ErrnoError"!==q.name)throw q;return-q.Ka}},k:function(a,b,c,
d,f,k,l){k=sc(k,l);try{var m=Y(f);if(c&2){if(!x.isFile(m.node.mode))throw new x.Fa(43);if(!(d&2)){var u=w.slice(a,a+b);x.cb(m,u,k,b,d)}}}catch(p){if("undefined"==typeof x||"ErrnoError"!==p.name)throw p;return-p.Ka}},y:(a,b,c,d)=>{var f=(new Date).getFullYear(),k=(new Date(f,0,1)).getTimezoneOffset();f=(new Date(f,6,1)).getTimezoneOffset();F[a>>2]=60*Math.max(k,f);E[b>>2]=Number(k!=f);b=l=>{var m=Math.abs(l);return`UTC${0<=l?"-":"+"}${String(Math.floor(m/60)).padStart(2,"0")}${String(m%60).padStart(2,
"0")}`};a=b(k);b=b(f);f<k?(t(a,w,c,17),t(b,w,d,17)):(t(a,w,d,17),t(b,w,c,17))},d:()=>Date.now(),s:()=>2147483648,c:()=>performance.now(),o:a=>{var b=w.length;a>>>=0;if(2147483648<a)return!1;for(var c=1;4>=c;c*=2){var d=b*(1+.2/c);d=Math.min(d,a+100663296);var f=Math;d=Math.max(a,d);a:{f=(f.min.call(f,2147483648,d+(65536-d%65536)%65536)-Ea.buffer.byteLength+65535)/65536;try{Ea.grow(f);Ka();var k=1;break a}catch(l){}k=void 0}if(k)return!0}return!1},A:(a,b)=>{var c=0;xc().forEach((d,f)=>{var k=b+c;f=
F[a+4*f>>2]=k;for(k=0;k<d.length;++k)r[f++]=d.charCodeAt(k);r[f]=0;c+=d.length+1});return 0},B:(a,b)=>{var c=xc();F[a>>2]=c.length;var d=0;c.forEach(f=>d+=f.length+1);F[b>>2]=d;return 0},e:function(a){try{var b=Y(a);x.close(b);return 0}catch(c){if("undefined"==typeof x||"ErrnoError"!==c.name)throw c;return c.Ka}},p:function(a,b){try{var c=Y(a);r[b]=c.tty?2:U(c.mode)?3:40960===(c.mode&61440)?7:4;Ha[b+2>>1]=0;H=[0,(G=0,1<=+Math.abs(G)?0<G?+Math.floor(G/4294967296)>>>0:~~+Math.ceil((G-+(~~G>>>0))/4294967296)>>>
0:0)];E[b+8>>2]=H[0];E[b+12>>2]=H[1];H=[0,(G=0,1<=+Math.abs(G)?0<G?+Math.floor(G/4294967296)>>>0:~~+Math.ceil((G-+(~~G>>>0))/4294967296)>>>0:0)];E[b+16>>2]=H[0];E[b+20>>2]=H[1];return 0}catch(d){if("undefined"==typeof x||"ErrnoError"!==d.name)throw d;return d.Ka}},w:function(a,b,c,d){try{a:{var f=Y(a);a=b;for(var k,l=b=0;l<c;l++){var m=F[a>>2],u=F[a+4>>2];a+=8;var p=x.read(f,r,m,u,k);if(0>p){var A=-1;break a}b+=p;if(p<u)break;"undefined"!=typeof k&&(k+=p)}A=b}F[d>>2]=A;return 0}catch(q){if("undefined"==
typeof x||"ErrnoError"!==q.name)throw q;return q.Ka}},m:function(a,b,c,d,f){b=sc(b,c);try{if(isNaN(b))return 61;var k=Y(a);x.Ua(k,b,d);H=[k.position>>>0,(G=k.position,1<=+Math.abs(G)?0<G?+Math.floor(G/4294967296)>>>0:~~+Math.ceil((G-+(~~G>>>0))/4294967296)>>>0:0)];E[f>>2]=H[0];E[f+4>>2]=H[1];k.tb&&0===b&&0===d&&(k.tb=null);return 0}catch(l){if("undefined"==typeof x||"ErrnoError"!==l.name)throw l;return l.Ka}},D:function(a){try{var b=Y(a);return b.Ha?.fsync?b.Ha.fsync(b):0}catch(c){if("undefined"==
typeof x||"ErrnoError"!==c.name)throw c;return c.Ka}},t:function(a,b,c,d){try{a:{var f=Y(a);a=b;for(var k,l=b=0;l<c;l++){var m=F[a>>2],u=F[a+4>>2];a+=8;var p=x.write(f,r,m,u,k);if(0>p){var A=-1;break a}b+=p;"undefined"!=typeof k&&(k+=p)}A=b}F[d>>2]=A;return 0}catch(q){if("undefined"==typeof x||"ErrnoError"!==q.name)throw q;return q.Ka}}},Z=function(){function a(c){Z=c.exports;Ea=Z.I;Ka();Bc=Z.K;Ma.unshift(Z.J);Va("wasm-instantiate");return Z}var b={a:Fc};Sa("wasm-instantiate");if(e.instantiateWasm)try{return e.instantiateWasm(b,
a)}catch(c){return Ca(`Module.instantiateWasm callback failed with error: ${c}`),!1}Za||=Xa("sql-wasm.wasm")?"sql-wasm.wasm":e.locateFile?e.locateFile("sql-wasm.wasm",B):B+"sql-wasm.wasm";cb(b,function(c){a(c.instance)});return{}}();e._sqlite3_free=a=>(e._sqlite3_free=Z.L)(a);e._sqlite3_value_text=a=>(e._sqlite3_value_text=Z.M)(a);e._sqlite3_prepare_v2=(a,b,c,d,f)=>(e._sqlite3_prepare_v2=Z.N)(a,b,c,d,f);e._sqlite3_step=a=>(e._sqlite3_step=Z.O)(a);e._sqlite3_reset=a=>(e._sqlite3_reset=Z.P)(a);
e._sqlite3_exec=(a,b,c,d,f)=>(e._sqlite3_exec=Z.Q)(a,b,c,d,f);e._sqlite3_finalize=a=>(e._sqlite3_finalize=Z.R)(a);e._sqlite3_column_name=(a,b)=>(e._sqlite3_column_name=Z.S)(a,b);e._sqlite3_column_text=(a,b)=>(e._sqlite3_column_text=Z.T)(a,b);e._sqlite3_column_type=(a,b)=>(e._sqlite3_column_type=Z.U)(a,b);e._sqlite3_errmsg=a=>(e._sqlite3_errmsg=Z.V)(a);e._sqlite3_clear_bindings=a=>(e._sqlite3_clear_bindings=Z.W)(a);e._sqlite3_value_blob=a=>(e._sqlite3_value_blob=Z.X)(a);
e._sqlite3_value_bytes=a=>(e._sqlite3_value_bytes=Z.Y)(a);e._sqlite3_value_double=a=>(e._sqlite3_value_double=Z.Z)(a);e._sqlite3_value_int=a=>(e._sqlite3_value_int=Z._)(a);e._sqlite3_value_type=a=>(e._sqlite3_value_type=Z.$)(a);e._sqlite3_result_blob=(a,b,c,d)=>(e._sqlite3_result_blob=Z.aa)(a,b,c,d);e._sqlite3_result_double=(a,b)=>(e._sqlite3_result_double=Z.ba)(a,b);e._sqlite3_result_error=(a,b,c)=>(e._sqlite3_result_error=Z.ca)(a,b,c);
e._sqlite3_result_int=(a,b)=>(e._sqlite3_result_int=Z.da)(a,b);e._sqlite3_result_int64=(a,b,c)=>(e._sqlite3_result_int64=Z.ea)(a,b,c);e._sqlite3_result_null=a=>(e._sqlite3_result_null=Z.fa)(a);e._sqlite3_result_text=(a,b,c,d)=>(e._sqlite3_result_text=Z.ga)(a,b,c,d);e._sqlite3_aggregate_context=(a,b)=>(e._sqlite3_aggregate_context=Z.ha)(a,b);e._sqlite3_column_count=a=>(e._sqlite3_column_count=Z.ia)(a);e._sqlite3_data_count=a=>(e._sqlite3_data_count=Z.ja)(a);
e._sqlite3_column_blob=(a,b)=>(e._sqlite3_column_blob=Z.ka)(a,b);e._sqlite3_column_bytes=(a,b)=>(e._sqlite3_column_bytes=Z.la)(a,b);e._sqlite3_column_double=(a,b)=>(e._sqlite3_column_double=Z.ma)(a,b);e._sqlite3_bind_blob=(a,b,c,d,f)=>(e._sqlite3_bind_blob=Z.na)(a,b,c,d,f);e._sqlite3_bind_double=(a,b,c)=>(e._sqlite3_bind_double=Z.oa)(a,b,c);e._sqlite3_bind_int=(a,b,c)=>(e._sqlite3_bind_int=Z.pa)(a,b,c);e._sqlite3_bind_text=(a,b,c,d,f)=>(e._sqlite3_bind_text=Z.qa)(a,b,c,d,f);
e._sqlite3_bind_parameter_index=(a,b)=>(e._sqlite3_bind_parameter_index=Z.ra)(a,b);e._sqlite3_sql=a=>(e._sqlite3_sql=Z.sa)(a);e._sqlite3_normalized_sql=a=>(e._sqlite3_normalized_sql=Z.ta)(a);e._sqlite3_changes=a=>(e._sqlite3_changes=Z.ua)(a);e._sqlite3_close_v2=a=>(e._sqlite3_close_v2=Z.va)(a);e._sqlite3_create_function_v2=(a,b,c,d,f,k,l,m,u)=>(e._sqlite3_create_function_v2=Z.wa)(a,b,c,d,f,k,l,m,u);e._sqlite3_open=(a,b)=>(e._sqlite3_open=Z.xa)(a,b);
var la=e._malloc=a=>(la=e._malloc=Z.ya)(a),ja=e._free=a=>(ja=e._free=Z.za)(a);e._RegisterExtensionFunctions=a=>(e._RegisterExtensionFunctions=Z.Aa)(a);var yb=(a,b)=>(yb=Z.Ba)(a,b),ra=a=>(ra=Z.Ca)(a),ma=a=>(ma=Z.Da)(a),oa=()=>(oa=Z.Ea)();e.addRunDependency=Sa;e.removeRunDependency=Va;e.stackSave=()=>oa();e.stackRestore=a=>ra(a);e.stackAlloc=a=>ma(a);e.cwrap=(a,b,c,d)=>{var f=!c||c.every(k=>"number"===k||"boolean"===k);return"string"!==b&&f&&!d?e["_"+a]:(...k)=>yc(a,b,c,k)};e.addFunction=ua;
e.removeFunction=ta;e.UTF8ToString=qa;e.FS_createPreloadedFile=Eb;e.FS_unlink=a=>x.unlink(a);e.FS_createPath=Cc;e.FS_createDevice=Ec;e.FS=x;e.FS_createDataFile=(a,b,c,d,f,k)=>{x.kb(a,b,c,d,f,k)};e.FS_createLazyFile=Dc;e.ALLOC_NORMAL=fa;e.allocate=ea;e.allocateUTF8OnStack=sa;var Gc;Ra=function Hc(){Gc||Ic();Gc||(Ra=Hc)};
function Ic(){function a(){if(!Gc&&(Gc=!0,e.calledRun=!0,!Ga)){e.noFSInit||x.ib.ub||x.ib();x.Pb=!1;db(Ma);e.onRuntimeInitialized?.();if(e.postRun)for("function"==typeof e.postRun&&(e.postRun=[e.postRun]);e.postRun.length;){var b=e.postRun.shift();Na.unshift(b)}db(Na)}}if(!(0<Pa)){if(e.preRun)for("function"==typeof e.preRun&&(e.preRun=[e.preRun]);e.preRun.length;)Oa();db(La);0<Pa||(e.setStatus?(e.setStatus("Running..."),setTimeout(function(){setTimeout(function(){e.setStatus("")},1);a()},1)):a())}}
if(e.preInit)for("function"==typeof e.preInit&&(e.preInit=[e.preInit]);0<e.preInit.length;)e.preInit.pop()();Ic();


        // The shell-pre.js and emcc-generated code goes above
        return Module;
    }); // The end of the promise being returned

  return initSqlJsPromise;
} // The end of our initSqlJs function

// This bit below is copied almost exactly from what you get when you use the MODULARIZE=1 flag with emcc
// However, we don't want to use the emcc modularization. See shell-pre.js
if (typeof exports === 'object' && typeof module === 'object'){
    module.exports = initSqlJs;
    // This will allow the module to be used in ES6 or CommonJS
    module.exports.default = initSqlJs;
}
else if (typeof define === 'function' && define['amd']) {
    define([], function() { return initSqlJs; });
}
else if (typeof exports === 'object'){
    exports["Module"] = initSqlJs;
}


/***/ }),

/***/ 720:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";
module.exports = __webpack_require__.p + "sql-wasm.wasm";

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/publicPath */
/******/ 	(() => {
/******/ 		__webpack_require__.p = "";
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__(630);
/******/ 	
/******/ 	return __webpack_exports__;
/******/ })()
;
});
//# sourceMappingURL=sqlite.worker.js.map