"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const archiver_1 = __importDefault(require("archiver"));
const path = __importStar(require("path"));
const tinify = __importStar(require("tinify"));
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function activate(context) {
    let directorySizesBefore = [];
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    const createZip = vscode.commands.registerCommand('static.createZip', () => {
        // The code you place here will be executed every time your command is executed
        // Display a message box to the user
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Creating zip archives...",
            cancellable: false
        }, async (progress) => {
            // Get the current workspace folders
            let workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders) {
                workspaceFolders.forEach(folder => {
                    // Get the subdirectories in each folder
                    let subdirectories = fs.readdirSync(folder.uri.fsPath).filter(subdir => {
                        return fs.statSync(path.join(folder.uri.fsPath, subdir)).isDirectory();
                    });
                    // Create a zip archive for each subdirectory
                    const regex = /^\d{2,4}x\d{2,4}$/;
                    const isCreativeDirecory = subdirectories.filter(subdir => regex.test(subdir));
                    isCreativeDirecory.forEach((subdir, i) => {
                        if (regex.test(subdir)) {
                            createZipArchive(path.join(folder.uri.fsPath, subdir));
                            let increment = (100 / (isCreativeDirecory.length - 1)) * i;
                            progress.report({
                                increment,
                                message: Math.round(increment) + '%'
                            });
                        }
                    });
                    vscode.window.showInformationMessage('All directories have been zipped!');
                });
            }
        });
    });
    const staticPreview = vscode.commands.registerCommand('static.staticPreview', () => {
        // Check if the Live Server extension is installed
        const liveServerExtension = vscode.extensions.getExtension('ritwickdey.liveServer');
        if (!liveServerExtension) {
            vscode.window.showErrorMessage('Live Server extension is not installed.');
            return;
        }
        liveServerExtension.activate();
        createPreview();
        // Start the live server after ensuring it's activated
        vscode.commands.executeCommand('extension.liveServer.goOnline').then(() => {
            // vscode.window.showInformationMessage('Live Server started successfully.');
        }, (err) => {
            vscode.window.showErrorMessage('Failed to start Live Server: ' + err);
        });
    });
    const tinyfy = vscode.commands.registerCommand('static.tinyfy', async () => {
        const config = vscode.workspace.getConfiguration('static');
        const configKey = await config.get('tinyKey') || '';
        tinify.key = configKey;
        tinify.default.key = configKey;
        if ((tinify.key && tinify.key.length > 1) || (tinify.default.key && tinify.default.key.length > 1)) {
            let totalFileSizeBefore = 0;
            let totalFileSizeAfter = 0;
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "compressing images...",
                cancellable: false
            }, async (progress) => {
                // Get the current workspace folders
                let workspaceFolders = vscode.workspace.workspaceFolders;
                if (workspaceFolders) {
                    let imagePaths = [];
                    for (const folder of workspaceFolders) {
                        // Get the subdirectories in each folder
                        let subdirectories = fs.readdirSync(folder.uri.fsPath).filter(subdir => {
                            return fs.statSync(path.join(folder.uri.fsPath, subdir)).isDirectory();
                        });
                        // Create a zip archive for each subdirectory
                        for (const subdir of subdirectories) {
                            const subdirPath = path.join(folder.uri.fsPath, subdir);
                            const files = await fs.promises.readdir(subdirPath);
                            const isSupportedImage = files.filter(file => file.endsWith('.jpg') || file.endsWith('.png'));
                            isSupportedImage.forEach((file) => {
                                imagePaths.push(path.join(subdirPath, file));
                            });
                        }
                    }
                    for (const [i, image] of imagePaths.entries()) {
                        const source = tinify.default.fromFile(image);
                        await source.toFile(image);
                        let increment = (100 / (imagePaths.length - 1)) * i;
                        progress.report({
                            increment,
                            message: Math.round(increment) + '%'
                        });
                        if (i === imagePaths.length - 1) {
                            createPreview();
                            vscode.window.showInformationMessage('All images have been compressed!');
                        }
                    }
                    vscode.window.showInformationMessage('All images have been compressed!');
                }
            });
        }
        else {
            vscode.window.showInformationMessage(`Please set your TinyPng API key in the extension settings.`);
        }
    });
    const setTinyApiKey = vscode.commands.registerCommand('static.setTinyKey', async () => {
        // Prompt the user for a new key
        const currentKey = vscode.workspace.getConfiguration('static').get('tinyKey') || '';
        const input = await vscode.window.showInputBox({
            prompt: 'Enter your TinyPng API key',
            value: currentKey // pre-fill with the current key if it exists
        });
        // If the user provided a value, update the configuration
        if (input !== undefined) {
            // Update the configuration with the new key
            await vscode.workspace.getConfiguration('static').update('tinyKey', input, true);
            vscode.window.showInformationMessage(`TinyPNG API key is updated to: ${vscode.workspace.getConfiguration('static').get('tinyKey')}`);
        }
    });
    function createZipArchive(directoryPath) {
        // Create a file to write the archive data to
        let output = fs.createWriteStream(`${directoryPath}.zip`);
        // Create a new zip archive
        let archive = (0, archiver_1.default)('zip', {
            zlib: { level: 9 } // Sets the compression level
        });
        const fileList = fs.readdirSync(directoryPath);
        const filteredFiles = fileList.filter(file => {
            if (!['less', 'scss', '.vscode', '.DS_Store'].includes(file) && !file.endsWith('.zip')) {
                archive.file(`${directoryPath}/${file}`, { name: file });
            }
        });
        // Pipe the archive data to the file
        archive.pipe(output);
        // Finalize the archive (i.e., finish appending files)
        // 'close' event is fired only when a file descriptor is involved
        archive.finalize();
    }
    function getDirectorySize(directory) {
        let totalSize = 0;
        // Read the contents of the directory
        const files = fs.readdirSync(directory);
        // Loop through each file and subdirectory
        for (const file of files) {
            const filePath = path.join(directory, file);
            if (['less', 'scss', '.vscode', '.DS_Store', 'Archive.zip'].includes(file) || path.extname(file) === '.zip') {
                totalSize += 0;
            }
            else {
                const stats = fs.statSync(filePath);
                if (stats.isDirectory()) {
                    // Recursively add the size of the subdirectory
                    totalSize += Number(getDirectorySize(filePath));
                }
                else {
                    // Add the file size
                    totalSize += stats.size;
                }
            }
        }
        // Convert to KB and round to 2 decimal places
        const totalSizeKB = Number((totalSize / 1024).toFixed(0));
        return totalSizeKB;
    }
    function createPreview() {
        // Get the current workspace folders
        let workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder is open.');
            return;
        }
        const containerFile = vscode.Uri.joinPath(workspaceFolders[0].uri, 'index.html');
        let directoryArray = [];
        let subdirectories = [];
        let directoySizes = [];
        directorySizesBefore = [];
        const regex = /^\d{2,4}x\d{2,4}$/;
        if (workspaceFolders) {
            workspaceFolders.forEach(folder => {
                // Get the subdirectories in each folder
                subdirectories = fs.readdirSync(folder.uri.fsPath).filter(subdir => {
                    const check = fs.statSync(path.join(folder.uri.fsPath, subdir)).isDirectory() && regex.test(subdir);
                    if (check) {
                        const fileSize = getDirectorySize(path.join(folder.uri.fsPath, subdir));
                        const fileSizeString = fileSize > 1000 ? (fileSize / 1000).toFixed(2) + ' MB' : fileSize + ' kB';
                        directoySizes.push(`"${fileSizeString}"`);
                        directoryArray.push(`"${subdir}"`);
                        directorySizesBefore.push(`"${fileSizeString}"`);
                    }
                    return check;
                });
            });
        }
        // Content to write to the file
        const fileContent = Buffer.from(`<!DOCTYPE html><html><head> <title>Static</title> <link rel="icon" href="data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz48IS0tIFVwbG9hZGVkIHRvOiBTVkcgUmVwbywgd3d3LnN2Z3JlcG8uY29tLCBHZW5lcmF0b3I6IFNWRyBSZXBvIE1peGVyIFRvb2xzIC0tPgo8c3ZnIHdpZHRoPSI4MDBweCIgaGVpZ2h0PSI4MDBweCIgdmlld0JveD0iMCAwIDUxMiA1MTIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZmlsbD0iI2ZmZiIgZD0iTTE0Mi43IDE4LjcyTDIwIDc3LjU2djIwLjcybDEyMC4zLTU3LjcyTDIwIDEzMnYxMTIuN2wxMjkuNC00Ni44LTYzLjQtOS4zIDE4OC00NS44TDIwIDMyNi41VjM3MGwzNDkuNi0xODkuNi04MS4xIDE4LjMgMTE1LjItNzEuNCA5MS42LTM0LjU4di0yMEM0MzIgMTAxLjQgMzY4IDExNS4yIDMwMSAxMzEuNmw0NC40LTMwLjIgMTQ5LjktNzIuODF2LTkuODdoLTIyLjVDMzkzLjIgNjMuODMgMzEwLjYgODkuODYgMjI0LjcgMTE5LjdMMzgzLjUgMTguNzJIMzAyTDExMi4zIDExNC4xbDEyMi4yLTk1LjM4ek00OTUuMyAxNDMuM0wyMzAuNiAyOTkuNmwxNTAuNS0zOS4xTDc4LjcyIDQxOC43bDEwMi4zOC05MC44TDIwIDQwOXY4NWgzMi45NFMyMjMgMzkyLjggMzE3LjMgMzU0LjdMMjQ3IDQwN2wxMTIuNi0zNC40LTIxNi4yIDExOS41IDI4Ni0xMDIuMS04MiA1Ny42TDQ5NS4zIDQwNlYyOTguNGwtMTM5LjkgNTIuMyA3Mi43LTU4LjUtMTMzLjcgNDcuMiAxNzctMTE1LjEtMjQuOSA0Mi41IDQ4LjgtMTguNXYtMTA1eiIvPjwvc3ZnPg=="> <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0"/> <style>body{margin:0; padding:0; background-color:#333; font-family: sans-serif; user-select: none;}#grid{display: flex; flex-wrap: wrap; justify-content: space-evenly; padding: 20px; gap: 20px;}.creativeContainer{display: flex; flex-direction: column;}.header{display: flex; justify-content: space-between; margin-bottom: 3px;}.title{color: #999; font-size: 14px;}.directoySize{color: #999; font-size: 14px;}.refresh{width: 16px; height: auto; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Cpath fill='%23999' d='M35.3 12.7c-2.89-2.9-6.88-4.7-11.3-4.7-8.84 0-15.98 7.16-15.98 16s7.14 16 15.98 16c7.45 0 13.69-5.1 15.46-12h-4.16c-1.65 4.66-6.07 8-11.3 8-6.63 0-12-5.37-12-12s5.37-12 12-12c3.31 0 6.28 1.38 8.45 3.55l-6.45 6.45h14v-14l-4.7 4.7z'/%3E%3Cpath d='M0 0h48v48h-48z' fill='none'/%3E%3C/svg%3E%0A"); background-size: contain; background-position: right center; background-repeat: no-repeat; transition: .2s background-image ease-in-out; cursor: pointer;}.refresh:hover{background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Cpath fill='%23fff' d='M35.3 12.7c-2.89-2.9-6.88-4.7-11.3-4.7-8.84 0-15.98 7.16-15.98 16s7.14 16 15.98 16c7.45 0 13.69-5.1 15.46-12h-4.16c-1.65 4.66-6.07 8-11.3 8-6.63 0-12-5.37-12-12s5.37-12 12-12c3.31 0 6.28 1.38 8.45 3.55l-6.45 6.45h14v-14l-4.7 4.7z'/%3E%3Cpath d='M0 0h48v48h-48z' fill='none'/%3E%3C/svg%3E%0A");}iframe{width: auto; height: auto; border: none; background-color:#333;}</style></head><body> <div id="grid"></div><script>const creatives=[${directoryArray}]; const directoySizes=[${directoySizes}]; const grid=document.getElementById("grid"); for (let i=0; i < creatives.length; i++){const creativeContainer=document.createElement("div"); creativeContainer.classList.add("creativeContainer"); const header=document.createElement("div"); header.classList.add("header"); const title=document.createElement("div"); title.textContent=creatives[i]; title.classList.add("title"); const directoySize=document.createElement("div"); directoySize.textContent=directoySizes[i]; directoySize.classList.add("directoySize"); const iframe=document.createElement("iframe"); iframe.src="/" + creatives[i] + "/index.html"; iframe.style.width=creatives[i].split("x")[0]+"px"; iframe.style.height=creatives[i].split("x")[1]+"px"; const refreshButton=document.createElement("div"); refreshButton.classList.add("refresh"); refreshButton.addEventListener("click", ()=>{iframe.contentWindow.location.reload();}); header.appendChild(title); header.appendChild(directoySize); header.appendChild(refreshButton); creativeContainer.appendChild(header); creativeContainer.appendChild(iframe); grid.appendChild(creativeContainer);}</script></body></html>`, 'utf8');
        // Write the content to the file using VSCode's FileSystem API
        try {
            vscode.workspace.fs.writeFile(containerFile, fileContent);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to create container index file: ${error}`);
        }
    }
}
// This method is called when your extension is deactivated
function deactivate() { }
//# sourceMappingURL=extension.js.map