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
function createLazyFile(sql, parent, name, canRead, canWrite, lazyFileConfig) {
    var lazyArray = new LazyUint8Array(lazyFileConfig);
    var properties = { isDevice: false, contents: lazyArray };
    var node = sql.FS_createFile(parent, name, properties, canRead, canWrite);
    node.contents = lazyArray;
    node.stream_ops = {};
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
            sql.FS_forceLoadFile(node);
            return fn.apply(null, arguments);
        };
    });
    // use a custom read function
    stream_ops.read = function stream_ops_read(stream, buffer, offset, length, position) {
        sql.FS_forceLoadFile(node);
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
            console.log("log sql");
            console.log(sql);
            const lazyFile = lazyFile_1.createLazyFile(sql, "/", filename, true, true, {
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
        debugger;
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
var e;e||=typeof Module != 'undefined' ? Module : {};var aa="object"==typeof window,ea="function"==typeof importScripts,fa="object"==typeof process&&"object"==typeof process.versions&&"string"==typeof process.versions.node;"use strict";
e.onRuntimeInitialized=function(){function a(h){var m=cc(h);h=dc(h);for(var q=new Uint8Array(m),x=0;x<m;x+=1)q[x]=g[h+x];return q}function b(h,m){this.Oa=h;this.db=m;this.Ma=1;this.sb=[]}function c(h,m){this.db=m;m=ha(h)+1;this.ib=ja(m);if(null===this.ib)throw Error("Unable to allocate memory for the SQL string");r(h,v,this.ib,m);this.ob=this.ib;this.fb=this.Bb=null}function d(h){this.filename="dbfile_"+(4294967295*Math.random()>>>0);null!=h&&w.tb("/",this.filename,h,!0,!0);h=n(this.filename,k);this.db=
z(k,"i32");this.handleError(h);Xa(this.db);this.jb={};this.Ra={}}function f(h){this.filename=h;h=n(this.filename,k);this.db=z(k,"i32");this.handleError(h);Xa(this.db);this.jb={};this.Ra={}}var k=ka(4),l=e.cwrap,n=l("sqlite3_open","number",["string","number"]);l("sqlite3_open_v2","number",["string","number","number","string"]);var t=l("sqlite3_close_v2","number",["number"]),u=l("sqlite3_exec","number",["number","string","number","number","number"]),p=l("sqlite3_changes","number",["number"]),y=l("sqlite3_prepare_v2",
"number",["number","string","number","number","number"]),J=l("sqlite3_sql","string",["number"]),L=l("sqlite3_normalized_sql","string",["number"]),K=l("sqlite3_prepare_v2","number",["number","number","number","number","number"]),M=l("sqlite3_bind_text","number",["number","number","number","number","number"]),W=l("sqlite3_bind_blob","number",["number","number","number","number","number"]),ia=l("sqlite3_bind_double","number",["number","number","number"]),ba=l("sqlite3_bind_int","number",["number","number",
"number"]),Ya=l("sqlite3_bind_parameter_index","number",["number","string"]),O=l("sqlite3_step","number",["number"]),ec=l("sqlite3_errmsg","string",["number"]),fc=l("sqlite3_column_count","number",["number"]),gc=l("sqlite3_data_count","number",["number"]),hc=l("sqlite3_column_double","number",["number","number"]),xb=l("sqlite3_column_text","string",["number","number"]),ic=l("sqlite3_column_blob","number",["number","number"]),jc=l("sqlite3_column_bytes","number",["number","number"]),kc=l("sqlite3_column_type",
"number",["number","number"]),lc=l("sqlite3_column_name","string",["number","number"]),mc=l("sqlite3_reset","number",["number"]),nc=l("sqlite3_clear_bindings","number",["number"]),oc=l("sqlite3_finalize","number",["number"]),pc=l("sqlite3_create_module_v2","number",["number","string","number","number","number"]),yb=l("sqlite3_create_function_v2","number","number string number number number number number number number".split(" ")),zb=l("sqlite3_value_type","number",["number"]),cc=l("sqlite3_value_bytes",
"number",["number"]),Ab=l("sqlite3_value_text","string",["number"]),dc=l("sqlite3_value_blob","number",["number"]),Bb=l("sqlite3_value_double","number",["number"]),Za=l("sqlite3_result_double","",["number","number"]),qa=l("sqlite3_result_null","",["number"]),$a=l("sqlite3_result_text","",["number","string","number","number"]),ab=l("sqlite3_result_blob","",["number","number","number","number"]),bb=l("sqlite3_result_int","",["number","number"]),ra=l("sqlite3_result_error","",["number","string","number"]),
Cb=l("sqlite3_aggregate_context","number",["number","number"]),qc=l("sqlite3_malloc","number",["number"]);e.sqlite3_malloc=qc;var Xa=l("RegisterExtensionFunctions","number",["number"]);b.prototype.bind=function(h){if(!this.Oa)throw"Statement closed";this.reset();return Array.isArray(h)?this.cc(h):null!=h&&"object"===typeof h?this.dc(h):!0};b.prototype.step=function(){if(!this.Oa)throw"Statement closed";this.Ma=1;var h=O(this.Oa);switch(h){case 100:return!0;case 101:return!1;default:throw this.db.handleError(h);
}};b.prototype.Qb=function(h){null==h&&(h=this.Ma,this.Ma+=1);return hc(this.Oa,h)};b.prototype.lc=function(h){null==h&&(h=this.Ma,this.Ma+=1);h=xb(this.Oa,h);if("function"!==typeof BigInt)throw Error("BigInt is not supported");return BigInt(h)};b.prototype.oc=function(h){null==h&&(h=this.Ma,this.Ma+=1);return xb(this.Oa,h)};b.prototype.getBlob=function(h){null==h&&(h=this.Ma,this.Ma+=1);var m=jc(this.Oa,h);h=ic(this.Oa,h);for(var q=new Uint8Array(m),x=0;x<m;x+=1)q[x]=g[h+x];return q};b.prototype.get=
function(h,m){m=m||{};null!=h&&this.bind(h)&&this.step();h=[];for(var q=gc(this.Oa),x=0;x<q;x+=1)switch(kc(this.Oa,x)){case 1:var C=m.useBigInt?this.lc(x):this.Qb(x);h.push(C);break;case 2:h.push(this.Qb(x));break;case 3:h.push(this.oc(x));break;case 4:h.push(this.getBlob(x));break;default:h.push(null)}return h};b.prototype.getColumnNames=function(){for(var h=[],m=fc(this.Oa),q=0;q<m;q+=1)h.push(lc(this.Oa,q));return h};b.prototype.getAsObject=function(h,m){h=this.get(h,m);m=this.getColumnNames();
for(var q={},x=0;x<m.length;x+=1)q[m[x]]=h[x];return q};b.prototype.getSQL=function(){return J(this.Oa)};b.prototype.getNormalizedSQL=function(){return L(this.Oa)};b.prototype.run=function(h){null!=h&&this.bind(h);this.step();return this.reset()};b.prototype.Kb=function(h,m){null==m&&(m=this.Ma,this.Ma+=1);h=la(h);var q=ma(h,na);this.sb.push(q);this.db.handleError(M(this.Oa,m,q,h.length-1,0))};b.prototype.bc=function(h,m){null==m&&(m=this.Ma,this.Ma+=1);var q=ma(h,na);this.sb.push(q);this.db.handleError(W(this.Oa,
m,q,h.length,0))};b.prototype.Jb=function(h,m){null==m&&(m=this.Ma,this.Ma+=1);this.db.handleError((h===(h|0)?ba:ia)(this.Oa,m,h))};b.prototype.ec=function(h){null==h&&(h=this.Ma,this.Ma+=1);W(this.Oa,h,0,0,0)};b.prototype.Lb=function(h,m){null==m&&(m=this.Ma,this.Ma+=1);switch(typeof h){case "string":this.Kb(h,m);return;case "number":this.Jb(h,m);return;case "bigint":this.Kb(h.toString(),m);return;case "boolean":this.Jb(h+0,m);return;case "object":if(null===h){this.ec(m);return}if(null!=h.length){this.bc(h,
m);return}}throw"Wrong API use : tried to bind a value of an unknown type ("+h+").";};b.prototype.dc=function(h){var m=this;Object.keys(h).forEach(function(q){var x=Ya(m.Oa,q);0!==x&&m.Lb(h[q],x)});return!0};b.prototype.cc=function(h){for(var m=0;m<h.length;m+=1)this.Lb(h[m],m+1);return!0};b.prototype.reset=function(){this.freemem();return 0===nc(this.Oa)&&0===mc(this.Oa)};b.prototype.freemem=function(){for(var h;void 0!==(h=this.sb.pop());)oa(h)};b.prototype.free=function(){this.freemem();var h=
0===oc(this.Oa);delete this.db.jb[this.Oa];this.Oa=0;return h};c.prototype.next=function(){if(null===this.ib)return{done:!0};null!==this.fb&&(this.fb.free(),this.fb=null);if(!this.db.db)throw this.ub(),Error("Database closed");var h=pa(),m=ka(4);sa(k,0,"i32");sa(m,0,"i32");try{this.db.handleError(K(this.db.db,this.ob,-1,k,m));this.ob=z(m,"i32");var q=z(k,"i32");if(0===q)return this.ub(),{done:!0};this.fb=new b(q,this.db);this.db.jb[q]=this.fb;return{value:this.fb,done:!1}}catch(x){throw this.Bb=ta(this.ob),
this.ub(),x;}finally{ua(h)}};c.prototype.ub=function(){oa(this.ib);this.ib=null};c.prototype.getRemainingSQL=function(){return null!==this.Bb?this.Bb:ta(this.ob)};"function"===typeof Symbol&&"symbol"===typeof Symbol.iterator&&(c.prototype[Symbol.iterator]=function(){return this});d.prototype.run=function(h,m){if(!this.db)throw"Database closed";if(m){h=this.prepare(h,m);try{h.step()}finally{h.free()}}else this.handleError(u(this.db,h,0,0,k));return this};d.prototype.exec=function(h,m,q){if(!this.db)throw"Database closed";
var x=pa(),C=null;try{var G=va(h),Q=ka(4);for(h=[];0!==z(G,"i8");){sa(k,0,"i32");sa(Q,0,"i32");this.handleError(K(this.db,G,-1,k,Q));var ca=z(k,"i32");G=z(Q,"i32");if(0!==ca){var D=null;C=new b(ca,this);for(null!=m&&C.bind(m);C.step();)null===D&&(D={columns:C.getColumnNames(),values:[]},h.push(D)),D.values.push(C.get(null,q));C.free()}}return h}catch(S){throw C&&C.free(),S;}finally{ua(x)}};d.prototype.each=function(h,m,q,x,C){"function"===typeof m&&(x=q,q=m,m=void 0);h=this.prepare(h,m);try{for(;h.step();)q(h.getAsObject(null,
C))}finally{h.free()}if("function"===typeof x)return x()};d.prototype.prepare=function(h,m){sa(k,0,"i32");this.handleError(y(this.db,h,-1,k,0));h=z(k,"i32");if(0===h)throw"Nothing to prepare";var q=new b(h,this);null!=m&&q.bind(m);return this.jb[h]=q};d.prototype.iterateStatements=function(h){return new c(h,this)};d.prototype["export"]=function(){Object.values(this.jb).forEach(function(m){m.free()});Object.values(this.Ra).forEach(wa);this.Ra={};this.handleError(t(this.db));var h=w.readFile(this.filename,
{encoding:"binary"});this.handleError(n(this.filename,k));this.db=z(k,"i32");Xa(this.db);return h};d.prototype.close=function(){null!==this.db&&(Object.values(this.jb).forEach(function(h){h.free()}),Object.values(this.Ra).forEach(wa),this.Ra={},this.handleError(t(this.db)),w.unlink("/"+this.filename),this.db=null)};d.prototype.handleError=function(h){if(0===h)return null;var m=ec(this.db);throw Error("SQLite: "+(m||"Code "+h));};d.prototype.getRowsModified=function(){return p(this.db)};e.extract_value=
function(h){h=z(h,"i32");var m=zb(h),q;1===m||2===m?q=Bb(h):3===m?q=Ab(h):4===m?q=a(h):q=null;return q};e.set_return_value=function(h,m){switch(typeof m){case "boolean":bb(h,m?1:0);break;case "number":Za(h,m);break;case "string":$a(h,m,-1,-1);break;case "object":if(null===m)qa(h);else if(null!=m.length){var q=ma(m,na);ab(h,q,m.length,-1);oa(q)}else ra(h,"Wrong API use : tried to return a value of an unknown type ("+m+").",-1);break;default:console.warn("unknown sqlite result type: ",typeof m,m),qa(h)}};
e.set_return_value=function(h,m){switch(typeof m){case "boolean":bb(h,m?1:0);break;case "number":Za(h,m);break;case "string":$a(h,m,-1,-1);break;case "object":if(null===m)qa(h);else if(null!=m.length){var q=ma(m,na);ab(h,q,m.length,-1);oa(q)}else ra(h,"Wrong API use : tried to return a value of an unknown type ("+m+").",-1);break;default:console.warn("unknown sqlite result type: ",typeof m,m),qa(h)}};d.prototype.create_function=function(h,m){Object.prototype.hasOwnProperty.call(this.Ra,h)&&(wa(this.Ra[h]),
delete this.Ra[h]);var q=xa(function(x,C,G){for(var Q,ca=[],D=0;D<C;D+=1)ca.push(e.Bc(G+4*D));try{Q=m.apply(null,ca)}catch(S){ra(x,"JS threw: "+S,-1);return}e.Mc(x,Q)},"viii");this.Ra[h]=q;this.handleError(yb(this.db,h,m.length,1,0,q,0,0,0));return this};d.prototype.create_aggregate=function(h,m){var q=m.init||function(){return null},x=m.finalize||function(D){return D},C=m.step;if(!C)throw"An aggregate function must have a step function in "+h;var G={};Object.hasOwnProperty.call(this.Ra,h)&&(wa(this.Ra[h]),
delete this.Ra[h]);m=h+"__finalize";Object.hasOwnProperty.call(this.Ra,m)&&(wa(this.Ra[m]),delete this.Ra[m]);var Q=xa(function(D,S,T){var da=Cb(D,1);Object.hasOwnProperty.call(G,da)||(G[da]=q());for(var Ja=[],fb=0;fb<S;fb+=1){var Ka=z(T+4*fb,"i32"),La=zb(Ka),Aa;1===La||2===La?Aa=Bb(Ka):3===La?Aa=Ab(Ka):4===La?Aa=a(Ka):Aa=null;Ja.push(Aa)}S=[G[da]].concat(Ja);try{G[da]=C.apply(null,S)}catch(rc){delete G[da],ra(D,rc,-1)}},"viii"),ca=xa(function(D){var S=Cb(D,1);try{var T=x(G[S])}catch(Ja){delete G[S];
ra(D,Ja,-1);return}switch(typeof T){case "boolean":bb(D,T?1:0);break;case "number":Za(D,T);break;case "string":$a(D,T,-1,-1);break;case "object":if(null===T)qa(D);else if(null!=T.length){var da=ma(T,na);ab(D,da,T.length,-1);oa(da)}else ra(D,"Wrong API use : tried to return a value of an unknown type ("+T+").",-1);break;default:qa(D)}delete G[S]},"vi");this.Ra[h]=Q;this.Ra[m]=ca;this.handleError(yb(this.db,h,C.length-1,1,0,0,Q,ca,0));return this};d.prototype.create_vtab=function(h){h=new h(e,this);
const m={Ec:null,Uc:"ptr",Tc:"ptr",Pc:"ptr",Wc:"ptr",Vc:"ptr",ad:"ptr",Qc:"ptr",Yc:"ptr",$c:"ptr",Xc:"ptr",Rc:"ptr",gd:"ptr",ld:"ptr",Oc:"ptr",kd:"ptr",Sc:"ptr",dd:"ptr",Zc:"ptr",cd:"ptr",hd:"ptr",bd:"ptr",ed:"ptr",jd:"ptr"},q=ja(4*Object.keys(m).length);let x=0;for(const Q in m){var C=h[Q]||0,G="i32";m[Q]&&h[Q]&&(G=h[Q].bind(h),C=Array(1+G.length).fill("i").join(""),C=xa(G,C),G="*");sa(q+4*x,C,G);x++}this.handleError(pc(this.db,h.name,q,0,0))};e.Database=d;f.prototype=Object.create(d.prototype);
e.FS=w;e.FS_createFile=w.Nb;e.FS_createDataFile=w.tb;e.FS_createNode=w.createNode;e.FS_forceLoadFile=w.nb;e.CustomDatabase=f};var ya=Object.assign({},e),za="./this.program",A="",Ba,Ca;
if(fa){var fs=require("fs"),Da=require("path");A=__dirname+"/";Ca=a=>{a=Ea(a)?new URL(a):Da.normalize(a);return fs.readFileSync(a)};Ba=a=>{a=Ea(a)?new URL(a):Da.normalize(a);return new Promise((b,c)=>{fs.readFile(a,void 0,(d,f)=>{d?c(d):b(f.buffer)})})};!e.thisProgram&&1<process.argv.length&&(za=process.argv[1].replace(/\\/g,"/"));process.argv.slice(2);"undefined"!=typeof module&&(module.exports=e)}else if(aa||ea)ea?A=self.location.href:"undefined"!=typeof document&&document.currentScript&&(A=document.currentScript.src),
A=A.startsWith("blob:")?"":A.substr(0,A.replace(/[?#].*/,"").lastIndexOf("/")+1),ea&&(Ca=a=>{var b=new XMLHttpRequest;b.open("GET",a,!1);b.responseType="arraybuffer";b.send(null);return new Uint8Array(b.response)}),Ba=a=>Ea(a)?new Promise((b,c)=>{var d=new XMLHttpRequest;d.open("GET",a,!0);d.responseType="arraybuffer";d.onload=()=>{(200==d.status||0==d.status&&d.response)&&c(d.response);b(d.status)};d.onerror=b;d.send(null)}):fetch(a,{credentials:"same-origin"}).then(b=>b.ok?b.arrayBuffer():Promise.reject(Error(b.status+
" : "+b.url)));var Fa=e.print||console.log.bind(console),Ga=e.printErr||console.error.bind(console);Object.assign(e,ya);ya=null;e.thisProgram&&(za=e.thisProgram);var Ha;e.wasmBinary&&(Ha=e.wasmBinary);var Ia,Ma=!1,g,v,Na,B,E,Oa,Pa;
function Qa(){var a=Ia.buffer;e.HEAP8=g=new Int8Array(a);e.HEAP16=Na=new Int16Array(a);e.HEAPU8=v=new Uint8Array(a);e.HEAPU16=new Uint16Array(a);e.HEAP32=B=new Int32Array(a);e.HEAPU32=E=new Uint32Array(a);e.HEAPF32=Oa=new Float32Array(a);e.HEAPF64=Pa=new Float64Array(a)}var Ra=[],Sa=[],Ta=[];function Ua(){var a=e.preRun.shift();Ra.unshift(a)}var Va=0,Wa=null,cb=null;function db(){Va++;e.monitorRunDependencies?.(Va)}
function eb(){Va--;e.monitorRunDependencies?.(Va);if(0==Va&&(null!==Wa&&(clearInterval(Wa),Wa=null),cb)){var a=cb;cb=null;a()}}function gb(a){e.onAbort?.(a);a="Aborted("+a+")";Ga(a);Ma=!0;throw new WebAssembly.RuntimeError(a+". Build with -sASSERTIONS for more info.");}var hb=a=>a.startsWith("data:application/octet-stream;base64,"),Ea=a=>a.startsWith("file://"),ib;function jb(a){if(a==ib&&Ha)return new Uint8Array(Ha);if(Ca)return Ca(a);throw"both async and sync fetching of the wasm failed";}
function kb(a){return Ha?Promise.resolve().then(()=>jb(a)):Ba(a).then(b=>new Uint8Array(b),()=>jb(a))}function lb(a,b,c){return kb(a).then(d=>WebAssembly.instantiate(d,b)).then(c,d=>{Ga(`failed to asynchronously prepare wasm: ${d}`);gb(d)})}
function mb(a,b){var c=ib;Ha||"function"!=typeof WebAssembly.instantiateStreaming||hb(c)||Ea(c)||fa||"function"!=typeof fetch?lb(c,a,b):fetch(c,{credentials:"same-origin"}).then(d=>WebAssembly.instantiateStreaming(d,a).then(b,function(f){Ga(`wasm streaming compile failed: ${f}`);Ga("falling back to ArrayBuffer instantiation");return lb(c,a,b)}))}var F,H,nb=a=>{for(;0<a.length;)a.shift()(e)};
function z(a,b="i8"){b.endsWith("*")&&(b="*");switch(b){case "i1":return g[a];case "i8":return g[a];case "i16":return Na[a>>1];case "i32":return B[a>>2];case "i64":gb("to do getValue(i64) use WASM_BIGINT");case "float":return Oa[a>>2];case "double":return Pa[a>>3];case "*":return E[a>>2];default:gb(`invalid type for getValue: ${b}`)}}
function sa(a,b,c="i8"){c.endsWith("*")&&(c="*");switch(c){case "i1":g[a]=b;break;case "i8":g[a]=b;break;case "i16":Na[a>>1]=b;break;case "i32":B[a>>2]=b;break;case "i64":gb("to do setValue(i64) use WASM_BIGINT");case "float":Oa[a>>2]=b;break;case "double":Pa[a>>3]=b;break;case "*":E[a>>2]=b;break;default:gb(`invalid type for setValue: ${c}`)}}
var ob="undefined"!=typeof TextDecoder?new TextDecoder:void 0,I=(a,b,c)=>{var d=b+c;for(c=b;a[c]&&!(c>=d);)++c;if(16<c-b&&a.buffer&&ob)return ob.decode(a.subarray(b,c));for(d="";b<c;){var f=a[b++];if(f&128){var k=a[b++]&63;if(192==(f&224))d+=String.fromCharCode((f&31)<<6|k);else{var l=a[b++]&63;f=224==(f&240)?(f&15)<<12|k<<6|l:(f&7)<<18|k<<12|l<<6|a[b++]&63;65536>f?d+=String.fromCharCode(f):(f-=65536,d+=String.fromCharCode(55296|f>>10,56320|f&1023))}}else d+=String.fromCharCode(f)}return d},ta=(a,
b)=>a?I(v,a,b):"",pb=(a,b)=>{for(var c=0,d=a.length-1;0<=d;d--){var f=a[d];"."===f?a.splice(d,1):".."===f?(a.splice(d,1),c++):c&&(a.splice(d,1),c--)}if(b)for(;c;c--)a.unshift("..");return a},N=a=>{var b="/"===a.charAt(0),c="/"===a.substr(-1);(a=pb(a.split("/").filter(d=>!!d),!b).join("/"))||b||(a=".");a&&c&&(a+="/");return(b?"/":"")+a},qb=a=>{var b=/^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/.exec(a).slice(1);a=b[0];b=b[1];if(!a&&!b)return".";b&&=b.substr(0,b.length-1);return a+
b},rb=a=>{if("/"===a)return"/";a=N(a);a=a.replace(/\/$/,"");var b=a.lastIndexOf("/");return-1===b?a:a.substr(b+1)},sb=(a,b)=>N(a+"/"+b),tb=()=>{if("object"==typeof crypto&&"function"==typeof crypto.getRandomValues)return c=>crypto.getRandomValues(c);if(fa)try{var a=require("crypto");if(a.randomFillSync)return c=>a.randomFillSync(c);var b=a.randomBytes;return c=>(c.set(b(c.byteLength)),c)}catch(c){}gb("initRandomDevice")},ub=a=>(ub=tb())(a),vb=(...a)=>{for(var b="",c=!1,d=a.length-1;-1<=d&&!c;d--){c=
0<=d?a[d]:w.cwd();if("string"!=typeof c)throw new TypeError("Arguments to path.resolve must be strings");if(!c)return"";b=c+"/"+b;c="/"===c.charAt(0)}b=pb(b.split("/").filter(f=>!!f),!c).join("/");return(c?"/":"")+b||"."},wb=(a,b)=>{function c(l){for(var n=0;n<l.length&&""===l[n];n++);for(var t=l.length-1;0<=t&&""===l[t];t--);return n>t?[]:l.slice(n,t-n+1)}a=vb(a).substr(1);b=vb(b).substr(1);a=c(a.split("/"));b=c(b.split("/"));for(var d=Math.min(a.length,b.length),f=d,k=0;k<d;k++)if(a[k]!==b[k]){f=
k;break}d=[];for(k=f;k<a.length;k++)d.push("..");d=d.concat(b.slice(f));return d.join("/")},Db=[],ha=a=>{for(var b=0,c=0;c<a.length;++c){var d=a.charCodeAt(c);127>=d?b++:2047>=d?b+=2:55296<=d&&57343>=d?(b+=4,++c):b+=3}return b},r=(a,b,c,d)=>{if(!(0<d))return 0;var f=c;d=c+d-1;for(var k=0;k<a.length;++k){var l=a.charCodeAt(k);if(55296<=l&&57343>=l){var n=a.charCodeAt(++k);l=65536+((l&1023)<<10)|n&1023}if(127>=l){if(c>=d)break;b[c++]=l}else{if(2047>=l){if(c+1>=d)break;b[c++]=192|l>>6}else{if(65535>=
l){if(c+2>=d)break;b[c++]=224|l>>12}else{if(c+3>=d)break;b[c++]=240|l>>18;b[c++]=128|l>>12&63}b[c++]=128|l>>6&63}b[c++]=128|l&63}}b[c]=0;return c-f};function la(a,b){var c=Array(ha(a)+1);a=r(a,c,0,c.length);b&&(c.length=a);return c}var Eb=[];function Fb(a,b){Eb[a]={input:[],output:[],hb:b};Gb(a,Hb)}
var Hb={open(a){var b=Eb[a.node.rdev];if(!b)throw new w.Ia(43);a.tty=b;a.seekable=!1},close(a){a.tty.hb.fsync(a.tty)},fsync(a){a.tty.hb.fsync(a.tty)},read(a,b,c,d){if(!a.tty||!a.tty.hb.Rb)throw new w.Ia(60);for(var f=0,k=0;k<d;k++){try{var l=a.tty.hb.Rb(a.tty)}catch(n){throw new w.Ia(29);}if(void 0===l&&0===f)throw new w.Ia(6);if(null===l||void 0===l)break;f++;b[c+k]=l}f&&(a.node.timestamp=Date.now());return f},write(a,b,c,d){if(!a.tty||!a.tty.hb.Cb)throw new w.Ia(60);try{for(var f=0;f<d;f++)a.tty.hb.Cb(a.tty,
b[c+f])}catch(k){throw new w.Ia(29);}d&&(a.node.timestamp=Date.now());return f}},Ib={Rb(){a:{if(!Db.length){var a=null;if(fa){var b=Buffer.alloc(256),c=0,d=process.stdin.fd;try{c=fs.readSync(d,b,0,256)}catch(f){if(f.toString().includes("EOF"))c=0;else throw f;}0<c&&(a=b.slice(0,c).toString("utf-8"))}else"undefined"!=typeof window&&"function"==typeof window.prompt&&(a=window.prompt("Input: "),null!==a&&(a+="\n"));if(!a){a=null;break a}Db=la(a,!0)}a=Db.shift()}return a},Cb(a,b){null===b||10===b?(Fa(I(a.output,
0)),a.output=[]):0!=b&&a.output.push(b)},fsync(a){a.output&&0<a.output.length&&(Fa(I(a.output,0)),a.output=[])},Fc(){return{uc:25856,wc:5,tc:191,vc:35387,sc:[3,28,127,21,4,0,1,0,17,19,26,0,18,15,23,22,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]}},Gc(){return 0},Hc(){return[24,80]}},Jb={Cb(a,b){null===b||10===b?(Ga(I(a.output,0)),a.output=[]):0!=b&&a.output.push(b)},fsync(a){a.output&&0<a.output.length&&(Ga(I(a.output,0)),a.output=[])}},Lb=a=>{a=65536*Math.ceil(a/65536);var b=Kb(65536,a);b?(v.fill(0,b,b+a),a=
b):a=0;return a};function Mb(a,b){var c=a.La?a.La.length:0;c>=b||(b=Math.max(b,c*(1048576>c?2:1.125)>>>0),0!=c&&(b=Math.max(b,256)),c=a.La,a.La=new Uint8Array(b),0<a.Pa&&a.La.set(c.subarray(0,a.Pa),0))}
var P={Ya:null,Qa(){return P.createNode(null,"/",16895,0)},createNode(a,b,c,d){if(24576===(c&61440)||w.isFIFO(c))throw new w.Ia(63);P.Ya||(P.Ya={dir:{node:{Va:P.Ja.Va,Sa:P.Ja.Sa,lookup:P.Ja.lookup,$a:P.Ja.$a,rename:P.Ja.rename,unlink:P.Ja.unlink,rmdir:P.Ja.rmdir,readdir:P.Ja.readdir,symlink:P.Ja.symlink},stream:{Wa:P.Ka.Wa}},file:{node:{Va:P.Ja.Va,Sa:P.Ja.Sa},stream:{Wa:P.Ka.Wa,read:P.Ka.read,write:P.Ka.write,kb:P.Ka.kb,cb:P.Ka.cb,gb:P.Ka.gb}},link:{node:{Va:P.Ja.Va,Sa:P.Ja.Sa,readlink:P.Ja.readlink},
stream:{}},Mb:{node:{Va:P.Ja.Va,Sa:P.Ja.Sa},stream:w.ic}});c=w.createNode(a,b,c,d);R(c.mode)?(c.Ja=P.Ya.dir.node,c.Ka=P.Ya.dir.stream,c.La={}):w.isFile(c.mode)?(c.Ja=P.Ya.file.node,c.Ka=P.Ya.file.stream,c.Pa=0,c.La=null):40960===(c.mode&61440)?(c.Ja=P.Ya.link.node,c.Ka=P.Ya.link.stream):8192===(c.mode&61440)&&(c.Ja=P.Ya.Mb.node,c.Ka=P.Ya.Mb.stream);c.timestamp=Date.now();a&&(a.La[b]=c,a.timestamp=c.timestamp);return c},Dc(a){return a.La?a.La.subarray?a.La.subarray(0,a.Pa):new Uint8Array(a.La):new Uint8Array(0)},
Ja:{Va(a){var b={};b.dev=8192===(a.mode&61440)?a.id:1;b.ino=a.id;b.mode=a.mode;b.nlink=1;b.uid=0;b.gid=0;b.rdev=a.rdev;R(a.mode)?b.size=4096:w.isFile(a.mode)?b.size=a.Pa:40960===(a.mode&61440)?b.size=a.link.length:b.size=0;b.atime=new Date(a.timestamp);b.mtime=new Date(a.timestamp);b.ctime=new Date(a.timestamp);b.fc=4096;b.blocks=Math.ceil(b.size/b.fc);return b},Sa(a,b){void 0!==b.mode&&(a.mode=b.mode);void 0!==b.timestamp&&(a.timestamp=b.timestamp);if(void 0!==b.size&&(b=b.size,a.Pa!=b))if(0==b)a.La=
null,a.Pa=0;else{var c=a.La;a.La=new Uint8Array(b);c&&a.La.set(c.subarray(0,Math.min(b,a.Pa)));a.Pa=b}},lookup(){throw w.wb[44];},$a(a,b,c,d){return P.createNode(a,b,c,d)},rename(a,b,c){if(R(a.mode)){try{var d=U(b,c)}catch(k){}if(d)for(var f in d.La)throw new w.Ia(55);}delete a.parent.La[a.name];a.parent.timestamp=Date.now();a.name=c;b.La[c]=a;b.timestamp=a.parent.timestamp},unlink(a,b){delete a.La[b];a.timestamp=Date.now()},rmdir(a,b){var c=U(a,b),d;for(d in c.La)throw new w.Ia(55);delete a.La[b];
a.timestamp=Date.now()},readdir(a){var b=[".",".."],c;for(c of Object.keys(a.La))b.push(c);return b},symlink(a,b,c){a=P.createNode(a,b,41471,0);a.link=c;return a},readlink(a){if(40960!==(a.mode&61440))throw new w.Ia(28);return a.link}},Ka:{read(a,b,c,d,f){var k=a.node.La;if(f>=a.node.Pa)return 0;a=Math.min(a.node.Pa-f,d);if(8<a&&k.subarray)b.set(k.subarray(f,f+a),c);else for(d=0;d<a;d++)b[c+d]=k[f+d];return a},write(a,b,c,d,f,k){b.buffer===g.buffer&&(k=!1);if(!d)return 0;a=a.node;a.timestamp=Date.now();
if(b.subarray&&(!a.La||a.La.subarray)){if(k)return a.La=b.subarray(c,c+d),a.Pa=d;if(0===a.Pa&&0===f)return a.La=b.slice(c,c+d),a.Pa=d;if(f+d<=a.Pa)return a.La.set(b.subarray(c,c+d),f),d}Mb(a,f+d);if(a.La.subarray&&b.subarray)a.La.set(b.subarray(c,c+d),f);else for(k=0;k<d;k++)a.La[f+k]=b[c+k];a.Pa=Math.max(a.Pa,f+d);return d},Wa(a,b,c){1===c?b+=a.position:2===c&&w.isFile(a.node.mode)&&(b+=a.node.Pa);if(0>b)throw new w.Ia(28);return b},kb(a,b,c){Mb(a.node,b+c);a.node.Pa=Math.max(a.node.Pa,b+c)},cb(a,
b,c,d,f){if(!w.isFile(a.node.mode))throw new w.Ia(43);a=a.node.La;if(f&2||a.buffer!==g.buffer){if(0<c||c+b<a.length)a.subarray?a=a.subarray(c,c+b):a=Array.prototype.slice.call(a,c,c+b);c=!0;b=Lb(b);if(!b)throw new w.Ia(48);g.set(a,b)}else c=!1,b=a.byteOffset;return{Wb:b,Ib:c}},gb(a,b,c,d){P.Ka.write(a,b,0,d,c,!1);return 0}}},Nb=(a,b,c)=>{var d=`al ${a}`;Ba(a).then(f=>{b(new Uint8Array(f));d&&eb()},()=>{if(c)c();else throw`Loading data file "${a}" failed.`;});d&&db()},Ob=e.preloadPlugins||[],Pb=(a,
b,c,d)=>{"undefined"!=typeof Browser&&Browser.lb();var f=!1;Ob.forEach(k=>{!f&&k.canHandle(b)&&(k.handle(a,b,c,d),f=!0)});return f},Qb=(a,b)=>{var c=0;a&&(c|=365);b&&(c|=146);return c};function Gb(a,b){w.Pb[a]={Ka:b}}function R(a){return 16384===(a&61440)}function U(a,b){var c=R(a.mode)?(c=Rb(a,"x"))?c:a.Ja.lookup?0:2:54;if(c)throw new w.Ia(c);for(c=w.Xa[Sb(a.id,b)];c;c=c.eb){var d=c.name;if(c.parent.id===a.id&&d===b)return c}return w.lookup(a,b)}
function V(a,b={}){a=vb(a);if(!a)return{path:"",node:null};b=Object.assign({vb:!0,Eb:0},b);if(8<b.Eb)throw new w.Ia(32);a=a.split("/").filter(l=>!!l);for(var c=w.root,d="/",f=0;f<a.length;f++){var k=f===a.length-1;if(k&&b.parent)break;c=U(c,a[f]);d=N(d+"/"+a[f]);c.Ua&&(!k||k&&b.vb)&&(c=c.Ua.root);if(!k||b.Ta)for(k=0;40960===(c.mode&61440);)if(c=w.readlink(d),d=vb(qb(d),c),c=V(d,{Eb:b.Eb+1}).node,40<k++)throw new w.Ia(32);}return{path:d,node:c}}
function Tb(a){for(var b;;){if(w.Ub(a))return a=a.Qa.Vb,b?"/"!==a[a.length-1]?`${a}/${b}`:a+b:a;b=b?`${a.name}/${b}`:a.name;a=a.parent}}function Sb(a,b){for(var c=0,d=0;d<b.length;d++)c=(c<<5)-c+b.charCodeAt(d)|0;return(a+c>>>0)%w.Xa.length}function Ub(a){var b=Sb(a.parent.id,a.name);a.eb=w.Xa[b];w.Xa[b]=a}function Vb(a){var b=Sb(a.parent.id,a.name);if(w.Xa[b]===a)w.Xa[b]=a.eb;else for(b=w.Xa[b];b;){if(b.eb===a){b.eb=a.eb;break}b=b.eb}}
function Wb(a){var b=["r","w","rw"][a&3];a&512&&(b+="w");return b}function Rb(a,b){if(w.Sb)return 0;if(!b.includes("r")||a.mode&292){if(b.includes("w")&&!(a.mode&146)||b.includes("x")&&!(a.mode&73))return 2}else return 2;return 0}function Xb(a,b){try{return U(a,b),20}catch(c){}return Rb(a,"wx")}function Yb(a,b,c){try{var d=U(a,b)}catch(f){return f.Na}if(a=Rb(a,"wx"))return a;if(c){if(!R(d.mode))return 54;if(w.Ub(d)||Tb(d)===w.cwd())return 10}else if(R(d.mode))return 31;return 0}
function X(a){a=w.nc(a);if(!a)throw new w.Ia(8);return a}function Zb(a,b=-1){a=Object.assign(new w.Zb,a);if(-1==b)a:{for(b=0;b<=w.$b;b++)if(!w.streams[b])break a;throw new w.Ia(33);}a.fd=b;return w.streams[b]=a}function $b(a,b=-1){a=Zb(a,b);a.Ka?.Ac?.(a);return a}function ac(a){var b=[];for(a=[a];a.length;){var c=a.pop();b.push(c);a.push(...c.mb)}return b}function bc(a,b,c){"undefined"==typeof c&&(c=b,b=438);return w.$a(a,b|8192,c)}
var w={root:null,mb:[],Pb:{},streams:[],qc:1,Xa:null,Ob:"/",yb:!1,Sb:!0,Ia:class{constructor(a){this.name="ErrnoError";this.Na=a}},wb:{},kc:null,pb:0,Zb:class{constructor(){this.Za={};this.node=null}get object(){return this.node}set object(a){this.node=a}get flags(){return this.Za.flags}set flags(a){this.Za.flags=a}get position(){return this.Za.position}set position(a){this.Za.position=a}},Yb:class{constructor(a,b,c,d){a||=this;this.parent=a;this.Qa=a.Qa;this.Ua=null;this.id=w.qc++;this.name=b;this.mode=
c;this.Ja={};this.Ka={};this.rdev=d}get read(){return 365===(this.mode&365)}set read(a){a?this.mode|=365:this.mode&=-366}get write(){return 146===(this.mode&146)}set write(a){a?this.mode|=146:this.mode&=-147}get pc(){return R(this.mode)}get zb(){return 8192===(this.mode&61440)}},createNode(a,b,c,d){a=new w.Yb(a,b,c,d);Ub(a);return a},Ub(a){return a===a.parent},isFile(a){return 32768===(a&61440)},isFIFO(a){return 4096===(a&61440)},isSocket(a){return 49152===(a&49152)},$b:4096,nc:a=>w.streams[a],ic:{open(a){a.Ka=
w.mc(a.node.rdev).Ka;a.Ka.open?.(a)},Wa(){throw new w.Ia(70);}},Ab:a=>a>>8,Ic:a=>a&255,bb:(a,b)=>a<<8|b,mc:a=>w.Pb[a],Xb(a,b){function c(l){w.pb--;return b(l)}function d(l){if(l){if(!d.jc)return d.jc=!0,c(l)}else++k>=f.length&&c(null)}"function"==typeof a&&(b=a,a=!1);w.pb++;1<w.pb&&Ga(`warning: ${w.pb} FS.syncfs operations in flight at once, probably just doing extra work`);var f=ac(w.root.Qa),k=0;f.forEach(l=>{if(!l.type.Xb)return d(null);l.type.Xb(l,a,d)})},Qa(a,b,c){var d="/"===c;if(d&&w.root)throw new w.Ia(10);
if(!d&&c){var f=V(c,{vb:!1});c=f.path;f=f.node;if(f.Ua)throw new w.Ia(10);if(!R(f.mode))throw new w.Ia(54);}b={type:a,Kc:b,Vb:c,mb:[]};a=a.Qa(b);a.Qa=b;b.root=a;d?w.root=a:f&&(f.Ua=b,f.Qa&&f.Qa.mb.push(b));return a},Nc(a){a=V(a,{vb:!1});if(!a.node.Ua)throw new w.Ia(28);a=a.node;var b=a.Ua,c=ac(b);Object.keys(w.Xa).forEach(d=>{for(d=w.Xa[d];d;){var f=d.eb;c.includes(d.Qa)&&Vb(d);d=f}});a.Ua=null;a.Qa.mb.splice(a.Qa.mb.indexOf(b),1)},lookup(a,b){return a.Ja.lookup(a,b)},$a(a,b,c){var d=V(a,{parent:!0}).node;
a=rb(a);if(!a||"."===a||".."===a)throw new w.Ia(28);var f=Xb(d,a);if(f)throw new w.Ia(f);if(!d.Ja.$a)throw new w.Ia(63);return d.Ja.$a(d,a,b,c)},create(a,b){return w.$a(a,(void 0!==b?b:438)&4095|32768,0)},mkdir(a,b){return w.$a(a,(void 0!==b?b:511)&1023|16384,0)},Jc(a,b){a=a.split("/");for(var c="",d=0;d<a.length;++d)if(a[d]){c+="/"+a[d];try{w.mkdir(c,b)}catch(f){if(20!=f.Na)throw f;}}},symlink(a,b){if(!vb(a))throw new w.Ia(44);var c=V(b,{parent:!0}).node;if(!c)throw new w.Ia(44);b=rb(b);var d=Xb(c,
b);if(d)throw new w.Ia(d);if(!c.Ja.symlink)throw new w.Ia(63);return c.Ja.symlink(c,b,a)},rename(a,b){var c=qb(a),d=qb(b),f=rb(a),k=rb(b);var l=V(a,{parent:!0});var n=l.node;l=V(b,{parent:!0});l=l.node;if(!n||!l)throw new w.Ia(44);if(n.Qa!==l.Qa)throw new w.Ia(75);var t=U(n,f);a=wb(a,d);if("."!==a.charAt(0))throw new w.Ia(28);a=wb(b,c);if("."!==a.charAt(0))throw new w.Ia(55);try{var u=U(l,k)}catch(p){}if(t!==u){b=R(t.mode);if(f=Yb(n,f,b))throw new w.Ia(f);if(f=u?Yb(l,k,b):Xb(l,k))throw new w.Ia(f);
if(!n.Ja.rename)throw new w.Ia(63);if(t.Ua||u&&u.Ua)throw new w.Ia(10);if(l!==n&&(f=Rb(n,"w")))throw new w.Ia(f);Vb(t);try{n.Ja.rename(t,l,k),t.parent=l}catch(p){throw p;}finally{Ub(t)}}},rmdir(a){var b=V(a,{parent:!0}).node;a=rb(a);var c=U(b,a),d=Yb(b,a,!0);if(d)throw new w.Ia(d);if(!b.Ja.rmdir)throw new w.Ia(63);if(c.Ua)throw new w.Ia(10);b.Ja.rmdir(b,a);Vb(c)},readdir(a){a=V(a,{Ta:!0}).node;if(!a.Ja.readdir)throw new w.Ia(54);return a.Ja.readdir(a)},unlink(a){var b=V(a,{parent:!0}).node;if(!b)throw new w.Ia(44);
a=rb(a);var c=U(b,a),d=Yb(b,a,!1);if(d)throw new w.Ia(d);if(!b.Ja.unlink)throw new w.Ia(63);if(c.Ua)throw new w.Ia(10);b.Ja.unlink(b,a);Vb(c)},readlink(a){a=V(a).node;if(!a)throw new w.Ia(44);if(!a.Ja.readlink)throw new w.Ia(28);return vb(Tb(a.parent),a.Ja.readlink(a))},stat(a,b){a=V(a,{Ta:!b}).node;if(!a)throw new w.Ia(44);if(!a.Ja.Va)throw new w.Ia(63);return a.Ja.Va(a)},lstat(a){return w.stat(a,!0)},chmod(a,b,c){a="string"==typeof a?V(a,{Ta:!c}).node:a;if(!a.Ja.Sa)throw new w.Ia(63);a.Ja.Sa(a,
{mode:b&4095|a.mode&-4096,timestamp:Date.now()})},lchmod(a,b){w.chmod(a,b,!0)},fchmod(a,b){a=X(a);w.chmod(a.node,b)},chown(a,b,c,d){a="string"==typeof a?V(a,{Ta:!d}).node:a;if(!a.Ja.Sa)throw new w.Ia(63);a.Ja.Sa(a,{timestamp:Date.now()})},lchown(a,b,c){w.chown(a,b,c,!0)},fchown(a,b,c){a=X(a);w.chown(a.node,b,c)},truncate(a,b){if(0>b)throw new w.Ia(28);a="string"==typeof a?V(a,{Ta:!0}).node:a;if(!a.Ja.Sa)throw new w.Ia(63);if(R(a.mode))throw new w.Ia(31);if(!w.isFile(a.mode))throw new w.Ia(28);var c=
Rb(a,"w");if(c)throw new w.Ia(c);a.Ja.Sa(a,{size:b,timestamp:Date.now()})},open(a,b,c){if(""===a)throw new w.Ia(44);if("string"==typeof b){var d={r:0,"r+":2,w:577,"w+":578,a:1089,"a+":1090}[b];if("undefined"==typeof d)throw Error(`Unknown file open mode: ${b}`);b=d}c=b&64?("undefined"==typeof c?438:c)&4095|32768:0;if("object"==typeof a)var f=a;else{a=N(a);try{f=V(a,{Ta:!(b&131072)}).node}catch(k){}}d=!1;if(b&64)if(f){if(b&128)throw new w.Ia(20);}else f=w.$a(a,c,0),d=!0;if(!f)throw new w.Ia(44);8192===
(f.mode&61440)&&(b&=-513);if(b&65536&&!R(f.mode))throw new w.Ia(54);if(!d&&(c=f?40960===(f.mode&61440)?32:R(f.mode)&&("r"!==Wb(b)||b&512)?31:Rb(f,Wb(b)):44))throw new w.Ia(c);b&512&&!d&&w.truncate(f,0);b&=-131713;f=Zb({node:f,path:Tb(f),flags:b,seekable:!0,position:0,Ka:f.Ka,rc:[],error:!1});f.Ka.open&&f.Ka.open(f);!e.logReadFiles||b&1||(w.Db||(w.Db={}),a in w.Db||(w.Db[a]=1));return f},close(a){if(null===a.fd)throw new w.Ia(8);a.xb&&(a.xb=null);try{a.Ka.close&&a.Ka.close(a)}catch(b){throw b;}finally{w.streams[a.fd]=
null}a.fd=null},Wa(a,b,c){if(null===a.fd)throw new w.Ia(8);if(!a.seekable||!a.Ka.Wa)throw new w.Ia(70);if(0!=c&&1!=c&&2!=c)throw new w.Ia(28);a.position=a.Ka.Wa(a,b,c);a.rc=[];return a.position},read(a,b,c,d,f){if(0>d||0>f)throw new w.Ia(28);if(null===a.fd)throw new w.Ia(8);if(1===(a.flags&2097155))throw new w.Ia(8);if(R(a.node.mode))throw new w.Ia(31);if(!a.Ka.read)throw new w.Ia(28);var k="undefined"!=typeof f;if(!k)f=a.position;else if(!a.seekable)throw new w.Ia(70);b=a.Ka.read(a,b,c,d,f);k||(a.position+=
b);return b},write(a,b,c,d,f,k){if(0>d||0>f)throw new w.Ia(28);if(null===a.fd)throw new w.Ia(8);if(0===(a.flags&2097155))throw new w.Ia(8);if(R(a.node.mode))throw new w.Ia(31);if(!a.Ka.write)throw new w.Ia(28);a.seekable&&a.flags&1024&&w.Wa(a,0,2);var l="undefined"!=typeof f;if(!l)f=a.position;else if(!a.seekable)throw new w.Ia(70);b=a.Ka.write(a,b,c,d,f,k);l||(a.position+=b);return b},kb(a,b,c){if(null===a.fd)throw new w.Ia(8);if(0>b||0>=c)throw new w.Ia(28);if(0===(a.flags&2097155))throw new w.Ia(8);
if(!w.isFile(a.node.mode)&&!R(a.node.mode))throw new w.Ia(43);if(!a.Ka.kb)throw new w.Ia(138);a.Ka.kb(a,b,c)},cb(a,b,c,d,f){if(0!==(d&2)&&0===(f&2)&&2!==(a.flags&2097155))throw new w.Ia(2);if(1===(a.flags&2097155))throw new w.Ia(2);if(!a.Ka.cb)throw new w.Ia(43);return a.Ka.cb(a,b,c,d,f)},gb(a,b,c,d,f){return a.Ka.gb?a.Ka.gb(a,b,c,d,f):0},Tb(a,b,c){if(!a.Ka.Tb)throw new w.Ia(59);return a.Ka.Tb(a,b,c)},readFile(a,b={}){b.flags=b.flags||0;b.encoding=b.encoding||"binary";if("utf8"!==b.encoding&&"binary"!==
b.encoding)throw Error(`Invalid encoding type "${b.encoding}"`);var c,d=w.open(a,b.flags);a=w.stat(a).size;var f=new Uint8Array(a);w.read(d,f,0,a,0);"utf8"===b.encoding?c=I(f,0):"binary"===b.encoding&&(c=f);w.close(d);return c},writeFile(a,b,c={}){c.flags=c.flags||577;a=w.open(a,c.flags,c.mode);if("string"==typeof b){var d=new Uint8Array(ha(b)+1);b=r(b,d,0,d.length);w.write(a,d,0,b,void 0,c.hc)}else if(ArrayBuffer.isView(b))w.write(a,b,0,b.byteLength,void 0,c.hc);else throw Error("Unsupported data type");
w.close(a)},cwd:()=>w.Ob,chdir(a){a=V(a,{Ta:!0});if(null===a.node)throw new w.Ia(44);if(!R(a.node.mode))throw new w.Ia(54);var b=Rb(a.node,"x");if(b)throw new w.Ia(b);w.Ob=a.path},lb(a,b,c){w.lb.yb=!0;e.stdin=a||e.stdin;e.stdout=b||e.stdout;e.stderr=c||e.stderr;e.stdin?w.ab("/dev","stdin",e.stdin):w.symlink("/dev/tty","/dev/stdin");e.stdout?w.ab("/dev","stdout",null,e.stdout):w.symlink("/dev/tty","/dev/stdout");e.stderr?w.ab("/dev","stderr",null,e.stderr):w.symlink("/dev/tty1","/dev/stderr");w.open("/dev/stdin",
0);w.open("/dev/stdout",1);w.open("/dev/stderr",1)},Lc(){w.lb.yb=!1;for(var a=0;a<w.streams.length;a++){var b=w.streams[a];b&&w.close(b)}},Cc(a,b){try{var c=V(a,{Ta:!b});a=c.path}catch(k){}var d=!1,f=null;try{c=V(a,{parent:!0}),rb(a),c=V(a,{Ta:!b}),d=!0,f=c.node}catch(k){}return d?f:null},yc(a,b){a="string"==typeof a?a:Tb(a);for(b=b.split("/").reverse();b.length;){var c=b.pop();if(c){var d=N(a+"/"+c);try{w.mkdir(d)}catch(f){}a=d}}return d},Nb(a,b,c,d,f){a="string"==typeof a?a:Tb(a);b=N(a+"/"+b);return w.create(b,
Qb(d,f))},tb(a,b,c,d,f,k){var l=b;a&&(a="string"==typeof a?a:Tb(a),l=b?N(a+"/"+b):a);a=Qb(d,f);l=w.create(l,a);if(c){if("string"==typeof c){b=Array(c.length);d=0;for(f=c.length;d<f;++d)b[d]=c.charCodeAt(d);c=b}w.chmod(l,a|146);b=w.open(l,577);w.write(b,c,0,c.length,0,k);w.close(b);w.chmod(l,a)}},ab(a,b,c,d){a=sb("string"==typeof a?a:Tb(a),b);b=Qb(!!c,!!d);w.ab.Ab||(w.ab.Ab=64);var f=w.bb(w.ab.Ab++,0);Gb(f,{open(k){k.seekable=!1},close(){d?.buffer?.length&&d(10)},read(k,l,n,t){for(var u=0,p=0;p<t;p++){try{var y=
c()}catch(J){throw new w.Ia(29);}if(void 0===y&&0===u)throw new w.Ia(6);if(null===y||void 0===y)break;u++;l[n+p]=y}u&&(k.node.timestamp=Date.now());return u},write(k,l,n,t){for(var u=0;u<t;u++)try{d(l[n+u])}catch(p){throw new w.Ia(29);}t&&(k.node.timestamp=Date.now());return u}});return bc(a,b,f)},nb(a){if(a.zb||a.pc||a.link||a.La)return!0;if("undefined"!=typeof XMLHttpRequest)throw Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
try{a.La=Ca(a.url),a.Pa=a.La.length}catch(b){throw new w.Ia(29);}},xc(a,b,c,d,f){function k(p,y,J,L,K){p=p.node.La;if(K>=p.length)return 0;L=Math.min(p.length-K,L);if(p.slice)for(var M=0;M<L;M++)y[J+M]=p[K+M];else for(M=0;M<L;M++)y[J+M]=p.get(K+M);return L}class l{constructor(){this.rb=!1;this.Za=[];this.qb=void 0;this.Fb=this.Gb=0}get(p){if(!(p>this.length-1||0>p)){var y=p%this.chunkSize;return this.qb(p/this.chunkSize|0)[y]}}ac(p){this.qb=p}Hb(){var p=new XMLHttpRequest;p.open("HEAD",c,!1);p.send(null);
if(!(200<=p.status&&300>p.status||304===p.status))throw Error("Couldn't load "+c+". Status: "+p.status);var y=Number(p.getResponseHeader("Content-length")),J,L=(J=p.getResponseHeader("Accept-Ranges"))&&"bytes"===J;p=(J=p.getResponseHeader("Content-Encoding"))&&"gzip"===J;var K=1048576;L||(K=y);var M=this;M.ac(W=>{var ia=W*K,ba=(W+1)*K-1;ba=Math.min(ba,y-1);if("undefined"==typeof M.Za[W]){var Ya=M.Za;if(ia>ba)throw Error("invalid range ("+ia+", "+ba+") or no bytes requested!");if(ba>y-1)throw Error("only "+
y+" bytes available! programmer error!");var O=new XMLHttpRequest;O.open("GET",c,!1);y!==K&&O.setRequestHeader("Range","bytes="+ia+"-"+ba);O.responseType="arraybuffer";O.overrideMimeType&&O.overrideMimeType("text/plain; charset=x-user-defined");O.send(null);if(!(200<=O.status&&300>O.status||304===O.status))throw Error("Couldn't load "+c+". Status: "+O.status);ia=void 0!==O.response?new Uint8Array(O.response||[]):la(O.responseText||"",!0);Ya[W]=ia}if("undefined"==typeof M.Za[W])throw Error("doXHR failed!");
return M.Za[W]});if(p||!y)K=y=1,K=y=this.qb(0).length,Fa("LazyFiles on gzip forces download of the whole file when length is accessed");this.Gb=y;this.Fb=K;this.rb=!0}get length(){this.rb||this.Hb();return this.Gb}get chunkSize(){this.rb||this.Hb();return this.Fb}}if("undefined"!=typeof XMLHttpRequest){if(!ea)throw"Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";var n={zb:!1,La:new l}}else n={zb:!1,url:c};var t=w.Nb(a,b,n,d,f);n.La?
t.La=n.La:n.url&&(t.La=null,t.url=n.url);Object.defineProperties(t,{Pa:{get:function(){return this.La.length}}});var u={};Object.keys(t.Ka).forEach(p=>{var y=t.Ka[p];u[p]=(...J)=>{w.nb(t);return y(...J)}});u.read=(p,y,J,L,K)=>{w.nb(t);return k(p,y,J,L,K)};u.cb=(p,y,J)=>{w.nb(t);var L=Lb(y);if(!L)throw new w.Ia(48);k(p,g,L,y,J);return{Wb:L,Ib:!0}};t.Ka=u;return t}};
function sc(a,b,c){if("/"===b.charAt(0))return b;a=-100===a?w.cwd():X(a).path;if(0==b.length){if(!c)throw new w.Ia(44);return a}return N(a+"/"+b)}
function tc(a,b,c){a=a(b);B[c>>2]=a.dev;B[c+4>>2]=a.mode;E[c+8>>2]=a.nlink;B[c+12>>2]=a.uid;B[c+16>>2]=a.gid;B[c+20>>2]=a.rdev;H=[a.size>>>0,(F=a.size,1<=+Math.abs(F)?0<F?+Math.floor(F/4294967296)>>>0:~~+Math.ceil((F-+(~~F>>>0))/4294967296)>>>0:0)];B[c+24>>2]=H[0];B[c+28>>2]=H[1];B[c+32>>2]=4096;B[c+36>>2]=a.blocks;b=a.atime.getTime();var d=a.mtime.getTime(),f=a.ctime.getTime();H=[Math.floor(b/1E3)>>>0,(F=Math.floor(b/1E3),1<=+Math.abs(F)?0<F?+Math.floor(F/4294967296)>>>0:~~+Math.ceil((F-+(~~F>>>
0))/4294967296)>>>0:0)];B[c+40>>2]=H[0];B[c+44>>2]=H[1];E[c+48>>2]=b%1E3*1E3;H=[Math.floor(d/1E3)>>>0,(F=Math.floor(d/1E3),1<=+Math.abs(F)?0<F?+Math.floor(F/4294967296)>>>0:~~+Math.ceil((F-+(~~F>>>0))/4294967296)>>>0:0)];B[c+56>>2]=H[0];B[c+60>>2]=H[1];E[c+64>>2]=d%1E3*1E3;H=[Math.floor(f/1E3)>>>0,(F=Math.floor(f/1E3),1<=+Math.abs(F)?0<F?+Math.floor(F/4294967296)>>>0:~~+Math.ceil((F-+(~~F>>>0))/4294967296)>>>0:0)];B[c+72>>2]=H[0];B[c+76>>2]=H[1];E[c+80>>2]=f%1E3*1E3;H=[a.ino>>>0,(F=a.ino,1<=+Math.abs(F)?
0<F?+Math.floor(F/4294967296)>>>0:~~+Math.ceil((F-+(~~F>>>0))/4294967296)>>>0:0)];B[c+88>>2]=H[0];B[c+92>>2]=H[1];return 0}var uc=void 0;function vc(){var a=B[+uc>>2];uc+=4;return a}
var wc=(a,b)=>b+2097152>>>0<4194305-!!a?(a>>>0)+4294967296*b:NaN,xc=[0,31,60,91,121,152,182,213,244,274,305,335],yc=[0,31,59,90,120,151,181,212,243,273,304,334],zc={},Bc=()=>{if(!Ac){var a={USER:"web_user",LOGNAME:"web_user",PATH:"/",PWD:"/",HOME:"/home/web_user",LANG:("object"==typeof navigator&&navigator.languages&&navigator.languages[0]||"C").replace("-","_")+".UTF-8",_:za||"./this.program"},b;for(b in zc)void 0===zc[b]?delete a[b]:a[b]=zc[b];var c=[];for(b in a)c.push(`${b}=${a[b]}`);Ac=c}return Ac},
Ac,va=a=>{var b=ha(a)+1,c=ka(b);r(a,v,c,b);return c},Cc=(a,b,c,d)=>{var f={string:u=>{var p=0;null!==u&&void 0!==u&&0!==u&&(p=va(u));return p},array:u=>{var p=ka(u.length);g.set(u,p);return p}};a=e["_"+a];var k=[],l=0;if(d)for(var n=0;n<d.length;n++){var t=f[c[n]];t?(0===l&&(l=pa()),k[n]=t(d[n])):k[n]=d[n]}c=a(...k);return c=function(u){0!==l&&ua(l);return"string"===b?u?I(v,u):"":"boolean"===b?!!u:u}(c)},na=0,ma=(a,b)=>{b=1==b?ka(a.length):ja(a.length);a.subarray||a.slice||(a=new Uint8Array(a));v.set(a,
b);return b},Dc,Ec=[],Y,wa=a=>{Dc.delete(Y.get(a));Y.set(a,null);Ec.push(a)},xa=(a,b)=>{if(!Dc){Dc=new WeakMap;var c=Y.length;if(Dc)for(var d=0;d<0+c;d++){var f=Y.get(d);f&&Dc.set(f,d)}}if(c=Dc.get(a)||0)return c;if(Ec.length)c=Ec.pop();else{try{Y.grow(1)}catch(n){if(!(n instanceof RangeError))throw n;throw"Unable to grow wasm table. Set ALLOW_TABLE_GROWTH.";}c=Y.length-1}try{Y.set(c,a)}catch(n){if(!(n instanceof TypeError))throw n;if("function"==typeof WebAssembly.Function){d=WebAssembly.Function;
f={i:"i32",j:"i64",f:"f32",d:"f64",e:"externref",p:"i32"};for(var k={parameters:[],results:"v"==b[0]?[]:[f[b[0]]]},l=1;l<b.length;++l)k.parameters.push(f[b[l]]);b=new d(k,a)}else{d=[1];f=b.slice(0,1);b=b.slice(1);k={i:127,p:127,j:126,f:125,d:124,e:111};d.push(96);l=b.length;128>l?d.push(l):d.push(l%128|128,l>>7);for(l=0;l<b.length;++l)d.push(k[b[l]]);"v"==f?d.push(0):d.push(1,k[f]);b=[0,97,115,109,1,0,0,0,1];f=d.length;128>f?b.push(f):b.push(f%128|128,f>>7);b.push(...d);b.push(2,7,1,1,101,1,102,0,
0,7,5,1,1,102,0,0);b=new WebAssembly.Module(new Uint8Array(b));b=(new WebAssembly.Instance(b,{e:{f:a}})).exports.f}Y.set(c,b)}Dc.set(a,c);return c};w.zc=(a,b,c,d,f,k,l,n,t,u)=>{function p(J){function L(K){u?.();n||w.tb(a,b,K,d,f,t);k?.();eb()}Pb(J,y,L,()=>{l?.();eb()})||L(J)}var y=b?vb(N(a+"/"+b)):a;db();"string"==typeof c?Nb(c,p,l):p(c)};[44].forEach(a=>{w.wb[a]=new w.Ia(a);w.wb[a].stack="<generic error, no stack>"});w.Xa=Array(4096);w.Qa(P,{},"/");w.mkdir("/tmp");w.mkdir("/home");w.mkdir("/home/web_user");
(function(){w.mkdir("/dev");Gb(w.bb(1,3),{read:()=>0,write:(d,f,k,l)=>l});bc("/dev/null",w.bb(1,3));Fb(w.bb(5,0),Ib);Fb(w.bb(6,0),Jb);bc("/dev/tty",w.bb(5,0));bc("/dev/tty1",w.bb(6,0));var a=new Uint8Array(1024),b=0,c=()=>{0===b&&(b=ub(a).byteLength);return a[--b]};w.ab("/dev","random",c);w.ab("/dev","urandom",c);w.mkdir("/dev/shm");w.mkdir("/dev/shm/tmp")})();
(function(){w.mkdir("/proc");var a=w.mkdir("/proc/self");w.mkdir("/proc/self/fd");w.Qa({Qa(){var b=w.createNode(a,"fd",16895,73);b.Ja={lookup(c,d){var f=X(+d);c={parent:null,Qa:{Vb:"fake"},Ja:{readlink:()=>f.path}};return c.parent=c}};return b}},{},"/proc/self/fd")})();w.kc={MEMFS:P};
var Fc={a:(a,b,c,d)=>{gb(`Assertion failed: ${a?I(v,a):""}, at: `+[b?b?I(v,b):"":"unknown filename",c,d?d?I(v,d):"":"unknown function"])},h:function(a,b){try{return a=a?I(v,a):"",w.chmod(a,b),0}catch(c){if("undefined"==typeof w||"ErrnoError"!==c.name)throw c;return-c.Na}},H:function(a,b,c){try{b=b?I(v,b):"";b=sc(a,b);if(c&-8)return-28;var d=V(b,{Ta:!0}).node;if(!d)return-44;a="";c&4&&(a+="r");c&2&&(a+="w");c&1&&(a+="x");return a&&Rb(d,a)?-2:0}catch(f){if("undefined"==typeof w||"ErrnoError"!==f.name)throw f;
return-f.Na}},i:function(a,b){try{return w.fchmod(a,b),0}catch(c){if("undefined"==typeof w||"ErrnoError"!==c.name)throw c;return-c.Na}},g:function(a,b,c){try{return w.fchown(a,b,c),0}catch(d){if("undefined"==typeof w||"ErrnoError"!==d.name)throw d;return-d.Na}},b:function(a,b,c){uc=c;try{var d=X(a);switch(b){case 0:var f=vc();if(0>f)break;for(;w.streams[f];)f++;return $b(d,f).fd;case 1:case 2:return 0;case 3:return d.flags;case 4:return f=vc(),d.flags|=f,0;case 12:return f=vc(),Na[f+0>>1]=2,0;case 13:case 14:return 0}return-28}catch(k){if("undefined"==
typeof w||"ErrnoError"!==k.name)throw k;return-k.Na}},f:function(a,b){try{var c=X(a);return tc(w.stat,c.path,b)}catch(d){if("undefined"==typeof w||"ErrnoError"!==d.name)throw d;return-d.Na}},n:function(a,b,c){b=wc(b,c);try{if(isNaN(b))return 61;var d=X(a);if(0===(d.flags&2097155))throw new w.Ia(28);w.truncate(d.node,b);return 0}catch(f){if("undefined"==typeof w||"ErrnoError"!==f.name)throw f;return-f.Na}},C:function(a,b){try{if(0===b)return-28;var c=w.cwd(),d=ha(c)+1;if(b<d)return-68;r(c,v,a,b);return d}catch(f){if("undefined"==
typeof w||"ErrnoError"!==f.name)throw f;return-f.Na}},F:function(a,b){try{return a=a?I(v,a):"",tc(w.lstat,a,b)}catch(c){if("undefined"==typeof w||"ErrnoError"!==c.name)throw c;return-c.Na}},z:function(a,b,c){try{return b=b?I(v,b):"",b=sc(a,b),b=N(b),"/"===b[b.length-1]&&(b=b.substr(0,b.length-1)),w.mkdir(b,c,0),0}catch(d){if("undefined"==typeof w||"ErrnoError"!==d.name)throw d;return-d.Na}},E:function(a,b,c,d){try{b=b?I(v,b):"";var f=d&256;b=sc(a,b,d&4096);return tc(f?w.lstat:w.stat,b,c)}catch(k){if("undefined"==
typeof w||"ErrnoError"!==k.name)throw k;return-k.Na}},x:function(a,b,c,d){uc=d;try{b=b?I(v,b):"";b=sc(a,b);var f=d?vc():0;return w.open(b,c,f).fd}catch(k){if("undefined"==typeof w||"ErrnoError"!==k.name)throw k;return-k.Na}},v:function(a,b,c,d){try{b=b?I(v,b):"";b=sc(a,b);if(0>=d)return-28;var f=w.readlink(b),k=Math.min(d,ha(f)),l=g[c+k];r(f,v,c,d+1);g[c+k]=l;return k}catch(n){if("undefined"==typeof w||"ErrnoError"!==n.name)throw n;return-n.Na}},u:function(a){try{return a=a?I(v,a):"",w.rmdir(a),0}catch(b){if("undefined"==
typeof w||"ErrnoError"!==b.name)throw b;return-b.Na}},G:function(a,b){try{return a=a?I(v,a):"",tc(w.stat,a,b)}catch(c){if("undefined"==typeof w||"ErrnoError"!==c.name)throw c;return-c.Na}},r:function(a,b,c){try{return b=b?I(v,b):"",b=sc(a,b),0===c?w.unlink(b):512===c?w.rmdir(b):gb("Invalid flags passed to unlinkat"),0}catch(d){if("undefined"==typeof w||"ErrnoError"!==d.name)throw d;return-d.Na}},q:function(a,b,c){try{b=b?I(v,b):"";b=sc(a,b,!0);if(c){var d=E[c>>2]+4294967296*B[c+4>>2],f=B[c+8>>2];
k=1E3*d+f/1E6;c+=16;d=E[c>>2]+4294967296*B[c+4>>2];f=B[c+8>>2];l=1E3*d+f/1E6}else var k=Date.now(),l=k;a=k;var n=V(b,{Ta:!0}).node;n.Ja.Sa(n,{timestamp:Math.max(a,l)});return 0}catch(t){if("undefined"==typeof w||"ErrnoError"!==t.name)throw t;return-t.Na}},l:function(a,b,c){a=new Date(1E3*wc(a,b));B[c>>2]=a.getSeconds();B[c+4>>2]=a.getMinutes();B[c+8>>2]=a.getHours();B[c+12>>2]=a.getDate();B[c+16>>2]=a.getMonth();B[c+20>>2]=a.getFullYear()-1900;B[c+24>>2]=a.getDay();b=a.getFullYear();B[c+28>>2]=(0!==
b%4||0===b%100&&0!==b%400?yc:xc)[a.getMonth()]+a.getDate()-1|0;B[c+36>>2]=-(60*a.getTimezoneOffset());b=(new Date(a.getFullYear(),6,1)).getTimezoneOffset();var d=(new Date(a.getFullYear(),0,1)).getTimezoneOffset();B[c+32>>2]=(b!=d&&a.getTimezoneOffset()==Math.min(d,b))|0},j:function(a,b,c,d,f,k,l,n){f=wc(f,k);try{if(isNaN(f))return 61;var t=X(d),u=w.cb(t,a,f,b,c),p=u.Wb;B[l>>2]=u.Ib;E[n>>2]=p;return 0}catch(y){if("undefined"==typeof w||"ErrnoError"!==y.name)throw y;return-y.Na}},k:function(a,b,c,
d,f,k,l){k=wc(k,l);try{var n=X(f);if(c&2){if(!w.isFile(n.node.mode))throw new w.Ia(43);if(!(d&2)){var t=v.slice(a,a+b);w.gb(n,t,k,b,d)}}}catch(u){if("undefined"==typeof w||"ErrnoError"!==u.name)throw u;return-u.Na}},y:(a,b,c,d)=>{var f=(new Date).getFullYear(),k=(new Date(f,0,1)).getTimezoneOffset();f=(new Date(f,6,1)).getTimezoneOffset();E[a>>2]=60*Math.max(k,f);B[b>>2]=Number(k!=f);b=l=>{var n=Math.abs(l);return`UTC${0<=l?"-":"+"}${String(Math.floor(n/60)).padStart(2,"0")}${String(n%60).padStart(2,
"0")}`};a=b(k);b=b(f);f<k?(r(a,v,c,17),r(b,v,d,17)):(r(a,v,d,17),r(b,v,c,17))},d:()=>Date.now(),s:()=>2147483648,c:()=>performance.now(),o:a=>{var b=v.length;a>>>=0;if(2147483648<a)return!1;for(var c=1;4>=c;c*=2){var d=b*(1+.2/c);d=Math.min(d,a+100663296);var f=Math;d=Math.max(a,d);a:{f=(f.min.call(f,2147483648,d+(65536-d%65536)%65536)-Ia.buffer.byteLength+65535)/65536;try{Ia.grow(f);Qa();var k=1;break a}catch(l){}k=void 0}if(k)return!0}return!1},A:(a,b)=>{var c=0;Bc().forEach((d,f)=>{var k=b+c;f=
E[a+4*f>>2]=k;for(k=0;k<d.length;++k)g[f++]=d.charCodeAt(k);g[f]=0;c+=d.length+1});return 0},B:(a,b)=>{var c=Bc();E[a>>2]=c.length;var d=0;c.forEach(f=>d+=f.length+1);E[b>>2]=d;return 0},e:function(a){try{var b=X(a);w.close(b);return 0}catch(c){if("undefined"==typeof w||"ErrnoError"!==c.name)throw c;return c.Na}},p:function(a,b){try{var c=X(a);g[b]=c.tty?2:R(c.mode)?3:40960===(c.mode&61440)?7:4;Na[b+2>>1]=0;H=[0,(F=0,1<=+Math.abs(F)?0<F?+Math.floor(F/4294967296)>>>0:~~+Math.ceil((F-+(~~F>>>0))/4294967296)>>>
0:0)];B[b+8>>2]=H[0];B[b+12>>2]=H[1];H=[0,(F=0,1<=+Math.abs(F)?0<F?+Math.floor(F/4294967296)>>>0:~~+Math.ceil((F-+(~~F>>>0))/4294967296)>>>0:0)];B[b+16>>2]=H[0];B[b+20>>2]=H[1];return 0}catch(d){if("undefined"==typeof w||"ErrnoError"!==d.name)throw d;return d.Na}},w:function(a,b,c,d){try{a:{var f=X(a);a=b;for(var k,l=b=0;l<c;l++){var n=E[a>>2],t=E[a+4>>2];a+=8;var u=w.read(f,g,n,t,k);if(0>u){var p=-1;break a}b+=u;if(u<t)break;"undefined"!=typeof k&&(k+=u)}p=b}E[d>>2]=p;return 0}catch(y){if("undefined"==
typeof w||"ErrnoError"!==y.name)throw y;return y.Na}},m:function(a,b,c,d,f){b=wc(b,c);try{if(isNaN(b))return 61;var k=X(a);w.Wa(k,b,d);H=[k.position>>>0,(F=k.position,1<=+Math.abs(F)?0<F?+Math.floor(F/4294967296)>>>0:~~+Math.ceil((F-+(~~F>>>0))/4294967296)>>>0:0)];B[f>>2]=H[0];B[f+4>>2]=H[1];k.xb&&0===b&&0===d&&(k.xb=null);return 0}catch(l){if("undefined"==typeof w||"ErrnoError"!==l.name)throw l;return l.Na}},D:function(a){try{var b=X(a);return b.Ka?.fsync?b.Ka.fsync(b):0}catch(c){if("undefined"==
typeof w||"ErrnoError"!==c.name)throw c;return c.Na}},t:function(a,b,c,d){try{a:{var f=X(a);a=b;for(var k,l=b=0;l<c;l++){var n=E[a>>2],t=E[a+4>>2];a+=8;var u=w.write(f,g,n,t,k);if(0>u){var p=-1;break a}b+=u;"undefined"!=typeof k&&(k+=u)}p=b}E[d>>2]=p;return 0}catch(y){if("undefined"==typeof w||"ErrnoError"!==y.name)throw y;return y.Na}}},Z=function(){function a(c){Z=c.exports;Ia=Z.I;Qa();Y=Z.K;Sa.unshift(Z.J);eb();return Z}var b={a:Fc};db();if(e.instantiateWasm)try{return e.instantiateWasm(b,a)}catch(c){return Ga(`Module.instantiateWasm callback failed with error: ${c}`),
!1}ib||=hb("sql-wasm.wasm")?"sql-wasm.wasm":e.locateFile?e.locateFile("sql-wasm.wasm",A):A+"sql-wasm.wasm";mb(b,function(c){a(c.instance)});return{}}();e._sqlite3_malloc=a=>(e._sqlite3_malloc=Z.L)(a);e._sqlite3_free=a=>(e._sqlite3_free=Z.M)(a);e._sqlite3_value_text=a=>(e._sqlite3_value_text=Z.N)(a);e._sqlite3_prepare_v2=(a,b,c,d,f)=>(e._sqlite3_prepare_v2=Z.O)(a,b,c,d,f);e._sqlite3_step=a=>(e._sqlite3_step=Z.P)(a);e._sqlite3_reset=a=>(e._sqlite3_reset=Z.Q)(a);
e._sqlite3_exec=(a,b,c,d,f)=>(e._sqlite3_exec=Z.R)(a,b,c,d,f);e._sqlite3_finalize=a=>(e._sqlite3_finalize=Z.S)(a);e._sqlite3_column_name=(a,b)=>(e._sqlite3_column_name=Z.T)(a,b);e._sqlite3_column_text=(a,b)=>(e._sqlite3_column_text=Z.U)(a,b);e._sqlite3_column_type=(a,b)=>(e._sqlite3_column_type=Z.V)(a,b);e._sqlite3_errmsg=a=>(e._sqlite3_errmsg=Z.W)(a);e._sqlite3_clear_bindings=a=>(e._sqlite3_clear_bindings=Z.X)(a);e._sqlite3_value_blob=a=>(e._sqlite3_value_blob=Z.Y)(a);
e._sqlite3_value_bytes=a=>(e._sqlite3_value_bytes=Z.Z)(a);e._sqlite3_value_double=a=>(e._sqlite3_value_double=Z._)(a);e._sqlite3_value_int=a=>(e._sqlite3_value_int=Z.$)(a);e._sqlite3_value_type=a=>(e._sqlite3_value_type=Z.aa)(a);e._sqlite3_result_blob=(a,b,c,d)=>(e._sqlite3_result_blob=Z.ba)(a,b,c,d);e._sqlite3_result_double=(a,b)=>(e._sqlite3_result_double=Z.ca)(a,b);e._sqlite3_result_error=(a,b,c)=>(e._sqlite3_result_error=Z.da)(a,b,c);
e._sqlite3_result_int=(a,b)=>(e._sqlite3_result_int=Z.ea)(a,b);e._sqlite3_result_int64=(a,b,c)=>(e._sqlite3_result_int64=Z.fa)(a,b,c);e._sqlite3_result_null=a=>(e._sqlite3_result_null=Z.ga)(a);e._sqlite3_result_text=(a,b,c,d)=>(e._sqlite3_result_text=Z.ha)(a,b,c,d);e._sqlite3_aggregate_context=(a,b)=>(e._sqlite3_aggregate_context=Z.ia)(a,b);e._sqlite3_column_count=a=>(e._sqlite3_column_count=Z.ja)(a);e._sqlite3_data_count=a=>(e._sqlite3_data_count=Z.ka)(a);
e._sqlite3_column_blob=(a,b)=>(e._sqlite3_column_blob=Z.la)(a,b);e._sqlite3_column_bytes=(a,b)=>(e._sqlite3_column_bytes=Z.ma)(a,b);e._sqlite3_column_double=(a,b)=>(e._sqlite3_column_double=Z.na)(a,b);e._sqlite3_bind_blob=(a,b,c,d,f)=>(e._sqlite3_bind_blob=Z.oa)(a,b,c,d,f);e._sqlite3_bind_double=(a,b,c)=>(e._sqlite3_bind_double=Z.pa)(a,b,c);e._sqlite3_bind_int=(a,b,c)=>(e._sqlite3_bind_int=Z.qa)(a,b,c);e._sqlite3_bind_text=(a,b,c,d,f)=>(e._sqlite3_bind_text=Z.ra)(a,b,c,d,f);
e._sqlite3_bind_parameter_index=(a,b)=>(e._sqlite3_bind_parameter_index=Z.sa)(a,b);e._sqlite3_sql=a=>(e._sqlite3_sql=Z.ta)(a);e._sqlite3_normalized_sql=a=>(e._sqlite3_normalized_sql=Z.ua)(a);e._sqlite3_create_module_v2=(a,b,c,d,f)=>(e._sqlite3_create_module_v2=Z.va)(a,b,c,d,f);e._sqlite3_declare_vtab=(a,b)=>(e._sqlite3_declare_vtab=Z.wa)(a,b);e._sqlite3_changes=a=>(e._sqlite3_changes=Z.xa)(a);e._sqlite3_close_v2=a=>(e._sqlite3_close_v2=Z.ya)(a);
e._sqlite3_create_function_v2=(a,b,c,d,f,k,l,n,t)=>(e._sqlite3_create_function_v2=Z.za)(a,b,c,d,f,k,l,n,t);e._sqlite3_open=(a,b)=>(e._sqlite3_open=Z.Aa)(a,b);var ja=e._malloc=a=>(ja=e._malloc=Z.Ba)(a),oa=e._free=a=>(oa=e._free=Z.Ca)(a);e._RegisterExtensionFunctions=a=>(e._RegisterExtensionFunctions=Z.Da)(a);var Kb=(a,b)=>(Kb=Z.Ea)(a,b),ua=a=>(ua=Z.Fa)(a),ka=a=>(ka=Z.Ga)(a),pa=()=>(pa=Z.Ha)();e.stackSave=()=>pa();e.stackRestore=a=>ua(a);e.stackAlloc=a=>ka(a);
e.cwrap=(a,b,c,d)=>{var f=!c||c.every(k=>"number"===k||"boolean"===k);return"string"!==b&&f&&!d?e["_"+a]:(...k)=>Cc(a,b,c,k)};e.addFunction=xa;e.removeFunction=wa;e.UTF8ToString=ta;e.ALLOC_NORMAL=na;e.allocate=ma;e.allocateUTF8OnStack=va;var Gc;cb=function Hc(){Gc||Ic();Gc||(cb=Hc)};
function Ic(){function a(){if(!Gc&&(Gc=!0,e.calledRun=!0,!Ma)){e.noFSInit||w.lb.yb||w.lb();w.Sb=!1;nb(Sa);e.onRuntimeInitialized?.();if(e.postRun)for("function"==typeof e.postRun&&(e.postRun=[e.postRun]);e.postRun.length;){var b=e.postRun.shift();Ta.unshift(b)}nb(Ta)}}if(!(0<Va)){if(e.preRun)for("function"==typeof e.preRun&&(e.preRun=[e.preRun]);e.preRun.length;)Ua();nb(Ra);0<Va||(e.setStatus?(e.setStatus("Running..."),setTimeout(function(){setTimeout(function(){e.setStatus("")},1);a()},1)):a())}}
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