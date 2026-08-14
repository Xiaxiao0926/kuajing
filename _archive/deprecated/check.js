
        let allResults = [];
        let currentFilter = 'all';
        let currentPage = 1;
        const pageSize = 15;

        let allMarketData = [];
        let filteredMarketData = [];
        let currentMarketPage = 1;
        const marketPageSize = 50;

        function switchTab(tab) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
            
            if (tab === 'analysis') {
                document.querySelectorAll('.tab')[0].classList.add('active');
                document.getElementById('analysis-panel').classList.add('active');
                loadAnalysisData();
            } else {
                document.querySelectorAll('.tab')[1].classList.add('active');
                document.getElementById('market-panel').classList.add('active');
                loadMarketData();
            }
        }

        async function loadAnalysisData() {
            try {
                const summaryRes = await fetch('/api/summary');
                const summary = await summaryRes.json();
                updateSummary(summary);
                
                const resultsRes = await fetch('/api/results');
                allResults = await resultsRes.json();
                updateAdvantageCounts();
                renderResults();
            } catch (error) {
                console.error('加载数据失败:', error);
            }
        }

        function updateSummary(summary) {
            document.getElementById('total-count').textContent = summary.total;
            document.getElementById('matched-count').textContent = summary.matchedCount;
            document.getElementById('unmatched-count').textContent = summary.unmatchedCount;
            document.getElementById('review-count').textContent = summary.reviewCount || 0;
            document.getElementById('update-time').textContent = '更新时间: ' + summary.updateTime;
            
            document.getElementById('all-count').textContent = summary.total;
            document.getElementById('matched-tab-count').textContent = summary.matchedCount;
            document.getElementById('unmatched-tab-count').textContent = summary.unmatchedCount;
            document.getElementById('review-tab-count').textContent = summary.reviewCount || 0;
        }

        function updateAdvantageCounts() {
            const advantageCount = allResults.filter(r => r.hasAdvantage).length;
            const noAdvantageCount = allResults.filter(r => r.status === '已匹配' && !r.hasAdvantage).length;
            document.getElementById('advantage-count').textContent = advantageCount;
            document.getElementById('noadvantage-count').textContent = noAdvantageCount;
            document.getElementById('advantage-tab-count').textContent = advantageCount;
            document.getElementById('noadvantage-tab-count').textContent = noAdvantageCount;
        }

        function filterResults(filter) {
            currentFilter = filter;
            currentPage = 1;
            
            document.querySelectorAll('.filter-tab').forEach(tab => tab.classList.remove('active'));
            const filterMap = { 'all': 0, 'matched': 1, 'unmatched': 2, 'review': 3, 'advantage': 4, 'noadvantage': 5 };
            document.querySelectorAll('.filter-tab')[filterMap[filter]].classList.add('active');
            
            renderResults();
        }

        function getFilteredResults() {
            switch (currentFilter) {
                case 'all': return allResults;
                case 'matched': return allResults.filter(r => r.status === '已匹配');
                case 'unmatched': return allResults.filter(r => r.status === '未匹配');
                case 'review': return allResults.filter(r => r.status === '需要人工复核');
                case 'advantage': return allResults.filter(r => r.hasAdvantage);
                case 'noadvantage': return allResults.filter(r => r.status === '已匹配' && !r.hasAdvantage);
                default: return allResults;
            }
        }

        function renderResults() {
            const filtered = getFilteredResults();
            const totalPages = Math.ceil(filtered.length / pageSize);
            const start = (currentPage - 1) * pageSize;
            const pageData = filtered.slice(start, start + pageSize);

            const container = document.getElementById('results-container');
            
            if (pageData.length === 0) {
                container.innerHTML = '<div class="loading">暂无数据</div>';
                document.getElementById('pagination').innerHTML = '';
                return;
            }

            container.innerHTML = pageData.map((result, resultIndex) => {
                const globalIdx = (currentPage - 1) * pageSize + resultIndex;
                return `
                <div class="result-card" data-result-idx="${globalIdx}">
                    <div class="result-header">
                        <div>
                            <span class="status-badge ${
                                result.status === '已匹配' ? 'status-matched' : 
                                result.status === '需要人工复核' ? 'status-review' : 'status-unmatched'
                            }">${result.status}</span>
                        </div>
                        <div class="query-name">${result.queryName}</div>
                        <div class="price-info">
                            <div class="price-value">¥${result.supplierPrice || '--'}</div>
                            <div class="price-type">${result.priceType}</div>
                        </div>
                        <div>
                            <span class="advantage-badge ${result.hasAdvantage ? 'advantage-positive' : 'advantage-negative'}">
                                ${result.priceAdvantage || '--'}
                            </span>
                        </div>
                        <div class="market-count">${result.marketCount}个报价</div>
                        <div class="min-price-box">
                            <div>最低 <span class="min-price-value">¥${result.minPrice || '--'}</span></div>
                        </div>
                        <div style="font-size: 0.7rem; color: #9ca3af;">${result.category || '--'}</div>
                    </div>
                    ${result.minPriceItem && result.minPriceItem.title ? `
                        <div class="min-price-detail">
                            <div class="min-price-detail-title">⭐ 最低价详情</div>
                            <div style="font-size: 0.75rem; line-height: 1.4;">
                                <div style="font-weight: 500;">${result.minPriceItem.original_title || result.minPriceItem.title}</div>
                                <div>店铺: ${result.minPriceItem.shop || '--'}</div>
                                ${result.minPriceItem.link ? `<div>链接: <a href="${result.minPriceItem.link}" target="_blank" style="color:#667eea;">🔗 点击查看</a></div>` : ''}
                            </div>
                        </div>
                    ` : ''}
                    ${result.candidates && result.candidates.filter(c=>c).length > 0 ? `
                        <div class="candidates-section" id="candidates-section-${globalIdx}">
                            <div class="candidates-header">📦 候选报价 <span id="candidates-count-${globalIdx}">${result.candidates.filter(c=>c).length}</span>个</div>
                            <div class="candidates-grid" id="candidates-grid-${globalIdx}">
                            </div>
                        </div>
                    ` : ''}
                </div>
            `).join('');

            renderPagination(totalPages);

            // 渲染所有候选卡片
            pageData.forEach((result, idx) => {
                const globalIdx = (currentPage - 1) * pageSize + idx;
                renderCandidates(result, globalIdx);
            });
        }

        function renderPagination(totalPages) {
            const pagination = document.getElementById('pagination');
            if (totalPages <= 1) { pagination.innerHTML = ''; return; }

            let html = `<button class="page-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>上一页</button>`;
            const maxVisible = 5;
            let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
            let end = Math.min(totalPages, start + maxVisible - 1);
            for (let i = start; i <= end; i++) {
                html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
            }
            html += `<button class="page-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>下一页</button>`;
            pagination.innerHTML = html;
        }

        const DISPLAY_COUNT = 4; // 前端展示的候选数量
        // 存储每个结果的候选状态：{ globalIdx: { visible: [候选索引], rejected: [候选索引] } }
        const candidateStates = {};

        function renderCandidates(result, globalIdx) {
            const grid = document.getElementById(`candidates-grid-${globalIdx}`);
            if (!grid || !result.candidates) return;

            // 初始化状态
            if (!candidateStates[globalIdx]) {
                candidateStates[globalIdx] = {
                    visible: result.candidates.map((c, i) => c ? i : -1).filter(i => i >= 0),
                    rejected: []
                };
            }

            const state = candidateStates[globalIdx];
            const visibleCandidates = state.visible.filter(i => !state.rejected.includes(i));
            const displayCandidates = visibleCandidates.slice(0, DISPLAY_COUNT);

            // 更新计数
            const countEl = document.getElementById(`candidates-count-${globalIdx}`);
            if (countEl) countEl.textContent = visibleCandidates.length;

            grid.innerHTML = displayCandidates.map((candIdx, displayIdx) => {
                const candidate = result.candidates[candIdx];
                if (!candidate) return '';
                return `
                    <div class="candidate-card" data-cand-idx="${candIdx}">
                        <div class="candidate-header">
                            <span style="font-size: 0.65rem; color: #667eea; font-weight: 600;">候选${displayIdx + 1}</span>
                            <span class="similarity-tag">${candidate.similarity}</span>
                            ${candidate.needsReview ? '<span class="similarity-tag warning-tag">需复核</span>' : ''}
                        </div>
                        <div class="candidate-title">${candidate.original_title || candidate.title}</div>
                        <div style="font-weight: 600; color: #ef4444;">¥${candidate.price} ${candidate.spec ? '<span style="font-weight:400;color:#6b7280;font-size:0.7rem;">' + candidate.spec + '</span>' : ''}</div>
                        <div class="candidate-shop">店铺: ${candidate.shop || '--'}</div>
                        ${candidate.link ? `<div style="margin-top:2px;"><a href="${candidate.link}" target="_blank" style="color:#667eea;font-size:0.7rem;text-decoration:none;">🔗 查看链接</a></div>` : ''}
                        <div style="margin-top:4px; display:flex; gap:4px;">
                            <button onclick="tagCandidate(this, '符合', ${globalIdx}, ${candIdx})" style="padding:1px 8px; border-radius:3px; border:1px solid #10b981; background:#f0fdf4; color:#10b981; font-size:0.65rem; cursor:pointer;">符合</button>
                            <button onclick="rejectCandidate(${globalIdx}, ${candIdx})" style="padding:1px 8px; border-radius:3px; border:1px solid #ef4444; background:#fef2f2; color:#ef4444; font-size:0.65rem; cursor:pointer;">不符合</button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function tagCandidate(btn, tag, globalIdx, candIdx) {
            const card = btn.closest('.candidate-card');
            const buttons = card.querySelectorAll('button');
            buttons.forEach(b => {
                b.style.fontWeight = '400';
                b.style.opacity = '0.6';
            });
            btn.style.fontWeight = '700';
            btn.style.opacity = '1';
            let tagEl = card.querySelector('.tag-result');
            if (!tagEl) {
                tagEl = document.createElement('span');
                tagEl.className = 'tag-result';
                tagEl.style.cssText = 'display:inline-block;margin-left:6px;padding:1px 6px;border-radius:3px;font-size:0.65rem;font-weight:600;';
                card.querySelector('.candidate-header').appendChild(tagEl);
            }
            if (tag === '符合') {
                tagEl.textContent = '✓ 符合';
                tagEl.style.background = '#dcfce7';
                tagEl.style.color = '#16a34a';
            }
        }

        function rejectCandidate(globalIdx, candIdx) {
            if (!candidateStates[globalIdx]) return;
            candidateStates[globalIdx].rejected.push(candIdx);
            // 重新渲染该结果的候选
            const filtered = getFilteredResults();
            const start = (currentPage - 1) * pageSize;
            const localIdx = globalIdx - start;
            if (localIdx >= 0 && localIdx < filtered.length) {
                renderCandidates(filtered[localIdx], globalIdx);
                // 更新最低价和最低价详情
                updateMinPrice(filtered[localIdx], globalIdx);
            }
        }

        function updateMinPrice(result, globalIdx) {
            if (!candidateStates[globalIdx] || !result.candidates) return;
            const state = candidateStates[globalIdx];
            const visibleCandidates = state.visible.filter(i => !state.rejected.includes(i));
            // 从未被拒绝的候选中找最低价
            let newMinCandidate = null;
            for (const idx of visibleCandidates) {
                const c = result.candidates[idx];
                if (c && c.price && (!newMinCandidate || c.price < newMinCandidate.price)) {
                    newMinCandidate = c;
                }
            }
            const card = document.querySelector(`.result-card[data-result-idx="${globalIdx}"]`);
            if (!card) return;

            // 更新最低价数字
            const minPriceEl = card.querySelector('.min-price-value');
            if (minPriceEl) {
                minPriceEl.textContent = newMinCandidate ? `¥${newMinCandidate.price}` : '--';
            }

            // 更新最低价详情
            const detailEl = card.querySelector('.min-price-detail');
            if (newMinCandidate) {
                const detailHtml = `
                    <div class="min-price-detail-title">⭐ 最低价详情</div>
                    <div style="font-size: 0.75rem; line-height: 1.4;">
                        <div style="font-weight: 500;">${newMinCandidate.original_title || newMinCandidate.title}</div>
                        <div>店铺: ${newMinCandidate.shop || '--'}</div>
                        ${newMinCandidate.link ? `<div>链接: <a href="${newMinCandidate.link}" target="_blank" style="color:#667eea;">🔗 点击查看</a></div>` : ''}
                    </div>
                `;
                if (detailEl) {
                    detailEl.innerHTML = detailHtml;
                } else {
                    const newDetail = document.createElement('div');
                    newDetail.className = 'min-price-detail';
                    newDetail.innerHTML = detailHtml;
                    const header = card.querySelector('.result-header');
                    if (header && header.nextSibling) {
                        header.parentNode.insertBefore(newDetail, header.nextSibling);
                    }
                }
            } else if (detailEl) {
                detailEl.remove();
            }

            // 更新价格优势
            if (newMinCandidate && result.supplierPrice) {
                const diff = result.supplierPrice - newMinCandidate.price;
                const pct = ((diff / newMinCandidate.price) * 100).toFixed(1);
                const advantageEl = card.querySelector('.advantage-badge');
                if (advantageEl) {
                    if (diff <= 0) {
                        advantageEl.textContent = `低于市场${Math.abs(pct)}%`;
                        advantageEl.className = 'advantage-badge advantage-positive';
                    } else {
                        advantageEl.textContent = `高于市场${pct}%`;
                        advantageEl.className = 'advantage-badge advantage-negative';
                    }
                }
            }
        }

        function goToPage(page) {
            if (page < 1 || page > Math.ceil(getFilteredResults().length / pageSize)) return;
            currentPage = page;
            renderResults();
        }

        async function exportData() {
            try {
                const response = await fetch('/api/export');
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = '价格优势分析结果.xlsx';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            } catch (error) {
                console.error('导出失败:', error);
                alert('导出失败，请重试');
            }
        }

        async function loadMarketData() {
            try {
                const summaryRes = await fetch('/api/cleaned-summary');
                const summary = await summaryRes.json();
                updateMarketSummary(summary);
                
                const dataRes = await fetch('/api/cleaned');
                const dataJson = await dataRes.json();
                allMarketData = dataJson.data || [];
                if (allMarketData.length === 0) {
                    const allDataRes = await fetch('/api/cleaned?pageSize=99999');
                    const allDataJson = await allDataRes.json();
                    allMarketData = allDataJson.data || [];
                }
                
                populateMarketFilters(summary);
                filteredMarketData = [...allMarketData];
                renderMarketData();
            } catch (error) {
                console.error('加载市场数据失败:', error);
            }
        }

        function updateMarketSummary(summary) {
            document.getElementById('market-total').textContent = summary.total;
            document.getElementById('market-brands').textContent = Object.keys(summary.brandCount || {}).length;
            document.getElementById('market-types').textContent = Object.keys(summary.typeCount || {}).length;
            document.getElementById('market-files').textContent = Object.keys(summary.fileCount || {}).length;
            document.getElementById('market-update-time').textContent = '更新时间: ' + summary.updateTime;
            
            const statsHTML = `
                <div class="stats-section">
                    <h4>🔥 热门品牌</h4>
                    <div class="stats-list">
                        ${Object.entries(summary.brandCount || {})
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 15)
                            .map(([brand, count]) => `
                                <div class="stats-item">
                                    <span class="name">${brand || '未知'}</span>
                                    <span class="count">${count}</span>
                                </div>
                            `).join('')}
                    </div>
                </div>
                <div class="stats-section">
                    <h4>📦 产品类型分布</h4>
                    <div class="stats-list">
                        ${Object.entries(summary.typeCount || {})
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 15)
                            .map(([type, count]) => `
                                <div class="stats-item">
                                    <span class="name">${type}</span>
                                    <span class="count">${count}</span>
                                </div>
                            `).join('')}
                    </div>
                </div>
                <div class="stats-section">
                    <h4>🏷️ 系列分布</h4>
                    <div class="stats-list">
                        ${Object.entries(summary.seriesCount || {})
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 15)
                            .map(([series, count]) => `
                                <div class="stats-item">
                                    <span class="name">${series}</span>
                                    <span class="count">${count}</span>
                                </div>
                            `).join('')}
                    </div>
                </div>
            `;
            document.getElementById('market-stats-details').innerHTML = statsHTML;
        }

        function populateMarketFilters(summary) {
            const brands = new Set();
            const types = new Set();
            const seriesList = new Set();
            
            allMarketData.forEach(item => {
                if (item.brand) brands.add(item.brand);
                if (item.product_type) {
                    item.product_type.split('|').forEach(t => { if (t) types.add(t); });
                }
                if (item.series) seriesList.add(item.series);
            });

            if (summary) {
                Object.keys(summary.brandCount || {}).forEach(b => brands.add(b));
                Object.keys(summary.typeCount || {}).forEach(t => types.add(t));
                Object.keys(summary.seriesCount || {}).forEach(s => seriesList.add(s));
            }
            
            const brandSelect = document.getElementById('brand-filter');
            const typeSelect = document.getElementById('type-filter');
            const seriesSelect = document.getElementById('series-filter');
            brandSelect.innerHTML = '<option value="">全部品牌</option>';
            typeSelect.innerHTML = '<option value="">全部类型</option>';
            seriesSelect.innerHTML = '<option value="">全部系列</option>';
            
            [...brands].sort().forEach(brand => {
                brandSelect.innerHTML += `<option value="${brand}">${brand}</option>`;
            });
            [...types].sort().forEach(type => {
                typeSelect.innerHTML += `<option value="${type}">${type}</option>`;
            });
            [...seriesList].sort().forEach(s => {
                seriesSelect.innerHTML += `<option value="${s}">${s}</option>`;
            });
        }

        function applyMarketFilters() {
            const brandFilter = document.getElementById('brand-filter').value;
            const typeFilter = document.getElementById('type-filter').value;
            const seriesFilter = document.getElementById('series-filter').value;
            const search = document.getElementById('search-filter').value.toLowerCase();
            const minPrice = parseFloat(document.getElementById('min-price-filter').value) || 0;
            const maxPrice = parseFloat(document.getElementById('max-price-filter').value) || Infinity;
            
            filteredMarketData = allMarketData.filter(item => {
                if (brandFilter && item.brand !== brandFilter) return false;
                if (typeFilter && !(item.product_type || '').includes(typeFilter)) return false;
                if (seriesFilter && item.series !== seriesFilter) return false;
                if (search && !item.title.toLowerCase().includes(search) && !((item.original_title || '').toLowerCase().includes(search))) return false;
                if (item.price < minPrice || item.price > maxPrice) return false;
                return true;
            });
            
            currentMarketPage = 1;
            renderMarketData();
        }

        function renderMarketData() {
            const totalPages = Math.ceil(filteredMarketData.length / marketPageSize);
            const start = (currentMarketPage - 1) * marketPageSize;
            const pageData = filteredMarketData.slice(start, start + marketPageSize);

            document.getElementById('market-count-label').textContent = `(${filteredMarketData.length} 条)`;

            const tbody = document.getElementById('market-data-body');
            
            if (pageData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="10" class="loading">暂无数据</td></tr>';
                document.getElementById('market-pagination').innerHTML = '';
                return;
            }

            tbody.innerHTML = pageData.map((item, index) => `
                <tr>
                    <td>${start + index + 1}</td>
                    <td>${item.brand ? `<span class="badge badge-brand">${item.brand}</span>` : '-'}</td>
                    <td class="title-cell" title="${item.original_title || item.title}">${item.original_title || item.title}</td>
                    <td style="font-weight: 600; color: #ef4444;">¥${item.price}</td>
                    <td>${item.capacity || item.spec || '-'}</td>
                    <td>${item.product_type ? item.product_type.split('|').map(t => `<span class="badge badge-type">${t}</span>`).join(' ') : '-'}</td>
                    <td>${item.series ? `<span class="badge badge-series">${item.series}</span>` : '-'}</td>
                    <td class="shop-cell" title="${item.shop}">${item.shop || '-'}</td>
                    <td style="font-size: 0.75rem;">${item.link ? `<a href="${item.link}" target="_blank" style="color:#667eea;">🔗</a>` : '-'}</td>
                    <td style="font-size: 0.75rem; color: #6b7280;">${(item.source_file || '').slice(0, 20)}</td>
                </tr>
            `).join('');

            renderMarketPagination(totalPages);
        }

        function renderMarketPagination(totalPages) {
            const pagination = document.getElementById('market-pagination');
            if (totalPages <= 1) { pagination.innerHTML = ''; return; }

            let html = `<button class="page-btn" onclick="goToMarketPage(${currentMarketPage - 1})" ${currentMarketPage === 1 ? 'disabled' : ''}>上一页</button>`;
            const maxVisible = 7;
            let start = Math.max(1, currentMarketPage - Math.floor(maxVisible / 2));
            let end = Math.min(totalPages, start + maxVisible - 1);
            for (let i = start; i <= end; i++) {
                html += `<button class="page-btn ${i === currentMarketPage ? 'active' : ''}" onclick="goToMarketPage(${i})">${i}</button>`;
            }
            html += `<button class="page-btn" onclick="goToMarketPage(${currentMarketPage + 1})" ${currentMarketPage === totalPages ? 'disabled' : ''}>下一页</button>`;
            pagination.innerHTML = html;
        }

        function goToMarketPage(page) {
            if (page < 1 || page > Math.ceil(filteredMarketData.length / marketPageSize)) return;
            currentMarketPage = page;
            renderMarketData();
        }

        document.addEventListener('DOMContentLoaded', loadAnalysisData);
    