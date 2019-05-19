"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageserver_1 = require("vscode-languageserver");
const stlint_1 = require("stlint");
const types_1 = require("./helpers/types");
const helpers_1 = require("./helpers/helpers");
// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = vscode_languageserver_1.createConnection(vscode_languageserver_1.ProposedFeatures.all);
// Create a simple text document manager. The text document manager
// supports full document sync only
let documents = new vscode_languageserver_1.TextDocuments();
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let codeFixActions = new Map();
function recordCodeAction(document, diagnostic, problem) {
    let fix = problem.fix ? {
        label: `Fix: ${problem.descr}`,
        documentVersion: document.version,
        problem,
        edits: [
            {
                range: diagnostic.range,
                text: problem.fix.replace
            }
        ]
    } : void (0);
    if (!fix) {
        return;
    }
    let documentAutoFixes = codeFixActions[document.uri];
    if (!documentAutoFixes) {
        documentAutoFixes = Object.create(null);
        codeFixActions[document.uri] = documentAutoFixes;
    }
    documentAutoFixes[helpers_1.computeKey(diagnostic)] = fix;
}
connection.onCodeAction((params) => {
    let result = [];
    let uri = params.textDocument.uri;
    let documentVersion = -1;
    let ruleId = undefined;
    let documentFixes = codeFixActions[uri];
    if (documentFixes) {
        for (let diagnostic of params.context.diagnostics) {
            let autoFix = documentFixes[helpers_1.computeKey(diagnostic)];
            if (autoFix) {
                documentVersion = autoFix.documentVersion;
                ruleId = autoFix.problem.rule;
                const resultFix = helpers_1.createTextEdit(autoFix);
                let command = vscode_languageserver_1.Command.create(autoFix.label, types_1.CommandIds.applySingleFix, uri, documentVersion, resultFix);
                let codeAction = vscode_languageserver_1.CodeAction.create(autoFix.label, command, vscode_languageserver_1.CodeActionKind.QuickFix);
                codeAction.diagnostics = [diagnostic];
                result.push(codeAction);
            }
        }
        if (result.length > 0) {
            let same = [];
            let all = [];
            let fixes = Object.keys(documentFixes).map(key => documentFixes[key]);
            fixes = helpers_1.sortFixes(fixes);
            for (let autofix of fixes) {
                if (documentVersion === -1) {
                    documentVersion = autofix.documentVersion;
                }
                if (autofix.problem.rule === ruleId && !helpers_1.overlaps(helpers_1.getLastEdit(same), autofix)) {
                    same.push(autofix);
                }
                if (!helpers_1.overlaps(helpers_1.getLastEdit(all), autofix)) {
                    all.push(autofix);
                }
            }
            // if the same rule warning exists more than once, provide a command to fix all these warnings
            if (same.length > 1) {
                let label = `Fix all: ${same[0].problem.rule}`;
                const resultFix = helpers_1.concatenateEdits(same);
                let command = vscode_languageserver_1.Command.create(label, types_1.CommandIds.applySameFixes, uri, documentVersion, resultFix);
                result.push(vscode_languageserver_1.CodeAction.create(label, command, vscode_languageserver_1.CodeActionKind.QuickFix));
            }
            // create a command to fix all the warnings with fixes
            if (all.length > 1) {
                let label = `Fix all auto-fixable problems`;
                let command = vscode_languageserver_1.Command.create(label, types_1.CommandIds.applyAllFixes, uri, documentVersion, helpers_1.concatenateEdits(all));
                // Contribute both a kind = Source and kind = Quick Fix. Then
                // action appears in the light bulb (for backward compatibility) and the Source... quick pick.
                result.push(vscode_languageserver_1.CodeAction.create(`${label} (stlint)`, command, vscode_languageserver_1.CodeActionKind.Source), vscode_languageserver_1.CodeAction.create(label, command, vscode_languageserver_1.CodeActionKind.QuickFix));
            }
        }
    }
    return result;
});
connection.onRequest(types_1.AllFixesRequest.type, (params) => __awaiter(this, void 0, void 0, function* () {
    let result = undefined;
    let uri = params.textDocument.uri;
    let document = documents.get(uri);
    if (!document) {
        return undefined;
    }
    let documentFixes = codeFixActions[uri];
    let documentVersion = -1;
    if (!documentFixes) {
        return undefined;
    }
    let fixes = Object.keys(documentFixes).map(key => documentFixes[key]);
    for (let fix of fixes) {
        if (documentVersion === -1) {
            documentVersion = fix.documentVersion;
            break;
        }
    }
    let [allFixes, overlappingEdits] = helpers_1.getAllNonOverlappingFixes(fixes);
    result = {
        documentVersion: documentVersion,
        edits: helpers_1.concatenateEdits(allFixes),
        overlappingFixes: overlappingEdits
    };
    return result;
}));
connection.onInitialize((params) => {
    let capabilities = params.capabilities;
    // Does the client support the `workspace/configuration` request?
    // If not, we will fall back using global settings
    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
    hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
    return {
        capabilities: {
            codeActionProvider: true,
            textDocumentSync: documents.syncKind
        }
    };
});
connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        // Register for all configuration changes.
        connection.client.register(vscode_languageserver_1.DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log('Workspace folder change event received.');
        });
    }
});
// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings = {
    enable: true
};
let globalSettings = defaultSettings;
// Cache the settings of all open documents
let documentSettings = new Map();
connection.onDidChangeConfiguration(change => {
    if (hasConfigurationCapability) {
        // Reset all cached document settings
        documentSettings.clear();
    }
    else {
        globalSettings = ((change.settings.languageServerExample || defaultSettings));
    }
    // Revalidate all open text documents
    documents.all().forEach(validateTextDocument);
});
function getDocumentSettings(resource) {
    if (!hasConfigurationCapability) {
        return Promise.resolve(globalSettings);
    }
    let result = documentSettings.get(resource);
    if (!result) {
        result = connection.workspace.getConfiguration({
            scopeUri: resource,
            section: 'stlint'
        });
        documentSettings.set(resource, result);
    }
    return result;
}
// Only keep settings for open documents
documents.onDidClose(e => {
    documentSettings.delete(e.document.uri);
});
// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});
const linter = new stlint_1.Linter();
function validateTextDocument(textDocument) {
    return __awaiter(this, void 0, void 0, function* () {
        let settings = yield getDocumentSettings(textDocument.uri);
        if (!settings.enable) {
            return undefined;
        }
        let content = textDocument.getText();
        let diagnostics = [];
        linter.reporter.reset();
        linter.lint(helpers_1.getFilePath(textDocument), content);
        const response = linter.reporter.response;
        if (!response.passed && response.errors && response.errors.length) {
            response.errors.forEach((error) => {
                error.message.forEach((msg) => {
                    let diagnostic = {
                        severity: vscode_languageserver_1.DiagnosticSeverity.Error,
                        range: {
                            start: { line: msg.line - 1, character: msg.start - 1 },
                            end: { line: msg.endline - 1, character: msg.end }
                        },
                        message: msg.descr,
                        code: msg.rule,
                        source: msg.rule
                    };
                    recordCodeAction(textDocument, diagnostic, msg);
                    diagnostics.push(diagnostic);
                });
            });
        }
        // Send the computed diagnostics to VSCode.
        connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
    });
}
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);
// Listen on the connection
connection.listen();
//# sourceMappingURL=server.js.map