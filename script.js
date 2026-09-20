
// ============ STATE ============
let storyData = null;
let currentSlide = 0;
let slides = [];

// ============ DOM ============
const screens = {
    input: document.getElementById('screen-input'),
    loading: document.getElementById('screen-loading'),
    story: document.getElementById('screen-story'),
};

const usernameInput = document.getElementById('username-input');
const generateBtn = document.getElementById('generate-btn');
const errorMsg = document.getElementById('error-msg');
const slideContainer = document.getElementById('slide-container');
const progressDots = document.getElementById('progress-dots');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const restartBtn = document.getElementById('restart-btn');
const shareCard = document.getElementById('share-card');

// ============ SCREEN MANAGEMENT ============
function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    if (screens[name]) screens[name].classList.add('active');
}

// ============ GITHUB API ============
async function ghFetch(path, signal) {
    const res = await fetch(`${GITHUB_API}${path}`, {
        headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
            Accept: 'application/vnd.github+json',
        },
        signal,
    });
    if (!res.ok) {
        if (res.status === 404) throw new Error('User not found. Check the spelling.');
        if (res.status === 403) throw new Error('Rate limit hit. Try again later.');
        throw new Error(`GitHub API error: ${res.status}`);
    }
    return res.json();
}

async function fetchUserData(username, signal) {
    const user = await ghFetch(`/users/${username}`, signal);
    const repos = await ghFetch(`/users/${username}/repos?per_page=100&sort=updated`, signal);
    const events = await ghFetch(`/users/${username}/events?per_page=100`, signal);

    const totalStars = repos.reduce((sum, r) => sum + r.stargazers_count, 0);
    const topRepo = repos.reduce((best, r) => (r.stargazers_count > (best?.stargazers_count ?? -1) ? r : best), null);

    const langCounts = {};
    repos.forEach(r => { if (r.language) langCounts[r.language] = (langCounts[r.language] || 0) + 1; });
    const topLanguages = Object.entries(langCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

    const joinYear = new Date(user.created_at).getFullYear();
    const yearsOnGitHub = new Date().getFullYear() - joinYear;

    return {
        username: user.login, name: user.name || user.login, avatar: user.avatar_url,
        bio: user.bio || '', company: user.company || '', location: user.location || '', blog: user.blog || '', twitter: user.twitter_username || '',
        followers: user.followers, publicRepos: user.public_repos,
        joinYear, yearsOnGitHub, totalStars, topRepo, topLanguages, events,
    };
}

// ============ ARCHETYPE ALGORITHM ============
function determineArchetype(d) {
    const langs = d.topLanguages.map(l => l[0].toLowerCase());
    const totalLangs = d.topLanguages.length;

    if (totalLangs >= 3 && d.publicRepos > 30) {
        return { title: "The Polyglot Explorer", emoji: "🌍", desc: "You speak more languages than a UN translator. Versatility is your superpower." };
    }
    if (langs.includes('rust') || langs.includes('c++') || langs.includes('c') || langs.includes('go')) {
        return { title: "The Systems Architect", emoji: "🦀", desc: "You build the foundations others stand on. Performance and memory are your playground." };
    }
    if (langs.includes('python') && d.totalStars > 50) {
        return { title: "The Open Source Scientist", emoji: "🧪", desc: "You turn complex ideas into elegant code that the community loves to use." };
    }
    if (langs.includes('javascript') || langs.includes('typescript')) {
        return { title: "The Full-Stack Builder", emoji: "🚀", desc: "From the database to the DOM, you build experiences that users love." };
    }
    if (langs.includes('html') || langs.includes('css')) {
        return { title: "The Pixel Perfectionist", emoji: "🎨", desc: "You believe that code should not only work but look beautiful doing it." };
    }
    if (d.publicRepos > 20) {
        return { title: "The Serial Shipper", emoji: "📦", desc: "You ship fast, learn faster, and never let a project gather dust." };
    }
    return { title: "The Code Explorer", emoji: "🧭", desc: "You're on a journey, learning and building one commit at a time." };
}

// ============ SLIDE BUILDERS ============
function buildSlides(d) {
    const slides = [];

    slides.push({
        label: 'This is the story of',
        html: `<img src="${d.avatar}" alt="${d.username}" class="avatar" /><div class="big gradient-text">${d.name}</div><div class="sub">@${d.username}</div>`,
    });

    // Slide 2: Bio Card (Only if they have a bio/company/location)
    if (d.bio || d.company || d.location || d.blog || d.twitter) {
        const bioItems = [];
        if (d.bio) bioItems.push(`<div class="bio-text">"${d.bio}"</div>`);
        if (d.company) bioItems.push(`<div class="bio-item">🏢 ${d.company}</div>`);
        if (d.location) bioItems.push(`<div class="bio-item">📍 ${d.location}</div>`);
        if (d.blog) bioItems.push(`<div class="bio-item">🔗 ${d.blog}</div>`);
        if (d.twitter) bioItems.push(`<div class="bio-item">🐦 @${d.twitter}</div>`);

        slides.push({
            label: 'Behind the code',
            html: `<div class="big gradient-text">Who is ${d.name.split(' ')[0]}?</div><div class="bio-container">${bioItems.join('')}</div>`,
        });
    }

    // Slide 3: Archetype
    const archetype = determineArchetype(d);
    slides.push({
        label: 'Your developer DNA',
        html: `
        <div class="big gradient-text">${archetype.title}</div>
        <div style="font-size: 4rem; margin: 1rem 0;">${archetype.emoji}</div>
        <div class="sub">${archetype.desc}</div>
    `,
    });

    slides.push({
        label: 'You joined GitHub in',
        html: `<div class="big gradient-text">${d.joinYear}</div><div class="sub">That's ${d.yearsOnGitHub} year${d.yearsOnGitHub === 1 ? '' : 's'} of shipping code.</div>`,
    });

    slides.push({
        label: 'You\'ve built',
        html: `<div class="big gradient-text">${d.publicRepos}</div><div class="sub">public repositories. Each one a story.</div>`,
    });

    slides.push({
        label: 'The community has given you',
        html: `<div class="big gradient-text">${d.totalStars.toLocaleString()}</div><div class="sub">stars across all your projects.</div>`,
    });

    if (d.topLanguages.length > 0) {
        const pills = d.topLanguages.map(([lang, count]) =>
            `<div class="lang-pill">${lang} <span>· ${count}</span></div>`
        ).join('');
        slides.push({
            label: 'Your top languages',
            html: `<div class="big gradient-text">${d.topLanguages[0][0]}</div><div style="margin-top: 1.5rem;">${pills}</div>`,
        });
    }

    if (d.topRepo) {
        slides.push({
            label: 'Your most-loved project',
            html: `<div class="big gradient-text">${d.topRepo.name}</div><div class="sub">⭐ ${d.topRepo.stargazers_count.toLocaleString()} stars</div>`,
        });
    }

    // Heatmap slide
    if (d.events && d.events.length > 0) {
        const today = new Date();
        const days = [];
        for (let i = 89; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const count = d.events.filter(e => e.created_at.startsWith(dateStr)).length;
            days.push({ date: dateStr, count });
        }
        const maxCount = Math.max(...days.map(d => d.count), 1);
        const colors = ['rgba(255,255,255,0.05)', '#3b0764', '#7c3aed', '#a855f7', '#06b6d4'];
        const heatmapHtml = days.map(day => {
            const intensity = day.count === 0 ? 0 : Math.min(Math.ceil((day.count / maxCount) * 4), 4);
            return `<div class="heatmap-cell" style="background: ${colors[intensity]};" title="${day.date}: ${day.count} events"></div>`;
        }).join('');

        slides.push({
            label: 'Your last 90 days',
            html: `
        <div class="big gradient-text">The Time Machine</div>
        <div class="heatmap-grid">${heatmapHtml}</div>
        <div class="sub" style="margin-top: 1rem;">Every square is a day. Every color is your effort.</div>
        `,
        });
    }

    // Final slide — Certificate preview + Download + Profile Link
    slides.push({
        label: 'You earned this',
        html: `
        <div class="big gradient-text">Your GitWrapped Card</div>
        <div class="sub">A snapshot of your developer journey. Download and share it.</div>
        <div class="final-actions">
        <button id="download-btn" class="action-btn primary-action">
            📸 Download My Card
        </button>
        <a href="https://github.com/${d.username}" target="_blank" rel="noopener noreferrer" class="action-btn secondary-action">
            👤 View GitHub Profile
        </a>
        </div>
    `,
    });

    return slides;
}

// ============ SHARE CARD BUILDER ============
function buildShareCard(d) {
    const topLang = d.topLanguages[0] ? d.topLanguages[0][0] : 'Code';
    const archetype = determineArchetype(d);
    const shortBio = d.bio ? (d.bio.length > 60 ? d.bio.substring(0, 60) + '...' : d.bio) : 'Building the future, one commit at a time.';

    shareCard.innerHTML = `
    <div class="share-header">
        <div class="share-logo">Git<span>Wrapped</span></div>
        <div class="share-year">${new Date().getFullYear()}</div>
    </div>

    <div class="share-profile">
        <img src="${d.avatar}" class="share-avatar" crossorigin="anonymous" />
        <div>
        <div class="share-name">${d.name}</div>
        <div class="share-username">@${d.username}</div>
        </div>
    </div>

    <div class="share-bio">"${shortBio}"</div>

    <div class="share-archetype">
        <div class="share-archetype-emoji">${archetype.emoji}</div>
        <div class="share-archetype-title">${archetype.title}</div>
    </div>

    <div class="share-stats">
        <div class="share-stat">
        <div class="share-stat-value">${d.publicRepos}</div>
        <div class="share-stat-label">Repos</div>
        </div>
        <div class="share-stat">
        <div class="share-stat-value">${d.totalStars.toLocaleString()}</div>
        <div class="share-stat-label">Stars</div>
        </div>
        <div class="share-stat">
        <div class="share-stat-value">${d.followers.toLocaleString()}</div>
        <div class="share-stat-label">Followers</div>
        </div>
        <div class="share-stat">
        <div class="share-stat-value">${d.yearsOnGitHub}</div>
        <div class="share-stat-label">Years</div>
        </div>
    </div>

    <div class="share-footer">
        <div>TOP LANG · <strong>${topLang.toUpperCase()}</strong></div>
        <div>GREAT WORK!</div>
    </div>
    `;
}
// ============ RENDER STORY ============
function renderStory() {
    slides = buildSlides(storyData);
    slideContainer.innerHTML = slides.map((s, i) => `
    <div class="slide ${i === 0 ? 'active' : ''}" data-index="${i}">
        <div class="label">${s.label}</div>${s.html}
    </div>
    `).join('');

    progressDots.innerHTML = slides.map((_, i) =>
        `<div class="dot ${i === 0 ? 'active' : ''}" data-index="${i}"></div>`
    ).join('');

    currentSlide = 0;
    updateControls();
    buildShareCard(storyData);
}

// ============ DOWNLOAD (event delegation = no duplicates) ============
async function downloadShareCard() {
    const btn = document.getElementById('download-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Rendering...'; }

    try {
        const canvas = await html2canvas(shareCard, {
            backgroundColor: '#06060a',
            scale: 2,
            useCORS: true,
            logging: false,
        });
        const link = document.createElement('a');
        link.download = `${storyData.username}-gitwrapped.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (err) {
        console.error('Download failed:', err);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '📸 Download My Card'; }
    }
}

// Single global listener (fixes the multi-download bug)
document.addEventListener('click', (e) => {
    if (e.target.closest('#download-btn')) {
        e.preventDefault();
        downloadShareCard();
    }
});

// ============ NAVIGATION ============
function goToSlide(index) {
    document.querySelectorAll('.slide')[currentSlide]?.classList.remove('active');
    document.querySelectorAll('.dot')[currentSlide]?.classList.remove('active');
    currentSlide = index;
    document.querySelectorAll('.slide')[currentSlide]?.classList.add('active');
    document.querySelectorAll('.dot')[currentSlide]?.classList.add('active');
    updateControls();
}

function updateControls() {
    prevBtn.disabled = currentSlide === 0;
    nextBtn.disabled = currentSlide === slides.length - 1;
}

// ============ EVENT HANDLERS ============
async function handleGenerate() {
    const username = usernameInput.value.trim();

    if (GITHUB_TOKEN === '' || !GITHUB_TOKEN) {
        errorMsg.textContent = 'Please add your GitHub token in config.js';
        return;
    }
    if (!username) {
        errorMsg.textContent = 'Please enter a username.';
        return;
    }

    errorMsg.textContent = '';
    generateBtn.disabled = true;
    showScreen('loading');

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        storyData = await fetchUserData(username, controller.signal);
        clearTimeout(timeoutId);
        renderStory();
        showScreen('story');
    } catch (err) {
        showScreen('input');
        errorMsg.textContent = err.name === 'AbortError'
            ? 'Request timed out. Check your connection.'
            : err.message;
    } finally {
        generateBtn.disabled = false;
    }
}

generateBtn.addEventListener('click', handleGenerate);
usernameInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleGenerate(); });
prevBtn.addEventListener('click', () => { if (currentSlide > 0) goToSlide(currentSlide - 1); });
nextBtn.addEventListener('click', () => { if (currentSlide < slides.length - 1) goToSlide(currentSlide + 1); });

restartBtn.addEventListener('click', () => {
    usernameInput.value = '';
    slideContainer.innerHTML = '';
    progressDots.innerHTML = '';
    errorMsg.textContent = '';
    currentSlide = 0;
    slides = [];
    storyData = null;
    showScreen('input');
});

document.addEventListener('keydown', e => {
    if (!screens.story.classList.contains('active')) return;
    if (e.key === 'ArrowRight' && currentSlide < slides.length - 1) goToSlide(currentSlide + 1);
    if (e.key === 'ArrowLeft' && currentSlide > 0) goToSlide(currentSlide - 1);
});