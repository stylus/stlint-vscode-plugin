import {
	Range, RequestType, TextEdit, TextDocumentIdentifier
} from 'vscode-languageserver';

export interface RuleFailure {
	fix: null | {
		replace: string
	};
	rule: string;
	descr: string;
}

export interface AutofixEdit {
	range: Range;
	text: string;
}

export interface AutoFix {
	label: string;
	documentVersion: number;
	problem: RuleFailure;
	edits: AutofixEdit[];
}

export namespace Is {
    const toString = Object.prototype.toString;

    export function boolean(value: any): value is boolean {
        return value === true || value === false;
    }

    export function string(value: any): value is string {
        return toString.call(value) === '[object String]';
    }
}

export namespace CommandIds {
    export const applySingleFix: string = 'stlint.applySingleFix';
    export const applySameFixes: string = 'stlint.applySameFixes';
    export const applyAllFixes: string = 'stlint.applyAllFixes';
    export const applyAutoFix: string = 'stlint.applyAutoFix';
}

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
