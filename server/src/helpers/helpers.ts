import { AutofixEdit, AutoFix, Is } from "./types";
import { TextEdit, TextDocument, Diagnostic, Position } from "vscode-languageserver";
import URI from "vscode-uri";

export function computeKey(diagnostic: Diagnostic): string {
	let range = diagnostic.range;
	return `[${range.start.line},${range.start.character},${range.end.line},${range.end.character}]-${diagnostic.code}`;
}

export function sortFixes(fixes: AutoFix[]): AutoFix[] {
	// The AutoFix.edits are sorted, so we sort on the first edit
	return fixes.sort((a, b) => {
		let editA: AutofixEdit = a.edits[0];
		let editB: AutofixEdit = b.edits[0];

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

export function getLastEdit(array: AutoFix[]): AutoFix | undefined {
	let length = array.length;
	if (length === 0) {
		return undefined;
	}
	return array[length - 1];
}

export function overlaps(lastFix: AutoFix | undefined, nextFix: AutoFix): boolean {
	if (!lastFix) {
		return false;
	}
	let doesOverlap = false;
	lastFix.edits.some(last => {
		return nextFix.edits.some(next => {
			if (last.range.end.line > next.range.start.line) {
				doesOverlap = true;
				return true;
			} else if (last.range.end.line < next.range.start.line) {
				return false;
			} else if (last.range.end.character >= next.range.start.character) {
				doesOverlap = true;
				return true;
			}
			return false;
		});
	});
	return doesOverlap;
}

export function createTextEdit(autoFix: AutoFix): TextEdit[] {
	return autoFix.edits.map(each => TextEdit.replace(each.range, each.text || ''));
}

export function concatenateEdits(fixes: AutoFix[]): TextEdit[] {
	let textEdits: TextEdit[] = [];
	
	fixes.forEach(each => {
		textEdits = textEdits.concat(createTextEdit(each));
	});
	
	return textEdits;
}

export function getFileSystemPath(uri: URI): string {
    let result = uri.fsPath;
	
	if (process.platform === 'win32' && result.length >= 2 && result[1] === ':') {
        return result[0].toUpperCase() + result.substr(1);
	}
	
    return result;
}

export function getFilePath(documentOrUri: string | TextDocument): string {
    if (!documentOrUri) {
        return undefined;
    }
	
	let uri = Is.string(documentOrUri) ? URI.parse(documentOrUri) : URI.parse(documentOrUri.uri);
	
	if (uri.scheme !== 'file') {
        return undefined;
    }
	
	return getFileSystemPath(uri);
}

export function getAllNonOverlappingFixes(fixes: AutoFix[]): [AutoFix[], boolean] {
	let nonOverlapping: AutoFix[] = [];
	let hasOverlappingFixes = false;
	fixes = sortFixes(fixes);
	for (let autofix of fixes) {
		if (!overlaps(getLastEdit(nonOverlapping), autofix)) {
			nonOverlapping.push(autofix);
		} else {
			hasOverlappingFixes = true;
		}
	}
	return [nonOverlapping, hasOverlappingFixes];
}