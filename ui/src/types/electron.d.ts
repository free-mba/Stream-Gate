export { };

declare global {
    interface Window {
        require: (module: 'electron') => { ipcRenderer: Electron.IpcRenderer };
    }
}
