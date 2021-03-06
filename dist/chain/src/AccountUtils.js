"use strict";

exports.__esModule = true;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _PrivateKey = require("../../ecc/src/PrivateKey");

var _PrivateKey2 = _interopRequireDefault(_PrivateKey);

var _KeyUtils = require("../../ecc/src/KeyUtils");

var _KeyUtils2 = _interopRequireDefault(_KeyUtils);

var _bytebuffer = require("bytebuffer");

var _bytebuffer2 = _interopRequireDefault(_bytebuffer);

var _ecc = require("../../ecc");

var _state = require("./state");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _keyCachePriv = {};
var _keyCachePub = {};

var AccountUtils = function () {
    function AccountUtils() {
        _classCallCheck(this, AccountUtils);

        var state = { loggedIn: false, roles: ["secondary", "active", "owner", "memo"] };
        this.get = (0, _state.get)(state);
        this.set = (0, _state.set)(state);

        this.subs = {};
    }

    AccountUtils.prototype.addSubscription = function addSubscription(cb) {
        this.subs[cb] = cb;
    };

    AccountUtils.prototype.setRoles = function setRoles(roles) {
        this.set("roles", roles);
    };

    AccountUtils.prototype.generateKeys = function generateKeys(accountName, password, roles, prefix) {
        var start = new Date().getTime();
        if (!accountName || !password) {
            throw new Error("Account name or password required");
        }
        if (password.length < 12) {
            throw new Error("Password must have at least 12 characters");
        }

        var privKeys = {};
        var pubKeys = {};

        (roles || this.get("roles")).forEach(function (role) {
            var seed = accountName + role + password;
            var pkey = _keyCachePriv[seed] ? _keyCachePriv[seed] : _PrivateKey2.default.fromSeed(_KeyUtils2.default.normalize_brainKey(seed));
            _keyCachePriv[seed] = pkey;

            privKeys[role] = pkey;
            pubKeys[role] = _keyCachePub[seed] ? _keyCachePub[seed] : pkey.toPublicKey().toString(prefix);

            _keyCachePub[seed] = pubKeys[role];
        });

        return { privKeys: privKeys, pubKeys: pubKeys };
    };

    AccountUtils.prototype.checkKeys = function checkKeys(_ref) {
        var _this = this;

        var accountName = _ref.accountName,
            password = _ref.password,
            auths = _ref.auths;

        if (!accountName || !password || !auths) {
            throw new Error("checkKeys: Missing inputs");
        }
        var hasKey = false;

        var _loop = function _loop(role) {
            var _generateKeys = _this.generateKeys(accountName, password, [role]),
                privKeys = _generateKeys.privKeys,
                pubKeys = _generateKeys.pubKeys;

            auths[role].forEach(function (key) {
                if (key[0] === pubKeys[role]) {
                    hasKey = true;
                    _this.set(role, { priv: privKeys[role], pub: pubKeys[role] });
                }
            });
        };

        for (var role in auths) {
            _loop(role);
        }
        ;

        if (hasKey) {
            this.set("name", accountName);
        }

        this.set("loggedIn", hasKey);

        return hasKey;
    };

    AccountUtils.prototype.signTransaction = function signTransaction(tr) {
        var _this2 = this;

        var myKeys = {};
        var hasKey = false;

        this.get("roles").forEach(function (role) {
            var myKey = _this2.get(role);
            if (myKey) {
                hasKey = true;
                console.log("adding signer:", myKey.pub);
                tr.add_signer(myKey.priv, myKey.pub);
            }
        });

        if (!hasKey) {
            throw new Error("You do not have any private keys to sign this transaction");
        }
    };

    AccountUtils.prototype.calculateAccountUID = function calculateAccountUID(num) {
        var n = _bytebuffer.Long.fromNumber(0, true);
        if (typeof num === "string") {
            n = _bytebuffer.Long.fromString(num, true);
        } else if ((typeof num === "undefined" ? "undefined" : _typeof(num)) === "object" && _bytebuffer.Long.isLong(num)) {
            n = num;
        } else if (typeof num === "number") {
            n = _bytebuffer.Long.fromNumber(num, true);
        } else {
            throw new Error("Invalid parameter:" + num);
        }

        var max = _bytebuffer.Long.MAX_UNSIGNED_VALUE.shiftRightUnsigned(8);
        var id = n.and(max);
        var buff = new _bytebuffer2.default(8, true);
        buff.writeUInt64(id);
        var hashBuff = _ecc.hash.sha256(buff.buffer);
        var uid = n.multiply(256).add(hashBuff[0]);
        return uid;
    };

    AccountUtils.prototype.validAccountUID = function validAccountUID(uid) {
        var u = _bytebuffer.Long.fromNumber(0, true);
        if (typeof uid === "string") {
            u = _bytebuffer.Long.fromString(uid, true);
        } else if ((typeof uid === "undefined" ? "undefined" : _typeof(uid)) === "object" && _bytebuffer.Long.isLong(uid)) {
            u = uid;
        } else if (typeof uid === "number") {
            u = _bytebuffer.Long.fromNumber(uid, true);
        } else {
            if (__LIB_DEBUG__) console.log("validAccountUID: Invalid parameter " + uid);
            return false;
        }
        var checksum = u.and(0xFF);
        var toCheck = u.shiftRightUnsigned(8);
        var buff = new _bytebuffer2.default(8, true);
        buff.writeUInt64(toCheck);
        buff.reset();
        var hashBuff = null;
        var x = buff.toBuffer();
        if (x.toString().indexOf("ArrayBuffer") > 0) {
            var b = this.toBuffer(x);
            hashBuff = _ecc.hash.sha256(b);
        } else {
            hashBuff = _ecc.hash.sha256(x);
        }
        return hashBuff[0] == checksum;
    };

    AccountUtils.prototype.toArrayBuffer = function toArrayBuffer(buf) {
        var ab = new ArrayBuffer(buf.length);
        var view = new Uint8Array(ab);
        for (var i = 0; i < buf.length; ++i) {
            view[i] = buf[i];
        }
        return ab;
    };

    AccountUtils.prototype.toBuffer = function toBuffer(ab) {
        var buf = new Buffer(ab.byteLength);
        var view = new Uint8Array(ab);
        for (var i = 0; i < buf.length; ++i) {
            buf[i] = view[i];
        }
        return buf;
    };

    return AccountUtils;
}();

var accountUtils = new AccountUtils();

exports.default = accountUtils;
module.exports = exports["default"];