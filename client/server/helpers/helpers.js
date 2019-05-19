"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("./types");
const vscode_languageserver_1 = require("vscode-languageserver");
const vscode_uri_1 = require("vscode-uri");
function computeKey(diagnostic) {
    let range = diagnostic.range;
    return `[${range.start.line},${range.start.character},${range.end.line},${range.end.character}]-${diagnostic.code}`;
}
exports.computeKey = computeKey;
function sortFixes(fixes) {
    // The AutoFix.edits are sorted, so we sort on the first edit
    return fixes.sort((a, b) => {
        let editA = a.edits[0];
        let editB = b.edits[0];
        if (editA.range.start.line < editB.range.start.line) {
            return -1;
        }
        if (editA.range.start.line > editB.range.start.line) {
            return 1;
        }
        // lines are equal
        if (editA.range.end.line < editB.range.end.line) {
            return -1;
        }
        if (editA.range.end.line > editB.range.end.line) {
            return 1;
        }
        // characters are equal
        return 0;
    });
}
exports.sortFixes = sortFixes;
function getLastEdit(array) {
    let length = array.length;
    if (length === 0) {
        return undefined;
    }
    return array[length - 1];
}
exports.getLastEdit = getLastEdit;
function overlaps(lastFix, nextFix) {
    if (!lastFix) {
        return false;
    }
    let doesOverlap = false;
    lastFix.edits.some(last => {
        return nextFix.edits.some(next => {
            if (last.range.end.line > next.range.start.line) {
                doesOverlap = true;
                return true;
            }
            else if (last.range.end.line < next.range.start.line) {
                return false;
            }
            else if (last.range.end.character >= next.range.start.character) {
                doesOverlap = true;
                return true;
            }
            return false;
        });
    });
    return doesOverlap;
}
exports.overlaps = overlaps;
function createTextEdit(autoFix) {
    return autoFix.edits.map(each => vscode_languageserver_1.TextEdit.replace(each.range, each.text || ''));
}
exports.createTextEdit = createTextEdit;
function concatenateEdits(fixes) {
    let textEdits = [];
    fixes.forEach(each => {
        textEdits = textEdits.concat(createTextEdit(each));
    });
    return textEdits;
}
exports.concatenateEdits = concatenateEdits;
function getFileSystemPath(uri) {
    let result = uri.fsPath;
    if (process.platform === 'win32' && result.length >= 2 && result[1] === ':') {
        return result[0].toUpperCase() + result.substr(1);
    }
    return result;
}
exports.getFileSystemPath = getFileSystemPath;
function getFilePath(documentOrUri) {
    if (!documentOrUri) {
        return undefined;
    }
    let uri = types_1.Is.string(documentOrUri) ? vscode_uri_1.default.parse(documentOrUri) : vscode_uri_1.default.parse(documentOrUri.uri);
    if (uri.scheme !== 'file') {
        return undefined;
    }
    return getFileSystemPath(uri);
}
exports.getFilePath = getFilePath;
function getAllNonOverlappingFixes(fixes) {
    let nonOverlapping = [];
    let hasOverlappingFixes = false;
    fixes = sortFixes(fixes);
    for (let autofix of fixes) {
        if (!overlaps(getLastEdit(nonOverlapping), autofix)) {
            nonOverlapping.push(autofix);
        }
        else {
            hasOverlappingFixes = true;
        }
    }
    return [nonOverlapping, hasOverlappingFixes];
}
exports.getAllNonOverlappingFixes = getAllNonOverlappingFixes;
//# sourceMappingURL=helpers.js.map