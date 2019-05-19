/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import { workspace, ExtensionContext, commands, TextEdit, window, TextDocument } from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind,
	State as ClientState,
	RequestType,
	TextDocumentIdentifier
} from 'vscode-languageclient';

export interface AllFixesParams {
	textDocument: TextDocumentIdentifier;
	isOnSave: boolean;
}

export interface AllFixesResult {
	documentVersion: number;
	edits: TextEdit[];
	overlappingFixes: boolean;
}
export namespace AllFixesRequest {
	export const type = new RequestType<AllFixesParams, AllFixesResult, void, void>('textDocument/stlint/allFixes');
}

export namespace CommandIds {
    export const applySingleFix: string = 'stlint.applySingleFix';
    export const applySameFixes: string = 'stlint.applySameFixes';
    export const applyAllFixes: string = 'stlint.applyAllFixes';
    export const applyAutoFix: string = 'stlint.applyAutoFix';
}

let client: LanguageClient;

async function applyTextEdits(uri: string, documentVersion: number, edits: TextEdit[]): Promise<boolean> {
	let textEditor = window.activeTextEditor;
	
	if (textEditor && textEditor.document.uri.toString() === uri) {
		if (documentVersion !== -1 && textEditor.document.version !== documentVersion) {
			window.showInformationMessage(`StLint fixes are outdated and can't be applied to the document.`);
			return true;
		}

		return textEditor.edit(mutator => {
			for (let edit of edits) {
				mutator.replace(client.protocol2CodeConverter.asRange(edit.range), edit.newText);
			}
		});
	}
	
	return true;
}

let serverRunning: boolean = false;

function fixAllProblems(): Thenable<any> | undefined {
	// server is not running so there can be no problems to fix
	if (!serverRunning) {
		return;
	}
	let textEditor = window.activeTextEditor;
	if (!textEditor) {
		return;
	}
	return doFixAllProblems(textEditor.document, undefined); // no time budget
}

function doFixAllProblems(document: TextDocument, timeBudget: number | undefined): Thenable<any> {
	let start = Date.now();
	let loopCount = 0;
	let retry = false;
	let lastVersion = document.version;

	let promise = client.sendRequest(AllFixesRequest.type, { textDocument: { uri: document.uri.toString() }, isOnSave: true }).then(async (result) => {
		while (true) {
			// console.log('duration ', Date.now() - start);
			if (timeBudget && Date.now() - start > timeBudget) {
				console.log(`StLint auto fix on save maximum time budget (${timeBudget}ms) exceeded.`);
				break;
			}
			if (loopCount++ > 10) {
				console.log(`StLint auto fix on save maximum retries exceeded.`);
				break;
			}
			if (result) {
				// ensure that document versions on the client are in sync
				if (lastVersion !== document.version) {
					window.showInformationMessage("StLint: Auto fix on save, fixes could not be applied (client version mismatch).");
					break;
				}
				retry = false;
				if (lastVersion !== result.documentVersion) {
					console.log('StLint auto fix on save, server document version different than client version');
					retry = true;  // retry to get the fixes matching the document
				} else {
					// try to apply the edits from the server
					let edits = client.protocol2CodeConverter.asTextEdits(result.edits);
					// disable version check by passing -1 as the version, the event loop is blocked during `willSave`
					let success = await applyTextEdits(document.uri.toString(), -1, edits);
					if (!success) {
						window.showInformationMessage("StLint: Auto fix on save, edits could not be applied");
						break;
					}
				}

				lastVersion = document.version;

				if (result.overlappingFixes || retry) {
					// ask for more non overlapping fixes
					result = await client.sendRequest(AllFixesRequest.type, { textDocument: { uri: document.uri.toString() }, isOnSave: true });
				} else {
					break;
				}
			} else {
				break;
			}
		}
		return null;
	});
	return promise;
}

export function activate(context: ExtensionContext) {
	// The server is implemented in node
	let serverModule = context.asAbsolutePath(
		path.join('client', 'server', 'server.js')
	);
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = {
		run: { 
			module: serverModule, transport: TransportKind.ipc 
		},
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', language: 'stylus' }],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'languageServerExample',
		'Language Server Example',
		serverOptions,
		clientOptions
	);
	
	const running = 'Linter is running.';
	const stopped = 'Linter has stopped.';
	
	client.onDidChangeState((event) => {
		if (event.newState === ClientState.Running) {
			client.info(running);
			serverRunning = true;
		} else {
			client.info(stopped);
			serverRunning = false;
		}
	});

	// Start the client. This will also launch the server

	context.subscriptions.push(
		client.start(),
		// internal commands
		commands.registerCommand(CommandIds.applySingleFix, applyTextEdits),
		commands.registerCommand(CommandIds.applySameFixes, applyTextEdits),
		commands.registerCommand(CommandIds.applyAllFixes, fixAllProblems),
	);
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	
	return client.stop();
}
