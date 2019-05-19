"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageserver_1 = require("vscode-languageserver");
var Is;
(function (Is) {
    const toString = Object.prototype.toString;
    function boolean(value) {
        return value === true || value === false;
    }
    Is.boolean = boolean;
    function string(value) {
        return toString.call(value) === '[object String]';
    }
    Is.string = string;
})(Is = exports.Is || (exports.Is = {}));
var CommandIds;
(function (CommandIds) {
    CommandIds.applySingleFix = 'stlint.applySingleFix';
    CommandIds.applySameFixes = 'stlint.applySameFixes';
    CommandIds.applyAllFixes = 'stlint.applyAllFixes';
    CommandIds.applyAutoFix = 'stlint.applyAutoFix';
})(CommandIds = exports.CommandIds || (exports.CommandIds = {}));
var AllFixesRequest;
(function (AllFixesRequest) {
    AllFixesRequest.type = new vscode_languageserver_1.RequestType('textDocument/stlint/allFixes');
})(AllFixesRequest = exports.AllFixesRequest || (exports.AllFixesRequest = {}));
//# sourceMappingURL=types.js.map