import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export async function checkSystemProxyStatus(): Promise<boolean> {
    const platform = process.platform;

    try {
        if (platform === 'darwin') {
            // macOS: Check if proxy is enabled on any interface
            try {
                const { stdout } = await execAsync('networksetup -listallnetworkservices');
                const services = stdout.split('\n').filter(line => line.trim() && !line.includes('*') && !line.includes('An asterisk'));

                const preferredInterfaces = ['Wi-Fi', 'Ethernet', 'USB 10/100/1000 LAN', 'Thunderbolt Bridge'];

                for (const preferred of preferredInterfaces) {
                    const matching = services.find(s => s.includes(preferred) || s.toLowerCase().includes(preferred.toLowerCase()));
                    if (matching) {
                        try {
                            const iface = matching.trim();
                            const { stdout: proxyStatus } = await execAsync(`networksetup -getwebproxy "${iface}"`);
                            if (proxyStatus.includes('Enabled: Yes') && proxyStatus.includes('127.0.0.1') && proxyStatus.includes('8080')) {
                                return true;
                            }
                        } catch (err) {
                            continue;
                        }
                    }
                }

                // Check first available interface
                if (services.length > 0) {
                    try {
                        const iface = services[0].trim();
                        const { stdout: proxyStatus } = await execAsync(`networksetup -getwebproxy "${iface}"`);
                        if (proxyStatus.includes('Enabled: Yes') && proxyStatus.includes('127.0.0.1') && proxyStatus.includes('8080')) {
                            return true;
                        }
                    } catch (err) {
                        // Ignore
                    }
                }
            } catch (err) {
                return false;
            }
        } else if (platform === 'win32') {
            // Windows: Check netsh proxy settings
            try {
                const { stdout } = await execAsync('netsh winhttp show proxy');
                if (stdout.includes('127.0.0.1:8080') || (stdout.includes('127.0.0.1') && stdout.includes('8080'))) {
                    return true;
                }
            } catch (err) {
                return false;
            }
        }

        return false;
    } catch (err) {
        return false;
    }
}
