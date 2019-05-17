# VS Code StLint extension

## Description

Integrates [StLint](https://github.com/stylus/stlint) into VS Code. If you are new to StLint check the [documentation](https://github.com/stylus/stlint).

The extension uses the StLint library installed in the opened workspace folder. If the folder doesn't provide one the extension looks for a global install version. If you haven't installed StLint either locally or globally do so by running `npm install stlint` in the workspace folder for a local install or `npm install -g stlint` for a global install.

On new folders you might also need to create a `.stlintrc` configuration file. The extension will search for an `.stlintrc` file on the workspace folder root.

## Installation

### Via Visual Studio Code

1. Press <kbd>Ctrl</kbd> + <kbd>P</kbd> to open the _Go to File..._ view
2. Type `ext install xdan.stlint-vscode-plugin` and press <kbd>Enter</kbd>

### From VSIX

1. Download the `.vsix` file of the latest [release from GitHub](https://github.com/stylus/stlint-vscode-plugin/releases)
2. Run `code --install-extension stlint-vscode-plugin-*.*.*.vsix` in the command line ([reference](https://code.visualstudio.com/docs/editor/extension-gallery#_install-from-a-vsix))

## Settings Options

This extension contributes the following variables to the [settings](https://code.visualstudio.com/docs/customization/userandworkspace):

- `stlint.enable`: enable/disable stlint. Is enabled by default.
- `stlint.stlintrcPath`: The path to the `.stlintrc` file. When no `.stlintrc` file is found the [default options](https://github.com/stylus/stlint#options) are used.
- `stlint.packageManager`: controls the package manager to be used to resolve the Stlint library. This has only an influence if the Stlint library is resolved globally. Valid values are "npm" or "yarn".
- `stlint.run`: run the linter `onSave` or `onType`, default is `onType`.
- `stlint.nodePath`: use this setting if an installed Stlint package can't be detected, for example `/myGlobalNodePackages/node_modules`.
- `stlint.alwaysShowStatus`: Always show the Stlint status bar item.
- `stlint.trace.server`: Traces the communication between VSCode and the stlint linter service.
- `stlint.workingDirectories` - an array for working directories to be used. Stlint resolves configuration files relative to a working directory. This new settings allows users to control which working directory is used for which files. Consider the following setups:
  ```
  client/
    .stlintignore
    .stlintrc
    client.styl
  server/
    .stlintignore
    .stlintrc
    server.styl
  ```
  Then using the setting:
  ```json
    "stlint.workingDirectories": [
      "./client", "./server"
    ]
  ```
  will validate files inside the server directory with the server directory as the current working directory. Same for files   in the client directory. If the setting is omitted the working directory is the workspace folder.

  The setting also supports literals of the form `{ "directory": string, "changeProcessCWD": boolean }` as elements. Use this   form if you want to instruct Stlint to change the current working directory of the Stlint validation process to the value   of `directory` as well.

## Commands:

This extension contributes the following commands to the Command palette.

- `Disable Stlint for this Workspace`: disables Stlint extension for this workspace.
- `Enable Stlint for this Workspace`: enable Stlint extension for this workspace.
- `stylint.showOutputChannel`: show the output channel of the Stlint extension.

## Contribution

If you found a bug or are missing a feature do not hesitate to [file an issue](https://github.com/stylus/stlint-vscode-plugin/issues/new/choose).  
Pull Requests are welcome!

## Support
When you like this extension make sure to [star the repo](https://github.com/stylus/stlint-vscode-plugin/stargazers) and [write a review](https://marketplace.visualstudio.com/items?itemName=xdan.stlint-vscode-plugin#review-details). I am always looking for new ideas and feedback. 
