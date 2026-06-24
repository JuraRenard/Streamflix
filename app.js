/* ============================================================
   StreamFlix - Modern Streaming Application
   ============================================================
   INSTRUCTIONS:
   1. Get your TMDB API key from: https://www.themoviedb.org/settings/api
   2. Replace "YOUR_TMDB_API_KEY" below with your actual API key
   3. Open index.html in your browser - you're ready to go!
   ============================================================ */

// ============================================
// CONFIGURATION - INSERT YOUR TMDB API KEY HERE
// ============================================
const TMDB_API_KEY = "YOUR_TMDB_API_KEY";

// Base URLs
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/";
const IMAGE_SIZES = {
    poster: "w500",
    backdrop: "w1280",
    original: "original"
};

// Embed URLs for streaming
const EMBED_URLS = {
    movie: (id) => `https://vsembed.ru/embed/movie?tmdb=${id}`,
    tv: (id) => `https://vsembed.ru/embed/tv?tmdb=${id}`
};

// ============================================
// APPLICATION STATE
// ============================================
const state = {
    searchCache: new Map(),
    detailsCache: new Map(),
    searchTimeout: null,
    currentTheme: localStorage.getItem('theme') || 'dark',
    recentlyWatched: JSON.parse(localStorage.getItem('recentlyWatched') || '[]')
};

// ============================================
// API MODULE - Handles all TMDB requests
// ============================================
const api = {
    /**
     * Make a generic fetch request to TMDB API
     */
    async request(endpoint, params = {}) {
        const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
        url.searchParams.append('api_key', TMDB_API_KEY);
        url.searchParams.append('language', 'en-US');
        
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.append(key, value);
            }
        });

        try {
            const response = await fetch(url.toString());
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Request Failed:', error);
            ui.showToast(`Error: ${error.message}`, 'error');
            throw error;
        }
    },

    /**
     * Search for movies and TV shows (multi-search)
     */
    async searchMulti(query, page = 1) {
        const cacheKey = `search_${query}_${page}`;
        if (state.searchCache.has(cacheKey)) {
            return state.searchCache.get(cacheKey);
        }
        
        const data = await this.request('/search/multi', {
            query: query,
            page: page,
            include_adult: false
        });
        
        // Filter to only movies and TV shows
        data.results = data.results.filter(item => 
            item.media_type === 'movie' || item.media_type === 'tv'
        ).slice(0, 20);
        
        state.searchCache.set(cacheKey, data);
        return data;
    },

    /**
     * Get trending content
     */
    async getTrending(timeWindow = 'week') {
        return await this.request(`/trending/all/${timeWindow}`);
    },

    /**
     * Get popular movies
     */
    async getPopularMovies(page = 1) {
        return await this.request('/movie/popular', { page });
    },

    /**
     * Get popular TV shows
     */
    async getPopularTv(page = 1) {
        return await this.request('/tv/popular', { page });
    },

    /**
     * Get detailed info for a specific movie or TV show
     */
    async getDetails(mediaType, id) {
        const cacheKey = `details_${mediaType}_${id}`;
        if (state.detailsCache.has(cacheKey)) {
            return state.detailsCache.get(cacheKey);
        }
        
        const endpoint = mediaType === 'movie' ? `/movie/${id}` : `/tv/${id}`;
        const data = await this.request(endpoint);
        
        state.detailsCache.set(cacheKey, data);
        return data;
    }
};

// ============================================
// STORAGE MODULE - LocalStorage operations
// ============================================
const storage = {
    MAX_RECENT: 10,

    /**
     * Add item to recently watched
     */
    addRecentlyWatched(item) {
        // Remove duplicate if exists
        state.recentlyWatched = state.recentlyWatched.filter(
            i => !(i.id === item.id && i.media_type === item.media_type)
        );
        
        // Add to beginning
        state.recentlyWatched.unshift({
            id: item.id,
            media_type: item.media_type,
            title: item.title || item.name,
            poster: item.poster_path,
            year: (item.release_date || item.first_air_date || '').substring(0, 4),
            rating: item.vote_average,
            timestamp: Date.now()
        });
        
        // Limit to MAX_RECENT
        if (state.recentlyWatched.length > this.MAX_RECENT) {
            state.recentlyWatched = state.recentlyWatched.slice(0, this.MAX_RECENT);
        }
        
        localStorage.setItem('recentlyWatched', JSON.stringify(state.recentlyWatched));
        ui.renderRecentlyWatched();
    },

    /**
     * Clear all recently watched items
     */
    clearRecentlyWatched() {
        state.recentlyWatched = [];
        localStorage.removeItem('recentlyWatched');
        ui.renderRecentlyWatched();
        ui.showToast('Watch history cleared', 'success');
    }
};

