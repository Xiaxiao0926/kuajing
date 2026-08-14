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

        