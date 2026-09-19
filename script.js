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

// ============ SCREEN MANAGEMENT ============
function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    if (screens[name]) {
        screens[name].classList.add('active');
    }
}

// ============ GITHUB API ============
async function ghFetch(path, signal) {
    const res = await fetch(`${GITHUB_API}${path}`, {
        headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
            Accept: 'application/vnd.github+json',
        },
        signal: signal
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

    const totalStars = repos.reduce((sum, r) => sum + r.stargazers_count, 0);
    const totalForks = repos.reduce((sum, r) => sum + r.forks_count, 0);
    const topRepo = repos.reduce((best, r) => (r.stargazers_count > (best?.stargazers_count ?? -1) ? r : best), null);

    const langCounts = {};
    repos.forEach(r => {
        if (r.language) langCounts[r.language] = (langCounts[r.language] || 0) + 1;
    });
    const topLanguages = Object.entries(langCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

    const joinYear = new Date(user.created_at).getFullYear();
    const yearsOnGitHub = new Date().getFullYear() - joinYear;

    // 3. Fetch recent events for heatmap
    const events = await ghFetch(`/users/${username}/events?per_page=100`, signal);

    return {
        username: user.login, name: user.name || user.login, avatar: user.avatar_url,
        bio: user.bio, followers: user.followers, publicRepos: user.public_repos,
        joinYear, yearsOnGitHub, totalStars, totalForks, topRepo, topLanguages,
        repoCount: repos.length, events: events,
    };
}

// ============ SLIDE BUILDERS ============
function buildSlides(d) {
    const slides = [];

    slides.push({
        label: 'This is the story of',
        html: `<img src="${d.avatar}" alt="${d.username}" class="avatar" /><div class="big gradient-text">${d.name}</div><div class="sub">@${d.username}</div>`,
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
        const langsHtml = d.topLanguages.map(([lang, count]) =>
            `<div style="margin: 0.5rem 0; font-size: 1.2rem;"><strong>${lang}</strong> <span style="color: var(--muted);">— ${count} repo${count === 1 ? '' : 's'}</span></div>`
        ).join('');
        slides.push({
            label: 'Your top languages',
            html: `<div class="big gradient-text">${d.topLanguages[0][0]}</div><div style="margin-top: 1rem;">${langsHtml}</div>`,
        });
    }

    if (d.topRepo) {
        slides.push({
            label: 'Your most-loved project',
            html: `<div class="big gradient-text">${d.topRepo.name}</div><div class="sub">⭐ ${d.topRepo.stargazers_count.toLocaleString()} stars · 🍴 ${d.topRepo.forks_count.toLocaleString()} forks</div>`,
        });
    }

    // Slide 7: Heatmap (The 90-Day Time Machine)
    if (d.events && d.events.length > 0) {
        // Aggregate events by day for the last 90 days
        const today = new Date();
        const days = [];
        for (let i = 89; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const count = d.events.filter(e => e.created_at.startsWith(dateStr)).length;
            days.push({ date: dateStr, count: count });
        }

        const maxCount = Math.max(...days.map(d => d.count), 1);

        // Build the grid (13 weeks x 7 days = 91 days)
        const heatmapHtml = days.map(day => {
            const intensity = day.count === 0 ? 0 : Math.ceil((day.count / maxCount) * 4);
            const colors = ['#1f1f2e', '#3b0764', '#7c3aed', '#a855f7', '#06b6d4'];
            const color = colors[intensity];
            return `<div style="width: 12px; height: 12px; background: ${color}; border-radius: 2px; margin: 1px;" title="${day.date}: ${day.count} events"></div>`;
        }).join('');

        slides.push({
            label: 'Your last 90 days',
            html: `
        <div class="big gradient-text">The Time Machine</div>
        <div style="display: flex; flex-wrap: wrap; width: 196px; margin: 1.5rem auto; justify-content: center;">
            ${heatmapHtml}
        </div>
        <div class="sub">Every square is a day. Every color is your effort.</div>
        `,
        });
    }

    slides.push({
        label: 'That\'s a wrap',
        html: `<div class="big gradient-text">Keep shipping. 🚀</div><div class="sub">${d.name}, your story is still being written.</div>`,
    });

    return slides;
}

// ============ RENDER STORY ============
function renderStory() {
    slides = buildSlides(storyData);
    slideContainer.innerHTML = slides.map((s, i) => `
    <div class="slide ${i === 0 ? 'active' : ''}" data-index="${i}">
        <div class="label">${s.label}</div>${s.html}
    </div>
    `).join('');

    progressDots.innerHTML = slides.map((_, i) => `<div class="dot ${i === 0 ? 'active' : ''}" data-index="${i}"></div>`).join('');
    currentSlide = 0;
    updateControls();
}

// ============ NAVIGATION ============
function goToSlide(index) {
    const allSlides = document.querySelectorAll('.slide');
    const allDots = document.querySelectorAll('.dot');

    allSlides[currentSlide]?.classList.remove('active');
    allDots[currentSlide]?.classList.remove('active');

    currentSlide = index;

    allSlides[currentSlide]?.classList.add('active');
    allDots[currentSlide]?.classList.add('active');
    updateControls();
}

function updateControls() {
    prevBtn.disabled = currentSlide === 0;
    nextBtn.disabled = currentSlide === slides.length - 1;
}

// ============ EVENT HANDLERS ============
async function handleGenerate() {
    const username = usernameInput.value.trim();

    if (GITHUB_TOKEN === '') {
        errorMsg.textContent = 'Please add your GitHub token in script.js';
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
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        storyData = await fetchUserData(username, controller.signal);
        clearTimeout(timeoutId);

        renderStory();
        showScreen('story');
    } catch (err) {
        showScreen('input');
        if (err.name === 'AbortError') {
            errorMsg.textContent = 'Request timed out. Check your internet or token.';
        } else {
            errorMsg.textContent = err.message;
        }
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