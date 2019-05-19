import {
	createConnection,
	TextDocuments,
	TextDocument,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CodeAction,
	Command,
	CodeActionKind,
} from 'vscode-languageserver';

import * as fs from "fs";

import { Linter } from "stlint";

import { CommandIds, RuleFailure, AutoFix, AllFixesRequest, AllFixesResult } from './helpers/types';
import { sortFixes, createTextEdit, overlaps, getLastEdit, concatenateEdits, getFilePath, getAllNonOverlappingFixes, computeKey } from './helpers/helpers';

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;

let codeFixActions = new Map<string, Map<string, RuleFailure>>();

function recordCodeAction(document: TextDocument, diagnostic: Diagnostic, problem: RuleFailure): void {
	let fix: AutoFix | void  = problem.fix ? {
		label: `Fix: ${problem.descr}`,
		documentVersion: document.version,
		problem,
		edits: [
			{
				range: diagnostic.range,
				text: problem.fix.replace
			}
		]
	} : void(0);

	if (!fix) {
		return;
	}

	let documentAutoFixes: Map<string, AutoFix> = codeFixActions[document.uri];
	
	if (!documentAutoFixes) {
		documentAutoFixes = Object.create(null);
		codeFixActions[document.uri] = documentAutoFixes;
	}
	
	documentAutoFixes[computeKey(diagnostic)] = fix;
}


connection.onCodeAction((params): any => {
	let result:  CodeAction[] = [];
	let uri = params.textDocument.uri;
	let documentVersion: number = -1;
	let ruleId: string | undefined = undefined;

	let documentFixes = codeFixActions[uri];
	if (documentFixes) {
		for (let diagnostic of params.context.diagnostics) {
			let autoFix = documentFixes[computeKey(diagnostic)];
			
			if (autoFix) {
				documentVersion = autoFix.documentVersion;
				ruleId = autoFix.problem.rule;
				
				const resultFix = createTextEdit(autoFix);
				
				let command = Command.create(
					autoFix.label, 
					CommandIds.applySingleFix, 
					uri, 
					documentVersion, 
					resultFix
				);
				
				let codeAction = CodeAction.create(
					autoFix.label,
					command,
					CodeActionKind.QuickFix
				);
				
				codeAction.diagnostics = [diagnostic];
				result.push(codeAction);
			}
		}
		
		if (result.length > 0) {
			let same: AutoFix[] = [];
			let all: AutoFix[] = [];
			let fixes: AutoFix[] = Object.keys(documentFixes).map(key => documentFixes[key]);

			fixes = sortFixes(fixes);

			for (let autofix of fixes) {
				if (documentVersion === -1) {
					documentVersion = autofix.documentVersion;
				}
				if (autofix.problem.rule === ruleId && !overlaps(getLastEdit(same), autofix)) {
					same.push(autofix);
				}
				if (!overlaps(getLastEdit(all), autofix)) {
					all.push(autofix);
				}
			}

			// if the same rule warning exists more than once, provide a command to fix all these warnings
			if (same.length > 1) {
				let label = `Fix all: ${same[0].problem.rule}`;
				const resultFix = concatenateEdits(same);
				
				let command = Command.create(
					label,
					CommandIds.applySameFixes,
					uri,
					documentVersion, 
					resultFix
				);
				
				result.push(
					CodeAction.create(
						label,
						command,
						CodeActionKind.QuickFix
					)
				);
			}

			// create a command to fix all the warnings with fixes
			if (all.length > 1) {
				let label = `Fix all auto-fixable problems`;
				let command = Command.create(
					label,
					CommandIds.applyAllFixes,
					uri,
					documentVersion,
					concatenateEdits(all)
				);
				// Contribute both a kind = Source and kind = Quick Fix. Then
				// action appears in the light bulb (for backward compatibility) and the Source... quick pick.
				result.push(
					CodeAction.create(
						`${label} (stlint)`,
						command,
						CodeActionKind.Source
					),
					CodeAction.create(
						label,
						command,
						CodeActionKind.QuickFix
					),

				);
			}
		}
	}
	
	
	return result;
});

connection.onRequest(AllFixesRequest.type, async (params) => {
	let result: AllFixesResult | undefined = undefined;
	let uri = params.textDocument.uri;
	let document = documents.get(uri);

	if (!document) {
		return undefined;
	}


	let documentFixes = codeFixActions[uri];
	let documentVersion: number = -1;

	if (!documentFixes) {
		return undefined;
	}

	let fixes: AutoFix[] = Object.keys(documentFixes).map(key => documentFixes[key]);

	for (let fix of fixes) {
		if (documentVersion === -1) {
			documentVersion = fix.documentVersion;
			break;
		}
	}

	let [allFixes, overlappingEdits] = getAllNonOverlappingFixes(fixes);

	result = {
		documentVersion: documentVersion,
		edits: concatenateEdits(allFixes),
		overlappingFixes: overlappingEdits
	};
	
	return result;
});

let configFile: string;

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;

	let workspaceFolder = params.rootPath;

	configFile = workspaceFolder + '/.stlintrc';
	if (!fs.existsSync(configFile)) {
		configFile = workspaceFolder + '/stlintrc.json';
	}
	if (!fs.existsSync(configFile)) {
		configFile = workspaceFolder + '/stlintrc.js';
	}

	// Does the client support the `workspace/configuration` request?
	// If not, we will fall back using global settings
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);

	return {
		capabilities: {
			codeActionProvider: true,
			textDocumentSync: documents.syncKind
		}
	};
});

connection.onInitialized((params) => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// The example settings
interface ExampleSettings {
	enable: boolean;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { 
	enable: true 
};

let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings.languageServerExample || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
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

async function validateTextDocument(textDocument: TextDocument): Promise<void> {

	let settings = await getDocumentSettings(textDocument.uri);

	if (!settings.enable) {
		return undefined;
	}

	let content = textDocument.getText();

	let diagnostics: Diagnostic[] = [];

	const linter = new Linter(fs.existsSync(configFile) ? {
		config: configFile
	} : {});
	
	linter.lint(getFilePath(textDocument), content);
	const response = linter.reporter.response;
	
	if (!response.passed && response.errors && response.errors.length) {
		response.errors.forEach((error) => {
			error.message.forEach((msg) => {
				let diagnostic: Diagnostic = {
					severity: DiagnosticSeverity.Error,
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
}

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();