const REPO = 'free-mba/Stream-Gate';

async function fetchLatestRelease() {
    try {
        const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
        if (!response.ok) throw new Error('Failed to fetch release');

        const data = await response.json();
        renderRelease(data);
    } catch (error) {
        console.error('Error fetching release:', error);
        document.getElementById('loading-releases').innerText = 'Failed to connect to orbital data.';
    }
}

function renderRelease(release) {
    const versionBadge = document.getElementById('latest-version-badge');
    versionBadge.innerText = `Latest Release: ${release.tag_name}`;

    const loadingElem = document.getElementById('loading-releases');
    const cardsGrid = document.getElementById('release-cards');

    const assets = release.assets;
    const platforms = [
        {
            name: 'macOS (Universal)',
            pattern: /Stream-Gate-macOS-(ARM64|Intel)\.dmg$/, // Just take one or both
            icon: '🍎',
            label: 'Download DMG'
        },
        {
            name: 'Windows',
            pattern: /Stream-Gate-Windows-x64\.exe$/,
            icon: '🪟',
            label: 'Download EXE'
        },
        {
            name: 'Linux',
            pattern: /Stream-Gate-Linux-x64\.(AppImage|deb)$/,
            icon: '🐧',
            label: 'Download AppImage/DEB'
        }
    ];

    // Filter and group assets
    const platformData = platforms.map(p => {
        const matchingAssets = assets.filter(a => p.pattern.test(a.name));
        return { ...p, assets: matchingAssets };
    }).filter(p => p.assets.length > 0);

    const html = platformData.map(p => {
        return `
            <div class="download-card">
                <div class="feature-icon">${p.icon}</div>
                <h4>${p.name}</h4>
                <p class="card-meta">Version ${release.tag_name}</p>
                ${p.assets.map(a => `
                    <a href="${a.browser_download_url}" class="btn-download" style="margin-top: 10px;">
                        ${a.name.endsWith('.dmg') ? 'macOS DMG' :
                a.name.endsWith('.exe') ? 'Windows Installer' :
                    a.name.endsWith('.AppImage') ? 'Linux AppImage' : 'Linux DEB'} 
                        (${(a.size / 1024 / 1024).toFixed(1)} MB)
                    </a>
                `).join('')}
            </div>
        `;
    }).join('');

    loadingElem.style.display = 'none';
    cardsGrid.innerHTML = html;
    cardsGrid.style.display = 'grid';
}

document.addEventListener('DOMContentLoaded', fetchLatestRelease);