// ============================================
// UI MODULE - All DOM manipulation
// ============================================
const ui = {
    // Cache DOM elements
    elements: {},

    /**
     * Initialize element references
     */
    initElements() {
        this.elements = {
            navbar: document.getElementById('navbar'),
            searchInput: document.getElementById('searchInput'),
            heroSearchInput: document.getElementById('heroSearchInput'),
            searchBtn: document.getElementById('searchBtn'),
            heroSearchBtn: document.getElementById('heroSearchBtn'),
            clearBtn: document.getElementById('clearBtn'),
            suggestionsDropdown: document.getElementById('suggestionsDropdown'),
            themeToggle: document.getElementById('themeToggle'),
            trendingGrid: document.getElementById('trendingGrid'),
            popularMoviesGrid: document.getElementById('popularMoviesGrid'),
            popularTvGrid: document.getElementById('popularTvGrid'),
            searchResultsSection: document.getElementById('searchResultsSection'),
            searchResultsGrid: document.getElementById('searchResultsGrid'),
            searchResultsTitle: document.getElementById('searchResultsTitle'),
            recentlyWatchedSection: document.getElementById('recentlyWatchedSection'),
            recentlyWatchedGrid: document.getElementById('recentlyWatchedGrid'),
            clearHistoryBtn: document.getElementById('clearHistoryBtn'),
            playerModal: document.getElementById('playerModal'),
            playerCloseBtn: document.getElementById('playerCloseBtn'),
            playerIframe: document.getElementById('playerIframe'),
            playerLoader: document.getElementById('playerLoader'),
            mediaDetails: document.getElementById('mediaDetails'),
            detailsPoster: document.getElementById('detailsPoster'),
            detailsTitle: document.getElementById('detailsTitle'),
            detailsYear: document.getElementById('detailsYear'),
            detailsRatingValue: document.getElementById('detailsRatingValue'),
            detailsType: document.getElementById('detailsType'),
            detailsGenres: document.getElementById('detailsGenres'),
            detailsOverview: document.getElementById('detailsOverview'),
            detailsTmdbId: document.getElementById('detailsTmdbId'),
            backToTop: document.getElementById('backToTop'),
            toast: document.getElementById('toast'),
            trendingSection: document.getElementById('trendingSection'),
            popularMoviesSection: document.getElementById('popularMoviesSection'),
            popularTvSection: document.getElementById('popularTvSection')
        };
    },

    /**
     * Get full image URL
     */
    getImageUrl(path, size = 'poster') {
        if (!path) return null;
        return `${TMDB_IMAGE_BASE}${IMAGE_SIZES[size]}/${path}`;
    },

    /**
     * Create a media card element
     */
    createMediaCard(item) {
        const card = document.createElement('div');
        card.className = 'media-card';
        card.dataset.id = item.id;
        card.dataset.type = item.media_type;
        
        const title = item.title || item.name || 'Unknown Title';
        const year = (item.release_date || item.first_air_date || '').substring(0, 4);
        const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
        const posterUrl = this.getImageUrl(item.poster_path);
        const typeLabel = item.media_type === 'movie' ? 'Movie' : 'TV';
        
        card.innerHTML = `
            <div class="card-poster-wrapper">
                ${posterUrl 
                    ? `<img class="card-poster" src="${posterUrl}" alt="${title}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'card-poster-placeholder\\'><i class=\\'fas fa-film\\'></i></div>'">`
                    : `<div class="card-poster-placeholder"><i class="fas fa-film"></i></div>`
                }
                <div class="card-type-badge">${typeLabel}</div>
                <div class="card-rating-badge">
                    <i class="fas fa-star"></i>
                    ${rating}
                </div>
                <div class="card-play-overlay">
                    <div class="card-play-icon">
                        <i class="fas fa-play"></i>
                    </div>
                </div>
            </div>
            <div class="card-info">
                <div class="card-title" title="${title}">${title}</div>
                <div class="card-year">${year || 'Unknown Year'}</div>
            </div>
        `;
        
        card.addEventListener('click', () => {
            this.openPlayer(item);
        });
        
        return card;
    },

    /**
     * Create loading skeleton cards
     */
    createSkeletons(count = 10) {
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < count; i++) {
            const skeleton = document.createElement('div');
            skeleton.className = 'skeleton-card';
            skeleton.innerHTML = `
                <div class="skeleton-poster"></div>
                <div class="skeleton-text"></div>
                <div class="skeleton-text" style="width: 60%; margin-bottom: 0.75rem;"></div>
            `;
            fragment.appendChild(skeleton);
        }
        return fragment;
    },

    /**
     * Render a list of items into a container
     */
    renderCards(container, items, useScroll = true) {
        container.innerHTML = '';
        const fragment = document.createDocumentFragment();
        
        items.forEach(item => {
            fragment.appendChild(this.createMediaCard(item));
        });
        
        container.appendChild(fragment);
    },

    /**
     * Render trending section
     */
    async renderTrending() {
        this.elements.trendingGrid.innerHTML = '';
        this.elements.trendingGrid.appendChild(this.createSkeletons(10));
        
        try {
            const data = await api.getTrending();
            this.renderCards(this.elements.trendingGrid, data.results);
        } catch (error) {
            this.elements.trendingGrid.innerHTML = '<p style="color: var(--text-muted);">Unable to load trending content.</p>';
        }
    },

    /**
     * Render popular movies
     */
    async renderPopularMovies() {
        this.elements.popularMoviesGrid.innerHTML = '';
        this.elements.popularMoviesGrid.appendChild(this.createSkeletons(10));
        
        try {
            const data = await api.getPopularMovies();
            const movies = data.results.map(m => ({ ...m, media_type: 'movie' }));
            this.renderCards(this.elements.popularMoviesGrid, movies);
        } catch (error) {
            this.elements.popularMoviesGrid.innerHTML = '<p style="color: var(--text-muted);">Unable to load popular movies.</p>';
        }
    },

    /**
     * Render popular TV shows
     */
    async renderPopularTv() {
        this.elements.popularTvGrid.innerHTML = '';
        this.elements.popularTvGrid.appendChild(this.createSkeletons(10));
        
        try {
            const data = await api.getPopularTv();
            const tvShows = data.results.map(t => ({ ...t, media_type: 'tv' }));
            this.renderCards(this.elements.popularTvGrid, tvShows);
        } catch (error) {
            this.elements.popularTvGrid.innerHTML = '<p style="color: var(--text-muted);">Unable to load popular TV shows.</p>';
        }
    },

    /**
     * Render search results
     */
    renderSearchResults(results, query) {
        this.elements.searchResultsTitle.textContent = `Results for "${query}"`;
        
        if (results.length === 0) {
            this.elements.searchResultsGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                    <i class="fas fa-search" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                    <p style="color: var(--text-muted); font-size: 1.1rem;">No results found for "${query}"</p>
                    <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.5rem;">Try different keywords or check spelling</p>
                </div>
            `;
        } else {
            this.renderCards(this.elements.searchResultsGrid, results, false);
        }
        
        this.elements.searchResultsSection.style.display = 'block';
        this.elements.trendingSection.style.display = 'none';
        this.elements.popularMoviesSection.style.display = 'none';
        this.elements.popularTvSection.style.display = 'none';
        
        this.elements.searchResultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    /**
     * Render recently watched section
     */
    renderRecentlyWatched() {
        if (state.recentlyWatched.length === 0) {
            this.elements.recentlyWatchedSection.style.display = 'none';
            return;
        }
        
        this.elements.recentlyWatchedSection.style.display = 'block';
        this.elements.recentlyWatchedGrid.innerHTML = '';
        
        const fragment = document.createDocumentFragment();
        state.recentlyWatched.forEach(item => {
            const card = this.createMediaCard({
                id: item.id,
                media_type: item.media_type,
                title: item.title,
                name: item.title,
                poster_path: item.poster,
                release_date: item.year ? `${item.year}-01-01` : '',
                first_air_date: item.year ? `${item.year}-01-01` : '',
                vote_average: item.rating
            });
            fragment.appendChild(card);
        });
        
        this.elements.recentlyWatchedGrid.appendChild(fragment);
    },

    /**
     * Open the player modal with media details
     */
    async openPlayer(item) {
        const mediaType = item.media_type;
        const tmdbId = item.id;
        
        // Show modal
        this.elements.playerModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Show loader, hide iframe
        this.elements.playerLoader.classList.remove('hidden');
        this.elements.playerIframe.style.opacity = '0';
        this.elements.playerIframe.src = '';
        
        // Generate embed URL
        const embedUrl = mediaType === 'movie' 
            ? EMBED_URLS.movie(tmdbId) 
            : EMBED_URLS.tv(tmdbId);
        
        // Load iframe
        this.elements.playerIframe.src = embedUrl;
        this.elements.playerIframe.onload = () => {
            this.elements.playerLoader.classList.add('hidden');
            this.elements.playerIframe.style.opacity = '1';
        };
        
        // Fallback: hide loader after 5 seconds if onload doesn't fire
        setTimeout(() => {
            this.elements.playerLoader.classList.add('hidden');
            this.elements.playerIframe.style.opacity = '1';
        }, 5000);
        
        // Load and display media details
        await this.loadMediaDetails(mediaType, tmdbId, item);
        
        // Add to recently watched
        storage.addRecentlyWatched(item);
    },

    /**
     * Load and display detailed media information
     */
    async loadMediaDetails(mediaType, id, basicItem) {
        try {
            const details = await api.getDetails(mediaType, id);
            
            const title = details.title || details.name;
            const year = (details.release_date || details.first_air_date || '').substring(0, 4);
            const rating = details.vote_average ? details.vote_average.toFixed(1) : 'N/A';
            const posterUrl = this.getImageUrl(details.poster_path) || this.getImageUrl(basicItem.poster_path);
            const typeLabel = mediaType === 'movie' ? 'Movie' : 'TV Series';
            
            this.elements.detailsTitle.textContent = title;
            this.elements.detailsYear.textContent = year || 'Unknown';
            this.elements.detailsRatingValue.textContent = rating;
            this.elements.detailsType.textContent = typeLabel;
            this.elements.detailsOverview.textContent = details.overview || 'No overview available.';
            this.elements.detailsTmdbId.textContent = id;
            
            if (posterUrl) {
                this.elements.detailsPoster.src = posterUrl;
                this.elements.detailsPoster.alt = title;
            } else {
                this.elements.detailsPoster.src = '';
                this.elements.detailsPoster.alt = 'No poster';
            }
            
            // Render genres
            this.elements.detailsGenres.innerHTML = '';
            if (details.genres && details.genres.length > 0) {
                details.genres.forEach(genre => {
                    const tag = document.createElement('span');
                    tag.className = 'genre-tag';
                    tag.textContent = genre.name;
                    this.elements.detailsGenres.appendChild(tag);
                });
            }
            
        } catch (error) {
            // Fallback to basic item info
            this.elements.detailsTitle.textContent = basicItem.title || basicItem.name || 'Unknown';
            this.elements.detailsYear.textContent = (basicItem.release_date || basicItem.first_air_date || '').substring(0, 4) || 'Unknown';
            this.elements.detailsRatingValue.textContent = basicItem.vote_average ? basicItem.vote_average.toFixed(1) : 'N/A';
            this.elements.detailsType.textContent = mediaType === 'movie' ? 'Movie' : 'TV Series';
            this.elements.detailsOverview.textContent = 'Details unavailable. Please try again.';
            this.elements.detailsTmdbId.textContent = id;
            this.elements.detailsGenres.innerHTML = '';
        }
    },

    /**
     * Close the player modal
     */
    closePlayer() {
        this.elements.playerModal.classList.remove('active');
        document.body.style.overflow = '';
        this.elements.playerIframe.src = '';
    },

    /**
     * Show search suggestions
     */
    async showSuggestions(query) {
        if (!query || query.length < 2) {
            this.hideSuggestions();
            return;
        }
        
        try {
            const data = await api.searchMulti(query);
            const results = data.results.slice(0, 6);
            
            if (results.length === 0) {
                this.hideSuggestions();
                return;
            }
            
            this.elements.suggestionsDropdown.innerHTML = '';
            results.forEach(item => {
                const suggestion = document.createElement('div');
                suggestion.className = 'suggestion-item';
                
                const title = item.title || item.name;
                const year = (item.release_date || item.first_air_date || '').substring(0, 4);
                const type = item.media_type === 'movie' ? 'Movie' : 'TV';
                const posterUrl = this.getImageUrl(item.poster_path);
                
                suggestion.innerHTML = `
                    ${posterUrl 
                        ? `<img class="suggestion-poster" src="${posterUrl}" alt="${title}" loading="lazy">`
                        : `<div class="suggestion-poster" style="background: var(--bg-tertiary); display: flex; align-items: center; justify-content: center;"><i class="fas fa-film"></i></div>`
                    }
                    <div class="suggestion-info">
                        <div class="suggestion-title">${title}</div>
                        <div class="suggestion-meta">${year || 'Unknown'} • ${type}</div>
                    </div>
                `;
                
                suggestion.addEventListener('click', () => {
                    this.elements.searchInput.value = title;
                    this.hideSuggestions();
                    this.openPlayer(item);
                });
                
                this.elements.suggestionsDropdown.appendChild(suggestion);
            });
            
            this.elements.suggestionsDropdown.classList.add('active');
        } catch (error) {
            this.hideSuggestions();
        }
    },

    /**
     * Hide suggestions dropdown
     */
    hideSuggestions() {
        this.elements.suggestionsDropdown.classList.remove('active');
    },

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        this.elements.toast.textContent = message;
        this.elements.toast.className = `toast show ${type}`;
        
        setTimeout(() => {
            this.elements.toast.classList.remove('show');
        }, 3000);
    },

    /**
     * Apply theme
     */
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        state.currentTheme = theme;
        localStorage.setItem('theme', theme);
        
        const icon = this.elements.themeToggle.querySelector('i');
        icon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    },

    /**
     * Toggle theme
     */
    toggleTheme() {
        const newTheme = state.currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(newTheme);
    },

    /**
     * Show/hide back to top button
     */
    updateBackToTop() {
        if (window.scrollY > 300) {
            this.elements.backToTop.classList.add('visible');
        } else {
            this.elements.backToTop.classList.remove('visible');
        }
    },

    /**
     * Scroll to top
     */
    scrollToTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    /**
     * Update clear button visibility
     */
    updateClearButton() {
        const hasValue = this.elements.searchInput.value.trim().length > 0;
        this.elements.clearBtn.classList.toggle('visible', hasValue);
    }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Debounce function - delays execution until after wait ms
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================
// EVENT HANDLERS
// ============================================
const handlers = {
    /**
     * Handle search submission
     */
    async handleSearch(query) {
        query = query.trim();
        if (!query) {
            ui.showToast('Please enter a search term', 'error');
            return;
        }
        
        ui.hideSuggestions();
        ui.elements.searchInput.value = query;
        ui.elements.heroSearchInput.value = query;
        ui.updateClearButton();
        
        // Show loading state
        ui.elements.searchResultsGrid.innerHTML = '';
        const skeletons = ui.createSkeletons(20);
        ui.elements.searchResultsGrid.appendChild(skeletons);
        ui.elements.searchResultsSection.style.display = 'block';
        ui.elements.trendingSection.style.display = 'none';
        ui.elements.popularMoviesSection.style.display = 'none';
        ui.elements.popularTvSection.style.display = 'none';
        
        try {
            const data = await api.searchMulti(query);
            ui.renderSearchResults(data.results, query);
        } catch (error) {
            ui.elements.searchResultsGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--accent); margin-bottom: 1rem;"></i>
                    <p style="color: var(--text-muted);">Failed to load search results. Please try again.</p>
                </div>
            `;
        }
    },

    /**
     * Handle debounced search input for suggestions
     */
    handleSearchInput: debounce((query) => {
        ui.showSuggestions(query);
    }, 300),

    /**
     * Handle clear search
     */
    handleClearSearch() {
        ui.elements.searchInput.value = '';
        ui.elements.heroSearchInput.value = '';
        ui.updateClearButton();
        ui.hideSuggestions();
        
        // Show main sections again
        ui.elements.searchResultsSection.style.display = 'none';
        ui.elements.trendingSection.style.display = 'block';
        ui.elements.popularMoviesSection.style.display = 'block';
        ui.elements.popularTvSection.style.display = 'block';
        
        ui.elements.searchInput.focus();
    },

    /**
     * Handle back to home (click logo)
     */
    handleBackToHome() {
        handlers.handleClearSearch();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

// ============================================
// EVENT LISTENERS SETUP
// ============================================
function setupEventListeners() {
    // Search input events
    ui.elements.searchInput.addEventListener('input', (e) => {
        handlers.handleSearchInput(e.target.value);
        ui.elements.heroSearchInput.value = e.target.value;
        ui.updateClearButton();
    });
    
    ui.elements.heroSearchInput.addEventListener('input', (e) => {
        ui.elements.searchInput.value = e.target.value;
        ui.updateClearButton();
        handlers.handleSearchInput(e.target.value);
    });
    
    // Enter key to search
    ui.elements.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handlers.handleSearch(e.target.value);
        }
    });
    
    ui.elements.heroSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handlers.handleSearch(e.target.value);
        }
    });
    
    // Search buttons
    ui.elements.searchBtn.addEventListener('click', () => {
        handlers.handleSearch(ui.elements.searchInput.value);
    });
    
    ui.elements.heroSearchBtn.addEventListener('click', () => {
        handlers.handleSearch(ui.elements.heroSearchInput.value);
    });
    
    // Clear search button
    ui.elements.clearBtn.addEventListener('click', handlers.handleClearSearch);
    
    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-wrapper')) {
            ui.hideSuggestions();
        }
    });
    
    // Theme toggle
    ui.elements.themeToggle.addEventListener('click', () => ui.toggleTheme());
    
    // Player close button
    ui.elements.playerCloseBtn.addEventListener('click', () => ui.closePlayer());
    
    // Close player on backdrop click
    ui.elements.playerModal.addEventListener('click', (e) => {
        if (e.target === ui.elements.playerModal) {
            ui.closePlayer();
        }
    });
    
    // Escape key to close player
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && ui.elements.playerModal.classList.contains('active')) {
            ui.closePlayer();
        }
    });
    
    // Clear history button
    ui.elements.clearHistoryBtn.addEventListener('click', () => {
        if (confirm('Clear all watch history?')) {
            storage.clearRecentlyWatched();
        }
    });
    
    // Logo click - back to home
    document.querySelector('.nav-brand').addEventListener('click', handlers.handleBackToHome);
    
    // Back to top button
    ui.elements.backToTop.addEventListener('click', () => ui.scrollToTop());
    
    // Scroll events
    window.addEventListener('scroll', () => {
        ui.updateBackToTop();
        
        // Navbar shadow on scroll
        if (window.scrollY > 10) {
            ui.elements.navbar.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
        } else {
            ui.elements.navbar.style.boxShadow = 'none';
        }
    });
}

