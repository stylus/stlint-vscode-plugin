import { Range, RequestType, TextEdit, TextDocumentIdentifier } from 'vscode-languageserver';
export interface RuleFailure {
    fix: null | {
        replace: string;
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
export declare namespace Is {
    function boolean(value: any): value is boolean;
    function string(value: any): value is string;
}
export declare namespace CommandIds {
    const applySingleFix: string;
    const applySameFixes: string;
    const applyAllFixes: string;
    const applyAutoFix: string;
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
export declare namespace AllFixesRequest {
    const type: RequestType<AllFixesParams, AllFixesResult, void, void>;
}
