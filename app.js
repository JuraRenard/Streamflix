/* ============================================================
   StreamFlix - Shared Core Logic
   ============================================================ */

// ============================================
// CONFIGURATION - INSERT YOUR TMDB API KEY HERE
// ============================================
const TMDB_API_KEY = "01038440df5d0557e2dbced6f0577488";
const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p/";

// ============================================
// MAIN APP NAMESPACE
// ============================================
const App = {
    state: {
        theme: localStorage.getItem('theme') || 'dark',
        cache: new Map()
    },

    // ============================================
    // INITIALIZATION
    // ============================================
    init(pageName) {
        if (TMDB_API_KEY === "YOUR_TMDB_API_KEY" || !TMDB_API_KEY) {
            document.body.innerHTML = `
                <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;text-align:center;background:#0a0a0f;color:white;font-family:Poppins,sans-serif">
                    <div>
                        <i class="fas fa-key" style="font-size:4rem;color:#e50914;margin-bottom:1rem"></i>
                        <h1>API Key Required</h1>
                        <p style="color:#b3b3b3;margin-top:1rem">Insert your TMDB API key in <code>app.js</code></p>
                    </div>
                </div>`;
            return;
        }

        this.components.renderNavbar(pageName);
        this.components.renderFooter();
        this.setupGlobalEvents();
        this.applyTheme(this.state.theme);
    },

    // ============================================
    // API MODULE
    // ============================================
    api: {
        async request(endpoint, params = {}) {
            const url = new URL(`${TMDB_BASE}${endpoint}`);
            url.searchParams.append('api_key', TMDB_API_KEY);
            url.searchParams.append('language', 'en-US');
            Object.entries(params).forEach(([k, v]) => {
                if (v !== undefined && v !== null && v !== '') url.searchParams.append(k, v);
            });

            const cacheKey = url.toString();
            if (App.state.cache.has(cacheKey)) return App.state.cache.get(cacheKey);

            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                if (data.status_code) throw new Error(data.status_message);
                App.state.cache.set(cacheKey, data);
                return data;
            } catch (err) {
                console.error('API Error:', err);
                App.ui.showToast(`Error: ${err.message}`, 'error');
                throw err;
            }
        },

        getTrending: (window = 'week') => App.api.request(`/trending/all/${window}`),
        getPopularMovies: (page = 1) => App.api.request('/movie/popular', { page }),
        getTopRated: (type, page = 1) => App.api.request(`/${type}/top_rated`, { page }),
        getPopularTv: (page = 1) => App.api.request('/tv/popular', { page }),
        getUpcoming: (page = 1) => App.api.request('/movie/upcoming', { page }),
        getNowPlaying: (page = 1) => App.api.request('/movie/now_playing', { page }),
        getAiringToday: (page = 1) => App.api.request('/tv/airing_today', { page }),
        getOnTheAir: (page = 1) => App.api.request('/tv/on_the_air', { page }),
        getGenres: (type) => App.api.request(`/genre/${type}/list`),
        getDetails: (type, id) => App.api.request(`/${type}/${id}`),
        getSimilar: (type, id) => App.api.request(`/${type}/${id}/similar`),
        searchMulti: (query, page = 1) => App.api.request('/search/multi', { query, page }),
        
        discoverMovies: (params) => App.api.request('/discover/movie', params),
        discoverTv: (params) => App.api.request('/discover/tv', params)
    },

    // ============================================
    // STORAGE MODULE
    // ============================================
    storage: {
        MAX_RECENT: 10,

        getRecentlyWatched() {
            return JSON.parse(localStorage.getItem('recentlyWatched') || '[]');
        },

        addRecentlyWatched(item) {
            let history = this.getRecentlyWatched();
            history = history.filter(i => !(i.id === item.id && i.media_type === item.media_type));
            history.unshift({
                id: item.id,
                media_type: item.media_type,
                title: item.title || item.name,
                poster_path: item.poster_path,
                release_date: item.release_date,
                first_air_date: item.first_air_date,
                vote_average: item.vote_average,
                timestamp: Date.now()
            });
            if (history.length > this.MAX_RECENT) history = history.slice(0, this.MAX_RECENT);
            localStorage.setItem('recentlyWatched', JSON.stringify(history));
        },

        clearRecentlyWatched() {
            localStorage.removeItem('recentlyWatched');
        }
    },

    // ============================================
    // UI MODULE
    // ============================================
    ui: {
        renderCardsRow(containerId, items) {
            const container = document.getElementById(containerId);
            if (!container) return;
            container.innerHTML = '';
            const frag = document.createDocumentFragment();
            items.forEach(item => frag.appendChild(this.createCard(item)));
            container.appendChild(frag);
        },

        renderCardsGrid(containerId, items) {
            const container = document.getElementById(containerId);
            if (!container) return;
            container.innerHTML = '';
            const frag = document.createDocumentFragment();
            items.forEach(item => frag.appendChild(this.createCard(item)));
            container.appendChild(frag);
        },

        createCard(item) {
            const card = document.createElement('a');
            card.className = 'media-card';
            card.href = `watch.html?type=${item.media_type}&id=${item.id}`;
            
            const title = item.title || item.name || 'Unknown';
            const year = (item.release_date || item.first_air_date || '').substring(0, 4);
            const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
            const poster = App.utils.getImageUrl(item.poster_path);
            const type = item.media_type === 'movie' ? 'Movie' : 'TV';

            card.innerHTML = `
                <div class="card-poster-wrapper">
                    ${poster 
                        ? `<img class="card-poster" src="${poster}" alt="${title}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'card-poster-placeholder\\'><i class=\\'fas fa-film\\'></i></div>'">`
                        : `<div class="card-poster-placeholder"><i class="fas fa-film"></i></div>`
                    }
                    <div class="card-type-badge">${type}</div>
                    <div class="card-rating-badge"><i class="fas fa-star"></i> ${rating}</div>
                    <div class="card-play-overlay">
                        <div class="card-play-icon"><i class="fas fa-play"></i></div>
                    </div>
                </div>
                <div class="card-info">
                    <div class="card-title" title="${title}">${title}</div>
                    <div class="card-year">${year || 'Unknown'}</div>
                </div>
            `;
            return card;
        },

        renderSkeletons(containerId, count = 10, isGrid = false) {
            const container = document.getElementById(containerId);
            if (!container) return;
            container.innerHTML = '';
            for (let i = 0; i < count; i++) {
                const skel = document.createElement('div');
                skel.className = 'skeleton-card';
                skel.innerHTML = `<div class="skeleton-poster"></div><div class="skeleton-text"></div><div class="skeleton-text" style="width:60%;margin-bottom:0.75rem"></div>`;
                container.appendChild(skel);
            }
        },

        renderHero(item) {
            const title = item.title || item.name;
            const year = (item.release_date || item.first_air_date || '').substring(0, 4);
            const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
            const backdrop = App.utils.getImageUrl(item.backdrop_path, 'backdrop');

            document.getElementById('heroBackdrop').style.backgroundImage = `url(${backdrop})`;
            document.getElementById('heroTitle').textContent = title;
            document.getElementById('heroOverview').textContent = item.overview || '';
            document.getElementById('heroMeta').innerHTML = `
                <span><i class="fas fa-calendar"></i> ${year}</span>
                <span><i class="fas fa-star"></i> ${rating}</span>
                <span><i class="fas fa-film"></i> ${item.media_type === 'movie' ? 'Movie' : 'TV Series'}</span>
            `;
        },

        renderPagination(containerId, current, total, callback) {
            const container = document.getElementById(containerId);
            if (!container || total <= 1) { if (container) container.innerHTML = ''; return; }
            container.innerHTML = '';

            const maxVisible = 5;
            let start = Math.max(1, current - Math.floor(maxVisible / 2));
            let end = Math.min(total, start + maxVisible - 1);
            if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);

            // Prev button
            const prev = document.createElement('button');
            prev.className = 'page-btn';
            prev.innerHTML = '<i class="fas fa-chevron-left"></i>';
            prev.disabled = current === 1;
            prev.onclick = () => callback(current - 1);
            container.appendChild(prev);

            // First page + ellipsis
            if (start > 1) {
                container.appendChild(this.createPageBtn(1, current, callback));
                if (start > 2) {
                    const dots = document.createElement('span');
                    dots.textContent = '...';
                    dots.style.padding = '0 0.5rem';
                    dots.style.color = 'var(--text-muted)';
                    container.appendChild(dots);
                }
            }

            // Page numbers
            for (let i = start; i <= end; i++) {
                container.appendChild(this.createPageBtn(i, current, callback));
            }

            // Last page + ellipsis
            if (end < total) {
                if (end < total - 1) {
                    const dots = document.createElement('span');
                    dots.textContent = '...';
                    dots.style.padding = '0 0.5rem';
                    dots.style.color = 'var(--text-muted)';
                    container.appendChild(dots);
                }
                container.appendChild(this.createPageBtn(total, current, callback));
            }

            // Next button
            const next = document.createElement('button');
            next.className = 'page-btn';
            next.innerHTML = '<i class="fas fa-chevron-right"></i>';
            next.disabled = current === total;
            next.onclick = () => callback(current + 1);
            container.appendChild(next);
        },

        createPageBtn(num, current, callback) {
            const btn = document.createElement('button');
            btn.className = `page-btn ${num === current ? 'active' : ''}`;
            btn.textContent = num;
            btn.onclick = () => callback(num);
            return btn;
        },

        showToast(message, type = 'info') {
            const toast = document.getElementById('toast');
            if (!toast) return;
            toast.textContent = message;
            toast.className = `toast show ${type}`;
            setTimeout(() => toast.classList.remove('show'), 3000);
        }
    },

    // ============================================
    // COMPONENTS (Navbar & Footer)
    // ============================================
    components: {
        renderNavbar(activePage) {
            const container = document.getElementById('navbar-container');
            if (!container) return;

            const links = [
                { href: 'index.html', label: 'Home', icon: 'fa-home', id: 'home' },
                { href: 'movies.html', label: 'Movies', icon: 'fa-film', id: 'movies' },
                { href: 'tvshows.html', label: 'TV Shows', icon: 'fa-tv', id: 'tvshows' },
                { href: 'search.html', label: 'Search', icon: 'fa-search', id: 'search' },
                { href: 'history.html', label: 'History', icon: 'fa-history', id: 'history' }
            ];

            container.innerHTML = `
                <nav class="navbar">
                    <div class="nav-container">
                        <a href="index.html" class="nav-brand">
                            <i class="fas fa-film"></i>
                            <span>StreamFlix</span>
                        </a>
                        <ul class="nav-menu" id="navMenu">
                            ${links.map(l => `
                                <li>
                                    <a href="${l.href}" class="nav-link ${activePage === l.id ? 'active' : ''}">
                                        <i class="fas ${l.icon}"></i> ${l.label}
                                    </a>
                                </li>
                            `).join('')}
                        </ul>
                        <div class="nav-search">
                            <i class="fas fa-search"></i>
                            <input type="text" class="nav-search-input" id="navSearchInput" placeholder="Quick search...">
                        </div>
                        <div class="nav-actions">
                            <button class="theme-toggle" id="themeToggle" title="Toggle theme">
                                <i class="fas fa-moon"></i>
                            </button>
                            <button class="mobile-menu-btn" id="mobileMenuBtn">
                                <i class="fas fa-bars"></i>
                            </button>
                        </div>
                    </div>
                </nav>
            `;

            // Event listeners
            document.getElementById('themeToggle').addEventListener('click', () => {
                const newTheme = App.state.theme === 'dark' ? 'light' : 'dark';
                App.applyTheme(newTheme);
            });

            document.getElementById('mobileMenuBtn').addEventListener('click', () => {
                document.getElementById('navMenu').classList.toggle('active');
            });

            const navSearch = document.getElementById('navSearchInput');
            navSearch.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const q = navSearch.value.trim();
                    if (q) window.location.href = `search.html?q=${encodeURIComponent(q)}`;
                }
            });
        },

        renderFooter() {
            const container = document.getElementById('footer-container');
            if (!container) return;
            container.innerHTML = `
                <footer class="footer">
                    <div class="footer-links">
                        <a href="index.html">Home</a>
                        <a href="movies.html">Movies</a>
                        <a href="tvshows.html">TV Shows</a>
                        <a href="search.html">Search</a>
                        <a href="history.html">History</a>
                    </div>
                    <div class="footer-content">
                        <p>&copy; 2026 StreamFlix. Powered by TMDB API. For educational purposes only.</p>
                    </div>
                </footer>
            `;
        }
    },

    // ============================================
    // UTILITIES
    // ============================================
    utils: {
        getImageUrl(path, size = 'w500') {
            if (!path) return null;
            return `${IMG_BASE}${size}${path}`;
        },

        debounce(func, wait) {
            let timeout;
            return (...args) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => func(...args), wait);
            };
        },

        formatMoney(num) {
            if (!num) return 'N/A';
            return '$' + num.toLocaleString();
        }
    },

    // ============================================
    // THEME
    // ============================================
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.state.theme = theme;
        localStorage.setItem('theme', theme);
        const icon = document.querySelector('#themeToggle i');
        if (icon) icon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    },

    // ============================================
    // GLOBAL EVENTS
    // ============================================
    setupGlobalEvents() {
        const backToTop = document.getElementById('backToTop');
        if (backToTop) {
            window.addEventListener('scroll', () => {
                backToTop.classList.toggle('visible', window.scrollY > 300);
            });
            backToTop.addEventListener('click', () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }
    }
};