// ============================================
// APPLICATION INITIALIZATION
// ============================================
async function initApp() {
    // Validate API key
    if (TMDB_API_KEY === "YOUR_TMDB_API_KEY" || !TMDB_API_KEY) {
        document.body.innerHTML = `
            <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem; text-align: center; background: #0a0a0f; color: white; font-family: 'Poppins', sans-serif;">
                <div style="max-width: 600px;">
                    <i class="fas fa-key" style="font-size: 4rem; color: #e50914; margin-bottom: 1rem;"></i>
                    <h1 style="margin-bottom: 1rem;">API Key Required</h1>
                    <p style="color: #b3b3b3; margin-bottom: 1.5rem;">
                        Please insert your TMDB API key in <code style="background: #1a1a22; padding: 0.25rem 0.5rem; border-radius: 4px;">app.js</code> 
                        at the top of the file.
                    </p>
                    <p style="color: #777; font-size: 0.9rem;">
                        Get a free API key at 
                        <a href="https://www.themoviedb.org/settings/api" target="_blank" style="color: #e50914;">themoviedb.org</a>
                    </p>
                </div>
            </div>
        `;
        return;
    }
    
    // Initialize UI elements
    ui.initElements();
    
    // Apply saved theme
    ui.applyTheme(state.currentTheme);
    
    // Setup all event listeners
    setupEventListeners();
    
    // Render recently watched (if any)
    ui.renderRecentlyWatched();
    
    // Load initial content in parallel for performance
    try {
        await Promise.all([
            ui.renderTrending(),
            ui.renderPopularMovies(),
            ui.renderPopularTv()
        ]);
    } catch (error) {
        console.error('Failed to load initial content:', error);
    }
    
    console.log('%c🎬 StreamFlix Loaded Successfully!', 'color: #e50914; font-size: 16px; font-weight: bold;');
    console.log('%cPowered by TMDB API', 'color: #b3b3b3;');
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
                       }
