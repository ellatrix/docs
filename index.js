// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles
parcelRequire = (function (modules, cache, entry, globalName) {
  // Save the require from previous bundle to this closure if any
  var previousRequire = typeof parcelRequire === 'function' && parcelRequire;
  var nodeRequire = typeof require === 'function' && require;

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        // if we cannot find the module within our internal map or
        // cache jump to the current global require ie. the last bundle
        // that was added to the page.
        var currentRequire = typeof parcelRequire === 'function' && parcelRequire;
        if (!jumped && currentRequire) {
          return currentRequire(name, true);
        }

        // If there are other bundles on this page the require from the
        // previous one is saved to 'previousRequire'. Repeat this as
        // many times as there are bundles until the module is found or
        // we exhaust the require chain.
        if (previousRequire) {
          return previousRequire(name, true);
        }

        // Try the node require function if it exists.
        if (nodeRequire && typeof name === 'string') {
          return nodeRequire(name);
        }

        var err = new Error('Cannot find module \'' + name + '\'');
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }

      localRequire.resolve = resolve;
      localRequire.cache = {};

      var module = cache[name] = new newRequire.Module(name);

      modules[name][0].call(module.exports, localRequire, module, module.exports, this);
    }

    return cache[name].exports;

    function localRequire(x){
      return newRequire(localRequire.resolve(x));
    }

    function resolve(x){
      return modules[name][1][x] || x;
    }
  }

  function Module(moduleName) {
    this.id = moduleName;
    this.bundle = newRequire;
    this.exports = {};
  }

  newRequire.isParcelRequire = true;
  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;
  newRequire.register = function (id, exports) {
    modules[id] = [function (require, module) {
      module.exports = exports;
    }, {}];
  };

  var error;
  for (var i = 0; i < entry.length; i++) {
    try {
      newRequire(entry[i]);
    } catch (e) {
      // Save first error but execute all entries
      if (!error) {
        error = e;
      }
    }
  }

  if (entry.length) {
    // Expose entry point to Node, AMD or browser globals
    // Based on https://github.com/ForbesLindesay/umd/blob/master/template.js
    var mainExports = newRequire(entry[entry.length - 1]);

    // CommonJS
    if (typeof exports === "object" && typeof module !== "undefined") {
      module.exports = mainExports;

    // RequireJS
    } else if (typeof define === "function" && define.amd) {
     define(function () {
       return mainExports;
     });

    // <script>
    } else if (globalName) {
      this[globalName] = mainExports;
    }
  }

  // Override the current require with this new one
  parcelRequire = newRequire;

  if (error) {
    // throw error from earlier, _after updating parcelRequire_
    throw error;
  }

  return newRequire;
})({"IxO8":[function(require,module,exports) {
function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

module.exports = _defineProperty;
},{}],"OUZ9":[function(require,module,exports) {
function _arrayWithHoles(arr) {
  if (Array.isArray(arr)) return arr;
}

module.exports = _arrayWithHoles;
},{}],"vKPt":[function(require,module,exports) {
function _iterableToArrayLimit(arr, i) {
  if (!(Symbol.iterator in Object(arr) || Object.prototype.toString.call(arr) === "[object Arguments]")) {
    return;
  }

  var _arr = [];
  var _n = true;
  var _d = false;
  var _e = undefined;

  try {
    for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
      _arr.push(_s.value);

      if (i && _arr.length === i) break;
    }
  } catch (err) {
    _d = true;
    _e = err;
  } finally {
    try {
      if (!_n && _i["return"] != null) _i["return"]();
    } finally {
      if (_d) throw _e;
    }
  }

  return _arr;
}

module.exports = _iterableToArrayLimit;
},{}],"Rom6":[function(require,module,exports) {
function _nonIterableRest() {
  throw new TypeError("Invalid attempt to destructure non-iterable instance");
}

module.exports = _nonIterableRest;
},{}],"HETk":[function(require,module,exports) {
var arrayWithHoles = require("./arrayWithHoles");

var iterableToArrayLimit = require("./iterableToArrayLimit");

var nonIterableRest = require("./nonIterableRest");

function _slicedToArray(arr, i) {
  return arrayWithHoles(arr) || iterableToArrayLimit(arr, i) || nonIterableRest();
}

module.exports = _slicedToArray;
},{"./arrayWithHoles":"OUZ9","./iterableToArrayLimit":"vKPt","./nonIterableRest":"Rom6"}],"Focm":[function(require,module,exports) {
"use strict";

var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));

var _slicedToArray2 = _interopRequireDefault(require("@babel/runtime/helpers/slicedToArray"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(source, true).forEach(function (key) { (0, _defineProperty2.default)(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(source).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

var _window$wp = window.wp,
    _window$wp$element = _window$wp.element,
    createElement = _window$wp$element.createElement,
    Fragment = _window$wp$element.Fragment,
    useState = _window$wp$element.useState,
    __ = _window$wp.i18n.__,
    registerPlugin = _window$wp.plugins.registerPlugin,
    _window$wp$editPost = _window$wp.editPost,
    PluginDocumentSettingPanel = _window$wp$editPost.PluginDocumentSettingPanel,
    PluginSidebar = _window$wp$editPost.PluginSidebar,
    _window$wp$data = _window$wp.data,
    useSelect = _window$wp$data.useSelect,
    useDispatch = _window$wp$data.useDispatch,
    _window$wp$components = _window$wp.components,
    RadioControl = _window$wp$components.RadioControl,
    TextareaControl = _window$wp$components.TextareaControl,
    TextControl = _window$wp$components.TextControl,
    ClipboardButton = _window$wp$components.ClipboardButton;
var anyoneKey = 'docs-share-anyone';
var addressesKey = 'docs-share-email-addresses';
registerPlugin('my-document-setting-plugin', {
  render: function render() {
    var _useState = useState(false),
        _useState2 = (0, _slicedToArray2.default)(_useState, 2),
        state = _useState2[0],
        setState = _useState2[1];

    var _useDispatch = useDispatch('core/editor'),
        editPost = _useDispatch.editPost;

    var _useSelect = useSelect(function (select) {
      var _select = select('core/editor'),
          getEditedPostAttribute = _select.getEditedPostAttribute,
          getCurrentPost = _select.getCurrentPost;

      return {
        meta: getEditedPostAttribute('meta'),
        link: getCurrentPost().link
      };
    }),
        meta = _useSelect.meta,
        link = _useSelect.link;

    return createElement(Fragment, null, createElement(PluginDocumentSettingPanel, {
      title: __('Share', 'docs'),
      icon: "admin-links"
    }, createElement(RadioControl, {
      selected: meta[anyoneKey] || '',
      options: [{
        label: __('Only the author can edit.', 'docs'),
        value: ''
      }, {
        label: __('Anyone with the link can edit.', 'docs'),
        value: 'anyone'
      }, {
        label: __('Anyone with access to the following email addresses can edit.', 'docs'),
        value: 'email'
      }],
      onChange: function onChange(value) {
        return editPost({
          meta: _objectSpread({}, meta, (0, _defineProperty2.default)({}, anyoneKey, value))
        });
      }
    }), meta[anyoneKey] === 'email' && createElement(TextareaControl, {
      label: __('Comma separated list of email addresses. An email will be sent once the document is saved.', 'docs'),
      value: meta[addressesKey],
      onChange: function onChange(value) {
        return editPost({
          meta: _objectSpread({}, meta, (0, _defineProperty2.default)({}, addressesKey, value))
        });
      }
    }), meta[anyoneKey] && createElement(TextControl, {
      readOnly: true,
      value: link
    }), meta[anyoneKey] && createElement(ClipboardButton, {
      isLarge: true,
      text: link,
      onCopy: function onCopy() {
        return setState(true);
      },
      onFinishCopy: function onFinishCopy() {
        return setState(false);
      }
    }, state ? __('Copied!', 'docs') : __('Copy Link', 'docs'))));
  }
});
},{"@babel/runtime/helpers/defineProperty":"IxO8","@babel/runtime/helpers/slicedToArray":"HETk"}]},{},["Focm"], null)
//# sourceMappingURL=/index.js.map